"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Code2,
  GraduationCap,
  Lightbulb,
  MapPin,
  Menu,
  Pencil,
  Shuffle,
  Rocket,
  Search,
  Star,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

type Lang = "en" | "is";

const copy = {
  en: {
    navLocation: "Reykjavík, Iceland",
    menu: "Menu",
    langLabel: "Skipta yfir á íslensku",
    eyebrow: "Iceland's First Vibe Coding Hackathon",
    date: "21 - 23 August 2026",
    city: "Reykjavík",
    apply: "Apply Now",
    partner: "Become a Partner",
    essentials: {
      tag: "The Essentials",
      title: "Three days. Endless potential.",
      body: "Bringing together 60 builders, designers and dreamers to create what's next, powered by AI.",
      stats: [
        ["60", "Builders"],
        ["3", "Days"],
        ["AI", "Powered"],
        ["1", "Unforgettable Weekend"],
      ],
    },
    how: {
      tag: "How It Works",
      title: "Build. Ship. Pitch. Win.",
      steps: [
        ["Find an idea", "Come with an idea or find one at the event."],
        ["Build with AI", "Use tools like Claude, Cursor, Lovable, ChatGPT and more."],
        ["Launch", "Build your product from idea to working prototype."],
        ["Pitch", "Present to judges and partners. Win amazing prizes."],
      ],
    },
    ideaGenerator: {
      tag: "Inspo",
      title: "Random Vibe Code Idea Generator",
      eyebrow: "Find your idea",
      body: "Need a spark? Shuffle through Iceland-first product ideas and use one as a starting point for your team.",
      button: "Generate Idea",
    },
    audience: {
      tag: "Who It's For",
      title: "For builders of all backgrounds.",
      note: "No coding experience required.",
      cards: [
        ["Students", "Learn, build and level up your skills."],
        ["Future Founders", "Build your idea and take the first step."],
        ["Designers & Creatives", "Design, build and ship beautiful products."],
      ],
    },
    schedule: {
      tag: "Schedule",
      title: "Three days to build the future.",
      days: [
        ["01", "Friday", ["Opening Ceremony", "Team Formation", "Idea Validation", "Workshops"]],
        ["02", "Saturday", ["Build Day", "Mentorship", "Workshops", "Community Events"]],
        ["03", "Sunday", ["Final Sprint", "Pitch Competition", "Awards & Closing"]],
      ],
    },
    partners: {
      tag: "Our Partners",
      title: "Backed by innovators.",
      coming: "[ More partners coming soon ]",
    },
    cta: {
      title: "Ready to build something incredible?",
      body: "Join 60+ builders in Reykjavík for Iceland's first vibe coding hackathon.",
      facts: ["21 - 23 August 2026", "Reykjavík, Iceland", "60 Builders", "AI Powered"],
    },
    footer: "Hafðu samband",
  },
  is: {
    navLocation: "Reykjavík, Ísland",
    menu: "Valmynd",
    langLabel: "Switch to English",
    eyebrow: "Fyrsta Vibe Coding Hackathon Íslands",
    date: "21. - 23. ágúst 2026",
    city: "Reykjavík",
    apply: "Sækja um",
    partner: "Gerast samstarfsaðili",
    essentials: {
      tag: "Aðalatriðin",
      title: "Þrír dagar. Endalausir möguleikar.",
      body: "Við sameinum 60 þátttakendur til að skapa það næsta, knúið áfram af gervigreind.",
      stats: [
        ["60", "Þátttakendur"],
        ["3", "Dagar"],
        ["AI", "Gervigreindarknúið"],
        ["1", "Ógleymanleg Helgi"],
      ],
    },
    how: {
      tag: "Svona virkar þetta",
      title: "Skapaðu. Skilaðu. Kynntu. Sigraðu.",
      steps: [
        ["Komdu með hugmynd", "Myndaðu teymi og komdu með hugmynd."],
        ["Skapaðu með AI", "Notaðu verkfæri eins og Claude, Cursor, Lovable, ChatGPT og fleiri."],
        ["Skilaðu prótótýpu", "Búðu til prótótýpu og skilaðu henni til dómnefndar."],
        ["Kynntu", "Kynntu fyrir dómurum og samstarfsaðilum. Kepptu um verðlaun."],
      ],
    },
    ideaGenerator: {
      tag: "Inspo",
      title: "Finndu þína hugmynd",
      eyebrow: "Random Vibe Code Idea Generator",
      body: "Vantar neistann? Smelltu og fáðu íslenska vibe coding hugmynd sem teymið getur notað sem upphafspunkt.",
      button: "Fá nýja hugmynd",
    },
    audience: {
      tag: "Fyrir hverja",
      title: "Fyrir alla menntaskólanema (2008 - 2010).",
      note: "Engin forritunarreynsla nauðsynleg.",
      cards: [
        ["Nemendur", "Lærðu, byggðu og efldu hæfileikana þína."],
        ["Framtíðarstofnendur", "Byggðu hugmyndina þína og taktu fyrsta skrefið."],
        ["Hönnuðir & skapandi fólk", "Hannaðu, byggðu og sendu fallegar vörur frá þér."],
      ],
    },
    schedule: {
      tag: "Dagskrá",
      title: "Þrír dagar til að byggja framtíðina.",
      days: [
        ["01", "Föstudagur", ["Opnunarathöfn", "Teymamyndun", "Hugmyndavinna", "Vinnustofur"]],
        ["02", "Laugardagur", ["sköpunardagur", "Mentoravinna", "Vinnustofur", "Samfélagsviðburðir"]],
        ["03", "Sunnudagur", ["Lokasprettur", "Kynningakeppni", "Verðlaun & lokahóf"]],
      ],
    },
    partners: {
      tag: "Samstarfsaðilar",
      title: "Stutt af frumkvöðlum.",
      coming: "[ Fleiri samstarfsaðilar kynntir síðar ]",
    },
    cta: {
      title: "Tilbúin að skapa eitthvað magnað?",
      body: "Vertu með 60 þátttakendum í Reykjavík á fyrsta vibe coding hackathon Íslands.",
      facts: ["21. - 23. ágúst 2026", "Reykjavík, Ísland", "60 Þátttakendur", "Gervigreindarknúið"],
    },
    footer: "Hafðu samband",
  },
} as const;

const statIcons = [Users, CalendarDays, Zap, Star];
const stepIcons = [Search, Code2, Rocket, Trophy];
const audienceIcons = [GraduationCap, Rocket, Pencil];
const factIcons = [CalendarDays, MapPin, Users, Zap];
const menuResources = [
  {
    label: "Everything you need to know",
    href: "/everything-you-need-to-know",
    meta: "Scroll guide",
  },
  {
    label: "Allt sem þú þarft að vita",
    href: "/allt-sem-thu-tharft-ad-vita",
    meta: "Scroll síða",
  },
] as const;
const contactDetails = {
  name: "Elías Óli Tinnusson Björnsson",
  email: "eliasoli0967@gmail.com",
  phone: "+354 771 2109",
  phoneHref: "tel:+3547712109",
} as const;
const ideaPool = [
  {
    is: ["Reimur", "Giskar á landshlutann þinn af tali og kennir framburð."],
    en: ["Reimur", "Guesses your region from speech and teaches Icelandic pronunciation."],
  },
  {
    is: ["Afgangur", "Uppskriftir úr því sem er til, gegn matarsóun."],
    en: ["Afgangur", "Recipes from what you already have, built to fight food waste."],
  },
  {
    is: ["Norðurljósaspá", "Sameinar gögn og segir hvenær og hvert á að keyra."],
    en: ["Northern Lights Forecast", "Combines data and tells you when and where to drive."],
  },
  {
    is: ["Skiptibók", "Hverfismarkaður fyrir vöruskipti án peninga."],
    en: ["Swapbook", "A neighborhood marketplace for trading items without money."],
  },
  {
    is: ["Þögnarkort", "Finnur rólegustu staðina í borginni."],
    en: ["Quiet Map", "Finds the calmest places in the city."],
  },
  {
    is: ["Amma veit", "Íslensk húsráð og þjóðtrú sem spjall-AI."],
    en: ["Grandma Knows", "Icelandic home wisdom and folklore as a chat AI."],
  },
  {
    is: ["Skiptaplan", "Vaktaskipti með einum smelli."],
    en: ["Shift Swap", "Swap shifts with one click."],
  },
  {
    is: ["Tónspor", "Staðsetningarmiðuð tónlist falin um borgina."],
    en: ["Sound Trail", "Location-based music hidden around the city."],
  },
  {
    is: ["Veskið mitt á íslensku", "Fjármál útskýrð fyrir ungt fólk."],
    en: ["My Wallet in Icelandic", "Personal finance explained for young people."],
  },
  {
    is: ["Hvað heitir þetta?", "Þekkir plöntur, fugla og fjöll úr myndavél."],
    en: ["What Is This Called?", "Recognizes plants, birds, and mountains from your camera."],
  },
  {
    is: ["Sundlaugaspjall", "Finnur félaga í sund og pott."],
    en: ["Pool Chat", "Finds someone to meet for a swim and hot tub."],
  },
  {
    is: ["Námshjálp í vasa", "Skref-fyrir-skref útskýring á heimaverkefnum."],
    en: ["Pocket Study Help", "Step-by-step explanations for homework."],
  },
  {
    is: ["Sporlaust ferðalag", "Kolefnisspor ferða um Ísland."],
    en: ["Trace-Free Travel", "Carbon footprint tracking for trips around Iceland."],
  },
  {
    is: ["Rödd í texta - mállýska", "Íslensk tal-í-texta lausn með aðgengi í huga."],
    en: ["Voice to Text - Dialect", "Icelandic speech-to-text designed with accessibility in mind."],
  },
  {
    is: ["Hverfishetjur", "Leysir lítil hverfismál með leikjavæðingu."],
    en: ["Neighborhood Heroes", "Solves small neighborhood issues through gamification."],
  },
  {
    is: ["Stefnumót við bók", "Blint bókatip eftir stemmningu."],
    en: ["Date With a Book", "A blind book recommendation based on your mood."],
  },
  {
    is: ["Veðurklæðnaður", "Segir hverju á að klæðast eftir íslensku veðri."],
    en: ["Weather Outfit", "Tells you what to wear for Icelandic weather."],
  },
  {
    is: ["Samvinnusögur", "Skrifar sögur til skiptis við AI og vini."],
    en: ["Collaborative Stories", "Write stories turn by turn with AI and friends."],
  },
  {
    is: ["Tími til að hreyfa sig", "Örstuttar hreyfiáskoranir inn í daginn."],
    en: ["Time to Move", "Tiny movement challenges that fit into your day."],
  },
  {
    is: ["Draugaslóð Reykjavíkur", "AR-gönguleiðsögn um sögur miðbæjarins."],
    en: ["Reykjavík Ghost Trail", "An AR walking guide through downtown stories."],
  },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-mint">{children}</p>;
}

function ArrowButton({
  children,
  href,
  variant = "solid",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "solid" | "outline";
}) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex h-14 min-w-52 items-center justify-center gap-8 rounded-md border px-7 font-mono text-[12px] font-black uppercase tracking-tight transition duration-300",
        variant === "solid"
          ? "border-mint bg-mint text-black shadow-[0_0_34px_rgba(74,222,128,0.28)] hover:bg-mint-soft"
          : "border-mint/55 bg-black/30 text-mint hover:border-mint hover:bg-mint/10"
      )}
    >
      <span>{children}</span>
      <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  const next = lang === "en" ? "is" : "en";

  return (
    <button
      type="button"
      aria-label={copy[lang].langLabel}
      onClick={() => setLang(next)}
      className="rounded-full border border-mint/30 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mint transition hover:border-mint hover:bg-mint/10"
    >
      {lang === "en" ? "IS" : "EN"}
    </button>
  );
}

function MenuDropdown({ lang, open }: { lang: Lang; open: boolean }) {
  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-4 w-[min(88vw,25rem)] rounded-md border border-mint/20 bg-black/90 p-5 text-left shadow-[0_0_50px_rgba(74,222,128,0.14)] backdrop-blur-xl transition",
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      )}
    >
      <div>
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-mint">
          {lang === "en" ? "Guides" : "Skjöl"}
        </p>
        <div className="mt-3 grid gap-2">
          {menuResources.map((resource) => (
            <a
              key={resource.href}
              href={resource.href}
              className="group rounded border border-white/10 bg-white/[0.03] p-3 transition hover:border-mint/45 hover:bg-mint/10"
            >
              <span className="block font-mono text-xs font-black uppercase tracking-[0.12em] text-white group-hover:text-mint">{resource.label}</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">{resource.meta}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-mint/10 pt-5">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-mint">
          Hafðu samband
        </p>
        <div className="mt-3 space-y-2 font-mono text-xs leading-5 text-white/70">
          <p className="font-bold text-white">{contactDetails.name}</p>
          <a className="block transition hover:text-mint" href={`mailto:${contactDetails.email}`}>
            {contactDetails.email}
          </a>
          <a className="block transition hover:text-mint" href={contactDetails.phoneHref}>
            {contactDetails.phone}
          </a>
        </div>
      </div>
    </div>
  );
}

function Hero({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  const t = copy[lang];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative isolate min-h-screen overflow-hidden border-b border-mint/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(74,222,128,0.34),rgba(0,0,0,0)_29rem)]" />
      <div className="absolute inset-0 bg-grid opacity-70" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-mint/10" />
      <div className="absolute left-[23%] top-0 h-full w-px bg-mint/10" />
      <div className="absolute right-[23%] top-0 h-full w-px bg-mint/10" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-8 sm:px-11">
        <div className="flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
          <span className="size-2 rounded-full bg-mint shadow-[0_0_18px_rgba(74,222,128,0.85)]" />
          {t.navLocation}
        </div>
        <div className="relative flex items-center gap-4">
          <LanguageToggle lang={lang} setLang={setLang} />
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80 transition hover:text-mint"
          >
            {t.menu}
            <Menu className="size-4 text-mint" />
          </button>
          <MenuDropdown lang={lang} open={menuOpen} />
        </div>
      </nav>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] max-w-6xl flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="crosshair left-[10%] top-[18%]" />
        <div className="crosshair right-[10%] top-[18%]" />
        <div className="crosshair bottom-[24%] left-[18%]" />
        <div className="crosshair bottom-[24%] right-[18%]" />

        <div className="relative -my-8 aspect-[3/2] w-[min(100%,980px)] select-none sm:-my-14 lg:-my-20">
          <h1 className="sr-only">Vibe Ísland</h1>
          <Image
            src="/vibe-iceland-logo.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 94vw, 980px"
            className="object-contain opacity-95 mix-blend-screen saturate-125"
          />
        </div>

        <p className="mt-8 font-mono text-sm uppercase tracking-[0.34em] text-white/85 sm:mt-10">{t.eyebrow}</p>
        <div className="mt-8 space-y-1 font-mono text-sm uppercase tracking-[0.22em]">
          <p className="text-mint">{t.date}</p>
          <p className="text-white/80">{t.city}</p>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <ArrowButton href="/apply">{t.apply}</ArrowButton>
          <ArrowButton href="/partner" variant="outline">
            {t.partner}
          </ArrowButton>
        </div>
      </div>
    </header>
  );
}

function Essentials({ lang }: { lang: Lang }) {
  const t = copy[lang].essentials;

  return (
    <section className="section-shell grid gap-10 lg:grid-cols-[0.75fr_1.35fr]">
      <div>
        <SectionTag>{t.tag}</SectionTag>
        <h2 className="max-w-sm text-4xl font-medium leading-[1.08] text-white sm:text-5xl">{t.title}</h2>
        <p className="mt-10 max-w-xs font-mono text-sm leading-7 text-white/58">{t.body}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {t.stats.map(([value, label], index) => {
          const Icon = statIcons[index];
          return (
            <div key={label} className="panel flex min-h-44 flex-col items-center justify-center text-center">
              <Icon className="mb-6 size-9 text-mint" strokeWidth={1.7} />
              <p className="font-mono text-5xl font-black text-mint">{value}</p>
              <p className="mt-4 max-w-24 font-mono text-[11px] font-bold uppercase leading-4 tracking-wider text-white">
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks({ lang }: { lang: Lang }) {
  const t = copy[lang].how;

  return (
    <section className="section-shell text-center">
      <SectionTag>{t.tag}</SectionTag>
      <h2 className="font-mono text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t.title}</h2>
      <div className="mt-16 grid gap-12 md:grid-cols-4">
        {t.steps.map(([title, body], index) => {
          const Icon = stepIcons[index];
          return (
            <article key={title} className="relative flex flex-col items-center">
              {index < t.steps.length - 1 && (
                <span className="absolute left-[64%] top-8 hidden h-px w-[72%] bg-mint/25 md:block" />
              )}
              <div className="relative mb-9 flex h-20 items-center justify-center">
                <span className="absolute -left-10 top-2 grid size-9 place-items-center rounded-full border border-mint/70 font-mono text-xs text-mint">
                  {index + 1}
                </span>
                <Icon className="size-14 text-mint" strokeWidth={1.5} />
              </div>
              <h3 className="font-mono text-sm font-black uppercase tracking-wide text-white">{title}</h3>
              <p className="mt-5 max-w-44 font-mono text-xs leading-5 text-white/58">{body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function IdeaGenerator({ lang }: { lang: Lang }) {
  const t = copy[lang].ideaGenerator;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIdea = ideaPool[activeIndex][lang];

  function generateIdea() {
    setActiveIndex((current) => {
      if (ideaPool.length < 2) return current;

      let next = Math.floor(Math.random() * ideaPool.length);
      while (next === current) {
        next = Math.floor(Math.random() * ideaPool.length);
      }
      return next;
    });
  }

  return (
    <section className="section-shell">
      <div className="grid items-stretch gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between">
          <div>
            <SectionTag>{t.tag}</SectionTag>
            <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/45">{t.eyebrow}</p>
            <h2 className="max-w-xl text-4xl font-medium leading-tight text-white sm:text-5xl">{t.title}</h2>
            <p className="mt-7 max-w-md font-mono text-sm leading-7 text-white/58">{t.body}</p>
          </div>
          <button
            type="button"
            onClick={generateIdea}
            className="mt-9 inline-flex h-14 w-fit items-center gap-5 rounded-md border border-mint bg-mint px-7 font-mono text-[12px] font-black uppercase tracking-tight text-black shadow-[0_0_34px_rgba(74,222,128,0.24)] transition hover:bg-mint-soft"
          >
            <Shuffle className="size-4" />
            {t.button}
          </button>
        </div>

        <div className="panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(74,222,128,0.22),transparent_18rem)]" />
          <div className="relative">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-mint">
                <Lightbulb className="size-5" />
                {String(activeIndex + 1).padStart(2, "0")} / {ideaPool.length}
              </div>
            </div>
            <article className="min-h-40">
              <h3 className="text-3xl font-medium leading-tight text-white sm:text-4xl">{activeIdea[0]}</h3>
              <p className="mt-5 max-w-2xl font-mono text-base leading-7 text-white/68">{activeIdea[1]}</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function Audience({ lang }: { lang: Lang }) {
  const t = copy[lang].audience;

  return (
    <section className="section-shell text-center">
      <SectionTag>{t.tag}</SectionTag>
      <h2 className="text-4xl font-medium leading-tight text-white sm:text-5xl">{t.title}</h2>
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 text-left md:grid-cols-3">
        {t.cards.map(([title, body], index) => {
          const Icon = audienceIcons[index];
          return (
            <article key={title} className="panel min-h-48 p-8">
              <Icon className="mb-7 size-10 text-mint" strokeWidth={1.6} />
              <h3 className="font-mono text-sm font-black uppercase tracking-wide text-white">{title}</h3>
              <p className="mt-4 max-w-64 font-mono text-sm leading-6 text-white/60">{body}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-9 font-mono text-sm font-bold text-mint">{t.note}</p>
    </section>
  );
}

function Schedule({ lang }: { lang: Lang }) {
  const t = copy[lang].schedule;

  return (
    <section className="section-shell grid gap-12 lg:grid-cols-[0.62fr_1.38fr]">
      <div>
        <SectionTag>{t.tag}</SectionTag>
        <h2 className="max-w-sm text-4xl font-medium leading-[1.08] text-white sm:text-5xl">{t.title}</h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {t.days.map(([number, day, items]) => (
          <article key={number} className="border-l border-mint/14 pl-9">
            <p className="font-mono text-4xl text-mint">{number}</p>
            <h3 className="mt-8 font-mono text-sm font-black uppercase tracking-widest text-white">{day}</h3>
            <ul className="mt-7 space-y-3 font-mono text-sm text-white/65">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Partners({ lang }: { lang: Lang }) {
  const t = copy[lang].partners;

  return (
    <section className="section-shell">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <SectionTag>{t.tag}</SectionTag>
          <h2 className="text-4xl font-medium text-white sm:text-5xl">{t.title}</h2>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/52">{t.coming}</p>
      </div>
    </section>
  );
}

function FinalCTA({ lang }: { lang: Lang }) {
  const t = copy[lang];

  return (
    <section className="section-shell pb-10 pt-0">
      <div className="panel relative overflow-hidden p-8 sm:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(74,222,128,0.28),transparent_28rem)]" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="max-w-lg text-4xl font-medium leading-[1.1] text-white sm:text-5xl">{t.cta.title}</h2>
            <p className="mt-8 max-w-md font-mono text-sm leading-7 text-white/62">{t.cta.body}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <ArrowButton href="/apply">{t.apply}</ArrowButton>
              <ArrowButton href="/partner" variant="outline">
                {t.partner}
              </ArrowButton>
            </div>
          </div>
          <div className="space-y-6">
            {t.cta.facts.map((fact, index) => {
              const Icon = factIcons[index];
              return (
                <div key={fact} className="flex items-center gap-5 border-b border-mint/10 pb-5 font-mono text-sm font-bold uppercase tracking-[0.16em] text-mint">
                  <Icon className="size-5" />
                  {fact}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ lang }: { lang: Lang }) {
  const t = copy[lang];

  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-10 font-mono text-xs uppercase tracking-[0.2em] text-white/65 sm:px-10 md:flex-row md:items-end md:justify-between">
      <div className="relative h-14 w-40 overflow-hidden rounded-sm">
        <Image
          src="/vibe-iceland-wordmark.png"
          alt="Vibe Ísland"
          fill
          sizes="144px"
          className="object-cover object-center opacity-80 saturate-125"
        />
      </div>
      <p className="text-mint/80">© 2026 Vibe Ísland</p>
      <a href="mailto:Eliasoli0967@gmail.com" className="transition hover:text-mint">
        {t.footer}
      </a>
    </footer>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");

  return (
    <main className="min-h-screen bg-black text-white">
      <Hero lang={lang} setLang={setLang} />
      <Essentials lang={lang} />
      <HowItWorks lang={lang} />
      <IdeaGenerator lang={lang} />
      <Audience lang={lang} />
      <Schedule lang={lang} />
      <Partners lang={lang} />
      <FinalCTA lang={lang} />
      <Footer lang={lang} />
    </main>
  );
}
