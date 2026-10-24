const { writeAudit, writeLifecycle } = require("./audit.service");
const { getAsset } = require("./asset.service");
const { notify } = require("./notification.service");

async function assignAvailableAsset(conn, { organizationId, assetId, userId, notes, assignedBy }) {
  const asset = await getAsset(organizationId, assetId, conn);
  if (!asset) {
    return { error: { status: 404, message: "Asset not found" } };
  }
  if (asset.Status !== "Available") {
    return {
      error: {
        status: 400,
        message:
          asset.Status === "Assigned"
            ? "Asset is already assigned. Use transfer instead."
            : `Cannot assign an asset with status ${asset.Status}`,
      },
    };
  }

  const selfAssign = Number(userId) === Number(assignedBy);
  const [result] = await conn.query(
    `INSERT INTO asset_assignments
      (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy, AcceptanceStatus, AcceptedAt)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ${selfAssign ? "NOW()" : "NULL"})`,
    [organizationId, assetId, userId, notes, assignedBy, selfAssign ? "accepted" : "pending"]
  );
  await conn.query(
    `UPDATE assets SET Status = 'Assigned', CurrentAssignmentId = ?, UpdatedBy = ?
     WHERE AssetId = ? AND OrganizationId = ?`,
    [result.insertId, assignedBy, assetId, organizationId]
  );
  const [assignee] = await conn.query(
    "SELECT FullName FROM users WHERE UserId = ? AND OrganizationId = ? LIMIT 1",
    [userId, organizationId]
  );
  await writeLifecycle(conn, {
    organizationId,
    assetId,
    eventType: "assign",
    previousValue: "Available",
    newValue: assignee[0]?.FullName || String(userId),
    notes,
    createdBy: assignedBy,
  });
  await writeAudit(conn, {
    organizationId,
    userId: assignedBy,
    action: "asset.assign",
    entityType: "asset",
    entityId: assetId,
    after: { userId, notes },
  });
  if (!selfAssign) {
    await notify(conn, {
      organizationId,
      userId,
      type: "handover_pending",
      title: `Handover pending: ${asset.AssetTag}`,
      body: `${asset.Name} was assigned to you.`,
      link: "/my-assets",
      entityType: "assignment",
      entityId: result.insertId,
    });
  }
  return { assignmentId: result.insertId };
}

module.exports = { assignAvailableAsset };
