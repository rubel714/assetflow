const db = require("../config/db");
const { auditSetup, getOrgRow } = require("../services/setupAudit.service");

function mapRow(row) {
  return {
    DesignationId: row.DesignationId,
    Name: row.Name,
    CreatedAt: row.CreatedAt,
  };
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DesignationId, Name, CreatedAt
       FROM designations
       WHERE OrganizationId = ?
       ORDER BY Name ASC`,
      [req.user.OrganizationId]
    );
    const designations = rows.map(mapRow);
    res.json({ status: true, designations, items: designations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load designations" });
  }
};

const create = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Designation name is required" });
    }
    const [result] = await db.query(
      "INSERT INTO designations (OrganizationId, Name) VALUES (?, ?)",
      [req.user.OrganizationId, name]
    );
    await auditSetup(req, {
      action: "designation.create",
      entityType: "designation",
      entityId: result.insertId,
      after: { Name: name },
    });
    res.status(201).json({
      status: true,
      designation: { DesignationId: result.insertId, Name: name },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That designation already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create designation" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Designation name is required" });
    }
    const current = await getOrgRow("designations", "DesignationId", id, req.user.OrganizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Designation not found" });
    }
    await db.query(
      "UPDATE designations SET Name = ? WHERE DesignationId = ? AND OrganizationId = ?",
      [name, id, req.user.OrganizationId]
    );
    await auditSetup(req, {
      action: "designation.update",
      entityType: "designation",
      entityId: id,
      before: { Name: current.Name },
      after: { Name: name },
    });
    res.json({ status: true, designation: { DesignationId: id, Name: name } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That designation already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update designation" });
  }
};

const remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await getOrgRow("designations", "DesignationId", id, req.user.OrganizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Designation not found" });
    }
    const [used] = await db.query(
      "SELECT UserId FROM users WHERE OrganizationId = ? AND DesignationId = ? LIMIT 1",
      [req.user.OrganizationId, id]
    );
    if (used.length) {
      return res.status(409).json({ status: false, message: "This designation is used by a user" });
    }
    await db.query(
      "DELETE FROM designations WHERE DesignationId = ? AND OrganizationId = ?",
      [id, req.user.OrganizationId]
    );
    await auditSetup(req, {
      action: "designation.delete",
      entityType: "designation",
      entityId: id,
      before: { Name: current.Name },
    });
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete designation" });
  }
};

module.exports = { list, create, update, remove };
