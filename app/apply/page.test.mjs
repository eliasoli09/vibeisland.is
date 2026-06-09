import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("application form displays the server error message when submit fails", () => {
  assert.match(source, /await res\.json\(\)/);
  assert.match(source, /serverError\?\.error/);
  assert.match(source, /setSubmitError\(error instanceof Error \? error\.message : t\.errorMessage\)/);
});
