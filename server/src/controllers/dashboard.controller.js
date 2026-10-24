const db = require("../config/db");
const { isEmployee } = require("../middleware/auth");
const { pastMonthKeys, upcomingMonthKeys, fillMonths, namedTotals } = require("../lib/chartSeries");
const { WARRANTY_END_SQL } = require("../lib/warrantySql");
const { ensureScheduledWorkOrders } = require("../services/schedule.service");

const summary = async (req, res) => {
  try {
    const orgId = req.user.OrganizationId;
    await ensureScheduledWorkOrders(orgId);

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
           AND ${WARRANTY_END_SQL} <> '9999-12-31'
           AND ${WARRANTY_END_SQL} <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
        [orgId, req.user.UserId]
      );
      const [maintenance] = await db.query(
        `SELECT COUNT(*) AS c
         FROM maintenance_requests r
         WHERE r.OrganizationId = ? AND r.RequestedBy = ? AND r.Status IN ('open', 'in_progress')`,
        [orgId, req.user.UserId]
      );
      const [pendingRequests] = await db.query(
        `SELECT COUNT(*) AS c
         FROM asset_requests
         WHERE OrganizationId = ? AND RequestedBy = ? AND Status = 'pending'`,
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
          assignedToMe: Number(assigned[0].c || 0),
          myPendingHandovers: Number(pending[0].c || 0),
          warrantiesDue: Number(warranties[0].c || 0),
          openMaintenance: Number(maintenance[0].c || 0),
          pendingRequests: Number(pendingRequests[0].c || 0),
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
    const [assignedToMe] = await db.query(
      `SELECT COUNT(*) AS c
       FROM assets a
       JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
       WHERE a.OrganizationId = ? AND aa.UserId = ? AND aa.Status = 'open'`,
      [orgId, req.user.UserId]
    );
    const [myPending] = await db.query(
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
       WHERE a.OrganizationId = ?
         AND ${WARRANTY_END_SQL} <> '9999-12-31'
         AND ${WARRANTY_END_SQL} <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
      [orgId]
    );
    const [maintenance] = await db.query(
      `SELECT COUNT(*) AS c
       FROM maintenance_requests
       WHERE OrganizationId = ? AND Status IN ('open', 'in_progress')`,
      [orgId]
    );
    const [pendingRequests] = await db.query(
      `SELECT COUNT(*) AS c
       FROM asset_requests
       WHERE OrganizationId = ? AND Status = 'pending'`,
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
        assignedToMe: Number(assignedToMe[0].c || 0),
        myPendingHandovers: Number(myPending[0].c || 0),
        warrantiesDue: Number(warranties[0].c || 0),
        openMaintenance: Number(maintenance[0].c || 0),
        pendingRequests: Number(pendingRequests[0].c || 0),
        users: Number(users[0].c || 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load dashboard" });
  }
};

function pastStartSql() {
  return "DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')";
}

const charts = async (req, res) => {
  try {
    if (isEmployee(req.user)) {
      return res.json({ status: true, charts: null });
    }

    const orgId = req.user.OrganizationId;
    const months = pastMonthKeys(12);
    const warrantyMonths = upcomingMonthKeys(6);
    const since = pastStartSql();

    const [
      [openedRows],
      [completedRows],
      [spendRows],
      [purchaseRows],
      [categoryRows],
      [departmentRows],
      [locationRows],
      [warrantyRows],
      [assignmentRows],
      [transferRows],
      [requestRows],
    ] = await Promise.all([
      db.query(
        `SELECT DATE_FORMAT(CreatedAt, '%Y-%m') AS ym, COUNT(*) AS c
         FROM maintenance_requests
         WHERE OrganizationId = ? AND CreatedAt >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(CompletedAt, '%Y-%m') AS ym, COUNT(*) AS c
         FROM maintenance_requests
         WHERE OrganizationId = ? AND Status = 'completed'
           AND CompletedAt IS NOT NULL AND CompletedAt >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(CompletedAt, '%Y-%m') AS ym, COALESCE(SUM(Cost), 0) AS total
         FROM maintenance_requests
         WHERE OrganizationId = ? AND Status = 'completed'
           AND CompletedAt IS NOT NULL AND CompletedAt >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(PurchaseDate, '%Y-%m') AS ym, COALESCE(SUM(PurchaseCost), 0) AS total
         FROM assets
         WHERE OrganizationId = ? AND PurchaseDate IS NOT NULL AND PurchaseDate >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT COALESCE(c.Name, 'Uncategorized') AS name, COALESCE(SUM(a.PurchaseCost), 0) AS total
         FROM assets a
         LEFT JOIN asset_categories c ON c.CategoryId = a.CategoryId
         WHERE a.OrganizationId = ?
         GROUP BY c.CategoryId, c.Name
         ORDER BY total DESC, name ASC
         LIMIT 12`,
        [orgId]
      ),
      db.query(
        `SELECT COALESCE(d.Name, 'Unassigned') AS name, COUNT(*) AS total
         FROM assets a
         LEFT JOIN departments d ON d.DepartmentId = a.DepartmentId
         WHERE a.OrganizationId = ?
         GROUP BY d.DepartmentId, d.Name
         ORDER BY total DESC, name ASC
         LIMIT 12`,
        [orgId]
      ),
      db.query(
        `SELECT COALESCE(l.Name, 'Unassigned') AS name, COUNT(*) AS total
         FROM assets a
         LEFT JOIN locations l ON l.LocationId = a.LocationId
         WHERE a.OrganizationId = ?
         GROUP BY l.LocationId, l.Name
         ORDER BY total DESC, name ASC
         LIMIT 12`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(LastWarrantyDate, '%Y-%m') AS ym, COUNT(*) AS c
         FROM assets
         WHERE OrganizationId = ?
           AND LastWarrantyDate >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
           AND LastWarrantyDate < DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 6 MONTH), '%Y-%m-01')
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(AssignedAt, '%Y-%m') AS ym, COUNT(*) AS c
         FROM asset_assignments
         WHERE OrganizationId = ? AND AssignedAt >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(CreatedAt, '%Y-%m') AS ym, COUNT(*) AS c
         FROM asset_lifecycle_events
         WHERE OrganizationId = ? AND EventType = 'transfer' AND CreatedAt >= ${since}
         GROUP BY ym`,
        [orgId]
      ),
      db.query(
        `SELECT DATE_FORMAT(CreatedAt, '%Y-%m') AS ym, Status AS status, COUNT(*) AS c
         FROM asset_requests
         WHERE OrganizationId = ? AND CreatedAt >= ${since}
         GROUP BY ym, Status`,
        [orgId]
      ),
    ]);

    const requestStatuses = ["pending", "approved", "rejected", "cancelled"];
    const requestsByStatus = {};
    for (const status of requestStatuses) {
      requestsByStatus[status] = fillMonths(
        months,
        requestRows.filter((row) => row.status === status)
      );
    }

    res.json({
      status: true,
      charts: {
        months,
        warrantyMonths,
        maintenanceOpened: fillMonths(months, openedRows),
        maintenanceCompleted: fillMonths(months, completedRows),
        maintenanceSpend: fillMonths(months, spendRows, "total"),
        purchaseCost: fillMonths(months, purchaseRows, "total"),
        valueByCategory: namedTotals(categoryRows),
        assetsByDepartment: namedTotals(departmentRows),
        assetsByLocation: namedTotals(locationRows),
        warrantiesUpcoming: fillMonths(warrantyMonths, warrantyRows),
        assignments: fillMonths(months, assignmentRows),
        transfers: fillMonths(months, transferRows),
        requestsByStatus,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load dashboard charts" });
  }
};

module.exports = { summary, charts };
