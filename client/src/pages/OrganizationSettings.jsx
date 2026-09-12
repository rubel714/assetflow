import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { getSavedUser, patchSavedUser } from "../lib/globalfunction";
import { assetImageSrc } from "../lib/assetImage";
import { showSnackbar } from "../lib/snackbar";

const emptyForm = {
  name: "",
  legalName: "",
  code: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  countryId: "",
};

export default function OrganizationSettings() {
  const user = getSavedUser();
  const [form, setForm] = useState({
    ...emptyForm,
    name: user?.OrganizationName || "",
  });
  const [countries, setCountries] = useState([]);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/organization"), api.get("/lookups")])
      .then(([orgRes, lookupRes]) => {
        const org = orgRes.data.organization || {};
        setForm({
          name: org.Name || "",
          legalName: org.LegalName || "",
          code: org.Code || "",
          email: org.Email || "",
          phone: org.Phone || "",
          website: org.Website || "",
          address: org.Address || "",
          countryId: org.CountryId ? String(org.CountryId) : "",
        });
        setLogoPreview(org.LogoUrl ? assetImageSrc(org.LogoUrl) : "");
        setCountries(lookupRes.data.countries || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleLogoSelect(file) {
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(file ? URL.createObjectURL(file) : "");
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setRemoveLogo(true);
    setLogoPreview("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showSnackbar("Organization name is required", { type: "validation" });
      return;
    }
    if (!form.code.trim()) {
      showSnackbar("Organization code is required", { type: "validation" });
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      data.append("legalName", form.legalName.trim());
      data.append("code", form.code.trim());
      data.append("email", form.email.trim());
      data.append("phone", form.phone.trim());
      data.append("website", form.website.trim());
      data.append("address", form.address.trim());
      data.append("countryId", form.countryId);
      if (logoFile) data.append("image", logoFile);
      if (removeLogo && !logoFile) data.append("removeLogo", "true");

      const res = await api.patch("/organization", data);
      const org = res.data.organization || {};
      setForm({
        name: org.Name || "",
        legalName: org.LegalName || "",
        code: org.Code || "",
        email: org.Email || "",
        phone: org.Phone || "",
        website: org.Website || "",
        address: org.Address || "",
        countryId: org.CountryId ? String(org.CountryId) : "",
      });
      setLogoFile(null);
      setRemoveLogo(false);
      setLogoPreview(org.LogoUrl ? assetImageSrc(org.LogoUrl) : "");
      patchSavedUser({
        OrganizationName: org.Name || form.name.trim(),
        OrganizationCode: org.Code || null,
        OrganizationLogoUrl: org.LogoUrl || null,
      });
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
        <p className="text-muted text-sm mt-1">
          Identify this tenant with a legal name, short code, and contact details.
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="glass rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Identity</h3>
                <p className="text-muted text-xs mt-1">How this organization appears across AssetFlow.</p>
              </div>
              <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="min-w-0 space-y-4">
                  <div>
                    <label className="input-label">Display name</label>
                    <input
                      className="input-field"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Bashundhara Group"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="input-label">Legal name</label>
                    <input
                      className="input-field"
                      value={form.legalName}
                      onChange={update("legalName")}
                      placeholder="Official registered name"
                    />
                  </div>
                  <div>
                    <label className="input-label">Short code</label>
                    <input
                      className="input-field uppercase"
                      value={form.code}
                      onChange={update("code")}
                      placeholder="BG"
                      maxLength={20}
                    />
                    <p className="text-[11px] text-muted mt-1">Unique 1–20 character key. Letters, numbers, hyphen, or underscore.</p>
                  </div>
                </div>
                <div className="w-full sm:w-36">
                  <label className="input-label">Logo</label>
                  <label className="relative block h-[8.25rem] w-full sm:w-36 rounded-xl overflow-hidden border border-white/10 bg-black/20 cursor-pointer">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Organization logo" className="h-full w-full object-contain bg-white/5" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wider text-muted px-2 text-center">
                        Click to upload
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="text-[11px] text-muted mt-1">JPEG, PNG, WebP, GIF. Max 5MB.</p>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="mt-1 text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="glass rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Contact</h3>
                <p className="text-muted text-xs mt-1">Organization mailbox and switchboard, not a user account.</p>
              </div>
              <div>
                <label className="input-label">Email</label>
                <input
                  className="input-field"
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="assets@company.example"
                />
              </div>
              <div>
                <label className="input-label">Phone</label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={update("phone")}
                  placeholder="+880 2-41012345"
                />
              </div>
              <div>
                <label className="input-label">Website</label>
                <input
                  className="input-field"
                  value={form.website}
                  onChange={update("website")}
                  placeholder="https://www.company.example"
                />
              </div>
            </section>
          </div>

          <section className="glass rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Address</h3>
              <p className="text-muted text-xs mt-1">Shown on organization settings and later reports.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="input-label">Street address</label>
                <input
                  className="input-field"
                  value={form.address}
                  onChange={update("address")}
                  placeholder="Head office, city"
                />
              </div>
              <div>
                <label className="input-label">Country</label>
                <select className="input-field" value={form.countryId} onChange={update("countryId")}>
                  <option value="">Select</option>
                  {countries.map((item) => (
                    <option key={item.CountryId} value={item.CountryId}>
                      {item.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

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
