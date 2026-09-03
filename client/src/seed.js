// Seed data for the digitalfa outplacement platform.
// All data is fictional and generated for demo purposes.

export function buildSeed() {
  const companies = [
    { id: "co-1", name: "Fintesa Group", sector: "Servizi finanziari", city: "Milano", logo: "FG",
      plan: "Business", seatsTotal: 30, activeSince: "2025-09-01",
      careersUrl: "https://careers.fintesa.example/jobs" },
    { id: "co-2", name: "NovaMeccanica", sector: "Manifatturiero", city: "Torino", logo: "NM",
      plan: "Starter", seatsTotal: 10, activeSince: "2026-01-15",
      careersUrl: "https://novameccanica.example/lavora-con-noi" },
    { id: "co-3", name: "Aurora Retail", sector: "Retail & GDO", city: "Bologna", logo: "AR",
      plan: "Starter", seatsTotal: 10, activeSince: "2026-03-10",
      careersUrl: "https://aurora-retail.example/careers" },
  ];

  const users = [
    { id: "u-admin", role: "admin", name: "Sara Bianchi", email: "admin@digitalfa.demo",
      password: "demo", title: "Platform Administrator", avatar: "SB" },
    { id: "u-coach-1", role: "coach", name: "Marco Ferretti", email: "coach@digitalfa.demo",
      password: "demo", title: "Senior Career Coach", avatar: "MF",
      bio: "15 anni di esperienza in ricollocamento e sviluppo di carriera. Specializzato in profili manageriali e tech.",
      specialties: ["Leadership", "Tech & Digital", "Personal branding"] },
    { id: "u-coach-2", role: "coach", name: "Elena Costa", email: "elena@digitalfa.demo",
      password: "demo", title: "Career Coach", avatar: "EC",
      bio: "Coach certificata ICF, focus su transizioni di carriera e re-skilling.",
      specialties: ["Re-skilling", "Colloqui", "Neolaureati"] },
    { id: "u-hr-1", role: "hr", name: "Giulia Romano", email: "hr@digitalfa.demo",
      password: "demo", title: "HR Director", avatar: "GR", companyId: "co-1" },
    { id: "u-hr-2", role: "hr", name: "Paolo Greco", email: "paolo@digitalfa.demo",
      password: "demo", title: "People & Culture Manager", avatar: "PG", companyId: "co-2" },
    { id: "u-cand-1", role: "candidate", name: "Luca Moretti", email: "candidate@digitalfa.demo",
      password: "demo", title: "Marketing Manager", avatar: "LM",
      companyId: "co-1", coachId: "u-coach-1", programId: "pr-1",
      location: "Milano", seniority: "Manager", industry: "Marketing",
      headline: "Marketing Manager con 12 anni di esperienza nel B2B e nel digitale.",
      skills: ["Digital marketing", "Team leadership", "Budgeting", "SEO/SEM", "Analytics"],
      status: "active", enrolledAt: "2026-05-04" },
    { id: "u-cand-2", role: "candidate", name: "Francesca Neri", email: "francesca@digitalfa.demo",
      password: "demo", title: "Software Engineer", avatar: "FN",
      companyId: "co-1", coachId: "u-coach-1", programId: "pr-2",
      location: "Milano", seniority: "Senior", industry: "Tech",
      headline: "Full-stack developer, 8 anni su Java e React.",
      skills: ["Java", "React", "AWS", "SQL", "Agile"],
      status: "active", enrolledAt: "2026-05-20" },
    { id: "u-cand-3", role: "candidate", name: "Davide Fontana", email: "davide@digitalfa.demo",
      password: "demo", title: "Operations Specialist", avatar: "DF",
      companyId: "co-2", coachId: "u-coach-2", programId: "pr-2",
      location: "Torino", seniority: "Mid", industry: "Operations",
      headline: "Specialista operations e supply chain in ambito manifatturiero.",
      skills: ["Supply chain", "Lean", "Excel", "SAP"],
      status: "placed", enrolledAt: "2026-02-11", placedAt: "2026-07-30" },
    { id: "u-cand-4", role: "candidate", name: "Chiara Galli", email: "chiara@digitalfa.demo",
      password: "demo", title: "Sales Account", avatar: "CG",
      companyId: "co-2", coachId: "u-coach-2", programId: "pr-1",
      location: "Torino", seniority: "Mid", industry: "Sales",
      headline: "Account commerciale con forte orientamento ai risultati.",
      skills: ["B2B sales", "CRM", "Negoziazione", "Key account"],
      status: "active", enrolledAt: "2026-06-01" },
    { id: "u-cand-5", role: "candidate", name: "Alessandro Rizzo", email: "alessandro@digitalfa.demo",
      password: "demo", title: "Store Manager", avatar: "AR",
      companyId: "co-3", coachId: "u-coach-2", programId: "pr-1",
      location: "Bologna", seniority: "Manager", industry: "Retail",
      headline: "Store manager con esperienza nella gestione di team ampi.",
      skills: ["Retail", "People management", "P&L", "Visual merchandising"],
      status: "at_risk", enrolledAt: "2026-04-18" },
  ];

  const programs = [
    { id: "pr-1", name: "Ricollocamento Executive", durationMonths: 6,
      description: "Percorso premium per profili manageriali: coaching individuale, personal branding e accesso al network executive.",
      modules: ["Bilancio di competenze", "Personal branding", "Strategia di ricerca", "Colloqui executive", "Networking mirato"] },
    { id: "pr-2", name: "Ricollocamento Professional", durationMonths: 4,
      description: "Percorso per professional e specialist: revisione CV, preparazione ai colloqui e matching con offerte.",
      modules: ["CV & LinkedIn", "Mercato del lavoro", "Preparazione colloqui", "Job matching"] },
  ];

  const milestoneTemplate = [
    { key: "onboarding", label: "Onboarding & assessment" },
    { key: "cv", label: "CV & profilo LinkedIn" },
    { key: "strategy", label: "Strategia di ricerca" },
    { key: "applications", label: "Candidature attive" },
    { key: "interviews", label: "Colloqui" },
    { key: "offer", label: "Offerta & ricollocamento" },
  ];

  const progress = {
    "u-cand-1": { onboarding: "done", cv: "done", strategy: "done", applications: "in_progress", interviews: "in_progress", offer: "todo" },
    "u-cand-2": { onboarding: "done", cv: "done", strategy: "in_progress", applications: "todo", interviews: "todo", offer: "todo" },
    "u-cand-3": { onboarding: "done", cv: "done", strategy: "done", applications: "done", interviews: "done", offer: "done" },
    "u-cand-4": { onboarding: "done", cv: "in_progress", strategy: "todo", applications: "todo", interviews: "todo", offer: "todo" },
    "u-cand-5": { onboarding: "done", cv: "todo", strategy: "todo", applications: "todo", interviews: "todo", offer: "todo" },
  };

  // ---- Subscription plans catalogue ----
  // priceId is the Stripe Price ID; left null in the seed. Fill via env
  // (STRIPE_PRICE_<PLANID>) or the admin UI when going live.
  const plans = [
    { id: "ind_free", audience: "individual", name: "Free", price: 0, interval: "month", priceId: null,
      tagline: "Per iniziare la ricerca", features: ["Profilo & CV base", "3 candidature al mese", "Risorse formative gratuite"] },
    { id: "ind_weekly", audience: "individual", name: "Settimanale", price: 15, interval: "week", priceId: null,
      priceLabel: "€14,99", billingNote: "a settimana",
      tagline: "Massima flessibilità", features: ["Candidature illimitate", "Auto-candidatura assistita", "Matching avanzato sulle offerte", "Tutte le risorse premium"] },
    { id: "ind_monthly", audience: "individual", name: "Mensile (conveniente)", price: 52, interval: "month", priceId: null, popular: true,
      priceLabel: "€12,99/sett", billingNote: "fatturato ogni 4 settimane (€51,96)",
      tagline: "Risparmi rispetto al settimanale", features: ["Tutto del piano settimanale", "Prezzo bloccato più basso", "1 sessione di coaching al mese", "Priorità nel supporto"] },
    { id: "co_starter", audience: "company", name: "Starter", price: 149, interval: "month", priceId: null, seats: 10,
      tagline: "Piccoli team", features: ["Fino a 10 dipendenti", "Dashboard HR", "Coach assegnato", "Report di base"] },
    { id: "co_business", audience: "company", name: "Business", price: 399, interval: "month", priceId: null, seats: 30, popular: true,
      tagline: "La scelta più diffusa", features: ["Fino a 30 dipendenti", "Coaching dedicato", "Upload posizioni interne", "Report avanzati & export", "Supporto prioritario"] },
    { id: "co_enterprise", audience: "company", name: "Enterprise", price: null, interval: "month", priceId: null, seats: null, contact: true,
      tagline: "Grandi organizzazioni", features: ["Posti illimitati", "Onboarding dedicato", "SSO & sicurezza avanzata", "SLA e account manager", "Integrazioni su misura"] },
  ];

  // ---- Subscriptions (billing state) ----
  const subscriptions = [
    { id: "sub-1", ownerType: "user", ownerId: "u-cand-1", planId: "ind_monthly", status: "active",
      currentPeriodEnd: "2026-09-15", cancelAtPeriodEnd: false, provider: "stripe",
      stripeCustomerId: "cus_demo_luca", stripeSubscriptionId: "sub_demo_luca",
      card: { brand: "Visa", last4: "4242", expMonth: 11, expYear: 2027 }, startedAt: "2026-05-04" },
    { id: "sub-2", ownerType: "company", ownerId: "co-1", planId: "co_business", status: "active",
      currentPeriodEnd: "2026-09-01", cancelAtPeriodEnd: false, provider: "stripe",
      stripeCustomerId: "cus_demo_fintesa", stripeSubscriptionId: "sub_demo_fintesa",
      card: { brand: "Mastercard", last4: "4444", expMonth: 6, expYear: 2028 }, startedAt: "2025-09-01" },
    { id: "sub-3", ownerType: "company", ownerId: "co-2", planId: "co_starter", status: "active",
      currentPeriodEnd: "2026-09-15", cancelAtPeriodEnd: true, provider: "stripe",
      stripeCustomerId: "cus_demo_nova", stripeSubscriptionId: "sub_demo_nova",
      card: { brand: "Visa", last4: "1881", expMonth: 3, expYear: 2027 }, startedAt: "2026-01-15" },
  ];

  // ---- Scan sources (job portals + company careers pages) ----
  const sources = [
    { id: "src-1", type: "portal", name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs", connector: "linkedin",
      status: "disabled", autoScan: false, createdAt: "2026-01-10", frequencyHours: 24, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: null },
    { id: "src-2", type: "portal", name: "Indeed Italia", url: "https://it.indeed.com", connector: "indeed",
      status: "disabled", autoScan: false, createdAt: "2026-01-10", frequencyHours: 12, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: null },
    { id: "src-3", type: "portal", name: "InfoJobs", url: "https://www.infojobs.it", connector: "simulated",
      status: "disabled", autoScan: false, createdAt: "2026-02-01", frequencyHours: 24, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: null },
    { id: "src-4", type: "company_careers", name: "Fintesa Group — Carriere", url: "https://careers.fintesa.example/jobs", connector: "simulated",
      companyId: "co-1", status: "disabled", autoScan: false, createdAt: "2026-05-01", frequencyHours: 48, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: null },
    { id: "src-5", type: "portal", name: "Arbeitnow (API pubblica)", url: "https://www.arbeitnow.com/api/job-board-api", connector: "arbeitnow",
      status: "active", autoScan: true, createdAt: "2026-08-19", frequencyHours: 24, lastScanAt: null, nextScanAt: "2026-08-20T02:00:00", lastScanFound: 0, region: "Europa", apiConfig: { limit: 15 } },
    { id: "src-6", type: "portal", name: "Adzuna Italia", url: "https://api.adzuna.com/v1/api/jobs/it/search/1", connector: "http_json",
      status: "disabled", autoScan: false, createdAt: "2026-08-23", frequencyHours: 24, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: { url: "https://api.adzuna.com/v1/api/jobs/it/search/1?what=&results_per_page=50" } },
    { id: "src-7", type: "portal", name: "Jooble Italia", url: "https://it.jooble.org", connector: "jooble",
      status: "disabled", autoScan: false, createdAt: "2026-08-23", frequencyHours: 24, lastScanAt: null, nextScanAt: null, lastScanFound: 0, region: "Italia", apiConfig: { keywords: "", location: "" } },
  ];

  // ---- Positions (jobs) with lifecycle status active / inactive ----
  // origin: 'scan' (found by a source scan) or 'hr_upload' (added by a company's HR)
  const jobs = [
    { id: "job-1", title: "Head of Marketing", company: "TechWave S.p.A.", location: "Milano",
      type: "Full-time", remote: "Ibrido", salary: "70-85", industry: "Marketing", seniority: "Manager",
      postedAt: "2026-08-10", tags: ["Digital marketing", "Team leadership", "Budgeting"],
      description: "Cerchiamo un Head of Marketing per guidare la strategia di crescita B2B.",
      origin: "scan", sourceId: "src-1", status: "active", firstSeenAt: "2026-08-10", lastSeenAt: "2026-08-19", externalId: "li-90211" },
    { id: "job-2", title: "Marketing Manager", company: "Brandly", location: "Milano",
      type: "Full-time", remote: "Remoto", salary: "50-60", industry: "Marketing", seniority: "Manager",
      postedAt: "2026-08-14", tags: ["SEO/SEM", "Analytics", "Content"],
      description: "Manager marketing per una scale-up in forte crescita.",
      origin: "scan", sourceId: "src-1", status: "active", firstSeenAt: "2026-08-14", lastSeenAt: "2026-08-19", externalId: "li-90418" },
    { id: "job-3", title: "Senior Frontend Engineer", company: "Cloudnine", location: "Milano",
      type: "Full-time", remote: "Remoto", salary: "55-70", industry: "Tech", seniority: "Senior",
      postedAt: "2026-08-12", tags: ["React", "AWS", "Agile"],
      description: "Ingegnere frontend senior per prodotto SaaS.",
      origin: "scan", sourceId: "src-2", status: "active", firstSeenAt: "2026-08-12", lastSeenAt: "2026-08-19", externalId: "in-33120" },
    { id: "job-4", title: "Backend Developer (Java)", company: "Finlogic", location: "Milano",
      type: "Full-time", remote: "Ibrido", salary: "48-62", industry: "Tech", seniority: "Senior",
      postedAt: "2026-08-08", tags: ["Java", "SQL", "AWS"],
      description: "Sviluppatore backend per piattaforma fintech.",
      origin: "scan", sourceId: "src-2", status: "active", firstSeenAt: "2026-08-08", lastSeenAt: "2026-08-19", externalId: "in-33004" },
    { id: "job-5", title: "Supply Chain Analyst", company: "MechPro", location: "Torino",
      type: "Full-time", remote: "In sede", salary: "38-45", industry: "Operations", seniority: "Mid",
      postedAt: "2026-08-11", tags: ["Supply chain", "Lean", "SAP"],
      description: "Analista supply chain per stabilimento manifatturiero.",
      origin: "scan", sourceId: "src-1", status: "active", firstSeenAt: "2026-08-11", lastSeenAt: "2026-08-19", externalId: "li-90333" },
    { id: "job-6", title: "Key Account Manager", company: "SalesForce Italia", location: "Torino",
      type: "Full-time", remote: "Ibrido", salary: "45-55", industry: "Sales", seniority: "Mid",
      postedAt: "2026-08-13", tags: ["B2B sales", "CRM", "Key account"],
      description: "Account manager per la gestione di clienti strategici.",
      origin: "scan", sourceId: "src-2", status: "active", firstSeenAt: "2026-08-13", lastSeenAt: "2026-08-19", externalId: "in-33210" },
    { id: "job-7", title: "Store Manager Bologna Centro", company: "Fintesa Group", location: "Bologna",
      type: "Full-time", remote: "In sede", salary: "40-48", industry: "Retail", seniority: "Manager",
      postedAt: "2026-08-05", tags: ["Retail", "People management", "P&L"],
      description: "Posizione caricata internamente dall'HR aziendale.",
      origin: "hr_upload", sourceId: null, companyId: "co-1", status: "active", firstSeenAt: "2026-08-05", lastSeenAt: "2026-08-19" },
    // Inactive: no longer present in the latest scan of its source
    { id: "job-8", title: "Digital Marketing Specialist", company: "OldCorp", location: "Milano",
      type: "Full-time", remote: "Ibrido", salary: "35-42", industry: "Marketing", seniority: "Mid",
      postedAt: "2026-07-02", tags: ["SEO/SEM", "Social", "Analytics"],
      description: "Offerta non più disponibile: rimossa dalla fonte all'ultima scansione.",
      origin: "scan", sourceId: "src-1", status: "inactive", firstSeenAt: "2026-07-02", lastSeenAt: "2026-08-05", deactivatedAt: "2026-08-12", externalId: "li-88720" },
    { id: "job-9", title: "IT Project Manager", company: "Legacy Systems", location: "Torino",
      type: "Full-time", remote: "In sede", salary: "50-58", industry: "Tech", seniority: "Senior",
      postedAt: "2026-06-20", tags: ["Project management", "Agile", "PMP"],
      description: "Offerta archiviata automaticamente: non rilevata nelle ultime 2 scansioni.",
      origin: "scan", sourceId: "src-2", status: "inactive", firstSeenAt: "2026-06-20", lastSeenAt: "2026-07-28", deactivatedAt: "2026-08-01", externalId: "in-31990" },
  ];

  const applications = [
    { id: "app-1", candidateId: "u-cand-1", jobId: "job-1", stage: "interview", appliedAt: "2026-08-11", updatedAt: "2026-08-17" },
    { id: "app-2", candidateId: "u-cand-1", jobId: "job-2", stage: "applied", appliedAt: "2026-08-15", updatedAt: "2026-08-15" },
    { id: "app-3", candidateId: "u-cand-2", jobId: "job-3", stage: "screening", appliedAt: "2026-08-13", updatedAt: "2026-08-16" },
    { id: "app-4", candidateId: "u-cand-3", jobId: "job-5", stage: "offer", appliedAt: "2026-07-12", updatedAt: "2026-07-28" },
  ];

  const sessions = [
    { id: "s-1", candidateId: "u-cand-1", coachId: "u-coach-1", date: "2026-08-21T10:00:00", topic: "Preparazione colloquio TechWave", status: "scheduled", mode: "Video" },
    { id: "s-2", candidateId: "u-cand-1", coachId: "u-coach-1", date: "2026-08-07T10:00:00", topic: "Revisione strategia di ricerca", status: "completed", mode: "Video",
      notes: "Definiti 3 settori target. Luca aggiornerà LinkedIn entro venerdì." },
    { id: "s-3", candidateId: "u-cand-2", coachId: "u-coach-1", date: "2026-08-22T14:30:00", topic: "Ottimizzazione CV tecnico", status: "scheduled", mode: "Video" },
    { id: "s-4", candidateId: "u-cand-4", coachId: "u-coach-2", date: "2026-08-20T09:00:00", topic: "Bilancio di competenze", status: "scheduled", mode: "In presenza" },
    { id: "s-5", candidateId: "u-cand-5", coachId: "u-coach-2", date: "2026-08-06T11:00:00", topic: "Kick-off percorso", status: "completed", mode: "Video",
      notes: "Primo incontro. Alessandro poco disponibile, da ricontattare per fissare il prossimo step." },
    { id: "s-6", candidateId: "u-cand-3", coachId: "u-coach-2", date: "2026-07-25T15:00:00", topic: "Negoziazione offerta", status: "completed", mode: "Video",
      notes: "Offerta accettata! Ricollocato in MechPro." },
  ];

  const resources = [
    { id: "r-1", title: "Come strutturare un CV che supera gli ATS", type: "Articolo", duration: "8 min", category: "CV", level: "Base" },
    { id: "r-2", title: "Ottimizza il tuo profilo LinkedIn", type: "Video", duration: "22 min", category: "Personal branding", level: "Base" },
    { id: "r-3", title: "Rispondere alle domande difficili in colloquio", type: "Video", duration: "35 min", category: "Colloqui", level: "Intermedio" },
    { id: "r-4", title: "Costruire e attivare il tuo network", type: "Corso", duration: "1h 10min", category: "Networking", level: "Intermedio" },
    { id: "r-5", title: "Negoziazione salariale: guida pratica", type: "Articolo", duration: "12 min", category: "Offerta", level: "Avanzato" },
    { id: "r-6", title: "Personal branding per manager", type: "Corso", duration: "2h", category: "Personal branding", level: "Avanzato" },
  ];

  // ---- Scan run log ----
  const scanLogs = [
    { id: "log-1", sourceId: "src-1", runAt: "2026-08-19T02:00:00", found: 3, added: 0, deactivated: 0, status: "ok" },
    { id: "log-2", sourceId: "src-2", runAt: "2026-08-19T06:00:00", found: 2, added: 0, deactivated: 0, status: "ok" },
    { id: "log-3", sourceId: "src-1", runAt: "2026-08-12T02:00:00", found: 3, added: 0, deactivated: 1, status: "ok" },
    { id: "log-4", sourceId: "src-2", runAt: "2026-08-01T06:00:00", found: 2, added: 0, deactivated: 1, status: "ok" },
    { id: "log-5", sourceId: "src-4", runAt: "2026-08-18T02:00:00", found: 1, added: 1, deactivated: 0, status: "ok" },
  ];

  users.forEach((u) => { if (u.role === "candidate") { u.onboarded = true; if (!u.preferredLocations && u.location) u.preferredLocations = [u.location]; if (!u.desiredTitles && u.title) u.desiredTitles = [u.title]; } });

  return {
    companies, users, programs, milestoneTemplate, progress,
    plans, subscriptions, sources, jobs, applications, sessions, resources, scanLogs,
  };
}
