"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import URLInput from "@/components/URLInput";

export default function HomePage() {
  const router  = useRouter();
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(url) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/convert", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ github_url: url }),
      });
      if (!res.ok) throw new Error("Failed to start conversion");
      const data = await res.json();
      router.push(`/convert/${data.job_id}`);
    } catch (e) {
      setError(e.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.badge}>⚡ Powered by Jac & Jaseci</div>
        <h1 style={styles.title}>Repo-to-Jac Converter</h1>
        <p style={styles.subtitle}>
          Paste any public Python GitHub repo URL and get a fully converted
          <br />
          <strong>Jac/Jaseci</strong> codebase with README and demo — in seconds.
        </p>
      </div>

      {/* Input Card */}
      <div style={styles.card}>
        <URLInput onSubmit={handleSubmit} loading={loading} />
        {error && <p style={styles.error}>⚠ {error}</p>}
      </div>

      {/* How It Works */}
      <div style={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={i} style={styles.step}>
            <div style={styles.stepIcon}>{s.icon}</div>
            <div style={styles.stepTitle}>{s.title}</div>
            <div style={styles.stepDesc}>{s.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

const STEPS = [
  { icon: "🔗", title: "Paste URL",      desc: "Any public Python GitHub repo"       },
  { icon: "🧠", title: "Agent Analyzes", desc: "Classifies files, builds OSP plan"   },
  { icon: "⚙️", title: "Converts",       desc: "Generates Jac nodes, walkers, edges" },
  { icon: "📦", title: "Download ZIP",   desc: "README + .jac files + demo script"   },
];

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    gap: "2rem",
  },
  header: { textAlign: "center" },
  badge: {
    display: "inline-block",
    background: "#1a1f35",
    border: "1px solid #3b4fd8",
    color: "#818cf8",
    borderRadius: "999px",
    padding: "0.3rem 1rem",
    fontSize: "0.8rem",
    marginBottom: "1rem",
  },
  title: {
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    fontWeight: 800,
    background: "linear-gradient(135deg, #818cf8, #38bdf8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "1rem",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "1.1rem",
    lineHeight: 1.7,
  },
  card: {
    background: "#1a1f35",
    border: "1px solid #2d3748",
    borderRadius: "12px",
    padding: "2rem",
    width: "100%",
    maxWidth: "680px",
  },
  error: { marginTop: "1rem", color: "#f87171", fontSize: "0.9rem" },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "1rem",
    width: "100%",
    maxWidth: "680px",
  },
  step: {
    background: "#1a1f35",
    border: "1px solid #2d3748",
    borderRadius: "10px",
    padding: "1.2rem",
    textAlign: "center",
  },
  stepIcon:  { fontSize: "1.8rem", marginBottom: "0.5rem" },
  stepTitle: { fontWeight: 700, marginBottom: "0.3rem", fontSize: "0.95rem" },
  stepDesc:  { color: "#94a3b8", fontSize: "0.8rem" },
};