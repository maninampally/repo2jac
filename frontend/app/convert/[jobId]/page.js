"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProgressStream from "@/components/ProgressStream";
import FileTree       from "@/components/FileTree";
import CodePreview    from "@/components/CodePreview";
import SummaryCard    from "@/components/SummaryCard";
import DownloadButton from "@/components/DownloadButton";

const STATE = { STREAMING: "streaming", DONE: "done", ERROR: "error" };

export default function ConvertPage() {
  const { jobId } = useParams();
  const router    = useRouter();

  const [state,      setState]      = useState(STATE.STREAMING);
  const [events,     setEvents]     = useState([]);
  const [pct,        setPct]        = useState(0);
  const [preview,    setPreview]    = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [activeTab,  setActiveTab]  = useState("code");
  const [summary,    setSummary]    = useState(null);
  const [errorMsg,   setErrorMsg]   = useState("");

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    async function connectSSE() {
      // Small delay to ensure backend has registered the job
      await new Promise(r => setTimeout(r, 500));
      if (cancelled) return;

      try {
        const response = await fetch(`/api/stream/${jobId}`);
        if (!response.ok) {
          setErrorMsg("Failed to connect to stream");
          setState(STATE.ERROR);
          return;
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let eventType = "";
        let dataLine  = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim();
            } else if (line.startsWith(":")) {
              // keepalive ping — ignore
            } else if (line === "" && eventType && dataLine) {
              try {
                const data = JSON.parse(dataLine);
                if (eventType === "progress") {
                  setPct(data.pct || 0);
                  setEvents(prev => [...prev, data]);
                } else if (eventType === "complete") {
                  setSummary(data);
                  cancelled = true;
                  try {
                    const res = await fetch(`/api/preview/${jobId}`);
                    const pv  = await res.json();
                    setPreview(pv);
                    setActiveFile(pv.files?.[0] || null);
                  } catch (e) {
                    console.error("Preview failed:", e);
                  }
                  setState(STATE.DONE);
                } else if (eventType === "error") {
                  setErrorMsg(data.message || "Conversion failed");
                  setState(STATE.ERROR);
                  cancelled = true;
                }
              } catch (e) {
                console.error("Parse error:", e);
              }
              eventType = "";
              dataLine  = "";
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("SSE error:", e);
          setErrorMsg("Lost connection to server. Please try again.");
          setState(STATE.ERROR);
        }
      }
    }

    connectSSE();
    return () => { cancelled = true; };
  }, [jobId]);

  // ── Streaming ─────────────────────────────────────────────
  if (state === STATE.STREAMING) {
    return (
      <div style={styles.center}>
        <div style={styles.streamCard}>
          <h2 style={styles.streamTitle}>🤖 Agent is converting your repo...</h2>
          <ProgressStream events={events} pct={pct} />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (state === STATE.ERROR) {
    return (
      <div style={styles.center}>
        <div style={{ ...styles.streamCard, borderColor: "#f87171" }}>
          <h2 style={{ color: "#f87171" }}>⚠ Conversion Failed</h2>
          <p style={{ color: "#94a3b8", marginTop: "1rem" }}>{errorMsg}</p>
          <button style={styles.retryBtn} onClick={() => router.push("/")}>
            ← Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => router.push("/")}>
          ← New Conversion
        </button>
        <div style={styles.tabs}>
          {["code", "readme", "demo"].map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(activeTab === t ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(t)}
            >
              {t === "code" ? "💻 Code" : t === "readme" ? "📄 README" : "🚀 Demo"}
            </button>
          ))}
        </div>
        <DownloadButton jobId={jobId} />
      </div>

      {summary && <SummaryCard summary={summary} files={preview?.files || []} />}

      {activeTab === "code" && preview && (
        <div style={styles.panels}>
          <FileTree files={preview.files} activeFile={activeFile} onSelect={setActiveFile} />
          <CodePreview file={activeFile} />
        </div>
      )}
      {activeTab === "readme" && preview && (
        <div style={styles.textPanel}><pre style={styles.pre}>{preview.readme}</pre></div>
      )}
      {activeTab === "demo" && preview && (
        <div style={styles.textPanel}><pre style={styles.pre}>{preview.demo_script}</pre></div>
      )}
    </div>
  );
}

const styles = {
  center:      { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" },
  streamCard:  { background: "#1a1f35", border: "1px solid #2d3748", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "640px" },
  streamTitle: { fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" },
  retryBtn:    { marginTop: "1.5rem", background: "#2d3748", border: "none", color: "#e2e8f0", padding: "0.6rem 1.2rem", borderRadius: "6px", cursor: "pointer" },
  page:        { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topBar:      { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.5rem", background: "#1a1f35", borderBottom: "1px solid #2d3748", flexShrink: 0 },
  backBtn:     { background: "transparent", border: "1px solid #2d3748", color: "#94a3b8", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  tabs:        { display: "flex", gap: "0.5rem" },
  tab:         { background: "transparent", border: "1px solid #2d3748", color: "#64748b", padding: "0.4rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  tabActive:   { background: "#2d3748", color: "#e2e8f0", borderColor: "#4a5568" },
  panels:      { display: "flex", flex: 1, overflow: "hidden" },
  textPanel:   { flex: 1, overflow: "auto", padding: "1.5rem" },
  pre:         { fontFamily: "monospace", fontSize: "0.85rem", color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.7 },
};