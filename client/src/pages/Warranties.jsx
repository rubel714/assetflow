import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import DataGrid from "../components/DataGrid";
import PageNotice from "../components/PageNotice";

export default function Warranties() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/warranties", { params: { days: 30 } })
      .then((res) => setRows(res.data.warranties || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

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
      {
        field: "LastWarrantyDate",
        headerName: "Warranty ends",
        minWidth: 140,
        valueGetter: (params) =>
          params.data?.LastWarrantyDate ? String(params.data.LastWarrantyDate).slice(0, 10) : "—",
      },
      {
        field: "WarrantyState",
        headerName: "State",
        minWidth: 120,
        valueGetter: (params) =>
          params.data?.WarrantyState === "expired" ? "Expired" : "Expiring soon",
      },
      { field: "CustodianName", headerName: "Custodian", minWidth: 140 },
    ],
    []
  );

  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Coverage</p>
        <h2 className="text-2xl font-bold">Warranties</h2>
        <p className="text-muted text-sm mt-1">Expired or expiring within 30 days.</p>
      </div>
      {loading ? (
        <PageNotice loading loadingText="Loading warranties…" />
      ) : (
        <DataGrid
          rowData={rows}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.AssetId ?? "")}
          emptyMessage="No warranties due in this window."
          enableColumnFilter={false}
        />
      )}
    </div>
  );
}
