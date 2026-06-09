import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const iconPath = new URL("../public/vibe-site-icon.png", import.meta.url);
const appleIconPath = new URL("../public/apple-touch-icon.png", import.meta.url);
const defaultFaviconPath = new URL("./favicon.ico", import.meta.url);

test("site metadata uses Vibe Iceland icons instead of the default favicon", () => {
  assert.match(source, /icons:/);
  assert.match(source, /\/vibe-site-icon\.png/);
  assert.match(source, /\/apple-touch-icon\.png/);
  assert.ok(existsSync(iconPath), "expected public/vibe-site-icon.png to exist");
  assert.ok(existsSync(appleIconPath), "expected public/apple-touch-icon.png to exist");
  assert.equal(existsSync(defaultFaviconPath), false, "expected app/favicon.ico to be removed");
});
