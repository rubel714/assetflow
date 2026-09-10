import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { showSnackbar } from "../lib/snackbar";
import { pickList } from "../lib/setupLists";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    return api.get("/projects").then((res) => setProjects(pickList(res.data, "projects")));
  }

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showList() {
    setView("list");
    setEditing(null);
    setName("");
    setStatus("active");
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setName("");
    setStatus("active");
  }

  const showEdit = useCallback(async (row) => {
    const ok = await confirmAction({
      title: "Do you want to edit this record?",
      message: `“${row.Name}” will be opened for editing.`,
      confirmLabel: "Yes",
      danger: false,
    });
    if (!ok) return;
    setView("edit");
    setEditing(row);
    setName(row.Name || "");
    setStatus(row.Status === "inactive" ? "inactive" : "active");
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      showSnackbar("Project name is required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const isUpdate = view === "edit" && editing;
      if (isUpdate) {
        await api.patch(`/projects/${editing.ProjectId}`, {
          name: name.trim(),
          status,
        });
      } else {
        await api.post("/projects", { name: name.trim() });
      }
      await load();
      showList();
      showSnackbar(isUpdate ? "Data updated successfully" : "Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save project", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (row) => {
    const ok = await confirmAction({
      title: "Delete project?",
      message: `“${row.Name}” will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${row.ProjectId}`);
      await load();
      showSnackbar("Data deleted successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not delete project", { type: "error" });
    }
  }, []);

  const columnDefs = useMemo(
    () => [
      {
        field: "Name",
        headerName: "Name",
        minWidth: 200,
        flex: 2,
        filter: "agTextColumnFilter",
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

  const isForm = view === "add" || view === "edit";

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Add Project" : view === "edit" ? "Edit Project" : "Projects"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this project."
                : "Create a new project."
              : "Projects and sites that assets can be linked to."}
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
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 max-w-xl">
          <div>
            <label className="input-label">Project name</label>
            <input
              className="input-field"
              placeholder="Site A, Expansion 2026..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {view === "edit" && (
            <div>
              <label className="input-label" htmlFor="project-status">
                Status
              </label>
              <select
                id="project-status"
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
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
              {saving ? "Saving…" : view === "edit" ? "Save changes" : "Save project"}
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
        <p className="text-muted">Loading projects…</p>
      ) : (
        <DataGrid
          rowData={projects}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.ProjectId ?? params.data?.id ?? "")}
          emptyMessage="No projects yet."
          context={{ onEdit: showEdit, onDelete: handleDelete }}
        />
      )}
    </div>
  );
}
