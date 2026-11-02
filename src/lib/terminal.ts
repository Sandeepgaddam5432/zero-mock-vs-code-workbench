import type { Terminal } from "@xterm/xterm";
import { portfolioConfig } from "../../portfolio.config";
import { downloadResume } from "./resume";
import { allRepos, findRepo, orderedRepos, useWorkbench } from "./store";
import { THEMES } from "./themes";
import type { RepoMeta, TreeNode } from "./types";
import { findNode, loadGithubText, virtualFiles } from "./vfs";

export const terminalBus: { run: ((cmd: string) => void) | null } = { run: null };

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const COMMANDS = ["help", "whoami", "neofetch", "ls", "cd", "pwd", "cat", "code", "repos", "resume", "theme", "echo", "date", "history", "clear"];

type Stat =
  | { type: "dir"; segs: string[] }
  | { type: "virtual"; segs: string[]; name: string }
  | { type: "file"; segs: string[]; repo: RepoMeta; path: string; size: number };

interface Entry {
  name: string;
  dir: boolean;
}

export class TerminalSession {
  private buf = "";
  private cursor = 0;
  private history: string[] = [];
  private histIdx = -1;
  private busy = false;
  private cwd: string[] = [];
  private disposables: { dispose: () => void }[] = [];

  constructor(private term: Terminal) {}

  start() {
    this.disposables.push(this.term.onData((d) => this.onData(d)));
    terminalBus.run = (cmd) => this.runExternal(cmd);
    this.println(`${c.cyan}${c.bold}${portfolioConfig.profile.name}${c.reset} ${c.gray}— interactive portfolio shell${c.reset}`);
    this.println(`${c.gray}Type ${c.reset}${c.yellow}help${c.gray} to list commands. Try ${c.reset}${c.yellow}ls${c.gray}, ${c.reset}${c.yellow}cat README.md${c.gray} or ${c.reset}${c.yellow}neofetch${c.gray}.${c.reset}`);
    this.println("");
    this.prompt();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    if (terminalBus.run) terminalBus.run = null;
  }

  /* ------------------------------ IO helpers ----------------------------- */

  private println(s = "") {
    this.term.write(s.replace(/\r?\n/g, "\r\n") + "\r\n");
  }

  private promptText() {
    const dir = this.cwd.length ? `~/${this.cwd.join("/")}` : "~";
    return `${c.green}visitor@portfolio${c.reset}:${c.blue}${dir}${c.reset}$ `;
  }

  private prompt() {
    this.term.write(this.promptText());
  }

  private redraw() {
    const back = this.buf.length - this.cursor;
    this.term.write(`\r\x1b[K${this.promptText()}${this.buf}${back > 0 ? `\x1b[${back}D` : ""}`);
  }

  private runExternal(cmd: string) {
    if (this.busy) return;
    this.buf = cmd;
    this.cursor = cmd.length;
    this.redraw();
    this.term.write("\r\n");
    void this.execute(cmd);
  }

  /* ----------------------------- Line editing ---------------------------- */

  private onData(data: string) {
    if (this.busy) {
      if (data === "\x03") this.term.write("^C\r\n");
      return;
    }
    // Paste / multi-char chunk
    if (data.length > 1 && !data.startsWith("\x1b")) {
      for (const ch of data.replace(/\r\n/g, "\r")) this.onData(ch);
      return;
    }
    switch (data) {
      case "\r": {
        const cmd = this.buf;
        this.term.write("\r\n");
        this.buf = "";
        this.cursor = 0;
        this.histIdx = -1;
        void this.execute(cmd);
        return;
      }
      case "\x7f":
        if (this.cursor > 0) {
          this.buf = this.buf.slice(0, this.cursor - 1) + this.buf.slice(this.cursor);
          this.cursor--;
          this.redraw();
        }
        return;
      case "\x1b[3~":
        if (this.cursor < this.buf.length) {
          this.buf = this.buf.slice(0, this.cursor) + this.buf.slice(this.cursor + 1);
          this.redraw();
        }
        return;
      case "\x03":
        this.term.write("^C\r\n");
        this.buf = "";
        this.cursor = 0;
        this.prompt();
        return;
      case "\x0c":
        this.term.clear();
        this.term.write("\x1b[2J\x1b[H");
        this.redraw();
        return;
      case "\x1b[A":
        if (this.history.length && this.histIdx < this.history.length - 1) {
          this.histIdx++;
          this.buf = this.history[this.history.length - 1 - this.histIdx];
          this.cursor = this.buf.length;
          this.redraw();
        }
        return;
      case "\x1b[B":
        if (this.histIdx > 0) {
          this.histIdx--;
          this.buf = this.history[this.history.length - 1 - this.histIdx];
        } else {
          this.histIdx = -1;
          this.buf = "";
        }
        this.cursor = this.buf.length;
        this.redraw();
        return;
      case "\x1b[C":
        if (this.cursor < this.buf.length) {
          this.cursor++;
          this.term.write("\x1b[C");
        }
        return;
      case "\x1b[D":
        if (this.cursor > 0) {
          this.cursor--;
          this.term.write("\x1b[D");
        }
        return;
      case "\x1b[H":
      case "\x01":
        this.cursor = 0;
        this.redraw();
        return;
      case "\x1b[F":
      case "\x05":
        this.cursor = this.buf.length;
        this.redraw();
        return;
      case "\t":
        void this.complete();
        return;
      default:
        if (data >= " " && data !== "\x7f" && !data.startsWith("\x1b")) {
          this.buf = this.buf.slice(0, this.cursor) + data + this.buf.slice(this.cursor);
          this.cursor += data.length;
          if (this.cursor === this.buf.length) this.term.write(data);
          else this.redraw();
        }
    }
  }

  private async complete() {
    const before = this.buf.slice(0, this.cursor);
    const parts = before.split(/\s+/);
    const word = parts[parts.length - 1] ?? "";
    let candidates: string[] = [];
    if (parts.length <= 1) {
      candidates = COMMANDS.filter((x) => x.startsWith(word));
    } else {
      const slash = word.lastIndexOf("/");
      const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
      const namePart = slash >= 0 ? word.slice(slash + 1) : word;
      const entries = await this.listDir(this.normalize(dirPart || "."));
      candidates = (entries ?? []).filter((e) => e.name.toLowerCase().startsWith(namePart.toLowerCase())).map((e) => dirPart + e.name + (e.dir ? "/" : ""));
    }
    if (!candidates.length) return;
    if (candidates.length === 1) {
      const completion = candidates[0] + (candidates[0].endsWith("/") ? "" : " ");
      this.buf = this.buf.slice(0, this.cursor - word.length) + completion + this.buf.slice(this.cursor);
      this.cursor = this.cursor - word.length + completion.length;
      this.redraw();
      return;
    }
    this.term.write("\r\n" + candidates.map((x) => x.split("/").filter(Boolean).pop() ?? x).join("  ") + "\r\n");
    this.redraw();
  }

  /* ------------------------------ Filesystem ----------------------------- */

  private normalize(input: string): string[] {
    let segs: string[];
    if (input === "" || input === "~") segs = [];
    else if (input.startsWith("~/")) segs = [];
    else if (input.startsWith("/")) segs = [];
    else segs = [...this.cwd];
    const body = input.startsWith("~/") ? input.slice(2) : input;
    for (const p of body.split("/")) {
      if (!p || p === "." || p === "~") continue;
      if (p === "..") segs.pop();
      else segs.push(p);
    }
    return segs;
  }

  private manifest() {
    return useWorkbench.getState().manifest;
  }

  private async listDir(segs: string[]): Promise<Entry[] | null> {
    const m = this.manifest();
    if (segs.length === 0) {
      return [...Object.keys(virtualFiles).map((name) => ({ name, dir: false })), ...(m?.accounts ?? []).map((a) => ({ name: a.login, dir: true }))];
    }
    const acct = m?.accounts.find((a) => a.login.toLowerCase() === segs[0].toLowerCase());
    if (!acct) return null;
    if (segs.length === 1) return orderedRepos(acct.repos).map((r) => ({ name: r.name, dir: true }));
    const repo = findRepo(m, acct.login, segs[1]);
    if (!repo) return null;
    const tree = await useWorkbench.getState().loadTree(repo.account, repo.name);
    if (!tree) return null;
    const rest = segs.slice(2).join("/");
    const nodes: TreeNode[] | undefined = rest ? findNode(tree, rest)?.children : tree;
    if (!nodes) return null;
    return nodes.map((n) => ({ name: n.name, dir: n.type === "dir" }));
  }

  private async stat(segs: string[]): Promise<Stat | null> {
    const m = this.manifest();
    if (segs.length === 0) return { type: "dir", segs: [] };
    if (segs.length === 1 && segs[0] in virtualFiles) return { type: "virtual", segs, name: segs[0] };
    const acct = m?.accounts.find((a) => a.login.toLowerCase() === segs[0].toLowerCase());
    if (!acct) return null;
    if (segs.length === 1) return { type: "dir", segs: [acct.login] };
    const repo = findRepo(m, acct.login, segs[1]);
    if (!repo) return null;
    if (segs.length === 2) return { type: "dir", segs: [acct.login, repo.name] };
    const tree = await useWorkbench.getState().loadTree(repo.account, repo.name);
    const node = tree ? findNode(tree, segs.slice(2).join("/")) : undefined;
    if (!node) return null;
    const canon = [acct.login, repo.name, ...node.path.split("/")];
    if (node.type === "dir") return { type: "dir", segs: canon };
    return { type: "file", segs: canon, repo, path: node.path, size: node.size ?? 0 };
  }

  /* ------------------------------ Execution ------------------------------ */

  private async execute(line: string) {
    const trimmed = line.trim();
    this.busy = true;
    try {
      if (trimmed) {
        this.history.push(trimmed);
        await this.dispatch(trimmed);
      }
    } catch (e) {
      this.println(`${c.red}error:${c.reset} ${(e as Error).message}`);
    } finally {
      this.busy = false;
      this.prompt();
    }
  }

  private async dispatch(line: string) {
    const [cmd, ...args] = line.split(/\s+/);
    const arg = args.join(" ");
    const store = useWorkbench.getState();
    switch (cmd) {
      case "help":
        this.println(`${c.bold}Available commands${c.reset}`);
        [
          ["help", "show this message"],
          ["whoami", "who am I?"],
          ["neofetch", "system / portfolio summary"],
          ["ls [path]", "list files and repositories"],
          ["cd <path>", "change directory (repos live under ~/<account>/)"],
          ["pwd", "print working directory"],
          ["cat <file>", "print a file (virtual files or repository files)"],
          ["code <path>", "open a file in the editor"],
          ["repos", "list repositories with language and stars"],
          ["resume", "download my resume"],
          ["theme <name>", `switch theme (${THEMES.map((t) => t.id).join(", ")})`],
          ["clear", "clear the terminal"],
        ].forEach(([k, v]) => this.println(`  ${c.yellow}${k.padEnd(14)}${c.reset} ${c.gray}${v}${c.reset}`));
        return;
      case "whoami": {
        const p = portfolioConfig.profile;
        this.println(`${c.cyan}${p.name}${c.reset} (@${p.handle}) — ${p.role}`);
        p.bio.forEach((b) => this.println(`  ${b}`));
        return;
      }
      case "neofetch":
        return this.neofetch();
      case "pwd":
        this.println(`/home/visitor${this.cwd.length ? "/" + this.cwd.join("/") : ""}`);
        return;
      case "echo":
        this.println(arg);
        return;
      case "date":
        this.println(new Date().toString());
        return;
      case "history":
        this.history.forEach((h, i) => this.println(`${String(i + 1).padStart(4)}  ${h}`));
        return;
      case "clear":
        this.term.clear();
        this.term.write("\x1b[2J\x1b[3J\x1b[H");
        return;
      case "ls": {
        const flags = args.filter((a) => a.startsWith("-"));
        const target = args.find((a) => !a.startsWith("-")) ?? ".";
        const st = await this.stat(this.normalize(target));
        if (!st) return this.println(`${c.red}ls:${c.reset} cannot access '${target}': No such file or directory`);
        if (st.type !== "dir") return this.println(st.segs[st.segs.length - 1]);
        const entries = (await this.listDir(st.segs)) ?? [];
        if (!entries.length) return;
        const long = flags.some((f) => f.includes("l"));
        const fmt = (e: Entry) => (e.dir ? `${c.blue}${c.bold}${e.name}/${c.reset}` : e.name);
        if (long) entries.forEach((e) => this.println(`${e.dir ? "drwxr-xr-x" : "-rw-r--r--"}  ${fmt(e)}`));
        else this.println(entries.map(fmt).join("  "));
        return;
      }
      case "cd": {
        const st = await this.stat(this.normalize(arg || "~"));
        if (!st) return this.println(`${c.red}cd:${c.reset} ${arg}: No such file or directory`);
        if (st.type !== "dir") return this.println(`${c.red}cd:${c.reset} ${arg}: Not a directory`);
        this.cwd = st.segs;
        return;
      }
      case "cat": {
        if (!arg) return this.println("usage: cat <file>");
        const st = await this.stat(this.normalize(arg));
        if (!st) return this.println(`${c.red}cat:${c.reset} ${arg}: No such file or directory`);
        if (st.type === "dir") return this.println(`${c.red}cat:${c.reset} ${arg}: Is a directory`);
        const text = st.type === "virtual" ? virtualFiles[st.name] : await loadGithubText(st.repo.account, st.repo.name, st.repo.commitSha, st.path, st.size);
        const lines = text.split("\n");
        this.println(lines.slice(0, 300).join("\n"));
        if (lines.length > 300) this.println(`${c.gray}… ${lines.length - 300} more lines. Use ${c.reset}code ${arg}${c.gray} to open in the editor.${c.reset}`);
        return;
      }
      case "code": {
        if (!arg) return this.println("usage: code <path>");
        const st = await this.stat(this.normalize(arg));
        if (!st) return this.println(`${c.red}code:${c.reset} ${arg}: No such file or directory`);
        if (st.type === "dir") {
          if (st.segs.length >= 2) {
            const repo = findRepo(this.manifest(), st.segs[0], st.segs[1]);
            const tree = repo ? await store.loadTree(repo.account, repo.name) : null;
            const readme = tree?.find((n) => n.type === "file" && /^readme/i.test(n.name));
            if (repo && readme) {
              store.openGithubFile(repo, readme.path, { pin: true, size: readme.size });
              return this.println(`${c.green}opened${c.reset} ${repo.name}/${readme.path}`);
            }
          }
          return this.println(`${c.red}code:${c.reset} ${arg} is a directory`);
        }
        if (st.type === "virtual") store.openVirtual(st.name, { pin: true });
        else store.openGithubFile(st.repo, st.path, { pin: true, size: st.size });
        this.println(`${c.green}opened${c.reset} ${st.segs.join("/")} in editor`);
        return;
      }
      case "repos": {
        const repos = allRepos(this.manifest());
        if (!repos.length) return this.println(`${c.gray}No repositories in manifest (run the GitHub sync).${c.reset}`);
        orderedRepos(repos).forEach((r) => this.println(`${c.cyan}${r.name.padEnd(32)}${c.reset} ${c.yellow}${(r.language ?? "-").padEnd(12)}${c.reset} ★${r.stars}  ${c.gray}${r.description ?? ""}${c.reset}`));
        return;
      }
      case "resume": {
        const name = downloadResume(this.manifest());
        this.println(`${c.green}✔${c.reset} Downloading ${c.bold}${name}${c.reset}`);
        return;
      }
      case "theme": {
        if (!arg) {
          this.println(`Current theme: ${c.cyan}${store.theme}${c.reset}`);
          THEMES.forEach((t) => this.println(`  ${c.yellow}${t.id.padEnd(10)}${c.reset} ${c.gray}${t.label}${c.reset}`));
          return;
        }
        const t = THEMES.find((x) => x.id === arg.toLowerCase() || x.label.toLowerCase().startsWith(arg.toLowerCase()));
        if (!t) return this.println(`${c.red}theme:${c.reset} unknown theme '${arg}'. Available: ${THEMES.map((x) => x.id).join(", ")}`);
        store.setTheme(t.id);
        this.println(`${c.green}✔${c.reset} Theme set to ${t.label}`);
        return;
      }
      default:
        this.println(`${c.red}${cmd}:${c.reset} command not found. Type ${c.yellow}help${c.reset}.`);
    }
  }

  private neofetch() {
    const p = portfolioConfig.profile;
    const s = useWorkbench.getState();
    const repos = allRepos(s.manifest);
    const langs = new Map<string, number>();
    repos.forEach((r) => r.language && langs.set(r.language, (langs.get(r.language) ?? 0) + 1));
    const top = [...langs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l).join(", ") || "n/a";
    const logo = [
      "          ,///////,        ",
      "       ,////////////,      ",
      "     ////////    //////    ",
      "    /////////  ////  ///   ",
      "   ///// ////  ///   ///   ",
      "   ///// ////  ///   ///   ",
      "   //////////  ///  ////   ",
      "    ////////   ////////    ",
      "     ///////   ///////     ",
      "       ///////////////     ",
      "         ,///////////      ",
    ];
    const info = [
      `${c.cyan}${c.bold}visitor${c.reset}@${c.cyan}${c.bold}portfolio${c.reset}`,
      "─".repeat(18),
      `${c.blue}Name${c.reset}: ${p.name}`,
      `${c.blue}Role${c.reset}: ${p.role}`,
      `${c.blue}Shell${c.reset}: portfolio-sh (xterm.js)`,
      `${c.blue}Editor${c.reset}: Monaco / Shiki`,
      `${c.blue}Theme${c.reset}: ${THEMES.find((t) => t.id === s.theme)?.label ?? s.theme}`,
      `${c.blue}Repos${c.reset}: ${repos.length} public`,
      `${c.blue}Languages${c.reset}: ${top}`,
      `${c.blue}Status${c.reset}: ${c.green}${p.status}${c.reset}`,
      `${c.blue}GitHub${c.reset}: @${p.handle}`,
    ];
    const rows = Math.max(logo.length, info.length);
    for (let i = 0; i < rows; i++) {
      this.println(`${c.blue}${logo[i] ?? " ".repeat(27)}${c.reset}  ${info[i] ?? ""}`);
    }
    this.println(`${" ".repeat(29)}${["\x1b[40m", "\x1b[41m", "\x1b[42m", "\x1b[43m", "\x1b[44m", "\x1b[45m", "\x1b[46m", "\x1b[47m"].map((x) => `${x}   `).join("")}${c.reset}`);
  }
}
