import React, { useEffect, useState } from "react";
import { hideSnackbar, subscribeSnackbar } from "../lib/snackbar";

export default function Snackbar() {
  const [state, setState] = useState(null);

  useEffect(() => subscribeSnackbar(setState), []);

  if (!state) return null;

  const typeClass =
    state.type === "error"
      ? "bg-red-500"
      : state.type === "validation"
        ? "bg-amber-500"
        : "bg-emerald-600";

  return (
    <div className="fixed left-1/2 bottom-6 z-[10060] -translate-x-1/2 px-4 pointer-events-none">
      <div
        key={state.id}
        role={state.type === "success" ? "status" : "alert"}
        className={`pointer-events-auto flex items-center gap-3 rounded-xl text-white px-4 py-3 shadow-lg min-w-[260px] max-w-[90vw] animate-enter ${typeClass}`}
      >
        <p className="text-sm font-medium flex-1">{state.message}</p>
        <button
          type="button"
          className="text-white/80 hover:text-white text-sm font-semibold"
          onClick={hideSnackbar}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
