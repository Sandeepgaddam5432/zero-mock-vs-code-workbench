import MiniSearch from "minisearch";
import { portfolioConfig } from "../../portfolio.config";
import type { ChatMessage, Manifest, RepoMeta } from "./types";

/* ------------------------------------------------------------------ */
/* Settings & key storage (keys never leave the browser)               */
/* ------------------------------------------------------------------ */

export type Protocol = "openai" | "anthropic" | "gemini";

export interface Preset {
  id: string;
  label: string;
  protocol: Protocol;
  baseURL: string;
  model: string;
  needsKey: boolean;
}

export const PRESETS: Preset[] = [
  { id: "groq", label: "Groq", protocol: "openai", baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  { id: "deepseek", label: "DeepSeek", protocol: "openai", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat", needsKey: true },
  { id: "openrouter", label: "OpenRouter", protocol: "openai", baseURL: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", needsKey: true },
  { id: "mistral", label: "Mistral", protocol: "openai", baseURL: "https://api.mistral.ai/v1", model: "mistral-small-latest", needsKey: true },
  { id: "openai", label: "OpenAI", protocol: "openai", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini", needsKey: true },
  { id: "ollama", label: "Ollama (localhost)", protocol: "openai", baseURL: "http://localhost:11434/v1", model: "llama3.2", needsKey: false },
  { id: "anthropic", label: "Anthropic Claude", protocol: "anthropic", baseURL: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest", needsKey: true },
  { id: "gemini", label: "Google Gemini", protocol: "gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash", needsKey: true },
  { id: "custom", label: "Custom OpenAI-compatible", protocol: "openai", baseURL: "", model: "", needsKey: false },
];

export interface CopilotSettings {
  /** false => Zero-Key mode */
  byok: boolean;
  presetId: string;
  protocol: Protocol;
  baseURL: string;
  model: string;
  apiKey: string;
  remember: boolean;
}

export const defaultSettings = (): CopilotSettings => ({ byok: false, presetId: "groq", protocol: "openai", baseURL: PRESETS[0].baseURL, model: PRESETS[0].model, apiKey: "", remember: false });

const CFG = "copilot:config";
const KEY = "copilot:key";

export function loadSettings(): CopilotSettings {
  const base = defaultSettings();
  try {
    const cfg = JSON.parse(localStorage.getItem(CFG) ?? "null") as Partial<CopilotSettings> | null;
    const sessionKey = sessionStorage.getItem(KEY);
    const rememberedKey = localStorage.getItem(KEY);
    return { ...base, ...(cfg ?? {}), apiKey: sessionKey ?? rememberedKey ?? "", remember: !sessionKey && !!rememberedKey ? true : (cfg?.remember ?? false) };
  } catch {
    return base;
  }
}

export function saveSettings(s: CopilotSettings) {
  try {
    const { apiKey, ...rest } = s;
    localStorage.setItem(CFG, JSON.stringify(rest));
    if (!apiKey) {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
      return;
    }
    sessionStorage.setItem(KEY, apiKey);
    if (s.remember) localStorage.setItem(KEY, apiKey);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearKey() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* System prompt with editor context bridge                            */
/* ------------------------------------------------------------------ */

export interface EditorContext {
  path: string | null;
  code: string | null;
  selection: string | null;
}

const MAX_CONTEXT_CHARS = 6000;

export function buildSystemPrompt(manifest: Manifest | null, ctx: EditorContext): string {
  const p = portfolioConfig.profile;
  const repos = (manifest?.accounts ?? []).flatMap((a) => a.repos).slice(0, 25);
  const parts = [
    `You are the Copilot assistant embedded in ${p.name}'s interactive VS Code portfolio (${p.role}).`,
    `You help visitors understand ${p.name}'s skills, experience, projects and the code they are viewing. Be concise, friendly and accurate. Use Markdown with fenced code blocks.`,
    `Skills: ${Object.entries(portfolioConfig.skills).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" | ")}.`,
    `Experience: ${portfolioConfig.experience.map((e) => `${e.role} (${e.period}): ${e.highlights.join("; ")}`).join(" | ")}.`,
    repos.length ? `Public repositories: ${repos.map((r) => `${r.name}${r.language ? ` [${r.language}]` : ""}${r.description ? ` - ${r.description}` : ""}`).join("; ")}.` : "",
    `Status: ${p.status}. Contact: ${p.contact.email}.`,
  ].filter(Boolean);
  if (ctx.path) {
    parts.push(`\n--- Editor context ---\nThe visitor currently has this file open: ${ctx.path}`);
    if (ctx.selection) parts.push(`Selected code:\n\`\`\`\n${ctx.selection.slice(0, MAX_CONTEXT_CHARS)}\n\`\`\``);
    else if (ctx.code) parts.push(`File contents${ctx.code.length > MAX_CONTEXT_CHARS ? " (truncated)" : ""}:\n\`\`\`\n${ctx.code.slice(0, MAX_CONTEXT_CHARS)}\n\`\`\``);
  }
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* BYOK streaming adapters                                             */
/* ------------------------------------------------------------------ */

type Turn = Pick<ChatMessage, "role" | "content">;

async function readSSE(res: Response, onData: (data: string) => void) {
  if (!res.ok) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
    throw new Error(`Provider returned HTTP ${res.status}${body ? `: ${body}` : ""}`);
  }
  if (!res.body) throw new Error("Streaming is not supported by this browser/provider.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  }
  if (buffer.startsWith("data:")) onData(buffer.slice(5).trim());
}

export async function streamChat(settings: CopilotSettings, system: string, turns: Turn[], signal: AbortSignal, onToken: (t: string) => void): Promise<void> {
  const baseURL = settings.baseURL.replace(/\/+$/, "");
  if (settings.protocol === "openai") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({ model: settings.model, stream: true, messages: [{ role: "system", content: system }, ...turns] }),
    });
    await readSSE(res, (data) => {
      if (!data || data === "[DONE]") return;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const t = j.choices?.[0]?.delta?.content;
        if (t) onToken(t);
      } catch {
        /* partial JSON */
      }
    });
    return;
  }
  if (settings.protocol === "anthropic") {
    const res = await fetch(`${baseURL || "https://api.anthropic.com/v1"}/messages`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: settings.model, max_tokens: 4096, stream: true, system, messages: turns }),
    });
    await readSSE(res, (data) => {
      if (!data) return;
      try {
        const j = JSON.parse(data) as { type?: string; delta?: { text?: string }; error?: { message?: string } };
        if (j.type === "content_block_delta" && j.delta?.text) onToken(j.delta.text);
        if (j.type === "error") throw new Error(j.error?.message ?? "Anthropic stream error");
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    });
    return;
  }
  // Gemini
  const res = await fetch(`${baseURL || "https://generativelanguage.googleapis.com/v1beta"}/models/${encodeURIComponent(settings.model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    }),
  });
  await readSSE(res, (data) => {
    if (!data) return;
    try {
      const j = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = j.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("");
      if (text) onToken(text);
    } catch {
      /* partial JSON */
    }
  });
}

/* ------------------------------------------------------------------ */
/* Zero-key semantic assistant (static, in-memory, tool-less)          */
/* ------------------------------------------------------------------ */

interface Chunk {
  id: string;
  title: string;
  text: string;
  answer: string;
}

let kbCache: { key: string; ms: MiniSearch<Chunk>; chunks: Map<string, Chunk>; repos: RepoMeta[] } | null = null;

const repoLink = (r: RepoMeta) => `[${r.name}](#/${r.account}/${r.name})`;

function repoAnswer(r: RepoMeta): string {
  const lines = [`### ${repoLink(r)}`];
  if (r.description) lines.push(r.description);
  lines.push(`- **Language:** ${r.language ?? "n/a"}  \n- **Stars:** ${r.stars}  \n- **Pinned commit:** \`${r.commitSha.slice(0, 7)}\` on \`${r.branch}\`  \n- **Files:** ${r.fileCount}`);
  if (r.readme) lines.push(`> ${r.readme.replace(/[#>*`]/g, "").replace(/\s+/g, " ").trim().slice(0, 280)}…`);
  lines.push(`Open it in the editor with \`code ${r.account}/${r.name}\` in the terminal, or [view on GitHub](${r.htmlUrl}).`);
  return lines.join("\n\n");
}

function buildKb(manifest: Manifest | null) {
  const key = `${manifest?.generatedAt}:${manifest?.accounts.length}`;
  if (kbCache?.key === key) return kbCache;
  const p = portfolioConfig.profile;
  const repos = (manifest?.accounts ?? []).flatMap((a) => a.repos);
  const chunks: Chunk[] = [
    { id: "about", title: "About", text: `${p.name} ${p.role} ${p.bio.join(" ")}`, answer: `**${p.name}** — ${p.role}.\n\n${p.bio.join(" ")}` },
    ...Object.entries(portfolioConfig.skills).map(([k, v]) => ({ id: `skill-${k}`, title: `Skills: ${k}`, text: `${k} ${v.join(" ")}`, answer: `**${k}:** ${v.join(", ")}` })),
    ...portfolioConfig.experience.map((e, i) => ({
      id: `exp-${i}`,
      title: e.role,
      text: `${e.role} ${e.period} ${e.highlights.join(" ")}`,
      answer: `**${e.role}** (${e.period})\n${e.highlights.map((h) => `- ${h}`).join("\n")}`,
    })),
    { id: "contact", title: "Contact", text: `contact email github linkedin twitter hire ${p.status}`, answer: `- Email: ${p.contact.email}\n- GitHub: ${p.contact.github}\n- LinkedIn: ${p.contact.linkedin}\n- Twitter: ${p.contact.twitter}` },
    ...repos.map((r) => ({ id: `repo-${r.account}/${r.name}`, title: r.name, text: `${r.name} ${r.description ?? ""} ${r.language ?? ""} ${r.topics.join(" ")} ${r.readme.slice(0, 1500)}`, answer: repoAnswer(r) })),
  ];
  const ms = new MiniSearch<Chunk>({ fields: ["title", "text"], storeFields: ["title"], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 } });
  ms.addAll(chunks);
  kbCache = { key, ms, chunks: new Map(chunks.map((c) => [c.id, c])), repos };
  return kbCache;
}

export function zeroKeyAnswer(question: string, manifest: Manifest | null): string {
  const kb = buildKb(manifest);
  const q = question.toLowerCase();
  const p = portfolioConfig.profile;

  // 1. A specific repository mentioned by name
  const named = kb.repos.find((r) => q.includes(r.name.toLowerCase()) && r.name.length > 2);
  if (named) return repoAnswer(named);

  const langs = new Map<string, number>();
  kb.repos.forEach((r) => r.language && langs.set(r.language, (langs.get(r.language) ?? 0) + 1));
  const langList = [...langs.entries()].sort((a, b) => b[1] - a[1]);

  if (/\b(hi|hello|hey|help|what can you)\b/.test(q) && q.length < 40) {
    return `Hi! I'm the **zero-key** portfolio assistant. I run entirely in your browser from pre-compiled data — no keys, no servers.\n\nAsk me about ${p.name}'s **skills**, **experience**, **projects**, or **how to get in touch**. Add your own API key in the ⚙ settings above to chat with a full LLM about the code you're viewing.`;
  }
  if (/(skill|stack|tech|know|framework|proficien|good at|tools?)\b/.test(q)) {
    const skills = Object.entries(portfolioConfig.skills).map(([k, v]) => `- **${k}:** ${v.join(", ")}`).join("\n");
    const used = langList.length ? `\n\nMost-used languages across public repos: ${langList.slice(0, 5).map(([l, n]) => `${l} (${n})`).join(", ")}.` : "";
    return `Here's ${p.name}'s toolbox:\n\n${skills}${used}`;
  }
  if (/(language)/.test(q) && langList.length) {
    return `Languages across public repositories:\n\n${langList.map(([l, n]) => `- **${l}** — ${n} repo${n > 1 ? "s" : ""}`).join("\n")}`;
  }
  if (/(experience|work history|career|job|role|employ|background)/.test(q)) {
    return portfolioConfig.experience.map((e) => `**${e.role}** (${e.period})\n${e.highlights.map((h) => `- ${h}`).join("\n")}`).join("\n\n");
  }
  if (/(project|repo|built|build|open.?source|portfolio|showcase|work on)/.test(q)) {
    if (!kb.repos.length) return "No repositories are indexed yet. Run `npm run sync` to pull the latest public repositories into the manifest.";
    const top = [...kb.repos].sort((a, b) => b.stars - a.stars || (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "")).slice(0, 6);
    return `${p.name} has **${kb.repos.length}** public repositories. Highlights:\n\n${top.map((r) => `- ${repoLink(r)}${r.language ? ` · ${r.language}` : ""}${r.stars ? ` · ★${r.stars}` : ""}${r.description ? ` — ${r.description}` : ""}`).join("\n")}\n\nAsk about any repo by name for details.`;
  }
  if (/(contact|email|reach|hire|hiring|available|linkedin|twitter|github|open to)/.test(q)) {
    return `**${p.status}** ✅\n\n- Email: ${p.contact.email}\n- GitHub: ${p.contact.github}\n- LinkedIn: ${p.contact.linkedin}\n- Twitter: ${p.contact.twitter}\n\nYou can also run \`resume\` in the terminal to download a resume.`;
  }
  if (/(who|about|introduce|yourself|name)/.test(q)) {
    return kb.chunks.get("about")!.answer;
  }
  // 2. Semantic fallback: BM25 over knowledge chunks
  const hits = kb.ms.search(question).slice(0, 3);
  if (hits.length) {
    return `Here's what I found:\n\n${hits.map((h) => kb.chunks.get(h.id)!.answer).join("\n\n---\n\n")}`;
  }
  return `I couldn't find that in the portfolio data. Try asking about **skills**, **experience**, **projects** or **contact** — or enable BYOK mode in ⚙ settings for open-ended questions and code explanations.`;
}
