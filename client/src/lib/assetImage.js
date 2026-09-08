export function assetImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("blob:")) return imageUrl;
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}
