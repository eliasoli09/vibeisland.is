export type Project = {
  number: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  viewerPath: string;
  preview: string;
  previewAlt: string;
  status: string;
  tags: readonly string[];
};

export const projects: readonly Project[] = [
  {
    number: "01",
    slug: "vallaeyjar",
    title: "Vallaeyjar",
    description:
      "Þrívíður heimur þar sem íslenskir fótboltavellir svífa á eyjum í geimnum. Skoðaðu íslenska knattspyrnuvelli, þar á meðal Laugardalsvöll, úr sæti, fljúgðu frjálst og bættu við þínum eigin völlum.",
    href: "/verkefni/vallaeyjar",
    viewerPath: "/projects/vallaeyjar/viewer.html",
    preview: "/projects/vallaeyjar/preview.png",
    previewAlt: "Kaplakriki á svífandi eyju í Vallaeyjum",
    status: "Gagnvirkt 3D verkefni",
    tags: ["Three.js", "Fótbolti", "Ísland"],
  },
  {
    number: "02",
    slug: "pixel-pong",
    title: "Pixel Pong",
    description:
      "Borðtennis í þrívídd þar sem Claude Code krabbinn mætir Codex skýjavélmenninu. Veldu þinn leikmann, stýrðu spaðanum með músinni og sigraðu gervigreindina í fyrsta að 7.",
    href: "/verkefni/pixel-pong",
    viewerPath: "/projects/pixel-pong/game.html",
    preview: "/projects/pixel-pong/preview.png",
    previewAlt: "Claude krabbinn og Codex vélmennið spila borðtennis á neon borði",
    status: "Gagnvirkur 3D leikur",
    tags: ["Three.js", "Leikur", "Gervigreind"],
  },
];

export function getProjectBySlug(slug: string): Project {
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    throw new Error(`Project metadata is missing for slug: ${slug}`);
  }

  return project;
}
