const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const categories = require("../controllers/categories.controller");

router.use(requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE));
router.get("/", categories.list);
router.post("/", categories.create);
router.patch("/:id", categories.update);
router.delete("/:id", categories.remove);

module.exports = router;
