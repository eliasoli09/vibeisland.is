"""Run with python3 tests/trash-talk-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

AI trash talk: when an AI's team scores, one of those AIs says something in a speech bubble over its
head; in 2 v 2 your AI teammate sometimes moans at you when your team lets one in.
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []
RIVAL = ["Þetta verður svo EZ😭", "Loooool þú getur ekki neitt💀", "Nooob😂", "Vitlaust mark Snilli😭", "Þú getur ekki BLAUTAN bro😑"]
MATE = ["Ég hefði alveg eins getað verið einn í liði Bro😴", "Get ég skipt um liðsfélaga eða 😩", "Just stick to roblox lil bro🤏"]


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def bubbles(page):
    return [b for b in page.evaluate("__pong.talk()") if b]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
        page.goto(GAME)
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        lines = page.evaluate("__pong.talkLines()")
        check(lines["rival"] == RIVAL and lines["mate"] == MATE, "the trash talk lines are exactly the ones asked for")

        # 1 v 1: the AI scores and gloats over its head; you scoring doesn't make it talk
        page.evaluate("__pong.mode('pong')")
        n = page.evaluate("__pong.netForceScore(1), __pong.talk().filter(Boolean).length")
        check(n == 0, "the AI keeps quiet when you score")
        page.evaluate("__pong.netForceScore(-1)")
        page.wait_for_function("__pong.talk().some(Boolean)", timeout=5000)
        b = bubbles(page)
        check(len(b) == 1 and b[0]["i"] == 2 and b[0]["text"] in RIVAL, f"the AI says a trash talk line when it scores ({b[0]['text']})")
        page.wait_for_function("__pong.talk().some((b) => b && b.width > 40)", timeout=5000)  # (it pops in from nothing)
        b = [x for x in bubbles(page) if x["width"] > 40][0]
        check(0 <= b["left"] and b["right"] <= 1280 and 0 <= b["top"] and b["bottom"] <= 800 and b["width"] > 40,
              f"the bubble is on screen over the character ({b['left']:.0f},{b['top']:.0f} {b['width']:.0f}x{b['height']:.0f})")
        page.wait_for_function("!__pong.talk().some(Boolean)", timeout=20000)
        check(True, "the bubble goes away again")

        # never the same line twice in a row
        said = []
        for _ in range(5):
            page.evaluate("__pong.netForceScore(-1)")
            page.wait_for_function("__pong.talk().some(Boolean)", timeout=5000)
            said.append(bubbles(page)[0]["text"])
        check(all(a != b for a, b in zip(said, said[1:])), f"the AI never says the same thing twice in a row ({said})")

        # 2 v 2: one of the AIs gloats, and your AI teammate moans at you
        page.evaluate("__pong.setTalk({ mateP: 1 }); __pong.mode('volley', true)")
        page.evaluate("__pong.netForceScore(-1)")
        page.wait_for_function("__pong.talk().filter(Boolean).length === 2", timeout=15000)
        b = {x["i"]: x["text"] for x in bubbles(page)}
        rival = [t for i, t in b.items() if i in (2, 3)]
        check(len(rival) == 1 and rival[0] in RIVAL, f"2 v 2: an AI on the other team gloats ({rival})")
        check(b.get(1) in MATE, f"2 v 2: your AI teammate moans at you ({b.get(1)})")
        page.wait_for_function("!__pong.talk().some(Boolean)", timeout=20000)
        # (checked straight away: the match keeps going, and the AIs may score a real point while we wait)
        n = page.evaluate("__pong.setTalk({ mateP: 1 }), __pong.netForceScore(1), __pong.talk().filter(Boolean).length")
        check(n == 0, "2 v 2: nobody trash talks when your team scores")
        page.evaluate("__pong.setTalk({}); __pong.mode('pong')")

        # the menu demo (AI vs AI in the background) never talks
        page.evaluate("__pong.sim(30, {})")
        page.wait_for_timeout(500)
        check(not bubbles(page), "no trash talk in the menu's demo match")

        # on a phone too
        phone = browser.new_context(**p.devices["iPhone 13"]).new_page()
        phone.goto(GAME)
        phone.wait_for_function("Boolean(window.__pong)", timeout=30000)
        phone.evaluate("__pong.mode('hockey')")
        phone.evaluate("__pong.netForceScore(-1)")
        phone.wait_for_function("__pong.talk().some(Boolean)", timeout=5000)
        phone.wait_for_function("__pong.talk().some((b) => b && b.width > 40)", timeout=5000)
        b = [x for x in bubbles(phone) if x["width"] > 40][0]
        vw = phone.viewport_size["width"]
        check(b["left"] >= 0 and b["right"] <= vw and b["width"] <= vw * 0.75, f"phone: the bubble fits on the screen ({b['width']:.0f}px of {vw})")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
