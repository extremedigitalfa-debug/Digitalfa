import { useState } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Avatar } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import { Pricing, Signup, AuthCallback, ResetPassword } from "./pages/public.jsx";
import {
  CandidateDashboard, CandidateJobs, CandidateSessions, CandidateProfile, CandidateResources,
} from "./pages/candidate.jsx";
import { CoachDashboard, CoachCandidate } from "./pages/coach.jsx";
import { HrDashboard, HrPositions } from "./pages/hr.jsx";
import { AdminOverview, AdminUsers, AdminCompanies, AdminSources, AdminPositions, AdminMatching, AdminCandidateActivity, AdminSettings } from "./pages/admin.jsx";
import { ReferralDashboard } from "./pages/referral.jsx";
import { BillingPage } from "./pages/billing.jsx";
import { OnboardingWizard } from "./pages/onboarding.jsx";
import { AccountSettings } from "./pages/account.jsx";
import { CandidateAnswers } from "./pages/answers.jsx";
import Home from "./pages/home.jsx";
import { CandidateReferral } from "./pages/refer.jsx";

// Admin sections keyed so limited "staff" users can be granted a subset.
const ADMIN_NAV = [
  { key: "overview", to: "/app", label: "Panoramica", ico: "◎", end: true },
  { key: "companies", to: "/app/companies", label: "Aziende", ico: "▤" },
  { key: "sources", to: "/app/sources", label: "Fonti & Scansioni", ico: "⟳" },
  { key: "positions", to: "/app/positions", label: "Posizioni", ico: "◇" },
  { key: "matching", to: "/app/matching", label: "Matching", ico: "◍" },
  { key: "activity", to: "/app/activity", label: "Attività candidati", ico: "◈" },
  { key: "users", to: "/app/users", label: "Utenti", ico: "◐" },
];

const NAV = {
  candidate: [
    { to: "/app/jobs", label: "Offerte per me", ico: "◇" },
    { to: "/app", label: "Il mio percorso", ico: "◎", end: true },
    { to: "/app/sessions", label: "Coaching", ico: "◈" },
    { to: "/app/resources", label: "Risorse", ico: "▤" },
    { to: "/app/profile", label: "Profilo & CV", ico: "◐" },
    { to: "/app/answers", label: "Risposte candidatura", ico: "✎" },
    { to: "/app/refer", label: "Porta un amico", ico: "◫" },
    { to: "/app/onboarding", label: "Preferenze di ricerca", ico: "☰" },
    { to: "/app/billing", label: "Abbonamento", ico: "◧" },
  ],
  coach: [
    { to: "/app", label: "I miei candidati", ico: "◎", end: true },
  ],
  hr: [
    { to: "/app", label: "Dashboard aziendale", ico: "◎", end: true },
    { to: "/app/positions", label: "Posizioni aperte", ico: "◇" },
    { to: "/app/billing", label: "Abbonamento", ico: "◧" },
  ],
  referral: [
    { to: "/app", label: "Referral", ico: "◎", end: true },
  ],
  // Admin vede tutte le sezioni + Impostazioni (non delegabile allo staff).
  admin: [...ADMIN_NAV, { key: "settings", to: "/app/settings", label: "Impostazioni", ico: "⚙" }],
};

export const APP_VERSION = "1.36.2";
const ROLE_LABEL = { candidate: "Candidato", coach: "Career Coach", hr: "Azienda · HR", admin: "Amministratore", referral: "Referral", staff: "Staff" };

// Staff = limited admin: nav is the admin sections they were granted.
// "Impostazioni Account" NON è nella nav: sta sotto il nome utente (footer), per tutti i ruoli.
function navFor(user) {
  return user.role === "staff"
    ? ADMIN_NAV.filter((n) => (user.permissions || []).includes(n.key))
    : (NAV[user.role] || []);
}

function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  const items = navFor(user);
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-logo">d</div>
        <div>
          <div className="brand-name">digitalfa</div>
          <div className="brand-sub">Career Transition</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-section">{ROLE_LABEL[user.role]}</div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-ico">{it.ico}</span>{it.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip">
          <Avatar text={user.avatar} />
          <div className="meta">
            <div className="n">{user.name}</div>
            <div className="r">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
        <NavLink to="/app/account" onClick={onNavigate} className={({ isActive }) => `acct-link ${isActive ? "active" : ""}`}>⚙ Impostazioni Account</NavLink>
        <button className="logout" onClick={logout}>Esci</button>
        <div className="version">digitalfa v{APP_VERSION}</div>
      </div>
    </aside>
  );
}

const TITLES = [
  { re: /^\/app\/jobs/, t: "Offerte per me", s: "Posizioni selezionate in base al tuo profilo" },
  { re: /^\/app\/sessions/, t: "Coaching", s: "Le tue sessioni con il career coach" },
  { re: /^\/app\/resources/, t: "Risorse", s: "Contenuti e corsi per la tua transizione" },
  { re: /^\/app\/profile/, t: "Profilo & CV", s: "Le informazioni che i recruiter vedono" },
  { re: /^\/app\/billing/, t: "Abbonamento", s: "Piano, rinnovo e metodo di pagamento" },
  { re: /^\/app\/onboarding/, t: "Preferenze di ricerca", s: "Il tuo profilo guida la ricerca delle offerte" },
  { re: /^\/app\/answers/, t: "Risposte candidatura", s: "Le tue risposte pronte alle domande dei form" },
  { re: /^\/app\/refer/, t: "Porta un amico", s: "Invita e ricevi 2 settimane gratis" },
  { re: /^\/app\/account/, t: "Impostazioni Account", s: "Profilo, password e sessione" },
  { re: /^\/app\/users/, t: "Utenti", s: "Tutti gli utenti della piattaforma" },
  { re: /^\/app\/companies/, t: "Aziende clienti", s: "Organizzazioni servite e pagine carriere" },
  { re: /^\/app\/sources/, t: "Fonti & Scansioni", s: "Portali e pagine da cui raccogliere le offerte" },
  { re: /^\/app\/positions/, t: "Posizioni", s: "Tutte le offerte, classificate per stato" },
  { re: /^\/app\/matching/, t: "Metodologia matching", s: "Come si calcola la compatibilità candidato–offerta" },
  { re: /^\/app\/activity/, t: "Attività candidati", s: "Offerte inviate per match e candidature per ogni candidato" },
  { re: /^\/app\/settings/, t: "Impostazioni", s: "SMTP, LLM, cron della scansione e template delle comunicazioni" },
  { re: /^\/app\/candidate/, t: "Scheda candidato", s: "Percorso, sessioni e candidature" },
];
const DEFAULT_TITLE = {
  candidate: { t: "Il mio percorso", s: "Bentornato — ecco a che punto sei" },
  coach: { t: "I miei candidati", s: "Il tuo portfolio di persone in ricollocamento" },
  hr: { t: "Dashboard aziendale", s: "Andamento del programma di outplacement" },
  admin: { t: "Panoramica piattaforma", s: "Metriche e attività su tutti i clienti" },
  staff: { t: "Pannello staff", s: "Le sezioni a cui hai accesso" },
  referral: { t: "Referral", s: "Segnala candidati per la tua azienda" },
};

function Topbar({ onMenu }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const info = TITLES.find((x) => x.re.test(pathname)) || DEFAULT_TITLE[user.role];
  return (
    <header className="topbar">
      <div className="row" style={{ gap: 0, minWidth: 0 }}>
        <button className="menu-btn" onClick={onMenu} aria-label="Menu">☰</button>
        <div style={{ minWidth: 0 }}>
          <h1>{info.t}</h1>
          <div className="sub">{info.s}</div>
        </div>
      </div>
      <span className="role-pill">{ROLE_LABEL[user.role]}</span>
    </header>
  );
}

function Layout({ children }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="app">
      <div className={`sb-overlay ${menu ? "show" : ""}`} onClick={() => setMenu(false)} />
      <Sidebar open={menu} onNavigate={() => setMenu(false)} />
      <div className="main">
        <Topbar onMenu={() => setMenu((v) => !v)} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

function StaffHome() {
  const { user } = useAuth();
  const items = ADMIN_NAV.filter((n) => (user.permissions || []).includes(n.key));
  return (
    <div className="content-card" style={{ padding: 28, maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Pannello staff</h2>
      {items.length
        ? <p className="muted">Hai accesso a: {items.map((i) => i.label).join(", ")}. Scegli una sezione dal menu a sinistra.</p>
        : <p className="muted">Non ti sono ancora state assegnate sezioni. Contatta un amministratore.</p>}
    </div>
  );
}

function RoleRoutes() {
  const { user } = useAuth();
  if (user.role === "candidate") {
    // La navigazione è libera: le sezioni mostrano un invito a completare la
    // profilazione finché non è fatta (vedi ProfilingBanner in candidate.jsx).
    return (
      <Routes>
        <Route path="/app" element={<CandidateDashboard />} />
        <Route path="/app/jobs" element={<CandidateJobs />} />
        <Route path="/app/sessions" element={<CandidateSessions />} />
        <Route path="/app/resources" element={<CandidateResources />} />
        <Route path="/app/profile" element={<CandidateProfile />} />
        <Route path="/app/onboarding" element={<OnboardingWizard />} />
        <Route path="/app/answers" element={<CandidateAnswers />} />
        <Route path="/app/refer" element={<CandidateReferral />} />
        <Route path="/app/billing" element={<BillingPage />} />
        <Route path="/app/account" element={<AccountSettings />} />
        <Route path="*" element={<Navigate to="/app" />} />
      </Routes>
    );
  }
  if (user.role === "referral")
    return (
      <Routes>
        <Route path="/app" element={<ReferralDashboard />} />
        <Route path="/app/account" element={<AccountSettings />} />
        <Route path="*" element={<Navigate to="/app" />} />
      </Routes>
    );
  if (user.role === "staff") {
    const can = (k) => (user.permissions || []).includes(k);
    return (
      <Routes>
        <Route path="/app" element={can("overview") ? <AdminOverview /> : <StaffHome />} />
        {can("companies") && <Route path="/app/companies" element={<AdminCompanies />} />}
        {can("sources") && <Route path="/app/sources" element={<AdminSources />} />}
        {can("positions") && <Route path="/app/positions" element={<AdminPositions />} />}
        {can("matching") && <Route path="/app/matching" element={<AdminMatching />} />}
        {can("activity") && <Route path="/app/activity" element={<AdminCandidateActivity />} />}
        {can("users") && <Route path="/app/users" element={<AdminUsers />} />}
        <Route path="/app/account" element={<AccountSettings />} />
        <Route path="*" element={<Navigate to="/app" />} />
      </Routes>
    );
  }
  if (user.role === "coach")
    return (
      <Routes>
        <Route path="/app" element={<CoachDashboard />} />
        <Route path="/app/candidate/:id" element={<CoachCandidate />} />
        <Route path="/app/account" element={<AccountSettings />} />
        <Route path="*" element={<Navigate to="/app" />} />
      </Routes>
    );
  if (user.role === "hr")
    return (
      <Routes>
        <Route path="/app" element={<HrDashboard />} />
        <Route path="/app/positions" element={<HrPositions />} />
        <Route path="/app/billing" element={<BillingPage />} />
        <Route path="/app/account" element={<AccountSettings />} />
        <Route path="*" element={<Navigate to="/app" />} />
      </Routes>
    );
  return (
    <Routes>
      <Route path="/app" element={<AdminOverview />} />
      <Route path="/app/companies" element={<AdminCompanies />} />
      <Route path="/app/sources" element={<AdminSources />} />
      <Route path="/app/positions" element={<AdminPositions />} />
      <Route path="/app/matching" element={<AdminMatching />} />
      <Route path="/app/activity" element={<AdminCandidateActivity />} />
      <Route path="/app/settings" element={<AdminSettings />} />
      <Route path="/app/users" element={<AdminUsers />} />
      <Route path="*" element={<Navigate to="/app" />} />
    </Routes>
  );
}

function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28 }}>Termini e condizioni</h1>
      <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}</p>
      <p>Utilizzando digitalfa accetti di usare il servizio in modo lecito e conforme ai termini dei portali di terze parti. digitalfa aggrega offerte da fonti pubbliche e ti assiste nella candidatura; l'invio finale e la veridicità dei dati inseriti restano sotto la tua responsabilità.</p>
      <p>I tuoi dati (profilo, CV, risposte) sono trattati per fornirti il servizio di ricollocamento e non vengono ceduti a terzi se non per completare le candidature che autorizzi. Puoi richiedere in ogni momento l'esportazione o la cancellazione del tuo account.</p>
      <p>Gli abbonamenti si rinnovano automaticamente fino a disdetta. Puoi disdire quando vuoi dalla sezione Abbonamento.</p>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 24 }}>Questo è un testo di base, personalizzabile. Sostituiscilo con i termini legali definitivi prima del lancio.</p>
      <p><a href="#/" style={{ color: "var(--brand)", fontWeight: 600 }}>← Torna alla home</a></p>
    </div>
  );
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/auth" element={<AuthCallback />} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) return <PublicRoutes />;
  return (
    <Layout>
      <RoleRoutes />
    </Layout>
  );
}
