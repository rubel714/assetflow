import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import DataGrid from "../components/DataGrid";
import PageNotice from "../components/PageNotice";
import { showSnackbar } from "../lib/snackbar";

export default function MyAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    return api.get("/assets", { params: { page: 1, pageSize: 100 } }).then((res) => {
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
          params.data?.HandoverStatus === "pending" ? (
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
    []
  );

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
          getRowId={(params) => String(params.data?.AssetId ?? "")}
          emptyMessage="No assets assigned to you."
          enableColumnFilter={false}
        />
      )}
    </div>
  );
}
