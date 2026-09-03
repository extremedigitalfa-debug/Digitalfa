import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Card } from "../components/ui.jsx";

const ROLE_LABEL = { candidate: "Candidato", coach: "Career Coach", hr: "Azienda · HR", admin: "Amministratore", referral: "Referral", staff: "Staff" };

export function AccountSettings() {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl || "");
  const [pf, setPf] = useState("");
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true); setPf("");
    try { const r = await api.accountUpdateProfile({ name, phone, linkedinUrl }); if (r.user) updateUser(r.user); setPf("Dati aggiornati."); }
    catch (e) { setPf(e.message || "Errore"); } finally { setBusy(false); }
  }
  async function changePw() {
    setPw("");
    if (nw.length < 6) return setPw("La nuova password deve avere almeno 6 caratteri.");
    if (nw !== nw2) return setPw("Le due password non coincidono.");
    setBusy(true);
    try { await api.accountChangePassword(cur, nw); setPw("Password aggiornata."); setCur(""); setNw(""); setNw2(""); }
    catch (e) { setPw(e.message || "Errore"); } finally { setBusy(false); }
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Il tuo profilo</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Ruolo: <strong>{ROLE_LABEL[user.role] || user.role}</strong> · Email: {user.email}</p>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Nome e cognome</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>Telefono</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 …" /></div>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Profilo LinkedIn</label><input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" /></div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
          <button className="btn" disabled={busy} onClick={saveProfile}>Salva profilo</button>
          {pf && <span className="muted" style={{ fontSize: 12.5 }}>{pf}</span>}
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Cambia password</h3>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field" style={{ margin: 0, gridColumn: "span 2" }}><label>Password attuale</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="lascia vuoto se non ne hai una" /></div>
          <div className="field" style={{ margin: 0 }}><label>Nuova password</label><input type="password" value={nw} onChange={(e) => setNw(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>Ripeti nuova password</label><input type="password" value={nw2} onChange={(e) => setNw2(e.target.value)} /></div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
          <button className="btn" disabled={busy} onClick={changePw}>Aggiorna password</button>
          {pw && <span className="muted" style={{ fontSize: 12.5 }}>{pw}</span>}
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Sessione</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>Esci dal tuo account su questo dispositivo.</p>
        <button className="btn ghost" onClick={logout}>Esci</button>
      </Card>
    </div>
  );
}
