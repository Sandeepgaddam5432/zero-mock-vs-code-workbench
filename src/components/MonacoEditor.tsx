"use client";

import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/paths";
import { useWorkbench } from "@/lib/store";
import { THEMES } from "@/lib/themes";

const CDN_FALLBACK = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";
let pathsReady: Promise<void> | null = null;

/** Self-hosted Monaco (public/monaco/vs) first; jsDelivr as resilient fallback. */
function ensureMonacoPaths(): Promise<void> {
  if (!pathsReady) {
    pathsReady = (async () => {
      const local = withBase("/monaco/vs");
      try {
        const res = await fetch(`${local}/loader.js`, { method: "HEAD" });
        if (res.ok) {
          loader.config({ paths: { vs: local } });
          return;
        }
      } catch {
        /* fall through to CDN */
      }
      loader.config({ paths: { vs: CDN_FALLBACK } });
    })();
  }
  return pathsReady;
}

interface Props {
  tabId: string;
  value: string;
  language: string;
}

export default function MonacoEditor({ tabId, value, language }: Props) {
  const [ready, setReady] = useState(false);
  const theme = useWorkbench((s) => s.theme);
  const wordWrap = useWorkbench((s) => s.wordWrap);
  const minimap = useWorkbench((s) => s.minimap);
  const fontSize = useWorkbench((s) => s.fontSize);
  const reveal = useWorkbench((s) => s.reveal);
  const setCursor = useWorkbench((s) => s.setCursor);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const [mounted, setMounted] = useState(0);

  useEffect(() => {
    let alive = true;
    void ensureMonacoPaths().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const beforeMount: BeforeMount = (monaco) => {
    THEMES.forEach((t) => monaco.editor.defineTheme(`wb-${t.id}`, { base: t.monaco.base, inherit: t.monaco.inherit, rules: t.monaco.rules, colors: t.monaco.colors }));
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
    editor.addAction({
      id: "copilot.explainSelection",
      label: "Explain Selected Code",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      run: (ed) => {
        const st = useWorkbench.getState();
        const sel = ed.getSelection();
        const text = sel && !sel.isEmpty() ? ed.getModel()?.getValueInRange(sel) : null;
        const tab = st.tabs.find((t) => t.id === st.activeTabId);
        const path = tab ? (tab.kind === "github" ? `${tab.account}/${tab.repo}/${tab.path}` : tab.path) : null;
        if (!text) {
          st.toast("Select some code first, then choose “Explain Selected Code”.");
          return;
        }
        st.askCopilot(`Explain this selected code from \`${path ?? "the editor"}\`:`, text, path);
      },
    });
    editor.addAction({
      id: "copilot.askFile",
      label: "Ask Copilot About This File",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0.5,
      run: () => {
        const st = useWorkbench.getState();
        const tab = st.tabs.find((t) => t.id === st.activeTabId);
        if (!tab) return;
        st.askCopilot(`Give me a short overview of \`${tab.title}\` and what it does.`, null, tab.path);
      },
    });
    setMounted((n) => n + 1);
  };

  // deep-link line reveal + highlight
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !reveal || reveal.tabId !== tabId) return;
    const t = setTimeout(() => {
      const model = ed.getModel();
      if (!model) return;
      const line = Math.max(1, Math.min(reveal.line, model.getLineCount()));
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      decoRef.current?.clear();
      decoRef.current = ed.createDecorationsCollection([
        { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: "deep-link-line", linesDecorationsClassName: "deep-link-line-gutter" } },
      ]);
    }, 80);
    return () => clearTimeout(t);
  }, [reveal, tabId, mounted, value]);

  if (!ready) return <div className="flex h-full items-center justify-center text-xs text-muted">Loading editor…</div>;

  return (
    <Editor
      height="100%"
      width="100%"
      path={tabId}
      defaultLanguage={language}
      language={language}
      value={value}
      theme={`wb-${theme}`}
      beforeMount={beforeMount}
      onMount={onMount}
      loading={<div className="text-xs text-muted">Loading editor…</div>}
      options={{
        readOnly: true,
        domReadOnly: true,
        readOnlyMessage: { value: "This workspace is read-only. Use the terminal or Copilot to explore." },
        minimap: { enabled: minimap },
        wordWrap: wordWrap ? "on" : "off",
        fontSize,
        fontFamily: '"Cascadia Code", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
        fontLigatures: true,
        cursorSmoothCaretAnimation: "on",
        cursorBlinking: "smooth",
        smoothScrolling: true,
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 8 },
        lineNumbersMinChars: 3,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
        contextmenu: true,
        stickyScroll: { enabled: false },
      }}
    />
  );
}
