"""Run with python3 tests/ai-boosts-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

The AI earns boosts too (it used to never get any), in both modes, and every boost works for its side.
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get("PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()) + "?debug"
ERRORS = []


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def run_until(page, expr, used, tries=5):
    for _ in range(tries):  # a boost earned in the last seconds of a run may not get used: retry
        r = page.evaluate(expr)
        if used(r):
            return r
    return r


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.goto(GAME, wait_until="domcontentloaded")
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        # Ping Pong: the AI earns boosts from its spin shots, on every difficulty
        for diff in ("easy", "normal"):
            # against a perfect scripted player a weak AI earns about one boost a match, so allow a few matches
            r = run_until(page, f"__pong.simPlayer(600, {{ tapAt: 0.15, diff: '{diff}' }})", lambda r: r["aiPowers"] >= 1, tries=6)
            check(r["aiPowers"] >= 1, f"ping pong {diff}: the AI earns boosts ({r['aiPowers']})")
        checks = {
            "big": ("aiBigSeen", lambda v: v >= 1.49, "BIG PADDLE makes the AI's paddle 1.5x wider"),
            "slow": ("aiSlowSteps", lambda v: v > 0, "SLOW-MO slows balls flying at the AI"),
            "fire": ("aiFireShots", lambda v: v >= 1, "the AI fires FIREBALLs"),
            "triple": ("aiDecoys", lambda v: v >= 2, "the AI's TRIPLE BALL launches fakes at you"),
        }
        for kind, (key, ok, msg) in checks.items():
            r = run_until(page, f"__pong.simPlayer(240, {{ tapAt: 0.15, forceAiPower: '{kind}' }})", lambda r: ok(r[key]))
            check(r["aiPowers"] >= 1 and ok(r[key]), f"ping pong: {msg} ({r[key]})")
            check(r["bad"] == 0, f"ping pong {kind}: no invalid ball states")
            if kind == "triple":
                check(r["decoyPops"] == r["decoys"], "every fake ball pops")

        # Air Hockey: the AI earns boosts from its own smashes
        checks = {
            "big": ("aiBigSeen", lambda v: v >= 1.49, "BIG MALLET makes the AI's mallet 1.5x wider"),
            "fire": ("aiFireShots", lambda v: v >= 1, "the AI fires FIREBALL pucks"),
            "triple": ("aiFakes", lambda v: v >= 2, "the AI's TRIPLE PUCK launches fakes at you"),
            "wide": ("aiWideRatio", lambda v: v >= 1.59, "the AI's WIDE GOAL makes YOUR goal 1.6x wider"),
        }
        for kind, (key, ok, msg) in checks.items():
            r = run_until(page, f"__pong.hsimPlayer(180, {{ forceAiPower: '{kind}' }})", lambda r: ok(r[key]))
            check(r["aiPowers"] >= 1 and ok(r[key]), f"air hockey: {msg} ({r[key]})")
            check(r["bad"] == 0, f"air hockey {kind}: no invalid puck states")
            if kind == "triple":
                check(r["fakePops"] == r["fakes"], "every fake puck pops")

        # The AI's boost is shown on screen while it holds it
        # play (on Hard, where the AI spins most) until the AI is holding a boost
        for _ in range(6):
            if page.evaluate("__pong.simPlayer(120, { tapAt: 0.6, diff: 'hard', forceAiPower: 'big', keep: true, untilAiPower: true })")["aiPowers"]:
                break
        check(page.locator("#aiPowerChip").is_visible(), "the AI's active boost is shown on screen")
        check("BIG PADDLE" in page.locator("#aiPowerName").inner_text(), "the AI chip names the boost")

        # The menu's AI-vs-AI demo stays boost-free
        demo = page.evaluate("__pong.sim(300, {})")
        check(demo["powers"] == 0 and demo["aiPowers"] == 0, "the menu demo never uses boosts")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
