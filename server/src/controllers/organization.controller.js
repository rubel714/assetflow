const db = require("../config/db");
const { writeAudit } = require("../services/audit.service");

const get = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT OrganizationId, Name, CreatedAt, UpdatedAt
       FROM organizations
       WHERE OrganizationId = ?
       LIMIT 1`,
      [req.user.OrganizationId]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }
    res.json({ status: true, organization: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load organization" });
  }
};

const update = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ status: false, message: "Organization name is required" });
    }

    const [rows] = await db.query(
      "SELECT OrganizationId, Name FROM organizations WHERE OrganizationId = ? LIMIT 1",
      [req.user.OrganizationId]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }

    await db.query("UPDATE organizations SET Name = ? WHERE OrganizationId = ?", [
      name,
      req.user.OrganizationId,
    ]);
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "organization.update",
      entityType: "organization",
      entityId: req.user.OrganizationId,
      before: { Name: rows[0].Name },
      after: { Name: name },
    });

    res.json({
      status: true,
      organization: { OrganizationId: req.user.OrganizationId, Name: name },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update organization" });
  }
};

module.exports = { get, update };
