import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const here = import.meta.url;
const fileUrl = (path) => new URL(path, here);
const readIfPresent = (path) => {
  const url = fileUrl(path);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const projectsSource = readIfPresent("./projects.ts");
const indexSource = readIfPresent("./page.tsx");
const detailSource = readIfPresent("./vallaeyjar/page.tsx");
const viewerSource = readIfPresent("./vallaeyjar/vallaeyjar-viewer.tsx");
const staticViewerUrl = fileUrl("../../public/projects/vallaeyjar/viewer.html");
const staticViewerSource = existsSync(staticViewerUrl)
  ? readFileSync(staticViewerUrl, "utf8")
  : "";

test("projects are defined in one reusable data source", () => {
  assert.match(projectsSource, /export type Project/);
  assert.match(projectsSource, /export const projects/);
  assert.match(projectsSource, /export function getProjectBySlug/);
  assert.match(projectsSource, /title: "Vallaeyjar"/);
  assert.match(projectsSource, /href: "\/verkefni\/vallaeyjar"/);
  assert.match(projectsSource, /viewerPath: "\/projects\/vallaeyjar\/viewer\.html"/);
});

test("projects index renders reusable cards for Vallaeyjar", () => {
  assert.match(indexSource, /projects\.map/);
  assert.match(indexSource, />Verkefni</);
  assert.match(indexSource, /Opna verkefni/);
  assert.match(indexSource, /href=\{project\.href\}/);
});

test("Vallaeyjar detail page explains local stadium sharing", () => {
  assert.match(detailSource, /Til baka í verkefni/);
  assert.match(detailSource, /<VallaeyjarViewer/);
  assert.match(detailSource, /\.stadium/);
  assert.match(detailSource, /vafra/);
  assert.match(detailSource, /aðgengileg öllum/);
  assert.match(detailSource, /Eyjur sem þú bætir við vistast aðeins í þínum vafra/);
});

test("viewer iframe preserves required capabilities and stops on unmount", () => {
  assert.match(viewerSource, /src=\{viewerPath\}/);
  assert.match(viewerSource, /allowFullScreen/);
  assert.match(viewerSource, /clipboard-read; clipboard-write; fullscreen/);
  assert.match(viewerSource, /title="Vallaeyjar - gagnvirkur þrívíddarskoðari"/);
  assert.match(viewerSource, /frame\.src = "about:blank"/);
  assert.doesNotMatch(viewerSource, /sandbox=/);
});

test("static viewer keeps the complete Vallaeyjar feature set", () => {
  assert.ok(existsSync(staticViewerUrl), "expected the static viewer to exist");
  assert.match(staticViewerSource, /Kaplakriki/);
  assert.match(staticViewerSource, /Auðar/);
  assert.match(staticViewerSource, /data-view="top"/);
  assert.match(staticViewerSource, /data-view="main"/);
  assert.match(staticViewerSource, /id="tour-button"/);
  assert.match(staticViewerSource, /id="drone-button"/);
  assert.match(staticViewerSource, /id="stadium-file"/);
  assert.match(staticViewerSource, /id="export-island"/);
  assert.match(staticViewerSource, /id="copy-prompt"/);
  assert.match(staticViewerSource, /id="fullscreen"/);
  assert.match(staticViewerSource, /indexedDB/);
  assert.match(staticViewerSource, /id="quality"/);
});

const pongDetailSource = readIfPresent("./pixel-pong/page.tsx");
const embedSource = readIfPresent("./project-embed.tsx");
const staticPongUrl = fileUrl("../../public/projects/pixel-pong/game.html");
const staticPongSource = existsSync(staticPongUrl) ? readFileSync(staticPongUrl, "utf8") : "";

test("Pixel Pong is registered as the second project", () => {
  assert.match(projectsSource, /title: "Pixel Pong"/);
  assert.match(projectsSource, /href: "\/verkefni\/pixel-pong"/);
  assert.match(projectsSource, /viewerPath: "\/projects\/pixel-pong\/game\.html"/);
  assert.match(projectsSource, /preview: "\/projects\/pixel-pong\/preview\.png"/);
  assert.ok(existsSync(fileUrl("../../public/projects/pixel-pong/preview.png")), "expected a preview image");
});

test("project cards use per-project preview alt text", () => {
  assert.match(indexSource, /alt=\{project\.previewAlt\}/);
  assert.match(projectsSource, /previewAlt: string/);
});

test("Pixel Pong detail page embeds the game and explains controls", () => {
  assert.match(pongDetailSource, /Til baka í verkefni/);
  assert.match(pongDetailSource, /<ProjectEmbed/);
  assert.match(pongDetailSource, /músina/);
  assert.match(embedSource, /src=\{src\}/);
  assert.match(embedSource, /frame\.src = "about:blank"/);
  assert.doesNotMatch(embedSource, /sandbox=/);
});

test("Pixel Pong is playable directly on the projects index", () => {
  assert.match(projectsSource, /playInline\?: boolean/);
  assert.match(projectsSource, /slug: "pixel-pong",[\s\S]*playInline: true/);
  assert.match(indexSource, /project\.playInline \?/);
  assert.match(indexSource, /<ProjectEmbed/);
  assert.match(indexSource, /loading="lazy"/);
  assert.match(indexSource, /<Image/);
});

test("static Pixel Pong game is a complete document with both fighters", () => {
  assert.ok(existsSync(staticPongUrl), "expected the static game to exist");
  assert.match(staticPongSource, /^<!DOCTYPE html>/);
  assert.match(staticPongSource, /three\.js\/r128\/three\.min\.js/);
  assert.match(staticPongSource, /name: 'CLAUDE'/);
  assert.match(staticPongSource, /name: 'CODEX'/);
  assert.match(staticPongSource, /id="btnStart"/);
  assert.match(staticPongSource, /\[hidden\] \{ display: none !important; \}/);
  assert.match(staticPongSource, /WIN = 7/);
});

test("Pixel Pong has timed spin shots, streaks and power-ups", () => {
  assert.match(staticPongSource, /const SPIN = \{/);
  assert.match(staticPongSource, /function tapSpin\(\)/);
  assert.match(staticPongSource, /function integrate\(s, dt\)/);
  assert.match(staticPongSource, /'BIG PADDLE'/);
  assert.match(staticPongSource, /'SLOW-MO'/);
  assert.match(staticPongSource, /id="spinPips"/);
  assert.match(staticPongSource, /window\.__pong = \{/);
  assert.match(pongDetailSource, /snúning/);
});

const auroraDetailSource = readIfPresent("./nordurljos/page.tsx");
const staticAuroraUrl = fileUrl("../../public/projects/nordurljos/app.html");
const staticAuroraSource = existsSync(staticAuroraUrl) ? readFileSync(staticAuroraUrl, "utf8") : "";

test("Norðurljós is registered as the third project", () => {
  assert.match(projectsSource, /number: "03",\s*slug: "nordurljos"/);
  assert.match(projectsSource, /title: "Norðurljós"/);
  assert.match(projectsSource, /href: "\/verkefni\/nordurljos"/);
  assert.match(projectsSource, /viewerPath: "\/projects\/nordurljos\/app\.html"/);
  assert.match(projectsSource, /preview: "\/projects\/nordurljos\/preview\.png"/);
  assert.ok(existsSync(fileUrl("../../public/projects/nordurljos/preview.png")), "expected a preview image");
});

test("Norðurljós detail page embeds the app", () => {
  assert.match(auroraDetailSource, /Til baka í verkefni/);
  assert.match(auroraDetailSource, /<ProjectEmbed src=\{project\.viewerPath\}/);
});

test("static Norðurljós app is a complete document with all its scripts", () => {
  assert.ok(existsSync(staticAuroraUrl), "expected the static app to exist");
  assert.match(staticAuroraSource, /^<!doctype html>/i);
  assert.match(staticAuroraSource, /<meta name="viewport"/);
  for (const script of ["data/cgm.js", "data/land.js", "data/iceland.js", "js/gl.js", "js/astro.js", "js/sky.js", "js/sun.js", "js/magneto.js", "js/atmos.js", "js/globe.js", "js/iceland.js", "js/app.js"]) {
    assert.match(staticAuroraSource, new RegExp(`src="${script}"`));
    assert.ok(existsSync(fileUrl(`../../public/projects/nordurljos/${script}`)), `expected ${script}`);
  }
});
