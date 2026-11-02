"use client";

import DOMPurify from "dompurify";
import { marked, type Token } from "marked";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSystemPrompt, clearKey, defaultSettings, loadSettings, PRESETS, saveSettings, streamChat, zeroKeyAnswer, type CopilotSettings } from "@/lib/copilot";
import { highlightToHtml } from "@/lib/highlight";
import { useWorkbench } from "@/lib/store";
import { Codicon } from "./Codicon";

let handledNonce = 0;

/* ---------------------- Markdown with highlighted code ---------------------- */

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const theme = useWorkbench((s) => s.theme);
  const openUntitled = useWorkbench((s) => s.openUntitled);
  const toast = useWorkbench((s) => s.toast);
  const [html, setHtml] = useState("");
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      highlightToHtml(code, lang || "text", theme)
        .then((h) => !cancelled && setHtml(h))
        .catch(() => undefined);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code, lang, theme]);
  return (
    <div className="my-2 overflow-hidden rounded border border-line bg-editor">
      <div className="flex items-center justify-between border-b border-line bg-black/10 px-2 py-1 text-[11px] text-muted">
        <span>{lang || "text"}</span>
        <span className="flex gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover hover:text-bright"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => toast("Copied to clipboard"));
            }}
          >
            <Codicon name="copy" size={12} /> Copy
          </button>
          <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover hover:text-bright" onClick={() => openUntitled(code, lang)}>
            <Codicon name="go-to-file" size={12} /> Open in New Editor Tab
          </button>
        </span>
      </div>
      {html ? (
        <div className="shiki-chat overflow-x-auto p-2 text-[12px] [&_pre]:!bg-transparent [&_pre]:m-0 [&_code]:font-mono" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="m-0 overflow-x-auto p-2 font-mono text-[12px] text-fg">{code}</pre>
      )}
    </div>
  );
}

const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const list = marked.lexer(content);
    return list.map((tok: Token, i: number) => {
      if (tok.type === "code") return { key: i, code: tok.text, lang: tok.lang ?? "", html: "" };
      if (tok.type === "space") return { key: i, code: null, lang: "", html: "" };
      const html = marked.parser(Object.assign([tok], { links: list.links }));
      return { key: i, code: null, lang: "", html: DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) };
    });
  }, [content]);
  return (
    <div className="chat-md text-[13px] leading-relaxed">
      {blocks.map((b) => (b.code !== null ? <CodeBlock key={b.key} code={b.code} lang={b.lang} /> : b.html ? <div key={b.key} dangerouslySetInnerHTML={{ __html: b.html }} /> : null))}
    </div>
  );
});

/* ------------------------------- Main view ------------------------------- */

const SUGGESTIONS = ["What are your core skills?", "Show me your projects", "Tell me about your experience", "How can I contact you?"];

export function CopilotView() {
  const messages = useWorkbench((s) => s.messages);
  const busy = useWorkbench((s) => s.chatBusy);
  const request = useWorkbench((s) => s.copilotRequest);
  const activeTab = useWorkbench((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const [settings, setSettings] = useState<CopilotSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async (text: string, selection: string | null = null, selPath: string | null = null) => {
    const st = useWorkbench.getState();
    if (st.chatBusy || !text.trim()) return;
    const cfg = settingsRef.current;
    const id = Date.now();
    const userMsg = { id: `u${id}`, role: "user" as const, content: text };
    const asstId = `a${id}`;
    st.setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", content: "" }]);
    st.setChatBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const append = (tok: string) => useWorkbench.getState().setMessages((ms) => ms.map((m) => (m.id === asstId ? { ...m, content: m.content + tok } : m)));
    const fail = (message: string) => useWorkbench.getState().setMessages((ms) => ms.map((m) => (m.id === asstId ? { ...m, content: `${m.content}${m.content ? "\n\n" : ""}⚠️ ${message}`, error: true } : m)));

    try {
      if (!cfg.byok) {
        const answer = zeroKeyAnswer(text, st.manifest);
        for (let i = 0; i < answer.length; i += 6) {
          if (ctrl.signal.aborted) break;
          append(answer.slice(i, i + 6));
          await new Promise((r) => setTimeout(r, 8));
        }
      } else {
        const preset = PRESETS.find((p) => p.id === cfg.presetId);
        if ((preset?.needsKey ?? true) && !cfg.apiKey) throw new Error("No API key set. Open ⚙ settings and paste your key, or switch back to Zero-Key mode.");
        if (!cfg.baseURL && cfg.protocol === "openai") throw new Error("Base URL is required for OpenAI-compatible providers.");
        if (!cfg.model) throw new Error("Model name is required.");
        const tab = st.tabs.find((t) => t.id === st.activeTabId);
        const content = tab ? st.contents[tab.id] : undefined;
        const code = content?.status === "ready" ? content.content : null;
        const path = selPath ?? (tab ? (tab.kind === "github" ? `${tab.account}/${tab.repo}/${tab.path}` : tab.path) : null);
        const system = buildSystemPrompt(st.manifest, { path, code, selection });
        const history = useWorkbench.getState().messages.filter((m) => m.id !== asstId && !m.error).map((m) => ({ role: m.role, content: m.content }));
        await streamChat(cfg, system, history, ctrl.signal, append);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const msg = (e as Error).message;
        fail(/failed to fetch|networkerror|load failed/i.test(msg) ? `Network/CORS error talking to the provider. ${cfg.presetId === "ollama" ? "For Ollama, start it with OLLAMA_ORIGINS=* so the browser may call it." : "Check the base URL and your key."}` : msg);
      }
    } finally {
      useWorkbench.getState().setChatBusy(false);
      abortRef.current = null;
    }
  }, []);

  // Editor context bridge: "Explain Selected Code"
  useEffect(() => {
    if (!request || request.nonce === handledNonce) return;
    handledNonce = request.nonce;
    const body = request.selection ? `${request.prompt}\n\n\`\`\`\n${request.selection.slice(0, 4000)}\n\`\`\`` : request.prompt;
    void send(body, request.selection, request.path);
  }, [request, send]);

  const stop = () => abortRef.current?.abort();
  const mode = settings.byok ? `BYOK · ${PRESETS.find((p) => p.id === settings.presetId)?.label ?? "Custom"}` : "Zero-Key";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${settings.byok ? "bg-[#4ade80]" : "bg-[#75beff]"}`} />
          <span className="text-bright">{mode}</span>
        </span>
        <span className="flex gap-0.5">
          <button type="button" title="Clear chat" aria-label="Clear chat" className="rounded p-1 text-muted hover:bg-hover hover:text-bright" onClick={() => { stop(); useWorkbench.getState().setMessages(() => []); }}>
            <Codicon name="clear-all" size={14} />
          </button>
          <button type="button" title="Provider settings" aria-label="Provider settings" aria-pressed={showSettings} className={`rounded p-1 hover:bg-hover hover:text-bright ${showSettings ? "bg-hover text-bright" : "text-muted"}`} onClick={() => setShowSettings((v) => !v)}>
            <Codicon name="settings-gear" size={14} />
          </button>
        </span>
      </div>

      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} />}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="text-[13px] text-muted">
            <div className="mb-2 flex items-center gap-2 text-bright">
              <Codicon name="copilot" size={20} /> <span className="text-[15px] font-semibold">Ask Copilot</span>
            </div>
            <p className="mb-3 leading-relaxed">
              {settings.byok ? "Chatting with your own model. The active file is sent as context." : "Zero-Key mode answers from pre-compiled portfolio data — fully offline, no keys. Add your own key in ⚙ for a full LLM."}
            </p>
            <div className="flex flex-col gap-1.5">
              {[...SUGGESTIONS, ...(activeTab ? [`Explain ${activeTab.title}`] : [])].map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="rounded border border-line px-2.5 py-1.5 text-left text-[12px] text-fg hover:border-accent hover:bg-hover">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-6" : ""}>
            <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Codicon name={m.role === "user" ? "account" : "copilot"} size={12} /> {m.role === "user" ? "You" : "Copilot"}
            </div>
            <div className={`rounded px-2.5 py-1.5 ${m.role === "user" ? "bg-selected text-bright" : m.error ? "bg-red-500/10" : "bg-transparent"}`}>
              {m.role === "assistant" && !m.content && busy ? <span className="text-muted">Thinking…</span> : <ChatMarkdown content={m.content} />}
            </div>
          </div>
        ))}
      </div>

      <form
        className="shrink-0 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input;
          setInput("");
          void send(t);
        }}
      >
        {activeTab && (
          <div className="mb-1 flex items-center gap-1 text-[11px] text-muted" title="The active file is attached as context">
            <Codicon name="file" size={12} /> Context: <span className="truncate text-fg">{activeTab.title}</span>
          </div>
        )}
        <div className="flex items-end gap-1 rounded border border-line bg-input px-2 py-1 focus-within:border-accent">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Ask about skills, projects, or the open file…"
            aria-label="Chat message"
            className="min-h-[40px] flex-1 resize-none bg-transparent text-[13px] text-bright outline-none placeholder:text-muted"
          />
          {busy ? (
            <button type="button" onClick={stop} title="Stop" aria-label="Stop generating" className="mb-1 rounded p-1 text-bright hover:bg-hover">
              <Codicon name="debug-stop" size={16} />
            </button>
          ) : (
            <button type="submit" title="Send" aria-label="Send" disabled={!input.trim()} className="mb-1 rounded p-1 text-accent hover:bg-hover disabled:opacity-40">
              <Codicon name="send" size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------------------------- Provider settings --------------------------- */

function SettingsPanel({ settings, onChange }: { settings: CopilotSettings; onChange: (s: CopilotSettings) => void }) {
  const toast = useWorkbench((s) => s.toast);
  const update = (patch: Partial<CopilotSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    saveSettings(next);
  };
  const field = "h-7 w-full rounded-sm border border-line bg-input px-2 text-[12px] text-bright outline-none focus:border-accent";
  const lbl = "mb-0.5 block text-[10px] font-bold uppercase text-muted";
  return (
    <div className="shrink-0 space-y-2 border-b border-line bg-black/10 p-3 text-[12px]">
      <div className="flex gap-1">
        {(["Zero-Key", "BYOK"] as const).map((m) => {
          const on = (m === "BYOK") === settings.byok;
          return (
            <button key={m} type="button" aria-pressed={on} onClick={() => update({ byok: m === "BYOK" })} className={`flex-1 rounded-sm border px-2 py-1 ${on ? "border-accent bg-accent text-accentfg" : "border-line text-fg hover:bg-hover"}`}>
              {m === "BYOK" ? "Bring Your Own Key" : "Zero-Key (offline)"}
            </button>
          );
        })}
      </div>
      {settings.byok && (
        <>
          <div>
            <label className={lbl} htmlFor="cp-provider">
              Provider
            </label>
            <select
              id="cp-provider"
              className={field}
              value={settings.presetId}
              onChange={(e) => {
                const p = PRESETS.find((x) => x.id === e.target.value)!;
                update({ presetId: p.id, protocol: p.protocol, baseURL: p.baseURL, model: p.model });
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {settings.protocol === "openai" && (
            <div>
              <label className={lbl} htmlFor="cp-base">
                Base URL
              </label>
              <input id="cp-base" className={field} value={settings.baseURL} onChange={(e) => update({ baseURL: e.target.value })} placeholder="https://api.example.com/v1" />
            </div>
          )}
          <div>
            <label className={lbl} htmlFor="cp-model">
              Model
            </label>
            <input id="cp-model" className={field} value={settings.model} onChange={(e) => update({ model: e.target.value })} />
          </div>
          <div>
            <label className={lbl} htmlFor="cp-key">
              API Key {PRESETS.find((p) => p.id === settings.presetId)?.needsKey === false && <span className="font-normal normal-case">(optional)</span>}
            </label>
            <input id="cp-key" type="password" autoComplete="off" className={field} value={settings.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="sk-…" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input type="checkbox" checked={settings.remember} onChange={(e) => update({ remember: e.target.checked })} className="accent-[var(--accent)]" />
            Remember me (store key in localStorage)
          </label>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-[11px] text-link hover:underline"
              onClick={() => {
                clearKey();
                onChange({ ...settings, apiKey: "" });
                toast("API key removed from this browser");
              }}
            >
              Forget key
            </button>
          </div>
        </>
      )}
      <p className="text-[11px] leading-snug text-muted">
        <Codicon name="lock" size={11} className="mr-1 align-middle" />
        Keys live in <code>sessionStorage</code> (cleared when the tab closes) unless you opt in to “Remember me”. Requests go straight from your browser to the provider — never to this site.
      </p>
    </div>
  );
}
