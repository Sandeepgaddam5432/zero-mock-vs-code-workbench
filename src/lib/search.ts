import MiniSearch from "minisearch";
import { portfolioConfig } from "../../portfolio.config";
import { useWorkbench } from "./store";
import type { Manifest } from "./types";
import { flattenTree, virtualFiles } from "./vfs";

export interface SearchDoc {
  id: string;
  kind: "virtual" | "repo" | "file";
  title: string;
  path: string;
  account: string;
  repo: string;
  text: string;
  size?: number;
}

let index: MiniSearch<SearchDoc> | null = null;
let docs = new Map<string, SearchDoc>();
let builtFor = "";

/** Fuzzy subsequence scoring for Quick Open (filenames/paths). */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  let ti = 0;
  let score = 0;
  let streak = 0;
  const base = t.lastIndexOf("/") + 1;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found < 0) return 0;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (found >= base ? 2 : 0) + (found === 0 || "/-_. ".includes(t[found - 1]) ? 3 : 0);
    ti = found + 1;
  }
  return score - t.length * 0.02;
}

export async function getSearchIndex(): Promise<{ index: MiniSearch<SearchDoc>; docs: Map<string, SearchDoc> }> {
  await useWorkbench.getState().loadAllTrees();
  const { manifest, trees } = useWorkbench.getState();
  const signature = `${manifest?.generatedAt}:${Object.keys(trees).length}`;
  if (index && builtFor === signature) return { index, docs };
  index = buildIndex(manifest, trees);
  builtFor = signature;
  return { index, docs };
}

export function buildIndex(manifest: Manifest | null, trees: Record<string, import("./types").TreeNode[]>): MiniSearch<SearchDoc> {
  const list: SearchDoc[] = [];
  for (const [name, content] of Object.entries(virtualFiles)) {
    list.push({ id: `virtual:${name}`, kind: "virtual", title: name, path: name, account: "~", repo: "~", text: content });
  }
  list.push({
    id: "profile",
    kind: "virtual",
    title: "README.md",
    path: "README.md",
    account: "~",
    repo: "~",
    text: `${portfolioConfig.profile.name} ${portfolioConfig.profile.role} ${portfolioConfig.profile.bio.join(" ")}`,
  });
  for (const a of manifest?.accounts ?? []) {
    for (const r of a.repos) {
      list.push({
        id: `repo:${a.login}/${r.name}`,
        kind: "repo",
        title: r.name,
        path: "",
        account: a.login,
        repo: r.name,
        text: `${r.description ?? ""} ${r.language ?? ""} ${r.topics.join(" ")} ${r.readme}`,
      });
      const tree = trees[`${a.login}/${r.name}`];
      if (tree) {
        for (const f of flattenTree(tree)) {
          list.push({ id: `file:${a.login}/${r.name}/${f.path}`, kind: "file", title: f.name, path: f.path, account: a.login, repo: r.name, text: f.path.replace(/[/._-]/g, " "), size: f.size });
        }
      }
    }
  }
  docs = new Map(list.map((d) => [d.id, d]));
  const ms = new MiniSearch<SearchDoc>({
    fields: ["title", "path", "text"],
    storeFields: ["kind", "title", "path", "account", "repo"],
    searchOptions: { boost: { title: 3, path: 2 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
  });
  // Deduplicate ids (profile doc shares a path with README.md virtual file, ids are distinct)
  ms.addAll(list);
  return ms;
}

export function snippet(text: string, query: string, radius = 60): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of terms) {
    pos = lower.indexOf(t);
    if (pos >= 0) break;
  }
  if (pos < 0) return text.slice(0, radius * 2).replace(/\s+/g, " ");
  const start = Math.max(0, pos - radius);
  return (start > 0 ? "…" : "") + text.slice(start, pos + radius).replace(/\s+/g, " ") + "…";
}
