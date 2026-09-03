import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Card, Badge, Spinner, Empty } from "../components/ui.jsx";

const STATUS = { invited: { t: "Invitato", tone: "gray" }, registered: { t: "Registrato", tone: "blue" }, subscribed: { t: "Abbonato", tone: "green" }, rewarded: { t: "Premio accreditato ✓", tone: "green" } };

export function CandidateReferral() {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() { try { setData(await api.referralInfo()); } catch { setData({ invites: [] }); } }
  useEffect(() => { load(); }, []);

  async function invite() {
    setMsg(""); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg("Inserisci un'email valida."); return; }
    setBusy(true);
    try { const r = await api.referralInvite(email); setMsg(r.sent ? `✓ Invito inviato a ${email}.` : `✓ Invito registrato (email simulata: configura SMTP).`); setEmail(""); load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  function copyLink() { navigator.clipboard?.writeText(data.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }

  if (!data) return <Spinner />;
  return (
    <div className="stack" style={{ maxWidth: 780 }}>
      <Card style={{ background: "var(--brand-soft,#eef3ff)" }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Invita un amico, ricevi 2 settimane gratis 🎁</h3>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Condividi il tuo link. Quando un amico si registra <strong>e attiva un abbonamento</strong>, ricevi automaticamente <strong>2 settimane gratuite</strong> sul tuo piano.
        </p>
        <div className="row wrap" style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
          <input className="input sm" readOnly value={data.link || ""} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 260, fontFamily: "monospace", fontSize: 12.5 }} />
          <button className="btn sm" onClick={copyLink}>{copied ? "Copiato ✓" : "Copia link"}</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Il tuo codice: <strong style={{ fontFamily: "monospace" }}>{data.code}</strong></div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Invita via email</h3>
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
          <input className="input sm" placeholder="email del tuo amico" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 240 }} onKeyDown={(e) => { if (e.key === "Enter") invite(); }} />
          <button className="btn" disabled={busy} onClick={invite}>{busy ? "Invio…" : "Invia invito"}</button>
        </div>
        {msg && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{msg}</div>}
      </Card>

      <Card>
        <div className="row between wrap" style={{ gap: 8 }}>
          <h3 className="section-title" style={{ margin: 0 }}>I tuoi inviti</h3>
          <Badge tone="green">{data.rewardWeeks || 0} settimane guadagnate</Badge>
        </div>
        {(!data.invites || data.invites.length === 0) ? <Empty>Ancora nessun invito. Condividi il tuo link!</Empty> : (
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Email</th><th>Stato</th><th>Invitato</th></tr></thead>
            <tbody>
              {data.invites.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{r.email || "—"}</td>
                  <td><Badge tone={(STATUS[r.status] || {}).tone || "gray"}>{(STATUS[r.status] || {}).t || r.status}</Badge></td>
                  <td className="muted">{(r.invitedAt || "").slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
