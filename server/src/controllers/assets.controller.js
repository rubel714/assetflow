const db = require("../config/db");
const { writeAudit, writeLifecycle } = require("../services/audit.service");
const { ASSET_SELECT, nextAssetTag, getAsset, attachImageUrl, canAssignStatus, buildAssetListWhere, employeeCanViewAsset } = require("../services/asset.service");
const { relativeImagePath, deleteImageFile } = require("../services/assetImage.service");
const { resolveStatusChange } = require("../lib/statusTransitions");

function emptyToNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function parseAssetBody(body) {
  return {
    Name: body.name?.trim(),
    Description: emptyToNull(body.description?.trim()),
    CategoryId: emptyToNull(body.categoryId),
    Brand: emptyToNull(body.brand?.trim()),
    Model: emptyToNull(body.model?.trim()),
    SerialNumber: emptyToNull(body.serialNumber?.trim()),
    PurchaseDate: emptyToNull(body.purchaseDate),
    PurchaseCost: emptyToNull(body.purchaseCost),
    LocationId: emptyToNull(body.locationId),
    DepartmentId: emptyToNull(body.departmentId),
    ProjectId: emptyToNull(body.projectId),
    SupplierId: emptyToNull(body.supplierId),
    ManufacturerId: emptyToNull(body.manufacturerId),
    CountryOfOriginId: emptyToNull(body.countryOfOriginId),
    ReceiveDate: emptyToNull(body.receiveDate),
    LastWarrantyDate: emptyToNull(body.lastWarrantyDate),
    MaintenanceScheduleId: emptyToNull(body.maintenanceScheduleId),
    Remarks: emptyToNull(body.remarks?.trim()),
  };
}

async function assertOrgRef(table, idCol, id, organizationId) {
  if (!id) return true;
  const [rows] = await db.query(
    `SELECT ${idCol} FROM ${table} WHERE ${idCol} = ? AND OrganizationId = ? LIMIT 1`,
    [id, organizationId]
  );
  return rows.length > 0;
}

async function validateRefs(fields, organizationId) {
  const checks = [
    ["asset_categories", "CategoryId", fields.CategoryId, "category"],
    ["locations", "LocationId", fields.LocationId, "location"],
    ["departments", "DepartmentId", fields.DepartmentId, "department"],
    ["projects", "ProjectId", fields.ProjectId, "project"],
    ["suppliers", "SupplierId", fields.SupplierId, "supplier"],
    ["manufacturers", "ManufacturerId", fields.ManufacturerId, "manufacturer"],
    ["countries", "CountryId", fields.CountryOfOriginId, "country of origin"],
    ["maintenance_schedules", "MaintenanceScheduleId", fields.MaintenanceScheduleId, "maintenance schedule"],
  ];
  for (const [table, col, id, label] of checks) {
    if (!(await assertOrgRef(table, col, id, organizationId))) {
      return `${label} was not found`;
    }
  }
  return null;
}

function wantsImageRemoved(body) {
  return body.removeImage === true || body.removeImage === "true" || body.removeImage === "1";
}

function uploadedImagePath(req) {
  if (!req.file) return null;
  return relativeImagePath(req.user.OrganizationId, req.file.filename);
}

function discardUploadedFile(req) {
  const imagePath = uploadedImagePath(req);
  if (imagePath) deleteImageFile(imagePath);
}

const list = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const { where, params } = buildAssetListWhere(req.user, req.query);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM assets a
       LEFT JOIN asset_assignments aa ON aa.AssignmentId = a.CurrentAssignmentId
       LEFT JOIN users au ON au.UserId = aa.UserId
       ${where}`,
      params
    );
    const [rows] = await db.query(
      `${ASSET_SELECT} ${where} ORDER BY a.AssetId DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      status: true,
      page,
      pageSize,
      total: countRows[0].total,
      assets: rows.map(attachImageUrl),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load assets" });
  }
};

const getOne = async (req, res) => {
  try {
    const asset = await getAsset(req.user.OrganizationId, Number(req.params.id));
    if (!asset) {
      return res.status(404).json({ status: false, message: "Asset not found" });
    }
    if (!employeeCanViewAsset(req.user, asset)) {
      return res.status(403).json({ status: false, message: "You can only view assets assigned to you" });
    }

    const [history] = await db.query(
      `SELECT e.EventId, e.EventType, e.PreviousValue, e.NewValue, e.Notes, e.CreatedAt,
              u.FullName AS CreatedByName
       FROM asset_lifecycle_events e
       LEFT JOIN users u ON u.UserId = e.CreatedBy
       WHERE e.OrganizationId = ? AND e.AssetId = ?
       ORDER BY e.CreatedAt DESC, e.EventId DESC`,
      [req.user.OrganizationId, asset.AssetId]
    );

    res.json({ status: true, asset, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load asset" });
  }
};

const create = async (req, res) => {
  try {
    const fields = parseAssetBody(req.body);
    if (!fields.Name) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Asset name is required" });
    }
    const refError = await validateRefs(fields, req.user.OrganizationId);
    if (refError) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: refError });
    }

    const imagePath = uploadedImagePath(req);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const tag = await nextAssetTag(conn, req.user.OrganizationId);
      const [result] = await conn.query(
        `INSERT INTO assets
          (OrganizationId, AssetTag, Name, Description, CategoryId, Brand, Model,
           SerialNumber, PurchaseDate, PurchaseCost, Status, LocationId, DepartmentId,
           ProjectId, SupplierId, ManufacturerId, CountryOfOriginId, ReceiveDate,
           LastWarrantyDate, MaintenanceScheduleId, Remarks, ImagePath, CreatedBy, UpdatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.OrganizationId,
          tag,
          fields.Name,
          fields.Description,
          fields.CategoryId,
          fields.Brand,
          fields.Model,
          fields.SerialNumber,
          fields.PurchaseDate,
          fields.PurchaseCost,
          fields.LocationId,
          fields.DepartmentId,
          fields.ProjectId,
          fields.SupplierId,
          fields.ManufacturerId,
          fields.CountryOfOriginId,
          fields.ReceiveDate,
          fields.LastWarrantyDate,
          fields.MaintenanceScheduleId,
          fields.Remarks,
          imagePath,
          req.user.UserId,
          req.user.UserId,
        ]
      );
      await writeLifecycle(conn, {
        organizationId: req.user.OrganizationId,
        assetId: result.insertId,
        eventType: "created",
        newValue: "Available",
        notes: `Created as ${tag}`,
        createdBy: req.user.UserId,
      });
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.create",
        entityType: "asset",
        entityId: result.insertId,
        after: { ...fields, AssetTag: tag, ImagePath: imagePath },
      });
      await conn.commit();
      const asset = await getAsset(req.user.OrganizationId, result.insertId);
      res.status(201).json({ status: true, asset });
    } catch (err) {
      await conn.rollback();
      if (imagePath) deleteImageFile(imagePath);
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create asset" });
  }
};

const update = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const current = await getAsset(req.user.OrganizationId, assetId);
    if (!current) {
      discardUploadedFile(req);
      return res.status(404).json({ status: false, message: "Asset not found" });
    }

    const fields = parseAssetBody(req.body);
    if (!fields.Name) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Asset name is required" });
    }
    const refError = await validateRefs(fields, req.user.OrganizationId);
    if (refError) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: refError });
    }

    const transition = resolveStatusChange(current.Status, req.body.status, req.user.RoleKey);
    if (!transition.ok) {
      discardUploadedFile(req);
      return res.status(transition.statusCode).json({ status: false, message: transition.message });
    }
    const nextStatus = transition.nextStatus;

    let imagePath = current.ImagePath || null;
    if (req.file) {
      imagePath = uploadedImagePath(req);
    } else if (wantsImageRemoved(req.body)) {
      imagePath = null;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (transition.closeAssignment && current.CurrentAssignmentId) {
        await conn.query(
          `UPDATE asset_assignments
           SET Status = 'closed', ClosedAt = NOW(), ClosedBy = ?
           WHERE AssignmentId = ? AND OrganizationId = ?`,
          [req.user.UserId, current.CurrentAssignmentId, req.user.OrganizationId]
        );
      }
      await conn.query(
        `UPDATE assets SET
          Name = ?, Description = ?, CategoryId = ?, Brand = ?, Model = ?,
          SerialNumber = ?, PurchaseDate = ?, PurchaseCost = ?, Status = ?,
          LocationId = ?, DepartmentId = ?, ProjectId = ?, SupplierId = ?,
          ManufacturerId = ?, CountryOfOriginId = ?, ReceiveDate = ?,
          LastWarrantyDate = ?, MaintenanceScheduleId = ?, Remarks = ?, ImagePath = ?,
          CurrentAssignmentId = ?, UpdatedBy = ?
         WHERE AssetId = ? AND OrganizationId = ?`,
        [
          fields.Name,
          fields.Description,
          fields.CategoryId,
          fields.Brand,
          fields.Model,
          fields.SerialNumber,
          fields.PurchaseDate,
          fields.PurchaseCost,
          nextStatus,
          fields.LocationId,
          fields.DepartmentId,
          fields.ProjectId,
          fields.SupplierId,
          fields.ManufacturerId,
          fields.CountryOfOriginId,
          fields.ReceiveDate,
          fields.LastWarrantyDate,
          fields.MaintenanceScheduleId,
          fields.Remarks,
          imagePath,
          transition.closeAssignment ? null : current.CurrentAssignmentId,
          req.user.UserId,
          assetId,
          req.user.OrganizationId,
        ]
      );

      if (nextStatus !== current.Status) {
        await writeLifecycle(conn, {
          organizationId: req.user.OrganizationId,
          assetId,
          eventType: "status",
          previousValue: current.Status,
          newValue: nextStatus,
          createdBy: req.user.UserId,
        });
      }
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.update",
        entityType: "asset",
        entityId: assetId,
        before: current,
        after: { ...fields, Status: nextStatus },
      });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    if (imagePath !== (current.ImagePath || null) && current.ImagePath) {
      deleteImageFile(current.ImagePath);
    }

    res.json({ status: true, asset: await getAsset(req.user.OrganizationId, assetId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update asset" });
  }
};

async function getActiveUser(organizationId, userId) {
  const [rows] = await db.query(
    `SELECT UserId, FullName FROM users
     WHERE UserId = ? AND OrganizationId = ? AND Status = 'active' LIMIT 1`,
    [userId, organizationId]
  );
  return rows[0] || null;
}

const assign = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const userId = Number(req.body.userId);
    const notes = req.body.notes?.trim() || null;
    if (!userId) {
      return res.status(400).json({ status: false, message: "An employee is required" });
    }

    const assignee = await getActiveUser(req.user.OrganizationId, userId);
    if (!assignee) {
      return res.status(400).json({ status: false, message: "Employee was not found" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const asset = await getAsset(req.user.OrganizationId, assetId, conn);
      if (!asset) {
        await conn.rollback();
        return res.status(404).json({ status: false, message: "Asset not found" });
      }
      if (asset.Status !== "Available") {
        await conn.rollback();
        return res.status(400).json({
          status: false,
          message: asset.Status === "Assigned"
            ? "Asset is already assigned. Use transfer instead."
            : `Cannot assign an asset with status ${asset.Status}`,
        });
      }

      const [result] = await conn.query(
        `INSERT INTO asset_assignments
          (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy, AcceptanceStatus, AcceptedAt)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ${userId === req.user.UserId ? "NOW()" : "NULL"})`,
        [
          req.user.OrganizationId,
          assetId,
          userId,
          notes,
          req.user.UserId,
          userId === req.user.UserId ? "accepted" : "pending",
        ]
      );
      await conn.query(
        `UPDATE assets SET Status = 'Assigned', CurrentAssignmentId = ?, UpdatedBy = ?
         WHERE AssetId = ? AND OrganizationId = ?`,
        [result.insertId, req.user.UserId, assetId, req.user.OrganizationId]
      );
      await writeLifecycle(conn, {
        organizationId: req.user.OrganizationId,
        assetId,
        eventType: "assign",
        previousValue: "Available",
        newValue: assignee.FullName,
        notes,
        createdBy: req.user.UserId,
      });
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.assign",
        entityType: "asset",
        entityId: assetId,
        after: { userId, notes },
      });
      await conn.commit();
      res.json({ status: true, asset: await getAsset(req.user.OrganizationId, assetId) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not assign asset" });
  }
};

const transfer = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const userId = Number(req.body.userId);
    const notes = req.body.notes?.trim() || null;
    if (!userId) {
      return res.status(400).json({ status: false, message: "An employee is required" });
    }
    const assignee = await getActiveUser(req.user.OrganizationId, userId);
    if (!assignee) {
      return res.status(400).json({ status: false, message: "Employee was not found" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const asset = await getAsset(req.user.OrganizationId, assetId, conn);
      if (!asset) {
        await conn.rollback();
        return res.status(404).json({ status: false, message: "Asset not found" });
      }
      if (asset.Status !== "Assigned" || !asset.CurrentAssignmentId) {
        await conn.rollback();
        return res.status(400).json({ status: false, message: "Only an assigned asset can be transferred" });
      }
      if (asset.CustodianId === userId) {
        await conn.rollback();
        return res.status(400).json({ status: false, message: "Asset is already assigned to that employee" });
      }

      await conn.query(
        `UPDATE asset_assignments
         SET Status = 'closed', ClosedAt = NOW(), ClosedBy = ?
         WHERE AssignmentId = ? AND OrganizationId = ?`,
        [req.user.UserId, asset.CurrentAssignmentId, req.user.OrganizationId]
      );
      const [result] = await conn.query(
        `INSERT INTO asset_assignments
          (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy, AcceptanceStatus, AcceptedAt)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ${userId === req.user.UserId ? "NOW()" : "NULL"})`,
        [
          req.user.OrganizationId,
          assetId,
          userId,
          notes,
          req.user.UserId,
          userId === req.user.UserId ? "accepted" : "pending",
        ]
      );
      await conn.query(
        `UPDATE assets SET CurrentAssignmentId = ?, UpdatedBy = ?
         WHERE AssetId = ? AND OrganizationId = ?`,
        [result.insertId, req.user.UserId, assetId, req.user.OrganizationId]
      );
      await writeLifecycle(conn, {
        organizationId: req.user.OrganizationId,
        assetId,
        eventType: "transfer",
        previousValue: asset.CustodianName,
        newValue: assignee.FullName,
        notes,
        createdBy: req.user.UserId,
      });
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.transfer",
        entityType: "asset",
        entityId: assetId,
        before: { userId: asset.CustodianId },
        after: { userId, notes },
      });
      await conn.commit();
      res.json({ status: true, asset: await getAsset(req.user.OrganizationId, assetId) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not transfer asset" });
  }
};

const returnAsset = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const notes = req.body.notes?.trim() || null;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const asset = await getAsset(req.user.OrganizationId, assetId, conn);
      if (!asset) {
        await conn.rollback();
        return res.status(404).json({ status: false, message: "Asset not found" });
      }
      if (asset.Status !== "Assigned" || !asset.CurrentAssignmentId) {
        await conn.rollback();
        return res.status(400).json({ status: false, message: "Only an assigned asset can be returned" });
      }

      await conn.query(
        `UPDATE asset_assignments
         SET Status = 'closed', ClosedAt = NOW(), ClosedBy = ?
         WHERE AssignmentId = ? AND OrganizationId = ?`,
        [req.user.UserId, asset.CurrentAssignmentId, req.user.OrganizationId]
      );
      await conn.query(
        `UPDATE assets SET Status = 'Available', CurrentAssignmentId = NULL, UpdatedBy = ?
         WHERE AssetId = ? AND OrganizationId = ?`,
        [req.user.UserId, assetId, req.user.OrganizationId]
      );
      await writeLifecycle(conn, {
        organizationId: req.user.OrganizationId,
        assetId,
        eventType: "return",
        previousValue: asset.CustodianName,
        newValue: "Available",
        notes,
        createdBy: req.user.UserId,
      });
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.return",
        entityType: "asset",
        entityId: assetId,
        before: { userId: asset.CustodianId },
        after: { notes },
      });
      await conn.commit();
      res.json({ status: true, asset: await getAsset(req.user.OrganizationId, assetId) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not return asset" });
  }
};

const accept = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const asset = await getAsset(req.user.OrganizationId, assetId, conn);
      if (!asset) {
        await conn.rollback();
        return res.status(404).json({ status: false, message: "Asset not found" });
      }
      if (!asset.CurrentAssignmentId || Number(asset.CustodianId) !== Number(req.user.UserId)) {
        await conn.rollback();
        return res.status(403).json({ status: false, message: "You can only accept assets assigned to you" });
      }
      if (asset.HandoverStatus === "accepted") {
        await conn.rollback();
        return res.status(400).json({ status: false, message: "This handover is already accepted" });
      }

      await conn.query(
        `UPDATE asset_assignments
         SET AcceptanceStatus = 'accepted', AcceptedAt = NOW()
         WHERE AssignmentId = ? AND OrganizationId = ?`,
        [asset.CurrentAssignmentId, req.user.OrganizationId]
      );
      await writeLifecycle(conn, {
        organizationId: req.user.OrganizationId,
        assetId,
        eventType: "handover",
        previousValue: "pending",
        newValue: "accepted",
        createdBy: req.user.UserId,
      });
      await writeAudit(conn, {
        organizationId: req.user.OrganizationId,
        userId: req.user.UserId,
        action: "asset.accept",
        entityType: "asset",
        entityId: assetId,
        after: { assignmentId: asset.CurrentAssignmentId },
      });
      await conn.commit();
      res.json({ status: true, asset: await getAsset(req.user.OrganizationId, assetId) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not accept handover" });
  }
};

const lookup = async (req, res) => {
  try {
    const tag = req.query.tag?.trim();
    if (!tag) {
      return res.status(400).json({ status: false, message: "Asset tag is required" });
    }
    const [rows] = await db.query(
      `${ASSET_SELECT} WHERE a.OrganizationId = ? AND a.AssetTag = ? LIMIT 1`,
      [req.user.OrganizationId, tag]
    );
    const asset = attachImageUrl(rows[0] || null);
    if (!asset) {
      return res.status(404).json({ status: false, message: "No asset found with that tag" });
    }
    if (!employeeCanViewAsset(req.user, asset)) {
      return res.status(403).json({ status: false, message: "You can only view assets assigned to you" });
    }
    res.json({ status: true, asset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not look up asset" });
  }
};

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const exportCsv = async (req, res) => {
  try {
    const { where, params } = buildAssetListWhere(req.user, req.query);
    const [rows] = await db.query(`${ASSET_SELECT} ${where} ORDER BY a.AssetTag ASC`, params);
    const header = [
      "AssetTag",
      "Name",
      "Category",
      "Status",
      "SerialNumber",
      "Brand",
      "Model",
      "Custodian",
      "Department",
      "Location",
      "Project",
      "Supplier",
      "Manufacturer",
      "CountryOfOrigin",
      "ReceiveDate",
      "LastWarrantyDate",
      "MaintenanceSchedule",
      "Remarks",
      "PurchaseDate",
      "PurchaseCost",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.AssetTag,
          row.Name,
          row.CategoryName,
          row.Status,
          row.SerialNumber,
          row.Brand,
          row.Model,
          row.CustodianName,
          row.DepartmentName,
          row.LocationName,
          row.ProjectName,
          row.SupplierName,
          row.ManufacturerName,
          row.CountryOfOriginName,
          row.ReceiveDate,
          row.LastWarrantyDate,
          row.MaintenanceScheduleName,
          row.Remarks,
          row.PurchaseDate,
          row.PurchaseCost,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=asset-register.csv");
    res.send(lines.join("\n"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not export assets" });
  }
};

module.exports = {
  list,
  getOne,
  create,
  update,
  assign,
  transfer,
  returnAsset,
  accept,
  lookup,
  exportCsv,
  canAssignStatus,
};
