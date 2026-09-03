import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const STEPS = ["CV", "I tuoi dati", "Titoli", "Esperienza", "Salario", "Settori", "Tipo di lavoro", "Modalità", "Luogo", "LinkedIn", "Azienda"];
const fmtEuro = (n) => "€" + Number(n).toLocaleString("it-IT");
const SENIORITY_TO_EXP = { Junior: "junior", Mid: "mid", Senior: "senior", Manager: "10_plus" };

// ---- Step CV: upload & extract, or enter data manually ----
function StepCV({ onFile, cvChoice, setCvChoice, cvName, busy, err }) {
  return (
    <div>
      <div className="ob-grid">
        <button className={`ob-tile ${cvChoice === "upload" ? "on" : ""}`} onClick={() => setCvChoice("upload")}>
          <div className="t">📄 Carica il CV ed estrai i dati</div>
          <div className="d">Leggiamo il tuo CV e precompiliamo i campi. Potrai correggere tutto prima di salvare.</div>
        </button>
        <button className={`ob-tile ${cvChoice === "manual" ? "on" : ""}`} onClick={() => setCvChoice("manual")}>
          <div className="t">✍️ Inserisci i dati manualmente</div>
          <div className="d">Compili tu i campi passo per passo. Potrai caricare il CV anche in seguito.</div>
        </button>
      </div>
      {cvChoice === "upload" && (
        <div style={{ marginTop: 16 }}>
          <label className="btn ghost" style={{ display: "inline-block", cursor: "pointer" }}>
            {busy ? "Lettura del CV…" : (cvName ? `✓ ${cvName} — carica un altro` : "Scegli un file (PDF o DOCX)")}
            <input type="file" accept=".pdf,.docx" style={{ display: "none" }} disabled={busy} onChange={onFile} />
          </label>
          {cvName && !busy && <div className="ob-note" style={{ color: "var(--ok, #1c7a43)" }}>Dati estratti dal CV: li rivedi al passo successivo.</div>}
          {err && <div className="login-err" style={{ marginTop: 10 }}>{err}</div>}
        </div>
      )}
      <div className="ob-note">Il CV è la base per generare la Cover Letter e il pacchetto di candidatura. Se scegli l'inserimento manuale, potrai caricarlo più avanti.</div>
    </div>
  );
}

// ---- Step "I tuoi dati" (personal, editable, prefilled from CV) ----
function StepPersonal({ personal, setPersonal, fromCv }) {
  const set = (k) => (e) => setPersonal({ ...personal, [k]: e.target.value });
  const skillsStr = (personal.skills || []).join(", ");
  return (
    <div className="stack" style={{ gap: 12 }}>
      {fromCv && <div className="ob-note" style={{ marginTop: 0 }}>Abbiamo precompilato questi campi dal tuo CV: controllali e correggi ciò che serve.</div>}
      <div className="field" style={{ margin: 0 }}><label>Nome e cognome</label><input value={personal.fullName || ""} onChange={set("fullName")} placeholder="Mario Rossi" /></div>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <div className="field" style={{ margin: 0 }}><label>Telefono</label><input value={personal.phone || ""} onChange={set("phone")} placeholder="+39 ..." /></div>
        <div className="field" style={{ margin: 0 }}><label>Città</label><input value={personal.location || ""} onChange={set("location")} placeholder="Milano" /></div>
      </div>
      <div className="field" style={{ margin: 0 }}><label>Competenze (separate da virgola)</label><input value={skillsStr} onChange={(e) => setPersonal({ ...personal, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="SQL, Project management, ..." /></div>
      <div className="field" style={{ margin: 0 }}><label>Sintesi professionale</label><textarea rows={3} className="ob-input" style={{ resize: "vertical" }} value={personal.summary || ""} onChange={set("summary")} placeholder="Due o tre righe su di te." /></div>
    </div>
  );
}

function TileGrid({ items, selected, onToggle, multi }) {
  return (
    <div className="ob-grid">
      {items.map((it) => {
        const on = multi ? selected.includes(it.key) : selected === it.key;
        return (
          <button key={it.key} className={`ob-tile ${on ? "on" : ""}`} onClick={() => onToggle(it.key)}>
            <div className="t">{it.label}</div>
            {it.desc && <div className="d">{it.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}

function StepTitles({ options, value, set }) {
  const [q, setQ] = useState("");
  const titles = value.desiredTitles || [];
  const sugg = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return (options.titles || []).filter((t) => t.toLowerCase().includes(ql) && !titles.includes(t)).slice(0, 6);
  }, [q, options.titles, titles]);
  const add = (t) => { const v = (t || q).trim(); if (v && !titles.includes(v)) set({ desiredTitles: [...titles, v] }); setQ(""); };
  return (
    <div>
      <div className="ob-tags">
        {titles.map((t) => (
          <span className="ob-chip" key={t}>{t}<button onClick={() => set({ desiredTitles: titles.filter((x) => x !== t) })}>×</button></span>
        ))}
      </div>
      <input className="ob-input" value={q} placeholder="Inserisci un titolo di lavoro…"
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      {sugg.length > 0 && (
        <div className="ob-sugg">{sugg.map((s) => <button key={s} onClick={() => add(s)}>{s}</button>)}</div>
      )}
      {q.trim() && <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => add()}>+ Aggiungi “{q.trim()}”</button>}
      <div className="ob-note">Se hai caricato il CV, qui trovi già i titoli suggeriti. Puoi aggiungerne o rimuoverne.</div>
    </div>
  );
}

export function OnboardingWizard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [cvChoice, setCvChoice] = useState(user?.cvUploadedAt ? "upload" : null);
  const [cvName, setCvName] = useState(user?.cvFileName || "");
  const [cvBusy, setCvBusy] = useState(false);
  const [cvErr, setCvErr] = useState("");
  const [fromCv, setFromCv] = useState(false);
  const [personal, setPersonal] = useState({
    fullName: user?.name || "", phone: user?.phone || "", location: user?.location && user.location !== "—" ? user.location : "",
    summary: user?.summary || "", skills: user?.skills || [],
  });
  const [form, setForm] = useState({
    desiredTitles: user?.desiredTitles || [],
    experienceLevel: user?.experienceLevel || null,
    minSalary: user?.minSalary || 40000,
    sectors: user?.sectors || [],
    jobTypes: user?.jobTypes || [],
    workModes: user?.workModes || [],
    linkedinUrl: user?.linkedinUrl || "",
    preferredLocations: user?.preferredLocations || [],
    companyTypes: user?.companyTypes || [],
  });
  const [locInput, setLocInput] = useState("");
  const [terms, setTerms] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => { api.onboardingOptions().then(setOptions).catch(() => {}); }, []);
  if (!options) return <div className="spinner-wrap">Caricamento…</div>;

  const toggleArr = (key, v) => set({ [key]: form[key].includes(v) ? form[key].filter((x) => x !== v) : [...form[key], v] });

  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setCvErr(""); setCvBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
      const res = await api.uploadCv(f.name, dataUrl);
      const ex = res.extracted || {};
      setCvName(f.name); setFromCv(true);
      if (res.user) updateUser(res.user);
      // Prefill personal + role fields (all editable later).
      setPersonal((p) => ({
        fullName: ex.fullName || p.fullName, phone: ex.phone || p.phone, location: ex.location || p.location,
        summary: ex.summary || p.summary, skills: (ex.skills && ex.skills.length) ? ex.skills : p.skills,
      }));
      setForm((prev) => ({
        ...prev,
        desiredTitles: (ex.desiredTitles && ex.desiredTitles.length) ? ex.desiredTitles : prev.desiredTitles,
        sectors: (ex.sectors && ex.sectors.length) ? ex.sectors : prev.sectors,
        experienceLevel: prev.experienceLevel || SENIORITY_TO_EXP[ex.seniority] || null,
      }));
    } catch (err) { setCvErr(err.message || "Errore nel caricamento del CV"); }
    finally { setCvBusy(false); }
  }

  async function complete() {
    setSaving(true);
    try {
      const res = await api.saveOnboarding({ ...form, personal, acceptTerms: terms || !!(user && user.acceptedTermsAt) });
      if (res.user) updateUser(res.user);
      setDone(res.scan || { imported: 0 });
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <div className="ob-wrap">
        <div className="ob-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 46 }}>🎯</div>
          <h2 style={{ fontSize: 24, margin: "10px 0 8px" }}>Profilo completato!</h2>
          <p className="muted" style={{ maxWidth: 460, margin: "0 auto" }}>
            Abbiamo avviato la ricerca in base al tuo profilo.{" "}
            {done.imported > 0 ? <>Trovate <strong>{done.imported}</strong> nuove offerte per te.</> : <>Le offerte compatibili appariranno in “Offerte per me”.</>}
          </p>
          <button className="btn" style={{ marginTop: 20 }} onClick={() => navigate("/app/jobs")}>Vedi le mie offerte</button>
        </div>
      </div>
    );
  }

  const QUESTIONS = [
    {
      title: "Iniziamo dal tuo CV", sub: "Carica il CV per estrarre i tuoi dati, oppure inseriscili a mano.",
      body: <StepCV onFile={onFile} cvChoice={cvChoice} setCvChoice={setCvChoice} cvName={cvName} busy={cvBusy} err={cvErr} />,
      valid: cvChoice === "manual" || (cvChoice === "upload" && !!cvName),
    },
    {
      title: "I tuoi dati", sub: "Controlla e correggi. Questi dati alimentano CV, Cover Letter e candidature.",
      body: <StepPersonal personal={personal} setPersonal={setPersonal} fromCv={fromCv} />, valid: true,
    },
    { title: "Qual è il titolo del lavoro che desideri?", body: <StepTitles options={options} value={form} set={set} />, valid: form.desiredTitles.length > 0 },
    { title: "Qual è il tuo livello di esperienza?", body: <TileGrid items={options.experienceLevels} selected={form.experienceLevel} onToggle={(k) => set({ experienceLevel: k })} />, valid: !!form.experienceLevel },
    {
      title: "Qual è il tuo salario minimo preferito?", sub: "Stipendio annuo lordo (RAL).",
      body: (
        <div>
          <div className="ob-salary">{form.minSalary >= 240000 ? "€240.000+" : fmtEuro(form.minSalary)}</div>
          <input type="range" min="20000" max="240000" step="20000" value={form.minSalary} style={{ width: "100%" }} onChange={(e) => set({ minSalary: Number(e.target.value) })} />
          <div className="row between muted" style={{ fontSize: 12 }}><span>€20.000</span><span>€240.000+</span></div>
          <div className="ob-note">Molti datori non indicano la RAL negli annunci, quindi non sempre potremo filtrare per stipendio.</div>
        </div>
      ), valid: true,
    },
    {
      title: "In quali settori preferisci lavorare?", sub: "Scegli dal menu (lascia vuoto per «aperto a tutto»).",
      body: (
        <div>
          <select className="ob-select" value="" onChange={(e) => { if (e.target.value) toggleArr("sectors", e.target.value); }}>
            <option value="">+ Aggiungi un settore…</option>
            {options.sectors.filter((s) => !form.sectors.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="ob-tags" style={{ marginTop: 12 }}>
            {form.sectors.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Nessuna preferenza — aperto a tutti i settori.</span>}
            {form.sectors.map((s) => <span className="ob-chip" key={s}>{s}<button onClick={() => toggleArr("sectors", s)}>×</button></span>)}
          </div>
        </div>
      ), valid: true,
    },
    {
      title: "A che tipo di lavoro sei disponibile?",
      body: (
        <div className="ob-list">
          {options.jobTypes.map((t) => (
            <button key={t.key} className={`ob-row ${form.jobTypes.includes(t.key) ? "on" : ""}`} onClick={() => toggleArr("jobTypes", t.key)}>
              <span className="ob-check">{form.jobTypes.includes(t.key) ? "✓" : ""}</span>{t.label}
            </button>
          ))}
        </div>
      ), valid: true,
    },
    {
      title: "Con quale modalità vuoi lavorare?", sub: "Scegli una o più opzioni: influenza direttamente le offerte proposte.",
      body: (
        <div className="ob-list">
          {(options.workModes || []).map((m) => (
            <button key={m.key} className={`ob-row ${form.workModes.includes(m.key) ? "on" : ""}`} onClick={() => toggleArr("workModes", m.key)}>
              <span className="ob-check">{form.workModes.includes(m.key) ? "✓" : ""}</span>{m.label}
            </button>
          ))}
        </div>
      ), valid: form.workModes.length > 0,
    },
    {
      title: "Dove vuoi cercare?", sub: "Città, provincia, regione o nazione. Puoi aggiungerne più di una (se lavori solo da remoto puoi anche lasciarlo vuoto).",
      body: (
        <div>
          <div className="row" style={{ gap: 8 }}>
            <input className="ob-input" style={{ flex: 1 }} placeholder="Es. Milano, Lombardia, Italia, 20100…" value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && locInput.trim()) { toggleArr("preferredLocations", locInput.trim()); setLocInput(""); } }} />
            <button className="btn ghost" onClick={() => { if (locInput.trim()) { toggleArr("preferredLocations", locInput.trim()); setLocInput(""); } }}>Aggiungi</button>
          </div>
          <select className="ob-select" style={{ marginTop: 10 }} value="" onChange={(e) => { if (e.target.value) toggleArr("preferredLocations", e.target.value); }}>
            <option value="">+ oppure scegli dall'elenco…</option>
            {options.locations.filter((l) => !form.preferredLocations.includes(l)).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="ob-tags" style={{ marginTop: 12 }}>
            {form.preferredLocations.map((l) => <span className="ob-chip" key={l}>{l}<button onClick={() => toggleArr("preferredLocations", l)}>×</button></span>)}
          </div>
        </div>
      ), valid: form.preferredLocations.length > 0 || form.workModes.includes("remoto"),
    },
    {
      title: "Collega il tuo profilo LinkedIn", sub: "Facoltativo. Ci aiuta a capire i tuoi contatti per eventuali referenze e a tenere traccia delle candidature (verso un piccolo CRM personale).",
      body: (
        <div>
          <div className="field" style={{ margin: 0 }}><label>URL del tuo profilo LinkedIn</label>
            <input className="ob-input" style={{ width: "100%" }} value={form.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/il-tuo-profilo" />
          </div>
          <div className="ob-note" style={{ marginTop: 8 }}>Salviamo il link del profilo. La mappatura automatica di contatti e referenze richiede l'accesso all'API partner di LinkedIn: quando sarà attiva, la sfrutteremo per suggerirti chi può darti una referenza.</div>
        </div>
      ), valid: true,
    },
    { title: "Che tipo di azienda preferisci?", sub: "Puoi sceglierne più di una.", body: <TileGrid items={options.companyTypes} selected={form.companyTypes} onToggle={(k) => toggleArr("companyTypes", k)} multi />, valid: true },
  ];

  const q = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;

  return (
    <div className="ob-wrap">
      <div className="ob-progress">
        {STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}
      </div>
      <div className="ob-step-label">Passo {step + 1} di {STEPS.length} · {STEPS[step]}</div>
      <h2 className="ob-q">{q.title}</h2>
      {q.sub && <p className="ob-sub">{q.sub}</p>}
      <div className="ob-card">{q.body}</div>
      {last && !(user && user.acceptedTermsAt) && (
        <label className="check" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginTop: 16 }}>
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 2 }} />
          <span>Accetto i <a href="#/terms" target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>Termini e condizioni</a> e l'informativa privacy.</span>
        </label>
      )}
      <div className="row between" style={{ marginTop: 20 }}>
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Indietro</button>
        {last
          ? <button className="btn" disabled={!q.valid || saving || (!(user && user.acceptedTermsAt) && !terms)} onClick={complete}>{saving ? "Avvio ricerca…" : "Completa e cerca offerte"}</button>
          : <button className="btn" disabled={!q.valid} onClick={() => setStep((s) => s + 1)}>Avanti →</button>}
      </div>
    </div>
  );
}
