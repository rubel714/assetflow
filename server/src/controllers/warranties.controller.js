const db = require("../config/db");
const { ASSET_SELECT, attachImageUrl, getAsset, employeeCanViewAsset } = require("../services/asset.service");
const { isEmployee } = require("../middleware/auth");
const { writeAudit } = require("../services/audit.service");
const { WARRANTY_END_SQL } = require("../lib/warrantySql");

const list = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = " AND aa.UserId = ? AND aa.Status = 'open'";
      params.push(req.user.UserId);
    }
    const select = ASSET_SELECT.replace(
      "FROM assets a",
      `, ${WARRANTY_END_SQL} AS WarrantyEnd\n  FROM assets a`
    );
    const [rows] = await db.query(
      `${select}
       WHERE a.OrganizationId = ?
         AND ${WARRANTY_END_SQL} <> '9999-12-31'
         AND ${WARRANTY_END_SQL} <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
         ${extra}
       ORDER BY WarrantyEnd ASC`,
      params
    );
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      status: true,
      days,
      warranties: rows.map((row) => {
        const expiry = String(row.WarrantyEnd || row.LastWarrantyDate || "").slice(0, 10);
        return {
          ...attachImageUrl(row),
          WarrantyEnd: expiry,
          WarrantyState: expiry && expiry < today ? "expired" : "expiring",
        };
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load warranties" });
  }
};

const listForAsset = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const asset = await getAsset(req.user.OrganizationId, assetId);
    if (!asset) return res.status(404).json({ status: false, message: "Asset not found" });
    if (!employeeCanViewAsset(req.user, asset)) {
      return res.status(403).json({ status: false, message: "You can only view assets assigned to you" });
    }
    const [rows] = await db.query(
      `SELECT WarrantyId, Vendor, StartDate, EndDate, Notes, CreatedAt
       FROM asset_warranties
       WHERE OrganizationId = ? AND AssetId = ?
       ORDER BY EndDate ASC`,
      [req.user.OrganizationId, assetId]
    );
    res.json({ status: true, warranties: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load asset warranties" });
  }
};

const createForAsset = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const endDate = req.body.endDate?.trim();
    if (!endDate) {
      return res.status(400).json({ status: false, message: "End date is required" });
    }
    const [asset] = await db.query(
      "SELECT AssetId, LastWarrantyDate FROM assets WHERE OrganizationId = ? AND AssetId = ? LIMIT 1",
      [req.user.OrganizationId, assetId]
    );
    if (!asset.length) {
      return res.status(404).json({ status: false, message: "Asset not found" });
    }
    const [result] = await db.query(
      `INSERT INTO asset_warranties
        (OrganizationId, AssetId, Vendor, StartDate, EndDate, Notes, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.OrganizationId,
        assetId,
        req.body.vendor?.trim() || null,
        req.body.startDate || null,
        endDate,
        req.body.notes?.trim() || null,
        req.user.UserId,
      ]
    );
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "warranty.create",
      entityType: "asset",
      entityId: assetId,
      after: { warrantyId: result.insertId, endDate },
    });
    const [rows] = await db.query(
      "SELECT * FROM asset_warranties WHERE WarrantyId = ? LIMIT 1",
      [result.insertId]
    );
    res.status(201).json({ status: true, warranty: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not save warranty" });
  }
};

const removeForAsset = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const warrantyId = Number(req.params.warrantyId);
    const [result] = await db.query(
      `DELETE FROM asset_warranties
       WHERE WarrantyId = ? AND AssetId = ? AND OrganizationId = ?`,
      [warrantyId, assetId, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Warranty not found" });
    }
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "warranty.delete",
      entityType: "asset",
      entityId: assetId,
      after: { warrantyId },
    });
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete warranty" });
  }
};

module.exports = { list, listForAsset, createForAsset, removeForAsset };
