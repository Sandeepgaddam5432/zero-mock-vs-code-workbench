"use client";

import { create } from "zustand";
import { portfolioConfig } from "../../portfolio.config";
import { extForLang, languageOf } from "./fileIcons";
import type { ChatMessage, FileState, Manifest, MobileTab, RepoMeta, SidebarView, Tab, TreeNode } from "./types";
import { fetchManifest, fetchTree, githubTabId, virtualTab } from "./vfs";

export interface CopilotRequest {
  nonce: number;
  prompt: string;
  /** selected code or null */
  selection: string | null;
  path: string | null;
}

interface RevealRequest {
  tabId: string;
  line: number;
  nonce: number;
}

export interface Toast {
  id: number;
  text: string;
}

interface WorkbenchState {
  /* data */
  manifest: Manifest | null;
  manifestError: string | null;
  trees: Record<string, TreeNode[]>;
  treeErrors: Record<string, string>;
  /* layout */
  viewport: "unknown" | "mobile" | "desktop";
  recruiter: boolean;
  activeView: SidebarView;
  sidebarOpen: boolean;
  panelOpen: boolean;
  mobileTab: MobileTab;
  drawerOpen: boolean;
  quickOpen: boolean;
  /* settings */
  theme: string;
  wordWrap: boolean;
  minimap: boolean;
  fontSize: number;
  /* editor */
  tabs: Tab[];
  activeTabId: string | null;
  contents: Record<string, FileState>;
  splitPreview: Record<string, boolean>;
  cursor: { line: number; col: number };
  reveal: RevealRequest | null;
  expanded: Record<string, boolean>;
  /* copilot */
  copilotRequest: CopilotRequest | null;
  messages: ChatMessage[];
  chatBusy: boolean;
  /* misc */
  toasts: Toast[];

  /* actions */
  loadManifest: () => Promise<void>;
  loadTree: (account: string, repo: string) => Promise<TreeNode[] | null>;
  loadAllTrees: () => Promise<void>;
  setViewport: (v: "mobile" | "desktop") => void;
  setRecruiter: (v: boolean) => void;
  setActiveView: (v: SidebarView) => void;
  toggleView: (v: SidebarView) => void;
  setSidebarOpen: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setMobileTab: (t: MobileTab) => void;
  setDrawerOpen: (v: boolean) => void;
  setQuickOpen: (v: boolean) => void;
  setTheme: (id: string) => void;
  setWordWrap: (v: boolean) => void;
  setMinimap: (v: boolean) => void;
  setFontSize: (n: number) => void;
  openTab: (tab: Tab, opts?: { line?: number; pin?: boolean }) => void;
  openVirtual: (name: string, opts?: { line?: number; pin?: boolean }) => void;
  openGithubFile: (repo: RepoMeta, path: string, opts?: { line?: number; pin?: boolean; size?: number }) => void;
  openUntitled: (content: string, lang: string) => void;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  setActiveTab: (id: string) => void;
  pinTab: (id: string) => void;
  moveTab: (from: number, to: number) => void;
  setContent: (id: string, s: FileState) => void;
  toggleSplit: (id: string) => void;
  setCursor: (line: number, col: number) => void;
  toggleExpanded: (key: string, value?: boolean) => void;
  askCopilot: (prompt: string, selection: string | null, path: string | null) => void;
  setMessages: (fn: (m: ChatMessage[]) => ChatMessage[]) => void;
  setChatBusy: (v: boolean) => void;
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
}

let nonce = 0;
let untitledCount = 0;
let toastId = 0;

export const repoKey = (account: string, repo: string) => `${account}/${repo}`;
const loadingTrees = new Map<string, Promise<TreeNode[] | null>>();

const ancestorsOf = (account: string, repo: string, path: string): Record<string, boolean> => {
  const out: Record<string, boolean> = { [`repo:${account}/${repo}`]: true };
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) out[`dir:${account}/${repo}/${parts.slice(0, i).join("/")}`] = true;
  return out;
};

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  manifest: null,
  manifestError: null,
  trees: {},
  treeErrors: {},
  viewport: "unknown",
  recruiter: false,
  activeView: "explorer",
  sidebarOpen: true,
  panelOpen: true,
  mobileTab: "editor",
  drawerOpen: false,
  quickOpen: false,
  theme: "dark",
  wordWrap: true,
  minimap: true,
  fontSize: 13,
  tabs: [],
  activeTabId: null,
  contents: {},
  splitPreview: {},
  cursor: { line: 1, col: 1 },
  reveal: null,
  expanded: { "section:portfolio": true },
  copilotRequest: null,
  messages: [],
  chatBusy: false,
  toasts: [],

  loadManifest: async () => {
    try {
      const manifest = await fetchManifest();
      const expanded = { ...get().expanded };
      manifest.accounts.forEach((a) => (expanded[`section:${a.login}`] = expanded[`section:${a.login}`] ?? true));
      set({ manifest, manifestError: null, expanded });
    } catch (e) {
      set({ manifest: { generatedAt: null, accounts: [] }, manifestError: (e as Error).message });
    }
  },

  loadTree: (account, repo) => {
    const key = repoKey(account, repo);
    const existing = get().trees[key];
    if (existing) return Promise.resolve(existing);
    const inflight = loadingTrees.get(key);
    if (inflight) return inflight;
    const p = fetchTree(account, repo)
      .then((tree) => {
        set((s) => ({ trees: { ...s.trees, [key]: tree } }));
        return tree;
      })
      .catch((e: Error) => {
        set((s) => ({ treeErrors: { ...s.treeErrors, [key]: e.message } }));
        return null;
      })
      .finally(() => loadingTrees.delete(key));
    loadingTrees.set(key, p);
    return p;
  },

  loadAllTrees: async () => {
    const m = get().manifest;
    if (!m) return;
    const jobs = m.accounts.flatMap((a) => a.repos.map((r) => [a.login, r.name] as const));
    let i = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (i < jobs.length) {
          const [a, r] = jobs[i++];
          await get().loadTree(a, r);
        }
      }),
    );
  },

  setViewport: (viewport) => set({ viewport }),
  setRecruiter: (recruiter) => set({ recruiter }),
  setActiveView: (activeView) => set({ activeView, sidebarOpen: true }),
  toggleView: (v) => {
    const s = get();
    if (s.activeView === v && s.sidebarOpen) set({ sidebarOpen: false });
    else set({ activeView: v, sidebarOpen: true });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setMobileTab: (mobileTab) => set({ mobileTab, drawerOpen: false }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setQuickOpen: (quickOpen) => set({ quickOpen }),
  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem("workbench:theme", theme);
    } catch {
      /* ignore */
    }
  },
  setWordWrap: (wordWrap) => {
    set({ wordWrap });
    try {
      localStorage.setItem("workbench:wordWrap", String(wordWrap));
    } catch {
      /* ignore */
    }
  },
  setMinimap: (minimap) => {
    set({ minimap });
    try {
      localStorage.setItem("workbench:minimap", String(minimap));
    } catch {
      /* ignore */
    }
  },
  setFontSize: (fontSize) => {
    set({ fontSize });
    try {
      localStorage.setItem("workbench:fontSize", String(fontSize));
    } catch {
      /* ignore */
    }
  },

  openTab: (tab, opts) => {
    const s = get();
    const existing = s.tabs.find((t) => t.id === tab.id);
    let tabs = s.tabs;
    if (existing) {
      if (opts?.pin && existing.preview) tabs = tabs.map((t) => (t.id === tab.id ? { ...t, preview: false } : t));
    } else {
      const next: Tab = { ...tab, preview: opts?.pin ? false : tab.preview };
      if (next.preview) {
        // replace the current preview tab (VS Code single-click behaviour)
        const idx = tabs.findIndex((t) => t.preview);
        if (idx >= 0) {
          tabs = [...tabs];
          tabs.splice(idx, 1, next);
        } else tabs = [...tabs, next];
      } else tabs = [...tabs, next];
    }
    const expanded = tab.kind === "github" && tab.account && tab.repo ? { ...s.expanded, ...ancestorsOf(tab.account, tab.repo, tab.path) } : s.expanded;
    set({
      tabs,
      activeTabId: tab.id,
      expanded,
      mobileTab: "editor",
      drawerOpen: false,
      reveal: opts?.line ? { tabId: tab.id, line: opts.line, nonce: ++nonce } : null,
      cursor: opts?.line ? { line: opts.line, col: 1 } : { line: 1, col: 1 },
    });
  },

  openVirtual: (name, opts) => get().openTab(virtualTab(name, !opts?.pin), opts),

  openGithubFile: (repo, path, opts) => {
    const name = path.split("/").pop() ?? path;
    get().openTab(
      {
        id: githubTabId(repo.account, repo.name, path),
        kind: "github",
        title: name,
        path,
        account: repo.account,
        repo: repo.name,
        sha: repo.commitSha,
        branch: repo.branch,
        size: opts?.size,
        preview: !opts?.pin,
        language: languageOf(path),
      },
      opts,
    );
  },

  openUntitled: (content, lang) => {
    untitledCount += 1;
    const ext = extForLang(lang);
    const title = `Untitled-${untitledCount}.${ext}`;
    get().openTab({ id: `untitled:${title}`, kind: "untitled", title, path: title, preview: false, content, language: languageOf(title) }, { pin: true });
  },

  closeTab: (id) => {
    const s = get();
    const idx = s.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const tabs = s.tabs.filter((t) => t.id !== id);
    let activeTabId = s.activeTabId;
    if (activeTabId === id) activeTabId = tabs.length ? tabs[Math.min(idx, tabs.length - 1)].id : null;
    set({ tabs, activeTabId });
  },
  closeOthers: (id) => set((s) => ({ tabs: s.tabs.filter((t) => t.id === id), activeTabId: id })),
  closeAll: () => set({ tabs: [], activeTabId: null }),
  setActiveTab: (activeTabId) => set({ activeTabId, reveal: null, cursor: { line: 1, col: 1 } }),
  pinTab: (id) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, preview: false } : t)) })),
  moveTab: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.tabs.length || to >= s.tabs.length) return s;
      const tabs = [...s.tabs];
      const [m] = tabs.splice(from, 1);
      tabs.splice(to, 0, m);
      return { tabs };
    }),
  setContent: (id, state) => set((s) => ({ contents: { ...s.contents, [id]: state } })),
  toggleSplit: (id) => set((s) => ({ splitPreview: { ...s.splitPreview, [id]: !s.splitPreview[id] } })),
  setCursor: (line, col) => {
    const c = get().cursor;
    if (c.line !== line || c.col !== col) set({ cursor: { line, col } });
  },
  toggleExpanded: (key, value) => set((s) => ({ expanded: { ...s.expanded, [key]: value ?? !s.expanded[key] } })),

  askCopilot: (prompt, selection, path) =>
    set({
      copilotRequest: { nonce: ++nonce, prompt, selection, path },
      activeView: "copilot",
      sidebarOpen: true,
      mobileTab: "copilot",
    }),
  setMessages: (fn) => set((s) => ({ messages: fn(s.messages) })),
  setChatBusy: (chatBusy) => set({ chatBusy }),

  toast: (text) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ------------------------------ Selectors ------------------------------- */

export const findRepo = (m: Manifest | null, account: string, repo: string): RepoMeta | undefined => {
  if (!m) return undefined;
  const a = m.accounts.find((x) => x.login.toLowerCase() === account.toLowerCase());
  return a?.repos.find((r) => r.name.toLowerCase() === repo.toLowerCase());
};

export const allRepos = (m: Manifest | null): RepoMeta[] => (m ? m.accounts.flatMap((a) => a.repos) : []);

/** Repos ordered with config.pinnedRepos first. */
export const orderedRepos = (repos: RepoMeta[]): RepoMeta[] => {
  const pins = portfolioConfig.pinnedRepos.map((p) => p.toLowerCase());
  const rank = (r: RepoMeta) => {
    const i = pins.findIndex((p) => p === r.name.toLowerCase() || p === `${r.account}/${r.name}`.toLowerCase());
    return i < 0 ? Infinity : i;
  };
  return [...repos].sort((a, b) => rank(a) - rank(b));
};
