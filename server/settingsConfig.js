// Admin-editable configuration, stored as JSON on the Setting row and applied
// to process.env at boot / on save — so email.js and llm.js keep reading env,
// with the real environment variables acting as defaults/fallbacks.

import { resetTransporter } from "./email.js";

// config key -> environment variable it drives
const ENV_MAP = {
  smtpHost: "SMTP_HOST", smtpPort: "SMTP_PORT", smtpSecure: "SMTP_SECURE",
  smtpUser: "SMTP_USER", smtpPass: "SMTP_PASS", smtpFrom: "SMTP_FROM",
  llmProvider: "LLM_PROVIDER", llmApiKey: "LLM_API_KEY", llmBaseUrl: "LLM_BASE_URL", llmModel: "LLM_MODEL",
  cronSecret: "CRON_SECRET", frontendUrl: "FRONTEND_URL",
  adzunaAppId: "ADZUNA_APP_ID", adzunaAppKey: "ADZUNA_APP_KEY", joobleApiKey: "JOOBLE_API_KEY",
  findworkApiKey: "FINDWORK_API_KEY", theirstackApiKey: "THEIRSTACK_API_KEY", rapidapiKey: "RAPIDAPI_KEY",
  serpapiKey: "SERPAPI_KEY", apifyToken: "APIFY_TOKEN", apifyActorId: "APIFY_ACTOR_ID",
  brightdataApiKey: "BRIGHTDATA_API_KEY", brightdataDatasetId: "BRIGHTDATA_DATASET_ID",
  scraperapiKey: "SCRAPERAPI_KEY", scrapingbeeKey: "SCRAPINGBEE_KEY",
};
const SECRET_KEYS = ["smtpPass", "llmApiKey", "cronSecret", "adzunaAppKey", "joobleApiKey", "findworkApiKey", "theirstackApiKey", "rapidapiKey", "serpapiKey", "apifyToken", "brightdataApiKey", "scraperapiKey", "scrapingbeeKey"];

// Non-env config (read directly by the app): dailyScanHour, emailSubject, emailBody.
export const DEFAULT_TEMPLATES = {
  emailSubject: "{count} nuove offerte per te oggi su digitalfa",
  emailBody:
    "Ciao {name},\noggi ci sono {count} nuove offerte selezionate per il tuo profilo.\nVisita il tuo profilo per vederle: {link}\n\n— digitalfa",
};

export function applyConfigToEnv(config = {}) {
  for (const [k, envName] of Object.entries(ENV_MAP)) {
    const v = config[k];
    if (v !== undefined && v !== null && String(v) !== "") process.env[envName] = String(v);
  }
  resetTransporter();
}

// Rimuove DAVVERO una o più chiavi: le toglie dalla config salvata e
// cancella la variabile d'ambiente corrispondente dal processo in esecuzione
// (effetto immediato, senza riavvio). Usato per "svuotare" un segreto.
export function clearConfigKeys(config = {}, keys = []) {
  const next = { ...config };
  for (const k of keys) {
    if (!(k in ENV_MAP)) continue;
    delete next[k];
    delete process.env[ENV_MAP[k]];
  }
  resetTransporter();
  return next;
}

export async function loadConfig(prisma) {
  const st = await prisma.setting.findUnique({ where: { id: "singleton" } }).catch(() => null);
  return (st && st.config) || {};
}

export async function initConfig(prisma) {
  const config = await loadConfig(prisma);
  applyConfigToEnv(config);
  return config;
}

// Merge an incoming patch onto the stored config. Empty secret fields are
// IGNORED (so the UI can show a masked value without wiping the stored secret).
export function mergeConfig(current = {}, patch = {}) {
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (SECRET_KEYS.includes(k) && (v === "" || v == null)) continue; // keep existing secret
    next[k] = v;
  }
  return next;
}

// Safe view for the Admin UI: secrets are never echoed, only a boolean "set".
export function maskConfig(config = {}) {
  const out = {};
  for (const k of Object.keys(ENV_MAP)) if (!SECRET_KEYS.includes(k)) out[k] = config[k] ?? "";
  out.dailyScanHour = config.dailyScanHour ?? "";
  out.emailSubject = config.emailSubject ?? DEFAULT_TEMPLATES.emailSubject;
  out.emailBody = config.emailBody ?? DEFAULT_TEMPLATES.emailBody;
  out.smtpPassSet = !!config.smtpPass;
  out.llmApiKeySet = !!config.llmApiKey;
  out.cronSecretSet = !!config.cronSecret;
  out.adzunaAppKeySet = !!config.adzunaAppKey;
  out.joobleApiKeySet = !!config.joobleApiKey;
  out.findworkApiKeySet = !!config.findworkApiKey;
  out.theirstackApiKeySet = !!config.theirstackApiKey;
  out.rapidapiKeySet = !!config.rapidapiKey;
  out.serpapiKeySet = !!config.serpapiKey;
  out.apifyTokenSet = !!config.apifyToken;
  out.brightdataApiKeySet = !!config.brightdataApiKey;
  out.scraperapiKeySet = !!config.scraperapiKey;
  out.scrapingbeeKeySet = !!config.scrapingbeeKey;
  out.apifyActorId = config.apifyActorId ?? "";
  out.resourceVideos = Array.isArray(config.resourceVideos) ? config.resourceVideos : [];
  out.communications = Array.isArray(config.communications) ? config.communications : [];
  out.brightdataDatasetId = config.brightdataDatasetId ?? "";
  out.atsBoards = config.atsBoards && typeof config.atsBoards === "object" ? config.atsBoards : { greenhouse: [], lever: [], smartrecruiters: [] };
  return out;
}

export function templatesFrom(config = {}) {
  return {
    subject: config.emailSubject || DEFAULT_TEMPLATES.emailSubject,
    body: config.emailBody || DEFAULT_TEMPLATES.emailBody,
  };
}
