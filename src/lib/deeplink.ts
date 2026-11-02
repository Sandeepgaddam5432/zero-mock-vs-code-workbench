import { findRepo, useWorkbench } from "./store";
import type { Tab } from "./types";
import { findNode, virtualFiles } from "./vfs";

export type ParsedHash =
  | { kind: "recruiter" }
  | { kind: "virtual"; path: string; line?: number }
  | { kind: "repo"; account: string; repo: string }
  | { kind: "file"; account: string; repo: string; path: string; line?: number };

/** /#/:account/:repo/:filePath[:line]   |   /#/~/:virtualFile[:line]   |   /#/recruiter */
export function parseHash(hash: string): ParsedHash | null {
  const raw = hash.replace(/^#/, "").replace(/^\/+/, "");
  if (!raw) return null;
  if (raw === "recruiter") return { kind: "recruiter" };
  const segs = raw.split("/").map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  let line: number | undefined;
  const last = segs[segs.length - 1];
  const m = last.match(/^(.*):(\d+)$/);
  if (m) {
    segs[segs.length - 1] = m[1];
    line = Number(m[2]);
  }
  if (segs[0] === "~" && segs.length >= 2) return { kind: "virtual", path: segs.slice(1).join("/"), line };
  if (segs.length === 2) return { kind: "repo", account: segs[0], repo: segs[1] };
  if (segs.length >= 3) return { kind: "file", account: segs[0], repo: segs[1], path: segs.slice(2).join("/"), line };
  return null;
}

export function buildHash(tab: Tab | undefined, line?: number): string {
  if (!tab || tab.kind === "untitled") return "";
  const suffix = line ? `:${line}` : "";
  if (tab.kind === "virtual") return `#/~/${tab.path.split("/").map(encodeURIComponent).join("/")}${suffix}`;
  return `#/${encodeURIComponent(tab.account ?? "")}/${encodeURIComponent(tab.repo ?? "")}/${tab.path.split("/").map(encodeURIComponent).join("/")}${suffix}`;
}

/** Applies a parsed deep link to the workbench. Returns true when something was opened. */
export async function applyHash(hash: string): Promise<boolean> {
  const parsed = parseHash(hash);
  const store = useWorkbench.getState();
  if (!parsed) return false;
  if (parsed.kind === "recruiter") {
    store.setRecruiter(true);
    return true;
  }
  store.setRecruiter(false);
  if (parsed.kind === "virtual") {
    if (!(parsed.path in virtualFiles)) {
      store.toast(`Deep link: virtual file "${parsed.path}" not found`);
      return false;
    }
    store.openVirtual(parsed.path, { pin: true, line: parsed.line });
    return true;
  }
  if (!store.manifest) await store.loadManifest();
  const repo = findRepo(useWorkbench.getState().manifest, parsed.account, parsed.repo);
  if (!repo) {
    store.toast(`Deep link: repository ${parsed.account}/${parsed.repo} not found in manifest`);
    return false;
  }
  const tree = await useWorkbench.getState().loadTree(repo.account, repo.name);
  if (parsed.kind === "repo") {
    useWorkbench.getState().toggleExpanded(`repo:${repo.account}/${repo.name}`, true);
    const readme = tree?.find((n) => n.type === "file" && /^readme/i.test(n.name));
    if (readme) useWorkbench.getState().openGithubFile(repo, readme.path, { pin: true, size: readme.size });
    return true;
  }
  const node = tree ? findNode(tree, parsed.path) : undefined;
  useWorkbench.getState().openGithubFile(repo, node?.path ?? parsed.path, { pin: true, line: parsed.line, size: node?.size });
  return true;
}
