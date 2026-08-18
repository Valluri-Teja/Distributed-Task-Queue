import { useState, useEffect, useRef } from "react";
const BACKEND = "http://3.108.42.154:8000";

const FontLoader = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');`}</style>
);

const T = {
  bg:       "#f5f0eb",
  surface:  "#ede8e1",
  border:   "#d4cfc8",
  borderSub:"#e8e3dc",
  ink:      "#111110",
  inkMid:   "#3d3d3a",
  inkSub:   "#6f6e69",
  inkMuted: "#a8a49e",
  green:    "#1a7a4a",
  greenBg:  "#d4f0e2",
  amber:    "#c45c00",
  amberBg:  "#fce8d0",
  red:      "#c01c1c",
  redBg:    "#fdd8d8",
  purple:   "#4a3aa7",
  purpleBg: "#e4e0f8",
};

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

const S = {
  root:         { background:T.bg, fontFamily:FONT, color:T.ink, height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column" },
  sectionLabel: { fontSize:11, fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", color:T.inkSub },
  mono:         { fontFamily:"'Courier New', monospace" },
};

const LivePip = () => (
  <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:T.green, marginRight:6, animation:"pip 2s ease-in-out infinite" }} />
);

const Kpi = ({ label, value, color, sub }) => (
  <div style={{ padding:"20px 24px", borderRight:`1px solid ${T.border}` }}>
    <div style={{ fontSize:11, fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", color:T.inkSub, marginBottom:8 }}>{label}</div>
    <div style={{ fontSize:34, fontWeight:600, letterSpacing:"-0.02em", lineHeight:1, color:color||T.ink, marginBottom:4 }}>{value}</div>
    <div style={{ fontSize:12, color:T.inkSub }}>{sub}</div>
  </div>
);

const SectionHead = ({ label, right }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
    <span style={S.sectionLabel}>{label}</span>
    {right}
  </div>
);

const WDot = ({ status }) => {
  const colors = { busy:T.green, idle:T.inkMuted, dead:T.red };
  return <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background:colors[status]||T.inkMuted, display:"inline-block", animation:status==="busy"?"pip 1.4s ease-in-out infinite":"none" }} />;
};

const Tag = ({ type }) => {
  const map = {
    busy:     { bg:T.greenBg,  color:T.green  },
    idle:     { bg:T.surface,  color:T.inkSub },
    dead:     { bg:T.redBg,    color:T.red    },
    info:     { bg:T.greenBg,  color:T.green  },
    warn:     { bg:T.amberBg,  color:T.amber  },
    error:    { bg:T.redBg,    color:T.red    },
    recovery: { bg:T.purpleBg, color:T.purple },
  };
  const s = map[type]||map.idle;
  return <span style={{ fontSize:10, fontWeight:500, letterSpacing:"0.05em", textTransform:"uppercase", padding:"2px 7px", borderRadius:4, flexShrink:0, whiteSpace:"nowrap", background:s.bg, color:s.color }}>{type}</span>;
};

const Btn = ({ children, onClick, danger }) => (
  <button onClick={onClick} style={{ fontSize:11, fontWeight:500, padding:"6px 14px", border:`1px solid ${T.border}`, borderRadius:6, background:"transparent", color:T.inkMid, cursor:"pointer", transition:"all 0.15s", marginLeft:8, fontFamily:FONT }}
    onMouseEnter={e=>{ e.currentTarget.style.background=danger?T.red:T.ink; e.currentTarget.style.color=T.bg; e.currentTarget.style.borderColor=danger?T.red:T.ink; }}
    onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=T.inkMid; e.currentTarget.style.borderColor=T.border; }}
  >{children}</button>
);

const EnqueueBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ fontSize:12, fontWeight:500, padding:"7px 16px", background:T.ink, color:T.bg, border:"none", borderRadius:6, cursor:"pointer", fontFamily:FONT, transition:"background 0.15s" }}
    onMouseEnter={e=>e.currentTarget.style.background="#2a2a28"}
    onMouseLeave={e=>e.currentTarget.style.background=T.ink}
  >+ Enqueue</button>
);

const TASK_TYPES = ["email:send","webhook:post","pdf:export","image:resize","report:gen","sms:send","cache:warm"];

const EMPTY_TASKS = { queued:[], processing:[], success:[], failed:[], dlq:[] };

const PAYLOADS = {
  "email:send":    { to:"user@example.com", subject:"Welcome aboard", template:"onboarding_v2" },
  "image:resize":  { src:"uploads/photo.jpg", widths:[320,640,1280], format:"webp" },
  "report:gen":    { reportId:"rpt_7b3d", range:"2026-08-01..2026-08-12", format:"pdf" },
  "webhook:post":  { url:"https://hooks.acme.com/task", method:"POST", timeout:30 },
  "pdf:export":    { docId:"doc_5d6c", pages:"all", compress:true },
  "sms:send":      { to:"+919876543210", body:"Your order is confirmed." },
  "cache:warm":    { keys:["user:*","product:featured"], ttl:3600 },
  "db:backup":     { db:"postgres", bucket:"s3://backups", compress:true },
  "stripe:charge": { customerId:"cus_Xyz123", amount:4999, currency:"inr" },
  "notif:push":    { userId:"usr_882", title:"New message", badge:3 },
  "invoice:gen":   { invoiceId:"inv_a3e2", customerId:"cus_Abc456", items:14 },
};

const RECENT_ACTIVITY = [
  { t:"21:14", type:"info",     msg:"task_2a8f webhook:post picked up by worker-1" },
  { t:"21:13", type:"info",     msg:"task_ff01 email:send completed in 0.9s" },
  { t:"21:10", type:"warn",     msg:"task_bb34 retry attempt 2 — backoff 4s" },
  { t:"21:07", type:"error",    msg:"task_6b7d stripe:charge failed — timeout" },
  { t:"21:02", type:"info",     msg:"task_aa21 sms:send completed in 0.7s" },
  { t:"20:58", type:"recovery", msg:"task_a3e2 moved to DLQ after 5 retries" },
  { t:"20:55", type:"info",     msg:"task_8e4f cache:warm completed in 1.2s" },
  { t:"20:48", type:"warn",     msg:"worker-5 memory at 480MB — near limit" },
];

const MOCK_WORKERS = [
  { name:"worker-1", status:"busy",  current:"webhook:post", uptime:"4h 12m", done:312, pid:"38204", mem:"48 MB", cpu:"12%", restarts:"0", data:[4,6,5,7,8,7,9,8,10,9,11,8], logs:[{t:"21:14",type:"info",msg:"Started task_2a8f webhook:post"},{t:"21:13",type:"info",msg:"Completed email:send in 0.9s"},{t:"21:07",type:"warn",msg:"retry attempt 2 — backoff 4s"}] },
  { name:"worker-2", status:"busy",  current:"pdf:export",   uptime:"4h 12m", done:287, pid:"38211", mem:"62 MB", cpu:"18%", restarts:"0", data:[3,5,6,5,7,8,6,9,8,10,9,11], logs:[{t:"21:14",type:"info",msg:"Started task_5d6c pdf:export"},{t:"21:08",type:"warn",msg:"exceeded p95 threshold (8.4s)"}] },
  { name:"worker-3", status:"idle",  current:"—",            uptime:"4h 12m", done:198, pid:"38219", mem:"31 MB", cpu:"1%",  restarts:"0", data:[5,6,4,7,6,8,7,5,4,2,1,0],  logs:[{t:"21:09",type:"info",msg:"Completed sms:send in 0.8s"},{t:"18:05",type:"recovery",msg:"Re-acquired task after BRPOPLPUSH"}] },
  { name:"worker-4", status:"idle",  current:"—",            uptime:"2h 07m", done:251, pid:"41032", mem:"29 MB", cpu:"1%",  restarts:"1", data:[0,0,0,0,3,5,6,8,7,6,5,4],  logs:[{t:"19:00",type:"info",msg:"Worker started by systemd"},{t:"14:11",type:"recovery",msg:"Restarted after SIGKILL"}] },
  { name:"worker-5", status:"dead",  current:"invoice:gen",  uptime:"crashed", done:200, pid:"—",     mem:"—",    cpu:"—",    restarts:"2", data:[6,7,8,7,9,8,6,5,4,3,1,0],  logs:[{t:"19:40",type:"error",msg:"OOM killed — heap exceeded 512 MB"},{t:"19:38",type:"warn",msg:"exceeded 120s — watchdog fired"}] },
];

const MT_PATTERNS = {
  "worker-1": Array(30).fill("ok").map((_,i)=>i===23?"warn":"ok"),
  "worker-2": Array(30).fill("ok").map((_,i)=>i===14?"warn":"ok"),
  "worker-3": Array(30).fill("ok").map((_,i)=>i>=18?"idle":"ok"),
  "worker-4": Array(30).fill("ok").map((_,i)=>i<8?"idle":"ok"),
  "worker-5": Array(30).fill(0).map((_,i)=>i<7?"ok":i<11?"warn":"dead"),
};

const HM_DATA = [
  [1,2,1,0,1,2,3,4,4,3,4,4,3,4,3,4,4,3,4,4,3,2,2,1],
  [1,1,1,0,1,2,3,3,4,3,3,4,3,3,4,3,4,3,4,3,2,2,1,1],
  [0,0,0,0,1,2,2,3,3,4,3,3,3,3,3,3,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,3,3,3,3,2,2,1,0],
  [1,2,2,1,2,3,3,4,3,4,3,4,3,4,3,3,3,3,3,0,0,0,0,0],
];
const HM_COLORS = ["#e8e3dc","#c0d8c8","#7cb89a","#1a7a4a"];

const Sparkline = ({ data, color=T.ink, height=120 }) => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const c = ref.current;
    c.width = c.offsetWidth * window.devicePixelRatio;
    c.height = height * window.devicePixelRatio;
    const ctx = c.getContext("2d");
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W=c.offsetWidth, H=height, pad={t:8,b:20,l:28,r:8};
    const maxV=Math.max(...data,1);
    const xs=data.map((_,i)=>pad.l+i*(W-pad.l-pad.r)/(data.length-1));
    const ys=data.map(v=>pad.t+(1-v/maxV)*(H-pad.t-pad.b));
    ctx.strokeStyle=T.borderSub; ctx.lineWidth=0.5;
    [0,0.5,1].forEach(f=>{ const y=pad.t+f*(H-pad.t-pad.b); ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
    for(let i=1;i<data.length;i++){const cpx=(xs[i-1]+xs[i])/2; ctx.bezierCurveTo(cpx,ys[i-1],cpx,ys[i],xs[i],ys[i]);}
    ctx.lineTo(xs[xs.length-1],H-pad.b); ctx.lineTo(xs[0],H-pad.b); ctx.closePath();
    ctx.fillStyle=color+"12"; ctx.fill();
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.moveTo(xs[0],ys[0]);
    for(let i=1;i<data.length;i++){const cpx=(xs[i-1]+xs[i])/2; ctx.bezierCurveTo(cpx,ys[i-1],cpx,ys[i],xs[i],ys[i]);}
    ctx.stroke();
    const labels=["20:05","20:15","20:25","20:35","20:45","20:55","21:00"];
    const step=Math.floor((data.length-1)/(labels.length-1));
    data.forEach((v,i)=>{ if(i%step===0||i===data.length-1){ ctx.beginPath(); ctx.arc(xs[i],ys[i],2.5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.fillStyle=T.inkMuted; ctx.font=`9px Inter,Arial`; ctx.textAlign=i===0?"left":i===data.length-1?"right":"center"; const li=Math.floor(i/step); if(labels[li]) ctx.fillText(labels[li],xs[i],H-4); }});
    ctx.fillStyle=T.inkMuted; ctx.font=`9px Inter,Arial`; ctx.textAlign="right";
    [0,Math.round(maxV/2),maxV].forEach(v=>{ const y=pad.t+(1-v/maxV)*(H-pad.t-pad.b); ctx.fillText(v,pad.l-4,y+3); });
  },[data,color,height]);
  return <canvas ref={ref} style={{width:"100%",height,display:"block"}} />;
};

const Donut = () => {
  const ref = useRef();
  useEffect(() => {
    if(!ref.current) return;
    const c=ref.current, ctx=c.getContext("2d"), dpr=window.devicePixelRatio;
    c.width=100*dpr; c.height=100*dpr; ctx.scale(dpr,dpr);
    const segs=[{v:94,c:T.green},{v:4,c:T.amber},{v:2,c:T.red}];
    let angle=-Math.PI/2;
    segs.forEach(s=>{ const end=angle+(s.v/100)*Math.PI*2; ctx.beginPath(); ctx.arc(50,50,36,angle,end); ctx.arc(50,50,24,end,angle,true); ctx.closePath(); ctx.fillStyle=s.c; ctx.fill(); angle=end; });
    ctx.beginPath(); ctx.arc(50,50,22,0,Math.PI*2); ctx.fillStyle=T.bg; ctx.fill();
  },[]);
  return <canvas ref={ref} style={{width:100,height:100,flexShrink:0}} />;
};

// ─── MONITOR ─────────────────────────────────────────────────────────────────
const MonitorScreen = () => {
  const [tasks, setTasks]     = useState(EMPTY_TASKS);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("All tasks");
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/tasks/v2`);
        const data = await res.json();
        setTasks(data);
      } catch(e) {
        console.error("Failed to fetch tasks:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const addTask = async () => {
    const types = TASK_TYPES;
    const name = types[counter % types.length];
    setCounter(c => c + 1);
    try {
      await fetch(`${BACKEND}/api/tasks/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: name, payload: PAYLOADS[name] || {}, priority: 1 }),
      });
    } catch(e) { console.error("Enqueue failed:", e); }
  };

  const replayTask = async () => {
    if (!selected) return;
    try {
      await fetch(`${BACKEND}/api/tasks/${selected.id}/replay`, { method: "POST" });
      setSelected(null);
    } catch(e) { console.error("Replay failed:", e); }
  };

  const lanes = [
    { key:"queued",     label:"Queued",     dotColor:T.amber },
    { key:"processing", label:"Processing", dotColor:T.green, pulse:true },
    { key:"success",    label:"Done",       dotColor:T.green, dim:true },
    { key:"failed",     label:"Failed",     dotColor:T.red },
    { key:"dlq",        label:"DLQ",        dotColor:T.red, dimmer:true },
  ];

  const tlSteps = ["Enqueued","Attempt 1","Attempt 2","Attempt 3","DLQ"];
  const payload = selected ? (PAYLOADS[selected.name] || {}) : {};
  const rc = selected ? (selected.laneKey==="dlq" ? 5 : selected.laneKey==="failed" ? selected.retries||0 : 0) : 0;
  const canReplay = selected && (selected.laneKey==="dlq" || selected.laneKey==="failed");

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr repeat(4,auto)",borderBottom:`1px solid ${T.border}`,alignItems:"end",flexShrink:0}}>
        <div style={{padding:"20px 24px 16px"}}>
          <div style={{fontSize:40,fontWeight:600,letterSpacing:"-0.03em",lineHeight:1,color:T.ink}}>Task Queue</div>
          <div style={{fontSize:12,color:T.inkSub,marginTop:4}}>
            {loading ? "Connecting to backend…" : "Live · refreshes every 5s"}
          </div>
        </div>
        {[
          {label:"Queued",     val:tasks.queued.length,     color:T.amber},
          {label:"Processing", val:tasks.processing.length, color:T.green},
          {label:"Completed",  val:tasks.success.length,    color:T.ink},
          {label:"Failed",     val:tasks.failed.length,     color:T.red},
        ].map(k=>(
          <div key={k.label} style={{padding:"16px 24px",borderLeft:`1px solid ${T.border}`,textAlign:"right"}}>
            <div style={{fontSize:28,fontWeight:600,color:k.color,letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{k.val}</div>
            <div style={{fontSize:11,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,padding:"0 24px",overflowX:"auto",flexShrink:0}}>
        {["All tasks","email","webhook","pdf","image","report","sms"].map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{fontSize:12,fontWeight:500,color:activeTab===t?T.ink:T.inkSub,padding:"9px 14px 7px",background:"none",border:"none",borderBottom:activeTab===t?`2px solid ${T.ink}`:"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap",fontFamily:FONT}}>{t}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",flex:1,overflow:"hidden"}}>

        {/* Swimlanes */}
        <div style={{borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",flex:1,overflow:"hidden"}}>
            {lanes.map(lane=>(
              <div key={lane.key} style={{borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"baseline",justifyContent:"space-between",background:"rgba(0,0,0,0.015)",flexShrink:0}}>
                  <span style={S.sectionLabel}>{lane.label}</span>
                  <span style={{fontSize:14,fontWeight:600,color:T.ink}}>{tasks[lane.key].length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",overflowY:"auto",flex:1}}>
                  {tasks[lane.key].length === 0 && (
                    <div style={{padding:"16px 14px",fontSize:11,color:T.inkMuted,textAlign:"center"}}>
                      {loading ? "Loading…" : "Empty"}
                    </div>
                  )}
                  {tasks[lane.key].map((task,i)=>(
                    <div key={task.id+i}
                      onClick={()=>setSelected(selected?.id===task.id?null:{...task,laneKey:lane.key})}
                      style={{padding:"12px 14px",borderBottom:`1px solid ${T.borderSub}`,cursor:"pointer",background:selected?.id===task.id?T.surface:"transparent",borderLeft:selected?.id===task.id?`2px solid ${T.ink}`:"2px solid transparent",transition:"background 0.1s",flexShrink:0}}
                      onMouseEnter={e=>{if(selected?.id!==task.id)e.currentTarget.style.background=T.surface;}}
                      onMouseLeave={e=>{if(selected?.id!==task.id)e.currentTarget.style.background="transparent";}}
                    >
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:12,fontWeight:500,color:T.ink,lineHeight:1.3}}>{task.name}</span>
                        <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,marginTop:4,background:lane.dotColor,opacity:lane.dim?0.4:lane.dimmer?0.6:1,animation:lane.pulse?"pip 1.2s ease-in-out infinite":"none",display:"inline-block"}}/>
                      </div>
                      <div style={{...S.mono,fontSize:9,color:T.inkMuted,marginBottom:5,letterSpacing:"0.04em"}}>task_{task.id}</div>
                      <div style={{...S.mono,fontSize:9,color:T.inkSub,background:T.borderSub,borderRadius:4,padding:"3px 6px",marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {JSON.stringify(PAYLOADS[task.name]||{}).slice(0,38)}…
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,color:T.inkSub}}>{task.meta}</span>
                        {task.retries>0&&<span style={{fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:4,background:T.redBg,color:T.red,...S.mono}}>{task.retries}×</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderTop:`1px solid ${T.border}`,flexWrap:"wrap",flexShrink:0}}>
            <span style={{...S.sectionLabel,flexShrink:0}}>Workers</span>
            {MOCK_WORKERS.map(w=>(
              <div key={w.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:500,color:T.inkMid,padding:"3px 10px",borderRadius:20,border:`1px solid ${T.border}`}}>
                <WDot status={w.status}/>{w.name}{w.status==="dead"&&<span style={{fontSize:9,color:T.red}}>⚠</span>}
              </div>
            ))}
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,paddingLeft:16,borderLeft:`1px solid ${T.border}`}}>
              <span style={{fontSize:11,color:T.inkSub}}>tasks/min</span>
              <span style={{fontSize:20,fontWeight:600,letterSpacing:"-0.02em"}}>{tasks.processing.length * 4 || 0}</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{display:"flex",flexDirection:"column",background:T.surface,borderLeft:`1px solid ${T.border}`,overflow:"hidden"}}>
          {selected ? (
            <>
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:600,color:T.ink}}>{selected.name}</div>
                <button onClick={()=>setSelected(null)} style={{fontSize:12,color:T.inkSub,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}>✕</button>
              </div>
              <div style={{overflowY:"auto",flex:1}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.border}`}}>
                  {[{l:"Task ID",v:`task_${selected.id}`},{l:"Status",v:selected.laneKey},{l:"Enqueued",v:selected.created_at?selected.created_at.slice(11,16):"—"},{l:"Retries",v:selected.retries?`${selected.retries}×`:"none"}].map((f,i)=>(
                    <div key={f.l} style={{padding:"10px 14px",borderRight:i%2===0?`1px solid ${T.border}`:"none",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub,marginBottom:3}}>{f.l}</div>
                      <div style={{...S.mono,fontSize:11,color:T.ink}}>{f.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub,marginBottom:8}}>Payload</div>
                  <div style={{...S.mono,fontSize:10,color:T.inkMid,background:T.bg,borderRadius:6,padding:"10px 12px",lineHeight:1.8,border:`1px solid ${T.border}`}}>
                    {Object.entries(payload).map(([k,v])=>(
                      <div key={k}><span style={{color:T.inkMuted}}>{k}:</span> <span style={{color:T.ink}}>{JSON.stringify(v)}</span></div>
                    ))}
                  </div>
                </div>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub,marginBottom:12}}>Retry timeline</div>
                  <div style={{display:"flex",alignItems:"flex-start"}}>
                    {tlSteps.map((step,i)=>(
                      <div key={step} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
                        {i<tlSteps.length-1&&<div style={{position:"absolute",top:8,left:"50%",width:"100%",height:1,background:T.border}}/>}
                        <div style={{width:16,height:16,borderRadius:"50%",border:`1.5px solid ${i===0?T.green:i<=rc?T.red:T.border}`,background:i===0?T.green:i<=rc?T.red:T.bg,position:"relative",zIndex:1,marginBottom:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:T.bg}}/>
                        </div>
                        <div style={{fontSize:8,fontWeight:500,textTransform:"uppercase",color:T.inkSub,textAlign:"center",lineHeight:1.3}}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.border}`}}>
                  {[{l:"Next backoff",v:rc>0?`${Math.pow(2,rc)}s + jitter`:"—"},{l:"Max retries",v:"5"},{l:"Strategy",v:"exp backoff"},{l:"Priority",v:selected.meta||"normal"}].map((f,i)=>(
                    <div key={f.l} style={{padding:"9px 14px",borderRight:i%2===0?`1px solid ${T.border}`:"none",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub,marginBottom:3}}>{f.l}</div>
                      <div style={{...S.mono,fontSize:11,color:T.ink}}>{f.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{padding:"12px 16px",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={replayTask} disabled={!canReplay} style={{fontSize:11,fontWeight:500,padding:"6px 14px",background:canReplay?T.ink:T.border,color:canReplay?T.bg:T.inkMuted,border:"none",borderRadius:6,cursor:canReplay?"pointer":"default",fontFamily:FONT}}>↑ Replay</button>
                  <button style={{fontSize:11,fontWeight:500,padding:"6px 14px",background:"transparent",color:T.inkMid,border:`1px solid ${T.border}`,borderRadius:6,cursor:"pointer",fontFamily:FONT}}>Copy ID</button>
                  <button style={{fontSize:11,fontWeight:500,padding:"6px 14px",background:"transparent",color:T.red,border:`1px solid ${T.redBg}`,borderRadius:6,cursor:"pointer",fontFamily:FONT}}>Delete</button>
                </div>
              </div>
            </>
          ):(
            <>
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
                <div style={S.sectionLabel}>Recent activity</div>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {RECENT_ACTIVITY.map((log,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 16px",borderBottom:`1px solid ${T.borderSub}`,transition:"background 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  >
                    <span style={{...S.mono,fontSize:10,color:T.inkMuted,flexShrink:0,paddingTop:1}}>{log.t}</span>
                    <Tag type={log.type}/>
                    <span style={{fontSize:11,color:T.inkMid,lineHeight:1.5}}>{log.msg}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
                <div style={{fontSize:11,color:T.inkMuted}}>← Click any task to inspect payload and retry history</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const [range, setRange] = useState("6h");
  const [summary, setSummary] = useState({ total_processed:0, avg_latency:0, queued:0, dlq:0 });
  const [chartData, setChartData] = useState([48,62,55,80,73,91,87,104,98,112,88,95]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/stats/throughput?range=${range}`);
        const data = await res.json();
        setChartData(data.data);
        setSummary(data.summary);
      } catch(e) { console.error("Stats fetch failed:", e); }
    };
    fetchStats();
  }, [range]);

  const handlers=[
    {name:"email:send",   count:312,pct:88},
    {name:"webhook:post", count:234,pct:66},
    {name:"pdf:export",   count:191,pct:54},
    {name:"image:resize", count:149,pct:42},
    {name:"report:gen",   count:98, pct:28},
    {name:"sms:send",     count:64, pct:18},
  ];
  const latencies=[
    {name:"db:backup",    val:"14.3s",pct:95,color:T.amber},
    {name:"report:gen",   val:"8.1s", pct:60,color:T.amber},
    {name:"pdf:export",   val:"4.8s", pct:36,color:T.ink},
    {name:"image:resize", val:"2.6s", pct:20,color:T.ink},
    {name:"webhook:post", val:"1.2s", pct:10,color:T.ink},
    {name:"email:send",   val:"0.8s", pct:6, color:T.ink},
  ];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${T.border}`}}>
        <Kpi label="Tasks today"   value={summary.total_processed.toLocaleString()} sub="since midnight"/>
        <Kpi label="Avg latency"   value={`${summary.avg_latency}s`} color={T.amber} sub="from task_durations"/>
        <Kpi label="Queued now"    value={summary.queued} color={T.green} sub="high + normal queue"/>
        <Kpi label="DLQ size"      value={summary.dlq}   color={T.red}   sub="dead letter queue"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",borderBottom:`1px solid ${T.border}`}}>
        <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
          <SectionHead label="Throughput — tasks / hour" right={
            <div style={{display:"flex"}}>
              {["6h","24h","7d"].map((r,i)=>(
                <button key={r} onClick={()=>setRange(r)} style={{fontSize:11,fontWeight:500,color:range===r?T.bg:T.inkSub,padding:"3px 10px",cursor:"pointer",background:range===r?T.ink:T.bg,border:`1px solid ${T.border}`,borderRight:i<2?"none":`1px solid ${T.border}`,borderRadius:i===0?"6px 0 0 6px":i===2?"0 6px 6px 0":"0",fontFamily:FONT}}>{r}</button>
              ))}
            </div>
          }/>
          <Sparkline data={chartData} height={180}/>
        </div>
        <div style={{padding:"20px 24px"}}>
          <SectionHead label="Outcome split"/>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Donut/>
            <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
              {[{c:T.green,l:"Success",p:"94%"},{c:T.amber,l:"Failed",p:"4%"},{c:T.red,l:"DLQ",p:"2%"}].map(s=>(
                <div key={s.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,color:T.inkMid}}>
                  <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:s.c,display:"inline-block"}}/>{s.l}</span>
                  <span style={{...S.mono,fontSize:11,color:T.inkSub}}>{s.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`1px solid ${T.border}`}}>
        <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
          <SectionHead label="Top handlers"/>
          {handlers.map(h=>(
            <div key={h.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:12,color:T.inkMid,width:90,flexShrink:0}}>{h.name}</span>
              <div style={{flex:1,height:3,background:T.borderSub,borderRadius:2,overflow:"hidden"}}><div style={{width:`${h.pct}%`,height:"100%",background:T.ink,borderRadius:2}}/></div>
              <span style={{...S.mono,fontSize:11,color:T.inkSub,width:28,textAlign:"right"}}>{h.count}</span>
            </div>
          ))}
        </div>
        <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
          <SectionHead label="Worker health"/>
          {MOCK_WORKERS.map(w=>(
            <div key={w.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.borderSub}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,...S.mono,color:T.inkMid}}><WDot status={w.status}/>{w.name}</div>
              <span style={{fontSize:11,color:T.inkSub}}>{w.current}</span>
              <span style={{...S.mono,fontSize:10,color:T.inkMuted}}>{w.uptime}</span>
            </div>
          ))}
        </div>
        <div style={{padding:"20px 24px"}}>
          <SectionHead label="Latency by handler"/>
          {latencies.map(h=>(
            <div key={h.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:12,color:T.inkMid,width:90,flexShrink:0}}>{h.name}</span>
              <div style={{flex:1,height:3,background:T.borderSub,borderRadius:2,overflow:"hidden"}}><div style={{width:`${h.pct}%`,height:"100%",background:h.color,borderRadius:2}}/></div>
              <span style={{...S.mono,fontSize:11,color:T.inkSub,width:34,textAlign:"right"}}>{h.val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:T.inkMuted}}>Live data from task-queue.hopto.org</span>
        <Btn>Export CSV</Btn>
      </div>
    </div>
  );
};

// ─── WORKERS ─────────────────────────────────────────────────────────────────
const WorkersScreen = () => {
  const [workers, setWorkers] = useState(MOCK_WORKERS);
  const [selectedW, setSelectedW] = useState("worker-1");

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/workers`);
        const data = await res.json();
        if (data.workers && data.workers.length > 0) setWorkers(data.workers);
      } catch(e) { console.error("Workers fetch failed:", e); }
    };
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  const w = workers.find(x=>x.name===selectedW) || workers[0] || MOCK_WORKERS[0];
  const lineColor = w.status==="dead"?T.red:w.status==="idle"?T.inkMuted:T.ink;

  const MiniTimeline = ({wname}) => {
    const pattern = MT_PATTERNS[wname] || Array(30).fill("ok");
    return (
      <div style={{padding:"8px 14px",borderTop:`1px solid ${T.borderSub}`}}>
        <div style={{fontSize:9,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkMuted,marginBottom:5}}>Last 30 min</div>
        <div style={{display:"flex",gap:2,height:10}}>
          {pattern.map((s,i)=>(
            <div key={i} style={{flex:1,borderRadius:1,background:s==="ok"?T.green:s==="warn"?T.amber:s==="dead"?T.red:T.border,opacity:s==="ok"?0.6:s==="idle"?0.3:0.85}}/>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${T.border}`}}>
        <Kpi label="Active workers"    value={`${workers.filter(w=>w.status==="busy").length} / ${workers.length}`} color={T.green} sub="busy workers"/>
        <Kpi label="Total processed"   value={workers.reduce((a,w)=>a+(w.done||0),0).toLocaleString()} sub="combined"/>
        <Kpi label="Avg task duration" value="1.8s" color={T.amber} sub="p95 = 8.4s"/>
        <Kpi label="Crashes today"     value={workers.filter(w=>w.status==="dead").length} color={T.red} sub="dead workers"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.border}`}}>
        <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
          <SectionHead label="All workers" right={<span style={{fontSize:11,color:T.inkMuted}}>click to inspect</span>}/>
          {workers.map(wd=>(
            <div key={wd.name} onClick={()=>setSelectedW(wd.name)} style={{border:`1px solid ${selectedW===wd.name?T.ink:T.border}`,borderRadius:8,marginBottom:10,cursor:"pointer",background:selectedW===wd.name?T.surface:T.bg,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${T.borderSub}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:500,...S.mono,color:T.ink}}><WDot status={wd.status}/>{wd.name}</div>
                <Tag type={wd.status}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"10px 14px",gap:8}}>
                {[{l:wd.status==="dead"?"Last task":"Current",v:wd.current||"—"},{l:"Uptime",v:wd.uptime||"—"},{l:"Done",v:wd.done||0}].map(f=>(
                  <div key={f.l}>
                    <div style={{fontSize:9,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkMuted,marginBottom:2}}>{f.l}</div>
                    <div style={{fontSize:12,...S.mono,color:T.inkMid}}>{f.v}</div>
                  </div>
                ))}
              </div>
              <MiniTimeline wname={wd.name}/>
            </div>
          ))}
        </div>
        <div style={{padding:"20px 24px"}}>
          <SectionHead label={`${w.name} — detail`}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",marginBottom:16,background:T.bg}}>
            {[{l:"PID",v:w.pid||"—"},{l:"Memory",v:w.mem||"—"},{l:"CPU",v:w.cpu||"—"},{l:"Restarts",v:w.restarts||"0"}].map((f,i)=>(
              <div key={f.l} style={{padding:"10px 14px",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
                <div style={{fontSize:9,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:T.inkSub,marginBottom:4}}>{f.l}</div>
                <div style={{...S.mono,fontSize:12,color:T.ink}}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={S.sectionLabel}>Tasks / 5 min</span>
            <span style={{fontSize:11,color:T.inkMuted}}>last hour</span>
          </div>
          <Sparkline key={selectedW} data={w.data||[0,0,0,0,0,0,0,0,0,0,0,0]} color={lineColor} height={110}/>
          <div style={{marginTop:16,marginBottom:10,...S.sectionLabel}}>Event log</div>
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            {(w.logs||[]).map((log,i,a)=>(
              <div key={i} style={{display:"flex",alignItems:"baseline",gap:10,padding:"8px 14px",borderBottom:i<a.length-1?`1px solid ${T.borderSub}`:"none",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <span style={{...S.mono,fontSize:10,color:T.inkMuted,flexShrink:0,width:42}}>{log.t}</span>
                <Tag type={log.type}/>
                <span style={{fontSize:11,color:T.inkMid}}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
        <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
          <SectionHead label="Utilization heatmap — all workers · 24h"/>
          {workers.slice(0,5).map((wd,wi)=>(
            <div key={wd.name} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
              <span style={{fontSize:9,fontWeight:500,...S.mono,color:T.inkSub,width:60,flexShrink:0}}>{wd.name}</span>
              <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2,flex:1}}>
                {HM_DATA[wi].map((v,i)=><div key={i} style={{height:16,borderRadius:2,background:HM_COLORS[v]}}/>)}
              </div>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
            <span style={{fontSize:9,color:T.inkMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Low</span>
            {HM_COLORS.map(c=><div key={c} style={{width:12,height:12,borderRadius:2,background:c}}/>)}
            <span style={{fontSize:9,color:T.inkMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>High</span>
          </div>
        </div>
        <div style={{padding:"20px 24px"}}>
          <SectionHead label="Watchdog recovery events"/>
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            {[
              {t:"19:42",type:"recovery",msg:"worker-5 task_a3e2 moved to DLQ after 5 retries"},
              {t:"19:40",type:"error",   msg:"worker-5 OOM killed — heap exceeded 512 MB"},
              {t:"19:38",type:"warn",    msg:"worker-5 task_a3e2 exceeded 120s — watchdog fired"},
              {t:"18:05",type:"recovery",msg:"worker-3 re-acquired task_6b7d after BRPOPLPUSH"},
              {t:"16:22",type:"warn",    msg:"worker-2 pdf:export exceeded p95 threshold (8.4s)"},
              {t:"14:11",type:"recovery",msg:"worker-4 restarted by systemd after SIGKILL"},
            ].map((log,i,a)=>(
              <div key={i} style={{display:"flex",alignItems:"baseline",gap:10,padding:"8px 14px",borderBottom:i<a.length-1?`1px solid ${T.borderSub}`:"none",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <span style={{...S.mono,fontSize:10,color:T.inkMuted,flexShrink:0,width:42}}>{log.t}</span>
                <Tag type={log.type}/>
                <span style={{fontSize:11,color:T.inkMid}}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function QueueViz() {
  const [screen, setScreen] = useState("monitor");

  return (
    <>
      <FontLoader/>
      <style>{`
        @keyframes pip{0%,100%{opacity:1}50%{opacity:.2}}
        *{box-sizing:border-box;}
        body{margin:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#d4cfc8;border-radius:3px;}
      `}</style>

      <div style={{background:T.ink,display:"flex",alignItems:"center",padding:"0 24px",gap:0,flexShrink:0}}>
        <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.9)",letterSpacing:"-0.01em",marginRight:24,fontFamily:FONT}}>QueueViz</span>
        <div style={{display:"flex",flex:1}}>
          {[["monitor","Monitor"],["analytics","Analytics"],["workers","Workers"]].map(([key,label])=>(
            <button key={key} onClick={()=>setScreen(key)} style={{fontSize:12,fontWeight:500,padding:"11px 16px",background:"none",color:screen===key?"#fff":"rgba(255,255,255,0.45)",border:"none",borderBottom:screen===key?"2px solid #fff":"2px solid transparent",cursor:"pointer",fontFamily:FONT,transition:"color 0.15s",display:"flex",alignItems:"center",gap:6}}>
              {screen===key&&<span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}`}}/>}
              {label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:T.green,animation:"pip 2s ease-in-out infinite"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:FONT}}>Live</span>
          {screen==="monitor"&&<EnqueueBtn onClick={()=>{const btn=document.querySelector('[data-enqueue]'); if(btn)btn.click();}}/>}
          {screen==="workers"&&<><Btn>Restart all</Btn><Btn danger>Drain queue</Btn></>}
        </div>
      </div>

      <div style={S.root}>
        {screen==="monitor"   && <MonitorScreen/>}
        {screen==="analytics" && <div style={{overflowY:"auto",flex:1}}><AnalyticsScreen/></div>}
        {screen==="workers"   && <div style={{overflowY:"auto",flex:1}}><WorkersScreen/></div>}
      </div>
    </>
  );
}
