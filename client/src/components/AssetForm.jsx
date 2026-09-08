import React from "react";

export default function AssetForm({
  form,
  lookups,
  isEdit,
  saving,
  error,
  onChange,
  onSubmit,
  onCancel,
}) {
  function update(field) {
    return (e) => onChange(field, e.target.value);
  }

  return (
    <form onSubmit={onSubmit} className="w-full flex flex-col gap-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Identity</h3>
            <p className="text-muted text-xs mt-1">Name, category, and what this asset is.</p>
          </div>
          <div>
            <label className="input-label">Asset name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={update("name")}
              placeholder="Laptop, printer, vehicle..."
              autoFocus
            />
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea className="input-field" rows="4" value={form.description} onChange={update("description")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Category</label>
              <select className="input-field" value={form.categoryId} onChange={update("categoryId")}>
                <option value="">Select</option>
                {lookups.categories.map((c) => (
                  <option key={c.CategoryId} value={c.CategoryId}>
                    {c.Name}
                  </option>
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
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <p className="text-muted text-xs mt-1">Manufacturer details and serial identification.</p>
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
          <div>
            <label className="input-label">Manufacturer</label>
            <select className="input-field" value={form.manufacturerId || ""} onChange={update("manufacturerId")}>
              <option value="">Select</option>
              {(lookups.manufacturers || []).map((c) => (
                <option key={c.ManufacturerId} value={c.ManufacturerId}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Country of origin</label>
            <select className="input-field" value={form.countryOfOriginId || ""} onChange={update("countryOfOriginId")}>
              <option value="">Select</option>
              {(lookups.countries || []).map((c) => (
                <option key={c.CountryId} value={c.CountryId}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Purchase</h3>
            <p className="text-muted text-xs mt-1">When it was bought and what it cost.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Purchase date</label>
              <input type="date" className="input-field" value={form.purchaseDate} onChange={update("purchaseDate")} />
            </div>
            <div>
              <label className="input-label">Purchase cost</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={form.purchaseCost}
                onChange={update("purchaseCost")}
              />
            </div>
            <div>
              <label className="input-label">Supplier</label>
              <select className="input-field" value={form.supplierId || ""} onChange={update("supplierId")}>
                <option value="">Select</option>
                {(lookups.suppliers || []).map((c) => (
                  <option key={c.SupplierId} value={c.SupplierId}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Receive date</label>
              <input type="date" className="input-field" value={form.receiveDate || ""} onChange={update("receiveDate")} />
            </div>
            <div>
              <label className="input-label">Last date of warranty</label>
              <input
                type="date"
                className="input-field"
                value={form.lastWarrantyDate || ""}
                onChange={update("lastWarrantyDate")}
              />
            </div>
            <div>
              <label className="input-label">Maintenance schedule</label>
              <select
                className="input-field"
                value={form.maintenanceScheduleId || ""}
                onChange={update("maintenanceScheduleId")}
              >
                <option value="">Select</option>
                {(lookups.maintenanceSchedules || []).map((c) => (
                  <option key={c.MaintenanceScheduleId} value={c.MaintenanceScheduleId}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Remarks</label>
            <textarea className="input-field" rows="3" value={form.remarks || ""} onChange={update("remarks")} />
          </div>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Placement</h3>
            <p className="text-muted text-xs mt-1">Where this asset sits in the organization.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Location</label>
              <select className="input-field" value={form.locationId} onChange={update("locationId")}>
                <option value="">Select</option>
                {lookups.locations.map((c) => (
                  <option key={c.LocationId} value={c.LocationId}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Department</label>
              <select className="input-field" value={form.departmentId} onChange={update("departmentId")}>
                <option value="">Select</option>
                {lookups.departments.map((c) => (
                  <option key={c.DepartmentId} value={c.DepartmentId}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Project</label>
              <select className="input-field" value={form.projectId} onChange={update("projectId")}>
                <option value="">Select</option>
                {lookups.projects.map((c) => (
                  <option key={c.ProjectId} value={c.ProjectId}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-400">{error}</p> : <span className="text-sm text-muted">All fields except name are optional.</span>}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save asset"}
          </button>
        </div>
      </div>
    </form>
  );
}
