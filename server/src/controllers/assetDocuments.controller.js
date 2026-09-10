const db = require("../config/db");
const { writeAudit } = require("../services/audit.service");
const { getAsset, employeeCanViewAsset } = require("../services/asset.service");
const {
  relativeDocumentPath,
  deleteDocumentFile,
  attachDocumentUrl,
} = require("../services/assetDocument.service");
const { isEmployee } = require("../middleware/auth");

async function assertAssetAccess(req, assetId) {
  const asset = await getAsset(req.user.OrganizationId, assetId);
  if (!asset) return { error: { statusCode: 404, message: "Asset not found" } };
  if (!employeeCanViewAsset(req.user, asset)) {
    return { error: { statusCode: 403, message: "You can only view assets assigned to you" } };
  }
  return { asset };
}

function discardUpload(req) {
  if (req.file) {
    deleteDocumentFile(relativeDocumentPath(req.user.OrganizationId, req.file.filename));
  }
}

const list = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const access = await assertAssetAccess(req, assetId);
    if (access.error) {
      return res.status(access.error.statusCode).json({ status: false, message: access.error.message });
    }
    const [rows] = await db.query(
      `SELECT d.DocumentId, d.OriginalName, d.StoredPath, d.MimeType, d.SizeBytes, d.CreatedAt,
              u.FullName AS UploadedByName
       FROM asset_documents d
       LEFT JOIN users u ON u.UserId = d.UploadedBy
       WHERE d.OrganizationId = ? AND d.AssetId = ?
       ORDER BY d.CreatedAt DESC`,
      [req.user.OrganizationId, assetId]
    );
    res.json({ status: true, documents: rows.map(attachDocumentUrl) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load documents" });
  }
};

const create = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    if (!req.file) {
      return res.status(400).json({ status: false, message: "A file is required" });
    }
    const access = await assertAssetAccess(req, assetId);
    if (access.error) {
      discardUpload(req);
      return res.status(access.error.statusCode).json({ status: false, message: access.error.message });
    }
    if (isEmployee(req.user) && access.asset.CustodianId !== req.user.UserId) {
      discardUpload(req);
      return res.status(403).json({ status: false, message: "You can only attach files to your assets" });
    }

    const storedPath = relativeDocumentPath(req.user.OrganizationId, req.file.filename);
    const [result] = await db.query(
      `INSERT INTO asset_documents
        (OrganizationId, AssetId, OriginalName, StoredPath, MimeType, SizeBytes, UploadedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.OrganizationId,
        assetId,
        req.file.originalname || "file",
        storedPath,
        req.file.mimetype || null,
        req.file.size || null,
        req.user.UserId,
      ]
    );
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "asset.document.create",
      entityType: "asset",
      entityId: assetId,
      after: { documentId: result.insertId, name: req.file.originalname },
    });
    const [rows] = await db.query(
      `SELECT d.DocumentId, d.OriginalName, d.StoredPath, d.MimeType, d.SizeBytes, d.CreatedAt,
              u.FullName AS UploadedByName
       FROM asset_documents d
       LEFT JOIN users u ON u.UserId = d.UploadedBy
       WHERE d.DocumentId = ? LIMIT 1`,
      [result.insertId]
    );
    res.status(201).json({ status: true, document: attachDocumentUrl(rows[0]) });
  } catch (error) {
    discardUpload(req);
    console.error(error);
    res.status(500).json({ status: false, message: "Could not upload document" });
  }
};

const remove = async (req, res) => {
  try {
    const assetId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    const access = await assertAssetAccess(req, assetId);
    if (access.error) {
      return res.status(access.error.statusCode).json({ status: false, message: access.error.message });
    }
    const [rows] = await db.query(
      `SELECT DocumentId, StoredPath FROM asset_documents
       WHERE DocumentId = ? AND AssetId = ? AND OrganizationId = ? LIMIT 1`,
      [documentId, assetId, req.user.OrganizationId]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, message: "Document not found" });
    }
    await db.query(
      "DELETE FROM asset_documents WHERE DocumentId = ? AND OrganizationId = ?",
      [documentId, req.user.OrganizationId]
    );
    deleteDocumentFile(rows[0].StoredPath);
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "asset.document.delete",
      entityType: "asset",
      entityId: assetId,
      before: { documentId },
    });
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete document" });
  }
};

module.exports = { list, create, remove };
