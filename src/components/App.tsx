"use client";

import { useEffect } from "react";
import { applyHash, buildHash } from "@/lib/deeplink";
import { useWorkbench } from "@/lib/store";
import { applyThemeVars, getTheme } from "@/lib/themes";
import { QuickOpen } from "./QuickOpen";
import { RecruiterView } from "./RecruiterView";
import { DesktopWorkbench, MobileWorkbench } from "./Workbench";
import { Codicon } from "./Codicon";

// Captured at module load so the deep link survives React strict-mode double effects.
const initialHash = typeof window === "undefined" ? "" : window.location.hash;
let bootPromise: Promise<void> | null = null;

function boot(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const st = useWorkbench.getState();
      try {
        const theme = localStorage.getItem("workbench:theme");
        const wordWrap = localStorage.getItem("workbench:wordWrap");
        const minimap = localStorage.getItem("workbench:minimap");
        const fontSize = Number(localStorage.getItem("workbench:fontSize"));
        useWorkbench.setState({
          ...(theme ? { theme } : {}),
          ...(wordWrap !== null ? { wordWrap: wordWrap === "true" } : {}),
          ...(minimap !== null ? { minimap: minimap === "true" } : {}),
          ...(fontSize >= 10 && fontSize <= 24 ? { fontSize } : {}),
        });
      } catch {
        /* storage unavailable */
      }
      await st.loadManifest();
      const handled = initialHash ? await applyHash(initialHash) : false;
      if (!handled && useWorkbench.getState().tabs.length === 0) useWorkbench.getState().openVirtual("README.md", { pin: true });
    })();
  }
  return bootPromise;
}

function Toasts() {
  const toasts = useWorkbench((s) => s.toasts);
  const dismiss = useWorkbench((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-14 right-3 z-[60] flex flex-col gap-2 md:bottom-8" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" onClick={() => dismiss(t.id)} className="fade-in pointer-events-auto flex max-w-xs items-center gap-2 rounded border border-line bg-widget px-3 py-2 text-left text-[12px] text-bright shadow-xl">
          <Codicon name="info" size={14} className="shrink-0 text-accent" /> {t.text}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const viewport = useWorkbench((s) => s.viewport);
  const recruiter = useWorkbench((s) => s.recruiter);
  const theme = useWorkbench((s) => s.theme);
  const booted = useWorkbench((s) => s.manifest !== null);
  const activeTab = useWorkbench((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const setViewport = useWorkbench((s) => s.setViewport);

  // viewport detection (mobile < 768px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setViewport(mq.matches ? "mobile" : "desktop");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setViewport]);

  // data + settings + deep-link boot
  useEffect(() => {
    void boot();
    const onHash = () => void applyHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // theme
  useEffect(() => {
    applyThemeVars(getTheme(theme));
  }, [theme]);

  // keep the URL hash in sync with the active tab (shareable deep links)
  useEffect(() => {
    if (!booted) return;
    const hash = recruiter ? "#/recruiter" : buildHash(activeTab);
    if (hash && window.location.hash !== hash) history.replaceState(null, "", hash);
    else if (!hash && window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [booted, recruiter, activeTab]);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const st = useWorkbench.getState();
      const k = e.key.toLowerCase();
      const go = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (!e.shiftKey && !e.altKey && k === "p") return go(() => st.setQuickOpen(true));
      if (!e.shiftKey && k === "b") return go(() => st.setSidebarOpen(!st.sidebarOpen));
      if (!e.shiftKey && (k === "`" || k === "j")) return go(() => st.setPanelOpen(!st.panelOpen));
      if (!e.shiftKey && k === "w" && st.activeTabId) return go(() => st.closeTab(st.activeTabId!));
      if (e.shiftKey) {
        const map: Record<string, "explorer" | "search" | "git" | "extensions" | "copilot"> = { e: "explorer", f: "search", g: "git", x: "extensions", i: "copilot" };
        const view = map[k];
        if (view) return go(() => (st.viewport === "mobile" ? (view === "explorer" ? st.setDrawerOpen(true) : st.setMobileTab(view === "search" ? "search" : "copilot")) : st.toggleView(view)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (viewport === "unknown") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-editor text-muted" aria-busy="true">
        <Codicon name="vscode" size={56} className="opacity-30" />
        <span className="text-xs">Opening workspace…</span>
      </div>
    );
  }

  return (
    <>
      {viewport === "mobile" ? <MobileWorkbench /> : <DesktopWorkbench />}
      {recruiter && <RecruiterView />}
      <QuickOpen />
      <Toasts />
    </>
  );
}
