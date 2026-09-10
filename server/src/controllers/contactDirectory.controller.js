const db = require("../config/db");
const { auditSetup, getOrgRow } = require("../services/setupAudit.service");

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function readFields(body) {
  const name = body.name?.trim();
  const email = emptyToNull(body.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" };
  }
  return {
    name,
    ContactName: emptyToNull(body.contactName),
    Email: email,
    Phone: emptyToNull(body.phone),
    Address: emptyToNull(body.address),
    Website: emptyToNull(body.website),
  };
}

function createContactDirectoryController({
  table,
  idCol,
  listKey,
  itemKey,
  label,
  assetFk,
}) {
  const columns = `SELECT ${idCol}, Name, ContactName, Email, Phone, Address, Website, CreatedAt
    FROM ${table}
    WHERE OrganizationId = ?
    ORDER BY Name ASC`;

  const mapRow = (row) => ({
    [idCol]: row[idCol],
    Name: row.Name,
    ContactName: row.ContactName,
    Email: row.Email,
    Phone: row.Phone,
    Address: row.Address,
    Website: row.Website,
    CreatedAt: row.CreatedAt,
    id: row[idCol],
  });

  const list = async (req, res) => {
    try {
      const [rows] = await db.query(columns, [req.user.OrganizationId]);
      const items = rows.map(mapRow);
      res.json({ status: true, [listKey]: items, items });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: `Could not load ${listKey}` });
    }
  };

  const create = async (req, res) => {
    try {
      const fields = readFields(req.body);
      if (fields.error) {
        return res.status(400).json({ status: false, message: fields.error });
      }
      if (!fields.name) {
        return res.status(400).json({ status: false, message: `${label} name is required` });
      }
      const [result] = await db.query(
        `INSERT INTO ${table}
          (OrganizationId, Name, ContactName, Email, Phone, Address, Website)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.OrganizationId,
          fields.name,
          fields.ContactName,
          fields.Email,
          fields.Phone,
          fields.Address,
          fields.Website,
        ]
      );
      await auditSetup(req, {
        action: `${itemKey}.create`,
        entityType: itemKey,
        entityId: result.insertId,
        after: { Name: fields.name },
      });
      res.status(201).json({
        status: true,
        [itemKey]: mapRow({ [idCol]: result.insertId, ...fields, Name: fields.name }),
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ status: false, message: `That ${label} already exists` });
      }
      console.error(error);
      res.status(500).json({ status: false, message: `Could not create ${label}` });
    }
  };

  const update = async (req, res) => {
    try {
      const id = Number(req.params.id);
      const fields = readFields(req.body);
      if (fields.error) {
        return res.status(400).json({ status: false, message: fields.error });
      }
      if (!fields.name) {
        return res.status(400).json({ status: false, message: `${label} name is required` });
      }
      const current = await getOrgRow(table, idCol, id, req.user.OrganizationId);
      if (!current) {
        return res.status(404).json({ status: false, message: `${label} not found` });
      }
      await db.query(
        `UPDATE ${table}
         SET Name = ?, ContactName = ?, Email = ?, Phone = ?, Address = ?, Website = ?
         WHERE ${idCol} = ? AND OrganizationId = ?`,
        [
          fields.name,
          fields.ContactName,
          fields.Email,
          fields.Phone,
          fields.Address,
          fields.Website,
          id,
          req.user.OrganizationId,
        ]
      );
      await auditSetup(req, {
        action: `${itemKey}.update`,
        entityType: itemKey,
        entityId: id,
        before: { Name: current.Name },
        after: { Name: fields.name },
      });
      res.json({
        status: true,
        [itemKey]: mapRow({ [idCol]: id, ...fields, Name: fields.name }),
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ status: false, message: `That ${label} already exists` });
      }
      console.error(error);
      res.status(500).json({ status: false, message: `Could not update ${label}` });
    }
  };

  const remove = async (req, res) => {
    try {
      const id = Number(req.params.id);
      const current = await getOrgRow(table, idCol, id, req.user.OrganizationId);
      if (!current) {
        return res.status(404).json({ status: false, message: `${label} not found` });
      }
      const [used] = await db.query(
        `SELECT AssetId FROM assets WHERE OrganizationId = ? AND ${assetFk} = ? LIMIT 1`,
        [req.user.OrganizationId, id]
      );
      if (used.length) {
        return res.status(409).json({
          status: false,
          message: `This ${label} is used by an asset`,
        });
      }
      await db.query(
        `DELETE FROM ${table} WHERE ${idCol} = ? AND OrganizationId = ?`,
        [id, req.user.OrganizationId]
      );
      await auditSetup(req, {
        action: `${itemKey}.delete`,
        entityType: itemKey,
        entityId: id,
        before: { Name: current.Name },
      });
      res.json({ status: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: `Could not delete ${label}` });
    }
  };

  return { list, create, update, remove };
}

module.exports = {
  suppliers: createContactDirectoryController({
    table: "suppliers",
    idCol: "SupplierId",
    listKey: "suppliers",
    itemKey: "supplier",
    label: "supplier",
    assetFk: "SupplierId",
  }),
  manufacturers: createContactDirectoryController({
    table: "manufacturers",
    idCol: "ManufacturerId",
    listKey: "manufacturers",
    itemKey: "manufacturer",
    label: "manufacturer",
    assetFk: "ManufacturerId",
  }),
};
