import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend } from "recharts";

const API = "https://task-queue.hopto.org";
const TASK_TYPES = ["send_email", "resize_image", "generate_report", "data_sync", "failing_task"];

const C = {
  bg: "#0d1117", surface: "#161b22", border: "#30363d",
  text: "#e6edf3", muted: "#8b949e",
  blue: "#58a6ff", green: "#3fb950", red: "#f85149",
  amber: "#d29922", purple: "#bc8cff", teal: "#39d353",
  greenFade: "#238636",
};

const COLORS = [C.blue, C.green, C.amber, C.purple, C.red];

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px 20px", marginBottom: "16px" };
const label = { fontSize: "11px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" };
const CustomTooltip = ({ active, payload, label: l }) => active && payload?.length ? (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
    <p style={{ color: C.muted, margin: "0 0 4px" }}>{l}</p>
    {payload.map((p, i) => <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: {p.value}</p>)}
  </div>
) : null;

const statusColor = (s) => s === "completed" ? C.green : s === "failed" ? C.red : C.amber;
const statusBg = (s) => s === "completed" ? `${C.green}22` : s === "failed" ? `${C.red}22` : `${C.amber}22`;

export default function App() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [deadTasks, setDeadTasks] = useState([]);
  const [taskType, setTaskType] = useState("send_email");
  const [priority, setPriority] = useState(1);
  const [toast, setToast] = useState(null);
  const [trackId, setTrackId] = useState("");
  const [trackedTask, setTrackedTask] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchAll = useCallback(async () => {
    try {
      const [s, d, h, a] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/dead-letter`),
        axios.get(`${API}/stats/history`),
        axios.get(`${API}/analytics`),
      ]);
      setStats(s.data);
      setDeadTasks(d.data.failed_tasks || []);
      setHistory(h.data.history || []);
      setAnalytics(a.data);
      setLastUpdated(new Date());
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 5000); return () => clearInterval(id); }, [fetchAll]);

  const submitTask = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/tasks`, { task_type: taskType, payload: { to: "demo@example.com", filename: "photo.jpg" }, priority: parseInt(priority) });
      const id = res.data.task_id?.id || res.data.task_id;
      setTrackId(id);
      showToast(`Task queued — ID: ${id?.slice(0, 8)}…`, "success");
      fetchAll();
    } catch (e) { showToast(e?.response?.data?.detail?.[0]?.msg || "Failed to submit task", "error"); }
    finally { setSubmitting(false); }
  };

  const trackTask = async () => {
    if (!trackId.trim()) return;
    try { const res = await axios.get(`${API}/tasks/${trackId.trim()}`); setTrackedTask(res.data); }
    catch { setTrackedTask({ status: "not found" }); }
  };

  const clearDead = async () => { await axios.delete(`${API}/dead-letter`); fetchAll(); showToast("Dead letter queue cleared"); };
  const replayDead = async () => { await axios.post(`${API}/dead-letter/replay`); fetchAll(); showToast("Dead tasks requeued!"); };

  const successRate = stats?.total_tasks_processed > 0
    ? Math.round(((stats.total_tasks_processed - stats.dead_letter_queue) / stats.total_tasks_processed) * 100) : 100;

  const typeChartData = analytics ? Object.entries(analytics.task_type_counts).map(([name, value]) => ({ name, value })) : [];
  const workerChartData = analytics ? Object.entries(analytics.worker_counts).map(([name, value]) => ({ name, value })) : [];

  const inp = { width: "100%", padding: "8px 12px", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px", marginBottom: "10px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'); *{box-sizing:border-box} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}`}</style>

      {/* Navbar */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span style={{ fontSize: "15px", fontWeight: 600 }}>Distributed Task Queue</span>
          <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: `${C.green}22`, color: C.green, border: `1px solid ${C.green}44` }}>Live</span>
        </div>
        <a href={`${API}/docs`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: C.muted, textDecoration: "none" }}>API Docs →</a>
      </nav>

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Queue Monitor</h1>
        <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 28px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green, display: "inline-block", marginRight: "6px", animation: "pulse 2s infinite" }}/>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"} · auto-refreshes every 5s
        </p>

        {toast && <div style={{ padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px", background: toast.type === "success" ? `${C.green}11` : `${C.red}11`, border: `1px solid ${toast.type === "success" ? C.green+"44" : C.red+"44"}`, color: toast.type === "success" ? C.green : C.red }}>{toast.msg}</div>}

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "High Priority", value: stats?.high_priority_queue ?? "—", color: C.red },
            { label: "Normal Queue", value: stats?.normal_queue ?? "—", color: C.amber },
            { label: "Processing", value: stats?.processing ?? "—", color: C.blue },
            { label: "Dead Letter", value: stats?.dead_letter_queue ?? "—", color: C.muted },
            { label: "Total Processed", value: stats?.total_tasks_processed ?? "—", color: C.green },
            { label: "Avg Time (s)", value: stats?.avg_processing_time_seconds ?? "—", color: C.purple },
            { label: "Success Rate", value: `${successRate}%`, color: C.green },
          ].map(({ label: l, value, color }) => (
            <div key={l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px 20px" }}>
              <p style={{ fontSize: "11px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{l}</p>
              <p style={{ fontSize: "28px", fontWeight: 600, margin: 0, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Throughput Chart */}
        <div style={card}>
          <p style={label}>Live Throughput — tasks per 10s interval</p>
          {history.length === 0
            ? <p style={{ fontSize: "13px", color: C.muted }}>Collecting data — chart appears after 10 seconds…</p>
            : <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.muted }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="throughput" name="Processed" stroke={C.blue} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="queued" name="Queued" stroke={C.amber} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Task Type + Worker Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div style={card}>
            <p style={label}>Task Type Breakdown</p>
            {typeChartData.length === 0
              ? <p style={{ fontSize: "13px", color: C.muted }}>No tasks processed yet</p>
              : <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={typeChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.muted }} />
                    <YAxis tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]}>
                      {typeChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>

          <div style={card}>
            <p style={label}>Worker Utilization</p>
            {workerChartData.length === 0
              ? <p style={{ fontSize: "13px", color: C.muted }}>No tasks processed yet</p>
              : <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={workerChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} />
                    <YAxis tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Tasks" fill={C.teal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        </div>

        {/* Recent Task Feed */}
        <div style={card}>
          <p style={label}>Recent Task Activity</p>
          {!analytics?.recent_tasks?.length
            ? <p style={{ fontSize: "13px", color: C.muted }}>No recent tasks</p>
            : <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px 80px", gap: "8px", fontSize: "11px", color: C.muted, fontWeight: 600, marginBottom: "8px", padding: "0 4px" }}>
                  <span>Task ID</span><span>Type</span><span>Status</span><span>Duration</span><span>Time</span>
                </div>
                {analytics.recent_tasks.map((t, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px 80px", gap: "8px", fontSize: "12px", padding: "8px 4px", borderTop: `1px solid ${C.border}`, alignItems: "center" }}>
                    <span style={{ color: C.blue, fontFamily: "monospace" }}>{t.id?.slice(0, 8)}…</span>
                    <span style={{ color: C.text }}>{t.type}</span>
                    <span style={{ display: "inline-block", fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: statusBg(t.status), color: statusColor(t.status), border: `1px solid ${statusColor(t.status)}44` }}>{t.status}</span>
                    <span style={{ color: C.muted }}>{t.duration ? `${t.duration}s` : "—"}</span>
                    <span style={{ color: C.muted }}>{t.time}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Submit + Track */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div style={card}>
            <p style={label}>Submit Task</p>
            <select style={inp} value={taskType} onChange={e => setTaskType(e.target.value)}>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={inp} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value={1}>Normal priority</option>
              <option value={2}>High priority</option>
            </select>
            <button style={{ width: "100%", padding: "9px", background: C.greenFade, color: "#fff", border: "1px solid #2ea043", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: submitting ? 0.6 : 1 }} onClick={submitTask} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit task"}
            </button>
          </div>

          <div style={card}>
            <p style={label}>Track Task</p>
            <input style={inp} value={trackId} onChange={e => setTrackId(e.target.value)} placeholder="Paste task ID…" />
            <button style={{ width: "100%", padding: "9px", background: "transparent", color: C.blue, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }} onClick={trackTask}>Check status</button>
            {trackedTask && (
              <div style={{ marginTop: "12px", padding: "12px", background: C.bg, borderRadius: "6px", border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: statusBg(trackedTask.result?.status || "unknown"), color: statusColor(trackedTask.result?.status || "unknown"), border: `1px solid ${statusColor(trackedTask.result?.status || "unknown")}44` }}>
                  {(trackedTask.result?.status || trackedTask.status || "UNKNOWN").toUpperCase()}
                </span>
                {trackedTask.result?.duration_seconds && <p style={{ fontSize: "12px", color: C.muted, margin: "6px 0 0" }}>Duration: {trackedTask.result.duration_seconds}s · Worker: {trackedTask.result.worker}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Dead Letter Queue */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <p style={{ ...label, margin: 0 }}>Dead Letter Queue ({deadTasks.length})</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {deadTasks.length > 0 && <button style={{ padding: "5px 12px", background: "transparent", color: C.blue, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "11px", cursor: "pointer" }} onClick={replayDead}>Replay all</button>}
              {deadTasks.length > 0 && <button style={{ padding: "5px 12px", background: "transparent", color: C.red, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "11px", cursor: "pointer" }} onClick={clearDead}>Clear all</button>}
            </div>
          </div>
          {deadTasks.length === 0
            ? <p style={{ fontSize: "13px", color: C.muted, margin: 0 }}>No failed tasks — all clear.</p>
            : deadTasks.slice(0, 10).map((task, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: "8px", fontSize: "12px", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.red, fontFamily: "monospace" }}>{task.id?.slice(0, 8)}…</span>
                  <span>{task.type}</span>
                  <span style={{ color: C.muted }}>{task.retries}×</span>
                </div>
              ))
          }
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: C.muted, marginTop: "16px" }}>
          Redis · FastAPI · Python multiprocessing · AWS EC2 · GitHub Actions CI/CD
        </p>
      </main>
    </div>
  );
}
