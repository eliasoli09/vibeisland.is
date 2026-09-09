# Vallaeyjar Project Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a reusable Projects area to Vibe Ísland and embed the complete Vallaeyjar stadium viewer on its own responsive route.

**Architecture:** Keep the supplied viewer as a self-contained static HTML document under `public/` and load it through a lifecycle-aware React iframe. Store project metadata in one typed array, render the index from that array, and add only one localized link to the existing landing-page menu.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner, standalone Three.js/WebGL HTML, browser automation.

---

### Task 1: Define the route and menu contracts

**Files:**
- Modify: `app/page.test.mjs`
- Create: `app/verkefni/verkefni.test.mjs`

- [x] **Step 1: Write a failing landing-menu test**

Add an assertion that `app/page.tsx` contains an anchor target for `/verkefni` and the visible label `Verkefni`.

- [x] **Step 2: Write failing project-route tests**

Test that the project metadata exports Vallaeyjar with `/verkefni/vallaeyjar`, the index renders „Opna verkefni“, and the detail route references `/projects/vallaeyjar/viewer.html`, `allowFullScreen`, an iframe `title`, cleanup to `about:blank`, and accurate `.stadium` sharing copy.

- [x] **Step 3: Run tests and confirm RED**

Run:

```bash
node --test app/page.test.mjs app/verkefni/verkefni.test.mjs
```

Expected: FAIL because the menu target and project files do not exist.

### Task 2: Add the static Vallaeyjar viewer

**Files:**
- Create: `public/projects/vallaeyjar/viewer.html`

- [x] **Step 1: Copy the supplied self-contained viewer**

Copy `/Users/elias/Downloads/Kaplakriki_3D (2).html` byte-for-byte to `public/projects/vallaeyjar/viewer.html`.

- [x] **Step 2: Verify the static contract**

Confirm the copied file matches the source checksum and contains `Kaplakriki`, `Auðar`, `data-view="top"`, `data-view="main"`, `tour-button`, `drone-button`, `stadium-file`, `export-island`, `copy-prompt`, `fullscreen`, IndexedDB code, and the quality selector.

### Task 3: Build the projects index and detail page

**Files:**
- Create: `app/verkefni/projects.ts`
- Create: `app/verkefni/page.tsx`
- Create: `app/verkefni/vallaeyjar/page.tsx`
- Create: `app/verkefni/vallaeyjar/vallaeyjar-viewer.tsx`
- Modify: `app/page.tsx`

- [x] **Step 1: Add typed project data**

Define a `Project` type and a `projects` array containing Vallaeyjar, its Icelandic description, route, status, and viewer path. Keep the array as the sole project-card data source.

- [x] **Step 2: Add the index route**

Render a semantic header with a back link to `/`, a project count, and a responsive map over `projects`. Each card contains the project name, short description, status, and a Next.js `Link` labelled „Opna verkefni“.

- [x] **Step 3: Add the iframe lifecycle component**

Create a client component with an iframe ref. Set the real static URL as `src`, include `allow="clipboard-read; clipboard-write; fullscreen"` and `allowFullScreen`, and set `iframe.src = "about:blank"` during unmount.

- [x] **Step 4: Add the Vallaeyjar route**

Render a compact back link, title, local-storage explanation, and the lifecycle component. Size the viewer with `h-[calc(100dvh-...)]` plus sensible `min-height` values so controls remain reachable at desktop and mobile widths.

- [x] **Step 5: Add the landing-menu item**

Place a full-width `/verkefni` link labelled „Verkefni“ above the existing guide links without changing their content or the contact section.

- [x] **Step 6: Run tests and confirm GREEN**

Run:

```bash
node --test app/page.test.mjs app/verkefni/verkefni.test.mjs
```

Expected: all selected tests PASS.

### Task 4: Verify production and browser behavior

**Files:**
- Create: `tests/vallaeyjar-browser.py`

- [x] **Step 1: Run static verification**

Run all Node tests, `npm run lint`, `npm run build`, and `git diff --check`. Expected: exit code 0 with no failed tests or lint/build errors.

- [x] **Step 2: Test routes in a real browser**

Open `/`, use the „Verkefni“ menu link, open Vallaeyjar, reload both routes, and use the back link. Confirm the iframe is visible and unloaded after leaving the detail route.

- [x] **Step 3: Test the viewer controls**

Confirm initial island selection, Kaplakriki/Auðar branding, tour start/stop, Top and Side views, drone entry and movement, orbit zoom, quality changes, sample `.stadium` download/import, persistence after reload, stadium download, prompt copy, and fullscreen enter/exit.

- [x] **Step 4: Test responsive layout and console health**

Repeat the essential navigation and controls at a narrow mobile viewport. Confirm no clipping blocks controls and report any browser console errors separately from non-fatal WebGL/browser warnings.

- [x] **Step 5: Review the final diff**

Confirm the work changes only the new project feature, its menu entry, tests, docs, and static viewer asset.
