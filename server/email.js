// Transactional email. Uses SMTP when configured (SMTP_HOST/PORT/USER/PASS),
// otherwise logs to the console so the flow works in dev / without credentials.
import nodemailer from "nodemailer";

let transporter = null;
let checked = false;

// Force the transporter to be rebuilt on next send (after admin updates SMTP).
export function resetTransporter() { transporter = null; checked = false; }

export function emailEnabled() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (checked) return transporter;
  checked = true;
  if (!emailEnabled()) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const FROM = () => process.env.SMTP_FROM || "digitalfa <no-reply@digitalfa.app>";

// Salute SMTP: teniamo traccia dell'ultimo esito per il sistema di allerta.
let _mailHealth = { configured: false, lastError: null, lastErrorAt: null, lastOkAt: null };
export function getMailHealth() { return { ..._mailHealth, configured: !!getTransporter() }; }

export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) { console.log(`[email · simulata] a ${to} — ${subject}`); return { simulated: true }; }
  try {
    await t.sendMail({ from: FROM(), to, subject, text, html });
    _mailHealth = { configured: true, lastError: null, lastErrorAt: null, lastOkAt: new Date().toISOString() };
    return { sent: true };
  } catch (e) {
    _mailHealth = { ..._mailHealth, configured: true, lastError: e.message, lastErrorAt: new Date().toISOString() };
    throw e;
  }
}

const fill = (tmpl, vars) => String(tmpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));

// Password reset email with a one-time link.
export async function sendResetEmail(user, link) {
  const name = (user.name || "").split(" ")[0] || "ciao";
  const subject = "Reimposta la tua password · digitalfa";
  const text = `Ciao ${name},\nhai richiesto di reimpostare la password.\nApri questo link (valido 1 ora): ${link}\nSe non sei stato tu, ignora questa email.\n\n— digitalfa`;
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#2b5cff">Reimposta la password</h2>
    <p>Ciao ${name}, hai richiesto di reimpostare la password del tuo account digitalfa.</p>
    <p><a href="${link}" style="display:inline-block;background:#2b5cff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600">Reimposta la password →</a></p>
    <p style="color:#888;font-size:12px;margin-top:16px">Il link è valido 1 ora. Se non hai richiesto tu il reset, ignora questa email.</p>
  </div>`;
  return sendMail({ to: user.email, subject, text, html });
}

// "Oggi ci sono xx nuove offerte specifiche per te — visita il tuo profilo."
// Subject/body come from admin templates when provided (placeholders {name} {count} {link}).
export async function sendNewOffersEmail(user, count, link, templates = {}) {
  const name = (user.name || "").split(" ")[0] || "ciao";
  const vars = { name, count, link };
  const subject = templates.subject ? fill(templates.subject, vars) : `${count} nuove offerte per te oggi su digitalfa`;
  const bodyText = templates.body ? fill(templates.body, vars)
    : `Ciao ${name},\noggi ci sono ${count} nuove offerte selezionate per il tuo profilo.\nVisita il tuo profilo per vederle: ${link}\n\n— digitalfa`;
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto">
    ${bodyText.split("\n").map((l) => `<p style="margin:0 0 8px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("")}
    <p style="margin-top:14px"><a href="${link}" style="display:inline-block;background:#2b5cff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600">Vedi le offerte →</a></p>
    <p style="color:#888;font-size:12px;margin-top:24px">Ricevi questa email perché hai un profilo attivo su digitalfa.</p>
  </div>`;
  return sendMail({ to: user.email, subject, text: bodyText, html });
}
