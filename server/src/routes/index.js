const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const authRoutes = require("./auth.routes");
const usersController = require("../controllers/users.controller");
const lookupsController = require("../controllers/lookups.controller");
const assetsController = require("../controllers/assets.controller");
const dashboardController = require("../controllers/dashboard.controller");
const organizationController = require("../controllers/organization.controller");
const adminOrganizationsController = require("../controllers/adminOrganizations.controller");
const auditLogsController = require("../controllers/auditLogs.controller");
const departmentsController = require("../controllers/departments.controller");
const designationsController = require("../controllers/designations.controller");
const locationsController = require("../controllers/locations.controller");
const projectsController = require("../controllers/projects.controller");
const categoriesController = require("../controllers/categories.controller");
const { suppliers: suppliersController, manufacturers: manufacturersController } = require("../controllers/contactDirectory.controller");
const warrantiesController = require("../controllers/warranties.controller");
const maintenanceController = require("../controllers/maintenance.controller");
const assetDocumentsController = require("../controllers/assetDocuments.controller");
const { uploadAssetImage, uploadUserImage, uploadOrgLogo } = require("../middleware/assetImageUpload");
const { uploadAssetDocument } = require("../middleware/assetDocumentUpload");

router.use("/", authRoutes);

router.get(
  "/admin/organizations",
  requireAuth,
  requirePermission(PERMISSIONS.SITE_MANAGE),
  adminOrganizationsController.list
);
router.post(
  "/admin/organizations",
  requireAuth,
  requirePermission(PERMISSIONS.SITE_MANAGE),
  adminOrganizationsController.create
);
router.get(
  "/admin/organizations/:id",
  requireAuth,
  requirePermission(PERMISSIONS.SITE_MANAGE),
  adminOrganizationsController.getOne
);
router.patch(
  "/admin/organizations/:id",
  requireAuth,
  requirePermission(PERMISSIONS.SITE_MANAGE),
  adminOrganizationsController.update
);
router.post(
  "/admin/organizations/:id/enter",
  requireAuth,
  requirePermission(PERMISSIONS.SITE_ENTER),
  adminOrganizationsController.enter
);

router.get("/dashboard", requireAuth, requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardController.summary);
router.get("/lookups", requireAuth, lookupsController.list);
router.get("/organization", requireAuth, requirePermission(PERMISSIONS.ORG_MANAGE), organizationController.get);
router.patch(
  "/organization",
  requireAuth,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  uploadOrgLogo,
  organizationController.update
);
router.get("/audit-logs", requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE), auditLogsController.list);

router.get("/users", requireAuth, requirePermission(PERMISSIONS.USERS_READ), usersController.list);
router.post("/users", requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), uploadUserImage, usersController.create);
router.patch("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), uploadUserImage, usersController.update);

const canSetup = [requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE)];
router.get("/departments", ...canSetup, departmentsController.list);
router.post("/departments", ...canSetup, departmentsController.create);
router.patch("/departments/:id", ...canSetup, departmentsController.update);
router.delete("/departments/:id", ...canSetup, departmentsController.remove);
router.get("/designations", ...canSetup, designationsController.list);
router.post("/designations", ...canSetup, designationsController.create);
router.patch("/designations/:id", ...canSetup, designationsController.update);
router.delete("/designations/:id", ...canSetup, designationsController.remove);
router.get("/locations", ...canSetup, locationsController.list);
router.post("/locations", ...canSetup, locationsController.create);
router.patch("/locations/:id", ...canSetup, locationsController.update);
router.delete("/locations/:id", ...canSetup, locationsController.remove);
router.get("/projects", ...canSetup, projectsController.list);
router.post("/projects", ...canSetup, projectsController.create);
router.patch("/projects/:id", ...canSetup, projectsController.update);
router.delete("/projects/:id", ...canSetup, projectsController.remove);
router.get("/categories", ...canSetup, categoriesController.list);
router.post("/categories", ...canSetup, categoriesController.create);
router.patch("/categories/:id", ...canSetup, categoriesController.update);
router.delete("/categories/:id", ...canSetup, categoriesController.remove);
router.get("/suppliers", ...canSetup, suppliersController.list);
router.post("/suppliers", ...canSetup, suppliersController.create);
router.patch("/suppliers/:id", ...canSetup, suppliersController.update);
router.delete("/suppliers/:id", ...canSetup, suppliersController.remove);
router.get("/manufacturers", ...canSetup, manufacturersController.list);
router.post("/manufacturers", ...canSetup, manufacturersController.create);
router.patch("/manufacturers/:id", ...canSetup, manufacturersController.update);
router.delete("/manufacturers/:id", ...canSetup, manufacturersController.remove);

router.get("/warranties", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), warrantiesController.list);
router.get("/maintenance-requests", requireAuth, requirePermission(PERMISSIONS.MAINTENANCE_REQUEST), maintenanceController.list);
router.post("/maintenance-requests", requireAuth, requirePermission(PERMISSIONS.MAINTENANCE_REQUEST), maintenanceController.create);
router.patch(
  "/maintenance-requests/:id",
  requireAuth,
  requirePermission(PERMISSIONS.MAINTENANCE_MANAGE),
  maintenanceController.update
);

router.get("/assets/export", requireAuth, requirePermission(PERMISSIONS.REPORTS_EXPORT), assetsController.exportCsv);
router.get("/assets/lookup", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetsController.lookup);
router.get("/assets", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetsController.list);
router.post("/assets", requireAuth, requirePermission(PERMISSIONS.ASSETS_MANAGE), uploadAssetImage, assetsController.create);
router.get("/assets/:id", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetsController.getOne);
router.patch("/assets/:id", requireAuth, requirePermission(PERMISSIONS.ASSETS_MANAGE), uploadAssetImage, assetsController.update);
router.post("/assets/:id/assign", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.assign);
router.post("/assets/:id/transfer", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.transfer);
router.post("/assets/:id/return", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.returnAsset);
router.post("/assets/:id/accept", requireAuth, requirePermission(PERMISSIONS.ASSETS_ACCEPT), assetsController.accept);
router.get("/assets/:id/documents", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetDocumentsController.list);
router.post(
  "/assets/:id/documents",
  requireAuth,
  requirePermission(PERMISSIONS.ASSETS_READ),
  uploadAssetDocument,
  assetDocumentsController.create
);
router.delete(
  "/assets/:id/documents/:documentId",
  requireAuth,
  requirePermission(PERMISSIONS.ASSETS_READ),
  assetDocumentsController.remove
);

module.exports = router;
