// Outreach generators — suggested contacts, a <200-char message and a cover
// letter. Uses an LLM when configured (see llm.js), otherwise falls back to
// deterministic templates so everything works offline.
import { llmComplete, isLLMEnabled } from "./llm.js";

const NAMES = ["Giulia Ferrari", "Marco Bianchi", "Elena Conti", "Luca Ricci", "Sara Marino", "Andrea Greco", "Chiara Esposito", "Matteo Romano", "Francesca Gallo", "Davide Costa"];
const DEPT = { Tech: "Engineering", Marketing: "Marketing", Sales: "Sales", HR: "People", Operations: "Operations", Finance: "Finance", Retail: "Retail" };

function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
const linkedinSearch = (q) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;

// Three suggested contacts to reach out to for a given job.
// Names are fictional; the link is a LinkedIn people-search scoped to the role
// at the company (a legitimate way to find the real person). With a contacts
// data provider these become resolved profile URLs.
export function suggestContacts(job) {
  const dept = DEPT[job.industry] || "Team";
  const co = job.company && job.company !== "—" ? job.company : "";
  // Ricerche LinkedIn mirate (persone reali da contattare) — niente nomi inventati.
  const searches = [
    { role: `Recruiter / Talent Acquisition${co ? ` · ${co}` : ""}`, q: `("Recruiter" OR "Talent Acquisition") ${co}`.trim() },
    { role: `Responsabile HR${co ? ` · ${co}` : ""}`, q: `("HR" OR "People" OR "Risorse Umane") ${co}`.trim() },
    { role: `Hiring Manager · ${dept}${co ? ` · ${co}` : ""}`, q: `("Hiring Manager" OR "Head of ${dept}") ${co}`.trim() },
  ];
  const contacts = searches.map((r) => ({ role: r.role, company: job.company, linkedin: linkedinSearch(r.q) }));
  // Se nella JD c'è un'email di contatto, la mettiamo in cima (contatto diretto).
  const email = (String(job.description || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0];
  return { contacts, jdEmail: email || null };
}

// Taglio "morbido": non spezza le parole e chiude a fine frase quando possibile.
const clampMessage = (m, max = 300) => {
  const s = String(m || "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…";
};

// Template fallback for the short message.
export function templateMessage(profile, job) {
  const first = (profile.name || "").split(" ")[0] || "Ciao";
  const skills = (profile.skills || []).slice(0, 2).join(" e ");
  const role = profile.title && profile.title !== "—" ? profile.title : "professionista";
  return clampMessage(`Buongiorno, sono ${first}, ${role}. Ho visto la posizione "${job.title}" in ${job.company} e sono molto interessato/a: la mia esperienza in ${skills || job.industry || "questo ambito"} è in linea con il ruolo. Sarei felice di approfondire con una breve call. Grazie!`);
}

// Short outreach message (< 200 chars). LLM when configured, else template.
export async function generateMessage(profile, job) {
  if (isLLMEnabled()) {
    const out = await llmComplete({
      maxTokens: 160,
      system: "Sei un career coach. Scrivi in italiano un messaggio di contatto per LinkedIn, in prima persona, tono professionale e concreto. Vincoli: MASSIMO 300 caratteri, 2-3 frasi COMPLETE (mai troncate a metà), specifico sul ruolo e su una competenza pertinente, chiusura con una richiesta chiara (es. una breve call). Nessun preambolo, nessuna virgoletta iniziale/finale.",
      prompt: `Candidato: ${profile.name}, ${profile.title || "professionista"}${profile.seniority && profile.seniority !== "—" ? ` (${profile.seniority})` : ""}. Competenze: ${(profile.skills || []).slice(0, 4).join(", ") || "varie"}. Posizione: ${job.title} presso ${job.company}${job.location ? `, ${job.location}` : ""}. Scrivi il messaggio.`,
    });
    if (out) return clampMessage(out.replace(/^["'«]\s*|\s*["'»]$/g, "").trim());
  }
  return templateMessage(profile, job);
}

// Full cover letter (Italian, ~180 words). LLM when configured, else template.
export async function generateCoverLetter(profile, job) {
  if (isLLMEnabled()) {
    const out = await llmComplete({
      maxTokens: 500,
      system: "Sei un career coach esperto. Scrivi in italiano una cover letter professionale, concisa (150-220 parole), in prima persona, senza segnaposto tra parentesi. Inizia con 'Gentile team di …' e chiudi con 'Cordiali saluti,' e il nome.",
      prompt: `Candidato: ${profile.name}, ${profile.title || "professionista"}${profile.seniority && profile.seniority !== "—" ? ` (${profile.seniority})` : ""}. ${profile.headline || ""} Competenze: ${(profile.skills || []).join(", ") || "varie"}. Posizione: ${job.title} presso ${job.company}${job.location ? `, ${job.location}` : ""}${job.industry && job.industry !== "—" ? ` (settore ${job.industry})` : ""}.`,
    });
    if (out) return out.trim();
  }
  return templateCoverLetter(profile, job);
}

// Template fallback for the cover letter.
export function templateCoverLetter(profile, job) {
  const first = (profile.name || "").split(" ")[0];
  const skills = (profile.skills || []).slice(0, 4);
  const skillLine = skills.length ? skills.slice(0, -1).join(", ") + (skills.length > 1 ? ` e ${skills[skills.length - 1]}` : skills[0]) : "diverse competenze trasversali";
  const remote = job.remote && job.remote !== "—" ? ` (${job.remote.toLowerCase()})` : "";
  const intro = profile.headline ? ` ${profile.headline}` : "";
  return `Gentile team di ${job.company},

desidero candidarmi per la posizione di ${job.title}${remote} pubblicata di recente.

Sono ${profile.name}, ${profile.title || "un professionista"}.${intro} Nel corso del mio percorso ho sviluppato competenze in ${skillLine}, che ritengo particolarmente rilevanti per questo ruolo${job.industry && job.industry !== "—" ? ` in ambito ${job.industry.toLowerCase()}` : ""}.

Mi attrae la possibilità di contribuire ai risultati di ${job.company} portando un approccio orientato agli obiettivi e la capacità di inserirmi rapidamente in un nuovo contesto. Sarei felice di illustrarvi in un colloquio come la mia esperienza possa tradursi in valore concreto per il vostro team.

Ringrazio per l'attenzione e resto a disposizione per un incontro.

Cordiali saluti,
${profile.name}`;
}

// Tipologia azienda: euristica (gratis) → usata sempre come base/fallback.
export function heuristicCompanyType(job) {
  const t = `${job.company || ""} ${job.description || ""} ${job.title || ""}`.toLowerCase();
  if (/scale ?-?up/.test(t)) return "Scale-up";
  if (/start ?-?up/.test(t)) return "StartUp";
  if (/\bpmi\b|piccola e media|small business|small[- ]medium/.test(t)) return "PMI";
  if (/multinaz|multinational|gruppo|group\b|s\.?p\.?a\b|corporation|enterprise|holding/.test(t)) return "Azienda";
  return null;
}
const CT_VALUES = ["StartUp", "Scale-up", "PMI", "Azienda"];
// Classificazione: usa l'LLM se configurato (una parola), altrimenti euristica.
// Appena imposti la chiave LLM in Impostazioni, questa funzione la usa da sola.
export async function classifyCompanyType(job) {
  if (isLLMEnabled()) {
    const out = await llmComplete({
      maxTokens: 8,
      system: "Classifica il datore di lavoro di un annuncio in UNA parola tra: StartUp, Scale-up, PMI, Azienda. 'Azienda' = grande impresa/multinazionale. Rispondi solo con una di queste parole.",
      prompt: `Azienda: ${job.company || "n.d."}. Titolo: ${job.title || ""}. Descrizione: ${(job.description || "").slice(0, 500)}`,
    });
    if (out) { const m = CT_VALUES.find((v) => out.toLowerCase().includes(v.toLowerCase().replace("-", ""))); if (m) return m; }
  }
  return heuristicCompanyType(job);
}

// "Personalizza CV": suggerimenti per adattare il CV a una specifica offerta.
export async function generateTailoredCv(profile, job) {
  const cv = (profile.cvText || "").slice(0, 3000);
  if (isLLMEnabled()) {
    const out = await llmComplete({
      maxTokens: 550,
      system: "Sei un career coach. In italiano, proponi come adattare il CV del candidato a una specifica offerta. Restituisci: 1) un 'Titolo/Headline' su misura, 2) un breve 'Sommario professionale' (2-3 righe) orientato all'offerta, 3) 4-6 punti elenco con i risultati/competenze da mettere in evidenza. Niente segnaposto tra parentesi.",
      prompt: `Candidato: ${profile.name}, ${profile.title || "professionista"} (${profile.seniority || "—"}). Competenze: ${(profile.skills || []).join(", ") || "varie"}.${cv ? ` Estratto CV: """${cv}"""` : ""} Offerta: ${job.title} presso ${job.company}${job.location ? `, ${job.location}` : ""}${job.industry && job.industry !== "—" ? ` (settore ${job.industry})` : ""}.`,
    });
    if (out) return out.trim();
  }
  const skills = (profile.skills || []).slice(0, 6);
  return `Headline su misura
${profile.title || "Professionista"} orientato a ${job.title}

Sommario professionale
Professionista con esperienza in ${(skills.slice(0, 3).join(", ") || job.industry || "diversi ambiti")}, interessato al ruolo di ${job.title} presso ${job.company}. Punto su risultati concreti e rapida integrazione nel team.

Da mettere in evidenza per questa offerta
${(skills.length ? skills : ["Competenze chiave", "Risultati misurabili", "Lavoro in team"]).map((s) => `• ${s} — collega questa competenza a un risultato concreto ottenuto.`).join("\n")}
• Adatta il primo blocco del CV al linguaggio dell'annuncio "${job.title}".

Suggerimento: personalizza sempre le prime righe del CV con le parole chiave dell'annuncio.`;
}

// Seam for an LLM upgrade: if you wire an API key, replace the bodies above
// with a prompt like: "Scrivi un messaggio <200 caratteri per {profile} → {job}".
