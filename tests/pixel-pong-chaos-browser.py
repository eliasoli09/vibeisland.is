"""Run with python3 tests/pixel-pong-chaos-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Covers round 3: five characters, TRIPLE BALL / FIREBALL boosts, table pins, slime.
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []
CHARS = ["claude", "codex", "muse", "grok", "clawd"]


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

        # 1. Five characters, every pairing works, you can't face yourself.
        check(page.evaluate("__pong.chars()") == CHARS, "roster has Claude, Codex, Muse, Grok and Clawd")
        check(page.locator("#rosterYou .card").count() == 5, "five fighter cards for you")
        check(page.locator("#rosterAi .card").count() == 5, "five opponent cards")
        for you in CHARS:
            for ai in CHARS:
                got = page.evaluate(f"__pong.setup('{you}', '{ai}')")
                if you == ai:
                    assert got[0] == you and got[1] != you, ("faced itself", you, got)
                else:
                    assert got == [you, ai], (you, ai, got)
        print("ok - all 20 you/opponent pairings start a match, and nobody can face itself")
        page.locator("#rosterYou .card[data-char='grok']").click()
        check(page.locator("#rosterAi .card[data-char='grok']").is_disabled(), "your own fighter is disabled in the opponent row")

        # 2. Pins: within a rally they appear after 5 round trips and grow every 3; every point clears them.
        run = page.evaluate("__pong.sim(900, { spinP: 0.4 })")
        print("sim:", {k: run[k] for k in ("bad", "maxFlight", "points", "pinHits", "maxPins", "pinRallies", "pinsAtServe")})
        check(run["bad"] == 0, "ball never leaves the table or becomes non-finite with pins")
        check(run["maxFlight"] < 3, f"ball always reaches a paddle quickly with pins ({run['maxFlight']:.2f}s)")
        rule = all(n == min(6, 2 + (trip - 5) // 3) for trip, n in run["pinsAtTrip"])
        check(rule and run["pinsAtTrip"], f"pins follow the rule: 2 at 5 round trips, +1 every 3 ({run['pinsAtTrip'][:4]})")
        check(run["pinRallies"] >= 1, f"long rallies grow pins ({run['pinRallies']} rallies)")
        check(run["pinsAtServe"] == 0, "pins are gone after every point (none at any serve)")
        # Hard AIs rarely miss, so rallies run long enough to keep growing pins.
        hard = page.evaluate("__pong.sim(900, { diff: 'hard', spinP: 0.2 })")
        print("hard sim:", {k: hard[k] for k in ("bad", "maxFlight", "points", "pinHits", "maxPins", "pinRallies", "pinsAtServe")})
        rule = all(n == min(6, 2 + (trip - 5) // 3) for trip, n in hard["pinsAtTrip"])
        check(rule and hard["maxPins"] >= 3, f"pins keep growing in long rallies, +1 every 3 round trips (max {hard['maxPins']})")
        check(hard["bad"] == 0 and hard["maxFlight"] < 3 and hard["pinsAtServe"] == 0, "long pin rallies stay glitch-free and clear after every point")
        hits = run["pinHits"] + hard["pinHits"]
        check(hits >= 5, f"the ball really bounces off pins ({hits} hits; pins only live during long rallies)")

        # 3. TRIPLE BALL: two decoys spawn, never score, and always disappear.
        tri = page.evaluate("__pong.simPlayer(240, { tapAt: 0.15, forcePower: 'triple' })")
        print("triple:", {k: tri[k] for k in ("decoys", "decoyPops", "decoysLeft", "tripleShots", "tripleRet", "tripleMiss")})
        # the AI can fire TRIPLE BALL too now, so count only your fakes here
        check(tri["tripleShots"] >= 3 and tri["decoys"] - tri["aiDecoys"] == 2 * tri["tripleShots"], "each TRIPLE BALL shot spawns exactly 2 decoys")
        check(tri["decoyPops"] == tri["decoys"] and tri["decoysLeft"] == 0, "every decoy pops; none are left behind")
        check(tri["tripleMiss"] > 0, "decoys fool the AI sometimes")

        # 4. FIREBALL: faster shot, still valid.
        fire = page.evaluate("__pong.simPlayer(240, { tapAt: 0.15, forcePower: 'fire' })")
        print("fire:", {k: fire[k] for k in ("fireShots", "fireSpeedUp", "bad")})
        check(fire["fireShots"] >= 3, "FIREBALL shots happen")
        check(fire["fireSpeedUp"] >= 1.4, f"FIREBALL is clearly faster ({fire['fireSpeedUp']:.2f}x)")
        check(fire["bad"] == 0, "no invalid ball states with FIREBALL")

        # 5. Slime: the loser of every point gets slimed in the winner's colour.
        idle = page.evaluate("__pong.simPlayer(40, { tapAt: -1, idle: true })")
        print("slime:", {k: idle[k] for k in ("slimes", "slimeColors", "score")})
        check(idle["slimes"]["you"] >= 1, "you get slimed when you lose a point")
        check(idle["slimeColors"]["you"] == idle["aiColor"], "your slime is the opponent's colour")
        win = page.evaluate("__pong.simPlayer(120, { tapAt: 0.15 })")
        check(win["slimes"]["ai"] >= 1, "the AI gets slimed when you score")
        check(win["slimeColors"]["ai"] == win["youColor"], "the AI's slime is your colour")

        # 6. Bucket slime: a bucket tips over the loser, the coat flows all the way down, then it all cleans up.
        #    The timeline is stepped at a fixed 60 fps so the check doesn't depend on how fast this machine renders.
        for who in ("you", "ai"):
            page.evaluate(f"__pong.slime('{who}')")
            seen = {"bucket": False, "pour": False}
            for _ in range(12):  # first 1.2 s of the animation
                info = page.evaluate(f"__pong.slimeStep('{who}', 0.1), __pong.slimeInfo('{who}')")
                seen["bucket"] |= info["bucket"]
                seen["pour"] |= info["stream"]
            check(seen["bucket"] and seen["pour"], f"{who}: a bucket appears and pours a stream")
            info = page.evaluate(f"__pong.slimeStep('{who}', 0.4), __pong.slimeInfo('{who}')")
            check(info["maxCover"] >= 0.95, f"{who}: the slime flows down over the whole character (cover {info['maxCover']:.2f})")
            check(info["blobs"] == info["cells"], f"{who}: the slime fits the character, one goo blob per pixel ({info['blobs']}/{info['cells']})")
            check(info["vertices"] >= 3000, f"{who}: the slime coat is high resolution ({info['vertices']} vertices)")
            info = page.evaluate(f"__pong.slimeStep('{who}', 0.6), __pong.slimeInfo('{who}')")
            check(not info["active"] and not info["visible"], f"{who}: bucket and slime clean up afterwards")

        for c in CHARS:
            page.evaluate(f"__pong.setup('{c}', '{'claude' if c != 'claude' else 'codex'}')")
            page.evaluate("__pong.slime('you'), __pong.slimeStep('you', 1.4)")
            info = page.evaluate("__pong.slimeInfo('you')")
            assert info["blobs"] == info["cells"] and info["maxCover"] >= 0.95, (c, info)
            page.evaluate("__pong.slimeStep('you', 1)")
        print("ok - the slime fits and fully covers all five characters")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
