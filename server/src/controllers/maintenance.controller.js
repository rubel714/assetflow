const db = require("../config/db");
const { writeAudit, writeLifecycle } = require("../services/audit.service");
const { getAsset, employeeCanViewAsset } = require("../services/asset.service");
const { isEmployee } = require("../middleware/auth");

const OPEN_STATUSES = new Set(["open", "in_progress"]);

async function loadRequest(organizationId, requestId, conn) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT r.*, a.AssetTag, a.Name AS AssetName, a.Status AS AssetStatus, a.CurrentAssignmentId,
            req.FullName AS RequestedByName
     FROM maintenance_requests r
     JOIN assets a ON a.AssetId = r.AssetId
     LEFT JOIN users req ON req.UserId = r.RequestedBy
     WHERE r.OrganizationId = ? AND r.RequestId = ?
     LIMIT 1`,
    [organizationId, requestId]
  );
  return rows[0] || null;
}

const list = async (req, res) => {
  try {
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = ` AND (
        r.RequestedBy = ?
        OR (aa.UserId = ? AND aa.Status = 'open')
      )`;
      params.push(req.user.UserId, req.user.UserId);
    }
    const [rows] = await db.query(
      `SELECT r.RequestId, r.AssetId, r.Title, r.Description, r.Status, r.WorkNotes,
              r.PreviousAssetStatus, r.StartedAt, r.CompletedAt, r.CreatedAt,
              a.AssetTag, a.Name AS AssetName, a.Status AS AssetStatus,
              req.FullName AS RequestedByName
       FROM maintenance_requests r
       JOIN assets a ON a.AssetId = r.AssetId AND a.OrganizationId = r.OrganizationId
       LEFT JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
       LEFT JOIN users req ON req.UserId = r.RequestedBy
       WHERE r.OrganizationId = ? ${extra}
       ORDER BY r.CreatedAt DESC, r.RequestId DESC
       LIMIT 200`,
      params
    );
    res.json({ status: true, requests: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load maintenance requests" });
  }
};

const create = async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const title = req.body.title?.trim();
    const description = req.body.description?.trim() || null;
    if (!assetId || !title) {
      return res.status(400).json({ status: false, message: "Asset and title are required" });
    }
    const asset = await getAsset(req.user.OrganizationId, assetId);
    if (!asset) {
      return res.status(404).json({ status: false, message: "Asset not found" });
    }
    if (!employeeCanViewAsset(req.user, asset) && isEmployee(req.user)) {
      return res.status(403).json({ status: false, message: "You can only request maintenance on your assets" });
    }
    if (["Retired", "Lost"].includes(asset.Status)) {
      return res.status(400).json({ status: false, message: `Cannot request maintenance for a ${asset.Status} asset` });
    }

    const [result] = await db.query(
      `INSERT INTO maintenance_requests
        (OrganizationId, AssetId, Title, Description, Status, RequestedBy)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [req.user.OrganizationId, assetId, title, description, req.user.UserId]
    );
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "maintenance.create",
      entityType: "maintenance_request",
      entityId: result.insertId,
      after: { assetId, title },
    });
    res.status(201).json({
      status: true,
      request: await loadRequest(req.user.OrganizationId, result.insertId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create maintenance request" });
  }
};

async function restoreAssetStatus(conn, req, row) {
  const previous = row.PreviousAssetStatus || "Available";
  const asset = await getAsset(req.user.OrganizationId, row.AssetId, conn);
  if (!asset || asset.Status !== "In Repair") return previous;
  let next = previous;
  if (previous === "Assigned" && !asset.CurrentAssignmentId) {
    next = "Available";
  }
  await conn.query(
    `UPDATE assets SET Status = ?, UpdatedBy = ? WHERE AssetId = ? AND OrganizationId = ?`,
    [next, req.user.UserId, row.AssetId, req.user.OrganizationId]
  );
  await writeLifecycle(conn, {
    organizationId: req.user.OrganizationId,
    assetId: row.AssetId,
    eventType: "status",
    previousValue: "In Repair",
    newValue: next,
    notes: "Maintenance work order closed",
    createdBy: req.user.UserId,
  });
  return next;
}

const update = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const action = req.body.action?.trim();
    const workNotes = req.body.workNotes?.trim() || null;
    if (!["start", "complete", "cancel"].includes(action)) {
      return res.status(400).json({ status: false, message: "Action must be start, complete, or cancel" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const row = await loadRequest(req.user.OrganizationId, requestId, conn);
      if (!row) {
        await conn.rollback();
        return res.status(404).json({ status: false, message: "Request not found" });
      }

      if (action === "start") {
        if (row.Status !== "open") {
          await conn.rollback();
          return res.status(400).json({ status: false, message: "Only an open request can be started" });
        }
        if (["Retired", "Lost"].includes(row.AssetStatus)) {
          await conn.rollback();
          return res.status(400).json({
            status: false,
            message: `Cannot start work on a ${row.AssetStatus} asset`,
          });
        }
        const [inFlight] = await conn.query(
          `SELECT RequestId FROM maintenance_requests
           WHERE OrganizationId = ? AND AssetId = ? AND Status = 'in_progress' AND RequestId <> ?
           LIMIT 1`,
          [req.user.OrganizationId, row.AssetId, requestId]
        );
        if (inFlight.length) {
          await conn.rollback();
          return res.status(400).json({ status: false, message: "This asset already has an active work order" });
        }
        await conn.query(
          `UPDATE maintenance_requests
           SET Status = 'in_progress', StartedBy = ?, StartedAt = NOW(),
               WorkNotes = COALESCE(?, WorkNotes), PreviousAssetStatus = ?
           WHERE RequestId = ? AND OrganizationId = ?`,
          [req.user.UserId, workNotes, row.AssetStatus, requestId, req.user.OrganizationId]
        );
        if (row.AssetStatus !== "In Repair") {
          await conn.query(
            `UPDATE assets SET Status = 'In Repair', UpdatedBy = ?
             WHERE AssetId = ? AND OrganizationId = ?`,
            [req.user.UserId, row.AssetId, req.user.OrganizationId]
          );
          await writeLifecycle(conn, {
            organizationId: req.user.OrganizationId,
            assetId: row.AssetId,
            eventType: "status",
            previousValue: row.AssetStatus,
            newValue: "In Repair",
            notes: row.Title,
            createdBy: req.user.UserId,
          });
        }
      } else if (action === "complete") {
        if (row.Status !== "in_progress" && row.Status !== "open") {
          await conn.rollback();
          return res.status(400).json({ status: false, message: "This request cannot be completed" });
        }
        if (row.Status === "in_progress") {
          await restoreAssetStatus(conn, req, row);
        }
        await conn.query(
          `UPDATE maintenance_requests
           SET Status = 'completed', CompletedBy = ?, CompletedAt = NOW(),
               WorkNotes = COALESCE(?, WorkNotes)
           WHERE RequestId = ? AND OrganizationId = ?`,
          [req.user.UserId, workNotes, requestId, req.user.OrganizationId]
        );
      } else {
        if (!OPEN_STATUSES.has(row.Status)) {
          await conn.rollback();
          return res.status(400).json({ status: false, message: "Only an open or in-progress request can be cancelled" });
        }
        if (row.Status === "in_progress") {
          await restoreAssetStatus(conn, req, row);
        }
        await conn.query(
          `UPDATE maintenance_requests
           SET Status = 'cancelled', WorkNotes = COALESCE(?, WorkNotes)
           WHERE RequestId = ? AND OrganizationId = ?`,
          [workNotes, requestId, req.user.OrganizationId]
        );
      }

      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: `maintenance.${action}`,
        entityType: "maintenance_request",
        entityId: requestId,
        after: { action, workNotes },
      });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({
      status: true,
      request: await loadRequest(req.user.OrganizationId, requestId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update maintenance request" });
  }
};

module.exports = { list, create, update };
