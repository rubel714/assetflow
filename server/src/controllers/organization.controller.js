const db = require("../config/db");
const { writeAudit } = require("../services/audit.service");
const { emptyToNull } = require("../lib/designations");
const {
  relativeOrgLogoPath,
  attachOrgLogoUrl,
  deleteOrgLogoFile,
} = require("../services/orgImage.service");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[^\s]+\.[^\s]+$/i;

const ORG_SELECT = `o.OrganizationId, o.Name, o.LegalName, o.Code, o.Email, o.Phone,
       o.Website, o.Address, o.CountryId, c.Name AS CountryName, o.LogoPath,
       o.CreatedAt, o.UpdatedAt`;

function mapOrganization(row) {
  return attachOrgLogoUrl({
    OrganizationId: row.OrganizationId,
    Name: row.Name,
    LegalName: row.LegalName || null,
    Code: row.Code || null,
    Email: row.Email || null,
    Phone: row.Phone || null,
    Website: row.Website || null,
    Address: row.Address || null,
    CountryId: row.CountryId || null,
    CountryName: row.CountryName || null,
    LogoPath: row.LogoPath || null,
    CreatedAt: row.CreatedAt,
    UpdatedAt: row.UpdatedAt,
  });
}

async function loadOrganization(organizationId) {
  const [rows] = await db.query(
    `SELECT ${ORG_SELECT}
     FROM organizations o
     LEFT JOIN countries c ON c.CountryId = o.CountryId AND c.OrganizationId = o.OrganizationId
     WHERE o.OrganizationId = ?
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] ? mapOrganization(rows[0]) : null;
}

function wantsLogoRemoved(body) {
  return body.removeLogo === true || body.removeLogo === "true" || body.removeLogo === "1";
}

function uploadedLogoPath(req) {
  if (!req.file) return null;
  return relativeOrgLogoPath(req.user.OrganizationId, req.file.filename);
}

function discardUploadedLogo(req) {
  const logoPath = uploadedLogoPath(req);
  if (logoPath) deleteOrgLogoFile(logoPath);
}

function snapshot(org) {
  return {
    Name: org.Name,
    LegalName: org.LegalName,
    Code: org.Code,
    Email: org.Email,
    Phone: org.Phone,
    Website: org.Website,
    Address: org.Address,
    CountryId: org.CountryId,
    LogoPath: org.LogoPath,
  };
}

async function readProfile(organizationId, body, fallback) {
  const name = emptyToNull(body.name !== undefined ? body.name : fallback.Name);
  if (!name) {
    return { error: "Organization name is required" };
  }

  const email = emptyToNull(body.email !== undefined ? body.email : fallback.Email);
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const rawCode = emptyToNull(body.code !== undefined ? body.code : fallback.Code);
  if (!rawCode) {
    return { error: "Organization code is required" };
  }
  if (!CODE_PATTERN.test(rawCode)) {
    return { error: "Code must be 1–20 letters, numbers, hyphens, or underscores" };
  }
  const code = rawCode.toUpperCase();

  const website = emptyToNull(body.website !== undefined ? body.website : fallback.Website);
  if (website && !WEBSITE_PATTERN.test(website)) {
    return { error: "Enter a valid website" };
  }

  const countryRaw = body.countryId !== undefined ? body.countryId : fallback.CountryId;
  const countryId = emptyToNull(countryRaw);
  let resolvedCountryId = null;
  if (countryId) {
    const id = Number(countryId);
    if (!id) {
      return { error: "Select a valid country" };
    }
    const [countries] = await db.query(
      "SELECT CountryId FROM countries WHERE CountryId = ? AND OrganizationId = ? LIMIT 1",
      [id, organizationId]
    );
    if (!countries.length) {
      return { error: "Select a valid country" };
    }
    resolvedCountryId = id;
  }

  return {
    Name: name,
    LegalName: emptyToNull(body.legalName !== undefined ? body.legalName : fallback.LegalName),
    Code: code,
    Email: email,
    Phone: emptyToNull(body.phone !== undefined ? body.phone : fallback.Phone),
    Website: website,
    Address: emptyToNull(body.address !== undefined ? body.address : fallback.Address),
    CountryId: resolvedCountryId,
  };
}

const get = async (req, res) => {
  try {
    const organization = await loadOrganization(req.user.OrganizationId);
    if (!organization) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }
    res.json({ status: true, organization });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load organization" });
  }
};

const update = async (req, res) => {
  try {
    const current = await loadOrganization(req.user.OrganizationId);
    if (!current) {
      discardUploadedLogo(req);
      return res.status(404).json({ status: false, message: "Organization not found" });
    }

    const profile = await readProfile(req.user.OrganizationId, req.body || {}, current);
    if (profile.error) {
      discardUploadedLogo(req);
      return res.status(400).json({ status: false, message: profile.error });
    }

    let logoPath = current.LogoPath;
    const nextLogo = uploadedLogoPath(req);
    if (nextLogo) {
      if (current.LogoPath) deleteOrgLogoFile(current.LogoPath);
      logoPath = nextLogo;
    } else if (wantsLogoRemoved(req.body || {})) {
      if (current.LogoPath) deleteOrgLogoFile(current.LogoPath);
      logoPath = null;
    }

    await db.query(
      `UPDATE organizations
       SET Name = ?, LegalName = ?, Code = ?, Email = ?, Phone = ?, Website = ?,
           Address = ?, CountryId = ?, LogoPath = ?
       WHERE OrganizationId = ?`,
      [
        profile.Name,
        profile.LegalName,
        profile.Code,
        profile.Email,
        profile.Phone,
        profile.Website,
        profile.Address,
        profile.CountryId,
        logoPath,
        req.user.OrganizationId,
      ]
    );

    const organization = await loadOrganization(req.user.OrganizationId);
    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "organization.update",
      entityType: "organization",
      entityId: req.user.OrganizationId,
      before: snapshot(current),
      after: snapshot(organization),
    });

    res.json({ status: true, organization });
  } catch (error) {
    discardUploadedLogo(req);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "Organization code is already in use" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update organization" });
  }
};

module.exports = { get, update };
