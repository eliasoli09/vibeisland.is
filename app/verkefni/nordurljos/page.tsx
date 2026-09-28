import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getProjectBySlug } from "../projects";
import { ProjectEmbed } from "../project-embed";

const project = getProjectBySlug("nordurljos");

export const metadata: Metadata = {
  title: "Norðurljós | Verkefni | Vibe Ísland",
  description: project.description,
};

export default function NordurljosPage() {
  return (
    <main lang="is" className="flex h-dvh flex-col bg-black text-white">
      <header className="shrink-0 border-b border-mint/15 bg-black px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[112rem] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/verkefni"
              className="group inline-flex shrink-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 transition hover:text-mint"
            >
              <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
              Til baka í verkefni
            </Link>
            <span className="hidden h-7 w-px bg-mint/20 sm:block" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold leading-none">{project.title}</h1>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-mint/70">{project.status}</p>
            </div>
          </div>

          <p className="flex max-w-2xl items-start gap-3 text-xs leading-5 text-white/52 sm:text-right">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-mint" />
            <span>
              Skrunaðu niður í gegnum ferðalagið frá sólinni. Dragðu himininn til að líta í kringum þig og prófaðu sleðana í hverjum kafla.
            </span>
          </p>
        </div>
      </header>

      <section aria-label="Norðurljós gagnvirk síða" className="min-h-[560px] flex-1">
        <ProjectEmbed src={project.viewerPath} title="Norðurljós - gagnvirk vísindasíða um norðurljósin" />
      </section>
    </main>
  );
}
