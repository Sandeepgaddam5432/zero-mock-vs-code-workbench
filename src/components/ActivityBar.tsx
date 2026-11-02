"use client";

import { useWorkbench } from "@/lib/store";
import type { SidebarView } from "@/lib/types";
import { Codicon } from "./Codicon";

export const ACTIVITY_ITEMS: { id: SidebarView; icon: string; label: string; shortcut: string }[] = [
  { id: "explorer", icon: "files", label: "Explorer", shortcut: "Ctrl+Shift+E" },
  { id: "search", icon: "search", label: "Search", shortcut: "Ctrl+Shift+F" },
  { id: "git", icon: "source-control", label: "Source Control", shortcut: "Ctrl+Shift+G" },
  { id: "extensions", icon: "extensions", label: "Extensions", shortcut: "Ctrl+Shift+X" },
  { id: "copilot", icon: "copilot", label: "Copilot Chat", shortcut: "Ctrl+Shift+I" },
];

function Item({ id, icon, label, shortcut }: { id: SidebarView; icon: string; label: string; shortcut?: string }) {
  const active = useWorkbench((s) => s.activeView === id && s.sidebarOpen);
  const toggleView = useWorkbench((s) => s.toggleView);
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      onClick={() => toggleView(id)}
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center border-l-2 transition-colors ${
        active ? "border-white/90 text-white" : "border-transparent text-white/50 hover:text-white"
      }`}
      style={active ? { borderLeftColor: "var(--accent-fg)" } : undefined}
    >
      <Codicon name={icon} size={24} />
    </button>
  );
}

export function ActivityBar() {
  const profileUrl = useWorkbench((s) => s.manifest?.accounts[0]?.htmlUrl) ?? "https://github.com";
  return (
    <nav aria-label="Activity Bar" className="flex w-12 shrink-0 flex-col justify-between bg-activity">
      <div className="flex flex-col">
        {ACTIVITY_ITEMS.map((i) => (
          <Item key={i.id} {...i} />
        ))}
      </div>
      <div className="flex flex-col">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub profile"
          aria-label="GitHub profile"
          className="flex h-12 w-12 items-center justify-center border-l-2 border-transparent text-white/50 hover:text-white"
        >
          <Codicon name="account" size={24} />
        </a>
        <Item id="settings" icon="settings-gear" label="Settings" />
      </div>
    </nav>
  );
}
