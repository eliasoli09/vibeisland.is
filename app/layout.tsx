import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe Ísland — Iceland's First Vibe Coding Hackathon",
  description:
    "21-23 August 2026 · Reykjavík, Iceland · A bilingual AI and vibe coding hackathon for high school students.",
  openGraph: {
    title: "Vibe Ísland",
    description:
      "Iceland's first AI hackathon for high school students. August 21–23, 2026 · Reykjavík.",
    siteName: "Vibe Ísland",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
