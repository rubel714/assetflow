const { writeAudit } = require("./audit.service");
const db = require("../config/db");

async function getOrgRow(table, idCol, id, organizationId) {
  const [rows] = await db.query(
    `SELECT * FROM ${table} WHERE ${idCol} = ? AND OrganizationId = ? LIMIT 1`,
    [id, organizationId]
  );
  return rows[0] || null;
}

async function auditSetup(req, { action, entityType, entityId, before, after }) {
  await writeAudit({
    organizationId: req.user.OrganizationId,
    userId: req.user.UserId,
    action,
    entityType,
    entityId,
    before,
    after,
  });
}

module.exports = { getOrgRow, auditSetup };
