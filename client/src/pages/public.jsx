import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

function PublicShell({ children, wide }) {
  const navigate = useNavigate();
  return (
    <div className="public">
      <header className="public-top">
        <div className="row" style={{ gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div className="brand-logo" style={{ width: 34, height: 34 }}>d</div>
          <div className="brand-name" style={{ color: "var(--text)" }}>digitalfa</div>
        </div>
        <button className="btn ghost sm" onClick={() => navigate("/")}>Accedi</button>
      </header>
      <div className={`public-body ${wide ? "wide" : ""}`}>{children}</div>
    </div>
  );
}

const fmtPrice = (p) => (p.contact ? "Su contatto" : p.price === 0 ? "Gratis" : `€${p.price}`);

// Handles the LinkedIn OAuth redirect: /#/auth?token=JWT
export function AuthCallback() {
  const [params] = useSearchParams();
  const { primeToken, authenticate } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const token = params.get("token");
    if (!token) { navigate("/"); return; }
    primeToken(token);
    api.me().then((u) => { authenticate(token, u); navigate("/app"); }).catch(() => navigate("/"));
  }, []); // eslint-disable-line
  return <PublicShell><div className="signup-card card" style={{ textAlign: "center" }}>Accesso in corso…</div></PublicShell>;
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr("");
    if (pw.length < 6) return setErr("La password deve avere almeno 6 caratteri.");
    if (pw !== pw2) return setErr("Le due password non coincidono.");
    setBusy(true);
    try { await api.resetPassword(token, pw); setDone(true); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <PublicShell>
      <div className="signup-card card">
        <h2 style={{ marginTop: 0 }}>Reimposta la password</h2>
        {!token ? (
          <p className="muted">Link non valido: manca il token. Richiedi un nuovo reset dalla pagina di accesso.</p>
        ) : done ? (
          <>
            <div className="flash">Password aggiornata. Ora puoi accedere con la nuova password.</div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/")}>Vai all'accesso →</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field"><label>Nuova password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Almeno 6 caratteri" /></div>
            <div className="field"><label>Ripeti la password</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ripeti la password" /></div>
            {err && <div className="login-err">{err}</div>}
            <button className="btn" style={{ width: "100%", marginTop: 16 }} disabled={busy}>{busy ? "Salvataggio…" : "Salva nuova password"}</button>
          </form>
        )}
      </div>
    </PublicShell>
  );
}

export function Pricing() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState("individual");
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.plans().then(setPlans).catch(() => {}); }, []);
  const list = plans.filter((p) => p.audience === audience);

  return (
    <PublicShell wide>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <h1 style={{ fontSize: 30 }}>Attiva digitalfa</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>
          Scegli il piano più adatto. Nessun vincolo: puoi disdire quando vuoi.
        </p>
        <div className="seg" style={{ margin: "20px auto 0", width: "fit-content" }}>
          <button className={audience === "individual" ? "on" : ""} onClick={() => setAudience("individual")}>Per me</button>
          <button className={audience === "company" ? "on" : ""} onClick={() => setAudience("company")}>Per la mia azienda</button>
        </div>
      </div>

      <div className={`grid ${list.length > 2 ? "cols-3" : "cols-2"}`} style={{ alignItems: "stretch" }}>
        {list.map((p) => (
          <div className={`card price-card ${p.popular ? "popular" : ""}`} key={p.id}>
            {p.popular && <div className="popular-tag">Più scelto</div>}
            <div className="price-name">{p.name}</div>
            <div className="price-tag muted">{p.tagline}</div>
            <div className="price-val">{fmtPrice(p)}{!p.contact && p.price > 0 && <span className="price-per">/mese</span>}</div>
            <div className="divider" style={{ margin: "16px 0" }} />
            <ul className="feat-list">
              {p.features.map((f) => <li key={f}><span className="tick">✓</span>{f}</li>)}
            </ul>
            <button
              className={`btn ${p.popular ? "" : "ghost"}`}
              style={{ width: "100%", marginTop: 18 }}
              onClick={() => navigate(`/signup?plan=${p.id}&mode=${audience}`)}
            >
              {p.contact ? "Contatta le vendite" : p.price === 0 ? "Inizia gratis" : "Scegli " + p.name}
            </button>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}

export function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { primeToken, authenticate } = useAuth();
  const planId = params.get("plan") || "ind_free";
  const mode = params.get("mode") || "individual";

  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", companyName: "" });
  const [step, setStep] = useState("form"); // form | payment | done | contact
  const [pending, setPending] = useState(null); // {token, user}
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", exp: "12/28", cvc: "123", brand: "Visa" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.plans().then((all) => setPlan(all.find((p) => p.id === planId))).catch(() => {}); }, [planId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submitForm(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await api.register({ mode, ...form, planId });
      primeToken(res.token);
      setPending({ token: res.token, user: res.user });
      if (res.checkout?.activated) { authenticate(res.token, res.user); navigate("/app/billing"); return; }
      if (res.checkout?.contactSales) { setStep("contact"); return; }
      setStep("payment");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function pay() {
    setErr(""); setBusy(true);
    try {
      const co = await api.checkout(planId);
      if (co.url) { window.location.href = co.url; return; }        // real Stripe Checkout
      // simulated: collect card then confirm
      const parts = card.exp.split("/");
      await api.confirmCheckout(planId, { brand: card.brand, number: card.number.replace(/\s/g, ""), expMonth: +parts[0], expYear: 2000 + +(parts[1] || 28) });
      authenticate(pending.token, pending.user);
      navigate("/app/billing?success=1");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <PublicShell>
      <div className="signup-card card">
        {plan && (
          <div className="signup-plan">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Piano selezionato</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>digitalfa {plan.name} · {mode === "company" ? "Azienda" : "Individuale"}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{fmtPrice(plan)}{!plan.contact && plan.price > 0 && <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>/mese</span>}</div>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={submitForm}>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Crea il tuo account</h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Bastano pochi secondi.</p>
            {mode === "company" && (
              <div className="field"><label>Nome azienda</label><input value={form.companyName} onChange={set("companyName")} placeholder="La tua azienda S.r.l." /></div>
            )}
            <div className="field"><label>Nome e cognome</label><input value={form.name} onChange={set("name")} placeholder="Mario Rossi" /></div>
            <div className="field"><label>Email di lavoro</label><input type="email" value={form.email} onChange={set("email")} placeholder="nome@azienda.com" /></div>
            <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set("password")} placeholder="••••••" /></div>
            {err && <div className="login-err">{err}</div>}
            <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
              {busy ? "Attendere…" : plan?.price === 0 ? "Crea account gratuito" : "Continua al pagamento"}
            </button>
          </form>
        )}

        {step === "payment" && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Pagamento</h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Pagamento sicuro con Stripe. In questa demo il checkout è simulato — usa la carta di test già compilata.
            </p>
            <div className="field"><label>Numero carta</label><input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}><label>Scadenza</label><input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/AA" /></div>
              <div className="field" style={{ width: 100 }}><label>CVC</label><input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></div>
            </div>
            {err && <div className="login-err">{err}</div>}
            <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy} onClick={pay}>
              {busy ? "Elaborazione…" : `Paga ${plan ? fmtPrice(plan) + "/mese" : ""} e attiva`}
            </button>
            <div className="secure-note">🔒 I dati della carta non vengono mai salvati sui nostri server.</div>
          </div>
        )}

        {step === "contact" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 40 }}>✉️</div>
            <h2 style={{ fontSize: 20, margin: "10px 0 6px" }}>Grazie!</h2>
            <p className="muted">Il tuo account Enterprise è stato creato. Il nostro team commerciale ti contatterà per definire posti e attivazione.</p>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => { authenticate(pending.token, pending.user); navigate("/app"); }}>Entra nella dashboard</button>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
