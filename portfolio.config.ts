/**
 * Single source of truth for the portfolio identity.
 * Override at build time with NEXT_PUBLIC_GITHUB_ACCOUNTS="a,b" or NEXT_PUBLIC_GITHUB_USERNAME="a".
 */
const resolveAccounts = (): string[] => {
  const envAccounts = process.env.NEXT_PUBLIC_GITHUB_ACCOUNTS;
  const envUser = process.env.NEXT_PUBLIC_GITHUB_USERNAME;
  if (envAccounts && envAccounts.trim()) {
    return envAccounts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (envUser && envUser.trim()) {
    return [envUser.trim()];
  }
  return ["Sandeepgaddam5432"]; // Default Fallback Placeholder
};

const accounts = resolveAccounts();
const primary = accounts[0] ?? "Sandeepgaddam5432";

const skills: Record<string, string[]> = {
  frontend: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
  backend: ["Node.js", "Express", "Go", "PostgreSQL", "MongoDB"],
  devops: ["Docker", "GitHub Actions", "CI/CD", "Vercel"],
  tools: ["Git", "VS Code", "Linux", "Neovim"],
};

const experience = [
  {
    role: "Full Stack Engineer",
    period: "2023 - Present",
    highlights: ["Architected microservices", "Led frontend migrations"],
  },
];

const experienceSource = `export const experience = [\n${experience
  .map(
    (e) =>
      `  {\n    role: ${JSON.stringify(e.role)},\n    period: ${JSON.stringify(e.period)},\n    highlights: [${e.highlights
        .map((h) => JSON.stringify(h))
        .join(", ")}]\n  }`,
  )
  .join(",\n")}\n];`;

export interface PortfolioConfig {
  accounts: string[];
  excludeForks: boolean;
  excludeArchived: boolean;
  /** "repo" or "account/repo" - pinned at the top of the tree view */
  pinnedRepos: string[];
  profile: {
    name: string;
    handle: string;
    role: string;
    bio: string[];
    status: string;
    contact: { email: string; github: string; linkedin: string; twitter: string };
  };
  skills: Record<string, string[]>;
  experience: { role: string; period: string; highlights: string[] }[];
  virtualFiles: Record<string, string>;
}

export const portfolioConfig: PortfolioConfig = {
  accounts,
  excludeForks: true,
  excludeArchived: true,
  pinnedRepos: [], // If set, pins these at the top of the tree view
  profile: {
    name: "Sandeep Gaddam",
    handle: primary,
    role: "Full Stack Engineer & Open Source Contributor",
    bio: [
      "Crafting performant web applications, developer tooling, and distributed systems.",
      "Explore my repositories in this live VS Code environment or run terminal commands.",
    ],
    status: "Open to Work",
    contact: {
      email: "contact@example.com",
      github: `https://github.com/${primary}`,
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
    },
  },
  skills,
  experience,
  virtualFiles: {
    "README.md": `# Sandeep Gaddam\n\nFull Stack Engineer.\nWelcome to my interactive VS Code workspace! Explore my open source repositories, test code in the terminal, or chat with the AI Copilot.`,
    "skills.json": JSON.stringify(skills, null, 2),
    "experience.ts": experienceSource,
    "contact.env": `EMAIL="contact@example.com"\nGITHUB="https://github.com/${primary}"\nSTATUS="Open to Work"`,
  },
};
