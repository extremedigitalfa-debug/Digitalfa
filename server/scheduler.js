// Production scheduler & scan engine.
//
// Multi-instance safe: a Postgres transaction-level ADVISORY LOCK serialises
// the "claim due sources" step, and each claimed source has its nextScanAt
// pushed forward inside the same transaction — so two app instances (or a web
// dyno + a cron hit) never scan the same source twice. The actual (possibly
// slow) connector calls run OUTSIDE the lock, so transactions stay short.
//
// Drive it three ways (any/all):
//   1. Embedded ticker (startTicker) — good for a single always-on process.
//   2. Standalone worker (worker.js) — a dedicated process; the lock makes it
//      cooperate with the web instances.
//   3. External cron → POST /api/scheduler/tick (secured by CRON_SECRET) — for
//      serverless / free hosts that sleep. Calls runDueScans once.
//
// To scale further, swap runDueScans for a BullMQ/Redis queue reusing runScan.

import { fetchFromConnector } from "./connectors/index.js";
import { heuristicCompanyType } from "./generators.js";

const LOCK_KEY = 918273; // arbitrary app-wide advisory lock id

// Content fingerprint for cross-source dedup: same company + title across
// different boards (Adzuna, Jooble, …) collapses to one offer.
export function dedupKey(title, company) {
  const n = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return `${n(company)}|${n(title)}`;
}
let seq = 5000;
const nid = (p) => `${p}-${Date.now()}-${++seq}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
const addHoursISO = (h) => new Date(Date.now() + h * 3600000).toISOString();

// Scan a single source: fetch via its connector, upsert offers, archive the
// ones that disappeared (for connectors returning the full listing).
export async function runScan(prisma, source) {
  const nowISO = new Date().toISOString(), d = today();
  const { jobs: fetched, mode, full } = await fetchFromConnector(source);
  const existing = await prisma.job.findMany({ where: { sourceId: source.id } });
  const byExt = new Map(existing.filter((j) => j.externalId).map((j) => [j.externalId, j]));
  const seen = new Set();
  let added = 0, duplicates = 0;
  for (const j of fetched) {
    const ext = j.externalId; seen.add(ext);
    const ex = byExt.get(ext);
    if (ex) {
      await prisma.job.update({ where: { id: ex.id }, data: { lastSeenAt: d, status: "active", deactivatedAt: null } });
    } else {
      const key = dedupKey(j.title, j.company);
      // cross-source dedup: same company+title already present (another board)?
      const dup = await prisma.job.findFirst({ where: { dedupKey: key, status: "active" } });
      if (dup) { duplicates++; continue; }
      await prisma.job.create({ data: { id: nid("job"), title: j.title, company: j.company, location: j.location, type: j.type, remote: j.remote, salary: j.salary, industry: j.industry, seniority: j.seniority, postedAt: j.postedAt, tags: j.tags || [], description: j.description || "", origin: "scan", sourceId: source.id, status: "active", firstSeenAt: d, lastSeenAt: d, externalId: ext, dedupKey: key, companyType: heuristicCompanyType(j), url: j.url || null } });
      added++;
    }
  }
  let deactivated = 0;
  if (full) {
    for (const j of existing.filter((x) => x.status === "active" && x.externalId && !seen.has(x.externalId))) {
      await prisma.job.update({ where: { id: j.id }, data: { status: "inactive", deactivatedAt: d } });
      deactivated++;
    }
  } else {
    const active = existing.filter((x) => x.status === "active");
    if (active.length > 2 && Math.random() < 0.5) {
      await prisma.job.update({ where: { id: active[active.length - 1].id }, data: { status: "inactive", deactivatedAt: d } });
      deactivated++;
    }
  }
  const found = await prisma.job.count({ where: { sourceId: source.id, status: "active" } });
  await prisma.source.update({ where: { id: source.id }, data: { lastScanAt: nowISO, lastScanFound: found, nextScanAt: addHoursISO(source.frequencyHours) } });
  const log = await prisma.scanLog.create({ data: { id: nid("log"), sourceId: source.id, runAt: nowISO, found, added, deactivated, status: "ok" } });
  return { ...log, mode, duplicates };
}

// Atomically claim the due sources (leader-serialised, reserved by pushing
// nextScanAt forward). Returns [] if another instance holds the lock this tick.
async function claimDueSources(prisma) {
  return prisma.$transaction(async (tx) => {
    const got = await tx.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`);
    if (!got?.[0]?.locked) return [];
    const now = Date.now();
    const active = await tx.source.findMany({ where: { status: "active", autoScan: true } });
    const due = active.filter((s) => !s.nextScanAt || new Date(s.nextScanAt).getTime() <= now);
    for (const s of due) await tx.source.update({ where: { id: s.id }, data: { nextScanAt: addHoursISO(s.frequencyHours) } });
    return due;
  });
}

// Run one scheduler pass: claim due sources, then scan them (outside the lock).
export async function runDueScans(prisma) {
  const claimed = await claimDueSources(prisma);
  let ran = 0;
  for (const s of claimed) {
    console.log(`[scheduler] scansione automatica: ${s.name}`);
    try { await runScan(prisma, s); ran++; } catch (e) { console.error(`[scheduler] errore su ${s.name}:`, e.message); }
  }
  await prisma.setting.update({ where: { id: "singleton" }, data: { lastTickAt: new Date().toISOString() } }).catch(() => {});
  return ran;
}

// Embedded self-scheduling ticker. Returns a stop() function.
export function startTicker(prisma, getSettings) {
  let timer = null;
  async function tick() {
    let interval = 60;
    try {
      const st = await getSettings();
      interval = st.checkIntervalSec || 60;
      if (st.schedulerEnabled && !process.env.SCHEDULER_DISABLED) await runDueScans(prisma);
    } catch (e) { console.error("[scheduler]", e.message); }
    timer = setTimeout(tick, Math.max(5000, interval * 1000));
  }
  timer = setTimeout(tick, 5000);
  console.log("[scheduler] ticker avviato");
  return () => clearTimeout(timer);
}
