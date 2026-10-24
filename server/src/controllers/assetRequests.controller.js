const db = require("../config/db");
const { writeAudit, writeLifecycle } = require("../services/audit.service");
const { getAsset, nextAssetTag } = require("../services/asset.service");
const { isEmployee } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const { assignAvailableAsset } = require("../services/custody.service");
const { notify, notifyPermission } = require("../services/notification.service");

const REQUEST_TYPES = new Set(["new_asset", "assignment"]);

function emptyToNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function hasPermission(user, key) {
  return (user?.permissions || []).includes(key);
}

async function orgRowExists(conn, table, idColumn, id, organizationId) {
  if (!id) return true;
  const [rows] = await conn.query(
    `SELECT ${idColumn} FROM ${table} WHERE ${idColumn} = ? AND OrganizationId = ? LIMIT 1`,
    [id, organizationId]
  );
  return rows.length > 0;
}

async function loadRequest(organizationId, requestId, conn) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT r.*,
            a.AssetTag, a.Name AS AssetName, a.Status AS AssetStatus,
            c.Name AS CategoryName,
            d.Name AS DepartmentName,
            l.Name AS LocationName,
            p.Name AS ProjectName,
            req.FullName AS RequestedByName,
            rv.FullName AS ReviewedByName
     FROM asset_requests r
     LEFT JOIN assets a ON a.AssetId = r.AssetId
     LEFT JOIN asset_categories c ON c.CategoryId = r.CategoryId
     LEFT JOIN departments d ON d.DepartmentId = r.DepartmentId
     LEFT JOIN locations l ON l.LocationId = r.LocationId
     LEFT JOIN projects p ON p.ProjectId = r.ProjectId
     LEFT JOIN users req ON req.UserId = r.RequestedBy
     LEFT JOIN users rv ON rv.UserId = r.ReviewedBy
     WHERE r.OrganizationId = ? AND r.RequestId = ?
     LIMIT 1`,
    [organizationId, requestId]
  );
  return rows[0] || null;
}

async function listAvailableAssets(organizationId) {
  const [rows] = await db.query(
    `SELECT AssetId, AssetTag, Name
     FROM assets
     WHERE OrganizationId = ? AND Status = 'Available'
     ORDER BY AssetTag ASC
     LIMIT 200`,
    [organizationId]
  );
  return rows;
}

const list = async (req, res) => {
  try {
    const params = [req.user.OrganizationId];
    let extra = "";
    if (isEmployee(req.user)) {
      extra = " AND r.RequestedBy = ?";
      params.push(req.user.UserId);
    }
    const [rows] = await db.query(
      `SELECT r.RequestId, r.RequestType, r.Status, r.Title, r.Justification, r.Quantity,
              r.CategoryId, r.AssetId, r.DepartmentId, r.LocationId, r.ProjectId,
              r.RequestedBy, r.ReviewedBy, r.ReviewedAt, r.ReviewNotes, r.CreatedAt,
              a.AssetTag, a.Name AS AssetName, a.Status AS AssetStatus,
              c.Name AS CategoryName,
              d.Name AS DepartmentName,
              l.Name AS LocationName,
              p.Name AS ProjectName,
              req.FullName AS RequestedByName,
              rv.FullName AS ReviewedByName
       FROM asset_requests r
       LEFT JOIN assets a ON a.AssetId = r.AssetId
       LEFT JOIN asset_categories c ON c.CategoryId = r.CategoryId
       LEFT JOIN departments d ON d.DepartmentId = r.DepartmentId
       LEFT JOIN locations l ON l.LocationId = r.LocationId
       LEFT JOIN projects p ON p.ProjectId = r.ProjectId
       LEFT JOIN users req ON req.UserId = r.RequestedBy
       LEFT JOIN users rv ON rv.UserId = r.ReviewedBy
       WHERE r.OrganizationId = ? ${extra}
       ORDER BY r.CreatedAt DESC, r.RequestId DESC
       LIMIT 200`,
      params
    );
    res.json({
      status: true,
      requests: rows,
      availableAssets: await listAvailableAssets(req.user.OrganizationId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load asset requests" });
  }
};

const create = async (req, res) => {
  try {
    const requestType = req.body.requestType?.trim();
    const title = req.body.title?.trim();
    const justification = req.body.justification?.trim() || null;
    const quantity = Number(req.body.quantity || 1);
    const categoryId = emptyToNull(req.body.categoryId) ? Number(req.body.categoryId) : null;
    const assetId = emptyToNull(req.body.assetId) ? Number(req.body.assetId) : null;
    const departmentId = emptyToNull(req.body.departmentId) ? Number(req.body.departmentId) : null;
    const locationId = emptyToNull(req.body.locationId) ? Number(req.body.locationId) : null;
    const projectId = emptyToNull(req.body.projectId) ? Number(req.body.projectId) : null;

    if (!REQUEST_TYPES.has(requestType)) {
      return res.status(400).json({ status: false, message: "Request type must be new_asset or assignment" });
    }
    if (!title) {
      return res.status(400).json({ status: false, message: "Title is required" });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ status: false, message: "Quantity must be at least 1" });
    }
    if (requestType === "assignment") {
      if (!assetId) {
        return res.status(400).json({ status: false, message: "An available asset is required" });
      }
    }

    const orgId = req.user.OrganizationId;
    if (categoryId && !(await orgRowExists(db, "asset_categories", "CategoryId", categoryId, orgId))) {
      return res.status(400).json({ status: false, message: "Category not found" });
    }
    if (departmentId && !(await orgRowExists(db, "departments", "DepartmentId", departmentId, orgId))) {
      return res.status(400).json({ status: false, message: "Department not found" });
    }
    if (locationId && !(await orgRowExists(db, "locations", "LocationId", locationId, orgId))) {
      return res.status(400).json({ status: false, message: "Location not found" });
    }
    if (projectId && !(await orgRowExists(db, "projects", "ProjectId", projectId, orgId))) {
      return res.status(400).json({ status: false, message: "Project not found" });
    }

    let asset = null;
    if (requestType === "assignment") {
      asset = await getAsset(orgId, assetId);
      if (!asset) {
        return res.status(404).json({ status: false, message: "Asset not found" });
      }
      if (asset.Status !== "Available") {
        return res.status(400).json({ status: false, message: "Assignment requests require an Available asset" });
      }
    }

    const [result] = await db.query(
      `INSERT INTO asset_requests
        (OrganizationId, RequestType, Status, Title, Justification, CategoryId, AssetId, Quantity,
         DepartmentId, LocationId, ProjectId, RequestedBy)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        requestType,
        title,
        justification,
        categoryId,
        requestType === "assignment" ? assetId : null,
        quantity,
        departmentId,
        locationId,
        projectId,
        req.user.UserId,
      ]
    );

    if (asset) {
      await writeLifecycle({
        organizationId: orgId,
        assetId,
        eventType: "request",
        previousValue: null,
        newValue: "pending",
        notes: title,
        createdBy: req.user.UserId,
      });
    }

    await writeAudit({
      organizationId: orgId,
      userId: req.user.UserId,
      action: "request.create",
      entityType: "asset_request",
      entityId: result.insertId,
      after: { requestType, title, assetId, categoryId },
    });
    await notifyPermission(db, orgId, PERMISSIONS.REQUESTS_APPROVE, {
      type: "request_pending",
      title: `New request: ${title}`,
      body: requestType === "assignment" ? "Assignment request pending approval." : "New asset request pending approval.",
      link: "/requests",
      entityType: "asset_request",
      entityId: result.insertId,
    }, req.user.UserId);

    res.status(201).json({
      status: true,
      request: await loadRequest(orgId, result.insertId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create asset request" });
  }
};

const update = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const action = req.body.action?.trim();
    const reviewNotes = req.body.reviewNotes?.trim() || null;
    if (!["approve", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ status: false, message: "Action must be approve, reject, or cancel" });
    }

    const canApprove = hasPermission(req.user, PERMISSIONS.REQUESTS_APPROVE);
    const row = await loadRequest(req.user.OrganizationId, requestId);
    if (!row) {
      return res.status(404).json({ status: false, message: "Request not found" });
    }
    if (isEmployee(req.user) && row.RequestedBy !== req.user.UserId && !canApprove) {
      return res.status(404).json({ status: false, message: "Request not found" });
    }
    if (row.Status !== "pending") {
      return res.status(400).json({ status: false, message: "Only a pending request can be updated" });
    }

    if (action === "cancel") {
      const isRequester = row.RequestedBy === req.user.UserId;
      if (!isRequester && !canApprove) {
        return res.status(403).json({ status: false, message: "You do not have permission for this action" });
      }
      if (!reviewNotes) {
        return res.status(400).json({ status: false, message: "A note is required to cancel" });
      }
    } else {
      if (!canApprove) {
        return res.status(403).json({ status: false, message: "You do not have permission for this action" });
      }
      if (action === "reject" && !reviewNotes) {
        return res.status(400).json({ status: false, message: "A note is required to reject" });
      }
    }

    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    const conn = await db.getConnection();
    let createdAssetId = row.AssetId;
    try {
      await conn.beginTransaction();
      if (action === "approve" && row.RequestType === "assignment") {
        if (!row.AssetId) {
          await conn.rollback();
          return res.status(400).json({ status: false, message: "This request has no asset to assign" });
        }
        const assigned = await assignAvailableAsset(conn, {
          organizationId: req.user.OrganizationId,
          assetId: row.AssetId,
          userId: row.RequestedBy,
          notes: row.Title,
          assignedBy: req.user.UserId,
        });
        if (assigned.error) {
          await conn.rollback();
          return res.status(assigned.error.status).json({ status: false, message: assigned.error.message });
        }
      }
      if (action === "approve" && row.RequestType === "new_asset") {
        const tag = await nextAssetTag(conn, req.user.OrganizationId);
        const [created] = await conn.query(
          `INSERT INTO assets
            (OrganizationId, AssetTag, Name, Description, CategoryId, Status, DepartmentId, LocationId, ProjectId, CreatedBy, UpdatedBy)
           VALUES (?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, ?)`,
          [
            req.user.OrganizationId,
            tag,
            row.Title,
            row.Justification,
            row.CategoryId,
            row.DepartmentId,
            row.LocationId,
            row.ProjectId,
            req.user.UserId,
            req.user.UserId,
          ]
        );
        createdAssetId = created.insertId;
        await writeLifecycle(conn, {
          organizationId: req.user.OrganizationId,
          assetId: createdAssetId,
          eventType: "request",
          previousValue: "pending",
          newValue: "approved",
          notes: row.Title,
          createdBy: req.user.UserId,
        });
      }

      await conn.query(
        `UPDATE asset_requests
         SET Status = ?, ReviewedBy = ?, ReviewedAt = NOW(), ReviewNotes = ?, AssetId = COALESCE(?, AssetId)
         WHERE RequestId = ? AND OrganizationId = ? AND Status = 'pending'`,
        [nextStatus, req.user.UserId, reviewNotes, createdAssetId, requestId, req.user.OrganizationId]
      );

      if (row.AssetId && action !== "approve") {
        await writeLifecycle(conn, {
          organizationId: req.user.OrganizationId,
          assetId: row.AssetId,
          eventType: "request",
          previousValue: "pending",
          newValue: nextStatus,
          notes: reviewNotes || row.Title,
          createdBy: req.user.UserId,
        });
      }

      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: `request.${action}`,
        entityType: "asset_request",
        entityId: requestId,
        after: { action, reviewNotes, assetId: createdAssetId },
      });

      if (row.RequestedBy && Number(row.RequestedBy) !== Number(req.user.UserId)) {
        await notify(conn, {
          organizationId: req.user.OrganizationId,
          userId: row.RequestedBy,
          type: "request_reviewed",
          title: `Request ${nextStatus}: ${row.Title}`,
          body: reviewNotes || (action === "approve" ? "Your request was approved." : "Your request was updated."),
          link: "/requests",
          entityType: "asset_request",
          entityId: requestId,
        });
      }
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
    res.status(500).json({ status: false, message: "Could not update asset request" });
  }
};

module.exports = { list, create, update };
