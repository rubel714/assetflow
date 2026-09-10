import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { getSavedUser, hasPermission } from "../lib/globalfunction";
import DataGrid from "../components/DataGrid";
import PageNotice from "../components/PageNotice";
import { showSnackbar } from "../lib/snackbar";

export default function Maintenance() {
  const user = getSavedUser();
  const canManage = hasPermission(user, "maintenance.manage");
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ assetId: "", title: "", description: "" });

  function load() {
    return Promise.all([
      api.get("/maintenance-requests"),
      api.get("/assets", { params: { page: 1, pageSize: 100 } }),
    ]).then(([reqRes, assetRes]) => {
      setRequests(reqRes.data.requests || []);
      setAssets(assetRes.data.assets || []);
    });
  }

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.assetId || !form.title.trim()) {
      showSnackbar("Asset and title are required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/maintenance-requests", form);
      setForm({ assetId: "", title: "", description: "" });
      await load();
      showSnackbar("Maintenance request saved");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not create request", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(row, action) {
    try {
      await api.patch(`/maintenance-requests/${row.RequestId}`, { action });
      await load();
      showSnackbar("Work order updated");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not update work order", { type: "error" });
    }
  }

  const columnDefs = useMemo(
    () => [
      {
        field: "AssetTag",
        headerName: "Tag",
        minWidth: 110,
        cellRenderer: (params) =>
          params.data?.AssetId ? (
            <Link to={`/assets/${params.data.AssetId}`} className="text-accent font-medium">
              {params.data.AssetTag}
            </Link>
          ) : (
            params.value
          ),
      },
      { field: "AssetName", headerName: "Asset", minWidth: 160, flex: 1 },
      { field: "Title", headerName: "Request", minWidth: 180, flex: 2 },
      { field: "Status", headerName: "Status", minWidth: 120 },
      { field: "RequestedByName", headerName: "Requested by", minWidth: 140 },
      canManage
        ? {
            colId: "actions",
            headerName: "Work order",
            minWidth: 220,
            sortable: false,
            cellRenderer: (params) => {
              const row = params.data;
              if (!row) return null;
              if (row.Status === "open") {
                return (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-cyan-600 text-white text-xs"
                      onClick={() => runAction(row, "start")}
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg border border-white/10 text-xs"
                      onClick={() => runAction(row, "cancel")}
                    >
                      Cancel
                    </button>
                  </div>
                );
              }
              if (row.Status === "in_progress") {
                return (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-cyan-600 text-white text-xs"
                      onClick={() => runAction(row, "complete")}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg border border-white/10 text-xs"
                      onClick={() => runAction(row, "cancel")}
                    >
                      Cancel
                    </button>
                  </div>
                );
              }
              return <span className="text-muted text-xs">—</span>;
            },
          }
        : {
            field: "CreatedAt",
            headerName: "Opened",
            minWidth: 160,
            valueGetter: (params) =>
              params.data?.CreatedAt ? new Date(params.data.CreatedAt).toLocaleString() : "—",
          },
    ],
    [canManage]
  );

  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Service</p>
        <h2 className="text-2xl font-bold">Maintenance</h2>
        <p className="text-muted text-sm mt-1">
          Request work on an asset. Managers start and close work orders.
        </p>
      </div>

      <form className="glass rounded-2xl p-6 space-y-4" onSubmit={handleCreate}>
        <h3 className="font-semibold">New request</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Asset</label>
            <select
              className="input-field"
              value={form.assetId}
              onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
            >
              <option value="">Select asset</option>
              {assets.map((a) => (
                <option key={a.AssetId} value={a.AssetId}>
                  {a.AssetTag} · {a.Name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Title</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="input-label">Description</label>
          <input
            className="input-field"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          Submit request
        </button>
      </form>

      {loading ? (
        <PageNotice loading loadingText="Loading requests…" />
      ) : (
        <DataGrid
          rowData={requests}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.RequestId ?? "")}
          emptyMessage="No maintenance requests yet."
          enableColumnFilter={false}
        />
      )}
    </div>
  );
}
