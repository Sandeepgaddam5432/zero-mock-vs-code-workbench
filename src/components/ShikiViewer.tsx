"use client";

import { useEffect, useRef, useState } from "react";
import { highlightToHtml } from "@/lib/highlight";
import { useWorkbench } from "@/lib/store";

const MAX_LINES = 4000;

/** Lightweight, read-only syntax viewer used instead of Monaco on phones. */
export function ShikiViewer({ tabId, content, language }: { tabId: string; content: string; language: string }) {
  const theme = useWorkbench((s) => s.theme);
  const line = useWorkbench((s) => (s.reveal && s.reveal.tabId === tabId ? s.reveal.line : undefined));
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const truncated = content.split("\n").length > MAX_LINES;

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    const code = truncated ? content.split("\n").slice(0, MAX_LINES).join("\n") : content;
    highlightToHtml(code, language, theme, line)
      .then((h) => !cancelled && setHtml(h))
      .catch(() => !cancelled && setHtml(null));
    return () => {
      cancelled = true;
    };
  }, [content, language, theme, line, truncated]);

  useEffect(() => {
    if (html && line) ref.current?.querySelector(".line.hl")?.scrollIntoView({ block: "center" });
  }, [html, line]);

  return (
    <div ref={ref} className="shiki-viewer h-full overflow-auto bg-editor">
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="m-0 whitespace-pre p-3 font-mono text-[12px] leading-[1.55] text-fg">{content.slice(0, 60000)}</pre>}
      {truncated && <div className="border-t border-line p-2 text-center text-xs text-muted">Showing the first {MAX_LINES} lines.</div>}
    </div>
  );
}
