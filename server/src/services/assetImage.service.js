const fs = require("fs");
const path = require("path");

const ASSETS_UPLOAD_DIR = path.join(__dirname, "../../uploads/assets");
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function ensureAssetsUploadDir() {
  fs.mkdirSync(ASSETS_UPLOAD_DIR, { recursive: true });
}

function relativeImagePath(organizationId, filename) {
  return `${organizationId}/${filename}`;
}

function absoluteImagePath(imagePath) {
  if (!imagePath) return null;
  const resolved = path.resolve(ASSETS_UPLOAD_DIR, imagePath);
  const root = path.resolve(ASSETS_UPLOAD_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function publicImageUrl(imagePath) {
  if (!imagePath) return null;
  return `/uploads/assets/${imagePath}`;
}

function attachImageUrl(asset) {
  if (!asset) return asset;
  return { ...asset, ImageUrl: publicImageUrl(asset.ImagePath) };
}

function deleteImageFile(imagePath) {
  const full = absoluteImagePath(imagePath);
  if (!full) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.error("Could not delete asset image:", err.message);
  }
}

function imageExtFromFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_EXTS.has(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/gif") return ".gif";
  return ".jpg";
}

module.exports = {
  ASSETS_UPLOAD_DIR,
  ALLOWED_IMAGE_TYPES,
  ensureAssetsUploadDir,
  relativeImagePath,
  absoluteImagePath,
  publicImageUrl,
  attachImageUrl,
  deleteImageFile,
  imageExtFromFile,
};
