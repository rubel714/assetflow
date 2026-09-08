import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { getSavedUser, hasPermission, roleLabel } from "../lib/globalfunction";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

const emptyForm = { username: "", password: "", fullName: "", role: "employee", status: "active" };

export default function Users() {
  const current = getSavedUser();
  const canManage = hasPermission(current, "users.manage");
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    return api.get("/users").then((res) => setRows(res.data.users || []));
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || "Could not load users"));
  }, []);

  function showList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
    setError("");
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setForm(emptyForm);
    setError("");
  }

  const showEdit = useCallback(async (row) => {
    const ok = await confirmAction({
      title: "Do you want to edit this record?",
      message: `“${row.FullName}” will be opened for editing.`,
      confirmLabel: "Yes",
      danger: false,
    });
    if (!ok) return;
    setView("edit");
    setEditing(row);
    setForm({
      username: row.Username || "",
      password: "",
      fullName: row.FullName || "",
      role: row.Role || "employee",
      status: row.Status === "inactive" ? "inactive" : "active",
    });
    setError("");
  }, []);

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (view === "add") {
      if (!form.username.trim()) {
        setError("Username is required");
        return;
      }
      if (!form.password) {
        setError("Password is required");
        return;
      }
    }
    if (form.password && form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (view === "edit" && editing) {
        const payload = {
          fullName: form.fullName.trim(),
          role: form.role,
          status: form.status,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.UserId}`, payload);
      } else {
        await api.post("/users", {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
        });
      }
      await load();
      showList();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save user");
    } finally {
      setSaving(false);
    }
  }

  const columnDefs = useMemo(() => {
    const cols = [
      {
        field: "FullName",
        headerName: "Name",
        minWidth: 180,
        flex: 2,
        filter: "agTextColumnFilter",
      },
      {
        field: "Username",
        headerName: "Username",
        minWidth: 140,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "Role",
        headerName: "Role",
        minWidth: 160,
        flex: 1,
        filter: "agTextColumnFilter",
        valueFormatter: (params) => roleLabel(params.value),
        filterValueGetter: (params) => roleLabel(params.data?.Role),
      },
      {
        field: "Status",
        headerName: "Status",
        minWidth: 120,
        flex: 1,
        filter: "agTextColumnFilter",
        valueFormatter: (params) =>
          params.value ? String(params.value).charAt(0).toUpperCase() + String(params.value).slice(1) : "",
      },
    ];
    if (canManage) {
      cols.push({
        colId: "actions",
        headerName: "Actions",
        sortable: false,
        filter: false,
        floatingFilter: false,
        minWidth: 80,
        maxWidth: 100,
        cellRenderer: GridActionsCell,
      });
    }
    return cols;
  }, [canManage]);

  const isForm = view === "add" || view === "edit";

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Add User" : view === "edit" ? "Edit User" : "Users"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this user’s details."
                : "Create a person who can sign in to this organization."
              : "People who can sign in to this organization."}
          </p>
        </div>
        {view === "list" && canManage && (
          <button
            type="button"
            onClick={showAdd}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
          >
            Add
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {isForm ? (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 max-w-xl">
          <div>
            <label className="input-label">Full name</label>
            <input
              className="input-field"
              value={form.fullName}
              onChange={updateField("fullName")}
              placeholder="Jane Smith"
              autoFocus
            />
          </div>
          <div>
            <label className="input-label">Username</label>
            <input
              className="input-field"
              value={form.username}
              onChange={updateField("username")}
              placeholder="jane"
              disabled={view === "edit"}
            />
          </div>
          <div>
            <label className="input-label">{view === "edit" ? "New password (optional)" : "Password"}</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={updateField("password")}
              placeholder={view === "edit" ? "Leave blank to keep current" : ""}
            />
          </div>
          <div>
            <label className="input-label">Role</label>
            <select className="input-field" value={form.role} onChange={updateField("role")}>
              <option value="employee">Employee</option>
              <option value="asset_manager">Asset Manager</option>
              <option value="organization_admin">Organization Admin</option>
            </select>
          </div>
          {view === "edit" && (
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={form.status} onChange={updateField("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : view === "edit" ? "Save changes" : "Save user"}
            </button>
            <button
              type="button"
              onClick={showList}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <DataGrid
          rowData={rows}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.UserId ?? params.data?.id ?? "")}
          emptyMessage="No users yet."
          context={canManage ? { onEdit: showEdit } : {}}
        />
      )}
    </div>
  );
}
