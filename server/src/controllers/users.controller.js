const bcrypt = require("bcrypt");
const db = require("../config/db");
const { writeAudit } = require("../services/audit.service");
const { ROLES } = require("../lib/permissions");
const { emptyToNull, resolveDesignation } = require("../lib/designations");
const {
  relativeUserImagePath,
  attachUserImageUrl,
  deleteUserImageFile,
} = require("../services/userImage.service");

const ALLOWED_ROLES = Object.values(ROLES);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_PROFILE_COLUMNS = `u.UserId, u.Username, u.FullName, u.RoleKey, u.Status, u.ImagePath,
       u.DesignationId, d.Name AS Designation, u.Phone, u.Email, u.Address, u.CreatedAt`;

function mapUser(row) {
  return attachUserImageUrl({
    UserId: row.UserId,
    Username: row.Username,
    FullName: row.FullName,
    Role: row.RoleKey,
    Status: row.Status,
    ImagePath: row.ImagePath,
    DesignationId: row.DesignationId || null,
    Designation: row.Designation || null,
    Phone: row.Phone || null,
    Email: row.Email || null,
    Address: row.Address || null,
    CreatedAt: row.CreatedAt,
  });
}

function readPasswordChange(body, { required }) {
  const password = body.password == null ? "" : String(body.password);
  const confirmPassword = body.confirmPassword == null ? "" : String(body.confirmPassword);
  if (!password && !confirmPassword) {
    if (required) return { error: "Password is required" };
    return { password: null };
  }
  if (password !== confirmPassword) {
    return { error: "Password and confirm password must match" };
  }
  if (!password) {
    return { error: "Password is required" };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }
  return { password };
}

async function readProfileFields(orgId, body, fallback = {}) {
  const designation = await resolveDesignation(orgId, body, fallback);
  if (designation.error) return { error: designation.error };

  const email = emptyToNull(body.email !== undefined ? body.email : fallback.Email);
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address" };
  }

  return {
    DesignationId: designation.DesignationId,
    Designation: designation.Designation,
    Phone: emptyToNull(body.phone !== undefined ? body.phone : fallback.Phone),
    Email: email,
    Address: emptyToNull(body.address !== undefined ? body.address : fallback.Address),
  };
}

function wantsImageRemoved(body) {
  return body.removeImage === true || body.removeImage === "true" || body.removeImage === "1";
}

function uploadedImagePath(req) {
  if (!req.file) return null;
  return relativeUserImagePath(req.user.OrganizationId, req.file.filename);
}

function discardUploadedFile(req) {
  const imagePath = uploadedImagePath(req);
  if (imagePath) deleteUserImageFile(imagePath);
}

const list = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${USER_PROFILE_COLUMNS}
       FROM users u
       LEFT JOIN designations d ON d.DesignationId = u.DesignationId
       WHERE u.OrganizationId = ?
       ORDER BY u.FullName ASC`,
      [req.user.OrganizationId]
    );
    res.json({ status: true, users: rows.map(mapUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load users" });
  }
};

const create = async (req, res) => {
  try {
    const { username, fullName, role } = req.body;
    if (!username?.trim() || !fullName?.trim()) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Username, password, and full name are required" });
    }
    const passwordChange = readPasswordChange(req.body, { required: true });
    if (passwordChange.error) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: passwordChange.error });
    }
    const roleKey = role || ROLES.EMPLOYEE;
    if (!ALLOWED_ROLES.includes(roleKey)) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Invalid role" });
    }

    const profile = await readProfileFields(req.user.OrganizationId, req.body);
    if (profile.error) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: profile.error });
    }

    const hashed = await bcrypt.hash(passwordChange.password, 10);
    const imagePath = uploadedImagePath(req);
    const [result] = await db.query(
      `INSERT INTO users
        (OrganizationId, Username, Password, FullName, RoleKey, Status, ImagePath, DesignationId, Phone, Email, Address)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        req.user.OrganizationId,
        username.trim(),
        hashed,
        fullName.trim(),
        roleKey,
        imagePath,
        profile.DesignationId,
        profile.Phone,
        profile.Email,
        profile.Address,
      ]
    );

    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "user.create",
      entityType: "user",
      entityId: result.insertId,
      after: {
        username: username.trim(),
        role: roleKey,
        ImagePath: imagePath,
        DesignationId: profile.DesignationId,
        Phone: profile.Phone,
        Email: profile.Email,
        Address: profile.Address,
      },
    });

    res.status(201).json({
      status: true,
      user: mapUser({
        UserId: result.insertId,
        Username: username.trim(),
        FullName: fullName.trim(),
        RoleKey: roleKey,
        Status: "active",
        ImagePath: imagePath,
        ...profile,
      }),
    });
  } catch (error) {
    discardUploadedFile(req);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: false, message: "Username is already taken" });
    }
    console.error(error);
    res.status(500).json({ status: false, message: "Could not create user" });
  }
};

const update = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [rows] = await db.query(
      `SELECT ${USER_PROFILE_COLUMNS}
       FROM users u
       LEFT JOIN designations d ON d.DesignationId = u.DesignationId
       WHERE u.UserId = ? AND u.OrganizationId = ? LIMIT 1`,
      [userId, req.user.OrganizationId]
    );
    if (!rows.length) {
      discardUploadedFile(req);
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const current = rows[0];
    const profile = await readProfileFields(req.user.OrganizationId, req.body, current);
    if (profile.error) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: profile.error });
    }

    const fullName = req.body.fullName?.trim() || current.FullName;
    const roleKey = req.body.role || current.RoleKey;
    const status = req.body.status || current.Status;
    if (!ALLOWED_ROLES.includes(roleKey)) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Invalid role" });
    }
    if (!["active", "inactive"].includes(status)) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "Invalid status" });
    }
    if (userId === req.user.UserId && status === "inactive") {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: "You cannot deactivate your own account" });
    }

    let imagePath = current.ImagePath || null;
    if (req.file) {
      imagePath = uploadedImagePath(req);
    } else if (wantsImageRemoved(req.body)) {
      imagePath = null;
    }

    let passwordSql = "";
    const params = [
      fullName,
      roleKey,
      status,
      imagePath,
      profile.DesignationId,
      profile.Phone,
      profile.Email,
      profile.Address,
    ];
    const passwordChange = readPasswordChange(req.body, { required: false });
    if (passwordChange.error) {
      discardUploadedFile(req);
      return res.status(400).json({ status: false, message: passwordChange.error });
    }
    if (passwordChange.password) {
      passwordSql = ", Password = ?";
      params.push(await bcrypt.hash(passwordChange.password, 10));
    }
    params.push(userId, req.user.OrganizationId);

    await db.query(
      `UPDATE users SET FullName = ?, RoleKey = ?, Status = ?, ImagePath = ?,
        DesignationId = ?, Phone = ?, Email = ?, Address = ?${passwordSql}
       WHERE UserId = ? AND OrganizationId = ?`,
      params
    );

    if (imagePath !== (current.ImagePath || null) && current.ImagePath) {
      deleteUserImageFile(current.ImagePath);
    }

    await writeAudit({
      organizationId: req.user.OrganizationId,
      userId: req.user.UserId,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      before: current,
      after: {
        FullName: fullName,
        RoleKey: roleKey,
        Status: status,
        ImagePath: imagePath,
        ...profile,
      },
    });

    res.json({
      status: true,
      user: mapUser({
        UserId: userId,
        Username: current.Username,
        FullName: fullName,
        RoleKey: roleKey,
        Status: status,
        ImagePath: imagePath,
        ...profile,
      }),
    });
  } catch (error) {
    discardUploadedFile(req);
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update user" });
  }
};

module.exports = { list, create, update };
