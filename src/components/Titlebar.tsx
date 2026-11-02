"use client";

import { portfolioConfig } from "../../portfolio.config";
import { useWorkbench } from "@/lib/store";
import { Codicon } from "./Codicon";

export function Titlebar() {
  const s = useWorkbench();
  const active = s.tabs.find((t) => t.id === s.activeTabId);
  const isMd = !!active && /\.(md|mdx|markdown)$/i.test(active.path);
  const splitOn = !!active && !!s.splitPreview[active.id];

  const iconBtn = "flex h-[22px] w-7 items-center justify-center rounded text-muted hover:bg-white/10 hover:text-bright";

  return (
    <header className="relative z-30 flex h-[30px] shrink-0 select-none items-center border-b border-line bg-titlebar text-xs text-muted">
      <div className="flex w-[180px] shrink-0 items-center gap-2 pl-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Close all editors" title="Close all editors" onClick={s.closeAll} className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110" />
          <button type="button" aria-label="Toggle terminal" title="Toggle terminal (Ctrl+`)" onClick={() => s.setPanelOpen(!s.panelOpen)} className="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110" />
          <button type="button" aria-label="Toggle sidebar" title="Toggle sidebar (Ctrl+B)" onClick={() => s.setSidebarOpen(!s.sidebarOpen)} className="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110" />
        </div>
        <span className="ml-2 hidden truncate lg:inline">{portfolioConfig.profile.handle}</span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-2">
        <button
          type="button"
          onClick={() => s.setQuickOpen(true)}
          aria-label="Quick Open (Ctrl+P)"
          className="flex h-[22px] w-full max-w-[540px] items-center justify-center gap-2 rounded-md border border-line bg-black/20 px-3 text-[12px] text-muted hover:bg-black/30"
        >
          <Codicon name="search" size={13} />
          <span className="truncate">
            {portfolioConfig.profile.handle} <span className="opacity-60">· Quick Open (Ctrl+P)</span>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pr-2">
        {isMd && (
          <button type="button" title="Open Preview to the Side" aria-label="Toggle markdown split preview" aria-pressed={splitOn} onClick={() => active && s.toggleSplit(active.id)} className={`${iconBtn} ${splitOn ? "bg-white/10 text-bright" : ""}`}>
            <Codicon name="open-preview" size={15} />
          </button>
        )}
        <button type="button" title="Toggle Primary Sidebar (Ctrl+B)" aria-label="Toggle sidebar" onClick={() => s.setSidebarOpen(!s.sidebarOpen)} className={iconBtn}>
          <Codicon name="layout-sidebar-left" size={15} />
        </button>
        <button type="button" title="Toggle Panel (Ctrl+`)" aria-label="Toggle panel" onClick={() => s.setPanelOpen(!s.panelOpen)} className={iconBtn}>
          <Codicon name="layout-panel" size={15} />
        </button>
        <button
          type="button"
          onClick={() => s.setRecruiter(true)}
          className="ml-1 flex h-[22px] items-center gap-1.5 rounded px-2 text-[11px] font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <Codicon name="person" size={13} />
          <span className="hidden md:inline">Switch to Recruiter View</span>
          <span className="md:hidden">Recruiter</span>
        </button>
      </div>
    </header>
  );
}
