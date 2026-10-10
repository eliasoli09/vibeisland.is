import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mouse } from "lucide-react";
import { getProjectBySlug } from "../projects";
import { ProjectEmbed } from "../project-embed";
import { OpenInBrowser } from "./open-in-browser";

const project = getProjectBySlug("pixel-pong");

export const metadata: Metadata = {
  title: "Pixel Pong | Verkefni | Vibe Ísland",
  description: project.description,
};

// An online invite (/verkefni/pixel-pong?join=KRAB) passes its room code on to the game.
export default async function PixelPongPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const join = (await searchParams).join;
  const code = typeof join === "string" && /^[a-zA-Z]{4}$/.test(join) ? join.toUpperCase() : null;
  const src = code ? `${project.viewerPath}?join=${code}` : project.viewerPath;
  return (
    <main lang="is" className="flex h-dvh flex-col bg-black text-white">
      <header className="shrink-0 border-b border-mint/15 bg-black px-4 py-2.5 sm:px-6 sm:py-4 lg:px-8">
        <div className="mx-auto flex max-w-[112rem] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/verkefni"
              className="group inline-flex shrink-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 transition hover:text-mint"
            >
              <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
              Til baka í verkefni
            </Link>
            <span className="h-7 w-px bg-mint/20" />
            <div>
              <h1 className="text-lg font-semibold leading-none">{project.title}</h1>
              <p className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-mint/70 sm:block">{project.status}</p>
            </div>
          </div>

          <p className="hidden max-w-2xl items-start gap-3 text-xs leading-5 text-white/52 sm:flex sm:text-right">
            <Mouse className="mt-0.5 size-4 shrink-0 text-mint" />
            <span>
              Veldu borðtennis, lofthokkí, blak, 9 holu neon-mínígolf eða pool (8-ball), einn á móti einum eða tveir á móti tveimur með gervigreindar-liðsfélaga, á móti gervigreind eða vini á netinu. Hreyfðu músina til að stýra spaðanum eða kylfunni. Smelltu rétt þegar boltinn kemur að spaðanum til að gefa honum snúning, og þrír snúningar í röð gefa boost. Í blaki ertu sjálfur leikmaðurinn: hlauptu undir boltann til að senda hann til baka og smelltu til að stökkva og smassa við netið. Í pool miðarðu með músinni og ýtir, dregur til baka og sleppir til að skjóta. <kbd>Bil</kbd> setur leikinn á pásu og <kbd>M</kbd> slekkur á hljóði.
            </span>
          </p>
        </div>
      </header>

      {/* on phones the game takes the whole screen below a slim header */}
      <section aria-label="Pixel Pong leikur" className="min-h-0 flex-1 sm:min-h-[520px]">
        <ProjectEmbed src={src} title="Pixel Pong - Claude á móti Codex" />
      </section>
      {code ? <OpenInBrowser /> : null}
    </main>
  );
}
