const db = require("../config/db");

async function writeAudit(conn, { organizationId, userId, action, entityType, entityId, before, after }) {
  const executor = conn || db;
  await executor.query(
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

async function writeLifecycle(conn, { organizationId, assetId, eventType, previousValue, newValue, notes, createdBy }) {
  const executor = conn || db;
  await executor.query(
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
