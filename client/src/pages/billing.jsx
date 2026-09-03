import { useState } from "react";
import { api } from "../api.js";
import { useData } from "../components/useData.js";
import { Card, Badge, Spinner, fmtDate } from "../components/ui.jsx";

const fmtPrice = (p) => (p?.contact ? "Su contatto" : p?.price === 0 ? "Gratis" : (p?.priceLabel ? `${p.priceLabel}${p.billingNote ? " · " + p.billingNote : ""}` : `€${p?.price}/mese`));

function CardModal({ plan, onClose, onDone }) {
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", exp: "12/28", cvc: "123", brand: "Visa" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState(null); // {code, percent, free}
  const [vMsg, setVMsg] = useState("");
  async function applyVoucher() {
    setVMsg("");
    try { const r = await api.applyVoucher(voucher); setApplied(r); setVMsg(r.free ? `✓ ${r.code}: gratis per ${r.durationDays} giorni` : `✓ ${r.code}: -${r.percent}%`); }
    catch (e) { setApplied(null); setVMsg(e.message); }
  }
  async function confirm() {
    setBusy(true); setErr("");
    try {
      if (!(applied && applied.free)) {
        const co = await api.checkout(plan.id);
        if (co.url) { window.location.href = co.url; return; }
      }
      const parts = card.exp.split("/");
      await api.confirmCheckout(plan.id, { brand: card.brand, number: card.number.replace(/\s/g, ""), expMonth: +parts[0], expYear: 2000 + +(parts[1] || 28) }, applied?.code);
      onDone();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18 }}>Passa a {plan.name} · {fmtPrice(plan)}</h3>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 14px" }}>Checkout sicuro con Stripe (simulato nella demo — carta di test già compilata).</p>
        <div className="field"><label>Numero carta</label><input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Scadenza</label><input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} /></div>
          <div className="field" style={{ width: 90 }}><label>CVC</label><input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></div>
        </div>
        <div className="field"><label>Codice sconto (facoltativo)</label>
          <div className="row" style={{ gap: 8 }}>
            <input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="es. WELCOME100" style={{ flex: 1 }} />
            <button type="button" className="btn ghost" onClick={applyVoucher} disabled={!voucher.trim()}>Applica</button>
          </div>
          {vMsg && <div className="muted" style={{ fontSize: 12.5, marginTop: 6, color: applied ? "var(--ok,#1c7a43)" : "#c0392b" }}>{vMsg}</div>}
        </div>
        {applied && applied.free && <div className="muted" style={{ fontSize: 12.5 }}>Con questo codice non verrà addebitato nulla per {applied.durationDays} giorni.</div>}
        {err && <div className="login-err">{err}</div>}
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" style={{ flex: 1 }} onClick={confirm} disabled={busy}>{busy ? "Elaborazione…" : (applied && applied.free ? "Attiva gratis" : "Conferma e attiva")}</button>
        </div>
      </div>
    </div>
  );
}

export function BillingPage() {
  const { data, loading, reload } = useData(api.getSubscription);
  const [modalPlan, setModalPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <Spinner />;
  const { subscription: sub, plans, coveredByCompany, liveBilling } = data;

  async function cancel() { setBusy(true); try { await api.cancelSubscription(); reload(); } finally { setBusy(false); } }
  async function resume() { setBusy(true); try { await api.resumeSubscription(); reload(); } finally { setBusy(false); } }

  const statusBadge = sub
    ? sub.cancelAtPeriodEnd
      ? <Badge tone="warn">Si disattiva a fine periodo</Badge>
      : sub.status === "active" ? <Badge tone="green">Attivo</Badge> : <Badge tone="gray">{sub.status}</Badge>
    : <Badge tone="gray">Nessun piano</Badge>;

  return (
    <div className="stack">
      {coveredByCompany && (
        <Card className="banner"><span>ℹ️ Sei incluso anche nel programma aziendale di <strong>{coveredByCompany}</strong>. L'abbonamento qui sotto è il tuo piano personale digitalfa.</span></Card>
      )}

      <div className="grid cols-2">
        <Card>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Il tuo abbonamento</h3>
            {statusBadge}
          </div>
          {sub ? (
            <div className="stack" style={{ gap: 14 }}>
              <div className="row between">
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{sub.plan?.name}</div>
                  <div className="muted">{fmtPrice(sub.plan)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="muted" style={{ fontSize: 12 }}>{sub.cancelAtPeriodEnd ? "Attivo fino al" : "Prossimo rinnovo"}</div>
                  <div style={{ fontWeight: 700 }}>{fmtDate(sub.currentPeriodEnd)}</div>
                </div>
              </div>
              <div className="divider" />
              <div className="row between">
                <div className="row" style={{ gap: 12 }}>
                  <div className="card-brand">{sub.card?.brand}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>•••• •••• •••• {sub.card?.last4}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Scade {String(sub.card?.expMonth).padStart(2, "0")}/{sub.card?.expYear}</div>
                  </div>
                </div>
                <button className="btn ghost sm" onClick={() => api.billingPortal().then((r) => r.url && (window.location.href = r.url))}>Gestisci pagamento</button>
              </div>
              <div className="divider" />
              <div className="row" style={{ gap: 10 }}>
                {sub.cancelAtPeriodEnd
                  ? <button className="btn" disabled={busy} onClick={resume}>Riattiva rinnovo</button>
                  : <button className="btn ghost" disabled={busy} onClick={cancel}>Disdici abbonamento</button>}
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                Fatturazione {liveBilling ? "gestita da Stripe" : "simulata (demo)"} · provider: {sub.provider}
              </div>
            </div>
          ) : (
            <div className="empty">Nessun abbonamento attivo. Scegli un piano qui a fianco per iniziare.</div>
          )}
        </Card>

        <Card>
          <h3 className="section-title">{sub ? "Cambia piano" : "Scegli un piano"}</h3>
          <div className="stack" style={{ gap: 10 }}>
            {plans.map((p) => {
              const current = sub?.planId === p.id;
              return (
                <div className={`plan-row ${current ? "current" : ""}`} key={p.id}>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{p.name}</strong>
                      {p.popular && <Badge tone="blue">Popolare</Badge>}
                      {current && <Badge tone="green">Piano attuale</Badge>}
                    </div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{p.tagline} · {fmtPrice(p)}</div>
                  </div>
                  {!current && (
                    <button className="btn sm" onClick={() => (p.contact ? null : setModalPlan(p))} disabled={p.contact}>
                      {p.contact ? "Contattaci" : p.price === 0 ? "Passa a Free" : "Scegli"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {modalPlan && <CardModal plan={modalPlan} onClose={() => setModalPlan(null)} onDone={() => { setModalPlan(null); reload(); }} />}
    </div>
  );
}
