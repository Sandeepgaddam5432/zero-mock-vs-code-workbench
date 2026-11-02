"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portfolioConfig } from "../../portfolio.config";
import { fuzzyScore } from "@/lib/search";
import { allRepos, useWorkbench } from "@/lib/store";
import { flattenTree, virtualFileNames } from "@/lib/vfs";
import { Codicon } from "./Codicon";
import { FileIcon } from "./FileIcon";

interface Item {
  id: string;
  label: string;
  detail: string;
  kind: "virtual" | "repo" | "file";
  account?: string;
  repo?: string;
  path?: string;
  size?: number;
}

export function QuickOpen() {
  const open = useWorkbench((s) => s.quickOpen);
  const setOpen = useWorkbench((s) => s.setQuickOpen);
  const manifest = useWorkbench((s) => s.manifest);
  const trees = useWorkbench((s) => s.trees);
  const loadAllTrees = useWorkbench((s) => s.loadAllTrees);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      void loadAllTrees();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, loadAllTrees]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = virtualFileNames().map((n) => ({ id: `v:${n}`, label: n, detail: portfolioConfig.profile.handle, kind: "virtual", path: n }));
    for (const r of allRepos(manifest)) {
      list.push({ id: `r:${r.account}/${r.name}`, label: r.name, detail: `repository · ${r.language ?? "repo"}`, kind: "repo", account: r.account, repo: r.name });
      const tree = trees[`${r.account}/${r.name}`];
      if (tree) for (const f of flattenTree(tree)) list.push({ id: `f:${r.account}/${r.name}/${f.path}`, label: f.name, detail: `${r.name}/${f.path}`, kind: "file", account: r.account, repo: r.name, path: f.path, size: f.size });
    }
    return list;
  }, [manifest, trees]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return items.filter((i) => i.kind !== "file").slice(0, 60);
    return items
      .map((i) => ({ i, score: Math.max(fuzzyScore(q, i.kind === "file" ? i.detail : i.label), fuzzyScore(q, i.label) * 1.5) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map((x) => x.i);
  }, [items, query]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  useEffect(() => {
    (listRef.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const choose = async (it: Item) => {
    setOpen(false);
    const st = useWorkbench.getState();
    if (it.kind === "virtual") return st.openVirtual(it.path!, { pin: true });
    const repo = allRepos(st.manifest).find((r) => r.account === it.account && r.name === it.repo);
    if (!repo) return;
    if (it.kind === "file") return st.openGithubFile(repo, it.path!, { pin: true, size: it.size });
    st.toggleExpanded(`repo:${repo.account}/${repo.name}`, true);
    const tree = await st.loadTree(repo.account, repo.name);
    const readme = tree?.find((n) => n.type === "file" && /^readme/i.test(n.name));
    if (readme) st.openGithubFile(repo, readme.path, { pin: true, size: readme.size });
    st.setActiveView("explorer");
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex justify-center bg-black/30 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div className="h-fit w-[min(600px,94vw)] overflow-hidden rounded-md border border-line bg-widget shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Quick Open">
        <div className="p-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to file or repository…"
            aria-label="Quick open"
            className="h-7 w-full rounded-sm border border-accent bg-input px-2 text-[13px] text-bright outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter" && results[sel]) void choose(results[sel]);
            }}
          />
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto pb-1">
          {results.map((it, idx) => (
            <button key={it.id} type="button" onMouseMove={() => setSel(idx)} onClick={() => void choose(it)} className={`flex h-[24px] w-full items-center gap-2 px-3 text-left text-[13px] ${idx === sel ? "bg-accent text-accentfg" : "text-fg"}`}>
              {it.kind === "repo" ? <Codicon name="repo" size={15} /> : <FileIcon name={it.label} size={15} />}
              <span className="truncate">{it.label}</span>
              <span className={`truncate text-[11px] ${idx === sel ? "opacity-80" : "text-muted"}`}>{it.detail}</span>
            </button>
          ))}
          {results.length === 0 && <div className="px-4 py-3 text-xs text-muted">No matching files or repositories</div>}
        </div>
      </div>
    </div>
  );
}
