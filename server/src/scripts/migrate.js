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

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [process.env.DB_NAME || "assetflowdb", table, indexName]
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

async function ensureOrganizationProfileColumns(conn) {
  await addColumnIfMissing(conn, "organizations", "LegalName", "VARCHAR(200) NULL");
  await addColumnIfMissing(conn, "organizations", "Code", "VARCHAR(20) NULL");
  await addColumnIfMissing(conn, "organizations", "Email", "VARCHAR(150) NULL");
  await addColumnIfMissing(conn, "organizations", "Phone", "VARCHAR(50) NULL");
  await addColumnIfMissing(conn, "organizations", "Website", "VARCHAR(255) NULL");
  await addColumnIfMissing(conn, "organizations", "Address", "VARCHAR(255) NULL");
  await addColumnIfMissing(conn, "organizations", "CountryId", "INT NULL");
  await addColumnIfMissing(conn, "organizations", "LogoPath", "VARCHAR(255) NULL");
  const [orgs] = await conn.query(
    "SELECT OrganizationId, Code FROM organizations WHERE Code IS NULL OR TRIM(Code) = ''"
  );
  for (const org of orgs) {
    await conn.query("UPDATE organizations SET Code = ? WHERE OrganizationId = ?", [
      `ORG${org.OrganizationId}`,
      org.OrganizationId,
    ]);
  }
  await conn.query("ALTER TABLE organizations MODIFY Code VARCHAR(20) NOT NULL");
  if (!(await indexExists(conn, "organizations", "uq_organizations_code"))) {
    await conn.query("CREATE UNIQUE INDEX uq_organizations_code ON organizations (Code)");
  }
  if (await tableExists(conn, "countries")) {
    await addFkIfMissing(
      conn,
      "fk_org_country",
      "organizations",
      "CountryId",
      "countries",
      "CountryId"
    );
  }
}

async function ensureOrganizationLicenseColumns(conn) {
  await addColumnIfMissing(conn, "organizations", "Status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addColumnIfMissing(conn, "organizations", "AccessStartsAt", "DATETIME NULL");
  await addColumnIfMissing(conn, "organizations", "AccessEndsAt", "DATETIME NULL");
  await addColumnIfMissing(conn, "organizations", "MaxUsers", "INT NULL");
  await addColumnIfMissing(conn, "organizations", "MaxAssets", "INT NULL");
}

async function ensureUserEmailIdentity(conn) {
  await addColumnIfMissing(conn, "users", "Email", "VARCHAR(150) NULL");
  await conn.query(
    `UPDATE users
     SET Email = LOWER(TRIM(Email))
     WHERE Email IS NOT NULL AND TRIM(Email) <> ''`
  );
  const hasUsername = await columnExists(conn, "users", "Username");
  const [missing] = await conn.query(
    hasUsername
      ? "SELECT UserId, Username FROM users WHERE Email IS NULL OR TRIM(Email) = ''"
      : "SELECT UserId FROM users WHERE Email IS NULL OR TRIM(Email) = ''"
  );
  for (const user of missing) {
    const handle = String(user.Username || `user${user.UserId}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-");
    await conn.query("UPDATE users SET Email = ? WHERE UserId = ?", [
      `${handle || `user${user.UserId}`}@assetflow.local`,
      user.UserId,
    ]);
  }

  const [dupes] = await conn.query(
    `SELECT Email
     FROM users
     WHERE Email IS NOT NULL
     GROUP BY Email
     HAVING COUNT(*) > 1`
  );
  for (const row of dupes) {
    const [users] = await conn.query(
      "SELECT UserId FROM users WHERE Email = ? ORDER BY UserId ASC",
      [row.Email]
    );
    for (const [index, user] of users.entries()) {
      if (index === 0) continue;
      await conn.query("UPDATE users SET Email = ? WHERE UserId = ?", [
        `user${user.UserId}@assetflow.local`,
        user.UserId,
      ]);
    }
  }

  await conn.query("ALTER TABLE users MODIFY Email VARCHAR(150) NOT NULL");
  if (!(await indexExists(conn, "users", "uq_users_email"))) {
    await conn.query("CREATE UNIQUE INDEX uq_users_email ON users (Email)");
  }
  await dropColumnIfExists(conn, "users", "Username");
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
  await ensureOrganizationProfileColumns(root);
  await ensureOrganizationLicenseColumns(root);
  await addColumnIfMissing(root, "users", "ImagePath", "VARCHAR(255) NULL");
  await addColumnIfMissing(root, "users", "Phone", "VARCHAR(50) NULL");
  await addColumnIfMissing(root, "users", "Address", "VARCHAR(255) NULL");
  await ensureUserEmailIdentity(root);
  await ensureUserDesignationLink(root);
  await addColumnIfMissing(
    root,
    "asset_assignments",
    "AcceptanceStatus",
    "VARCHAR(20) NOT NULL DEFAULT 'accepted'"
  );
  await addColumnIfMissing(root, "asset_assignments", "AcceptedAt", "DATETIME NULL");

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
      const emailHandle = String(row.Username || `user${row.UserId}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-");
      await root.query(
        `INSERT IGNORE INTO users
          (UserId, Email, Password, FullName, RoleKey, Status, CreatedAt)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        [
          row.UserId,
          `${emailHandle || `user${row.UserId}`}@assetflow.local`,
          row.Password,
          row.FullName,
          roleKey,
          row.CreatedAt,
        ]
      );
    }
    await root.query("DROP TABLE users_legacy");
  }

  await root.end();
}

module.exports = migrate;
