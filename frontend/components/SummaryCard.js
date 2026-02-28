"use client";

export default function SummaryCard({ summary, files }) {
  if (!summary) return null;
  const needsReview = files.filter((f) => f.confidence < 0.75).length;
  const avgPct      = Math.round((summary.avg_confidence || 0) * 100);
  const confColor   = avgPct >= 85 ? "#4ade80" : avgPct >= 70 ? "#facc15" : "#f87171";

  return (
    <div style={styles.wrap}>
      <Stat icon="📁" label="Files Converted" value={summary.total_files || files.length} />
      <Stat icon="🎯" label="Avg Confidence"  value={`${avgPct}%`} valueColor={confColor} />
      <Stat icon="⚠️" label="Needs Review"    value={needsReview}  valueColor={needsReview > 0 ? "#facc15" : "#4ade80"} />
      <Stat icon="✅" label="Validated"        value={files.filter((f) => f.validated).length} />
    </div>
  );
}

function Stat({ icon, label, value, valueColor }) {
  return (
    <div style={styles.stat}>
      <span style={styles.icon}>{icon}</span>
      <span style={styles.label}>{label}</span>
      <span style={{ ...styles.value, color: valueColor || "#e2e8f0" }}>{value}</span>
    </div>
  );
}

const styles = {
  wrap:  { display: "flex", gap: "1px", background: "#2d3748", borderBottom: "1px solid #2d3748", flexShrink: 0 },
  stat:  { flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem", background: "#13172a" },
  icon:  { fontSize: "1rem" },
  label: { color: "#64748b", fontSize: "0.78rem", flex: 1 },
  value: { fontWeight: 700, fontSize: "0.95rem" },
};