export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
}

export interface RepoMeta {
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

export interface AccountMeta {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  htmlUrl: string;
  repos: RepoMeta[];
}

export interface Manifest {
  generatedAt: string | null;
  accounts: AccountMeta[];
}

export type TabKind = "virtual" | "github" | "untitled";

export interface Tab {
  id: string;
  kind: TabKind;
  title: string;
  /** file path inside the repo (github) or virtual file name */
  path: string;
  account?: string;
  repo?: string;
  sha?: string;
  branch?: string;
  size?: number;
  /** italic preview tab until pinned */
  preview: boolean;
  /** untitled tabs carry their own content */
  content?: string;
  language?: string;
}

export type SidebarView = "explorer" | "search" | "git" | "extensions" | "copilot" | "settings";
export type MobileTab = "editor" | "search" | "terminal" | "copilot";

export type FileState =
  | { status: "loading" }
  | { status: "ready"; content: string; source: "virtual" | "cache" | "network" | "untitled" }
  | { status: "image"; url: string; fallbackUrl: string }
  | { status: "toolarge"; size: number; rawUrl: string }
  | { status: "error"; message: string; rawUrl?: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}
