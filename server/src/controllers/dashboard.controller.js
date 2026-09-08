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
      return res.json({
        status: true,
        summary: {
          totalAssets: assigned[0].c,
          assigned: assigned[0].c,
          available: 0,
          users: 1,
        },
      });
    }

    const [totals] = await db.query(
      `SELECT
         COUNT(*) AS totalAssets,
         SUM(Status = 'Assigned') AS assigned,
         SUM(Status = 'Available') AS available
       FROM assets
       WHERE OrganizationId = ?`,
      [orgId]
    );
    const [users] = await db.query(
      "SELECT COUNT(*) AS c FROM users WHERE OrganizationId = ? AND Status = 'active'",
      [orgId]
    );

    res.json({
      status: true,
      summary: {
        totalAssets: Number(totals[0].totalAssets || 0),
        assigned: Number(totals[0].assigned || 0),
        available: Number(totals[0].available || 0),
        users: Number(users[0].c || 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load dashboard" });
  }
};

module.exports = { summary };
