const db = require("../config/db");
const { attachImageUrl } = require("./assetImage.service");

const ASSET_SELECT = `
  SELECT
    a.AssetId, a.OrganizationId, a.AssetTag, a.Name, a.Description, a.CategoryId,
    a.Brand, a.Model, a.SerialNumber, a.PurchaseDate, a.PurchaseCost, a.Status,
    a.LocationId, a.DepartmentId, a.ProjectId, a.CurrentAssignmentId,
    a.SupplierId, a.ManufacturerId, a.CountryOfOriginId, a.ReceiveDate,
    a.LastWarrantyDate, a.MaintenanceScheduleId, a.Remarks, a.ImagePath,
    a.CreatedAt, a.UpdatedAt,
    c.Name AS CategoryName,
    l.Name AS LocationName,
    d.Name AS DepartmentName,
    p.Name AS ProjectName,
    s.Name AS SupplierName,
    m.Name AS ManufacturerName,
    co.Name AS CountryOfOriginName,
    ms.Name AS MaintenanceScheduleName,
    au.UserId AS CustodianId,
    au.FullName AS CustodianName
  FROM assets a
  LEFT JOIN asset_categories c ON c.CategoryId = a.CategoryId
  LEFT JOIN locations l ON l.LocationId = a.LocationId
  LEFT JOIN departments d ON d.DepartmentId = a.DepartmentId
  LEFT JOIN projects p ON p.ProjectId = a.ProjectId
  LEFT JOIN suppliers s ON s.SupplierId = a.SupplierId
  LEFT JOIN manufacturers m ON m.ManufacturerId = a.ManufacturerId
  LEFT JOIN countries co ON co.CountryId = a.CountryOfOriginId
  LEFT JOIN maintenance_schedules ms ON ms.MaintenanceScheduleId = a.MaintenanceScheduleId
  LEFT JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
  LEFT JOIN users au ON au.UserId = aa.UserId
`;

async function nextAssetTag(conn, organizationId) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT AssetTag FROM assets
     WHERE OrganizationId = ? AND AssetTag REGEXP '^AF-[0-9]+$'
     ORDER BY CAST(SUBSTRING(AssetTag, 4) AS UNSIGNED) DESC
     LIMIT 1`,
    [organizationId]
  );
  const next = rows.length ? Number(rows[0].AssetTag.slice(3)) + 1 : 1;
  return `AF-${String(next).padStart(4, "0")}`;
}

async function getAsset(organizationId, assetId, conn) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `${ASSET_SELECT} WHERE a.OrganizationId = ? AND a.AssetId = ? LIMIT 1`,
    [organizationId, assetId]
  );
  return attachImageUrl(rows[0] || null);
}

function canAssignStatus(status) {
  return status === "Available";
}

function buildAssetListWhere(user, query = {}) {
  const params = [user.OrganizationId];
  let where = "WHERE a.OrganizationId = ?";

  if (user.RoleKey === "employee") {
    where += " AND aa.UserId = ? AND aa.Status = 'open'";
    params.push(user.UserId);
  }
  const q = query.q?.trim();
  if (q) {
    where += ` AND (
      a.Name LIKE ? OR a.AssetTag LIKE ? OR a.SerialNumber LIKE ?
      OR a.Brand LIKE ? OR au.FullName LIKE ?
    )`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (query.status?.trim()) {
    where += " AND a.Status = ?";
    params.push(query.status.trim());
  }
  if (query.categoryId) {
    where += " AND a.CategoryId = ?";
    params.push(query.categoryId);
  }
  return { where, params };
}

module.exports = {
  ASSET_SELECT,
  nextAssetTag,
  getAsset,
  attachImageUrl,
  canAssignStatus,
  buildAssetListWhere,
};
