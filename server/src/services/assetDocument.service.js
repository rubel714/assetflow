const fs = require("fs");
const path = require("path");

const DOCUMENTS_UPLOAD_DIR = path.join(__dirname, "../../uploads/documents");
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function ensureDocumentsUploadDir() {
  fs.mkdirSync(DOCUMENTS_UPLOAD_DIR, { recursive: true });
}

function relativeDocumentPath(organizationId, filename) {
  return `${organizationId}/${filename}`;
}

function absoluteDocumentPath(storedPath) {
  if (!storedPath) return null;
  const resolved = path.resolve(DOCUMENTS_UPLOAD_DIR, storedPath);
  const root = path.resolve(DOCUMENTS_UPLOAD_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function publicDocumentUrl(storedPath) {
  if (!storedPath) return null;
  return `/uploads/documents/${storedPath}`;
}

function deleteDocumentFile(storedPath) {
  const full = absoluteDocumentPath(storedPath);
  if (!full) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.error("Could not delete asset document:", err.message);
  }
}

function attachDocumentUrl(doc) {
  if (!doc) return doc;
  return { ...doc, Url: publicDocumentUrl(doc.StoredPath) };
}

function extensionFromFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return ".bin";
}

module.exports = {
  DOCUMENTS_UPLOAD_DIR,
  ALLOWED_DOCUMENT_TYPES,
  ensureDocumentsUploadDir,
  relativeDocumentPath,
  absoluteDocumentPath,
  publicDocumentUrl,
  deleteDocumentFile,
  attachDocumentUrl,
  extensionFromFile,
};
