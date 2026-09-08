import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";

const empty = {
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  purchaseCost: "",
  locationId: "",
  departmentId: "",
  projectId: "",
  status: "Available",
};

export default function AddAsset() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(empty);
  const [lookups, setLookups] = useState({ categories: [], locations: [], departments: [], projects: [] });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/lookups").then((res) => setLookups(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/assets/${id}`)
      .then((res) => {
        const a = res.data.asset;
        setForm({
          name: a.Name || "",
          description: a.Description || "",
          categoryId: a.CategoryId || "",
          brand: a.Brand || "",
          model: a.Model || "",
          serialNumber: a.SerialNumber || "",
          purchaseDate: a.PurchaseDate ? String(a.PurchaseDate).slice(0, 10) : "",
          purchaseCost: a.PurchaseCost || "",
          locationId: a.LocationId || "",
          departmentId: a.DepartmentId || "",
          projectId: a.ProjectId || "",
          status: a.Status || "Available",
        });
      })
      .catch((err) => setMessage(err.response?.data?.message || "Could not load asset"));
  }, [id, isEdit]);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setMessage("Asset name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      locationId: form.locationId || null,
      departmentId: form.departmentId || null,
      projectId: form.projectId || null,
      purchaseCost: form.purchaseCost === "" ? null : form.purchaseCost,
    };
    try {
      const res = isEdit
        ? await api.patch(`/assets/${id}`, payload)
        : await api.post("/assets", payload);
      navigate(`/assets/${res.data.asset.AssetId}`);
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not save asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-enter space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold">{isEdit ? "Edit Asset" : "Add Asset"}</h2>
        <p className="text-muted text-sm mt-1">
          {isEdit ? "Update register details." : "Register a new asset. A tag is generated automatically."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="input-label">Asset name</label>
          <input className="input-field" value={form.name} onChange={update("name")} placeholder="Laptop, printer, vehicle..." />
        </div>
        <div>
          <label className="input-label">Description</label>
          <textarea className="input-field" rows="3" value={form.description} onChange={update("description")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Category</label>
            <select className="input-field" value={form.categoryId} onChange={update("categoryId")}>
              <option value="">Select</option>
              {lookups.categories.map((c) => (
                <option key={c.CategoryId} value={c.CategoryId}>{c.Name}</option>
              ))}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={form.status} onChange={update("status")}>
                {["Available", "Assigned", "Damaged", "Lost", "Retired"].map((s) => (
                  <option key={s} value={s} disabled={s === "Assigned" && form.status !== "Assigned"}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Brand</label>
            <input className="input-field" value={form.brand} onChange={update("brand")} />
          </div>
          <div>
            <label className="input-label">Model</label>
            <input className="input-field" value={form.model} onChange={update("model")} />
          </div>
        </div>
        <div>
          <label className="input-label">Serial number</label>
          <input className="input-field" value={form.serialNumber} onChange={update("serialNumber")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Purchase date</label>
            <input type="date" className="input-field" value={form.purchaseDate} onChange={update("purchaseDate")} />
          </div>
          <div>
            <label className="input-label">Purchase cost</label>
            <input type="number" step="0.01" className="input-field" value={form.purchaseCost} onChange={update("purchaseCost")} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="input-label">Location</label>
            <select className="input-field" value={form.locationId} onChange={update("locationId")}>
              <option value="">Select</option>
              {lookups.locations.map((c) => (
                <option key={c.LocationId} value={c.LocationId}>{c.Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Department</label>
            <select className="input-field" value={form.departmentId} onChange={update("departmentId")}>
              <option value="">Select</option>
              {lookups.departments.map((c) => (
                <option key={c.DepartmentId} value={c.DepartmentId}>{c.Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Project</label>
            <select className="input-field" value={form.projectId} onChange={update("projectId")}>
              <option value="">Select</option>
              {lookups.projects.map((c) => (
                <option key={c.ProjectId} value={c.ProjectId}>{c.Name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Asset"}
        </button>
        {message && <p className="text-sm text-center text-red-400">{message}</p>}
      </form>
    </div>
  );
}
