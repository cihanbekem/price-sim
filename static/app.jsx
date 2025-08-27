// @ts-nocheck
/* global React, ReactDOM */

// ===== THEME =====
const THEME_KEY = 'ui-theme';
const applyTheme = (t) => {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
};
const getTheme = () =>
  document.documentElement.getAttribute('data-theme') ||
  localStorage.getItem(THEME_KEY) || 'dark';

function ThemeSwitch(){
  const [theme, setTheme] = React.useState(getTheme());
  React.useEffect(()=>{ applyTheme(theme); }, [theme]);
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return (
    <button className="theme-btn" onClick={toggle} title="Tema değiştir">
      {theme === 'dark' ? '🌙 Koyu' : '☀️ Açık'}
    </button>
  );
}

// ===== API =====
const api = {
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
  async get(url) {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
  async del(url) {
    const r = await fetch(url, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
};

// ===== SIRALI ID YARDIMCILARI (yalnızca UI) =====
const SEQ_KEY = 'seq-ids';
const _getAllSeq = () => JSON.parse(localStorage.getItem(SEQ_KEY) || "{}");
const _setAllSeq = (obj) => localStorage.setItem(SEQ_KEY, JSON.stringify(obj));
const getSeq = (ns) => _getAllSeq()[ns] || 0;
const setSeq = (ns, n) => { const d=_getAllSeq(); d[ns]=n; _setAllSeq(d); };
const peekNext = (ns) => `${ns}-${getSeq(ns)+1}`;
const nextSeq  = (ns) => { const n=getSeq(ns)+1; setSeq(ns,n); return `${ns}-${n}`; };
const syncSeqFromIds = (ns, ids) => {
  const re = new RegExp(`^${ns}-(\\d+)$`, 'i');
  const max = (ids||[]).reduce((m,id)=>{ const mch=String(id).match(re); return mch?Math.max(m, +mch[1]):m; }, 0);
  if (max > getSeq(ns)) setSeq(ns, max);
};

// ===== UI yardımcıları =====
const priceParts = (val) => {
  const n = Number(val ?? 0);
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const [intPart, decPart] = s.split(',');
  return [intPart, decPart ?? "00"];
};

function useWebSocketMetrics() {
  const [m, setM] = React.useState({
    total: 0, success: 0, failed: 0, queued: 0, processing: 0, avg_ack_ms: null,
  });
  React.useEffect(() => {
    const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/live/ws");
    ws.onopen = () => ws.send("hi");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "metrics") setM(msg);
      } catch {}
    };
    return () => ws.close();
  }, []);
  return m;
}

function Tabs({ current, onChange }) {
  const items = [
    { id: "dash", label: "Dashboard" },
    { id: "catalog", label: "Katalog (Ürün & Etiket)" },
    { id: "price", label: "Fiyat Değişikliği" },
    { id: "deploy", label: "Dağıtımlar" },
    { id: "wall", label: "Etiket Duvarı (Canlı)" },
  ];
  return (
    <>
      {items.map((t) => (
        <button key={t.id} className={["", current === t.id ? "active" : ""].join(" ")} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </>
  );
}

function KPI({ label, value }) {
  return (
    <div className="kpi">
      <div className="muted">{label}</div>
      <div className="v">{value ?? "-"}</div>
    </div>
  );
}

function Dashboard() {
  const m = useWebSocketMetrics();
  return (
    <div className="grid">
      <div className="card">
        <h2>Canlı Metrikler</h2>
        <div className="kpis">
          <KPI label="Toplam İş" value={m.total} />
          <KPI label="Başarılı" value={m.success} />
          <KPI label="Başarısız" value={m.failed} />
          <KPI label="Kuyrukta" value={m.queued} />
          <KPI label="Ort. ACK (ms)" value={m.avg_ack_ms ?? "-"} />
        </div>
        <div className="muted" style={{marginTop:8}}>
          Ayrıntı: <a className="link" href="/static/live.html" target="_blank">/static/live.html</a>
        </div>
      </div>
    </div>
  );
}

function LabelCard({ label, product, onClick }) {
  const p = product;
  const [intP, decP] = priceParts(p?.price);
  return (
  <div className="esl" onClick={() => onClick?.(label)} style={{cursor:"pointer"}}>
    <div className="esl">
      <div className="top">
        <div>{label.store}</div>
        <div>#{label.label_code}</div>
      </div>

      <div className="name">
        {p ? p.name : <span className="muted">Ürün atanmamış</span>}
      </div>

      {p ? (
        <div className="price">
          <div className="ccy">₺</div>
          <div className="num">
            <span className="int">{intP}</span>
            <span className="dec">,{decP}</span>
          </div>
        </div>
      ) : (
        <div className="placeholder">Ürüne eşleyin →</div>
      )}

      <div className="foot">
        <span>Batarya: {label.battery_pct ?? 100}%</span>
        <span>{label.status}</span>
      </div>
    </div>
   </div> 
  );
}

function LabelWall() {
    const [cards, setCards] = React.useState([]);
  
    React.useEffect(() => { api.get("/labels/wall").then(setCards); }, []);
  
    React.useEffect(() => {
      const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/live/ws");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "label-created") {
            setCards((L) => [{ label: msg.label, product: null }, ...L]);
          } else if (msg.type === "label-updated") {
            setCards((L) => L.map((x) => (x.label.id === msg.label_id ? { ...x, product: msg.product } : x)));
          } else if (msg.type === "product-updated") {
            setCards((L) => L.map((x) => (x.product && x.product.id === msg.product.id
              ? { ...x, product: { ...x.product, price: msg.product.price, name: msg.product.name, currency: msg.product.currency } }
              : x)));
          } else if (msg.type === "label-deleted") {
            setCards((L) => L.filter((x) => x.label.id !== msg.label_id));
          }
        } catch {}
      };
      return () => ws.close();
    }, []);
  
    async function onCardClick(label) {
      const ok = window.confirm(`Etiketi silmek istiyor musun?\n${label.id} (#${label.label_code})`);
      if (!ok) return;
      try {
        await api.del(`/labels/${label.id}`);
        setCards((L) => L.filter((x) => x.label.id !== label.id));
      } catch (e) {
        alert(`Silinemedi: ${e.message}`);
      }
    }
  
    return (
      <div className="card">
        <h2>Etiket Duvarı</h2>
        <div className="label-wall">
          {cards.map((c) => (
            <LabelCard key={c.label.id} label={c.label} product={c.product} onClick={onCardClick} />
          ))}
        </div>
      </div>
    );
  }
  

function Catalog() {
  const [products, setProducts] = React.useState([]);
  const [labels, setLabels] = React.useState([]);
  const [p, setP] = React.useState({ id: peekNext("p"), sku: "", name: "", base_price: 0 });
  const [l, setL] = React.useState({ id: peekNext("l"), code: "", store: "IST-01" });
  const [a, setA] = React.useState({ label_id: "", product_id: "" });
  const [msg, setMsg] = React.useState("");

  async function refresh() {
    const [ps, ls] = await Promise.all([api.get("/products/"), api.get("/labels/")]);
    setProducts(ps); setLabels(ls);
    // server listesinden sayaçları senkronla ve formlara bir sonrakini yaz
    syncSeqFromIds("p", ps.map(x=>x.id));
    syncSeqFromIds("l", ls.map(x=>x.id));
    setP(s => ({...s, id: peekNext("p")}));
    setL(s => ({...s, id: peekNext("l")}));
  }
  React.useEffect(() => { refresh(); }, []);

  async function createProduct() {
    const id = p.id || nextSeq("p");
    await api.post("/products/", { id, sku: p.sku, name: p.name, base_price: parseFloat(p.base_price || 0), currency: "TRY" });
    setMsg("Ürün kaydedildi");
    setP({ id: peekNext("p"), sku: "", name: "", base_price: 0 });
    refresh();
  }
  async function createLabel() {
    const id = l.id || nextSeq("l");
    await api.post("/labels/", { id, label_code: l.code, store: l.store });
    setMsg("Etiket kaydedildi");
    setL({ id: peekNext("l"), code: "", store: "IST-01" });
    refresh();
  }
  async function assign() {
    await api.post("/labels/assign", a); setMsg("Eşleştirme yapıldı"); refresh();
  }

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>Ürün Ekle</h2>
        <div className="row">
          <div><label>id</label><input value={p.id} onChange={e=>setP({...p,id:e.target.value})}/></div>
          <div><label>sku</label><input value={p.sku} onChange={e=>setP({...p,sku:e.target.value})}/></div>
          <div><label>ad</label><input value={p.name} onChange={e=>setP({...p,name:e.target.value})}/></div>
          <div><label>fiyat</label><input type="number" step="0.01" value={p.base_price} onChange={e=>setP({...p,base_price:e.target.value})}/></div>
        </div>
        <div className="actions">
          <button className="btn" onClick={createProduct}>Kaydet</button>
          <button className="btn ghost" onClick={refresh}>Listeyi Yenile</button>
        </div>
        <div style={{height:8}} />
        <table>
          <thead><tr><th>id</th><th>sku</th><th>ad</th><th>fiyat</th></tr></thead>
          <tbody>{products.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.sku}</td><td>{x.name}</td><td>{x.base_price}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card">
        <h2>Etiket Ekle & Eşle</h2>
        <div className="row">
          <div><label>label id</label><input value={l.id} onChange={e=>setL({...l,id:e.target.value})}/></div>
          <div><label>label_code</label><input value={l.code} onChange={e=>setL({...l,code:e.target.value})}/></div>
          <div><label>store</label><input value={l.store} onChange={e=>setL({...l,store:e.target.value})}/></div>
          <div style={{display:"flex",alignItems:"end"}}><button className="btn" onClick={createLabel}>Etiket Kaydet</button></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div>
            <label>Etiket</label>
            <select value={a.label_id} onChange={e=>setA({...a,label_id:e.target.value})}>
              <option value="">Seçin</option>
              {labels.map(x=><option key={x.id} value={x.id}>{x.id} ({x.store})</option>)}
            </select>
          </div>
          <div>
            <label>Ürün</label>
            <select value={a.product_id} onChange={e=>setA({...a,product_id:e.target.value})}>
              <option value="">Seçin</option>
              {products.map(x=><option key={x.id} value={x.id}>{x.id} — {x.name}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"end"}}><button className="btn" onClick={assign}>Ürüne Eşle</button></div>
        </div>

        <div className="muted" style={{marginTop:8}}>{msg}</div>
        <div style={{height:8}} />
        <table>
          <thead><tr><th>id</th><th>code</th><th>store</th><th>durum</th></tr></thead>
          <tbody>{labels.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.label_code}</td><td>{x.store}</td><td><span className="badge ok">{x.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function PriceChangeWizard() {
  const [products, setProducts] = React.useState([]);
  const [req, setReq] = React.useState({ id: peekNext("req"), product_id: "", store: "IST-01", new_price: "" });
  const [status, setStatus] = React.useState("PENDING");
  const [log, setLog] = React.useState([]);
  React.useEffect(() => { api.get("/products/").then(setProducts); }, []);
  const pushLog = (t) => setLog((L)=>[...L, t]);

  async function createReq() {
    const id = req.id || nextSeq("req");
    await api.post("/price-changes/", { ...req, id, new_price: parseFloat(req.new_price || 0), reason: "panel" });
    setReq(r => ({ ...r, id: peekNext("req") }));
    setStatus("PENDING"); pushLog("Talep oluşturuldu");
  }
  async function approve() {
    await api.post(`/price-changes/${req.id}/approve`, { approver: "admin", decision: "APPROVE", comment: "ok" });
    setStatus("APPROVED"); pushLog("Talep onaylandı");
  }
  async function startPush() {
    await api.post(`/push/${req.id}/start`, {});
    pushLog("Dağıtım başlatıldı");
  }

  return (
    <div className="card">
      <h2>Fiyat Değişikliği Sihirbazı</h2>
      <div className="row">
        <div><label>request id</label><input value={req.id} onChange={e=>setReq({...req,id:e.target.value})}/></div>
        <div>
          <label>product</label>
          <select value={req.product_id} onChange={e=>setReq({...req,product_id:e.target.value})}>
            <option value="">Seçin</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
        </div>
        <div><label>store</label><input value={req.store} onChange={e=>setReq({...req,store:e.target.value})}/></div>
        <div><label>new price</label><input type="number" step="0.01" value={req.new_price} onChange={e=>setReq({...req,new_price:e.target.value})}/></div>
      </div>
      <div className="actions">
        <button className="btn" onClick={createReq}>1) Talep Oluştur</button>
        <button className="btn" onClick={approve} disabled={status!=="PENDING"}>2) Onayla</button>
        <button className="btn" onClick={startPush} disabled={status!=="APPROVED"}>3) Push Başlat</button>
        <button className="btn ghost" onClick={()=>setReq({ id: peekNext("req"), product_id:"", store:"IST-01", new_price:"" })}>Temizle</button>
      </div>
      <div style={{marginTop:10}} className="muted">Durum: {status==="APPROVED"
        ? <span className="badge ok">APPROVED</span>
        : status==="PENDING" ? <span className="badge warn">PENDING</span> : status}</div>
      <ul>{log.map((x,i)=><li key={i} className="muted">{x}</li>)}</ul>
    </div>
  );
}

function Deployments() {
  const [jobs, setJobs] = React.useState([]);
  const [auto, setAuto] = React.useState(true);
  async function load(){ setJobs(await api.get("/push/jobs")); }
  React.useEffect(()=>{ load(); },[]);
  React.useEffect(()=>{
    if(!auto) return;
    const t = setInterval(load, 1000);
    return ()=> clearInterval(t);
  },[auto]);
  const badge = (s) =>
    s==="SUCCESS" ? "badge ok" : s==="FAILED" ? "badge bad" : s==="PROCESSING" ? "badge warn" : "badge";
  return (
    <div className="card">
      <h2>Dağıtım İşleri</h2>
      <div className="actions">
        <button className="btn ghost" onClick={load}>Yenile</button>
        <label style={{display:"flex",alignItems:"center",gap:6}} className="muted">
          <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> otomatik yenile
        </label>
      </div>
      <table style={{marginTop:10}}>
        <thead><tr><th>id</th><th>status</th><th>try</th><th>label</th><th>request</th></tr></thead>
        <tbody>
          {jobs.map(j=>(
            <tr key={j.id}>
              <td>{j.id}</td>
              <td><span className={badge(j.status)}>{j.status}</span></td>
              <td>{j.try_count}</td>
              <td>{j.label_id}</td>
              <td>{j.request_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [tab, setTab] = React.useState("dash");
  const [toast, setToast] = React.useState("");

  React.useEffect(()=>{
    const el = document.getElementById("tabs");
    ReactDOM.createRoot(el).render(<Tabs current={tab} onChange={setTab} />);
  }, [tab]);

  React.useEffect(()=>{
    const holder = document.getElementById("theme-toggle");
    if (holder) {
      ReactDOM.createRoot(holder).render(<ThemeSwitch />);
    }
  }, []);

  return (
    <>
      {tab==="dash" && <Dashboard/>}
      {tab==="catalog" && <Catalog/>}
      {tab==="price" && <PriceChangeWizard/>}
      {tab==="deploy" && <Deployments/>}
      {tab==="wall" && <LabelWall/>}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
