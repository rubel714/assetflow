const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const projects = require("../controllers/projects.controller");

router.use(requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE));
router.get("/", projects.list);
router.post("/", projects.create);
router.patch("/:id", projects.update);
router.delete("/:id", projects.remove);

module.exports = router;
