const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const env = require("../config/env");

const { publicUserImageUrl } = require("../services/userImage.service");
const { publicOrgLogoUrl } = require("../services/orgImage.service");
const { normalizeEmail } = require("../lib/identity");
const { isSiteAdmin, organizationAccessError } = require("../lib/orgAccess");

function toPublicUser(user, permissions) {
  return {
    UserId: user.UserId,
    Email: user.Email || null,
    FullName: user.FullName,
    Role: user.RoleKey,
    OrganizationId: user.OrganizationId,
    OrganizationName: user.OrganizationName || null,
    OrganizationCode: user.OrganizationCode || null,
    OrganizationLogoUrl: publicOrgLogoUrl(user.OrganizationLogoPath),
    ImageUrl: publicUserImageUrl(user.ImagePath),
    permissions,
  };
}

const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password are required",
        user: {},
      });
    }

    const [rows] = await db.query(
      `SELECT u.UserId, u.Email, u.Password, u.FullName, u.RoleKey, u.Status, u.ImagePath,
              u.OrganizationId, o.Name AS OrganizationName, o.Code AS OrganizationCode,
              o.LogoPath AS OrganizationLogoPath,
              o.Status AS OrganizationStatus, o.AccessStartsAt, o.AccessEndsAt
       FROM users u
       LEFT JOIN organizations o ON o.OrganizationId = u.OrganizationId
       WHERE u.Email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ status: false, message: "Invalid email or password", user: {} });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      return res.status(401).json({ status: false, message: "Invalid email or password", user: {} });
    }
    if (user.Status !== "active") {
      return res.status(403).json({ status: false, message: "User is inactive", user: {} });
    }
    if (!isSiteAdmin(user)) {
      const accessError = organizationAccessError(user);
      if (accessError) {
        return res.status(accessError.status).json({ status: false, message: accessError.message, user: {} });
      }
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
