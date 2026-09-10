import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { getSavedUser, hasPermission } from "../lib/globalfunction";
import { assetImageSrc } from "../lib/assetImage";
import { showSnackbar } from "../lib/snackbar";
import AssetQr from "../components/AssetQr";
import { confirmAction } from "../lib/confirm";

export default function AssetDetail() {
  const { id } = useParams();
  const user = getSavedUser();
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  function load() {
    return Promise.all([
      api.get(`/assets/${id}`),
      api.get(`/assets/${id}/documents`).catch(() => ({ data: { documents: [] } })),
    ]).then(([res, docs]) => {
      setAsset(res.data.asset);
      setHistory(res.data.history || []);
      setDocuments(docs.data.documents || []);
      setLoadFailed(false);
    });
  }

  useEffect(() => {
    load().catch(() => {
      setLoadFailed(true);
    });
    api.get("/lookups").then((res) => setUsers(res.data.users || [])).catch(() => {});
  }, [id]);

  async function runAction(path) {
    if ((path === "assign" || path === "transfer") && !userId) {
      showSnackbar("Select an employee first", { type: "validation" });
      return;
    }
    try {
      await api.post(`/assets/${id}/${path}`, { userId, notes });
      setNotes("");
      setUserId("");
      await load();
      showSnackbar("Data saved successfully");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Action failed", { type: "error" });
    }
  }

  async function acceptHandover() {
    try {
      await api.post(`/assets/${id}/accept`);
      await load();
      showSnackbar("Handover accepted");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not accept handover", { type: "error" });
    }
  }

  async function uploadDocument(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    try {
      await api.post(`/assets/${id}/documents`, data);
      await load();
      showSnackbar("File attached");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not upload file", { type: "error" });
    }
  }

  async function deleteDocument(doc) {
    const ok = await confirmAction({
      title: "Delete file?",
      message: `“${doc.OriginalName}” will be removed.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.delete(`/assets/${id}/documents/${doc.DocumentId}`);
      await load();
      showSnackbar("File deleted");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Could not delete file", { type: "error" });
    }
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <p className="text-muted">This asset could not be loaded.</p>
        <Link
          to="/assets"
          className="inline-flex px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
        >
          Back to assets
        </Link>
      </div>
    );
  }
  if (!asset) {
    return <p className="text-muted">Loading…</p>;
  }

  const canAssign = hasPermission(user, "assets.assign");
  const canManage = hasPermission(user, "assets.manage");
  const canAccept =
    hasPermission(user, "assets.accept") &&
    asset.HandoverStatus === "pending" &&
    Number(asset.CustodianId) === Number(user?.UserId);

  return (
    <div className="animate-enter space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap qr-print-hide">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-20 w-20 rounded-2xl overflow-hidden border border-white/10 bg-black/20 flex items-center justify-center shrink-0">
            {assetImageSrc(asset.ImageUrl) ? (
              <img src={assetImageSrc(asset.ImageUrl)} alt={asset.Name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted px-2 text-center">No image</span>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{asset.AssetTag}</p>
            <h2 className="text-2xl font-bold">{asset.Name}</h2>
            <p className="text-muted text-sm mt-1">{asset.Description || "No description"}</p>
            {asset.HandoverStatus === "pending" && (
              <p className="text-amber-400 text-sm mt-2">Handover pending acceptance</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/assets"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
          >
            Back to assets
          </Link>
          {canManage && (
            <Link
              to={`/assets/${asset.AssetId}/edit`}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {canAccept && (
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-3 qr-print-hide">
          <p className="text-sm">This asset was assigned to you. Accept custody to complete handover.</p>
          <button
            type="button"
            onClick={acceptHandover}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold"
          >
            Accept handover
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm qr-print-hide">
        {[
          ["Status", asset.Status],
          ["Category", asset.CategoryName],
          ["Custodian", asset.CustodianName],
          ["Handover", asset.HandoverStatus === "pending" ? "Pending" : asset.CustodianName ? "Accepted" : "—"],
          ["Serial", asset.SerialNumber],
          ["Brand / Model", [asset.Brand, asset.Model].filter(Boolean).join(" ")],
          ["Location", asset.LocationName],
          ["Department", asset.DepartmentName],
          ["Project", asset.ProjectName],
          ["Supplier", asset.SupplierName],
          ["Manufacturer", asset.ManufacturerName],
          ["Country of origin", asset.CountryOfOriginName],
          ["Receive date", asset.ReceiveDate ? String(asset.ReceiveDate).slice(0, 10) : null],
          ["Last date of warranty", asset.LastWarrantyDate ? String(asset.LastWarrantyDate).slice(0, 10) : null],
          ["Maintenance schedule", asset.MaintenanceScheduleName],
          ["Remarks", asset.Remarks],
          ["Purchase cost", asset.PurchaseCost],
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-2xl p-4">
            <p className="text-muted text-xs uppercase tracking-wider">{label}</p>
            <p className="font-medium mt-1">{value || "—"}</p>
          </div>
        ))}
      </div>

      <AssetQr tag={asset.AssetTag} />

      {canAssign && (
        <div className="glass rounded-2xl p-6 space-y-4 qr-print-hide">
          <h3 className="font-semibold">Custody</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Employee</label>
              <select className="input-field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select employee</option>
                {users.map((u) => (
                  <option key={u.UserId} value={u.UserId}>
                    {u.FullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Notes</label>
              <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runAction("assign")}
              disabled={asset.Status !== "Available"}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Assign
            </button>
            <button
              onClick={() => runAction("transfer")}
              disabled={asset.Status !== "Assigned"}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold disabled:opacity-40"
            >
              Transfer
            </button>
            <button
              onClick={() => runAction("return")}
              disabled={asset.Status !== "Assigned"}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold disabled:opacity-40"
            >
              Return
            </button>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-6 space-y-4 qr-print-hide">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Attachments</h3>
          <label className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5 cursor-pointer">
            Upload file
            <input type="file" className="hidden" onChange={uploadDocument} />
          </label>
        </div>
        {documents.length === 0 ? (
          <p className="text-muted text-sm">No files attached.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {documents.map((doc) => (
              <li key={doc.DocumentId} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                <a
                  href={assetImageSrc(doc.Url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent font-medium truncate"
                >
                  {doc.OriginalName}
                </a>
                <button
                  type="button"
                  className="text-red-400 text-xs"
                  onClick={() => deleteDocument(doc)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass rounded-2xl p-6 qr-print-hide">
        <h3 className="font-semibold mb-4">Timeline</h3>
        {history.length === 0 ? (
          <p className="text-muted text-sm">No events yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {history.map((event) => (
              <li key={event.EventId} className="border-b border-white/5 pb-3 last:border-0">
                <p className="font-medium capitalize">{event.EventType}</p>
                <p className="text-muted">
                  {event.PreviousValue || "—"} → {event.NewValue || "—"}
                  {event.Notes ? ` · ${event.Notes}` : ""}
                </p>
                <p className="text-xs text-muted mt-1">
                  {event.CreatedByName || "System"} · {new Date(event.CreatedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
