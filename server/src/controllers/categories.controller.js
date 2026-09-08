const db = require("../config/db");

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT CategoryId, Name, CreatedAt
       FROM asset_categories
       WHERE OrganizationId = ?
       ORDER BY Name ASC`,
      [req.user.OrganizationId]
    );
    res.json({ status: true, categories: rows, items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load categories" });
  }
};

const create = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Category name is required" });
    }
    const [result] = await db.query(
      "INSERT INTO asset_categories (OrganizationId, Name) VALUES (?, ?)",
      [req.user.OrganizationId, name]
    );
    res.status(201).json({
      status: true,
      category: { CategoryId: result.insertId, Name: name },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That category already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create category" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Category name is required" });
    }
    const [result] = await db.query(
      "UPDATE asset_categories SET Name = ? WHERE CategoryId = ? AND OrganizationId = ?",
      [name, id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }
    res.json({ status: true, category: { CategoryId: id, Name: name } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That category already exists" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update category" });
  }
};

const remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [used] = await db.query(
      "SELECT AssetId FROM assets WHERE OrganizationId = ? AND CategoryId = ? LIMIT 1",
      [req.user.OrganizationId, id]
    );
    if (used.length) {
      return res.status(409).json({ status: false, message: "This category is used by an asset" });
    }
    const [result] = await db.query(
      "DELETE FROM asset_categories WHERE CategoryId = ? AND OrganizationId = ?",
      [id, req.user.OrganizationId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete category" });
  }
};

module.exports = { list, create, update, remove };
