"""Run with python3 tests/pixel-pong-spin-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy)."""
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

        # 1. Long AI-vs-AI run with lots of spin: the ball must stay valid and rallies must end.
        run = page.evaluate("__pong.sim(900, { spinP: 0.6 })")
        print("sim:", run)
        check(run["bad"] == 0, "ball never leaves the table or becomes non-finite")
        check(run["points"] >= 30, f"rallies keep ending in points ({run['points']} in 15 min)")
        check(run["maxFlight"] < 3, f"the ball always reaches a paddle quickly (longest flight {run['maxFlight']:.2f}s)")
        spun = sum(run["ret"][1:]) + sum(run["miss"][1:])
        check(spun > 50, f"AI spin shots actually happen ({spun} received)")
        bend = [run["bend"][l] / max(1, run["bendN"][l]) for l in (1, 2)]
        check(min(bend) > 1.0, f"spin really bends the ball (avg {bend[0]:.2f} / {bend[1]:.2f} units at levels 1 / 2)")

        # 2. Spin is harder to return, but not impossible (level 3 vs Normal AI).
        plain = page.evaluate("__pong.sim(600, { spinP: 0 })")
        l3 = page.evaluate("__pong.sim(600, { spinP: 1, forceLevel: 3 })")
        plain_rate = plain["ret"][0] / max(1, plain["ret"][0] + plain["miss"][0])
        l3_rate = l3["ret"][3] / max(1, l3["ret"][3] + l3["miss"][3])
        print(f"return rate: plain {plain_rate:.2f}, level-3 spin {l3_rate:.2f}")
        check(l3_rate < plain_rate - 0.1, "level-3 spin is clearly harder to return")
        check(l3_rate > 0.25, "level-3 spin is still returnable")
        check(l3["bad"] == 0, "no invariant violations with maximum spin")

        # 3. Timed taps build a streak and award power-ups; early taps don't spin.
        timed = page.evaluate("__pong.simPlayer(240, { tapAt: 0.15 })")
        print("timed taps:", timed)
        check(timed["spinShots"] >= 5, "timed taps produce spin shots")
        check(timed["maxStreak"] >= 3, "consecutive spin shots build a streak")
        check(timed["powers"] >= 1, "a 3-streak awards a power-up")
        early = page.evaluate("__pong.simPlayer(120, { tapAt: 0.6 })")
        print("early taps:", early)
        check(early["spinShots"] == 0, "taps outside the window never spin")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
