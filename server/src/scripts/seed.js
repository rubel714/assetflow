const bcrypt = require("bcrypt");
const db = require("../config/db");
const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require("../lib/permissions");

const ROLE_NAMES = {
  [ROLES.ORGANIZATION_ADMIN]: "Organization Admin",
  [ROLES.ASSET_MANAGER]: "Asset Manager",
  [ROLES.EMPLOYEE]: "Employee",
};

const PERMISSION_NAMES = {
  [PERMISSIONS.ORG_MANAGE]: "Manage organization",
  [PERMISSIONS.USERS_MANAGE]: "Manage users",
  [PERMISSIONS.USERS_READ]: "View users",
  [PERMISSIONS.SETUP_MANAGE]: "Manage setup lists",
  [PERMISSIONS.ASSETS_READ]: "View assets",
  [PERMISSIONS.ASSETS_MANAGE]: "Manage assets",
  [PERMISSIONS.ASSETS_ASSIGN]: "Assign assets",
  [PERMISSIONS.REPORTS_EXPORT]: "Export reports",
  [PERMISSIONS.DASHBOARD_READ]: "View dashboard",
};

async function seedLookups() {
  for (const [key, name] of Object.entries(ROLE_NAMES)) {
    await db.query(
      "INSERT IGNORE INTO roles (RoleKey, Name) VALUES (?, ?)",
      [key, name]
    );
  }
  for (const [key, name] of Object.entries(PERMISSION_NAMES)) {
    await db.query(
      "INSERT IGNORE INTO permissions (PermissionKey, Name) VALUES (?, ?)",
      [key, name]
    );
  }
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const perm of perms) {
      await db.query(
        "INSERT IGNORE INTO role_permissions (RoleKey, PermissionKey) VALUES (?, ?)",
        [role, perm]
      );
    }
  }
}

async function ensureOrg() {
  const [rows] = await db.query(
    "SELECT OrganizationId FROM organizations ORDER BY OrganizationId ASC LIMIT 1"
  );
  if (rows.length) {
    return rows[0].OrganizationId;
  }
  const [result] = await db.query(
    "INSERT INTO organizations (Name) VALUES (?)",
    ["Bashundhara Group"]
  );
  return result.insertId;
}

async function insertNamed(table, idCol, orgId, names) {
  const ids = {};
  for (const name of names) {
    const [existing] = await db.query(
      `SELECT ${idCol} AS id FROM ${table} WHERE OrganizationId = ? AND Name = ? LIMIT 1`,
      [orgId, name]
    );
    if (existing.length) {
      ids[name] = existing[0].id;
      continue;
    }
    const [result] = await db.query(
      `INSERT INTO ${table} (OrganizationId, Name) VALUES (?, ?)`,
      [orgId, name]
    );
    ids[name] = result.insertId;
  }
  return ids;
}

async function ensureUser(orgId, username, password, fullName, roleKey) {
  const [rows] = await db.query(
    "SELECT UserId FROM users WHERE Username = ? LIMIT 1",
    [username]
  );
  if (rows.length) {
    await db.query(
      `UPDATE users
       SET OrganizationId = COALESCE(OrganizationId, ?), RoleKey = ?, FullName = ?
       WHERE UserId = ?`,
      [orgId, roleKey, fullName, rows[0].UserId]
    );
    return rows[0].UserId;
  }
  const hashed = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    `INSERT INTO users (OrganizationId, Username, Password, FullName, RoleKey, Status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [orgId, username, hashed, fullName, roleKey]
  );
  return result.insertId;
}

async function ensureAsset(orgId, tag, fields) {
  const [rows] = await db.query(
    "SELECT AssetId FROM assets WHERE OrganizationId = ? AND AssetTag = ? LIMIT 1",
    [orgId, tag]
  );
  if (rows.length) {
    return rows[0].AssetId;
  }
  const [result] = await db.query(
    `INSERT INTO assets
      (OrganizationId, AssetTag, Name, Description, CategoryId, Brand, Model,
       SerialNumber, PurchaseDate, PurchaseCost, Status, LocationId, DepartmentId,
       ProjectId, SupplierId, ManufacturerId, CountryOfOriginId, ReceiveDate,
       LastWarrantyDate, MaintenanceScheduleId, Remarks, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      tag,
      fields.Name,
      fields.Description || null,
      fields.CategoryId || null,
      fields.Brand || null,
      fields.Model || null,
      fields.SerialNumber || null,
      fields.PurchaseDate || null,
      fields.PurchaseCost || null,
      fields.Status || "Available",
      fields.LocationId || null,
      fields.DepartmentId || null,
      fields.ProjectId || null,
      fields.SupplierId || null,
      fields.ManufacturerId || null,
      fields.CountryOfOriginId || null,
      fields.ReceiveDate || null,
      fields.LastWarrantyDate || null,
      fields.MaintenanceScheduleId || null,
      fields.Remarks || null,
      fields.CreatedBy || null,
    ]
  );
  return result.insertId;
}

async function seed() {
  await seedLookups();
  const orgId = await ensureOrg();

  const adminId = await ensureUser(
    orgId,
    "admin",
    "admin123",
    "System Administrator",
    ROLES.ORGANIZATION_ADMIN
  );
  const managerId = await ensureUser(
    orgId,
    "manager",
    "manager123",
    "Alex Manager",
    ROLES.ASSET_MANAGER
  );
  const employeeId = await ensureUser(
    orgId,
    "employee",
    "employee123",
    "Sam Employee",
    ROLES.EMPLOYEE
  );

  const departments = await insertNamed("departments", "DepartmentId", orgId, [
    "Information Technology",
    "Finance and Accounts",
    "Human Resources",
    "Administration",
    "Legal and Corporate Affairs",
    "Procurement",
    "Internal Audit",
    "Corporate Communications",
  ]);
  const locations = await insertNamed("locations", "LocationId", orgId, [
    "Group Head Office, Bashundhara R/A",
    "Bashundhara City Corporate Floor",
    "Gulshan Liaison Office",
    "Central Store, Head Office",
  ]);
  const projects = await insertNamed("projects", "ProjectId", orgId, [
    "ERP Implementation",
    "Head Office Digitization",
    "New Subsidiary Onboarding 2026",
    "Annual Corporate Events 2026",
  ]);
  const categories = await insertNamed(
    "asset_categories",
    "CategoryId",
    orgId,
    [
      "Laptop",
      "Desktop",
      "Monitor",
      "Printer",
      "Mobile Phone",
      "Furniture",
      "Vehicle",
      "Networking Equipment",
    ]
  );
  const suppliers = await insertNamed("suppliers", "SupplierId", orgId, [
    "Tech Source Ltd",
    "Office Mart BD",
    "Global IT Distributors",
    "Bashundhara Procurement",
  ]);
  const manufacturers = await insertNamed("manufacturers", "ManufacturerId", orgId, [
    "Dell",
    "HP",
    "Lenovo",
    "Samsung",
    "Apple",
    "Canon",
    "Cisco",
  ]);
  const countries = await insertNamed("countries", "CountryId", orgId, [
    "Bangladesh",
    "China",
    "United States",
    "Japan",
    "South Korea",
    "Taiwan",
    "Germany",
    "India",
    "United Kingdom",
    "Singapore",
  ]);
  const maintenanceSchedules = await insertNamed(
    "maintenance_schedules",
    "MaintenanceScheduleId",
    orgId,
    ["Monthly", "Quarterly", "Semi-Annual", "Annual"]
  );

  const laptopId = await ensureAsset(orgId, "AF-0001", {
    Name: "Dell Latitude 5540",
    Description: "Standard staff laptop",
    CategoryId: categories.Laptop,
    Brand: "Dell",
    Model: "Latitude 5540",
    SerialNumber: "DL5540-001",
    PurchaseDate: "2025-03-12",
    PurchaseCost: 1250,
    Status: "Assigned",
    LocationId: locations["Group Head Office, Bashundhara R/A"],
    DepartmentId: departments["Information Technology"],
    ProjectId: projects["ERP Implementation"],
    SupplierId: suppliers["Tech Source Ltd"],
    ManufacturerId: manufacturers.Dell,
    CountryOfOriginId: countries["United States"],
    ReceiveDate: "2025-03-18",
    LastWarrantyDate: "2028-03-12",
    MaintenanceScheduleId: maintenanceSchedules.Annual,
    Remarks: "Assigned to ERP implementation team.",
    CreatedBy: adminId,
  });

  await ensureAsset(orgId, "AF-0002", {
    Name: "HP LaserJet Pro",
    Description: "Office printer",
    CategoryId: categories.Printer,
    Brand: "HP",
    Model: "LaserJet Pro",
    SerialNumber: "HP-PRN-009",
    PurchaseDate: "2024-11-02",
    PurchaseCost: 380,
    Status: "Available",
    LocationId: locations["Group Head Office, Bashundhara R/A"],
    DepartmentId: departments.Administration,
    CreatedBy: managerId,
  });

  await ensureAsset(orgId, "AF-0003", {
    Name: "Samsung 27in Monitor",
    CategoryId: categories.Monitor,
    Brand: "Samsung",
    Model: "S27C390",
    SerialNumber: "SM-MON-027",
    PurchaseDate: "2025-01-20",
    PurchaseCost: 210,
    Status: "Available",
    LocationId: locations["Central Store, Head Office"],
    DepartmentId: departments["Information Technology"],
    CreatedBy: adminId,
  });

  const [openAssign] = await db.query(
    `SELECT AssignmentId FROM asset_assignments
     WHERE OrganizationId = ? AND AssetId = ? AND Status = 'open' LIMIT 1`,
    [orgId, laptopId]
  );
  if (!openAssign.length) {
    const [assignResult] = await db.query(
      `INSERT INTO asset_assignments
        (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [orgId, laptopId, employeeId, "Seeded assignment", adminId]
    );
    await db.query(
      "UPDATE assets SET CurrentAssignmentId = ? WHERE AssetId = ?",
      [assignResult.insertId, laptopId]
    );
    await db.query(
      `INSERT INTO asset_lifecycle_events
        (OrganizationId, AssetId, EventType, PreviousValue, NewValue, Notes, CreatedBy)
       VALUES (?, ?, 'assign', 'Available', 'Assigned', 'Seeded assignment', ?)`,
      [orgId, laptopId, adminId]
    );
  }

  console.log("Seeded Phase 1 demo data (admin / admin123)");
}

module.exports = seed;
