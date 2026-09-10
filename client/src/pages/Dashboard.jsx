import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { getSavedUser, roleLabel } from "../lib/globalfunction";

export default function Dashboard() {
  const user = getSavedUser();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/dashboard")
      .then((res) => {
        if (!cancelled) setSummary(res.data.summary);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEmployee = user?.Role === "employee";
  const cards = isEmployee
    ? [
        { label: "Assigned to me", value: summary?.assigned, to: "/my-assets" },
        { label: "Pending handovers", value: summary?.pendingHandovers, to: "/my-assets" },
        { label: "Warranties due", value: summary?.warrantiesDue, to: "/warranties" },
        { label: "Open maintenance", value: summary?.openMaintenance, to: "/maintenance" },
      ]
    : [
        { label: "Total Assets", value: summary?.totalAssets, to: "/assets" },
        { label: "Assigned", value: summary?.assigned, to: "/assets" },
        { label: "Available", value: summary?.available, to: "/assets" },
        { label: "In Repair", value: summary?.inRepair, to: "/maintenance" },
        { label: "Damaged", value: summary?.damaged, to: "/assets" },
        { label: "Lost", value: summary?.lost, to: "/assets" },
        { label: "Retired", value: summary?.retired, to: "/assets" },
        { label: "Pending handovers", value: summary?.pendingHandovers, to: "/assets" },
        { label: "Warranties due", value: summary?.warrantiesDue, to: "/warranties" },
        { label: "Open maintenance", value: summary?.openMaintenance, to: "/maintenance" },
        { label: "Users", value: summary?.users, to: "/users" },
      ];

  return (
    <div className="animate-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted text-sm mt-1">
          Welcome back, {user?.FullName || user?.Username || "user"}.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted">Signed in as</p>
        <p className="text-lg font-semibold">{user?.FullName}</p>
        <div className="grid sm:grid-cols-3 gap-4 pt-2 text-sm">
          <div>
            <p className="text-muted">Username</p>
            <p className="font-medium">{user?.Username}</p>
          </div>
          <div>
            <p className="text-muted">Role</p>
            <p className="font-medium">{roleLabel(user?.Role)}</p>
          </div>
          <div>
            <p className="text-muted">Organization</p>
            <p className="font-medium">{user?.OrganizationName || "—"}</p>
          </div>
        </div>
      </div>

      {loading && <p className="text-muted">Loading dashboard…</p>}

      {!loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Link key={card.label} to={card.to} className="glass rounded-2xl p-5 block hover:bg-white/5">
              <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
              <p className="text-3xl font-bold mt-2 text-accent">
                {summary ? card.value ?? 0 : "—"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
