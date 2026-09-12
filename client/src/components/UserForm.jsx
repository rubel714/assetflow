import React from "react";

export default function UserForm({
  form,
  lookups,
  isEdit,
  saving,
  imagePreview,
  onChange,
  onImageSelect,
  onImageRemove,
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
            <p className="text-muted text-xs mt-1">Name, photo, and job title for this person.</p>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <div>
                <label className="input-label">Full name</label>
                <input
                  className="input-field"
                  value={form.fullName}
                  onChange={update("fullName")}
                  placeholder="Jane Smith"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Designation</label>
                <select className="input-field" value={form.designationId} onChange={update("designationId")}>
                  <option value="">Select</option>
                  {(lookups?.designations || []).map((item) => (
                    <option key={item.DesignationId} value={item.DesignationId}>
                      {item.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-full sm:w-36">
              <label className="input-label">Photo</label>
              <label className="relative block h-[8.25rem] w-full sm:w-36 rounded-xl overflow-hidden border border-white/10 bg-black/20 cursor-pointer">
                {imagePreview ? (
                  <img src={imagePreview} alt="User" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wider text-muted px-2 text-center">
                    Click to upload
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => onImageSelect?.(e.target.files?.[0] || null)}
                />
              </label>
              <p className="text-[11px] text-muted mt-1">JPEG, PNG, WebP, GIF. Max 5MB.</p>
              {imagePreview && (
                <button
                  type="button"
                  onClick={onImageRemove}
                  className="mt-1 text-xs font-semibold text-red-400 hover:text-red-300"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Access</h3>
            <p className="text-muted text-xs mt-1">Sign-in details and what this person can do.</p>
          </div>
          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={update("email")}
              placeholder="jane@company.com"
              autoComplete="email"
            />
            <p className="text-[11px] text-muted mt-1">Used to sign in. Must be unique across AssetFlow.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">{isEdit ? "New password" : "Password"}</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={update("password")}
                placeholder={isEdit ? "Leave blank to keep current" : ""}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="input-label">Confirm password</label>
              <input
                type="password"
                className="input-field"
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
                placeholder={isEdit ? "Leave blank to keep current" : ""}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Role</label>
              <select className="input-field" value={form.role} onChange={update("role")}>
                <option value="employee">Employee</option>
                <option value="asset_manager">Asset Manager</option>
                <option value="organization_admin">Organization Admin</option>
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="input-label">Status</label>
                <select className="input-field" value={form.status} onChange={update("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold">Contact</h3>
            <p className="text-muted text-xs mt-1">How to reach this person.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Phone</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={update("phone")}
                placeholder="+880 ..."
              />
            </div>
          </div>
          <div>
            <label className="input-label">Address</label>
            <textarea
              className="input-field"
              rows="3"
              value={form.address}
              onChange={update("address")}
              placeholder="Street, city, country"
            />
          </div>
        </section>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {isEdit
            ? "Leave both password fields empty to keep the current password."
            : "Full name, email, password, and confirm password are required."}
        </span>
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save user"}
          </button>
        </div>
      </div>
    </form>
  );
}
