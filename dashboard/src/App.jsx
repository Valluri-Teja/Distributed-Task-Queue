import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "https://task-queue.hopto.org";

const TASK_TYPES = ["send_email", "resize_image", "generate_report", "data_sync", "failing_task"];

// ── tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        "#0d1117",
  surface:   "#161b22",
  border:    "#30363d",
  borderHov: "#58a6ff",
  text:      "#e6edf3",
  muted:     "#8b949e",
  blue:      "#58a6ff",
  green:     "#3fb950",
  red:       "#f85149",
  amber:     "#d29922",
  purple:    "#bc8cff",
  blueFade:  "#1f6feb22",
  greenFade: "#238636",
  redFade:   "#da36326a",
};

const s = {
  app: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    background: C.bg,
    minHeight: "100vh",
    color: C.text,
    padding: "0",
  },
  nav: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "56px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  navLogo: { fontSize: "15px", fontWeight: 600, color: C.text, letterSpacing: "-0.02em" },
  navBadge: {
    fontSize: "11px", padding: "2px 8px", borderRadius: "12px",
    background: `${C.green}22`, color: C.green, fontWeight: 500,
    border: `1px solid ${C.green}44`,
  },
  navLink: {
    fontSize: "12px", color: C.muted, textDecoration: "none",
    display: "flex", alignItems: "center", gap: "6px",
  },
  main: { maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" },
  heading: { fontSize: "22px", fontWeight: 600, color: C.text, margin: "0 0 4px", letterSpacing: "-0.02em" },
  sub: { fontSize: "13px", color: C.muted, margin: "0 0 28px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "28px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px 20px" },
  statLabel: { fontSize: "11px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" },
  statValue: { fontSize: "28px", fontWeight: 600, margin: 0, lineHeight: 1 },
  sectionTitle: { fontSize: "13px", fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" },
  select: {
    width: "100%", padding: "8px 12px", background: C.bg, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px",
    marginBottom: "10px", outline: "none", cursor: "pointer",
  },
  input: {
    width: "100%", padding: "8px 12px", background: C.bg, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px",
    marginBottom: "10px", outline: "none", boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%", padding: "9px 16px", background: C.greenFade, color: "#fff",
    border: `1px solid #2ea043`, borderRadius: "6px", fontSize: "13px",
    fontWeight: 500, cursor: "pointer", transition: "opacity .15s",
  },
  btnSecondary: {
    width: "100%", padding: "9px 16px", background: "transparent", color: C.blue,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px",
    fontWeight: 500, cursor: "pointer",
  },
  btnDanger: {
    padding: "5px 12px", background: "transparent", color: C.red,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "11px",
    cursor: "pointer",
  },
  toast: {
    padding: "10px 14px", borderRadius: "6px", fontSize: "13px",
    marginBottom: "10px", border: `1px solid`,
  },
  tag: (color) => ({
    display: "inline-block", fontSize: "11px", padding: "2px 8px",
    borderRadius: "12px", fontWeight: 500,
    background: `${color}22`, color, border: `1px solid ${color}44`,
  }),
  dlRow: {
    padding: "10px 0", borderBottom: `1px solid ${C.border}`,
    display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: "8px",
    fontSize: "12px",
  },
  pulse: {
    width: "8px", height: "8px", borderRadius: "50%",
    background: C.green, display: "inline-block", marginRight: "6px",
    animation: "pulse 2s infinite",
  },
};

// ── helpers ──────────────────────────────────────────────────────────────
const statusColor = (s) =>
  s === "completed" ? C.green : s === "failed" || s === "dead" ? C.red : s === "processing" ? C.amber : C.muted;

// ── component ────────────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null);
  const [deadTasks, setDeadTasks] = useState([]);
  const [taskType, setTaskType] = useState("send_email");
  const [priority, setPriority] = useState(1);
  const [toast, setToast] = useState(null);
  const [trackId, setTrackId] = useState("");
  const [trackedTask, setTrackedTask] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/dead-letter`),
      ]);
      setStats(s.data);
      setDeadTasks(d.data.failed_tasks || []);
      setLastUpdated(new Date());
    } catch {
      // silent fail — keeps polling
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 3000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const submitTask = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/tasks`, {
        task_type: taskType,
        payload: { to: "demo@example.com", filename: "photo.jpg" },
        priority: parseInt(priority),
      });
      setTrackId(res.data.task_id.id || res.data.task_id);
      showToast(`Task queued — ID: ${(res.data.task_id.id || res.data.task_id).slice(0, 8)}…`, "success");
      fetchStats();
    } catch (e) {
      showToast(e?.response?.data?.detail?.[0]?.msg || "Failed to submit task", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const trackTask = async () => {
    if (!trackId.trim()) return;
    try {
      const res = await axios.get(`${API}/tasks/${trackId.trim()}`);
      setTrackedTask(res.data);
    } catch {
      setTrackedTask({ status: "not found" });
    }
  };

  const clearDead = async () => {
    await axios.delete(`${API}/dead-letter`);
    fetchStats();
    showToast("Dead letter queue cleared", "success");
  };

  const successRate = stats
    ? stats.total_tasks_processed > 0
      ? Math.round(((stats.total_tasks_processed - stats.dead_letter_queue) / stats.total_tasks_processed) * 100)
      : 100
    : null;

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        select:focus, input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px ${C.blueFade}; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
      `}</style>

      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span style={s.navLogo}>Distributed Task Queue</span>
          <span style={s.navBadge}>Live</span>
        </div>
        <a href={`${API}/docs`} target="_blank" rel="noreferrer" style={s.navLink}>
          API Docs →
        </a>
      </nav>

      <main style={s.main}>
        <h1 style={s.heading}>Queue Monitor</h1>
        <p style={s.sub}>
          <span style={s.pulse} />
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"} · auto-refreshes every 3s
        </p>

        {/* Toast */}
        {toast && (
          <div style={{
            ...s.toast,
            background: toast.type === "success" ? `${C.green}11` : `${C.red}11`,
            borderColor: toast.type === "success" ? `${C.green}44` : `${C.red}44`,
            color: toast.type === "success" ? C.green : C.red,
          }}>
            {toast.msg}
          </div>
        )}

        {/* Stat cards */}
        <div style={s.grid4}>
          {[
            { label: "High Priority", value: stats?.high_priority_queue ?? "—", color: C.red },
            { label: "Normal Queue",  value: stats?.normal_queue ?? "—",         color: C.amber },
            { label: "Processing",    value: stats?.total_tasks_processed ?? "—", color: C.blue },
            { label: "Dead Letter",   value: stats?.dead_letter_queue ?? "—",    color: C.muted },
            { label: "Total Processed", value: stats?.total_tasks_processed ?? "—", color: C.green },
            { label: "Avg Time (s)",  value: stats?.avg_processing_time_seconds ?? "—", color: C.purple },
            { label: "Success Rate",  value: successRate !== null ? `${successRate}%` : "—", color: C.green },
          ].map(({ label, value, color }) => (
            <div key={label} style={s.card}>
              <p style={s.statLabel}>{label}</p>
              <p style={{ ...s.statValue, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Submit + Track */}
        <div style={s.grid2}>
          {/* Submit */}
          <div style={s.card}>
            <p style={s.sectionTitle}>Submit Task</p>
            <select style={s.select} value={taskType} onChange={e => setTaskType(e.target.value)}>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={s.select} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value={1}>Normal priority</option>
              <option value={2}>High priority</option>
            </select>
            <button style={{ ...s.btnPrimary, opacity: submitting ? 0.6 : 1 }} onClick={submitTask} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit task"}
            </button>
          </div>

          {/* Track */}
          <div style={s.card}>
            <p style={s.sectionTitle}>Track Task</p>
            <input
              style={s.input}
              value={trackId}
              onChange={e => setTrackId(e.target.value)}
              placeholder="Paste task ID…"
            />
            <button style={s.btnSecondary} onClick={trackTask}>Check status</button>
            {trackedTask && (
              <div style={{ marginTop: "12px", padding: "12px", background: C.bg, borderRadius: "6px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={s.tag(statusColor(trackedTask.status))}>{trackedTask.status?.toUpperCase() || "UNKNOWN"}</span>
                </div>
                {trackedTask.type && <p style={{ fontSize: "12px", color: C.muted, margin: "4px 0" }}>Type: {trackedTask.type}</p>}
                {trackedTask.result && <p style={{ fontSize: "12px", color: C.muted, margin: "4px 0" }}>Duration: {trackedTask.result.duration_seconds}s · Worker: {trackedTask.result.worker}</p>}
                {trackedTask.error && <p style={{ fontSize: "12px", color: C.red, margin: "4px 0" }}>Error: {trackedTask.error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Dead Letter Queue */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <p style={{ ...s.sectionTitle, margin: 0 }}>Dead Letter Queue ({deadTasks.length})</p>
            {deadTasks.length > 0 && (
              <button style={s.btnDanger} onClick={clearDead}>Clear all</button>
            )}
          </div>
          {deadTasks.length === 0 ? (
            <p style={{ fontSize: "13px", color: C.muted, margin: 0 }}>No failed tasks — all clear.</p>
          ) : (
            <>
              <div style={{ ...s.dlRow, color: C.muted, fontWeight: 600 }}>
                <span>Task ID</span><span>Type</span><span>Retries</span>
              </div>
              {deadTasks.slice(0, 10).map((task, i) => (
                <div key={i} style={s.dlRow}>
                  <span style={{ color: C.red, fontFamily: "monospace" }}>{task.id?.slice(0, 8)}…</span>
                  <span style={{ color: C.text }}>{task.type}</span>
                  <span style={{ color: C.muted }}>{task.retries}×</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: C.muted, marginTop: "32px" }}>
          Redis · FastAPI · Python multiprocessing · AWS EC2 · GitHub Actions CI/CD
        </p>
      </main>
    </div>
  );
}
