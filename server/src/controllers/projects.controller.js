const db = require("../config/db");

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ProjectId, Name, Status, CreatedAt
       FROM projects
       WHERE OrganizationId = ?
       ORDER BY Name ASC`,
      [req.user.OrganizationId]
    );
    res.json({ status: true, projects: rows, items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load projects" });
  }
};

const create = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Project name is required" });
    }
    const [result] = await db.query(
      "INSERT INTO projects (OrganizationId, Name) VALUES (?, ?)",
      [req.user.OrganizationId, name]
    );
    res.status(201).json({
      status: true,
      project: { ProjectId: result.insertId, Name: name, Status: "active" },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That project already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create project" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Project name is required" });
    }
    const status = req.body.status === "inactive" ? "inactive" : "active";
    const [result] = await db.query(
      "UPDATE projects SET Name = ?, Status = ? WHERE ProjectId = ? AND OrganizationId = ?",
      [name, status, id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Project not found" });
    }
    res.json({ status: true, project: { ProjectId: id, Name: name, Status: status } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That project already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update project" });
  }
};

const remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [used] = await db.query(
      "SELECT AssetId FROM assets WHERE OrganizationId = ? AND ProjectId = ? LIMIT 1",
      [req.user.OrganizationId, id]
    );
    if (used.length) {
      return res.status(409).json({ status: false, message: "This project is used by an asset" });
    }
    const [result] = await db.query(
      "DELETE FROM projects WHERE ProjectId = ? AND OrganizationId = ?",
      [id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Project not found" });
    }
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete project" });
  }
};

module.exports = { list, create, update, remove };
