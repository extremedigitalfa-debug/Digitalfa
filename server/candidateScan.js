// Profile-driven scan engine (the single engine, model "A").
//
// Candidates' profiles produce SEARCH QUERIES (title × chosen location). We
// COALESCE identical queries across all candidates so the same search is never
// downloaded twice, scan each unique query once into the shared job pool (with
// cross-source dedup), and let the matcher rank the pool per candidate.
//
//   - scanForCandidate(): immediate scan for one candidate (signup / profile edit)
//   - runProfileScan():   daily scan over the UNION of all candidates' queries
//   - countNewMatchesToday(): how many offers added today match a candidate

import { fetchFromConnector as fetchConn } from "./connectors/index.js";
import { dedupKey } from "./scheduler.js";
import { computeMatch, DEFAULT_WEIGHTS } from "./matcher.js";
import { classifyCompanyType } from "./generators.js";

// Giorno di calendario in fuso italiano (coerente col client) → "oggi" = oggi in Italia.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
let seq = 7000;
const nid = (p) => `${p}-${Date.now()}-${++seq}`;

// A candidate offer counts as a "match" (for the daily email + highlights)
// when its compatibility score is at least this.
export const MATCH_THRESHOLD = 45;

const EU_COUNTRIES = ["it", "gb", "de", "fr", "es", "nl", "pl", "at"];
const WORLD_COUNTRIES = ["it", "gb", "us", "de", "fr", "ca", "au", "in"];
const isCityLoc = (l) => l && !/remoto|europa|mondo|italia/i.test(l);

// Parole strutturali da togliere dalla QUERY ai portali: "Head of Operations"
// → cerca "operations" (Adzuna fa AND sulle parole: il titolo intero trova poco).
const QUERY_STOP = new Set(["head", "of", "the", "and", "di", "del", "della", "dei", "delle", "in", "con", "per", "senior", "junior", "lead", "principal", "staff", "chief", "vp", "responsabile", "capo"]);
function queryKeywords(title) {
  const toks = String(title || "").toLowerCase().replace(/[^a-z0-9àèéìòù ]/gi, " ").split(/\s+/).filter((w) => w.length > 1);
  const kept = toks.filter((t) => !QUERY_STOP.has(t));
  return (kept.length ? kept : toks).join(" ").trim() || String(title || "");
}

// Location label → Adzuna {country, where} targets.
function adzunaTargets(loc) {
  const s = String(loc || "").toLowerCase();
  if (/mondo/.test(s)) return WORLD_COUNTRIES.map((c) => ({ country: c, where: "" }));
  if (/europa/.test(s)) return EU_COUNTRIES.map((c) => ({ country: c, where: "" }));
  if (/remoto/.test(s)) return [{ country: "it", where: "", remote: true }, { country: "gb", where: "", remote: true }];
  if (/italia/.test(s)) return [{ country: "it", where: "" }];
  return [{ country: "it", where: loc }];
}

// Build the coalesced set of queries for a list of candidates.
// opts.atsBoards = { greenhouse:[tokens], lever:[...], smartrecruiters:[...] }
export function buildQueries(candidates, { maxPerCandidate = 24, cap = 80, atsBoards = {} } = {}) {
  const map = new Map(); // key -> query
  const allTitles = new Set();
  for (const c of candidates) {
    const titles = (c.desiredTitles && c.desiredTitles.length ? c.desiredTitles : (c.title ? [c.title] : [])).slice(0, 4);
    const locs = (c.preferredLocations && c.preferredLocations.length ? c.preferredLocations : ["Italia (tutta)"]);
    const modes = (c.workModes || []).map((m) => String(m).toLowerCase());
    const wantsRemote = modes.includes("remoto");
    let n = 0;
    for (const title of titles) {
      allTitles.add(title);
      const cityLoc = locs.find(isCityLoc);
      const jLoc = cityLoc || (locs.some((l) => /europa|mondo/i.test(l)) ? "Europa" : (wantsRemote && !cityLoc) ? "" : "Italia");
      // Jooble query (one per title, broad location)
      const jk = `jooble|${title.toLowerCase()}|${jLoc.toLowerCase()}`;
      if (!map.has(jk)) map.set(jk, { source: "jooble", title, location: jLoc });
      // SerpApi (Google Jobs) e Apify: parola chiave + località (alta rilevanza).
      for (const src of ["serpapi", "apify"]) {
        const sk = `${src}|${title.toLowerCase()}|${jLoc.toLowerCase()}`;
        if (!map.has(sk)) map.set(sk, { source: src, title, location: jLoc || "Italy" });
      }
      // Fonti gratuite/keyed a parola chiave — una query per titolo.
      for (const src of ["remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur", "findwork", "theirstack", "jsearch"]) {
        const rk = `${src}|${title.toLowerCase()}`;
        if (!map.has(rk)) map.set(rk, { source: src, title });
      }
      // Adzuna queries (title × each location target)
      for (const loc of locs) {
        for (const t of adzunaTargets(loc)) {
          const key = `adzuna|${title.toLowerCase()}|${t.country}|${(t.where || "").toLowerCase()}|${t.remote ? "r" : ""}`;
          if (!map.has(key)) map.set(key, { source: "adzuna", title, country: t.country, where: t.where || "", remote: !!t.remote });
          if (++n >= maxPerCandidate) break;
        }
        if (n >= maxPerCandidate) break;
      }
      // Se il candidato vuole il remoto, aggiungi target Adzuna remote (IT + GB).
      if (wantsRemote) {
        for (const country of ["it", "gb"]) {
          const key = `adzuna|${title.toLowerCase()}|${country}||r`;
          if (!map.has(key)) map.set(key, { source: "adzuna", title, country, where: "", remote: true });
        }
      }
    }
  }
  // ATS diretti (Greenhouse/Lever/SmartRecruiters): UNA query per provider,
  // che scorre tutti i board configurati e filtra per le parole chiave dei ruoli.
  const kw = Array.from(allTitles).join(" ");
  for (const src of ["greenhouse", "lever", "smartrecruiters"]) {
    const boards = (atsBoards && atsBoards[src]) || [];
    if (boards.length) map.set(`${src}|ats`, { source: src, boards, keywords: kw });
  }
  // Bright Data: un dataset già pronto, filtrato per parole chiave.
  map.set("brightdata|ds", { source: "brightdata", keywords: kw });
  return Array.from(map.values()).slice(0, cap);
}

// Upsert one normalised offer into the shared pool. Returns true if created.
async function upsertJob(prisma, j) {
  const d = today();
  if (j.externalId) {
    const ex = await prisma.job.findFirst({ where: { externalId: j.externalId } });
    if (ex) { await prisma.job.update({ where: { id: ex.id }, data: { lastSeenAt: d, status: "active", deactivatedAt: null } }); return false; }
  }
  const key = dedupKey(j.title, j.company);
  const dup = await prisma.job.findFirst({ where: { dedupKey: key, status: "active" } });
  if (dup) return false; // stessa offerta già presente da un'altra fonte
  const companyType = await classifyCompanyType(j).catch(() => null); // LLM se configurato, altrimenti euristica
  await prisma.job.create({ data: {
    id: nid("job"), title: j.title, company: j.company, location: j.location, type: j.type, remote: j.remote,
    salary: j.salary, industry: j.industry, seniority: j.seniority, postedAt: j.postedAt, tags: j.tags || [],
    description: j.description || "", origin: "scan", sourceId: null, status: "active",
    firstSeenAt: d, lastSeenAt: d, externalId: j.externalId || nid("ext"), dedupKey: key, companyType, url: j.url || null,
  } });
  return true;
}

// Run one coalesced query against its connector; upsert results.
// Returns { fetched, created, mode } for diagnostics.
async function scanQuery(prisma, q, { maxPages }) {
  let created = 0;
  const kw = queryKeywords(q.title);
  let jobs = [], mode = "n/a";
  if (q.source === "adzuna") {
    if (!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)) return { fetched: 0, created: 0, mode: "no-keys" };
    // what_or = una QUALSIASI delle parole distintive (più volume per ruoli di nicchia)
    const whatOr = encodeURIComponent(kw);
    const where = q.where ? `&where=${encodeURIComponent(q.where)}` : "";
    const remote = q.remote ? "&what_phrase=remote" : "";
    const url = `https://api.adzuna.com/v1/api/jobs/${q.country}/search/1?results_per_page=50&what_or=${whatOr}${where}${remote}`;
    ({ jobs, mode } = await fetchConn({ id: "prof-adz", name: q.title, connector: "http_json", apiConfig: { url, maxPages } }));
  } else if (q.source === "jooble") {
    if (!process.env.JOOBLE_API_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    // Jooble cerca bene per frase: usa il titolo pieno (es. "Head of Operations", non solo "operations").
    ({ jobs, mode } = await fetchConn({ id: "prof-job", name: q.title, connector: "jooble", apiConfig: { keywords: q.title, location: q.location } }));
  } else if (q.source === "findwork") {
    if (!process.env.FINDWORK_API_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    ({ jobs, mode } = await fetchConn({ id: "prof-findwork", name: q.title, connector: "findwork", apiConfig: { keywords: kw } }));
  } else if (q.source === "theirstack") {
    if (!process.env.THEIRSTACK_API_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    ({ jobs, mode } = await fetchConn({ id: "prof-theirstack", name: q.title, connector: "theirstack", apiConfig: { keywords: kw } }));
  } else if (q.source === "jsearch") {
    if (!process.env.RAPIDAPI_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    ({ jobs, mode } = await fetchConn({ id: "prof-jsearch", name: q.title, connector: "jsearch", apiConfig: { keywords: kw } }));
  } else if (q.source === "serpapi") {
    if (!process.env.SERPAPI_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    // Google Jobs: titolo pieno per la massima precisione sul ruolo.
    ({ jobs, mode } = await fetchConn({ id: "prof-serpapi", name: q.title, connector: "serpapi", apiConfig: { keywords: q.title, location: q.location } }));
  } else if (q.source === "apify") {
    if (!process.env.APIFY_TOKEN) return { fetched: 0, created: 0, mode: "no-keys" };
    ({ jobs, mode } = await fetchConn({ id: "prof-apify", name: q.title, connector: "apify", apiConfig: { keywords: q.title, location: q.location } }));
  } else if (q.source === "brightdata") {
    if (!process.env.BRIGHTDATA_API_KEY) return { fetched: 0, created: 0, mode: "no-keys" };
    ({ jobs, mode } = await fetchConn({ id: "prof-brightdata", name: "brightdata", connector: "brightdata", apiConfig: { keywords: q.keywords } }));
  } else if (["greenhouse", "lever", "smartrecruiters"].includes(q.source)) {
    // ATS diretti (nessuna chiave): scorrono i board configurati in Admin.
    if (!q.boards || !q.boards.length) return { fetched: 0, created: 0, mode: "no-boards" };
    ({ jobs, mode } = await fetchConn({ id: `prof-${q.source}`, name: q.source, connector: q.source, apiConfig: { boards: q.boards, keywords: q.keywords } }));
  } else if (["remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur"].includes(q.source)) {
    // Fonti gratuite (nessuna chiave) — cercano per parola chiave.
    ({ jobs, mode } = await fetchConn({ id: `prof-${q.source}`, name: q.title, connector: q.source, apiConfig: { keywords: kw } }));
  } else {
    return { fetched: 0, created: 0, mode: "n/a" };
  }
  for (const j of jobs) if (await upsertJob(prisma, j)) created++;
  return { fetched: jobs.length, created, mode };
}

const LABEL = { adzuna: "Adzuna", jooble: "Jooble", remotive: "Remotive", remoteok: "RemoteOK", jobicy: "Jobicy", jobdataapi: "jobdataapi", arbeitsagentur: "Arbeitsagentur", findwork: "Findwork", theirstack: "TheirStack", jsearch: "JSearch", serpapi: "SerpApi (Google Jobs)", apify: "Apify", greenhouse: "Greenhouse", lever: "Lever", smartrecruiters: "SmartRecruiters", brightdata: "Bright Data" };
export const SOURCE_LABEL = LABEL;
// Fonti che richiedono una chiave in Impostazioni (per lo stato "chiave mancante").
const KEYED = new Set(["adzuna", "jooble", "findwork", "theirstack", "jsearch", "serpapi", "apify", "brightdata"]);

// Scan a coalesced query set. Returns { queries, created, fetched, modes, perSource }.
async function runQuerySet(prisma, queries, { maxPages }) {
  let created = 0, fetched = 0; const errors = [];
  const per = {}; // source -> { q, fetched, created, noKeys, status }
  for (const q of queries) {
    (per[q.source] ||= { q: 0, fetched: 0, created: 0, noKeys: 0 }).q++;
    try {
      const r = await scanQuery(prisma, q, { maxPages });
      created += r.created; fetched += r.fetched;
      per[q.source].fetched += r.fetched; per[q.source].created += r.created;
      if (r.mode === "no-keys") per[q.source].noKeys++;
      if (r.mode === "no-boards") (per[q.source].noBoards = (per[q.source].noBoards || 0) + 1);
      if (r.mode && /simulato|fallback|HTTP|errore/i.test(r.mode)) { per[q.source].error = r.mode; if (errors.length < 5) errors.push(`${q.source}: ${r.mode}`); }
    } catch (e) { per[q.source].error = e.message; if (errors.length < 5) errors.push(`errore ${q.source}/${q.title}: ${e.message}`); }
  }
  // Stato leggibile per ogni fonte: distingue "chiave mancante" da "0 letture" da errore.
  for (const [s, p] of Object.entries(per)) {
    if (p.error) p.status = "errore";
    else if (p.noKeys >= p.q) p.status = "chiave mancante";
    else if (p.noBoards >= p.q) p.status = "board mancanti";
    else if (p.fetched === 0) p.status = "nessun risultato";
    else p.status = "ok";
  }
  const modes = Object.entries(per).map(([s, p]) =>
    (p.status === "chiave mancante" || p.status === "board mancanti")
      ? `${LABEL[s] || s}: ${p.status}`
      : `${LABEL[s] || s}: ${p.q} ric. · ${p.fetched} lette · +${p.created} nuove`);
  modes.push(...errors);
  if (!modes.length) modes.push("nessuna fonte disponibile");
  return { queries: queries.length, created, fetched, modes, perSource: per };
}

// Immediate scan for ONE candidate (signup / profile edit).
export async function scanForCandidate(prisma, candidate, { atsBoards = {} } = {}) {
  const queries = buildQueries([candidate], { atsBoards });
  const maxPages = Math.max(1, Math.min(20, parseInt(process.env.ADZUNA_MAX_PAGES || "", 10) || 8));
  return runQuerySet(prisma, queries, { maxPages });
}

// Daily scan over the UNION of all onboarded candidates' queries (coalesced).
export async function runProfileScan(prisma, candidates, { atsBoards = {} } = {}) {
  const queries = buildQueries(candidates, { atsBoards });
  const maxPages = Math.max(1, Math.min(20, parseInt(process.env.ADZUNA_MAX_PAGES || "", 10) || 6));
  return runQuerySet(prisma, queries, { maxPages });
}

// How many offers added TODAY match this candidate at/above the threshold.
export async function countNewMatchesToday(prisma, candidate, weights) {
  const d = today();
  const w = weights || (await prisma.matchPref.findUnique({ where: { userId: candidate.id } }).catch(() => null))?.weights || DEFAULT_WEIGHTS;
  const fresh = await prisma.job.findMany({ where: { status: "active", firstSeenAt: d, OR: [{ ownerUserId: null }, { ownerUserId: candidate.id }] } });
  let n = 0;
  for (const j of fresh) { if (computeMatch(candidate, j, w).score >= MATCH_THRESHOLD) n++; }
  return n;
}
