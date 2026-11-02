import { portfolioConfig } from "../../portfolio.config";
import { App } from "@/components/App";

export default function HomePage() {
  const { profile, skills, experience } = portfolioConfig;
  return (
    <>
      {/* Crawlable, semantic summary for SEO / no-JS visitors. The interactive workbench mounts on top of it. */}
      <section className="sr-only" aria-label="Portfolio summary">
        <h1>
          {profile.name} — {profile.role}
        </h1>
        {profile.bio.map((b) => (
          <p key={b}>{b}</p>
        ))}
        <h2>Skills</h2>
        <ul>
          {Object.entries(skills).map(([k, v]) => (
            <li key={k}>
              {k}: {v.join(", ")}
            </li>
          ))}
        </ul>
        <h2>Experience</h2>
        <ul>
          {experience.map((e) => (
            <li key={e.role}>
              {e.role} ({e.period}): {e.highlights.join("; ")}
            </li>
          ))}
        </ul>
        <a href={profile.contact.github}>GitHub</a>
      </section>
      <App />
    </>
  );
}
