"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "@/lib/store";
import { Codicon } from "./Codicon";
import { FileIcon } from "./FileIcon";

export function TabsBar({ mobile = false }: { mobile?: boolean }) {
  const tabs = useWorkbench((s) => s.tabs);
  const activeTabId = useWorkbench((s) => s.activeTabId);
  const setActiveTab = useWorkbench((s) => s.setActiveTab);
  const closeTab = useWorkbench((s) => s.closeTab);
  const pinTab = useWorkbench((s) => s.pinTab);
  const moveTab = useWorkbench((s) => s.moveTab);
  const wordWrap = useWorkbench((s) => s.wordWrap);
  const setWordWrap = useWorkbench((s) => s.setWordWrap);
  const toggleSplit = useWorkbench((s) => s.toggleSplit);
  const splitPreview = useWorkbench((s) => s.splitPreview);
  const closeAll = useWorkbench((s) => s.closeAll);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  const active = tabs.find((t) => t.id === activeTabId);
  const isMd = !!active && /\.(md|mdx|markdown)$/i.test(active.path);

  return (
    <div className="flex h-[35px] shrink-0 bg-tab" role="tablist" aria-label="Open editors">
      <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t, i) => {
          const isActive = t.id === activeTabId;
          return (
            <div
              key={t.id}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              draggable
              title={t.kind === "github" ? `${t.account}/${t.repo}/${t.path}` : t.path}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", t.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== i) setDragOver(i);
              }}
              onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) moveTab(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onClick={() => setActiveTab(t.id)}
              onDoubleClick={() => pinTab(t.id)}
              onMouseDown={(e) => {
                if (e.button === 1) e.preventDefault(); // stop browser autoscroll
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(t.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActiveTab(t.id);
              }}
              className={`group relative flex h-[35px] min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-line pl-3 pr-1.5 text-[13px] ${
                isActive ? "bg-tabactive text-bright" : "text-muted hover:text-fg"
              } ${dragOver === i && dragFrom !== i ? "outline outline-1 -outline-offset-1 outline-accent" : ""} ${dragFrom === i ? "opacity-50" : ""}`}
              style={isActive ? { boxShadow: "inset 0 1px 0 var(--accent)" } : undefined}
            >
              <FileIcon name={t.title} size={15} />
              <span className={`max-w-[160px] truncate ${t.preview ? "italic" : ""}`}>{t.title}</span>
              <button
                type="button"
                aria-label={`Close ${t.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                className={`ml-1 flex h-5 w-5 items-center justify-center rounded hover:bg-white/15 ${isActive || mobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <Codicon name="close" size={14} />
              </button>
            </div>
          );
        })}
        <div
          className="min-w-4 flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null) moveTab(dragFrom, tabs.length - 1);
            setDragFrom(null);
            setDragOver(null);
          }}
        />
      </div>
      {tabs.length > 0 && !mobile && (
        <div className="flex shrink-0 items-center gap-0.5 px-2 text-muted">
          {isMd && active && (
            <button type="button" title="Open Preview to the Side" aria-label="Toggle split preview" aria-pressed={!!splitPreview[active.id]} onClick={() => toggleSplit(active.id)} className={`rounded p-1 hover:bg-white/10 hover:text-bright ${splitPreview[active.id] ? "bg-white/10 text-bright" : ""}`}>
              <Codicon name="open-preview" size={16} />
            </button>
          )}
          <button type="button" title="Toggle Word Wrap (Alt+Z)" aria-label="Toggle word wrap" aria-pressed={wordWrap} onClick={() => setWordWrap(!wordWrap)} className={`rounded p-1 hover:bg-white/10 hover:text-bright ${wordWrap ? "bg-white/10 text-bright" : ""}`}>
            <Codicon name="word-wrap" size={16} />
          </button>
          <button type="button" title="Close All Editors" aria-label="Close all editors" onClick={closeAll} className="rounded p-1 hover:bg-white/10 hover:text-bright">
            <Codicon name="clear-all" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
