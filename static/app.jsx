// @ts-nocheck
/* global React, ReactDOM */

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
  };
  
  const genId = (p) => `${p}-${Date.now().toString(36).slice(-6)}`;
  
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
  
  function Toast({ text }) {
    if (!text) return null;
    return <div className="toast">{text}</div>;
  }
  
  function useToast() {
    const [t, setT] = React.useState("");
    const show = (msg) => {
      setT(msg);
      setTimeout(() => setT(""), 2000);
    };
    return { t, show };
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
        <SeedCard />
      </div>
    );
  }
  
  function SeedCard() {
    const { show } = useToast();
    async function seed() {
      const pid = genId("p");
      const lid = genId("l");
      await api.post("/products/", { id: pid, sku: "86900001", name: "Süt 1L", base_price: 35.9, currency: "TRY" });
      await api.post("/labels/", { id: lid, label_code: "LB-101", store: "IST-01" });
      await api.post("/labels/assign", { label_id: lid, product_id: pid });
      show("Örnek ürün+etiket eklendi ve eşleştirildi");
    }
    return (
      <div className="card">
        <h2>Hızlı Başlangıç</h2>
        <p className="muted">Tek tıkla örnek ürün/etiket oluşturup eşle.</p>
        <button className="btn" onClick={seed}>Seed (demo)</button>
      </div>
    );
  }
  
  function Catalog() {
    const [products, setProducts] = React.useState([]);
    const [labels, setLabels] = React.useState([]);
    const [p, setP] = React.useState({ id: genId("p"), sku: "", name: "", base_price: 0 });
    const [l, setL] = React.useState({ id: genId("l"), code: "", store: "IST-01" });
    const [a, setA] = React.useState({ label_id: "", product_id: "" });
    const [msg, setMsg] = React.useState("");
  
    async function refresh() {
      const [ps, ls] = await Promise.all([api.get("/products/"), api.get("/labels/")]);
      setProducts(ps); setLabels(ls);
    }
    React.useEffect(() => { refresh(); }, []);
  
    async function createProduct() {
      await api.post("/products/", { id: p.id, sku: p.sku, name: p.name, base_price: parseFloat(p.base_price || 0), currency: "TRY" });
      setMsg("Ürün kaydedildi"); setP({ id: genId("p"), sku: "", name: "", base_price: 0 }); refresh();
    }
    async function createLabel() {
      await api.post("/labels/", { id: l.id, label_code: l.code, store: l.store });
      setMsg("Etiket kaydedildi"); setL({ id: genId("l"), code: "", store: "IST-01" }); refresh();
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
    const [req, setReq] = React.useState({ id: genId("req"), product_id: "", store: "IST-01", new_price: "" });
    const [status, setStatus] = React.useState("PENDING");
    const [log, setLog] = React.useState([]);
    React.useEffect(() => { api.get("/products/").then(setProducts); }, []);
    const pushLog = (t) => setLog((L)=>[...L, t]);
  
    async function createReq() {
      await api.post("/price-changes/", { ...req, new_price: parseFloat(req.new_price || 0), reason: "panel" });
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
          <button className="btn ghost" onClick={()=>setReq({ id: genId("req"), product_id:"", store:"IST-01", new_price:"" })}>Temizle</button>
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
  
    return (
      <>
        {tab==="dash" && <Dashboard/>}
        {tab==="catalog" && <Catalog/>}
        {tab==="price" && <PriceChangeWizard/>}
        {tab==="deploy" && <Deployments/>}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }
  
  ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
  