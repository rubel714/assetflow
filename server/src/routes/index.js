const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const authRoutes = require("./auth.routes");
const usersController = require("../controllers/users.controller");
const lookupsController = require("../controllers/lookups.controller");
const assetsController = require("../controllers/assets.controller");
const dashboardController = require("../controllers/dashboard.controller");
const departmentsController = require("../controllers/departments.controller");
const locationsController = require("../controllers/locations.controller");
const projectsController = require("../controllers/projects.controller");
const categoriesController = require("../controllers/categories.controller");
const { suppliers: suppliersController, manufacturers: manufacturersController } = require("../controllers/contactDirectory.controller");
const { uploadAssetImage } = require("../middleware/assetImageUpload");

router.use("/", authRoutes);

router.get("/dashboard", requireAuth, requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardController.summary);
router.get("/lookups", requireAuth, lookupsController.list);

router.get("/users", requireAuth, requirePermission(PERMISSIONS.USERS_READ), usersController.list);
router.post("/users", requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), usersController.create);
router.patch("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), usersController.update);

const canSetup = [requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE)];
router.get("/departments", ...canSetup, departmentsController.list);
router.post("/departments", ...canSetup, departmentsController.create);
router.patch("/departments/:id", ...canSetup, departmentsController.update);
router.delete("/departments/:id", ...canSetup, departmentsController.remove);
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

router.get("/assets/export", requireAuth, requirePermission(PERMISSIONS.REPORTS_EXPORT), assetsController.exportCsv);
router.get("/assets", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetsController.list);
router.post("/assets", requireAuth, requirePermission(PERMISSIONS.ASSETS_MANAGE), uploadAssetImage, assetsController.create);
router.get("/assets/:id", requireAuth, requirePermission(PERMISSIONS.ASSETS_READ), assetsController.getOne);
router.patch("/assets/:id", requireAuth, requirePermission(PERMISSIONS.ASSETS_MANAGE), uploadAssetImage, assetsController.update);
router.post("/assets/:id/assign", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.assign);
router.post("/assets/:id/transfer", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.transfer);
router.post("/assets/:id/return", requireAuth, requirePermission(PERMISSIONS.ASSETS_ASSIGN), assetsController.returnAsset);

module.exports = router;
