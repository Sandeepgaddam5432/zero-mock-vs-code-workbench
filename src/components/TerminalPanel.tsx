"use client";

import "@xterm/xterm/css/xterm.css";
import { CanvasAddon } from "@xterm/addon-canvas";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal, type ITheme } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { useWorkbench } from "@/lib/store";
import { TerminalSession } from "@/lib/terminal";
import { getTheme } from "@/lib/themes";

/** Genuine xterm.js terminal (canvas renderer) auto-sized with FitAddon. Client-only via next/dynamic. */
export default function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const themeId = useWorkbench((s) => s.theme);
  const themeRef = useRef(themeId);
  themeRef.current = themeId;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 3000,
      allowProposedApi: true,
      theme: getTheme(themeRef.current).xterm as ITheme,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri, "_blank", "noopener,noreferrer")));
    term.open(el);
    try {
      term.loadAddon(new CanvasAddon()); // canvas renderer; xterm falls back to DOM if unavailable
    } catch {
      /* DOM renderer fallback */
    }
    const doFit = () => {
      if (el.clientWidth > 20 && el.clientHeight > 20) {
        try {
          fit.fit();
        } catch {
          /* hidden */
        }
      }
    };
    doFit();
    termRef.current = term;
    const session = new TerminalSession(term);
    session.start();
    const ro = new ResizeObserver(() => doFit());
    ro.observe(el);
    return () => {
      ro.disconnect();
      session.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = getTheme(themeId).xterm as ITheme;
  }, [themeId]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden" onClick={() => termRef.current?.focus()} role="application" aria-label="Terminal" />;
}
