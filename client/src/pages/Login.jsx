import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api.js";

const ROLE_LABEL = { candidate: "Candidato", coach: "Career Coach", hr: "Azienda · HR", admin: "Admin", referral: "Referral", staff: "Staff" };

const INTENTS = [
  { key: "job_seeker", label: "Cerco lavoro", desc: "Sono in transizione e voglio trovare una nuova posizione." },
  { key: "employer", label: "Sono un'azienda (HR)", desc: "Cerco personale e offro ricollocamento ai dipendenti in uscita." },
  { key: "referral", label: "Referral aziendale", desc: "Segnalo candidati per le posizioni aperte nella mia azienda." },
];

export default function Login() {
  const { login, authenticate } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("login"); // "login" | "signup"
  // login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);
  // signup state
  const [sEmail, setSEmail] = useState("");
  const [sUser, setSUser] = useState("");
  const [sPass, setSPass] = useState("");
  const [intent, setIntent] = useState("job_seeker");
  const [sTerms, setSTerms] = useState(false);
  const [sRef, setSRef] = useState("");
  const [sErr, setSErr] = useState("");
  const [sBusy, setSBusy] = useState(false);
  // forgot-password state
  const [fEmail, setFEmail] = useState("");
  const [fMsg, setFMsg] = useState("");
  const [fBusy, setFBusy] = useState(false);

  useEffect(() => { api.demoAccounts().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash : "";
    const m = h.match(/[?&]ref=([A-Za-z0-9_-]+)/);
    if (m) { setSRef(m[1].toUpperCase()); setTab("signup"); setIntent("job_seeker"); }
  }, []);

  async function submit(e) {
    e?.preventDefault(); setErr(""); setBusy(true);
    try { await login(email, password); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function quick(acc) {
    setEmail(acc.email); setPassword(acc.password); setErr(""); setBusy(true);
    try { await login(acc.email, acc.password); } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function forgot(e) {
    e?.preventDefault(); setFMsg(""); setFBusy(true);
    try { await api.forgotPassword(fEmail); setFMsg("Se l'indirizzo è registrato, ti abbiamo inviato un'email con il link per reimpostare la password. Controlla anche lo spam."); }
    catch (err) { setFMsg(err.message); } finally { setFBusy(false); }
  }
  async function signup(e) {
    e?.preventDefault(); setSErr("");
    if (!sTerms) { setSErr("Devi accettare i Termini e condizioni per registrarti."); return; }
    setSBusy(true);
    try {
      const { token, user } = await api.signup({ email: sEmail, username: sUser, password: sPass, intent, acceptTerms: sTerms, ref: sRef || undefined });
      authenticate(token, user);
      // Chi cerca lavoro vede subito la profilazione.
      if (user.role === "candidate") navigate("/app/onboarding");
    } catch (e) { setSErr(e.message); setSBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="row" style={{ gap: 10 }}>
          <div className="brand-logo" style={{ width: 38, height: 38 }}>d</div>
          <div className="brand-name">digitalfa</div>
        </div>
        <div>
          <h2>Ogni fine carriera<br />è un nuovo inizio.</h2>
          <p>La piattaforma di ricollocamento professionale che connette persone in transizione, career coach e aziende — in un unico percorso guidato.</p>
          <div className="hero-feats">
            <div className="hero-feat"><div className="fi">◎</div><div><div className="ft">Percorso personalizzato</div><div className="fs">Milestone, coaching e obiettivi chiari per ogni candidato.</div></div></div>
            <div className="hero-feat"><div className="fi">◇</div><div><div className="ft">Matching con le offerte</div><div className="fs">Posizioni suggerite in base a competenze e seniority.</div></div></div>
            <div className="hero-feat"><div className="fi">▤</div><div><div className="ft">Visibilità per le aziende</div><div className="fs">Le HR seguono l'andamento del programma in tempo reale.</div></div></div>
          </div>
        </div>
        <div style={{ color: "#8b97bd", fontSize: 12 }}>Prototipo dimostrativo · dati fittizi</div>
      </div>

      <div className="login-form">
        <div className="login-box">
          {tab === "forgot" ? (
            <>
              <h3>Recupera password</h3>
              <p className="muted" style={{ marginTop: 6 }}>Inserisci la tua email: ti invieremo un link per reimpostare la password.</p>
              <form onSubmit={forgot}>
                <div className="field"><label>Email</label>
                  <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="nome@email.com" /></div>
                {fMsg && <div className="flash" style={{ marginTop: 12 }}>{fMsg}</div>}
                <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={fBusy}>{fBusy ? "Invio…" : "Invia il link di reset"}</button>
              </form>
              <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
                <a onClick={() => setTab("login")} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>← Torna all'accesso</a>
              </p>
            </>
          ) : tab === "login" ? (
            <>
              <h3>Accedi</h3>
              <p className="muted" style={{ marginTop: 6 }}>Entra nella tua area riservata.</p>
              <form onSubmit={submit}>
                <div className="field"><label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@azienda.com" /></div>
                <div className="field"><label>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" /></div>
                {err && <div className="login-err">{err}</div>}
                <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
              </form>
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                <a onClick={() => { setFMsg(""); setTab("forgot"); }} style={{ color: "var(--brand)", cursor: "pointer" }}>Password dimenticata?</a>
              </p>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Non hai un account?{" "}
                <a onClick={() => setTab("signup")} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>Registrati →</a>
              </p>
            </>
          ) : (
            <>
              <h3>Registrati</h3>
              {sRef && <div className="flash" style={{ margin: "8px 0" }}>🎁 Sei stato invitato! Registrati per iniziare.</div>}
              <p className="muted" style={{ marginTop: 6 }}>Crea il tuo account gratuito. L'abbonamento lo scegli dopo, dalla tua dashboard.</p>
              <form onSubmit={signup}>
                <div className="field"><label>Email</label>
                  <input type="email" value={sEmail} onChange={(e) => setSEmail(e.target.value)} placeholder="nome@email.com" /></div>
                <div className="field"><label>Username</label>
                  <input type="text" value={sUser} onChange={(e) => setSUser(e.target.value)} placeholder="Come vuoi essere chiamato/a" /></div>
                <div className="field"><label>Password</label>
                  <input type="password" value={sPass} onChange={(e) => setSPass(e.target.value)} placeholder="Almeno 6 caratteri" /></div>
                <div className="field"><label>Cosa vuoi fare?</label>
                  <div className="intent-grid">
                    {INTENTS.map((it) => (
                      <button type="button" key={it.key} className={`intent-tile ${intent === it.key ? "on" : ""}`} onClick={() => setIntent(it.key)}>
                        <div className="it-l">{it.label}</div>
                        <div className="it-d">{it.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="check" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, marginTop: 4 }}>
                  <input type="checkbox" checked={sTerms} onChange={(e) => setSTerms(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Accetto i <a href="#/terms" target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>Termini e condizioni</a> e l'informativa privacy.</span>
                </label>
                {sErr && <div className="login-err">{sErr}</div>}
                <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={sBusy || !sTerms}>{sBusy ? "Creazione…" : "Crea account"}</button>
              </form>
              <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
                Hai già un account?{" "}
                <a onClick={() => setTab("login")} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>Accedi →</a>
              </p>
            </>
          )}

          <div className="demo-accounts">
            <div className="h">Accesso rapido (demo)</div>
            <div className="demo-grid">
              {accounts.map((a) => (
                <button key={a.role} className="demo-btn" onClick={() => quick(a)}>
                  <div className="dr">{ROLE_LABEL[a.role]}</div>
                  <div className="de">{a.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
