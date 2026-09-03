import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useData } from "../components/useData.js";
import {
  Card, StatCard, Badge, ProgressBar, Avatar, Spinner, Empty,
  StatusBadge, StageBadge, fmtDate, fmtDateTime,
} from "../components/ui.jsx";

export function CoachDashboard() {
  const { data, loading } = useData(api.coachCaseload);
  const nav = useNavigate();
  if (loading || !data) return <Spinner />;
  const { candidates, upcoming } = data;
  const placed = candidates.filter((c) => c.status === "placed").length;
  const atRisk = candidates.filter((c) => c.status === "at_risk").length;

  return (
    <div className="stack">
      <div className="grid cols-4">
        <StatCard label="Candidati seguiti" value={candidates.length} icon="◐" tone="blue" />
        <StatCard label="Ricollocati" value={placed} icon="✓" tone="green" />
        <StatCard label="Da attenzionare" value={atRisk} icon="!" tone="red" />
        <StatCard label="Sessioni in agenda" value={upcoming.length} icon="◈" tone="teal" />
      </div>

      <div className="grid cols-2">
        <Card>
          <h3 className="section-title">Il mio portfolio</h3>
          <div className="list">
            {candidates.map((c) => (
              <div className="list-item" key={c.id} style={{ cursor: "pointer" }} onClick={() => nav(`/app/candidate/${c.id}`)}>
                <Avatar text={c.avatar} />
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="sub">{c.title} · {c.companyName}</div>
                </div>
                <div style={{ width: 110 }}>
                  <div className="row between" style={{ marginBottom: 4 }}>
                    <span className="muted" style={{ fontSize: 11 }}>{c.progressPct}%</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <ProgressBar pct={c.progressPct} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="section-title">Prossime sessioni</h3>
          {upcoming.length ? upcoming.map((s) => (
            <div className="list-item" key={s.id}>
              <div className="tl-dot in_progress">◈</div>
              <div className="grow">
                <div className="title">{s.candidateName}</div>
                <div className="sub">{s.topic}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDateTime(s.date)}</div>
                <span className="chip">{s.mode}</span>
              </div>
            </div>
          )) : <Empty>Nessuna sessione in agenda</Empty>}
        </Card>
      </div>
    </div>
  );
}

const mIco = { done: "✓", in_progress: "▸", todo: "○" };
const NEXT = { todo: "in_progress", in_progress: "done", done: "todo" };

export function CoachCandidate() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, reload } = useData(() => api.coachCandidate(id), [id]);
  const [saving, setSaving] = useState(null);

  async function cycle(m) {
    setSaving(m.key);
    try {
      await api.updateProgress(id, m.key, NEXT[m.status]);
      reload();
    } finally {
      setSaving(null);
    }
  }

  if (loading || !data) return <Spinner />;
  const { candidate: c, milestones, sessions, applications } = data;

  return (
    <div className="stack">
      <button className="btn ghost sm" style={{ width: "fit-content" }} onClick={() => nav("/app")}>← Torna al portfolio</button>
      <Card>
        <div className="row between wrap">
          <div className="row">
            <Avatar text={c.avatar} className="lg" />
            <div>
              <h3 style={{ fontSize: 18 }}>{c.name}</h3>
              <div className="muted">{c.title} · {c.companyName}</div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <StatusBadge status={c.status} />
                <Badge tone="blue">{c.programName}</Badge>
              </div>
            </div>
          </div>
          <div style={{ minWidth: 200 }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Avanzamento</span>
              <strong>{c.progressPct}%</strong>
            </div>
            <ProgressBar pct={c.progressPct} />
          </div>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card>
          <h3 className="section-title">Milestone — clicca per aggiornare</h3>
          <div className="timeline">
            {milestones.map((m) => (
              <div className="tl-item" key={m.key}>
                <button
                  className={`tl-dot ${m.status}`}
                  title="Cambia stato"
                  onClick={() => cycle(m)}
                  style={{ border: "none", cursor: "pointer", opacity: saving === m.key ? 0.5 : 1 }}
                >{mIco[m.status]}</button>
                <div className="tl-body">
                  <div className="t">{m.label}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {m.status === "done" ? "Completata" : m.status === "in_progress" ? "In corso" : "Da iniziare"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <h3 className="section-title">Candidature</h3>
            {applications.length ? applications.map((a) => (
              <div className="list-item" key={a.id}>
                <div className="grow">
                  <div className="title">{a.job?.title}</div>
                  <div className="sub">{a.job?.company}</div>
                </div>
                <StageBadge stage={a.stage} />
              </div>
            )) : <Empty>Nessuna candidatura</Empty>}
          </Card>
          <Card>
            <h3 className="section-title">Storico sessioni</h3>
            {sessions.length ? sessions.map((s) => (
              <div className="list-item" key={s.id}>
                <div className={`tl-dot ${s.status === "completed" ? "done" : "in_progress"}`}>
                  {s.status === "completed" ? "✓" : "◈"}
                </div>
                <div className="grow">
                  <div className="title">{s.topic}</div>
                  <div className="sub">{fmtDateTime(s.date)}{s.notes ? ` · ${s.notes}` : ""}</div>
                </div>
              </div>
            )) : <Empty>Nessuna sessione</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}
