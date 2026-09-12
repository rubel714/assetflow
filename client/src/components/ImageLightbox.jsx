import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ImageLightbox({ src, alt = "Asset image", onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] grid place-items-center"
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
      <figure className="relative m-0 grid place-items-center">
        <img
          src={src}
          alt={alt}
          className="block max-h-[64vh] max-w-[min(42rem,90vw)] h-auto w-auto object-contain rounded-2xl border border-white/10 bg-black/30"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 text-sm font-semibold hover:bg-white/10"
        >
          Close
        </button>
      </figure>
    </div>,
    document.body
  );
}
