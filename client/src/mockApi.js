// In-memory mock API for the standalone (no-backend) demo build.
// Mirrors the server's endpoints so the same React UI runs client-only.
import { buildSeed } from "./seed.js";

let db = buildSeed();
let currentUserId = null;
let seq = 2000;
let settings = { id: "singleton", schedulerEnabled: true, checkIntervalSec: 60, lastTickAt: null };

// --- matcher (mirror server/matcher.js) ---
const M_DIMENSIONS = [
  { key: "role", label: "Ruolo / titolo", desc: "Quanto il titolo dell'offerta combacia con ruolo e parole chiave del candidato." },
  { key: "skills", label: "Competenze", desc: "Sovrapposizione tra le competenze del candidato e quelle richieste." },
  { key: "location", label: "Località", desc: "Vicinanza tra sede dell'offerta e città del candidato (o remoto)." },
  { key: "seniority", label: "Seniority", desc: "Coerenza tra livello del candidato e della posizione." },
  { key: "industry", label: "Settore", desc: "Affinità tra settore del candidato e dell'offerta." },
];
const M_DEFAULT = { role: 30, skills: 30, location: 15, seniority: 15, industry: 10 };
const M_METHOD = [
  "Ogni offerta viene confrontata col profilo del candidato su 5 dimensioni.",
  "Ogni dimensione riceve un sotto-punteggio da 0 a 100.",
  "Il punteggio finale è la media dei sotto-punteggi, pesata secondo i pesi.",
  "I pesi possono essere personalizzati dal singolo candidato: valgono solo per lui.",
  "Il candidato può contestare un punteggio: il feedback sposta i suoi pesi personali.",
];
const matchPrefs = {};   // userId -> weights
const matchFeedback = []; // {userId, jobId, verdict, createdAt}
const mNorm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9àèéìòù+#. ]/gi, " ").split(/\s+/).filter((w) => w.length > 2);
function mOverlap(a, b) { if (!a.length || !b.length) return 0; const set = new Set(b); const hits = [...new Set(a)].filter((t) => set.has(t)).length; return Math.min(100, Math.round((hits / Math.min(a.length, 8)) * 100)); }
const M_GENERIC = new Set(["manager", "senior", "junior", "lead", "principal", "staff", "specialist", "responsabile", "addetto", "addetta", "impiegato", "impiegata", "assistant", "assistente", "associate", "executive", "head", "director", "direttore", "officer", "coordinatore", "coordinator", "operatore", "operator", "tecnico", "technician", "consultant", "consulente", "stage", "intern", "trainee", "apprendista", "full", "part", "time", "remote", "smart", "working", "the", "and", "con", "per", "del", "della"]);
const mMean = (t) => t.filter((x) => !M_GENERIC.has(x));
const M_SYN = { sviluppatore: "developer", sviluppatrice: "developer", programmatore: "developer", dev: "developer", commerciale: "sales", vendite: "sales", venditore: "sales", account: "sales", contabile: "accounting", magazziniere: "warehouse", magazzino: "warehouse", logistica: "logistics", infermiere: "nurse", infermiera: "nurse", ingegnere: "engineer", progettista: "engineer", informatico: "it", grafico: "designer", grafica: "designer", personale: "hr", risorse: "hr", recruiter: "hr", selezione: "hr", commessa: "retail", commesso: "retail", negozio: "retail" };
const mStem = (t) => { const c = M_SYN[t] || t; return (c.length > 4 && c.endsWith("s")) ? c.slice(0, -1) : c; };
const mTok = (x, y) => mStem(x) === mStem(y);
function mTitleSim(dt, jt) { const a = mNorm(dt), b = mNorm(jt); if (!a.length || !b.length) return 0; const ma = mMean(a); if (ma.length) { const mm = ma.filter((t) => b.some((bt) => mTok(t, bt))); if (mm.length === 0) return 8; return Math.round(Math.min(100, (mm.length / ma.length) * 100)); } const matched = a.filter((t) => b.some((bt) => mTok(t, bt))); return Math.round((matched.length / a.length) * 100); }
const M_PLACEHOLDER = /in cerca di lavoro|candidat|—/i;
function mRole(c, j) {
  const titles = (c.desiredTitles && c.desiredTitles.length) ? c.desiredTitles : (c.title && !M_PLACEHOLDER.test(c.title) ? [c.title] : []);
  if (titles.length) return titles.reduce((best, t) => Math.max(best, mTitleSim(t, j.title || "")), 0);
  const cs = mMean(mNorm((c.skills || []).join(" ")));
  if (cs.length) { const jt = new Set(mNorm((j.title || "") + " " + (j.tags || []).join(" "))); const hits = cs.filter((t) => jt.has(t)).length; return hits > 0 ? Math.min(100, Math.round((hits / Math.min(cs.length, 6)) * 100)) : 12; }
  return 20;
}
const M_SEN = ["junior", "mid", "senior", "manager"];
function mSub(c, j) {
  const cRole = mNorm((c.title || "") + " " + (c.skills || []).join(" ")), jText = mNorm((j.title || "") + " " + (j.tags || []).join(" "));
  const ci = M_SEN.indexOf(String(c.seniority || "").toLowerCase()), ji = M_SEN.indexOf(String(j.seniority || "").toLowerCase());
  const sen = ci < 0 || ji < 0 ? 60 : (Math.abs(ci - ji) === 0 ? 100 : Math.abs(ci - ji) === 1 ? 70 : Math.abs(ci - ji) === 2 ? 40 : 20);
  const jl = String(j.location || "").toLowerCase(), jr = (j.remote || "").toLowerCase().includes("remot") || /remot|smart\s*work/.test(jl);
  const modes = (c.workModes || []).map((m) => String(m).toLowerCase());
  const wantsRemote = modes.includes("remoto"); const wantsOnsite = modes.includes("onsite") || modes.includes("ibrido");
  const prefs = (c.preferredLocations && c.preferredLocations.length ? c.preferredLocations : (c.location ? [c.location] : [])).map((p) => String(p).toLowerCase());
  const cityHit = prefs.some((p) => { const city = p.replace(/\(.*\)/, "").trim(); return city && !/italia|europa|mondo/.test(city) && jl.includes(city); });
  const broad = prefs.some((p) => /italia|europa|mondo/.test(p));
  let loc;
  if (cityHit) loc = 100;
  else if (wantsRemote && jr) loc = 95;
  else if (!prefs.length && !modes.length) loc = 55;
  else if (jr && (wantsRemote || !wantsOnsite)) loc = 82;
  else if (broad) loc = 72;
  else if (wantsOnsite && jr && !wantsRemote) loc = 45;
  else if (jl && prefs.length) loc = 40;
  else loc = 50;
  const cInd = String(c.industry || "").toLowerCase(), jInd = String(j.industry || "").toLowerCase();
  const ind = !cInd || cInd === "—" || !jInd ? 55 : cInd === jInd ? 100 : (jInd.includes(cInd) || cInd.includes(jInd)) ? 75 : 35;
  return { role: mRole(c, j), skills: mOverlap(mMean(mNorm((c.skills || []).join(" "))), mMean(mNorm((j.tags || []).join(" ") + " " + (j.title || "")))), location: loc, seniority: sen, industry: ind };
}
function mNormW(w) { const base = { ...M_DEFAULT, ...(w || {}) }; const tot = M_DIMENSIONS.reduce((s, d) => s + (Number(base[d.key]) || 0), 0) || 1; const o = {}; M_DIMENSIONS.forEach((d) => (o[d.key] = (Number(base[d.key]) || 0) / tot)); return o; }
function mCompute(c, j, w) {
  const subs = mSub(c, j), wf = mNormW(w);
  const breakdown = M_DIMENSIONS.map((d) => ({ key: d.key, label: d.label, desc: d.desc, weight: Math.round(wf[d.key] * 100), subscore: subs[d.key], contribution: Math.round(subs[d.key] * wf[d.key]) }));
  let score = Math.round(breakdown.reduce((s, b) => s + b.subscore * wf[b.key], 0));
  if (subs.role < 15) score = Math.min(score, 30);
  return { score, breakdown };
}
function mNudge(w, breakdown, verdict, step = 6) {
  const nw = { ...M_DEFAULT, ...(w || {}) };
  if (verdict === "good" || !breakdown?.length) return nw;
  const top = [...breakdown].sort((a, b) => b.contribution - a.contribution)[0];
  const delta = verdict === "too_high" ? -step : step;
  nw[top.key] = Math.max(5, Math.min(60, (Number(nw[top.key]) || 0) + delta));
  return nw;
}
const effW = (uid) => matchPrefs[uid] || M_DEFAULT;
const mDedup = (t, c) => { const n = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); return `${n(c)}|${n(t)}`; };
const mHasDup = (t, c) => db.jobs.some((j) => j.status === "active" && j.dedupKey === mDedup(t, c));
const mBlocked = (u) => !!(u && u.blockedUntil && new Date(u.blockedUntil).getTime() > Date.now());
db.jobs.forEach((j) => { if (!j.dedupKey) j.dedupKey = mDedup(j.title, j.company); });

// --- onboarding data (mirror server/onboardingData.js, compact) ---
const OB_EXP = [
  { key: "entry", label: "Entry-level (0-2 anni)", desc: "Primo ruolo full-time nel settore" },
  { key: "junior", label: "Junior / associate (1-3 anni)", desc: "Lavora autonomamente su task ben definiti" },
  { key: "mid", label: "Livello intermedio (3-5 anni)", desc: "Gestisce progetti, può fare mentoring" },
  { key: "senior", label: "Senior / lead (5+ anni)", desc: "Guida lavori complessi e definisce la direzione" },
  { key: "5_10", label: "5-10 anni", desc: "Ampia esperienza, guida team o funzioni" },
  { key: "10_plus", label: "Più di 10 anni", desc: "Leadership senior / dirigenziale" },
];
const OB_COMPANY = [
  { key: "startup", label: "Start-up", desc: "Fase iniziale, ritmo veloce, molta autonomia" },
  { key: "scaleup", label: "Scale-up", desc: "In forte crescita, struttura in espansione" },
  { key: "pmi", label: "PMI", desc: "Piccola-media impresa, ruoli concreti" },
  { key: "azienda", label: "Grande azienda", desc: "Struttura consolidata, percorsi definiti" },
];
const OB_JOBTYPES = [{ key: "full_time", label: "Tempo pieno" }, { key: "part_time", label: "Part-time" }, { key: "contract", label: "Contratto / Freelance" }];
const OB_SALARY = [20000, 40000, 60000, 80000, 100000, 120000, 140000, 160000, 180000, 200000, 220000, 240000];
const OB_SECTORS = ["Tecnologia dell'informazione e telecomunicazioni", "Sanità e scienze della vita", "Servizi finanziari e assicurativi", "Vendite e sviluppo commerciale", "Marketing, pubblicità e relazioni pubbliche", "Commercio al dettaglio e all'ingrosso", "Istruzione e formazione", "Risorse umane e reclutamento", "Ospitalità, turismo e tempo libero", "Industria manifatturiera e produzione", "Ingegneria e costruzioni", "Trasporti e logistica", "Energia e utilities", "Media, editoria e intrattenimento", "Design e creatività", "Consulenza e servizi professionali", "Legale", "Immobiliare", "Automotive", "Moda e lusso"];
const OB_LOCATIONS = ["Italia (tutta)", "Milano", "Roma", "Torino", "Bologna", "Firenze", "Napoli", "Genova", "Venezia", "Verona", "Bari", "Palermo", "Bergamo", "Brescia", "Europa", "Mondo"];
const OB_WORKMODES = [{ key: "remoto", label: "Da remoto" }, { key: "ibrido", label: "Ibrido" }, { key: "onsite", label: "In sede" }];
const MOCK_TRIGGER_TYPES = [
  { type: "manual", label: "Solo manuale / test" },
  { type: "on_scan", label: "A ogni scansione (se ci sono nuove offerte)" },
  { type: "days_after_signup", label: "N giorni dopo la registrazione" },
  { type: "low_offers", label: "Poche offerte da almeno N giorni" },
  { type: "on_subscription_active", label: "Quando l'abbonamento si attiva" },
  { type: "on_subscription_canceled", label: "Quando l'abbonamento si disattiva" },
];
const MOCK_DEFAULT_COMMS = [
  { key: "scan_done", name: "Scansione: nuove offerte trovate", channel: "email", enabled: true, trigger: { type: "on_scan" }, subject: "{count} nuove offerte per te oggi su digitalfa", body: "Ciao {name},\noggi la scansione ha trovato {count} nuove offerte compatibili.\nGuardale qui: {link}\n\n— digitalfa" },
  { key: "sub_active", name: "Abbonamento attivato", channel: "email", enabled: true, trigger: { type: "on_subscription_active" }, subject: "Il tuo abbonamento digitalfa è attivo", body: "Ciao {name},\nil tuo abbonamento è attivo.\n{link}\n\n— digitalfa" },
  { key: "sub_canceled", name: "Abbonamento disattivato", channel: "email", enabled: true, trigger: { type: "on_subscription_canceled" }, subject: "Abbonamento digitalfa disattivato", body: "Ciao {name},\nil tuo abbonamento è stato disattivato. Riattivalo quando vuoi.\n{link}\n\n— digitalfa" },
  { key: "onb_1", name: "Onboarding · sollecito 1 (valore)", channel: "email", enabled: true, trigger: { type: "days_after_signup", days: 1 }, subject: "Completa il profilo e ricevi subito offerte su misura", body: "Ciao {name},\nbastano 2 minuti per completare il profilo.\n{link}\n\n— digitalfa" },
  { key: "onb_2", name: "Onboarding · sollecito 2 (tempo)", channel: "email", enabled: true, trigger: { type: "days_after_signup", days: 3 }, subject: "Non perdere le offerte di oggi", body: "Ciao {name},\nsenza profilo completo non possiamo selezionarle per te.\n{link}\n\n— digitalfa" },
  { key: "onb_3", name: "Onboarding · sollecito 3 (prova sociale)", channel: "email", enabled: true, trigger: { type: "days_after_signup", days: 7 }, subject: "Altri come te hanno già trovato opportunità", body: "Ciao {name},\ntocca a te: completa il profilo.\n{link}\n\n— digitalfa" },
  { key: "low_offers", name: "In-app: poche offerte", channel: "inapp", enabled: true, trigger: { type: "low_offers", threshold: 10, minDays: 1 }, subject: "Poche offerte al momento", body: "Al momento abbiamo trovato poche offerte per il tuo profilo. Aggiungi altri titoli di ruolo e più località nelle Preferenze di ricerca, oppure allarga la modalità (es. anche da remoto)." },
];
function mGetComms() {
  const custom = Array.isArray(settings.config?.communications) ? settings.config.communications : [];
  const byKey = new Map(custom.map((c) => [c.key, c]));
  const merged = MOCK_DEFAULT_COMMS.map((d) => ({ ...d, ...(byKey.get(d.key) || {}), trigger: { ...d.trigger, ...((byKey.get(d.key) || {}).trigger || {}) } }));
  for (const c of custom) if (c.key && !MOCK_DEFAULT_COMMS.some((d) => d.key === c.key)) merged.push(c);
  return merged;
}
function mGetComm(key) { return mGetComms().find((c) => c.key === key) || null; }
const OB_TITLES = ["Software Engineer", "Senior Software Engineer", "Frontend Developer", "Backend Developer", "Full-Stack Developer", "DevOps Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer", "Product Manager", "Product Owner", "UX Designer", "UI Designer", "UX/UI Designer", "Marketing Manager", "Digital Marketing Specialist", "Growth Marketing Manager", "SEO Specialist", "Content Manager", "Social Media Manager", "Sales Manager", "Account Executive", "Key Account Manager", "Business Development Manager", "Customer Success Manager", "Financial Analyst", "Controller", "Operations Manager", "Supply Chain Manager", "Project Manager", "Business Analyst", "HR Manager", "HR Business Partner", "Talent Acquisition Specialist", "Recruiter", "Venture Builder", "Consultant", "Store Manager", "Area Manager"];
const EXP_TO_SEN = { entry: "Junior", junior: "Junior", mid: "Mid", senior: "Senior", "5_10": "Senior", "10_plus": "Manager" };

// --- inline outreach generators (mirror server/generators.js) ---
const G_NAMES = ["Giulia Ferrari", "Marco Bianchi", "Elena Conti", "Luca Ricci", "Sara Marino", "Andrea Greco", "Chiara Esposito", "Matteo Romano", "Francesca Gallo", "Davide Costa"];
const G_DEPT = { Tech: "Engineering", Marketing: "Marketing", Sales: "Sales", HR: "People", Operations: "Operations", Finance: "Finance", Retail: "Retail" };
const ghash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const liSearch = (q) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
// Mirror leggero di titleTier del server (per l'anteprima demo).
const MT_GENERIC = new Set(["manager","senior","junior","lead","principal","staff","specialist","responsabile","addetto","addetta","assistant","assistente","associate","executive","head","director","direttore","officer","coordinatore","coordinator","operatore","operator","tecnico","technician","consultant","consulente","stage","intern","trainee","full","part","time","remote","smart","working","the","and","con","per","del","della"]);
const mtNorm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9àèéìòù+#. ]/gi, " ").split(/\s+/).filter((w) => w.length > 2);
const mtStem = (t) => (t.length > 4 && t.endsWith("s")) ? t.slice(0, -1) : t;
function mTitleTier(desiredTitles, jobTitle) {
  const titles = (desiredTitles || []).filter(Boolean);
  if (!titles.length) return "other";
  const jFull = new Set(mtNorm(jobTitle).map(mtStem));
  const jCore = new Set(mtNorm(jobTitle).filter((t) => !MT_GENERIC.has(t)).map(mtStem));
  let best = "other";
  for (const t of titles) {
    const rFull = mtNorm(t).map(mtStem); if (!rFull.length) continue;
    const rSet = new Set(rFull);
    const rCore = new Set(mtNorm(t).filter((x) => !MT_GENERIC.has(x)).map(mtStem));
    const coreRef = rCore.size ? rCore : rSet;
    const missing = [...rSet].filter((x) => !jFull.has(x));
    const extraCore = [...jCore].filter((x) => !rSet.has(x));
    const shareCore = [...coreRef].some((x) => jFull.has(x));
    let tier = "other";
    if (missing.length === 0 && extraCore.length === 0) tier = "exact";
    else if (shareCore && missing.length <= 1) tier = "related";
    if (tier === "exact") return "exact";
    if (tier === "related") best = "related";
  }
  return best;
}
function mReqs(desc) {
  const t = String(desc || ""); if (!t) return [];
  const sec = t.match(/(requisiti|requirements|cosa cerchiamo|your profile|qualifications|chi sei)[:\s-]*/i);
  const seg = sec ? t.slice(sec.index + sec[0].length) : t;
  let parts = seg.split(/[\n•·]|(?:^|\s)[-–]\s|;/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) parts = seg.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const cue = /(esperienza|anni|laurea|conoscenz|competenz|richiest|required|skills?|degree|years|inglese)/i;
  const clean = parts.filter((p) => p.length >= 12 && p.length <= 140);
  const cued = clean.filter((p) => cue.test(p));
  return (cued.length ? cued : clean).slice(0, 5).map((p) => p.replace(/^[\s\-–•]+/, "").slice(0, 130));
}
function gContacts(job) {
  const dept = G_DEPT[job.industry] || "Team";
  const co = job.company && job.company !== "—" ? job.company : "";
  const roles = [
    { role: `Recruiter / Talent Acquisition${co ? ` · ${co}` : ""}`, q: `("Recruiter" OR "Talent Acquisition") ${co}`.trim() },
    { role: `Responsabile HR${co ? ` · ${co}` : ""}`, q: `("HR" OR "Risorse Umane") ${co}`.trim() },
    { role: `Hiring Manager · ${dept}${co ? ` · ${co}` : ""}`, q: `("Hiring Manager" OR "Head of ${dept}") ${co}`.trim() },
  ];
  const contacts = roles.map((r) => ({ role: r.role, company: job.company, linkedin: liSearch(r.q) }));
  const jdEmail = (String(job.description || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || null;
  return { contacts, jdEmail };
}
function gMessage(p, job) {
  const first = (p.name || "").split(" ")[0] || "Ciao";
  const skills = (p.skills || []).slice(0, 2).join(" e ");
  const role = p.title && p.title !== "—" ? p.title : "professionista";
  let m = `Ciao, sono ${first}, ${role}. Ho visto la posizione ${job.title} in ${job.company}: con esperienza in ${skills || job.industry} credo di poter dare valore al team. Possiamo sentirci?`;
  return m.length > 199 ? m.slice(0, 196).trimEnd() + "…" : m;
}
function gCover(p, job) {
  const skills = (p.skills || []).slice(0, 4);
  const line = skills.length ? skills.slice(0, -1).join(", ") + (skills.length > 1 ? ` e ${skills[skills.length - 1]}` : skills[0]) : "diverse competenze trasversali";
  const remote = job.remote && job.remote !== "—" ? ` (${job.remote.toLowerCase()})` : "";
  const intro = p.headline ? ` ${p.headline}` : "";
  return `Gentile team di ${job.company},\n\ndesidero candidarmi per la posizione di ${job.title}${remote} pubblicata di recente.\n\nSono ${p.name}, ${p.title || "un professionista"}.${intro} Nel corso del mio percorso ho sviluppato competenze in ${line}, che ritengo particolarmente rilevanti per questo ruolo${job.industry && job.industry !== "—" ? ` in ambito ${job.industry.toLowerCase()}` : ""}.\n\nMi attrae la possibilità di contribuire ai risultati di ${job.company} portando un approccio orientato agli obiettivi. Sarei felice di illustrarvi in un colloquio come la mia esperienza possa tradursi in valore concreto per il vostro team.\n\nCordiali saluti,\n${p.name}`;
}
const nid = (p) => `${p}-${++seq}`;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const addHoursISO = (h) => new Date(Date.now() + h * 3600000).toISOString();

const publicUser = (u) => { const { password, ...rest } = u; return rest; };
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 110));
const fail = (m) => Promise.reject(new Error(m));

const CONNECTOR_LABELS = {
  simulated: "Simulato",
  arbeitnow: "Arbeitnow API (reale)",
  jooble: "Jooble API (reale)",
  adzuna: "Adzuna API (reale · multi-paese)",
  remotive: "Remotive (remote · gratis)",
  remoteok: "RemoteOK (remote · gratis)",
  jobicy: "Jobicy (remote · gratis)",
  jobdataapi: "jobdataapi (Italia · gratis)",
  arbeitsagentur: "Arbeitsagentur (DE · gratis)",
  findwork: "Findwork (dev · chiave)",
  theirstack: "TheirStack (tech · chiave)",
  jsearch: "JSearch · RapidAPI (Indeed/LinkedIn)",
  http_json: "HTTP/JSON generico",
  rss: "Feed RSS",
  linkedin: "LinkedIn Partner API",
  indeed: "Indeed Partner API",
};
const planById = (id) => db.plans.find((p) => p.id === id) || null;
const sourceName = (id) => db.sources.find((s) => s.id === id)?.name || null;
function me() { return db.users.find((u) => u.id === currentUserId); }

function candidateCard(c) {
  const prog = db.progress[c.id] || {};
  const done = Object.values(prog).filter((s) => s === "done").length;
  const total = db.milestoneTemplate.length;
  const coach = db.users.find((u) => u.id === c.coachId);
  const company = db.companies.find((co) => co.id === c.companyId);
  const program = db.programs.find((p) => p.id === c.programId);
  const apps = db.applications.filter((a) => a.candidateId === c.id);
  return { ...publicUser(c), progressPct: Math.round((done / total) * 100), coachName: coach?.name || null, companyName: company?.name || null, programName: program?.name || null, applicationsCount: apps.length };
}

function billingOwnerFor(u) {
  if (u.role === "hr") return { ownerType: "company", ownerId: u.companyId };
  if (u.role === "candidate") return { ownerType: "user", ownerId: u.id };
  return null;
}
const findSub = (t, id) => db.subscriptions.find((s) => s.ownerType === t && s.ownerId === id) || null;
const subView = (s) => (s ? { ...s, plan: planById(s.planId) } : null);
function activate({ ownerType, ownerId, planId, card, voucher }) {
  const plan = planById(planId);
  let sub = findSub(ownerType, ownerId);
  if (!sub) { sub = { id: nid("sub"), ownerType, ownerId, provider: "simulated", startedAt: today() }; db.subscriptions.push(sub); }
  Object.assign(sub, { planId, status: "active", currentPeriodEnd: addDays(30), cancelAtPeriodEnd: false, card: card || sub.card || { brand: "Visa", last4: "4242", expMonth: 12, expYear: 2028 },
    voucherCode: voucher ? voucher.code : null, discountPercent: voucher ? voucher.percent : null, freeUntil: (voucher && voucher.percent >= 100) ? addDays(voucher.durationDays || 30) : null });
  if (ownerType === "company") { const co = db.companies.find((c) => c.id === ownerId); if (co && plan) { co.plan = plan.name; if (plan.seats) co.seatsTotal = plan.seats; } }
  return sub;
}

const NEW_JOB_POOL = [
  { title: "Growth Marketing Lead", company: "Scalr", location: "Milano", type: "Full-time", remote: "Remoto", salary: "58-72", industry: "Marketing", seniority: "Manager", tags: ["Digital marketing", "Analytics", "Growth"] },
  { title: "Data Analyst", company: "Insightly", location: "Milano", type: "Full-time", remote: "Ibrido", salary: "40-50", industry: "Tech", seniority: "Mid", tags: ["SQL", "Analytics", "Python"] },
  { title: "HR Business Partner", company: "PeopleFirst", location: "Torino", type: "Full-time", remote: "Ibrido", salary: "45-55", industry: "HR", seniority: "Manager", tags: ["People management", "HR"] },
  { title: "Customer Success Manager", company: "Retain", location: "Bologna", type: "Full-time", remote: "Remoto", salary: "38-48", industry: "Sales", seniority: "Mid", tags: ["CRM", "Customer success"] },
  { title: "DevOps Engineer", company: "Cloudnine", location: "Milano", type: "Full-time", remote: "Remoto", salary: "55-68", industry: "Tech", seniority: "Senior", tags: ["AWS", "CI/CD", "Kubernetes"] },
];
function runScan(source) {
  const nowISO = new Date().toISOString(), d = today();
  let added = 0, deactivated = 0;
  const active = db.jobs.filter((j) => j.sourceId === source.id && j.status === "active");
  active.forEach((j) => (j.lastSeenAt = d));
  if (active.length > 2 && Math.random() < 0.5) { const v = active[active.length - 1]; v.status = "inactive"; v.deactivatedAt = d; deactivated = 1; }
  let duplicates = 0;
  if (source.type === "portal" && Math.random() < 0.75) {
    const t = NEW_JOB_POOL[Math.floor(Math.random() * NEW_JOB_POOL.length)];
    if (mHasDup(t.title, t.company)) { duplicates = 1; }
    else {
      db.jobs.push({ id: nid("job"), ...t, postedAt: d, description: `Rilevata dalla scansione di ${source.name}.`, origin: "scan", sourceId: source.id, status: "active", firstSeenAt: d, lastSeenAt: d, externalId: nid("ext"), dedupKey: mDedup(t.title, t.company) });
      added = 1;
    }
  }
  const found = db.jobs.filter((j) => j.sourceId === source.id && j.status === "active").length;
  source.lastScanAt = nowISO; source.lastScanFound = found; source.nextScanAt = addHoursISO(source.frequencyHours);
  const log = { id: nid("log"), sourceId: source.id, runAt: nowISO, found, added, deactivated, duplicates, status: "ok" };
  db.scanLogs.unshift(log);
  return log;
}

export const mockApi = {
  demoAccounts: () => delay(["candidate", "coach", "hr", "admin"].map((role) => { const u = db.users.find((x) => x.role === role); return { role, email: u.email, password: u.password, name: u.name }; })),
  plans: () => delay(db.plans),

  login: (email, password) => {
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password);
    if (!user) return delay().then(() => fail("Credenziali non valide"));
    if (mBlocked(user)) return delay().then(() => fail(`Account sospeso fino al ${new Date(user.blockedUntil).toLocaleString("it-IT")}`));
    currentUserId = user.id;
    return delay({ token: user.id, user: publicUser(user) });
  },
  me: () => delay(publicUser(me())),

  forgotPassword: (email) => {
    const u = db.users.find((x) => x.email.toLowerCase() === String(email || "").toLowerCase());
    if (u) { u.resetToken = "demo-" + nid("t"); u.resetExpires = new Date(Date.now() + 3600000).toISOString(); }
    return delay({ ok: true });
  },
  resetPassword: (token, password) => {
    if (!token || !password) return fail("Token e nuova password obbligatori");
    if (String(password).length < 6) return fail("La password deve avere almeno 6 caratteri");
    const u = db.users.find((x) => x.resetToken === token && x.resetExpires && new Date(x.resetExpires).getTime() > Date.now());
    if (!u) return fail("Link non valido o scaduto. Richiedi un nuovo reset.");
    u.password = password; u.resetToken = null; u.resetExpires = null;
    return delay({ ok: true });
  },

  signup: ({ email, username, password, intent, acceptTerms }) => {
    const roleMap = { job_seeker: "candidate", employer: "hr", referral: "referral" };
    const role = roleMap[intent];
    if (!email || !username || !password) return fail("Email, username e password sono obbligatori");
    if (!role) return fail("Seleziona cosa vuoi fare");
    if (!acceptTerms) return fail("Devi accettare i Termini e condizioni per registrarti.");
    if (db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return fail("Esiste già un account con questa email");
    const initials = String(username).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
    const base = { id: nid("u"), name: username, username, email: String(email).toLowerCase(), password, avatar: initials, status: "active", enrolledAt: today(), permissions: [] };
    let user;
    if (role === "hr") {
      const co = { id: nid("co"), name: `${username} — azienda`, logo: initials, plan: "Free", seatsTotal: 0, activeSince: today() };
      db.companies.push(co);
      user = { ...base, role: "hr", title: "Azienda · HR", companyId: co.id };
    } else if (role === "referral") {
      user = { ...base, role: "referral", title: "Referral aziendale" };
    } else {
      let referredBy = null;
      if (arguments[0] && arguments[0].ref) { const rr = db.users.find((x) => x.referralCode === String(arguments[0].ref).trim().toUpperCase()); if (rr) referredBy = rr.id; }
      user = { ...base, role: "candidate", title: "In cerca di lavoro", onboarded: false, referredBy };
      if (referredBy) { db.referrals ||= []; db.referrals.unshift({ id: nid("ref"), referrerId: referredBy, code: String(arguments[0].ref).trim().toUpperCase(), email: base.email, referredUserId: user.id, status: "registered", invitedAt: new Date().toISOString() }); }
    }
    db.users.push(user);
    currentUserId = user.id;
    return delay({ token: user.id, user: publicUser(user) });
  },

  register: (payload) => {
    const { mode, name, email, password, planId, companyName } = payload || {};
    if (!name || !email || !password) return fail("Nome, email e password sono obbligatori");
    if (db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return fail("Esiste già un account con questa email");
    const plan = planById(planId); if (!plan) return fail("Piano non valido");
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    let user, ownerType, ownerId;
    if (mode === "company") {
      if (!companyName) return fail("Nome azienda obbligatorio");
      const company = { id: nid("co"), name: companyName, sector: "—", city: "—", logo: initials, plan: plan.name, seatsTotal: plan.seats || 0, activeSince: today(), careersUrl: "" };
      db.companies.push(company);
      user = { id: nid("u"), role: "hr", name, email, password, title: "HR", avatar: initials, companyId: company.id };
      ownerType = "company"; ownerId = company.id;
    } else {
      user = { id: nid("u"), role: "candidate", name, email, password, title: "In cerca di lavoro", avatar: initials, location: "—", seniority: "—", industry: "—", headline: "", skills: [], status: "active", enrolledAt: today() };
      ownerType = "user"; ownerId = user.id;
    }
    db.users.push(user);
    currentUserId = user.id;
    if (plan.price === 0) { activate({ ownerType, ownerId, planId }); return delay({ token: user.id, user: publicUser(user), checkout: { activated: true } }); }
    if (plan.contact) return delay({ token: user.id, user: publicUser(user), checkout: { contactSales: true } });
    return delay({ token: user.id, user: publicUser(user), checkout: { needsPayment: true, planId } });
  },

  // BILLING (simulated)
  getSubscription: () => {
    const u = me(); const owner = billingOwnerFor(u);
    if (!owner) return delay({ subscription: null, plans: db.plans });
    const audience = owner.ownerType === "company" ? "company" : "individual";
    const covered = u.role === "candidate" && u.companyId ? db.companies.find((c) => c.id === u.companyId)?.name : null;
    return delay({ subscription: subView(findSub(owner.ownerType, owner.ownerId)), owner, coveredByCompany: covered, plans: db.plans.filter((p) => p.audience === audience), liveBilling: false });
  },
  checkout: (planId) => { const plan = planById(planId); if (!plan) return fail("Piano non valido"); if (plan.contact) return delay({ contactSales: true }); return delay({ simulated: true, planId }); },
  confirmCheckout: (planId, card, voucherCode) => {
    const plan = planById(planId); if (!plan) return fail("Piano non valido");
    const owner = billingOwnerFor(me());
    let voucher = null;
    if (voucherCode) { const v = (db.vouchers || []).find((x) => x.code === String(voucherCode).trim().toUpperCase() && x.active); if (v) { voucher = v; v.redeemedCount = (v.redeemedCount || 0) + 1; } }
    const sub = activate({ ownerType: owner.ownerType, ownerId: owner.ownerId, planId, card: card ? { brand: card.brand || "Visa", last4: (card.number || "4242").slice(-4), expMonth: card.expMonth || 12, expYear: card.expYear || 2028 } : null, voucher });
    // Premia il referrer (demo): 2 settimane gratis.
    const u = me();
    if (u.referredBy) {
      const rr = (db.referrals || []).find((r) => r.referrerId === u.referredBy && r.referredUserId === u.id);
      if (!rr || rr.status !== "rewarded") {
        let rsub = findSub("user", u.referredBy); if (!rsub) { rsub = { id: nid("sub"), ownerType: "user", ownerId: u.referredBy, provider: "simulated", startedAt: today(), planId: "ind_weekly", status: "active", currentPeriodEnd: addDays(14) }; db.subscriptions.push(rsub); }
        rsub.freeUntil = addDays(14);
        if (rr) { rr.status = "rewarded"; rr.rewardedAt = new Date().toISOString(); }
      }
    }
    return delay({ subscription: subView(sub) });
  },
  applyVoucher: (code) => {
    const v = (db.vouchers || []).find((x) => x.code === String(code || "").trim().toUpperCase());
    if (!v || !v.active) return fail("Codice non valido o disattivato.");
    if (v.maxRedemptions != null && v.redeemedCount >= v.maxRedemptions) return fail("Codice esaurito.");
    return delay({ ok: true, code: v.code, percent: v.percent, durationDays: v.durationDays, free: v.percent >= 100 });
  },
  adminVouchers: () => delay({ vouchers: (db.vouchers || []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }),
  adminVoucherCreate: (b) => {
    db.vouchers ||= [];
    let code = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "") || ("DIGI" + Math.random().toString(36).slice(2, 8).toUpperCase());
    if (db.vouchers.find((x) => x.code === code)) return fail("Codice già esistente.");
    const v = { id: nid("vou"), code, percent: Math.max(1, Math.min(100, parseInt(b.percent, 10) || 100)), durationDays: Math.max(1, parseInt(b.durationDays, 10) || 30), maxRedemptions: b.maxRedemptions ? parseInt(b.maxRedemptions, 10) : null, note: b.note || null, active: true, redeemedCount: 0, createdAt: new Date().toISOString() };
    db.vouchers.unshift(v); return delay({ voucher: v });
  },
  adminVoucherToggle: (id, active) => { const v = (db.vouchers || []).find((x) => x.id === id); if (v) v.active = active; return delay({ voucher: v }); },
  adminVoucherDelete: (id) => { db.vouchers = (db.vouchers || []).filter((x) => x.id !== id); return delay({ ok: true }); },
  cancelSubscription: () => { const o = billingOwnerFor(me()); const s = findSub(o.ownerType, o.ownerId); if (!s) return fail("Nessun abbonamento"); s.cancelAtPeriodEnd = true; return delay({ subscription: subView(s) }); },
  resumeSubscription: () => { const o = billingOwnerFor(me()); const s = findSub(o.ownerType, o.ownerId); if (!s) return fail("Nessun abbonamento"); s.cancelAtPeriodEnd = false; return delay({ subscription: subView(s) }); },
  billingPortal: () => delay({ simulated: true }),

  // CANDIDATE
  candidateOverview: () => {
    const c = me();
    const prog = db.progress[c.id] || {};
    const milestones = db.milestoneTemplate.map((m) => ({ ...m, status: prog[m.key] || "todo" }));
    const done = milestones.filter((m) => m.status === "done").length;
    const coach = db.users.find((u) => u.id === c.coachId);
    const program = db.programs.find((p) => p.id === c.programId);
    const sessions = db.sessions.filter((s) => s.candidateId === c.id).sort((a, b) => new Date(a.date) - new Date(b.date));
    const nextSession = sessions.find((s) => s.status === "scheduled") || null;
    const apps = db.applications.filter((a) => a.candidateId === c.id).map((a) => ({ ...a, job: db.jobs.find((j) => j.id === a.jobId) }));
    return delay({ profile: publicUser(c), program, coach: coach ? publicUser(coach) : null, milestones, progressPct: Math.round((done / milestones.length) * 100), nextSession, sessions, applications: apps });
  },
  candidateJobs: () => {
    const c = me(); const w = effW(c.id);
    const appliedSet = new Set(db.applications.filter((a) => a.candidateId === c.id).map((a) => a.jobId));
    const scored = db.jobs.filter((j) => j.status === "active" && (!j.ownerUserId || j.ownerUserId === c.id)).map((j) => {
      const { score, breakdown } = mCompute(c, j, w);
      return { ...j, match: score, breakdown, applied: appliedSet.has(j.id), manual: j.ownerUserId === c.id };
    }).filter((j) => j.manual || j.match >= 45).sort((a, b) => b.match - a.match).slice(0, 300);
    const desired = (c.desiredTitles && c.desiredTitles.length) ? c.desiredTitles : (c.title ? [c.title] : []);
    scored.forEach((j) => { j.requirements = mReqs(j.description); j.titleTier = mTitleTier(desired, j.title); });
    const scan = { scheduledHour: (settings.config && settings.config.dailyScanHour) || null, doneToday: settings.lastDailyScanDate === today(), today: today() };
    const lo = mGetComm("low_offers");
    let lowOffers = null;
    if (lo && lo.enabled !== false && scored.length < (parseInt(lo.trigger?.threshold, 10) || 10)) lowOffers = { title: lo.subject, message: lo.body };
    return delay({ offers: scored, scan, lowOffers });
  },
  onboardingOptions: () => delay({ titles: OB_TITLES, sectors: OB_SECTORS, experienceLevels: OB_EXP, companyTypes: OB_COMPANY, jobTypes: OB_JOBTYPES, salarySteps: OB_SALARY, locations: OB_LOCATIONS, workModes: OB_WORKMODES }),
  uploadCv: (fileName) => {
    const u = me();
    u.cvFileName = fileName || "cv"; u.cvUploadedAt = new Date().toISOString();
    // Demo: estrazione simulata (nella versione reale legge davvero il PDF/DOCX).
    const extracted = { fullName: u.name, email: u.email, phone: "+39 333 1234567", location: u.location && u.location !== "—" ? u.location : "Milano", seniority: u.seniority || "Mid", skills: u.skills && u.skills.length ? u.skills : ["Project management", "Analytics"], desiredTitles: u.desiredTitles && u.desiredTitles.length ? u.desiredTitles : [u.title], sectors: u.sectors || [], summary: "Profilo professionale con esperienza nel settore. (estratto simulato nella demo)", source: "demo" };
    return delay({ ok: true, extracted, user: publicUser(u) });
  },
  saveOnboarding: (b) => {
    const u = me();
    const desiredTitles = (b.desiredTitles || []).filter(Boolean).slice(0, 8);
    const prefLoc = (b.preferredLocations || []).filter(Boolean);
    const workModes = (b.workModes || []).filter(Boolean).map((m) => String(m).toLowerCase());
    const city = prefLoc.find((l) => l && !/italia|europa|mondo/i.test(l)) || null;
    const remote = workModes.includes("remoto");
    const personal = b.personal || {};
    Object.assign(u, {
      onboarded: true, desiredTitles, experienceLevel: b.experienceLevel || null,
      minSalary: b.minSalary != null ? +b.minSalary : null, sectors: b.sectors || [],
      jobTypes: b.jobTypes || [], preferredLocations: prefLoc, workModes, companyTypes: b.companyTypes || [],
      ...(b.acceptTerms && !u.acceptedTermsAt ? { acceptedTermsAt: new Date().toISOString() } : {}),
      ...(b.linkedinUrl != null ? { linkedinUrl: String(b.linkedinUrl).trim() || null } : {}),
      title: desiredTitles[0] || u.title, location: (personal.location && personal.location.trim()) || city || (remote ? "Remoto" : u.location || "—"),
      seniority: EXP_TO_SEN[b.experienceLevel] || u.seniority || "—",
      skills: (personal.skills && personal.skills.length) ? personal.skills : (desiredTitles.length ? desiredTitles : u.skills),
      ...(personal.fullName && personal.fullName.trim() ? { name: personal.fullName.trim() } : {}),
      ...(personal.phone != null ? { phone: String(personal.phone) } : {}),
      ...(personal.summary != null ? { summary: String(personal.summary) } : {}),
    });
    // simulate a scan: add a few active jobs derived from the desired titles
    let imported = 0, duplicates = 0; const d = today();
    (desiredTitles.slice(0, 2)).forEach((t, i) => {
      const pool = NEW_JOB_POOL[i % NEW_JOB_POOL.length];
      if (mHasDup(t, pool.company)) { duplicates++; return; }
      db.jobs.push({ id: nid("job"), title: t, company: pool.company, location: city || "Milano", type: "Full-time", remote: remote ? "Remoto" : "Ibrido", salary: "n.d.", industry: pool.industry, seniority: EXP_TO_SEN[b.experienceLevel] || "Mid", postedAt: d, tags: pool.tags, description: `Offerta reale rilevata per «${t}».`, origin: "scan", sourceId: null, status: "active", firstSeenAt: d, lastSeenAt: d, externalId: nid("ext"), dedupKey: mDedup(t, pool.company) });
      imported++;
    });
    return delay({ ok: true, user: publicUser(u), scan: { imported, duplicates, mode: "simulato (demo)" } });
  },
  matchConfig: () => delay({ dimensions: M_DIMENSIONS, defaultWeights: M_DEFAULT, methodology: M_METHOD }),
  getMatchPrefs: () => { const c = me(); return delay({ weights: matchPrefs[c.id] || M_DEFAULT, customized: !!matchPrefs[c.id], defaults: M_DEFAULT, dimensions: M_DIMENSIONS }); },
  setMatchPrefs: (weights) => { const c = me(); const clean = {}; M_DIMENSIONS.forEach((d) => (clean[d.key] = Math.max(0, Math.min(100, Number(weights[d.key]) || 0)))); matchPrefs[c.id] = clean; return delay({ weights: clean }); },
  resetMatchPrefs: () => { const c = me(); delete matchPrefs[c.id]; return delay({ weights: M_DEFAULT }); },
  jobFeedback: (jobId, verdict, note) => {
    const c = me(); const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata");
    matchFeedback.unshift({ id: nid("fb"), userId: c.id, jobId, verdict, note: note || null, createdAt: new Date().toISOString() });
    if (verdict === "down") return delay({ ok: true, recorded: true });
    if (verdict !== "good") { const { breakdown } = mCompute(c, job, effW(c.id)); matchPrefs[c.id] = mNudge(effW(c.id), breakdown, verdict); }
    return delay({ ok: true, weights: effW(c.id) });
  },
  adminAlerts: () => {
    // Demo: mostra alcuni alert d'esempio coerenti con lo stato delle chiavi.
    const cfg = settings.config || {}; const alerts = [];
    if (cfg.joobleApiKey) alerts.push({ kind: "source", key: "jooble", level: "error", message: "Fonte «Jooble» in errore: HTTP 403 (chiave non valida).", since: new Date().toISOString() });
    if (!cfg.smtpHost) alerts.push({ kind: "smtp", key: "send", level: "warn", message: "SMTP non configurato: le email sono simulate.", since: new Date().toISOString() });
    return delay({ alerts, mail: { configured: !!cfg.smtpHost, lastError: null } });
  },
  adminMatchOverview: () => {
    const byVerdict = matchFeedback.reduce((a, f) => { a[f.verdict] = (a[f.verdict] || 0) + 1; return a; }, {});
    const downs = matchFeedback.filter((f) => f.verdict === "down");
    const rc = {}; downs.forEach((d) => { const r = (d.note || "Nessun motivo").trim(); rc[r] = (rc[r] || 0) + 1; });
    const recent = downs.slice(0, 20).map((d) => { const j = db.jobs.find((x) => x.id === d.jobId) || {}; return { createdAt: d.createdAt, note: d.note, title: j.title || "—", company: j.company || "" }; });
    const downStats = { total: downs.length, reasons: Object.entries(rc).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), recent };
    return delay({ dimensions: M_DIMENSIONS, defaultWeights: M_DEFAULT, methodology: M_METHOD, feedback: { total: matchFeedback.length, byVerdict, recent: matchFeedback.slice(0, 8) }, downStats, customisedCandidates: Object.keys(matchPrefs).length });
  },
  apply: (jobId, extra = {}) => {
    const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata");
    if (db.applications.find((a) => a.candidateId === currentUserId && a.jobId === jobId)) return fail("Ti sei già candidato a questa offerta");
    const now = new Date().toISOString();
    const a = { id: nid("app"), candidateId: currentUserId, jobId, stage: "applied", appliedAt: now, updatedAt: now, coverLetter: extra.coverLetter || null, contactMessage: extra.contactMessage || null };
    db.applications.push(a); return delay({ ...a, job });
  },
  applyCheck: (jobId) => {
    const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata");
    const host = ((job.url || "").match(/^https?:\/\/([^/]+)/i) || [])[1] || "";
    let mode = "manuale"; const reasons = [];
    if (!job.url) reasons.push("Nessun link di candidatura salvato per questa offerta.");
    else if (/adzuna|jooble|indeed|linkedin/i.test(host)) reasons.push("Il link porta a un aggregatore: candidatura sul sito finale, spesso con registrazione.");
    else if (/workable|greenhouse|lever|smartrecruiters|recruitee|teamtailor/i.test(host)) { mode = "assistita"; reasons.push(`ATS standard (${host}): form strutturato, di norma con email e CV.`); reasons.push("Possibili domande aggiuntive."); }
    else if (host) reasons.push("Sito aziendale non standard: probabile registrazione e/o domande.");
    reasons.push("Anti-bot, login e domande extra non sono rilevabili con certezza in anticipo.");
    return delay({ mode, host: host || null, url: job.url || null, reasons });
  },
  setApplied: (jobId, applied) => {
    const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata");
    const ex = db.applications.find((a) => a.candidateId === currentUserId && a.jobId === jobId);
    if (applied && !ex) { const now = new Date().toISOString(); db.applications.push({ id: nid("app"), candidateId: currentUserId, jobId, stage: "applied", appliedAt: now, updatedAt: now }); }
    else if (!applied && ex) { db.applications = db.applications.filter((a) => a !== ex); }
    return delay({ ok: true, applied });
  },
  jobOutreach: (jobId) => { const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata"); const msg = gMessage(me(), job); const { contacts, jdEmail } = gContacts(job); return delay({ jobId, contacts, jdEmail, message: msg, messageLength: msg.length }); },
  jobCoverLetter: (jobId) => { const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata"); return delay({ jobId, coverLetter: gCover(me(), job), attachable: job.origin === "hr_upload" }); },
  jobCvTailored: (jobId) => { const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata"); const u = me(); const skills = (u.skills || []).slice(0, 5); return delay({ jobId, hasCv: !!u.cvUploadedAt, cv: `Headline su misura\n${u.title || "Professionista"} orientato a ${job.title}\n\nSommario professionale\nProfessionista con esperienza in ${(skills.slice(0,3).join(", ") || job.industry || "diversi ambiti")}, interessato al ruolo di ${job.title} presso ${job.company}.\n\nDa mettere in evidenza\n${(skills.length?skills:["Competenze chiave","Risultati misurabili"]).map((s)=>`• ${s}`).join("\n")}\n• Adatta le prime righe del CV alle parole chiave di "${job.title}".` }); },
  jobAd: (jobId) => { const job = db.jobs.find((j) => j.id === jobId); if (!job) return fail("Offerta non trovata"); return delay({ jobId, title: job.title, company: job.company, location: job.location, description: job.description || "", url: job.url || null }); },
  // LinkedIn (simulated in the demo)
  linkedinStart: () => delay({ simulated: true }),
  linkedinSimulate: () => {
    let u = db.users.find((x) => x.linkedinId === "li-demo-user");
    if (!u) { u = { id: nid("u"), role: "candidate", name: "Giorgia De Luca", email: "giorgia.linkedin@digitalfa.demo", authProvider: "linkedin", linkedinId: "li-demo-user", title: "In cerca di lavoro", avatar: "GD", location: "—", seniority: "—", industry: "—", headline: "", skills: [], status: "active", enrolledAt: today() }; db.users.push(u); }
    currentUserId = u.id; return delay({ token: u.id, user: publicUser(u) });
  },

  // COACH
  coachCaseload: () => {
    const candidates = db.users.filter((u) => u.role === "candidate" && u.coachId === currentUserId).map(candidateCard);
    const upcoming = db.sessions.filter((s) => s.coachId === currentUserId && s.status === "scheduled").map((s) => ({ ...s, candidateName: db.users.find((u) => u.id === s.candidateId)?.name })).sort((a, b) => new Date(a.date) - new Date(b.date));
    return delay({ candidates, upcoming });
  },
  coachCandidate: (id) => {
    const c = db.users.find((u) => u.id === id && u.coachId === currentUserId); if (!c) return fail("Candidato non trovato");
    const prog = db.progress[c.id] || {};
    const milestones = db.milestoneTemplate.map((m) => ({ ...m, status: prog[m.key] || "todo" }));
    const sessions = db.sessions.filter((s) => s.candidateId === c.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const apps = db.applications.filter((a) => a.candidateId === c.id).map((a) => ({ ...a, job: db.jobs.find((j) => j.id === a.jobId) }));
    return delay({ candidate: candidateCard(c), milestones, sessions, applications: apps });
  },
  updateProgress: (candidateId, key, status) => { db.progress[candidateId] = db.progress[candidateId] || {}; db.progress[candidateId][key] = status; return delay({ candidateId, key, status }); },

  // HR
  hrDashboard: () => {
    const u = me(); const company = db.companies.find((co) => co.id === u.companyId);
    const employees = db.users.filter((x) => x.role === "candidate" && x.companyId === u.companyId);
    const cards = employees.map(candidateCard);
    const total = employees.length, placed = employees.filter((e) => e.status === "placed").length, active = employees.filter((e) => e.status === "active").length, atRisk = employees.filter((e) => e.status === "at_risk").length;
    const avgProgress = cards.length ? Math.round(cards.reduce((s, c) => s + c.progressPct, 0) / cards.length) : 0;
    return delay({ company, stats: { total, placed, active, atRisk, avgProgress, placementRate: total ? Math.round((placed / total) * 100) : 0 }, employees: cards });
  },
  hrPositions: () => { const u = me(); const company = db.companies.find((co) => co.id === u.companyId); return delay({ company, positions: db.jobs.filter((j) => j.companyId === u.companyId || j.company === company?.name) }); },
  hrCreatePosition: (b) => {
    const u = me(); const company = db.companies.find((co) => co.id === u.companyId);
    if (!b.title) return fail("Titolo obbligatorio");
    const job = { id: nid("job"), title: b.title, company: company?.name || "Azienda", location: b.location || "—", type: b.type || "Full-time", remote: b.remote || "Ibrido", salary: b.salary || "—", industry: b.industry || "—", seniority: b.seniority || "Mid", postedAt: today(), tags: Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",").map((t) => t.trim()).filter(Boolean), description: b.description || "", origin: "hr_upload", sourceId: null, companyId: u.companyId, status: "active", firstSeenAt: today(), lastSeenAt: today() };
    db.jobs.push(job); return delay(job);
  },
  hrUpdatePosition: (id, status) => { const u = me(); const job = db.jobs.find((j) => j.id === id && j.companyId === u.companyId); if (!job) return fail("Posizione non trovata"); job.status = status; if (status === "inactive") job.deactivatedAt = today(); return delay(job); },

  // ADMIN
  adminOverview: () => {
    const candidates = db.users.filter((u) => u.role === "candidate"), coaches = db.users.filter((u) => u.role === "coach");
    const placed = candidates.filter((c) => c.status === "placed").length;
    const byStatus = candidates.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
    const companyStats = db.companies.map((co) => { const emp = candidates.filter((c) => c.companyId === co.id); return { ...co, enrolled: emp.length, placed: emp.filter((c) => c.status === "placed").length }; });
    const coachLoad = coaches.map((co) => ({ id: co.id, name: co.name, avatar: co.avatar, caseload: candidates.filter((c) => c.coachId === co.id).length }));
    const mrr = db.subscriptions.filter((s) => s.status === "active").reduce((sum, s) => sum + (planById(s.planId)?.price || 0), 0);
    return delay({ stats: { companies: db.companies.length, candidates: candidates.length, coaches: coaches.length, placed, placementRate: candidates.length ? Math.round((placed / candidates.length) * 100) : 0, activePositions: db.jobs.filter((j) => j.status === "active").length, sources: db.sources.filter((s) => s.status === "active").length, mrr }, byStatus, companyStats, coachLoad });
  },
  adminUsers: () => delay(db.users.map((u) => {
    const s = u.role === "hr" ? findSub("company", u.companyId) : findSub("user", u.id);
    const plan = s ? planById(s.planId) : null;
    const subscription = s ? { status: s.status, plan: plan?.name || s.planId, planPrice: plan?.priceLabel || (plan?.price != null ? `€${plan.price}` : null), startedAt: s.startedAt, currentPeriodEnd: s.currentPeriodEnd, cancelAtPeriodEnd: s.cancelAtPeriodEnd, provider: s.provider, cardLast4: (s.card && s.card.last4) || null, voucherCode: s.voucherCode || null, discountPercent: s.discountPercent || null, freeUntil: s.freeUntil || null } : null;
    return { ...publicUser(u), companyName: db.companies.find((co) => co.id === u.companyId)?.name || null, blocked: mBlocked(u), acceptedTerms: !!u.acceptedTermsAt, subscription };
  })),
  adminBlockUser: (id, days) => {
    const me2 = me(); if (id === me2.id) return fail("Non puoi bloccare il tuo stesso account");
    const u = db.users.find((x) => x.id === id); if (!u) return fail("Utente non trovato");
    u.blockedUntil = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    u.status = u.blockedUntil ? "blocked" : "active";
    return delay({ ...publicUser(u), blocked: mBlocked(u) });
  },
  adminSetRole: (id, role, permissions) => {
    const me2 = me(); if (id === me2.id) return fail("Non puoi cambiare il ruolo del tuo stesso account");
    const u = db.users.find((x) => x.id === id); if (!u) return fail("Utente non trovato");
    const allowed = ["candidate", "coach", "hr", "referral", "staff"];
    if (!allowed.includes(role)) return fail("Ruolo non valido");
    const sections = ["overview", "companies", "sources", "positions", "matching", "users"];
    u.role = role;
    u.permissions = role === "staff" ? (permissions || []).filter((p) => sections.includes(p)) : [];
    return delay({ ...publicUser(u), blocked: mBlocked(u) });
  },
  adminDeleteUser: (id) => {
    const me2 = me(); if (id === me2.id) return fail("Non puoi cancellare il tuo stesso account");
    const u = db.users.find((x) => x.id === id); if (!u) return fail("Utente non trovato");
    db.applications = db.applications.filter((a) => a.candidateId !== id);
    db.sessions = db.sessions.filter((s) => s.candidateId !== id && s.coachId !== id);
    if (Array.isArray(db.progress)) db.progress = db.progress.filter((p) => p.userId !== id);
    else if (db.progress && db.progress[id]) delete db.progress[id];
    db.subscriptions = db.subscriptions.filter((s) => !(s.ownerType === "user" && s.ownerId === id));
    db.users.forEach((x) => { if (x.coachId === id) x.coachId = null; });
    db.users = db.users.filter((x) => x.id !== id);
    delete matchPrefs[id];
    return delay({ ok: true, deleted: id });
  },
  adminCompanies: () => delay(db.companies.map((co) => ({ ...co, enrolled: db.users.filter((u) => u.role === "candidate" && u.companyId === co.id).length, subscription: subView(findSub("company", co.id)) }))),
  adminCreateCompany: (b) => {
    if (!b.name) return fail("Nome obbligatorio");
    const logo = b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const co = { id: nid("co"), name: b.name, sector: b.sector || "—", city: b.city || "—", logo, plan: b.plan || "Starter", seatsTotal: b.seatsTotal || 10, activeSince: today(), careersUrl: b.careersUrl || "" };
    db.companies.push(co);
    if (b.careersUrl && b.createSource) db.sources.push({ id: nid("src"), type: "company_careers", name: `${co.name} — Carriere`, url: b.careersUrl, companyId: co.id, status: "active", createdAt: today(), frequencyHours: b.frequencyHours || 48, lastScanAt: null, nextScanAt: addHoursISO(b.frequencyHours || 48), lastScanFound: 0, region: "Italia" });
    return delay(co);
  },
  adminUpdateCompany: (id, b) => { const co = db.companies.find((c) => c.id === id); if (!co) return fail("Azienda non trovata"); ["name", "sector", "city", "careersUrl", "plan", "seatsTotal"].forEach((k) => { if (b[k] !== undefined) co[k] = b[k]; }); return delay(co); },
  adminSources: () => delay(db.sources.map((s) => ({ ...s, autoScan: s.autoScan !== false, companyName: db.companies.find((c) => c.id === s.companyId)?.name || null, connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector, activePositions: db.jobs.filter((j) => j.sourceId === s.id && j.status === "active").length }))),
  adminCreateSource: (b) => { if (!b.name || !b.url) return fail("Nome e URL obbligatori"); const s = { id: nid("src"), type: b.type || "portal", name: b.name, url: b.url, companyId: b.companyId || null, status: "active", createdAt: today(), frequencyHours: b.frequencyHours || 24, lastScanAt: null, nextScanAt: addHoursISO(b.frequencyHours || 24), lastScanFound: 0, region: b.region || "Italia", connector: b.connector || "simulated", autoScan: true, apiConfig: b.apiConfig || null }; db.sources.push(s); return delay(s); },
  adminUpdateSource: (id, b) => { const s = db.sources.find((x) => x.id === id); if (!s) return fail("Fonte non trovata"); ["status", "frequencyHours", "name", "url", "region", "connector", "autoScan"].forEach((k) => { if (b[k] !== undefined) s[k] = b[k]; }); if (s.status === "disabled") s.nextScanAt = null; else if (!s.nextScanAt) s.nextScanAt = addHoursISO(s.frequencyHours); return delay(s); },
  adminScheduler: () => { const now = Date.now(); const sources = db.sources.map((s) => ({ id: s.id, name: s.name, status: s.status, autoScan: s.autoScan !== false, connector: s.connector, connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector, frequencyHours: s.frequencyHours, lastScanAt: s.lastScanAt, nextScanAt: s.nextScanAt, due: s.status === "active" && s.autoScan !== false && (!s.nextScanAt || new Date(s.nextScanAt).getTime() <= now) })); return delay({ settings, sources, autoActive: sources.filter((s) => s.status === "active" && s.autoScan).length }); },
  adminUpdateScheduler: (b) => { if (b.schedulerEnabled !== undefined) settings.schedulerEnabled = !!b.schedulerEnabled; if (b.checkIntervalSec !== undefined) settings.checkIntervalSec = Math.max(10, parseInt(b.checkIntervalSec, 10) || 60); return delay(settings); },
  adminScanAll: () => { const active = db.sources.filter((s) => s.status === "active"); const results = active.map((s) => { const log = runScan(s); return { source: s.name, ...log }; }); return delay({ ran: results.length, results }); },
  adminGetConfig: () => {
    const cfg = settings.config || {};
    const masked = {
      smtpHost: cfg.smtpHost || "", smtpPort: cfg.smtpPort || "", smtpUser: cfg.smtpUser || "", smtpFrom: cfg.smtpFrom || "", smtpSecure: !!cfg.smtpSecure,
      llmProvider: cfg.llmProvider || "", llmBaseUrl: cfg.llmBaseUrl || "", llmModel: cfg.llmModel || "", frontendUrl: cfg.frontendUrl || "",
      dailyScanHour: cfg.dailyScanHour ?? "", emailSubject: cfg.emailSubject || "{count} nuove offerte per te oggi su digitalfa",
      emailBody: cfg.emailBody || "Ciao {name},\noggi ci sono {count} nuove offerte selezionate per il tuo profilo.\nVisita il tuo profilo: {link}\n\n— digitalfa",
      adzunaAppId: cfg.adzunaAppId || "", apifyActorId: cfg.apifyActorId || "", brightdataDatasetId: cfg.brightdataDatasetId || "",
      atsBoards: (cfg.atsBoards && typeof cfg.atsBoards === "object") ? cfg.atsBoards : { greenhouse: [], lever: [], smartrecruiters: [] },
      smtpPassSet: !!cfg.smtpPass, llmApiKeySet: !!cfg.llmApiKey, cronSecretSet: !!cfg.cronSecret,
      adzunaAppKeySet: !!cfg.adzunaAppKey, joobleApiKeySet: !!cfg.joobleApiKey,
      findworkApiKeySet: !!cfg.findworkApiKey, theirstackApiKeySet: !!cfg.theirstackApiKey, rapidapiKeySet: !!cfg.rapidapiKey,
      serpapiKeySet: !!cfg.serpapiKey, apifyTokenSet: !!cfg.apifyToken, brightdataApiKeySet: !!cfg.brightdataApiKey,
      scraperapiKeySet: !!cfg.scraperapiKey, scrapingbeeKeySet: !!cfg.scrapingbeeKey,
    };
    return delay({ config: masked, cronPath: "/api/scheduler/tick" });
  },
  adminSaveConfig: (patch) => {
    const cur = settings.config || {};
    const next = { ...cur };
    Object.entries(patch || {}).forEach(([k, v]) => { if (["smtpPass", "llmApiKey", "cronSecret", "adzunaAppKey", "joobleApiKey", "findworkApiKey", "theirstackApiKey", "rapidapiKey", "serpapiKey", "apifyToken", "brightdataApiKey", "scraperapiKey", "scrapingbeeKey"].includes(k) && (v === "" || v == null)) return; next[k] = v; });
    settings.config = next;
    return mockApi.adminGetConfig();
  },
  adminClearConfig: (keys) => {
    const cur = { ...(settings.config || {}) };
    (keys || []).forEach((k) => { delete cur[k]; });
    settings.config = cur;
    return mockApi.adminGetConfig();
  },
  adminTestEmail: (to) => delay({ ok: true, mode: (settings.config && settings.config.smtpHost) ? "inviata" : "simulata (SMTP non configurato)", to: to || me().email }),
  adminTestConnector: (connector) => {
    const cfg = settings.config || {};
    const need = { adzuna: cfg.adzunaAppId && cfg.adzunaAppKey, jooble: cfg.joobleApiKey, findwork: cfg.findworkApiKey, theirstack: cfg.theirstackApiKey, jsearch: cfg.rapidapiKey, serpapi: cfg.serpapiKey, apify: cfg.apifyToken, brightdata: cfg.brightdataApiKey };
    const ats = { greenhouse: (cfg.atsBoards && cfg.atsBoards.greenhouse) || [], lever: (cfg.atsBoards && cfg.atsBoards.lever) || [], smartrecruiters: (cfg.atsBoards && cfg.atsBoards.smartrecruiters) || [] };
    const free = ["arbeitnow", "remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur"];
    if (free.includes(connector)) return delay({ ok: true, message: "OK · connessione riuscita (demo)." });
    if (connector in ats) return delay(ats[connector].length ? { ok: true, message: `OK · ${ats[connector].length} board configurati (demo).` } : { ok: false, message: "Nessun board configurato." });
    if (connector in need) return delay(need[connector] ? { ok: true, message: "OK · connessione riuscita (demo)." } : { ok: false, message: "Chiave non impostata." });
    return fail("Connettore non riconosciuto");
  },
  adminCandidateActivity: () => {
    const TH = 45;
    const jobs = db.jobs.filter((j) => j.status === "active");
    const cands = db.users.filter((u) => u.role === "candidate");
    const rows = cands.map((c) => {
      const w = effW(c.id);
      let high = 0, mid = 0, matched = 0, best = 0;
      jobs.forEach((j) => { const s = mCompute(c, j, w).score; if (s >= TH) { matched++; s >= 75 ? high++ : mid++; } if (s > best) best = s; });
      const applications = db.applications.filter((a) => a.candidateId === c.id).length;
      return { id: c.id, name: c.name, email: c.email, onboarded: !!c.onboarded, cvUploaded: !!c.cvUploadedAt, matched, high, mid, bestMatch: best, applications };
    }).sort((a, b) => b.matched - a.matched);
    return delay({ candidates: rows, threshold: TH, totalActiveJobs: jobs.length, scanHistory: settings.scanHistory || [] });
  },
  adminCandidateActivityDetail: (id) => {
    const TH = 45;
    const c = db.users.find((u) => u.id === id); if (!c) return fail("Candidato non trovato");
    const w = effW(c.id);
    const applied = new Set(db.applications.filter((a) => a.candidateId === id).map((a) => a.jobId));
    const offers = db.jobs.filter((j) => j.status === "active").map((j) => ({ id: j.id, title: j.title, company: j.company, location: j.location, firstSeenAt: j.firstSeenAt, match: mCompute(c, j, w).score, applied: applied.has(j.id), source: sourceName(j.sourceId) || "Motore" })).filter((o) => o.match >= TH).sort((a, b) => b.match - a.match);
    const dayMap = {};
    offers.forEach((o) => { const d = (o.firstSeenAt || "").slice(0, 10) || "—"; (dayMap[d] ||= { date: d, matched: 0, applied: 0 }); dayMap[d].matched++; if (o.applied) dayMap[d].applied++; });
    const byDay = Object.values(dayMap).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 21);
    return delay({ candidate: { id: c.id, name: c.name, email: c.email, onboarded: !!c.onboarded, cvUploaded: !!c.cvUploadedAt, desiredTitles: c.desiredTitles || [] }, offers, byDay, threshold: TH, applications: applied.size });
  },
  adminCandidateScanInfo: () => {
    const last = settings.lastDailyScanInfo || {};
    const perLast = last.perSource || {};
    const cfg = settings.config || {};
    const KEY_OF = { adzuna: "adzunaAppKey", jooble: "joobleApiKey", findwork: "findworkApiKey", theirstack: "theirstackApiKey", jsearch: "rapidapiKey", serpapi: "serpapiKey", apify: "apifyToken", brightdata: "brightdataApiKey" };
    const LABELS = { adzuna: "Adzuna", jooble: "Jooble", arbeitnow: "Arbeitnow", remotive: "Remotive", remoteok: "RemoteOK", jobicy: "Jobicy", jobdataapi: "jobdataapi", arbeitsagentur: "Arbeitsagentur", findwork: "Findwork", theirstack: "TheirStack", jsearch: "JSearch", serpapi: "SerpApi (Google Jobs)", apify: "Apify", greenhouse: "Greenhouse", lever: "Lever", smartrecruiters: "SmartRecruiters", brightdata: "Bright Data" };
    const ATS = new Set(["greenhouse", "lever", "smartrecruiters"]);
    const boards = (cfg.atsBoards && typeof cfg.atsBoards === "object") ? cfg.atsBoards : {};
    const ORDER = ["serpapi", "adzuna", "jooble", "apify", "jsearch", "arbeitnow", "remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur", "findwork", "theirstack", "greenhouse", "lever", "smartrecruiters", "brightdata"];
    const sources = ORDER.map((s) => {
      const keyName = KEY_OF[s]; const keyed = !!keyName; const hasKey = keyed ? !!cfg[keyName] : true;
      const isAts = ATS.has(s); const nb = isAts ? ((boards[s] || []).length) : null; const hasBoards = isAts ? nb > 0 : true;
      let status = "attiva"; if (keyed && !hasKey) status = "chiave mancante"; else if (isAts && !hasBoards) status = "board mancanti";
      const p = perLast[s] || null;
      return { id: s, name: LABELS[s], keyed, hasKey, ats: isAts, boards: nb, status, lastQueries: p ? p.q : null, lastFetched: p ? p.fetched : null, lastCreated: p ? p.created : null };
    });
    const poolTotal = db.jobs.filter((j) => j.status === "active").length;
    const poolToday = db.jobs.filter((j) => j.status === "active" && j.firstSeenAt === today()).length;
    return delay({ lastDate: settings.lastDailyScanDate || null, emailConfigured: false, last, sources, poolTotal, poolToday });
  },
  adminCandidateScanRun: () => {
    const cands = db.users.filter((u) => u.role === "candidate" && u.onboarded);
    // demo: simula qualche nuova offerta e "email" ai candidati con match
    let created = 0;
    cands.slice(0, 2).forEach((c, i) => { const t = (c.desiredTitles && c.desiredTitles[0]) || c.title; const pool = NEW_JOB_POOL[i % NEW_JOB_POOL.length]; if (!mHasDup(t, pool.company)) { db.jobs.push({ id: nid("job"), title: t, company: pool.company, location: (c.preferredLocations && c.preferredLocations[0]) || "Milano", type: "Full-time", remote: "Ibrido", salary: "n.d.", industry: pool.industry, seniority: c.seniority || "Mid", postedAt: today(), tags: pool.tags, description: `Nuova offerta per «${t}».`, origin: "scan", sourceId: null, status: "active", firstSeenAt: today(), lastSeenAt: today(), externalId: nid("ext"), dedupKey: mDedup(t, pool.company) }); created++; } });
    const q = Math.max(1, cands.length) * 3;
    const perSource = {
      remotive: { q, fetched: 54, created, status: "ok" },
      remoteok: { q, fetched: 9, created: 0, status: "ok" },
      jobicy: { q, fetched: 214, created: 0, status: "ok" },
      jobdataapi: { q, fetched: 3, created: 0, status: "ok" },
      arbeitsagentur: { q, fetched: 1, created: 0, status: "ok" },
    };
    const info = { candidates: cands.length, queries: q * 2, fetched: 281, created, emailed: created, matchedTotal: created, email: "simulata", modes: ["demo: scansione simulata nel browser"], perSource, at: new Date().toISOString() };
    settings.lastDailyScanDate = today(); settings.lastDailyScanInfo = info;
    const d = today(); settings.scanHistory = [{ date: d, perSource, created, fetched: created, candidates: cands.length, emailed: created }, ...(settings.scanHistory || []).filter((h) => h.date !== d)].slice(0, 30);
    return delay({ ok: true, ...info });
  },
  adminScan: (id) => { const s = db.sources.find((x) => x.id === id); if (!s) return fail("Fonte non trovata"); if (s.status !== "active") return fail("La fonte è disattivata"); const log = runScan(s); log.mode = `simulato nel browser · connettore: ${CONNECTOR_LABELS[s.connector] || s.connector}`; return delay({ log, source: { ...s, connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector, companyName: db.companies.find((c) => c.id === s.companyId)?.name || null } }); },
  adminTestSource: (id) => { const s = db.sources.find((x) => x.id === id); if (!s) return fail("Fonte non trovata"); const sample = NEW_JOB_POOL.slice(0, 3).map((t) => ({ title: t.title, company: t.company, location: t.location })); return delay({ mode: `${CONNECTOR_LABELS[s.connector] || s.connector} · demo (nel prototipo completo la chiamata è reale)`, full: s.connector !== "simulated", count: sample.length + 2, sample }); },
  adminScanLogs: () => delay(db.scanLogs.slice(0, 40).map((l) => ({ ...l, sourceName: l.label || sourceName(l.sourceId) || "—" }))),
  adminPositions: (status) => {
    let list = db.jobs.map((j) => ({ ...j, sourceName: sourceName(j.sourceId) || mSourceLabel(j), simulated: mIsSim(j) }));
    if (status) list = list.filter((j) => j.status === status);
    list.sort((a, b) => (a.status === b.status ? new Date(b.lastSeenAt) - new Date(a.lastSeenAt) : a.status === "active" ? -1 : 1));
    return delay({ positions: list, counts: { active: db.jobs.filter((j) => j.status === "active").length, inactive: db.jobs.filter((j) => j.status === "inactive").length } });
  },
  adminUpdatePosition: (id, status) => { const job = db.jobs.find((j) => j.id === id); if (!job) return fail("Posizione non trovata"); job.status = status; if (status === "inactive") job.deactivatedAt = today(); else job.lastSeenAt = today(); return delay({ ...job, sourceName: sourceName(job.sourceId) || mSourceLabel(job) }); },
  adminForwardPosition: (id, to, fromName) => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to || ""))) return fail("Inserisci un'email valida."); return delay({ ok: true, sent: !!(settings.config && settings.config.smtpHost), to }); },
  adminPurgeJobs: () => {
    const before = db.jobs.length;
    const keep = db.jobs.filter((j) => !mIsSim(j));
    const removedIds = new Set(db.jobs.filter((j) => mIsSim(j)).map((j) => j.id));
    db.jobs = keep;
    db.applications = db.applications.filter((a) => !removedIds.has(a.jobId));
    return delay({ ok: true, deleted: before - db.jobs.length, remaining: db.jobs.length });
  },
  adminPurgeScanLogs: () => { const before = db.scanLogs.length; db.scanLogs = db.scanLogs.filter((l) => { const s = db.sources.find((x) => x.id === l.sourceId); return !(s && ["simulated", "linkedin", "indeed"].includes(s.connector)); }); return delay({ ok: true, deleted: before - db.scanLogs.length }); },
  accountUpdateProfile: (body) => { const u = me(); if (body.name && body.name.trim()) u.name = body.name.trim(); if (body.phone != null) u.phone = String(body.phone); if (body.linkedinUrl != null) u.linkedinUrl = String(body.linkedinUrl).trim() || null; return delay({ ok: true, user: publicUser(u) }); },
  accountChangePassword: (current, next) => { const u = me(); if (!next || next.length < 6) return fail("La nuova password deve avere almeno 6 caratteri."); if (u.password && current !== u.password) return fail("La password attuale non è corretta."); u.password = next; return delay({ ok: true }); },
  coachApply: (body) => { const u = me(); const now = new Date().toISOString(); (db.coachApplications ||= []).unshift({ id: nid("coachapp"), name: body.name || u.name, email: body.email || u.email, phone: body.phone || null, linkedin: body.linkedin || null, message: body.message || null, userId: u.id, createdAt: now, emailed: false }); return delay({ ok: true, emailed: false, inbox: "extremedigitalfa@gmail.com" }); },
  adminCoachApplications: () => delay({ applications: db.coachApplications || [], inbox: "extremedigitalfa@gmail.com" }),
  adminCommunications: () => delay({ communications: mGetComms(), triggerTypes: MOCK_TRIGGER_TYPES, emailConfigured: !!(settings.config && settings.config.smtpHost) }),
  adminCommTest: (key, to) => { const c = mGetComm(key); if (!c) return fail("Comunicazione non trovata"); return delay({ ok: true, mode: (settings.config && settings.config.smtpHost) ? "inviata" : "simulata (SMTP non configurato)", to: to || me().email }); },
  jobAddManual: (url) => {
    const u = me();
    if (!/^https?:\/\//i.test(String(url || ""))) return fail("Incolla un link valido (https://…).");
    const host = (String(url).match(/^https?:\/\/([^/]+)/i) || [])[1]?.replace(/^www\./, "") || "—";
    const d = today();
    const job = { id: nid("job"), title: "Offerta aggiunta manualmente", company: host, location: "—", type: "—", remote: "—", salary: "n.d.", industry: "—", seniority: "—", postedAt: d, tags: [], description: "", origin: "manual", sourceId: null, ownerUserId: u.id, status: "active", firstSeenAt: d, lastSeenAt: d, externalId: `manual:${u.id}:${Date.now()}`, dedupKey: mDedup("Offerta aggiunta manualmente", host), url };
    db.jobs.unshift(job);
    return delay({ ok: true, job: { id: job.id, title: job.title, company: job.company, url, match: 60 } });
  },
  jobShare: (id, to) => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to || ""))) return fail("Inserisci un indirizzo email valido."); return delay({ ok: true, sent: !!(settings.config && settings.config.smtpHost), to }); },
  referralInfo: () => {
    const u = me(); if (!u.referralCode) u.referralCode = "R" + Math.random().toString(36).slice(2, 8).toUpperCase();
    db.referrals ||= [];
    const invites = db.referrals.filter((r) => r.referrerId === u.id).sort((a, b) => (a.invitedAt < b.invitedAt ? 1 : -1));
    const rewarded = invites.filter((r) => r.status === "rewarded").length;
    return delay({ code: u.referralCode, link: `${location.origin}/#/login?ref=${u.referralCode}`, invites, rewardWeeks: rewarded * 2, rewardDays: 14 });
  },
  referralInvite: (email) => {
    const u = me(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""))) return fail("Inserisci un'email valida.");
    if (!u.referralCode) u.referralCode = "R" + Math.random().toString(36).slice(2, 8).toUpperCase();
    db.referrals ||= [];
    db.referrals.unshift({ id: nid("ref"), referrerId: u.id, code: u.referralCode, email: String(email).toLowerCase(), status: "invited", invitedAt: new Date().toISOString(), referredUserId: null });
    return delay({ ok: true, sent: !!(settings.config && settings.config.smtpHost), email });
  },
  jobAutoApply: (id, submit) => {
    const u = me(); const job = db.jobs.find((j) => j.id === id) || {};
    if (!job.url) return delay({ status: "manual", mode: "manuale", reasons: ["Nessun link di candidatura salvato per questa offerta."], fields: [], questions: [], submitted: false });
    const parts = String(u.name || "").trim().split(/\s+/);
    const fields = [
      { key: "first_name", label: "Nome", value: parts[0] || "" },
      { key: "last_name", label: "Cognome", value: parts.slice(1).join(" ") || "" },
      { key: "email", label: "Email", value: u.email || "" },
      { key: "phone", label: "Telefono", value: u.phone || "" },
    ].filter((f) => f.value);
    const questions = (db.answers || []).filter((a) => a.userId === u.id).slice(0, 2).map((a) => ({ q: a.question, a: a.answer }));
    // Demo: nel browser non c'è un vero form → esito "assistita".
    return delay({ status: "assisted", mode: "assistita", reasons: ["Demo: qui il server leggerebbe il form reale e compilerebbe i campi. Copia i dati e invia dal sito, oppure attiva Playwright/ScraperAPI in produzione.", `${fields.length} campi pronti.`], fields, questions, submitted: false });
  },
  answersList: () => delay({ answers: (db.answers || []).filter((a) => a.userId === me().id).sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1)) }),
  answerSave: (body) => {
    const u = me(); const now = new Date().toISOString(); db.answers ||= [];
    if (!String(body.question || "").trim()) return fail("La domanda è obbligatoria.");
    if (body.id) { const a = db.answers.find((x) => x.id === body.id && x.userId === u.id); if (!a) return fail("Risposta non trovata"); a.question = body.question; a.answer = body.answer || ""; a.updatedAt = now; return delay({ answer: a }); }
    const a = { id: nid("ans"), userId: u.id, question: body.question.trim(), answer: body.answer || "", createdAt: now, updatedAt: now }; db.answers.unshift(a); return delay({ answer: a });
  },
  answerDelete: (id) => { db.answers = (db.answers || []).filter((a) => !(a.id === id && a.userId === me().id)); return delay({ ok: true }); },
  answerGenerate: (question) => { const u = me(); return delay({ ai: false, answer: `In base alla mia esperienza come ${(u.desiredTitles || [u.title])[0] || "professionista"}, ritengo di essere una buona candidatura. (Demo: con una chiave LLM la risposta a «${question}» sarebbe generata su misura dal tuo profilo/CV.)` }); },
  jobApplyKit: (id) => {
    const u = me(); const job = db.jobs.find((j) => j.id === id) || {};
    const parts = String(u.name || "").trim().split(/\s+/);
    const fields = [
      { key: "first_name", label: "Nome", value: parts[0] || "" },
      { key: "last_name", label: "Cognome", value: parts.slice(1).join(" ") || "" },
      { key: "email", label: "Email", value: u.email || "" },
      { key: "phone", label: "Telefono", value: u.phone || "" },
      { key: "location", label: "Località", value: u.location || "" },
      { key: "current_title", label: "Ruolo attuale/target", value: (u.desiredTitles || [u.title])[0] || "" },
    ].filter((f) => f.value);
    return delay({ fields, savedAnswers: (db.answers || []).filter((a) => a.userId === u.id), url: job.url || null, cvReady: !!u.cvFileName });
  },
  resourcesVideos: () => delay({ videos: [
    { id: "rrkrvAUbU9Y", title: "La motivazione che ti serve nella ricerca del lavoro", desc: "Dan Pink — cosa ci spinge davvero." },
    { id: "H14bBuluwB8", title: "Grit: costanza e determinazione", desc: "Angela Lee Duckworth." },
    { id: "Ks-_Mh1QhMc", title: "Il linguaggio del corpo ai colloqui", desc: "Amy Cuddy." },
    { id: "qp0HIF3SfI4", title: "Parti dal «perché»: racconta il tuo valore", desc: "Simon Sinek." },
  ] }),
  adminSetPassword: (id, password) => { const u = db.users.find((x) => x.id === id); if (!u) return fail("Utente non trovato"); if (!password || password.length < 6) return fail("La password deve avere almeno 6 caratteri."); u.password = password; return delay({ ok: true, email: u.email }); },
};

// Etichetta fonte (demo) dedotta dall'externalId, come sul server.
function mSourceLabel(j) {
  const ext = String(j.externalId || ""); const pfx = ext.includes(":") ? ext.slice(0, ext.indexOf(":")) : "";
  const M = { remotive: "Remotive", remoteok: "RemoteOK", jobicy: "Jobicy", jobdata: "jobdataapi", arbeitsagentur: "Arbeitsagentur", findwork: "Findwork", theirstack: "TheirStack", jsearch: "JSearch" };
  if (M[pfx]) return M[pfx];
  if (/^[a-z]{2}$/.test(pfx)) return "Adzuna";
  if (ext.startsWith("sim-")) return "Simulato";
  if (/^(li|in)-/.test(ext)) return "Demo";
  if (j.origin === "hr_upload") return "Caricata da HR";
  return "Motore";
}
function mIsSim(j) {
  const ext = String(j.externalId || "");
  if (ext.startsWith("sim-")) return true;
  if (/^(li|in)-\d/.test(ext)) return true;
  if (j.origin === "hr_upload") return true;
  if (j.sourceId) return true;
  if (/simulat/i.test(String(j.description || ""))) return true;
  return false;
}
