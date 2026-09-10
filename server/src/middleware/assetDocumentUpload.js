const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const {
  DOCUMENTS_UPLOAD_DIR,
  ALLOWED_DOCUMENT_TYPES,
  ensureDocumentsUploadDir,
  extensionFromFile,
} = require("../services/assetDocument.service");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      ensureDocumentsUploadDir();
      const dest = path.join(DOCUMENTS_UPLOAD_DIR, String(req.user.OrganizationId));
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    cb(null, `${crypto.randomBytes(16).toString("hex")}${extensionFromFile(file)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      cb(new Error("That file type is not allowed"));
      return;
    }
    cb(null, true);
  },
});

function uploadAssetDocument(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File must be 10MB or smaller"
        : err.message || "Could not upload file";
    res.status(400).json({ status: false, message });
  });
}

module.exports = { uploadAssetDocument };
