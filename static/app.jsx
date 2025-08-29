// @ts-nocheck
/* global React, ReactDOM, api, Login */

// ---------------- THEME ----------------
const THEME_KEY = 'ui-theme';
const getTheme = () =>
  document.documentElement.getAttribute('data-theme') ||
  localStorage.getItem(THEME_KEY) || 'dark';
const applyTheme = (t) => {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
};
function ThemeSwitch(){
  const [theme, setTheme] = React.useState(getTheme());
  React.useEffect(()=>{ applyTheme(theme); }, [theme]);
  return (
    <button className="theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Tema değiştir">
      {theme === 'dark' ? '🌙 Koyu' : '☀️ Açık'}
    </button>
  );
}

// -------- HTTP yardımcıları (auth.jsx’teki api’yi gölgelemiyor!) --------
const http = {
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json",
        ...(localStorage.getItem('auth-token') ? { Authorization: `Bearer ${localStorage.getItem('auth-token')}` } : {})
      },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
  async get(url) {
    const r = await fetch(url, {
      headers: { ...(localStorage.getItem('auth-token') ? { Authorization: `Bearer ${localStorage.getItem('auth-token')}` } : {}) }
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
  async del(url) {
    const r = await fetch(url, {
      method: "DELETE",
      headers: { ...(localStorage.getItem('auth-token') ? { Authorization: `Bearer ${localStorage.getItem('auth-token')}` } : {}) }
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
};

// ------------- küçük yardımcılar -------------
const priceParts = (val) => {
  const n = Number(val ?? 0);
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const [intPart, decPart] = s.split(',');
  return [intPart, decPart ?? "00"];
};

function useWebSocketMetrics() {
  const [m, setM] = React.useState({ total:0, success:0, failed:0, queued:0, processing:0, avg_ack_ms:null });
  React.useEffect(() => {
    const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/live/ws");
    ws.onopen = () => {
      try { ws.send(JSON.stringify({ type:"hello", user:(api?.user && (api.user.name||api.user.email))||"" })); } catch {}
    };
    ws.onmessage = (ev) => {
      try { const msg = JSON.parse(ev.data); if (msg.type === "metrics") setM(msg); } catch {}
    };
    return () => ws.close();
  }, []);
  return m;
}

// ------------- shell -------------
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
      <StoreCoverageCard />
    </div>
  );
}

// -------- kullanıcı üst sağ: avatar + isim --------
function readUser(){
  try { return JSON.parse(localStorage.getItem("auth-user")||"{}"); } catch { return {}; }
}
function UserBox(){
  const [user, setUser] = React.useState(()=> api?.user || readUser());
  React.useEffect(()=>{ if (api?.user) setUser(api.user); }, []);
  if (!user || !user.name) return null;
  const initials = String(user.name).split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  return (
    <div className="userbox">
      <div className="avatar">{initials || "U"}</div>
      <div className="name">{user.name}</div>
    </div>
  );
}
function LogoutButton({ onLoggedOut }){
  const doLogout = () => {
    try { api?.setToken?.(null); } catch {}
    try { localStorage.removeItem('auth-token'); localStorage.removeItem('auth-user'); } catch {}
    if (typeof onLoggedOut === 'function') onLoggedOut();
    location.reload();
  };
  return <button className="btn danger" onClick={doLogout} title="Çıkış">Çıkış</button>;
}

// ------------- Etiket Duvarı -------------
function LabelCard({ label, product, onClick }) {
  const p = product;
  const [intP, decP] = priceParts(p?.price);
  return (
    <div className="esl" onClick={() => onClick?.(label)} style={{cursor:"pointer"}}>
      <div className="top">
        <div>{label.store}</div>
        <div>#{label.label_code}</div>
      </div>
      <div className="name">{p ? p.name : <span className="muted">Ürün atanmamış</span>}</div>
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
  );
}
function LabelWall() {
  const [cards, setCards] = React.useState([]);
  React.useEffect(() => { http.get("/labels/wall").then(setCards); }, []);
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
    try { await http.del(`/labels/${label.id}`); setCards(L => L.filter(x => x.label.id !== label.id)); }
    catch (e) { alert(`Silinemedi: ${e.message}`); }
  }
  return (
    <div className="card">
      <h2>Etiket Duvarı</h2>
      <div className="label-wall">
        {cards.map((c) => <LabelCard key={c.label.id} label={c.label} product={c.product} onClick={onCardClick}/>)}
      </div>
    </div>
  );
}

// ------------- Fiyat Geçmişi paneli -------------
function PriceHistoryPanel({ productId, store }) {
  const [rows, setRows] = React.useState([]);
  React.useEffect(() => {
    if (!productId) return;
    const qs = new URLSearchParams({ limit: 20, ...(store ? { store } : {}) });
    http.get(`/products/${productId}/price-history?` + qs.toString())
      .then(setRows).catch(()=>setRows([]));
  }, [productId, store]);

  if (!productId) return null;
  return (
    <div className="card">
      <h2>Fiyat Geçmişi — {productId}</h2>
      {rows.length === 0 ? <div className="muted">kayıt yok</div> : (
        <table>
          <thead><tr><th>tarih</th><th>store</th><th>old → new</th><th>kaynak</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.changed_at).toLocaleString()}</td>
                <td>{r.store}</td>
                <td>{(r.old_price ?? "-")} → {r.new_price}</td>
                <td>{r.source_request_id || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ------------- Katalog -------------
function Catalog() {
  const [products, setProducts] = React.useState([]);
  const [labels, setLabels] = React.useState([]);
  const [p, setP] = React.useState({ id: "p-1", sku: "", name: "", base_price: 0 });
  const [l, setL] = React.useState({ id: "l-1", code: "", store: "IST-01" });
  const [a, setA] = React.useState({ label_id: "", product_id: "" });
  const [msg, setMsg] = React.useState("");
  const [selected, setSelected] = React.useState(null);

  async function refresh() {
    const [ps, ls] = await Promise.all([http.get("/products/"), http.get("/labels/")]);
    setProducts(ps); setLabels(ls);
  }
  React.useEffect(() => {
    refresh();
    // next-id senkronu
    http.get("/products/next-id").then(({id}) => setP(v=>({...v, id}))).catch(()=>{});
    http.get("/labels/next-id").then(({id}) => setL(v=>({...v, id}))).catch(()=>{});
  }, []);

  // canlı güncelleme -> listeyi taze tut
  React.useEffect(() => {
    let timer = null;
    const scheduleRefresh = () => { if (timer) return; timer = setTimeout(()=>{ timer=null; refresh().catch(()=>{}); }, 250); };
    const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/live/ws");
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      const RELOAD = new Set(["product-created","product-updated","product-deleted","label-created","label-updated","label-deleted","label-assigned","label-unassigned"]);
      if (msg?.type && RELOAD.has(msg.type)) scheduleRefresh();
    };
    return () => { try{ws.close();}catch{} if (timer) clearTimeout(timer); };
  }, []);

  async function createProduct() {
    try {
      await http.post("/products/", { id: p.id, sku: p.sku, name: p.name, base_price: parseFloat(p.base_price || 0), currency: "TRY" });
      setMsg("Ürün kaydedildi");
      // sıradaki
      http.get("/products/next-id").then(({id}) => setP({ id, sku:"", name:"", base_price:0 }));
      refresh();
    } catch (e) { setMsg("Hata: " + e.message); }
  }
  async function createLabel() {
    try {
      await http.post("/labels/", { id: l.id, label_code: l.code, store: l.store });
      setMsg("Etiket kaydedildi");
      http.get("/labels/next-id").then(({id}) => setL({ id, code:"", store:"IST-01" }));
      refresh();
    } catch (e) { setMsg("Hata: " + e.message); }
  }
  async function assign() {
    try { await http.post("/labels/assign", a); setMsg("Eşleştirme yapıldı"); refresh(); }
    catch (e) { setMsg("Hata: " + e.message); }
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
          <tbody>
            {products.map(x => (
              <tr key={x.id} onClick={()=>setSelected(x.id)} className={selected===x.id?"selected":""} style={{cursor:"pointer"}}>
                <td>{x.id}</td><td>{x.sku}</td><td>{x.name}</td><td>{x.base_price}</td>
              </tr>
            ))}
          </tbody>
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

        <PriceHistoryPanel productId={selected} />
      </div>
    </div>
  );
}

// ------------- Fiyat Değişikliği -------------
function PriceChangeWizard() {
  const [products, setProducts] = React.useState([]);
  const [req, setReq] = React.useState({ id: "req-1", product_id: "", store: "IST-01", new_price: "" });
  const [status, setStatus] = React.useState("PENDING");
  const [log, setLog] = React.useState([]);
  const pushLog = (t) => setLog((L)=>[...L, t]);

  React.useEffect(() => {
    http.get("/products/").then(setProducts);
    http.get("/price-changes/next-id").then(({id}) => setReq(r => ({...r, id}))).catch(()=>{});
  }, []);

  async function createReq() {
    try {
      await http.post("/price-changes/", { ...req, new_price: parseFloat(req.new_price || 0), reason: "panel" });
      setStatus("PENDING"); pushLog(`Talep oluşturuldu (${req.id})`);
    } catch (e) {
      pushLog("Talep hata: " + e.message);
    }
  }
  async function approve() {
    try {
      await http.post(`/price-changes/${req.id}/approve`, { approver: "admin", decision: "APPROVE", comment: "ok" });
      setStatus("APPROVED"); pushLog("Talep onaylandı");
    } catch (e) {
      pushLog("Onay hata: " + e.message);
    }
  }
  async function startPush() {
    try {
      await http.post(`/push/${req.id}/start`, {});
      pushLog("Dağıtım başlatıldı");
      setStatus("PENDING");
      http.get("/price-changes/next-id").then(({id}) => setReq({ id, product_id:"", store:"IST-01", new_price:"" }));
    } catch (e) {
      pushLog("Push hata: " + e.message + " ➊ Talep APPROVED mı? ➋ Bu store için ürüne etiket eşli mi?");
    }
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
        <button className="btn ghost" onClick={()=>{
          http.get("/price-changes/next-id").then(({id}) => setReq({ id, product_id:"", store:"IST-01", new_price:"" }));
          setStatus("PENDING"); setLog([]);
        }}>Temizle</button>
      </div>
      <div style={{marginTop:10}} className="muted">Durum: {status==="APPROVED"
        ? <span className="badge ok">APPROVED</span>
        : status==="PENDING" ? <span className="badge warn">PENDING</span> : status}</div>
      <ul>{log.map((x,i)=><li key={i} className="muted">{x}</li>)}</ul>
    </div>
  );
}

// ------------- Dağıtımlar -------------
function Deployments() {
  const [jobs, setJobs] = React.useState([]);
  const [auto, setAuto] = React.useState(true);
  const [error, setError] = React.useState("");

  async function load(){ 
    try { const data = await http.get("/push/jobs"); setJobs(data); setError(""); }
    catch (e) { setError("Yükleme hatası: " + e.message); }
  }
  React.useEffect(()=>{ load(); },[]);
  React.useEffect(()=>{ if(!auto) return; const t = setInterval(load, 2000); return ()=> clearInterval(t); },[auto]);

  const badge = (s) => s==="SUCCESS" ? "badge ok" : s==="FAILED" ? "badge bad" : s==="PROCESSING" ? "badge warn" : "badge";

  return (
    <div className="card">
      <h2>Dağıtım İşleri</h2>
      <div className="actions">
        <button className="btn ghost" onClick={load}>Yenile</button>
        <label style={{display:"flex",alignItems:"center",gap:6}} className="muted">
          <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> otomatik yenile
        </label>
      </div>
      {error && <div className="muted" style={{color:"#ef4444",marginTop:8}}>{error}</div>}
      <table style={{marginTop:10}}>
        <thead><tr><th>id</th><th>status</th><th>try</th><th>label</th><th>request</th></tr></thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr><td colSpan="5" style={{textAlign:"center",color:"var(--muted)"}}>Henüz dağıtım işi yok</td></tr>
          ) : (
            jobs.map(j=>(
              <tr key={j.id}>
                <td>{j.id}</td>
                <td><span className={badge(j.status)}>{j.status}</span></td>
                <td>{j.try_count}</td>
                <td>{j.label_id}</td>
                <td>{j.request_id}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ------------- Mağaza Kapsamı -------------
function StoreCoverageCard() {
  const [rows, setRows] = React.useState([]);
  const [auto, setAuto] = React.useState(true);
  const [err, setErr] = React.useState("");

  async function load() {
    try {
      const labels = await http.get("/labels/");
      const by = {};
      (labels || []).forEach(l => { by[l.store] = (by[l.store] || 0) + 1; });
      const out = Object.entries(by).map(([store, count]) => ({ store, count })).sort((a,b)=>b.count-a.count);
      setRows(out); setErr("");
    } catch (e) { setErr("Kapsam yüklenemedi: " + e.message); }
  }

  React.useEffect(() => { load(); }, []);
  React.useEffect(() => { if (!auto) return; const t = setInterval(load, 3000); return () => clearInterval(t); }, [auto]);

  const max = Math.max(1, ...rows.map(r => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="card">
      <h2>Mağaza Kapsamı</h2>
      <div className="actions" style={{marginBottom:8}}>
        <button className="btn ghost" onClick={load}>Yenile</button>
        <label className="muted" style={{display:"inline-flex",alignItems:"center",gap:6, marginLeft:12}}>
          <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} />
          otomatik yenile
        </label>
      </div>

      {err && <div className="muted" style={{color:"var(--danger)"}}>{err}</div>}

      {rows.length === 0 ? (
        <div className="muted">Henüz etiket kaydı yok.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Store</th><th>Etiket</th><th style={{width:220}}>Dağılım</th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pct = Math.round((r.count / max) * 100);
              return (
                <tr key={r.store}>
                  <td>{r.store}</td>
                  <td>{r.count}</td>
                  <td>
                    <div style={{height:10, background:"var(--muted-2)", borderRadius:6, overflow:"hidden"}}>
                      <div style={{width:pct+"%", height:"100%", background:"var(--accent)", transition:"width .3s"}}/>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td><b>Toplam</b></td>
              <td colSpan={2}><b>{total}</b></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

// ------------- App + Root -------------
function App() {
  const [tab, setTab] = React.useState("dash");
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
      {tab==="wall" && <LabelWall/>}
    </>
  );
}
function RootApp() {
  const [authed, setAuthed] = React.useState(!!localStorage.getItem('auth-token'));

  // user’ı yükle
  React.useEffect(()=>{ try { window.api.user = JSON.parse(localStorage.getItem("auth-user")||"null"); } catch {} }, []);

  // header mount
  React.useEffect(()=>{
    const holder = document.getElementById("theme-toggle");
    if (holder) ReactDOM.createRoot(holder).render(<ThemeSwitch />);
    
    const userbox = document.getElementById("userbox");
    if (userbox) ReactDOM.createRoot(userbox).render(
      <div style={{
        display:"inline-flex", 
        alignItems:"center", 
        gap:10, 
        padding:"8px 16px", 
        border:"1px solid var(--border)", 
        borderRadius:12,
        background:"linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.02))",
        boxShadow:"0 4px 12px rgba(0,0,0,.15)",
        backdropFilter:"blur(10px)"
      }}>
        <div style={{
          width:32,
          height:32,
          borderRadius:50,
          background:"linear-gradient(135deg, #6366f1, #22d3ee)",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          fontSize:14,
          fontWeight:700,
          color:"#0b1220"
        }}>
          {(window.api.user && (window.api.user.name || window.api.user.email) || "U").charAt(0).toUpperCase()}
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:2}}>
          <span style={{fontWeight:600, fontSize:13, color:"var(--text)"}}>
            {(window.api.user && (window.api.user.name || window.api.user.email)) || ""}
          </span>
          <span style={{fontSize:11, color:"var(--muted)"}}>Aktif</span>
        </div>
        <div style={{width:1, height:20, background:"var(--border)"}}></div>
        <button 
          className="btn ghost" 
          onClick={() => { 
            window.api.setToken(null); 
            localStorage.removeItem('auth-token'); 
            localStorage.removeItem('auth-user'); 
            setAuthed(false); 
          }}
          style={{
            padding:"6px 12px",
            fontSize:12,
            fontWeight:500,
            border:"1px solid var(--border)",
            borderRadius:8,
            background:"transparent",
            color:"var(--text)",
            cursor:"pointer",
            transition:"all 0.2s ease"
          }}
        >
          Çıkış
        </button>
      </div>
    );
  }, []);

  if (!authed) return <AuthShell onLoggedIn={(user) => {
    window.api.user = user || window.api.user || null;
    if (window.api.user) localStorage.setItem("auth-user", JSON.stringify(window.api.user));
    setAuthed(true);
  }} />;

  return <App/>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<RootApp/>);
