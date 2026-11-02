export interface ThemeDef {
  id: string;
  label: string;
  kind: "dark" | "light";
  vars: Record<string, string>;
  monaco: {
    base: "vs" | "vs-dark";
    inherit: boolean;
    rules: { token: string; foreground?: string; fontStyle?: string }[];
    colors: Record<string, string>;
  };
  xterm: Record<string, string>;
  shiki: string;
}

const darkPlus: ThemeDef = {
  id: "dark",
  label: "Dark+ (default dark)",
  kind: "dark",
  shiki: "dark-plus",
  vars: {
    "--bg-editor": "#1e1e1e",
    "--bg-sidebar": "#252526",
    "--bg-activity": "#333333",
    "--bg-titlebar": "#3c3c3c",
    "--bg-statusbar": "#007acc",
    "--bg-tab-inactive": "#2d2d2d",
    "--bg-tab-active": "#1e1e1e",
    "--bg-panel": "#1e1e1e",
    "--bg-input": "#3c3c3c",
    "--bg-hover": "#2a2d2e",
    "--bg-selected": "#37373d",
    "--bg-widget": "#252526",
    "--fg": "#cccccc",
    "--fg-muted": "#858585",
    "--fg-bright": "#ffffff",
    "--fg-status": "#ffffff",
    "--border": "#3c3c3c",
    "--accent": "#007acc",
    "--accent-fg": "#ffffff",
    "--link": "#3794ff",
    "--line-highlight": "#264f78",
  },
  monaco: {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#1e1e1e", "editor.lineHighlightBackground": "#2a2d2e", "editorGutter.background": "#1e1e1e" },
  },
  xterm: { background: "#1e1e1e", foreground: "#cccccc", cursor: "#aeafad", selectionBackground: "#264f78", black: "#000000", red: "#cd3131", green: "#0dbc79", yellow: "#e5e510", blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5", brightBlack: "#666666", brightRed: "#f14c4c", brightGreen: "#23d18b", brightYellow: "#f5f543", brightBlue: "#3b8eea", brightMagenta: "#d670d6", brightCyan: "#29b8db", brightWhite: "#ffffff" },
};

const lightPlus: ThemeDef = {
  id: "light",
  label: "Light+ (default light)",
  kind: "light",
  shiki: "light-plus",
  vars: {
    "--bg-editor": "#ffffff",
    "--bg-sidebar": "#f3f3f3",
    "--bg-activity": "#2c2c2c",
    "--bg-titlebar": "#dddddd",
    "--bg-statusbar": "#007acc",
    "--bg-tab-inactive": "#ececec",
    "--bg-tab-active": "#ffffff",
    "--bg-panel": "#ffffff",
    "--bg-input": "#ffffff",
    "--bg-hover": "#e8e8e8",
    "--bg-selected": "#e4e6f1",
    "--bg-widget": "#f3f3f3",
    "--fg": "#3b3b3b",
    "--fg-muted": "#767676",
    "--fg-bright": "#000000",
    "--fg-status": "#ffffff",
    "--border": "#d4d4d4",
    "--accent": "#005fb8",
    "--accent-fg": "#ffffff",
    "--link": "#006ab1",
    "--line-highlight": "#add6ff",
  },
  monaco: { base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff", "editor.lineHighlightBackground": "#f0f0f0" } },
  xterm: { background: "#ffffff", foreground: "#3b3b3b", cursor: "#000000", selectionBackground: "#add6ff", black: "#000000", red: "#cd3131", green: "#00bc00", yellow: "#949800", blue: "#0451a5", magenta: "#bc05bc", cyan: "#0598bc", white: "#555555", brightBlack: "#666666", brightRed: "#cd3131", brightGreen: "#14ce14", brightYellow: "#b5ba00", brightBlue: "#0451a5", brightMagenta: "#bc05bc", brightCyan: "#0598bc", brightWhite: "#a5a5a5" },
};

const monokai: ThemeDef = {
  id: "monokai",
  label: "Monokai",
  kind: "dark",
  shiki: "monokai",
  vars: {
    ...darkPlus.vars,
    "--bg-editor": "#272822",
    "--bg-sidebar": "#1e1f1c",
    "--bg-activity": "#171814",
    "--bg-titlebar": "#1e1f1c",
    "--bg-statusbar": "#75715e",
    "--bg-tab-inactive": "#34352f",
    "--bg-tab-active": "#272822",
    "--bg-panel": "#272822",
    "--bg-input": "#383a3e",
    "--bg-hover": "#3e3d32",
    "--bg-selected": "#414339",
    "--bg-widget": "#1e1f1c",
    "--border": "#1e1f1c",
    "--accent": "#a6e22e",
    "--accent-fg": "#272822",
    "--link": "#66d9ef",
    "--line-highlight": "#49483e",
    "--fg": "#d6d6d6",
  },
  monaco: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "75715e" },
      { token: "string", foreground: "e6db74" },
      { token: "keyword", foreground: "f92672" },
      { token: "number", foreground: "ae81ff" },
      { token: "type", foreground: "66d9ef" },
      { token: "identifier", foreground: "f8f8f2" },
    ],
    colors: { "editor.background": "#272822", "editor.lineHighlightBackground": "#3e3d32", "editorCursor.foreground": "#f8f8f0" },
  },
  xterm: { ...darkPlus.xterm, background: "#272822", foreground: "#f8f8f2", red: "#f92672", green: "#a6e22e", yellow: "#e6db74", blue: "#66d9ef", magenta: "#ae81ff", cyan: "#a1efe4" },
};

const dracula: ThemeDef = {
  id: "dracula",
  label: "Dracula",
  kind: "dark",
  shiki: "dracula",
  vars: {
    ...darkPlus.vars,
    "--bg-editor": "#282a36",
    "--bg-sidebar": "#21222c",
    "--bg-activity": "#191a21",
    "--bg-titlebar": "#21222c",
    "--bg-statusbar": "#bd93f9",
    "--bg-tab-inactive": "#191a21",
    "--bg-tab-active": "#282a36",
    "--bg-panel": "#282a36",
    "--bg-input": "#343746",
    "--bg-hover": "#44475a50",
    "--bg-selected": "#44475a",
    "--bg-widget": "#21222c",
    "--fg": "#f8f8f2",
    "--fg-muted": "#8b91b5",
    "--fg-status": "#282a36",
    "--border": "#191a21",
    "--accent": "#bd93f9",
    "--accent-fg": "#282a36",
    "--link": "#8be9fd",
    "--line-highlight": "#44475a",
  },
  monaco: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "string", foreground: "f1fa8c" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd" },
    ],
    colors: { "editor.background": "#282a36", "editor.lineHighlightBackground": "#44475a55", "editorCursor.foreground": "#f8f8f0" },
  },
  xterm: { ...darkPlus.xterm, background: "#282a36", foreground: "#f8f8f2", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c", blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd" },
};

export const THEMES: ThemeDef[] = [darkPlus, lightPlus, monokai, dracula];

export const getTheme = (id: string): ThemeDef => THEMES.find((t) => t.id === id) ?? darkPlus;

export const applyThemeVars = (theme: ThemeDef) => {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = theme.id;
  root.dataset.kind = theme.kind;
  root.style.colorScheme = theme.kind;
};
