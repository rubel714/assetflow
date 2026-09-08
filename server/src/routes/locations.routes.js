const express = require("express");
const router = express.Router();
const { requireAuth, requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../lib/permissions");
const locations = require("../controllers/locations.controller");

router.use(requireAuth, requirePermission(PERMISSIONS.SETUP_MANAGE));
router.get("/", locations.list);
router.post("/", locations.create);
router.patch("/:id", locations.update);
router.delete("/:id", locations.remove);

module.exports = router;
