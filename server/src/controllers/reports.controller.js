const db = require("../config/db");
const { sendCsv } = require("../lib/csv");
const { isEmployee } = require("../middleware/auth");
const { WARRANTY_END_SQL } = require("../lib/warrantySql");

const warranties = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = " AND aa.UserId = ? AND aa.Status = 'open'";
      params.push(req.user.UserId);
    }
    const [rows] = await db.query(
      `SELECT a.AssetTag, a.Name, ${WARRANTY_END_SQL} AS WarrantyEnd, au.FullName AS CustodianName
       FROM assets a
       LEFT JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
       LEFT JOIN users au ON au.UserId = aa.UserId
       WHERE a.OrganizationId = ?
         AND ${WARRANTY_END_SQL} <> '9999-12-31'
         AND ${WARRANTY_END_SQL} <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
         ${extra}
       ORDER BY WarrantyEnd ASC`,
      params
    );
    const today = new Date().toISOString().slice(0, 10);
    sendCsv(
      res,
      "warranties.csv",
      ["AssetTag", "Name", "WarrantyEnd", "State", "Custodian"],
      rows.map((row) => {
        const expiry = String(row.WarrantyEnd || "").slice(0, 10);
        return [row.AssetTag, row.Name, expiry, expiry && expiry < today ? "expired" : "expiring", row.CustodianName];
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not export warranties" });
  }
};

const maintenance = async (req, res) => {
  try {
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = " AND r.RequestedBy = ?";
      params.push(req.user.UserId);
    }
    const [rows] = await db.query(
      `SELECT r.RequestId, a.AssetTag, a.Name AS AssetName, r.Title, r.Status, r.Cost,
              r.CreatedAt, r.StartedAt, r.CompletedAt
       FROM maintenance_requests r
       JOIN assets a ON a.AssetId = r.AssetId
       WHERE r.OrganizationId = ? ${extra}
       ORDER BY r.CreatedAt DESC`,
      params
    );
    sendCsv(res, "maintenance.csv", ["RequestId", "AssetTag", "Asset", "Title", "Status", "Cost", "CreatedAt", "StartedAt", "CompletedAt"], rows.map((row) => [
      row.RequestId,
      row.AssetTag,
      row.AssetName,
      row.Title,
      row.Status,
      row.Cost,
      row.CreatedAt,
      row.StartedAt,
      row.CompletedAt,
    ]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not export maintenance" });
  }
};

const assignments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.AssetTag, a.Name, u.FullName AS Custodian, aa.AssignedAt, aa.AcceptanceStatus
       FROM asset_assignments aa
       JOIN assets a ON a.AssetId = aa.AssetId
       JOIN users u ON u.UserId = aa.UserId
       WHERE aa.OrganizationId = ? AND aa.Status = 'open'
       ORDER BY aa.AssignedAt DESC`,
      [req.user.OrganizationId]
    );
    sendCsv(res, "assignments.csv", ["AssetTag", "Name", "Custodian", "AssignedAt", "Handover"], rows.map((row) => [
      row.AssetTag,
      row.Name,
      row.Custodian,
      row.AssignedAt,
      row.AcceptanceStatus,
    ]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not export assignments" });
  }
};

const valueByCategory = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COALESCE(c.Name, 'Uncategorized') AS Category, COUNT(*) AS Assets, COALESCE(SUM(a.PurchaseCost), 0) AS Value
       FROM assets a
       LEFT JOIN asset_categories c ON c.CategoryId = a.CategoryId
       WHERE a.OrganizationId = ?
       GROUP BY c.CategoryId, c.Name
       ORDER BY Value DESC`,
      [req.user.OrganizationId]
    );
    sendCsv(res, "value-by-category.csv", ["Category", "Assets", "Value"], rows.map((row) => [
      row.Category,
      row.Assets,
      row.Value,
    ]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not export category values" });
  }
};

module.exports = { warranties, maintenance, assignments, valueByCategory };
