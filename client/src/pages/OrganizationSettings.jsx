import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { getSavedUser, patchSavedUser } from "../lib/globalfunction";
import { showSnackbar } from "../lib/snackbar";

export default function OrganizationSettings() {
  const user = getSavedUser();
  const [name, setName] = useState(user?.OrganizationName || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/organization")
      .then((res) => {
        setName(res.data.organization?.Name || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      showSnackbar("Organization name is required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/organization", { name: name.trim() });
      const nextName = res.data.organization?.Name || name.trim();
      setName(nextName);
      patchSavedUser({ OrganizationName: nextName });
      showSnackbar("Data updated successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not save organization", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Organization</p>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted text-sm mt-1">The name shown for this organization across AssetFlow.</p>
      </div>

      {loading ? (
        <p className="text-muted">Loading settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 max-w-xl">
          <div>
            <label className="input-label">Organization name</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
