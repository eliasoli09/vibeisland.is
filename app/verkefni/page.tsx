import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { projects } from "./projects";

export const metadata: Metadata = {
  title: "Verkefni | Vibe Ísland",
  description: "Gagnvirk verkefni frá Vibe Ísland.",
};

export default function ProjectsPage() {
  return (
    <main lang="is" className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-45" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_50%_0%,rgba(74,222,128,0.18),transparent_66%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between border-b border-mint/15 pb-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 transition hover:text-mint"
          >
            <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
            Vibe Ísland
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint">
            {String(projects.length).padStart(2, "0")} verkefni
          </span>
        </nav>

        <header className="grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_0.65fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-mint">
              Byggt með hugmyndaflugi
            </p>
            <h1 className="mt-5 text-5xl font-semibold uppercase text-white sm:text-7xl">Verkefni</h1>
          </div>
          <p className="max-w-xl text-base leading-7 text-white/58 lg:justify-self-end">
            Gagnvirkar hugmyndir og tilraunir frá íslenskum smiðum. Opnaðu verkefni og prófaðu þau beint í vafranum.
          </p>
        </header>

        <section aria-label="Verkefnalisti" className="border-t border-mint/15 pb-20">
          {projects.map((project) => (
            <article
              key={project.slug}
              className="group grid gap-0 border-b border-mint/15 lg:grid-cols-[0.78fr_1.22fr]"
            >
              <div className="flex min-h-80 flex-col justify-between p-6 sm:p-9 lg:min-h-[30rem]">
                <div className="flex items-start justify-between gap-5">
                  <span className="font-mono text-xs font-bold tracking-[0.2em] text-mint">{project.number}</span>
                  <span className="border border-mint/25 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55">
                    {project.status}
                  </span>
                </div>

                <div className="py-12">
                  <h2 className="text-4xl font-medium text-white sm:text-5xl">{project.title}</h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-white/58">{project.description}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[10px] uppercase tracking-[0.16em] text-mint/72"
                      >
                        + {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={project.href}
                  className="inline-flex h-13 w-fit items-center gap-8 rounded border border-mint bg-mint px-6 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-black shadow-[0_0_28px_rgba(74,222,128,0.18)] transition hover:bg-mint-soft"
                >
                  Opna verkefni
                  <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="relative min-h-80 overflow-hidden border-t border-mint/15 bg-black lg:min-h-[30rem] lg:border-l lg:border-t-0">
                <Image
                  src={project.preview}
                  alt={project.previewAlt}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-contain"
                />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
