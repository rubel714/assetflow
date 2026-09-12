import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import DataGrid from "../components/DataGrid";
import { setActingOrganization } from "../lib/globalfunction";
import { showSnackbar } from "../lib/snackbar";

const emptyForm = {
  name: "",
  legalName: "",
  code: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  status: "active",
  accessStartsAt: "",
  accessEndsAt: "",
  maxUsers: "",
  maxAssets: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fromOrg(org) {
  return {
    ...emptyForm,
    name: org.Name || "",
    legalName: org.LegalName || "",
    code: org.Code || "",
    email: org.Email || "",
    phone: org.Phone || "",
    website: org.Website || "",
    address: org.Address || "",
    status: org.Status || "active",
    accessStartsAt: toDateInput(org.AccessStartsAt),
    accessEndsAt: toDateInput(org.AccessEndsAt),
    maxUsers: org.MaxUsers == null ? "" : String(org.MaxUsers),
    maxAssets: org.MaxAssets == null ? "" : String(org.MaxAssets),
  };
}

function ActionButton({ children, onClick, className }) {
  return (
    <button
      type="button"
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap text-white ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function OrgActionsCell(params) {
  const row = params?.data;
  const ctx = params?.context || {};
  if (!row) return null;
  const inactive = row.Status === "active";
  return (
    <div className="flex flex-wrap items-center gap-1.5 h-full py-1.5 pr-2">
      <ActionButton className="bg-cyan-600 hover:bg-cyan-500" onClick={() => ctx.onEnter?.(row)}>
        Enter
      </ActionButton>
      <ActionButton className="bg-indigo-600 hover:bg-indigo-500" onClick={() => ctx.onEdit?.(row)}>
        Edit
      </ActionButton>
      <ActionButton
        className={inactive ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"}
        onClick={() => ctx.onToggleStatus?.(row)}
      >
        {inactive ? "Inactivate" : "Activate"}
      </ActionButton>
      <ActionButton className="bg-amber-600 hover:bg-amber-500" onClick={() => ctx.onSetAccessDays?.(row, 30)}>
        30 days
      </ActionButton>
      <ActionButton className="bg-violet-600 hover:bg-violet-500" onClick={() => ctx.onSetAccessDays?.(row, 7)}>
        7 days
      </ActionButton>
      <ActionButton className="bg-sky-600 hover:bg-sky-500" onClick={() => ctx.onSetAccessDays?.(row, 90)}>
        90 days
      </ActionButton>
      <ActionButton className="bg-slate-600 hover:bg-slate-500" onClick={() => ctx.onClearAccess?.(row)}>
        No expiry
      </ActionButton>
    </div>
  );
}

function licensePayload(form, extra = {}) {
  return {
    name: form.name.trim(),
    legalName: form.legalName.trim(),
    code: form.code.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    website: form.website.trim(),
    address: form.address.trim(),
    status: form.status,
    accessStartsAt: form.accessStartsAt || null,
    accessEndsAt: form.accessEndsAt || null,
    maxUsers: form.maxUsers === "" ? null : Number(form.maxUsers),
    maxAssets: form.maxAssets === "" ? null : Number(form.maxAssets),
    ...extra,
  };
}

export default function AdminOrganizations() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    return api
      .get("/admin/organizations")
      .then((res) => setRows(res.data.organizations || []))
      .catch((err) => {
        showSnackbar(err.response?.data?.message || "Could not load organizations", { type: "error" });
      });
  }

  React.useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function showAdd() {
    setEditing(null);
    setForm({ ...emptyForm, status: "active" });
    setView("add");
  }

  function showEdit(row) {
    setEditing(row);
    setForm(fromOrg(row));
    setView("edit");
  }

  function showList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      showSnackbar("Name and code are required", { type: "validation" });
      return;
    }
    if (view === "add" && (!form.adminFullName.trim() || !form.adminEmail.trim() || !form.adminPassword)) {
      showSnackbar("First organization admin is required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const payload = licensePayload(form);
      if (view === "add") {
        payload.admin = {
          fullName: form.adminFullName.trim(),
          email: form.adminEmail.trim().toLowerCase(),
          password: form.adminPassword,
        };
        await api.post("/admin/organizations", payload);
        showSnackbar("Organization created");
      } else {
        await api.patch(`/admin/organizations/${editing.OrganizationId}`, payload);
        showSnackbar("Organization updated");
      }
      await load();
      showList();
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save organization", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function setAccessDays(row, days) {
    try {
      await api.patch(`/admin/organizations/${row.OrganizationId}`, {
        name: row.Name,
        code: row.Code,
        accessDays: days,
      });
      await load();
      showSnackbar(days ? `Access set for ${days} days` : "Access updated");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not update access", { type: "error" });
    }
  }

  async function clearAccess(row) {
    try {
      await api.patch(`/admin/organizations/${row.OrganizationId}`, {
        name: row.Name,
        code: row.Code,
        clearAccess: true,
      });
      await load();
      showSnackbar("Access expiry cleared");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not clear access", { type: "error" });
    }
  }

  async function toggleStatus(row) {
    const next = row.Status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/admin/organizations/${row.OrganizationId}`, {
        name: row.Name,
        code: row.Code,
        status: next,
      });
      await load();
      showSnackbar(next === "active" ? "Organization activated" : "Organization inactivated");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not change status", { type: "error" });
    }
  }

  async function enterOrg(row) {
    try {
      const res = await api.post(`/admin/organizations/${row.OrganizationId}/enter`);
      setActingOrganization(res.data.organization);
      showSnackbar(`Entered ${res.data.organization.Name}`);
      navigate("/");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not enter organization", { type: "error" });
    }
  }

  const columnDefs = useMemo(
    () => [
      { field: "Name", headerName: "Name", minWidth: 140, flex: 1.1, filter: "agTextColumnFilter" },
      { field: "Code", headerName: "Code", minWidth: 80, flex: 0.4, filter: "agTextColumnFilter" },
      {
        field: "Status",
        headerName: "Status",
        minWidth: 90,
        flex: 0.4,
        valueFormatter: (params) => (params.value === "inactive" ? "Inactive" : "Active"),
      },
      {
        field: "AccessEndsAt",
        headerName: "Access ends",
        minWidth: 110,
        flex: 0.5,
        valueFormatter: (params) => (params.value ? toDateInput(params.value) : "No expiry"),
      },
      {
        field: "DaysRemaining",
        headerName: "Days left",
        minWidth: 80,
        flex: 0.4,
        valueFormatter: (params) => (params.value == null ? "—" : String(params.value)),
      },
      {
        colId: "users",
        headerName: "Users",
        minWidth: 80,
        flex: 0.4,
        valueGetter: (params) => {
          const max = params.data?.MaxUsers;
          const count = params.data?.UserCount ?? 0;
          return max == null ? `${count}` : `${count} / ${max}`;
        },
      },
      {
        colId: "assets",
        headerName: "Assets",
        minWidth: 80,
        flex: 0.4,
        valueGetter: (params) => {
          const max = params.data?.MaxAssets;
          const count = params.data?.AssetCount ?? 0;
          return max == null ? `${count}` : `${count} / ${max}`;
        },
      },
      {
        colId: "actions",
        headerName: "Actions",
        sortable: false,
        filter: false,
        floatingFilter: false,
        minWidth: 280,
        flex: 2.2,
        autoHeight: true,
        cellRenderer: OrgActionsCell,
      },
    ],
    []
  );

  const isForm = view === "add" || view === "edit";

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Site admin</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Create organization" : view === "edit" ? "Edit organization" : "Organizations"}
          </h2>
          <p className="text-muted text-sm mt-1">
            License, activate, and enter tenant organizations.
          </p>
        </div>
        {view === "list" ? (
          <button
            type="button"
            onClick={showAdd}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
          >
            Add
          </button>
        ) : (
          <button
            type="button"
            onClick={showList}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
          >
            Back to organizations
          </button>
        )}
      </div>

      {isForm ? (
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-2 gap-6">
          <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">Profile</h3>
            <div>
              <label className="input-label">Name</label>
              <input className="input-field" value={form.name} onChange={update("name")} />
            </div>
            <div>
              <label className="input-label">Legal name</label>
              <input className="input-field" value={form.legalName} onChange={update("legalName")} />
            </div>
            <div>
              <label className="input-label">Code</label>
              <input className="input-field" value={form.code} onChange={update("code")} />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input className="input-field" value={form.email} onChange={update("email")} />
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input className="input-field" value={form.phone} onChange={update("phone")} />
            </div>
            <div>
              <label className="input-label">Website</label>
              <input className="input-field" value={form.website} onChange={update("website")} />
            </div>
            <div>
              <label className="input-label">Address</label>
              <input className="input-field" value={form.address} onChange={update("address")} />
            </div>
          </section>
          <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">License and limits</h3>
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={form.status} onChange={update("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Access starts</label>
                <input type="date" className="input-field" value={form.accessStartsAt} onChange={update("accessStartsAt")} />
              </div>
              <div>
                <label className="input-label">Access ends</label>
                <input type="date" className="input-field" value={form.accessEndsAt} onChange={update("accessEndsAt")} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="px-3 py-1 rounded-lg text-xs border border-white/10" onClick={() => {
                const start = new Date();
                const end = new Date(start.getTime() + 30 * 86400000);
                setForm((prev) => ({
                  ...prev,
                  accessStartsAt: start.toISOString().slice(0, 10),
                  accessEndsAt: end.toISOString().slice(0, 10),
                }));
              }}>
                30 days
              </button>
              <button type="button" className="px-3 py-1 rounded-lg text-xs border border-white/10" onClick={() => setForm((prev) => ({ ...prev, accessStartsAt: "", accessEndsAt: "" }))}>
                No expiry
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Max users (empty = unlimited)</label>
                <input type="number" min="1" className="input-field" value={form.maxUsers} onChange={update("maxUsers")} />
              </div>
              <div>
                <label className="input-label">Max assets (empty = unlimited)</label>
                <input type="number" min="1" className="input-field" value={form.maxAssets} onChange={update("maxAssets")} />
              </div>
            </div>
            {view === "add" && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h3 className="text-sm font-semibold">First organization admin</h3>
                <div>
                  <label className="input-label">Full name</label>
                  <input className="input-field" value={form.adminFullName} onChange={update("adminFullName")} />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input className="input-field" value={form.adminEmail} onChange={update("adminEmail")} />
                </div>
                <div>
                  <label className="input-label">Password</label>
                  <input type="password" className="input-field" value={form.adminPassword} onChange={update("adminPassword")} />
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : view === "add" ? "Create organization" : "Save changes"}
            </button>
          </section>
        </form>
      ) : loading ? (
        <p className="text-muted">Loading organizations…</p>
      ) : (
        <DataGrid
          rowData={rows}
          columnDefs={columnDefs}
          rowHeight={72}
          context={{
            onEnter: enterOrg,
            onEdit: showEdit,
            onToggleStatus: toggleStatus,
            onSetAccessDays: setAccessDays,
            onClearAccess: clearAccess,
          }}
          getRowId={(params) => String(params.data?.OrganizationId ?? "")}
          emptyMessage="No organizations yet."
        />
      )}
    </div>
  );
}
