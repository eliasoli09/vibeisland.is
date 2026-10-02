"""Run with python3 tests/online-browser.py

Two browsers play online through the real game server (Supabase Realtime on the islensk-fotbolti
project; WebRTC when possible). Checks both modes, both transports, mirroring, input, scoring,
slime and disconnects. Uses the static file (or PIXEL_PONG_URL).
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


def match(browser, mode, transport):
    label = f"{mode}/{transport}"
    flags = "debug" + ("&net=relay" if transport == "relay" else "")
    hctx, gctx = browser.new_context(), browser.new_context()
    host, guest = hctx.new_page(), gctx.new_page()
    for pg in (host, guest):
        pg.on("pageerror", lambda error: ERRORS.append(str(error)))
    host.goto(f"{BASE}?{flags}", wait_until="domcontentloaded")
    host.wait_for_function("Boolean(window.__pong)", timeout=30000)
    host.locator(f".mode[data-mode='{mode}']").click()
    host.locator("#rosterYou .card[data-char='claude']").click()
    host.locator("#btnOnline").click()
    host.wait_for_function("document.querySelector('#onLink').value.includes('join=')", timeout=20000)
    link = host.locator("#onLink").input_value()
    host.wait_for_selector("#onQR svg", timeout=15000)  # the QR library loads on demand
    check(host.locator("#onQR svg").count() == 1, f"{label}: the host gets a QR code and a link")

    guest.goto(f"{link}&{flags}", wait_until="domcontentloaded")
    guest.wait_for_function("Boolean(window.__pong)", timeout=30000)
    guest.wait_for_selector("#onJoin", state="visible", timeout=20000)
    check(guest.locator("#rosterJoin .card[data-char='claude']").is_disabled(), f"{label}: the friend can't pick the host's fighter")
    guest.locator("#rosterJoin .card[data-char='grok']").click()
    guest.locator("#onJoin").click()
    for pg in (host, guest):
        pg.wait_for_function("__pong.net().live && __pong.net().phase !== 'over'", timeout=20000)
    h, g = host.evaluate("__pong.net()"), guest.evaluate("__pong.net()")
    check(h["mode"] == g["mode"] == mode, f"{label}: both play {mode}")
    check(h["you"] == "claude" and h["rival"] == "grok" and g["you"] == "grok" and g["rival"] == "claude",
          f"{label}: each side sees itself near and the friend far")
    if transport == "p2p":
        host.wait_for_function("__pong.net().transport === 'p2p'", timeout=15000)
        check(True, f"{label}: a direct WebRTC connection opens")
    else:
        host.wait_for_timeout(3000)
        check(host.evaluate("__pong.net().transport") == "relay", f"{label}: forced relay works through the game server")

    # the friend's movement reaches the host, mirrored
    guest.evaluate("__pong.netAim(2.5, 5)")
    # (in hockey the puck can briefly knock the mallet aside on the host, so wait for it to settle there)
    reached = "Math.abs(__pong.net().ma[0] + 2.5) < 0.6" if mode == "hockey" else "Math.abs(__pong.net().ax + 2.5) < 0.6"
    try:
        host.wait_for_function(reached, timeout=4000)
    except Exception:
        pass
    h = host.evaluate("__pong.net()")
    if mode == "hockey":
        check(abs(h["ma"][0] + 2.5) < 0.6, f"{label}: the friend's mallet shows up mirrored on the host ({h['ma']})")
    else:
        check(abs(h["ax"] + 2.5) < 0.6, f"{label}: the friend's paddle shows up mirrored on the host ({h['ax']:.2f})")
    # the game state reaches the friend, mirrored
    host.wait_for_timeout(500)
    h, g = host.evaluate("__pong.net()"), guest.evaluate("__pong.net()")
    key = "puck" if mode == "hockey" else "ball"
    check(abs(h[key][0] + g[key][0]) < 3 and abs(h[key][1] + g[key][1]) < 4,
          f"{label}: the friend sees the same {key}, mirrored (host {h[key]}, friend {g[key]})")

    # scoring: the host scores; the friend sees the rival score and gets slimed
    host.evaluate("__pong.netForceScore(1)")
    guest.wait_for_function("__pong.net().score[1] >= 1", timeout=5000)
    g = guest.evaluate("__pong.net()")
    check(g["score"] == [0, 1] and g["slimeYou"], f"{label}: a point syncs and the friend gets slimed ({g['score']})")

    # the friend leaves: the host is told and gets the win
    gctx.close()
    host.wait_for_function("__pong.net().over", timeout=12000)
    check(host.evaluate("__pong.net().overTitle") == "OPPONENT LEFT", f"{label}: the host is told when the friend leaves")
    hctx.close()


def site_join(p, browser, site):
    """Invite flow through the real pages: link -> /verkefni/pixel-pong?join=CODE -> game in the iframe."""
    hctx = browser.new_context()
    host = hctx.new_page()
    host.on("pageerror", lambda error: ERRORS.append(str(error)))
    host.goto(f"{site}/projects/pixel-pong/game.html?debug", wait_until="domcontentloaded")
    host.wait_for_function("Boolean(window.__pong)", timeout=30000)
    host.locator("#btnOnline").click()
    host.wait_for_function("document.querySelector('#onLink').value.includes('join=')", timeout=20000)
    link = host.locator("#onLink").input_value()
    check("/verkefni/pixel-pong?join=" in link, f"site: the invite link opens the game page ({link})")
    # a friend on an iPhone, inside Instagram's built-in browser: told to open it in Safari
    iphone = dict(p.devices["iPhone 13"])
    iphone["user_agent"] += " Instagram 300.0"  # Instagram's in-app browser identifies itself like this
    insta = browser.new_context(**iphone)
    ip = insta.new_page()
    ip.goto(link, wait_until="domcontentloaded")
    ip.wait_for_selector("[role=dialog][aria-label='Opnaðu leikinn í vafra']", timeout=15000)
    check(True, "site: inside Instagram's browser the friend is told to open the link in Safari")
    insta.close()
    # a friend in a normal phone browser joins through the page's iframe
    gctx = browser.new_context(**p.devices["iPhone 13"])
    gp = gctx.new_page()
    gp.goto(link, wait_until="domcontentloaded")
    frame = gp.frame_locator("iframe[src*='pixel-pong']")
    frame.locator("#onJoin").wait_for(state="visible", timeout=30000)
    check(gp.locator("iframe[src*='join=']").count() == 1, "site: the page hands the room code to the game")
    frame.locator("#onJoin").tap()
    host.wait_for_function("__pong.net().live", timeout=20000)
    check(True, "site: the friend joins from the link on a phone and the match starts")
    gctx.close(); hctx.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        match(browser, "pong", "p2p")
        match(browser, "hockey", "relay")
        match(browser, "hockey", "p2p")
        match(browser, "pong", "relay")
        site = os.environ.get("SITE_URL")
        if site:
            site_join(p, browser, site)
        else:
            print("skip - website invite checks (set SITE_URL to run them)")
        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
