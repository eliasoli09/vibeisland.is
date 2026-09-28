import type { Metadata } from "next";
import { getProjectBySlug } from "../projects";
import { ProjectEmbed } from "../project-embed";

const project = getProjectBySlug("svefnvelin");

export const metadata: Metadata = {
  title: "Svefnvélin | Verkefni | Vibe Ísland",
  description: project.description,
};

export default function SvefnvelinPage() {
  return (
    <main lang="is" className="h-dvh w-full overflow-hidden">
      <ProjectEmbed src={project.viewerPath} title="Svefnvélin" />
    </main>
  );
}
