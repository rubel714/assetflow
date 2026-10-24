const db = require("../config/db");
const { notifyPermission } = require("./notification.service");
const { PERMISSIONS } = require("../lib/permissions");

async function ensureScheduledWorkOrders(organizationId) {
  const [rows] = await db.query(
    `SELECT a.AssetId, a.AssetTag, a.Name, ms.Name AS ScheduleName, ms.IntervalDays,
            (SELECT MAX(r.CompletedAt) FROM maintenance_requests r
             WHERE r.OrganizationId = a.OrganizationId AND r.AssetId = a.AssetId AND r.Status = 'completed'
            ) AS LastCompleted,
            (SELECT COUNT(*) FROM maintenance_requests o
             WHERE o.OrganizationId = a.OrganizationId AND o.AssetId = a.AssetId
               AND o.Status IN ('open', 'in_progress')
            ) AS OpenCount
     FROM assets a
     JOIN maintenance_schedules ms ON ms.MaintenanceScheduleId = a.MaintenanceScheduleId
     WHERE a.OrganizationId = ?
       AND ms.IntervalDays IS NOT NULL AND ms.IntervalDays > 0
       AND a.Status NOT IN ('Retired', 'Lost')`,
    [organizationId]
  );

  let created = 0;
  for (const row of rows) {
    if (Number(row.OpenCount) > 0) continue;
    const due = !row.LastCompleted
      ? true
      : new Date(row.LastCompleted).getTime() + Number(row.IntervalDays) * 86400000 <= Date.now();
    if (!due) continue;
    const title = `Scheduled: ${row.ScheduleName}`;
    const [result] = await db.query(
      `INSERT INTO maintenance_requests
        (OrganizationId, AssetId, Title, Description, Status)
       VALUES (?, ?, ?, ?, 'open')`,
      [organizationId, row.AssetId, title, `Auto-opened from the ${row.ScheduleName} schedule.`]
    );
    await notifyPermission(db, organizationId, PERMISSIONS.MAINTENANCE_MANAGE, {
      type: "maintenance_scheduled",
      title: `Scheduled work: ${row.AssetTag}`,
      body: title,
      link: "/maintenance",
      entityType: "maintenance_request",
      entityId: result.insertId,
    });
    created += 1;
  }
  return created;
}

module.exports = { ensureScheduledWorkOrders };
