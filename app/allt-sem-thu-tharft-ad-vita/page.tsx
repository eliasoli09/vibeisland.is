import type { Metadata } from "next";
import { GuidePage, guides } from "../guide-content";

export const metadata: Metadata = {
  title: "Allt sem þú þarft að vita — Vibe Ísland",
  description: "Scroll-vænt yfirlit um Vibe Ísland 2026.",
};

export default function AlltSemThuTharftAdVitaPage() {
  return <GuidePage guide={guides.is} />;
}
