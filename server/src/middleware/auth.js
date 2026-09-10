const jwt = require("jsonwebtoken");
const db = require("../config/db");
const env = require("../config/env");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ status: false, message: "Authentication required" });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const [rows] = await db.query(
      `SELECT u.UserId, u.OrganizationId, u.Username, u.FullName, u.RoleKey, u.Status, u.ImagePath,
              o.Name AS OrganizationName
       FROM users u
       LEFT JOIN organizations o ON o.OrganizationId = u.OrganizationId
       WHERE u.UserId = ?
       LIMIT 1`,
      [payload.userId]
    );

    if (!rows.length || rows[0].Status !== "active") {
      return res.status(401).json({ status: false, message: "Invalid or inactive user" });
    }
    if (!rows[0].OrganizationId) {
      return res.status(403).json({ status: false, message: "User is not assigned to an organization" });
    }

    const [perms] = await db.query(
      "SELECT PermissionKey FROM role_permissions WHERE RoleKey = ?",
      [rows[0].RoleKey]
    );

    req.user = {
      ...rows[0],
      permissions: perms.map((p) => p.PermissionKey),
    };
    next();
  } catch (err) {
    return res.status(401).json({ status: false, message: "Invalid or expired token" });
  }
}

function requirePermission(...keys) {
  return (req, res, next) => {
    const granted = req.user?.permissions || [];
    const ok = keys.every((key) => granted.includes(key));
    if (!ok) {
      return res.status(403).json({ status: false, message: "You do not have permission for this action" });
    }
    next();
  };
}

function isEmployee(user) {
  return user?.RoleKey === "employee";
}

module.exports = { requireAuth, requirePermission, isEmployee };
