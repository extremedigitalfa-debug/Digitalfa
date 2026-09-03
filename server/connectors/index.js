// Job-source connectors. Each connector fetches offers from a source and
// returns a NORMALISED list plus metadata the scan engine uses to reconcile.
//
//   connector(source) -> { jobs: NormalisedJob[], mode: string, full: boolean }
//
//   NormalisedJob = { externalId, title, company, location, type, remote,
//                     salary, industry, seniority, postedAt, tags, description }
//
// `full: true`  → the connector returned the COMPLETE current listing, so the
//                 engine can deactivate offers that disappeared (real APIs).
// `full: false` → a partial/simulated feed; the engine won't archive by absence.

const todayStr = () => new Date().toISOString().slice(0, 10);

function stripHtml(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
const truncate = (s, n = 180) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function inferIndustry(tags = [], title = "") {
  const t = (tags.join(" ") + " " + title).toLowerCase();
  if (/(dev|engineer|software|react|java|python|it|data|cloud|frontend|backend)/.test(t)) return "Tech";
  if (/(market|seo|brand|growth|content)/.test(t)) return "Marketing";
  if (/(sales|account|business development)/.test(t)) return "Sales";
  if (/(hr|people|recruit|talent)/.test(t)) return "HR";
  if (/(finance|account|controll)/.test(t)) return "Finance";
  if (/(supply|logisti|operation|warehouse)/.test(t)) return "Operations";
  return "Altro";
}
function inferSeniority(title = "") {
  const t = title.toLowerCase();
  if (/(head|director|lead|manager|chief|vp)/.test(t)) return "Manager";
  if (/(senior|sr\.|principal|staff)/.test(t)) return "Senior";
  if (/(junior|jr\.|intern|stage|graduate)/.test(t)) return "Junior";
  return "Mid";
}

// ---- Simulated connector (no external calls) ----
const POOL = [
  { title: "Growth Marketing Lead", company: "Scalr", location: "Milano", remote: "Remoto", industry: "Marketing", seniority: "Manager", salary: "58-72", tags: ["Digital marketing", "Analytics", "Growth"] },
  { title: "Data Analyst", company: "Insightly", location: "Milano", remote: "Ibrido", industry: "Tech", seniority: "Mid", salary: "40-50", tags: ["SQL", "Analytics", "Python"] },
  { title: "HR Business Partner", company: "PeopleFirst", location: "Torino", remote: "Ibrido", industry: "HR", seniority: "Manager", salary: "45-55", tags: ["People management", "HR"] },
  { title: "Customer Success Manager", company: "Retain", location: "Bologna", remote: "Remoto", industry: "Sales", seniority: "Mid", salary: "38-48", tags: ["CRM", "Customer success"] },
  { title: "DevOps Engineer", company: "Cloudnine", location: "Milano", remote: "Remoto", industry: "Tech", seniority: "Senior", salary: "55-68", tags: ["AWS", "CI/CD", "Kubernetes"] },
];
export function simulatedConnector(source) {
  const jobs = [];
  if (Math.random() < 0.75) {
    const t = POOL[Math.floor(Math.random() * POOL.length)];
    jobs.push({ ...t, externalId: `sim-${source.id}-${Date.now()}`, type: "Full-time", postedAt: todayStr(), description: `Rilevata dalla scansione simulata di ${source.name}.` });
  }
  return { jobs, mode: "simulato", full: false };
}

// ---- Arbeitnow (real public API, no key) ----
export async function arbeitnowConnector(source) {
  const limit = source.apiConfig?.limit || 15;
  const res = await fetch(source.url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = (body.data || []).slice(0, limit);
  const jobs = rows.map((r) => {
    const tags = [...(r.tags || []), ...(r.job_types || [])].slice(0, 6);
    return {
      externalId: r.slug,
      title: r.title,
      company: r.company_name,
      location: r.location || "—",
      type: (r.job_types && r.job_types[0]) || "Full-time",
      remote: r.remote ? "Remoto" : "In sede",
      salary: "n.d.",
      industry: inferIndustry(tags, r.title),
      seniority: inferSeniority(r.title),
      postedAt: r.created_at ? new Date(r.created_at * 1000).toISOString().slice(0, 10) : todayStr(),
      tags,
      description: truncate(stripHtml(r.description || ""), 2500),
    };
  });
  return { jobs, mode: "reale · Arbeitnow API", full: true };
}

// ---- Generic HTTP/JSON connector (config-driven) ----
// apiConfig: { url, arrayPath?, headers?, map: { externalId, title, company, ... } }  (values are dot-paths)
const dig = (obj, path) => (path ? path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj) : undefined);

// Adzuna-specific mapping: pulls REAL salary, category and contract type.
const CONTRACT_TIME = { full_time: "Full-time", part_time: "Part-time" };
function fmtSalary(r) {
  // Solo RAL reali: se Adzuna la marca come "predicted" (stima), la trattiamo
  // come non disponibile → la card mostrerà "Non specificata".
  if (String(r.salary_is_predicted) === "1") return "n.d.";
  const min = r.salary_min, max = r.salary_max;
  if (!min && !max) return "n.d.";
  const k = (n) => Math.round(n / 1000);
  return min && max ? `€${k(min)}–${k(max)}k` : `€${k(min || max)}k`;
}
function mapAdzuna(r) {
  const title = r.title || "Posizione";
  const remote = /remot|smart\s*working|ibrido|telelavoro/i.test(`${title} ${r.description || ""}`);
  return {
    externalId: String(r.id),
    title,
    company: r.company?.display_name || "—",
    location: r.location?.display_name || "—",
    type: CONTRACT_TIME[r.contract_time] || (r.contract_type === "permanent" ? "Indeterminato" : r.contract_type === "contract" ? "Determinato" : "—"),
    remote: remote ? "Remoto" : "—",
    salary: fmtSalary(r),                                  // RAL reale (min–max) da Adzuna
    industry: r.category?.label || inferIndustry([], title), // settore dalla categoria ufficiale
    seniority: inferSeniority(title),                       // stima dal titolo (Adzuna non espone la seniority)
    postedAt: (r.created || todayStr()).slice(0, 10),
    tags: r.category?.tag ? [r.category.tag] : [],
    description: truncate(stripHtml(r.description || ""), 2500),
    url: r.redirect_url || null,
  };
}

export async function httpJsonConnector(source) {
  const cfg = source.apiConfig || {};
  let url = cfg.url || source.url;
  if (!url) throw new Error("apiConfig.url mancante");

  // Adzuna (official aggregator API, free tier): inject keys from env and use
  // the dedicated mapper above. Get keys at https://developer.adzuna.com.
  // PAGINATION: Adzuna returns max 50 results per page; we sweep several pages
  // (ADZUNA_MAX_PAGES, default 10 → up to ~500 offerte per scansione) so una
  // sola fonte scarica un volume reale, non 25 offerte.
  if (/api\.adzuna\.com/i.test(url)) {
    const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
    if (!id || !key) throw new Error("Adzuna: imposta le variabili ADZUNA_APP_ID e ADZUNA_APP_KEY");
    const maxPages = Math.max(1, Math.min(20, parseInt(cfg.maxPages || process.env.ADZUNA_MAX_PAGES || "10", 10) || 10));
    // Split base path (…/search/) from the page number and query string.
    const m = url.match(/^(.*\/search\/)(\d+)?(\?.*)?$/i);
    const base = m ? m[1] : url.replace(/\/?$/, "/search/");
    let qs = (m && m[3]) ? m[3] : "";
    if (!/[?&]results_per_page=/.test(qs)) qs += (qs ? "&" : "?") + "results_per_page=50";
    qs += `${qs.includes("?") ? "&" : "?"}app_id=${encodeURIComponent(id)}&app_key=${encodeURIComponent(key)}`;
    const all = [];
    let pages = 0;
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch(`${base}${page}${qs}`, { headers: { accept: "application/json" } });
      if (!res.ok) { if (page === 1) throw new Error(`HTTP ${res.status}`); break; }
      const body = await res.json();
      const batch = body.results || [];
      all.push(...batch);
      pages = page;
      if (batch.length < 50) break; // ultima pagina raggiunta
    }
    return { jobs: all.map(mapAdzuna), mode: `reale · Adzuna API (${pages} pag.)`, full: true };
  }

  // Generic dot-path mapping for any other JSON API
  const res = await fetch(url, { headers: { accept: "application/json", ...(cfg.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = (cfg.arrayPath ? dig(body, cfg.arrayPath) : body) || [];
  const m = cfg.map || {};
  const jobs = rows.map((r, i) => {
    const title = dig(r, m.title) || "Posizione";
    const tags = (m.tags ? dig(r, m.tags) : []) || [];
    return {
      externalId: String(dig(r, m.externalId) ?? `${source.id}-${i}`),
      title,
      company: dig(r, m.company) || source.name,
      location: dig(r, m.location) || "—",
      type: dig(r, m.type) || "—",
      remote: dig(r, m.remote) || "—",
      salary: dig(r, m.salary) || "n.d.",
      industry: dig(r, m.industry) || inferIndustry(tags, title),
      seniority: dig(r, m.seniority) || inferSeniority(title),
      postedAt: (dig(r, m.postedAt) || todayStr()).toString().slice(0, 10),
      tags: Array.isArray(tags) ? tags.slice(0, 6) : [],
      description: truncate(stripHtml(dig(r, m.description) || ""), 2500),
    };
  });
  return { jobs, mode: "reale · HTTP/JSON", full: true };
}

// ---- RSS/Atom feed connector ----
export async function rssConnector(source) {
  const res = await fetch(cfgUrl(source), { headers: { accept: "application/rss+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.split(/<item[\s>]/i).slice(1);
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? stripHtml(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
  };
  const jobs = items.slice(0, source.apiConfig?.limit || 20).map((block, i) => {
    const title = pick(block, "title");
    const link = pick(block, "link") || `${source.id}-${i}`;
    return {
      externalId: link, title, company: source.name, location: "—", type: "Full-time",
      remote: "Ibrido", salary: "n.d.", industry: inferIndustry([], title), seniority: inferSeniority(title),
      postedAt: todayStr(), tags: [], description: truncate(pick(block, "description")),
    };
  });
  return { jobs, mode: "reale · RSS", full: true };
}
const cfgUrl = (s) => s.apiConfig?.url || s.url;

// ---- Jooble (real API, key required, POST-based) ----
// Get a free key at https://jooble.org/api/about . Set JOOBLE_API_KEY (or
// apiConfig.apiKey). keywords/location come from apiConfig or the source name.
export async function joobleConnector(source) {
  const key = source.apiConfig?.apiKey || process.env.JOOBLE_API_KEY;
  if (!key) {
    const sim = simulatedConnector(source);
    return { ...sim, mode: "simulato · Jooble (chiave API non configurata)" };
  }
  const keywords = source.apiConfig?.keywords || source.name || "";
  const location = source.apiConfig?.location || "";
  const res = await fetch(`https://it.jooble.org/api/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ keywords, location, page: "1" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = body.jobs || [];
  const jobs = rows.map((r, i) => {
    const title = r.title || "Posizione";
    return {
      externalId: String(r.id || r.link || `${source.id}-${i}`),
      title,
      company: r.company || "—",
      location: r.location || location || "—",
      type: r.type || "—",
      remote: /remot|smart\s*working/i.test(`${title} ${r.snippet || ""}`) ? "Remoto" : "—",
      salary: r.salary || "n.d.",
      industry: inferIndustry([], title),
      seniority: inferSeniority(title),
      postedAt: (r.updated || todayStr()).toString().slice(0, 10),
      tags: [],
      description: truncate(stripHtml(r.snippet || ""), 2500),
      url: r.link || null,
    };
  });
  return { jobs, mode: "reale · Jooble API", full: false };
}

// ---- Adzuna multi-country (comprehensive sweep) ----
// One source can cover a whole REGION: it loops the country endpoints and
// paginates each, returning the merged listing. Adzuna is country-scoped
// (…/jobs/{country}/search/{page}), so "Europa"/"Mondo" = several countries.
const ADZUNA_REGIONS = {
  italia: ["it"],
  europa: ["it", "gb", "de", "fr", "es", "nl", "pl", "at"],
  mondo: ["it", "gb", "us", "de", "fr", "ca", "au", "in"],
};
export async function adzunaConnector(source) {
  const cfg = source.apiConfig || {};
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) {
    const sim = simulatedConnector(source);
    return { ...sim, mode: "simulato · Adzuna (imposta ADZUNA_APP_ID e ADZUNA_APP_KEY)" };
  }
  const region = String(cfg.region || "italia").toLowerCase();
  const countries = (Array.isArray(cfg.countries) && cfg.countries.length) ? cfg.countries : (ADZUNA_REGIONS[region] || ["it"]);
  // More countries → fewer pages each by default, to respect the free-tier quota.
  const envMax = parseInt(process.env.ADZUNA_MAX_PAGES || "", 10);
  const defMax = countries.length > 1 ? 3 : 10;
  const maxPages = Math.max(1, Math.min(20, parseInt(cfg.maxPages, 10) || envMax || defMax));
  const what = cfg.keywords || cfg.what || "";
  const extra =
    (cfg.salaryMin ? `&salary_min=${encodeURIComponent(cfg.salaryMin)}` : "") +
    (cfg.fullTime ? "&full_time=1" : "") +
    (cfg.partTime ? "&part_time=1" : "");
  const all = [];
  const perCountry = [];
  for (const c of countries) {
    let got = 0;
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://api.adzuna.com/v1/api/jobs/${c}/search/${page}?results_per_page=50&what=${encodeURIComponent(what)}${extra}&app_id=${encodeURIComponent(id)}&app_key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) { if (page === 1) perCountry.push(`${c}:HTTP${res.status}`); break; }
      const body = await res.json();
      const batch = (body.results || []);
      // Prefix externalId with country so the same Adzuna id in two countries stays distinct.
      for (const r of batch) { const j = mapAdzuna(r); j.externalId = `${c}:${j.externalId}`; all.push(j); }
      got += batch.length;
      if (batch.length < 50) break;
    }
    perCountry.push(`${c}:${got}`);
  }
  return { jobs: all, mode: `reale · Adzuna [${perCountry.join(" ")}]`, full: true };
}

// ---- Remote-first free APIs (no key): Remotive, RemoteOK, Jobicy ----
// Tutte accettano apiConfig.keywords (dai profili dei candidati). Restituiscono
// offerte remote, ottime per profili Tech/Senior.
const kwTokens = (s) => String(s || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
const matchesKw = (text, toks) => !toks.length || toks.some((t) => String(text || "").toLowerCase().includes(t));

export async function remotiveConnector(source) {
  const kw = source.apiConfig?.keywords || "";
  const url = `https://remotive.com/api/remote-jobs?limit=100${kw ? `&search=${encodeURIComponent(kw)}` : ""}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const jobs = (body.jobs || []).map((r) => ({
    externalId: `remotive:${r.id}`, title: r.title || "Posizione", company: r.company_name || "—",
    location: r.candidate_required_location || "Remoto", type: r.job_type || "—", remote: "Remoto",
    salary: r.salary || "n.d.", industry: r.category || inferIndustry([], r.title || ""), seniority: inferSeniority(r.title || ""),
    postedAt: (r.publication_date || todayStr()).slice(0, 10), tags: [r.category].filter(Boolean),
    description: truncate(stripHtml(r.description || ""), 2500), url: r.url || null,
  }));
  return { jobs, mode: "reale · Remotive API", full: false };
}

export async function remoteokConnector(source) {
  const toks = kwTokens(source.apiConfig?.keywords || "");
  const res = await fetch("https://remoteok.com/api", { headers: { accept: "application/json", "user-agent": "digitalfa/1.0 (+https://digitalfa.app)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = (Array.isArray(body) ? body : []).filter((r) => r && r.id && (r.position || r.title));
  const jobs = rows
    .filter((r) => matchesKw(`${r.position || r.title} ${(r.tags || []).join(" ")}`, toks))
    .slice(0, 60)
    .map((r) => ({
      externalId: `remoteok:${r.id}`, title: r.position || r.title || "Posizione", company: r.company || "—",
      location: r.location || "Remoto", type: "—", remote: "Remoto",
      salary: (r.salary_min && r.salary_max) ? `€${Math.round(r.salary_min / 1000)}–${Math.round(r.salary_max / 1000)}k` : "n.d.",
      industry: inferIndustry(r.tags || [], r.position || ""), seniority: inferSeniority(r.position || ""),
      postedAt: (r.date || todayStr()).slice(0, 10), tags: (r.tags || []).slice(0, 4),
      description: truncate(stripHtml(r.description || ""), 2500), url: r.url || null,
    }));
  return { jobs, mode: "reale · RemoteOK API", full: false };
}

export async function jobicyConnector(source) {
  const kw = source.apiConfig?.keywords || "";
  const url = `https://jobicy.com/api/v2/remote-jobs?count=100${kw ? `&tag=${encodeURIComponent(kw)}` : ""}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const jobs = (body.jobs || []).map((r) => ({
    externalId: `jobicy:${r.id}`, title: r.jobTitle || "Posizione", company: r.companyName || "—",
    location: r.jobGeo || "Remoto", type: (Array.isArray(r.jobType) ? r.jobType[0] : r.jobType) || "—", remote: "Remoto",
    salary: (r.annualSalaryMin && r.annualSalaryMax) ? `€${Math.round(r.annualSalaryMin / 1000)}–${Math.round(r.annualSalaryMax / 1000)}k` : "n.d.",
    industry: (Array.isArray(r.jobIndustry) ? r.jobIndustry[0] : r.jobIndustry) || inferIndustry([], r.jobTitle || ""),
    seniority: inferSeniority(r.jobTitle || ""), postedAt: (r.pubDate || todayStr()).slice(0, 10),
    tags: (Array.isArray(r.jobIndustry) ? r.jobIndustry : []).slice(0, 3),
    description: truncate(stripHtml(r.jobExcerpt || ""), 2500), url: r.url || null,
  }));
  return { jobs, mode: "reale · Jobicy API", full: false };
}

// ---- jobdataapi.com — aggregatore con filtro per paese (Italia). ----
// Gratuito; un token opzionale (JOBDATA_API_KEY) alza i limiti.
export async function jobdataapiConnector(source) {
  const kw = source.apiConfig?.keywords || "";
  const country = source.apiConfig?.country || "IT";
  const url = `https://jobdataapi.com/api/jobs/?country_code=${encodeURIComponent(country)}&page_size=50${kw ? `&title=${encodeURIComponent(kw)}` : ""}`;
  const headers = { accept: "application/json" };
  if (process.env.JOBDATA_API_KEY) headers.authorization = `Api-Key ${process.env.JOBDATA_API_KEY}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = body.results || body.jobs || (Array.isArray(body) ? body : []);
  const jobs = rows.map((r, i) => {
    const title = r.title || r.job_title || "Posizione";
    const company = r.company?.name || r.company_name || r.company || "—";
    const loc = r.location || r.city || (r.region && r.country ? `${r.region}, ${r.country}` : r.country) || "Italia";
    return {
      externalId: `jobdata:${r.id || r.slug || i}`, title, company, location: loc,
      type: (Array.isArray(r.types) ? r.types[0] : r.employment_type) || "—",
      remote: r.has_remote || /remote|remoto/i.test(`${title} ${loc}`) ? "Remoto" : "—",
      salary: (r.salary_min && r.salary_max) ? `€${Math.round(r.salary_min / 1000)}–${Math.round(r.salary_max / 1000)}k` : "n.d.",
      industry: inferIndustry([], title), seniority: inferSeniority(title),
      postedAt: (r.published || r.created || todayStr()).toString().slice(0, 10), tags: [],
      description: truncate(stripHtml(r.description || ""), 2500), url: r.application_url || r.url || null,
    };
  });
  return { jobs, mode: "reale · jobdataapi (Italia)", full: false };
}

// ---- Arbeitsagentur (agenzia federale tedesca) — API pubblica gratuita. ----
export async function arbeitsagenturConnector(source) {
  const kw = source.apiConfig?.keywords || "";
  const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/app/jobs?was=${encodeURIComponent(kw || "manager")}&size=50&page=1`;
  const res = await fetch(url, { headers: { "X-API-Key": "jobboerse-jobsuche", accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = body.stellenangebote || body.jobs || [];
  const jobs = rows.map((r, i) => {
    const title = r.titel || r.beruf || "Posizione";
    return {
      externalId: `arbeitsagentur:${r.refnr || r.hashId || i}`, title, company: r.arbeitgeber || "—",
      location: r.arbeitsort?.ort || r.arbeitsort?.region || "Germania", type: "—",
      remote: /remote|homeoffice|telelavoro/i.test(title) ? "Remoto" : "—", salary: "n.d.",
      industry: inferIndustry([], title), seniority: inferSeniority(title),
      postedAt: (r.aktuelleVeroeffentlichungsdatum || r.eintrittsdatum || todayStr()).toString().slice(0, 10), tags: [],
      description: truncate(stripHtml(r.stellenbeschreibung || ""), 2500),
      url: r.externeUrl || (r.refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(r.refnr)}` : null),
    };
  });
  return { jobs, mode: "reale · Arbeitsagentur (DE)", full: false };
}

// ---- Findwork (findwork.dev) — ruoli software/engineering, free tier con token. ----
export async function findworkConnector(source) {
  const key = (source.apiConfig?.apiKey || process.env.FINDWORK_API_KEY || "").trim();
  if (!key) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · Findwork (imposta FINDWORK_API_KEY)" }; }
  const kw = source.apiConfig?.keywords || "";
  const url = `https://findwork.dev/api/jobs/${kw ? `?search=${encodeURIComponent(kw)}` : ""}`;
  const res = await fetch(url, { headers: { authorization: `Token ${key}`, accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const jobs = (body.results || []).map((r, i) => {
    const title = r.role || "Posizione";
    return {
      externalId: `findwork:${r.id || i}`, title, company: r.company_name || "—",
      location: r.location || (r.remote ? "Remoto" : "—"), type: r.employment_type || "—",
      remote: r.remote ? "Remoto" : "—", salary: "n.d.", industry: inferIndustry(r.keywords || [], title),
      seniority: inferSeniority(title), postedAt: (r.date_posted || todayStr()).toString().slice(0, 10),
      tags: (r.keywords || []).slice(0, 4), description: truncate(stripHtml(r.text || ""), 2500), url: r.url || null,
    };
  });
  return { jobs, mode: "reale · Findwork API", full: false };
}

// ---- TheirStack — API tech, free tier a crediti (POST con filtri). ----
export async function theirstackConnector(source) {
  const key = (source.apiConfig?.apiKey || process.env.THEIRSTACK_API_KEY || "").trim();
  if (!key) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · TheirStack (imposta THEIRSTACK_API_KEY)" }; }
  const kw = source.apiConfig?.keywords || "";
  const res = await fetch("https://api.theirstack.com/v1/jobs/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ page: 0, limit: 50, posted_at_max_age_days: 30, ...(kw ? { job_title_or: [kw] } : {}) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const rows = body.data || body.results || [];
  const jobs = rows.map((r, i) => {
    const title = r.job_title || r.title || "Posizione";
    const company = r.company_object?.name || r.company || r.company_name || "—";
    return {
      externalId: `theirstack:${r.id || i}`, title, company,
      location: r.location || r.short_location || (r.remote ? "Remoto" : "—"), type: r.employment_statuses?.[0] || "—",
      remote: r.remote ? "Remoto" : "—", salary: r.salary_string || "n.d.", industry: inferIndustry([], title),
      seniority: r.seniority || inferSeniority(title), postedAt: (r.date_posted || todayStr()).toString().slice(0, 10),
      tags: [], description: truncate(stripHtml(r.description || ""), 2500), url: r.url || r.final_url || null,
    };
  });
  return { jobs, mode: "reale · TheirStack API", full: false };
}

// ---- JSearch (RapidAPI) — aggrega Google for Jobs (Indeed, LinkedIn, ecc.),
// JSON già pulito. Richiede una RapidAPI key. ----
export async function jsearchConnector(source) {
  const key = (source.apiConfig?.apiKey || process.env.RAPIDAPI_KEY || "").trim();
  if (!key) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · JSearch (imposta RAPIDAPI_KEY)" }; }
  const kw = source.apiConfig?.keywords || "developer";
  const country = source.apiConfig?.country || "it";
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(kw)}&page=1&num_pages=1&country=${encodeURIComponent(country)}`;
  const res = await fetch(url, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com", accept: "application/json" } });
  if (!res.ok) {
    let detail = ""; try { const eb = await res.json(); detail = eb.message || eb.error || ""; } catch { /* body non-JSON */ }
    if (res.status === 403) throw new Error(`403 — la chiave RapidAPI non è ABBONATA all'API JSearch. Apri JSearch su RapidAPI e premi "Subscribe to Test" (piano Basic, gratuito).${detail ? " " + detail : ""}`);
    if (res.status === 429) throw new Error(`429 — quota RapidAPI esaurita sul piano attuale (il Basic ha un limite mensile).${detail ? " " + detail : ""}`);
    if (res.status === 401) throw new Error(`401 — chiave RapidAPI non valida o assente.${detail ? " " + detail : ""}`);
    throw new Error(`HTTP ${res.status}${detail ? " — " + detail : ""}`);
  }
  const body = await res.json();
  const rows = body.data || [];
  const jobs = rows.map((r, i) => {
    const title = r.job_title || "Posizione";
    const loc = [r.job_city, r.job_state, r.job_country].filter(Boolean).join(", ") || (r.job_is_remote ? "Remoto" : "—");
    return {
      externalId: `jsearch:${r.job_id || i}`, title, company: r.employer_name || "—", location: loc,
      type: r.job_employment_type || "—", remote: r.job_is_remote ? "Remoto" : "—",
      salary: (r.job_min_salary && r.job_max_salary) ? `€${Math.round(r.job_min_salary / 1000)}–${Math.round(r.job_max_salary / 1000)}k` : "n.d.",
      industry: inferIndustry([], title), seniority: inferSeniority(title),
      postedAt: (r.job_posted_at_datetime_utc || todayStr()).toString().slice(0, 10), tags: [],
      description: truncate(stripHtml(r.job_description || ""), 2500), url: r.job_apply_link || null,
    };
  });
  return { jobs, mode: "reale · JSearch (RapidAPI)", full: false };
}

// ---- SerpApi — Google for Jobs. Alta rilevanza + mercato locale italiano. Keyed. ----
export async function serpapiConnector(source) {
  const key = (source.apiConfig?.apiKey || process.env.SERPAPI_KEY || "").trim();
  if (!key) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · SerpApi (imposta SERPAPI_KEY)" }; }
  const kw = source.apiConfig?.keywords || "lavoro";
  const loc = source.apiConfig?.location || "Italy";
  const params = new URLSearchParams({ engine: "google_jobs", q: kw, hl: "it", gl: "it", api_key: key });
  if (loc && !/remot/i.test(loc)) params.set("location", loc);
  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    let d = ""; try { const b = await res.json(); d = b.error || ""; } catch { /* non-JSON */ }
    if (res.status === 401) throw new Error(`401 — SERPAPI_KEY non valida.${d ? " " + d : ""}`);
    throw new Error(`HTTP ${res.status}${d ? " — " + d : ""}`);
  }
  const body = await res.json();
  if (body.error) throw new Error(`SerpApi: ${body.error}`);
  const jobs = (body.jobs_results || []).map((r, i) => {
    const apply = (r.apply_options && r.apply_options[0] && r.apply_options[0].link) || r.share_link || null;
    const ext = `serpapi:${String(r.job_id || `${i}-${(r.title || "").slice(0, 24)}`).slice(0, 90)}`;
    const ext2 = (r.detected_extensions || {});
    return {
      externalId: ext, title: r.title || "Posizione", company: r.company_name || "—",
      location: r.location || "—", type: ext2.schedule_type || "—",
      remote: /remot|smart/i.test(r.location || "") ? "Remoto" : "—", salary: ext2.salary || "n.d.",
      industry: inferIndustry([], r.title || ""), seniority: inferSeniority(r.title || ""),
      postedAt: todayStr(), tags: (ext2.qualifications || []).slice(0, 4),
      description: truncate(stripHtml(r.description || ""), 2500), url: apply,
    };
  });
  return { jobs, mode: "reale · SerpApi Google Jobs", full: false };
}

// ---- Apify — esegue un Actor di scraping (LinkedIn/Indeed/Glassdoor/ZipRecruiter)
// via run-sync-get-dataset-items. actorId configurabile. Keyed. ----
export async function apifyConnector(source) {
  const token = (source.apiConfig?.apiKey || process.env.APIFY_TOKEN || "").trim();
  if (!token) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · Apify (imposta APIFY_TOKEN)" }; }
  const actor = source.apiConfig?.actorId || process.env.APIFY_ACTOR_ID || "misceres~indeed-scraper";
  const kw = source.apiConfig?.keywords || "";
  const loc = source.apiConfig?.location || "Italy";
  // Input "ombrello": copre i nomi-campo dei principali actor di job scraping.
  const input = { position: kw, query: kw, keyword: kw, keywords: kw, searchKeywords: kw, title: kw, location: loc, country: "IT", maxItems: 50, maxResults: 50, rows: 50 };
  const res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&clean=true&limit=50`, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input),
  });
  if (!res.ok) {
    let d = ""; try { const b = await res.json(); d = (b.error && b.error.message) || ""; } catch { /* non-JSON */ }
    if (res.status === 401 || res.status === 403) throw new Error(`${res.status} — APIFY_TOKEN non valido o actor non accessibile.${d ? " " + d : ""}`);
    throw new Error(`HTTP ${res.status}${d ? " — " + d : ""}`);
  }
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw.items || []);
  const jobs = arr.map((r, i) => {
    const title = r.title || r.jobTitle || r.positionName || r.position || "Posizione";
    const company = r.company || r.companyName || r.employer || r.company_name || "—";
    const loc2 = r.location || r.jobLocation || r.place || (r.isRemote ? "Remoto" : "—");
    const url = r.url || r.jobUrl || r.link || r.applyUrl || r.jobPostingUrl || null;
    const desc = r.description || r.descriptionText || r.jobDescription || r.snippet || "";
    return {
      externalId: `apify:${String(r.id || r.jobId || url || i).slice(0, 110)}`, title, company, location: loc2,
      type: r.employmentType || r.contractType || "—", remote: (r.isRemote || /remot/i.test(loc2)) ? "Remoto" : "—",
      salary: r.salary || r.salaryInfo || "n.d.", industry: inferIndustry([], title), seniority: inferSeniority(title),
      postedAt: String(r.postedAt || r.date || r.publishedAt || todayStr()).slice(0, 10), tags: [],
      description: truncate(stripHtml(typeof desc === "string" ? desc : ""), 2500), url,
    };
  });
  return { jobs, mode: `reale · Apify (${actor})`, full: false };
}

// Filtro "in scope": il titolo contiene almeno una parola chiave del candidato.
function kwMatch(title, kw) {
  if (!kw) return true;
  const toks = String(kw).toLowerCase().split(/[^a-zàèéìòù0-9]+/).filter((w) => w.length > 2);
  if (!toks.length) return true;
  const t = String(title || "").toLowerCase();
  return toks.some((w) => t.includes(w));
}

// ---- ATS pubblici (portali carriere aziendali). Nessuna chiave.
// apiConfig.boards = elenco di "company token"; keywords per restare in scope. ----
export async function greenhouseConnector(source) {
  const boards = source.apiConfig?.boards || []; const kw = source.apiConfig?.keywords || ""; const jobs = [];
  for (const b of boards) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b)}/jobs?content=true`, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const body = await res.json();
      for (const r of (body.jobs || [])) {
        if (!kwMatch(r.title, kw)) continue;
        const loc = (r.location && r.location.name) || "—";
        jobs.push({ externalId: `greenhouse:${b}:${r.id}`, title: r.title || "Posizione", company: b, location: loc, type: "—", remote: /remot/i.test(loc) ? "Remoto" : "—", salary: "n.d.", industry: inferIndustry([], r.title || ""), seniority: inferSeniority(r.title || ""), postedAt: String(r.updated_at || todayStr()).slice(0, 10), tags: [], description: truncate(stripHtml(r.content || ""), 2500), url: r.absolute_url || null });
      }
    } catch { /* board non valido → salta */ }
  }
  return { jobs, mode: `reale · Greenhouse (${boards.length} board)`, full: false };
}
export async function leverConnector(source) {
  const boards = source.apiConfig?.boards || []; const kw = source.apiConfig?.keywords || ""; const jobs = [];
  for (const b of boards) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(b)}?mode=json&limit=100`, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const rows = await res.json();
      for (const r of (Array.isArray(rows) ? rows : [])) {
        if (!kwMatch(r.text, kw)) continue;
        const loc = (r.categories && r.categories.location) || "—";
        jobs.push({ externalId: `lever:${b}:${r.id}`, title: r.text || "Posizione", company: b, location: loc, type: (r.categories && r.categories.commitment) || "—", remote: /remot/i.test(loc) ? "Remoto" : "—", salary: "n.d.", industry: inferIndustry([], r.text || ""), seniority: inferSeniority(r.text || ""), postedAt: (r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : todayStr()), tags: [], description: truncate(stripHtml(r.descriptionPlain || r.description || ""), 2500), url: r.hostedUrl || r.applyUrl || null });
      }
    } catch { /* salta */ }
  }
  return { jobs, mode: `reale · Lever (${boards.length} board)`, full: false };
}
export async function smartrecruitersConnector(source) {
  const boards = source.apiConfig?.boards || []; const kw = source.apiConfig?.keywords || ""; const jobs = [];
  for (const b of boards) {
    try {
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b)}/postings?limit=100${kw ? `&q=${encodeURIComponent(kw)}` : ""}`, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const body = await res.json();
      for (const r of (body.content || [])) {
        const loc = r.location ? [r.location.city, r.location.country].filter(Boolean).join(", ") : "—";
        jobs.push({ externalId: `smartrecruiters:${b}:${r.id}`, title: r.name || "Posizione", company: (r.company && r.company.name) || b, location: loc || "—", type: (r.typeOfEmployment && r.typeOfEmployment.label) || "—", remote: (r.location && r.location.remote) ? "Remoto" : "—", salary: "n.d.", industry: inferIndustry([], r.name || ""), seniority: inferSeniority(r.name || ""), postedAt: String(r.releasedDate || todayStr()).slice(0, 10), tags: [], description: "", url: `https://jobs.smartrecruiters.com/${b}/${r.id}` });
      }
    } catch { /* salta */ }
  }
  return { jobs, mode: `reale · SmartRecruiters (${boards.length} board)`, full: false };
}

// ---- Bright Data — recupero di uno snapshot/dataset di annunci già pronto. Keyed. ----
export async function brightdataConnector(source) {
  const key = (source.apiConfig?.apiKey || process.env.BRIGHTDATA_API_KEY || "").trim();
  if (!key) { const sim = simulatedConnector(source); return { ...sim, mode: "simulato · Bright Data (imposta BRIGHTDATA_API_KEY)" }; }
  const dataset = source.apiConfig?.datasetId || process.env.BRIGHTDATA_DATASET_ID;
  if (!dataset) throw new Error("Bright Data: manca l'ID del dataset (impostalo in Impostazioni).");
  const res = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(dataset)}?format=json`, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(`${res.status} — BRIGHTDATA_API_KEY non valida.`);
    throw new Error(`HTTP ${res.status}`);
  }
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw.data || []);
  const kw = source.apiConfig?.keywords || "";
  const jobs = arr.filter((r) => kwMatch(r.job_title || r.title || "", kw)).slice(0, 200).map((r, i) => {
    const title = r.job_title || r.title || "Posizione"; const url = r.url || r.job_url || r.link || null;
    return { externalId: `brightdata:${String(r.job_posting_id || r.id || url || i).slice(0, 110)}`, title, company: r.company_name || r.company || "—", location: r.job_location || r.location || "—", type: r.job_employment_type || "—", remote: /remot/i.test(r.job_location || r.location || "") ? "Remoto" : "—", salary: r.salary || "n.d.", industry: inferIndustry([], title), seniority: inferSeniority(title), postedAt: String(r.job_posted_date || todayStr()).slice(0, 10), tags: [], description: truncate(stripHtml(r.job_summary || r.description || ""), 2500), url };
  });
  return { jobs, mode: "reale · Bright Data dataset", full: false };
}

// Scarica l'HTML di una pagina via ScrapingBee/ScraperAPI (bypassa anti-bot).
// Ritorna null se nessun middleware è configurato.
export async function fetchHtmlViaProxy(targetUrl) {
  const bee = process.env.SCRAPINGBEE_KEY, sapi = process.env.SCRAPERAPI_KEY;
  let url = null;
  if (bee) url = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(bee)}&render_js=false&url=${encodeURIComponent(targetUrl)}`;
  else if (sapi) url = `https://api.scraperapi.com/?api_key=${encodeURIComponent(sapi)}&url=${encodeURIComponent(targetUrl)}`;
  else return null;
  const res = await fetch(url, { headers: { accept: "text/html" } });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  return await res.text();
}
export const scraperEnabled = () => !!(process.env.SCRAPINGBEE_KEY || process.env.SCRAPERAPI_KEY);

// ---- Partner-API stubs (LinkedIn / Indeed) ----
// Real partner APIs need approved credentials. Without them we clearly fall
// back to simulated data, but the wiring point is ready for the real call.
function partnerStub(name) {
  return function (source) {
    const key = source.apiConfig?.apiKey || process.env[`${name.toUpperCase()}_API_KEY`];
    if (!key) {
      const sim = simulatedConnector(source);
      return { ...sim, mode: `simulato · ${name} (credenziali API non configurate)` };
    }
    // With a real key you'd call the partner endpoint here and map the result.
    throw new Error(`${name}: chiamata reale non implementata in questo prototipo (credenziali presenti). Aggiungi il mapping dell'endpoint partner.`);
  };
}

export const CONNECTORS = {
  simulated: simulatedConnector,
  arbeitnow: arbeitnowConnector,
  jooble: joobleConnector,
  adzuna: adzunaConnector,
  remotive: remotiveConnector,
  remoteok: remoteokConnector,
  jobicy: jobicyConnector,
  jobdataapi: jobdataapiConnector,
  arbeitsagentur: arbeitsagenturConnector,
  findwork: findworkConnector,
  theirstack: theirstackConnector,
  jsearch: jsearchConnector,
  serpapi: serpapiConnector,
  apify: apifyConnector,
  greenhouse: greenhouseConnector,
  lever: leverConnector,
  smartrecruiters: smartrecruitersConnector,
  brightdata: brightdataConnector,
  http_json: httpJsonConnector,
  rss: rssConnector,
  linkedin: partnerStub("LinkedIn"),
  indeed: partnerStub("Indeed"),
};

export const CONNECTOR_LABELS = {
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
  jsearch: "JSearch · RapidAPI (aggrega Indeed/LinkedIn)",
  serpapi: "SerpApi · Google Jobs (chiave · rilevanza alta)",
  apify: "Apify · Actor LinkedIn/Indeed/Glassdoor (chiave)",
  greenhouse: "Greenhouse (ATS aziendale · gratis)",
  lever: "Lever (ATS aziendale · gratis)",
  smartrecruiters: "SmartRecruiters (ATS aziendale · gratis)",
  brightdata: "Bright Data (dataset · chiave)",
  http_json: "HTTP/JSON generico",
  rss: "Feed RSS",
  linkedin: "LinkedIn Partner API",
  indeed: "Indeed Partner API",
};

// Run the connector for a source. Never throws: on error, falls back to
// simulated and reports the error in `mode`.
export async function fetchFromConnector(source) {
  const fn = CONNECTORS[source.connector] || CONNECTORS.simulated;
  try {
    const out = await fn(source);
    return { jobs: out.jobs || [], mode: out.mode || source.connector, full: !!out.full };
  } catch (e) {
    const sim = simulatedConnector(source);
    return { jobs: sim.jobs, mode: `simulato · fallback (${e.message})`, full: false };
  }
}
