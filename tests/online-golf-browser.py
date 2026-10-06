"""Run with python3 tests/online-golf-browser.py

Mini golf online against a friend: two browsers through the real game server (Supabase Realtime on
the islensk-fotbolti project; WebRTC when possible). The host putts first on each hole, then the
friend; the host runs the ball, the friend aims on their own screen and their putt is sent over.
Uses the static file (or PIXEL_PONG_URL).
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri())
ERRORS = []


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def open_page(browser, url, small=False):
    ctx = browser.new_context(viewport={"width": 640, "height": 420} if small else {"width": 1000, "height": 700})
    page = ctx.new_page()
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_function("Boolean(window.__pong)", timeout=60000)
    return ctx, page


def golf(page):
    return page.evaluate("__pong.net().golf")


def play_until_turn_ends(page, label, mine_turn):
    """Good putts (a HARD AI's choice) on this screen until this player's turn on the hole is over."""
    for _ in range(8):
        page.wait_for_function(f"(g => (g.turn === {mine_turn} && g.state === 'aim') || g.turn !== {mine_turn} || g.hole > 0)(__pong.net().golf)", timeout=90000)
        g = golf(page)
        if g["turn"] != mine_turn or g["hole"] > 0:
            return
        page.evaluate("__pong.golfBest()")
        page.wait_for_function(f"__pong.net().golf.state !== 'aim' && __pong.net().golf.state !== 'sent'", timeout=30000)
    raise AssertionError(f"{label}: the turn never ended")


def match(browser, transport):
    label = f"golf/{transport}"
    flags = "debug" + ("&net=relay" if transport == "relay" else "")
    hctx, host = open_page(browser, f"{BASE}?{flags}")
    host.locator(".mode[data-mode='golf']").click()
    check(host.locator("#btnOnline").is_visible(), f"{label}: PLAY ONLINE is there in mini golf")
    host.locator("#rosterYou .card[data-char='claude']").click()
    host.locator("#btnOnline").click()
    host.wait_for_function("document.querySelector('#onLink').value.includes('join=')", timeout=30000)
    code = host.locator("#onLink").input_value().split("join=")[1][:4]
    gctx, guest = open_page(browser, f"{BASE}?join={code}&{flags}", small=True)
    guest.wait_for_selector("#onJoin", state="visible", timeout=30000)
    check("MINI GOLF" in guest.locator("#onStatus").text_content(), f"{label}: the friend is invited to MINI GOLF")
    guest.locator("#rosterJoin .card[data-char='grok']").click()
    guest.locator("#onJoin").click()
    for pg in (host, guest):
        pg.wait_for_function("__pong.net().live && __pong.net().mode === 'golf'", timeout=30000)
    h, g = host.evaluate("__pong.net()"), guest.evaluate("__pong.net()")
    check(h["golf"]["ai"] == [False, False], f"{label}: player 2 is the friend, not the AI")
    check(h["you"] == "claude" and g["you"] == "grok", f"{label}: each side plays as their own fighter")

    # the host putts first; the friend sees the same hole and the ball move
    host.wait_for_function("__pong.net().golf.state === 'aim'", timeout=30000)
    check(guest.evaluate("__pong.net().golf.turn") == 1, f"{label}: on the friend's screen it's the host's turn first")
    host.evaluate("__pong.golfShoot(-Math.PI / 2, 0.3)")  # (a short putt that stops on the green)
    host.wait_for_function("(g => g.state === 'aim' && g.turn === 0)(__pong.net().golf)", timeout=60000)
    hb = golf(host)["ball"]
    guest.wait_for_function(f"(b => Math.hypot(b[0] - {hb[0]}, b[1] - {hb[1]}) < 0.3)(__pong.net().golf.ball)", timeout=30000)
    check(golf(guest)["strokes"][1][0] == 1, f"{label}: the friend sees the host's putt, the ball ends up in the same place ({[round(v, 2) for v in hb]}) and it counts on their scorecard")
    play_until_turn_ends(host, f"{label} host", 0)

    # the friend's turn: they aim on their own screen (the host sees it) and putt
    guest.wait_for_function("(g => g.turn === 0 && g.state === 'aim')(__pong.net().golf)", timeout=60000)
    check(golf(host)["turn"] == 1, f"{label}: then it's the friend's turn")
    guest.mouse.move(320, 200); guest.mouse.down(); guest.mouse.move(320, 300, steps=6)
    host.wait_for_function("__pong.net().golf.aim !== null", timeout=15000)
    check(True, f"{label}: the host sees the friend line up their putt")
    guest.mouse.move(320, 205, steps=4); guest.mouse.up()  # (back to the start: no putt)
    check(golf(guest)["state"] == "aim", f"{label}: a cancelled drag doesn't putt")
    play_until_turn_ends(guest, f"{label} friend", 0)
    for pg in (host, guest):
        pg.wait_for_function("__pong.net().golf.hole === 1", timeout=60000)
    h, g = golf(host), golf(guest)
    check(h["strokes"][0][0] == g["strokes"][1][0] and h["strokes"][1][0] == g["strokes"][0][0] and h["strokes"][1][0] >= 1,
          f"{label}: both scorecards agree after hole 1 (host {h['strokes'][0][0]}, friend {h['strokes'][1][0]})")
    check(True, f"{label}: on to hole 2 together")

    # the friend leaves: the host is told
    gctx.close()
    host.wait_for_function("__pong.net().over", timeout=30000)
    check(host.evaluate("__pong.net().overTitle") == "OPPONENT LEFT", f"{label}: the host is told when the friend leaves")
    hctx.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        match(browser, "p2p")
        match(browser, "relay")
        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
