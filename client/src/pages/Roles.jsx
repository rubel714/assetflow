import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { showSnackbar } from "../lib/snackbar";
import { pickList } from "../lib/setupLists";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

const emptyForm = { name: "", permissions: [] };

function groupPermissions(catalog) {
  const groups = [];
  for (const item of catalog || []) {
    let group = groups.find((entry) => entry.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    return api.get("/roles").then((res) => {
      setRoles(pickList(res.data, "roles"));
      setCatalog(res.data.permissions || []);
    });
  }

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setForm(emptyForm);
  }

  const showEdit = useCallback(async (row) => {
    if (row.IsSystem) return;
    const ok = await confirmAction({
      title: "Do you want to edit this record?",
      message: `“${row.Name}” will be opened for editing.`,
      confirmLabel: "Yes",
      danger: false,
    });
    if (!ok) return;
    setView("edit");
    setEditing(row);
    setForm({
      name: row.Name || "",
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    });
  }, []);

  function togglePermission(key) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((item) => item !== key)
        : [...prev.permissions, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showSnackbar("Role name is required", { type: "validation" });
      return;
    }
    if (!form.permissions.length) {
      showSnackbar("Select at least one permission", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const isUpdate = view === "edit" && editing;
      const payload = { name: form.name.trim(), permissions: form.permissions };
      if (isUpdate) {
        await api.patch(`/roles/${encodeURIComponent(editing.RoleKey)}`, payload);
      } else {
        await api.post("/roles", payload);
      }
      await load();
      showList();
      showSnackbar(isUpdate ? "Data updated successfully" : "Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save role", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (row) => {
    if (row.IsSystem) return;
    const ok = await confirmAction({
      title: "Delete role?",
      message: `“${row.Name}” will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.delete(`/roles/${encodeURIComponent(row.RoleKey)}`);
      await load();
      showSnackbar("Data deleted successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not delete role", { type: "error" });
    }
  }, []);

  const columnDefs = useMemo(
    () => [
      {
        field: "Name",
        headerName: "Name",
        minWidth: 180,
        flex: 1.4,
        filter: "agTextColumnFilter",
      },
      {
        colId: "type",
        headerName: "Type",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (params) => (params.data?.IsSystem ? "Built-in" : "Custom"),
        filter: "agTextColumnFilter",
      },
      {
        colId: "permissions",
        headerName: "Permissions",
        minWidth: 140,
        flex: 0.8,
        valueGetter: (params) => {
          const count = params.data?.permissions?.length || 0;
          return count === 1 ? "1 permission" : `${count} permissions`;
        },
        filter: "agTextColumnFilter",
      },
      {
        colId: "actions",
        headerName: "Actions",
        sortable: false,
        filter: false,
        floatingFilter: false,
        minWidth: 110,
        maxWidth: 130,
        cellRenderer: GridActionsCell,
      },
    ],
    []
  );

  const groups = groupPermissions(catalog);
  const isForm = view === "add" || view === "edit";

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Add Role" : view === "edit" ? "Edit Role" : "Roles"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this role name and what it can do."
                : "Create an access level that can be assigned to users."
              : "Access levels that can be assigned to users."}
          </p>
        </div>
        {view === "list" && (
          <button
            type="button"
            onClick={showAdd}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
          >
            Add
          </button>
        )}
      </div>

      {isForm ? (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5 max-w-3xl">
          <div>
            <label className="input-label">Role name</label>
            <input
              className="input-field"
              placeholder="Auditor, Storekeeper, Viewer..."
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="space-y-3">
            <div>
              <p className="input-label">Permissions</p>
              <p className="text-[11px] text-muted">Choose what people with this role can open and change.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div key={group.name} className="rounded-xl border border-white/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted">{group.name}</p>
                  {group.items.map((item) => (
                    <label key={item.key} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={form.permissions.includes(item.key)}
                        onChange={() => togglePermission(item.key)}
                      />
                      <span className="min-w-0">
                        <span>{item.name}</span>
                        {item.note ? <span className="text-muted"> — {item.note}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : view === "edit" ? "Save changes" : "Save role"}
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
      ) : loading ? (
        <p className="text-muted">Loading roles…</p>
      ) : (
        <DataGrid
          rowData={roles}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.RoleKey ?? params.data?.id ?? "")}
          emptyMessage="No roles yet."
          context={{
            onEdit: showEdit,
            onDelete: handleDelete,
            canEdit: (row) => !row.IsSystem,
            canDelete: (row) => !row.IsSystem,
          }}
        />
      )}
    </div>
  );
}
