// Shared UI primitives for digitalfa.

export function Avatar({ text, className = "" }) {
  return <div className={`avatar ${className}`}>{text}</div>;
}

export function Card({ children, className = "", pad = true }) {
  return <div className={`card ${pad ? "card-pad" : ""} ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "gray" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ProgressBar({ pct }) {
  return (
    <div className="progress">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "blue", delta }) {
  const bg = {
    blue: "var(--brand-soft)", teal: "var(--accent-soft)",
    green: "var(--ok-soft)", warn: "var(--warn-soft)", red: "var(--danger-soft)",
  }[tone];
  const fg = {
    blue: "var(--brand)", teal: "#0b8a78",
    green: "var(--ok)", warn: "#a86a12", red: "#b23a28",
  }[tone];
  return (
    <div className="card stat">
      <div className="row between">
        <div>
          <div className="label">{label}</div>
          <div className="value">{value}</div>
          {delta && <div className="delta muted">{delta}</div>}
        </div>
        <div className="ico" style={{ background: bg, color: fg }}>{icon}</div>
      </div>
    </div>
  );
}

export function PageIntro({ title, subtitle }) {
  return (
    <div className="pageintro">
      <h2 style={{ fontSize: 20 }}>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function Spinner({ label = "Caricamento…" }) {
  return <div className="spinner-wrap">{label}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

// Status helpers
export const statusMeta = {
  active: { tone: "blue", label: "In percorso" },
  placed: { tone: "green", label: "Ricollocato" },
  at_risk: { tone: "red", label: "A rischio" },
};
export function StatusBadge({ status }) {
  const m = statusMeta[status] || { tone: "gray", label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export const stageMeta = {
  applied: { tone: "gray", label: "Candidatura inviata" },
  screening: { tone: "blue", label: "Screening" },
  interview: { tone: "warn", label: "Colloquio" },
  offer: { tone: "green", label: "Offerta" },
  rejected: { tone: "red", label: "Non selezionato" },
};
export function StageBadge({ stage }) {
  const m = stageMeta[stage] || { tone: "gray", label: stage };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) +
    " · " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
// Formato italiano numerico: dd/mm/yyyy (accetta ISO o "YYYY-MM-DD").
export function fmtDateItaly(v) {
  if (!v) return "—";
  const d = new Date(String(v).length === 10 ? v + "T00:00:00" : v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
// dd/mm/yyyy HH:MM
export function fmtDateTimeItaly(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
