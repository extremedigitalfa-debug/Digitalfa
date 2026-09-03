import { useState } from "react";
import { api } from "../api.js";
import { useData } from "../components/useData.js";
import {
  Card, StatCard, Badge, ProgressBar, Avatar, Spinner, Empty, StatusBadge, fmtDate,
} from "../components/ui.jsx";

export function HrDashboard() {
  const { data, loading } = useData(api.hrDashboard);
  if (loading || !data) return <Spinner />;
  const { company, stats, employees } = data;

  return (
    <div className="stack">
      <Card>
        <div className="row between wrap">
          <div className="row">
            <div className="brand-logo" style={{ width: 48, height: 48, fontSize: 18 }}>{company.logo}</div>
            <div>
              <h3 style={{ fontSize: 18 }}>{company.name}</h3>
              <div className="muted">{company.sector} · {company.city}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Badge tone="blue">Piano {company.plan}</Badge>
            <Badge tone="gray">{company.seatsTotal} posti</Badge>
          </div>
        </div>
      </Card>

      <div className="grid cols-4">
        <StatCard label="Dipendenti nel programma" value={stats.total} icon="◐" tone="blue" />
        <StatCard label="Ricollocati" value={stats.placed} icon="✓" tone="green" delta={`${stats.placementRate}% tasso di ricollocamento`} />
        <StatCard label="Avanzamento medio" value={`${stats.avgProgress}%`} icon="▸" tone="teal" />
        <StatCard label="Da attenzionare" value={stats.atRisk} icon="!" tone="red" />
      </div>

      <Card>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Dipendenti nel programma</h3>
          <span className="muted" style={{ fontSize: 12 }}>Le note di coaching restano riservate tra candidato e coach</span>
        </div>
        {employees.length ? (
          <table>
            <thead><tr><th>Persona</th><th>Ruolo</th><th>Coach</th><th>Avanzamento</th><th>Candidature</th><th>Stato</th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar text={e.avatar} />
                      <span style={{ fontWeight: 600 }}>{e.name}</span>
                    </div>
                  </td>
                  <td className="muted">{e.title}</td>
                  <td className="muted">{e.coachName}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ width: 90 }}><ProgressBar pct={e.progressPct} /></div>
                      <span className="muted" style={{ fontSize: 12 }}>{e.progressPct}%</span>
                    </div>
                  </td>
                  <td className="muted">{e.applicationsCount}</td>
                  <td><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Nessun dipendente nel programma</Empty>}
      </Card>
    </div>
  );
}

const EMPTY_POS = { title: "", location: "", type: "Full-time", remote: "Ibrido", salary: "", industry: "", seniority: "Mid", tags: "", description: "" };

export function HrPositions() {
  const { data, loading, reload } = useData(api.hrPositions);
  const [form, setForm] = useState(EMPTY_POS);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.hrCreatePosition(form); setForm(EMPTY_POS); setOpen(false); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function toggle(job) {
    await api.hrUpdatePosition(job.id, job.status === "active" ? "inactive" : "active");
    reload();
  }

  if (loading || !data) return <Spinner />;
  const { positions } = data;
  const active = positions.filter((p) => p.status === "active");
  const inactive = positions.filter((p) => p.status === "inactive");

  return (
    <div className="stack">
      <Card>
        <div className="row between">
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>Posizioni aperte della tua azienda</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Carica le tue posizioni: verranno proposte ai candidati in ricollocamento con matching sulle competenze.</p>
          </div>
          <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "+ Nuova posizione"}</button>
        </div>

        {open && (
          <form onSubmit={create} style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field" style={{ margin: 0 }}><label>Titolo *</label><input value={form.title} onChange={set("title")} placeholder="Es. Marketing Specialist" /></div>
              <div className="field" style={{ margin: 0 }}><label>Sede</label><input value={form.location} onChange={set("location")} placeholder="Milano" /></div>
              <div className="field" style={{ margin: 0 }}><label>Settore</label><input value={form.industry} onChange={set("industry")} placeholder="Marketing" /></div>
              <div className="field" style={{ margin: 0 }}><label>RAL (k€)</label><input value={form.salary} onChange={set("salary")} placeholder="40-50" /></div>
              <div className="field" style={{ margin: 0 }}><label>Modalità</label>
                <select value={form.remote} onChange={set("remote")}><option>Ibrido</option><option>Remoto</option><option>In sede</option></select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>Seniority</label>
                <select value={form.seniority} onChange={set("seniority")}><option>Junior</option><option>Mid</option><option>Senior</option><option>Manager</option></select>
              </div>
            </div>
            <div className="field"><label>Competenze (separate da virgola)</label><input value={form.tags} onChange={set("tags")} placeholder="SEO, Analytics, Content" /></div>
            <div className="field"><label>Descrizione</label><input value={form.description} onChange={set("description")} placeholder="Breve descrizione della posizione" /></div>
            {err && <div className="login-err">{err}</div>}
            <button className="btn" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Salvataggio…" : "Pubblica posizione"}</button>
          </form>
        )}
      </Card>

      <Card>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Attive</h3>
          <Badge tone="green">{active.length}</Badge>
        </div>
        {active.length ? <PositionsTable rows={active} onToggle={toggle} /> : <Empty>Nessuna posizione attiva</Empty>}
      </Card>

      {inactive.length > 0 && (
        <Card>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Non attive</h3>
            <Badge tone="gray">{inactive.length}</Badge>
          </div>
          <PositionsTable rows={inactive} onToggle={toggle} />
        </Card>
      )}
    </div>
  );
}

function PositionsTable({ rows, onToggle }) {
  return (
    <table>
      <thead><tr><th>Posizione</th><th>Sede</th><th>Origine</th><th>Pubblicata</th><th>Stato</th><th></th></tr></thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td style={{ fontWeight: 600 }}>{p.title}</td>
            <td className="muted">{p.location}</td>
            <td>{p.origin === "hr_upload" ? <Badge tone="blue">Caricata da HR</Badge> : <Badge tone="teal">Scansione</Badge>}</td>
            <td className="muted">{fmtDate(p.postedAt)}</td>
            <td>{p.status === "active" ? <Badge tone="green">Attiva</Badge> : <Badge tone="gray">Non attiva</Badge>}</td>
            <td style={{ textAlign: "right" }}>
              {p.origin === "hr_upload" && (
                <button className="btn ghost sm" onClick={() => onToggle(p)}>{p.status === "active" ? "Disattiva" : "Riattiva"}</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
