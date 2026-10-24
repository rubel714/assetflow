const db = require("../config/db");
const { publicUserImageUrl } = require("../services/userImage.service");

const list = async (req, res) => {
  try {
    const orgId = req.user.OrganizationId;
    const [departments] = await db.query(
      "SELECT DepartmentId, Name FROM departments WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [designations] = await db.query(
      "SELECT DesignationId, Name FROM designations WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [roles] = await db.query(
      `SELECT RoleKey, Name
       FROM roles
       WHERE RoleKey <> 'site_admin'
         AND (OrganizationId IS NULL OR OrganizationId = ?)
       ORDER BY IsSystem DESC, FIELD(RoleKey, 'organization_admin', 'asset_manager', 'employee'), Name`,
      [orgId]
    );
    const [locations] = await db.query(
      "SELECT LocationId, Name FROM locations WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [projects] = await db.query(
      "SELECT ProjectId, Name FROM projects WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [categories] = await db.query(
      "SELECT CategoryId, Name FROM asset_categories WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [suppliers] = await db.query(
      "SELECT SupplierId, Name FROM suppliers WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [manufacturers] = await db.query(
      "SELECT ManufacturerId, Name FROM manufacturers WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [countries] = await db.query(
      "SELECT CountryId, Name FROM countries WHERE OrganizationId = ? ORDER BY Name",
      [orgId]
    );
    const [maintenanceSchedules] = await db.query(
      `SELECT MaintenanceScheduleId, Name, IntervalDays
       FROM maintenance_schedules
       WHERE OrganizationId = ?
       ORDER BY FIELD(Name, 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'), Name`,
      [orgId]
    );
    const userParams = [orgId];
    let userWhere = "WHERE u.OrganizationId = ? AND u.Status = 'active'";
    if (req.user.RoleKey === "employee") {
      userWhere += " AND u.UserId = ?";
      userParams.push(req.user.UserId);
    }
    const [users] = await db.query(
      `SELECT u.UserId, u.FullName, u.Email, u.RoleKey, r.Name AS RoleName, u.ImagePath
       FROM users u
       LEFT JOIN roles r ON r.RoleKey = u.RoleKey
       ${userWhere}
       ORDER BY u.FullName`,
      userParams
    );
    res.json({
      status: true,
      departments: departments.map((row) => ({ ...row, id: row.DepartmentId })),
      designations: designations.map((row) => ({ ...row, id: row.DesignationId })),
      roles: roles.map((row) => ({ RoleKey: row.RoleKey, Name: row.Name })),
      locations: locations.map((row) => ({ ...row, id: row.LocationId })),
      projects: projects.map((row) => ({ ...row, id: row.ProjectId })),
      categories: categories.map((row) => ({ ...row, id: row.CategoryId })),
      suppliers: suppliers.map((row) => ({ ...row, id: row.SupplierId })),
      manufacturers: manufacturers.map((row) => ({ ...row, id: row.ManufacturerId })),
      countries: countries.map((row) => ({ ...row, id: row.CountryId })),
      maintenanceSchedules: maintenanceSchedules.map((row) => ({
        ...row,
        id: row.MaintenanceScheduleId,
      })),
      users: users.map((u) => ({
        UserId: u.UserId,
        FullName: u.FullName,
        Email: u.Email,
        Role: u.RoleKey,
        RoleName: u.RoleName || null,
        ImageUrl: publicUserImageUrl(u.ImagePath),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load lookups" });
  }
};

module.exports = { list };
