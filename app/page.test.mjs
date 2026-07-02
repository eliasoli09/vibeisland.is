import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const lovableLogoPath = new URL("../public/lovable-logo.png", import.meta.url);
const relayLogoPath = new URL("../public/relay-logo.png", import.meta.url);
const frumtakLogoPath = new URL("../public/frumtak-logo.png", import.meta.url);

test("landing page partner CTAs route to the partner form", () => {
  assert.match(source, /href="\/partner"/);
  assert.doesNotMatch(source, /Vibe%20%C3%8Dsland%20partnership/);
});

test("landing page menu includes scroll guides and contact details", () => {
  assert.match(source, /Everything you need to know/);
  assert.match(source, /Allt sem þú þarft að vita/);
  assert.match(source, /\/everything-you-need-to-know/);
  assert.match(source, /\/allt-sem-thu-tharft-ad-vita/);
  assert.doesNotMatch(source, /\/vibe-iceland-everything-you-need-to-know\.pdf/);
  assert.doesNotMatch(source, /\/vibe-island-allt-sem-thu-tharft-ad-vita\.pdf/);
  assert.match(source, /Elías Óli Tinnusson Björnsson/);
  assert.match(source, /eliasoli0967@gmail\.com/);
  assert.match(source, /\+354 771 2109/);
});

test("landing page lists the event location as TBA in both languages", () => {
  assert.match(source, /navLocation: "TBA"/);
  assert.match(source, /city: "TBA"/);
  assert.match(source, /\["21 - 23 August 2026", "TBA", "60 Builders", "AI Powered"\]/);
  assert.match(source, /\["21\. - 23\. ágúst 2026", "TBA", "60 Þátttakendur", "Gervigreindarknúið"\]/);
  assert.doesNotMatch(source, /navLocation: "Reykjavík/);
  assert.doesNotMatch(source, /city: "Reykjavík"/);
});

test("landing page displays the Lovable logo in the partners section", () => {
  assert.match(source, /src="\/lovable-logo\.png"/);
  assert.match(source, /alt="Lovable"/);
  assert.ok(existsSync(lovableLogoPath), "expected public/lovable-logo.png to exist");
});

test("landing page displays the Relay logo next to Lovable", () => {
  assert.match(source, /src="\/relay-logo\.png"/);
  assert.match(source, /alt="Relay"/);
  assert.ok(existsSync(relayLogoPath), "expected public/relay-logo.png to exist");
});

test("landing page displays the Frumtak logo in the partners section", () => {
  assert.match(source, /src="\/frumtak-logo\.png"/);
  assert.match(source, /alt="Frumtak"/);
  assert.ok(existsSync(frumtakLogoPath), "expected public/frumtak-logo.png to exist");
});

test("landing page menu stays above the hero logo when opened", () => {
  assert.match(source, /<nav className="relative z-50 /);
  assert.match(source, /<MenuDropdown lang=\{lang\} open=\{menuOpen\} \/>/);
  assert.match(source, /<div className="relative z-10 mx-auto flex min-h-\[calc\(100vh-96px\)\]/);
  assert.doesNotMatch(source, /<nav className="relative z-10 /);
});

test("landing page uses the updated Icelandic copy and footer contact link", () => {
  assert.match(source, /Skapaðu\. Skilaðu\. Kynntu\. Sigraðu\./);
  assert.doesNotMatch(source, /Skapaðu\. Sendu\. Kynntu\. Sigraðu\./);
  assert.match(source, /Við sameinum 60 þátttakendur til að skapa það næsta, knúið áfram af gervigreind\./);
  assert.doesNotMatch(source, /Við sameinum 60 þátttakendur, hönnuði og draumafólk/);
  assert.match(source, /2008 - 2010/);
  assert.doesNotMatch(source, /2010 - 2008/);
  assert.match(source, /sköpunardagur/);
  assert.doesNotMatch(source, /Byggingardagur/);
  assert.match(source, /Tilbúin að skapa eitthvað magnað\?/);
  assert.doesNotMatch(source, /Tilbúin að byggja eitthvað magnað\?/);
  assert.match(source, /Hafðu samband/);
  assert.match(source, /mailto:Eliasoli0967@gmail\.com/);
  assert.doesNotMatch(source, /mailto:hallo@vibeisland\.is/);
});

test("idea generator only shows the random idea control, not the full idea bank", () => {
  assert.match(source, /Fá nýja hugmynd/);
  assert.match(source, /Generate Idea/);
  assert.doesNotMatch(source, /Hugmyndabanki/);
  assert.doesNotMatch(source, /Idea pool/);
  assert.doesNotMatch(source, /ideaPool\.map\(\(idea/);
});
