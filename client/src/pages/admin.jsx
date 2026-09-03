import { useState, Fragment } from "react";
import { api } from "../api.js";
import { useData } from "../components/useData.js";
import {
  Card, StatCard, Badge, ProgressBar, Avatar, Spinner, Empty, StatusBadge, fmtDate, fmtDateTime, fmtDateItaly, fmtDateTimeItaly,
} from "../components/ui.jsx";

const ROLE_LABEL = { candidate: "Candidato", coach: "Coach", hr: "HR", admin: "Admin", referral: "Referral", staff: "Staff" };
const ROLE_TONE = { candidate: "blue", coach: "teal", hr: "warn", admin: "gray", referral: "green", staff: "teal" };
const ASSIGNABLE_ROLES = [["candidate", "Candidato"], ["coach", "Coach"], ["hr", "Azienda · HR"], ["referral", "Referral"], ["staff", "Staff (admin limitato)"]];
const ADMIN_SECTIONS = [["overview", "Panoramica"], ["companies", "Aziende"], ["sources", "Fonti & Scansioni"], ["positions", "Posizioni"], ["matching", "Matching"], ["users", "Utenti"]];

function SystemAlertsBanner() {
  const { data } = useData(api.adminAlerts);
  if (!data) return null;
  const alerts = data.alerts || [];
  if (alerts.length === 0) {
    return <Card style={{ borderColor: "#bfe3c8", background: "#f0faf2" }}><div style={{ fontWeight: 700, color: "var(--ok,#1c7a43)" }}>✅ Tutti i sistemi funzionano</div><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Nessun problema rilevato su fonti, scansione ed email.</div></Card>;
  }
  const KIND = { source: "Fonte offerte", smtp: "Email (SMTP)", cron: "Scansione / Cron" };
  return (
    <Card style={{ borderColor: "#f0b0a0", background: "#fff4f0" }}>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div style={{ fontWeight: 800, color: "#b3402a" }}>⚠️ {alerts.length} problema/i rilevato/i</div>
        <span className="muted" style={{ fontSize: 12 }}>Ricevi anche un'email quando compare un nuovo problema.</span>
      </div>
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        {alerts.map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <Badge tone={a.level === "error" ? "red" : "warn"}>{KIND[a.kind] || a.kind}</Badge>
            <div style={{ fontSize: 13 }}>{a.message}</div>
          </div>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>Le fonti in errore si risolvono aggiornando la chiave in <strong>Impostazioni</strong>; gli errori SMTP nella sezione Email. L'avviso sparisce da solo quando il problema rientra.</div>
    </Card>
  );
}

export function AdminOverview() {
  const { data, loading } = useData(api.adminOverview);
  if (loading || !data) return <Spinner />;
  const { stats, byStatus, companyStats, coachLoad } = data;
  const statusRows = [
    { key: "active", label: "In percorso", tone: "blue" },
    { key: "placed", label: "Ricollocati", tone: "green" },
    { key: "at_risk", label: "A rischio", tone: "red" },
  ];
  const totalCand = stats.candidates || 1;

  return (
    <div className="stack">
      <SystemAlertsBanner />
      <div className="grid cols-4">
        <StatCard label="MRR (ricavi/mese)" value={`€${stats.mrr}`} icon="◧" tone="green" delta="da abbonamenti attivi" />
        <StatCard label="Aziende clienti" value={stats.companies} icon="▤" tone="blue" />
        <StatCard label="Candidati totali" value={stats.candidates} icon="◐" tone="teal" />
        <StatCard label="Ricollocati" value={stats.placed} icon="✓" tone="warn" delta={`${stats.placementRate}% tasso globale`} />
      </div>
      <div className="grid cols-4">
        <StatCard label="Posizioni attive" value={stats.activePositions} icon="◇" tone="blue" />
        <StatCard label="Fonti attive" value={stats.sources} icon="⟳" tone="teal" />
        <StatCard label="Career coach" value={stats.coaches} icon="◈" tone="warn" />
        <StatCard label="Tasso ricollocamento" value={`${stats.placementRate}%`} icon="▸" tone="green" />
      </div>

      <div className="grid cols-2">
        <Card>
          <h3 className="section-title">Distribuzione candidati per stato</h3>
          <div className="stack" style={{ gap: 16 }}>
            {statusRows.map((r) => {
              const v = byStatus[r.key] || 0;
              const pct = Math.round((v / totalCand) * 100);
              return (
                <div key={r.key}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span className="row" style={{ gap: 8 }}><Badge tone={r.tone}>{r.label}</Badge></span>
                    <span className="muted" style={{ fontSize: 12.5 }}>{v} · {pct}%</span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="section-title">Carico dei coach</h3>
          {coachLoad.map((c) => (
            <div className="list-item" key={c.id}>
              <Avatar text={c.avatar} />
              <div className="grow"><div className="title">{c.name}</div><div className="sub">{c.caseload} candidati seguiti</div></div>
              <Badge tone={c.caseload > 3 ? "warn" : "green"}>{c.caseload > 3 ? "Carico alto" : "Ok"}</Badge>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <h3 className="section-title">Andamento per azienda cliente</h3>
        <table>
          <thead><tr><th>Azienda</th><th>Settore</th><th>Piano</th><th>Iscritti</th><th>Ricollocati</th><th>Tasso</th></tr></thead>
          <tbody>
            {companyStats.map((co) => (
              <tr key={co.id}>
                <td><div className="row" style={{ gap: 10 }}><div className="brand-logo" style={{ width: 30, height: 30, fontSize: 12 }}>{co.logo}</div><span style={{ fontWeight: 600 }}>{co.name}</span></div></td>
                <td className="muted">{co.sector}</td>
                <td><Badge tone="blue">{co.plan}</Badge></td>
                <td>{co.enrolled}</td>
                <td>{co.placed}</td>
                <td>{co.enrolled ? Math.round((co.placed / co.enrolled) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const BLOCK_DURATIONS = [{ days: 7, label: "7 giorni" }, { days: 30, label: "30 giorni" }, { days: 90, label: "90 giorni" }];

export function AdminUsers() {
  const { data, loading, reload } = useData(api.adminUsers);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(null);
  const [dur, setDur] = useState({});      // per-user selected block duration
  const [confirmDel, setConfirmDel] = useState(null);
  const [flash, setFlash] = useState("");
  const [roleEdit, setRoleEdit] = useState(null);   // userId whose role is being edited
  const [pRole, setPRole] = useState("candidate");
  const [pPerms, setPPerms] = useState([]);

  if (loading || !data) return <Spinner />;

  async function block(u, days) {
    setBusy(u.id);
    try { await api.adminBlockUser(u.id, days); setFlash(days ? `${u.name} sospeso per ${days} giorni.` : `${u.name} riattivato.`); reload(); }
    catch (e) { setFlash(e.message || "Errore"); }
    finally { setBusy(null); }
  }
  function startRole(u) { setRoleEdit(u.id); setPRole(u.role === "admin" ? "staff" : u.role); setPPerms(u.permissions || []); }
  function togglePerm(k) { setPPerms((ps) => ps.includes(k) ? ps.filter((x) => x !== k) : [...ps, k]); }
  async function saveRole(u) {
    setBusy(u.id);
    try { await api.adminSetRole(u.id, pRole, pRole === "staff" ? pPerms : []); setFlash(`Ruolo di ${u.name} aggiornato in ${ROLE_LABEL[pRole]}.`); setRoleEdit(null); reload(); }
    catch (e) { setFlash(e.message || "Errore"); }
    finally { setBusy(null); }
  }
  async function remove(u) {
    setBusy(u.id);
    try { await api.adminDeleteUser(u.id); setFlash(`${u.name} eliminato.`); setConfirmDel(null); reload(); }
    catch (e) { setFlash(e.message || "Errore"); }
    finally { setBusy(null); }
  }
  async function setPassword(u) {
    const pwd = typeof window !== "undefined" ? window.prompt(`Nuova password per ${u.name} (${u.email}), minimo 6 caratteri:`) : null;
    if (!pwd) return;
    setBusy(u.id);
    try { await api.adminSetPassword(u.id, pwd); setFlash(`Password di ${u.name} aggiornata.`); }
    catch (e) { setFlash(e.message || "Errore"); }
    finally { setBusy(null); }
  }

  const needle = q.trim().toLowerCase();
  const shown = data.filter((u) =>
    (!role || u.role === role) &&
    (!state || (state === "blocked" ? u.blocked : !u.blocked)) &&
    (!needle || `${u.name} ${u.email} ${u.companyName || ""}`.toLowerCase().includes(needle))
  );

  return (
    <Card>
      <div className="row between wrap" style={{ marginBottom: 12, gap: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Utenti ({shown.length}{shown.length !== data.length ? ` / ${data.length}` : ""})</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="input sm" placeholder="Cerca nome, email, azienda…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
          <select className="input sm" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Ogni ruolo</option>
            <option value="candidate">Candidati</option>
            <option value="coach">Coach</option>
            <option value="hr">HR aziende</option>
            <option value="admin">Admin</option>
          </select>
          <div className="seg sm">
            <button className={state === "" ? "on" : ""} onClick={() => setState("")}>Tutti</button>
            <button className={state === "active" ? "on" : ""} onClick={() => setState("active")}>Attivi</button>
            <button className={state === "blocked" ? "on" : ""} onClick={() => setState("blocked")}>Sospesi</button>
          </div>
        </div>
      </div>
      {flash && <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>{flash}</p>}
      <table>
        <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Abbonamento</th><th>Stato</th><th style={{ textAlign: "right" }}>Azioni</th></tr></thead>
        <tbody>
          {shown.map((u) => (
            <Fragment key={u.id}>
            <tr style={{ opacity: u.blocked ? 0.7 : 1 }}>
              <td><div className="row" style={{ gap: 10 }}><Avatar text={u.avatar} /><span style={{ fontWeight: 600 }}>{u.name}</span></div></td>
              <td className="muted">{u.email}</td>
              <td>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.role !== "admin" && <button className="btn ghost sm" onClick={() => (roleEdit === u.id ? setRoleEdit(null) : startRole(u))}>ruolo ▾</button>}
                </div>
                {u.role === "staff" && (u.permissions || []).length > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{(u.permissions || []).length} sezioni</div>}
              </td>
              <td>
                {u.subscription ? (
                  <div>
                    <Badge tone={u.subscription.freeUntil ? "teal" : u.subscription.cancelAtPeriodEnd ? "warn" : "green"}>
                      {u.subscription.plan}{u.subscription.freeUntil ? " · gratis" : ""}
                    </Badge>
                    <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {u.subscription.planPrice || ""}
                      {u.subscription.voucherCode ? ` · voucher ${u.subscription.voucherCode} (${u.subscription.discountPercent}%)` : (u.subscription.cardLast4 ? ` · •••• ${u.subscription.cardLast4}` : "")}
                      {u.subscription.startedAt ? ` · dal ${fmtDateItaly(u.subscription.startedAt)}` : ""}
                      {u.subscription.cancelAtPeriodEnd ? " · in disdetta" : ""}
                    </div>
                  </div>
                ) : <span className="muted">{u.role === "candidate" || u.role === "hr" ? "Nessuno" : "—"}</span>}
              </td>
              <td>{u.blocked ? <Badge tone="red">Sospeso</Badge> : <Badge tone="green">Attivo</Badge>}{!u.acceptedTerms && (u.role === "candidate") ? <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>T&C non accettati</div> : null}</td>
              <td>
                <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {u.blocked ? (
                    <button className="btn ghost sm" disabled={busy === u.id} onClick={() => block(u, 0)}>Sblocca</button>
                  ) : (
                    <>
                      <select className="input sm" value={dur[u.id] || 7} onChange={(e) => setDur({ ...dur, [u.id]: +e.target.value })} style={{ width: 96 }}>
                        {BLOCK_DURATIONS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
                      </select>
                      <button className="btn ghost sm" disabled={busy === u.id} onClick={() => block(u, dur[u.id] || 7)}>Blocca</button>
                    </>
                  )}
                  <button className="btn ghost sm" disabled={busy === u.id} onClick={() => setPassword(u)}>Password</button>
                  {confirmDel === u.id ? (
                    <>
                      <button className="btn sm" disabled={busy === u.id} onClick={() => remove(u)} style={{ background: "#c0392b", color: "#fff", borderColor: "#c0392b" }}>Confermi?</button>
                      <button className="btn ghost sm" onClick={() => setConfirmDel(null)}>Annulla</button>
                    </>
                  ) : (
                    <button className="btn ghost sm" onClick={() => setConfirmDel(u.id)} style={{ color: "var(--danger, #c0392b)" }}>Cancella</button>
                  )}
                </div>
              </td>
            </tr>
            {roleEdit === u.id && (
              <tr>
                <td colSpan={6} style={{ background: "var(--brand-soft)" }}>
                  <div className="row wrap" style={{ gap: 12, alignItems: "center" }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600 }}>Assegna ruolo</label>
                    <select className="input sm" value={pRole} onChange={(e) => setPRole(e.target.value)}>
                      {ASSIGNABLE_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {pRole === "staff" && (
                      <div className="row wrap" style={{ gap: 12 }}>
                        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Sezioni visibili:</span>
                        {ADMIN_SECTIONS.map(([k, l]) => (
                          <label key={k} className="row" style={{ gap: 5, fontSize: 12.5 }}>
                            <input type="checkbox" checked={pPerms.includes(k)} onChange={() => togglePerm(k)} /> {l}
                          </label>
                        ))}
                      </div>
                    )}
                    <button className="btn sm" disabled={busy === u.id} onClick={() => saveRole(u)}>Salva</button>
                    <button className="btn ghost sm" onClick={() => setRoleEdit(null)}>Annulla</button>
                  </div>
                  {pRole === "staff" && <p className="muted" style={{ margin: "8px 0 0", fontSize: 11.5 }}>Lo staff vede solo le sezioni selezionate e non può gestire gli utenti.</p>}
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const EMPTY_CO = { name: "", sector: "", city: "", plan: "Starter", seatsTotal: 10, careersUrl: "", createSource: true, frequencyHours: 48 };

export function AdminCompanies() {
  const { data, loading, reload } = useData(api.adminCompanies);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CO);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.adminCreateCompany({ ...form, seatsTotal: +form.seatsTotal, frequencyHours: +form.frequencyHours }); setForm(EMPTY_CO); setOpen(false); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading || !data) return <Spinner />;
  return (
    <div className="stack">
      <Card>
        <div className="row between">
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>Aziende clienti</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Carica un'azienda e, se vuoi, registra la sua pagina "posizioni aperte" come fonte da scansionare.</p>
          </div>
          <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "+ Nuova azienda"}</button>
        </div>
        {open && (
          <form onSubmit={create} style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="grid cols-3" style={{ gap: 12 }}>
              <div className="field" style={{ margin: 0 }}><label>Nome *</label><input value={form.name} onChange={set("name")} placeholder="Azienda S.p.A." /></div>
              <div className="field" style={{ margin: 0 }}><label>Settore</label><input value={form.sector} onChange={set("sector")} placeholder="Manifatturiero" /></div>
              <div className="field" style={{ margin: 0 }}><label>Città</label><input value={form.city} onChange={set("city")} placeholder="Milano" /></div>
              <div className="field" style={{ margin: 0 }}><label>Piano</label>
                <select value={form.plan} onChange={set("plan")}><option>Starter</option><option>Business</option><option>Enterprise</option></select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>Posti</label><input type="number" value={form.seatsTotal} onChange={set("seatsTotal")} /></div>
              <div className="field" style={{ margin: 0 }}><label>Scansione ogni (ore)</label><input type="number" value={form.frequencyHours} onChange={set("frequencyHours")} /></div>
            </div>
            <div className="field"><label>URL pagina posizioni aperte</label><input value={form.careersUrl} onChange={set("careersUrl")} placeholder="https://azienda.com/careers" /></div>
            <label className="check"><input type="checkbox" checked={form.createSource} onChange={(e) => setForm((f) => ({ ...f, createSource: e.target.checked }))} /> Registra la pagina carriere come fonte di scansione</label>
            {err && <div className="login-err">{err}</div>}
            <button className="btn" disabled={busy} style={{ marginTop: 14 }}>{busy ? "Creazione…" : "Crea azienda"}</button>
          </form>
        )}
      </Card>

      <div className="grid cols-3">
        {data.map((co) => (
          <Card key={co.id}>
            <div className="row between">
              <div className="brand-logo" style={{ width: 44, height: 44, fontSize: 16 }}>{co.logo}</div>
              <Badge tone={co.subscription?.status === "active" ? "green" : "gray"}>{co.plan}</Badge>
            </div>
            <h3 style={{ fontSize: 16, margin: "14px 0 4px" }}>{co.name}</h3>
            <div className="muted" style={{ fontSize: 13 }}>{co.sector} · {co.city}</div>
            {co.careersUrl && <a className="link-url" href={co.careersUrl} target="_blank" rel="noreferrer">↗ {co.careersUrl.replace(/^https?:\/\//, "")}</a>}
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="row between">
              <div><div className="muted" style={{ fontSize: 12 }}>Iscritti</div><strong>{co.enrolled}/{co.seatsTotal}</strong></div>
              <div style={{ textAlign: "right" }}>
                <div className="muted" style={{ fontSize: 12 }}>Abbonamento</div>
                <strong>{co.subscription ? `rinnovo ${fmtDate(co.subscription.currentPeriodEnd)}` : "—"}</strong>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const SRC_TYPE = { portal: { label: "Portale", tone: "blue" }, company_careers: { label: "Pagina carriere", tone: "teal" } };
const CONNECTORS = [
  { id: "simulated", label: "Simulato" },
  { id: "adzuna", label: "Adzuna API (reale · multi-paese)" },
  { id: "arbeitnow", label: "Arbeitnow API (reale)" },
  { id: "jooble", label: "Jooble API (reale)" },
  { id: "remotive", label: "Remotive (remote · gratis)" },
  { id: "remoteok", label: "RemoteOK (remote · gratis)" },
  { id: "jobicy", label: "Jobicy (remote · gratis)" },
  { id: "jobdataapi", label: "jobdataapi (Italia · gratis)" },
  { id: "arbeitsagentur", label: "Arbeitsagentur (DE · gratis)" },
  { id: "findwork", label: "Findwork (dev · chiave)" },
  { id: "theirstack", label: "TheirStack (tech · chiave)" },
  { id: "jsearch", label: "JSearch · RapidAPI (Indeed/LinkedIn)" },
  { id: "http_json", label: "HTTP/JSON generico" },
  { id: "rss", label: "Feed RSS" },
  { id: "linkedin", label: "LinkedIn Partner API" },
  { id: "indeed", label: "Indeed Partner API" },
];
const ADZUNA_COVERAGE = [
  { id: "italia", label: "Solo Italia (1 paese)" },
  { id: "europa", label: "Europa (IT, GB, DE, FR, ES, NL, PL, AT)" },
  { id: "mondo", label: "Mondo (IT, GB, US, DE, FR, CA, AU, IN)" },
];
const EMPTY_SRC = { type: "portal", name: "", url: "", frequencyHours: 24, region: "Italia", connector: "simulated", keywords: "", coverage: "europa" };

export function AdminSources() {
  const { data, loading, reload } = useData(api.adminSources);
  const logs = useData(api.adminScanLogs);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SRC);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(null);
  const [flash, setFlash] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, frequencyHours: +form.frequencyHours };
      if (form.connector === "adzuna") {
        // L'admin sceglie copertura e parole chiave; l'URL/config li costruiamo noi.
        payload.url = payload.url || "https://api.adzuna.com";
        payload.region = form.coverage === "italia" ? "Italia" : form.coverage === "mondo" ? "Mondo" : "Europa";
        payload.apiConfig = { region: form.coverage, keywords: form.keywords || "" };
      }
      delete payload.keywords; delete payload.coverage;
      await api.adminCreateSource(payload); setForm(EMPTY_SRC); setOpen(false); reload();
    }
    finally { setBusy(false); }
  }
  async function toggle(s) { await api.adminUpdateSource(s.id, { status: s.status === "active" ? "disabled" : "active" }); reload(); }
  async function scan(s) {
    setScanning(s.id); setFlash("");
    try {
      const r = await api.adminScan(s.id);
      setFlash(`Scansione "${s.name}" [${r.log.mode}]: ${r.log.found} attive · +${r.log.added} nuove · ${r.log.deactivated} archiviate${r.log.duplicates ? ` · ${r.log.duplicates} duplicati evitati` : ""}`);
      reload(); logs.reload();
    } catch (e) { setFlash(e.message); } finally { setScanning(null); }
  }
  async function test(s) {
    setScanning(s.id); setFlash("");
    try {
      const r = await api.adminTestSource(s.id);
      const ex = r.sample?.map((j) => j.title).join(", ") || "—";
      setFlash(`Test "${s.name}" [${r.mode}]: ${r.count} offerte rilevate. Esempi: ${ex}`);
    } catch (e) { setFlash(e.message); } finally { setScanning(null); }
  }
  async function toggleAuto(s) { await api.adminUpdateSource(s.id, { autoScan: !s.autoScan }); reload(); }
  async function scanAll() {
    setScanning("all"); setFlash("");
    try {
      const r = await api.adminScanAll();
      const added = r.results.reduce((a, x) => a + (x.added || 0), 0);
      const deact = r.results.reduce((a, x) => a + (x.deactivated || 0), 0);
      setFlash(`Scansione di tutte le fonti attive (${r.ran}): +${added} nuove · ${deact} archiviate`);
      reload(); logs.reload();
    } catch (e) { setFlash(e.message); } finally { setScanning(null); }
  }
  async function purgeLogs() {
    if (typeof window !== "undefined" && !window.confirm("Rimuovere dal log le voci demo/simulate (fonti stub)?")) return;
    try { const r = await api.adminPurgeScanLogs(); setFlash(`Log ripulito: ${r.deleted} voci simulate rimosse.`); logs.reload(); }
    catch (e) { setFlash(e.message); }
  }

  if (loading || !data) return <Spinner />;
  const active = data.filter((s) => s.status === "active");
  const disabled = data.filter((s) => s.status === "disabled");

  return (
    <div className="stack">
      <SchedulerPanel />
      <CandidateEnginePanel />

      <Card>
        <div className="row between">
          <h3 className="section-title" style={{ margin: 0 }}>Log delle scansioni</h3>
          <button className="btn ghost sm" onClick={purgeLogs}>🧹 Pulisci log simulati</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Ogni riga è una scansione eseguita: il <strong>Motore candidati</strong> (scansione dai profili) e le eventuali fonti manuali.</p>
        {flash && <div className="flash" style={{ margin: "10px 0" }}>{flash}</div>}
        {logs.data && logs.data.length ? (
          <table>
            <thead><tr><th>Fonte / Scansione</th><th>Eseguita</th><th>Lette</th><th>Nuove</th><th>Archiviate</th><th>Esito</th></tr></thead>
            <tbody>
              {logs.data.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.sourceName}</td>
                  <td className="muted">{fmtDateTimeItaly(l.runAt)}</td>
                  <td>{l.found}</td>
                  <td>{l.added > 0 ? <span style={{ color: "var(--ok)" }}>+{l.added}</span> : "0"}</td>
                  <td>{l.deactivated > 0 ? <span style={{ color: "var(--danger)" }}>−{l.deactivated}</span> : "0"}</td>
                  <td><Badge tone="green">OK</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Nessuna scansione registrata</Empty>}
      </Card>

      <details className="adv-block">
        <summary>Fonti manuali aggiuntive (avanzato)</summary>
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 12px" }}>
          Queste sono righe-fonte create a mano (portali o pagine carriere singole) che si aggiungono al motore automatico dei candidati. Servono solo in casi particolari: normalmente basta il box qui sopra.
        </p>
      <Card>
        <div className="row between">
          <h3 className="section-title" style={{ margin: 0 }}>Fonti manuali</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" disabled={scanning === "all"} onClick={scanAll}>{scanning === "all" ? "Scansione…" : "⟳ Scansiona tutte ora"}</button>
            <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "+ Nuova fonte"}</button>
          </div>
        </div>
        {flash && <div className="flash">{flash}</div>}
        {open && (
          <form onSubmit={create} style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="grid cols-3" style={{ gap: 12 }}>
              <div className="field" style={{ margin: 0 }}><label>Tipo</label>
                <select value={form.type} onChange={set("type")}><option value="portal">Portale di lavoro</option><option value="company_careers">Pagina carriere azienda</option></select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>Nome *</label><input value={form.name} onChange={set("name")} placeholder="LinkedIn Jobs" /></div>
              <div className="field" style={{ margin: 0 }}><label>Scansione ogni (ore)</label><input type="number" value={form.frequencyHours} onChange={set("frequencyHours")} /></div>
              <div className="field" style={{ margin: 0 }}><label>Connettore</label>
                <select value={form.connector} onChange={set("connector")}>
                  {CONNECTORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {form.connector === "adzuna" ? (
                <>
                  <div className="field" style={{ margin: 0 }}><label>Copertura</label>
                    <select value={form.coverage} onChange={set("coverage")}>
                      {ADZUNA_COVERAGE.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}><label>Parole chiave (opz.)</label><input value={form.keywords} onChange={set("keywords")} placeholder="es. developer — vuoto = tutte le offerte" /></div>
                </>
              ) : (
                <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>URL *</label><input value={form.url} onChange={set("url")} placeholder="https://..." /></div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              {form.connector === "adzuna"
                ? <>Con <strong>Adzuna</strong> a tappeto imposti su Render le chiavi <code>ADZUNA_APP_ID</code> e <code>ADZUNA_APP_KEY</code>; lascia le parole chiave vuote per scaricare tutte le offerte dei paesi scelti. Senza chiavi la fonte resta simulata.</>
                : <>Suggerimento: <strong>Arbeitnow</strong> è un'API pubblica reale (nessuna chiave). LinkedIn/Indeed richiedono credenziali partner: senza chiavi il connettore usa dati simulati.</>}
            </div>
            <button className="btn" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Creazione…" : "Aggiungi fonte"}</button>
          </form>
        )}
        <div style={{ marginTop: 16 }}>
          <SourcesTable rows={active} onToggle={toggle} onScan={scan} onTest={test} onToggleAuto={toggleAuto} scanning={scanning} title="Attive" tone="green" />
        </div>
      </Card>

      {disabled.length > 0 && (
        <Card><SourcesTable rows={disabled} onToggle={toggle} onScan={scan} onTest={test} onToggleAuto={toggleAuto} scanning={scanning} title="Disattivate" tone="gray" /></Card>
      )}
      </details>
    </div>
  );
}

function SourcesTable({ rows, onToggle, onScan, onTest, onToggleAuto, scanning, title, tone }) {
  const connTone = (c) => (c === "arbeitnow" ? "green" : c === "simulated" ? "gray" : "teal");
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h3 className="section-title" style={{ margin: 0 }}>{title}</h3><Badge tone={tone}>{rows.length}</Badge>
      </div>
      {rows.length ? (
        <table>
          <thead><tr><th>Fonte</th><th>Connettore</th><th>Frequenza</th><th>Auto</th><th>Ultima scansione</th><th>Offerte</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <a className="link-url" href={s.url} target="_blank" rel="noreferrer">↗ {s.url.replace(/^https?:\/\//, "")}</a>
                </td>
                <td><Badge tone={connTone(s.connector)}>{s.connectorLabel || s.connector}</Badge></td>
                <td className="muted">ogni {s.frequencyHours}h</td>
                <td>
                  <button className={`toggle ${s.autoScan ? "on" : ""}`} title="Scansione automatica" onClick={() => onToggleAuto(s)}><span /></button>
                </td>
                <td className="muted">{s.lastScanAt ? fmtDateTime(s.lastScanAt) : "mai"}</td>
                <td><strong>{s.activePositions}</strong></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {s.status === "active" && (
                    <>
                      <button className="btn ghost sm" disabled={scanning === s.id} onClick={() => onTest(s)} style={{ marginRight: 6 }}>Testa</button>
                      <button className="btn sm" disabled={scanning === s.id} onClick={() => onScan(s)} style={{ marginRight: 6 }}>
                        {scanning === s.id ? "…" : "⟳ Scansiona"}
                      </button>
                    </>
                  )}
                  <button className="btn ghost sm" onClick={() => onToggle(s)}>{s.status === "active" ? "Disattiva" : "Attiva"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>Nessuna fonte</Empty>}
    </div>
  );
}

function SchedulerPanel() {
  const { data, loading, reload } = useData(api.adminScheduler);
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Card>Scheduler…</Card>;
  const st = data.settings;
  async function toggle() { setBusy(true); try { await api.adminUpdateScheduler({ schedulerEnabled: !st.schedulerEnabled }); reload(); } finally { setBusy(false); } }
  async function setInterval_(v) { setBusy(true); try { await api.adminUpdateScheduler({ checkIntervalSec: v }); reload(); } finally { setBusy(false); } }
  const next = data.sources.filter((s) => s.status === "active" && s.autoScan).sort((a, b) => new Date(a.nextScanAt || 0) - new Date(b.nextScanAt || 0))[0];
  return (
    <Card>
      <div className="row between wrap" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 14 }}>
          <div className={`sched-dot ${st.schedulerEnabled ? "on" : "off"}`} />
          <div>
            <h3 style={{ fontSize: 16 }}>Scheduler scansioni {st.schedulerEnabled ? "attivo" : "in pausa"}</h3>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Controlla le fonti ogni {st.checkIntervalSec}s · {data.autoActive} fonti in automatico
              {next?.nextScanAt ? ` · prossima: ${next.name} (${fmtDateTime(next.nextScanAt)})` : ""}
              {st.lastTickAt ? ` · ultimo check ${fmtDateTime(st.lastTickAt)}` : ""}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="muted" style={{ fontSize: 12.5 }}>Ogni
            <select value={st.checkIntervalSec} disabled={busy} onChange={(e) => setInterval_(+e.target.value)} style={{ margin: "0 6px", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value={30}>30s</option><option value={60}>60s</option><option value={300}>5 min</option><option value={900}>15 min</option><option value={3600}>1 ora</option>
            </select>
          </label>
          <button className={`btn ${st.schedulerEnabled ? "ghost" : ""}`} disabled={busy} onClick={toggle}>{st.schedulerEnabled ? "Metti in pausa" : "Attiva scheduler"}</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        ⚙️ Lo scheduler gira lato server: alla frequenza impostata, ogni fonte attiva con "Auto" acceso viene scansionata automaticamente. Le nuove offerte diventano attive, quelle sparite vengono archiviate. La scansione reale (es. Arbeitnow) usa l'API pubblica; per LinkedIn/Indeed serve una API partner.
      </div>
    </Card>
  );
}

// Box UNICO: fonti del motore + esegui scansione + totali del bacino + esito per fonte.
function CandidateEnginePanel() {
  const { data, loading, reload } = useData(api.adminCandidateScanInfo);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  if (loading || !data) return <Card>Motore candidati…</Card>;
  const last = data.last || {};
  const sources = data.sources || [];
  async function run() {
    setBusy(true); setFlash("");
    try {
      const r = await api.adminCandidateScanRun();
      setFlash(`Scansione completata: ${r.candidates} candidati · ${r.queries} ricerche · ${r.fetched ?? "?"} offerte lette · +${r.created} nuove nel bacino · ${r.emailed} email (${r.email}).`);
      reload();
    } catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  async function purge() {
    if (typeof window !== "undefined" && !window.confirm("Eliminare dal bacino tutte le offerte demo/simulate? Restano solo quelle scaricate da portali reali.")) return;
    setBusy(true); setFlash("");
    try { const r = await api.adminPurgeJobs(); setFlash(`Pulizia completata: ${r.deleted} offerte simulate rimosse · ${r.remaining} offerte reali nel bacino.`); reload(); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  const StatusBadge = ({ s }) => {
    if (s.status === "chiave mancante") return <Badge tone="warn">chiave mancante</Badge>;
    if (s.status === "board mancanti") return <Badge tone="warn">board mancanti</Badge>;
    if (s.ats) return <Badge tone="green">{s.boards || 0} board</Badge>;
    return s.keyed ? <Badge tone="green">chiave ok</Badge> : <Badge tone="teal">gratis</Badge>;
  };

  return (
    <Card>
      <div className="row between wrap" style={{ gap: 16 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Fonti & scansione candidati</h3>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            Motore unico guidato dai profili: le stesse ricerche si scaricano una sola volta, le offerte confluiscono in un bacino condiviso con de-duplica, poi ogni candidato riceve le nuove offerte compatibili.
            {` · email: ${data.emailConfigured ? "SMTP configurato" : "simulata (log)"}`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" disabled={busy} onClick={purge} title="Rimuove le offerte demo/simulate">🧹 Pulisci bacino</button>
          <button className="btn" disabled={busy} onClick={run}>{busy ? "Scansione…" : "⟳ Esegui scansione ora"}</button>
        </div>
      </div>

      {/* Totali del bacino */}
      <div className="row wrap" style={{ gap: 12, marginTop: 14 }}>
        <div className="stat-box"><div className="stat-n">{data.poolTotal ?? "—"}</div><div className="stat-l">offerte totali nel bacino</div></div>
        <div className="stat-box"><div className="stat-n">+{data.poolToday ?? 0}</div><div className="stat-l">aggiunte oggi</div></div>
        <div className="stat-box"><div className="stat-n">{last.fetched ?? "—"}</div><div className="stat-l">lette nell'ultima scansione</div></div>
        <div className="stat-box"><div className="stat-n">{last.created != null ? "+" + last.created : "—"}</div><div className="stat-l">nuove nell'ultima scansione</div></div>
        <div className="stat-box"><div className="stat-n" style={{ fontSize: 15 }}>{last.at ? fmtDateTimeItaly(last.at) : fmtDateItaly(data.lastDate)}</div><div className="stat-l">ultima scansione</div></div>
      </div>

      {flash && <div className="flash" style={{ marginTop: 12 }}>{flash}</div>}

      {/* Esito per fonte */}
      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Fonte</th><th>Stato</th><th style={{ textAlign: "right" }}>Ricerche inviate</th><th style={{ textAlign: "right" }}>Offerte lette</th><th style={{ textAlign: "right" }}>Nuove nel bacino</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td><StatusBadge s={s} /></td>
                <td style={{ textAlign: "right" }} className="muted">{s.lastQueries ?? "—"}</td>
                <td style={{ textAlign: "right" }} className="muted">{s.lastFetched ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{s.lastCreated > 0 ? <span style={{ color: "var(--ok,#1c7a43)", fontWeight: 700 }}>+{s.lastCreated}</span> : (s.lastCreated === 0 ? "0" : "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>
          <strong>Ricerche inviate</strong> = quante interrogazioni abbiamo mandato a quella fonte (una per ogni titolo desiderato dei candidati).
          <strong> Offerte lette</strong> = quanti annunci la fonte ci ha restituito in totale.
          <strong> Nuove nel bacino</strong> = quante di quelle erano davvero nuove (le altre erano già presenti da scansioni precedenti o trovate da un'altra fonte → de-duplicate).<br />
          "Chiave mancante" = fonte non ancora attiva: imposta la chiave in <strong>Impostazioni</strong>. Le fonti "gratis" sono sempre attive. "—" = fonte non interrogata nell'ultima scansione.
        </div>
      </div>
    </Card>
  );
}

function CommunicationsCard() {
  const { data, loading } = useData(api.adminCommunications);
  const [list, setList] = useState(null);
  const [to, setTo] = useState({});
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Card>Comunicazioni…</Card>;
  const comms = list || data.communications;
  const upd = (i, patch) => setList(comms.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const updTrig = (i, patch) => setList(comms.map((c, k) => (k === i ? { ...c, trigger: { ...c.trigger, ...patch } } : c)));
  async function save() {
    setBusy(true); setFlash("");
    try { await api.adminSaveConfig({ communications: comms }); setFlash("Comunicazioni salvate."); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  async function test(c) {
    setFlash("");
    try { const r = await api.adminCommTest(c.key, to[c.key]); setFlash(`Test «${c.name}»: ${r.mode}${r.to ? ` → ${r.to}` : ""}.`); }
    catch (e) { setFlash(e.message); }
  }
  return (
    <Card>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Comunicazioni & automazioni</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Testi e regole di invio. Placeholder: <code>{"{name}"}</code>, <code>{"{count}"}</code>, <code>{"{link}"}</code>, <code>{"{days}"}</code>. {data.emailConfigured ? "" : "SMTP non configurato: gli invii sono simulati (log)."}</p>
        </div>
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Salvo…" : "Salva comunicazioni"}</button>
      </div>
      {flash && <div className="flash" style={{ marginTop: 10 }}>{flash}</div>}
      <div className="stack" style={{ marginTop: 14 }}>
        {comms.map((c, i) => (
          <div key={c.key} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div className="row between wrap" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <strong>{c.name}</strong>
                <Badge tone={c.channel === "inapp" ? "teal" : "blue"}>{c.channel === "inapp" ? "in-app" : "email"}</Badge>
              </div>
              <label className="check" style={{ fontSize: 12.5 }}><input type="checkbox" checked={c.enabled !== false} onChange={(e) => upd(i, { enabled: e.target.checked })} /> attiva</label>
            </div>
            <div className="grid cols-2" style={{ gap: 10, marginTop: 10 }}>
              <div className="field" style={{ margin: 0 }}><label>Quando inviarla</label>
                <select value={c.trigger?.type || "manual"} onChange={(e) => updTrig(i, { type: e.target.value })}>
                  {data.triggerTypes.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                {c.trigger?.type === "days_after_signup" && <><label>Giorni dopo la registrazione</label><input type="number" min="0" value={c.trigger?.days ?? 1} onChange={(e) => updTrig(i, { days: +e.target.value })} /></>}
                {c.trigger?.type === "low_offers" && <><label>Soglia offerte / giorni minimi</label><div className="row" style={{ gap: 8 }}><input type="number" min="1" value={c.trigger?.threshold ?? 10} onChange={(e) => updTrig(i, { threshold: +e.target.value })} /><input type="number" min="0" value={c.trigger?.minDays ?? 1} onChange={(e) => updTrig(i, { minDays: +e.target.value })} /></div></>}
              </div>
            </div>
            {c.channel === "email" && <div className="field" style={{ margin: "10px 0 0" }}><label>Oggetto</label><input value={c.subject || ""} onChange={(e) => upd(i, { subject: e.target.value })} /></div>}
            <div className="field" style={{ margin: "10px 0 0" }}><label>{c.channel === "inapp" ? "Titolo box" : "Oggetto"} · Testo</label>
              {c.channel === "inapp" && <input style={{ marginBottom: 8 }} value={c.subject || ""} onChange={(e) => upd(i, { subject: e.target.value })} placeholder="Titolo del box in-app" />}
              <textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%" }} value={c.body || ""} onChange={(e) => upd(i, { body: e.target.value })} />
            </div>
            {c.channel === "email" && (
              <div className="row wrap" style={{ gap: 8, marginTop: 10, alignItems: "center" }}>
                <input className="input sm" placeholder="email per il test" value={to[c.key] || ""} onChange={(e) => setTo({ ...to, [c.key]: e.target.value })} style={{ minWidth: 220 }} />
                <button className="btn ghost sm" onClick={() => test(c)}>Invia test</button>
                <span className="muted" style={{ fontSize: 11.5 }}>Salva prima di testare, così usa il testo aggiornato.</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>I trigger "a ogni scansione", "N giorni dopo la registrazione" e "poche offerte" scattano durante la scansione giornaliera (cron). Quelli dell'abbonamento scattano all'attivazione/disattivazione.</p>
    </Card>
  );
}

function VouchersCard() {
  const { data, loading, reload } = useData(api.adminVouchers);
  const [f, setF] = useState({ code: "", percent: 100, durationDays: 30, maxRedemptions: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  if (loading || !data) return <Card>Voucher…</Card>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function create() {
    setBusy(true); setFlash("");
    try { const r = await api.adminVoucherCreate(f); setFlash(`Creato: ${r.voucher.code}`); setF({ code: "", percent: 100, durationDays: 30, maxRedemptions: "", note: "" }); reload(); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  return (
    <Card>
      <h3 className="section-title" style={{ marginTop: 0 }}>Codici sconto (voucher)</h3>
      <p className="muted" style={{ fontSize: 12.5 }}>Genera codici da dare ai candidati: si inseriscono nel carrello prima del pagamento. 100% = gratis per la durata scelta.</p>
      <div className="grid cols-3" style={{ gap: 10 }}>
        <div className="field" style={{ margin: 0 }}><label>Codice (vuoto = automatico)</label><input value={f.code} onChange={set("code")} placeholder="es. WELCOME100" /></div>
        <div className="field" style={{ margin: 0 }}><label>Sconto %</label><input type="number" min="1" max="100" value={f.percent} onChange={set("percent")} /></div>
        <div className="field" style={{ margin: 0 }}><label>Durata (giorni)</label><input type="number" min="1" value={f.durationDays} onChange={set("durationDays")} /></div>
        <div className="field" style={{ margin: 0 }}><label>Usi massimi (vuoto = illimitati)</label><input type="number" min="1" value={f.maxRedemptions} onChange={set("maxRedemptions")} /></div>
        <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Nota (interna)</label><input value={f.note} onChange={set("note")} placeholder="es. campagna LinkedIn" /></div>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 10, alignItems: "center" }}>
        <button className="btn" disabled={busy} onClick={create}>Crea voucher</button>
        {flash && <span className="muted" style={{ fontSize: 12.5 }}>{flash}</span>}
      </div>
      {data.vouchers.length > 0 && (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table>
            <thead><tr><th>Codice</th><th>Sconto</th><th>Durata</th><th>Usi</th><th>Stato</th><th></th></tr></thead>
            <tbody>
              {data.vouchers.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{v.code}{v.note ? <div className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{v.note}</div> : null}</td>
                  <td>{v.percent}%</td>
                  <td className="muted">{v.durationDays} gg</td>
                  <td className="muted">{v.redeemedCount}{v.maxRedemptions != null ? ` / ${v.maxRedemptions}` : ""}</td>
                  <td>{v.active ? <Badge tone="green">attivo</Badge> : <Badge tone="gray">disattivo</Badge>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn ghost sm" onClick={async () => { await api.adminVoucherToggle(v.id, !v.active); reload(); }}>{v.active ? "Disattiva" : "Attiva"}</button>
                    <button className="btn ghost sm" style={{ color: "var(--danger,#c0392b)", marginLeft: 6 }} onClick={async () => { await api.adminVoucherDelete(v.id); reload(); }}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CoachApplicationsCard() {
  const { data, loading } = useData(api.adminCoachApplications);
  return (
    <Card>
      <h3 className="section-title" style={{ marginTop: 0 }}>Candidature Coach ricevute</h3>
      <p className="muted" style={{ fontSize: 12.5 }}>Le candidature dal form nella pagina Coaching. Vengono anche inviate via email a <strong>{data?.inbox || "extremedigitalfa@gmail.com"}</strong> (se l'SMTP è configurato).</p>
      {loading ? <Spinner /> : !data?.applications?.length ? <Empty>Ancora nessuna candidatura.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Nome</th><th>Email</th><th>Telefono</th><th>LinkedIn</th><th>Messaggio</th><th>Email inviata</th></tr></thead>
            <tbody>
              {data.applications.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td className="muted">{a.email}</td>
                  <td className="muted">{a.phone || "—"}</td>
                  <td>{a.linkedin ? <a href={a.linkedin} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>↗</a> : <span className="muted">—</span>}</td>
                  <td className="muted" style={{ maxWidth: 280, whiteSpace: "normal" }}>{a.message || "—"}</td>
                  <td>{a.emailed ? <Badge tone="green">sì</Badge> : <Badge tone="warn">no</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const LLM_PRESETS = {
  openai: { llmProvider: "openai", llmBaseUrl: "", llmModel: "gpt-4o-mini" },
  gemini: { llmProvider: "openai", llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", llmModel: "gemini-2.5-flash" },
  anthropic: { llmProvider: "anthropic", llmBaseUrl: "", llmModel: "claude-3-5-haiku-latest" },
};

export function AdminSettings() {
  const { data, loading, reload } = useData(api.adminGetConfig);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [testTo, setTestTo] = useState("");
  const [conn, setConn] = useState({});   // { adzuna: {ok,message,busy}, jooble: {...} }
  if (loading || !data) return <Spinner />;
  const c = f || data.config;
  const set = (k) => (e) => setF({ ...c, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const atsVal = (p) => { const v = c.atsBoards && c.atsBoards[p]; return Array.isArray(v) ? v.join("\n") : (v || ""); };
  const setAts = (p) => (e) => setF({ ...c, atsBoards: { ...(c.atsBoards || {}), [p]: e.target.value.split(/[\s,;\n]+/).map((x) => x.trim()).filter(Boolean) } });
  const vidVal = () => (Array.isArray(c.resourceVideos) ? c.resourceVideos : []).map((v) => `${v.id} | ${v.title || ""} | ${v.desc || ""}`).join("\n");
  const setVid = (e) => setF({ ...c, resourceVideos: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [id, title, desc] = l.split("|").map((x) => (x || "").trim()); return { id, title: title || "", desc: desc || "" }; }).filter((v) => v.id) });
  const cronUrl = (typeof window !== "undefined" ? window.location.origin : "") + (data.cronPath || "/api/scheduler/tick");
  async function save() {
    setBusy(true); setFlash("");
    try { const r = await api.adminSaveConfig(c); setF(r.config); setFlash("Impostazioni salvate e applicate."); reload(); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  async function testEmail() {
    setBusy(true); setFlash("");
    try { const r = await api.adminTestEmail(testTo || undefined); setFlash(`Email di prova: ${r.mode}${r.to ? ` → ${r.to}` : ""}.`); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  const applyPreset = (p) => { const pr = LLM_PRESETS[p]; if (pr) setF({ ...c, ...pr }); };
  async function clearCron() {
    setBusy(true); setFlash("");
    try { const r = await api.adminClearConfig(["cronSecret"]); setF(r.config); setFlash("Segreto Cron rimosso: l'endpoint del cron ora non richiede più l'header. (Se era impostato come variabile su Render, va rimosso anche lì.)"); reload(); }
    catch (e) { setFlash(e.message); } finally { setBusy(false); }
  }
  async function testConn(which) {
    setConn((s) => ({ ...s, [which]: { busy: true } }));
    try {
      // Salva prima ciò che è digitato (i segreti vuoti restano invariati lato server),
      // così basta incollare la chiave e premere Verifica: niente più "Chiave non impostata".
      try { await api.adminSaveConfig(c); } catch (_) { /* se il salvataggio fallisce, provo comunque con la chiave già salvata */ }
      const r = await api.adminTestConnector(which);
      setConn((s) => ({ ...s, [which]: { ok: r.ok, message: r.message } }));
      reload();
    }
    catch (e) { setConn((s) => ({ ...s, [which]: { ok: false, message: e.message } })); }
  }
  const ConnResult = ({ which }) => { const r = conn[which]; if (!r) return null; return r.busy ? <span className="muted" style={{ fontSize: 12.5 }}>verifica…</span> : <span style={{ fontSize: 12.5, fontWeight: 600, color: r.ok ? "var(--ok,#1c7a43)" : "#c0392b" }}>{r.ok ? "✓ " : "✕ "}{r.message}</span>; };

  return (
    <div className="stack">
      {flash && <div className="flash">{flash}</div>}

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Scansione automatica & Cron</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>La scansione giornaliera dei profili e l'invio delle email partono da un cron esterno che chiama l'URL qui sotto una volta al giorno (o ogni ora). Imposta l'ora e, se vuoi, un segreto.</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Ora della scansione (0–23, fuso UTC)</label><input type="number" min="0" max="23" value={c.dailyScanHour ?? ""} onChange={set("dailyScanHour")} placeholder="es. 2 = 04:00 in Italia" /></div>
          <div className="field" style={{ margin: 0 }}><label>Segreto Cron {data.config.cronSecretSet ? "(impostato)" : ""}</label>
            <div className="row" style={{ gap: 8 }}>
              <input type="password" value={c.cronSecret || ""} onChange={set("cronSecret")} placeholder={data.config.cronSecretSet ? "•••• lascia vuoto per non cambiare" : "opzionale"} style={{ flex: 1 }} />
              {data.config.cronSecretSet && <button type="button" className="btn ghost sm" disabled={busy} onClick={clearCron}>Rimuovi</button>}
            </div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>URL da chiamare col cron (es. cron-job.org)</label>
          <input readOnly value={cronUrl} onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace", fontSize: 12.5 }} />
          <div className="ob-note" style={{ marginTop: 6 }}>Metodo POST. Se imposti il segreto, aggiungi l'header <code>x-cron-secret</code> con lo stesso valore. Programma il cron una volta al giorno (o ogni ora: la scansione parte all'ora indicata sopra).</div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>URL "keep-alive" (per tenere sveglio il servizio su Render)</label>
          <input readOnly value={(typeof window !== "undefined" ? window.location.origin : "") + "/api/health"} onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace", fontSize: 12.5 }} />
          <div className="ob-note" style={{ marginTop: 6 }}>Il piano gratuito di Render va in standby dopo ~15 min di inattività. Con un monitor gratuito (es. UptimeRobot) che chiama questo URL ogni 5 minuti, il servizio resta sveglio (metodo GET).</div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Email (SMTP)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Da qui partono le email ai candidati. Senza questi dati, le email restano simulate (solo log).</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Host SMTP</label><input value={c.smtpHost || ""} onChange={set("smtpHost")} placeholder="mail.digitalfa.com" /></div>
          <div className="field" style={{ margin: 0 }}><label>Porta</label><input value={c.smtpPort || ""} onChange={set("smtpPort")} placeholder="465" /></div>
          <div className="field" style={{ margin: 0 }}><label>Utente</label><input value={c.smtpUser || ""} onChange={set("smtpUser")} placeholder="no-reply@digitalfa.com" /></div>
          <div className="field" style={{ margin: 0 }}><label>Password {data.config.smtpPassSet ? "(impostata)" : ""}</label><input type="password" value={c.smtpPass || ""} onChange={set("smtpPass")} placeholder={data.config.smtpPassSet ? "•••• lascia vuoto per non cambiare" : ""} /></div>
          <div className="field" style={{ margin: 0 }}><label>Mittente (From)</label><input value={c.smtpFrom || ""} onChange={set("smtpFrom")} placeholder="digitalfa <no-reply@digitalfa.com>" /></div>
          <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={!!c.smtpSecure} onChange={set("smtpSecure")} /> Connessione SSL (porta 465)</label>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <input className="input sm" placeholder="email per il test (default: la tua)" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ minWidth: 240 }} />
          <button className="btn ghost" disabled={busy} onClick={testEmail}>Invia email di prova</button>
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Intelligenza artificiale (LLM)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Migliora estrazione dati dal CV, cover letter e messaggi. Senza chiave si usano i template.</p>
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12.5, alignSelf: "center" }}>Preset:</span>
          <button className="btn ghost sm" onClick={() => applyPreset("gemini")}>Google Gemini</button>
          <button className="btn ghost sm" onClick={() => applyPreset("openai")}>OpenAI</button>
          <button className="btn ghost sm" onClick={() => applyPreset("anthropic")}>Anthropic</button>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Provider</label>
            <select value={c.llmProvider || ""} onChange={set("llmProvider")}><option value="">(nessuno)</option><option value="openai">OpenAI-compatibile (incl. Gemini)</option><option value="anthropic">Anthropic</option></select>
          </div>
          <div className="field" style={{ margin: 0 }}><label>Modello</label><input value={c.llmModel || ""} onChange={set("llmModel")} placeholder="gemini-2.5-flash" /></div>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Base URL (per Gemini/endpoint compatibili)</label><input value={c.llmBaseUrl || ""} onChange={set("llmBaseUrl")} placeholder="https://generativelanguage.googleapis.com/v1beta/openai" /></div>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Chiave API {data.config.llmApiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.llmApiKey || ""} onChange={set("llmApiKey")} placeholder={data.config.llmApiKeySet ? "•••• lascia vuoto per non cambiare" : "la tua chiave"} /></div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Connettori offerte (Adzuna / Jooble)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Chiavi delle fonti reali usate dalla scansione. Adzuna: <a href="https://developer.adzuna.com" target="_blank" rel="noreferrer">developer.adzuna.com</a>. Jooble: chiedi la chiave su jooble.org/api/about.</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Adzuna App ID</label><input value={c.adzunaAppId || ""} onChange={set("adzunaAppId")} placeholder="es. 12ab34cd" /></div>
          <div className="field" style={{ margin: 0 }}><label>Adzuna App Key {data.config.adzunaAppKeySet ? "(impostata)" : ""}</label><input type="password" value={c.adzunaAppKey || ""} onChange={set("adzunaAppKey")} placeholder={data.config.adzunaAppKeySet ? "•••• lascia vuoto per non cambiare" : ""} /></div>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Jooble API Key {data.config.joobleApiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.joobleApiKey || ""} onChange={set("joobleApiKey")} placeholder={data.config.joobleApiKeySet ? "•••• lascia vuoto per non cambiare" : "opzionale"} /></div>
          <div className="field" style={{ margin: 0 }}><label>Findwork API Key {data.config.findworkApiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.findworkApiKey || ""} onChange={set("findworkApiKey")} placeholder={data.config.findworkApiKeySet ? "•••• lascia vuoto per non cambiare" : "findwork.dev/api"} /></div>
          <div className="field" style={{ margin: 0 }}><label>TheirStack API Key {data.config.theirstackApiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.theirstackApiKey || ""} onChange={set("theirstackApiKey")} placeholder={data.config.theirstackApiKeySet ? "•••• lascia vuoto per non cambiare" : "theirstack.com"} /></div>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>RapidAPI Key (per JSearch) {data.config.rapidapiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.rapidapiKey || ""} onChange={set("rapidapiKey")} placeholder={data.config.rapidapiKeySet ? "•••• lascia vuoto per non cambiare" : "da rapidapi.com → JSearch"} /></div>
        </div>
        <div className="ob-note" style={{ marginTop: 8 }}>Suggerimento: incolla la chiave nel campo e premi <strong>Verifica</strong> — il salvataggio ora avviene in automatico prima del test.</div>
        <div className="row wrap" style={{ gap: 10, marginTop: 8, alignItems: "center" }}>
          <button className="btn ghost sm" disabled={conn.adzuna?.busy} onClick={() => testConn("adzuna")}>Verifica Adzuna</button>
          <ConnResult which="adzuna" />
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 6, alignItems: "center" }}>
          <button className="btn ghost sm" disabled={conn.jooble?.busy} onClick={() => testConn("jooble")}>Verifica Jooble</button>
          <ConnResult which="jooble" />
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 6, alignItems: "center" }}>
          <button className="btn ghost sm" disabled={conn.findwork?.busy} onClick={() => testConn("findwork")}>Verifica Findwork</button>
          <ConnResult which="findwork" />
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 6, alignItems: "center" }}>
          <button className="btn ghost sm" disabled={conn.theirstack?.busy} onClick={() => testConn("theirstack")}>Verifica TheirStack</button>
          <ConnResult which="theirstack" />
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 6, alignItems: "center" }}>
          <button className="btn ghost sm" disabled={conn.jsearch?.busy} onClick={() => testConn("jsearch")}>Verifica JSearch</button>
          <ConnResult which="jsearch" />
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Fonti avanzate: Google Jobs, Apify, Bright Data</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Fonti ad alta rilevanza per aumentare le offerte in scope. Si attivano incollando la chiave e salvando.</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>SerpApi Key — Google Jobs {data.config.serpapiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.serpapiKey || ""} onChange={set("serpapiKey")} placeholder={data.config.serpapiKeySet ? "•••• lascia vuoto per non cambiare" : "da serpapi.com (free tier disponibile)"} /></div>
          <div className="field" style={{ margin: 0 }}><label>Apify Token {data.config.apifyTokenSet ? "(impostato)" : ""}</label><input type="password" value={c.apifyToken || ""} onChange={set("apifyToken")} placeholder={data.config.apifyTokenSet ? "•••• lascia vuoto" : "da console.apify.com"} /></div>
          <div className="field" style={{ margin: 0 }}><label>Apify Actor ID</label><input value={c.apifyActorId || ""} onChange={set("apifyActorId")} placeholder="es. misceres~indeed-scraper" /></div>
          <div className="field" style={{ margin: 0 }}><label>Bright Data API Key {data.config.brightdataApiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.brightdataApiKey || ""} onChange={set("brightdataApiKey")} placeholder={data.config.brightdataApiKeySet ? "•••• lascia vuoto" : "da brightdata.com"} /></div>
          <div className="field" style={{ margin: 0 }}><label>Bright Data Dataset ID</label><input value={c.brightdataDatasetId || ""} onChange={set("brightdataDatasetId")} placeholder="es. gd_xxxxxxxx" /></div>
        </div>
        <div className="ob-note" style={{ marginTop: 8 }}>⚠️ Apify/Bright Data eseguono scraping di LinkedIn/Indeed/Glassdoor: usa i tuoi account e rispetta i Termini di Servizio dei portali. Sono a pagamento (con crediti gratuiti iniziali).</div>
        <div className="row wrap" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn ghost sm" disabled={conn.serpapi?.busy} onClick={() => testConn("serpapi")}>Verifica SerpApi</button><ConnResult which="serpapi" />
          <button className="btn ghost sm" disabled={conn.apify?.busy} onClick={() => testConn("apify")}>Verifica Apify</button><ConnResult which="apify" />
          <button className="btn ghost sm" disabled={conn.brightdata?.busy} onClick={() => testConn("brightdata")}>Verifica Bright Data</button><ConnResult which="brightdata" />
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Portali carriere aziendali (ATS diretti)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>API pubbliche e gratuite. Inserisci gli <strong>identificativi azienda</strong> (uno per riga o separati da virgola). L'identificativo è quello nell'URL della loro pagina lavori: <code>boards.greenhouse.io/<b>stripe</b></code>, <code>jobs.lever.co/<b>netflix</b></code>, <code>jobs.smartrecruiters.com/<b>Bosch</b></code>.</p>
        <div className="grid cols-3" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Greenhouse</label><textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%", fontFamily: "monospace", fontSize: 12.5 }} value={atsVal("greenhouse")} onChange={setAts("greenhouse")} placeholder="stripe&#10;airbnb" /></div>
          <div className="field" style={{ margin: 0 }}><label>Lever</label><textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%", fontFamily: "monospace", fontSize: 12.5 }} value={atsVal("lever")} onChange={setAts("lever")} placeholder="netflix&#10;spotify" /></div>
          <div className="field" style={{ margin: 0 }}><label>SmartRecruiters</label><textarea rows={4} className="ob-input" style={{ resize: "vertical", width: "100%", fontFamily: "monospace", fontSize: 12.5 }} value={atsVal("smartrecruiters")} onChange={setAts("smartrecruiters")} placeholder="Bosch&#10;Ubisoft" /></div>
        </div>
        <div className="ob-note" style={{ marginTop: 8 }}>Vengono importate solo le posizioni il cui titolo è coerente con i ruoli dei candidati.</div>
        <div className="row wrap" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn ghost sm" disabled={conn.greenhouse?.busy} onClick={() => testConn("greenhouse")}>Verifica Greenhouse</button><ConnResult which="greenhouse" />
          <button className="btn ghost sm" disabled={conn.lever?.busy} onClick={() => testConn("lever")}>Verifica Lever</button><ConnResult which="lever" />
          <button className="btn ghost sm" disabled={conn.smartrecruiters?.busy} onClick={() => testConn("smartrecruiters")}>Verifica SmartRecruiters</button><ConnResult which="smartrecruiters" />
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Middleware anti-bot (per «Verifica candidatura»)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Con una di queste chiavi, «Verifica candidatura» legge la pagina reale dell'offerta (aggirando Cloudflare) e rileva registrazione, form CV, domande extra e anti-bot.</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>ScrapingBee Key {data.config.scrapingbeeKeySet ? "(impostata)" : ""}</label><input type="password" value={c.scrapingbeeKey || ""} onChange={set("scrapingbeeKey")} placeholder={data.config.scrapingbeeKeySet ? "•••• lascia vuoto" : "da scrapingbee.com"} /></div>
          <div className="field" style={{ margin: 0 }}><label>ScraperAPI Key {data.config.scraperapiKeySet ? "(impostata)" : ""}</label><input type="password" value={c.scraperapiKey || ""} onChange={set("scraperapiKey")} placeholder={data.config.scraperapiKeySet ? "•••• lascia vuoto" : "da scraperapi.com"} /></div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Video della sezione Risorse</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Uno per riga, formato <code>ID_YouTube | Titolo | Descrizione</code>. L'ID è la parte dopo <code>watch?v=</code> del link YouTube. Vengono mostrati embeddati nell'app ai candidati.</p>
        <textarea rows={5} className="ob-input" style={{ resize: "vertical", width: "100%", fontFamily: "monospace", fontSize: 12.5 }} value={vidVal()} onChange={setVid} placeholder="rrkrvAUbU9Y | Motivazione | Dan Pink" />
      </Card>

      <VouchersCard />

      <CommunicationsCard />

      <CoachApplicationsCard />

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Salvataggio…" : "Salva impostazioni"}</button>
      </div>
    </div>
  );
}

export function AdminCandidateActivity() {
  const { data, loading } = useData(api.adminCandidateActivity);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  async function toggle(id) {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetail(null);
    try { setDetail(await api.adminCandidateActivityDetail(id)); } catch { setDetail({ offers: [] }); }
  }
  if (loading || !data) return <Spinner />;
  const needle = q.trim().toLowerCase();
  const rows = data.candidates.filter((c) => !needle || `${c.name} ${c.email}`.toLowerCase().includes(needle));
  const band = (m) => (m >= 75 ? "green" : m >= 60 ? "warn" : "gray");
  const history = data.scanHistory || [];
  const SRC_LABEL = { adzuna: "Adzuna", jooble: "Jooble", remotive: "Remotive", remoteok: "RemoteOK", jobicy: "Jobicy", jobdataapi: "jobdataapi", arbeitsagentur: "Arbeitsagentur", findwork: "Findwork", theirstack: "TheirStack", jsearch: "JSearch", arbeitnow: "Arbeitnow" };
  const srcKeys = Array.from(new Set(history.flatMap((h) => Object.keys(h.perSource || {}))));
  const fmtDay = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return (
    <div className="stack">
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Rendimento fonti · giorno per giorno</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Nuove offerte portate da ogni fonte nella scansione giornaliera dei profili. Vuoto = nessuna scansione registrata quel giorno.</p>
        {history.length === 0 ? (
          <Empty>Ancora nessuna scansione giornaliera registrata. Lancia "Scansione candidati → Esegui ora" o attendi il cron.</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Giorno</th>{srcKeys.map((s) => <th key={s} style={{ textAlign: "right" }}>{SRC_LABEL[s] || s}</th>)}<th style={{ textAlign: "right" }}>Totale nuove</th><th style={{ textAlign: "right" }}>Email</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.date}>
                    <td style={{ fontWeight: 600 }}>{fmtDay(h.date)}</td>
                    {srcKeys.map((s) => { const p = (h.perSource || {})[s]; return <td key={s} style={{ textAlign: "right" }}>{p ? <span title={`${p.fetched} lette`}>+{p.created}</span> : <span className="muted">—</span>}</td>; })}
                    <td style={{ textAlign: "right", fontWeight: 700 }}>+{h.created ?? 0}</td>
                    <td style={{ textAlign: "right" }} className="muted">{h.emailed ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    <Card>
      <div className="row between wrap" style={{ marginBottom: 12, gap: 10 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Attività candidati</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Offerte compatibili inviate a ciascun candidato (match ≥ {data.threshold}%) e candidature inviate. {data.totalActiveJobs} offerte attive in totale.</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}><strong>{data.candidates.filter((x) => x.onboarded).length}</strong> su {data.candidates.length} candidati hanno completato il profilo{data.candidates.filter((x) => x.onboarded).length === 0 ? " — la scansione giornaliera gira solo su chi ha completato la profilazione." : "."}</p>
        </div>
        <input className="input sm" placeholder="Cerca candidato…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
      </div>
      <table>
        <thead><tr><th>Candidato</th><th>Offerte compatibili</th><th>Alta / Media</th><th>Miglior match</th><th>Candidature</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td><div style={{ fontWeight: 600 }}>{c.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{c.email}{c.cvUploaded ? " · CV ✓" : ""}{!c.onboarded ? " · profilo incompleto" : ""}</div></td>
                <td><strong>{c.matched}</strong></td>
                <td><Badge tone="green">{c.high} alta</Badge> <Badge tone="warn">{c.mid} media</Badge></td>
                <td><Badge tone={band(c.bestMatch)}>{c.bestMatch}%</Badge></td>
                <td><strong>{c.applications}</strong> {c.applications > 0 ? "candidature" : ""}</td>
                <td style={{ textAlign: "right" }}><button className="btn ghost sm" onClick={() => toggle(c.id)}>{open === c.id ? "Chiudi" : "Dettaglio ▾"}</button></td>
              </tr>
              {open === c.id && (
                <tr>
                  <td colSpan={6} style={{ background: "var(--brand-soft)" }}>
                    {!detail ? <span className="muted">Caricamento…</span> : detail.offers.length === 0 ? <span className="muted">Nessuna offerta compatibile per ora.</span> : (
                      <>
                        {detail.byDay && detail.byDay.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Nuove offerte compatibili per giorno</div>
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ margin: 0 }}>
                                <thead><tr><th>Giorno</th>{detail.byDay.map((d) => <th key={d.date} style={{ textAlign: "right" }}>{d.date === "—" ? "—" : fmtDay(d.date)}</th>)}</tr></thead>
                                <tbody>
                                  <tr><td style={{ fontWeight: 600 }}>Compatibili</td>{detail.byDay.map((d) => <td key={d.date} style={{ textAlign: "right", fontWeight: 700 }}>{d.matched}</td>)}</tr>
                                  <tr><td style={{ fontWeight: 600 }}>Candidature</td>{detail.byDay.map((d) => <td key={d.date} style={{ textAlign: "right" }} className="muted">{d.applied || 0}</td>)}</tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      <table style={{ margin: 0 }}>
                        <thead><tr><th>Match</th><th>Offerta</th><th>Azienda · luogo</th><th>Comparsa</th><th>Candidato?</th><th>Fonte</th></tr></thead>
                        <tbody>
                          {detail.offers.slice(0, 50).map((o) => (
                            <tr key={o.id}>
                              <td><Badge tone={band(o.match)}>{o.match}%</Badge></td>
                              <td style={{ fontWeight: 600 }}>{o.title}</td>
                              <td className="muted">{o.company} · {o.location}</td>
                              <td className="muted">{fmtDateItaly(o.firstSeenAt)}</td>
                              <td>{o.applied ? <Badge tone="green">✓ candidato</Badge> : <span className="muted">—</span>}</td>
                              <td className="muted" style={{ fontSize: 12 }}>{o.source || "—"}{o.url ? <> · <a href={o.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>↗</a></> : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Card>
    </div>
  );
}

export function AdminMatching() {
  const { data, loading } = useData(api.adminMatchOverview);
  if (loading || !data) return <Spinner />;
  const { dimensions, defaultWeights, methodology, feedback, customisedCandidates, downStats } = data;
  const VERDICT = { too_high: "Troppo alto", too_low: "Troppo basso", good: "Corretto", down: "Non pertinente 👎" };
  return (
    <div className="stack">
      <Card className="banner"><span>🧮 Così digitalfa calcola la compatibilità tra candidato e offerta. I pesi qui sotto sono quelli di default; ogni candidato può personalizzarli per sé, e il suo feedback sulle offerte li ritocca automaticamente — solo per lui.</span></Card>

      {downStats && (
        <Card>
          <div className="row between wrap" style={{ gap: 10 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Pollice giù — offerte non pertinenti</h3>
            <Badge tone="warn">{downStats.total} segnalazioni</Badge>
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Motivi indicati dai candidati quando un'offerta non è pertinente. Utile per tarare fonti e matching.</p>
          {downStats.total === 0 ? <Empty>Ancora nessuna segnalazione.</Empty> : (
            <div className="grid cols-2" style={{ gap: 16 }}>
              <div>
                <div className="kit-h" style={{ marginTop: 0 }}>Per motivo</div>
                {downStats.reasons.map((r) => (
                  <div key={r.reason} className="row between" style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13 }}>{r.reason}</span><strong>{r.count}</strong>
                  </div>
                ))}
              </div>
              <div>
                <div className="kit-h" style={{ marginTop: 0 }}>Ultime segnalazioni</div>
                {downStats.recent.map((d, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.title} <span className="muted" style={{ fontWeight: 400 }}>· {d.company}</span></div>
                    <div className="muted" style={{ fontSize: 12 }}>{d.note || "—"} · {fmtDateItaly(d.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid cols-2">
        <Card>
          <h3 className="section-title">Distribuzione dei pesi (default)</h3>
          {dimensions.map((d) => (
            <div className="weight-row" key={d.key}>
              <div className="wl">{d.label}</div>
              <div className="wbar"><span style={{ width: `${defaultWeights[d.key]}%` }} /></div>
              <div className="wv">{defaultWeights[d.key]}%</div>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Somma = 100%. Ogni dimensione dà un sotto-punteggio 0–100; il totale è la media pesata.</div>
        </Card>

        <Card>
          <h3 className="section-title">Metodologia</h3>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
            {methodology.map((m, i) => <li key={i}>{m}</li>)}
          </ol>
        </Card>
      </div>

      <Card>
        <h3 className="section-title">Cosa viene considerato</h3>
        <table>
          <thead><tr><th>Dimensione</th><th>Peso default</th><th>Come si misura</th></tr></thead>
          <tbody>
            {dimensions.map((d) => (
              <tr key={d.key}>
                <td style={{ fontWeight: 600 }}>{d.label}</td>
                <td><Badge tone="blue">{defaultWeights[d.key]}%</Badge></td>
                <td className="muted">{d.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid cols-3">
        <StatCard label="Feedback ricevuti" value={feedback.total} icon="✎" tone="blue" />
        <StatCard label="Candidati con pesi personali" value={customisedCandidates} icon="◐" tone="teal" />
        <StatCard label="Punteggi corretti" value={feedback.byVerdict?.good || 0} icon="✓" tone="green" />
      </div>

      <Card>
        <h3 className="section-title">Feedback recenti dai candidati</h3>
        {feedback.recent?.length ? (
          <table>
            <thead><tr><th>Verdetto</th><th>Offerta</th><th>Quando</th></tr></thead>
            <tbody>
              {feedback.recent.map((f) => (
                <tr key={f.id}>
                  <td><Badge tone={f.verdict === "good" ? "green" : f.verdict === "too_high" ? "warn" : "red"}>{VERDICT[f.verdict] || f.verdict}</Badge></td>
                  <td className="muted">{f.jobId}</td>
                  <td className="muted">{fmtDateTime(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Ancora nessun feedback</Empty>}
      </Card>
    </div>
  );
}

const ORIGIN = { scan: { label: "Scansione", tone: "teal" }, hr_upload: { label: "Caricata da HR", tone: "blue" } };

const modeOf = (remote) => { const r = String(remote || "").toLowerCase(); if (/remot/.test(r)) return "Remoto"; if (/ibrid|hybrid/.test(r)) return "Ibrido"; if (/sede|onsite|presenza/.test(r)) return "In sede"; return remote || "—"; };
export function AdminPositions() {
  const [filter, setFilter] = useState("");
  const [origin, setOrigin] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState("");
  const [sen, setSen] = useState("");
  const { data, loading, reload } = useData(() => api.adminPositions(filter), [filter]);
  const [busy, setBusy] = useState(null);
  const [fwdId, setFwdId] = useState(null);
  const [fwd, setFwd] = useState({ to: "", fromName: "" });
  const [fwdMsg, setFwdMsg] = useState("");

  async function toggle(p) {
    setBusy(p.id);
    try { await api.adminUpdatePosition(p.id, p.status === "active" ? "inactive" : "active"); reload(); }
    finally { setBusy(null); }
  }
  async function forward(p) {
    setFwdMsg("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fwd.to)) { setFwdMsg("Inserisci un'email valida."); return; }
    setBusy(p.id);
    try { const r = await api.adminForwardPosition(p.id, fwd.to, fwd.fromName); setFwdMsg(r.sent ? "✓ Inoltrata." : "✓ Registrata (email simulata: configura SMTP)."); setFwdId(null); setFwd({ to: "", fromName: "" }); }
    catch (e) { setFwdMsg(e.message); } finally { setBusy(null); }
  }

  if (loading || !data) return <Spinner />;
  const { positions, counts } = data;
  const needle = q.trim().toLowerCase();
  const cities = Array.from(new Set(positions.map((p) => p.location).filter((l) => l && l !== "—"))).sort();
  const seniorities = Array.from(new Set(positions.map((p) => p.seniority).filter((s) => s && s !== "—"))).sort();
  const modes = Array.from(new Set(positions.map((p) => modeOf(p.remote)).filter((m) => m && m !== "—")));
  const shown = positions.filter((p) =>
    (!origin || p.origin === origin) &&
    (!city || p.location === city) &&
    (!mode || modeOf(p.remote) === mode) &&
    (!sen || p.seniority === sen) &&
    (!needle || `${p.title} ${p.company} ${p.location} ${p.sourceName || ""}`.toLowerCase().includes(needle))
  );
  const anyFilter = origin || city || mode || sen || needle;

  return (
    <div className="stack">
      <div className="grid cols-3">
        <StatCard label="Posizioni attive" value={counts.active} icon="◇" tone="green" />
        <StatCard label="Non attive (archiviate)" value={counts.inactive} icon="⌫" tone="gray" />
        <StatCard label="Totale rilevate" value={counts.active + counts.inactive} icon="▤" tone="blue" />
      </div>

      <Card>
        <div className="row between wrap" style={{ marginBottom: 12, gap: 10 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Tutte le posizioni</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <input className="input sm" placeholder="Cerca titolo, azienda, città…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
            <select className="input sm" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Ogni città</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select className="input sm" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">Ogni modalità</option>{modes.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select className="input sm" value={sen} onChange={(e) => setSen(e.target.value)}><option value="">Ogni seniority</option>{seniorities.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select className="input sm" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">Ogni origine</option>
              <option value="scan">Scansione</option>
              <option value="hr_upload">Caricata da HR</option>
              <option value="manual">Manuale (candidato)</option>
            </select>
            <div className="seg sm">
              <button className={filter === "" ? "on" : ""} onClick={() => setFilter("")}>Tutte</button>
              <button className={filter === "active" ? "on" : ""} onClick={() => setFilter("active")}>Attive</button>
              <button className={filter === "inactive" ? "on" : ""} onClick={() => setFilter("inactive")}>Non attive</button>
            </div>
          </div>
        </div>
        {anyFilter && <p className="muted" style={{ margin: "0 0 8px", fontSize: 12.5 }}>{shown.length} posizioni su {positions.length} — filtri attivi <button className="btn ghost sm" onClick={() => { setOrigin(""); setQ(""); setCity(""); setMode(""); setSen(""); }}>azzera</button></p>}
        {fwdMsg && <div className="flash" style={{ margin: "0 0 8px" }}>{fwdMsg}</div>}
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 11.5, lineHeight: 1.6 }}>
          <strong>Posizioni attive</strong> = le stesse "offerte nel bacino" della pagina Fonti & scansione (stesso conteggio). <strong>Prima vista</strong> = quando l'offerta è entrata la prima volta nel bacino; <strong>Ultima vista</strong> = l'ultima scansione in cui era ancora online (se non ricompare viene archiviata).
        </p>
        <table>
          <thead><tr><th>Posizione</th><th>Azienda</th><th>Origine</th><th>Fonte</th><th title="Quando l'offerta è entrata la prima volta nel bacino">Prima vista</th><th title="L'ultima scansione in cui l'offerta era ancora online">Ultima vista</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <Fragment key={p.id}>
              <tr style={{ opacity: p.status === "inactive" ? 0.72 : 1 }}>
                <td style={{ fontWeight: 600 }}>{p.title}<div className="muted" style={{ fontSize: 11.5, fontWeight: 400 }}>{p.location} · {modeOf(p.remote)} · {p.seniority}</div></td>
                <td className="muted">{p.company}</td>
                <td><Badge tone={ORIGIN[p.origin]?.tone || "gray"}>{ORIGIN[p.origin]?.label || p.origin}</Badge></td>
                <td>{p.simulated ? <Badge tone="warn">{p.sourceName || "Simulata"}</Badge> : <span className="muted">{p.sourceName || "—"}</span>}</td>
                <td className="muted">{fmtDateItaly(p.firstSeenAt)}</td>
                <td className="muted">{p.status === "inactive" ? `archiviata ${fmtDateItaly(p.deactivatedAt)}` : fmtDateItaly(p.lastSeenAt)}</td>
                <td>{p.status === "active" ? <Badge tone="green">Attiva</Badge> : <Badge tone="gray">Non attiva</Badge>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn ghost sm" onClick={() => { setFwdId(fwdId === p.id ? null : p.id); setFwd({ to: "", fromName: "" }); setFwdMsg(""); }} style={{ marginRight: 6 }}>Inoltra</button>
                  <button className="btn ghost sm" disabled={busy === p.id} onClick={() => toggle(p)}>{p.status === "active" ? "Archivia" : "Riattiva"}</button>
                </td>
              </tr>
              {fwdId === p.id && (
                <tr>
                  <td colSpan={8} style={{ background: "var(--brand-soft)" }}>
                    <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 12.5 }}>Inoltra «{p.title}» a:</span>
                      <input className="input sm" placeholder="email destinatario" value={fwd.to} onChange={(e) => setFwd({ ...fwd, to: e.target.value })} style={{ minWidth: 200 }} />
                      <input className="input sm" placeholder="da parte di (nome nell'oggetto)" value={fwd.fromName} onChange={(e) => setFwd({ ...fwd, fromName: e.target.value })} style={{ minWidth: 200 }} />
                      <button className="btn sm" disabled={busy === p.id} onClick={() => forward(p)}>Invia</button>
                      <button className="btn ghost sm" onClick={() => setFwdId(null)}>Annulla</button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
