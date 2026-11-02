"use client";

import { useMemo, useState } from "react";
import { portfolioConfig } from "../../portfolio.config";
import { applyHash } from "@/lib/deeplink";
import { downloadResume } from "@/lib/resume";
import { allRepos, orderedRepos, useWorkbench } from "@/lib/store";
import { Codicon } from "./Codicon";

const LANG_DOT: Record<string, string> = { TypeScript: "bg-blue-500", JavaScript: "bg-yellow-400", Python: "bg-sky-600", Go: "bg-cyan-500", Rust: "bg-orange-400", HTML: "bg-orange-600", CSS: "bg-indigo-400", Shell: "bg-green-500", Java: "bg-red-500" };

export function RecruiterView() {
  const manifest = useWorkbench((s) => s.manifest);
  const setRecruiter = useWorkbench((s) => s.setRecruiter);
  const [showAll, setShowAll] = useState(false);
  const { profile, skills, experience } = portfolioConfig;
  const repos = useMemo(() => orderedRepos(allRepos(manifest)).sort((a, b) => (portfolioConfig.pinnedRepos.length ? 0 : b.stars - a.stars || (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))), [manifest]);
  const visible = showAll ? repos : repos.slice(0, 9);
  const avatar = manifest?.accounts[0]?.avatarUrl;

  const openInWorkbench = async (account: string, repo: string) => {
    setRecruiter(false);
    await applyHash(`#/${account}/${repo}`);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 text-slate-800 print:static print:overflow-visible">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Codicon name="person" size={18} className="text-blue-600" /> {profile.name}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="hidden rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:block">
              Print / PDF
            </button>
            <button type="button" onClick={() => setRecruiter(false)} className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
              <Codicon name="vscode" size={14} /> Back to Workbench
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={profile.name} width={112} height={112} className="h-28 w-28 rounded-full border-4 border-white shadow-lg" />
          )}
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {profile.status}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">{profile.name}</h1>
            <p className="mt-1 text-lg text-blue-700">{profile.role}</p>
            {profile.bio.map((b) => (
              <p key={b} className="mt-2 max-w-2xl text-slate-600">{b}</p>
            ))}
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => downloadResume(manifest)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
                <Codicon name="cloud-download" size={15} /> Download Resume
              </button>
              <a href={`mailto:${profile.contact.email}`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Email</a>
              <a href={profile.contact.github} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">GitHub</a>
              <a href={profile.contact.linkedin} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">LinkedIn</a>
            </div>
          </div>
        </section>

        <section className="py-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Skills</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(skills).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</div>
                <div className="flex flex-wrap gap-1.5">
                  {v.map((s) => (
                    <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-sm text-slate-700">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Experience</h2>
          <ol className="relative ml-2 border-l-2 border-slate-200">
            {experience.map((e) => (
              <li key={e.role + e.period} className="mb-6 ml-6">
                <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-600" />
                <div className="text-sm text-slate-500">{e.period}</div>
                <h3 className="text-lg font-semibold text-slate-900">{e.role}</h3>
                <ul className="mt-1 list-disc pl-5 text-slate-600">
                  {e.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Projects <span className="text-base font-normal text-slate-500">({repos.length})</span></h2>
            {repos.length > 9 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-blue-700 hover:underline print:hidden">
                {showAll ? "Show fewer" : "Show all"}
              </button>
            )}
          </div>
          {repos.length === 0 && <p className="text-slate-500">Repositories appear here after the GitHub sync (`npm run sync`).</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <article key={`${r.account}/${r.name}`} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="break-all font-semibold text-slate-900">{r.name}</h3>
                  {r.stars > 0 && <span className="flex shrink-0 items-center gap-0.5 text-xs text-slate-500"><Codicon name="star-full" size={12} /> {r.stars}</span>}
                </div>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-600">{r.description ?? "No description provided."}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  {r.language && (
                    <span className="flex items-center gap-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${LANG_DOT[r.language] ?? "bg-slate-400"}`} /> {r.language}
                    </span>
                  )}
                  <code className="rounded bg-slate-100 px-1">{r.commitSha.slice(0, 7)}</code>
                </div>
                <div className="mt-3 flex gap-2 print:hidden">
                  <button type="button" onClick={() => void openInWorkbench(r.account, r.name)} className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700">Open in Workbench</button>
                  <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">GitHub</a>
                  {r.homepage && <a href={r.homepage} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">Live</a>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="py-6">
          <h2 className="mb-3 text-xl font-semibold text-slate-900">Contact</h2>
          <p className="text-slate-600">
            <a className="text-blue-700 hover:underline" href={`mailto:${profile.contact.email}`}>{profile.contact.email}</a> ·{" "}
            <a className="text-blue-700 hover:underline" href={profile.contact.github}>GitHub</a> ·{" "}
            <a className="text-blue-700 hover:underline" href={profile.contact.linkedin}>LinkedIn</a> ·{" "}
            <a className="text-blue-700 hover:underline" href={profile.contact.twitter}>Twitter</a>
          </p>
        </section>
      </main>
    </div>
  );
}
