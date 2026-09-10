import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { showSnackbar } from "../lib/snackbar";

export default function ScanAsset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tag, setTag] = useState(searchParams.get("tag") || "");
  const [looking, setLooking] = useState(false);

  async function lookup(nextTag) {
    const value = (nextTag || tag).trim();
    if (!value) {
      showSnackbar("Enter an asset tag", { type: "validation" });
      return;
    }
    setLooking(true);
    try {
      const res = await api.get("/assets/lookup", { params: { tag: value } });
      navigate(`/assets/${res.data.asset.AssetId}`);
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Asset not found", { type: "error" });
    } finally {
      setLooking(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("tag");
    if (initial) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-enter space-y-6 max-w-lg">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Register</p>
        <h2 className="text-2xl font-bold">Scan asset</h2>
        <p className="text-muted text-sm mt-1">
          Enter the printed tag, or open a QR label URL that includes the tag.
        </p>
      </div>
      <form
        className="glass rounded-2xl p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <div>
          <label className="input-label" htmlFor="scan-tag">
            Asset tag
          </label>
          <input
            id="scan-tag"
            className="input-field"
            placeholder="AF-0001"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={looking}
          className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          {looking ? "Looking up…" : "Open asset"}
        </button>
      </form>
    </div>
  );
}
