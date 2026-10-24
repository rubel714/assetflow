import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getSavedUser } from "../lib/globalfunction";

function formatWhen(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "";
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  function load() {
    if (!user) return Promise.resolve();
    return api
      .get("/notifications")
      .then((res) => {
        setItems(res.data.notifications || []);
        setUnread(Number(res.data.unread || 0));
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [user?.UserId]);

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function openItem(row) {
    if (!row.ReadAt) {
      await api.patch(`/notifications/${row.NotificationId}/read`).catch(() => {});
    }
    setOpen(false);
    if (row.Link) navigate(row.Link);
    load();
  }

  async function markAll() {
    await api.patch("/notifications/read-all").catch(() => {});
    load();
  }

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="relative p-2 rounded-full hover:bg-white/10"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-1 rounded-full bg-red-500 text-[10px] text-white font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="nav-dropdown absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl py-1 z-[90]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="text-xs text-accent" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>
            ) : (
              items.map((row) => (
                <button
                  key={row.NotificationId}
                  type="button"
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${
                    row.ReadAt ? "text-muted" : "font-medium"
                  }`}
                  onClick={() => openItem(row)}
                >
                  <span className="block">{row.Title}</span>
                  {row.Body ? <span className="block text-xs text-muted mt-0.5">{row.Body}</span> : null}
                  <span className="block text-[11px] text-muted mt-0.5">{formatWhen(row.CreatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
