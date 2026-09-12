const { ROLES } = require("./permissions");

function isSiteAdmin(user) {
  return user?.RoleKey === ROLES.SITE_ADMIN || user?.Role === ROLES.SITE_ADMIN;
}

function organizationAccessError(org) {
  if (!org || !org.OrganizationId) {
    return { status: 403, message: "User is not assigned to an organization" };
  }
  const status = org.OrganizationStatus || org.Status || "active";
  if (status === "inactive") {
    return { status: 403, message: "Organization is inactive" };
  }
  const now = Date.now();
  if (org.AccessStartsAt && new Date(org.AccessStartsAt).getTime() > now) {
    return { status: 403, message: "Organization access has not started" };
  }
  if (org.AccessEndsAt && new Date(org.AccessEndsAt).getTime() < now) {
    return { status: 403, message: "Organization access has expired" };
  }
  return null;
}

function daysRemaining(accessEndsAt) {
  if (!accessEndsAt) return null;
  return Math.ceil((new Date(accessEndsAt).getTime() - Date.now()) / 86400000);
}

async function assertWithinOrgLimit(db, organizationId, kind) {
  const [orgs] = await db.query(
    "SELECT MaxUsers, MaxAssets FROM organizations WHERE OrganizationId = ? LIMIT 1",
    [organizationId]
  );
  const org = orgs[0];
  if (!org) {
    return { error: "Organization not found" };
  }
  if (kind === "users" && org.MaxUsers != null) {
    const [rows] = await db.query("SELECT COUNT(*) AS c FROM users WHERE OrganizationId = ?", [
      organizationId,
    ]);
    if (Number(rows[0].c) >= Number(org.MaxUsers)) {
      return { error: "Organization has reached its user limit" };
    }
  }
  if (kind === "assets" && org.MaxAssets != null) {
    const [rows] = await db.query("SELECT COUNT(*) AS c FROM assets WHERE OrganizationId = ?", [
      organizationId,
    ]);
    if (Number(rows[0].c) >= Number(org.MaxAssets)) {
      return { error: "Organization has reached its asset limit" };
    }
  }
  return {};
}

module.exports = {
  isSiteAdmin,
  organizationAccessError,
  daysRemaining,
  assertWithinOrgLimit,
};
