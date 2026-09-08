const ROLES = {
  ORGANIZATION_ADMIN: "organization_admin",
  ASSET_MANAGER: "asset_manager",
  EMPLOYEE: "employee",
};

const PERMISSIONS = {
  ORG_MANAGE: "org.manage",
  USERS_MANAGE: "users.manage",
  USERS_READ: "users.read",
  SETUP_MANAGE: "setup.manage",
  ASSETS_READ: "assets.read",
  ASSETS_MANAGE: "assets.manage",
  ASSETS_ASSIGN: "assets.assign",
  REPORTS_EXPORT: "reports.export",
  DASHBOARD_READ: "dashboard.read",
};

const ROLE_PERMISSIONS = {
  [ROLES.ORGANIZATION_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ASSET_MANAGER]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SETUP_MANAGE,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_MANAGE,
    PERMISSIONS.ASSETS_ASSIGN,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [ROLES.EMPLOYEE]: [PERMISSIONS.ASSETS_READ, PERMISSIONS.DASHBOARD_READ],
};

const ASSET_STATUSES = ["Available", "Assigned", "Damaged", "Lost", "Retired"];

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ASSET_STATUSES,
};
