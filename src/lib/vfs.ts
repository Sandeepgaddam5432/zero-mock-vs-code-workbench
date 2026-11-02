import { get, set } from "idb-keyval";
import { portfolioConfig } from "../../portfolio.config";
import { IMAGE_EXT, extOf, languageOf } from "./fileIcons";
import { withBase } from "./paths";
import type { FileState, Manifest, Tab, TreeNode } from "./types";

export const MAX_FILE_BYTES = 500 * 1024;

/* ----------------------------- Virtual files ----------------------------- */

export const virtualFiles: Record<string, string> = portfolioConfig.virtualFiles;
export const virtualFileNames = (): string[] => Object.keys(virtualFiles);

export const virtualTab = (name: string, preview = true): Tab => ({
  id: `virtual:${name}`,
  kind: "virtual",
  title: name,
  path: name,
  preview,
  language: languageOf(name),
});

export const githubTabId = (account: string, repo: string, path: string) => `gh:${account}/${repo}/${path}`;

/* ------------------------------- URLs ----------------------------------- */

export const rawUrl = (account: string, repo: string, sha: string, filePath: string) =>
  `https://raw.githubusercontent.com/${account}/${repo}/${sha}/${filePath.split("/").map(encodeURIComponent).join("/")}`;

export const cdnUrl = (account: string, repo: string, sha: string, filePath: string) =>
  `https://cdn.jsdelivr.net/gh/${account}/${repo}@${sha}/${filePath.split("/").map(encodeURIComponent).join("/")}`;

export const githubBlobUrl = (account: string, repo: string, branch: string, filePath: string, line?: number) =>
  `https://github.com/${account}/${repo}/blob/${branch}/${filePath}${line ? `#L${line}` : ""}`;

/* ------------------------------ Data loading ---------------------------- */

export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(withBase("/data/manifest.json"), { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
  return (await res.json()) as Manifest;
}

export async function fetchTree(account: string, repo: string): Promise<TreeNode[]> {
  const res = await fetch(withBase(`/data/trees/${encodeURIComponent(account)}-${encodeURIComponent(repo)}.json`));
  if (!res.ok) throw new Error(`tree HTTP ${res.status}`);
  return (await res.json()) as TreeNode[];
}

export function flattenTree(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    else if (n.children) flattenTree(n.children, out);
  }
  return out;
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  const parts = path.split("/").filter(Boolean);
  let list: TreeNode[] | undefined = nodes;
  let found: TreeNode | undefined;
  for (const p of parts) {
    found = list?.find((n) => n.name === p);
    if (!found) return undefined;
    list = found.children;
  }
  return found;
}

/* ----------------------------- File content ----------------------------- */

const memCache = new Map<string, string>();

async function fetchText(url: string, timeoutMs = 12000): Promise<{ text: string; size: number | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = res.headers.get("content-length");
    const text = await res.text();
    return { text, size: len ? Number(len) : null };
  } finally {
    clearTimeout(timer);
  }
}

const looksBinary = (text: string) => text.slice(0, 8000).includes("\u0000");

export async function loadTab(tab: Tab): Promise<FileState> {
  if (tab.kind === "untitled") return { status: "ready", content: tab.content ?? "", source: "untitled" };
  if (tab.kind === "virtual") return { status: "ready", content: virtualFiles[tab.path] ?? "", source: "virtual" };

  const { account, repo, sha, path } = tab;
  if (!account || !repo || !sha) return { status: "error", message: "Missing repository coordinates for this tab." };

  const primary = rawUrl(account, repo, sha, path);
  const fallback = cdnUrl(account, repo, sha, path);

  if (IMAGE_EXT.has(extOf(path))) return { status: "image", url: primary, fallbackUrl: fallback };
  if ((tab.size ?? 0) > MAX_FILE_BYTES) return { status: "toolarge", size: tab.size ?? 0, rawUrl: primary };

  const key = `${sha}:${path}`;
  const mem = memCache.get(key);
  if (mem !== undefined) return { status: "ready", content: mem, source: "cache" };

  try {
    const cached = await get<string>(key);
    if (typeof cached === "string") {
      memCache.set(key, cached);
      return { status: "ready", content: cached, source: "cache" };
    }
  } catch {
    /* IndexedDB unavailable (private mode) - continue with the network */
  }

  let lastError = "Unknown error";
  for (const url of [primary, fallback]) {
    try {
      const { text, size } = await fetchText(url);
      const bytes = size ?? text.length;
      if (bytes > MAX_FILE_BYTES) return { status: "toolarge", size: bytes, rawUrl: primary };
      if (looksBinary(text)) return { status: "error", message: "Binary file - cannot be displayed as text.", rawUrl: primary };
      memCache.set(key, text);
      try {
        await set(key, text);
      } catch {
        /* quota exceeded - ignore */
      }
      return { status: "ready", content: text, source: "network" };
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  return { status: "error", message: `Could not load file from raw.githubusercontent.com or jsDelivr (${lastError}).`, rawUrl: primary };
}

/** Load plain text for a github path outside of a tab (terminal `cat`). */
export async function loadGithubText(account: string, repo: string, sha: string, path: string, size?: number): Promise<string> {
  const state = await loadTab({ id: githubTabId(account, repo, path), kind: "github", title: path, path, account, repo, sha, size, preview: true });
  if (state.status === "ready") return state.content;
  if (state.status === "toolarge") throw new Error(`file is too large (${Math.round(state.size / 1024)} KB)`);
  if (state.status === "error") throw new Error(state.message);
  throw new Error("not a text file");
}

export const formatBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
