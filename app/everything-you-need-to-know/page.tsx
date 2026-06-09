import type { Metadata } from "next";
import { GuidePage, guides } from "../guide-content";

export const metadata: Metadata = {
  title: "Everything you need to know — Vibe Iceland",
  description: "A scroll-friendly overview of Vibe Iceland 2026.",
};

export default function EverythingYouNeedToKnowPage() {
  return <GuidePage guide={guides.en} />;
}
