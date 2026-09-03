// digitalfa API — Express backend, persisted on PostgreSQL via Prisma.
// Billing via Stripe when STRIPE_SECRET_KEY is set, otherwise simulated.
// Job ingestion via pluggable connectors (real APIs + simulated fallback).

import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { fetchFromConnector, CONNECTOR_LABELS, fetchHtmlViaProxy, scraperEnabled } from "./connectors/index.js";
import { seedDb } from "./seedDb.js";
import { suggestContacts, generateMessage, generateCoverLetter, generateTailoredCv } from "./generators.js";
import { isLLMEnabled, llmProvider, llmComplete } from "./llm.js";
import { runScan, runDueScans, startTicker, dedupKey } from "./scheduler.js";
import { DIMENSIONS, DEFAULT_WEIGHTS, METHODOLOGY, computeMatch, nudgeWeights, titleTier } from "./matcher.js";
import { fetchFromConnector as fetchConn } from "./connectors/index.js";
import { scanForCandidate, runProfileScan, countNewMatchesToday, MATCH_THRESHOLD, SOURCE_LABEL } from "./candidateScan.js";
import { extractText, extractProfile } from "./cvParser.js";
import { initConfig, loadConfig, mergeConfig, maskConfig, applyConfigToEnv, templatesFrom, clearConfigKeys } from "./settingsConfig.js";
import { sendNewOffersEmail, emailEnabled, sendMail, sendResetEmail, getMailHealth } from "./email.js";
import { getComms, getComm, renderComm, DEFAULT_COMMS, TRIGGER_TYPES } from "./communications.js";
import { runAutoApply, parseJobPage } from "./autoApply.js";
import crypto from "node:crypto";
import { EXPERIENCE_LEVELS, COMPANY_TYPES, JOB_TYPES, SALARY_STEPS, SECTORS, LOCATIONS, JOB_TITLES, WORK_MODES } from "./onboardingData.js";

// map onboarding experience level → matcher seniority bucket
const EXP_TO_SENIORITY = { entry: "Junior", junior: "Junior", mid: "Mid", senior: "Senior", "5_10": "Senior", "10_plus": "Manager" };
const isCityLoc = (l) => l && !/remoto|europa|mondo|italia/i.test(l);

// Adzuna is country-scoped (…/jobs/{country}/search/…). Map a CHOSEN location
// label to the list of {country, where} searches it implies.
const EU_COUNTRIES = ["it", "gb", "de", "fr", "es", "nl"];
const WORLD_COUNTRIES = ["it", "gb", "us", "de", "fr", "ca"];
function adzunaTargets(loc) {
  const s = String(loc || "").toLowerCase();
  if (/mondo/.test(s)) return WORLD_COUNTRIES.map((c) => ({ country: c, where: "" }));
  if (/europa/.test(s)) return EU_COUNTRIES.map((c) => ({ country: c, where: "" }));
  if (/remoto/.test(s)) return [{ country: "it", where: "", remote: true }, { country: "gb", where: "", remote: true }];
  if (/italia/.test(s)) return [{ country: "it", where: "" }];
  return [{ country: "it", where: loc }];          // specific Italian city
}

async function effectiveWeights(userId) {
  const pref = await prisma.matchPref.findUnique({ where: { userId } }).catch(() => null);
  return pref?.weights || DEFAULT_WEIGHTS;
}

export const APP_VERSION = "1.36.2";
const LLM_ON = isLLMEnabled();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "digitalfa-dev-secret-change-me";
const LINKEDIN = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/api/auth/linkedin/callback`,
};
const LINKEDIN_LIVE = !!(LINKEDIN.clientId && LINKEDIN.clientSecret);

// Milestone template (configuration, not data)
const MILESTONES = [
  { key: "onboarding", label: "Onboarding & assessment" },
  { key: "cv", label: "CV & profilo LinkedIn" },
  { key: "strategy", label: "Strategia di ricerca" },
  { key: "applications", label: "Candidature attive" },
  { key: "interviews", label: "Colloqui" },
  { key: "offer", label: "Offerta & ricollocamento" },
];

// ---- Stripe (optional) ----
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY); console.log("Stripe attivo (reale)"); }
  catch (e) { console.warn("Stripe non inizializzato:", e.message); }
}
const LIVE_BILLING = !!stripe;

app.use(cors());
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!LIVE_BILLING) return res.json({ received: true });
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());
  } catch (err) { return res.status(400).send(`Webhook error: ${err.message}`); }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const { ownerType, ownerId, planId } = s.metadata || {};
    await activateSubscription({ ownerType, ownerId, planId, stripeCustomerId: s.customer, stripeSubscriptionId: s.subscription });
  }
  res.json({ received: true });
});
app.use(express.json({ limit: "14mb" }));

// ---- helpers ----
let seq = 1000;
const nid = (p) => `${p}-${Date.now()}-${++seq}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

// Estrae fino a 5 requisiti sintetici dal testo dell'annuncio (euristica, no LLM).
function extractRequirements(desc) {
  const t = String(desc || "");
  if (!t) return [];
  const sec = t.match(/(requisiti|requirements|cosa cerchiamo|what you.?ll need|your profile|competenze richieste|qualifications|chi sei)[:\s-]*/i);
  const seg = sec ? t.slice(sec.index + sec[0].length) : t;
  let parts = seg.split(/[\n•·]|(?:^|\s)[-–]\s|;/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) parts = seg.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const cue = /(esperienza|anni|laurea|conoscenz|competenz|capacità|richiest|required|proficien|knowledge|skills?|degree|years|fluent|lingua|inglese|padronanz)/i;
  const clean = parts.filter((p) => p.length >= 12 && p.length <= 140);
  const cued = clean.filter((p) => cue.test(p));
  return (cued.length ? cued : clean).slice(0, 5).map((p) => p.replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").slice(0, 130));
}
// Etichetta della fonte di un'offerta del motore (che non ha una riga Source).
// La deduciamo dal prefisso dell'externalId assegnato dal connettore.
const EXT_SOURCE = { remotive: "Remotive", remoteok: "RemoteOK", jobicy: "Jobicy", jobdata: "jobdataapi", arbeitsagentur: "Arbeitsagentur", findwork: "Findwork", theirstack: "TheirStack", jsearch: "JSearch" };
function sourceLabelOf(job, sourcesById) {
  if (job.sourceId) return (sourcesById && sourcesById.get(job.sourceId)) || "Fonte manuale";
  const ext = String(job.externalId || "");
  const pfx = ext.includes(":") ? ext.slice(0, ext.indexOf(":")) : "";
  if (EXT_SOURCE[pfx]) return EXT_SOURCE[pfx];
  if (/^[a-z]{2}$/.test(pfx)) return "Adzuna";           // externalId Adzuna = "it:123", "gb:456"…
  if (ext.startsWith("sim-")) return "Simulato";
  if (/^(li|in)-/.test(ext)) return "Demo";
  if (job.origin === "hr_upload") return "Caricata da HR";
  return null;
}
// È un'offerta demo/simulata (da eliminare col "pulisci bacino")?
function isSimulatedJob(job) {
  const ext = String(job.externalId || "");
  if (ext.startsWith("sim-")) return true;
  if (/^(li|in)-\d/.test(ext)) return true;              // seed demo LinkedIn/Indeed
  if (job.origin === "hr_upload") return true;           // offerte demo caricate da HR nel seed
  if (job.sourceId) return true;                          // seed/fonti manuali demo (il motore usa sourceId null)
  if (!ext) return true;                                  // senza id esterno = non proviene da un portale reale
  if (/simulat/i.test(String(job.description || ""))) return true;
  return false;
}
// Normalizza la lista dei board ATS salvata in config → { greenhouse:[], lever:[], smartrecruiters:[] }
function atsBoardsFrom(config = {}) {
  const src = (config && config.atsBoards && typeof config.atsBoards === "object") ? config.atsBoards : {};
  const norm = (a) => Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean) : (typeof a === "string" ? a.split(/[\s,;\n]+/).map((x) => x.trim()).filter(Boolean) : []);
  return { greenhouse: norm(src.greenhouse), lever: norm(src.lever), smartrecruiters: norm(src.smartrecruiters) };
}
const addDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const addHoursISO = (h) => new Date(Date.now() + h * 3600000).toISOString();
const publicUser = (u) => { if (!u) return u; const { password, ...rest } = u; return rest; };
// A user is currently blocked if blockedUntil is set and still in the future.
const blockActive = (u) => !!(u && u.blockedUntil && new Date(u.blockedUntil).getTime() > Date.now());
const blockMsg = (u) => `Account sospeso fino al ${new Date(u.blockedUntil).toLocaleString("it-IT")}`;

function makeToken(userId) { return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" }); }
function parseToken(t) { try { return jwt.verify(t, JWT_SECRET).sub; } catch { return null; } }
async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await prisma.user.findUnique({ where: { id: parseToken(token) || "__none__" } });
  if (!user) return res.status(401).json({ error: "Non autenticato" });
  if (blockActive(user)) return res.status(403).json({ error: blockMsg(user) });
  req.user = user;
  next();
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Accesso negato per questo ruolo" });
// async handler wrapper
const h = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message }); });

async function candidateCard(c) {
  const [progress, coach, company, program, appsCount] = await Promise.all([
    prisma.progress.findMany({ where: { userId: c.id } }),
    c.coachId ? prisma.user.findUnique({ where: { id: c.coachId } }) : null,
    c.companyId ? prisma.company.findUnique({ where: { id: c.companyId } }) : null,
    c.programId ? prisma.program.findUnique({ where: { id: c.programId } }) : null,
    prisma.application.count({ where: { candidateId: c.id } }),
  ]);
  const done = progress.filter((p) => p.status === "done").length;
  return { ...publicUser(c), progressPct: Math.round((done / MILESTONES.length) * 100), coachName: coach?.name || null, companyName: company?.name || null, programName: program?.name || null, applicationsCount: appsCount };
}
async function milestonesFor(userId) {
  const prog = await prisma.progress.findMany({ where: { userId } });
  const map = Object.fromEntries(prog.map((p) => [p.key, p.status]));
  return MILESTONES.map((m) => ({ ...m, status: map[m.key] || "todo" }));
}
async function planById(id) { return prisma.plan.findUnique({ where: { id } }); }
async function subView(sub) {
  if (!sub) return null;
  const plan = await planById(sub.planId);
  const { cardBrand, cardLast4, cardExpMonth, cardExpYear, ...rest } = sub;
  return { ...rest, card: cardBrand ? { brand: cardBrand, last4: cardLast4, expMonth: cardExpMonth, expYear: cardExpYear } : null, plan };
}
function billingOwnerFor(user) {
  if (user.role === "hr") return { ownerType: "company", ownerId: user.companyId };
  if (user.role === "candidate") return { ownerType: "user", ownerId: user.id };
  return null;
}
const findSub = (ownerType, ownerId) => prisma.subscription.findUnique({ where: { ownerType_ownerId: { ownerType, ownerId } } });
async function activateSubscription({ ownerType, ownerId, planId, stripeCustomerId = null, stripeSubscriptionId = null, card = null, voucher = null }) {
  const plan = await planById(planId);
  const base = {
    planId, status: "active", currentPeriodEnd: addDays(30), cancelAtPeriodEnd: false,
    provider: LIVE_BILLING ? "stripe" : "simulated",
    ...(stripeCustomerId ? { stripeCustomerId } : {}), ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    ...(card ? { cardBrand: card.brand, cardLast4: card.last4, cardExpMonth: card.expMonth, cardExpYear: card.expYear } : {}),
    voucherCode: voucher ? voucher.code : null,
    discountPercent: voucher ? voucher.percent : null,
    freeUntil: (voucher && voucher.percent >= 100) ? addDays(voucher.durationDays || 30) : null,
  };
  const sub = await prisma.subscription.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    update: base,
    create: { id: nid("sub"), ownerType, ownerId, startedAt: today(), cardBrand: "Visa", cardLast4: "4242", cardExpMonth: 12, cardExpYear: 2028, ...base },
  });
  if (ownerType === "company" && plan) await prisma.company.update({ where: { id: ownerId }, data: { plan: plan.name, ...(plan.seats ? { seatsTotal: plan.seats } : {}) } });
  if (ownerType === "user") {
    const u = await prisma.user.findUnique({ where: { id: ownerId } }).catch(() => null);
    if (u) { fireCommEvent("on_subscription_active", u, { plan: plan?.name || "" }); creditReferrer(u).catch(() => {}); }
  }
  return sub;
}
// Premia il referrer con 2 settimane gratis quando l'amico attiva (una sola volta per amico).
async function creditReferrer(referredUser) {
  if (!referredUser?.referredBy) return;
  const rr = await prisma.referral.findFirst({ where: { referrerId: referredUser.referredBy, referredUserId: referredUser.id } }).catch(() => null);
  if (rr && rr.status === "rewarded") return;                        // già premiato
  const now = new Date();
  const refSub = await prisma.subscription.findUnique({ where: { ownerType_ownerId: { ownerType: "user", ownerId: referredUser.referredBy } } }).catch(() => null);
  const baseDate = refSub && refSub.freeUntil && new Date(refSub.freeUntil) > now ? new Date(refSub.freeUntil)
    : refSub && refSub.currentPeriodEnd && new Date(refSub.currentPeriodEnd) > now ? new Date(refSub.currentPeriodEnd) : now;
  const newFree = new Date(baseDate.getTime() + REFERRAL_REWARD_DAYS * 86400000).toISOString().slice(0, 10);
  if (refSub) await prisma.subscription.update({ where: { id: refSub.id }, data: { freeUntil: newFree } }).catch(() => {});
  else await prisma.subscription.create({ data: { id: nid("sub"), ownerType: "user", ownerId: referredUser.referredBy, planId: "ind_weekly", status: "active", provider: "simulated", startedAt: today(), currentPeriodEnd: addDays(REFERRAL_REWARD_DAYS), freeUntil: newFree } }).catch(() => {});
  if (rr) await prisma.referral.update({ where: { id: rr.id }, data: { status: "rewarded", rewardedAt: now.toISOString() } }).catch(() => {});
  // Notifica al referrer (riusa una comunicazione se attiva).
  const referrer = await prisma.user.findUnique({ where: { id: referredUser.referredBy } }).catch(() => null);
  if (referrer) { try { await sendMail({ to: referrer.email, subject: "Hai guadagnato 2 settimane gratis su digitalfa 🎉", text: `Ciao ${referrer.name},\nun tuo invito ha attivato un abbonamento: ti abbiamo accreditato 2 settimane gratis.\nGrazie per aver fatto crescere digitalfa!` }); } catch (e) { /* non bloccante */ } }
}

// ==================================================================
// Public
// ==================================================================
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "digitalfa-api", version: APP_VERSION, db: "postgres", liveBilling: LIVE_BILLING, linkedin: LINKEDIN_LIVE, llm: LLM_ON ? llmProvider() : false }));
app.get("/api/version", (_req, res) => res.json({ version: APP_VERSION }));
app.get("/api/plans", h(async (_req, res) => res.json(await prisma.plan.findMany({ orderBy: { price: "asc" } }))));
app.get("/api/demo-accounts", h(async (_req, res) => {
  const out = [];
  for (const role of ["candidate", "coach", "hr", "admin"]) {
    const u = await prisma.user.findFirst({ where: { role, authProvider: "password" }, orderBy: { id: "asc" } });
    if (u) out.push({ role, email: u.email, password: "demo", name: u.name });
  }
  res.json(out);
}));

app.post("/api/login", h(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase() } });
  if (!user || !user.password || !bcrypt.compareSync(String(password || ""), user.password))
    return res.status(401).json({ error: "Credenziali non valide" });
  if (blockActive(user)) return res.status(403).json({ error: blockMsg(user) });
  res.json({ token: makeToken(user.id), user: publicUser(user) });
}));

app.post("/api/register", h(async (req, res) => {
  const { mode, name, email, password, planId, companyName } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, email e password sono obbligatori" });
  if (await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })) return res.status(409).json({ error: "Esiste già un account con questa email" });
  const plan = await planById(planId);
  if (!plan) return res.status(400).json({ error: "Piano non valido" });
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const pwHash = bcrypt.hashSync(String(password), 10);
  let user, ownerType, ownerId;
  if (mode === "company") {
    if (!companyName) return res.status(400).json({ error: "Nome azienda obbligatorio" });
    const company = await prisma.company.create({ data: { id: nid("co"), name: companyName, logo: initials, plan: plan.name, seatsTotal: plan.seats || 0, activeSince: today() } });
    user = await prisma.user.create({ data: { id: nid("u"), role: "hr", name, email: String(email).toLowerCase(), password: pwHash, title: "HR", avatar: initials, companyId: company.id } });
    ownerType = "company"; ownerId = company.id;
  } else {
    user = await prisma.user.create({ data: { id: nid("u"), role: "candidate", name, email: String(email).toLowerCase(), password: pwHash, title: "In cerca di lavoro", avatar: initials, status: "active", enrolledAt: today() } });
    ownerType = "user"; ownerId = user.id;
  }
  const token = makeToken(user.id);
  if (plan.price === 0) { await activateSubscription({ ownerType, ownerId, planId }); return res.status(201).json({ token, user: publicUser(user), checkout: { activated: true } }); }
  if (plan.contact) return res.status(201).json({ token, user: publicUser(user), checkout: { contactSales: true } });
  res.status(201).json({ token, user: publicUser(user), checkout: { needsPayment: true, planId } });
}));

// Free self-service signup from the home page: email + username + password +
// intent. No plan required — subscriptions are handled later in the dashboard.
const INTENT_ROLE = { job_seeker: "candidate", employer: "hr", referral: "referral" };
app.post("/api/signup", h(async (req, res) => {
  const { email, username, password, intent, acceptTerms, ref } = req.body || {};
  const role = INTENT_ROLE[intent];
  if (!email || !username || !password) return res.status(400).json({ error: "Email, username e password sono obbligatori" });
  if (!role) return res.status(400).json({ error: "Seleziona cosa vuoi fare: cerco lavoro, azienda/HR o referral" });
  if (!acceptTerms) return res.status(400).json({ error: "Devi accettare i Termini e condizioni per registrarti." });
  const em = String(email).toLowerCase();
  if (await prisma.user.findUnique({ where: { email: em } })) return res.status(409).json({ error: "Esiste già un account con questa email" });
  const initials = String(username).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const pwHash = bcrypt.hashSync(String(password), 10);
  const base = { id: nid("u"), name: username, username, email: em, password: pwHash, avatar: initials, authProvider: "password", status: "active", enrolledAt: today(), acceptedTermsAt: new Date().toISOString() };
  let user;
  if (role === "hr") {
    const company = await prisma.company.create({ data: { id: nid("co"), name: `${username} — azienda`, logo: initials, plan: "Free", seatsTotal: 0, activeSince: today() } });
    user = await prisma.user.create({ data: { ...base, role: "hr", title: "Azienda · HR", companyId: company.id } });
  } else if (role === "referral") {
    user = await prisma.user.create({ data: { ...base, role: "referral", title: "Referral aziendale" } });
  } else {
    // Referral: se arriva con un codice valido, collega il nuovo candidato al referrer.
    let referredBy = null;
    if (ref) { const r = await prisma.user.findUnique({ where: { referralCode: String(ref).trim().toUpperCase() } }).catch(() => null); if (r && r.id) referredBy = r.id; }
    user = await prisma.user.create({ data: { ...base, role: "candidate", title: "In cerca di lavoro", onboarded: false, referredBy } });
    if (referredBy) {
      const existing = await prisma.referral.findFirst({ where: { referrerId: referredBy, email: em } }).catch(() => null);
      if (existing) await prisma.referral.update({ where: { id: existing.id }, data: { status: "registered", referredUserId: user.id } }).catch(() => {});
      else await prisma.referral.create({ data: { id: nid("ref"), referrerId: referredBy, code: String(ref).trim().toUpperCase(), email: em, referredUserId: user.id, status: "registered", invitedAt: new Date().toISOString() } }).catch(() => {});
    }
  }
  res.status(201).json({ token: makeToken(user.id), user: publicUser(user) });
}));

// Password reset: request a link (always responds ok — no account enumeration).
app.post("/api/auth/forgot", h(async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user && user.password) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpires: expires } });
    const link = `${process.env.FRONTEND_URL || FRONTEND_URL}/#/reset?token=${token}`;
    try { await sendResetEmail(user, link); } catch (e) { /* non blocca */ }
    if (!emailEnabled()) console.log(`[reset] link per ${email}: ${link}`);
  }
  res.json({ ok: true });
}));
// Password reset: set a new password from a valid token.
app.post("/api/auth/reset", h(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Token e nuova password obbligatori" });
  if (String(password).length < 6) return res.status(400).json({ error: "La password deve avere almeno 6 caratteri" });
  const user = await prisma.user.findFirst({ where: { resetToken: String(token) } });
  if (!user || !user.resetExpires || new Date(user.resetExpires).getTime() < Date.now())
    return res.status(400).json({ error: "Link non valido o scaduto. Richiedi un nuovo reset." });
  await prisma.user.update({ where: { id: user.id }, data: { password: bcrypt.hashSync(String(password), 10), resetToken: null, resetExpires: null } });
  res.json({ ok: true });
}));

app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

// ---- LinkedIn OAuth (real when creds set, else simulated) ----
async function upsertLinkedinUser({ linkedinId, name, email }) {
  let user = null;
  if (linkedinId) user = await prisma.user.findUnique({ where: { linkedinId } });
  if (!user && email) user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) return user;
  const initials = (name || "LinkedIn").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return prisma.user.create({ data: { id: nid("u"), role: "candidate", name: name || "Utente LinkedIn", email: (email || `linkedin-${Date.now()}@digitalfa.demo`).toLowerCase(), password: "", authProvider: "linkedin", linkedinId: linkedinId || null, title: "In cerca di lavoro", avatar: initials, status: "active", enrolledAt: today() } });
}

app.get("/api/auth/linkedin/start", h(async (_req, res) => {
  if (!LINKEDIN_LIVE) return res.json({ simulated: true });
  const state = jwt.sign({ t: "li" }, JWT_SECRET, { expiresIn: "10m" });
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(LINKEDIN.clientId)}&redirect_uri=${encodeURIComponent(LINKEDIN.redirectUri)}&scope=${encodeURIComponent("openid profile email")}&state=${state}`;
  res.json({ url });
}));

app.get("/api/auth/linkedin/callback", h(async (req, res) => {
  if (!LINKEDIN_LIVE) return res.redirect(`${FRONTEND_URL}/#/?linkedin=unconfigured`);
  const { code } = req.query;
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: LINKEDIN.redirectUri, client_id: LINKEDIN.clientId, client_secret: LINKEDIN.clientSecret });
  const tok = await (await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body })).json();
  const info = await (await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
  const user = await upsertLinkedinUser({ linkedinId: info.sub, name: info.name, email: info.email });
  res.redirect(`${FRONTEND_URL}/#/auth?token=${makeToken(user.id)}`);
}));

// Simulated LinkedIn login (demo / no creds)
app.post("/api/auth/linkedin/simulate", h(async (_req, res) => {
  const user = await upsertLinkedinUser({ linkedinId: "li-demo-user", name: "Giorgia De Luca", email: "giorgia.linkedin@digitalfa.demo" });
  res.json({ token: makeToken(user.id), user: publicUser(user) });
}));

// ==================================================================
// Billing
// ==================================================================
app.get("/api/billing/subscription", auth, h(async (req, res) => {
  const owner = billingOwnerFor(req.user);
  if (!owner) return res.json({ subscription: null, plans: await prisma.plan.findMany() });
  const sub = await findSub(owner.ownerType, owner.ownerId);
  const audience = owner.ownerType === "company" ? "company" : "individual";
  let covered = null;
  if (req.user.role === "candidate" && req.user.companyId) covered = (await prisma.company.findUnique({ where: { id: req.user.companyId } }))?.name || null;
  res.json({ subscription: await subView(sub), owner, coveredByCompany: covered, plans: await prisma.plan.findMany({ where: { audience }, orderBy: { price: "asc" } }), liveBilling: LIVE_BILLING });
}));

app.post("/api/billing/checkout", auth, h(async (req, res) => {
  const plan = await planById(req.body?.planId);
  if (!plan) return res.status(400).json({ error: "Piano non valido" });
  const owner = billingOwnerFor(req.user);
  if (!owner) return res.status(403).json({ error: "Ruolo senza abbonamento" });
  if (plan.contact) return res.json({ contactSales: true });
  if (LIVE_BILLING) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [plan.priceId ? { price: plan.priceId, quantity: 1 } : { quantity: 1, price_data: { currency: "eur", recurring: { interval: plan.interval }, unit_amount: plan.price * 100, product_data: { name: `digitalfa ${plan.name}` } } }],
      success_url: `${FRONTEND_URL}/#/billing?success=1`, cancel_url: `${FRONTEND_URL}/#/billing?canceled=1`,
      metadata: { ownerType: owner.ownerType, ownerId: owner.ownerId, planId: plan.id },
    });
    return res.json({ url: session.url, sessionId: session.id });
  }
  res.json({ simulated: true, planId: plan.id });
}));

// Valida un codice sconto (voucher) prima del pagamento.
async function validateVoucher(code) {
  if (!code) return null;
  const v = await prisma.voucher.findUnique({ where: { code: String(code).trim().toUpperCase() } }).catch(() => null);
  if (!v || !v.active) return { error: "Codice non valido o disattivato." };
  if (v.maxRedemptions != null && v.redeemedCount >= v.maxRedemptions) return { error: "Codice esaurito." };
  return { voucher: v };
}
app.post("/api/billing/apply-voucher", auth, h(async (req, res) => {
  const r = await validateVoucher(req.body?.code);
  if (!r) return res.status(400).json({ error: "Inserisci un codice." });
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.voucher;
  res.json({ ok: true, code: v.code, percent: v.percent, durationDays: v.durationDays, free: v.percent >= 100 });
}));

app.post("/api/billing/confirm", auth, h(async (req, res) => {
  if (LIVE_BILLING) return res.status(400).json({ error: "In modalità Stripe reale la conferma avviene via webhook" });
  const { planId, card, voucherCode } = req.body || {};
  if (!(await planById(planId))) return res.status(400).json({ error: "Piano non valido" });
  const owner = billingOwnerFor(req.user);
  let voucher = null;
  if (voucherCode) { const r = await validateVoucher(voucherCode); if (r && r.voucher) voucher = r.voucher; }
  const sub = await activateSubscription({ ownerType: owner.ownerType, ownerId: owner.ownerId, planId, card: card ? { brand: card.brand || "Visa", last4: (card.number || "4242").slice(-4), expMonth: card.expMonth || 12, expYear: card.expYear || 2028 } : null, voucher });
  if (voucher) await prisma.voucher.update({ where: { id: voucher.id }, data: { redeemedCount: { increment: 1 } } }).catch(() => {});
  res.json({ subscription: await subView(sub) });
}));

app.post("/api/billing/cancel", auth, h(async (req, res) => {
  const owner = billingOwnerFor(req.user);
  const sub = await findSub(owner.ownerType, owner.ownerId);
  if (!sub) return res.status(404).json({ error: "Nessun abbonamento attivo" });
  const upd = await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  if (owner.ownerType === "user") fireCommEvent("on_subscription_canceled", req.user, { link: `${FRONTEND_URL}/#/app/billing` });
  res.json({ subscription: await subView(upd) });
}));
app.post("/api/billing/resume", auth, h(async (req, res) => {
  const owner = billingOwnerFor(req.user);
  const sub = await findSub(owner.ownerType, owner.ownerId);
  if (!sub) return res.status(404).json({ error: "Nessun abbonamento" });
  const upd = await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false } });
  res.json({ subscription: await subView(upd) });
}));
app.post("/api/billing/portal", auth, h(async (req, res) => {
  const owner = billingOwnerFor(req.user);
  const sub = await findSub(owner.ownerType, owner.ownerId);
  if (LIVE_BILLING && sub?.stripeCustomerId) {
    const portal = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${FRONTEND_URL}/#/billing` });
    return res.json({ url: portal.url });
  }
  res.json({ simulated: true });
}));

// ==================================================================
// CANDIDATE
// ==================================================================
app.get("/api/candidate/overview", auth, requireRole("candidate"), h(async (req, res) => {
  const c = req.user;
  const milestones = await milestonesFor(c.id);
  const done = milestones.filter((m) => m.status === "done").length;
  const coach = c.coachId ? await prisma.user.findUnique({ where: { id: c.coachId } }) : null;
  const program = c.programId ? await prisma.program.findUnique({ where: { id: c.programId } }) : null;
  const sessions = (await prisma.session.findMany({ where: { candidateId: c.id } })).sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextSession = sessions.find((s) => s.status === "scheduled") || null;
  const apps = await prisma.application.findMany({ where: { candidateId: c.id }, include: { job: true } });
  res.json({ profile: publicUser(c), program, coach: publicUser(coach), milestones, progressPct: Math.round((done / milestones.length) * 100), nextSession, sessions, applications: apps });
}));

app.get("/api/candidate/jobs", auth, requireRole("candidate"), h(async (req, res) => {
  const c = req.user;
  const weights = await effectiveWeights(c.id);
  // Offerte del bacino condiviso + eventuali offerte "manuali" di questo candidato.
  const jobs = await prisma.job.findMany({ where: { status: "active", OR: [{ ownerUserId: null }, { ownerUserId: c.id }] } });
  // Traccia la visita (per il sollecito "dopo 8 ore" se non ha aperto le offerte).
  prisma.user.update({ where: { id: c.id }, data: { lastOffersVisitAt: new Date().toISOString() } }).catch(() => {});
  const myApps = await prisma.application.findMany({ where: { candidateId: c.id } });
  const appliedSet = new Set(myApps.map((a) => a.jobId));
  // Solo le offerte COMPATIBILI (sopra soglia): non tutto il magazzino.
  const desired = (c.desiredTitles && c.desiredTitles.length) ? c.desiredTitles : (c.title ? [c.title] : []);
  const scored = jobs.map((j) => {
    const { score, breakdown } = computeMatch(c, j, weights);
    const manual = j.ownerUserId === c.id;
    return { ...j, match: score, breakdown, applied: appliedSet.has(j.id), requirements: extractRequirements(j.description), titleTier: titleTier(desired, j.title), manual };
  }).filter((j) => j.manual || j.match >= MATCH_THRESHOLD).sort((a, b) => b.match - a.match).slice(0, 300);
  const st = await getSettings();
  const cfg = st.config || {};
  const scan = {
    scheduledHour: (cfg.dailyScanHour !== undefined && cfg.dailyScanHour !== "") ? parseInt(cfg.dailyScanHour, 10) : null,
    doneToday: st.lastDailyScanDate === today(),
    today: today(),
  };
  // Banner in-app "poche offerte": se il candidato ha meno di N offerte da almeno M giorni.
  let lowOffers = null;
  const lo = getComm(cfg, "low_offers");
  if (lo && lo.enabled !== false && lo.channel === "inapp") {
    const threshold = parseInt(lo.trigger?.threshold, 10) || 10;
    const minDays = parseInt(lo.trigger?.minDays, 10) || 1;
    const age = c.enrolledAt ? Math.floor((new Date(today() + "T00:00:00Z") - new Date(String(c.enrolledAt).slice(0, 10) + "T00:00:00Z")) / 86400000) : 0;
    if (scored.length < threshold && age >= minDays) lowOffers = { title: lo.subject, message: lo.body };
  }
  res.json({ offers: scored, scan, lowOffers });
}));

// Matching methodology (shared by admin view and candidate "perché")
app.get("/api/match/config", auth, h(async (_req, res) => {
  res.json({ dimensions: DIMENSIONS, defaultWeights: DEFAULT_WEIGHTS, methodology: METHODOLOGY });
}));

// Admin overview of the matcher: methodology + feedback stats + customisation count
app.get("/api/admin/match-overview", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const fb = await prisma.matchFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  const byVerdict = fb.reduce((a, f) => { a[f.verdict] = (a[f.verdict] || 0) + 1; return a; }, {});
  const customised = await prisma.matchPref.count();
  // Statistica "pollice giù": conteggio per motivo + ultimi con dettaglio offerta.
  const downs = fb.filter((f) => f.verdict === "down");
  const downReasons = {};
  downs.forEach((d) => { const r = (d.note || "Nessun motivo").trim(); downReasons[r] = (downReasons[r] || 0) + 1; });
  const jobIds = [...new Set(downs.slice(0, 20).map((d) => d.jobId))];
  const jobsForDown = jobIds.length ? await prisma.job.findMany({ where: { id: { in: jobIds } } }) : [];
  const jobMap = new Map(jobsForDown.map((j) => [j.id, j]));
  const recentDowns = downs.slice(0, 20).map((d) => ({ createdAt: d.createdAt, note: d.note, title: jobMap.get(d.jobId)?.title || "—", company: jobMap.get(d.jobId)?.company || "" }));
  res.json({
    dimensions: DIMENSIONS, defaultWeights: DEFAULT_WEIGHTS, methodology: METHODOLOGY,
    feedback: { total: fb.length, byVerdict, recent: fb.slice(0, 8) },
    downStats: { total: downs.length, reasons: Object.entries(downReasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), recent: recentDowns },
    customisedCandidates: customised,
  });
}));

// Admin: per-candidate activity — matched offers (by score) + applications sent.
app.get("/api/admin/candidate-activity", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const candidates = await prisma.user.findMany({ where: { role: "candidate" } });
  const jobs = await prisma.job.findMany({ where: { status: "active" } });
  const apps = await prisma.application.findMany();
  const appsByCand = apps.reduce((m, a) => { (m[a.candidateId] ||= []).push(a); return m; }, {});
  const rows = [];
  for (const c of candidates) {
    const weights = (await prisma.matchPref.findUnique({ where: { userId: c.id } }).catch(() => null))?.weights || DEFAULT_WEIGHTS;
    let high = 0, mid = 0, matched = 0, best = 0;
    for (const j of jobs) {
      const s = computeMatch(c, j, weights).score;
      if (s >= MATCH_THRESHOLD) { matched++; if (s >= 75) high++; else mid++; }
      if (s > best) best = s;
    }
    rows.push({
      id: c.id, name: c.name, email: c.email, onboarded: !!c.onboarded, cvUploaded: !!c.cvUploadedAt,
      matched, high, mid, bestMatch: best,
      applications: (appsByCand[c.id] || []).length,
    });
  }
  rows.sort((a, b) => b.matched - a.matched);
  const st = await getSettings();
  const scanHistory = (st.scanHistory && Array.isArray(st.scanHistory)) ? st.scanHistory.slice(0, 14) : [];
  res.json({ candidates: rows, threshold: MATCH_THRESHOLD, totalActiveJobs: jobs.length, scanHistory });
}));

// Admin: detail for one candidate — the matched offers ranked, with "applied" flag.
app.get("/api/admin/candidate-activity/:id", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const c = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!c || c.role !== "candidate") return res.status(404).json({ error: "Candidato non trovato" });
  const weights = (await prisma.matchPref.findUnique({ where: { userId: c.id } }).catch(() => null))?.weights || DEFAULT_WEIGHTS;
  const jobs = await prisma.job.findMany({ where: { status: "active" } });
  const apps = await prisma.application.findMany({ where: { candidateId: c.id } });
  const appliedJobIds = new Set(apps.map((a) => a.jobId));
  const sources = await prisma.source.findMany();
  const byId = new Map(sources.map((s) => [s.id, s.name]));
  const scored = jobs.map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location, firstSeenAt: j.firstSeenAt,
    match: computeMatch(c, j, weights).score, applied: appliedJobIds.has(j.id), url: j.url || null,
    source: sourceLabelOf(j, byId),
  })).filter((j) => j.match >= MATCH_THRESHOLD).sort((a, b) => b.match - a.match);
  // Ripartizione per giorno (data di comparsa) delle offerte compatibili → una mini-tabella per utente.
  const dayMap = {};
  for (const o of scored) { const d = (o.firstSeenAt || "").slice(0, 10) || "—"; (dayMap[d] ||= { date: d, matched: 0, applied: 0 }); dayMap[d].matched++; if (o.applied) dayMap[d].applied++; }
  const byDay = Object.values(dayMap).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 21);
  res.json({
    candidate: { id: c.id, name: c.name, email: c.email, onboarded: !!c.onboarded, cvUploaded: !!c.cvUploadedAt, desiredTitles: c.desiredTitles || [] },
    offers: scored, byDay, threshold: MATCH_THRESHOLD, applications: apps.length,
  });
}));

// Candidate's personal weights (override or defaults)
app.get("/api/candidate/match-prefs", auth, requireRole("candidate"), h(async (req, res) => {
  const pref = await prisma.matchPref.findUnique({ where: { userId: req.user.id } });
  res.json({ weights: pref?.weights || DEFAULT_WEIGHTS, customized: !!pref, defaults: DEFAULT_WEIGHTS, dimensions: DIMENSIONS });
}));
app.put("/api/candidate/match-prefs", auth, requireRole("candidate"), h(async (req, res) => {
  const weights = req.body?.weights || DEFAULT_WEIGHTS;
  const clean = {};
  DIMENSIONS.forEach((d) => { clean[d.key] = Math.max(0, Math.min(100, Number(weights[d.key]) || 0)); });
  const pref = await prisma.matchPref.upsert({
    where: { userId: req.user.id },
    update: { weights: clean, updatedAt: new Date().toISOString() },
    create: { userId: req.user.id, weights: clean, updatedAt: new Date().toISOString() },
  });
  res.json({ weights: pref.weights });
}));
app.post("/api/candidate/match-prefs/reset", auth, requireRole("candidate"), h(async (req, res) => {
  await prisma.matchPref.deleteMany({ where: { userId: req.user.id } });
  res.json({ weights: DEFAULT_WEIGHTS });
}));

// Candidate feedback on a single offer's score → nudges THEIR weights only
app.post("/api/candidate/job/:id/feedback", auth, requireRole("candidate"), h(async (req, res) => {
  const { verdict, note } = req.body || {};
  if (!["too_high", "too_low", "good", "down"].includes(verdict)) return res.status(400).json({ error: "Verdict non valido" });
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  await prisma.matchFeedback.create({ data: { userId: req.user.id, jobId: job.id, verdict, note: note || null, createdAt: new Date().toISOString() } });
  // Il "pollice giù" registra solo il motivo (statistica), non tocca i pesi.
  if (verdict === "down") return res.json({ ok: true, recorded: true });
  const current = await effectiveWeights(req.user.id);
  const { breakdown } = computeMatch(req.user, job, current);
  const nudged = nudgeWeights(current, breakdown, verdict);
  if (verdict !== "good") {
    await prisma.matchPref.upsert({
      where: { userId: req.user.id },
      update: { weights: nudged, updatedAt: new Date().toISOString() },
      create: { userId: req.user.id, weights: nudged, updatedAt: new Date().toISOString() },
    });
  }
  res.json({ ok: true, weights: nudged });
}));

// Onboarding options for the wizard
app.get("/api/onboarding/options", auth, h(async (_req, res) => {
  res.json({ titles: JOB_TITLES, sectors: SECTORS, experienceLevels: EXPERIENCE_LEVELS, companyTypes: COMPANY_TYPES, jobTypes: JOB_TYPES, salarySteps: SALARY_STEPS, locations: LOCATIONS, workModes: WORK_MODES });
}));

// Upload a CV (base64 in JSON): extract text + structured profile.
// The candidate reviews/edits the extracted fields before they're saved.
app.post("/api/candidate/cv", auth, requireRole("candidate"), h(async (req, res) => {
  const { fileName, dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: "File CV mancante" });
  const b64 = String(dataBase64).replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) return res.status(400).json({ error: "File CV vuoto o non valido" });
  if (buffer.length > 10 * 1024 * 1024) return res.status(413).json({ error: "CV troppo grande (max 10 MB)" });
  let text = "";
  try { text = await extractText(buffer, fileName || ""); }
  catch (e) { return res.status(422).json({ error: `Non riesco a leggere il file (${e.message}). Usa PDF o DOCX, oppure inserisci i dati a mano.` }); }
  if (!text.trim()) return res.status(422).json({ error: "Nessun testo estratto dal CV (potrebbe essere una scansione-immagine). Inserisci i dati a mano." });
  const extracted = await extractProfile(text);
  await prisma.user.update({ where: { id: req.user.id }, data: { cvFileName: fileName || "cv", cvText: text.slice(0, 20000), cvUploadedAt: new Date().toISOString() } });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ ok: true, extracted, user: publicUser(user) });
}));

// Save candidate onboarding profile + auto-scan built from the profile
app.post("/api/candidate/onboarding", auth, requireRole("candidate"), h(async (req, res) => {
  const b = req.body || {};
  const desiredTitles = (b.desiredTitles || []).filter(Boolean).slice(0, 8);
  const preferredLocations = (b.preferredLocations || []).filter(Boolean);
  const workModes = (b.workModes || []).filter(Boolean).map((m) => String(m).toLowerCase());
  const city = preferredLocations.find(isCityLoc) || null;
  const remote = workModes.includes("remoto");
  // Personal data (from CV extraction, edited by the user) — saved when present.
  const personal = b.personal || {};
  const skillsFromCv = Array.isArray(personal.skills) ? personal.skills.filter(Boolean) : null;
  const data = {
    onboarded: true, desiredTitles,
    experienceLevel: b.experienceLevel || null,
    minSalary: b.minSalary != null ? parseInt(b.minSalary, 10) : null,
    sectors: b.sectors || [], jobTypes: b.jobTypes || [],
    preferredLocations, workModes, companyTypes: b.companyTypes || [],
    title: desiredTitles[0] || req.user.title,
    location: (personal.location && personal.location.trim()) || city || (remote ? "Remoto" : req.user.location || "—"),
    seniority: EXP_TO_SENIORITY[b.experienceLevel] || req.user.seniority || "—",
    skills: (skillsFromCv && skillsFromCv.length) ? skillsFromCv : (desiredTitles.length ? desiredTitles : req.user.skills),
    ...(personal.fullName && personal.fullName.trim() ? { name: personal.fullName.trim() } : {}),
    ...(personal.phone != null ? { phone: String(personal.phone) } : {}),
    ...(personal.summary != null ? { summary: String(personal.summary) } : {}),
    ...(b.acceptTerms && !req.user.acceptedTermsAt ? { acceptedTermsAt: new Date().toISOString() } : {}),
    ...(b.linkedinUrl != null ? { linkedinUrl: String(b.linkedinUrl).trim() || null } : {}),
  };
  const saved = await prisma.user.update({ where: { id: req.user.id }, data });

  // Immediate profile-driven scan (single engine, coalesced queries + dedup).
  let scan = { queries: 0, created: 0, modes: [] };
  try { const stx = await getSettings(); scan = await scanForCandidate(prisma, saved, { atsBoards: atsBoardsFrom(stx.config) }); }
  catch (e) { scan = { queries: 0, created: 0, modes: [`errore: ${e.message}`] }; }

  res.json({ ok: true, user: publicUser(saved), scan: { imported: scan.created, queries: scan.queries, mode: scan.modes.join(" · ") || "—" } });
}));

// Video educativi mostrati in "Risorse" (embeddati in-app). Modificabili in Admin → Impostazioni.
const DEFAULT_RESOURCE_VIDEOS = [
  { id: "rrkrvAUbU9Y", title: "La motivazione che ti serve nella ricerca del lavoro", desc: "Dan Pink — cosa ci spinge davvero: utile per mantenere energia e metodo durante la ricerca." },
  { id: "H14bBuluwB8", title: "Grit: costanza e determinazione", desc: "Angela Lee Duckworth — la qualità che fa la differenza in un percorso di ricollocamento." },
  { id: "Ks-_Mh1QhMc", title: "Il linguaggio del corpo ai colloqui", desc: "Amy Cuddy — come la postura influisce su come ti presenti a un colloquio." },
  { id: "qp0HIF3SfI4", title: "Parti dal «perché»: racconta il tuo valore", desc: "Simon Sinek — costruire un pitch personale convincente per recruiter e aziende." },
];
app.get("/api/resources/videos", auth, h(async (_req, res) => {
  const cfg = (await getSettings()).config || {};
  const vids = Array.isArray(cfg.resourceVideos) && cfg.resourceVideos.length ? cfg.resourceVideos : DEFAULT_RESOURCE_VIDEOS;
  res.json({ videos: vids });
}));

// ---- Account self-service (tutti i ruoli): profilo + cambio password ----
app.put("/api/account/profile", auth, h(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.phone != null) data.phone = String(b.phone);
  if (b.linkedinUrl != null) data.linkedinUrl = String(b.linkedinUrl).trim() || null;
  const saved = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ ok: true, user: publicUser(saved) });
}));
app.post("/api/account/password", auth, h(async (req, res) => {
  const { current, next } = req.body || {};
  if (String(next || "").length < 6) return res.status(400).json({ error: "La nuova password deve avere almeno 6 caratteri." });
  // Se l'utente ha già una password, verifica quella attuale (chi ha fatto login con LinkedIn può impostarla senza).
  if (req.user.password && !bcrypt.compareSync(String(current || ""), req.user.password)) {
    return res.status(400).json({ error: "La password attuale non è corretta." });
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { password: bcrypt.hashSync(String(next), 10), authProvider: "password" } });
  res.json({ ok: true });
}));

// ---- Banca risposte (Q&A) del candidato: risposte riutilizzabili ai form di candidatura ----
app.get("/api/candidate/answers", auth, requireRole("candidate"), h(async (req, res) => {
  const answers = await prisma.answerBank.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: "desc" } });
  res.json({ answers });
}));
app.post("/api/candidate/answers", auth, requireRole("candidate"), h(async (req, res) => {
  const { id, question, answer } = req.body || {};
  if (!String(question || "").trim()) return res.status(400).json({ error: "La domanda è obbligatoria." });
  const now = new Date().toISOString();
  if (id) {
    const ex = await prisma.answerBank.findFirst({ where: { id, userId: req.user.id } });
    if (!ex) return res.status(404).json({ error: "Risposta non trovata" });
    const up = await prisma.answerBank.update({ where: { id }, data: { question: String(question).trim(), answer: answer || "", updatedAt: now } });
    return res.json({ answer: up });
  }
  const created = await prisma.answerBank.create({ data: { id: nid("ans"), userId: req.user.id, question: String(question).trim(), answer: answer || "", createdAt: now, updatedAt: now } });
  res.json({ answer: created });
}));
app.delete("/api/candidate/answers/:id", auth, requireRole("candidate"), h(async (req, res) => {
  await prisma.answerBank.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
}));
// Genera una risposta con AI a partire dal profilo/CV (non la salva: la salva l'utente dopo).
app.post("/api/candidate/answers/generate", auth, requireRole("candidate"), h(async (req, res) => {
  const q = String(req.body?.question || "").trim();
  if (!q) return res.status(400).json({ error: "La domanda è obbligatoria." });
  const u = req.user;
  const profile = `Nome: ${u.name}\nRuoli target: ${(u.desiredTitles || []).join(", ") || u.title}\nSeniority: ${u.seniority || "—"}\nCompetenze: ${(u.skills || []).join(", ")}\nSettori: ${(u.sectors || []).join(", ")}\nSintesi: ${u.summary || ""}\nEstratto CV: ${(u.cvText || "").slice(0, 1500)}`;
  let answer = await llmComplete({
    system: "Aiuti un candidato a rispondere alle domande dei form di candidatura. Rispondi in prima persona, in italiano, professionale e conciso (max ~120 parole), coerente col profilo. Nessun preambolo, solo la risposta.",
    prompt: `Profilo del candidato:\n${profile}\n\nDomanda del form:\n"${q}"\n\nScrivi la risposta del candidato:`, maxTokens: 300,
  });
  const ai = !!answer;
  if (!answer) answer = `In base alla mia esperienza come ${(u.desiredTitles || [u.title])[0] || "professionista"}, ritengo di essere una buona candidatura per questa posizione. (Bozza: imposta una chiave LLM in Admin → Impostazioni per risposte complete, oppure modifica questo testo.)`;
  res.json({ answer: answer.trim(), ai });
}));
// Kit candidatura: dati profilo mappati sui campi standard dei form + risposte salvate.
app.get("/api/candidate/job/:id/apply-kit", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const u = req.user;
  const parts = String(u.name || "").trim().split(/\s+/);
  const fields = [
    { key: "first_name", label: "Nome", value: parts[0] || "" },
    { key: "last_name", label: "Cognome", value: parts.slice(1).join(" ") || "" },
    { key: "email", label: "Email", value: u.email || "" },
    { key: "phone", label: "Telefono", value: u.phone || "" },
    { key: "location", label: "Località", value: u.location || "" },
    { key: "current_title", label: "Ruolo attuale/target", value: (u.desiredTitles || [u.title])[0] || "" },
  ].filter((f) => f.value);
  const savedAnswers = await prisma.answerBank.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" } });
  res.json({ fields, savedAnswers, url: job.url || null, cvReady: !!u.cvText });
}));

// Aggiungi un'offerta trovata fuori dalla ricerca (incolla il link). Fonte "Manuale",
// visibile SOLO a questo candidato, insieme alle offerte del giorno.
app.post("/api/candidate/job/add-manual", auth, requireRole("candidate"), h(async (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Incolla un link valido (https://…)." });
  let html = null;
  try { html = scraperEnabled() ? await fetchHtmlViaProxy(url) : await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text(); }
  catch (e) { /* pagina non leggibile: creiamo comunque una scheda minima */ }
  const parsed = html ? parseJobPage(html, url) : { title: "Offerta aggiunta manualmente", company: (url.match(/^https?:\/\/([^/]+)/i) || [])[1]?.replace(/^www\./, "") || "—", description: "" };
  const d = today();
  const job = await prisma.job.create({ data: {
    id: nid("job"), title: parsed.title, company: parsed.company, location: "—", type: "—", remote: "—",
    salary: "n.d.", industry: "—", seniority: "—", postedAt: d, tags: [], description: parsed.description || "",
    origin: "manual", sourceId: null, ownerUserId: req.user.id, status: "active", firstSeenAt: d, lastSeenAt: d,
    externalId: `manual:${req.user.id}:${Date.now()}`, dedupKey: dedupKey(parsed.title, parsed.company), url,
  } });
  const weights = await effectiveWeights(req.user.id);
  const { score } = computeMatch(req.user, job, weights);
  res.json({ ok: true, job: { id: job.id, title: job.title, company: job.company, url: job.url, match: score } });
}));

// Condividi un'offerta a un'altra persona via email (effetto network). Oggetto/testo configurabili.
app.post("/api/candidate/job/:id/share", auth, requireRole("candidate"), h(async (req, res) => {
  const to = String(req.body?.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: "Inserisci un indirizzo email valido." });
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const cfg = (await getSettings()).config || {};
  const comm = getComm(cfg, "share_offer");
  const link = job.url || `${FRONTEND_URL}/#/app/jobs`;
  const { subject, text } = renderComm(comm || { subject: "{name} ti consiglia una posizione: {jobTitle}", body: "{name} ti consiglia {jobTitle} — {company}: {link}" }, { name: req.user.name, jobTitle: job.title, company: job.company, link });
  let sent = false;
  try { const r = await sendMail({ to, subject, text }); sent = !r.simulated; } catch (e) { /* non bloccante */ }
  res.json({ ok: true, sent, to });
}));

// Candidatura assistita/automatica su una singola offerta.
app.post("/api/candidate/job/:id/auto-apply", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const submit = !!req.body?.submit;
  const answers = await prisma.answerBank.findMany({ where: { userId: req.user.id } });
  const result = await runAutoApply({ url: job.url, user: req.user, answers, submit });
  // Se inviata, registra la candidatura.
  if (result.submitted) {
    const ex = await prisma.application.findFirst({ where: { candidateId: req.user.id, jobId: job.id } });
    if (!ex) { const now = new Date().toISOString(); await prisma.application.create({ data: { id: nid("app"), candidateId: req.user.id, jobId: job.id, stage: "applied", appliedAt: now, updatedAt: now } }); }
  }
  res.json(result);
}));

// ---- Referral "porta un amico" (2 settimane gratis all'attivazione dell'amico) ----
const REFERRAL_REWARD_DAYS = 14;
async function ensureReferralCode(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (u?.referralCode) return u.referralCode;
  let code, tries = 0;
  do { code = "R" + Math.random().toString(36).slice(2, 8).toUpperCase(); tries++; } while (await prisma.user.findUnique({ where: { referralCode: code } }).catch(() => null) && tries < 6);
  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } }).catch(() => {});
  return code;
}
app.get("/api/candidate/referrals", auth, requireRole("candidate"), h(async (req, res) => {
  const code = await ensureReferralCode(req.user.id);
  const link = `${FRONTEND_URL}/#/login?ref=${code}`;
  const invites = await prisma.referral.findMany({ where: { referrerId: req.user.id }, orderBy: { invitedAt: "desc" } });
  const rewarded = invites.filter((i) => i.status === "rewarded").length;
  res.json({ code, link, invites, rewardWeeks: (rewarded * REFERRAL_REWARD_DAYS) / 7, rewardDays: REFERRAL_REWARD_DAYS });
}));
app.post("/api/candidate/referrals/invite", auth, requireRole("candidate"), h(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Inserisci un'email valida." });
  const code = await ensureReferralCode(req.user.id);
  const link = `${FRONTEND_URL}/#/login?ref=${code}`;
  const now = new Date().toISOString();
  await prisma.referral.create({ data: { id: nid("ref"), referrerId: req.user.id, code, email, status: "invited", invitedAt: now } }).catch(() => {});
  const cfg = (await getSettings()).config || {};
  const comm = getComm(cfg, "referral_invite");
  const { subject, text } = renderComm(comm || { subject: "{name} ti invita su digitalfa", body: "{name} ti invita: {link}" }, { name: req.user.name, link });
  let sent = false;
  try { const r = await sendMail({ to: email, subject, text }); sent = !r.simulated; } catch (e) { /* non bloccante */ }
  res.json({ ok: true, sent, email });
}));

// ---- Candidatura come Coach (form nella pagina Coaching) → email a digitalfa ----
const COACH_INBOX = "extremedigitalfa@gmail.com";
app.post("/api/coach/apply", auth, h(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || req.user.name || "").trim();
  const email = String(b.email || req.user.email || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Nome ed email sono obbligatori." });
  const phone = b.phone ? String(b.phone) : null;
  const linkedin = b.linkedin ? String(b.linkedin) : null;
  const message = b.message ? String(b.message).slice(0, 4000) : null;
  const now = new Date().toISOString();
  let emailed = false;
  const text = `Nuova candidatura Coach su digitalfa\n\nNome: ${name}\nEmail: ${email}\nTelefono: ${phone || "—"}\nLinkedIn: ${linkedin || "—"}\nUtente: ${req.user.email} (${req.user.role})\n\nMessaggio:\n${message || "—"}\n`;
  try { const r = await sendMail({ to: COACH_INBOX, subject: `Candidatura Coach — ${name}`, text }); emailed = !!r.sent; } catch (e) { /* email non bloccante */ }
  try { await prisma.coachApplication.create({ data: { id: nid("coachapp"), name, email, phone, linkedin, message, userId: req.user.id, createdAt: now, emailed } }); } catch (e) { /* persistenza best-effort */ }
  res.json({ ok: true, emailed, inbox: COACH_INBOX });
}));
// Admin: elenco candidature Coach ricevute.
app.get("/api/admin/coach-applications", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const rows = await prisma.coachApplication.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []);
  res.json({ applications: rows, inbox: COACH_INBOX });
}));

app.post("/api/candidate/apply", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.body?.jobId } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  if (await prisma.application.findFirst({ where: { candidateId: req.user.id, jobId: job.id } })) return res.status(409).json({ error: "Ti sei già candidato a questa offerta" });
  const now = new Date().toISOString();
  const a = await prisma.application.create({ data: { id: nid("app"), candidateId: req.user.id, jobId: job.id, stage: "applied", appliedAt: now, updatedAt: now, coverLetter: req.body?.coverLetter || null, contactMessage: req.body?.contactMessage || null } });
  res.status(201).json({ ...a, job });
}));

// Diagnosi "candidatura automatica": stima, dal link/ATS, se la candidatura può
// essere assistita o richiede passaggi manuali. È una stima (non fetcha la pagina).
app.get("/api/candidate/job/:id/apply-check", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const url = job.url || "";
  const host = (url.match(/^https?:\/\/([^/]+)/i) || [])[1] || "";
  let mode = "manuale"; const reasons = [];
  if (!url) {
    reasons.push("Nessun link di candidatura salvato per questa offerta.");
  } else if (/adzuna|jooble|jobrapido|indeed|linkedin/i.test(host)) {
    mode = "manuale";
    reasons.push("Il link porta a un portale/aggregatore: la candidatura si completa sul sito finale, spesso con registrazione.");
  } else if (/workable|greenhouse|lever|smartrecruiters|recruitee|teamtailor|personio|breezy|ashby/i.test(host)) {
    mode = "assistita";
    reasons.push(`ATS standard (${host.replace(/^www\./, "")}): form strutturato, ma di norma richiede email e caricamento del CV.`);
    reasons.push("Possibili domande aggiuntive specifiche dell'azienda.");
  } else if (host) {
    mode = "manuale";
    reasons.push("Sito aziendale/portale non standard: probabile registrazione e/o domande personalizzate.");
  }
  // Analisi REALE della pagina (se è configurato ScraperAPI/ScrapingBee): legge
  // l'HTML aggirando gli anti-bot e cerca segnali concreti.
  let inspected = false;
  if (url && scraperEnabled()) {
    try {
      const html = await fetchHtmlViaProxy(url);
      if (html) {
        inspected = true;
        const h = html.toLowerCase();
        if (/cloudflare|cf-browser-verification|challenge-platform|datadome|captcha|recaptcha|hcaptcha/.test(h)) {
          mode = "manuale"; reasons.unshift("⚠️ Rilevata protezione anti-bot (Cloudflare/DataDome/CAPTCHA): la candidatura automatica non è possibile.");
        }
        if (/crea(re)? un account|create an account|sign ?up|registrati|register|accedi per candidart/.test(h)) {
          if (mode !== "manuale") mode = "manuale"; reasons.push("La pagina richiede registrazione/login prima di candidarsi.");
        }
        const hasForm = /<form[\s>]/.test(h);
        const wantsCv = /type=["']file["']|curriculum|resume|upload|allega/.test(h);
        if (hasForm && wantsCv) reasons.push("È presente un form con caricamento del CV: candidatura assistita fattibile.");
        if (/screening|domand[ae]|questionnaire|additional questions|perché vuoi|why do you/.test(h)) reasons.push("Rilevate probabili domande aggiuntive di screening.");
      }
    } catch (e) { reasons.push(`Nota: non è stato possibile leggere la pagina (${e.message}).`); }
  }
  reasons.push(inspected
    ? "Analisi eseguita leggendo la pagina reale tramite il middleware di scraping configurato."
    : "Verifiche anti-bot (es. Cloudflare), login e domande extra non sono rilevabili con certezza senza aprire la pagina (configura ScraperAPI/ScrapingBee in Impostazioni per l'analisi reale).");
  res.json({ mode, host: host || null, url: url || null, reasons, inspected });
}));

// Set/unset "ti sei candidato" manually (toggle Sì/No sulla card).
app.post("/api/candidate/job/:id/applied", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const applied = !!req.body?.applied;
  const existing = await prisma.application.findFirst({ where: { candidateId: req.user.id, jobId: job.id } });
  if (applied && !existing) {
    const now = new Date().toISOString();
    await prisma.application.create({ data: { id: nid("app"), candidateId: req.user.id, jobId: job.id, stage: "applied", appliedAt: now, updatedAt: now } });
  } else if (!applied && existing) {
    await prisma.application.delete({ where: { id: existing.id } });
  }
  res.json({ ok: true, applied });
}));

// Outreach kit for a specific opportunity: 3 contacts + a <200-char message.
app.get("/api/candidate/job/:id/outreach", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  const message = await generateMessage(req.user, job);
  const { contacts, jdEmail } = suggestContacts(job);
  res.json({ jobId: job.id, contacts, jdEmail, message, messageLength: message.length, generatedBy: LLM_ON ? "llm" : "template" });
}));

// Auto-generated cover letter for an opportunity.
app.get("/api/candidate/job/:id/cover-letter", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  res.json({ jobId: job.id, coverLetter: await generateCoverLetter(req.user, job), attachable: job.origin === "hr_upload", generatedBy: LLM_ON ? "llm" : "template" });
}));
app.get("/api/candidate/job/:id/cv-tailored", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  res.json({ jobId: job.id, cv: await generateTailoredCv(req.user, job), hasCv: !!req.user.cvText, generatedBy: LLM_ON ? "llm" : "template" });
}));
// Full ad text for a single offer (shown inline in the card).
app.get("/api/candidate/job/:id/ad", auth, requireRole("candidate"), h(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Offerta non trovata" });
  // Al candidato NON esponiamo il link alla fonte (solo la JD salvata).
  res.json({ jobId: job.id, title: job.title, company: job.company, location: job.location, description: job.description || "" });
}));

// ==================================================================
// COACH
// ==================================================================
app.get("/api/coach/caseload", auth, requireRole("coach"), h(async (req, res) => {
  const list = await prisma.user.findMany({ where: { role: "candidate", coachId: req.user.id } });
  const candidates = await Promise.all(list.map(candidateCard));
  const ups = await prisma.session.findMany({ where: { coachId: req.user.id, status: "scheduled" } });
  const upcoming = [];
  for (const s of ups.sort((a, b) => new Date(a.date) - new Date(b.date))) {
    const cand = await prisma.user.findUnique({ where: { id: s.candidateId } });
    upcoming.push({ ...s, candidateName: cand?.name });
  }
  res.json({ candidates, upcoming });
}));
app.get("/api/coach/candidate/:id", auth, requireRole("coach"), h(async (req, res) => {
  const c = await prisma.user.findFirst({ where: { id: req.params.id, coachId: req.user.id } });
  if (!c) return res.status(404).json({ error: "Candidato non trovato" });
  const milestones = await milestonesFor(c.id);
  const sessions = (await prisma.session.findMany({ where: { candidateId: c.id } })).sort((a, b) => new Date(b.date) - new Date(a.date));
  const apps = await prisma.application.findMany({ where: { candidateId: c.id }, include: { job: true } });
  res.json({ candidate: await candidateCard(c), milestones, sessions, applications: apps });
}));
app.patch("/api/coach/progress", auth, requireRole("coach"), h(async (req, res) => {
  const { candidateId, key, status } = req.body || {};
  const c = await prisma.user.findFirst({ where: { id: candidateId, coachId: req.user.id } });
  if (!c) return res.status(404).json({ error: "Candidato non trovato" });
  if (!MILESTONES.find((m) => m.key === key)) return res.status(400).json({ error: "Milestone non valida" });
  await prisma.progress.upsert({ where: { userId_key: { userId: candidateId, key } }, update: { status }, create: { userId: candidateId, key, status } });
  res.json({ candidateId, key, status });
}));

// ==================================================================
// HR
// ==================================================================
app.get("/api/hr/dashboard", auth, requireRole("hr"), h(async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const employees = await prisma.user.findMany({ where: { role: "candidate", companyId: req.user.companyId } });
  const cards = await Promise.all(employees.map(candidateCard));
  const total = employees.length;
  const placed = employees.filter((e) => e.status === "placed").length;
  const active = employees.filter((e) => e.status === "active").length;
  const atRisk = employees.filter((e) => e.status === "at_risk").length;
  const avgProgress = cards.length ? Math.round(cards.reduce((s, c) => s + c.progressPct, 0) / cards.length) : 0;
  res.json({ company, stats: { total, placed, active, atRisk, avgProgress, placementRate: total ? Math.round((placed / total) * 100) : 0 }, employees: cards });
}));
app.get("/api/hr/positions", auth, requireRole("hr"), h(async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const positions = await prisma.job.findMany({ where: { OR: [{ companyId: req.user.companyId }, { company: company?.name }] }, orderBy: { firstSeenAt: "desc" } });
  res.json({ company, positions });
}));
app.post("/api/hr/positions", auth, requireRole("hr"), h(async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: "Titolo obbligatorio" });
  const tags = Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const job = await prisma.job.create({ data: { id: nid("job"), title: b.title, company: company?.name || "Azienda", location: b.location || "—", type: b.type || "Full-time", remote: b.remote || "Ibrido", salary: b.salary || "—", industry: b.industry || "—", seniority: b.seniority || "Mid", postedAt: today(), tags, description: b.description || "", origin: "hr_upload", companyId: req.user.companyId, status: "active", firstSeenAt: today(), lastSeenAt: today() } });
  res.status(201).json(job);
}));
app.patch("/api/hr/positions/:id", auth, requireRole("hr"), h(async (req, res) => {
  const job = await prisma.job.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!job) return res.status(404).json({ error: "Posizione non trovata" });
  const upd = await prisma.job.update({ where: { id: job.id }, data: { status: req.body.status, ...(req.body.status === "inactive" ? { deactivatedAt: today() } : {}) } });
  res.json(upd);
}));

// ==================================================================
// ADMIN
// ==================================================================
app.get("/api/admin/overview", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const [companies, candidates, coaches, activePositions, activeSources, subs] = await Promise.all([
    prisma.company.findMany(),
    prisma.user.findMany({ where: { role: "candidate" } }),
    prisma.user.findMany({ where: { role: "coach" } }),
    prisma.job.count({ where: { status: "active" } }),
    prisma.source.count({ where: { status: "active" } }),
    prisma.subscription.findMany({ where: { status: "active" } }),
  ]);
  const placed = candidates.filter((c) => c.status === "placed").length;
  const byStatus = candidates.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});
  const plans = await prisma.plan.findMany();
  const priceOf = (id) => plans.find((p) => p.id === id)?.price || 0;
  const mrr = subs.reduce((s, x) => s + priceOf(x.planId), 0);
  const companyStats = companies.map((co) => { const emp = candidates.filter((c) => c.companyId === co.id); return { ...co, enrolled: emp.length, placed: emp.filter((c) => c.status === "placed").length }; });
  const coachLoad = coaches.map((co) => ({ id: co.id, name: co.name, avatar: co.avatar, caseload: candidates.filter((c) => c.coachId === co.id).length }));
  res.json({ stats: { companies: companies.length, candidates: candidates.length, coaches: coaches.length, placed, placementRate: candidates.length ? Math.round((placed / candidates.length) * 100) : 0, activePositions, sources: activeSources, mrr }, byStatus, companyStats, coachLoad });
}));

app.get("/api/admin/users", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const users = await prisma.user.findMany();
  const companies = await prisma.company.findMany();
  const subs = await prisma.subscription.findMany();
  const plans = await prisma.plan.findMany();
  const subOf = (u) => {
    const s = u.role === "hr" ? subs.find((x) => x.ownerType === "company" && x.ownerId === u.companyId)
      : subs.find((x) => x.ownerType === "user" && x.ownerId === u.id);
    if (!s) return null;
    const plan = plans.find((p) => p.id === s.planId);
    return {
      status: s.status, plan: plan?.name || s.planId, planPrice: plan?.priceLabel || (plan?.price != null ? `€${plan.price}` : null),
      startedAt: s.startedAt, currentPeriodEnd: s.currentPeriodEnd, cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      provider: s.provider, cardLast4: s.cardLast4 || null,
      voucherCode: s.voucherCode || null, discountPercent: s.discountPercent || null, freeUntil: s.freeUntil || null,
    };
  };
  res.json(users.map((u) => ({ ...publicUser(u), companyName: companies.find((c) => c.id === u.companyId)?.name || null, blocked: blockActive(u), acceptedTerms: !!u.acceptedTermsAt, subscription: subOf(u) })));
}));

// Block a user for a duration (days), or unblock (days = 0 / null).
app.patch("/api/admin/users/:id/block", auth, requireRole("admin"), h(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Non puoi bloccare il tuo stesso account" });
  const days = Number(req.body?.days);
  const blockedUntil = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { blockedUntil, status: blockedUntil ? "blocked" : "active" } });
  res.json({ ...publicUser(u), blocked: blockActive(u) });
}));

// Assign a role and (for limited staff) which admin sections they can see.
const ASSIGNABLE_ROLES = ["candidate", "coach", "hr", "referral", "staff"];
const ADMIN_SECTIONS = ["overview", "companies", "sources", "positions", "matching", "users"];
app.patch("/api/admin/users/:id/role", auth, requireRole("admin"), h(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Non puoi cambiare il ruolo del tuo stesso account" });
  const { role, permissions } = req.body || {};
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: "Ruolo non valido" });
  const perms = role === "staff" ? (Array.isArray(permissions) ? permissions.filter((p) => ADMIN_SECTIONS.includes(p)) : []) : [];
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { role, permissions: perms } });
  res.json({ ...publicUser(u), blocked: blockActive(u) });
}));

// Permanently delete a user and their dependent records.
app.delete("/api/admin/users/:id", auth, requireRole("admin"), h(async (req, res) => {
  const id = req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: "Non puoi cancellare il tuo stesso account" });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "Utente non trovato" });
  await prisma.$transaction([
    prisma.application.deleteMany({ where: { candidateId: id } }),
    prisma.session.deleteMany({ where: { OR: [{ candidateId: id }, { coachId: id }] } }),
    prisma.progress.deleteMany({ where: { userId: id } }),
    prisma.matchPref.deleteMany({ where: { userId: id } }),
    prisma.matchFeedback.deleteMany({ where: { userId: id } }),
    prisma.subscription.deleteMany({ where: { ownerType: "user", ownerId: id } }),
    prisma.user.updateMany({ where: { coachId: id }, data: { coachId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  res.json({ ok: true, deleted: id });
}));

app.get("/api/admin/companies", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const companies = await prisma.company.findMany();
  const out = [];
  for (const co of companies) {
    const enrolled = await prisma.user.count({ where: { role: "candidate", companyId: co.id } });
    out.push({ ...co, enrolled, subscription: await subView(await findSub("company", co.id)) });
  }
  res.json(out);
}));
app.post("/api/admin/companies", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Nome obbligatorio" });
  const logo = b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const co = await prisma.company.create({ data: { id: nid("co"), name: b.name, sector: b.sector || "—", city: b.city || "—", logo, plan: b.plan || "Starter", seatsTotal: b.seatsTotal || 10, activeSince: today(), careersUrl: b.careersUrl || "" } });
  if (b.careersUrl && b.createSource) await prisma.source.create({ data: { id: nid("src"), type: "company_careers", name: `${co.name} — Carriere`, url: b.careersUrl, companyId: co.id, status: "active", createdAt: today(), frequencyHours: b.frequencyHours || 48, nextScanAt: addHoursISO(b.frequencyHours || 48), lastScanFound: 0, region: "Italia", connector: b.connector || "simulated" } });
  res.status(201).json(co);
}));
app.patch("/api/admin/companies/:id", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const data = {};
  ["name", "sector", "city", "careersUrl", "plan", "seatsTotal"].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  const co = await prisma.company.update({ where: { id: req.params.id }, data });
  res.json(co);
}));

// Sources
app.get("/api/admin/sources", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const sources = await prisma.source.findMany({ orderBy: { createdAt: "asc" } });
  const companies = await prisma.company.findMany();
  const out = [];
  for (const s of sources) {
    const activePositions = await prisma.job.count({ where: { sourceId: s.id, status: "active" } });
    out.push({ ...s, companyName: companies.find((c) => c.id === s.companyId)?.name || null, connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector, activePositions });
  }
  res.json(out);
}));
app.post("/api/admin/sources", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.url) return res.status(400).json({ error: "Nome e URL obbligatori" });
  const s = await prisma.source.create({ data: { id: nid("src"), type: b.type || "portal", name: b.name, url: b.url, companyId: b.companyId || null, status: "active", createdAt: today(), frequencyHours: b.frequencyHours || 24, nextScanAt: addHoursISO(b.frequencyHours || 24), lastScanFound: 0, region: b.region || "Italia", connector: b.connector || "simulated", apiConfig: b.apiConfig || undefined } });
  res.status(201).json(s);
}));
app.patch("/api/admin/sources/:id", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const data = {};
  ["status", "frequencyHours", "name", "url", "region", "connector", "autoScan"].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.status === "disabled") data.nextScanAt = null;
  else if (data.status === "active") data.nextScanAt = addHoursISO(data.frequencyHours || req.body.frequencyHours || 24);
  const s = await prisma.source.update({ where: { id: req.params.id }, data });
  res.json(s);
}));

app.post("/api/admin/sources/:id/scan", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const s = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).json({ error: "Fonte non trovata" });
  if (s.status !== "active") return res.status(400).json({ error: "La fonte è disattivata" });
  const log = await runScan(prisma, s);
  res.json({ log, source: { ...s, connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector } });
}));

// External-cron entry point (secured by CRON_SECRET when set).
let _tickRunning = false;
async function runTickWork() {
  if (_tickRunning) return { skipped: true, reason: "già in corso" };
  _tickRunning = true;
  try {
    try { await runDueScans(prisma); } catch (e) { console.error("[tick] runDueScans:", e.message); }
    try { await runDailyCandidateScan(prisma); } catch (e) { console.error("[tick] dailyScan:", e.message); }
    try { await runTimedComms(); } catch (e) { console.error("[tick] timedComms:", e.message); }
    try { await refreshSystemAlerts(); } catch (e) { console.error("[tick] alerts:", e.message); }
  } finally { _tickRunning = false; }
  return { done: true };
}
app.post("/api/scheduler/tick", h(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["x-cron-secret"] !== secret) return res.status(401).json({ error: "unauthorized" });
  // Rispondiamo SUBITO: il lavoro pesante (scansione giornaliera) gira in background,
  // così il cron non va in timeout (i portali di cron chiudono la richiesta a ~30s).
  res.json({ ok: true, started: !_tickRunning, alreadyRunning: _tickRunning });
  runTickWork().catch((e) => console.error("[tick] background:", e.message));
}));

// Dry-run a connector without touching the DB (for "Testa connettore")
app.post("/api/admin/sources/:id/test", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const s = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).json({ error: "Fonte non trovata" });
  const { jobs, mode, full } = await fetchFromConnector(s);
  res.json({ mode, full, count: jobs.length, sample: jobs.slice(0, 5).map((j) => ({ title: j.title, company: j.company, location: j.location })) });
}));

// ---- Scheduler configuration & control ----
async function getSettings() {
  return (await prisma.setting.findUnique({ where: { id: "singleton" } })) || (await prisma.setting.create({ data: { id: "singleton" } }));
}

// Daily profile-driven scan: scan the union of candidates' queries once, then
// email each candidate the count of NEW matching offers found today.
// ---- Sistema di allerta (fonti in errore / SMTP / scansione ferma) ----
// Gli alert attivi sono salvati in config.systemAlerts: [{ kind, key, message, level, since, notified }].
async function getSystemAlerts() { const st = await getSettings(); return Array.isArray(st.config?.systemAlerts) ? st.config.systemAlerts : []; }
async function saveSystemAlerts(list) {
  const st = await getSettings(); const cfg = { ...(st.config || {}), systemAlerts: list };
  await prisma.setting.update({ where: { id: "singleton" }, data: { config: cfg } }).catch(() => {});
}
// Ricalcola gli alert dallo stato reale e notifica via email quelli NUOVI.
async function refreshSystemAlerts() {
  try {
    const st = await getSettings();
    const desired = []; // alert che dovrebbero essere attivi ora
    // 1) Fonti in errore nell'ultima scansione.
    const last = safeParse(st.lastDailyScanInfo); const per = last.perSource || {};
    for (const [src, p] of Object.entries(per)) {
      if (p && p.error) desired.push({ kind: "source", key: src, level: "error", message: `Fonte «${SOURCE_LABEL[src] || src}» in errore: ${String(p.error).slice(0, 160)}` });
    }
    // 2) SMTP: ultimo invio fallito.
    const mh = getMailHealth();
    if (mh.configured && mh.lastError) desired.push({ kind: "smtp", key: "send", level: "error", message: `Invio email SMTP fallito: ${String(mh.lastError).slice(0, 160)}` });
    // 3) Scansione ferma da troppo tempo (>30h) rispetto all'ultima registrata.
    if (st.lastDailyScanDate) {
      const ageH = (Date.now() - new Date(st.lastDailyScanDate + "T06:00:00Z").getTime()) / 3600000;
      if (ageH > 30) desired.push({ kind: "cron", key: "scan_stale", level: "warn", message: `Nessuna scansione da oltre 30 ore (ultima: ${st.lastDailyScanDate}). Controlla il cron.` });
    }
    // Merge con gli alert già memorizzati (mantieni since/notified, invia email ai nuovi).
    const prev = Array.isArray(st.config?.systemAlerts) ? st.config.systemAlerts : [];
    const now = new Date().toISOString();
    const out = [];
    const newlyRaised = [];
    for (const d of desired) {
      const existing = prev.find((a) => a.kind === d.kind && a.key === d.key);
      if (existing) out.push({ ...existing, message: d.message, level: d.level });
      else { const a = { ...d, since: now, notified: false }; out.push(a); newlyRaised.push(a); }
    }
    await saveSystemAlerts(out);
    // Notifica email agli admin per i nuovi alert (se SMTP funziona).
    if (newlyRaised.length && !getMailHealth().lastError) {
      const admins = await prisma.user.findMany({ where: { role: "admin" } }).catch(() => []);
      const body = "Rilevati problemi su digitalfa:\n\n" + newlyRaised.map((a) => `• ${a.message}`).join("\n") + `\n\nApri la dashboard Admin per i dettagli: ${FRONTEND_URL}/#/app`;
      for (const ad of admins) { try { await sendMail({ to: ad.email, subject: `⚠️ digitalfa: ${newlyRaised.length} problema/i rilevati`, text: body }); } catch (e) { /* niente loop */ } }
      // segna come notificati
      const marked = out.map((a) => newlyRaised.some((n) => n.kind === a.kind && n.key === a.key) ? { ...a, notified: true } : a);
      await saveSystemAlerts(marked);
    }
    return out;
  } catch (e) { return []; }
}

const APP_JOBS_LINK = () => `${process.env.FRONTEND_URL || FRONTEND_URL}/#/app/jobs`;
const ONB_LINK = () => `${process.env.FRONTEND_URL || FRONTEND_URL}/#/app/onboarding`;

// Invia una comunicazione (email) a un utente, con dedupe opzionale via CommLog.
async function sendComm(user, comm, ctx = {}, { ref = null, once = false } = {}) {
  if (!user || !comm || comm.enabled === false) return false;
  if (comm.channel !== "email") return false;                 // le "inapp" non si inviano via email
  if (once) {
    const ex = await prisma.commLog.findFirst({ where: { userId: user.id, commKey: comm.key, ref: ref || null } }).catch(() => null);
    if (ex) return false;
  }
  const { subject, text } = renderComm(comm, { name: user.name, ...ctx });
  let ok = false;
  try { await sendMail({ to: user.email, subject, text }); ok = true; } catch (e) { ok = false; }
  await prisma.commLog.create({ data: { id: nid("comm"), userId: user.id, commKey: comm.key, ref: ref || null, sentAt: new Date().toISOString() } }).catch(() => {});
  return ok;
}
// Evento puntuale (es. abbonamento) → invia la comunicazione col trigger indicato.
async function fireCommEvent(triggerType, user, ctx = {}) {
  try {
    const cfg = (await getSettings()).config || {};
    const comm = getComms(cfg).find((c) => c.trigger && c.trigger.type === triggerType && c.channel === "email" && c.enabled !== false);
    if (comm && user) await sendComm(user, comm, { link: ctx.link || APP_JOBS_LINK(), ...ctx });
  } catch (e) { /* non bloccante */ }
}
// Solleciti onboarding: invia le comunicazioni "days_after_signup" ai candidati NON profilati.
async function runOnboardingReminders(config, dstr) {
  const comms = getComms(config).filter((c) => c.trigger && c.trigger.type === "days_after_signup" && c.channel === "email" && c.enabled !== false);
  if (!comms.length) return 0;
  const all = await prisma.user.findMany({ where: { role: "candidate", onboarded: false } });
  let sent = 0;
  for (const c of comms) {
    const days = Math.max(0, parseInt(c.trigger.days, 10) || 0);
    for (const u of all) {
      if (!u.enrolledAt) continue;
      const age = Math.floor((new Date(dstr + "T00:00:00Z") - new Date(String(u.enrolledAt).slice(0, 10) + "T00:00:00Z")) / 86400000);
      if (age === days) { if (await sendComm(u, c, { link: ONB_LINK(), days }, { ref: dstr, once: true })) sent++; }
    }
  }
  return sent;
}

// Comunicazioni "a tempo": sollecito N ore dopo l'email di scansione, se il
// candidato non ha ancora visitato le offerte. Eseguita a ogni tick/intervallo.
let _timedCommsRunning = false;
async function runTimedComms() {
  if (_timedCommsRunning) return; _timedCommsRunning = true;
  try {
    const cfg = (await getSettings()).config || {};
    const comm = getComms(cfg).find((c) => c.trigger?.type === "after_scan_hours" && c.channel === "email" && c.enabled !== false);
    if (!comm) return;
    const hours = Math.max(1, parseInt(comm.trigger.hours, 10) || 8);
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const scanSent = await prisma.commLog.findMany({ where: { commKey: "scan_done", sentAt: { gte: since } } }).catch(() => []);
    for (const cl of scanSent) {
      const sentTime = new Date(cl.sentAt).getTime();
      if (Date.now() - sentTime < hours * 3600 * 1000) continue;               // non sono ancora passate N ore
      const already = await prisma.commLog.findFirst({ where: { userId: cl.userId, commKey: comm.key, ref: cl.id } }).catch(() => null);
      if (already) continue;                                                    // follow-up già gestito
      const u = await prisma.user.findUnique({ where: { id: cl.userId } }).catch(() => null);
      if (!u) continue;
      // Se ha già visitato le offerte dopo l'email, niente sollecito (ma segna come gestito).
      if (u.lastOffersVisitAt && new Date(u.lastOffersVisitAt).getTime() > sentTime) {
        await prisma.commLog.create({ data: { id: nid("comm"), userId: u.id, commKey: comm.key, ref: cl.id, sentAt: new Date().toISOString() } }).catch(() => {});
        continue;
      }
      await sendComm(u, comm, { link: APP_JOBS_LINK() }, { ref: cl.id });
    }
  } catch (e) { /* non bloccante */ } finally { _timedCommsRunning = false; }
}

async function runDailyCandidateScan(prisma, { force = false } = {}) {
  const d = today();
  const st = await getSettings();
  if (!force && st.lastDailyScanDate === d) return { skipped: true, reason: "già eseguita oggi", ...safeParse(st.lastDailyScanInfo) };
  const config = (st.config) || {};
  // Scheduled hour (server time / UTC): before it, a tick just waits.
  const hour = config.dailyScanHour !== undefined && config.dailyScanHour !== "" ? parseInt(config.dailyScanHour, 10) : null;
  if (!force && hour != null && new Date().getUTCHours() < hour) return { skipped: true, reason: `in attesa dell'ora programmata (${hour}:00 UTC)` };
  const link = APP_JOBS_LINK();
  const candidates = await prisma.user.findMany({ where: { role: "candidate", onboarded: true } });
  const { queries, created, fetched, modes, perSource } = await runProfileScan(prisma, candidates, { atsBoards: atsBoardsFrom(config) });
  const scanDone = getComm(config, "scan_done");
  let emailed = 0, matchedTotal = 0;
  for (const c of candidates) {
    const n = await countNewMatchesToday(prisma, c);
    matchedTotal += n;
    if (n > 0 && scanDone && scanDone.enabled !== false) {
      if (await sendComm(c, scanDone, { count: n, link }, { ref: d, once: true })) emailed++;
    }
  }
  // Solleciti onboarding programmati (days_after_signup).
  const onbSent = await runOnboardingReminders(config, d);
  const info = { candidates: candidates.length, queries, created, fetched, emailed, matchedTotal, email: emailEnabled() ? "smtp" : "simulata", modes: (modes || []).slice(0, 20), perSource: perSource || {}, at: new Date().toISOString() };
  // Storico per-giorno-e-fonte (ultimi 30 giorni). Se già eseguita oggi, sovrascrive la voce del giorno.
  const prev = (st.scanHistory && Array.isArray(st.scanHistory)) ? st.scanHistory : [];
  const entry = { date: d, perSource: perSource || {}, created, fetched, candidates: candidates.length, emailed };
  const history = [entry, ...prev.filter((h) => h.date !== d)].slice(0, 30);
  await prisma.setting.update({ where: { id: "singleton" }, data: { lastDailyScanDate: d, lastDailyScanInfo: JSON.stringify(info), scanHistory: history } }).catch(() => {});
  // Registra la scansione del motore nel Log delle scansioni (fonte "virtuale", sourceId null).
  await prisma.scanLog.create({ data: { id: `log-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, sourceId: null, label: `Motore candidati · ${candidates.length} profili`, runAt: new Date().toISOString(), found: fetched, added: created, deactivated: 0, status: "ok" } }).catch(() => {});
  return info;
}
const safeParse = (s) => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };
app.get("/api/admin/scheduler", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const st = await getSettings();
  const sources = await prisma.source.findMany({ orderBy: { createdAt: "asc" } });
  const now = Date.now();
  const list = sources.map((s) => ({
    id: s.id, name: s.name, status: s.status, autoScan: s.autoScan, connector: s.connector,
    connectorLabel: CONNECTOR_LABELS[s.connector] || s.connector, frequencyHours: s.frequencyHours,
    lastScanAt: s.lastScanAt, nextScanAt: s.nextScanAt,
    due: s.status === "active" && s.autoScan && (!s.nextScanAt || new Date(s.nextScanAt).getTime() <= now),
  }));
  res.json({ settings: st, sources: list, autoActive: list.filter((s) => s.status === "active" && s.autoScan).length });
}));
app.patch("/api/admin/scheduler", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const data = {};
  if (req.body.schedulerEnabled !== undefined) data.schedulerEnabled = !!req.body.schedulerEnabled;
  if (req.body.checkIntervalSec !== undefined) data.checkIntervalSec = Math.max(10, parseInt(req.body.checkIntervalSec, 10) || 60);
  const st = await prisma.setting.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  res.json(st);
}));
// Manually run the daily profile-driven candidate scan (force = ignore once-per-day guard).
app.post("/api/admin/candidate-scan", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const info = await runDailyCandidateScan(prisma, { force: true });
  refreshSystemAlerts().catch(() => {});
  res.json({ ok: true, ...info });
}));
// Stato del sistema: alert attivi (fonti in errore, SMTP, scansione ferma).
app.get("/api/admin/alerts", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const alerts = await refreshSystemAlerts();
  res.json({ alerts, mail: getMailHealth() });
}));
app.get("/api/admin/candidate-scan", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const st = await getSettings();
  const config = (st.config) || {};
  // Elenco COMPLETO delle fonti del motore, con stato (gratis / chiave impostata / chiave mancante / board mancanti).
  const KEY_OF = { adzuna: "adzunaAppKey", jooble: "joobleApiKey", findwork: "findworkApiKey", theirstack: "theirstackApiKey", jsearch: "rapidapiKey", serpapi: "serpapiKey", apify: "apifyToken", brightdata: "brightdataApiKey" };
  const ATS = new Set(["greenhouse", "lever", "smartrecruiters"]);
  const ORDER = ["serpapi", "adzuna", "jooble", "apify", "jsearch", "arbeitnow", "remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur", "findwork", "theirstack", "greenhouse", "lever", "smartrecruiters", "brightdata"];
  const boards = atsBoardsFrom(config);
  const last = safeParse(st.lastDailyScanInfo);
  const perLast = last.perSource || {};
  const sources = ORDER.map((s) => {
    const keyName = KEY_OF[s];
    const keyed = !!keyName;
    const hasKey = keyed ? !!config[keyName] : true;
    const isAts = ATS.has(s);
    const hasBoards = isAts ? (boards[s] && boards[s].length > 0) : true;
    let status = "attiva";
    if (keyed && !hasKey) status = "chiave mancante";
    else if (isAts && !hasBoards) status = "board mancanti";
    const p = perLast[s] || null;
    return {
      id: s, name: SOURCE_LABEL[s] || s, keyed, hasKey, ats: isAts, boards: isAts ? (boards[s] || []).length : null, status,
      lastQueries: p ? p.q : null, lastFetched: p ? p.fetched : null, lastCreated: p ? p.created : null,
    };
  });
  const poolTotal = await prisma.job.count({ where: { status: "active" } });
  const poolToday = await prisma.job.count({ where: { status: "active", firstSeenAt: today() } });
  res.json({
    lastDate: st.lastDailyScanDate || null, emailConfigured: emailEnabled(),
    last, sources, poolTotal, poolToday,
  });
}));
// ---- Admin configuration (SMTP / LLM / cron / scan schedule / templates) ----
const cronPublicPath = "/api/scheduler/tick";
app.get("/api/admin/config", auth, requireRole("admin"), h(async (_req, res) => {
  const config = await loadConfig(prisma);
  res.json({ config: maskConfig(config), cronPath: cronPublicPath });
}));
app.put("/api/admin/config", auth, requireRole("admin"), h(async (req, res) => {
  const patch = req.body?.config || {};
  const clear = Array.isArray(req.body?.clear) ? req.body.clear : [];
  const current = await loadConfig(prisma);
  let next = mergeConfig(current, patch);
  if (clear.length) next = clearConfigKeys(next, clear);   // svuota segreti (es. cronSecret) + env in tempo reale
  await prisma.setting.upsert({ where: { id: "singleton" }, update: { config: next }, create: { id: "singleton", config: next } });
  applyConfigToEnv(next);   // effetto immediato (SMTP/LLM/cron) senza riavvio
  res.json({ ok: true, config: maskConfig(next) });
}));
// Comunicazioni configurabili: elenco (default + personalizzazioni) e tipi di trigger.
app.get("/api/admin/communications", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const cfg = (await getSettings()).config || {};
  res.json({ communications: getComms(cfg), triggerTypes: TRIGGER_TYPES, emailConfigured: emailEnabled() });
}));
// Invia un'anteprima di prova di una comunicazione all'indirizzo indicato.
app.post("/api/admin/communications/test", auth, requireRole("admin"), h(async (req, res) => {
  const { key, to } = req.body || {};
  const cfg = (await getSettings()).config || {};
  const comm = getComm(cfg, key);
  if (!comm) return res.status(404).json({ error: "Comunicazione non trovata" });
  const dest = String(to || req.user.email).trim();
  const { subject, text } = renderComm(comm, { name: req.user.name || "Mario Rossi", count: 7, days: comm.trigger?.days || 2, link: APP_JOBS_LINK(), plan: "Abbonamento" });
  try { const r = await sendMail({ to: dest, subject, text }); res.json({ ok: true, mode: r.simulated ? "simulata (SMTP non configurato)" : "inviata", to: dest }); }
  catch (e) { res.status(500).json({ error: e.message }); }
}));

// Send a test email to the given address (or the admin) using current SMTP.
app.post("/api/admin/config/test-email", auth, requireRole("admin"), h(async (req, res) => {
  const to = (req.body?.to || req.user.email);
  try {
    const r = await sendMail({ to, subject: "Email di prova · digitalfa", text: "Se leggi questo messaggio, l'SMTP è configurato correttamente. — digitalfa" });
    res.json({ ok: true, mode: r.simulated ? "simulata (SMTP non configurato)" : "inviata", to });
  } catch (e) { res.status(500).json({ error: e.message }); }
}));

// Verify a connector's credentials with a tiny real call → { ok, message }.
app.post("/api/admin/config/test-connector", auth, requireRole("admin"), h(async (req, res) => {
  const which = String(req.body?.connector || "").toLowerCase();
  try {
    if (which === "adzuna") {
      const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
      if (!id || !key) return res.json({ ok: false, message: "Chiavi Adzuna non impostate." });
      const url = `https://api.adzuna.com/v1/api/jobs/it/search/1?results_per_page=1&app_id=${encodeURIComponent(id)}&app_key=${encodeURIComponent(key)}`;
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) return res.json({ ok: false, message: `Adzuna ha risposto HTTP ${r.status} (controlla App ID e App Key).` });
      const body = await r.json();
      return res.json({ ok: true, message: `OK · connessione riuscita${typeof body.count === "number" ? ` · ~${body.count.toLocaleString("it-IT")} offerte disponibili in Italia` : ""}.` });
    }
    if (which === "jooble") {
      const key = process.env.JOOBLE_API_KEY;
      if (!key) return res.json({ ok: false, message: "Chiave Jooble non impostata." });
      const r = await fetch(`https://it.jooble.org/api/${encodeURIComponent(key)}`, {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ keywords: "developer", location: "Italia", page: "1" }),
      });
      if (!r.ok) return res.json({ ok: false, message: `Jooble ha risposto HTTP ${r.status} (controlla la API Key).` });
      const body = await r.json();
      return res.json({ ok: true, message: `OK · connessione riuscita${body.totalCount != null ? ` · ${Number(body.totalCount).toLocaleString("it-IT")} risultati per la ricerca di prova` : ""}.` });
    }
    // ATS diretti: prova sui board configurati in Impostazioni.
    if (["greenhouse", "lever", "smartrecruiters"].includes(which)) {
      const cfg = (await getSettings()).config || {};
      const boards = atsBoardsFrom(cfg)[which] || [];
      if (!boards.length) return res.json({ ok: false, message: `Nessun board ${which} configurato: aggiungi almeno un'azienda in Impostazioni.` });
      const { jobs, mode } = await fetchFromConnector({ id: "test", connector: which, apiConfig: { boards, keywords: "" } });
      return res.json({ ok: true, message: `OK · ${jobs.length} annunci letti da ${boards.length} board (${mode}).` });
    }
    // Generico per tutti gli altri connettori: esegue una ricerca di prova reale.
    const KNOWN = ["arbeitnow", "remotive", "remoteok", "jobicy", "jobdataapi", "arbeitsagentur", "findwork", "theirstack", "jsearch", "serpapi", "apify", "brightdata"];
    if (KNOWN.includes(which)) {
      // Usa la chiave SALVATA in config (non dipende dalla variabile d'ambiente).
      const cfg = (await getSettings()).config || {};
      const KEY_OF = { findwork: "findworkApiKey", theirstack: "theirstackApiKey", jsearch: "rapidapiKey", serpapi: "serpapiKey", apify: "apifyToken", brightdata: "brightdataApiKey" };
      const apiConfig = { keywords: "manager", location: "Italy", country: "it" };
      if (KEY_OF[which]) apiConfig.apiKey = String(cfg[KEY_OF[which]] || "").trim();
      if (which === "apify") apiConfig.actorId = cfg.apifyActorId || undefined;
      if (which === "brightdata") apiConfig.datasetId = cfg.brightdataDatasetId || undefined;
      if (KEY_OF[which] && !apiConfig.apiKey) return res.json({ ok: false, message: "Chiave non impostata: incolla la chiave qui sopra e premi Salva, poi Verifica." });
      const { jobs, mode } = await fetchFromConnector({ id: "test", connector: which, apiConfig });
      if (/simulato|fallback/i.test(mode)) return res.json({ ok: false, message: mode });
      return res.json({ ok: true, message: `OK · ${jobs.length} offerte lette nella prova (${mode}).` });
    }
    return res.status(400).json({ error: "Connettore non riconosciuto" });
  } catch (e) {
    return res.json({ ok: false, message: `Errore di rete: ${e.message}` });
  }
}));

app.post("/api/admin/scan-all", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const sources = await prisma.source.findMany({ where: { status: "active" } });
  const results = [];
  for (const s of sources) { const log = await runScan(prisma, s); results.push({ source: s.name, ...log }); }
  res.json({ ran: results.length, results });
}));

app.get("/api/admin/scan-logs", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const logs = await prisma.scanLog.findMany({ orderBy: { runAt: "desc" }, take: 40 });
  const sources = await prisma.source.findMany();
  res.json(logs.map((l) => ({ ...l, sourceName: l.label || sources.find((s) => s.id === l.sourceId)?.name || "—" })));
}));

app.get("/api/admin/positions", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const jobs = await prisma.job.findMany({ where });
  const sources = await prisma.source.findMany();
  const byId = new Map(sources.map((s) => [s.id, s.name]));
  const positions = jobs.map((j) => ({ ...j, sourceName: sourceLabelOf(j, byId), simulated: isSimulatedJob(j) }))
    .sort((a, b) => (a.status === b.status ? new Date(b.lastSeenAt) - new Date(a.lastSeenAt) : a.status === "active" ? -1 : 1));
  res.json({ positions, counts: { active: await prisma.job.count({ where: { status: "active" } }), inactive: await prisma.job.count({ where: { status: "inactive" } }) } });
}));
app.patch("/api/admin/positions/:id", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const data = { status: req.body.status, ...(req.body.status === "inactive" ? { deactivatedAt: today() } : { lastSeenAt: today() }) };
  const job = await prisma.job.update({ where: { id: req.params.id }, data });
  const source = job.sourceId ? await prisma.source.findUnique({ where: { id: job.sourceId } }) : null;
  res.json({ ...job, sourceName: source?.name || null });
}));

// Elimina dal bacino le offerte demo/simulate, tenendo solo quelle scaricate da portali reali.
app.post("/api/admin/jobs/purge-simulated", auth, requireRole("admin"), h(async (_req, res) => {
  const jobs = await prisma.job.findMany();
  const toDelete = jobs.filter(isSimulatedJob).map((j) => j.id);
  if (toDelete.length) {
    await prisma.application.deleteMany({ where: { jobId: { in: toDelete } } });
    await prisma.job.deleteMany({ where: { id: { in: toDelete } } });
  }
  const remaining = await prisma.job.count();
  res.json({ ok: true, deleted: toDelete.length, remaining });
}));
// Elimina dal log delle scansioni le voci demo/simulate (fonti stub: simulated/linkedin/indeed).
app.post("/api/admin/scan-logs/purge-simulated", auth, requireRole("admin"), h(async (_req, res) => {
  const sources = await prisma.source.findMany();
  const simIds = sources.filter((s) => ["simulated", "linkedin", "indeed"].includes(s.connector)).map((s) => s.id);
  const r = await prisma.scanLog.deleteMany({ where: { sourceId: { in: simIds } } });
  res.json({ ok: true, deleted: r.count });
}));
// Admin: imposta una nuova password per un utente (reset manuale).
app.post("/api/admin/users/:id/set-password", auth, requireRole("admin"), h(async (req, res) => {
  const pwd = String(req.body?.password || "");
  if (pwd.length < 6) return res.status(400).json({ error: "La password deve avere almeno 6 caratteri." });
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) return res.status(404).json({ error: "Utente non trovato" });
  await prisma.user.update({ where: { id: u.id }, data: { password: bcrypt.hashSync(pwd, 10), authProvider: "password" } });
  res.json({ ok: true, email: u.email });
}));

// ---- Voucher / codici sconto (Admin) ----
app.get("/api/admin/vouchers", auth, requireRole("admin", "staff"), h(async (_req, res) => {
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ vouchers });
}));
app.post("/api/admin/vouchers", auth, requireRole("admin"), h(async (req, res) => {
  const b = req.body || {};
  let code = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) code = "DIGI" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const percent = Math.max(1, Math.min(100, parseInt(b.percent, 10) || 100));
  const durationDays = Math.max(1, parseInt(b.durationDays, 10) || 30);
  const maxRedemptions = b.maxRedemptions != null && b.maxRedemptions !== "" ? Math.max(1, parseInt(b.maxRedemptions, 10)) : null;
  if (await prisma.voucher.findUnique({ where: { code } }).catch(() => null)) return res.status(409).json({ error: "Codice già esistente." });
  const v = await prisma.voucher.create({ data: { id: nid("vou"), code, percent, durationDays, maxRedemptions, note: b.note || null, active: true, createdAt: new Date().toISOString() } });
  res.json({ voucher: v });
}));
app.patch("/api/admin/vouchers/:id", auth, requireRole("admin"), h(async (req, res) => {
  const data = {};
  if (req.body.active !== undefined) data.active = !!req.body.active;
  const v = await prisma.voucher.update({ where: { id: req.params.id }, data });
  res.json({ voucher: v });
}));
app.delete("/api/admin/vouchers/:id", auth, requireRole("admin"), h(async (req, res) => {
  await prisma.voucher.deleteMany({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// Admin: inoltra una posizione a qualcuno via email. Il nome di chi la manda finisce nell'oggetto.
app.post("/api/admin/positions/:id/forward", auth, requireRole("admin", "staff"), h(async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const fromName = String(req.body?.fromName || req.user.name || "digitalfa").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: "Inserisci un'email valida." });
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Posizione non trovata" });
  const cfg = (await getSettings()).config || {};
  const comm = getComm(cfg, "share_offer");
  const link = job.url || `${FRONTEND_URL}/#/app/jobs`;
  const { subject, text } = renderComm(comm || { subject: "{name} ti consiglia una posizione: {jobTitle}", body: "{name} ti consiglia {jobTitle} — {company}: {link}" }, { name: fromName, jobTitle: job.title, company: job.company, link });
  let sent = false;
  try { const r = await sendMail({ to, subject, text }); sent = !r.simulated; } catch (e) { /* non bloccante */ }
  res.json({ ok: true, sent, to });
}));

app.post("/api/admin/reset", auth, requireRole("admin", "staff"), h(async (_req, res) => { await seedDb(prisma); res.json({ ok: true }); }));

// ---- Serve built client ----
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// First-deploy convenience: seed demo data if the DB is empty.
if (process.env.SEED_ON_EMPTY === "1") {
  try { if ((await prisma.user.count()) === 0) { await seedDb(prisma); console.log("[seed] DB vuoto → dati demo caricati"); } }
  catch (e) { console.error("[seed] saltato:", e.message); }
}

// Assicura i piani candidato aggiornati (settimanale / mensile) senza reseed completo.
async function ensurePlans() {
  const plans = [
    { id: "ind_free", audience: "individual", name: "Free", price: 0, interval: "month", popular: false, contact: false, tagline: "Per iniziare la ricerca", features: ["Profilo & CV base", "3 candidature al mese", "Risorse formative gratuite"], priceLabel: null, billingNote: null },
    { id: "ind_weekly", audience: "individual", name: "Settimanale", price: 15, interval: "week", popular: false, contact: false, tagline: "Massima flessibilità", features: ["Candidature illimitate", "Auto-candidatura assistita", "Matching avanzato sulle offerte", "Tutte le risorse premium"], priceLabel: "€14,99", billingNote: "a settimana" },
    { id: "ind_monthly", audience: "individual", name: "Mensile (conveniente)", price: 52, interval: "month", popular: true, contact: false, tagline: "Risparmi rispetto al settimanale", features: ["Tutto del piano settimanale", "Prezzo bloccato più basso", "1 sessione di coaching al mese", "Priorità nel supporto"], priceLabel: "€12,99/sett", billingNote: "fatturato ogni 4 settimane (€51,96)" },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { id: p.id }, update: p, create: p }).catch(() => {});
  }
  // Rimuovi il vecchio piano "Pro" se presente e nessuno lo usa più.
  await prisma.plan.deleteMany({ where: { id: "ind_pro" } }).catch(() => {});
}
try { await ensurePlans(); } catch (e) { console.error("[plans] ensure saltato:", e.message); }

// Apply admin-saved configuration (SMTP/LLM/cron/...) over the environment.
try { await initConfig(prisma); } catch (e) { console.error("[config] init saltato:", e.message); }

app.listen(PORT, () => {
  console.log(`digitalfa API v${APP_VERSION} · http://localhost:${PORT} · Postgres · billing ${LIVE_BILLING ? "Stripe" : "simulato"} · LinkedIn ${LINKEDIN_LIVE ? "reale" : "simulato"} · LLM ${isLLMEnabled() ? llmProvider() : "off (template)"}`);
  if (!process.env.SCHEDULER_DISABLED && process.env.EMBEDDED_SCHEDULER !== "0") startTicker(prisma, getSettings);
  // Valuta i solleciti "a tempo" (es. dopo 8 ore) ogni 30 minuti mentre il servizio è sveglio.
  if (process.env.EMBEDDED_SCHEDULER !== "0") setInterval(() => { runTimedComms().catch(() => {}); refreshSystemAlerts().catch(() => {}); }, 30 * 60 * 1000);
});
