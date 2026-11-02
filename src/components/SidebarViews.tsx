"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portfolioConfig } from "../../portfolio.config";
import { getSearchIndex, snippet, type SearchDoc } from "@/lib/search";
import { allRepos, findRepo, orderedRepos, useWorkbench } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import { findNode } from "@/lib/vfs";
import { Codicon } from "./Codicon";
import { FileIcon } from "./FileIcon";
import { Section } from "./Explorer";

/* ------------------------------- Search --------------------------------- */

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(SearchDoc & { score: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const manifest = useWorkbench((s) => s.manifest);
  const s = useWorkbench.getState;

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      const { index, docs } = await getSearchIndex();
      if (cancelled) return;
      const hits = index.search(q).slice(0, 80);
      setResults(hits.map((h) => ({ ...(docs.get(h.id) as SearchDoc), score: h.score })).filter((d) => d.id));
      setBusy(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const openResult = async (d: SearchDoc) => {
    const st = s();
    if (d.kind === "virtual") return st.openVirtual(d.path, { pin: true });
    const repo = findRepo(st.manifest, d.account, d.repo);
    if (!repo) return;
    if (d.kind === "file") return st.openGithubFile(repo, d.path, { pin: true, size: d.size });
    const tree = await st.loadTree(repo.account, repo.name);
    const readme = tree?.find((n) => n.type === "file" && /^readme/i.test(n.name));
    st.toggleExpanded(`repo:${repo.account}/${repo.name}`, true);
    if (readme) st.openGithubFile(repo, readme.path, { pin: true, size: findNode(tree!, readme.path)?.size });
  };

  const groups = useMemo(() => {
    const g: Record<string, (SearchDoc & { score: number })[]> = { repo: [], file: [], virtual: [] };
    results.forEach((r) => g[r.kind]?.push(r));
    return g;
  }, [results]);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pb-2">
        <div className="flex items-center rounded-sm border border-transparent bg-input px-2 focus-within:border-accent">
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repos, READMEs, files…" aria-label="Search" className="h-[26px] min-w-0 flex-1 bg-transparent text-[13px] text-bright outline-none placeholder:text-muted" />
          {query && (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="text-muted hover:text-bright">
              <Codicon name="close" size={14} />
            </button>
          )}
        </div>
        <div className="mt-1.5 text-[11px] text-muted">{busy ? "Indexing & searching…" : query ? `${results.length} result${results.length === 1 ? "" : "s"} · MiniSearch index of ${allRepos(manifest).length} repos` : "Client-side full-text index over manifests, file trees and READMEs."}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {(
          [
            ["repo", "Repositories"],
            ["file", "Files"],
            ["virtual", "Portfolio"],
          ] as const
        ).map(([k, label]) =>
          groups[k].length ? (
            <div key={k}>
              <div className="px-3 py-1 text-[11px] font-bold uppercase text-bright">
                {label} <span className="font-normal text-muted">({groups[k].length})</span>
              </div>
              {groups[k].slice(0, 40).map((d) => (
                <button key={d.id} type="button" onClick={() => openResult(d)} className="block w-full px-3 py-1 text-left hover:bg-hover">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    {d.kind === "repo" ? <Codicon name="repo" size={14} className="text-[#75beff]" /> : <FileIcon name={d.title} size={14} />}
                    <span className="truncate text-bright">{d.title}</span>
                    {d.kind !== "virtual" && <span className="truncate text-[11px] text-muted">{d.kind === "file" ? `${d.repo}/${d.path.split("/").slice(0, -1).join("/")}` : d.account}</span>}
                  </div>
                  {d.kind !== "file" && <div className="mt-0.5 line-clamp-2 pl-5 text-[11px] text-muted">{snippet((docsText(d) ?? ""), query)}</div>}
                </button>
              ))}
            </div>
          ) : null,
        )}
        {query && !busy && results.length === 0 && <div className="px-4 py-3 text-xs text-muted">No results for “{query}”.</div>}
      </div>
    </div>
  );
}

// text is not in storeFields; look it up lazily from the live docs map
function docsText(d: SearchDoc): string | undefined {
  return d.text ?? "";
}

/* ---------------------------- Source control ---------------------------- */

export function SourceControlView() {
  const manifest = useWorkbench((s) => s.manifest);
  const openRepo = async (account: string, name: string) => {
    const st = useWorkbench.getState();
    const repo = findRepo(st.manifest, account, name);
    if (!repo) return;
    st.toggleExpanded(`repo:${account}/${name}`, true);
    const tree = await st.loadTree(account, name);
    const readme = tree?.find((n) => n.type === "file" && /^readme/i.test(n.name));
    if (readme) st.openGithubFile(repo, readme.path, { pin: true, size: readme.size });
  };
  return (
    <div className="flex h-full flex-col overflow-y-auto pb-4">
      <Section id="git:changes" title="Changes" count={0}>
        <div className="px-4 py-2 text-xs text-muted">The working tree is clean. Every repository is pinned to an immutable commit SHA.</div>
      </Section>
      {manifest?.accounts.map((a) => (
        <Section key={a.login} id={`git:${a.login}`} title={`Repositories · ${a.login}`} count={a.repos.length}>
          {orderedRepos(a.repos).map((r) => (
            <div key={r.name} className="group flex items-center gap-2 px-4 py-1 hover:bg-hover">
              <button type="button" onClick={() => openRepo(r.account, r.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={`Open ${r.name} README`}>
                <Codicon name="git-branch" size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-bright">{r.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {r.branch} · <code>{r.commitSha.slice(0, 7)}</code> · {r.pushedAt ? new Date(r.pushedAt).toLocaleDateString() : "n/a"}
                  </span>
                </span>
              </button>
              <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.name} on GitHub`} className="hidden text-muted hover:text-bright group-hover:block">
                <Codicon name="link-external" size={14} />
              </a>
            </div>
          ))}
        </Section>
      ))}
    </div>
  );
}

/* ------------------------------ Extensions ------------------------------ */

const LANG_COLORS: Record<string, string> = { TypeScript: "#3178c6", JavaScript: "#e5c100", Python: "#4b8bbe", Go: "#00add8", Rust: "#dea584", HTML: "#e44d26", CSS: "#42a5f5", Shell: "#89e051", Java: "#e76f00", Kotlin: "#a97bff", Dockerfile: "#2496ed" };

export function ExtensionsView() {
  const manifest = useWorkbench((s) => s.manifest);
  const langs = useMemo(() => {
    const m = new Map<string, number>();
    allRepos(manifest).forEach((r) => r.language && m.set(r.language, (m.get(r.language) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [manifest]);
  return (
    <div className="flex h-full flex-col overflow-y-auto pb-4">
      <Section id="ext:installed" title="Installed · Skills" count={Object.values(portfolioConfig.skills).flat().length}>
        {Object.entries(portfolioConfig.skills).map(([cat, list]) => (
          <div key={cat} className="px-3 py-1.5">
            <div className="mb-1 text-[11px] uppercase text-muted">{cat}</div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((sk) => (
                <span key={sk} className="flex items-center gap-1 rounded-sm bg-selected px-2 py-0.5 text-[12px] text-bright">
                  <Codicon name="extensions" size={12} className="text-accent" /> {sk}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section id="ext:languages" title="Language usage" count={langs.length}>
        {langs.length === 0 && <div className="px-4 py-2 text-xs text-muted">Language data appears after the GitHub sync.</div>}
        {langs.map(([l, n]) => (
          <div key={l} className="flex items-center gap-2 px-4 py-1">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LANG_COLORS[l] ?? "#9a9a9a" }} />
            <span className="flex-1 truncate text-[13px] text-bright">{l}</span>
            <span className="text-[11px] text-muted">
              {n} repo{n > 1 ? "s" : ""}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

/* -------------------------------- Settings ------------------------------- */

export function SettingsView() {
  const s = useWorkbench();
  const label = "mb-1 block text-[11px] font-bold uppercase text-muted";
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-[13px]">
      <div>
        <label className={label} htmlFor="theme-select">
          Color Theme
        </label>
        <select id="theme-select" value={s.theme} onChange={(e) => s.setTheme(e.target.value)} className="h-7 w-full rounded-sm border border-line bg-input px-1 text-bright outline-none focus:border-accent">
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="font-size">
          Editor Font Size ({s.fontSize}px)
        </label>
        <input id="font-size" type="range" min={11} max={20} value={s.fontSize} onChange={(e) => s.setFontSize(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      </div>
      {(
        [
          ["Word Wrap", s.wordWrap, s.setWordWrap],
          ["Minimap", s.minimap, s.setMinimap],
        ] as const
      ).map(([name, value, set]) => (
        <label key={name} className="flex cursor-pointer items-center justify-between">
          <span className="text-bright">Editor: {name}</span>
          <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        </label>
      ))}
      <div className="rounded-sm border border-line p-2 text-[12px] text-muted">
        <Codicon name="info" size={13} className="mr-1 align-middle" />
        Copilot provider &amp; API key settings live in the Copilot Chat panel (⚙). Keys stay in your browser and are never sent to any server except the provider you choose.
      </div>
      <div className="text-[11px] text-muted">
        <div>Shortcuts</div>
        <ul className="mt-1 space-y-0.5">
          {[
            ["Ctrl+P", "Quick Open"],
            ["Ctrl+B", "Toggle sidebar"],
            ["Ctrl+`", "Toggle terminal"],
            ["Ctrl+Shift+E/F/G/X/I", "Switch view"],
            ["Ctrl+W", "Close tab"],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span>{v}</span>
              <kbd className="rounded bg-selected px-1 text-bright">{k}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
