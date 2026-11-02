/** VS Code Material-icon-theme style mapping: language badge (letters + color) or a codicon fallback. */
export interface FileIconSpec {
  label?: string;
  color: string;
  codicon?: string;
}

const byExt: Record<string, FileIconSpec> = {
  ts: { label: "TS", color: "#3178c6" },
  tsx: { label: "TSX", color: "#3fa9d8" },
  js: { label: "JS", color: "#e5c100" },
  jsx: { label: "JSX", color: "#3fa9d8" },
  mjs: { label: "JS", color: "#e5c100" },
  cjs: { label: "JS", color: "#e5c100" },
  py: { label: "PY", color: "#4b8bbe" },
  go: { label: "GO", color: "#00add8" },
  rs: { label: "RS", color: "#dea584" },
  java: { label: "JV", color: "#e76f00" },
  kt: { label: "KT", color: "#a97bff" },
  swift: { label: "SW", color: "#fa7343" },
  c: { label: "C", color: "#659ad2" },
  h: { label: "H", color: "#a074c4" },
  cpp: { label: "C+", color: "#659ad2" },
  cs: { label: "C#", color: "#68217a" },
  rb: { label: "RB", color: "#cc342d" },
  php: { label: "PHP", color: "#8892bf" },
  dart: { label: "DT", color: "#40c4ff" },
  lua: { label: "LU", color: "#51a0cf" },
  sh: { label: "SH", color: "#89e051" },
  bash: { label: "SH", color: "#89e051" },
  zsh: { label: "SH", color: "#89e051" },
  html: { label: "<>", color: "#e44d26" },
  css: { label: "#", color: "#42a5f5" },
  scss: { label: "SC", color: "#f06292" },
  vue: { label: "V", color: "#41b883" },
  svelte: { label: "S", color: "#ff3e00" },
  sql: { label: "SQL", color: "#e38c00" },
  yml: { label: "YML", color: "#cb171e" },
  yaml: { label: "YML", color: "#cb171e" },
  toml: { label: "TML", color: "#9c4221" },
  xml: { label: "XML", color: "#e37933" },
  json: { color: "#cbcb41", codicon: "json" },
  md: { color: "#519aba", codicon: "markdown" },
  mdx: { color: "#519aba", codicon: "markdown" },
  txt: { color: "#9a9a9a", codicon: "file-text" },
  env: { color: "#faf743", codicon: "gear" },
  svg: { color: "#ffb13b", codicon: "file-media" },
  png: { color: "#a074c4", codicon: "file-media" },
  jpg: { color: "#a074c4", codicon: "file-media" },
  jpeg: { color: "#a074c4", codicon: "file-media" },
  gif: { color: "#a074c4", codicon: "file-media" },
  webp: { color: "#a074c4", codicon: "file-media" },
  lock: { color: "#9a9a9a", codicon: "lock" },
};

const byName: Record<string, FileIconSpec> = {
  dockerfile: { label: "DK", color: "#2496ed" },
  makefile: { label: "MK", color: "#e37933" },
  "package.json": { color: "#8bc34a", codicon: "json" },
  "tsconfig.json": { color: "#3178c6", codicon: "json" },
  license: { color: "#e5c100", codicon: "law" },
  ".gitignore": { color: "#f4511e", codicon: "source-control" },
  "readme.md": { color: "#42a5f5", codicon: "info" },
};

export function fileIcon(name: string): FileIconSpec {
  const lower = name.toLowerCase();
  if (byName[lower]) return byName[lower];
  if (lower.startsWith(".env") || lower.endsWith(".env")) return byExt.env;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return byExt[ext] ?? { color: "#9a9a9a", codicon: "file" };
}

export const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"]);

export const extOf = (path: string): string => {
  const base = path.split("/").pop() ?? path;
  return base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
};

const langByExt: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", md: "markdown", mdx: "markdown", py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin",
  swift: "swift", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", rb: "ruby", php: "php",
  dart: "dart", lua: "lua", sh: "shell", bash: "shell", zsh: "shell", html: "html", htm: "html", css: "css",
  scss: "scss", less: "less", vue: "html", svelte: "html", sql: "sql", yml: "yaml", yaml: "yaml", xml: "xml",
  svg: "xml", toml: "ini", ini: "ini", env: "ini", txt: "plaintext", gradle: "java", dockerfile: "dockerfile",
  graphql: "graphql", r: "r", scala: "scala", pl: "perl", ps1: "powershell", bat: "bat",
};

export function languageOf(path: string): string {
  const base = (path.split("/").pop() ?? path).toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "plaintext";
  if (base.startsWith(".env")) return "ini";
  return langByExt[extOf(path)] ?? "plaintext";
}

/** Map a fenced-code language label to a file extension (for "Open in New Editor Tab"). */
export const extForLang = (lang: string): string => {
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx", python: "py", py: "py", go: "go",
    rust: "rs", java: "java", json: "json", bash: "sh", sh: "sh", shell: "sh", html: "html", css: "css", sql: "sql",
    yaml: "yml", yml: "yml", markdown: "md", md: "md", c: "c", cpp: "cpp", csharp: "cs", ruby: "rb", php: "php",
  };
  return map[l] ?? (l && /^[a-z0-9]{1,5}$/.test(l) ? l : "txt");
};
