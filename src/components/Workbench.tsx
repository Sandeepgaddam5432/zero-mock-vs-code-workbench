"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { portfolioConfig } from "../../portfolio.config";
import { useWorkbench } from "@/lib/store";
import { terminalBus } from "@/lib/terminal";
import { ActivityBar } from "./ActivityBar";
import { Codicon } from "./Codicon";
import { CopilotView } from "./CopilotView";
import { EditorArea } from "./EditorArea";
import { Explorer } from "./Explorer";
import { SearchView } from "./SidebarViews";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Titlebar } from "./Titlebar";

// xterm needs the DOM/canvas: client-only dynamic import (no SSR => no hydration mismatch)
const TerminalPanel = dynamic(() => import("./TerminalPanel"), {
  ssr: false,
  loading: () => <div className="p-3 text-xs text-muted">Starting terminal…</div>,
});

/* ------------------------------- Desktop -------------------------------- */

export function DesktopWorkbench() {
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const panelRef = useRef<ImperativePanelHandle>(null);
  const sidebarOpen = useWorkbench((s) => s.sidebarOpen);
  const panelOpen = useWorkbench((s) => s.panelOpen);
  const activeView = useWorkbench((s) => s.activeView);
  const setSidebarOpen = useWorkbench((s) => s.setSidebarOpen);
  const setPanelOpen = useWorkbench((s) => s.setPanelOpen);

  useEffect(() => {
    const p = sidebarRef.current;
    if (!p) return;
    if (sidebarOpen) p.expand();
    else p.collapse();
  }, [sidebarOpen]);

  useEffect(() => {
    const p = panelRef.current;
    if (!p) return;
    if (panelOpen) p.expand();
    else p.collapse();
  }, [panelOpen]);

  useEffect(() => {
    if (activeView === "copilot" && sidebarOpen) {
      const p = sidebarRef.current;
      if (p && p.getSize() < 26) p.resize(30);
    }
  }, [activeView, sidebarOpen]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-editor text-fg">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <PanelGroup direction="horizontal" className="min-w-0 flex-1" autoSaveId="wb-main">
          <Panel ref={sidebarRef} id="sidebar" order={1} defaultSize={22} minSize={12} maxSize={50} collapsible collapsedSize={0} onCollapse={() => setSidebarOpen(false)} onExpand={() => setSidebarOpen(true)} className="border-r border-line">
            <Sidebar />
          </Panel>
          <PanelResizeHandle className="sash-v" />
          <Panel id="main" order={2} minSize={30}>
            <PanelGroup direction="vertical" autoSaveId="wb-editor">
              <Panel id="editor" order={1} minSize={20}>
                <EditorArea />
              </Panel>
              <PanelResizeHandle className="sash-h" />
              <Panel ref={panelRef} id="terminal" order={2} defaultSize={30} minSize={10} maxSize={80} collapsible collapsedSize={0} onCollapse={() => setPanelOpen(false)} onExpand={() => setPanelOpen(true)} className="border-t border-line">
                <TerminalShell />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
      <StatusBar />
    </div>
  );
}

function TerminalShell() {
  const setPanelOpen = useWorkbench((s) => s.setPanelOpen);
  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex h-[35px] shrink-0 items-center justify-between px-3 text-[11px] uppercase text-muted">
        <div className="flex gap-4">
          <span className="border-b border-bright py-1 text-bright" style={{ borderColor: "var(--accent)" }}>
            Terminal
          </span>
        </div>
        <div className="flex gap-1">
          <button type="button" title="Clear terminal" aria-label="Clear terminal" onClick={() => terminalBus.run?.("clear")} className="rounded p-1 hover:bg-hover hover:text-bright">
            <Codicon name="clear-all" size={15} />
          </button>
          <button type="button" title="Close panel" aria-label="Close terminal panel" onClick={() => setPanelOpen(false)} className="rounded p-1 hover:bg-hover hover:text-bright">
            <Codicon name="close" size={15} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <TerminalPanel />
      </div>
    </div>
  );
}

/* -------------------------------- Mobile -------------------------------- */

const CHIPS = ["ls", "cat README.md", "resume", "neofetch", "help", "clear"];

export function MobileWorkbench() {
  const mobileTab = useWorkbench((s) => s.mobileTab);
  const drawerOpen = useWorkbench((s) => s.drawerOpen);
  const setMobileTab = useWorkbench((s) => s.setMobileTab);
  const setDrawerOpen = useWorkbench((s) => s.setDrawerOpen);
  const setRecruiter = useWorkbench((s) => s.setRecruiter);
  const [terminalMounted, setTerminalMounted] = useState(false);

  useEffect(() => {
    if (mobileTab === "terminal") setTerminalMounted(true);
  }, [mobileTab]);

  const navBtn = (active: boolean) => `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${active ? "text-bright" : "text-white/55"}`;

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-editor text-fg">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-titlebar px-3">
        <button type="button" aria-label="Open explorer" onClick={() => setDrawerOpen(true)} className="rounded p-1.5 text-fg hover:bg-white/10">
          <Codicon name="menu" size={20} />
        </button>
        <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-bright">{portfolioConfig.profile.name}</div>
        <button type="button" onClick={() => setRecruiter(true)} className="rounded px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
          Recruiter View
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        {/* Shiki read-only viewer is used inside EditorArea on mobile - Monaco is never loaded here */}
        <div className={mobileTab === "editor" ? "h-full" : "hidden"}>
          <EditorArea mobile />
        </div>
        {mobileTab === "search" && (
          <div className="h-full bg-sidebar">
            <SearchView />
          </div>
        )}
        {mobileTab === "copilot" && (
          <div className="h-full bg-sidebar">
            <CopilotView />
          </div>
        )}
        {terminalMounted && (
          <div className={mobileTab === "terminal" ? "flex h-full flex-col bg-panel" : "hidden"}>
            <div className="min-h-0 flex-1">
              <TerminalPanel />
            </div>
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-line bg-sidebar px-2 py-1.5" aria-label="Terminal quick commands">
              {CHIPS.map((c) => (
                <button key={c} type="button" onClick={() => terminalBus.run?.(c)} className="shrink-0 rounded-full border border-line bg-input px-3 py-1.5 font-mono text-[12px] text-bright active:bg-accent">
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav aria-label="App navigation" className="mobile-safe-bottom flex shrink-0 border-t border-black/30 bg-activity">
        <button type="button" onClick={() => setDrawerOpen(true)} className={navBtn(drawerOpen)}>
          <Codicon name="files" size={22} /> Files
        </button>
        <button type="button" onClick={() => setMobileTab("search")} className={navBtn(mobileTab === "search")}>
          <Codicon name="search" size={22} /> Search
        </button>
        <button type="button" onClick={() => setMobileTab("terminal")} className={navBtn(mobileTab === "terminal")}>
          <Codicon name="terminal" size={22} /> Terminal
        </button>
        <button type="button" onClick={() => setMobileTab("copilot")} className={navBtn(mobileTab === "copilot")}>
          <Codicon name="copilot" size={22} /> Copilot
        </button>
        <button type="button" onClick={() => setRecruiter(true)} className={navBtn(false)}>
          <Codicon name="person" size={22} /> Recruiter
        </button>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-label="Explorer drawer">
          <aside className="drawer-in flex h-full w-[85%] max-w-[340px] flex-col bg-sidebar shadow-2xl">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4 text-[11px] uppercase tracking-wide text-muted">
              Explorer
              <button type="button" aria-label="Close explorer" onClick={() => setDrawerOpen(false)} className="rounded p-1 hover:bg-hover">
                <Codicon name="close" size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Explorer />
            </div>
          </aside>
          <button type="button" aria-label="Dismiss drawer" className="fade-in flex-1 bg-black/50" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </div>
  );
}
