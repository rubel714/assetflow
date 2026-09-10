const db = require("../config/db");
const { auditSetup, getOrgRow } = require("../services/setupAudit.service");

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT LocationId, Name, CreatedAt
       FROM locations
       WHERE OrganizationId = ?
       ORDER BY Name ASC`,
      [req.user.OrganizationId]
    );
    res.json({ status: true, locations: rows, items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load locations" });
  }
};

const create = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Location name is required" });
    }
    const [result] = await db.query(
      "INSERT INTO locations (OrganizationId, Name) VALUES (?, ?)",
      [req.user.OrganizationId, name]
    );
    await auditSetup(req, {
      action: "location.create",
      entityType: "location",
      entityId: result.insertId,
      after: { Name: name },
    });
    res.status(201).json({
      status: true,
      location: { LocationId: result.insertId, Name: name },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That location already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create location" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Location name is required" });
    }
    const current = await getOrgRow("locations", "LocationId", id, req.user.OrganizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Location not found" });
    }
    await db.query(
      "UPDATE locations SET Name = ? WHERE LocationId = ? AND OrganizationId = ?",
      [name, id, req.user.OrganizationId]
    );
    await auditSetup(req, {
      action: "location.update",
      entityType: "location",
      entityId: id,
      before: { Name: current.Name },
      after: { Name: name },
    });
    res.json({ status: true, location: { LocationId: id, Name: name } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That location already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update location" });
  }
};

const remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await getOrgRow("locations", "LocationId", id, req.user.OrganizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Location not found" });
    }
    const [used] = await db.query(
      "SELECT AssetId FROM assets WHERE OrganizationId = ? AND LocationId = ? LIMIT 1",
      [req.user.OrganizationId, id]
    );
    if (used.length) {
      return res.status(409).json({ status: false, message: "This location is used by an asset" });
    }
    await db.query(
      "DELETE FROM locations WHERE LocationId = ? AND OrganizationId = ?",
      [id, req.user.OrganizationId]
    );
    await auditSetup(req, {
      action: "location.delete",
      entityType: "location",
      entityId: id,
      before: { Name: current.Name },
    });
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete location" });
  }
};

module.exports = { list, create, update, remove };
