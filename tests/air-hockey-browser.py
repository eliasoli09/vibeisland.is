"""Run with python3 tests/air-hockey-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Air Hockey mode: puck physics, AI, character pucks, slime, pins and boosts.
"""
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


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
        page.goto(GAME)
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        # 1. Mode switch shows the right table parts.
        check(page.locator(".mode[data-mode='hockey']").count() == 1, "menu has an AIR HOCKEY mode button")
        page.locator(".mode[data-mode='hockey']").click()
        vis = page.evaluate("__pong.parts()")
        check(vis["hockey"] and not vis["pong"], "air hockey shows goals/rails and hides the pong net")
        page.locator(".mode[data-mode='pong']").click()
        vis = page.evaluate("__pong.parts()")
        check(vis["pong"] and not vis["hockey"], "ping pong shows the net and hides the hockey parts")
        page.locator(".mode[data-mode='hockey']").click()

        # 2. Long AI-vs-AI hockey runs: valid, never stuck, goals keep coming.
        for diff in ("normal", "hard"):
            run = page.evaluate(f"__pong.hsim(900, {{ diff: '{diff}' }})")
            print(diff, {k: run[k] for k in ("bad", "goals", "maxSlow", "faceoffs", "maxPen", "puckKeys", "pinHits", "maxPins", "pinsAtFaceoff")})
            check(run["bad"] == 0, f"{diff}: the puck never escapes the table or goes invalid")
            need = {"normal": 20, "hard": 7}[diff]
            check(run["goals"] >= need, f"{diff}: goals keep happening ({run['goals']} in 15 min)")
            check(run["maxSlow"] < 4.6, f"{diff}: the puck never sits still for long ({run['maxSlow']:.1f}s)")
            check(run["maxPen"] < 0.05, f"{diff}: the puck never sinks into a mallet ({run['maxPen']:.3f})")
            check(len(run["puckKeys"]) >= 4, f"{diff}: the puck character changes after goals ({run['puckKeys']})")
            check(run["pinsAtFaceoff"] == 0, f"{diff}: pins are cleared after every goal")
            rule = all(n == min(4, 2 + (hits - 10) // 6) for hits, n in run["pinsAtHit"])
            check(rule, f"{diff}: pins follow the rule: 2 after 10 hits, +1 every 6, max 4 ({run['pinsAtHit'][:4]})")
            check(run["slimes"]["you"] + run["slimes"]["ai"] == run["goals"], f"{diff}: every goal slimes the side that conceded")

        # 3. Boosts from smashes (scripted player). A mallet that never moves only blocks: no smashes.
        idle = page.evaluate("__pong.hsimPlayer(90, { idle: true })")
        check(idle["smashes"] == 0 and idle["powers"] == 0, f"standing still never counts as a smash ({idle['smashes']})")

        for kind in ("big", "fire", "triple", "wide"):
            for attempt in range(3):  # a boost earned in the last seconds of a run may not get used: retry
                r = page.evaluate(f"__pong.hsimPlayer(180, {{ forcePower: '{kind}' }})")
                used = {"big": r["bigSeen"] >= 1.49, "fire": r["fireShots"] >= 1, "triple": r["fakes"] >= 2, "wide": r["wideSeen"] >= 2.39}[kind]
                if used:
                    break
            print(kind, {k: r[k] for k in ("smashes", "powers", "bad", "fakes", "fakePops", "fakeGoals", "fireShots", "fireSpeed", "bigSeen", "wideSeen", "score")})
            check(r["smashes"] >= 3 and r["powers"] >= 1, f"{kind}: smashes in a row earn the boost")
            check(r["bad"] == 0, f"{kind}: no invalid puck states")
            if kind == "big":
                check(r["bigSeen"] >= 1.49, "BIG MALLET makes your mallet 1.5x wider")
            if kind == "fire":
                check(r["fireShots"] >= 1 and r["fireMin"] >= 28, f"every FIREBALL shot is blazing, even from a gentle touch (slowest {r['fireMin']:.1f})")
            if kind == "triple":
                check(r["fakes"] >= 2 and r["fakes"] % 2 == 0, f"TRIPLE PUCK launches 2 fakes per shot ({r['fakes']})")
                check(r["fakePops"] == r["fakes"] and r["fakeGoals"] == 0, "every fake pops and none ever score")
            if kind == "wide":
                check(r["wideSeen"] >= 2.39, f"WIDE GOAL widens the AI's goal ({r['wideSeen']:.2f})")

        # 4. Ping Pong still works after visiting hockey.
        page.locator(".mode[data-mode='pong']").click()
        pong = page.evaluate("__pong.sim(120, {})")
        check(pong["bad"] == 0 and pong["points"] >= 5, "ping pong still plays normally")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
