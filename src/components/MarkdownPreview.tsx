"use client";

import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { withBase } from "@/lib/paths";
import { getTheme } from "@/lib/themes";
import { useWorkbench } from "@/lib/store";
import type { Tab } from "@/lib/types";

interface Base {
  account: string;
  repo: string;
  sha: string;
  branch: string;
  dir: string;
}

let currentBase: Base | null = null;
let hooked = false;

function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      } else if (currentBase && href) {
        try {
          node.setAttribute("href", new URL(href, `https://github.com/${currentBase.account}/${currentBase.repo}/blob/${currentBase.branch}/${currentBase.dir}`).toString());
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        } catch {
          node.removeAttribute("href");
        }
      }
    }
    if (node.tagName === "IMG" && currentBase) {
      const src = node.getAttribute("src") ?? "";
      if (src && !/^(https?:|data:)/i.test(src)) {
        try {
          node.setAttribute("src", new URL(src, `https://raw.githubusercontent.com/${currentBase.account}/${currentBase.repo}/${currentBase.sha}/${currentBase.dir}`).toString());
        } catch {
          node.removeAttribute("src");
        }
      }
      node.setAttribute("loading", "lazy");
    }
  });
}

export const baseForTab = (tab: Tab): Base | null =>
  tab.kind === "github" && tab.account && tab.repo && tab.sha
    ? { account: tab.account, repo: tab.repo, sha: tab.sha, branch: tab.branch ?? "main", dir: tab.path.includes("/") ? tab.path.slice(0, tab.path.lastIndexOf("/") + 1) : "" }
    : null;

/** GitHub-flavoured preview: marked -> DOMPurify -> github-markdown-css (light/dark chosen by theme). */
export function MarkdownPreview({ content, base }: { content: string; base: Base | null }) {
  const kind = getTheme(useWorkbench((s) => s.theme)).kind;
  const [cssReady, setCssReady] = useState(false);

  useEffect(() => {
    let link = document.getElementById("gh-md-css") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "gh-md-css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const href = withBase(`/vendor/github-markdown-${kind}.css`);
    if (!link.href.endsWith(href)) link.href = href;
    setCssReady(true);
  }, [kind]);

  const html = useMemo(() => {
    ensureHooks();
    currentBase = base;
    const raw = marked.parse(content, { async: false, gfm: true }) as string;
    const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });
    currentBase = null;
    return clean;
  }, [content, base]);

  return (
    <div className="h-full overflow-auto bg-editor" data-ready={cssReady}>
      <article className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ImagePreview({ url, fallbackUrl, name }: { url: string; fallbackUrl: string; name: string }) {
  const [src, setSrc] = useState(url);
  const [dims, setDims] = useState<string>("");
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto p-6" style={{ backgroundImage: "repeating-conic-gradient(rgba(128,128,128,.15) 0% 25%, transparent 0% 50%)", backgroundSize: "20px 20px" }}>
      {failed ? (
        <div className="rounded bg-widget p-4 text-sm text-muted">Could not load image. <a className="text-link underline" href={url} target="_blank" rel="noopener noreferrer">Open raw source</a></div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="max-h-full max-w-full object-contain shadow-lg"
          onLoad={(e) => setDims(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)}
          onError={() => (src === url ? setSrc(fallbackUrl) : setFailed(true))}
        />
      )}
      <div className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">{name}{dims && ` · ${dims}`}</div>
    </div>
  );
}
