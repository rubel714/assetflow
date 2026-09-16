import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="leading-tight min-w-0 w-full overflow-hidden py-0.5">
      <div className="truncate">{name || "—"}</div>
      <div className="text-[11px] text-muted truncate">{formatWhen(at)}</div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const emptyForm = {
  requestType: "new_asset",
  title: "",
  justification: "",
  quantity: "1",
  categoryId: "",
  assetId: "",
  departmentId: "",
  locationId: "",
  projectId: "",
};

export default function AssetRequests() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const canApprove = hasPermission(user, "requests.approve");
  const [requests, setRequests] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [lookups, setLookups] = useState({ categories: [], departments: [], locations: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  function openForm() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  function load() {
    return Promise.all([api.get("/asset-requests"), api.get("/lookups")]).then(([reqRes, lookupRes]) => {
      setRequests(reqRes.data.requests || []);
      setAvailableAssets(reqRes.data.availableAssets || []);
      setLookups({
        categories: lookupRes.data.categories || [],
        departments: lookupRes.data.departments || [],
        locations: lookupRes.data.locations || [],
        projects: lookupRes.data.projects || [],
      });
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
      if (typeFilter && row.RequestType !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        row.Title,
        row.Justification,
        row.AssetTag,
        row.AssetName,
        row.CategoryName,
        row.RequestedByName,
        row.ReviewedByName,
        row.Status,
        row.RequestType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, search, statusFilter, typeFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      showSnackbar("Title is required", { type: "validation" });
      return;
    }
    if (form.requestType === "assignment" && !form.assetId) {
      showSnackbar("Choose an available asset", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/asset-requests", {
        requestType: form.requestType,
        title: form.title.trim(),
        justification: form.justification.trim(),
        quantity: Number(form.quantity || 1),
        categoryId: form.categoryId || null,
        assetId: form.assetId || null,
        departmentId: form.departmentId || null,
        locationId: form.locationId || null,
        projectId: form.projectId || null,
      });
      closeForm();
      await load();
      showSnackbar("Request submitted");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not create request", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(row, action) {
    const label = row.Title ? `“${row.Title}”` : "This request";
    const prompts = {
      approve: {
        title: "Approve this request?",
        message: `${label} will be marked approved. It will not create an asset or assign custody.`,
        confirmLabel: "Approve",
        danger: false,
      },
      reject: {
        title: "Reject this request?",
        message: `${label} will be rejected.`,
        confirmLabel: "Reject",
        danger: true,
        noteRequired: true,
        noteLabel: "Reason",
      },
      cancel: {
        title: "Cancel this request?",
        message: `${label} will be cancelled.`,
        confirmLabel: "Cancel request",
        danger: true,
        noteRequired: true,
        noteLabel: "Reason",
      },
    };
    const result = await confirmAction(prompts[action]);
    const confirmed = prompts[action].noteRequired ? result?.ok : result;
    if (!confirmed) return;
    try {
      await api.patch(`/asset-requests/${row.RequestId}`, {
        action,
        reviewNotes: result?.note || undefined,
      });
      await load();
      showSnackbar("Request updated");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not update request", { type: "error" });
    }
  }

  const columnDefs = useMemo(
    () => [
      { field: "Title", headerName: "Request", minWidth: 140, flex: 1.3, tooltipField: "Title" },
      {
        field: "RequestType",
        headerName: "Type",
        minWidth: 50,
        maxWidth: 110,
        flex: 0.35,
        valueFormatter: (params) => (params.value === "assignment" ? "Assignment" : "New asset"),
      },
      {
        colId: "subject",
        headerName: "Asset / category",
        minWidth: 200,
        flex: 2.4,
        tooltipValueGetter: (params) =>
          params.data?.AssetId
            ? `${params.data.AssetTag} · ${params.data.AssetName || ""}`.trim()
            : params.data?.CategoryName || "",
        valueGetter: (params) =>
          params.data?.AssetTag
            ? `${params.data.AssetTag} ${params.data.AssetName || ""}`.trim()
            : params.data?.CategoryName || "",
        cellRenderer: (params) => {
          const row = params.data;
          if (!row?.AssetId) {
            return <span className="block truncate w-full">{row?.CategoryName || "—"}</span>;
          }
          return (
            <Link
              to={`/assets/${row.AssetId}`}
              state={{ from: "/requests" }}
              className="text-accent font-medium truncate block min-w-0 w-full"
              title={`${row.AssetTag} · ${row.AssetName}`}
              onClick={(e) => e.stopPropagation()}
            >
              {row.AssetTag} · {row.AssetName}
            </Link>
          );
        },
      },
      { field: "Quantity", headerName: "Qty", minWidth: 52, maxWidth: 72, flex: 0.27, cellClass: "text-right", headerClass: "text-right"},
      { field: "Status", headerName: "Status", minWidth: 64, maxWidth: 84, flex: 0.35 },
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
        colId: "reviewed",
        headerName: "Reviewed",
        minWidth: 130,
        flex: 1,
        valueGetter: (params) =>
          `${params.data?.ReviewedByName || ""} ${params.data?.ReviewedAt || ""}`.trim(),
        cellRenderer: (params) => (
          <UserDateCell name={params.data?.ReviewedByName} at={params.data?.ReviewedAt} />
        ),
      },
      {
        colId: "actions",
        headerName: "Actions",
        minWidth: 96,
        maxWidth: 220,
        flex: 0,
        sortable: false,
        cellRenderer: (params) => {
          const row = params.data;
          if (!row || row.Status !== "pending") {
            return <span className="text-muted text-xs">—</span>;
          }
          const isRequester = Number(row.RequestedBy) === Number(user?.UserId);
          return (
            <div className="flex flex-wrap gap-1">
              {canApprove && (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg bg-cyan-600 text-white text-xs"
                  onClick={() => runAction(row, "approve")}
                >
                  Approve
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border border-white/10 text-xs"
                  onClick={() => runAction(row, "reject")}
                >
                  Reject
                </button>
              )}
              {(isRequester || canApprove) && (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border border-white/10 text-xs"
                  onClick={() => runAction(row, "cancel")}
                >
                  Cancel
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [canApprove, user?.UserId]
  );

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Lifecycle</p>
          <h2 className="text-2xl font-bold">{showForm ? "New Request" : "Requests"}</h2>
          <p className="text-muted text-sm mt-1">
            {showForm
              ? "Ask for a new asset or for an available item. Approval does not purchase or assign."
              : "Submit requests. Managers approve or reject pending items."}
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
              placeholder="Title, asset, person"
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
            <label className="input-label">Type</label>
            <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="new_asset">New asset</option>
              <option value="assignment">Assignment</option>
            </select>
          </div>
        </div>
      )}

      {showForm ? (
        <form className="glass rounded-2xl p-6 space-y-4" onSubmit={handleCreate}>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Type</label>
              <select
                className="input-field"
                value={form.requestType}
                onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value, assetId: "" }))}
              >
                <option value="new_asset">New asset</option>
                <option value="assignment">Assignment</option>
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
              <label className="input-label">Quantity</label>
              <input
                className="input-field"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            {form.requestType === "new_asset" ? (
              <div>
                <label className="input-label">Category</label>
                <select
                  className="input-field"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {lookups.categories.map((c) => (
                    <option key={c.CategoryId} value={c.CategoryId}>
                      {c.Name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="input-label">Available asset</label>
                <select
                  className="input-field"
                  value={form.assetId}
                  onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
                >
                  <option value="">Select asset</option>
                  {availableAssets.map((a) => (
                    <option key={a.AssetId} value={a.AssetId}>
                      {a.AssetTag} · {a.Name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="input-label">Department</label>
              <select
                className="input-field"
                value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              >
                <option value="">Optional</option>
                {lookups.departments.map((d) => (
                  <option key={d.DepartmentId} value={d.DepartmentId}>
                    {d.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Location</label>
              <select
                className="input-field"
                value={form.locationId}
                onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              >
                <option value="">Optional</option>
                {lookups.locations.map((l) => (
                  <option key={l.LocationId} value={l.LocationId}>
                    {l.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Project</label>
              <select
                className="input-field"
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">Optional</option>
                {lookups.projects.map((p) => (
                  <option key={p.ProjectId} value={p.ProjectId}>
                    {p.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="input-label">Justification</label>
              <input
                className="input-field"
                value={form.justification}
                onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
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
          emptyMessage="No asset requests yet."
          enableColumnFilter={false}
          rowHeight={52}
          onCellClicked={(params) => {
            if (params.colDef?.colId !== "subject") return;
            const assetId = params.data?.AssetId;
            if (!assetId) return;
            navigate(`/assets/${assetId}`, { state: { from: "/requests" } });
          }}
        />
      )}
    </div>
  );
}
