const db = require("../config/db");

const list = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const orgId = req.user.OrganizationId;

    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM audit_logs WHERE OrganizationId = ?",
      [orgId]
    );
    const [rows] = await db.query(
      `SELECT a.AuditId, a.Action, a.EntityType, a.EntityId, a.BeforeJson, a.AfterJson, a.CreatedAt,
              u.FullName AS UserName
       FROM audit_logs a
       LEFT JOIN users u ON u.UserId = a.UserId
       WHERE a.OrganizationId = ?
       ORDER BY a.CreatedAt DESC, a.AuditId DESC
       LIMIT ? OFFSET ?`,
      [orgId, pageSize, offset]
    );

    res.json({
      status: true,
      page,
      pageSize,
      total: countRows[0].total,
      logs: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load audit log" });
  }
};

module.exports = { list };
