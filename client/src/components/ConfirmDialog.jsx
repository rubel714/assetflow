import React, { useEffect, useState } from "react";
import { settleConfirm, subscribeConfirm } from "../lib/confirm";

export default function ConfirmDialog() {
  const [state, setState] = useState(null);

  useEffect(() => subscribeConfirm(setState), []);

  useEffect(() => {
    if (!state) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        settleConfirm(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55"
        aria-label="Cancel"
        onClick={() => settleConfirm(false)}
      />
      <div className="relative glass rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h3 id="confirm-title" className="text-lg font-bold">
          {state.title}
        </h3>
        {state.message && <p className="text-muted text-sm mt-2 leading-relaxed">{state.message}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold"
            onClick={() => settleConfirm(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-white text-sm font-semibold ${
              state.danger === false
                ? "bg-cyan-600 hover:bg-cyan-500"
                : "bg-red-500 hover:bg-red-400"
            }`}
            onClick={() => settleConfirm(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
