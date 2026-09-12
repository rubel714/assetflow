const fs = require("fs");
const path = require("path");
const { ALLOWED_IMAGE_TYPES, imageExtFromFile } = require("./assetImage.service");

const ORG_UPLOAD_DIR = path.join(__dirname, "../../uploads/organizations");

function ensureOrgUploadDir() {
  fs.mkdirSync(ORG_UPLOAD_DIR, { recursive: true });
}

function relativeOrgLogoPath(organizationId, filename) {
  return `${organizationId}/${filename}`;
}

function absoluteOrgLogoPath(logoPath) {
  if (!logoPath) return null;
  const resolved = path.resolve(ORG_UPLOAD_DIR, logoPath);
  const root = path.resolve(ORG_UPLOAD_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function publicOrgLogoUrl(logoPath) {
  if (!logoPath) return null;
  return `/uploads/organizations/${logoPath}`;
}

function attachOrgLogoUrl(organization) {
  if (!organization) return organization;
  return { ...organization, LogoUrl: publicOrgLogoUrl(organization.LogoPath) };
}

function deleteOrgLogoFile(logoPath) {
  const full = absoluteOrgLogoPath(logoPath);
  if (!full) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.error("Could not delete organization logo:", err.message);
  }
}

module.exports = {
  ORG_UPLOAD_DIR,
  ALLOWED_IMAGE_TYPES,
  ensureOrgUploadDir,
  relativeOrgLogoPath,
  publicOrgLogoUrl,
  attachOrgLogoUrl,
  deleteOrgLogoFile,
  imageExtFromFile,
};
