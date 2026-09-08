const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const departments = require("../controllers/departments.controller");

router.use(requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE));
router.get("/", departments.list);
router.post("/", departments.create);
router.patch("/:id", departments.update);
router.delete("/:id", departments.remove);

module.exports = router;
