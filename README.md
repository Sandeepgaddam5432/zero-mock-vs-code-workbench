# VS Code Web Workbench — Portfolio

A living, pixel-faithful Visual Studio Code workbench as a portfolio: Monaco editor, xterm.js terminal, draggable split panes,
official Codicons, a BYOK Copilot, a recruiter view and deep links — all client-side over static JSON.

## Identity

Defaults to `Sandeepgaddam5432`. Override at build time:

```bash
NEXT_PUBLIC_GITHUB_USERNAME=octocat npm run build
NEXT_PUBLIC_GITHUB_ACCOUNTS=octocat,torvalds npm run build   # several accounts
```

Edit `portfolio.config.ts` for profile text, skills, experience, pinned repos and virtual files.

## Build pipeline

`npm run build` = `tsx scripts/sync-github.ts && next build`.

The sync script resolves accounts, pins every repo to its latest commit SHA and writes
`public/data/manifest.json` plus `public/data/trees/[account]-[repo].json` (noise, lockfiles, images and files > 500 KB stripped).
It also self-hosts Monaco (`public/monaco/vs`) and `github-markdown-css` so the runtime has no CDN dependency.

Rate-limit resilience: commit SHAs come from git smart-HTTP (no API quota), trees fall back to the jsDelivr data API, and if
everything fails the previous `public/data` is reused — the build never fails because of GitHub. In CI, `GITHUB_TOKEN` is used automatically.

## Static export

```bash
npm run build:static   # STATIC_EXPORT=1 -> output: 'export' -> ./out
```

The default `npm run build` produces a standard Next build (so `next start` and the `/api/health` check work in hosted previews);
the app code is identical in both modes. A GitHub Pages workflow is included in `.github/workflows/deploy.yml`.

## Runtime

- Files load from `raw.githubusercontent.com/<account>/<repo>/<sha>/<path>` (fallback: jsDelivr), cached in IndexedDB under `<sha>:<path>`.
- Deep links: `/#/:account/:repo/:filePath[:line]`, `/#/~/README.md`, `/#/recruiter`.
- Mobile (< 768px): Shiki read-only viewer instead of Monaco, bottom navigation, slide-over explorer, tappable terminal chips.
- Copilot: Zero-Key semantic assistant by default; BYOK for OpenAI-compatible (Groq, DeepSeek, OpenRouter, Mistral, Ollama), Anthropic and Gemini.
  Keys live in `sessionStorage` (opt-in `localStorage`) and are only sent to the provider you configure.
