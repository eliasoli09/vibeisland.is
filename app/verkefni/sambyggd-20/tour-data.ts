export type TourStation = {
  id: string;
  title: string;
  kicker: string;
  image: string;
  alt: string;
  planX: number;
  planY: number;
  provenance: "listing-reference-0105";
};

const root = "/projects/sambyggd-20";

// The interior photos in the source listing have "ibud0105" filenames; the plan is 0305.
// Positions locate the type of room on the 0305 plan, not the camera in 0105.
export const stations: readonly TourStation[] = [
  {
    id: "anddyri", title: "Anddyri", kicker: "01 / Komdu inn",
    image: `${root}/hall.jpg`,
    alt: "Ljósmynd úr auglýsingu af björtu anddyri með dökkri viðarinnréttingu og hvítum hurðum.",
    planX: 29, planY: 10, provenance: "listing-reference-0105",
  },
  {
    id: "stofa", title: "Stofa", kicker: "02 / Dagsbirtan",
    image: `${root}/living-one.jpg`,
    alt: "Ljósmynd úr auglýsingu af stofu með stórum gluggum, setusvæði og borðkrók.",
    planX: 69, planY: 77, provenance: "listing-reference-0105",
  },
  {
    id: "stofa-annad", title: "Stofa · annað sjónarhorn", kicker: "03 / Rýmið",
    image: `${root}/living-two.jpg`,
    alt: "Ljósmynd úr auglýsingu af sömu stofu frá eldhúsi í átt að setusvæði og gluggum.",
    planX: 70, planY: 83, provenance: "listing-reference-0105",
  },
  {
    id: "eldhus", title: "Eldhús", kicker: "04 / Efni og áferð",
    image: `${root}/kitchen.jpg`,
    alt: "Ljósmynd úr auglýsingu af eldhúsi með dökkum viðarskápum og ljósri borðplötu.",
    planX: 25, planY: 62, provenance: "listing-reference-0105",
  },
  {
    id: "herbergi", title: "Herbergi", kicker: "05 / Innréttingar",
    image: `${root}/wardrobe.jpg`,
    alt: "Ljósmynd úr auglýsingu af herbergi með dökkum fataskápum, glugga og ljósum veggjum.",
    planX: 76, planY: 35, provenance: "listing-reference-0105",
  },
  {
    id: "bad", title: "Baðherbergi", kicker: "06 / Smáatriðin",
    image: `${root}/bath-one.jpg`,
    alt: "Ljósmynd úr auglýsingu af baðherbergi með hvítum vaski, spegli og þvottavélum.",
    planX: 24, planY: 37, provenance: "listing-reference-0105",
  },
  {
    id: "bad-annad", title: "Bað · annað sjónarhorn", kicker: "07 / Frágangur",
    image: `${root}/bath-two.jpg`,
    alt: "Ljósmynd úr auglýsingu af baðherbergi frá öðru sjónarhorni, með innréttingu og þvottavélum.",
    planX: 24, planY: 40, provenance: "listing-reference-0105",
  },
];

export function getNextStation(currentId: string, direction: 1 | -1): TourStation {
  const index = stations.findIndex((station) => station.id === currentId);
  const currentIndex = index < 0 ? 0 : index;
  return stations[(currentIndex + direction + stations.length) % stations.length];
}
