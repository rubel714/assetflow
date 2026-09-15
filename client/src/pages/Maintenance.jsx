import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { getSavedUser, hasPermission } from "../lib/globalfunction";
import DataGrid from "../components/DataGrid";
import PageNotice from "../components/PageNotice";
import { showSnackbar } from "../lib/snackbar";

function formatWhen(value) {
  return value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : "—";
}

function UserDateCell({ name, at }) {
  return (
    <div className="leading-tight min-w-0 py-0.5">
      <div className="truncate">{name || "—"}</div>
      <div className="text-[11px] text-muted truncate">{formatWhen(at)}</div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Maintenance() {
  const user = getSavedUser();
  const canManage = hasPermission(user, "maintenance.manage");
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assetId: "", title: "", description: "" });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");

  const emptyForm = { assetId: "", title: "", description: "" };

  function openForm() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

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

  useEffect(() => {
    const handle = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const filteredRequests = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter((row) => {
      if (statusFilter && row.Status !== statusFilter) return false;
      if (assetFilter && String(row.AssetId) !== String(assetFilter)) return false;
      if (!q) return true;
      const hay = [
        row.AssetTag,
        row.AssetName,
        row.Title,
        row.Description,
        row.RequestedByName,
        row.StartedByName,
        row.CompletedByName,
        row.Status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, search, statusFilter, assetFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.assetId || !form.title.trim()) {
      showSnackbar("Asset and title are required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/maintenance-requests", form);
      closeForm();
      await load();
      showSnackbar("Maintenance request saved");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not create request", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(row, action) {
    const label = row.Title ? `“${row.Title}”` : "This work order";
    const asset = row.AssetTag ? ` for ${row.AssetTag}` : "";
    const prompts = {
      start: {
        title: "Start this work order?",
        message: `${label}${asset} will move to in progress and the asset will be marked In Repair.`,
        confirmLabel: "Start",
        danger: false,
      },
      complete: {
        title: "Complete this work order?",
        message: `${label}${asset} will be marked completed.`,
        confirmLabel: "Complete",
        danger: false,
      },
      cancel: {
        title: "Cancel this work order?",
        message: `${label}${asset} will be cancelled.`,
        confirmLabel: "Cancel work order",
        danger: true,
      },
    };
    const prompt = prompts[action];
    if (prompt) {
      const ok = await confirmAction(prompt);
      if (!ok) return;
    }
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
        minWidth: 90,
        cellRenderer: (params) =>
          params.data?.AssetId ? (
            <Link to={`/assets/${params.data.AssetId}`} className="text-accent font-medium">
              {params.data.AssetTag}
            </Link>
          ) : (
            params.value
          ),
      },
      { field: "AssetName", headerName: "Asset", minWidth: 110, flex: 1 },
      { field: "Title", headerName: "Request", minWidth: 120, flex: 1.2 },
      { field: "Status", headerName: "Status", minWidth: 90, flex: 0.6 },
      {
        colId: "requested",
        headerName: "Requested",
        minWidth: 130,
        flex: 1,
        valueGetter: (params) =>
          `${params.data?.RequestedByName || ""} ${params.data?.CreatedAt || ""}`.trim(),
        cellRenderer: (params) => (
          <UserDateCell name={params.data?.RequestedByName} at={params.data?.CreatedAt} />
        ),
      },
      {
        colId: "started",
        headerName: "Started",
        minWidth: 130,
        flex: 1,
        valueGetter: (params) =>
          `${params.data?.StartedByName || ""} ${params.data?.StartedAt || ""}`.trim(),
        cellRenderer: (params) => (
          <UserDateCell name={params.data?.StartedByName} at={params.data?.StartedAt} />
        ),
      },
      {
        colId: "completed",
        headerName: "Completed",
        minWidth: 130,
        flex: 1,
        valueGetter: (params) =>
          `${params.data?.CompletedByName || ""} ${params.data?.CompletedAt || ""}`.trim(),
        cellRenderer: (params) => (
          <UserDateCell name={params.data?.CompletedByName} at={params.data?.CompletedAt} />
        ),
      },
      ...(canManage
        ? [
            {
              colId: "actions",
              headerName: "Work order",
              minWidth: 168,
              maxWidth: 200,
              flex: 0,
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
            },
          ]
        : []),
    ],
    [canManage]
  );

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Service</p>
          <h2 className="text-2xl font-bold">{showForm ? "New Request" : "Maintenance"}</h2>
          <p className="text-muted text-sm mt-1">
            {showForm
              ? "Choose an asset and describe the work that is needed."
              : "Request work on an asset. Managers start and close work orders."}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openForm}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
          >
            New Request
          </button>
        )}
      </div>

      {!showForm && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="input-label">Search</label>
            <input
              className="input-field"
              placeholder="Tag, asset, title, person"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">Status</label>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Asset</label>
            <select
              className="input-field"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
            >
              <option value="">All assets</option>
              {assets.map((a) => (
                <option key={a.AssetId} value={a.AssetId}>
                  {a.AssetTag} · {a.Name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showForm ? (
        <form className="glass rounded-2xl p-6 space-y-4" onSubmit={handleCreate}>
          <div className="grid sm:grid-cols-3 gap-4">
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
            <div>
              <label className="input-label">Description</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Submit request
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : loading ? (
        <PageNotice loading loadingText="Loading requests…" />
      ) : (
        <DataGrid
          rowData={filteredRequests}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.RequestId ?? "")}
          emptyMessage="No maintenance requests yet."
          enableColumnFilter={false}
          rowHeight={52}
        />
      )}
    </div>
  );
}
