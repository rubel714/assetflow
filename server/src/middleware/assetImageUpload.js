const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const {
  ASSETS_UPLOAD_DIR,
  ALLOWED_IMAGE_TYPES,
  ensureAssetsUploadDir,
  imageExtFromFile,
} = require("../services/assetImage.service");
const { USERS_UPLOAD_DIR, ensureUsersUploadDir } = require("../services/userImage.service");
const { ORG_UPLOAD_DIR, ensureOrgUploadDir } = require("../services/orgImage.service");

function createImageUpload(getDestDir) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      try {
        const dest = getDestDir(req);
        fs.mkdirSync(dest, { recursive: true });
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

  return function uploadImage(req, res, next) {
    upload.single("image")(req, res, (err) => {
      if (!err) return next();
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : err.message || "Could not upload image";
      res.status(400).json({ status: false, message });
    });
  };
}

const uploadAssetImage = createImageUpload((req) => {
  ensureAssetsUploadDir();
  return path.join(ASSETS_UPLOAD_DIR, String(req.user.OrganizationId));
});

const uploadUserImage = createImageUpload((req) => {
  ensureUsersUploadDir();
  return path.join(USERS_UPLOAD_DIR, String(req.user.OrganizationId));
});

const uploadOrgLogo = createImageUpload((req) => {
  ensureOrgUploadDir();
  return path.join(ORG_UPLOAD_DIR, String(req.user.OrganizationId));
});

module.exports = { uploadAssetImage, uploadUserImage, uploadOrgLogo };
