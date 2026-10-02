"""Run with python3 tests/pixel-pong-mobile-browser.py

Phone checks on an emulated iPhone 13 (portrait + landscape) with real touch events.
The game part uses the static file (or PIXEL_PONG_URL). The website part runs when SITE_URL is
set (e.g. SITE_URL=http://localhost:3000 with `npm run dev`).
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get("PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()) + "?debug"
SITE = os.environ.get("SITE_URL")
ERRORS = []


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def touch_drag(cdp, x0, y0, x1, y1, steps=12):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0, "id": 1}]})
    for i in range(1, steps + 1):
        x = x0 + (x1 - x0) * i / steps
        y = y0 + (y1 - y0) * i / steps
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def game_checks(p, browser, device, label):
    ctx = browser.new_context(**p.devices[device])
    page = ctx.new_page()
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.goto(GAME, wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.__pong)", timeout=30000)
    cdp = ctx.new_cdp_session(page)
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]

    check(page.evaluate("document.body.classList.contains('touch')"), f"{label}: phone is detected as a touch screen")
    check(page.locator("#hintPong .h-touch").is_visible(), f"{label}: the menu explains touch controls")
    # every menu control can be reached and tapped (the menu used to be cut off at the top)
    for sel in ["#modeHockey", "#modePong", "#rosterYou .card[data-char='muse']", "#rosterAi .card[data-char='clawd']", "#dHard", "#dNormal"]:
        page.locator(sel).tap(timeout=5000)
    check(page.evaluate("__pong.state().you") == "muse", f"{label}: every menu button can be reached and tapped")

    # --- Ping Pong
    page.locator("#btnStart").tap(timeout=5000)
    page.wait_for_timeout(300)
    fit = page.evaluate("__pong.fit()")
    check(fit["inside"], f"{label}: the whole table is on screen ({fit})")
    if vh > vw:
        check(fit["coverH"] > 0.45, f"{label}: the table fills the tall screen ({fit['coverH']:.2f} of the height)")
    check(page.locator("#spinBtn").is_visible(), f"{label}: a SPIN button is shown in Ping Pong")
    # drag from the lower-left corner: the paddle moves with the finger's movement, not to the finger
    x0 = page.evaluate("__pong.state().px")
    touch_drag(cdp, vw * 0.1, vh * 0.85, vw * 0.1 + 80, vh * 0.85)
    page.wait_for_timeout(250)
    x1 = page.evaluate("__pong.state().px")
    # the finger stays on the far left the whole time: a paddle that jumped under the finger would go left
    check(x1 - x0 > 0.8, f"{label}: dragging right moves the paddle right, even with the finger far to the left ({x0:.2f} -> {x1:.2f})")
    page.wait_for_function("__pong.state().phase === 'play'", timeout=15000)  # spin only arms while the ball is in play
    page.locator("#spinBtn").tap()
    check(page.evaluate("__pong.state().spinTap") >= 0, f"{label}: tapping SPIN arms a spin shot")

    # --- Air Hockey
    page.evaluate("__pong.mode('hockey')")
    page.wait_for_timeout(300)
    check(not page.locator("#spinBtn").is_visible(), f"{label}: no SPIN button in Air Hockey")
    fit = page.evaluate("__pong.fit()")
    check(fit["inside"], f"{label}: the whole hockey table is on screen")
    s0 = page.evaluate("__pong.state()")
    touch_drag(cdp, vw * 0.5, vh * 0.85, vw * 0.5 + 60, vh * 0.85 - 70)
    page.wait_for_timeout(300)
    s1 = page.evaluate("__pong.state()")
    check(s1["mx"] - s0["mx"] > 0.5 and s0["mz"] - s1["mz"] > 0.5,
          f"{label}: dragging up-right slides the mallet right and forward ({s0['mx']:.2f},{s0['mz']:.2f} -> {s1['mx']:.2f},{s1['mz']:.2f})")

    # --- Volleyball
    page.evaluate("__pong.mode('volley')")
    page.wait_for_timeout(300)
    fit = page.evaluate("__pong.fit()")
    check(fit["inside"], f"{label}: the whole volleyball court is on screen")
    check(page.locator("#spinBtn").is_visible() and page.locator("#spinBtn").text_content() == "SPIKE", f"{label}: the button says SPIKE in Volleyball")
    s0 = page.evaluate("__pong.state()")
    touch_drag(cdp, vw * 0.5, vh * 0.85, vw * 0.5 + 60, vh * 0.85 - 70)
    page.wait_for_timeout(500)
    s1 = page.evaluate("__pong.state()")
    check(s1["vx"] - s0["vx"] > 0.5 and s0["vz"] - s1["vz"] > 0.5,
          f"{label}: dragging up-right runs your player right and toward the net ({s0['vx']:.2f},{s0['vz']:.2f} -> {s1['vx']:.2f},{s1['vz']:.2f})")
    page.wait_for_function("__pong.state().phase === 'play'", timeout=15000)
    page.locator("#spinBtn").tap()
    check(page.evaluate("__pong.state().vJump") > 0, f"{label}: tapping SPIKE jumps")
    ctx.close()


def site_checks(p, browser):
    ctx = browser.new_context(**p.devices["iPhone 13"])
    page = ctx.new_page()
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.goto(SITE + "/verkefni", wait_until="domcontentloaded")
    play = page.locator("a[data-play='pixel-pong']")
    play.scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    check(play.is_visible(), "projects page: phones get a SPILA button instead of the inline game")
    check(page.locator("iframe[src*='pixel-pong']").count() == 0, "projects page: no inline game iframe on phones (no scroll trap)")
    y0 = page.evaluate("scrollY")
    box = play.bounding_box()
    cdp = ctx.new_cdp_session(page)
    cdp.send("Input.synthesizeScrollGesture", {"x": int(box["x"] + 10), "y": int(box["y"] - 40), "yDistance": -300, "gestureSourceType": "touch"})
    page.wait_for_timeout(600)
    check(page.evaluate("scrollY") > y0 + 100, "projects page: swiping over the Pixel Pong card scrolls the page")
    play.tap()
    page.wait_for_url("**/verkefni/pixel-pong", timeout=15000)
    page.wait_for_timeout(1500)
    frame = page.locator("iframe[src*='pixel-pong']").bounding_box()
    vh = page.viewport_size["height"]
    check(frame and frame["height"] > vh * 0.8, f"game page: the game fills the phone screen ({frame and round(frame['height'])}px of {vh})")
    ctx.close()
    desk = browser.new_page(viewport={"width": 1440, "height": 900})
    desk.goto(SITE + "/verkefni", wait_until="domcontentloaded")
    desk.wait_for_selector("iframe[src*='pixel-pong']", state="attached", timeout=15000)
    check(desk.locator("a[data-play='pixel-pong']").count() == 0, "desktop: the game is still playable inline")
    desk.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        game_checks(p, browser, "iPhone 13", "portrait")
        game_checks(p, browser, "iPhone 13 landscape", "landscape")
        if SITE:
            site_checks(p, browser)
        else:
            print("skip - website checks (set SITE_URL to run them)")
        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
