import React, { useEffect, useState } from "react";
import { settleConfirm, subscribeConfirm } from "../lib/confirm";

export default function ConfirmDialog() {
  const [state, setState] = useState(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => subscribeConfirm(setState), []);

  useEffect(() => {
    setNote("");
    setNoteError("");
  }, [state]);

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

  function handleConfirm() {
    if (state.noteRequired && !note.trim()) {
      setNoteError("A note is required");
      return;
    }
    settleConfirm(true, note.trim());
  }

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
        {state.noteRequired && (
          <div className="mt-4">
            <label className="input-label" htmlFor="confirm-note">
              {state.noteLabel || "Notes"}
            </label>
            <textarea
              id="confirm-note"
              className="input-field min-h-[80px]"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError("");
              }}
            />
            {noteError ? <p className="text-red-400 text-xs mt-1">{noteError}</p> : null}
          </div>
        )}
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
            onClick={handleConfirm}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
