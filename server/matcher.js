// Matcher — transparent, explainable job↔candidate scoring.
// The overall score is a WEIGHTED AVERAGE of 5 dimensions, each 0–100.
// Weights can be global (defaults below) or overridden PER CANDIDATE.
// computeMatch returns the score AND a full breakdown, so both the admin
// (methodology view) and the candidate ("perché questo punteggio?") can see
// exactly how it was built. Pure functions → also reused by the daily matcher.

export const DIMENSIONS = [
  { key: "role", label: "Ruolo / titolo", desc: "Quanto il titolo dell'offerta combacia con il ruolo e le parole chiave del candidato." },
  { key: "skills", label: "Competenze", desc: "Sovrapposizione tra le competenze del candidato e quelle richieste dall'offerta." },
  { key: "location", label: "Località", desc: "Vicinanza tra la sede dell'offerta e la città del candidato (o lavoro da remoto)." },
  { key: "seniority", label: "Seniority", desc: "Coerenza tra il livello del candidato e quello della posizione." },
  { key: "industry", label: "Settore", desc: "Affinità tra il settore del candidato e quello dell'offerta." },
];

export const DEFAULT_WEIGHTS = { role: 30, skills: 30, location: 15, seniority: 15, industry: 10 };

export const METHODOLOGY = [
  "Ogni offerta viene confrontata col profilo del candidato su 5 dimensioni.",
  "Ogni dimensione riceve un sotto-punteggio da 0 a 100.",
  "Il punteggio finale è la media dei sotto-punteggi, pesata secondo i pesi qui a fianco.",
  "I pesi possono essere personalizzati dal singolo candidato: le sue modifiche valgono solo per lui.",
  "Il candidato può contestare un punteggio: il feedback sposta leggermente i suoi pesi personali.",
];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9àèéìòù+#. ]/gi, " ").split(/\s+/).filter((w) => w.length > 2);
const uniq = (a) => [...new Set(a)];

// Generic role words that must NOT, on their own, make two titles "match":
// "Marketing Manager" vs "Project Manager" share only "manager".
const GENERIC = new Set([
  "manager", "senior", "junior", "lead", "principal", "staff", "specialist", "responsabile",
  "addetto", "addetta", "impiegato", "impiegata", "assistant", "assistente", "associate", "executive",
  "head", "director", "direttore", "officer", "coordinatore", "coordinator", "operatore", "operator",
  "tecnico", "technician", "consultant", "consulente", "stage", "intern", "trainee", "apprendista",
  "full", "part", "time", "remote", "smart", "working", "the", "and", "con", "per", "del", "della",
]);
const meaningful = (tokens) => tokens.filter((t) => !GENERIC.has(t));

// Sinonimi/traduzioni per i ruoli più comuni: normalizzano IT↔EN allo stesso token.
const SYN = {
  sviluppatore: "developer", sviluppatrice: "developer", programmatore: "developer", programmatrice: "developer", dev: "developer",
  commerciale: "sales", vendite: "sales", venditore: "sales", venditrice: "sales", account: "sales",
  contabile: "accounting", contabilita: "accounting", amministrativo: "accounting", amministrativa: "accounting",
  magazziniere: "warehouse", magazzino: "warehouse", logistica: "logistics",
  infermiere: "nurse", infermiera: "nurse", progettista: "engineer", ingegnere: "engineer", ingegnera: "engineer",
  informatico: "it", informatica: "it", sistemista: "sysadmin", grafico: "designer", grafica: "designer",
  marketing: "marketing", vendita: "sales", risorse: "hr", personale: "hr", recruiter: "hr", selezione: "hr",
  cameriere: "waiter", cuoco: "chef", commessa: "retail", commesso: "retail", negozio: "retail",
};
// Normalizza un token: sinonimo/traduzione + singolare (toglie la 's' finale).
// NIENTE match per prefisso: "operations" e "operator" NON devono combaciare.
const stem = (t) => { const c = SYN[t] || t; return (c.length > 4 && c.endsWith("s")) ? c.slice(0, -1) : c; };
const tokMatch = (x, y) => stem(x) === stem(y);

function overlapPct(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const b = new Set(bTokens);
  const hits = uniq(aTokens).filter((t) => b.has(t)).length;
  // ratio of candidate tokens found in the job, capped and smoothed
  return Math.min(100, Math.round((hits / Math.min(aTokens.length, 8)) * 100));
}

// Similarity between ONE desired title and the job title, driven by the
// DISTINCTIVE words (a shared "manager"/"senior" alone is near-zero).
function titleSim(desiredTitle, jobTitle) {
  const a = norm(desiredTitle), b = norm(jobTitle);
  if (!a.length || !b.length) return 0;
  const ma = meaningful(a);
  if (ma.length) {
    const mMatched = ma.filter((t) => b.some((bt) => tokMatch(t, bt)));
    if (mMatched.length === 0) return 8;                       // nessuna parola distintiva in comune
    return Math.round(Math.min(100, (mMatched.length / ma.length) * 100));
  }
  const matched = a.filter((t) => b.some((bt) => tokMatch(t, bt)));
  return Math.round((matched.length / a.length) * 100);        // titolo tutto generico → overlap semplice
}
// Classifica un'offerta in base a QUANTO il titolo combacia col RUOLO cercato.
// Usa le parole PIENE del ruolo (es. "Head of Operations" = {head, operations},
// NON solo "operations"), così un semplice "Operations Manager" NON è "esatto".
//   "exact"   → il titolo contiene TUTTE le parole del ruolo e nessuna parola
//               distintiva in più (le parole generiche come senior/junior sono ignorate)
//   "related" → condivide una parola distintiva del ruolo e al massimo ne manca una
//   "other"   → nessun legame reale col ruolo (è emersa da skill/settore/ecc.)
// Ritorna il livello MIGLIORE tra tutti i titoli desiderati.
export function titleTier(desiredTitles, jobTitle) {
  const titles = (desiredTitles || []).filter(Boolean);
  if (!titles.length) return "other";
  const jFull = new Set(norm(jobTitle).map(stem));                 // tutte le parole del titolo offerta
  const jCore = new Set(meaningful(norm(jobTitle)).map(stem));      // solo le distintive
  let best = "other";
  for (const t of titles) {
    const rFull = norm(t).map(stem);
    if (!rFull.length) continue;
    const rSet = new Set(rFull);
    const rCore = new Set(meaningful(norm(t)).map(stem));
    const coreRef = rCore.size ? rCore : rSet;                      // ruolo tutto generico → usa le piene
    const missing = [...rSet].filter((x) => !jFull.has(x));         // parole del ruolo assenti dal titolo
    const extraCore = [...jCore].filter((x) => !rSet.has(x));       // parole distintive in più nel titolo
    const shareCore = [...coreRef].some((x) => jFull.has(x));       // almeno una parola distintiva in comune
    let tier = "other";
    if (missing.length === 0 && extraCore.length === 0) tier = "exact";
    else if (shareCore && missing.length <= 1) tier = "related";
    if (tier === "exact") return "exact";
    if (tier === "related") best = "related";
  }
  return best;
}

const PLACEHOLDER_TITLE = /in cerca di lavoro|candidat|—/i;
// Best match of the job title across the candidate's desired titles.
// Fallback chain: desiredTitles → title → skills (as pseudo-titles). No signal → low.
function roleScore(cand, job) {
  const titles = (cand.desiredTitles && cand.desiredTitles.length)
    ? cand.desiredTitles
    : (cand.title && !PLACEHOLDER_TITLE.test(cand.title) ? [cand.title] : []);
  if (titles.length) return titles.reduce((best, t) => Math.max(best, titleSim(t, job.title || "")), 0);
  // No explicit role → try the candidate's skills against the job title/tags.
  const cs = meaningful(norm((cand.skills || []).join(" ")));
  if (cs.length) {
    const jTokens = new Set(norm((job.title || "") + " " + (job.tags || []).join(" ")));
    const hits = cs.filter((t) => jTokens.has(t)).length;
    return hits > 0 ? Math.min(100, Math.round((hits / Math.min(cs.length, 6)) * 100)) : 12;
  }
  return 20; // nessun segnale sul ruolo → punteggio basso (non far passare tutto)
}

const SENIORITY_ORDER = ["junior", "mid", "senior", "manager"];
function seniorityScore(cand, job) {
  const c = SENIORITY_ORDER.indexOf(String(cand.seniority || "").toLowerCase());
  const j = SENIORITY_ORDER.indexOf(String(job.seniority || "").toLowerCase());
  if (c < 0 || j < 0) return 60;                 // unknown → neutral
  const dist = Math.abs(c - j);
  return dist === 0 ? 100 : dist === 1 ? 70 : dist === 2 ? 40 : 20;
}
function locationScore(cand, job) {
  const jl = String(job.location || "").toLowerCase();
  const jobRemote = (job.remote || "").toLowerCase().includes("remot") || /remot|smart\s*work/.test(jl);
  // Modalità di lavoro preferite (separate dal luogo).
  const modes = (cand.workModes || []).map((m) => String(m).toLowerCase());
  const wantsRemote = modes.includes("remoto");
  const wantsOnsite = modes.includes("onsite") || modes.includes("ibrido");
  // DOVE: le località scelte (non la residenza).
  const prefs = (cand.preferredLocations && cand.preferredLocations.length)
    ? cand.preferredLocations
    : (cand.location ? [cand.location] : []);
  const norm = prefs.map((p) => String(p).toLowerCase());
  // Match città/regione specifica.
  let cityHit = false;
  for (const p of norm) {
    const city = p.replace(/\(.*\)/, "").trim();
    if (city && !/italia|europa|mondo/.test(city) && jl && jl.includes(city)) { cityHit = true; break; }
  }
  const broad = norm.some((p) => /italia|europa|mondo/.test(p));
  if (cityHit) return 100;                                      // sede esatta desiderata
  if (wantsRemote && jobRemote) return 95;                      // vuole remoto e l'offerta è remota
  if (!norm.length && !modes.length) return 55;                 // nessuna preferenza → neutro
  if (jobRemote && (wantsRemote || !wantsOnsite)) return 82;    // remoto accettabile
  if (broad) return 72;                                         // area ampia (Italia/Europa/Mondo)
  if (wantsOnsite && jobRemote && !wantsRemote) return 45;      // vuole la sede ma l'offerta è solo remota
  if (jl && norm.length) return 40;                             // città diversa da quelle scelte
  return 50;
}
function industryScore(cand, job) {
  const ci = String(cand.industry || "").toLowerCase();
  const ji = String(job.industry || "").toLowerCase();
  if (!ci || ci === "—" || !ji) return 55;
  if (ci === ji) return 100;
  if (ji.includes(ci) || ci.includes(ji)) return 75;
  return 35;
}

export function subScores(candidate, job) {
  const candSkills = meaningful(norm((candidate.skills || []).join(" ")));
  const jobSkills = meaningful(norm((job.tags || []).join(" ") + " " + (job.title || "")));
  return {
    role: roleScore(candidate, job),
    skills: overlapPct(candSkills, jobSkills),
    location: locationScore(candidate, job),
    seniority: seniorityScore(candidate, job),
    industry: industryScore(candidate, job),
  };
}

export function normalizeWeights(w) {
  const base = { ...DEFAULT_WEIGHTS, ...(w || {}) };
  const total = DIMENSIONS.reduce((s, d) => s + (Number(base[d.key]) || 0), 0) || 1;
  const out = {};
  DIMENSIONS.forEach((d) => (out[d.key] = (Number(base[d.key]) || 0) / total)); // fractions summing to 1
  return out;
}

// Full explainable result.
export function computeMatch(candidate, job, weights) {
  const subs = subScores(candidate, job);
  const wf = normalizeWeights(weights);
  const breakdown = DIMENSIONS.map((d) => {
    const subscore = subs[d.key];
    const weightPct = Math.round(wf[d.key] * 100);
    const contribution = Math.round(subscore * wf[d.key]); // points this dimension adds to the total
    return { key: d.key, label: d.label, desc: d.desc, weight: weightPct, subscore, contribution };
  });
  let score = Math.round(breakdown.reduce((s, b) => s + b.subscore * wf[b.key], 0));
  // "Cancello" sul ruolo: se il titolo non c'entra col ruolo cercato, l'offerta
  // non può essere un buon match, per quanto combacino gli altri fattori.
  if (subs.role < 15) score = Math.min(score, 30);
  return { score, breakdown };
}

// Feedback nudge: adjust THIS candidate's weights based on their verdict on one
// offer. "too_high" → lower the weight of the dimension that contributed most
// to that offer; "too_low" → raise it. Returns new (un-normalized) weights.
export function nudgeWeights(currentWeights, breakdown, verdict, step = 6) {
  const w = { ...DEFAULT_WEIGHTS, ...(currentWeights || {}) };
  if (verdict === "good" || !Array.isArray(breakdown) || !breakdown.length) return w;
  const top = [...breakdown].sort((a, b) => b.contribution - a.contribution)[0];
  if (!top) return w;
  const delta = verdict === "too_high" ? -step : verdict === "too_low" ? step : 0;
  w[top.key] = Math.max(5, Math.min(60, (Number(w[top.key]) || 0) + delta));
  return w;
}
