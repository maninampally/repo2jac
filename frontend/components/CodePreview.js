"use client";

import { useState } from "react";

export default function CodePreview({ file }) {
  const [copied, setCopied] = useState(false);

  if (!file) {
    return (
      <div style={styles.empty}>
        <p>← Select a file to preview</p>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(file.converted || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const conf      = file.confidence || 0;
  const confColor = conf >= 0.85 ? "#4ade80" : conf >= 0.7 ? "#facc15" : "#f87171";
  const confLabel = conf >= 0.85 ? "High" : conf >= 0.7 ? "Medium" : "Low";

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.fileInfo}>
          <span style={styles.fileName}>{file.path}</span>
          <span style={{ border: "1px solid", borderColor: confColor, color: confColor, borderRadius: "999px", padding: "0.15rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>
            {confLabel} · {Math.round(conf * 100)}%
          </span>
          {!file.validated && (
            <span style={styles.reviewBadge}>⚠ Manual review recommended</span>
          )}
        </div>
        <button style={styles.copyBtn} onClick={handleCopy}>
          {copied ? "✓ Copied!" : "Copy Jac"}
        </button>
      </div>

      {/* Side-by-side */}
      <div style={styles.panels}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}><span style={styles.panelLabel}>🐍 Original Python</span></div>
          <pre style={styles.code}>{file.original || "(empty)"}</pre>
        </div>
        <div style={styles.divider} />
        <div style={styles.panel}>
          <div style={styles.panelHeader}><span style={styles.panelLabel}>⚡ Converted Jac</span></div>
          <pre style={{ ...styles.code, color: "#a5f3fc" }}>{file.converted || "(not converted)"}</pre>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap:        { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  empty:       { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: "0.9rem" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem", borderBottom: "1px solid #2d3748", background: "#13172a", flexShrink: 0, gap: "1rem", flexWrap: "wrap" },
  fileInfo:    { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  fileName:    { fontFamily: "monospace", fontSize: "0.85rem", color: "#e2e8f0" },
  reviewBadge: { background: "#451a03", color: "#facc15", borderRadius: "999px", padding: "0.15rem 0.6rem", fontSize: "0.72rem" },
  copyBtn:     { background: "#2d3748", border: "none", color: "#e2e8f0", padding: "0.4rem 0.9rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", flexShrink: 0 },
  panels:      { display: "flex", flex: 1, overflow: "hidden" },
  panel:       { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  panelHeader: { padding: "0.4rem 1rem", borderBottom: "1px solid #2d3748", background: "#0f1117", flexShrink: 0 },
  panelLabel:  { fontSize: "0.78rem", color: "#64748b", fontWeight: 600 },
  divider:     { width: "1px", background: "#2d3748", flexShrink: 0 },
  code:        { flex: 1, overflowY: "auto", padding: "1rem", fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 },
};