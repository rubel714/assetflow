import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import DataGrid from "../components/DataGrid";
import ImageLightbox from "../components/ImageLightbox";
import PageNotice from "../components/PageNotice";
import { getSavedUser } from "../lib/globalfunction";
import { assetImageSrc } from "../lib/assetImage";
import { showSnackbar } from "../lib/snackbar";

function formatAssignedDate(value) {
  if (!value) return "—";
  const text = String(value).replace("T", " ");
  return text.slice(0, 16);
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

export default function MyAssets() {
  const user = getSavedUser();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  function load() {
    return api.get("/assets", { params: { page: 1, pageSize: 100, mine: 1 } }).then((res) => {
      setAssets(res.data.assets || []);
    });
  }

  useEffect(() => {
    load()
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, []);

  async function accept(row) {
    try {
      await api.post(`/assets/${row.AssetId}/accept`);
      await load();
      showSnackbar("Handover accepted");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not accept handover", { type: "error" });
    }
  }

  const columnDefs = useMemo(
    () => [
      {
        field: "ImageUrl",
        headerName: "Image",
        minWidth: 88,
        maxWidth: 100,
        sortable: false,
        cellRenderer: ImageCell,
      },
      {
        field: "AssetTag",
        headerName: "Tag",
        minWidth: 120,
        cellRenderer: (params) =>
          params.data?.AssetId ? (
            <Link to={`/assets/${params.data.AssetId}`} className="text-accent font-medium">
              {params.data.AssetTag}
            </Link>
          ) : (
            params.value
          ),
      },
      { field: "Name", headerName: "Name", minWidth: 180, flex: 2 },
      { field: "Status", headerName: "Status", minWidth: 120 },
      {
        field: "AssignedAt",
        headerName: "Assigned date",
        minWidth: 150,
        valueGetter: (params) => formatAssignedDate(params.data?.AssignedAt),
      },
      {
        field: "AssignedByName",
        headerName: "Assigned by",
        minWidth: 160,
        valueGetter: (params) => params.data?.AssignedByName || "—",
      },
      {
        colId: "handover",
        headerName: "Handover",
        minWidth: 140,
        valueGetter: (params) =>
          params.data?.HandoverStatus === "pending" ? "Pending acceptance" : "Accepted",
      },
      {
        colId: "actions",
        headerName: "",
        minWidth: 140,
        sortable: false,
        cellRenderer: (params) =>
          params.data?.HandoverStatus === "pending" &&
          Number(params.data?.CustodianId) === Number(user?.UserId) ? (
            <button
              type="button"
              className="px-3 py-1 rounded-lg bg-cyan-600 text-white text-xs font-semibold"
              onClick={() => accept(params.data)}
            >
              Accept
            </button>
          ) : (
            <Link to={`/assets/${params.data.AssetId}`} className="text-accent text-xs font-semibold">
              View
            </Link>
          ),
      },
    ],
    [user?.UserId]
  );

  const showPreview = useCallback((image) => {
    setPreviewImage(image);
  }, []);

  const gridContext = useMemo(() => ({ onPreviewImage: showPreview }), [showPreview]);

  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Custody</p>
        <h2 className="text-2xl font-bold">My Assets</h2>
        <p className="text-muted text-sm mt-1">Assets assigned to you. Accept new handovers here.</p>
      </div>
      {loading ? (
        <PageNotice loading loadingText="Loading your assets…" />
      ) : (
        <DataGrid
          rowData={assets}
          columnDefs={columnDefs}
          rowHeight={52}
          getRowId={(params) => String(params.data?.AssetId ?? "")}
          emptyMessage="No assets assigned to you."
          context={gridContext}
          enableColumnFilter={false}
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
