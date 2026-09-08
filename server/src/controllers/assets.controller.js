const db = require("../config/db");
const { writeAudit, writeLifecycle } = require("../services/audit.service");
const { ASSET_SELECT, nextAssetTag, getAsset, canAssignStatus } = require("../services/asset.service");
const { ASSET_STATUSES } = require("../lib/permissions");
const { isEmployee } = require("../middleware/auth");

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

const list = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const q = req.query.q?.trim();
    const status = req.query.status?.trim();
    const categoryId = req.query.categoryId;
    const params = [req.user.OrganizationId];
    let where = "WHERE a.OrganizationId = ?";

    if (isEmployee(req.user)) {
      where += " AND aa.UserId = ? AND aa.Status = 'open'";
      params.push(req.user.UserId);
    }
    if (q) {
      where += ` AND (
        a.Name LIKE ? OR a.AssetTag LIKE ? OR a.SerialNumber LIKE ?
        OR a.Brand LIKE ? OR au.FullName LIKE ?
      )`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (status) {
      where += " AND a.Status = ?";
      params.push(status);
    }
    if (categoryId) {
      where += " AND a.CategoryId = ?";
      params.push(categoryId);
    }

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
      assets: rows,
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
    if (isEmployee(req.user) && asset.CustodianId !== req.user.UserId) {
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
      return res.status(400).json({ status: false, message: "Asset name is required" });
    }
    const refError = await validateRefs(fields, req.user.OrganizationId);
    if (refError) {
      return res.status(400).json({ status: false, message: refError });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const tag = await nextAssetTag(conn, req.user.OrganizationId);
      const [result] = await conn.query(
        `INSERT INTO assets
          (OrganizationId, AssetTag, Name, Description, CategoryId, Brand, Model,
           SerialNumber, PurchaseDate, PurchaseCost, Status, LocationId, DepartmentId,
           ProjectId, SupplierId, ManufacturerId, CountryOfOriginId, ReceiveDate,
           LastWarrantyDate, MaintenanceScheduleId, Remarks, CreatedBy, UpdatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        after: { ...fields, AssetTag: tag },
      });
      await conn.commit();
      const asset = await getAsset(req.user.OrganizationId, result.insertId);
      res.status(201).json({ status: true, asset });
    } catch (err) {
      await conn.rollback();
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
      return res.status(404).json({ status: false, message: "Asset not found" });
    }

    const fields = parseAssetBody(req.body);
    if (!fields.Name) {
      return res.status(400).json({ status: false, message: "Asset name is required" });
    }
    const refError = await validateRefs(fields, req.user.OrganizationId);
    if (refError) {
      return res.status(400).json({ status: false, message: refError });
    }

    let nextStatus = current.Status;
    if (req.body.status && req.body.status !== current.Status) {
      if (!ASSET_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ status: false, message: "Invalid status" });
      }
      if (req.body.status === "Retired" && req.user.RoleKey !== "organization_admin") {
        return res.status(403).json({ status: false, message: "Only an organization admin can retire an asset" });
      }
      if (req.body.status === "Assigned") {
        return res.status(400).json({ status: false, message: "Use assign or transfer to set Assigned status" });
      }
      if (current.Status === "Assigned" && ["Damaged", "Lost", "Retired"].includes(req.body.status)) {
        return res.status(400).json({
          status: false,
          message: "Return the asset before marking it damaged, lost, or retired",
        });
      }
      nextStatus = req.body.status;
    }

    await db.query(
      `UPDATE assets SET
        Name = ?, Description = ?, CategoryId = ?, Brand = ?, Model = ?,
        SerialNumber = ?, PurchaseDate = ?, PurchaseCost = ?, Status = ?,
        LocationId = ?, DepartmentId = ?, ProjectId = ?, SupplierId = ?,
        ManufacturerId = ?, CountryOfOriginId = ?, ReceiveDate = ?,
        LastWarrantyDate = ?, MaintenanceScheduleId = ?, Remarks = ?, UpdatedBy = ?
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
        req.user.UserId,
        assetId,
        req.user.OrganizationId,
      ]
    );

    if (nextStatus !== current.Status) {
      await writeLifecycle(db, {
        organizationId: req.user.OrganizationId,
        assetId,
        eventType: "status",
        previousValue: current.Status,
        newValue: nextStatus,
        createdBy: req.user.UserId,
      });
    }
    await writeAudit(db, {
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "asset.update",
      entityType: "asset",
      entityId: assetId,
      before: current,
      after: { ...fields, Status: nextStatus },
    });

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
          (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [req.user.OrganizationId, assetId, userId, notes, req.user.UserId]
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
          (OrganizationId, AssetId, UserId, Notes, Status, AssignedBy)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [req.user.OrganizationId, assetId, userId, notes, req.user.UserId]
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

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const exportCsv = async (req, res) => {
  try {
    const params = [req.user.OrganizationId];
    let where = "WHERE a.OrganizationId = ?";
    if (isEmployee(req.user)) {
      where += " AND aa.UserId = ? AND aa.Status = 'open'";
      params.push(req.user.UserId);
    }
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
  exportCsv,
  canAssignStatus,
};
