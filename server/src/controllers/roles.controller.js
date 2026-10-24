const db = require("../config/db");
const { PERMISSION_CATALOG } = require("../lib/permissions");
const { auditSetup } = require("../services/setupAudit.service");
const {
  normalizePermissions,
  uniqueRoleKey,
  findNameConflict,
} = require("../lib/roles");

function permissionList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function mapRole(row) {
  return {
    RoleKey: row.RoleKey,
    Name: row.Name,
    IsSystem: Boolean(Number(row.IsSystem)),
    permissions: normalizePermissions(permissionList(row.PermissionKeys ?? row.permissions)),
  };
}

async function loadRole(roleKey, orgId) {
  const [rows] = await db.query(
    `SELECT r.RoleKey, r.Name, r.IsSystem, r.OrganizationId,
            GROUP_CONCAT(rp.PermissionKey) AS PermissionKeys
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.RoleKey = r.RoleKey
     WHERE r.RoleKey = ?
       AND (r.OrganizationId IS NULL OR r.OrganizationId = ?)
     GROUP BY r.RoleKey, r.Name, r.IsSystem, r.OrganizationId
     LIMIT 1`,
    [roleKey, orgId]
  );
  return rows[0] || null;
}

async function replacePermissions(conn, roleKey, permissions) {
  await conn.query("DELETE FROM role_permissions WHERE RoleKey = ?", [roleKey]);
  for (const permission of permissions) {
    await conn.query(
      "INSERT INTO role_permissions (RoleKey, PermissionKey) VALUES (?, ?)",
      [roleKey, permission]
    );
  }
}

function readRoleInput(body) {
  const name = body.name?.trim();
  if (!name) return { error: "Role name is required" };
  if (name.length > 80) return { error: "Role name must be 80 characters or fewer" };
  const permissions = normalizePermissions(body.permissions);
  if (!permissions.length) return { error: "Select at least one permission" };
  return { name, permissions };
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.RoleKey, r.Name, r.IsSystem, r.OrganizationId,
              GROUP_CONCAT(rp.PermissionKey) AS PermissionKeys
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.RoleKey = r.RoleKey
       WHERE r.RoleKey <> 'site_admin'
         AND (r.OrganizationId IS NULL OR r.OrganizationId = ?)
       GROUP BY r.RoleKey, r.Name, r.IsSystem, r.OrganizationId
       ORDER BY r.IsSystem DESC, FIELD(r.RoleKey, 'organization_admin', 'asset_manager', 'employee'), r.Name`,
      [req.user.OrganizationId]
    );
    const roles = rows.map(mapRole);
    res.json({ status: true, roles, items: roles, permissions: PERMISSION_CATALOG });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load roles" });
  }
};

const create = async (req, res) => {
  const input = readRoleInput(req.body);
  if (input.error) {
    return res.status(400).json({ status: false, message: input.error });
  }
  if (await findNameConflict(req.user.OrganizationId, input.name)) {
    return res.status(409).json({ status: false, message: "That role already exists" });
  }

  let roleKey;
  try {
    roleKey = await uniqueRoleKey(req.user.OrganizationId, input.name);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Could not create role" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO roles (RoleKey, Name, OrganizationId, IsSystem) VALUES (?, ?, ?, 0)",
      [roleKey, input.name, req.user.OrganizationId]
    );
    await replacePermissions(conn, roleKey, input.permissions);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That role already exists" });
    }
    console.error(error);
    return res.status(500).json({ status: false, message: "Could not create role" });
  } finally {
    conn.release();
  }

  await auditSetup(req, {
    action: "role.create",
    entityType: "role",
    entityId: null,
    after: { RoleKey: roleKey, Name: input.name, permissions: input.permissions },
  });
  res.status(201).json({
    status: true,
    role: mapRole({
      RoleKey: roleKey,
      Name: input.name,
      IsSystem: 0,
      permissions: input.permissions,
    }),
  });
};

const update = async (req, res) => {
  const roleKey = String(req.params.key || "");
  const input = readRoleInput(req.body);
  if (input.error) {
    return res.status(400).json({ status: false, message: input.error });
  }

  const current = await loadRole(roleKey, req.user.OrganizationId);
  if (!current) {
    return res.status(404).json({ status: false, message: "Role not found" });
  }
  if (Number(current.IsSystem) || current.OrganizationId == null) {
    return res.status(400).json({ status: false, message: "Built-in roles cannot be changed" });
  }
  if (Number(current.OrganizationId) !== Number(req.user.OrganizationId)) {
    return res.status(404).json({ status: false, message: "Role not found" });
  }
  if (await findNameConflict(req.user.OrganizationId, input.name, roleKey)) {
    return res.status(409).json({ status: false, message: "That role already exists" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE roles SET Name = ? WHERE RoleKey = ? AND OrganizationId = ?",
      [input.name, roleKey, req.user.OrganizationId]
    );
    await replacePermissions(conn, roleKey, input.permissions);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "That role already exists" });
    }
    console.error(error);
    return res.status(500).json({ status: false, message: "Could not update role" });
  } finally {
    conn.release();
  }

  await auditSetup(req, {
    action: "role.update",
    entityType: "role",
    entityId: null,
    before: { RoleKey: current.RoleKey, Name: current.Name, permissions: permissionList(current.PermissionKeys) },
    after: { RoleKey: roleKey, Name: input.name, permissions: input.permissions },
  });
  res.json({
    status: true,
    role: mapRole({
      RoleKey: roleKey,
      Name: input.name,
      IsSystem: 0,
      permissions: input.permissions,
    }),
  });
};

const remove = async (req, res) => {
  try {
    const roleKey = String(req.params.key || "");
    const current = await loadRole(roleKey, req.user.OrganizationId);
    if (!current) {
      return res.status(404).json({ status: false, message: "Role not found" });
    }
    if (Number(current.IsSystem) || current.OrganizationId == null) {
      return res.status(400).json({ status: false, message: "Built-in roles cannot be deleted" });
    }
    if (Number(current.OrganizationId) !== Number(req.user.OrganizationId)) {
      return res.status(404).json({ status: false, message: "Role not found" });
    }
    const [used] = await db.query("SELECT UserId FROM users WHERE RoleKey = ? LIMIT 1", [roleKey]);
    if (used.length) {
      return res.status(409).json({ status: false, message: "This role is assigned to a user" });
    }
    await db.query("DELETE FROM role_permissions WHERE RoleKey = ?", [roleKey]);
    await db.query("DELETE FROM roles WHERE RoleKey = ? AND OrganizationId = ?", [
      roleKey,
      req.user.OrganizationId,
    ]);
    await auditSetup(req, {
      action: "role.delete",
      entityType: "role",
      entityId: null,
      before: { RoleKey: current.RoleKey, Name: current.Name },
    });
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not delete role" });
  }
};

module.exports = { list, create, update, remove };
