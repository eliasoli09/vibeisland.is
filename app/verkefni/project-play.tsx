"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ProjectEmbed } from "./project-embed";

// Phones and tablets get a preview with a play button that opens the game on its own page:
// an inline game there would swallow the swipes people use to scroll the project list.
const PHONE_QUERY = "(pointer: coarse), (max-width: 767px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
const serverIsPhone = () => true; // render the light preview first; desktops swap to the game after hydration

type ProjectPlayProps = {
  slug: string;
  href: string;
  src: string;
  title: string;
  preview: string;
  previewAlt: string;
};

export function ProjectPlay({ slug, href, src, title, preview, previewAlt }: ProjectPlayProps) {
  const phone = useSyncExternalStore(subscribe, isPhone, serverIsPhone);

  if (!phone) {
    return <ProjectEmbed src={src} title={`${title} - spilaðu hér`} loading="lazy" />;
  }

  return (
    <div className="relative h-full w-full">
      <Image src={preview} alt={previewAlt} fill sizes="100vw" className="object-cover opacity-70" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
        <Link
          href={href}
          data-play={slug}
          className="inline-flex h-16 items-center gap-3 rounded border border-mint bg-mint px-8 font-mono text-sm font-black uppercase tracking-[0.14em] text-black shadow-[0_0_40px_rgba(74,222,128,0.35)] transition hover:bg-mint-soft"
        >
          <Play className="size-5 fill-current" />
          Spila
        </Link>
      </div>
    </div>
  );
}
