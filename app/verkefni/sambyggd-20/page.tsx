import type { Metadata } from "next";
import { TourViewer } from "./tour-viewer";

export const metadata: Metadata = {
  title: "Sambyggð 20 · Myndaganga | Vibe Ísland",
  description:
    "Gagnvirk myndaganga um rými Sambyggðar 20, með ljósmyndum úr fasteignaauglýsingu og grunnmynd íbúðar 0305.",
};

export default function SambyggdPage() {
  return <TourViewer />;
}
