const ROLES = {
  SITE_ADMIN: "site_admin",
  ORGANIZATION_ADMIN: "organization_admin",
  ASSET_MANAGER: "asset_manager",
  EMPLOYEE: "employee",
};

const PERMISSIONS = {
  SITE_MANAGE: "site.manage",
  SITE_ENTER: "site.enter",
  ORG_MANAGE: "org.manage",
  USERS_MANAGE: "users.manage",
  USERS_READ: "users.read",
  SETUP_MANAGE: "setup.manage",
  ASSETS_READ: "assets.read",
  ASSETS_MANAGE: "assets.manage",
  ASSETS_ASSIGN: "assets.assign",
  ASSETS_ACCEPT: "assets.accept",
  MAINTENANCE_REQUEST: "maintenance.request",
  MAINTENANCE_MANAGE: "maintenance.manage",
  REQUESTS_CREATE: "requests.create",
  REQUESTS_APPROVE: "requests.approve",
  REPORTS_EXPORT: "reports.export",
  DASHBOARD_READ: "dashboard.read",
};

const TENANT_PERMISSIONS = Object.values(PERMISSIONS).filter((key) => !key.startsWith("site."));

const PERMISSION_CATALOG = [
  { key: PERMISSIONS.DASHBOARD_READ, name: "View dashboard", group: "Dashboard", note: "Counts, charts, and alerts." },
  { key: PERMISSIONS.ORG_MANAGE, name: "Manage organization settings", group: "Organization", note: "Name, logo, and profile." },
  { key: PERMISSIONS.SETUP_MANAGE, name: "Manage setup lists", group: "Organization", note: "Departments, locations, categories, and similar lists." },
  { key: PERMISSIONS.USERS_READ, name: "View users", group: "People", note: "See who can sign in." },
  { key: PERMISSIONS.USERS_MANAGE, name: "Add and edit users", group: "People", note: "Create accounts and change their details." },
  { key: PERMISSIONS.ASSETS_READ, name: "View assets", group: "Assets", note: "Open the register and asset records." },
  { key: PERMISSIONS.ASSETS_MANAGE, name: "Create and edit assets", group: "Assets", note: "Add assets and update their details." },
  { key: PERMISSIONS.ASSETS_ASSIGN, name: "Assign and transfer assets", group: "Assets", note: "Hand over, move, or return an asset." },
  { key: PERMISSIONS.ASSETS_ACCEPT, name: "Accept asset handover", group: "Assets", note: "Confirm custody of an assigned asset." },
  { key: PERMISSIONS.MAINTENANCE_REQUEST, name: "Request maintenance", group: "Maintenance", note: "Open a work order." },
  { key: PERMISSIONS.MAINTENANCE_MANAGE, name: "Manage maintenance", group: "Maintenance", note: "Update status and cost." },
  { key: PERMISSIONS.REQUESTS_CREATE, name: "Create asset requests", group: "Requests", note: "Ask for an asset." },
  { key: PERMISSIONS.REQUESTS_APPROVE, name: "Approve asset requests", group: "Requests", note: "Accept or reject requests." },
  { key: PERMISSIONS.REPORTS_EXPORT, name: "Export reports", group: "Reports", note: "Download CSV files." },
];

const ROLE_PERMISSIONS = {
  [ROLES.SITE_ADMIN]: [PERMISSIONS.SITE_MANAGE, PERMISSIONS.SITE_ENTER],
  [ROLES.ORGANIZATION_ADMIN]: TENANT_PERMISSIONS,
  [ROLES.ASSET_MANAGER]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SETUP_MANAGE,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_MANAGE,
    PERMISSIONS.ASSETS_ASSIGN,
    PERMISSIONS.ASSETS_ACCEPT,
    PERMISSIONS.MAINTENANCE_REQUEST,
    PERMISSIONS.MAINTENANCE_MANAGE,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.REQUESTS_APPROVE,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_ACCEPT,
    PERMISSIONS.MAINTENANCE_REQUEST,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.DASHBOARD_READ,
  ],
};

const ASSET_STATUSES = ["Available", "Assigned", "Damaged", "Lost", "Retired", "In Repair"];

module.exports = {
  ROLES,
  PERMISSIONS,
  TENANT_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  ASSET_STATUSES,
};
