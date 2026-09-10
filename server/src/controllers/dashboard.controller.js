const db = require("../config/db");
const { isEmployee } = require("../middleware/auth");

const summary = async (req, res) => {
  try {
    const orgId = req.user.OrganizationId;

    if (isEmployee(req.user)) {
      const [assigned] = await db.query(
        `SELECT COUNT(*) AS c
         FROM assets a
         JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
         WHERE a.OrganizationId = ? AND aa.UserId = ? AND aa.Status = 'open'`,
        [orgId, req.user.UserId]
      );
      const [pending] = await db.query(
        `SELECT COUNT(*) AS c
         FROM assets a
         JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
         WHERE a.OrganizationId = ? AND aa.UserId = ? AND aa.Status = 'open'
           AND aa.AcceptanceStatus = 'pending'`,
        [orgId, req.user.UserId]
      );
      const [warranties] = await db.query(
        `SELECT COUNT(*) AS c
         FROM assets a
         JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
         WHERE a.OrganizationId = ? AND aa.UserId = ? AND aa.Status = 'open'
           AND a.LastWarrantyDate IS NOT NULL
           AND a.LastWarrantyDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
        [orgId, req.user.UserId]
      );
      const [maintenance] = await db.query(
        `SELECT COUNT(*) AS c
         FROM maintenance_requests r
         WHERE r.OrganizationId = ? AND r.RequestedBy = ? AND r.Status IN ('open', 'in_progress')`,
        [orgId, req.user.UserId]
      );
      return res.json({
        status: true,
        summary: {
          totalAssets: assigned[0].c,
          assigned: assigned[0].c,
          available: 0,
          damaged: 0,
          lost: 0,
          retired: 0,
          inRepair: 0,
          pendingHandovers: Number(pending[0].c || 0),
          warrantiesDue: Number(warranties[0].c || 0),
          openMaintenance: Number(maintenance[0].c || 0),
          users: 1,
        },
      });
    }

    const [totals] = await db.query(
      `SELECT
         COUNT(*) AS totalAssets,
         SUM(Status = 'Assigned') AS assigned,
         SUM(Status = 'Available') AS available,
         SUM(Status = 'Damaged') AS damaged,
         SUM(Status = 'Lost') AS lost,
         SUM(Status = 'Retired') AS retired,
         SUM(Status = 'In Repair') AS inRepair
       FROM assets
       WHERE OrganizationId = ?`,
      [orgId]
    );
    const [users] = await db.query(
      "SELECT COUNT(*) AS c FROM users WHERE OrganizationId = ? AND Status = 'active'",
      [orgId]
    );
    const [pending] = await db.query(
      `SELECT COUNT(*) AS c
       FROM assets a
       JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
       WHERE a.OrganizationId = ? AND aa.Status = 'open' AND aa.AcceptanceStatus = 'pending'`,
      [orgId]
    );
    const [warranties] = await db.query(
      `SELECT COUNT(*) AS c
       FROM assets
       WHERE OrganizationId = ?
         AND LastWarrantyDate IS NOT NULL
         AND LastWarrantyDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
      [orgId]
    );
    const [maintenance] = await db.query(
      `SELECT COUNT(*) AS c
       FROM maintenance_requests
       WHERE OrganizationId = ? AND Status IN ('open', 'in_progress')`,
      [orgId]
    );

    res.json({
      status: true,
      summary: {
        totalAssets: Number(totals[0].totalAssets || 0),
        assigned: Number(totals[0].assigned || 0),
        available: Number(totals[0].available || 0),
        damaged: Number(totals[0].damaged || 0),
        lost: Number(totals[0].lost || 0),
        retired: Number(totals[0].retired || 0),
        inRepair: Number(totals[0].inRepair || 0),
        pendingHandovers: Number(pending[0].c || 0),
        warrantiesDue: Number(warranties[0].c || 0),
        openMaintenance: Number(maintenance[0].c || 0),
        users: Number(users[0].c || 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load dashboard" });
  }
};

module.exports = { summary };
