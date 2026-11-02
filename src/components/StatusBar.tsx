"use client";

import { portfolioConfig } from "../../portfolio.config";
import { THEMES } from "@/lib/themes";
import { findRepo, useWorkbench } from "@/lib/store";
import { Codicon } from "./Codicon";

export function StatusBar() {
  const s = useWorkbench();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  const repo = tab?.kind === "github" && tab.account && tab.repo ? findRepo(s.manifest, tab.account, tab.repo) : undefined;
  const branch = repo?.branch ?? "main";
  const item = "flex h-full items-center gap-1 px-2 hover:bg-white/15";
  const lang = tab?.language ?? "plaintext";

  return (
    <footer className="flex h-[22px] shrink-0 select-none items-center justify-between bg-statusbar text-[12px] text-statusfg">
      <div className="flex h-full items-center">
        <span className="flex h-full items-center bg-black/20 px-2" title="Remote: Portfolio workbench">
          <Codicon name="remote" size={14} />
        </span>
        <button type="button" className={item} title={repo ? `${repo.account}/${repo.name} @ ${repo.commitSha.slice(0, 7)}` : "Branch"} onClick={() => s.setActiveView("git")}>
          <Codicon name="git-branch" size={13} />
          {branch}
          {repo && <span className="opacity-70">@{repo.commitSha.slice(0, 7)}</span>}
        </button>
        <span className={item} title="No problems">
          <Codicon name="error" size={13} /> 0 <Codicon name="warning" size={13} className="ml-1" /> 0
        </span>
      </div>
      <div className="flex h-full items-center">
        <button type="button" className={`${item} font-medium`} title="Click to open contact.env" onClick={() => s.openVirtual("contact.env", { pin: true })}>
          <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80] shadow-[0_0_6px_#4ade80]" />
          {portfolioConfig.profile.status}
        </button>
        {tab && (
          <span className={item} title="Go to Line/Column">
            Ln {s.cursor.line}, Col {s.cursor.col}
          </span>
        )}
        <span className={`${item} hidden sm:flex`}>Spaces: 2</span>
        <span className={`${item} hidden sm:flex`}>UTF-8</span>
        <span className={`${item} hidden md:flex`}>{lang === "plaintext" ? "Plain Text" : lang.charAt(0).toUpperCase() + lang.slice(1)}</span>
        <span className={`${item} hidden sm:flex`} title="Prettier: formatted">
          <Codicon name="check" size={13} /> Prettier
        </span>
        <button type="button" className={`${item} hidden md:flex`} title="Select Color Theme" onClick={() => s.setActiveView("settings")}>
          {THEMES.find((t) => t.id === s.theme)?.label.split(" ")[0]}
        </button>
        <span className={item}>
          <Codicon name="bell" size={13} />
        </span>
      </div>
    </footer>
  );
}
