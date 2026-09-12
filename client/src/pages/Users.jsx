import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { getSavedUser, hasPermission, patchSavedUser, roleLabel } from "../lib/globalfunction";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";
import ImageLightbox from "../components/ImageLightbox";
import UserForm from "../components/UserForm";
import { assetImageSrc } from "../lib/assetImage";
import { showSnackbar } from "../lib/snackbar";

const emptyForm = {
  password: "",
  confirmPassword: "",
  fullName: "",
  designationId: "",
  phone: "",
  email: "",
  address: "",
  role: "employee",
  status: "active",
};

function ImageCell(params) {
  const row = params?.data;
  const src = assetImageSrc(row?.ImageUrl);
  if (!src) {
    return <span className="text-muted text-xs">—</span>;
  }
  return (
    <button
      type="button"
      className="block h-10 w-10 rounded-full overflow-hidden border border-white/10 my-1 cursor-pointer hover:ring-2 hover:ring-cyan-400/70"
      title="View photo"
      aria-label={`View photo for ${row?.FullName || row?.Email || "user"}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        params?.context?.onPreviewImage?.({
          src,
          alt: row?.FullName || row?.Email || "User photo",
        });
      }}
    >
      <img src={src} alt="" className="h-full w-full object-cover pointer-events-none" />
    </button>
  );
}

export default function Users() {
  const current = getSavedUser();
  const canManage = hasPermission(current, "users.manage");
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ designations: [] });
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function resetImage() {
    setImageFile(null);
    setImagePreview("");
    setRemoveImage(false);
  }

  function load() {
    return api.get("/users").then((res) => setRows(res.data.users || []));
  }

  function loadLookups() {
    return api.get("/lookups").then((res) => {
      setLookups({ designations: res.data.designations || [] });
    });
  }

  useEffect(() => {
    loadLookups().catch(() => {});
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
    resetImage();
  }

  function showAdd() {
    setView("add");
    setEditing(null);
    setForm(emptyForm);
    resetImage();
    loadLookups().catch(() => {});
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
      password: "",
      confirmPassword: "",
      fullName: row.FullName || "",
      designationId: row.DesignationId || "",
      phone: row.Phone || "",
      email: row.Email || "",
      address: row.Address || "",
      role: row.Role || "employee",
      status: row.Status === "inactive" ? "inactive" : "active",
    });
    setImageFile(null);
    setRemoveImage(false);
    setImagePreview(assetImageSrc(row.ImageUrl));
    loadLookups().catch(() => {});
  }, []);

  const showPreview = useCallback((image) => {
    setPreviewImage(image);
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleImageSelect(file) {
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleImageRemove() {
    setImageFile(null);
    setRemoveImage(true);
    setImagePreview("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      showSnackbar("Full name is required", { type: "validation" });
      return;
    }
    if (!form.email.trim()) {
      showSnackbar("Email is required", { type: "validation" });
      return;
    }
    if (view === "add") {
      if (!form.password) {
        showSnackbar("Password is required", { type: "validation" });
        return;
      }
      if (!form.confirmPassword) {
        showSnackbar("Confirm password is required", { type: "validation" });
        return;
      }
    }
    if (form.password || form.confirmPassword) {
      if (form.password !== form.confirmPassword) {
        showSnackbar("Password and confirm password must match", { type: "validation" });
        return;
      }
      if (form.password.length < 6) {
        showSnackbar("Password must be at least 6 characters", { type: "validation" });
        return;
      }
    }
    setSaving(true);
    const data = new FormData();
    data.append("fullName", form.fullName.trim());
    data.append("designationId", form.designationId);
    data.append("phone", form.phone.trim());
    data.append("email", form.email.trim());
    data.append("address", form.address.trim());
    data.append("role", form.role);
    if (view === "add") {
      data.append("password", form.password);
      data.append("confirmPassword", form.confirmPassword);
    } else {
      data.append("status", form.status);
      if (form.password) {
        data.append("password", form.password);
        data.append("confirmPassword", form.confirmPassword);
      }
    }
    if (imageFile) data.append("image", imageFile);
    if (removeImage && !imageFile) data.append("removeImage", "true");
    try {
      let saved;
      if (view === "edit" && editing) {
        saved = await api.patch(`/users/${editing.UserId}`, data);
      } else {
        saved = await api.post("/users", data);
      }
      if (saved.data.user?.UserId === current?.UserId) {
        patchSavedUser({
          FullName: saved.data.user.FullName,
          Email: saved.data.user.Email,
          ImageUrl: saved.data.user.ImageUrl,
        });
      }
      await load();
      showList();
      showSnackbar(view === "edit" ? "Data updated successfully" : "Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save user", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const columnDefs = useMemo(() => {
    const cols = [
      {
        field: "ImageUrl",
        headerName: "Photo",
        minWidth: 88,
        maxWidth: 100,
        flex: 0,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: ImageCell,
      },
      {
        field: "FullName",
        headerName: "Name",
        minWidth: 180,
        flex: 2,
        filter: "agTextColumnFilter",
      },
      {
        field: "Email",
        headerName: "Email",
        minWidth: 200,
        flex: 1.2,
        filter: "agTextColumnFilter",
      },
      {
        field: "Designation",
        headerName: "Designation",
        minWidth: 150,
        flex: 1,
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
        flex: 1.4,
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

  const gridContext = useMemo(
    () => ({
      onPreviewImage: showPreview,
      ...(canManage ? { onEdit: showEdit } : {}),
    }),
    [canManage, showEdit, showPreview]
  );

  const isForm = view === "add" || view === "edit";

  return (
    <div className={`animate-enter space-y-6 ${isForm ? "w-full" : ""}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Add User" : view === "edit" ? "Edit User" : "Users"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update this user’s details and photo."
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
        {isForm && (
          <button
            type="button"
            onClick={showList}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
          >
            Back to users
          </button>
        )}
      </div>

      {isForm ? (
        <UserForm
          form={form}
          lookups={lookups}
          isEdit={view === "edit"}
          saving={saving}
          imagePreview={imagePreview}
          onChange={updateField}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onSubmit={handleSubmit}
          onCancel={showList}
        />
      ) : loading ? (
        <p className="text-muted">Loading users…</p>
      ) : (
        <DataGrid
          rowData={rows}
          columnDefs={columnDefs}
          rowHeight={52}
          getRowId={(params) => String(params.data?.UserId ?? params.data?.id ?? "")}
          emptyMessage="No users yet."
          context={gridContext}
        />
      )}
      <ImageLightbox
        src={previewImage?.src}
        alt={previewImage?.alt}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
