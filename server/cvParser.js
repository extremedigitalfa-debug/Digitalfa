// CV parsing: extract raw text from PDF/DOCX/TXT, then pull structured profile
// fields. Uses the LLM when configured, otherwise a heuristic fallback so the
// flow works without any API key (the user always edits the result anyway).
import mammoth from "mammoth";
import { createRequire } from "module";
import { llmComplete } from "./llm.js";
import { JOB_TITLES, SECTORS } from "./onboardingData.js";

const require = createRequire(import.meta.url);

export async function extractText(buffer, fileName = "") {
  const name = String(fileName).toLowerCase();
  if (name.endsWith(".pdf")) {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }
  // txt / fallback: treat as UTF-8 text
  return buffer.toString("utf8");
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

// Heuristic extraction (no LLM): best-effort, always editable by the user.
function heuristicProfile(text) {
  const t = text.replace(/\r/g, "");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const email = (t.match(EMAIL_RE) || [])[0] || "";
  const phone = (t.match(PHONE_RE) || [])[0]?.trim() || "";
  // Name guess: first non-empty line that looks like a name (2-4 capitalised words, no digits/@).
  let fullName = "";
  for (const l of lines.slice(0, 8)) {
    if (!/\d|@/.test(l) && /^[A-ZÀ-Ý][\p{L}'.-]+(\s+[A-ZÀ-Ý][\p{L}'.-]+){1,3}$/u.test(l)) { fullName = l; break; }
  }
  const low = t.toLowerCase();
  const desiredTitles = (JOB_TITLES || []).filter((jt) => low.includes(jt.toLowerCase())).slice(0, 4);
  const sectors = (SECTORS || []).filter((s) => low.includes(s.toLowerCase())).slice(0, 4);
  const SKILLS = ["javascript", "python", "java", "react", "node", "sql", "aws", "excel", "sap", "seo", "sem", "crm", "photoshop", "project management", "agile", "scrum", "marketing", "vendite", "budgeting", "leadership", "analytics", "docker", "kubernetes"];
  const skills = SKILLS.filter((s) => low.includes(s)).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 12);
  let seniority = "Mid";
  if (/(head|director|chief|vp|manager|responsabile|dirigente)/i.test(low)) seniority = "Manager";
  else if (/(senior|sr\.|lead|principal)/i.test(low)) seniority = "Senior";
  else if (/(junior|jr\.|stage|intern|neolaureat)/i.test(low)) seniority = "Junior";
  return { fullName, email, phone, location: "", seniority, skills, desiredTitles, sectors, summary: lines.slice(0, 3).join(" ").slice(0, 280) };
}

const clampArr = (a, n) => (Array.isArray(a) ? a.filter(Boolean).map(String).slice(0, n) : []);

export async function extractProfile(text) {
  const base = heuristicProfile(text);
  const snippet = text.slice(0, 6000);
  const system = "Sei un estrattore di dati da CV. Rispondi SOLO con JSON valido, senza testo attorno.";
  const prompt = `Estrai dal seguente CV questi campi in JSON: {"fullName": string, "email": string, "phone": string, "location": string (città), "seniority": "Junior"|"Mid"|"Senior"|"Manager", "skills": string[], "desiredTitles": string[] (ruoli/titoli adatti), "sectors": string[], "summary": string (2-3 frasi)}. Se un campo non è deducibile, usa "" o []. CV:\n"""${snippet}"""`;
  const out = await llmComplete({ system, prompt, maxTokens: 500 });
  if (out) {
    try {
      const j = JSON.parse(out.replace(/^```json\s*|\s*```$/g, "").trim());
      return {
        fullName: j.fullName || base.fullName,
        email: j.email || base.email,
        phone: j.phone || base.phone,
        location: j.location || base.location,
        seniority: j.seniority || base.seniority,
        skills: clampArr(j.skills, 12).length ? clampArr(j.skills, 12) : base.skills,
        desiredTitles: clampArr(j.desiredTitles, 4).length ? clampArr(j.desiredTitles, 4) : base.desiredTitles,
        sectors: clampArr(j.sectors, 4).length ? clampArr(j.sectors, 4) : base.sectors,
        summary: j.summary || base.summary,
        source: "llm",
      };
    } catch { /* cade nell'euristica */ }
  }
  return { ...base, source: "euristica" };
}
