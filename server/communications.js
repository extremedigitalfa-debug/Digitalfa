// Sistema di comunicazioni configurabili + trigger (motore di automazioni leggero).
// I testi e i trigger sono modificabili da Admin → Impostazioni e salvati in config.communications.
// L'esecuzione dei trigger avviene: nella scansione giornaliera (on_scan, days_after_signup,
// low_offers) e dagli hook dell'abbonamento (on_subscription_active/canceled).

export const TRIGGER_TYPES = [
  { type: "manual", label: "Solo manuale / test" },
  { type: "on_scan", label: "A ogni scansione (se ci sono nuove offerte)" },
  { type: "after_scan_hours", label: "N ore dopo l'email di scansione (se non ha visitato le offerte)" },
  { type: "days_after_signup", label: "N giorni dopo la registrazione" },
  { type: "low_offers", label: "Poche offerte da almeno N giorni" },
  { type: "on_subscription_active", label: "Quando l'abbonamento si attiva" },
  { type: "on_subscription_canceled", label: "Quando l'abbonamento si disattiva" },
];

// Comunicazioni predefinite (l'admin può modificarle o aggiungerne).
export const DEFAULT_COMMS = [
  {
    key: "scan_done", name: "Scansione: nuove offerte trovate", channel: "email", enabled: true,
    trigger: { type: "on_scan" },
    subject: "{count} nuove offerte per te oggi su digitalfa",
    body: "Ciao {name},\noggi la scansione ha trovato {count} nuove offerte compatibili con il tuo profilo.\nGuardale qui: {link}\n\n— digitalfa",
  },
  {
    key: "sub_active", name: "Abbonamento attivato", channel: "email", enabled: true,
    trigger: { type: "on_subscription_active" },
    subject: "Il tuo abbonamento digitalfa è attivo",
    body: "Ciao {name},\nil tuo abbonamento è attivo: ora ricevi ogni giorno le offerte selezionate per te e puoi candidarti con il pacchetto completo.\nInizia qui: {link}\n\n— digitalfa",
  },
  {
    key: "sub_canceled", name: "Abbonamento disattivato", channel: "email", enabled: true,
    trigger: { type: "on_subscription_canceled" },
    subject: "Abbonamento digitalfa disattivato",
    body: "Ciao {name},\nil tuo abbonamento è stato disattivato. Puoi riattivarlo quando vuoi per continuare a ricevere le offerte quotidiane.\nRiattiva qui: {link}\n\n— digitalfa",
  },
  {
    key: "onb_1", name: "Onboarding · sollecito 1 (valore)", channel: "email", enabled: true,
    trigger: { type: "days_after_signup", days: 1 },
    subject: "Completa il profilo e ricevi subito offerte su misura",
    body: "Ciao {name},\nbastano 2 minuti per completare il profilo: da lì facciamo partire la ricerca automatica delle offerte più adatte a te.\nCompleta ora: {link}\n\n— digitalfa",
  },
  {
    key: "onb_2", name: "Onboarding · sollecito 2 (tempo)", channel: "email", enabled: true,
    trigger: { type: "days_after_signup", days: 3 },
    subject: "Non perdere le offerte di oggi",
    body: "Ciao {name},\nogni giorno pubblichiamo nuove posizioni. Senza il profilo completo non possiamo selezionarle per te.\nBastano pochi minuti: {link}\n\n— digitalfa",
  },
  {
    key: "onb_3", name: "Onboarding · sollecito 3 (prova sociale)", channel: "email", enabled: true,
    trigger: { type: "days_after_signup", days: 7 },
    subject: "Altri come te hanno già trovato opportunità",
    body: "Ciao {name},\ncandidati e manager in transizione stanno già ricevendo offerte compatibili ogni giorno. Tocca a te: completa il profilo e attiva la ricerca.\n{link}\n\n— digitalfa",
  },
  {
    key: "offers_followup_8h", name: "Offerte: sollecito dopo 8 ore", channel: "email", enabled: true,
    trigger: { type: "after_scan_hours", hours: 8 },
    subject: "Sei tra i primi? Le nuove offerte ti aspettano",
    body: "Ciao {name},\nqualche ora fa ti abbiamo segnalato nuove offerte compatibili ma non le hai ancora viste.\nChi si candida per primo ha più possibilità: entra ora e dai un'occhiata.\n{link}\n\n— digitalfa",
  },
  {
    key: "referral_invite", name: "Invito referral (porta un amico)", channel: "email", enabled: true,
    trigger: { type: "manual" },
    subject: "{name} ti invita su digitalfa",
    body: "Ciao,\n{name} ti invita a provare digitalfa: la piattaforma che trova ogni giorno offerte su misura e ti aiuta a candidarti.\nRegistrati con questo link: {link}\n\nA presto,\nil team digitalfa",
  },
  {
    key: "share_offer", name: "Condivisione offerta (network)", channel: "email", enabled: true,
    trigger: { type: "manual" },
    subject: "{name} ti consiglia una posizione: {jobTitle}",
    body: "Ciao,\n{name} ha pensato a te per questa posizione: {jobTitle} — {company}.\nGuarda l'offerta qui: {link}\n\nInviato tramite digitalfa.",
  },
  {
    key: "low_offers", name: "In-app: poche offerte", channel: "inapp", enabled: true,
    trigger: { type: "low_offers", threshold: 10, minDays: 1 },
    subject: "Poche offerte al momento",
    body: "Al momento abbiamo trovato poche offerte per il tuo profilo. Per ampliare i risultati: aggiungi altri titoli di ruolo e più località nelle Preferenze di ricerca, oppure allarga la modalità (es. anche da remoto).",
  },
];

// Unisce i default con le personalizzazioni salvate in config (per chiave).
export function getComms(config = {}) {
  const custom = Array.isArray(config.communications) ? config.communications : [];
  const byKey = new Map(custom.map((c) => [c.key, c]));
  const merged = DEFAULT_COMMS.map((d) => ({ ...d, ...(byKey.get(d.key) || {}), trigger: { ...d.trigger, ...((byKey.get(d.key) || {}).trigger || {}) } }));
  // Comunicazioni aggiunte dall'admin che non sono tra i default.
  for (const c of custom) if (c.key && !DEFAULT_COMMS.some((d) => d.key === c.key)) merged.push(c);
  return merged;
}

export function getComm(config, key) { return getComms(config).find((c) => c.key === key) || null; }

// Sostituisce i placeholder nel testo.
export function renderComm(tpl, ctx = {}) {
  const map = {
    name: ctx.name || "", count: ctx.count != null ? String(ctx.count) : "", link: ctx.link || "",
    days: ctx.days != null ? String(ctx.days) : "", plan: ctx.plan || "",
    jobTitle: ctx.jobTitle || "", company: ctx.company || "",
  };
  const sub = (s) => String(s || "").replace(/\{(name|count|link|days|plan|jobTitle|company)\}/g, (_, k) => map[k]);
  return { subject: sub(tpl.subject), text: sub(tpl.body) };
}
