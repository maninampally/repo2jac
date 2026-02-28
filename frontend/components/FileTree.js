"use client";

export default function FileTree({ files, activeFile, onSelect }) {
  if (!files || files.length === 0) return null;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>📁 Files</span>
        <span style={styles.count}>{files.length}</span>
      </div>
      <div style={styles.list}>
        {files.map((f) => {
          const isActive = activeFile?.path === f.path;
          const conf     = f.confidence || 0;
          const icon     = conf >= 0.85 ? "✅" : conf >= 0.70 ? "⚠️" : "❌";
          return (
            <button
              key={f.path}
              style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
              onClick={() => onSelect(f)}
              title={f.path}
            >
              <span style={styles.icon}>{icon}</span>
              <span style={styles.name}>{f.path.split("/").pop()}</span>
              <span style={{ color: conf >= 0.85 ? "#4ade80" : conf >= 0.7 ? "#facc15" : "#f87171", fontSize: "0.72rem", fontWeight: 700 }}>
                {Math.round(conf * 100)}%
              </span>
            </button>
          );
        })}
      </div>
      <div style={styles.legend}>
        <span>✅ &gt;85%</span>
        <span>⚠️ 70–85%</span>
        <span>❌ &lt;70%</span>
      </div>
    </aside>
  );
}

const styles = {
  sidebar:     { width: "220px", flexShrink: 0, borderRight: "1px solid #2d3748", display: "flex", flexDirection: "column", background: "#13172a", overflow: "hidden" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: "1px solid #2d3748", flexShrink: 0 },
  headerTitle: { fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8" },
  count:       { background: "#2d3748", color: "#94a3b8", fontSize: "0.72rem", borderRadius: "999px", padding: "0.1rem 0.5rem" },
  list:        { flex: 1, overflowY: "auto", padding: "0.5rem" },
  item:        { width: "100%", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.6rem", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left", color: "#94a3b8", fontSize: "0.8rem" },
  itemActive:  { background: "#1e2640", color: "#e2e8f0" },
  icon:        { fontSize: "0.75rem", flexShrink: 0 },
  name:        { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" },
  legend:      { display: "flex", justifyContent: "space-around", padding: "0.5rem", borderTop: "1px solid #2d3748", fontSize: "0.68rem", color: "#475569", flexShrink: 0 },
};