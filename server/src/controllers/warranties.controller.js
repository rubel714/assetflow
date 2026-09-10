const db = require("../config/db");
const { ASSET_SELECT, attachImageUrl } = require("../services/asset.service");
const { isEmployee } = require("../middleware/auth");

const list = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = " AND aa.UserId = ? AND aa.Status = 'open'";
      params.push(req.user.UserId);
    }
    const [rows] = await db.query(
      `${ASSET_SELECT}
       WHERE a.OrganizationId = ?
         AND a.LastWarrantyDate IS NOT NULL
         AND a.LastWarrantyDate <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
         ${extra}
       ORDER BY a.LastWarrantyDate ASC`,
      params
    );
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      status: true,
      days,
      warranties: rows.map((row) => {
        const expiry = String(row.LastWarrantyDate).slice(0, 10);
        return {
          ...attachImageUrl(row),
          WarrantyState: expiry < today ? "expired" : "expiring",
        };
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load warranties" });
  }
};

module.exports = { list };
