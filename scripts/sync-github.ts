/**
 * Build-time GitHub sync.
 *  - Resolves accounts from portfolio.config.ts
 *  - Pins each repo to its latest commit SHA
 *  - Writes public/data/manifest.json and public/data/trees/[account]-[repo].json
 *  - Self-hosts Monaco (public/monaco/vs) and github-markdown-css so the runtime has zero CDN dependency
 *
 * It NEVER fails the build: on network / rate-limit errors it falls back to previously generated data.
 */
import fs from "node:fs";
import path from "node:path";
import { portfolioConfig } from "../portfolio.config";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const TREE_DIR = path.join(DATA_DIR, "trees");
const MAX_FILE_SIZE = 500 * 1024;
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

interface GhRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  html_url: string;
  homepage: string | null;
  topics?: string[];
  pushed_at: string | null;
  size: number;
}
interface GhTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}
interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
}
interface RepoMeta {
  account: string;
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  commitSha: string;
  branch: string;
  htmlUrl: string;
  homepage: string | null;
  topics: string[];
  pushedAt: string | null;
  fileCount: number;
  truncated: boolean;
  readme: string;
}
interface AccountMeta {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  htmlUrl: string;
  repos: RepoMeta[];
}

const NOISE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "vendor", ".venv", "__pycache__", ".idea", ".gradle", "target", "coverage"]);
const LOCKFILES = new Set(["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock", "poetry.lock", "composer.lock", "Gemfile.lock", "go.sum"]);
const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif", "tiff", "psd",
  "mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "ogg", "flac",
  "zip", "tar", "gz", "tgz", "rar", "7z", "jar", "war", "apk", "ipa",
  "exe", "dll", "so", "dylib", "bin", "class", "o", "a", "pyc", "wasm",
  "ttf", "otf", "woff", "woff2", "eot", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "db", "sqlite", "dex", "keystore", "jks",
]);

const headers = (accept = "application/vnd.github+json"): Record<string, string> => {
  const h: Record<string, string> = { Accept: accept, "User-Agent": "vscode-web-portfolio-sync", "X-GitHub-Api-Version": "2022-11-28" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
};

async function gh<T>(url: string, accept?: string, text = false): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { headers: headers(accept), signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 403 || res.status === 429) {
        throw new Error(`rate limited / forbidden (${res.status}) for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (text ? await res.text() : await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && e.message.startsWith("rate limited")) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function isNoise(entry: GhTreeEntry): boolean {
  if (entry.type !== "blob") return true;
  const parts = entry.path.split("/");
  const file = parts[parts.length - 1];
  if (parts.slice(0, -1).some((p) => NOISE_DIRS.has(p))) return true;
  if (LOCKFILES.has(file)) return true;
  if (file === ".DS_Store" || file.endsWith(".min.js") || file.endsWith(".min.css") || file.endsWith(".map")) return true;
  const ext = file.includes(".") ? file.split(".").pop()!.toLowerCase() : "";
  if (BINARY_EXT.has(ext)) return true;
  if ((entry.size ?? 0) > MAX_FILE_SIZE) return true;
  return false;
}

function buildTree(entries: GhTreeEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };
  for (const e of entries) {
    const parts = e.path.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      const p = parts.slice(0, i + 1).join("/");
      cur.children = cur.children || [];
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = isLast ? { name: part, path: p, type: "file", size: e.size ?? 0 } : { name: part, path: p, type: "dir", children: [] };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) : a.type === "dir" ? -1 : 1));
    nodes.forEach((n) => n.children && sort(n.children));
  };
  sort(root.children!);
  return root.children!;
}

async function fetchReadme(account: string, repo: string, sha: string, entries: GhTreeEntry[]): Promise<string> {
  const candidate = entries.find((e) => /^readme(\.md|\.markdown|\.txt)?$/i.test(e.path));
  if (!candidate) return "";
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${account}/${repo}/${sha}/${candidate.path}`);
    if (!res.ok) return "";
    return (await res.text()).slice(0, 6000);
  } catch {
    return "";
  }
}

/** Rate-limit-free: git smart-HTTP ref advertisement (not part of the REST API quota). */
async function shaViaGit(account: string, repo: string, branch: string): Promise<string> {
  const res = await fetch(`https://github.com/${account}/${repo}.git/info/refs?service=git-upload-pack`, { headers: { "User-Agent": "git/2.43.0" } });
  if (!res.ok) throw new Error(`git refs HTTP ${res.status}`);
  const body = await res.text();
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = body.match(new RegExp(`([0-9a-f]{40}) refs/heads/${escaped}(?:\\u0000|\\n|$)`));
  if (!m) throw new Error(`branch ${branch} not found in git refs`);
  return m[1];
}

async function getSha(account: string, repo: string, branch: string): Promise<string> {
  try {
    return await shaViaGit(account, repo, branch);
  } catch {
    return (await gh<string>(`https://api.github.com/repos/${account}/${repo}/commits/${encodeURIComponent(branch)}`, "application/vnd.github.sha", true)).trim();
  }
}

/** Tree via REST API, falling back to the jsDelivr data API (immutable by SHA, no GitHub quota). */
async function getTree(account: string, repo: string, sha: string): Promise<{ entries: GhTreeEntry[]; truncated: boolean }> {
  try {
    const t = await gh<{ tree: GhTreeEntry[]; truncated: boolean }>(`https://api.github.com/repos/${account}/${repo}/git/trees/${sha}?recursive=1`);
    return { entries: t.tree, truncated: t.truncated };
  } catch (apiErr) {
    try {
      const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${account}/${repo}@${sha}?structure=flat`);
      if (!res.ok) throw new Error(`jsdelivr HTTP ${res.status}`);
      const j = (await res.json()) as { files: { name: string; size: number }[] };
      return { entries: j.files.map((f) => ({ path: f.name.replace(/^\//, ""), type: "blob" as const, size: f.size })), truncated: false };
    } catch {
      throw apiErr;
    }
  }
}

async function syncRepo(account: string, repo: GhRepo, prev: RepoMeta | undefined): Promise<RepoMeta | null> {
  const treeFile = path.join(TREE_DIR, `${account}-${repo.name}.json`);
  try {
    const sha = await getSha(account, repo.name, repo.default_branch);
    if (prev && prev.commitSha === sha && fs.existsSync(treeFile)) {
      return { ...prev, stars: repo.stargazers_count, description: repo.description, language: repo.language, topics: repo.topics ?? [], homepage: repo.homepage || null };
    }
    const tree = await getTree(account, repo.name, sha);
    const clean = tree.entries.filter((e) => !isNoise(e));
    fs.writeFileSync(treeFile, JSON.stringify(buildTree(clean)));
    const readme = await fetchReadme(account, repo.name, sha, clean);
    return {
      account,
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      commitSha: sha,
      branch: repo.default_branch,
      htmlUrl: repo.html_url,
      homepage: repo.homepage || null,
      topics: repo.topics ?? [],
      pushedAt: repo.pushed_at,
      fileCount: clean.length,
      truncated: tree.truncated,
      readme,
    };
  } catch (e) {
    console.warn(`[sync] ${account}/${repo.name}: ${(e as Error).message}`);
    if (prev && fs.existsSync(treeFile)) {
      console.warn(`[sync] ${account}/${repo.name}: using cached data`);
      return prev;
    }
    return null;
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function syncAccount(account: string, prevAccount: AccountMeta | undefined): Promise<AccountMeta> {
  const base: AccountMeta = prevAccount ?? { login: account, name: null, avatarUrl: null, bio: null, htmlUrl: `https://github.com/${account}`, repos: [] };
  try {
    const repos = await gh<GhRepo[]>(`https://api.github.com/users/${account}/repos?type=public&per_page=100&sort=pushed`);
    let user: { name: string | null; avatar_url: string; bio: string | null; html_url: string } | null = null;
    try {
      user = await gh(`https://api.github.com/users/${account}`);
    } catch {
      /* optional */
    }
    const filtered = repos.filter((r) => !(portfolioConfig.excludeForks && r.fork) && !(portfolioConfig.excludeArchived && r.archived));
    console.log(`[sync] ${account}: ${filtered.length}/${repos.length} repos after filtering`);
    const prevMap = new Map((prevAccount?.repos ?? []).map((r) => [r.name, r]));
    const synced = (await pool(filtered, 4, (r) => syncRepo(account, r, prevMap.get(r.name)))).filter((r): r is RepoMeta => r !== null);
    return {
      login: account,
      name: user?.name ?? base.name,
      avatarUrl: user?.avatar_url ?? base.avatarUrl,
      bio: user?.bio ?? base.bio,
      htmlUrl: user?.html_url ?? base.htmlUrl,
      repos: synced,
    };
  } catch (e) {
    console.warn(`[sync] ${account}: ${(e as Error).message} - falling back to cached data (${base.repos.length} repos)`);
    return base;
  }
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function selfHostAssets() {
  try {
    const monacoSrc = path.join(ROOT, "node_modules", "monaco-editor", "min", "vs");
    const monacoDest = path.join(ROOT, "public", "monaco", "vs");
    if (fs.existsSync(monacoSrc) && !fs.existsSync(path.join(monacoDest, "loader.js"))) {
      copyDir(monacoSrc, monacoDest);
      console.log("[sync] copied Monaco to public/monaco/vs");
    }
    const mdSrc = path.join(ROOT, "node_modules", "github-markdown-css");
    const mdDest = path.join(ROOT, "public", "vendor");
    fs.mkdirSync(mdDest, { recursive: true });
    for (const f of ["github-markdown-dark.css", "github-markdown-light.css"]) {
      if (fs.existsSync(path.join(mdSrc, f))) fs.copyFileSync(path.join(mdSrc, f), path.join(mdDest, f));
    }
  } catch (e) {
    console.warn(`[sync] asset copy failed: ${(e as Error).message}`);
  }
}

async function main() {
  fs.mkdirSync(TREE_DIR, { recursive: true });
  selfHostAssets();
  console.log(`[sync] accounts: ${portfolioConfig.accounts.join(", ")} (${TOKEN ? "authenticated" : "unauthenticated"})`);
  const prev = readJson<{ accounts: AccountMeta[] }>(path.join(DATA_DIR, "manifest.json"));
  const prevMap = new Map((prev?.accounts ?? []).map((a) => [a.login.toLowerCase(), a]));
  const accounts: AccountMeta[] = [];
  for (const login of portfolioConfig.accounts) {
    accounts.push(await syncAccount(login, prevMap.get(login.toLowerCase())));
  }
  const manifest = { generatedAt: new Date().toISOString(), accounts };
  fs.writeFileSync(path.join(DATA_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  const total = accounts.reduce((n, a) => n + a.repos.length, 0);
  console.log(`[sync] wrote manifest.json (${accounts.length} accounts, ${total} repos)`);
}

main().catch((e) => {
  console.warn(`[sync] fatal: ${(e as Error).message} (continuing build with existing data)`);
  try {
    fs.mkdirSync(TREE_DIR, { recursive: true });
    if (!fs.existsSync(path.join(DATA_DIR, "manifest.json"))) {
      fs.writeFileSync(path.join(DATA_DIR, "manifest.json"), JSON.stringify({ generatedAt: null, accounts: [] }));
    }
  } catch {
    /* ignore */
  }
});
