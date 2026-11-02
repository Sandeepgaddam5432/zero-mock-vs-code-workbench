import { portfolioConfig } from "../../portfolio.config";
import type { Manifest } from "./types";

export function buildResumeMarkdown(manifest: Manifest | null): string {
  const p = portfolioConfig.profile;
  const lines: string[] = [];
  lines.push(`# ${p.name}`, "", `**${p.role}**`, "", ...p.bio, "");
  lines.push("## Contact", "", `- Email: ${p.contact.email}`, `- GitHub: ${p.contact.github}`, `- LinkedIn: ${p.contact.linkedin}`, `- Twitter: ${p.contact.twitter}`, "");
  lines.push("## Skills", "");
  for (const [k, v] of Object.entries(portfolioConfig.skills)) lines.push(`- **${k}**: ${v.join(", ")}`);
  lines.push("", "## Experience", "");
  for (const e of portfolioConfig.experience) {
    lines.push(`### ${e.role} (${e.period})`, "");
    e.highlights.forEach((h) => lines.push(`- ${h}`));
    lines.push("");
  }
  const repos = (manifest?.accounts ?? []).flatMap((a) => a.repos).sort((a, b) => b.stars - a.stars).slice(0, 8);
  if (repos.length) {
    lines.push("## Selected Projects", "");
    repos.forEach((r) => lines.push(`- [${r.name}](${r.htmlUrl})${r.language ? ` (${r.language})` : ""}${r.stars ? ` ★${r.stars}` : ""}${r.description ? ` - ${r.description}` : ""}`));
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadResume(manifest: Manifest | null): string {
  const name = `${portfolioConfig.profile.name.replace(/\s+/g, "_")}_Resume.md`;
  const blob = new Blob([buildResumeMarkdown(manifest)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}
