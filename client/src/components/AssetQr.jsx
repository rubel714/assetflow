import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function AssetQr({ tag, size = 180 }) {
  const [src, setSrc] = useState("");
  const scanUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/scan?tag=${encodeURIComponent(tag || "")}`
      : "";

  useEffect(() => {
    if (!tag) return undefined;
    let cancelled = false;
    QRCode.toDataURL(scanUrl, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [tag, scanUrl, size]);

  if (!tag) return null;

  function printLabel() {
    window.print();
  }

  return (
    <div className="qr-print-label glass rounded-2xl p-6 space-y-3">
      <h3 className="font-semibold">QR label</h3>
      <div className="flex flex-wrap items-center gap-4">
        {src ? (
          <img src={src} alt={`QR for ${tag}`} className="h-40 w-40 bg-white rounded-xl p-2" />
        ) : (
          <p className="text-muted text-sm">Generating QR…</p>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{tag}</p>
          <p className="text-sm text-muted mt-1 break-all">{scanUrl}</p>
          <button
            type="button"
            onClick={printLabel}
            className="mt-3 px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5 qr-print-hide"
          >
            Print label
          </button>
        </div>
      </div>
    </div>
  );
}
