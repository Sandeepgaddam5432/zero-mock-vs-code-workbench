import { getTheme } from "./themes";

const LANG_ALIASES: Record<string, string> = { plaintext: "text", shell: "bash", ini: "ini", dockerfile: "docker" };

/** Lazy Shiki highlighter (dynamic import keeps it off the critical path). Falls back to plain text. */
export async function highlightToHtml(code: string, lang: string, themeId: string, hlLine?: number): Promise<string> {
  const { codeToHtml } = await import("shiki");
  const theme = getTheme(themeId).shiki;
  const transformers = hlLine
    ? [
        {
          line(node: { properties: Record<string, unknown> }, line: number) {
            if (line === hlLine) node.properties.class = `${(node.properties.class as string) ?? ""} hl`.trim();
          },
        },
      ]
    : [];
  const l = LANG_ALIASES[lang] ?? lang;
  try {
    return await codeToHtml(code, { lang: l, theme, transformers });
  } catch {
    return await codeToHtml(code, { lang: "text", theme, transformers });
  }
}
