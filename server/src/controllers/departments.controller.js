const db = require("../config/db");

function mapRow(row) {
  return {
    DepartmentId: row.DepartmentId,
    Name: row.Name,
    CreatedAt: row.CreatedAt,
  };
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DepartmentId, Name, CreatedAt
       FROM departments
       WHERE OrganizationId = ?
       ORDER BY Name ASC`,
      [req.user.OrganizationId]
    );
    const departments = rows.map(mapRow);
    res.json({ status: true, departments, items: departments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load departments" });
  }
};

const create = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Department name is required" });
    }
    const [result] = await db.query(
      "INSERT INTO departments (OrganizationId, Name) VALUES (?, ?)",
      [req.user.OrganizationId, name]
    );
    res.status(201).json({
      status: true,
      department: { DepartmentId: result.insertId, Name: name },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That department already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create department" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Department name is required" });
    }
    const [result] = await db.query(
      "UPDATE departments SET Name = ? WHERE DepartmentId = ? AND OrganizationId = ?",
      [name, id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Department not found" });
    }
    res.json({ status: true, department: { DepartmentId: id, Name: name } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That department already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update department" });
  }
};

const remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [used] = await db.query(
      "SELECT AssetId FROM assets WHERE OrganizationId = ? AND DepartmentId = ? LIMIT 1",
      [req.user.OrganizationId, id]
    );
    if (used.length) {
      return res.status(409).json({ status: false, message: "This department is used by an asset" });
    }
    const [result] = await db.query(
      "DELETE FROM departments WHERE DepartmentId = ? AND OrganizationId = ?",
      [id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Department not found" });
    }
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete department" });
  }
};

module.exports = { list, create, update, remove };
