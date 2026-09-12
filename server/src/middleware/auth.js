const jwt = require("jsonwebtoken");
const db = require("../config/db");
const env = require("../config/env");
const { ROLES, ROLE_PERMISSIONS } = require("../lib/permissions");
const { isSiteAdmin, organizationAccessError } = require("../lib/orgAccess");

const USER_SELECT = `u.UserId, u.OrganizationId, u.Email, u.FullName, u.RoleKey, u.Status, u.ImagePath,
              o.Name AS OrganizationName, o.Code AS OrganizationCode,
              o.LogoPath AS OrganizationLogoPath,
              o.Status AS OrganizationStatus, o.AccessStartsAt, o.AccessEndsAt`;

async function loadPermissions(roleKey) {
  const [perms] = await db.query("SELECT PermissionKey FROM role_permissions WHERE RoleKey = ?", [
    roleKey,
  ]);
  return perms.map((p) => p.PermissionKey);
}

async function loadOrganization(organizationId) {
  const [rows] = await db.query(
    `SELECT OrganizationId, Name AS OrganizationName, Code AS OrganizationCode,
            LogoPath AS OrganizationLogoPath, Status AS OrganizationStatus,
            AccessStartsAt, AccessEndsAt
     FROM organizations
     WHERE OrganizationId = ?
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] || null;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ status: false, message: "Authentication required" });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const [rows] = await db.query(
      `SELECT ${USER_SELECT}
       FROM users u
       LEFT JOIN organizations o ON o.OrganizationId = u.OrganizationId
       WHERE u.UserId = ?
       LIMIT 1`,
      [payload.userId]
    );

    if (!rows.length || rows[0].Status !== "active") {
      return res.status(401).json({ status: false, message: "Invalid or inactive user" });
    }

    const user = rows[0];
    let permissions = await loadPermissions(user.RoleKey);
    let actingAsOrganization = false;

    if (isSiteAdmin(user)) {
      const actingId = Number(req.headers["x-organization-id"]);
      const onAdminRoute = String(req.path || "").startsWith("/admin");
      if (!onAdminRoute && Number.isInteger(actingId) && actingId > 0) {
        const org = await loadOrganization(actingId);
        if (!org) {
          return res.status(403).json({ status: false, message: "Organization not found" });
        }
        Object.assign(user, org);
        permissions = ROLE_PERMISSIONS[ROLES.ORGANIZATION_ADMIN] || permissions;
        actingAsOrganization = true;
      }
    } else {
      if (!user.OrganizationId) {
        return res.status(403).json({ status: false, message: "User is not assigned to an organization" });
      }
      const accessError = organizationAccessError(user);
      if (accessError) {
        return res.status(accessError.status).json({ status: false, message: accessError.message });
      }
    }

    req.user = {
      ...user,
      permissions,
      actingAsOrganization,
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
