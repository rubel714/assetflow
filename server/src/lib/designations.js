const db = require("../config/db");

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

async function resolveDesignation(orgId, body, fallback = {}) {
  const raw =
    body.designationId !== undefined
      ? body.designationId
      : fallback.DesignationId;
  const value = emptyToNull(raw);
  if (!value) {
    return { DesignationId: null, Designation: null };
  }
  const designationId = Number(value);
  if (!designationId) {
    return { error: "Select a valid designation" };
  }
  const [rows] = await db.query(
    `SELECT DesignationId, Name
     FROM designations
     WHERE DesignationId = ? AND OrganizationId = ?
     LIMIT 1`,
    [designationId, orgId]
  );
  if (!rows.length) {
    return { error: "Select a valid designation" };
  }
  return { DesignationId: rows[0].DesignationId, Designation: rows[0].Name };
}

module.exports = { emptyToNull, resolveDesignation };
