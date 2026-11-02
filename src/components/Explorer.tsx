"use client";

import { useEffect, type ReactNode } from "react";
import { portfolioConfig } from "../../portfolio.config";
import { orderedRepos, useWorkbench } from "@/lib/store";
import type { RepoMeta, TreeNode } from "@/lib/types";
import { githubTabId, virtualFileNames } from "@/lib/vfs";
import { Codicon } from "./Codicon";
import { FileIcon, FolderIcon } from "./FileIcon";

const ROW = "flex h-[22px] w-full cursor-pointer items-center gap-1 pr-2 text-left text-[13px] leading-[22px] hover:bg-hover";

export function Chevron({ open }: { open: boolean }) {
  return <Codicon name="chevron-right" size={16} className="shrink-0 transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />;
}

export function Section({ id, title, count, children, actions }: { id: string; title: string; count?: number; children: ReactNode; actions?: ReactNode }) {
  const open = useWorkbench((s) => !!s.expanded[id]);
  const toggle = useWorkbench((s) => s.toggleExpanded);
  return (
    <section>
      <div className="group flex h-[22px] items-center border-y border-transparent bg-white/[0.03] hover:bg-white/[0.06]">
        <button type="button" aria-expanded={open} onClick={() => toggle(id)} className="flex h-full min-w-0 flex-1 items-center gap-0.5 pl-0.5 text-[11px] font-bold uppercase tracking-wide text-bright">
          <Chevron open={open} />
          <span className="truncate">{title}</span>
          {count !== undefined && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-medium text-accentfg">{count}</span>}
        </button>
        {actions}
      </div>
      {open && <div>{children}</div>}
    </section>
  );
}

function FileRow({ repo, node, depth }: { repo: RepoMeta; node: TreeNode; depth: number }) {
  const active = useWorkbench((s) => s.activeTabId === githubTabId(repo.account, repo.name, node.path));
  const open = useWorkbench((s) => s.openGithubFile);
  return (
    <button
      type="button"
      className={`${ROW} ${active ? "!bg-selected text-bright" : ""}`}
      style={{ paddingLeft: 8 + depth * 8 + 16 }}
      title={`${node.path} · ${node.size ?? 0} bytes`}
      onClick={() => open(repo, node.path, { size: node.size })}
      onDoubleClick={() => open(repo, node.path, { size: node.size, pin: true })}
    >
      <FileIcon name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function DirRow({ repo, node, depth }: { repo: RepoMeta; node: TreeNode; depth: number }) {
  const key = `dir:${repo.account}/${repo.name}/${node.path}`;
  const open = useWorkbench((s) => !!s.expanded[key]);
  const toggle = useWorkbench((s) => s.toggleExpanded);
  return (
    <>
      <button type="button" className={ROW} style={{ paddingLeft: 8 + depth * 8 }} aria-expanded={open} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <FolderIcon open={open} />
        <span className="truncate">{node.name}</span>
      </button>
      {open && <Nodes repo={repo} nodes={node.children ?? []} depth={depth + 1} />}
    </>
  );
}

function Nodes({ repo, nodes, depth }: { repo: RepoMeta; nodes: TreeNode[]; depth: number }) {
  return (
    <>
      {nodes.map((n) => (n.type === "dir" ? <DirRow key={n.path} repo={repo} node={n} depth={depth} /> : <FileRow key={n.path} repo={repo} node={n} depth={depth} />))}
    </>
  );
}

function RepoRow({ repo }: { repo: RepoMeta }) {
  const key = `repo:${repo.account}/${repo.name}`;
  const open = useWorkbench((s) => !!s.expanded[key]);
  const toggle = useWorkbench((s) => s.toggleExpanded);
  const loadTree = useWorkbench((s) => s.loadTree);
  const tree = useWorkbench((s) => s.trees[`${repo.account}/${repo.name}`]);
  const err = useWorkbench((s) => s.treeErrors[`${repo.account}/${repo.name}`]);
  useEffect(() => {
    if (open) void loadTree(repo.account, repo.name);
  }, [open, loadTree, repo.account, repo.name]);
  const pinned = portfolioConfig.pinnedRepos.some((p) => p.toLowerCase() === repo.name.toLowerCase() || p.toLowerCase() === `${repo.account}/${repo.name}`.toLowerCase());
  return (
    <div>
      <button type="button" className={ROW} style={{ paddingLeft: 8 }} aria-expanded={open} title={repo.description ?? repo.name} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <Codicon name="repo" size={16} className="shrink-0 text-[#75beff]" />
        <span className="truncate">{repo.name}</span>
        {pinned && <Codicon name="pinned" size={12} className="shrink-0 text-muted" />}
        {repo.language && <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted">{repo.language}</span>}
      </button>
      {open && (
        <div>
          {!tree && !err && <div className="h-[22px] pl-10 text-xs leading-[22px] text-muted">Loading…</div>}
          {err && <div className="pl-10 text-xs leading-[22px] text-[#f48771]">Failed to load tree ({err})</div>}
          {tree && tree.length === 0 && <div className="pl-10 text-xs leading-[22px] text-muted">(empty)</div>}
          {tree && <Nodes repo={repo} nodes={tree} depth={1} />}
        </div>
      )}
    </div>
  );
}

export function Explorer() {
  const manifest = useWorkbench((s) => s.manifest);
  const activeTabId = useWorkbench((s) => s.activeTabId);
  const openVirtual = useWorkbench((s) => s.openVirtual);
  // collapse every repo/folder but keep the top-level sections open
  const collapseAll = () =>
    useWorkbench.setState((s) => ({ expanded: Object.fromEntries(Object.entries(s.expanded).filter(([k]) => k.startsWith("section:"))) }));

  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden pb-4">
      <Section
        id="section:portfolio"
        title={`${portfolioConfig.profile.handle} · portfolio`}
        actions={
          <button type="button" title="Collapse all folders" aria-label="Collapse all" className="mr-1 hidden h-5 w-5 items-center justify-center text-muted hover:text-bright group-hover:flex" onClick={collapseAll}>
            <Codicon name="collapse-all" size={14} />
          </button>
        }
      >
        {virtualFileNames().map((name) => (
          <button
            key={name}
            type="button"
            className={`${ROW} ${activeTabId === `virtual:${name}` ? "!bg-selected text-bright" : ""}`}
            style={{ paddingLeft: 8 + 16 }}
            onClick={() => openVirtual(name)}
            onDoubleClick={() => openVirtual(name, { pin: true })}
          >
            <FileIcon name={name} />
            <span className="truncate">{name}</span>
          </button>
        ))}
      </Section>

      {!manifest && <div className="px-4 py-3 text-xs text-muted">Loading repositories…</div>}
      {manifest?.accounts.map((a) => (
        <Section key={a.login} id={`section:${a.login}`} title={`GitHub: ${a.login}`} count={a.repos.length}>
          {a.repos.length === 0 && <div className="px-6 py-2 text-xs text-muted">No public repositories in the manifest. Run <code>npm run sync</code>.</div>}
          {orderedRepos(a.repos).map((r) => (
            <RepoRow key={r.name} repo={r} />
          ))}
        </Section>
      ))}
    </div>
  );
}
