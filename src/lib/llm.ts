const URL = "https://api.featherless.ai/v1/chat/completions";
export const MODELE = process.env.LLM_MODEL || "moonshotai/Kimi-K3";

export type Message = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string };

export async function chat(messages: Message[], opts: { tools?: any[]; max_tokens?: number; temperature?: number } = {}) {
  const cle = process.env.FEATHERLESS_API_KEY;
  if (!cle) throw new Error("FEATHERLESS_API_KEY manquante");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELE, messages, tools: opts.tools, max_tokens: opts.max_tokens ?? 700, temperature: opts.temperature ?? 0.3, chat_template_kwargs: { thinking: false, enable_thinking: false } }),
      signal: ctrl.signal,
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    return j.choices[0].message as { content: string | null; tool_calls?: any[] };
  } finally {
    clearTimeout(timer);
  }
}

export function extraireJson<T = any>(txt: string | null | undefined): T | null {
  if (!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
