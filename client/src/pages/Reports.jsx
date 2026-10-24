import React from "react";
import api from "../lib/api";
import { showSnackbar } from "../lib/snackbar";

const REPORTS = [
  { key: "assets", path: "/assets/export", filename: "asset-register.csv", label: "Asset register", hint: "Full register with filters from the assets API." },
  { key: "warranties", path: "/reports/warranties", filename: "warranties.csv", label: "Warranties due", hint: "Expired or due within 30 days." },
  { key: "maintenance", path: "/reports/maintenance", filename: "maintenance.csv", label: "Maintenance work orders", hint: "Status, cost, and dates." },
  { key: "assignments", path: "/reports/assignments", filename: "assignments.csv", label: "Open assignments", hint: "Current custodian and handover status." },
  { key: "value", path: "/reports/value-by-category", filename: "value-by-category.csv", label: "Value by category", hint: "Purchase cost totals matching the dashboard pie." },
];

async function download(report) {
  try {
    const res = await api.get(report.path, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showSnackbar(err.response?.data?.message || "Could not download report", { type: "error" });
  }
}

export default function Reports() {
  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Exports</p>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted text-sm mt-1">Download CSV files. Nothing is sent by email.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.key} className="glass rounded-2xl p-5">
            <h3 className="font-semibold">{report.label}</h3>
            <p className="text-muted text-sm mt-1">{report.hint}</p>
            <button
              type="button"
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold"
              onClick={() => download(report)}
            >
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
