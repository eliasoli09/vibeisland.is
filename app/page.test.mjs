import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("landing page partner CTAs route to the partner form", () => {
  assert.match(source, /href="\/partner"/);
  assert.doesNotMatch(source, /Vibe%20%C3%8Dsland%20partnership/);
});
