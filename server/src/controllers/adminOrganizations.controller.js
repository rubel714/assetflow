const bcrypt = require("bcrypt");
const db = require("../config/db");
const { ROLES } = require("../lib/permissions");
const { emptyToNull } = require("../lib/designations");
const { normalizeEmail, isValidEmail } = require("../lib/identity");
const { daysRemaining } = require("../lib/orgAccess");
const { publicOrgLogoUrl } = require("../services/orgImage.service");

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[^\s]+\.[^\s]+$/i;

const ORG_COLUMNS = `o.OrganizationId, o.Name, o.LegalName, o.Code, o.Email, o.Phone,
       o.Website, o.Address, o.CountryId, o.LogoPath, o.Status, o.AccessStartsAt,
       o.AccessEndsAt, o.MaxUsers, o.MaxAssets, o.CreatedAt, o.UpdatedAt`;

function toMysqlDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseOptionalDate(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === "") return { value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: "Enter a valid date" };
  }
  return { value: date };
}

function parseOptionalLimit(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return { error: "Limits must be a positive whole number or empty for unlimited" };
  }
  return { value: n };
}

function mapOrganization(row) {
  return {
    OrganizationId: row.OrganizationId,
    Name: row.Name,
    LegalName: row.LegalName || null,
    Code: row.Code || null,
    Email: row.Email || null,
    Phone: row.Phone || null,
    Website: row.Website || null,
    Address: row.Address || null,
    CountryId: row.CountryId || null,
    LogoUrl: publicOrgLogoUrl(row.LogoPath),
    Status: row.Status || "active",
    AccessStartsAt: row.AccessStartsAt || null,
    AccessEndsAt: row.AccessEndsAt || null,
    DaysRemaining: daysRemaining(row.AccessEndsAt),
    MaxUsers: row.MaxUsers == null ? null : Number(row.MaxUsers),
    MaxAssets: row.MaxAssets == null ? null : Number(row.MaxAssets),
    UserCount: row.UserCount == null ? undefined : Number(row.UserCount),
    AssetCount: row.AssetCount == null ? undefined : Number(row.AssetCount),
    CreatedAt: row.CreatedAt,
    UpdatedAt: row.UpdatedAt,
  };
}

function readProfileFields(body, fallback = {}) {
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

  const website = emptyToNull(body.website !== undefined ? body.website : fallback.Website);
  if (website && !WEBSITE_PATTERN.test(website)) {
    return { error: "Enter a valid website" };
  }

  return {
    Name: name,
    LegalName: emptyToNull(body.legalName !== undefined ? body.legalName : fallback.LegalName),
    Code: rawCode.toUpperCase(),
    Email: email,
    Phone: emptyToNull(body.phone !== undefined ? body.phone : fallback.Phone),
    Website: website,
    Address: emptyToNull(body.address !== undefined ? body.address : fallback.Address),
  };
}

function readLicenseFields(body, fallback = {}) {
  let status = fallback.Status || "active";
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "inactive") {
      return { error: "Status must be active or inactive" };
    }
    status = body.status;
  }

  let accessStartsAt = fallback.AccessStartsAt || null;
  let accessEndsAt = fallback.AccessEndsAt || null;

  if (body.clearAccess === true || body.clearAccess === "true") {
    accessStartsAt = null;
    accessEndsAt = null;
  } else if (body.accessDays !== undefined && body.accessDays !== null && body.accessDays !== "") {
    const days = Number(body.accessDays);
    if (!Number.isInteger(days) || days < 1) {
      return { error: "Access days must be a positive whole number" };
    }
    const start = new Date();
    accessStartsAt = start;
    accessEndsAt = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  } else {
    const start = parseOptionalDate(body.accessStartsAt);
    if (start.error) return start;
    if (!start.skip) accessStartsAt = start.value;
    const end = parseOptionalDate(body.accessEndsAt);
    if (end.error) return end;
    if (!end.skip) accessEndsAt = end.value;
  }

  if (accessStartsAt && accessEndsAt && new Date(accessStartsAt) > new Date(accessEndsAt)) {
    return { error: "Access start must be before access end" };
  }

  const maxUsers = parseOptionalLimit(body.maxUsers);
  if (maxUsers.error) return maxUsers;
  const maxAssets = parseOptionalLimit(body.maxAssets);
  if (maxAssets.error) return maxAssets;

  return {
    Status: status,
    AccessStartsAt: toMysqlDateTime(accessStartsAt),
    AccessEndsAt: toMysqlDateTime(accessEndsAt),
    MaxUsers: maxUsers.skip ? fallback.MaxUsers ?? null : maxUsers.value,
    MaxAssets: maxAssets.skip ? fallback.MaxAssets ?? null : maxAssets.value,
  };
}

async function loadOrganization(organizationId) {
  const [rows] = await db.query(
    `SELECT ${ORG_COLUMNS},
            (SELECT COUNT(*) FROM users u WHERE u.OrganizationId = o.OrganizationId) AS UserCount,
            (SELECT COUNT(*) FROM assets a WHERE a.OrganizationId = o.OrganizationId) AS AssetCount
     FROM organizations o
     WHERE o.OrganizationId = ?
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] ? mapOrganization(rows[0]) : null;
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${ORG_COLUMNS},
              (SELECT COUNT(*) FROM users u WHERE u.OrganizationId = o.OrganizationId) AS UserCount,
              (SELECT COUNT(*) FROM assets a WHERE a.OrganizationId = o.OrganizationId) AS AssetCount
       FROM organizations o
       ORDER BY o.Name ASC`
    );
    res.json({ status: true, organizations: rows.map(mapOrganization) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load organizations" });
  }
};

const getOne = async (req, res) => {
  try {
    const organization = await loadOrganization(Number(req.params.id));
    if (!organization) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }
    res.json({ status: true, organization });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load organization" });
  }
};

const create = async (req, res) => {
  const conn = await db.getConnection();
  let started = false;
  try {
    const profile = readProfileFields(req.body);
    if (profile.error) {
      return res.status(400).json({ status: false, message: profile.error });
    }
    const license = readLicenseFields(req.body);
    if (license.error) {
      return res.status(400).json({ status: false, message: license.error });
    }

    const admin = req.body.admin || {};
    const adminEmail = normalizeEmail(admin.email);
    const adminName = emptyToNull(admin.fullName);
    const adminPassword = String(admin.password || "");
    if (!adminEmail || !isValidEmail(adminEmail) || !adminName || adminPassword.length < 6) {
      return res.status(400).json({
        status: false,
        message: "First organization admin needs a valid email, full name, and password of at least 6 characters",
      });
    }

    const [emailTaken] = await conn.query("SELECT UserId FROM users WHERE Email = ? LIMIT 1", [adminEmail]);
    if (emailTaken.length) {
      return res.status(400).json({ status: false, message: "That admin email is already in use" });
    }

    await conn.beginTransaction();
    started = true;
    const [inserted] = await conn.query(
      `INSERT INTO organizations
        (Name, LegalName, Code, Email, Phone, Website, Address, Status, AccessStartsAt, AccessEndsAt, MaxUsers, MaxAssets)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.Name,
        profile.LegalName,
        profile.Code,
        profile.Email,
        profile.Phone,
        profile.Website,
        profile.Address,
        license.Status,
        license.AccessStartsAt,
        license.AccessEndsAt,
        license.MaxUsers,
        license.MaxAssets,
      ]
    );

    const hashed = await bcrypt.hash(adminPassword, 10);
    await conn.query(
      `INSERT INTO users (OrganizationId, Email, Password, FullName, RoleKey, Status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [inserted.insertId, adminEmail, hashed, adminName, ROLES.ORGANIZATION_ADMIN]
    );
    await conn.commit();

    const organization = await loadOrganization(inserted.insertId);
    res.status(201).json({ status: true, organization });
  } catch (error) {
    if (started) await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ status: false, message: "Organization code is already in use" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create organization" });
  } finally {
    conn.release();
  }
};

const update = async (req, res) => {
  try {
    const organizationId = Number(req.params.id);
    const current = await loadOrganization(organizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }

    const profile = readProfileFields(req.body, current);
    if (profile.error) {
      return res.status(400).json({ status: false, message: profile.error });
    }
    const license = readLicenseFields(req.body, current);
    if (license.error) {
      return res.status(400).json({ status: false, message: license.error });
    }

    await db.query(
      `UPDATE organizations
       SET Name = ?, LegalName = ?, Code = ?, Email = ?, Phone = ?, Website = ?, Address = ?,
           Status = ?, AccessStartsAt = ?, AccessEndsAt = ?, MaxUsers = ?, MaxAssets = ?
       WHERE OrganizationId = ?`,
      [
        profile.Name,
        profile.LegalName,
        profile.Code,
        profile.Email,
        profile.Phone,
        profile.Website,
        profile.Address,
        license.Status,
        license.AccessStartsAt,
        license.AccessEndsAt,
        license.MaxUsers,
        license.MaxAssets,
        organizationId,
      ]
    );

    const organization = await loadOrganization(organizationId);
    res.json({ status: true, organization });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ status: false, message: "Organization code is already in use" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update organization" });
  }
};

const enter = async (req, res) => {
  try {
    const organization = await loadOrganization(Number(req.params.id));
    if (!organization) {
      return res.status(404).json({ status: false, message: "Organization not found" });
    }
    res.json({ status: true, organization });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not enter organization" });
  }
};

module.exports = { list, getOne, create, update, enter };
