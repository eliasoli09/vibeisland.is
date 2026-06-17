import Link from "next/link";

type Guide = {
  label: string;
  title: string;
  subtitle: string;
  backLabel: string;
  switchLabel: string;
  switchHref: string;
  sections: Array<{
    eyebrow: string;
    title: string;
    body: string;
  }>;
};

export const guides = {
  en: {
    label: "Everything you need to know",
    title: "Everything you need to know",
    subtitle:
      "A scroll-friendly overview of Vibe Iceland, Iceland's first AI and vibe coding hackathon for high school students.",
    backLabel: "Back to Vibe Iceland",
    switchLabel: "Lesa á íslensku",
    switchHref: "/allt-sem-thu-tharft-ad-vita",
    sections: [
      {
        eyebrow: "01",
        title: "What is Vibe Iceland?",
        body: "Vibe Iceland is Iceland's first AI and vibe coding hackathon for high school students. Over one weekend, participants will work on real projects with the help of artificial intelligence, receive guidance from mentors, and present their solutions to a judging panel.",
      },
      {
        eyebrow: "02",
        title: "Participants",
        body: "The participants of Vibe Iceland are ambitious high school students who are interested in technology, innovation, and the future. Through the event, we want to give them the opportunity to build real solutions with the help of artificial intelligence, learn from mentors from the business world, and meet other young people who want to create, build, and make an impact.",
      },
      {
        eyebrow: "03",
        title: "What to Expect",
        body: "Over three days, participants will work in teams to develop ideas into real solutions with the help of artificial intelligence. They will receive guidance from mentors from the business world, take part in workshops, meet other ambitious young people, and present their projects to a judging panel at the end of the event. The goal is to learn, create, and experience how an idea can become reality in a single weekend.",
      },
      {
        eyebrow: "04",
        title: "Future vision",
        body: "Vibe Iceland is only the beginning. The goal is to build an annual event that becomes the largest platform for young people in Iceland in the fields of artificial intelligence, innovation, and entrepreneurship. In the coming years, we aim to increase the number of participants, bring more companies and mentors on board, and create connections with the international innovation community. In the long term, we want Vibe Iceland to become the place where the next generation of Icelandic entrepreneurs, founders, and technology leaders meet, learn, and build ideas that can have an impact far beyond Iceland.",
      },
      {
        eyebrow: "05",
        title: "Location",
        body: "The location for Vibe Iceland 2026 is TBA. We will announce the venue as soon as it is confirmed, and it will be chosen to give participants a strong environment for creating, mentoring, and pitching their projects.",
      },
    ],
  },
  is: {
    label: "Allt sem þú þarft að vita",
    title: "Allt sem þú þarft að vita",
    subtitle:
      "Scroll-væn yfirlitssíða um Vibe Ísland, fyrsta AI og vibe coding hackathon Íslands fyrir menntaskólanema.",
    backLabel: "Til baka á Vibe Ísland",
    switchLabel: "Read in English",
    switchHref: "/everything-you-need-to-know",
    sections: [
      {
        eyebrow: "01",
        title: "Hvað er Vibe Ísland?",
        body: "Vibe Ísland er fyrsta AI og vibe coding hackathon Íslands fyrir menntaskólanema. Yfir eina helgi vinna þátttakendur að raunverulegum verkefnum með hjálp gervigreindar, fá leiðsögn frá mentorum og kynna lausnir sínar fyrir dómnefnd.",
      },
      {
        eyebrow: "02",
        title: "Þátttakendur",
        body: "Þátttakendur Vibe Íslands eru metnaðarfullir menntaskólanemar sem hafa áhuga á tækni, nýsköpun og framtíðinni. Með viðburðinum viljum við gefa þeim tækifæri til að byggja raunverulegar lausnir með hjálp gervigreindar, læra af mentorum úr atvinnulífinu og kynnast öðrum ungmennum sem vilja skapa, byggja og hafa áhrif.",
      },
      {
        eyebrow: "03",
        title: "Við hverju má búast?",
        body: "Yfir þrjá daga munu þátttakendur vinna í teymum að því að þróa hugmyndir í raunverulegar lausnir með hjálp gervigreindar. Þeir fá leiðsögn frá mentorum úr atvinnulífinu, taka þátt í vinnustofum, kynnast öðrum metnaðarfullum ungmennum og kynna verkefni sín fyrir dómnefnd í lok viðburðarins. Markmiðið er að læra, skapa og upplifa hvernig hugmynd getur orðið að veruleika á einni helgi.",
      },
      {
        eyebrow: "04",
        title: "Framtíðarsýn",
        body: "Vibe Ísland er aðeins byrjunin. Markmiðið er að byggja upp árlegan viðburð sem verður stærsti vettvangur ungs fólks á Íslandi fyrir gervigreind, nýsköpun og frumkvöðlastarf. Á næstu árum stefnum við að því að fjölga þátttakendum, fá fleiri fyrirtæki og mentora að borðinu og skapa tengingar við alþjóðlegt nýsköpunarsamfélag. Til lengri tíma litið viljum við að Vibe Ísland verði staðurinn þar sem næsta kynslóð íslenskra frumkvöðla, stofnenda og tæknileiðtoga hittist, lærir og byggir hugmyndir sem geta haft áhrif langt út fyrir landsteinana.",
      },
      {
        eyebrow: "05",
        title: "Staðsetning",
        body: "Staðsetning Vibe Íslands 2026 er TBA. Við tilkynnum staðinn um leið og hann er staðfestur, og hann verður valinn með það í huga að þátttakendur fái gott umhverfi til að skapa, fá leiðsögn og kynna verkefnin sín.",
      },
    ],
  },
} as const satisfies Record<string, Guide>;

export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <section className="relative isolate border-b border-mint/10 px-6 py-8 sm:px-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(74,222,128,0.28),transparent_34rem)]" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-45" />
        <nav className="mx-auto flex max-w-6xl flex-col gap-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/62 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="transition hover:text-mint">
            {guide.backLabel}
          </Link>
          <Link href={guide.switchHref} className="text-mint transition hover:text-mint-soft">
            {guide.switchLabel}
          </Link>
        </nav>
        <div className="mx-auto flex min-h-[54vh] max-w-6xl flex-col justify-center py-20">
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.26em] text-mint">Vibe Ísland 2026</p>
          <h1 className="mt-7 max-w-4xl text-5xl font-medium leading-[0.98] tracking-tight text-white sm:text-7xl">
            {guide.title}
          </h1>
          <p className="mt-8 max-w-2xl font-mono text-sm leading-7 text-white/62 sm:text-base">{guide.subtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <div className="grid gap-5">
          {guide.sections.map((section) => (
            <article
              key={section.title}
              className="grid gap-8 border-b border-mint/12 py-10 md:grid-cols-[0.22fr_0.78fr]"
            >
              <p className="font-mono text-4xl text-mint">{section.eyebrow}</p>
              <div>
                <h2 className="text-3xl font-medium leading-tight text-white sm:text-4xl">{section.title}</h2>
                <p className="mt-5 max-w-3xl font-mono text-sm leading-8 text-white/68 sm:text-base">{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
