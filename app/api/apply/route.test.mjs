import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("application API uses a server-only Supabase key", () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("application API is pinned to the Node.js runtime", () => {
  assert.match(source, /export const runtime = "nodejs"/);
});

test("application API handles invalid JSON requests", () => {
  assert.match(source, /try\s*{[\s\S]*request\.json\(\)[\s\S]*}\s*catch/);
  assert.match(source, /Invalid application request/);
});

test("application API exposes a lightweight health check", () => {
  assert.match(source, /export async function GET/);
  assert.match(source, /application-api-ready/);
});

test("application API validates the request before creating the Supabase client", () => {
  assert.ok(source.indexOf("Missing required application fields.") < source.indexOf("createClient(supabaseUrl"));
});

test("application API validates the Supabase URL format", () => {
  assert.match(source, /new URL\(supabaseUrl\)/);
  assert.match(source, /Application storage is misconfigured/);
});

test("application API returns safe Supabase diagnostics on insert failure", () => {
  assert.match(source, /debug:/);
  assert.match(source, /code: error\.code/);
  assert.match(source, /message: error\.message/);
  assert.doesNotMatch(source, /debug:[\s\S]*supabaseKey/);
  assert.doesNotMatch(source, /debug:[\s\S]*process\.env/);
});
