import React, { useEffect, useState } from "react";
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
    ? [{ label: "Assigned to me", value: summary?.assigned }]
    : [
        { label: "Total Assets", value: summary?.totalAssets },
        { label: "Assigned", value: summary?.assigned },
        { label: "Available", value: summary?.available },
        { label: "Damaged", value: summary?.damaged },
        { label: "Lost", value: summary?.lost },
        { label: "Retired", value: summary?.retired },
        { label: "Users", value: summary?.users },
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
            <div key={card.label} className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted">{card.label}</p>
              <p className="text-3xl font-bold mt-2 text-accent">
                {summary ? card.value ?? 0 : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
