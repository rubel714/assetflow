const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const env = require("../config/env");

function toPublicUser(user, permissions) {
  return {
    UserId: user.UserId,
    Username: user.Username,
    FullName: user.FullName,
    Role: user.RoleKey,
    OrganizationId: user.OrganizationId,
    OrganizationName: user.OrganizationName || null,
    permissions,
  };
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        status: false,
        message: "Username and password are required",
        user: {},
      });
    }

    const [rows] = await db.query(
      `SELECT u.UserId, u.Username, u.Password, u.FullName, u.RoleKey, u.Status,
              u.OrganizationId, o.Name AS OrganizationName
       FROM users u
       LEFT JOIN organizations o ON o.OrganizationId = u.OrganizationId
       WHERE u.Username = ?
       LIMIT 1`,
      [username.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ status: false, message: "Invalid username or password", user: {} });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      return res.status(401).json({ status: false, message: "Invalid username or password", user: {} });
    }
    if (user.Status !== "active") {
      return res.status(403).json({ status: false, message: "User is inactive", user: {} });
    }

    const [perms] = await db.query(
      "SELECT PermissionKey FROM role_permissions WHERE RoleKey = ?",
      [user.RoleKey]
    );
    const permissions = perms.map((p) => p.PermissionKey);
    const token = jwt.sign(
      { userId: user.UserId, organizationId: user.OrganizationId, role: user.RoleKey },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      status: true,
      message: "Success",
      token,
      user: toPublicUser(user, permissions),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server Error", user: {} });
  }
};

const me = async (req, res) => {
  res.json({
    status: true,
    user: toPublicUser(req.user, req.user.permissions),
  });
};

module.exports = { login, me };
