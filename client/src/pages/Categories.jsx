import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { pickList } from "../lib/setupLists";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    return api.get("/categories").then((res) => setCategories(pickList(res.data, "categories")));
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || "Could not load categories"));
  }, []);

  function showList() {
    setView("list");
    setEditing(null);
    setName("");
    setError("");
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setName("");
    setError("");
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
    setError("");
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (view === "edit" && editing) {
        await api.patch(`/categories/${editing.CategoryId}`, { name: name.trim() });
      } else {
        await api.post("/categories", { name: name.trim() });
      }
      await load();
      showList();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (row) => {
    const ok = await confirmAction({
      title: "Delete category?",
      message: `“${row.Name}” will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.delete(`/categories/${row.CategoryId}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete category");
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
            {view === "add" ? "Add Category" : view === "edit" ? "Edit Category" : "Categories"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this category name."
                : "Create a new category."
              : "Types used to group assets in the register."}
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {isForm ? (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 max-w-xl">
          <div>
            <label className="input-label">Category name</label>
            <input
              className="input-field"
              placeholder="Laptop, Vehicle, Furniture..."
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
              {saving ? "Saving…" : view === "edit" ? "Save changes" : "Save category"}
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
          rowData={categories}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.CategoryId ?? params.data?.id ?? "")}
          emptyMessage="No categories yet."
          context={{ onEdit: showEdit, onDelete: handleDelete }}
        />
      )}
    </div>
  );
}
