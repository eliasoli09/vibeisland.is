"""Run with python3 tests/minigolf-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Mini golf: the 9-hole neon course, slide aim (mouse, touch, keys), turns, water penalties, the
special holes (windmill, loop, clown, pinball, gates, volcano, bridge, robot), AI rounds on every
difficulty, and the scorecard at the end.
"""
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def per_hole(holes):
    per = [[] for _ in range(9)]
    for i, (a, b) in enumerate(holes):
        per[i % 9] += [a, b]
    return [sum(x) / len(x) if x else None for x in per]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
        page.goto(GAME)
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        # 1. The mode: 1 v 1 only, 9 unique holes, par 27
        page.locator("#modeGolf").click()
        check(page.locator("#modeGolf").get_attribute("aria-checked") == "true" and page.locator("#hintGolf").is_visible(), "MINI GOLF is a mode, and the menu explains slide aim")
        check(not page.locator(".sizes").is_visible() and page.locator("#btnOnline").is_visible(), "mini golf is 1 v 1: against the AI, or a friend online (no 2 v 2)")
        g = page.evaluate("__pong.golf()")
        names = [h["name"] for h in g["holes"]]
        check(len(names) == 9 and len(set(names)) == 9 and g["par"] == 27, f"9 different holes, par 27 ({', '.join(names)})")

        # 2. AI rounds: the ball never escapes, every special hole gets used, harder AIs score better
        totals = {}
        for diff in ("easy", "normal", "hard"):
            r = page.evaluate(f"__pong.gsim(1800, {{ diff: '{diff}' }})")
            avg = per_hole(r["gfHoles"])
            totals[diff] = sum(avg)
            print(diff, "per hole", [round(a, 2) for a in avg], "total", round(totals[diff], 1),
                  {k: r[k] for k in ("bumps", "loops", "loopFails", "clown", "portals", "water", "moverHits", "escaped")})
            check(r["escaped"] == 0, f"{diff}: the ball never gets through a wall")
            check(len(r["gfHoles"]) >= 18, f"{diff}: the AIs play whole rounds ({len(r['gfHoles'])} holes)")
            check(all(1 <= a <= 7 and 1 <= b <= 7 for a, b in r["gfHoles"]), f"{diff}: every hole ends in 1-7 strokes")
            if diff == "normal":
                check(r["loops"] > 0 and r["clown"] > 0 and r["portals"] > 0 and r["bumps"] > 0 and r["moverHits"] > 0,
                      "the loop, the clown's mouth, the robot's tunnel, the bumpers and the moving obstacles all come into play")
        check(totals["easy"] > totals["normal"] > totals["hard"], f"harder AIs take fewer strokes ({ {k: round(v, 1) for k, v in totals.items()} })")
        check(abs(totals["normal"] - 27) <= 6, f"a NORMAL AI plays about par ({totals['normal']:.1f} vs 27)")

        # 2b. The camera plays like a golf game: behind the ball looking down the hole, follows the ball, VIEW shows it all
        page.evaluate("__pong.golfSnap(); __pong.mode('golf'); __pong.golfGo(0)")
        page.wait_for_timeout(1200)
        g = page.evaluate("__pong.golf()")
        ox, oz = -26, -26  # hole 1's place on the course
        bx, bz = ox + g["ball"]["x"], oz + g["ball"]["z"]
        cam, look = g["cam"], g["look"]
        check(cam[2] > bz + 2 and look[2] < bz and cam[1] > 2, f"the camera sits behind the ball, looking up the hole (cam {[round(c, 1) for c in cam]}, ball z {bz:.1f})")
        page.evaluate("__pong.golfShoot(-Math.PI / 2, 0.55)")
        page.wait_for_function("__pong.golf().state !== 'roll'", timeout=60000)
        page.wait_for_timeout(1500)
        g = page.evaluate("__pong.golf()")
        bx2, bz2 = ox + g["ball"]["x"], oz + g["ball"]["z"]
        near = math.hypot(g["cam"][0] - bx2, g["cam"][2] - bz2)
        check(math.hypot(g["cam"][0] - cam[0], g["cam"][2] - cam[2]) > 3 and near < 7, f"the camera follows the ball up the hole ({near:.1f} away from it)")
        behind = math.atan2(bz2 - g["cam"][2], bx2 - g["cam"][0])  # from the camera to the ball...
        d = abs(math.atan2(math.sin(behind - g["pathDir"]), math.cos(behind - g["pathDir"])))
        check(d < 0.4, f"...and stays behind it along the hole's path, round the dogleg's corner (off by {d:.2f})")
        page.keyboard.press("v")
        page.wait_for_timeout(1200)
        v = page.evaluate("__pong.golf()")
        check(v["view"] and v["cam"][1] > g["cam"][1] + 3, f"VIEW shows the whole hole from above (camera height {g['cam'][1]:.1f} -> {v['cam'][1]:.1f})")
        page.keyboard.press("v")
        bloom = page.evaluate("__pong.golf().bloom")
        print("bloom on:", bloom)
        page.evaluate("__pong.golfSnap(false)")

        # 3. Slide aim with the mouse: drag back, see the aim, let go to putt
        page.evaluate("__pong.mode('golf'); __pong.golfGo(1)")
        page.wait_for_timeout(1500)
        page.mouse.move(640, 420)
        page.mouse.down()
        page.mouse.move(640, 430, steps=2)
        page.mouse.up()
        check(page.evaluate("__pong.golf().state") == "aim", "a tiny drag doesn't putt")
        page.mouse.move(640, 420)
        page.mouse.down()
        page.mouse.move(645, 600, steps=8)
        aim = page.evaluate("__pong.golf().aim")
        check(aim and 0.25 < aim["p"] < 0.9 and abs(aim["a"] + math.pi / 2) < 0.4, f"dragging back aims forward with power from the drag length ({aim})")
        page.mouse.up()
        g = page.evaluate("__pong.golf()")
        check(g["state"] == "roll" and g["cur"] == 1 and g["ball"]["vz"] < -3, "letting go putts the ball up the course")
        page.wait_for_function("__pong.golf().state !== 'roll'", timeout=60000)

        # 4. Keys: arrows aim and set the power, Enter putts
        page.evaluate("__pong.golfGo(0)")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowLeft"); page.keyboard.press("ArrowUp"); page.keyboard.press("ArrowUp")
        check(page.evaluate("__pong.golf().aim") is not None, "the arrow keys show an aim")
        page.keyboard.press("Enter")
        check(page.evaluate("__pong.golf().state") == "roll", "Enter putts")

        # 5. The loop: a hard putt goes round it; a soft one rolls back
        page.evaluate("__pong.golfGo(2); __pong.golfShoot(-Math.PI / 2, 1)")
        page.wait_for_function("__pong.golf().ball.z < -1.2 || __pong.golf().state !== 'roll'", timeout=60000)
        check(page.evaluate("__pong.golf().ball.z") < -1.2, "a hard putt goes round the loop")
        page.evaluate("__pong.golfGo(2); __pong.golfShoot(-Math.PI / 2, 0.2)")
        page.wait_for_function("__pong.golf().state !== 'roll'", timeout=60000)
        check(page.evaluate("__pong.golf().ball.z") > 0.8, "a soft putt can't make it round and rolls back")

        # 6. Water: off the bridge = +1 stroke and back to where you putted from
        page.evaluate("__pong.golfGo(7); __pong.golfShoot(Math.atan2(-4, -1.2), 0.45)")
        page.wait_for_function("__pong.golf().state === 'aim' && __pong.golf().cur >= 2", timeout=60000)
        g = page.evaluate("__pong.golf()")
        check(g["cur"] == 2 and abs(g["ball"]["x"]) < 0.01 and abs(g["ball"]["z"] - 6.2) < 0.01, "SPLASH: a putt into the water costs a stroke and you play again from the same spot")

        # 7. Turns: after you finish the hole the AI plays it, then the next hole
        page.evaluate("__pong.golfGo(0)")
        for _ in range(8):  # (aim straight at the cup and putt softly until it drops or you run out of strokes)
            page.wait_for_function("(g => (g.state === 'aim' && g.turn === 0) || g.turn === 1)(__pong.golf())", timeout=60000)
            if page.evaluate("__pong.golf().turn") == 1:
                break
            page.evaluate("(() => { const g = __pong.golf(), h = g.holes[g.hole]; __pong.golfShoot(Math.atan2(h.cup[1] - g.ball.z, h.cup[0] - g.ball.x), 0.25); })()")
            page.wait_for_function("__pong.golf().state !== 'roll'", timeout=60000)
        page.wait_for_function("__pong.golf().turn === 1", timeout=30000)
        check(True, "when you're done with a hole, the AI plays it")
        page.evaluate("(() => { for (let i = 0; i < 120 * 120 && __pong.golf().hole === 0; i++) __pong.stepFor(1 / 120); })()")  # (fast-forward the AI's turn)
        g = page.evaluate("__pong.golf()")
        check(g["strokes"][0][0] >= 1 and g["strokes"][1][0] >= 1, f"then it's on to hole 2 (hole 1: you {g['strokes'][0][0]}, AI {g['strokes'][1][0]})")

        # 8. A whole match: the scorecard at the end
        r = page.evaluate("__pong.gsim(2400, { game: true })")
        check(r["over"] and r["card"] == 4 * 10, f"a full 9-hole match finishes with a scorecard ({r['card']} cells)")
        page.evaluate("__pong.mode('golf')")

        # 9. On a phone: slide aim with a finger
        page.close()  # (one 3D page at a time on this machine)
        phone_ctx = browser.new_context(**p.devices["iPhone 13"])
        phone = phone_ctx.new_page()
        phone.on("pageerror", lambda error: ERRORS.append(str(error)))
        phone.goto(GAME, timeout=90000)
        phone.wait_for_function("Boolean(window.__pong)", timeout=60000)
        phone.evaluate("__pong.mode('golf'); __pong.golfGo(0)")
        phone.wait_for_timeout(1500)
        cdp = phone_ctx.new_cdp_session(phone)
        x0, y0 = 195, 420
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
        for i in range(1, 9):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0, "y": y0 + i * 18}]})
        aim = phone.evaluate("__pong.golf().aim")
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        check(aim and aim["p"] > 0.2, f"phone: dragging a finger back aims ({aim})")
        check(phone.evaluate("__pong.golf().state") == "roll", "phone: lifting the finger putts")
        phone_ctx.close()

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
