const db = require("../config/db");

function executor(conn) {
  return conn && typeof conn.query === "function" ? conn : db;
}

async function writeAudit(conn, payload) {
  const data = payload === undefined ? conn : payload;
  const { organizationId, userId, action, entityType, entityId, before, after } = data;
  await executor(payload === undefined ? null : conn).query(
    `INSERT INTO audit_logs
      (OrganizationId, UserId, Action, EntityType, EntityId, BeforeJson, AfterJson)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      userId || null,
      action,
      entityType,
      entityId || null,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ]
  );
}

async function writeLifecycle(conn, payload) {
  const data = payload === undefined ? conn : payload;
  const { organizationId, assetId, eventType, previousValue, newValue, notes, createdBy } = data;
  await executor(payload === undefined ? null : conn).query(
    `INSERT INTO asset_lifecycle_events
      (OrganizationId, AssetId, EventType, PreviousValue, NewValue, Notes, CreatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      assetId,
      eventType,
      previousValue || null,
      newValue || null,
      notes || null,
      createdBy || null,
    ]
  );
}

module.exports = { writeAudit, writeLifecycle };
