import { useState, useEffect, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:       "#f5f0eb",
  surface:  "#ede8e1",
  border:   "#d4cfc8",
  borderSub:"#e8e3dc",
  ink:      "#1a1a18",
  inkMid:   "#4a4840",
  inkSub:   "#8a8478",
  inkMuted: "#b0a898",
  green:    "#2d6a4f",
  greenBg:  "#e8f3ed",
  amber:    "#b5630a",
  amberBg:  "#fdf3e3",
  red:      "#9b2226",
  redBg:    "#fae8e8",
  purple:   "#4a3aa7",
  purpleBg: "#ede8f5",
};

// ─── SHARED STYLES ─────────────────────────────────────────────────────────────
const S = {
  root:      { background: T.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: T.ink, minHeight: "100vh" },
  nav:       { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:`1px solid ${T.border}` },
  navBrand:  { fontSize:13, letterSpacing:"0.18em", textTransform:"uppercase", color: T.ink },
  navLinks:  { display:"flex", gap:0 },
  sectionLabel: { fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color: T.inkSub },
  mono:      { fontFamily:"'Courier New', monospace" },
  serif:     { fontFamily:"Georgia, 'Times New Roman', serif" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const LivePip = () => (
  <span style={{
    display:"inline-block", width:6, height:6, borderRadius:"50%",
    background: T.green, marginRight:6,
    animation:"pip 2s ease-in-out infinite"
  }} />
);

const NavLink = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
    color: active ? T.ink : T.inkSub,
    padding:"0 14px", background:"none", border:"none",
    borderRight:`1px solid ${T.border}`,
    cursor:"pointer", transition:"color 0.15s",
    display:"flex", alignItems:"center", gap:0
  }}>
    {active && <LivePip />}{label}
  </button>
);

const Kpi = ({ label, value, color, sub }) => (
  <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
    <div style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color: T.inkSub, marginBottom:8 }}>{label}</div>
    <div style={{ ...S.serif, fontSize:36, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1, color: color || T.ink, marginBottom:4 }}>{value}</div>
    <div style={{ fontSize:11, color: T.inkSub }}>{sub}</div>
  </div>
);

const SectionHead = ({ label, right }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
    <span style={S.sectionLabel}>{label}</span>
    {right}
  </div>
);

const WDot = ({ status }) => {
  const colors = { busy: T.green, idle: T.inkMuted, dead: T.red };
  return (
    <span style={{
      width:7, height:7, borderRadius:"50%", flexShrink:0,
      background: colors[status] || T.inkMuted,
      display:"inline-block",
      animation: status === "busy" ? "pip 1.4s ease-in-out infinite" : "none"
    }} />
  );
};

const Tag = ({ type }) => {
  const map = {
    busy:     { bg: T.greenBg,  color: T.green  },
    idle:     { bg: T.surface,  color: T.inkSub },
    dead:     { bg: T.redBg,    color: T.red    },
    info:     { bg: T.greenBg,  color: T.green  },
    warn:     { bg: T.amberBg,  color: T.amber  },
    error:    { bg: T.redBg,    color: T.red    },
    recovery: { bg: T.purpleBg, color: T.purple },
  };
  const s = map[type] || map.idle;
  return (
    <span style={{
      fontSize:9, letterSpacing:"0.07em", textTransform:"uppercase",
      padding:"2px 6px", borderRadius:2, flexShrink:0, whiteSpace:"nowrap",
      background: s.bg, color: s.color
    }}>{type}</span>
  );
};

const Btn = ({ children, onClick, danger }) => (
  <button onClick={onClick} style={{
    fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase",
    padding:"6px 14px", border:`1px solid ${T.border}`, borderRadius:2,
    background: "transparent", color: T.inkMid, cursor:"pointer",
    transition:"all 0.15s", marginLeft:8,
    fontFamily:"'Helvetica Neue', Arial, sans-serif"
  }}
    onMouseEnter={e => { e.target.style.background = danger ? T.red : T.ink; e.target.style.color = T.bg; e.target.style.borderColor = danger ? T.red : T.ink; }}
    onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = T.inkMid; e.target.style.borderColor = T.border; }}
  >{children}</button>
);

const EnqueueBtn = ({ onClick }) => (
  <button onClick={onClick} style={{
    fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase",
    padding:"6px 14px", background: T.ink, color: T.bg,
    border:"none", borderRadius:2, cursor:"pointer",
    fontFamily:"'Helvetica Neue', Arial, sans-serif",
    transition:"background 0.15s"
  }}
    onMouseEnter={e => e.target.style.background = "#3a3a36"}
    onMouseLeave={e => e.target.style.background = T.ink}
  >+ Enqueue</button>
);

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const TASK_TYPES = ["email:send","webhook:post","pdf:export","image:resize","report:gen","sms:send","cache:warm"];

const initTasks = {
  queued: [
    { id:"9f2a", name:"email:send",    meta:"high priority" },
    { id:"4c1e", name:"image:resize",  meta:"normal priority" },
    { id:"7b3d", name:"report:gen",    meta:"low priority" },
  ],
  processing: [
    { id:"2a8f", name:"webhook:post",  meta:"worker-1 · 4s",  retries:1 },
    { id:"5d6c", name:"pdf:export",    meta:"worker-2 · 1s",  retries:0 },
  ],
  success: [
    { id:"1a2b", name:"sms:send",      meta:"0.8s · worker-3" },
    { id:"8e4f", name:"cache:warm",    meta:"1.2s · worker-1" },
    { id:"3c9a", name:"db:backup",     meta:"14.3s · worker-2" },
  ],
  failed: [
    { id:"6b7d", name:"stripe:charge", meta:"timeout · exp backoff", retries:3 },
    { id:"0f1c", name:"notif:push",    meta:"conn refused",          retries:2 },
  ],
  dlq: [
    { id:"a3e2", name:"invoice:gen",   meta:"OOM · moved to DLQ",   retries:5 },
  ],
};

const WORKERS_DATA = {
  w1: { name:"worker-1", pid:"38204", mem:"48 MB", cpu:"12%", restarts:"0", status:"busy",  current:"webhook:post", uptime:"4h 12m", done:312,
    data:[4,6,5,7,8,7,9,8,10,9,11,8],
    logs:[
      {t:"21:14",type:"info",     msg:"Started task_2a8f webhook:post"},
      {t:"21:13",type:"info",     msg:"Completed task_ff01 email:send in 0.9s"},
      {t:"21:10",type:"info",     msg:"Completed task_cc82 image:resize in 2.1s"},
      {t:"21:07",type:"warn",     msg:"task_bb34 retry attempt 2 — backoff 4s"},
      {t:"21:02",type:"info",     msg:"Completed task_aa21 sms:send in 0.7s"},
    ]},
  w2: { name:"worker-2", pid:"38211", mem:"62 MB", cpu:"18%", restarts:"0", status:"busy",  current:"pdf:export",   uptime:"4h 12m", done:287,
    data:[3,5,6,5,7,8,6,9,8,10,9,11],
    logs:[
      {t:"21:14",type:"info",     msg:"Started task_5d6c pdf:export"},
      {t:"21:08",type:"warn",     msg:"task_5d6c exceeded p95 threshold (8.4s)"},
      {t:"21:01",type:"info",     msg:"Completed task_dd43 report:gen in 6.2s"},
      {t:"20:55",type:"info",     msg:"Completed task_ee12 pdf:export in 4.8s"},
      {t:"20:48",type:"info",     msg:"Completed task_ff99 db:backup in 14.3s"},
    ]},
  w3: { name:"worker-3", pid:"38219", mem:"31 MB", cpu:"1%",  restarts:"0", status:"idle",  current:"—",            uptime:"4h 12m", done:198,
    data:[5,6,4,7,6,8,7,5,4,2,1,0],
    logs:[
      {t:"21:09",type:"info",     msg:"Completed task_1a2b sms:send in 0.8s"},
      {t:"18:05",type:"recovery", msg:"Re-acquired task_6b7d after BRPOPLPUSH timeout"},
      {t:"18:04",type:"warn",     msg:"task_6b7d stall detected — re-queuing"},
    ]},
  w4: { name:"worker-4", pid:"41032", mem:"29 MB", cpu:"1%",  restarts:"1", status:"idle",  current:"—",            uptime:"2h 07m", done:251,
    data:[0,0,0,0,3,5,6,8,7,6,5,4],
    logs:[
      {t:"21:11",type:"info",     msg:"Completed task_3c9a db:backup in 14.3s"},
      {t:"19:00",type:"info",     msg:"Worker started by systemd after restart"},
      {t:"14:11",type:"recovery", msg:"Restarted by systemd after SIGKILL"},
      {t:"14:10",type:"error",    msg:"SIGKILL received — heap dump saved"},
    ]},
  w5: { name:"worker-5", pid:"—",     mem:"—",    cpu:"—",    restarts:"2", status:"dead",  current:"invoice:gen",  uptime:"crashed 2h ago", done:200,
    data:[6,7,8,7,9,8,6,5,4,3,1,0],
    logs:[
      {t:"19:42",type:"recovery", msg:"task_a3e2 moved to DLQ after 5 retries"},
      {t:"19:40",type:"error",    msg:"OOM killed — heap exceeded 512 MB"},
      {t:"19:38",type:"warn",     msg:"task_a3e2 exceeded 120s — watchdog fired"},
      {t:"19:35",type:"warn",     msg:"Memory at 480 MB — near limit"},
    ]},
};

const MT_PATTERNS = {
  w1:Array(30).fill("ok").map((_,i)=>i===23?"warn":"ok"),
  w2:Array(30).fill("ok").map((_,i)=>i===14?"warn":"ok"),
  w3:Array(30).fill("ok").map((_,i)=>i>=18?"idle":"ok"),
  w4:Array(30).fill("ok").map((_,i)=>i<8?"idle":"ok"),
  w5:Array(30).fill(0).map((_,i)=>i<7?"ok":i<11?"warn":i<13?"warn":"dead"),
};

const HM_DATA = [
  [1,2,1,0,1,2,3,4,4,3,4,4,3,4,3,4,4,3,4,4,3,2,2,1],
  [1,1,1,0,1,2,3,3,4,3,3,4,3,3,4,3,4,3,4,3,2,2,1,1],
  [0,0,0,0,1,2,2,3,3,4,3,3,3,3,3,3,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,3,3,3,3,2,2,1,0],
  [1,2,2,1,2,3,3,4,3,4,3,4,3,4,3,3,3,3,3,0,0,0,0,0],
];
const HM_COLORS = ["#e8e3dc","#c0d8c8","#7cb89a","#2d6a4f"];

// ─── SPARKLINE (pure canvas, no lib) ──────────────────────────────────────────
const Sparkline = ({ data, color = T.ink, height = 120 }) => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const c = ref.current;
    c.width  = c.offsetWidth * window.devicePixelRatio;
    c.height = height       * window.devicePixelRatio;
    const ctx = c.getContext("2d");
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = c.offsetWidth, H = height;
    const pad = { t:8, b:20, l:28, r:8 };
    const maxV = Math.max(...data, 1);
    const xs = data.map((_,i) => pad.l + i * (W - pad.l - pad.r) / (data.length - 1));
    const ys = data.map(v  => pad.t + (1 - v / maxV) * (H - pad.t - pad.b));

    // grid
    ctx.strokeStyle = T.borderSub; ctx.lineWidth = 0.5;
    [0, 0.5, 1].forEach(f => {
      const y = pad.t + f * (H - pad.t - pad.b);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    });

    // fill
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < data.length; i++) {
      const cpx = (xs[i-1] + xs[i]) / 2;
      ctx.bezierCurveTo(cpx, ys[i-1], cpx, ys[i], xs[i], ys[i]);
    }
    ctx.lineTo(xs[xs.length-1], H - pad.b);
    ctx.lineTo(xs[0], H - pad.b);
    ctx.closePath();
    ctx.fillStyle = color + "12"; ctx.fill();

    // line
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < data.length; i++) {
      const cpx = (xs[i-1] + xs[i]) / 2;
      ctx.bezierCurveTo(cpx, ys[i-1], cpx, ys[i], xs[i], ys[i]);
    }
    ctx.stroke();

    // dots + labels
    const labels = ["20:05","20:15","20:25","20:35","20:45","20:55","21:00"];
    const step = Math.floor((data.length - 1) / (labels.length - 1));
    data.forEach((v, i) => {
      if (i % step === 0 || i === data.length - 1) {
        ctx.beginPath(); ctx.arc(xs[i], ys[i], 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = T.inkMuted; ctx.font = `9px 'Helvetica Neue', Arial`;
        ctx.textAlign = "center";
        if (i === 0) ctx.textAlign = "left";
        if (i === data.length - 1) ctx.textAlign = "right";
        const li = Math.floor(i / step);
        if (labels[li]) ctx.fillText(labels[li], xs[i], H - 4);
      }
    });

    // y labels
    ctx.fillStyle = T.inkMuted; ctx.font = `9px 'Helvetica Neue', Arial`; ctx.textAlign = "right";
    [0, Math.round(maxV/2), maxV].forEach((v,i) => {
      const y = pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
      ctx.fillText(v, pad.l - 4, y + 3);
    });
  }, [data, color, height]);

  return <canvas ref={ref} style={{ width:"100%", height, display:"block" }} aria-label="Task throughput line chart" />;
};

// Donut (pure canvas)
const Donut = () => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const c = ref.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio;
    c.width = 100 * dpr; c.height = 100 * dpr;
    ctx.scale(dpr, dpr);
    const cx = 50, cy = 50, r = 36, w = 12;
    const segs = [{v:94,c:T.green},{v:4,c:T.amber},{v:2,c:T.red}];
    let angle = -Math.PI / 2;
    segs.forEach(s => {
      const end = angle + (s.v / 100) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, angle, end);
      ctx.arc(cx, cy, r - w, end, angle, true);
      ctx.closePath(); ctx.fillStyle = s.c; ctx.fill();
      angle = end;
    });
    // gap
    ctx.beginPath(); ctx.arc(cx, cy, r - w - 2, 0, Math.PI * 2);
    ctx.fillStyle = T.bg; ctx.fill();
  }, []);
  return <canvas ref={ref} style={{ width:100, height:100, flexShrink:0 }} aria-label="Donut chart: 94% success, 4% failed, 2% DLQ" />;
};

// ─── SCREEN 1: MONITOR ────────────────────────────────────────────────────────
const MonitorScreen = () => {
  const [tasks, setTasks] = useState(initTasks);
  const [selected, setSelected] = useState(null);
  const [counter, setCounter] = useState(100);

  const addTask = () => {
    const name = TASK_TYPES[counter % TASK_TYPES.length];
    const id = Math.random().toString(36).slice(2,6);
    setTasks(t => ({ ...t, queued: [{ id, name, meta:"normal priority" }, ...t.queued] }));
    setCounter(c => c + 1);
  };

  const replayTask = () => {
    const id = Math.random().toString(36).slice(2,6);
    setTasks(t => ({ ...t, queued: [{ id, name:"replayed:task", meta:"replayed · high priority" }, ...t.queued] }));
    setSelected(null);
  };

  const lanes = [
    { key:"queued",     label:"Queued",     dotColor: T.amber },
    { key:"processing", label:"Processing", dotColor: T.green, pulse:true },
    { key:"success",    label:"Done",       dotColor: T.green, dim:true },
    { key:"failed",     label:"Failed",     dotColor: T.red },
    { key:"dlq",        label:"DLQ",        dotColor: T.red, dimmer:true },
  ];

  const tlSteps = ["Enqueued","Attempt 1","Attempt 2","Attempt 3","DLQ"];

  return (
    <div>
      {/* Nav */}
      <div style={S.nav}>
        <div style={S.navBrand}>QueueViz</div>
        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
          <NavLink label="Monitor" active />
          <NavLink label="Analytics" />
          <NavLink label="Workers" />
        </div>
        <EnqueueBtn onClick={addTask} />
      </div>

      {/* Hero */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(4, auto)", borderBottom:`1px solid ${T.border}`, alignItems:"end" }}>
        <div style={{ padding:"28px 24px 20px" }}>
          <div style={{ ...S.serif, fontSize:52, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1, color: T.ink }}>
            Task<br/><em style={{ color: T.inkSub }}>Queue.</em>
          </div>
        </div>
        {[
          { label:"Queued",     val: tasks.queued.length,     color: T.amber },
          { label:"Processing", val: tasks.processing.length, color: T.green },
          { label:"Completed",  val: tasks.success.length,    color: T.ink   },
          { label:"Failed",     val: tasks.failed.length,     color: T.red   },
        ].map(k => (
          <div key={k.label} style={{ padding:"20px 24px", borderLeft:`1px solid ${T.border}`, textAlign:"right" }}>
            <div style={{ ...S.serif, fontSize:28, fontWeight:400, color: k.color, letterSpacing:"-0.02em", lineHeight:1, marginBottom:4 }}>{k.val}</div>
            <div style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color: T.inkSub }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, padding:"0 24px", overflowX:"auto" }}>
        {["All tasks","email","webhook","pdf","image","report"].map((t,i) => (
          <button key={t} style={{
            fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
            color: i===0 ? T.ink : T.inkSub, padding:"12px 16px 10px",
            background:"none", border:"none", borderBottom: i===0 ? `2px solid ${T.ink}` : "2px solid transparent",
            cursor:"pointer", whiteSpace:"nowrap"
          }}>{t}</button>
        ))}
      </div>

      {/* Swimlanes */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", borderBottom:`1px solid ${T.border}` }}>
        {lanes.map(lane => (
          <div key={lane.key} style={{ borderRight:`1px solid ${T.border}` }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"baseline", justifyContent:"space-between", background:"rgba(0,0,0,0.015)" }}>
              <span style={S.sectionLabel}>{lane.label}</span>
              <span style={{ ...S.serif, fontSize:13, color: T.ink }}>{tasks[lane.key].length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              {tasks[lane.key].map(task => (
                <div key={task.id} onClick={() => setSelected(task.id === selected?.id ? null : { ...task, laneKey: lane.key })}
                  style={{
                    padding:"12px 16px", borderBottom:`1px solid ${T.borderSub}`,
                    cursor:"pointer", background: selected?.id === task.id ? T.surface : "transparent",
                    transition:"background 0.12s"
                  }}
                  onMouseEnter={e => { if(selected?.id !== task.id) e.currentTarget.style.background = T.surface; }}
                  onMouseLeave={e => { if(selected?.id !== task.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, color: T.ink }}>{task.name}</span>
                    <span style={{
                      width:6, height:6, borderRadius:"50%", flexShrink:0, marginTop:5,
                      background: lane.dotColor, opacity: lane.dim ? 0.4 : lane.dimmer ? 0.6 : 1,
                      animation: lane.pulse ? "pip 1.2s ease-in-out infinite" : "none",
                      display:"inline-block"
                    }} />
                  </div>
                  <div style={{ ...S.mono, fontSize:10, color: T.inkMuted, marginBottom:2 }}>task_{task.id}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:10, color: T.inkSub }}>{task.meta}</span>
                    {task.retries > 0 && (
                      <span style={{ fontSize:9, padding:"1px 5px", borderRadius:2, background: T.redBg, color: T.red }}>{task.retries}×</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Workers bar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 24px", borderBottom:`1px solid ${T.border}`, flexWrap:"wrap" }}>
        <span style={S.sectionLabel}>Workers</span>
        {Object.values(WORKERS_DATA).map(w => (
          <div key={w.name} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color: T.inkMid, padding:"4px 10px", borderRadius:20, border:`1px solid ${T.border}` }}>
            <WDot status={w.status} />
            {w.name}
            {w.status === "dead" && <span style={{ fontSize:9, color: T.red }}>⚠</span>}
          </div>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, paddingLeft:20, borderLeft:`1px solid ${T.border}` }}>
          <span style={{ fontSize:10, color: T.inkSub }}>tasks/min</span>
          <span style={{ ...S.serif, fontSize:22, letterSpacing:"-0.02em" }}>23</span>
        </div>
      </div>

      {/* Inspector */}
      {selected && (() => {
        const rc = selected.laneKey === "dlq" ? 5 : selected.laneKey === "failed" ? selected.retries || 0 : 0;
        const canReplay = selected.laneKey === "dlq" || selected.laneKey === "failed";
        return (
          <div style={{ padding:"20px 24px", background: T.surface, borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ ...S.serif, fontSize:22, color: T.ink }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color: T.inkSub, background:"none", border:"none", cursor:"pointer" }}>Close ✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", border:`1px solid ${T.border}`, borderRadius:2, overflow:"hidden", marginBottom:16, background: T.bg }}>
              {[
                { l:"Task ID",  v:`task_${selected.id}` },
                { l:"Status",   v: selected.laneKey },
                { l:"Priority", v: selected.meta },
                { l:"Retries",  v: selected.retries ? `${selected.retries}×` : "none" },
              ].map((f,i) => (
                <div key={f.l} style={{ padding:"10px 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color: T.inkSub, marginBottom:4 }}>{f.l}</div>
                  <div style={{ ...S.mono, fontSize:12, color: T.ink }}>{f.v}</div>
                </div>
              ))}
            </div>
            {/* Timeline */}
            <div style={{ display:"flex", alignItems:"flex-start", marginBottom:16 }}>
              {tlSteps.map((step, i) => (
                <div key={step} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
                  {i < tlSteps.length - 1 && (
                    <div style={{ position:"absolute", top:8, left:"50%", width:"100%", height:1, background: T.border }} />
                  )}
                  <div style={{
                    width:16, height:16, borderRadius:"50%", border:`1px solid ${T.border}`,
                    background: i === 0 ? T.green : i <= rc ? T.red : T.bg,
                    position:"relative", zIndex:1, marginBottom:6, display:"flex", alignItems:"center", justifyContent:"center"
                  }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background: T.bg }} />
                  </div>
                  <div style={{ fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase", color: T.inkSub, textAlign:"center" }}>{step}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={replayTask} disabled={!canReplay} style={{
                fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
                padding:"7px 16px", background: canReplay ? T.ink : T.border,
                color: canReplay ? T.bg : T.inkMuted, border:"none", borderRadius:2, cursor: canReplay ? "pointer" : "default",
                fontFamily:"'Helvetica Neue', Arial, sans-serif"
              }}>↑ Replay from DLQ</button>
              <span style={{ fontSize:10, color: T.inkMuted }}>
                {canReplay ? "Re-enqueues with fresh backoff" : "Only available for failed and DLQ tasks"}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── SCREEN 2: ANALYTICS ──────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const [range, setRange] = useState("6h");

  const datasets = {
    "6h":  { data:[48,62,55,80,73,91,87,104,98,112,88,95],  label:"last 6 hours" },
    "24h": { data:[12,8,5,18,42,78,91,104,98,88,72,55],     label:"last 24 hours" },
    "7d":  { data:[520,680,710,640,890,340,210],             label:"last 7 days" },
  };

  const handlers = [
    { name:"email:send",   count:312, pct:88 },
    { name:"webhook:post", count:234, pct:66 },
    { name:"pdf:export",   count:191, pct:54 },
    { name:"image:resize", count:149, pct:42 },
    { name:"report:gen",   count:98,  pct:28 },
    { name:"sms:send",     count:64,  pct:18 },
  ];

  const latencies = [
    { name:"db:backup",    val:"14.3s", pct:95, color: T.amber },
    { name:"report:gen",   val:"8.1s",  pct:60, color: T.amber },
    { name:"pdf:export",   val:"4.8s",  pct:36, color: T.ink },
    { name:"image:resize", val:"2.6s",  pct:20, color: T.ink },
    { name:"webhook:post", val:"1.2s",  pct:10, color: T.ink },
    { name:"email:send",   val:"0.8s",  pct:6,  color: T.ink },
  ];

  return (
    <div>
      <div style={S.nav}>
        <div style={S.navBrand}>QueueViz <span style={{ color: T.inkMuted }}>/ Analytics</span></div>
        <div style={{ display:"flex" }}>
          <NavLink label="Monitor" />
          <NavLink label="Analytics" active />
          <NavLink label="Workers" />
        </div>
        <div style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color: T.inkMuted }}>Since midnight</div>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:`1px solid ${T.border}` }}>
        <Kpi label="Tasks today"   value="1,248" sub="↑ 12% vs yesterday" />
        <Kpi label="Success rate"  value="94.2%" color={T.green} sub="↑ 1.4pp vs yesterday" />
        <Kpi label="Avg latency"   value="1.8s"  color={T.amber} sub="p95 = 8.4s" />
        <Kpi label="DLQ size"      value="7"     color={T.red}   sub="↑ 3 since midnight" style={{ borderRight:"none" }} />
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
          <SectionHead label={`Throughput — tasks / hour · ${datasets[range].label}`} right={
            <div style={{ display:"flex" }}>
              {["6h","24h","7d"].map((r,i) => (
                <button key={r} onClick={() => setRange(r)} style={{
                  fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase",
                  color: range===r ? T.bg : T.inkSub,
                  padding:"2px 8px", cursor:"pointer",
                  background: range===r ? T.ink : T.bg,
                  border:`1px solid ${T.border}`,
                  borderRight: i<2 ? "none" : `1px solid ${T.border}`,
                  borderRadius: i===0?"2px 0 0 2px":i===2?"0 2px 2px 0":"0",
                  fontFamily:"'Helvetica Neue', Arial, sans-serif"
                }}>{r}</button>
              ))}
            </div>
          } />
          <Sparkline data={datasets[range].data} height={180} />
        </div>
        <div style={{ padding:"20px 24px" }}>
          <SectionHead label="Outcome split" />
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <Donut />
            <div style={{ display:"flex", flexDirection:"column", gap:10, flex:1 }}>
              {[{c:T.green,l:"Success",p:"94%"},{c:T.amber,l:"Failed",p:"4%"},{c:T.red,l:"DLQ",p:"2%"}].map(s => (
                <div key={s.l} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color: T.inkMid }}>
                  <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: s.c, display:"inline-block" }} />{s.l}
                  </span>
                  <span style={{ ...S.mono, fontSize:10, color: T.inkSub }}>{s.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderBottom:`1px solid ${T.border}` }}>
        {/* Handlers */}
        <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
          <SectionHead label="Top handlers" />
          {handlers.map(h => (
            <div key={h.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:11, color: T.inkMid, width:88, flexShrink:0 }}>{h.name}</span>
              <div style={{ flex:1, height:3, background: T.borderSub, borderRadius:1, overflow:"hidden" }}>
                <div style={{ width:`${h.pct}%`, height:"100%", background: T.ink, borderRadius:1 }} />
              </div>
              <span style={{ ...S.mono, fontSize:11, color: T.inkSub, width:28, textAlign:"right" }}>{h.count}</span>
            </div>
          ))}
        </div>

        {/* Worker health */}
        <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
          <SectionHead label="Worker health" />
          {Object.values(WORKERS_DATA).map(w => (
            <div key={w.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.borderSub}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, ...S.mono, color: T.inkMid }}>
                <WDot status={w.status} />{w.name}
              </div>
              <span style={{ fontSize:10, color: T.inkSub, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.current}</span>
              <span style={{ ...S.mono, fontSize:10, color: T.inkMuted }}>{w.uptime}</span>
            </div>
          ))}
        </div>

        {/* Latency */}
        <div style={{ padding:"20px 24px" }}>
          <SectionHead label="Latency by handler" />
          {latencies.map(h => (
            <div key={h.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:11, color: T.inkMid, width:88, flexShrink:0 }}>{h.name}</span>
              <div style={{ flex:1, height:3, background: T.borderSub, borderRadius:1, overflow:"hidden" }}>
                <div style={{ width:`${h.pct}%`, height:"100%", background: h.color, borderRadius:1 }} />
              </div>
              <span style={{ ...S.mono, fontSize:11, color: T.inkSub, width:34, textAlign:"right" }}>{h.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:10, letterSpacing:"0.06em", textTransform:"uppercase", color: T.inkMuted }}>Last updated: just now · auto-refresh every 30s</span>
        <Btn>Export CSV</Btn>
      </div>
    </div>
  );
};

// ─── SCREEN 3: WORKERS ────────────────────────────────────────────────────────
const WorkersScreen = () => {
  const [selectedW, setSelectedW] = useState("w1");
  const w = WORKERS_DATA[selectedW];
  const lineColor = w.status === "dead" ? T.red : w.status === "idle" ? T.inkMuted : T.ink;

  const MiniTimeline = ({ wid }) => (
    <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.borderSub}` }}>
      <div style={{ fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase", color: T.inkMuted, marginBottom:6 }}>Last 30 min</div>
      <div style={{ display:"flex", gap:2, height:12 }}>
        {MT_PATTERNS[wid].map((s,i) => (
          <div key={i} style={{
            flex:1, borderRadius:1,
            background: s==="ok"?"#2d6a4f": s==="warn"?"#b5630a": s==="dead"?"#9b2226": T.border,
            opacity: s==="ok"?0.65: s==="idle"?0.4: 0.85
          }} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={S.nav}>
        <div style={S.navBrand}>QueueViz <span style={{ color: T.inkMuted }}>/ Workers</span></div>
        <div style={{ display:"flex" }}>
          <NavLink label="Monitor" />
          <NavLink label="Analytics" />
          <NavLink label="Workers" active />
        </div>
        <div style={{ display:"flex" }}>
          <Btn>Restart all</Btn>
          <Btn danger>Drain queue</Btn>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:`1px solid ${T.border}` }}>
        <Kpi label="Active workers" value="2 / 5" color={T.green} sub="3 idle · 1 crashed" />
        <Kpi label="Total processed" value="1,248" sub="since midnight" />
        <Kpi label="Avg task duration" value="1.8s" color={T.amber} sub="p95 = 8.4s" />
        <Kpi label="Crashes today" value="1" color={T.red} sub="worker-5 · 2h ago" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:`1px solid ${T.border}` }}>

        {/* Left — worker list */}
        <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
          <SectionHead label="All workers" right={<span style={{ fontSize:10, color: T.inkMuted }}>click to inspect</span>} />
          {Object.entries(WORKERS_DATA).map(([wid, wd]) => (
            <div key={wid} onClick={() => setSelectedW(wid)}
              style={{
                border:`1px solid ${selectedW===wid ? T.ink : T.border}`,
                borderRadius:2, marginBottom:10, cursor:"pointer",
                background: selectedW===wid ? T.surface : T.bg,
                transition:"border-color 0.15s, background 0.15s"
              }}
            >
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid ${T.borderSub}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, ...S.mono, color: T.ink }}>
                  <WDot status={wd.status} />{wd.name}
                </div>
                <Tag type={wd.status} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", padding:"10px 14px", gap:8 }}>
                {[
                  { l: wd.status==="dead"?"Last task":"Current task", v: wd.current },
                  { l:"Uptime",     v: wd.uptime },
                  { l:"Done today", v: wd.done },
                ].map(f => (
                  <div key={f.l}>
                    <div style={{ fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", color: T.inkMuted, marginBottom:2 }}>{f.l}</div>
                    <div style={{ fontSize:12, ...S.mono, color: T.inkMid }}>{f.v}</div>
                  </div>
                ))}
              </div>
              <MiniTimeline wid={wid} />
            </div>
          ))}
        </div>

        {/* Right — detail */}
        <div style={{ padding:"20px 24px" }}>
          <SectionHead label={`${w.name} — detail`} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", border:`1px solid ${T.border}`, borderRadius:2, overflow:"hidden", marginBottom:16, background: T.bg }}>
            {[
              { l:"PID",      v: w.pid },
              { l:"Memory",   v: w.mem },
              { l:"CPU",      v: w.cpu },
              { l:"Restarts", v: w.restarts },
            ].map((f,i) => (
              <div key={f.l} style={{ padding:"10px 14px", borderRight: i<3 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color: T.inkSub, marginBottom:4 }}>{f.l}</div>
                <div style={{ ...S.mono, fontSize:12, color: T.ink }}>{f.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <span style={S.sectionLabel}>Tasks / 5 min</span>
            <span style={{ fontSize:10, color: T.inkMuted }}>last hour</span>
          </div>
          <Sparkline key={selectedW} data={w.data} color={lineColor} height={120} />

          <div style={{ marginTop:16, marginBottom:10, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color: T.inkSub }}>Event log</div>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:2, overflow:"hidden" }}>
            {w.logs.map((log, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"baseline", gap:12, padding:"8px 14px",
                borderBottom: i < w.logs.length-1 ? `1px solid ${T.borderSub}` : "none",
                transition:"background 0.12s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ ...S.mono, fontSize:10, color: T.inkMuted, flexShrink:0, width:42 }}>{log.t}</span>
                <Tag type={log.type} />
                <span style={{ ...S.mono, fontSize:11, color: T.inkMid }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap + watchdog */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
        <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
          <SectionHead label="Utilization heatmap — all workers · 24h" />
          {Object.entries(WORKERS_DATA).map(([wid,wd],wi) => (
            <div key={wid} style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center" }}>
              <span style={{ fontSize:9, ...S.mono, color: T.inkSub, width:60, flexShrink:0 }}>{wd.name}</span>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(24,1fr)", gap:2, flex:1 }}>
                {HM_DATA[wi].map((v,i) => (
                  <div key={i} style={{ height:16, borderRadius:1, background: HM_COLORS[v] }} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10 }}>
            <span style={{ fontSize:9, color: T.inkMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>Low</span>
            {HM_COLORS.map(c => <div key={c} style={{ width:12, height:12, borderRadius:1, background:c }} />)}
            <span style={{ fontSize:9, color: T.inkMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>High</span>
          </div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          <SectionHead label="Watchdog recovery events" />
          <div style={{ border:`1px solid ${T.border}`, borderRadius:2, overflow:"hidden" }}>
            {[
              {t:"19:42", type:"recovery", msg:"worker-5 task_a3e2 moved to DLQ after 5 retries"},
              {t:"19:40", type:"error",    msg:"worker-5 OOM killed — heap exceeded 512 MB"},
              {t:"19:38", type:"warn",     msg:"worker-5 task_a3e2 exceeded 120s — watchdog fired"},
              {t:"18:05", type:"recovery", msg:"worker-3 re-acquired task_6b7d after BRPOPLPUSH"},
              {t:"16:22", type:"warn",     msg:"worker-2 pdf:export exceeded p95 threshold (8.4s)"},
              {t:"14:11", type:"recovery", msg:"worker-4 restarted by systemd after SIGKILL"},
            ].map((log,i,a) => (
              <div key={i} style={{
                display:"flex", alignItems:"baseline", gap:12, padding:"8px 14px",
                borderBottom: i<a.length-1 ? `1px solid ${T.borderSub}` : "none",
                transition:"background 0.12s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ ...S.mono, fontSize:10, color: T.inkMuted, flexShrink:0, width:42 }}>{log.t}</span>
                <Tag type={log.type} />
                <span style={{ ...S.mono, fontSize:11, color: T.inkMid }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── APP SHELL ─────────────────────────────────────────────────────────────────
export default function QueueViz() {
  const [screen, setScreen] = useState("monitor");

  return (
    <>
      <style>{`
        @keyframes pip { 0%,100%{opacity:1} 50%{opacity:.2} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4cfc8; border-radius: 3px; }
      `}</style>

      {/* Global nav to switch screens */}
      <div style={{ background: T.ink, display:"flex", gap:0, padding:"0 24px" }}>
        {[["monitor","Monitor"],["analytics","Analytics"],["workers","Workers"]].map(([key,label]) => (
          <button key={key} onClick={() => setScreen(key)} style={{
            fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
            padding:"10px 16px", background:"none",
            color: screen===key ? T.bg : "rgba(255,255,255,0.4)",
            border:"none", borderBottom: screen===key ? `2px solid ${T.bg}` : "2px solid transparent",
            cursor:"pointer", fontFamily:"'Helvetica Neue', Arial, sans-serif"
          }}>{label}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center" }}>
          QueueViz — Distributed Task Queue Debugger
        </span>
      </div>

      <div style={S.root}>
        {screen === "monitor"   && <MonitorScreen />}
        {screen === "analytics" && <AnalyticsScreen />}
        {screen === "workers"   && <WorkersScreen />}
      </div>
    </>
  );
}
