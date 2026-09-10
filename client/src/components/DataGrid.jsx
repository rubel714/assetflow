import React, { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  backgroundColor: "transparent",
  foregroundColor: "var(--text-main)",
  headerBackgroundColor: "var(--bg-app)",
  headerTextColor: "var(--text-muted)",
  oddRowBackgroundColor: "transparent",
  rowHoverColor: "rgba(34, 211, 238, 0.08)",
  selectedRowBackgroundColor: "rgba(34, 211, 238, 0.12)",
  borderColor: "var(--glass-border)",
  wrapperBorder: false,
  headerRowBorder: true,
  rowBorder: true,
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 600,
  spacing: 8,
  accentColor: "var(--text-accent)",
  menuBackgroundColor: "var(--bg-app)",
  chromeBackgroundColor: "var(--bg-app)",
  cardShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
});

export default function DataGrid({
  rowData,
  columnDefs,
  getRowId,
  emptyMessage = "No rows to show.",
  onCellClicked,
  context,
  rowHeight,
  enableColumnFilter = true,
  serverPagination = false,
  page = 1,
  pageSize: pageSizeProp = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  rowOffset = 0,
}) {
  const gridRef = useRef(null);
  const [popupParent, setPopupParent] = useState(null);
  const [pageSize, setPageSize] = useState(pageSizeProp);
  const [pageInfo, setPageInfo] = useState({
    current: 1,
    total: 1,
    rowCount: 0,
  });

  function refreshPageInfo() {
    const api = gridRef.current?.api;
    if (!api) return;
    setPageInfo({
      current: api.paginationGetCurrentPage() + 1,
      total: Math.max(1, api.paginationGetTotalPages()),
      rowCount: api.paginationGetRowCount(),
    });
  }

  function changePageSize(next) {
    const size = Number(next);
    if (serverPagination) {
      onPageSizeChange?.(size);
      return;
    }
    setPageSize(size);
    gridRef.current?.api?.setGridOption("paginationPageSize", size);
    gridRef.current?.api?.paginationGoToFirstPage();
    refreshPageInfo();
  }
  const serialColumn = useMemo(
    () => ({
      colId: "_serial",
      headerName: "#",
      width: 72,
      maxWidth: 80,
      minWidth: 60,
      flex: 0,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      valueGetter: (params) => {
        const node = params.node;
        const api = params.api;
        if (!node || !api) return "";
        let serial = "";
        api.forEachNodeAfterFilterAndSort((n, index) => {
          if (n === node || (n.id != null && n.id === node.id)) {
            serial = index + 1 + rowOffset;
          }
        });
        return serial;
      },
    }),
    [rowOffset]
  );

  const mergedColumnDefs = useMemo(
    () => [serialColumn, ...(columnDefs || [])],
    [serialColumn, columnDefs]
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
      filter: enableColumnFilter ? "agTextColumnFilter" : false,
      floatingFilter: enableColumnFilter,
      filterParams: {
        buttons: ["reset"],
        debounceMs: 200,
        maxNumConditions: 1,
      },
    }),
    [enableColumnFilter]
  );

  useEffect(() => {
    setPopupParent(document.getElementById("ag-grid-popup-root") || document.body);
  }, []);

  return (
    <div className="glass rounded-2xl overflow-visible">
      <div className="w-full min-h-[220px]">
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={mergedColumnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          rowHeight={rowHeight}
          popupParent={popupParent || undefined}
          domLayout="autoHeight"
          animateRows={false}
          suppressCellFocus
          enableCellTextSelection
          ensureDomOrder
          overlayNoRowsTemplate={`<span class="text-muted">${emptyMessage}</span>`}
          onCellClicked={onCellClicked}
          context={context}
          pagination={!serverPagination}
          paginationPageSize={serverPagination ? pageSizeProp : pageSize}
          paginationPageSizeSelector={false}
          suppressPaginationPanel
          onPaginationChanged={() => {
            refreshPageInfo();
            gridRef.current?.api?.refreshCells({ columns: ["_serial"], force: true });
          }}
          onFilterChanged={() => {
            refreshPageInfo();
            gridRef.current?.api?.refreshCells({ columns: ["_serial"], force: true });
          }}
          onSortChanged={() => {
            gridRef.current?.api?.refreshCells({ columns: ["_serial"], force: true });
          }}
          onGridReady={refreshPageInfo}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-muted" htmlFor="grid-page-size">
            Page size
          </label>
          <select
            id="grid-page-size"
            className="grid-page-size"
            value={serverPagination ? pageSizeProp : pageSize}
            onChange={(e) => changePageSize(e.target.value)}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          {serverPagination ? (
            <>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-white/10 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
              >
                Prev
              </button>
              <span>
                Page {page} of {Math.max(1, Math.ceil(total / pageSizeProp))}
              </span>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-white/10 disabled:opacity-40"
                disabled={page >= Math.max(1, Math.ceil(total / pageSizeProp))}
                onClick={() => onPageChange?.(page + 1)}
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-white/10 disabled:opacity-40"
                disabled={pageInfo.current <= 1}
                onClick={() => {
                  gridRef.current?.api?.paginationGoToPreviousPage();
                  refreshPageInfo();
                }}
              >
                Prev
              </button>
              <span>
                Page {pageInfo.current} of {pageInfo.total}
              </span>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg border border-white/10 disabled:opacity-40"
                disabled={pageInfo.current >= pageInfo.total}
                onClick={() => {
                  gridRef.current?.api?.paginationGoToNextPage();
                  refreshPageInfo();
                }}
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
