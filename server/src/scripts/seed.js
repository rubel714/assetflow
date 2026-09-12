const bcrypt = require("bcrypt");
const db = require("../config/db");
const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require("../lib/permissions");

const ROLE_NAMES = {
  [ROLES.SITE_ADMIN]: "Site Admin",
  [ROLES.ORGANIZATION_ADMIN]: "Organization Admin",
  [ROLES.ASSET_MANAGER]: "Asset Manager",
  [ROLES.EMPLOYEE]: "Employee",
};

const PERMISSION_NAMES = {
  [PERMISSIONS.SITE_MANAGE]: "Manage organizations (site)",
  [PERMISSIONS.SITE_ENTER]: "Enter organization (site)",
  [PERMISSIONS.ORG_MANAGE]: "Manage organization",
  [PERMISSIONS.USERS_MANAGE]: "Manage users",
  [PERMISSIONS.USERS_READ]: "View users",
  [PERMISSIONS.SETUP_MANAGE]: "Manage setup lists",
  [PERMISSIONS.ASSETS_READ]: "View assets",
  [PERMISSIONS.ASSETS_MANAGE]: "Manage assets",
  [PERMISSIONS.ASSETS_ASSIGN]: "Assign assets",
  [PERMISSIONS.ASSETS_ACCEPT]: "Accept asset handover",
  [PERMISSIONS.MAINTENANCE_REQUEST]: "Request maintenance",
  [PERMISSIONS.MAINTENANCE_MANAGE]: "Manage maintenance work orders",
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
    "INSERT INTO organizations (Name, Code) VALUES (?, ?)",
    ["Bashundhara Group", "BG"]
  );
  return result.insertId;
}

async function ensureOrgProfile(orgId, countries) {
  const [rows] = await db.query(
    "SELECT Code, Email FROM organizations WHERE OrganizationId = ? LIMIT 1",
    [orgId]
  );
  if (!rows.length || (rows[0].Code && rows[0].Email)) {
    return;
  }
  await db.query(
    `UPDATE organizations
     SET LegalName = ?, Code = ?, Email = ?, Phone = ?, Website = ?, Address = ?, CountryId = ?
     WHERE OrganizationId = ?`,
    [
      "Bashundhara Group",
      rows[0].Code || "BG",
      "assets@bashundhara.example",
      "+880 2-41012345",
      "https://www.bashundhara.com",
      "Group Head Office, Bashundhara R/A, Dhaka",
      countries.Bangladesh || null,
      orgId,
    ]
  );
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

async function insertVendors(table, idCol, orgId, records) {
  const ids = {};
  for (const rec of records) {
    const [existing] = await db.query(
      `SELECT ${idCol} AS id FROM ${table} WHERE OrganizationId = ? AND Name = ? LIMIT 1`,
      [orgId, rec.Name]
    );
    if (existing.length) {
      ids[rec.Name] = existing[0].id;
      continue;
    }
    const [result] = await db.query(
      `INSERT INTO ${table}
        (OrganizationId, Name, ContactName, Email, Phone, Address, Website)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        rec.Name,
        rec.ContactName || null,
        rec.Email || null,
        rec.Phone || null,
        rec.Address || null,
        rec.Website || null,
      ]
    );
    ids[rec.Name] = result.insertId;
  }
  return ids;
}

async function ensureSiteAdmin() {
  const email = "site@assetflow.example";
  const [rows] = await db.query("SELECT UserId FROM users WHERE Email = ? LIMIT 1", [email]);
  if (rows.length) {
    await db.query(
      `UPDATE users
       SET OrganizationId = NULL, RoleKey = ?, FullName = ?, Email = ?, Status = 'active'
       WHERE UserId = ?`,
      [ROLES.SITE_ADMIN, "Site Administrator", email, rows[0].UserId]
    );
    return rows[0].UserId;
  }
  const hashed = await bcrypt.hash("siteadmin123", 10);
  const [result] = await db.query(
    `INSERT INTO users (OrganizationId, Email, Password, FullName, RoleKey, Status)
     VALUES (NULL, ?, ?, 'Site Administrator', ?, 'active')`,
    [email, hashed, ROLES.SITE_ADMIN]
  );
  return result.insertId;
}

async function ensureUser(orgId, email, password, fullName, roleKey) {
  const [rows] = await db.query("SELECT UserId FROM users WHERE Email = ? LIMIT 1", [email]);
  if (rows.length) {
    await db.query(
      `UPDATE users
       SET OrganizationId = COALESCE(OrganizationId, ?), RoleKey = ?, FullName = ?, Email = ?
       WHERE UserId = ?`,
      [orgId, roleKey, fullName, email, rows[0].UserId]
    );
    return rows[0].UserId;
  }
  const hashed = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    `INSERT INTO users (OrganizationId, Email, Password, FullName, RoleKey, Status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [orgId, email, hashed, fullName, roleKey]
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
  await ensureSiteAdmin();
  const orgId = await ensureOrg();

  const adminId = await ensureUser(
    orgId,
    "admin@bashundhara.example",
    "admin123",
    "System Administrator",
    ROLES.ORGANIZATION_ADMIN
  );
  const managerId = await ensureUser(
    orgId,
    "manager@bashundhara.example",
    "manager123",
    "Alex Manager",
    ROLES.ASSET_MANAGER
  );
  const employeeId = await ensureUser(
    orgId,
    "employee@bashundhara.example",
    "employee123",
    "Sam Employee",
    ROLES.EMPLOYEE
  );

  await insertNamed("designations", "DesignationId", orgId, [
    "Accountant",
    "Administrator",
    "Analyst",
    "Assistant Manager",
    "Coordinator",
    "Director",
    "Engineer",
    "Executive",
    "General Manager",
    "HR Officer",
    "IT Officer",
    "Manager",
    "Officer",
    "Operator",
    "Store Keeper",
    "Supervisor",
    "Technician",
  ]);
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
  const suppliers = await insertVendors("suppliers", "SupplierId", orgId, [
    {
      Name: "Tech Source Ltd",
      ContactName: "Rafiq Hasan",
      Email: "sales@techsource.example",
      Phone: "+880 1711-100001",
      Address: "House 12, Road 7, Banani, Dhaka 1213",
      Website: "https://techsource.example",
    },
    {
      Name: "Office Mart BD",
      ContactName: "Nusrat Jahan",
      Email: "orders@officemart.example",
      Phone: "+880 1711-100002",
      Address: "Level 4, Elephant Road, Dhaka 1205",
      Website: "https://officemart.example",
    },
    {
      Name: "Global IT Distributors",
      ContactName: "Imran Chowdhury",
      Email: "bd@globalit.example",
      Phone: "+880 1711-100003",
      Address: "Plot 18, Tejgaon Industrial Area, Dhaka 1208",
      Website: "https://globalit.example",
    },
    {
      Name: "Bashundhara Procurement",
      ContactName: "Procurement Desk",
      Email: "procurement@bashundhara.example",
      Phone: "+880 2-41012345",
      Address: "Group Head Office, Bashundhara R/A, Dhaka",
      Website: "https://www.bashundharagroup.com",
    },
  ]);
  const manufacturers = await insertVendors("manufacturers", "ManufacturerId", orgId, [
    {
      Name: "Dell",
      ContactName: "Enterprise Support",
      Email: "support@dell.example",
      Phone: "+1 800-624-9897",
      Address: "1 Dell Way, Round Rock, TX 78682, USA",
      Website: "https://www.dell.com",
    },
    {
      Name: "HP",
      ContactName: "Business Sales",
      Email: "sales@hp.example",
      Phone: "+1 650-857-1501",
      Address: "1501 Page Mill Road, Palo Alto, CA 94304, USA",
      Website: "https://www.hp.com",
    },
    {
      Name: "Lenovo",
      ContactName: "Channel Partner Desk",
      Email: "partners@lenovo.example",
      Phone: "+86 10-5886-8888",
      Address: "No. 6 Chuangye Road, Haidian District, Beijing, China",
      Website: "https://www.lenovo.com",
    },
    {
      Name: "Samsung",
      ContactName: "B2B Inquiries",
      Email: "b2b@samsung.example",
      Phone: "+82 2-2255-0114",
      Address: "129 Samsung-ro, Yeongtong-gu, Suwon, South Korea",
      Website: "https://www.samsung.com",
    },
    {
      Name: "Apple",
      ContactName: "Enterprise Team",
      Email: "enterprise@apple.example",
      Phone: "+1 800-275-2273",
      Address: "One Apple Park Way, Cupertino, CA 95014, USA",
      Website: "https://www.apple.com",
    },
    {
      Name: "Canon",
      ContactName: "Imaging Support",
      Email: "support@canon.example",
      Phone: "+81 3-3758-2111",
      Address: "30-2 Shimomaruko 3-chome, Ota-ku, Tokyo, Japan",
      Website: "https://www.canon.com",
    },
    {
      Name: "Cisco",
      ContactName: "Partner Support",
      Email: "partners@cisco.example",
      Phone: "+1 408-526-4000",
      Address: "170 West Tasman Drive, San Jose, CA 95134, USA",
      Website: "https://www.cisco.com",
    },
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
  await ensureOrgProfile(orgId, countries);
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
    LastWarrantyDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
    LastWarrantyDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
        (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy, AcceptanceStatus, AcceptedAt)
       VALUES (?, ?, ?, ?, 'open', ?, 'accepted', NOW())`,
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

  console.log("Seeded demo data (admin@bashundhara.example / admin123, site@assetflow.example / siteadmin123)");
}

module.exports = seed;
