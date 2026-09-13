import { useEffect } from "react";
import { syncFavicon } from "../lib/favicon";

export default function Favicon({ user }) {
  useEffect(() => {
    syncFavicon();
    window.addEventListener("assetflow-auth-updated", syncFavicon);
    return () => window.removeEventListener("assetflow-auth-updated", syncFavicon);
  }, [user]);
  return null;
}
