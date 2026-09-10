const fs = require("fs");
const path = require("path");
const { ALLOWED_IMAGE_TYPES, imageExtFromFile } = require("./assetImage.service");

const USERS_UPLOAD_DIR = path.join(__dirname, "../../uploads/users");

function ensureUsersUploadDir() {
  fs.mkdirSync(USERS_UPLOAD_DIR, { recursive: true });
}

function relativeUserImagePath(organizationId, filename) {
  return `${organizationId}/${filename}`;
}

function absoluteUserImagePath(imagePath) {
  if (!imagePath) return null;
  const resolved = path.resolve(USERS_UPLOAD_DIR, imagePath);
  const root = path.resolve(USERS_UPLOAD_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function publicUserImageUrl(imagePath) {
  if (!imagePath) return null;
  return `/uploads/users/${imagePath}`;
}

function attachUserImageUrl(user) {
  if (!user) return user;
  return { ...user, ImageUrl: publicUserImageUrl(user.ImagePath) };
}

function deleteUserImageFile(imagePath) {
  const full = absoluteUserImagePath(imagePath);
  if (!full) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.error("Could not delete user image:", err.message);
  }
}

module.exports = {
  USERS_UPLOAD_DIR,
  ALLOWED_IMAGE_TYPES,
  ensureUsersUploadDir,
  relativeUserImagePath,
  publicUserImageUrl,
  attachUserImageUrl,
  deleteUserImageFile,
  imageExtFromFile,
};
