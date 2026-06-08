"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

type Lang = "en" | "is";

const applicationCopy = {
  en: {
    back: "Back to site",
    langLabel: "Skipta yfir á íslensku",
    tag: "Application",
    title: "Vibe Iceland 2026 - Application",
    body: "Tell us who you are, what you want to build, and how you want to contribute during the weekend.",
    destination: "Applications are sent as an email to hallo@vibeisland.is. They are not stored in a database yet.",
    submit: "Send Application",
    emailSubject: "Vibe Iceland 2026 Application",
    sentHint: "Your email app should open with the application filled in. Send it from there to complete the application.",
    sections: {
      basics: "Part 1 - Basic information",
      background: "Part 2 - Background",
      about: "Part 3 - About you",
      team: "Part 4 - Team and interests",
      community: "Part 5 - The community",
    },
    fields: {
      fullName: "Full name",
      email: "Email",
      phone: "Phone number",
      birthdate: "Date of birth",
      school: "School",
      residence: "Residence",
      describe: "How would you describe yourself?",
      chooseAll: "Choose all that apply.",
      other: "Other",
      experience: "How much experience do you have building projects?",
      aiTools: "Which AI tools have you used?",
      why: "Why do you want to take part in Vibe Iceland?",
      wordLimit: "100 words max",
      built: "Tell us about something you have built, created, or taken initiative on.",
      builtHelp: "It does not need to be a tech project.",
      teamRole: "What would you most like to do on the team?",
      interests: "What kind of project interests you most?",
      applyingAs: "Are you applying:",
      teammateNames: "Teammate names",
      teammateEmails: "Teammate emails",
      hopes: "What do you hope to get out of the weekend?",
    },
  },
  is: {
    back: "Til baka á síðu",
    langLabel: "Switch to English",
    tag: "Umsókn",
    title: "Vibe Iceland 2026 - Umsókn",
    body: "Segðu okkur hver þú ert, hvað þig langar að byggja og hvernig þú vilt leggja þitt af mörkum yfir helgina.",
    destination: "Umsóknin fer sem tölvupóstur á hallo@vibeisland.is. Hún vistast ekki í gagnagrunni ennþá.",
    submit: "Senda umsókn",
    emailSubject: "Vibe Iceland 2026 Umsókn",
    sentHint: "Tölvupóstforritið þitt ætti að opnast með útfylltri umsókn. Sendu póstinn þaðan til að klára umsóknina.",
    sections: {
      basics: "Hluti 1 - Grunnupplýsingar",
      background: "Hluti 2 - Bakgrunnur",
      about: "Hluti 3 - Um þig",
      team: "Hluti 4 - Teymi og áhugasvið",
      community: "Hluti 5 - Samfélagið",
    },
    fields: {
      fullName: "Fullt nafn",
      email: "Netfang",
      phone: "Símanúmer",
      birthdate: "Fæðingardagur",
      school: "Skóli",
      residence: "Búseta",
      describe: "Hvernig myndir þú lýsa þér?",
      chooseAll: "Veldu allt sem á við.",
      other: "Annað",
      experience: "Hversu mikla reynslu hefur þú af að byggja verkefni?",
      aiTools: "Hvaða AI tól hefur þú notað?",
      why: "Af hverju viltu taka þátt í Vibe Iceland?",
      wordLimit: "100 orð hámark",
      built: "Segðu frá einhverju sem þú hefur byggt, skapað eða tekið frumkvæði að.",
      builtHelp: "Það þarf ekki að vera tækniverkefni.",
      teamRole: "Hvað myndir þú helst vilja gera í teyminu?",
      interests: "Hvers konar verkefni hefur mestan áhuga fyrir þig?",
      applyingAs: "Ertu að sækja um:",
      teammateNames: "Nöfn liðsfélaga",
      teammateEmails: "Netföng liðsfélaga",
      hopes: "Hvað vonast þú til að fá út úr helginni?",
    },
  },
} as const;

const applicationOptions = {
  profiles: {
    en: ["Programmer", "Designer", "Entrepreneur", "Marketer", "Student", "AI enthusiast", "Product manager"],
    is: ["Forritari", "Hönnuður", "Frumkvöðull", "Markaðsmaður", "Nemandi", "AI áhugamaður", "Vörustjóri"],
  },
  experience: {
    en: ["None", "A little", "I have built a few projects", "I have started a company or launched a product"],
    is: ["Enga", "Smá", "Hef byggt nokkur verkefni", "Hef stofnað fyrirtæki eða gefið út vöru"],
  },
  aiTools: {
    en: ["ChatGPT", "Claude", "Cursor", "Lovable", "Bolt", "Windsurf"],
    is: ["ChatGPT", "Claude", "Cursor", "Lovable", "Bolt", "Windsurf"],
  },
  teamRoles: {
    en: [
      "Ideation and brainstorming",
      "Programming and technical implementation",
      "Design (UI/UX)",
      "Marketing and pitching",
      "Business development",
      "Project management",
      "I am up for anything",
    ],
    is: [
      "Hugmyndavinna og brainstorming",
      "Forritun og tæknileg útfærsla",
      "Hönnun (UI/UX)",
      "Markaðssetning og kynning",
      "Viðskiptaþróun",
      "Verkefnastýring",
      "Ég er til í hvað sem er",
    ],
  },
  interests: {
    en: [
      "AI and productivity tools",
      "Education and schools",
      "Health and sports",
      "Social media",
      "Games and entertainment",
      "Environment and sustainability",
      "Finance and business",
    ],
    is: [
      "AI og Productivity Tools",
      "Menntun og skólar",
      "Heilsa og íþróttir",
      "Samfélagsmiðlar",
      "Leikir og afþreying",
      "Umhverfi og sjálfbærni",
      "Fjármál og viðskipti",
    ],
  },
  applyingAs: {
    en: ["Alone", "With a team"],
    is: ["Einn", "Með teymi"],
  },
  hopes: {
    en: [
      "New friends",
      "Learn AI",
      "Build a project",
      "Start a company",
      "Find collaborators",
      "Find a future job",
      "Meet people in tech",
    ],
    is: [
      "Nýja vini",
      "Læra AI",
      "Byggja verkefni",
      "Stofna fyrirtæki",
      "Finna samstarfsaðila",
      "Finna framtíðarstarf",
      "Kynnast fólki í tæknigeiranum",
    ],
  },
} as const;

const inputClass =
  "mt-2 w-full rounded border border-mint/15 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-white/28 focus:border-mint/70 focus:bg-black/55";

function SectionTag({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-mint">{children}</p>;
}

function FormField({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/62">
      {label}
      <input className={inputClass} name={name} type={type} required={required} />
    </label>
  );
}

function FormTextarea({
  label,
  name,
  help,
  maxLength,
  required = false,
}: {
  label: string;
  name: string;
  help?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/62">
      {label}
      {help ? <span className="mt-2 block normal-case tracking-normal text-white/42">{help}</span> : null}
      <textarea className={`${inputClass} min-h-36 resize-y leading-6`} name={name} maxLength={maxLength} required={required} />
    </label>
  );
}

function CheckboxGroup({
  label,
  hint,
  name,
  options,
  otherLabel,
}: {
  label: string;
  hint?: string;
  name: string;
  options: readonly string[];
  otherLabel?: string;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/72">{label}</legend>
      {hint ? <p className="mt-2 font-mono text-xs text-white/42">{hint}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-3 rounded border border-mint/10 bg-black/24 px-3 py-3 font-mono text-sm text-white/72 transition hover:border-mint/35">
            <input className="size-4 accent-mint" name={name} type="checkbox" value={option} />
            {option}
          </label>
        ))}
      </div>
      {otherLabel ? (
        <label className="mt-3 block font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/62">
          {otherLabel}
          <input className={inputClass} name={`${name} - ${otherLabel}`} type="text" />
        </label>
      ) : null}
    </fieldset>
  );
}

function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/72">{label}</legend>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-3 rounded border border-mint/10 bg-black/24 px-3 py-3 font-mono text-sm text-white/72 transition hover:border-mint/35">
            <input
              checked={value ? value === option : undefined}
              className="size-4 accent-mint"
              name={name}
              onChange={() => onChange?.(option)}
              required
              type="radio"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ApplyPage() {
  const [lang, setLang] = useState<Lang>("is");
  const t = applicationCopy[lang];
  const options = {
    profiles: applicationOptions.profiles[lang],
    experience: applicationOptions.experience[lang],
    aiTools: applicationOptions.aiTools[lang],
    teamRoles: applicationOptions.teamRoles[lang],
    interests: applicationOptions.interests[lang],
    applyingAs: applicationOptions.applyingAs[lang],
    hopes: applicationOptions.hopes[lang],
  };
  const [applyingAs, setApplyingAs] = useState<string>(options.applyingAs[0]);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const lines: string[] = [];
    const grouped = new Map<string, string[]>();

    formData.forEach((value, key) => {
      const text = String(value).trim();
      if (!text) return;
      grouped.set(key, [...(grouped.get(key) ?? []), text]);
    });

    grouped.forEach((values, key) => {
      lines.push(`${key}: ${values.join(", ")}`);
    });

    setSubmitted(true);
    window.location.href = `mailto:hallo@vibeisland.is?subject=${encodeURIComponent(t.emailSubject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 -z-0 bg-grid opacity-70" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 sm:px-10">
        <nav className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-mint transition hover:text-mint-soft" href="/">
            <ArrowLeft className="size-4" />
            {t.back}
          </Link>
          <button
            type="button"
            aria-label={t.langLabel}
            onClick={() => setLang(lang === "en" ? "is" : "en")}
            className="rounded-full border border-mint/30 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mint transition hover:border-mint hover:bg-mint/10"
          >
            {lang === "en" ? "IS" : "EN"}
          </button>
        </nav>

        <header className="grid items-center gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative h-28 w-72 max-w-full overflow-hidden rounded-sm">
            <Image
              src="/vibe-iceland-wordmark.png"
              alt="Vibe Ísland"
              fill
              priority
              sizes="288px"
              className="object-cover object-center opacity-85 saturate-125"
            />
          </div>
          <div>
            <SectionTag>{t.tag}</SectionTag>
            <h1 className="max-w-3xl text-4xl font-medium leading-tight text-white sm:text-6xl">{t.title}</h1>
            <p className="mt-6 max-w-2xl font-mono text-sm leading-7 text-white/58">{t.body}</p>
            <p className="mt-5 max-w-2xl rounded border border-mint/20 bg-mint/10 p-4 font-mono text-sm leading-6 text-mint">
              {t.destination}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="panel relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(74,222,128,0.16),transparent_24rem)]" />
          <div className="relative space-y-12">
            <section>
              <h2 className="mb-6 font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.basics}</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField label={t.fields.fullName} name={t.fields.fullName} required />
                <FormField label={t.fields.email} name={t.fields.email} type="email" required />
                <FormField label={t.fields.phone} name={t.fields.phone} type="tel" required />
                <FormField label={t.fields.birthdate} name={t.fields.birthdate} type="date" required />
                <FormField label={t.fields.school} name={t.fields.school} required />
                <FormField label={t.fields.residence} name={t.fields.residence} required />
              </div>
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.background}</h2>
              <CheckboxGroup label={t.fields.describe} hint={t.fields.chooseAll} name={t.fields.describe} options={options.profiles} otherLabel={t.fields.other} />
              <RadioGroup label={t.fields.experience} name={t.fields.experience} options={options.experience} />
              <CheckboxGroup label={t.fields.aiTools} hint={t.fields.chooseAll} name={t.fields.aiTools} options={options.aiTools} otherLabel={t.fields.other} />
            </section>

            <section className="space-y-6 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.about}</h2>
              <FormTextarea label={t.fields.why} help={t.fields.wordLimit} maxLength={750} name={t.fields.why} required />
              <FormTextarea label={t.fields.built} help={t.fields.builtHelp} name={t.fields.built} required />
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.team}</h2>
              <CheckboxGroup label={t.fields.teamRole} hint={t.fields.chooseAll} name={t.fields.teamRole} options={options.teamRoles} />
              <CheckboxGroup label={t.fields.interests} hint={t.fields.chooseAll} name={t.fields.interests} options={options.interests} otherLabel={t.fields.other} />
              <RadioGroup label={t.fields.applyingAs} name={t.fields.applyingAs} options={options.applyingAs} value={applyingAs} onChange={setApplyingAs} />
              {applyingAs === options.applyingAs[1] ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <FormTextarea label={t.fields.teammateNames} name={t.fields.teammateNames} required />
                  <FormTextarea label={t.fields.teammateEmails} name={t.fields.teammateEmails} required />
                </div>
              ) : null}
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.community}</h2>
              <CheckboxGroup label={t.fields.hopes} hint={t.fields.chooseAll} name={t.fields.hopes} options={options.hopes} />
            </section>

            <div className="flex flex-col items-start gap-4 border-t border-mint/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                className="inline-flex h-14 items-center gap-5 rounded-md border border-mint bg-mint px-8 font-mono text-[12px] font-black uppercase tracking-tight text-black shadow-[0_0_34px_rgba(74,222,128,0.24)] transition hover:bg-mint-soft"
              >
                {t.submit}
                <ArrowUpRight className="size-4" />
              </button>
              {submitted ? <p className="max-w-md font-mono text-xs leading-5 text-mint">{t.sentHint}</p> : null}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
