// @ts-nocheck
/* global React, ReactDOM */

// API yardımcısı (app.jsx'teki http'yi kullan)
const api = {
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(localStorage.getItem('auth-token') ? { Authorization: `Bearer ${localStorage.getItem('auth-token')}` } : {})
      },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.detail || r.statusText);
    return d;
  },
  setToken(token) {
    if (token) localStorage.setItem('auth-token', token);
    else localStorage.removeItem('auth-token');
  }
};

// Küçük yardımcılar
const errText = (e) => (e?.detail || e?.message || "Bir hata oluştu");

function Text({children, muted}) {
  return <div className={muted ? "muted" : ""} style={{marginTop:8}}>{children}</div>;
}

// ---- Login ----
function Login({ onLoggedIn, onSwitch }) {
  const [email, setEmail] = React.useState("");
  const [employeeNo, setEmployeeNo] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function submit(e) {
    e?.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);
    try {
      // Beklenen payload: { access_token, user: { full_name, email, employee_no } }
      const r = await api.post("/auth/login", {
        email,
        employee_no: employeeNo,
        password,
      });
      if (r?.access_token) api.setToken(r.access_token);
      if (r?.user) localStorage.setItem("auth-user", JSON.stringify(r.user));
      onLoggedIn?.(r?.user || null);
    } catch (e) {
      setErr(errText(await e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{maxWidth:560, margin:"24px auto"}}>
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h2>Giriş Yap</h2>
          <a className="link" href="#" onClick={(e)=>{e.preventDefault(); onSwitch?.("signup");}}>
            Hesabın yok mu? <b>Kayıt Ol</b>
          </a>
        </div>

        <form onSubmit={submit}>
          <label>E-posta</label>
          <input placeholder="adiniz@firma.com" value={email} onChange={e=>setEmail(e.target.value)} />

          <label style={{marginTop:8}}>Çalışan No</label>
          <input placeholder="ör. 12345" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} />

          <label style={{marginTop:8}}>Şifre</label>
          <input type="password" placeholder="********" value={password} onChange={e=>setPassword(e.target.value)} />

          {err && <div className="muted" style={{color:"#ef4444", marginTop:10}}>{err}</div>}

          <div className="actions" style={{marginTop:12}}>
            <button className="btn" type="submit" disabled={loading}>{loading ? "…" : "Giriş Yap"}</button>
            <button
              type="button"
              className="btn ghost"
              onClick={()=>{ window.location.href="/auth/google/start"; }}
              title="Google ile giriş"
              style={{display:"inline-flex",alignItems:"center",gap:8}}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.612 20.083H42V20H24v8h11.303C33.826 31.91 29.287 35 24 35c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.313 0 6.332 1.235 8.633 3.267l5.657-5.657C34.886 3.042 29.706 1 24 1 10.745 1 0 11.745 0 25s10.745 24 24 24c12.683 0 23-9.317 23-22 0-1.507-.155-2.977-.388-4.417z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.816C14.759 16.233 18.999 13 24 13c3.313 0 6.332 1.235 8.633 3.267l5.657-5.657C34.886 3.042 29.706 1 24 1 15.317 1 7.826 5.835 3.694 13.309l2.612 1.382z"/>
                <path fill="#4CAF50" d="M24 49c5.138 0 9.86-1.757 13.553-4.73l-6.252-5.192C29.316 40.365 26.772 41 24 41c-5.248 0-9.742-3.345-11.366-8.01l-6.503 5.005C9.05 44.946 16.034 49 24 49z"/>
                <path fill="#1976D2" d="M43.612 20.083H42V20H24v8h11.303c-1.086 3.109-3.547 5.556-6.752 6.735l6.252 5.192C36.024 41.5 41 36.5 41 27c0-2.252-.305-4.356-.888-6.417z"/>
              </svg>
              Google ile Giriş
            </button>
          </div>
        </form>

        <Text muted>Google ile giriş, kimlik doğrulaması sonrası tarayıcıdan alınan ID token’ın backend’e iletilmesiyle yapılır.</Text>
      </div>
    </div>
  );
}

// ---- Signup ----
function Signup({ onSwitch }) {
  const [email, setEmail] = React.useState("");
  const [employeeNo, setEmployeeNo] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(e) {
    e?.preventDefault();
    if (loading) return;
    setErr(""); setOk("");
    setLoading(true);
    try {
      // Beklenen davranış: doğrulama e-postası gönderilir
      const r = await api.post("/auth/register", {
        email,
        employee_no: employeeNo,
        name: fullName,
        password,
      });
      setOk("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
    } catch (e) {
      setErr(errText(await e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{maxWidth:560, margin:"24px auto"}}>
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h2>Kayıt Ol</h2>
          <a className="link" href="#" onClick={(e)=>{e.preventDefault(); onSwitch?.("login");}}>
            Hesabın var mı? <b>Giriş Yap</b>
          </a>
        </div>

        <form onSubmit={submit}>
          <label>Gmail</label>
          <input placeholder="adiniz@gmail.com" value={email} onChange={e=>setEmail(e.target.value)} />

          <label style={{marginTop:8}}>Çalışan No</label>
          <input placeholder="ör. 12345" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} />

          <label style={{marginTop:8}}>Ad Soyad</label>
          <input placeholder="Adınız Soyadınız" value={fullName} onChange={e=>setFullName(e.target.value)} />

          <label style={{marginTop:8}}>Şifre</label>
          <input type="password" placeholder="********" value={password} onChange={e=>setPassword(e.target.value)} />

          {err && <div className="muted" style={{color:"#ef4444", marginTop:10}}>{err}</div>}
          {ok && <div className="muted" style={{color:"#10b981", marginTop:10}}>{ok}</div>}

          <div className="actions" style={{marginTop:12}}>
            <button className="btn" type="submit" disabled={loading}>{loading ? "…" : "Kayıt Ol"}</button>
            <button
              type="button"
              className="btn ghost"
              onClick={()=>{ window.location.href="/auth/google/start"; }}
              title="Google ile kayıt"
              style={{display:"inline-flex",alignItems:"center",gap:8}}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.612 20.083H42V20H24v8h11.303C33.826 31.91 29.287 35 24 35c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.313 0 6.332 1.235 8.633 3.267l5.657-5.657C34.886 3.042 29.706 1 24 1 10.745 1 0 11.745 0 25s10.745 24 24 24c12.683 0 23-9.317 23-22 0-1.507-.155-2.977-.388-4.417z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.816C14.759 16.233 18.999 13 24 13c3.313 0 6.332 1.235 8.633 3.267l5.657-5.657C34.886 3.042 29.706 1 24 1 15.317 1 7.826 5.835 3.694 13.309l2.612 1.382z"/>
                <path fill="#4CAF50" d="M24 49c5.138 0 9.86-1.757 13.553-4.73l-6.252-5.192C29.316 40.365 26.772 41 24 41c-5.248 0-9.742-3.345-11.366-8.01l-6.503 5.005C9.05 44.946 16.034 49 24 49z"/>
                <path fill="#1976D2" d="M43.612 20.083H42V20H24v8h11.303c-1.086 3.109-3.547 5.556-6.752 6.735l6.252 5.192C36.024 41.5 41 36.5 41 27c0-2.252-.305-4.356-.888-6.417z"/>
              </svg>
              Google ile Kayıt Ol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Shell (Login/Signup arasında geçiş için) ----
function AuthShell({ onLoggedIn }) {
  const [mode, setMode] = React.useState("login");
  return mode === "login"
    ? <Login onLoggedIn={onLoggedIn} onSwitch={setMode} />
    : <Signup onSwitch={setMode} />;
}

// global export (App/RootApp tarafından kullanılacak)
window.Login = Login;
window.Signup = Signup;
window.AuthShell = AuthShell;
window.api = api;
