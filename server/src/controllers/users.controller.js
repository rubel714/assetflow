const bcrypt = require("bcrypt");
const db = require("../config/db");
const { writeAudit } = require("../services/audit.service");
const { ROLES } = require("../lib/permissions");

const ALLOWED_ROLES = Object.values(ROLES);

function mapUser(row) {
  return {
    UserId: row.UserId,
    Username: row.Username,
    FullName: row.FullName,
    Role: row.RoleKey,
    Status: row.Status,
    CreatedAt: row.CreatedAt,
  };
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT UserId, Username, FullName, RoleKey, Status, CreatedAt
       FROM users
       WHERE OrganizationId = ?
       ORDER BY FullName ASC`,
      [req.user.OrganizationId]
    );
    res.json({ status: true, users: rows.map(mapUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load users" });
  }
};

const create = async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username?.trim() || !password || !fullName?.trim()) {
      return res.status(400).json({ status: false, message: "Username, password, and full name are required" });
    }
    const roleKey = role || ROLES.EMPLOYEE;
    if (!ALLOWED_ROLES.includes(roleKey)) {
      return res.status(400).json({ status: false, message: "Invalid role" });
    }
    if (password.length < 6) {
      return res.status(400).json({ status: false, message: "Password must be at least 6 characters" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (OrganizationId, Username, Password, FullName, RoleKey, Status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [req.user.OrganizationId, username.trim(), hashed, fullName.trim(), roleKey]
    );

    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "user.create",
      entityType: "user",
      entityId: result.insertId,
      after: { username: username.trim(), role: roleKey },
    });

    res.status(201).json({
      status: true,
      user: {
        UserId: result.insertId,
        Username: username.trim(),
        FullName: fullName.trim(),
        Role: roleKey,
        Status: "active",
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "Username is already taken" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create user" });
  }
};

const update = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [rows] = await db.query(
      `SELECT UserId, Username, FullName, RoleKey, Status
       FROM users WHERE UserId = ? AND OrganizationId = ? LIMIT 1`,
      [userId, req.user.OrganizationId]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const current = rows[0];
    const fullName = req.body.fullName?.trim() || current.FullName;
    const roleKey = req.body.role || current.RoleKey;
    const status = req.body.status || current.Status;
    if (!ALLOWED_ROLES.includes(roleKey)) {
      return res.status(400).json({ status: false, message: "Invalid role" });
    }
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ status: false, message: "Invalid status" });
    }
    if (userId === req.user.UserId && status === "inactive") {
      return res.status(400).json({ status: false, message: "You cannot deactivate your own account" });
    }

    let passwordSql = "";
    const params = [fullName, roleKey, status];
    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ status: false, message: "Password must be at least 6 characters" });
      }
      passwordSql = ", Password = ?";
      params.push(await bcrypt.hash(req.body.password, 10));
    }
    params.push(userId, req.user.OrganizationId);

    await db.query(
      `UPDATE users SET FullName = ?, RoleKey = ?, Status = ?${passwordSql}
       WHERE UserId = ? AND OrganizationId = ?`,
      params
    );

    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      before: current,
      after: { FullName: fullName, RoleKey: roleKey, Status: status },
    });

    res.json({
      status: true,
      user: {
        UserId: userId,
        Username: current.Username,
        FullName: fullName,
        Role: roleKey,
        Status: status,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update user" });
  }
};

module.exports = { list, create, update };
