"use client";

import { useState } from "react";

export default function DownloadButton({ jobId }) {
  const [state, setState] = useState("idle");

  async function handleDownload() {
    setState("loading");
    try {
      const res = await fetch(`/api/download/${jobId}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "converted-jac.zip";
      a.click();
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const label = {
    idle:    "⬇ Download ZIP",
    loading: "Preparing...",
    done:    "✓ Downloaded!",
    error:   "⚠ Failed — retry",
  }[state];

  return (
    <button
      style={{ ...styles.btn, opacity: state === "loading" ? 0.7 : 1 }}
      onClick={handleDownload}
      disabled={state === "loading"}
    >
      {label}
    </button>
  );
}

const styles = {
  btn: {
    background: "linear-gradient(135deg, #4f46e5, #38bdf8)",
    border: "none", borderRadius: "8px",
    padding: "0.5rem 1.2rem",
    color: "#fff", fontWeight: 700,
    fontSize: "0.88rem", cursor: "pointer",
    whiteSpace: "nowrap",
  },
};