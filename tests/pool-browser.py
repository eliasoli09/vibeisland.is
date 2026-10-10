"""Run with python3 tests/pool-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Pool: the 8-ball mode. The rack, AI games on every difficulty (no ball ever gets through a cushion,
overlaps another or goes NaN, and harder AIs pot more), aiming and shooting with the mouse, the keys
and on a phone (finger + POWER bar), the rules (groups, fouls, scratches, the 8) and the camera.
"""
import json
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []
L, W = 6.4, 3.2


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def steps(page, seconds):
    page.evaluate(f"for (let i = 0; i < {round(seconds * 120)}; i++) __pong.stepFor(1 / 120)")


def pool(page):
    return page.evaluate("__pong.pool()")


def ball(state, i):
    return next(b for b in state["balls"] if b["id"] == i)


def straight_in(page, cue, obj, pocket, power, opts):
    """Set up a straight shot: cue ball, one object ball on the line to a pocket, then shoot it."""
    page.evaluate(f"__pong.poolSet({json.dumps([[0, *cue], *obj])}, {json.dumps(opts)})")
    a = math.atan2(obj[0][2] - cue[1], obj[0][1] - cue[0])
    page.evaluate(f"__pong.poolShoot({a}, {power})")
    return page.evaluate("__pong.poolSettle()")


STRESS = r"""
(trials) => {
  const L = 6.4, W = 3.2, BR = 0.16, P = [[-L, -W], [0, -W], [L, -W], [-L, W], [0, W], [L, W]];
  let esc = 0, ovl = 0;
  __pong.mode('pool');
  for (let t = 0; t < trials; t++) {
    const list = [], side = t % 4;
    for (let k = 0; k < 6; k++) {
      const u = -2.5 + k * 2 * BR * 1.0005 + (t % 7) * 0.05;
      list.push([k + 1, ...(side === 0 ? [u, -W + BR] : side === 1 ? [u, W - BR] : side === 2 ? [-L + BR, u + 1.2] : [L - BR, u + 1.2])]);
    }
    const cue = [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3];
    list.push([9, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4], [0, ...cue]);
    __pong.poolSet(list, { groups: ['solid', 'stripe'] });
    const tgt = list[Math.floor(Math.random() * 6)];
    __pong.poolShoot(Math.atan2(tgt[2] - cue[1], tgt[1] - cue[0]) + (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.3);
    for (let i = 0; i < 2400; i++) {
      __pong.stepFor(1 / 120);
      const s = __pong.pool();
      for (const b of s.balls) if (b.on && !P.some(([x, z]) => Math.hypot(b.x - x, b.z - z) < 0.75) && (Math.abs(b.x) > L - BR + 0.01 || Math.abs(b.z) > W - BR + 0.01)) esc++;
      if (s.state !== 'roll') break;
    }
    const on = __pong.pool().balls.filter((b) => b.on);
    for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) if (Math.hypot(on[a].x - on[b].x, on[a].z - on[b].z) < 2 * BR - 0.01) ovl++;
  }
  return { esc, ovl };
}
"""


def new_page(browser, **kw):
    page = browser.new_page(**kw)
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
    page.goto(GAME)
    page.wait_for_function("Boolean(window.__pong)", timeout=30000)
    return page


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = new_page(browser, viewport={"width": 1280, "height": 800})

        # 1. The mode: 1 v 1 against the AI, and the menu explains it
        page.locator("#modePool").click()
        check(page.locator("#modePool").get_attribute("aria-checked") == "true" and page.locator("#hintPool").is_visible(), "POOL is a mode, and the menu explains 8-ball")
        check(not page.locator(".sizes").is_visible() and not page.locator("#btnOnline").is_visible(), "pool is 1 v 1 against the AI (no 2 v 2, no online yet)")

        # 2. The rack
        page.locator("#btnStart").click()
        s = pool(page)
        ids = sorted(b["id"] for b in s["balls"])
        others = [b for b in s["balls"] if b["id"]]
        eight = ball(s, 8)
        apex = min(others, key=lambda b: b["x"])
        check(ids == list(range(16)) and all(b["on"] for b in s["balls"]), "16 balls on the table: the cue ball and 1-15")
        check(abs(ball(s, 0)["x"] + L / 2) < 1e-6 and abs(apex["x"] - L / 2) < 0.01, "the cue ball is on the head spot and the rack's apex on the foot spot")
        check(abs(eight["z"]) < 0.01 and abs(eight["x"] - (L / 2 + 2 * 0.324 * math.cos(math.pi / 6))) < 0.01, "the 8 sits in the middle of the rack")
        check(s["isBreak"] and s["turn"] == 0 and s["groups"] == [None, None], "you break, on an open table")

        # 3. AI games: the physics holds up and harder AIs pot more per shot
        rate = {}
        for diff in ("easy", "normal", "hard"):
            r = page.evaluate(f"__pong.psim(1500, {{ diff: '{diff}' }})")
            shots, pots = sum(r["plShots"]), sum(r["plPots"])
            rate[diff] = pots / max(1, shots)
            print(diff, {"shots": shots, "pots": pots, "fouls": sum(r["plFouls"]), "scratches": sum(r["plScratches"]), "games": len(r["plGames"]), "pots/shot": round(rate[diff], 2)})
            check(r["plEscaped"] == 0 and r["plOverlap"] == 0 and r["plNaN"] == 0, f"{diff}: no ball gets through a cushion, overlaps another or goes NaN")
            check(len(r["plGames"]) >= 4, f"{diff}: the AIs finish whole racks ({len(r['plGames'])})")
            check(all(g["winner"] in (0, 1) and ("8" in g["why"]) for g in r["plGames"]), f"{diff}: every rack ends on the 8")
        check(rate["easy"] < rate["normal"] < rate["hard"], f"harder AIs pot more per shot ({rate['easy']:.2f} < {rate['normal']:.2f} < {rate['hard']:.2f})")
        # rows of balls pressed against a cushion, blasted by the cue ball: nothing gets shoved into a cushion or another ball
        r = page.evaluate(STRESS, 120)
        check(r["esc"] == 0 and r["ovl"] == 0, f"balls packed against the cushions never get pushed into them or into each other ({r})")

        # 4. Mouse: hover aims, press + pull back + let go shoots; a tiny pull does nothing
        page.locator("#btnPause").click(); page.locator("#btnQuit").click()
        page.locator("#modePool").click()
        page.locator("#btnStart").click()
        steps(page, 2)
        x, y = page.evaluate("__pong.poolScreen(0, 2)")
        page.mouse.move(x, y)
        s = pool(page)
        want = math.atan2(2 - ball(s, 0)["z"], 0 - ball(s, 0)["x"])
        check(abs(s["aim"] - want) < 0.01 and s["guide"] and s["cue"], "the cue and the aim line follow the mouse")
        check(page.locator("#poolPow").is_visible(), "the POWER bar shows while you aim")
        page.mouse.down(); page.mouse.move(x + 3, y + 2); page.mouse.up()
        check(pool(page)["state"] == "aim", "a tiny pull doesn't shoot")
        x, y = page.evaluate("__pong.poolScreen(3.2, 0)")
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x - 120, y, steps=4)
        mid = pool(page)["pow"]
        page.mouse.move(x - 400, y, steps=4)
        full = pool(page)["pow"]
        check(0.1 < mid < full and full == 1, f"pulling further back adds power ({mid:.2f} then {full:.2f})")
        page.mouse.up()
        check(pool(page)["state"] == "roll", "letting go breaks")
        page.evaluate("__pong.poolSettle()")
        check(sum(1 for b in pool(page)["balls"] if abs(b["x"] - L / 2) > 1.5 and b["id"]) >= 4, "the break spreads the rack")

        # 5. Keys: arrows aim and set the power, Enter shoots
        page.evaluate(f"__pong.poolSet([[0, -2, 0], [1, 2, 1.5], [9, 3, -1.5]], {{ groups: [null, null] }})")
        a0 = pool(page)["aim"]
        page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight"); page.keyboard.press("Shift+ArrowLeft")
        check(abs(pool(page)["aim"] - (a0 + 0.024 - 0.0025)) < 1e-6, "arrows turn the cue (Shift finely)")
        page.keyboard.press("ArrowUp")
        check(abs(pool(page)["pow"] - 0.55) < 1e-6, "up/down set the power")
        page.keyboard.press("Enter")
        check(pool(page)["state"] == "roll", "Enter shoots")

        # 6. The rules
        straight_in(page, (3, -1.5), [[1, 5, -2.5]], (L, -W), 0.35, {"groups": [None, None]})
        s = pool(page)
        check(not ball(s, 1)["on"] and s["groups"] == ["solid", "stripe"] and s["turn"] == 0, "potting the first ball claims its group (solids) and you shoot again")
        check("YOU: SOLIDS" in s["hud"] and s["score"][0] == 7 - sum(1 for b in s["balls"] if b["on"] and 0 < b["id"] < 8), f"the HUD shows your group and score ({s['hud']})")
        straight_in(page, (3, -1.5), [[9, 5, -2.5], [2, -4, 2]], (L, -W), 0.35, {"groups": ["solid", "stripe"]})
        s = pool(page)
        check(s["turn"] == 1, "hitting the other group's ball first is a foul: the turn passes")
        page.evaluate("__pong.poolSet([[0, 5, -2.5], [2, -4, 2], [8, -3, -2]], { groups: ['solid', 'stripe'] })")
        page.evaluate(f"__pong.poolShoot({math.atan2(-0.7, 1.4)}, 0.4)")
        page.evaluate("__pong.poolSettle()")
        s = pool(page)
        check(s["turn"] == 1 and ball(s, 0)["on"] and abs(ball(s, 0)["x"] + L / 2) < 0.01, "a scratch: the turn passes and the cue ball goes back on the head spot")
        straight_in(page, (3, -1.5), [[8, 5, -2.5], [2, -4, 2]], (L, -W), 0.35, {"groups": ["solid", "stripe"]})
        s = pool(page)
        check(s["state"] == "over" and s["winner"] == 1 and "too early" in s["why"], "sinking the 8 before your group is cleared loses")
        check(page.locator("#over").is_visible() and "WINS" in page.locator("#overTitle").inner_text(), f"the end screen shows who won ({page.locator('#overTitle').inner_text()})")
        page.locator("#btnRematch").click()
        straight_in(page, (3, -1.5), [[8, 5, -2.5], [10, -4, 2]], (L, -W), 0.35, {"groups": ["solid", "stripe"]})
        s = pool(page)
        check(s["state"] == "over" and s["winner"] == 0 and "sank the 8" in s["why"], "with your group cleared, sinking the 8 wins")
        check(page.locator("#overTitle").inner_text().endswith("WINS!") and "You sank the 8 ball" in page.locator("#overSub").inner_text(), "the end screen says how")

        # 7. The camera fits the whole table, from the long side
        page.locator("#btnRematch").click()
        steps(page, 1)
        corners = [page.evaluate(f"__pong.poolScreen({sx * (L + 0.8)}, {sz * (W + 0.8)})") for sx in (-1, 1) for sz in (-1, 1)]
        check(all(0 <= cx <= 1280 and 0 <= cy <= 800 for cx, cy in corners), "the whole table is on screen")
        cam = pool(page)["cam"]
        check(cam[2] > 3 and abs(cam[0]) < 1, "on a wide screen the camera looks from the long side")
        page.close()

        # 8. A phone: the camera looks down the table, a finger aims, the POWER bar shoots
        page = new_page(browser, viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page.evaluate("__pong.mode('pool')")
        steps(page, 2)
        s = pool(page)
        check(s["cam"][0] > 3 and abs(s["cam"][2]) < 1, "on a tall screen the camera looks down the table from the end")
        corners = [page.evaluate(f"__pong.poolScreen({sx * (L + 0.8)}, {sz * (W + 0.8)})") for sx in (-1, 1) for sz in (-1, 1)]
        page.wait_for_selector("#poolPow", state="visible", timeout=10000)
        bar = page.locator("#poolPow").bounding_box()
        check(all(0 <= cx <= 390 and 0 <= cy <= 844 for cx, cy in corners), "the whole table is on the phone's screen")
        check(bar["y"] > max(cy for _, cy in corners), "the POWER bar sits under the table, not over it")
        check(page.locator(".first-to").is_visible(), "the groups / whose shot line shows on phones too")
        x, y = page.evaluate("__pong.poolScreen(2, -2)")
        page.touchscreen.tap(x, y)
        s = pool(page)
        check(abs(s["aim"] - math.atan2(-2 - ball(s, 0)["z"], 2 - ball(s, 0)["x"])) < 0.01, "a finger on the table aims")
        bx, by = bar["x"] + bar["width"] / 2, bar["y"] + 20
        page.evaluate(f"""(() => {{
            const el = document.querySelector('#poolPow');
            const ev = (type, y) => el.dispatchEvent(new PointerEvent(type, {{ bubbles: true, pointerId: 7, pointerType: 'touch', clientX: {bx}, clientY: y, isPrimary: true }}));
            ev('pointerdown', {by}); ev('pointermove', {by + 60});
            window.__powMid = __pong.pool().pow;
            ev('pointermove', {by + 400}); ev('pointerup', {by + 400});
        }})()""")
        check(page.evaluate("window.__powMid") > 0.1 and pool(page)["state"] == "roll", "pulling the POWER bar down and letting go shoots")
        page.evaluate("__pong.poolSettle()")
        page.evaluate("__pong.poolSet([[0, -2, 0], [1, 2, 1.5]], { turn: 1 })")
        page.wait_for_selector("#poolPow", state="hidden", timeout=10000)
        check(not page.locator("#poolPow").is_visible(), "the POWER bar hides while the AI shoots")

        check(not ERRORS, "no page errors: " + "; ".join(ERRORS[:3]))
        browser.close()


if __name__ == "__main__":
    main()
