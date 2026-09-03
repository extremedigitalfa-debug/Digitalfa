// Provider-agnostic LLM client. Enabled only when an API key is configured;
// otherwise callers fall back to their deterministic templates.
//
// Supported providers (env LLM_PROVIDER):
//   - "openai"    → any OpenAI-compatible /chat/completions endpoint
//                   (OpenAI, Azure OpenAI, OpenRouter, Together, local Ollama…)
//                   env: OPENAI_API_KEY | LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
//   - "anthropic" → Anthropic Messages API
//                   env: ANTHROPIC_API_KEY, LLM_MODEL
// If LLM_PROVIDER is unset it is inferred from whichever key is present.

const OPENAI_KEY = () => process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY;

export function llmProvider() {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "openai" || p === "anthropic") return p;
  if (ANTHROPIC_KEY()) return "anthropic";
  if (OPENAI_KEY()) return "openai";
  return null;
}
export const isLLMEnabled = () => !!llmProvider();

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15000);

async function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promise(ctrl.signal); } finally { clearTimeout(t); }
}

async function openaiComplete({ system, prompt, maxTokens }) {
  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const res = await withTimeout((signal) => fetch(`${base}/chat/completions`, {
    method: "POST", signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY()}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.6, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  }), TIMEOUT_MS);
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM: risposta vuota");
  return text.trim();
}

async function anthropicComplete({ system, prompt, maxTokens }) {
  const model = process.env.LLM_MODEL || "claude-3-5-haiku-latest";
  const res = await withTimeout((signal) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  }), TIMEOUT_MS);
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.content?.map((b) => b.text).join("").trim();
  if (!text) throw new Error("LLM: risposta vuota");
  return text;
}

// Returns the generated string, or null if LLM is disabled / fails
// (callers then use their template fallback).
export async function llmComplete({ system, prompt, maxTokens = 400 }) {
  const provider = llmProvider();
  if (!provider) return null;
  try {
    return provider === "anthropic"
      ? await anthropicComplete({ system, prompt, maxTokens })
      : await openaiComplete({ system, prompt, maxTokens });
  } catch (e) {
    console.warn("[llm] fallback ai template:", e.message);
    return null;
  }
}
