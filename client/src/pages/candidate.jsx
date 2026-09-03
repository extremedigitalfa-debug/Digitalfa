import { useEffect, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import {
  Card, StatCard, Badge, ProgressBar, Avatar, Spinner, Empty,
  StageBadge, fmtDate, fmtDateTime,
} from "../components/ui.jsx";

// Invito a completare la profilazione: appare nelle sezioni candidato finché
// l'onboarding non è stato completato. Guida la scansione e il matching.
export function ProfilingBanner() {
  const { user } = useAuth();
  if (!user || user.onboarded) return null;
  return (
    <div className="profiling-banner">
      <div>
        <div className="pb-title">Completa il tuo profilo per vedere offerte su misura</div>
        <div className="pb-sub">Ci bastano pochi minuti: ruolo, luoghi in cui vuoi lavorare, seniority e settori. Da lì partono la scansione e il matching delle offerte più adatte a te.</div>
      </div>
      <Link to="/app/onboarding" className="btn">Completa la profilazione →</Link>
    </div>
  );
}

// Invito a caricare il CV: compare finché il CV non è stato caricato. Il CV è la
// base per generare Cover Letter e pacchetto di candidatura.
export function CvBanner() {
  const { user } = useAuth();
  if (!user || user.cvUploadedAt) return null;
  return (
    <div className="profiling-banner" style={{ background: "linear-gradient(90deg,#fff4e6,#fff)", borderColor: "#f0d3a0" }}>
      <div>
        <div className="pb-title">Carica il tuo CV</div>
        <div className="pb-sub">È la base con cui generiamo la tua Cover Letter e il pacchetto per candidarti alle offerte. Da qui estraiamo anche i tuoi dati, che puoi correggere.</div>
      </div>
      <Link to="/app/onboarding" className="btn">Carica il CV →</Link>
    </div>
  );
}

function useData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetcher().then((d) => alive && setData(d)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [...deps, reloadKey]);
  return { data, loading, reload: () => setReloadKey((k) => k + 1) };
}

const mIco = { done: "✓", in_progress: "▸", todo: "○" };

export function CandidateDashboard() {
  const { user } = useAuth();
  const { data, loading } = useData(api.candidateOverview);
  const jobsData = useData(api.candidateJobs);
  if (loading || !data) return <Spinner />;
  const { profile, applications } = data;
  const onboarded = !!user?.onboarded;
  const cvOk = !!user?.cvUploadedAt;

  // Box 2: offerte compatibili inviate finora, per fascia di compatibilità.
  const offers = (jobsData.data && jobsData.data.offers) || [];
  const alta = offers.filter((o) => o.match >= 75).length;
  const media = offers.filter((o) => o.match >= 60 && o.match < 75).length;
  const bassa = offers.filter((o) => o.match >= 45 && o.match < 60).length;

  return (
    <div className="stack">
      <ProfilingBanner />
      <CvBanner />

      <div className="grid cols-3">
        {/* BOX 1 — Onboarding & Assessment */}
        <Card>
          <h3 className="section-title" style={{ marginTop: 0 }}>Onboarding & Assessment</h3>
          <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 6 }}>
            <div style={{ fontSize: 30 }}>{onboarded ? "✅" : "📝"}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{onboarded ? "Completato" : "Da completare"}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>CV: {cvOk ? "caricato ✓" : "non ancora caricato"}</div>
            </div>
          </div>
          {!onboarded && <Link to="/app/onboarding" className="btn sm" style={{ marginTop: 12, textDecoration: "none" }}>Completa ora →</Link>}
          {onboarded && <Link to="/app/onboarding" className="btn ghost sm" style={{ marginTop: 12, textDecoration: "none" }}>Rivedi le preferenze</Link>}
        </Card>

        {/* BOX 2 — Offerte inviate per compatibilità */}
        <Card>
          <h3 className="section-title" style={{ marginTop: 0 }}>Offerte ricevute</h3>
          {jobsData.loading ? <div className="muted">…</div> : (
            <>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{offers.length}</div>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>offerte compatibili finora</div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Badge tone="green">Alta ≥75%: {alta}</Badge>
                <Badge tone="warn">Media 60–74%: {media}</Badge>
                <Badge tone="gray">Base 45–59%: {bassa}</Badge>
              </div>
            </>
          )}
          <Link to="/app/jobs" className="btn ghost sm" style={{ marginTop: 12, textDecoration: "none" }}>Vedi le offerte →</Link>
        </Card>

        {/* BOX 3 — sintesi candidature (dettaglio sotto) */}
        <Card>
          <h3 className="section-title" style={{ marginTop: 0 }}>Le tue candidature</h3>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{applications.length}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>candidature inviate</div>
        </Card>
      </div>

      {/* Elenco candidature */}
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Elenco candidature</h3>
        {applications.length ? (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Posizione</th><th>Azienda</th><th>Stato</th><th>Aggiornata</th></tr></thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.job?.title}</td>
                    <td className="muted">{a.job?.company}</td>
                    <td><StageBadge stage={a.stage} /></td>
                    <td className="muted">{fmtDate(a.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Non ti sei ancora candidato a nessuna offerta.</Empty>}
      </Card>
    </div>
  );
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
async function downloadPdf(filename, text) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48, width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  for (const para of String(text).split("\n")) {
    const lines = doc.splitTextToSize(para || " ", width);
    for (const ln of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y); y += 16;
    }
  }
  doc.save(filename);
}
// Pulsante "copia" riutilizzabile.
function CopyBtn({ text, label = "Copia" }) {
  const [ok, setOk] = useState(false);
  return <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>{ok ? "Copiato ✓" : label}</button>;
}

const DIM_LABEL = { role: "Ruolo / titolo", skills: "Competenze", location: "Località", seniority: "Seniority", industry: "Settore" };

// Tag fissi mostrati su ogni offerta, in italiano, con "Non specificato" se manca il dato.
const SEN_IT = { junior: "Junior", mid: "Intermedio", senior: "Senior", manager: "Manager" };
const isMissing = (v) => !v || ["—", "-", "n.d.", "nd", ""].includes(String(v).trim().toLowerCase());
// Tipologia azienda dedotta dal testo (best-effort): startup/scaleup/PMI/azienda.
function companyType(j) {
  const t = `${j.company || ""} ${j.description || ""}`.toLowerCase();
  if (/scale ?-?up/.test(t)) return "Scale-up";
  if (/start ?-?up/.test(t)) return "StartUp";
  if (/\bpmi\b|piccola e media|small business|small[- ]medium/.test(t)) return "PMI";
  if (/multinaz|multinational|gruppo|group\b|s\.?p\.?a\b|corporation|enterprise|holding/.test(t)) return "Azienda";
  return null;
}
function jobTags(j) {
  const ct = j.companyType || companyType(j);
  const ral = (isMissing(j.salary) || /stima/i.test(String(j.salary))) ? "Non specificata" : (/^\s*\d/.test(String(j.salary)) ? `€${j.salary}k` : String(j.salary));
  const modalita = isMissing(j.remote) ? "Non specificata" : j.remote;
  const seniority = isMissing(j.seniority) ? "Non specificata" : (SEN_IT[String(j.seniority).toLowerCase()] || j.seniority);
  const settore = isMissing(j.industry) ? "Non specificato" : j.industry;
  return [
    { label: "RAL", value: ral },
    { label: "Modalità", value: modalita },
    { label: "Seniority", value: seniority },
    { label: "Tipologia", value: ct || "Non specificata" },
    { label: "Settore", value: settore },
  ];
}
// Motivi del fit (elenco puntato) derivati dal breakdown del match.
function fitReasons(j) {
  const b = {}; (j.breakdown || []).forEach((d) => (b[d.key] = d.subscore));
  const R = [];
  R.push(b.role >= 60 ? { ok: true, t: "Ruolo in linea con quello che cerchi" } : { ok: false, t: "Ruolo solo parzialmente allineato" });
  if (b.location != null) R.push(b.location >= 70 ? { ok: true, t: "Sede tra le tue preferenze" } : { ok: false, t: "Sede fuori dalle tue preferenze" });
  if (b.seniority >= 70) R.push({ ok: true, t: "Livello di seniority coerente" });
  if (b.skills >= 50) R.push({ ok: true, t: "Competenze in comune con l'offerta" });
  if (b.industry >= 75) R.push({ ok: true, t: "Settore affine al tuo profilo" });
  return R.slice(0, 5);
}

function JobCard({ j, onFeedback }) {
  const [applied, setApplied] = useState(!!j.applied);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(null);        // null | 'outreach' | 'cover' | 'cv' | 'ad' | 'match'
  const [outreach, setOutreach] = useState(null);
  const [cover, setCover] = useState(null);
  const [cv, setCv] = useState(null);
  const [ad, setAd] = useState(null);
  const [check, setCheck] = useState(null);
  const [loadingKit, setLoadingKit] = useState(false);
  const [autoRes, setAutoRes] = useState(null);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [downReason, setDownReason] = useState("");
  const [downSent, setDownSent] = useState(false);
  const [shareTo, setShareTo] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareSent, setShareSent] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  async function sendShare() {
    setShareMsg("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(shareTo)) { setShareMsg("Inserisci un'email valida."); return; }
    setShareBusy(true);
    try { const r = await api.jobShare(j.id, shareTo); setShareSent(true); setShareMsg(r.sent ? "✓ Email inviata." : "✓ Registrata (email simulata: configura SMTP per l'invio reale)."); }
    catch (e) { setShareMsg(e.message); } finally { setShareBusy(false); }
  }
  async function sendDown() {
    try { await api.jobFeedback(j.id, "down", downReason); setDownSent(true); if (onFeedback) onFeedback(); } catch { setDownSent(true); }
  }
  async function openAuto() {
    if (tab === "auto") { setTab(null); return; }
    setTab("auto"); setLoadingAuto(true);
    try { const r = await api.jobAutoApply(j.id, true); setAutoRes(r); if (r.submitted && onFeedback) onFeedback(); }
    catch (e) { setAutoRes({ status: "manual", reasons: [e.message || "Errore"], fields: [], questions: [] }); }
    finally { setLoadingAuto(false); }
  }
  const [copied, setCopied] = useState(false);
  const [fbMsg, setFbMsg] = useState("");

  async function sendFeedback(verdict) {
    setFbMsg("");
    try {
      await api.jobFeedback(j.id, verdict);
      setFbMsg(verdict === "good" ? "Grazie, feedback registrato." : "Grazie: ho aggiornato i tuoi pesi personali.");
      if (verdict !== "good" && onFeedback) setTimeout(onFeedback, 900);
    } catch (e) { setFbMsg(e.message); }
  }

  async function loadOutreach() { if (!outreach) { setLoadingKit(true); try { setOutreach(await api.jobOutreach(j.id)); } finally { setLoadingKit(false); } } }
  async function openMessage() { if (tab === "message") { setTab(null); return; } setTab("message"); await loadOutreach(); }
  async function openContacts() { if (tab === "contacts") { setTab(null); return; } setTab("contacts"); await loadOutreach(); }
  async function openCover() {
    if (tab === "cover") { setTab(null); return; }
    setTab("cover");
    if (!cover) { setLoadingKit(true); try { setCover(await api.jobCoverLetter(j.id)); } finally { setLoadingKit(false); } }
  }
  async function openCv() {
    if (tab === "cv") { setTab(null); return; }
    setTab("cv");
    if (!cv) { setLoadingKit(true); try { setCv(await api.jobCvTailored(j.id)); } finally { setLoadingKit(false); } }
  }
  async function openAd() {
    if (tab === "ad") { setTab(null); return; }
    setTab("ad");
    if (!ad) { setLoadingKit(true); try { setAd(await api.jobAd(j.id)); } finally { setLoadingKit(false); } }
  }
  async function openCheck() {
    if (tab === "check") { setTab(null); return; }
    setTab("check");
    if (!check) { setLoadingKit(true); try { setCheck(await api.applyCheck(j.id)); } finally { setLoadingKit(false); } }
  }
  async function apply(withCover) {
    // Offerta esterna: apriamo la pagina di candidatura e basta — NON segniamo
    // la candidatura (potrebbe non completarla). Sarà lei con il toggle Sì/No.
    if (j.url && !withCover) { try { window.open(j.url, "_blank", "noopener"); } catch { /* ignore */ } return; }
    // Offerta interna (HR) o allega-e-candidati: candidatura reale nel sistema.
    setBusy(true);
    try {
      await api.apply(j.id, withCover && cover ? { coverLetter: cover.coverLetter, contactMessage: outreach?.message } : {});
      setApplied(true);
    } catch { setApplied(true); } finally { setBusy(false); }
  }
  async function setAppliedState(v) {
    if (v === applied) return;
    setApplied(v);
    try { await api.setApplied(j.id, v); if (onFeedback) onFeedback(); } catch { setApplied(!v); }
  }
  function copyMsg() { navigator.clipboard?.writeText(outreach.message).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }

  return (
    <Card>
      <div className="job-main">
        <div className="job-left">
          <div className="row between">
            <div>
              <h3 style={{ fontSize: 16 }}>{j.title}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{j.company} · {j.location}</div>
              <div className="row" style={{ gap: 8, marginTop: 6, alignItems: "center", fontSize: 12.5 }}>
                <label className="check" style={{ fontSize: 12.5, gap: 6 }}>
                  <input type="checkbox" checked={applied} onChange={(e) => setAppliedState(e.target.checked)} />
                  {applied ? <span style={{ color: "var(--ok,#1c7a43)", fontWeight: 600 }}>Mi sono candidato ✓</span> : "Segna come «mi sono candidato»"}
                </label>
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <button className="chip match" style={{ border: "none", cursor: "pointer" }} onClick={() => setTab(tab === "match" ? null : "match")} title="Perché questo punteggio?">{j.match}% match ⓘ</button>
              <button className="btn ghost sm" title="Non pertinente" onClick={() => setTab(tab === "down" ? null : "down")} style={{ padding: "6px 8px" }}>{downSent ? "👎✓" : "👎"}</button>
            </div>
          </div>
          {tab === "down" && !downSent && (
            <div className="kit" style={{ marginTop: 10 }}>
              <div className="kit-h" style={{ marginTop: 0 }}>Perché non è pertinente?</div>
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                {["Ruolo diverso", "Località sbagliata", "Seniority non adatta", "Settore non mio", "Retribuzione bassa", "Azienda non interessante"].map((r) => (
                  <button key={r} className={`chip ${downReason === r ? "match" : ""}`} style={{ cursor: "pointer", border: "1px solid var(--border)" }} onClick={() => setDownReason(r)}>{r}</button>
                ))}
              </div>
              <input className="input sm" style={{ width: "100%" }} placeholder="Altro motivo (facoltativo)" value={downReason && !["Ruolo diverso", "Località sbagliata", "Seniority non adatta", "Settore non mio", "Retribuzione bassa", "Azienda non interessante"].includes(downReason) ? downReason : ""} onChange={(e) => setDownReason(e.target.value)} />
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn sm" disabled={!downReason} onClick={sendDown}>Invia feedback</button>
                <button className="btn ghost sm" onClick={() => setTab(null)}>Annulla</button>
              </div>
            </div>
          )}
          {tab === "down" && downSent && <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>Grazie! Terremo conto del tuo feedback. 👍</div>}
          {(j.requirements && j.requirements.length > 0) && (
            <div className="fit-list" style={{ marginTop: 12 }}>
              <div className="fit-h">Requisiti principali</div>
              {j.requirements.map((r, i) => (<div className="fit-row" key={i}>• {r}</div>))}
            </div>
          )}
          <div className="tag-list" style={{ marginTop: 14 }}>
            {jobTags(j).map((t) => (
              <span className="chip" key={t.label}><b style={{ fontWeight: 700 }}>{t.label}:</b> {t.value}</span>
            ))}
          </div>
        </div>

        <div className="job-actions">
          <button className="btn" style={{ width: "100%" }} disabled={busy} onClick={() => apply(false)}>
            {busy ? "…" : "Candidati"}
          </button>
          <button className={`btn ghost sm ${tab === "auto" ? "on" : ""}`} style={{ width: "100%" }} onClick={openAuto}>⚡ Auto-candidatura</button>
          <button className={`btn ghost sm ${tab === "check" ? "on" : ""}`} style={{ width: "100%" }} onClick={openCheck}>Verifica candidatura</button>
          <div className="act-box">
            <div className="act-box-h">Genera / Personalizza</div>
            <button className={`btn ghost sm ${tab === "message" ? "on" : ""}`} onClick={openMessage}>Messaggio</button>
            <button className={`btn ghost sm ${tab === "cover" ? "on" : ""}`} onClick={openCover}>Cover Letter</button>
            <button className={`btn ghost sm ${tab === "cv" ? "on" : ""}`} onClick={openCv}>Curriculum</button>
          </div>
          <div className="act-box">
            <div className="act-box-h">Trova</div>
            <button className={`btn ghost sm ${tab === "contacts" ? "on" : ""}`} onClick={openContacts}>Contatti</button>
            <button className="btn ghost sm" disabled title="Disponibile a breve">Referenze</button>
          </div>
          <button className={`btn ghost sm ${tab === "ad" ? "on" : ""}`} style={{ width: "100%" }} onClick={openAd}>Mostra annuncio</button>
          <button className={`btn ghost sm ${tab === "share" ? "on" : ""}`} style={{ width: "100%" }} onClick={() => setTab(tab === "share" ? null : "share")}>↗ Condividi</button>
        </div>
      </div>

      {tab === "share" && (
        <div className="kit">
          <div className="kit-h" style={{ marginTop: 0 }}>Condividi questa offerta</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Inserisci l'email di chi potrebbe essere interessato: riceverà l'offerta a tuo nome.</div>
          {shareSent ? <div className="muted" style={{ fontSize: 13 }}>✓ Inviata a {shareTo}.</div> : (
            <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
              <input className="input sm" style={{ flex: 1, minWidth: 220 }} placeholder="email@esempio.com" value={shareTo} onChange={(e) => setShareTo(e.target.value)} />
              <button className="btn sm" disabled={shareBusy} onClick={sendShare}>{shareBusy ? "Invio…" : "Invia"}</button>
            </div>
          )}
          {shareMsg && <div className="muted" style={{ fontSize: 12, marginTop: 6, color: shareMsg.startsWith("✓") ? "var(--ok,#1c7a43)" : "#c0392b" }}>{shareMsg}</div>}
        </div>
      )}

      {tab === "auto" && (
        <div className="kit">
          {loadingAuto ? <div className="muted">Preparo la candidatura…</div> : autoRes && (
            <div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <div className="kit-h" style={{ margin: 0 }}>Candidatura</div>
                <Badge tone={autoRes.status === "submitted" ? "green" : autoRes.status === "assisted" ? "warn" : "gray"}>
                  {autoRes.status === "submitted" ? "inviata ✓" : autoRes.status === "assisted" ? "assistita" : "manuale"}
                </Badge>
              </div>
              <ul className="muted" style={{ fontSize: 12.5, marginTop: 8, paddingLeft: 18 }}>{(autoRes.reasons || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
              {autoRes.fields?.length > 0 && (<>
                <div className="kit-h">Dati da inserire</div>
                {autoRes.fields.map((f, i) => (
                  <div key={i} className="row between" style={{ gap: 8, padding: "3px 0" }}>
                    <span className="muted" style={{ fontSize: 12.5 }}>{f.label}</span>
                    <span style={{ fontWeight: 600, fontSize: 12.5, marginLeft: "auto", marginRight: 8 }}>{f.value}</span>
                    <CopyBtn text={f.value} />
                  </div>
                ))}
              </>)}
              {autoRes.questions?.length > 0 && (<>
                <div className="kit-h">Domande aggiuntive</div>
                {autoRes.questions.map((q, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{q.q}</div>
                    <div className="muted" style={{ fontSize: 12.5, whiteSpace: "pre-line" }}>{q.a || <em>— nessuna risposta salvata (aggiungila in “Risposte candidatura”) —</em>}</div>
                    {q.a && <CopyBtn text={q.a} />}
                  </div>
                ))}
              </>)}
              {autoRes.status !== "submitted" && j.url && <a className="btn sm" href={j.url} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block" }}>Apri e completa →</a>}
            </div>
          )}
        </div>
      )}

      {tab === "match" && (
        <div className="kit">
          <div className="kit-h">Perché {j.match}% — come è calcolato</div>
          {(j.breakdown || []).map((b) => (
            <div key={b.key} style={{ marginBottom: 8 }}>
              <div className="row between" style={{ fontSize: 12.5, marginBottom: 3 }}>
                <span>{DIM_LABEL[b.key] || b.key} <span className="muted">· peso {b.weight}%</span></span>
                <span className="muted">{b.subscore}/100 → +{b.contribution}</span>
              </div>
              <div className="score-bar"><span style={{ width: `${b.subscore}%` }} /></div>
            </div>
          ))}
          <div className="kit-note">Il punteggio è la media dei sotto-punteggi, pesata. Puoi cambiare i pesi con "Preferenze di match" in alto.</div>
          <div className="kit-h" style={{ marginTop: 14 }}>Questo punteggio ti sembra corretto?</div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => sendFeedback("too_high")}>Troppo alto</button>
            <button className="btn ghost sm" onClick={() => sendFeedback("good")}>Corretto</button>
            <button className="btn ghost sm" onClick={() => sendFeedback("too_low")}>Troppo basso</button>
          </div>
          {fbMsg && <div className="flash" style={{ marginTop: 10 }}>{fbMsg}</div>}
        </div>
      )}

      {tab === "message" && (
        <div className="kit">
          {loadingKit && !outreach ? <div className="muted">Genero il messaggio…</div> : outreach && (
            <>
              <div className="kit-h">Messaggio pronto ({outreach.message.length}/300)</div>
              <div className="msg-box">{outreach.message}</div>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={copyMsg}>{copied ? "Copiato ✓" : "Copia messaggio"}</button>
            </>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <div className="kit">
          {loadingKit && !outreach ? <div className="muted">Cerco i contatti…</div> : outreach && (
            <>
              {outreach.jdEmail && (
                <div style={{ marginBottom: 12 }}>
                  <div className="kit-h" style={{ marginTop: 0 }}>Contatto indicato nell'annuncio</div>
                  <a className="btn sm" href={`mailto:${outreach.jdEmail}`}>✉ {outreach.jdEmail}</a>
                </div>
              )}
              <div className="kit-h">Persone da contattare in azienda (LinkedIn)</div>
              {outreach.contacts.map((c, i) => (
                <div className="contact" key={i}>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.role}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Cerca chi ricopre questo ruolo in {c.company || "azienda"}</div>
                  </div>
                  <a className="btn ghost sm" href={c.linkedin} target="_blank" rel="noreferrer">Cerca su LinkedIn ↗</a>
                </div>
              ))}
              <div className="kit-note">I link aprono una ricerca LinkedIn mirata (recruiter, HR, hiring manager) nell'azienda dell'offerta: da lì individui la persona reale a cui scrivere.</div>
            </>
          )}
        </div>
      )}

      {tab === "cover" && (
        <div className="kit">
          {loadingKit && !cover ? <div className="muted">Genero la cover letter…</div> : cover && (
            <>
              <div className="row between">
                <div className="kit-h" style={{ margin: 0 }}>Cover letter generata</div>
                {cover.attachable ? <Badge tone="green">Allegabile alla candidatura</Badge> : <Badge tone="gray">Solo download</Badge>}
              </div>
              <pre className="cover-box">{cover.coverLetter}</pre>
              <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                <CopyBtn text={cover.coverLetter} />
                <button className="btn ghost sm" onClick={() => downloadPdf(`CoverLetter_${j.company}.pdf`, cover.coverLetter)}>Scarica PDF</button>
                <button className="btn ghost sm" onClick={() => download(`CoverLetter_${j.company}.txt`, cover.coverLetter)}>Scarica .txt</button>
                {cover.attachable && (
                  <button className="btn sm" disabled={busy || applied} onClick={() => apply(true)}>
                    {applied ? "Inviata con allegato ✓" : "Allega e candidati"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "cv" && (
        <div className="kit">
          {loadingKit && !cv ? <div className="muted">Preparo i suggerimenti per il CV…</div> : cv && (
            <>
              <div className="kit-h" style={{ margin: 0 }}>CV su misura per questa offerta</div>
              {!cv.hasCv && <div className="kit-note">Non hai ancora caricato un CV: questi sono suggerimenti dal tuo profilo. Carica il CV per risultati più precisi.</div>}
              <pre className="cover-box">{cv.cv}</pre>
              <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                <CopyBtn text={cv.cv} />
                <button className="btn ghost sm" onClick={() => downloadPdf(`CV_${j.company}.pdf`, cv.cv)}>Scarica PDF</button>
                <button className="btn ghost sm" onClick={() => download(`CV_${j.company}.txt`, cv.cv)}>Scarica .txt</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "ad" && (
        <div className="kit">
          {loadingKit && !ad ? <div className="muted">Carico l'annuncio…</div> : ad && (
            <>
              <div className="kit-h" style={{ margin: 0 }}>{ad.title}</div>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{ad.company} · {ad.location}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ad.description || "Descrizione non disponibile per questa offerta."}</p>
              <div className="kit-note">Questa è la descrizione dell'annuncio salvata al momento della scansione.</div>
            </>
          )}
        </div>
      )}

      {tab === "check" && (
        <div className="kit">
          {loadingKit && !check ? <div className="muted">Analizzo il link di candidatura…</div> : check && (
            <>
              <div className="kit-h" style={{ margin: 0 }}>Verifica candidatura</div>
              <div style={{ margin: "6px 0 8px" }}>
                {check.mode === "assistita"
                  ? <Badge tone="warn">Assistita · possibile ma con passaggi</Badge>
                  : <Badge tone="gray">Manuale · da completare sul sito</Badge>}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {check.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <div className="kit-note">È una stima basata sul link/ATS: la candidatura automatica end-to-end non è ancora attiva.</div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function MatchPrefs({ onChange }) {
  const { data, loading, reload } = useData(api.getMatchPrefs);
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading || !data) return null;
  const weights = w || data.weights;
  const dims = data.dimensions;
  async function save() { setBusy(true); try { await api.setMatchPrefs(weights); reload(); onChange && onChange(); } finally { setBusy(false); } }
  async function reset() { setBusy(true); try { await api.resetMatchPrefs(); setW(null); reload(); onChange && onChange(); } finally { setBusy(false); } }
  return (
    <Card>
      <div className="row between">
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Preferenze di match {data.customized && <Badge tone="blue">personalizzate</Badge>}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Regola quanto conta ogni fattore <strong>per te</strong>. I punteggi si aggiornano di conseguenza.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "Regola pesi"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {dims.map((d) => (
            <div key={d.key} className="row" style={{ gap: 12, marginBottom: 10 }}>
              <div style={{ width: 140, fontSize: 13 }}>{d.label}</div>
              <input type="range" min="0" max="60" value={weights[d.key]} style={{ flex: 1 }}
                onChange={(e) => setW({ ...weights, [d.key]: Number(e.target.value) })} />
              <div style={{ width: 40, textAlign: "right", fontWeight: 600 }}>{weights[d.key]}</div>
            </div>
          ))}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn sm" disabled={busy} onClick={save}>Salva le mie preferenze</button>
            <button className="btn ghost sm" disabled={busy} onClick={reset}>Ripristina default</button>
          </div>
        </div>
      )}
    </Card>
  );
}

const dayKey = (d) => d.toISOString().slice(0, 10);
// Etichetta relativa a "todayRef" (il giorno di riferimento del calendario),
// così il giorno 0 è SEMPRE "Oggi" anche con fusi orari diversi dal server.
function dayLabel(day, todayRef) {
  const t = todayRef || new Date().toISOString().slice(0, 10);
  const yst = new Date(new Date(t + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  const dateStr = new Date(day + "T00:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  if (day === t) return `Oggi · ${dateStr}`;
  if (day === yst) return `Ieri · ${dateStr}`;
  return dateStr;
}

// Un box di offerte in forma tabellare con righe espandibili al click sul titolo.
function OffersBox({ title, hint, tone, rows, openId, setOpenId, reload, empty, bare }) {
  const Table = (
    <table className="jobs-table">
      <thead><tr><th>Offerta</th><th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Match</th><th></th></tr></thead>
      <tbody>
        {rows.map((j) => {
          const isOpen = openId === j.id;
          return (
          <Fragment key={j.id}>
            <tr className={`job-row ${isOpen ? "open" : ""}`} style={{ cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : j.id)}>
              <td>
                <div className="job-title-link">{j.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>{j.company} · {j.location}{j.applied ? " · candidato ✓" : ""}</div>
              </td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <Badge tone={j.match >= 75 ? "green" : j.match >= 60 ? "warn" : "gray"}>{j.match}%</Badge>
              </td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span className="row-toggle">{isOpen ? "Chiudi ▲" : "Dettagli ▾"}</span>
              </td>
            </tr>
            {isOpen && (
              <tr><td colSpan={3} style={{ padding: 0 }}><div style={{ padding: 6 }}><JobCard j={j} onFeedback={reload} /></div></td></tr>
            )}
          </Fragment>
        );})}
      </tbody>
    </table>
  );
  if (bare) return <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid var(--border)" }}>{Table}</div>;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: rows.length ? "1px solid var(--border)" : "none" }}>
        <div className="row" style={{ gap: 8 }}>
          {tone && <span style={{ width: 9, height: 9, borderRadius: 9, background: tone === "green" ? "var(--ok,#1c7a43)" : "#d98a00" }} />}
          <h3 className="section-title" style={{ margin: 0 }}>{title}</h3>
          <Badge tone={tone || "gray"}>{rows.length}</Badge>
        </div>
        {hint && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>}
      </div>
      {rows.length ? Table : <div className="muted" style={{ padding: "14px 16px", fontSize: 13 }}>{empty || "Nessuna offerta."}</div>}
    </Card>
  );
}

// Card: aggiungi un'offerta trovata fuori dalla ricerca (incolla il link).
function AddManualOffer({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function add() {
    setMsg(""); if (!/^https?:\/\//i.test(url)) { setMsg("Incolla un link valido (https://…)."); return; }
    setBusy(true);
    try { const r = await api.jobAddManual(url); setMsg(`Aggiunta: ${r.job.title}. La trovi tra le offerte di oggi.`); setUrl(""); if (onAdded) onAdded(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <Card style={{ background: "var(--brand-soft,#eef3ff)" }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Hai trovato un'offerta fuori dalla nostra ricerca?</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Sfrutta comunque la potenza del nostro sistema di candidatura: incolla il link e aggiungila.</div>
        </div>
        {!open && <button className="btn" onClick={() => setOpen(true)}>+ Aggiungi un'offerta</button>}
      </div>
      {open && (
        <div className="row wrap" style={{ gap: 8, marginTop: 12, alignItems: "center" }}>
          <input className="input sm" style={{ flex: 1, minWidth: 260 }} placeholder="https://…/offerta-di-lavoro" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className="btn" disabled={busy} onClick={add}>{busy ? "Aggiungo…" : "Inserisci e Candidati"}</button>
          <button className="btn ghost sm" onClick={() => { setOpen(false); setMsg(""); }}>Annulla</button>
        </div>
      )}
      {msg && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{msg}</div>}
    </Card>
  );
}

export function CandidateJobs() {
  const { data, loading, reload } = useData(api.candidateJobs);
  const [offset, setOffset] = useState(0);   // 0 = oggi, +1 = ieri, ...
  const [openId, setOpenId] = useState(null);
  if (loading || !data) return (<div className="stack"><ProfilingBanner /><CvBanner /><MatchPrefs onChange={reload} /><Spinner /></div>);

  const offers = data.offers || [];
  const scan = data.scan || {};
  // "Oggi" nel fuso italiano (Europe/Rome), coerente col server → nessuno slittamento.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  // Offerte per giorno di comparsa
  const byDay = {};
  offers.forEach((j) => { const d = (j.firstSeenAt || j.postedAt || today).slice(0, 10); (byDay[d] ||= []).push(j); });
  // Giorno selezionato = oggi - offset (tutto in UTC per evitare slittamenti di fuso)
  const sel = new Date(today + "T00:00:00Z"); sel.setUTCDate(sel.getUTCDate() - offset);
  const selKey = sel.toISOString().slice(0, 10);
  const dayOffers = byDay[selKey] || [];
  // Fin dove si può tornare indietro: almeno 7 giorni, o fino alla più vecchia offerta
  const oldest = Object.keys(byDay).sort()[0] || today;
  const maxOffset = Math.max(7, Math.round((new Date(today + "T00:00:00Z") - new Date(oldest + "T00:00:00Z")) / 86400000));
  const isToday = offset === 0;

  const totalOffers = offers.length;
  const todayCount = offers.filter((o) => (o.firstSeenAt || o.postedAt || today).slice(0, 10) === today).length;
  const appliedCount = offers.filter((o) => o.applied).length;

  return (
    <div className="stack">
      <ProfilingBanner />
      <CvBanner />

      {/* La prima cosa da vedere: Oggi · Totali · Candidature */}
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="stat-box"><div className="stat-n">{todayCount}</div><div className="stat-l">offerte di oggi</div></div>
        <div className="stat-box"><div className="stat-n">{totalOffers}</div><div className="stat-l">offerte complessive</div></div>
        <div className="stat-box"><div className="stat-n">{appliedCount}</div><div className="stat-l">candidature</div></div>
      </div>

      {data.lowOffers && (
        <Card style={{ borderColor: "#f0c060", background: "#fff9ec" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 {data.lowOffers.title}</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>{data.lowOffers.message}</div>
          <a href="#/app/onboarding" className="btn ghost sm" style={{ marginTop: 10, display: "inline-block" }}>Apri Preferenze di ricerca →</a>
        </Card>
      )}

      <div className="muted" style={{ fontSize: 12.5 }}>
        Vuoi cambiare quanto contano ruolo, competenze e località nel punteggio? Si regola nelle <a href="#/app/onboarding" style={{ color: "var(--brand)", fontWeight: 600 }}>Preferenze di ricerca</a>.
      </div>

      <AddManualOffer onAdded={reload} />

      <div className="cal-nav">
        <button className="btn ghost sm" disabled={offset >= maxOffset} onClick={() => setOffset((o) => o + 1)}>← Giorno prec.</button>
        <div className="cal-day">{dayLabel(selKey, today)} <span className="muted" style={{ fontWeight: 400 }}>· {dayOffers.length} offerte compatibili</span>{!isToday && <button className="btn ghost sm" style={{ marginLeft: 10 }} onClick={() => setOffset(0)}>vai a Oggi</button>}</div>
        <button className="btn ghost sm" disabled={isToday} onClick={() => setOffset((o) => Math.max(0, o - 1))}>Giorno succ. →</button>
      </div>

      {dayOffers.length > 0 ? (
        <>
          <div className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>👉 Clicca su una riga (o su “Dettagli”) per aprire l’offerta e vedere requisiti e azioni.</div>
          {(() => {
            const manual = dayOffers.filter((j) => j.manual);
            const pool = dayOffers.filter((j) => !j.manual);
            const exact = pool.filter((j) => j.titleTier === "exact");
            const related = pool.filter((j) => j.titleTier === "related");
            const other = pool.filter((j) => j.titleTier !== "exact" && j.titleTier !== "related");
            const shared = { openId, setOpenId, reload };
            return (
              <>
                {manual.length > 0 && (
                  <OffersBox title="Aggiunte da te (fonte: Manuale)" hint="Offerte che hai inserito tu incollando il link." tone="teal" rows={manual} {...shared} />
                )}
                <OffersBox
                  title="In linea con il tuo ruolo"
                  hint="Offerte il cui titolo contiene esattamente le parole chiave dei tuoi ruoli."
                  tone="green" rows={exact} {...shared}
                  empty="Nessuna offerta con il titolo esatto in questo giorno."
                />
                <OffersBox
                  title="Attinenti al tuo ruolo"
                  hint="Titoli vicini: manca una parola oppure ne hanno qualcuna in più rispetto al tuo ruolo."
                  tone="warn" rows={related} {...shared}
                  empty="Nessuna offerta attinente in questo giorno."
                />
                {other.length > 0 && (
                  <details className="adv-block">
                    <summary>Altre offerte compatibili ({other.length})</summary>
                    <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 12px" }}>
                      Offerte emerse dal profilo (competenze, settore, seniority) con un titolo più distante dal ruolo cercato.
                    </p>
                    <OffersBox title="" rows={other} {...shared} bare />
                  </details>
                )}
              </>
            );
          })()}
        </>
      ) : isToday && !scan.doneToday ? (
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>⏳</div>
          <h3 style={{ margin: "8px 0 6px" }}>Scansione di oggi in arrivo</h3>
          <p className="muted" style={{ maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            La scansione è prevista per le ore <strong>{scan.scheduledHour != null ? String(scan.scheduledHour).padStart(2, "0") + ":00" : "nel corso della giornata"}</strong>. Ti avviseremo via email appena l'avremo fatta, con le nuove offerte compatibili con il tuo profilo.
          </p>
        </Card>
      ) : (
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🔎</div>
          <h3 style={{ margin: "8px 0 6px" }}>Nessuna offerta compatibile in questo giorno</h3>
          <p className="muted" style={{ maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
            Ops, abbiamo scandagliato tra migliaia di nuove offerte ma non ce ne sono che riflettano i tuoi criteri di ricerca. Usa le frecce per rivedere i giorni precedenti, oppure aggiorna le tue <a href="#/app/onboarding" style={{ color: "var(--brand)", fontWeight: 600 }}>preferenze di ricerca</a>.
          </p>
        </Card>
      )}
    </div>
  );
}

export function CandidateSessions() {
  const [f, setF] = useState({ name: "", email: "", phone: "", linkedin: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit() {
    setErr("");
    if (!f.name.trim() || !f.email.trim()) return setErr("Inserisci almeno nome ed email.");
    setBusy(true);
    try { await api.coachApply(f); setSent(true); }
    catch (e) { setErr(e.message || "Errore nell'invio."); } finally { setBusy(false); }
  }
  return (
    <div className="stack">
      <ProfilingBanner />
      <Card style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🧑‍🏫</div>
        <h3 style={{ margin: "8px 0 6px", fontSize: 20 }}>Il servizio di Coaching sta arrivando</h3>
        <p className="muted" style={{ maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
          Stiamo selezionando i <strong>migliori career coach</strong> per accompagnarti nel tuo percorso di ricollocamento.
          Apriremo il servizio a breve: nel frattempo continua a candidarti alle offerte in “Offerte per me”.
        </p>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Sei un coach? Candidati per collaborare con noi</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Cerchiamo career coach esperti. Compila il form: la tua candidatura arriverà direttamente al nostro team.</p>
        {sent ? (
          <div className="flash" style={{ marginTop: 8 }}>Grazie! Abbiamo ricevuto la tua candidatura. Ti contatteremo a breve.</div>
        ) : (
          <>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field" style={{ margin: 0 }}><label>Nome e cognome *</label><input value={f.name} onChange={set("name")} /></div>
              <div className="field" style={{ margin: 0 }}><label>Email *</label><input value={f.email} onChange={set("email")} placeholder="tua@email.com" /></div>
              <div className="field" style={{ margin: 0 }}><label>Telefono</label><input value={f.phone} onChange={set("phone")} placeholder="+39 …" /></div>
              <div className="field" style={{ margin: 0 }}><label>Profilo LinkedIn</label><input value={f.linkedin} onChange={set("linkedin")} placeholder="https://linkedin.com/in/…" /></div>
              <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Raccontaci la tua esperienza da coach</label><textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%" }} value={f.message} onChange={set("message")} placeholder="Ambiti, anni di esperienza, tipologie di candidati seguiti…" /></div>
            </div>
            {err && <div className="muted" style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
            <button className="btn" disabled={busy} style={{ marginTop: 12 }} onClick={submit}>{busy ? "Invio…" : "Invia candidatura"}</button>
          </>
        )}
      </Card>
    </div>
  );
}

export function CandidateResources() {
  const [videos, setVideos] = useState(null);
  useEffect(() => { api.resourcesVideos().then((r) => setVideos(r.videos || [])).catch(() => setVideos([])); }, []);
  return (
    <div className="stack">
      <ProfilingBanner />
      <CvBanner />
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Video per la ricerca del lavoro</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Contenuti selezionati su CV, colloqui, personal branding e motivazione. Si guardano qui, senza uscire dall'app.</p>
        {!videos ? <Spinner /> : videos.length === 0 ? <Empty>Presto disponibili nuovi contenuti.</Empty> : (
          <div className="video-grid">
            {videos.map((v) => (
              <div key={v.id} className="video-card">
                <div className="video-embed">
                  <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}`} title={v.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
                <div style={{ padding: "10px 2px 0" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title}</div>
                  {v.desc && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{v.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function CandidateProfile() {
  const { data, loading } = useData(api.candidateOverview);
  if (loading || !data) return <Spinner />;
  const p = data.profile;
  return (
    <div className="stack">
      <ProfilingBanner />
      <CvBanner />
      <div className="grid cols-2">
      <Card>
        <div className="row">
          <Avatar text={p.avatar} className="lg" />
          <div>
            <h3 style={{ fontSize: 18 }}>{p.name}</h3>
            <div className="muted">{p.title} · {p.location}</div>
          </div>
        </div>
        <p style={{ marginTop: 16 }}>{p.headline}</p>
        <div className="divider" style={{ margin: "16px 0" }} />
        <div className="row wrap" style={{ gap: 20 }}>
          <div><div className="muted" style={{ fontSize: 12 }}>Seniority</div><strong>{p.seniority}</strong></div>
          <div><div className="muted" style={{ fontSize: 12 }}>Settore</div><strong>{p.industry}</strong></div>
          <div><div className="muted" style={{ fontSize: 12 }}>In percorso dal</div><strong>{fmtDate(p.enrolledAt)}</strong></div>
        </div>
      </Card>
      <Card>
        <h3 className="section-title">Competenze</h3>
        <div className="tag-list">
          {(p.skills || []).map((s) => <span className="chip" key={s}>{s}</span>)}
        </div>
        <div className="divider" style={{ margin: "18px 0" }} />
        <h3 className="section-title">Curriculum</h3>
        <div className="list-item">
          <div className="tl-dot done">▤</div>
          <div className="grow"><div className="title">CV_{p.name.replace(" ", "_")}.pdf</div><div className="sub">Aggiornato · revisionato dal coach</div></div>
          <button className="btn ghost sm">Scarica</button>
        </div>
      </Card>
      </div>
    </div>
  );
}
