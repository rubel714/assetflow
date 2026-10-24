const db = require("../config/db");
const { PERMISSIONS } = require("../lib/permissions");

async function notify(executor, payload) {
  const conn = executor || db;
  const userId = Number(payload.userId);
  if (!userId || userId === Number(payload.skipUserId)) return;
  await conn.query(
    `INSERT INTO notifications
      (OrganizationId, UserId, Type, Title, Body, Link, EntityType, EntityId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.organizationId,
      userId,
      payload.type,
      payload.title,
      payload.body || null,
      payload.link || null,
      payload.entityType || null,
      payload.entityId || null,
    ]
  );
}

async function notifyUnlessUnread(executor, payload) {
  const conn = executor || db;
  const [existing] = await conn.query(
    `SELECT NotificationId FROM notifications
     WHERE OrganizationId = ? AND UserId = ? AND Type = ? AND EntityType = ? AND EntityId = ? AND ReadAt IS NULL
     LIMIT 1`,
    [payload.organizationId, payload.userId, payload.type, payload.entityType, payload.entityId]
  );
  if (existing.length) return;
  await notify(conn, payload);
}

async function usersWithPermission(organizationId, permissionKey, conn) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT DISTINCT u.UserId
     FROM users u
     JOIN role_permissions rp ON rp.RoleKey = u.RoleKey
     WHERE u.OrganizationId = ? AND u.Status = 'active' AND rp.PermissionKey = ?`,
    [organizationId, permissionKey]
  );
  return rows.map((row) => row.UserId);
}

async function notifyPermission(executor, organizationId, permissionKey, payload, skipUserId) {
  const users = await usersWithPermission(organizationId, permissionKey, executor);
  for (const userId of users) {
    await notify(executor, { ...payload, organizationId, userId, skipUserId });
  }
}

async function ensureWarrantyNotifications(organizationId, userId, isEmployee) {
  const params = [organizationId];
  let extra = "";
  if (isEmployee) {
    extra = " AND aa.UserId = ? AND aa.Status = 'open'";
    params.push(userId);
  }
  const [rows] = await db.query(
    `SELECT a.AssetId, a.AssetTag, a.Name, ends.WarrantyEnd
     FROM assets a
     JOIN (
       SELECT AssetId, MIN(d) AS WarrantyEnd
       FROM (
         SELECT AssetId, LastWarrantyDate AS d
         FROM assets
         WHERE OrganizationId = ? AND LastWarrantyDate IS NOT NULL
         UNION ALL
         SELECT AssetId, EndDate
         FROM asset_warranties
         WHERE OrganizationId = ?
       ) dates
       GROUP BY AssetId
     ) ends ON ends.AssetId = a.AssetId
     LEFT JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
     WHERE a.OrganizationId = ?
       AND ends.WarrantyEnd <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ${extra}`,
    isEmployee ? [organizationId, organizationId, organizationId, userId] : [organizationId, organizationId, organizationId]
  );
  for (const row of rows) {
    const expired = String(row.WarrantyEnd).slice(0, 10) < new Date().toISOString().slice(0, 10);
    await notifyUnlessUnread(db, {
      organizationId,
      userId,
      type: "warranty_due",
      title: expired ? `Warranty expired: ${row.AssetTag}` : `Warranty due: ${row.AssetTag}`,
      body: `${row.Name} coverage ends ${String(row.WarrantyEnd).slice(0, 10)}.`,
      link: "/warranties",
      entityType: "asset",
      entityId: row.AssetId,
    });
  }
}

module.exports = {
  notify,
  notifyUnlessUnread,
  notifyPermission,
  usersWithPermission,
  ensureWarrantyNotifications,
  PERMISSIONS,
};
