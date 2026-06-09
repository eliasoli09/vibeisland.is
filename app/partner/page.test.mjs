import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("partner page contains the sponsor application form", () => {
  assert.match(source, /Styrktaraðilaumsókn/);
  assert.match(source, /Nafn fyrirtækis/);
  assert.match(source, /Hvers vegna hefur fyrirtækið áhuga/);
  assert.match(source, /Fjárstyrkur/);
  assert.match(source, /Má hafa samband/);
});

test("partner page submits to the partner API", () => {
  assert.match(source, /fetch\("\/api\/partner"/);
  assert.match(source, /company_name/);
  assert.match(source, /contact_name/);
});
