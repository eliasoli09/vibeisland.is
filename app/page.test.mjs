import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("landing page partner CTAs route to the partner form", () => {
  assert.match(source, /href="\/partner"/);
  assert.doesNotMatch(source, /Vibe%20%C3%8Dsland%20partnership/);
});

test("landing page menu includes PDF guides and contact details", () => {
  assert.match(source, /Everything you need to know/);
  assert.match(source, /Allt sem þú þarft að vita/);
  assert.match(source, /\/vibe-iceland-everything-you-need-to-know\.pdf/);
  assert.match(source, /\/vibe-island-allt-sem-thu-tharft-ad-vita\.pdf/);
  assert.match(source, /Elías Óli Tinnusson Björnsson/);
  assert.match(source, /eliasoli0967@gmail\.com/);
  assert.match(source, /\+354 771 2109/);
});
