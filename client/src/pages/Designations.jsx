import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { showSnackbar } from "../lib/snackbar";
import { pickList } from "../lib/setupLists";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

export default function Designations() {
  const [designations, setDesignations] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    return api.get("/designations").then((res) => setDesignations(pickList(res.data, "designations")));
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
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setName("");
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
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      showSnackbar("Designation name is required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const isUpdate = view === "edit" && editing;
      if (isUpdate) {
        await api.patch(`/designations/${editing.DesignationId}`, { name: name.trim() });
      } else {
        await api.post("/designations", { name: name.trim() });
      }
      await load();
      showList();
      showSnackbar(isUpdate ? "Data updated successfully" : "Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save designation", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (row) => {
    const ok = await confirmAction({
      title: "Delete designation?",
      message: `“${row.Name}” will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.delete(`/designations/${row.DesignationId}`);
      await load();
      showSnackbar("Data deleted successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not delete designation", { type: "error" });
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
            {view === "add" ? "Add Designation" : view === "edit" ? "Edit Designation" : "Designations"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this designation name."
                : "Create a job title used when adding users."
              : "Job titles that can be assigned to users."}
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
            <label className="input-label">Designation name</label>
            <input
              className="input-field"
              placeholder="Manager, Engineer, Officer..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : view === "edit" ? "Save changes" : "Save designation"}
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
        <p className="text-muted">Loading designations…</p>
      ) : (
        <DataGrid
          rowData={designations}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.DesignationId ?? params.data?.id ?? "")}
          emptyMessage="No designations yet."
          context={{ onEdit: showEdit, onDelete: handleDelete }}
        />
      )}
    </div>
  );
}
