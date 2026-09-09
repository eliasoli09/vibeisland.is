import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database, FileDown } from "lucide-react";
import { getProjectBySlug } from "../projects";
import { VallaeyjarViewer } from "./vallaeyjar-viewer";

const project = getProjectBySlug("vallaeyjar");

export const metadata: Metadata = {
  title: "Vallaeyjar | Verkefni | Vibe Ísland",
  description: project.description,
};

export default function VallaeyjarPage() {
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
            <Database className="mt-0.5 size-4 shrink-0 text-mint" />
            <span>Eyjur vistast aðeins í þínum vafra og birtast ekki sjálfkrafa hjá öðrum. Deildu völlum með því að sækja og senda <code>.stadium</code>-skrár.</span>
            <FileDown className="mt-0.5 hidden size-4 shrink-0 text-mint/60 lg:block" />
          </p>
        </div>
      </header>

      <section aria-label="Vallaeyjar þrívíddarskoðari" className="min-h-[600px] flex-1 sm:min-h-[500px]">
        <VallaeyjarViewer viewerPath={project.viewerPath} />
      </section>
    </main>
  );
}
