import React, { useEffect } from "react";

export default function ImageLightbox({ src, alt = "Asset image", onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75"
        aria-label="Close image"
        onClick={onClose}
      />
      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 text-sm font-semibold hover:bg-white/10"
        >
          Close
        </button>
        <img
          src={src}
          alt={alt}
          className="relative max-h-[82vh] w-full object-contain rounded-2xl border border-white/10 bg-black/30"
        />
      </div>
    </div>
  );
}
