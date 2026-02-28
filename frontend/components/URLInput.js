"use client";

import { useState } from "react";

export default function URLInput({ onSubmit, loading }) {
  const [url,   setUrl]   = useState("");
  const [error, setError] = useState("");

  function validate(raw) {
    const t = raw.trim();
    if (!t) return "Please enter a GitHub URL";
    if (!t.startsWith("https://github.com/")) return "URL must start with https://github.com/";
    if (t.endsWith(".git")) return 'Remove the ".git" at the end';
    const parts = t.replace("https://github.com/", "").split("/").filter(Boolean);
    if (parts.length < 2) return "URL must include owner and repo (e.g. https://github.com/user/repo)";
    return null;
  }

  function handleSubmit() {
    const err = validate(url);
    if (err) { setError(err); return; }
    setError("");
    onSubmit(url.trim());
  }

  return (
    <div>
      <label style={styles.label}>GitHub Repository URL</label>
      <div style={styles.row}>
        <input
          style={{ ...styles.input, borderColor: error ? "#f87171" : "#2d3748" }}
          type="text"
          placeholder="https://github.com/username/repo"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={loading}
        />
        <button
          style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Starting..." : "Convert →"}
        </button>
      </div>
      {error && <p style={styles.error}>⚠ {error}</p>}
      <p style={styles.hint}>
        ✅ Public Python repo &nbsp;|&nbsp; ❌ No .git at end &nbsp;|&nbsp; ❌ No HTML/portfolio sites
      </p>
      <div style={styles.examples}>
        <span style={styles.exLabel}>Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.url} style={styles.exBtn}
            onClick={() => { setUrl(ex.url); setError(""); }}
            disabled={loading}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const EXAMPLES = [
  { url: "https://github.com/pallets/flask",  label: "flask"    },
  { url: "https://github.com/psf/requests",   label: "requests" },
  { url: "https://github.com/encode/httpx",   label: "httpx"    },
];

const styles = {
  label:    { display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.6rem" },
  row:      { display: "flex", gap: "0.75rem" },
  input:    { flex: 1, background: "#0f1117", border: "1px solid", borderRadius: "8px", padding: "0.75rem 1rem", color: "#e2e8f0", fontSize: "0.95rem", outline: "none" },
  btn:      { background: "linear-gradient(135deg, #4f46e5, #38bdf8)", border: "none", borderRadius: "8px", padding: "0.75rem 1.5rem", color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", whiteSpace: "nowrap" },
  error:    { marginTop: "0.5rem", color: "#f87171", fontSize: "0.85rem" },
  hint:     { marginTop: "0.6rem", color: "#475569", fontSize: "0.78rem" },
  examples: { display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" },
  exLabel:  { color: "#64748b", fontSize: "0.8rem" },
  exBtn:    { background: "transparent", border: "1px solid #2d3748", color: "#818cf8", borderRadius: "6px", padding: "0.3rem 0.8rem", fontSize: "0.78rem", cursor: "pointer" },
};