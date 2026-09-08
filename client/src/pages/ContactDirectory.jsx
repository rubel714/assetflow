import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { showSnackbar } from "../lib/snackbar";
import { pickList } from "../lib/setupLists";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";

const emptyForm = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  website: "",
};

function formFromRow(row) {
  return {
    name: row.Name || "",
    contactName: row.ContactName || "",
    email: row.Email || "",
    phone: row.Phone || "",
    address: row.Address || "",
    website: row.Website || "",
  };
}

function payloadFromForm(form) {
  return {
    name: form.name.trim(),
    contactName: form.contactName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    website: form.website.trim(),
  };
}

export default function ContactDirectory({ config }) {
  const { title, singular, path, idKey, listKey, hint, addHint, editHint } = config;
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    return api.get(path).then((res) => setRows(pickList(res.data, listKey)));
  }

  useEffect(() => {
    load().catch((err) =>
      showSnackbar(err.response?.data?.message || `Could not load ${title.toLowerCase()}`, {
        type: "error",
      })
    );
  }, [path, title]);

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
    const ok = await confirmAction({
      title: "Do you want to edit this record?",
      message: `“${row.Name}” will be opened for editing.`,
      confirmLabel: "Yes",
      danger: false,
    });
    if (!ok) return;
    setView("edit");
    setEditing(row);
    setForm(formFromRow(row));
  }, []);

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showSnackbar(`${singular} name is required`, { type: "error" });
      return;
    }
    setSaving(true);
    try {
      const isUpdate = view === "edit" && editing;
      const payload = payloadFromForm(form);
      if (isUpdate) {
        await api.patch(`${path}/${editing[idKey]}`, payload);
      } else {
        await api.post(path, payload);
      }
      await load();
      showList();
      showSnackbar(isUpdate ? "Data updated successfully" : "Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || `Could not save ${singular}`, { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(
    async (row) => {
      const ok = await confirmAction({
        title: `Delete ${singular}?`,
        message: `“${row.Name}” will be removed. This cannot be undone.`,
        confirmLabel: "Delete",
      });
      if (!ok) return;
      try {
        await api.delete(`${path}/${row[idKey]}`);
        await load();
        showSnackbar("Data deleted successfully");
      } catch (err) {
        showSnackbar(err.response?.data?.message || `Could not delete ${singular}`, {
          type: "error",
        });
      }
    },
    [idKey, path, singular]
  );

  const columnDefs = useMemo(
    () => [
      {
        field: "Name",
        headerName: "Name",
        minWidth: 160,
        flex: 1.4,
        filter: "agTextColumnFilter",
      },
      {
        field: "ContactName",
        headerName: "Contact",
        minWidth: 140,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "Email",
        headerName: "Email",
        minWidth: 180,
        flex: 1.2,
        filter: "agTextColumnFilter",
      },
      {
        field: "Phone",
        headerName: "Phone",
        minWidth: 130,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "Address",
        headerName: "Address",
        minWidth: 200,
        flex: 1.6,
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
            {view === "add" ? `Add ${singular}` : view === "edit" ? `Edit ${singular}` : title}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm ? (view === "edit" ? editHint : addHint) : hint}
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
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 max-w-2xl">
          <div>
            <label className="input-label">{singular} name</label>
            <input
              className="input-field"
              placeholder={`Name of the ${singular.toLowerCase()}`}
              value={form.name}
              onChange={updateField("name")}
              autoFocus
            />
          </div>
          <div>
            <label className="input-label">Contact name</label>
            <input
              className="input-field"
              placeholder="Primary contact person"
              value={form.contactName}
              onChange={updateField("contactName")}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={updateField("email")}
              />
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input
                className="input-field"
                placeholder="+880 ..."
                value={form.phone}
                onChange={updateField("phone")}
              />
            </div>
          </div>
          <div>
            <label className="input-label">Address</label>
            <textarea
              className="input-field min-h-[88px]"
              placeholder="Street, city, country"
              value={form.address}
              onChange={updateField("address")}
            />
          </div>
          <div>
            <label className="input-label">Website</label>
            <input
              className="input-field"
              placeholder="https://"
              value={form.website}
              onChange={updateField("website")}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : view === "edit" ? "Save changes" : `Save ${singular.toLowerCase()}`}
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
          getRowId={(params) => String(params.data?.[idKey] ?? params.data?.id ?? "")}
          emptyMessage={`No ${title.toLowerCase()} yet.`}
          context={{ onEdit: showEdit, onDelete: handleDelete }}
        />
      )}
    </div>
  );
}
