import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { getSavedUser } from "../lib/globalfunction";
import { useTheme } from "../lib/ThemeContext";
import { buildDashboardCharts, chartPalette } from "../lib/dashboardCharts";
import ChartCard from "../components/ChartCard";

export default function Dashboard() {
  const user = getSavedUser();
  const { theme } = useTheme();
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/dashboard"), api.get("/dashboard/charts")])
      .then(([summaryRes, chartRes]) => {
        if (cancelled) return;
        setSummary(summaryRes.data.summary);
        setCharts(chartRes.data.charts || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const palette = useMemo(() => chartPalette(theme), [theme]);
  const chartCards = useMemo(() => buildDashboardCharts(charts, palette), [charts, palette]);
  const sections = useMemo(() => {
    const grouped = [];
    for (const card of chartCards) {
      const last = grouped[grouped.length - 1];
      if (!last || last.section !== card.section) {
        grouped.push({ section: card.section, items: [card] });
      } else {
        last.items.push(card);
      }
    }
    return grouped;
  }, [chartCards]);

  const isEmployee = user?.Role === "employee";
  const cards = isEmployee
    ? [
        { label: "Assigned to me", value: summary?.assigned, to: "/my-assets" },
        { label: "Pending handovers", value: summary?.pendingHandovers, to: "/my-assets" },
        { label: "Warranties due", value: summary?.warrantiesDue, to: "/warranties" },
        { label: "Open maintenance", value: summary?.openMaintenance, to: "/maintenance" },
        { label: "Pending requests", value: summary?.pendingRequests, to: "/requests" },
      ]
    : [
        { label: "Total Assets", value: summary?.totalAssets, to: "/assets" },
        { label: "Assigned", value: summary?.assigned, to: "/assets" },
        { label: "Available", value: summary?.available, to: "/assets" },
        { label: "In Repair", value: summary?.inRepair, to: "/maintenance" },
        { label: "Damaged", value: summary?.damaged, to: "/assets" },
        { label: "Lost", value: summary?.lost, to: "/assets" },
        { label: "Retired", value: summary?.retired, to: "/assets" },
        { label: "Assigned to me", value: summary?.assignedToMe, to: "/my-assets" },
        { label: "My pending handovers", value: summary?.myPendingHandovers, to: "/my-assets" },
        { label: "Pending handovers", value: summary?.pendingHandovers, to: "/assets" },
        { label: "Warranties due", value: summary?.warrantiesDue, to: "/warranties" },
        { label: "Open maintenance", value: summary?.openMaintenance, to: "/maintenance" },
        { label: "Pending requests", value: summary?.pendingRequests, to: "/requests" },
        { label: "Users", value: summary?.users, to: "/users" },
      ];

  return (
    <div className="animate-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted text-sm mt-1">
          Welcome back, {user?.FullName || user?.Email || "user"}.
        </p>
      </div>

      {loading && <p className="text-muted">Loading dashboard…</p>}

      {!loading && (
        <>
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

          {!isEmployee &&
            sections.map((group) => (
              <section key={group.section} className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest text-muted">{group.section}</h3>
                <div className="grid lg:grid-cols-2 gap-4">
                  {group.items.map((item) => (
                    <ChartCard key={item.title} title={item.title} option={item.option} height={item.height} />
                  ))}
                </div>
              </section>
            ))}
        </>
      )}
    </div>
  );
}
