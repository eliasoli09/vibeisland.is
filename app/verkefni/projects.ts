export type Project = {
  number: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  viewerPath: string;
  preview: string;
  status: string;
  tags: readonly string[];
};

export const projects: readonly Project[] = [
  {
    number: "01",
    slug: "vallaeyjar",
    title: "Vallaeyjar",
    description:
      "Þrívíður heimur þar sem íslenskir fótboltavellir svífa á eyjum í geimnum. Skoðaðu Kaplakrika, Víkingsvöll og Hlíðarenda úr sæti, fljúgðu frjálst og bættu við þínum eigin völlum.",
    href: "/verkefni/vallaeyjar",
    viewerPath: "/projects/vallaeyjar/viewer.html",
    preview: "/projects/vallaeyjar/preview.png",
    status: "Gagnvirkt 3D verkefni",
    tags: ["Three.js", "Fótbolti", "Ísland"],
  },
];

export function getProjectBySlug(slug: string): Project {
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    throw new Error(`Project metadata is missing for slug: ${slug}`);
  }

  return project;
}
