import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@vscode/codicons/dist/codicon.css";
import "./globals.css";
import { portfolioConfig } from "../../portfolio.config";

const { profile } = portfolioConfig;

export const metadata: Metadata = {
  title: `${profile.name} — ${profile.role}`,
  description: `${profile.bio.join(" ")}`,
  openGraph: {
    title: `${profile.name} — Portfolio Workbench`,
    description: profile.bio[0],
    type: "website",
  },
  authors: [{ name: profile.name, url: profile.contact.github }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e1e1e",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
