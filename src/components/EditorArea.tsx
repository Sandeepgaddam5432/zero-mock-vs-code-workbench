"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { portfolioConfig } from "../../portfolio.config";
import { useWorkbench } from "@/lib/store";
import type { Tab } from "@/lib/types";
import { formatBytes, loadTab } from "@/lib/vfs";
import { Codicon } from "./Codicon";
import { baseForTab, ImagePreview, MarkdownPreview } from "./MarkdownPreview";
import { ShikiViewer } from "./ShikiViewer";
import { TabsBar } from "./TabsBar";

// Monaco touches `window` - isolate it in a client-only dynamic import (no SSR, no hydration mismatch).
const MonacoEditor = dynamic(() => import("./MonacoEditor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-muted">Loading editor…</div>,
});

function Banner({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className={`max-w-lg rounded border p-4 text-[13px] ${tone === "warn" ? "border-[#cca700]/60 bg-[#cca700]/10" : "border-[#f14c4c]/60 bg-[#f14c4c]/10"}`}>{children}</div>
    </div>
  );
}

function Breadcrumbs({ tab }: { tab: Tab }) {
  const parts = tab.kind === "github" ? [tab.account ?? "", tab.repo ?? "", ...tab.path.split("/")] : [portfolioConfig.profile.handle, tab.path];
  return (
    <div className="flex h-[22px] shrink-0 items-center gap-0.5 overflow-hidden whitespace-nowrap bg-editor px-3 text-[12px] text-muted">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-0.5">
          {i > 0 && <Codicon name="chevron-right" size={12} />}
          <span className={i === parts.length - 1 ? "text-fg" : ""}>{p}</span>
        </span>
      ))}
    </div>
  );
}

function TabContent({ tab, mobile }: { tab: Tab; mobile: boolean }) {
  const state = useWorkbench((s) => s.contents[tab.id]);
  const setContent = useWorkbench((s) => s.setContent);
  const split = useWorkbench((s) => !!s.splitPreview[tab.id]);
  const [mdMode, setMdMode] = useState<"preview" | "source">("preview");
  const [attempt, setAttempt] = useState(0);
  const isMd = /\.(md|mdx|markdown)$/i.test(tab.path);
  const base = useMemo(() => baseForTab(tab), [tab]);

  useEffect(() => {
    if (state && state.status !== "error" && state.status !== "loading") return;
    let cancelled = false;
    void loadTab(tab).then((r) => !cancelled && setContent(tab.id, r));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, attempt]);

  if (!state || state.status === "loading") {
    return <div className="flex h-full items-center justify-center gap-2 text-[13px] text-muted"><Codicon name="loading" className="animate-spin" /> Fetching {tab.title}…</div>;
  }
  if (state.status === "toolarge") {
    return (
      <Banner tone="warn">
        <div className="mb-2 flex items-center gap-2 font-semibold text-bright"><Codicon name="warning" /> File too large to preview</div>
        <p className="mb-3 text-muted">{tab.title} is {formatBytes(state.size)}, which exceeds the 500 KB preview limit.</p>
        <a href={state.rawUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-accent px-3 py-1 text-accentfg hover:brightness-110"><Codicon name="link-external" size={13} /> Open Raw Source</a>
      </Banner>
    );
  }
  if (state.status === "error") {
    return (
      <Banner tone="error">
        <div className="mb-2 flex items-center gap-2 font-semibold text-bright"><Codicon name="error" /> Unable to open {tab.title}</div>
        <p className="mb-3 text-muted">{state.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setContent(tab.id, { status: "loading" }); setAttempt((n) => n + 1); }} className="rounded bg-accent px-3 py-1 text-accentfg hover:brightness-110">Retry</button>
          {state.rawUrl && <a href={state.rawUrl} target="_blank" rel="noopener noreferrer" className="rounded border border-line px-3 py-1 text-fg hover:bg-hover">Open Raw Source</a>}
        </div>
      </Banner>
    );
  }
  if (state.status === "image") return <ImagePreview url={state.url} fallbackUrl={state.fallbackUrl} name={tab.title} />;

  const language = tab.language ?? "plaintext";

  if (mobile) {
    return (
      <div className="flex h-full flex-col">
        {isMd && (
          <div className="flex shrink-0 gap-1 border-b border-line bg-widget p-1 text-[12px]">
            {(["preview", "source"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMdMode(m)} className={`rounded px-3 py-1 capitalize ${mdMode === m ? "bg-accent text-accentfg" : "text-muted"}`}>{m}</button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1">
          {isMd && mdMode === "preview" ? <MarkdownPreview content={state.content} base={base} /> : <ShikiViewer tabId={tab.id} content={state.content} language={language} />}
        </div>
      </div>
    );
  }

  if (isMd && split) {
    return (
      <PanelGroup direction="horizontal" key={`split-${tab.id}`}>
        <Panel id="md-src" order={1} defaultSize={50} minSize={20}>
          <MonacoEditor key={tab.id} tabId={tab.id} value={state.content} language={language} />
        </Panel>
        <PanelResizeHandle className="sash-v" />
        <Panel id="md-preview" order={2} defaultSize={50} minSize={20}>
          <MarkdownPreview content={state.content} base={base} />
        </Panel>
      </PanelGroup>
    );
  }
  return <MonacoEditor key={tab.id} tabId={tab.id} value={state.content} language={language} />;
}

function Welcome() {
  const s = useWorkbench();
  const row = "flex items-center justify-between gap-8 py-1";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <Codicon name="vscode" size={110} className="opacity-10" />
      <div className="w-full max-w-xs text-[13px] text-muted">
        <div className={row}><span>Quick Open</span><kbd className="rounded bg-selected px-1.5 text-fg">Ctrl+P</kbd></div>
        <div className={row}><span>Toggle Terminal</span><kbd className="rounded bg-selected px-1.5 text-fg">Ctrl+`</kbd></div>
        <div className={row}><span>Explorer</span><kbd className="rounded bg-selected px-1.5 text-fg">Ctrl+Shift+E</kbd></div>
        <div className={row}><span>Copilot Chat</span><kbd className="rounded bg-selected px-1.5 text-fg">Ctrl+Shift+I</kbd></div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => s.openVirtual("README.md", { pin: true })} className="rounded bg-accent px-3 py-1 text-[13px] text-accentfg hover:brightness-110">Open README.md</button>
        <button type="button" onClick={() => s.setRecruiter(true)} className="rounded border border-line px-3 py-1 text-[13px] text-fg hover:bg-hover">Recruiter View</button>
      </div>
    </div>
  );
}

export function EditorArea({ mobile = false }: { mobile?: boolean }) {
  const tab = useWorkbench((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const key = tab?.id;
  return (
    <div className="flex h-full min-h-0 flex-col bg-editor">
      <TabsBar mobile={mobile} />
      {tab && !mobile && <Breadcrumbs tab={tab} />}
      <div className="relative min-h-0 flex-1">{tab ? <TabContent key={key} tab={tab} mobile={mobile} /> : <Welcome />}</div>
    </div>
  );
}
