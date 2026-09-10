import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import DataGrid from "../components/DataGrid";

function formatJson(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/audit-logs", { params: { page, pageSize } })
      .then((res) => {
        const rows = res.data.logs || res.data.items || [];
        setLogs(rows);
        setTotal(Number(res.data.total || 0));
      })
      .catch(() => {
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  const columnDefs = useMemo(
    () => [
      {
        field: "CreatedAt",
        headerName: "When",
        minWidth: 170,
        flex: 1,
        filter: false,
        floatingFilter: false,
      },
      {
        field: "UserName",
        headerName: "User",
        minWidth: 140,
        flex: 1,
        filter: false,
        floatingFilter: false,
        valueGetter: (params) => params.data?.UserName || "—",
      },
      {
        field: "Action",
        headerName: "Action",
        minWidth: 160,
        flex: 1,
        filter: false,
        floatingFilter: false,
      },
      {
        colId: "entity",
        headerName: "Entity",
        minWidth: 140,
        flex: 1,
        filter: false,
        floatingFilter: false,
        valueGetter: (params) =>
          [params.data?.EntityType, params.data?.EntityId].filter(Boolean).join(" "),
      },
      {
        field: "AfterJson",
        headerName: "After",
        minWidth: 220,
        flex: 2,
        filter: false,
        floatingFilter: false,
        valueGetter: (params) => formatJson(params.data?.AfterJson),
      },
    ],
    []
  );

  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
        <h2 className="text-2xl font-bold">Audit log</h2>
        <p className="text-muted text-sm mt-1">Create, edit, assign, transfer, return, and status changes.</p>
      </div>

      {loading ? (
        <p className="text-muted">Loading audit log…</p>
      ) : (
        <DataGrid
          rowData={logs}
          columnDefs={columnDefs}
          getRowId={(params) => String(params.data?.AuditId ?? params.data?.id ?? "")}
          emptyMessage="No audit events yet."
          enableColumnFilter={false}
          serverPagination
          page={page}
          pageSize={pageSize}
          total={total}
          rowOffset={(page - 1) * pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
