"use client";

import { useWorkbench } from "@/lib/store";
import type { SidebarView } from "@/lib/types";
import { CopilotView } from "./CopilotView";
import { Explorer } from "./Explorer";
import { ExtensionsView, SearchView, SettingsView, SourceControlView } from "./SidebarViews";

const TITLES: Record<SidebarView, string> = {
  explorer: "Explorer",
  search: "Search",
  git: "Source Control",
  extensions: "Extensions",
  copilot: "Copilot Chat",
  settings: "Settings",
};

export function SidebarContent({ view }: { view: SidebarView }) {
  switch (view) {
    case "explorer":
      return <Explorer />;
    case "search":
      return <SearchView />;
    case "git":
      return <SourceControlView />;
    case "extensions":
      return <ExtensionsView />;
    case "copilot":
      return <CopilotView />;
    case "settings":
      return <SettingsView />;
  }
}

export function Sidebar() {
  const view = useWorkbench((s) => s.activeView);
  return (
    <aside aria-label={TITLES[view]} className="flex h-full min-w-0 flex-col overflow-hidden bg-sidebar">
      <div className="flex h-[35px] shrink-0 items-center px-5 text-[11px] font-normal uppercase tracking-wide text-muted">{TITLES[view]}</div>
      <div className="min-h-0 flex-1">
        <SidebarContent view={view} />
      </div>
    </aside>
  );
}
