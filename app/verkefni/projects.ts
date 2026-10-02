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
  /** Render the live project on the index card instead of the preview image. */
  playInline?: boolean;
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
      "Borðtennis, lofthokkí og blak í þrívídd með fimm gervigreindar-karakterum: Claude, Codex, Muse, Grok og Clawd. Veldu leikham, þinn leikmann og andstæðing, safnaðu boostum, varastu pinnana á borðinu og forðastu slímið.",
    href: "/verkefni/pixel-pong",
    viewerPath: "/projects/pixel-pong/game.html",
    preview: "/projects/pixel-pong/preview.png",
    previewAlt: "Grok og Clawd spila borðtennis á neon borði með pinnum og þremur boltum á lofti",
    status: "Gagnvirkur 3D leikur",
    tags: ["Three.js", "Leikur", "Gervigreind"],
    playInline: true,
  },
  {
    number: "03",
    slug: "nordurljos",
    title: "Norðurljós",
    description:
      "Gagnvirkt ferðalag frá sólinni niður á íslenskan næturhiminn. Sjáðu hvernig norðurljósin myndast, af hverju þau eru græn, rauð og fjólublá, og hvenær og hvar best er að sjá þau á Íslandi.",
    href: "/verkefni/nordurljos",
    viewerPath: "/projects/nordurljos/app.html",
    preview: "/projects/nordurljos/preview.png",
    previewAlt: "Hermd norðurljós yfir íslensku stöðuvatni og fjöllum",
    status: "Gagnvirk vísindasíða",
    tags: ["WebGL", "Vísindi", "Ísland"],
  },
  {
    number: "04",
    slug: "svefnvelin",
    title: "Svefnvélin",
    description:
      "Gagnvirkur íslenskur vefur um svefn og líkamann, byggður á 300 þáttum af Huberman Lab. Skoðaðu þrívíða líffærafræði, prófaðu kreatínhermi með skammta- og tímavali, eða leitaðu í uppskriftum þáttanna.",
    href: "/verkefni/svefnvelin",
    viewerPath: "/projects/svefnvelin/index.html",
    preview: "/projects/svefnvelin/preview.png",
    previewAlt: "Forsíða Svefnvélarinnar með köflum um svefn og líkamann",
    status: "Gagnvirkur fræðsluvefur",
    tags: ["Svefn", "Líkaminn", "Three.js"],
  },
];

export function getProjectBySlug(slug: string): Project {
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    throw new Error(`Project metadata is missing for slug: ${slug}`);
  }

  return project;
}
