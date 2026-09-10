const { ASSET_STATUSES, ROLES } = require("./permissions");

function resolveStatusChange(from, to, roleKey) {
  if (!to || from === to) {
    return { ok: true, nextStatus: from, closeAssignment: false };
  }
  if (!ASSET_STATUSES.includes(to)) {
    return { ok: false, statusCode: 400, message: "Invalid status" };
  }
  if (to === "Assigned" || to === "Available") {
    return {
      ok: false,
      statusCode: 400,
      message: "Use assign, transfer, or return to change custody status",
    };
  }
  if (from === "Retired") {
    return { ok: false, statusCode: 400, message: "A retired asset cannot change status" };
  }
  if (to === "Retired") {
    if (roleKey !== ROLES.ORGANIZATION_ADMIN) {
      return {
        ok: false,
        statusCode: 403,
        message: "Only an organization admin can retire an asset",
      };
    }
    return { ok: true, nextStatus: to, closeAssignment: from === "Assigned" };
  }
  if ((to === "Damaged" || to === "Lost") && (from === "Available" || from === "Assigned")) {
    return { ok: true, nextStatus: to, closeAssignment: from === "Assigned" };
  }
  return {
    ok: false,
    statusCode: 400,
    message: `Cannot change status from ${from} to ${to}`,
  };
}

function statusChoices(currentStatus, roleKey) {
  const current = currentStatus || "Available";
  const choices = [current];
  if (current === "Available" || current === "Assigned") {
    choices.push("Damaged", "Lost");
    if (roleKey === ROLES.ORGANIZATION_ADMIN) choices.push("Retired");
  } else if (current === "Damaged" || current === "Lost") {
    if (roleKey === ROLES.ORGANIZATION_ADMIN) choices.push("Retired");
  }
  return [...new Set(choices)];
}

module.exports = { resolveStatusChange, statusChoices };
