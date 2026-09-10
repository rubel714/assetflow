const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME || "assetflowdb", table, column]
  );
  return rows[0].c > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [process.env.DB_NAME || "assetflowdb", table]
  );
  return rows[0].c > 0;
}

async function constraintExists(conn, table, constraint) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [process.env.DB_NAME || "assetflowdb", table, constraint]
  );
  return rows[0].c > 0;
}

async function addColumnIfMissing(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
  }
}

async function dropColumnIfExists(conn, table, column) {
  if (await columnExists(conn, table, column)) {
    await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }
}

async function ensureUserDesignationLink(conn) {
  await addColumnIfMissing(conn, "users", "DesignationId", "INT NULL");
  if (await columnExists(conn, "users", "Designation")) {
    const [rows] = await conn.query(
      `SELECT UserId, OrganizationId, Designation
       FROM users
       WHERE Designation IS NOT NULL AND TRIM(Designation) <> ""`
    );
    for (const row of rows) {
      if (!row.OrganizationId) continue;
      const name = String(row.Designation).trim();
      const [existing] = await conn.query(
        "SELECT DesignationId FROM designations WHERE OrganizationId = ? AND Name = ? LIMIT 1",
        [row.OrganizationId, name]
      );
      let designationId = existing[0]?.DesignationId;
      if (!designationId) {
        const [inserted] = await conn.query(
          "INSERT INTO designations (OrganizationId, Name) VALUES (?, ?)",
          [row.OrganizationId, name]
        );
        designationId = inserted.insertId;
      }
      await conn.query("UPDATE users SET DesignationId = ? WHERE UserId = ?", [designationId, row.UserId]);
    }
    await dropColumnIfExists(conn, "users", "Designation");
  }
  await addFkIfMissing(conn, "fk_users_designation", "users", "DesignationId", "designations", "DesignationId");
}

async function addFkIfMissing(conn, constraint, table, column, refTable, refColumn) {
  if (await constraintExists(conn, table, constraint)) return;
  await conn.query(
    `ALTER TABLE \`${table}\`
     ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (${column}) REFERENCES \`${refTable}\` (${refColumn})`
  );
}

async function ensureVendorContactColumns(conn) {
  const contactColumns = [
    ["ContactName", "VARCHAR(150) NULL"],
    ["Email", "VARCHAR(150) NULL"],
    ["Phone", "VARCHAR(50) NULL"],
    ["Address", "VARCHAR(255) NULL"],
    ["Website", "VARCHAR(200) NULL"],
  ];
  for (const table of ["suppliers", "manufacturers"]) {
    for (const [column, definition] of contactColumns) {
      await addColumnIfMissing(conn, table, column, definition);
    }
  }
}

async function ensureAssetLookupColumns(conn) {
  await addColumnIfMissing(conn, "assets", "SupplierId", "INT NULL");
  await addColumnIfMissing(conn, "assets", "ManufacturerId", "INT NULL");
  await addColumnIfMissing(conn, "assets", "CountryOfOriginId", "INT NULL");
  await addColumnIfMissing(conn, "assets", "ReceiveDate", "DATE NULL");
  await addColumnIfMissing(conn, "assets", "LastWarrantyDate", "DATE NULL");
  await addColumnIfMissing(conn, "assets", "MaintenanceScheduleId", "INT NULL");
  await addColumnIfMissing(conn, "assets", "Remarks", "TEXT NULL");
  await addColumnIfMissing(conn, "assets", "ImagePath", "VARCHAR(255) NULL");
  await addFkIfMissing(conn, "fk_assets_supplier", "assets", "SupplierId", "suppliers", "SupplierId");
  await addFkIfMissing(conn, "fk_assets_manufacturer", "assets", "ManufacturerId", "manufacturers", "ManufacturerId");
  await addFkIfMissing(conn, "fk_assets_country", "assets", "CountryOfOriginId", "countries", "CountryId");
  await addFkIfMissing(conn, "fk_assets_maint", "assets", "MaintenanceScheduleId", "maintenance_schedules", "MaintenanceScheduleId");
}

async function migrate() {
  const dbName = process.env.DB_NAME || "assetflowdb";
  const root = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.query(`USE \`${dbName}\``);

  const usersExisted = await tableExists(root, "users");
  const oldUsers =
    usersExisted && !(await columnExists(root, "users", "RoleKey"));

  if (oldUsers) {
    await root.query("RENAME TABLE users TO users_legacy");
  }

  const schemaPath = path.join(__dirname, "../../../database/schema.sql");
  let sql = fs.readFileSync(schemaPath, "utf8");
  sql = sql
    .replace(/CREATE DATABASE[\s\S]*?USE assetflowdb;/, "")
    .trim();
  await root.query(sql);

  await ensureVendorContactColumns(root);
  await ensureAssetLookupColumns(root);
  await addColumnIfMissing(root, "users", "ImagePath", "VARCHAR(255) NULL");
  await addColumnIfMissing(root, "users", "Phone", "VARCHAR(50) NULL");
  await addColumnIfMissing(root, "users", "Email", "VARCHAR(150) NULL");
  await addColumnIfMissing(root, "users", "Address", "VARCHAR(255) NULL");
  await ensureUserDesignationLink(root);

  const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require("../lib/permissions");
  for (const key of Object.values(ROLES)) {
    await root.query("INSERT IGNORE INTO roles (RoleKey, Name) VALUES (?, ?)", [
      key,
      key,
    ]);
  }
  for (const key of Object.values(PERMISSIONS)) {
    await root.query(
      "INSERT IGNORE INTO permissions (PermissionKey, Name) VALUES (?, ?)",
      [key, key]
    );
  }
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const perm of perms) {
      await root.query(
        "INSERT IGNORE INTO role_permissions (RoleKey, PermissionKey) VALUES (?, ?)",
        [role, perm]
      );
    }
  }

  if (oldUsers) {
    const [legacy] = await root.query(
      "SELECT UserId, Username, Password, FullName, Role, CreatedAt FROM users_legacy"
    );
    for (const row of legacy) {
      const roleKey =
        row.Role === "admin" || row.Role === "organization_admin"
          ? "organization_admin"
          : row.Role === "asset_manager" || row.Role === "manager"
            ? "asset_manager"
            : "employee";
      await root.query(
        `INSERT IGNORE INTO users
          (UserId, Username, Password, FullName, RoleKey, Status, CreatedAt)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        [row.UserId, row.Username, row.Password, row.FullName, roleKey, row.CreatedAt]
      );
    }
    await root.query("DROP TABLE users_legacy");
  }

  await root.end();
}

module.exports = migrate;
