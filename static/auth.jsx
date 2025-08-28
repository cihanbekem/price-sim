// /static/auth.jsx
// @ts-nocheck
/* global React, ReactDOM */

(() => {
    // ---- Basit token & fetch sarmalayıcısı ----
    const TOKEN_KEY = "auth-token";
  
    const api = (window.api ||= {});
    api.token = localStorage.getItem(TOKEN_KEY);
    api.onUnauthorized = null;
  
    api.setToken = (t) => {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
      api.token = t || null;
    };
  
    // Tüm istekleri tek noktadan geçir
    async function coreFetch(url, opts = {}) {
      const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
      if (api.token) headers.Authorization = "Bearer " + api.token;
      const r = await fetch(url, { ...opts, headers });
      if (r.status === 401 && typeof api.onUnauthorized === "function") {
        try { api.onUnauthorized(); } catch {}
      }
      return r;
    }
  
    api.get = async (url) => {
      const r = await coreFetch(url);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || r.statusText);
      return d;
    };
    api.post = async (url, body) => {
      const r = await coreFetch(url, { method: "POST", body: JSON.stringify(body || {}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || r.statusText);
      return d;
    };
    api.del = async (url) => {
      const r = await coreFetch(url, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || r.statusText);
      return d;
    };
  
    // ---- Google Logosu (inline SVG) ----
    const GoogleIcon = () => (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.9 0-12.5-5.6-12.5-12.5S17.1 11 24 11c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.3 5.7 29.4 4 24 4 12.4 4 3 13.4 3 25s9.4 21 21 21 21-9.4 21-21c0-1.5-.2-3-.4-4.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.3 5.7 29.4 4 24 4 16.1 4 9.3 8.5 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 46c5.2 0 10-2 13.6-5.4l-6.3-5.2C29.2 37.2 26.8 38 24 38c-5.2 0-9.6-3.3-11.2-8l-6.6 5C9.2 41.2 16 46 24 46z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-0.7 2-2 3.7-3.7 4.9l0 0 6.3 5.2C40.9 34.9 43 30.3 43 25 43 23.5 42.9 22 43.6 20.5z"/>
      </svg>
    );
  
    // ---- Ortak küçük bileşenler ----
    const Field = ({ label, ...rest }) => (
      <div>
        <label>{label}</label>
        <input {...rest} />
      </div>
    );
  
    const GoogleButton = ({ children, ...rest }) => (
      <button className="btn ghost" style={{display:"flex",alignItems:"center",gap:8}} {...rest}>
        <GoogleIcon /> {children}
      </button>
    );
  
    // ---- Login & Signup kartı ----
    function Login({ onLoggedIn }) {
      const [mode, setMode] = React.useState("login"); // 'login' | 'signup'
      const [loading, setLoading] = React.useState(false);
      const [err, setErr] = React.useState("");
      const [info, setInfo] = React.useState("");

      // login form (email/password)
      const [email, setEmail] = React.useState("");
      const [password, setPassword] = React.useState("");

      // signup form
      const [name, setName] = React.useState("");
      const [employeeNo, setEmployeeNo] = React.useState("");
      const [signupEmail, setSignupEmail] = React.useState("");
      const [signupPassword, setSignupPassword] = React.useState("");
      const gRef = React.useRef(null);
  
      async function handleLogin(e) {
        e.preventDefault();
        setErr(""); setInfo(""); setLoading(true);
        try {
          // Backend: /auth/login { email, password } -> { token }
          const res = await api.post("/auth/login", { email, password });
          api.setToken(res.token);
          api.user = res.user || { email };
          try { localStorage.setItem("auth-user", JSON.stringify(api.user)); } catch {}
          onLoggedIn?.(api.user);
        } catch (e) {
          setErr(e.message || "Giriş başarısız");
        } finally { setLoading(false); }
      }
  
      async function handleSignup(e) {
        e.preventDefault();
        setErr(""); setInfo(""); setLoading(true);
        try {
          // Backend: /auth/register { email, name, employee_no, password } -> { ok }
          await api.post("/auth/register", { email: signupEmail, name, employee_no: employeeNo, password: signupPassword });
          setInfo("Kayıt başarılı. Şimdi giriş yapın.");
          setMode("login");
        } catch (e) {
          setErr(e.message || "Kayıt başarısız");
        } finally { setLoading(false); }
      }
  
      // Google button: GIS id_token -> /auth/google
      React.useEffect(() => {
        let t;
        function tryInit(){
          const el = gRef.current;
          const cid = window.GOOGLE_CLIENT_ID || "";
          if (!el || !window.google || !window.GIS_READY || !cid) { t = setTimeout(tryInit, 200); return; }
          try{
            window.google.accounts.id.initialize({
              client_id: cid,
              callback: async (resp) => {
                try{
                  const cred = resp && resp.credential;
                  if (!cred) throw new Error("Google kimliği alınamadı");
                  const { token, user } = await api.post("/auth/google", { id_token: cred });
                  api.setToken(token);
                  api.user = user;
                  try { localStorage.setItem("auth-user", JSON.stringify(api.user)); } catch {}
                  onLoggedIn?.(api.user);
                }catch(err){ setErr(String(err.message || err)); }
              },
            });
            window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", width: 300 });
          }catch(e){ t = setTimeout(tryInit, 300); }
        }
        tryInit();
        return () => t && clearTimeout(t);
      }, []);
  
      return (
        <main style={{maxWidth: 980, margin:"34px auto", padding:"0 16px"}}>
          <div className="grid cols-2">
            <div className="card">
              <h2 style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                <div className="muted" style={{fontWeight:600, fontSize:12}}>
                  {mode === "login" ? (
                    <>Hesabın yok mu? <a className="link" href="#" onClick={(e)=>{e.preventDefault(); setMode("signup");}}>Kayıt Ol</a></>
                  ) : (
                    <>Hesabın var mı? <a className="link" href="#" onClick={(e)=>{e.preventDefault(); setMode("login");}}>Giriş Yap</a></>
                  )}
                </div>
              </h2>
  
              {mode === "login" ? (
                <form onSubmit={handleLogin}>
                  <div className="row" style={{gridTemplateColumns:"1fr"}}>
                    <Field label="E-posta" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="adiniz@firma.com" required />
                    <Field label="Şifre" type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" />
                  </div>
                  {err && <div className="muted" style={{color:"#ef4444"}}>{err}</div>}
                  <div className="actions">
                    <button className="btn" disabled={loading} type="submit">{loading ? "Giriş yapılıyor…" : "Giriş Yap"}</button>
                    <div ref={gRef}></div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignup}>
                  <div className="row" style={{gridTemplateColumns:"1fr 1fr"}}>
                    <Field label="Ad Soyad" value={name} onChange={e=>setName(e.target.value)} placeholder="Ad Soyad" required />
                    <Field label="Çalışan No" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} placeholder="örn. 100234" />
                  </div>
                  <div className="row" style={{gridTemplateColumns:"1fr 1fr"}}>
                    <Field label="E-posta" type="email" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} placeholder="adiniz@firma.com" required />
                    <Field label="Şifre" type="password" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                  {err && <div className="muted" style={{color:"#ef4444"}}>{err}</div>}
                  {info && <div className="muted" style={{color:"#10b981"}}>{info}</div>}
                  <div className="actions">
                    <button className="btn" disabled={loading} type="submit">{loading ? "Kaydediliyor…" : "Kayıt Ol"}</button>
                    <div ref={gRef}></div>
                  </div>
                </form>
              )}
  
              <div className="muted" style={{marginTop:10, fontSize:12}}>
                Google ile giriş, kimlik doğrulama sonrası tarayıcıdan alınan ID token’ın backend’e iletilmesiyle yapılır.
              </div>
            </div>
  
            <div className="card">
              <h2>Bilgi</h2>
              <ul className="muted" style={{margin:0, paddingLeft:18}}>
                <li>UI teması mevcut uygulamayla bire bir uyumlu.</li>
                <li>Google ile giriş ücretsizdir (Google OAuth). </li>
                <li>E-posta doğrulamasını Firebase Auth / Supabase gibi ücretsiz katmanla başlatabiliriz.</li>
                <li>Küçük ölçekte tümü “free tier” içinde kalır.</li>
              </ul>
            </div>
          </div>
        </main>
      );
    }
  
    // global export
    window.Login = Login;
  })();
  