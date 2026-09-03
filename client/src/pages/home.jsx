import { Link } from "react-router-dom";

const B = "var(--brand)";
function Btn({ to, children, primary, small }) {
  return <Link to={to} className={`btn ${primary ? "" : "ghost"} ${small ? "sm" : ""}`} style={{ textDecoration: "none", ...(primary ? {} : {}) }}>{children}</Link>;
}
function Section({ children, style }) {
  return <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", ...style }}>{children}</section>;
}

export default function Home() {
  return (
    <div style={{ background: "var(--bg,#f6f8fc)", color: "var(--text,#0f172a)", minHeight: "100vh" }}>
      {/* Topbar */}
      <div style={{ borderBottom: "1px solid var(--border,#e5e9f2)", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <Section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: B, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>d</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>digitalfa</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#come-funziona" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }} className="lp-navlink">Come funziona</a>
            <a href="#prezzi" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }} className="lp-navlink">Prezzi</a>
            <Btn to="/login" small>Accedi</Btn>
            <Btn to="/signup" primary small>Inizia gratis</Btn>
          </div>
        </Section>
      </div>

      {/* Hero */}
      <Section style={{ paddingTop: 64, paddingBottom: 48, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "var(--brand-soft,#eaf0ff)", color: B, fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>Career transition potenziata dall'AI</div>
        <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: "18px auto 14px", maxWidth: 760, fontWeight: 800 }}>
          Trova il lavoro giusto e <span style={{ color: B }}>candidati in automatico</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--muted)", maxWidth: 640, margin: "0 auto 26px", lineHeight: 1.6 }}>
          digitalfa scansiona ogni giorno migliaia di offerte, le abbina al tuo profilo e prepara la candidatura — CV su misura, cover letter e risposte pronte. Tu approvi, noi acceleriamo.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn to="/signup" primary>Inizia gratis →</Btn>
          <Btn to="/login">Ho già un account</Btn>
        </div>
        <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--muted)" }}>Nessuna carta richiesta per iniziare · Disdici quando vuoi</div>
      </Section>

      {/* Tre pubblici */}
      <Section style={{ paddingBottom: 20 }}>
        <div className="lp-grid3">
          {[
            { ico: "◇", t: "Per chi cerca lavoro", d: "Offerte selezionate ogni giorno, match trasparente e candidatura assistita in un clic.", cta: "Cerco lavoro", to: "/signup" },
            { ico: "▤", t: "Per le aziende", d: "Outplacement e ricollocamento per i tuoi dipendenti, con dashboard HR e coach dedicati.", cta: "Siamo un'azienda", to: "/signup" },
            { ico: "◈", t: "Per i referral", d: "Segnala candidati per le posizioni aperte e monitora le tue segnalazioni.", cta: "Faccio referral", to: "/signup" },
          ].map((c) => (
            <div key={c.t} style={{ background: "#fff", border: "1px solid var(--border,#e5e9f2)", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 26 }}>{c.ico}</div>
              <h3 style={{ fontSize: 19, margin: "10px 0 6px" }}>{c.t}</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>{c.d}</p>
              <Btn to={c.to} small primary>{c.cta} →</Btn>
            </div>
          ))}
        </div>
      </Section>

      {/* Come funziona */}
      <Section style={{ paddingTop: 56, paddingBottom: 20 }}>
        <h2 id="come-funziona" style={{ textAlign: "center", fontSize: 30, fontWeight: 800, margin: "0 0 8px", scrollMarginTop: 80 }}>Come funziona</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", margin: "0 auto 32px", maxWidth: 560 }}>Dal profilo alla candidatura, in quattro passi.</p>
        <div className="lp-grid4">
          {[
            { n: "1", t: "Profilo & CV", d: "Carichi il CV: estraiamo dati, competenze e ruoli desiderati." },
            { n: "2", t: "Scansione quotidiana", d: "Interroghiamo Google Jobs, ATS aziendali e i migliori aggregatori." },
            { n: "3", t: "Match trasparente", d: "Ogni offerta ha un punteggio spiegato: ruolo, competenze, località." },
            { n: "4", t: "Candidatura assistita", d: "Compiliamo i form e riutilizziamo le tue risposte. Tu confermi." },
          ].map((s) => (
            <div key={s.n} style={{ background: "#fff", border: "1px solid var(--border,#e5e9f2)", borderRadius: 14, padding: 20 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: B, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{s.n}</div>
              <div style={{ fontWeight: 700, margin: "12px 0 4px" }}>{s.t}</div>
              <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Prezzi */}
      <Section style={{ paddingTop: 56, paddingBottom: 20 }}>
        <h2 id="prezzi" style={{ textAlign: "center", fontSize: 30, fontWeight: 800, margin: "0 0 8px", scrollMarginTop: 80 }}>Prezzi semplici</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", margin: "0 auto 32px", maxWidth: 560 }}>Inizia gratis. Passa a Premium quando vuoi accelerare.</p>
        <div className="lp-grid3">
          {[
            { name: "Free", price: "€0", note: "per iniziare", feats: ["Profilo & CV", "Offerte compatibili", "Risorse formative"], cta: "Inizia gratis", hl: false },
            { name: "Settimanale", price: "€14,99", note: "a settimana", feats: ["Candidature illimitate", "Auto-candidatura assistita", "Matching avanzato", "Risorse premium"], cta: "Scegli", hl: false },
            { name: "Mensile", price: "€12,99", note: "a settimana · fatturato ogni 4 settimane", feats: ["Tutto del settimanale", "Prezzo più basso bloccato", "1 coaching al mese", "Supporto prioritario"], cta: "Scegli", hl: true },
          ].map((p) => (
            <div key={p.name} style={{ background: "#fff", border: `1px solid ${p.hl ? B : "var(--border,#e5e9f2)"}`, boxShadow: p.hl ? "0 8px 30px rgba(30,64,175,.12)" : "none", borderRadius: 16, padding: 24, position: "relative" }}>
              {p.hl && <div style={{ position: "absolute", top: -11, left: 24, background: B, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>Consigliato</div>}
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
              <div style={{ margin: "8px 0 2px" }}><span style={{ fontSize: 32, fontWeight: 800 }}>{p.price}</span></div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 14 }}>{p.note}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px" }}>
                {p.feats.map((f) => <li key={f} style={{ fontSize: 13.5, padding: "5px 0", color: "var(--text)" }}>✓ {f}</li>)}
              </ul>
              <Btn to="/signup" primary={p.hl} small>{p.cta}</Btn>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA finale */}
      <Section style={{ paddingTop: 56, paddingBottom: 64 }}>
        <div style={{ background: B, color: "#fff", borderRadius: 20, padding: "40px 28px", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px" }}>Il tuo prossimo lavoro, più vicino</h2>
          <p style={{ opacity: .9, margin: "0 auto 22px", maxWidth: 520 }}>Crea il profilo in 2 minuti e ricevi già oggi le prime offerte compatibili.</p>
          <Link to="/signup" className="btn" style={{ background: "#fff", color: B, textDecoration: "none", fontWeight: 700 }}>Inizia gratis →</Link>
        </div>
      </Section>

      <div style={{ borderTop: "1px solid var(--border,#e5e9f2)", background: "#fff" }}>
        <Section style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, color: "var(--muted)", fontSize: 12.5 }}>
          <div>© {new Date().getFullYear()} digitalfa · Career Transition</div>
          <div style={{ display: "flex", gap: 14 }}><Link to="/login" style={{ color: "var(--muted)" }}>Accedi</Link><Link to="/signup" style={{ color: "var(--muted)" }}>Registrati</Link></div>
        </Section>
      </div>
    </div>
  );
}
