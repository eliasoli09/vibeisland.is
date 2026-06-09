"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

type Lang = "en" | "is";

const partnerCopy = {
  en: {
    back: "Back to site",
    langLabel: "Skipta yfir á íslensku",
    tag: "Partner Application",
    title: "Vibe Iceland 2026 - Partner Application",
    body: "Tell us how your company wants to support Iceland's first vibe coding hackathon for young builders.",
    destination: "The partner application goes directly to the Vibe Iceland team.",
    submit: "Send Partner Application",
    successMessage: "Thank you. We have received your partner application.",
    errorMessage: "Something went wrong. Please try again or email hallo@vibeisland.is.",
    chooseAll: "Choose all that apply.",
    optional: "Optional",
    wordLimit: "100 words max",
    sections: {
      company: "Part 1 - The company",
      interest: "Part 2 - Partnership interest",
      type: "Part 3 - Type of partnership",
      participation: "Part 4 - Event participation",
      other: "Part 5 - Other",
    },
    fields: {
      companyName: "Company name",
      contactName: "Contact name",
      jobTitle: "Job title",
      email: "Email",
      phone: "Phone number",
      website: "Company website",
      why: "Why is your company interested in supporting Vibe Iceland?",
      mostInterest: "What interests you most?",
      partnershipType: "What kind of partnership are you most interested in?",
      scope: "What scale of partnership feels realistic?",
      activeParticipation: "Would you be interested in actively participating in the event?",
      anythingElse: "Is there anything else you want us to know?",
      mayContact: "May we contact you to discuss the partnership further?",
      other: "Other",
    },
  },
  is: {
    back: "Til baka á síðu",
    langLabel: "Switch to English",
    tag: "Styrktaraðilaumsókn",
    title: "Vibe Iceland 2026 - Styrktaraðilaumsókn",
    body: "Segið okkur hvernig fyrirtækið vill styðja fyrsta vibe coding hackathon Íslands fyrir unga skapara.",
    destination: "Styrktaraðilaumsóknin fer beint til teymisins hjá Vibe Ísland.",
    submit: "Senda styrktaraðilaumsókn",
    successMessage: "Takk fyrir. Við höfum móttekið styrktaraðilaumsóknina.",
    errorMessage: "Eitthvað fór úrskeiðis. Vinsamlegast reyndu aftur eða sendu tölvupóst á hallo@vibeisland.is.",
    chooseAll: "Veldu allt sem á við.",
    optional: "Valfrjálst",
    wordLimit: "100 orð hámark",
    sections: {
      company: "Hluti 1 - Fyrirtækið",
      interest: "Hluti 2 - Áhugi á samstarfi",
      type: "Hluti 3 - Tegund samstarfs",
      participation: "Hluti 4 - Þátttaka á viðburðinum",
      other: "Hluti 5 - Annað",
    },
    fields: {
      companyName: "Nafn fyrirtækis",
      contactName: "Nafn tengiliðar",
      jobTitle: "Starfsheiti",
      email: "Netfang",
      phone: "Símanúmer",
      website: "Vefsíða fyrirtækis",
      why: "Hvers vegna hefur fyrirtækið áhuga á að styðja Vibe Iceland?",
      mostInterest: "Hvað vekur mestan áhuga hjá ykkur?",
      partnershipType: "Hvernig samstarfi hafið þið helst áhuga á?",
      scope: "Hvert teljið þið raunhæft umfang samstarfs?",
      activeParticipation: "Hefðuð þið áhuga á að taka virkan þátt í viðburðinum?",
      anythingElse: "Er eitthvað annað sem þið viljið að við vitum?",
      mayContact: "Má hafa samband við ykkur til að ræða samstarf nánar?",
      other: "Annað",
    },
  },
} as const;

const partnerOptions = {
  mostInterest: {
    en: [
      "Supporting young and promising people",
      "Innovation and entrepreneurship",
      "Artificial intelligence and technology",
      "Brand visibility",
      "Connection with future talent",
      "Connection with the Icelandic tech community",
    ],
    is: [
      "Að styðja ungt og efnilegt fólk",
      "Nýsköpun og frumkvöðlastarf",
      "Gervigreind og tækni",
      "Vörumerkjasýnileiki",
      "Tengsl við framtíðarstarfsfólk",
      "Tengsl við íslenska tæknisamfélagið",
    ],
  },
  partnershipType: {
    en: [
      "Financial sponsorship",
      "Prizes for winners",
      "AI credits or software licenses",
      "Mentors or experts",
      "Judges",
      "Promotion or marketing partnership",
      "Venue, facilities, or equipment",
    ],
    is: [
      "Fjárstyrkur",
      "Verðlaun fyrir sigurvegara",
      "AI inneignir eða hugbúnaðarleyfi",
      "Mentorar eða sérfræðingar",
      "Dómarar",
      "Kynning eða markaðssamstarf",
      "Aðstaða eða búnaður",
    ],
  },
  scope: {
    en: [
      "Under 100,000 ISK",
      "100,000-250,000 ISK",
      "250,000-500,000 ISK",
      "500,000-1,000,000 ISK",
      "1,000,000+ ISK",
      "We want to discuss options",
    ],
    is: [
      "Undir 100.000 kr.",
      "100.000-250.000 kr.",
      "250.000-500.000 kr.",
      "500.000-1.000.000 kr.",
      "1.000.000+ kr.",
      "Viljum ræða möguleika",
    ],
  },
  activeParticipation: {
    en: ["Have representatives on site", "Give a short talk", "Provide a mentor", "Join the jury", "Have a booth", "Not decided"],
    is: ["Vera með fulltrúa á staðnum", "Halda stutt erindi", "Vera með mentor", "Vera í dómnefnd", "Hafa kynningarbás", "Ekki ákveðið"],
  },
  mayContact: {
    en: ["Yes", "No"],
    is: ["Já", "Nei"],
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
      <textarea className={`${inputClass} min-h-32 resize-y leading-6`} name={name} maxLength={maxLength} required={required} />
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

function RadioGroup({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return (
    <fieldset>
      <legend className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/72">{label}</legend>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-3 rounded border border-mint/10 bg-black/24 px-3 py-3 font-mono text-sm text-white/72 transition hover:border-mint/35">
            <input className="size-4 accent-mint" name={name} required type="radio" value={option} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function PartnerPage() {
  const [lang, setLang] = useState<Lang>("is");
  const t = partnerCopy[lang];
  const options = {
    mostInterest: partnerOptions.mostInterest[lang],
    partnershipType: partnerOptions.partnershipType[lang],
    scope: partnerOptions.scope[lang],
    activeParticipation: partnerOptions.activeParticipation[lang],
    mayContact: partnerOptions.mayContact[lang],
  };
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const data: Record<string, string | string[]> = {};
    const grouped = new Map<string, string[]>();

    formData.forEach((value, key) => {
      const text = String(value).trim();
      if (!text) return;
      grouped.set(key, [...(grouped.get(key) ?? []), text]);
    });

    grouped.forEach((values, key) => {
      data[key] = values.length === 1 ? values[0] : values;
    });

    const getField = (name: string) => {
      const val = data[name];
      return Array.isArray(val) ? val[0] : (val ?? "");
    };

    const partnerData = {
      company_name: getField(t.fields.companyName),
      contact_name: getField(t.fields.contactName),
      job_title: getField(t.fields.jobTitle),
      email: getField(t.fields.email),
      phone: getField(t.fields.phone),
      website: getField(t.fields.website),
      data,
    };

    try {
      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partnerData),
      });
      if (!res.ok) {
        const serverError = await res.json().catch(() => null);
        const message = typeof serverError?.error === "string" ? serverError.error : t.errorMessage;
        throw new Error(message);
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t.errorMessage);
    } finally {
      setSubmitting(false);
    }
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
            <Image src="/vibe-iceland-wordmark.png" alt="Vibe Ísland" fill priority sizes="288px" className="object-cover object-center opacity-85 saturate-125" />
          </div>
          <div>
            <SectionTag>{t.tag}</SectionTag>
            <h1 className="max-w-3xl text-4xl font-medium leading-tight text-white sm:text-6xl">{t.title}</h1>
            <p className="mt-6 max-w-2xl font-mono text-sm leading-7 text-white/58">{t.body}</p>
            <p className="mt-5 max-w-2xl rounded border border-mint/20 bg-mint/10 p-4 font-mono text-sm leading-6 text-mint">{t.destination}</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="panel relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(74,222,128,0.16),transparent_24rem)]" />
          <div className="relative space-y-12">
            <section>
              <h2 className="mb-6 font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.company}</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField label={t.fields.companyName} name={t.fields.companyName} required />
                <FormField label={t.fields.contactName} name={t.fields.contactName} required />
                <FormField label={t.fields.jobTitle} name={t.fields.jobTitle} required />
                <FormField label={t.fields.email} name={t.fields.email} type="email" required />
                <FormField label={t.fields.phone} name={t.fields.phone} type="tel" required />
                <FormField label={t.fields.website} name={t.fields.website} type="url" required />
              </div>
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.interest}</h2>
              <FormTextarea label={t.fields.why} help={t.wordLimit} maxLength={750} name={t.fields.why} required />
              <CheckboxGroup label={t.fields.mostInterest} hint={t.chooseAll} name={t.fields.mostInterest} options={options.mostInterest} otherLabel={t.fields.other} />
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.type}</h2>
              <CheckboxGroup label={t.fields.partnershipType} hint={t.chooseAll} name={t.fields.partnershipType} options={options.partnershipType} otherLabel={t.fields.other} />
              <RadioGroup label={t.fields.scope} name={t.fields.scope} options={options.scope} />
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.participation}</h2>
              <CheckboxGroup label={t.fields.activeParticipation} hint={t.chooseAll} name={t.fields.activeParticipation} options={options.activeParticipation} />
            </section>

            <section className="space-y-8 border-t border-mint/10 pt-10">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-mint">{t.sections.other}</h2>
              <FormTextarea label={t.fields.anythingElse} help={t.optional} name={t.fields.anythingElse} />
              <RadioGroup label={t.fields.mayContact} name={t.fields.mayContact} options={options.mayContact} />
            </section>

            <div className="flex flex-col items-start gap-4 border-t border-mint/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
              {submitted ? null : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-14 items-center gap-5 rounded-md border border-mint bg-mint px-8 font-mono text-[12px] font-black uppercase tracking-tight text-black shadow-[0_0_34px_rgba(74,222,128,0.24)] transition hover:bg-mint-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "..." : t.submit}
                  {!submitting && <ArrowUpRight className="size-4" />}
                </button>
              )}
              {submitted ? <p className="max-w-md rounded border border-mint/30 bg-mint/10 p-4 font-mono text-sm leading-6 text-mint">{t.successMessage}</p> : null}
              {submitError ? <p className="max-w-md font-mono text-xs leading-5 text-red-400">{submitError}</p> : null}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
