import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("partner API stores sponsor applications in the partner table", () => {
  assert.match(source, /partner_applications/);
  assert.match(source, /company_name/);
  assert.match(source, /contact_name/);
  assert.match(source, /job_title/);
});

test("partner API uses the same server-only Supabase setup as applications", () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
  assert.match(source, /supabaseProjectUrl = new URL\(supabaseUrl\)\.origin/);
  assert.match(source, /export const runtime = "nodejs"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
