"use client";

import { useEffect, useRef, useState } from "react";

const STEP_LABELS = {
  fetch:    "Fetching repo files",
  analyze:  "Analyzing file roles",
  plan:     "Building OSP mapping plan",
  convert:  "Converting to Jac",
  assemble: "Assembling output",
};

// Simulate smooth progress even when real events are delayed
const STEP_RANGES = {
  fetch:    [0,  15],
  analyze:  [15, 38],
  plan:     [38, 45],
  convert:  [45, 83],
  assemble: [83, 99],
};

export default function ProgressStream({ events, pct }) {
  const logRef          = useRef(null);
  const [displayPct, setDisplayPct] = useState(0);
  const animRef         = useRef(null);
  const currentRef      = useRef(0);

  // Smooth animated progress bar
  useEffect(() => {
    const target = pct || 0;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    function animate() {
      const diff = target - currentRef.current;
      if (Math.abs(diff) < 0.5) {
        currentRef.current = target;
        setDisplayPct(Math.round(target));
        return;
      }
      currentRef.current += diff * 0.08;
      setDisplayPct(Math.round(currentRef.current));
      animRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [pct]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  // Simulate progress when no events yet
  const [simPct, setSimPct] = useState(0);
  useEffect(() => {
    if (events.length > 0) return; // real events arrived, stop simulation
    const interval = setInterval(() => {
      setSimPct(p => p < 12 ? p + 0.5 : p);
    }, 200);
    return () => clearInterval(interval);
  }, [events.length]);

  const effectivePct = events.length > 0 ? displayPct : simPct;
  const last         = events[events.length - 1] || {};
  const stepLabel    = STEP_LABELS[last.step] || "Connecting to agent...";

  // Group events by step for a cleaner log
  const stepCounts = events.reduce((acc, ev) => {
    acc[ev.step] = (acc[ev.step] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Progress bar */}
      <div style={styles.barWrap}>
        <div style={{ ...styles.bar, width: `${effectivePct}%` }} />
      </div>

      {/* Step + pct */}
      <div style={styles.statusRow}>
        <span style={styles.stepLabel}>{stepLabel}</span>
        <span style={styles.pct}>{Math.round(effectivePct)}%</span>
      </div>

      {/* Current file */}
      {last.file && (
        <div style={styles.currentFile}>
          📄 {last.file}
          {last.confidence && (
            <span style={{
              color: last.confidence >= 0.85 ? "#4ade80" : last.confidence >= 0.7 ? "#facc15" : "#f87171",
              fontWeight: 600
            }}>
              {" "}· {Math.round(last.confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}

      {/* Step summary cards */}
      {Object.keys(stepCounts).length > 0 && (
        <div style={styles.stepCards}>
          {Object.entries(stepCounts).map(([step, count]) => (
            <div key={step} style={styles.stepCard}>
              <span style={styles.stepCardIcon}>
                {step === "fetch" ? "🔗" : step === "analyze" ? "🔍" : step === "plan" ? "📋" : step === "convert" ? "⚙️" : "📦"}
              </span>
              <span style={styles.stepCardLabel}>{STEP_LABELS[step] || step}</span>
              <span style={styles.stepCardCount}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live log */}
      <div ref={logRef} style={styles.log}>
        {events.length === 0 ? (
          <div style={styles.logLine}>
            <span style={{ color: "#4f46e5" }}>[connecting]</span>{" "}
            <span style={{ color: "#94a3b8" }}>Waiting for agent to start...</span>
          </div>
        ) : (
          events.slice(-30).map((ev, i) => (
            <div key={i} style={styles.logLine}>
              <span style={styles.logStep}>[{ev.step}]</span>{" "}
              <span style={styles.logFile}>{ev.file}</span>
              {ev.role && <span style={styles.logRole}> → {ev.role}</span>}
              {ev.confidence && (
                <span style={{
                  color: ev.confidence >= 0.85 ? "#4ade80" : "#facc15",
                  marginLeft: "0.5rem",
                  fontSize: "0.72rem"
                }}>
                  {Math.round(ev.confidence * 100)}%
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  barWrap:       { background: "#0f1117", borderRadius: "999px", height: "10px", overflow: "hidden", marginBottom: "0.75rem" },
  bar:           { height: "100%", background: "linear-gradient(90deg, #4f46e5, #818cf8, #38bdf8)", borderRadius: "999px", transition: "width 0.3s ease" },
  statusRow:     { display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" },
  stepLabel:     { color: "#94a3b8", fontSize: "0.88rem" },
  pct:           { color: "#818cf8", fontWeight: 700, fontSize: "0.88rem" },
  currentFile:   { color: "#e2e8f0", fontSize: "0.82rem", marginBottom: "0.75rem", fontFamily: "monospace", background: "#0f1117", padding: "0.4rem 0.75rem", borderRadius: "6px" },
  stepCards:     { display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" },
  stepCard:      { display: "flex", alignItems: "center", gap: "0.35rem", background: "#0f1117", border: "1px solid #1e2130", borderRadius: "6px", padding: "0.3rem 0.6rem" },
  stepCardIcon:  { fontSize: "0.8rem" },
  stepCardLabel: { color: "#64748b", fontSize: "0.72rem" },
  stepCardCount: { color: "#818cf8", fontWeight: 700, fontSize: "0.72rem", background: "#1e2130", borderRadius: "999px", padding: "0.1rem 0.4rem" },
  log:           { background: "#0f1117", border: "1px solid #1e2130", borderRadius: "8px", padding: "0.75rem", height: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.2rem" },
  logLine:       { fontSize: "0.78rem", fontFamily: "monospace", color: "#64748b" },
  logStep:       { color: "#4f46e5" },
  logFile:       { color: "#94a3b8" },
  logRole:       { color: "#38bdf8" },
};