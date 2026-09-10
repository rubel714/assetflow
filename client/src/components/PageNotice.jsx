import React from "react";

export default function PageNotice({ loading, error, loadingText = "Loading…" }) {
  if (loading) {
    return <p className="text-muted">{loadingText}</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }
  return null;
}
