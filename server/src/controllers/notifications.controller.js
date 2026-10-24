const { isEmployee } = require("../middleware/auth");
const {
  ensureWarrantyNotifications,
} = require("../services/notification.service");
const { ensureScheduledWorkOrders } = require("../services/schedule.service");
const db = require("../config/db");

const list = async (req, res) => {
  try {
    const orgId = req.user.OrganizationId;
    await ensureScheduledWorkOrders(orgId);
    await ensureWarrantyNotifications(orgId, req.user.UserId, isEmployee(req.user));
    const [rows] = await db.query(
      `SELECT NotificationId, Type, Title, Body, Link, EntityType, EntityId, ReadAt, CreatedAt
       FROM notifications
       WHERE OrganizationId = ? AND UserId = ?
       ORDER BY (ReadAt IS NULL) DESC, CreatedAt DESC
       LIMIT 50`,
      [orgId, req.user.UserId]
    );
    const unread = rows.filter((row) => !row.ReadAt).length;
    res.json({ status: true, unread, notifications: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not load notifications" });
  }
};

const markRead = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.query(
      `UPDATE notifications SET ReadAt = COALESCE(ReadAt, NOW())
       WHERE NotificationId = ? AND OrganizationId = ? AND UserId = ?`,
      [id, req.user.OrganizationId, req.user.UserId]
    );
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update notification" });
  }
};

const markAllRead = async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET ReadAt = NOW()
       WHERE OrganizationId = ? AND UserId = ? AND ReadAt IS NULL`,
      [req.user.OrganizationId, req.user.UserId]
    );
    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Could not update notifications" });
  }
};

module.exports = { list, markRead, markAllRead };
