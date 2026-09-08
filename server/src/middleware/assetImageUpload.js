const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const {
  ASSETS_UPLOAD_DIR,
  ALLOWED_IMAGE_TYPES,
  ensureAssetsUploadDir,
  imageExtFromFile,
} = require("../services/assetImage.service");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      ensureAssetsUploadDir();
      const dest = path.join(ASSETS_UPLOAD_DIR, String(req.user.OrganizationId));
      require("fs").mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = imageExtFromFile(file);
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

function uploadAssetImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5MB or smaller"
        : err.message || "Could not upload image";
    res.status(400).json({ status: false, message });
  });
}

module.exports = { uploadAssetImage };
