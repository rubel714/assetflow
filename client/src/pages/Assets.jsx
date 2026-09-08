import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { confirmAction } from "../lib/confirm";
import { getSavedUser, getToken, hasPermission } from "../lib/globalfunction";
import DataGrid from "../components/DataGrid";
import GridActionsCell from "../components/GridActionsCell";
import AssetForm from "../components/AssetForm";
import ImageLightbox from "../components/ImageLightbox";
import { assetImageSrc } from "../lib/assetImage";

const emptyForm = {
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  purchaseCost: "",
  locationId: "",
  departmentId: "",
  projectId: "",
  supplierId: "",
  manufacturerId: "",
  countryOfOriginId: "",
  receiveDate: "",
  lastWarrantyDate: "",
  maintenanceScheduleId: "",
  remarks: "",
  status: "Available",
};

function dateInput(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function formFromAsset(a) {
  return {
    name: a.Name || "",
    description: a.Description || "",
    categoryId: a.CategoryId || "",
    brand: a.Brand || "",
    model: a.Model || "",
    serialNumber: a.SerialNumber || "",
    purchaseDate: dateInput(a.PurchaseDate),
    purchaseCost: a.PurchaseCost ?? "",
    locationId: a.LocationId || "",
    departmentId: a.DepartmentId || "",
    projectId: a.ProjectId || "",
    supplierId: a.SupplierId || "",
    manufacturerId: a.ManufacturerId || "",
    countryOfOriginId: a.CountryOfOriginId || "",
    receiveDate: dateInput(a.ReceiveDate),
    lastWarrantyDate: dateInput(a.LastWarrantyDate),
    maintenanceScheduleId: a.MaintenanceScheduleId || "",
    remarks: a.Remarks || "",
    status: a.Status || "Available",
  };
}

function ImageCell(params) {
  const row = params?.data;
  const src = assetImageSrc(row?.ImageUrl);
  if (!src) {
    return <span className="text-muted text-xs">—</span>;
  }
  return (
    <button
      type="button"
      className="block h-10 w-10 rounded-lg overflow-hidden border border-white/10 my-1 cursor-pointer hover:ring-2 hover:ring-cyan-400/70"
      title="View image"
      aria-label={`View image for ${row?.Name || row?.AssetTag || "asset"}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        params?.context?.onPreviewImage?.({
          src,
          alt: row?.Name || row?.AssetTag || "Asset image",
        });
      }}
    >
      <img src={src} alt="" className="h-full w-full object-cover pointer-events-none" />
    </button>
  );
}

function TagCell(params) {
  const row = params?.data;
  if (!row?.AssetId) return params.value || "";
  return (
    <Link to={`/assets/${row.AssetId}`} className="text-accent font-medium">
      {row.AssetTag}
    </Link>
  );
}

export default function Assets() {
  const user = getSavedUser();
  const navigate = useNavigate();
  const { id } = useParams();
  const addMatch = useMatch("/assets/new");
  const editMatch = useMatch("/assets/:id/edit");
  const canManage = hasPermission(user, "assets.manage");
  const canExport = hasPermission(user, "reports.export");

  const [assets, setAssets] = useState([]);
  const [lookups, setLookups] = useState({
    categories: [],
    locations: [],
    departments: [],
    projects: [],
    suppliers: [],
    manufacturers: [],
    countries: [],
    maintenanceSchedules: [],
  });
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  const view = addMatch ? "add" : editMatch ? "edit" : "list";
  const isForm = view === "add" || view === "edit";

  function loadList() {
    return api.get("/assets", { params: { page: 1, pageSize: 1000 } }).then((res) => {
      setAssets(res.data.assets || []);
    });
  }

  useEffect(() => {
    api
      .get("/lookups")
      .then((res) =>
        setLookups({
          categories: res.data.categories || [],
          locations: res.data.locations || [],
          departments: res.data.departments || [],
          projects: res.data.projects || [],
          suppliers: res.data.suppliers || [],
          manufacturers: res.data.manufacturers || [],
          countries: res.data.countries || [],
          maintenanceSchedules: res.data.maintenanceSchedules || [],
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "list") return;
    setLoading(true);
    loadList()
      .then(() => setError(""))
      .catch((err) => setError(err.response?.data?.message || "Could not load assets"))
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => {
    if (view === "add") {
      setEditing(null);
      setForm(emptyForm);
      setImageFile(null);
      setImagePreview("");
      setRemoveImage(false);
      setError("");
      return;
    }
    if (view === "edit" && id) {
      setError("");
      api
        .get(`/assets/${id}`)
        .then((res) => {
          const a = res.data.asset;
          setEditing(a);
          setForm(formFromAsset(a));
          setImageFile(null);
          setRemoveImage(false);
          setImagePreview(assetImageSrc(a.ImageUrl));
        })
        .catch((err) => setError(err.response?.data?.message || "Could not load asset"));
    }
  }, [view, id]);

  function showList() {
    setError("");
    navigate("/assets");
  }

  function showAdd() {
    setError("");
    navigate("/assets/new");
  }

  const showEdit = useCallback(
    async (row) => {
      const ok = await confirmAction({
        title: "Do you want to edit this record?",
        message: `“${row.Name}” will be opened for editing.`,
        confirmLabel: "Yes",
        danger: false,
      });
      if (!ok) return;
      navigate(`/assets/${row.AssetId}/edit`);
    },
    [navigate]
  );

  const showPreview = useCallback((image) => {
    setPreviewImage(image);
  }, []);

  const gridContext = useMemo(
    () => ({
      onPreviewImage: showPreview,
      ...(canManage ? { onEdit: showEdit } : {}),
    }),
    [canManage, showEdit, showPreview]
  );

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
    if (!form.name.trim()) {
      setError("Asset name is required");
      return;
    }
    setSaving(true);
    setError("");
    const data = new FormData();
    const fields = {
      ...form,
      categoryId: form.categoryId || "",
      locationId: form.locationId || "",
      departmentId: form.departmentId || "",
      projectId: form.projectId || "",
      supplierId: form.supplierId || "",
      manufacturerId: form.manufacturerId || "",
      countryOfOriginId: form.countryOfOriginId || "",
      maintenanceScheduleId: form.maintenanceScheduleId || "",
      purchaseCost: form.purchaseCost === "" ? "" : form.purchaseCost,
      receiveDate: form.receiveDate || "",
      lastWarrantyDate: form.lastWarrantyDate || "",
    };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) data.append(key, value);
    });
    if (imageFile) data.append("image", imageFile);
    if (removeImage && !imageFile) data.append("removeImage", "true");
    try {
      if (view === "edit" && (editing?.AssetId || id)) {
        await api.patch(`/assets/${editing?.AssetId || id}`, data);
      } else {
        await api.post("/assets", data);
      }
      await loadList();
      showList();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save asset");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const token = getToken();
    fetch(`${import.meta.env.VITE_API_URL}/assets/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "asset-register.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Could not export CSV"));
  }

  const columnDefs = useMemo(() => {
    const cols = [
      {
        field: "ImageUrl",
        headerName: "Image",
        minWidth: 88,
        maxWidth: 100,
        flex: 0,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: ImageCell,
      },
      {
        field: "AssetTag",
        headerName: "Tag",
        minWidth: 120,
        flex: 1,
        filter: "agTextColumnFilter",
        cellRenderer: TagCell,
      },
      {
        field: "Name",
        headerName: "Name",
        minWidth: 180,
        flex: 2,
        filter: "agTextColumnFilter",
      },
      {
        field: "CategoryName",
        headerName: "Category",
        minWidth: 140,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "Status",
        headerName: "Status",
        minWidth: 120,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "CustodianName",
        headerName: "Custodian",
        minWidth: 150,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        field: "LocationName",
        headerName: "Location",
        minWidth: 150,
        flex: 1,
        filter: "agTextColumnFilter",
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

  return (
    <div className={`animate-enter space-y-6 ${isForm ? "w-full" : ""}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Register</p>
          <h2 className="text-2xl font-bold">
            {view === "add" ? "Add Asset" : view === "edit" ? "Edit Asset" : "Assets"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {isForm
              ? view === "edit"
                ? "Update register details."
                : "Register a new asset. A tag is generated automatically."
              : user?.Role === "employee"
                ? "Assets currently assigned to you."
                : "Search and manage the asset register."}
          </p>
        </div>
        {view === "list" && (
          <div className="flex gap-2">
            {canExport && (
              <button
                type="button"
                onClick={exportCsv}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
              >
                Export CSV
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={showAdd}
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
              >
                Add
              </button>
            )}
          </div>
        )}
        {isForm && (
          <button
            type="button"
            onClick={showList}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
          >
            Back to assets
          </button>
        )}
      </div>

      {view === "list" && error && <p className="text-sm text-red-400">{error}</p>}

      {isForm ? (
        <AssetForm
          form={form}
          lookups={lookups}
          isEdit={view === "edit"}
          saving={saving}
          error={error}
          imagePreview={imagePreview}
          onChange={updateField}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onSubmit={handleSubmit}
          onCancel={showList}
        />
      ) : loading ? (
        <p className="text-muted">Loading assets…</p>
      ) : (
        <DataGrid
          rowData={assets}
          columnDefs={columnDefs}
          rowHeight={52}
          getRowId={(params) => String(params.data?.AssetId ?? params.data?.id ?? "")}
          emptyMessage="No assets yet."
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
