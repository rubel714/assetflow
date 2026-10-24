const db = require("../config/db");
const { ROLES, PERMISSION_CATALOG } = require("./permissions");

const SYSTEM_ROLE_KEYS = new Set(Object.values(ROLES));
const CATALOG_KEYS = PERMISSION_CATALOG.map((item) => item.key);

function normalizePermissions(input) {
  const list = Array.isArray(input) ? input : [];
  const allowed = new Set(CATALOG_KEYS);
  const chosen = new Set();
  for (const key of list) {
    const value = String(key || "").trim();
    if (allowed.has(value)) chosen.add(value);
  }
  return CATALOG_KEYS.filter((key) => chosen.has(key));
}

function slugPart(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

async function uniqueRoleKey(orgId, name) {
  const part = slugPart(name) || "role";
  for (let n = 1; n < 1000; n += 1) {
    const suffix = n === 1 ? "" : `_${n}`;
    let candidate = `o${orgId}_${part}${suffix}`;
    if (candidate.length > 40) candidate = candidate.slice(0, 40);
    if (SYSTEM_ROLE_KEYS.has(candidate)) continue;
    const [rows] = await db.query("SELECT RoleKey FROM roles WHERE RoleKey = ? LIMIT 1", [candidate]);
    if (!rows.length) return candidate;
  }
  throw new Error("Could not allocate a role key");
}

async function findNameConflict(orgId, name, exceptKey) {
  const [rows] = await db.query(
    `SELECT RoleKey FROM roles
     WHERE LOWER(Name) = LOWER(?)
       AND (OrganizationId IS NULL OR OrganizationId = ?)
       AND RoleKey <> ?
     LIMIT 1`,
    [name, orgId, exceptKey || ""]
  );
  return rows[0] || null;
}

async function assertAssignableRole(orgId, roleKey) {
  if (!roleKey || roleKey === ROLES.SITE_ADMIN) return false;
  const [rows] = await db.query(
    `SELECT RoleKey FROM roles
     WHERE RoleKey = ?
       AND RoleKey <> ?
       AND (OrganizationId IS NULL OR OrganizationId = ?)
     LIMIT 1`,
    [roleKey, ROLES.SITE_ADMIN, orgId]
  );
  return Boolean(rows.length);
}

async function roleNameFor(roleKey) {
  const [rows] = await db.query("SELECT Name FROM roles WHERE RoleKey = ? LIMIT 1", [roleKey]);
  return rows[0]?.Name || null;
}

module.exports = {
  normalizePermissions,
  uniqueRoleKey,
  findNameConflict,
  assertAssignableRole,
  roleNameFor,
};
