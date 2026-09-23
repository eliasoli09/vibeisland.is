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
    slug: "sambyggd-20",
    title: "Sambyggð 20",
    description:
      "Gakktu milli raunverulegra ljósmynda úr fasteignaauglýsingu, skoðaðu rýmin á grunnmynd og kynntu þér hvað heimildirnar sýna.",
    href: "/verkefni/sambyggd-20",
    viewerPath: "/verkefni/sambyggd-20",
    preview: "/projects/sambyggd-20/living-one.jpg",
    previewAlt: "Björt stofa með gluggum, setusvæði og borðkrók úr auglýsingu Sambyggðar 20",
    status: "Gagnvirk myndaganga",
    tags: ["Fasteignir", "Myndaganga", "Grunnmynd"],
  },
];

export function getProjectBySlug(slug: string): Project {
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    throw new Error(`Project metadata is missing for slug: ${slug}`);
  }

  return project;
}
