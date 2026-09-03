// Motore di candidatura. Due modalità:
//  - "assisted": legge il form dell'offerta (via proxy/HTML), rileva i campi, li
//    mappa sul profilo del candidato e prepara le risposte → l'utente incolla/invia.
//  - "auto" (best-effort): se Playwright è disponibile sul server, apre la pagina,
//    compila i campi standard e invia SOLO se il form non richiede login/anti-bot.
// Se non è possibile, ritorna status "manual" con il motivo.

import { fetchHtmlViaProxy, scraperEnabled } from "./connectors/index.js";

const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// Regole di mappatura: attributo del campo → valore dal profilo.
function profileFrom(user) {
  const parts = String(user.name || "").trim().split(/\s+/);
  return {
    first_name: parts[0] || "", last_name: parts.slice(1).join(" ") || "", full_name: user.name || "",
    email: user.email || "", phone: user.phone || "", location: user.location || "",
    linkedin: "", current_title: (user.desiredTitles || [user.title])[0] || "",
  };
}
const FIELD_RULES = [
  { key: "email", re: /e[-_]?mail/i },
  { key: "first_name", re: /first[\s_-]?name|nome(?!.*cognome)|given[\s_-]?name/i },
  { key: "last_name", re: /last[\s_-]?name|cognome|surname|family[\s_-]?name/i },
  { key: "full_name", re: /full[\s_-]?name|nome e cognome|your name|nominativo/i },
  { key: "phone", re: /phone|tel(efono)?|mobile|cellulare/i },
  { key: "location", re: /location|città|city|indirizzo|address|località|residen/i },
  { key: "linkedin", re: /linkedin/i },
  { key: "current_title", re: /current title|job title|ruolo|posizione attuale|headline/i },
];

// Estrae i campi da un HTML (name/id/type/placeholder/aria-label + label associata).
export function detectFields(html) {
  const fields = [];
  const re = /<(input|textarea|select)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) && fields.length < 60) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const at = (n) => { const r = new RegExp(n + '\\s*=\\s*"([^"]*)"', "i").exec(attrs); return r ? r[1] : ""; };
    const type = (at("type") || (tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text")).toLowerCase();
    if (["hidden", "submit", "button", "checkbox", "radio", "search"].includes(type)) continue;
    const name = at("name"), id = at("id"), aria = at("aria-label"), ph = at("placeholder");
    const hay = [name, id, aria, ph].join(" ").toLowerCase();
    if (!hay.trim()) continue;
    let mapped = null;
    if (type === "file" || /resume|cv|curriculum|allega/.test(hay)) mapped = "cv_upload";
    else { const rule = FIELD_RULES.find((r) => r.re.test(hay)); if (rule) mapped = rule.key; }
    fields.push({ tag, type, name, id, label: aria || ph || name || id, mapped });
  }
  return fields;
}

const ANTIBOT = /cloudflare|cf-browser-verification|challenge-platform|datadome|captcha|recaptcha|hcaptcha|are you human/i;
const NEEDS_LOGIN = /crea(re)? un account|create an account|sign ?up|registrati|accedi per candidart|log ?in to apply|sign in/i;

// Analizza l'HTML e prepara il "kit" (mappatura campi + segnali).
export function buildKit(html, user, answers = []) {
  const reasons = []; let mode = "assistita";
  if (ANTIBOT.test(html)) { mode = "manuale"; reasons.push("Rilevata protezione anti-bot (Cloudflare/CAPTCHA): invio automatico non possibile."); }
  if (NEEDS_LOGIN.test(html)) { mode = "manuale"; reasons.push("Il portale richiede registrazione/login prima di candidarsi."); }
  const detected = detectFields(html);
  const prof = profileFrom(user);
  const mappedFields = detected.filter((f) => f.mapped && f.mapped !== "cv_upload")
    .map((f) => ({ label: f.label, key: f.mapped, value: prof[f.mapped] || "" }))
    .filter((f, i, arr) => f.value && arr.findIndex((x) => x.key === f.key) === i);
  const wantsCv = detected.some((f) => f.mapped === "cv_upload");
  const customQuestions = detected.filter((f) => f.tag === "textarea" && !f.mapped)
    .map((f) => ({ q: f.label, a: (answers.find((a) => sim(a.question, f.label)) || {}).answer || "" }));
  if (wantsCv) reasons.push("È previsto il caricamento del CV.");
  if (mappedFields.length) reasons.push(`${mappedFields.length} campi standard compilabili automaticamente.`);
  if (customQuestions.length) reasons.push(`${customQuestions.length} domande aggiuntive rilevate.`);
  return { mode, reasons, fields: mappedFields, wantsCv, questions: customQuestions };
}
function sim(a, b) { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a && b && (a.includes(b) || b.includes(a)); }

// Estrae titolo/azienda/descrizione da una pagina offerta (JSON-LD JobPosting o meta).
export function parseJobPage(html, url) {
  let title = "", company = "", description = "";
  // 1) JSON-LD JobPosting (il più affidabile).
  const blocks = [...String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const arr = Array.isArray(data) ? data : (data["@graph"] || [data]);
      const jp = arr.find((x) => x && (x["@type"] === "JobPosting" || (Array.isArray(x["@type"]) && x["@type"].includes("JobPosting"))));
      if (jp) {
        title = jp.title || title;
        company = (jp.hiringOrganization && (jp.hiringOrganization.name || jp.hiringOrganization)) || company;
        description = stripTags(jp.description || description);
        break;
      }
    } catch { /* json non valido */ }
  }
  const meta = (prop) => { const r = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']+)["\']', "i").exec(html); return r ? r[1] : ""; };
  if (!title) title = meta("og:title") || (/(<title[^>]*>)([\s\S]*?)<\/title>/i.exec(html)?.[2] || "").trim();
  if (!company) company = meta("og:site_name") || "";
  if (!description) description = stripTags(meta("og:description") || meta("description") || "");
  const host = (url.match(/^https?:\/\/([^/]+)/i) || [])[1] || "";
  if (!company && host) company = host.replace(/^www\./, "");
  return { title: (title || "Offerta").slice(0, 160), company: (company || "—").slice(0, 120), description: (description || "").slice(0, 2500) };
}

// Best-effort: prova Playwright per compilare/inviare; altrimenti kit assistito.
export async function runAutoApply({ url, user, answers = [], submit = false }) {
  if (!url) return { status: "manual", mode: "manuale", reasons: ["Nessun link di candidatura salvato per questa offerta."], fields: [], questions: [], submitted: false };
  // 1) tenta Playwright (se installato e il browser è presente).
  if (submit) {
    try {
      const { chromium } = await import("playwright-core");
      const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined }).catch(() => chromium.launch());
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        const html = await page.content();
        const kit = buildKit(html, user, answers);
        if (kit.mode === "manuale") { await browser.close(); return { status: "manual", ...kit, submitted: false }; }
        const prof = profileFrom(user);
        let filled = 0;
        for (const f of kit.fields) {
          const sel = `input[name*="${f.key}"], input[id*="${f.key}"], input[aria-label*="${f.label}"]`;
          const el = await page.$(sel).catch(() => null);
          if (el) { await el.fill(String(f.value)).catch(() => {}); filled++; }
        }
        // Non inviamo se restano domande obbligatorie senza risposta o serve il CV file.
        const blocked = kit.wantsCv || kit.questions.some((q) => !q.a);
        if (!blocked) {
          const btn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Apply"), button:has-text("Invia"), button:has-text("Candidati")').catch(() => null);
          if (btn) { await btn.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2500); }
          await browser.close();
          return { status: "submitted", mode: "auto", reasons: [`Compilati ${filled} campi e inviata la candidatura.`], fields: kit.fields, questions: kit.questions, submitted: true };
        }
        await browser.close();
        return { status: "assisted", mode: "assistita", reasons: [`Compilati ${filled} campi. ${kit.wantsCv ? "Carica il CV e conferma l'invio." : "Rispondi alle domande e conferma l'invio."}`, ...kit.reasons], fields: kit.fields, questions: kit.questions, submitted: false };
      } finally { /* browser chiuso nei rami */ }
    } catch (e) {
      // Playwright non disponibile/o errore → fallback assistito.
    }
  }
  // 2) fallback: leggi l'HTML (proxy se configurato, altrimenti fetch diretto) → kit assistito.
  let html = null;
  try { html = scraperEnabled() ? await fetchHtmlViaProxy(url) : await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text(); }
  catch (e) { return { status: "manual", mode: "manuale", reasons: [`Pagina non leggibile (${e.message}). Procedi manualmente: apri il link e candidati.`], fields: [], questions: [], submitted: false }; }
  if (!html) return { status: "manual", mode: "manuale", reasons: ["Pagina non leggibile senza un middleware di scraping. Apri il link e candidati manualmente (oppure imposta ScraperAPI/ScrapingBee)."], fields: [], questions: [], submitted: false };
  const kit = buildKit(html, user, answers);
  return { status: kit.mode === "manuale" ? "manual" : "assisted", mode: kit.mode, reasons: kit.reasons.length ? kit.reasons : ["Kit pronto: copia i dati nei campi del form e invia."], fields: kit.fields, questions: kit.questions, submitted: false };
}
