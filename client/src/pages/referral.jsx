import { useAuth } from "../auth.jsx";
import { Card } from "../components/ui.jsx";

export function ReferralDashboard() {
  const { user } = useAuth();
  return (
    <div className="stack">
      <Card>
        <h3 className="section-title" style={{ marginTop: 0 }}>Ciao {user.name} 👋</h3>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Da qui potrai segnalare candidati per le posizioni aperte nella tua azienda e
          seguire lo stato delle tue segnalazioni. Stiamo completando questa sezione:
          a breve troverai l'elenco delle posizioni interne e il modulo di referral.
        </p>
      </Card>
      <div className="grid cols-3">
        <Card><div className="muted" style={{ fontSize: 12.5 }}>Segnalazioni inviate</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>0</div></Card>
        <Card><div className="muted" style={{ fontSize: 12.5 }}>In valutazione</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>0</div></Card>
        <Card><div className="muted" style={{ fontSize: 12.5 }}>Assunti</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>0</div></Card>
      </div>
      <Card>
        <h4 style={{ marginTop: 0 }}>Come funziona il referral</h4>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Il referral premia chi porta talento in azienda: quando una posizione aperta
          combacia con qualcuno nella tua rete, potrai segnalarlo in un clic e l'HR lo
          vedrà tra i candidati suggeriti. Ti avviseremo qui appena la funzione è attiva.
        </p>
      </Card>
    </div>
  );
}
