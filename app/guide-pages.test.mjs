import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guideSource = readFileSync(new URL("./guide-content.tsx", import.meta.url), "utf8");
const englishPageSource = readFileSync(new URL("./everything-you-need-to-know/page.tsx", import.meta.url), "utf8");
const icelandicPageSource = readFileSync(new URL("./allt-sem-thu-tharft-ad-vita/page.tsx", import.meta.url), "utf8");

test("English guide is a scroll page based on Vibe Iceland.pdf", () => {
  assert.match(englishPageSource, /GuidePage/);
  assert.match(englishPageSource, /guide=\{guides\.en\}/);
  assert.match(guideSource, /Everything you need to know/);
  assert.match(guideSource, /What is Vibe Iceland/);
  assert.match(guideSource, /Participants/);
  assert.match(guideSource, /What to Expect/);
  assert.match(guideSource, /Future vision/);
  assert.match(guideSource, /Location/);
  assert.match(guideSource, /The location for Vibe Iceland 2026 is TBA/);
  assert.doesNotMatch(guideSource, /will take place at Gróska/);
});

test("Icelandic guide is a scroll page based on Vibe Ísland (1).pdf", () => {
  assert.match(icelandicPageSource, /GuidePage/);
  assert.match(icelandicPageSource, /guide=\{guides\.is\}/);
  assert.match(guideSource, /Allt sem þú þarft að vita/);
  assert.match(guideSource, /Hvað er Vibe Ísland/);
  assert.match(guideSource, /Þátttakendur/);
  assert.match(guideSource, /Við hverju má búast/);
  assert.match(guideSource, /Framtíðarsýn/);
  assert.match(guideSource, /Staðsetning/);
  assert.match(guideSource, /Staðsetning Vibe Íslands 2026 er TBA/);
  assert.doesNotMatch(guideSource, /fer fram í Grósku/);
});
