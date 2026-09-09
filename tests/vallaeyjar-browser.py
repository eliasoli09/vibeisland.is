"""Run with python3 tests/vallaeyjar-browser.py against localhost:3000."""
import json
import os
import io
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import expect, sync_playwright
from PIL import Image

BASE = os.environ.get("VALLAEYJAR_URL", "http://localhost:3000")
DETAIL = BASE + "/verkefni/vallaeyjar"
ROOT = Path(__file__).resolve().parents[1]
ERRORS = []


def ready(page):
    frame = page.frame_locator("iframe")
    expect(frame.locator(".island-card .enter").first).to_be_visible(timeout=60000)
    expect(frame.locator("#loader")).to_be_hidden(timeout=60000)
    viewer = page.frame(url=BASE + "/projects/vallaeyjar/viewer.html")
    viewer.wait_for_function("Boolean(window.stadiumViewer)", timeout=60000)
    return viewer


def camera(frame):
    return frame.evaluate("stadiumViewer.camera.position.toArray()")


def moved(frame, before):
    frame.wait_for_function(
        "before => stadiumViewer.camera.position.toArray().some((v, i) => Math.abs(v - before[i]) > 0.01)",
        arg=before, timeout=10000,
    )


def capture(page):
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)


def visible_pitch(frame):
    # Let fullscreen resize and WebGL repaint before checking the canvas pixels.
    frame.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    pixels = Image.open(io.BytesIO(frame.locator("#viewport").screenshot())).convert("RGB")
    green = sum(1 for r, g, b in pixels.getdata() if g > 70 and g > r * 1.08 and g > b * 1.15)
    assert green > pixels.width * pixels.height * .01, f"No visible pitch: {green} green pixels"


with TemporaryDirectory(prefix="vallaeyjar-test-") as temp, sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    page.set_default_timeout(15000)
    capture(page)
    page.goto(BASE)
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("link", name="Verkefni Interactive projects").click()
    expect(page).to_have_url(BASE + "/verkefni")
    page.reload()
    page.get_by_role("link", name="Opna verkefni", exact=True).click()
    expect(page).to_have_url(DETAIL)
    frame = ready(page)
    assert frame.locator("body").get_attribute("class") == "world"
    expect(frame.locator(".island-card h3")).to_have_text(["Kaplakriki"])
    print("PASS menu, index reload, detail route, initial island chooser", flush=True)
    print("Storage status:", frame.locator("#save-status").inner_text(), flush=True)
    visible_pitch(frame)
    if os.environ.get("CAPTURE_PREVIEW") == "1":
        frame.locator("#viewport").screenshot(
            path=str(ROOT / "public/projects/vallaeyjar/preview.png"),
            style="#world-panel, .floating-top, .bottom-bar { visibility: hidden !important; }",
        )

    frame.locator(".enter").click()
    frame.locator('[data-view="top"]').click()
    assert frame.evaluate("stadiumViewer.camera.isOrthographicCamera")
    frame.locator('[data-view="main"]').click()
    expect(frame.locator('[data-view="main"]')).to_have_attribute("aria-pressed", "true")
    frame.locator('[data-view="overview"]').click()
    before = camera(frame)
    frame.locator("#tour-button").click()
    moved(frame, before)
    assert frame.evaluate("stadiumViewer.mode") == "tour"
    frame.locator("#orbit-button").click()
    assert frame.evaluate("stadiumViewer.mode") == "orbit"
    frame.locator('[data-view="overview"]').click()
    frame.locator("#drone-button").click()
    frame.locator("#viewport").focus()
    before = camera(frame)
    page.keyboard.down("w")
    moved(frame, before)
    page.keyboard.up("w")
    frame.locator("#flight-stop").click()
    assert frame.evaluate("stadiumViewer.mode") == "orbit"
    box = frame.locator("#viewport").bounding_box()
    page.mouse.move(box["x"] + box["width"] * .45, box["y"] + box["height"] * .55)
    before = camera(frame)
    page.mouse.wheel(0, -300)
    moved(frame, before)
    for quality in ["auto", "ultra", "high"]:
        frame.locator("#quality").select_option(quality)
        assert frame.locator("#quality").input_value() == quality
    print("PASS Top, Side, orbit tour, keyboard drone, zoom, all quality modes", flush=True)

    frame.locator("#creator-button").click()
    prompt = frame.locator("#creator-prompt").input_value()
    frame.locator("#copy-prompt").click()
    assert page.evaluate("navigator.clipboard.readText()") == prompt
    with page.expect_download() as download:
        frame.locator("#example-download").click()
    stadium_path = Path(temp) / download.value.suggested_filename
    download.value.save_as(stadium_path)
    sample = json.loads(stadium_path.read_text())
    with page.expect_download() as download:
        frame.locator("#prompt-download").click()
    prompt_path = Path(temp) / download.value.suggested_filename
    download.value.save_as(prompt_path)
    assert prompt_path.read_text() == prompt
    frame.locator('[data-close="creator-dialog"]').click()
    frame.locator("#home-button").click()
    frame.locator("#add-island").click()
    with page.expect_file_chooser() as chooser:
        frame.locator("#stadium-file").click()
    chooser.value.set_files(stadium_path)
    expect(frame.locator("#confirm-import")).to_be_enabled()
    frame.locator("#confirm-import").click()
    expect(frame.locator("#import-dialog")).not_to_be_visible(timeout=30000)
    frame.wait_for_function("name => stadiumViewer.activePackage.name === name", arg=sample["name"])
    print("Import status:", frame.locator("#toast").inner_text(), flush=True)
    assert "vistuð" in frame.locator("#toast").inner_text()
    with page.expect_download() as download:
        frame.locator("#export-island").click()
    exported_path = Path(temp) / "exported.stadium"
    download.value.save_as(exported_path)
    assert json.loads(exported_path.read_text()) == sample
    page.reload()
    frame = ready(page)
    frame.wait_for_function("stadiumViewer.islands.length === 2")
    assert sample["name"] in frame.locator("#island-cards").inner_text()
    print("PASS real file chooser, import, download round-trip, reload persistence, prompt clipboard and download", flush=True)

    frame.locator(".island-card").filter(has=frame.get_by_role("heading", name="Kaplakriki", exact=True)).locator(".enter").click()
    frame.locator("#fullscreen").click()
    frame.wait_for_function("Boolean(document.fullscreenElement)")
    frame.locator("#fullscreen").click()
    frame.wait_for_function("!document.fullscreenElement")
    frame.locator('[data-view="overview"]').click()
    frame.locator("#quality").select_option("auto")
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/vallaeyjar-desktop.png")
    # Observe frame detach/blanking and ensure it restarts after a cached-route return.
    page.get_by_role("link", name="Til baka í verkefni").click()
    expect(page).to_have_url(BASE + "/verkefni")
    page.wait_for_function("Array.from(document.querySelectorAll('iframe')).every(f => f.getAttribute('src') === 'about:blank')")
    page.get_by_role("link", name="Opna verkefni", exact=True).click()
    frame = ready(page)
    frame.wait_for_function("stadiumViewer.islands.length === 2")
    print("PASS fullscreen, iframe shutdown, cached-route return", flush=True)
    page.close()
    context.close()

    for width, height, touch in [(390, 844, True), (768, 1024, True), (844, 390, True)]:
        ctx = browser.new_context(viewport={"width": width, "height": height}, has_touch=touch, is_mobile=True, permissions=["clipboard-read", "clipboard-write"])
        mobile = ctx.new_page()
        capture(mobile)
        mobile.goto(DETAIL)
        frame = ready(mobile)
        visible_pitch(frame)
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
        frame.locator(".enter").click()
        frame.locator("#quality").select_option("auto")
        if width <= 760:
            frame.locator("#mobile-view").select_option("top")
            assert frame.evaluate("stadiumViewer.camera.isOrthographicCamera")
            frame.locator("#mobile-view").select_option("main")
        frame.locator("#drone-button").click()
        before = camera(frame)
        button = frame.locator('[data-fly="KeyW"]')
        button.scroll_into_view_if_needed()
        box = button.bounding_box()
        cdp = ctx.new_cdp_session(mobile)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": box["x"] + 20, "y": box["y"] + 18}]})
        moved(frame, before)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        frame.locator("#flight-stop").click()
        frame.locator("#creator-button").click()
        expect(frame.locator("#copy-prompt")).to_be_visible()
        if width == 390:
            frame.locator("#copy-prompt").click()
            assert mobile.evaluate("navigator.clipboard.readText()") == prompt
        frame.locator('[data-close="creator-dialog"]').click()
        frame.locator("#fullscreen").click()
        frame.wait_for_function("Boolean(document.fullscreenElement)")
        frame.locator("#fullscreen").click()
        frame.wait_for_function("!document.fullscreenElement")
        if width <= 760:
            frame.locator("#mobile-view").select_option("overview")
        else:
            frame.locator('[data-view="overview"]').click()
        visible_pitch(frame)
        if width == 390:
            canvas = frame.locator("#viewport").bounding_box()
            x, y = canvas["x"] + 195, canvas["y"] + canvas["height"] * .55
            before = camera(frame)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
            for delta in [10, 25, 45, 65]:
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + delta, "y": y + 10}]})
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            moved(frame, before)
            before = camera(frame)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x - 30, "y": y, "id": 1}, {"x": x + 30, "y": y, "id": 2}]})
            for delta in [40, 50, 60]:
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x - delta, "y": y, "id": 1}, {"x": x + delta, "y": y, "id": 2}]})
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            moved(frame, before)
            frame.locator("#mobile-view").select_option("overview")
            visible_pitch(frame)
            mobile.screenshot(path="/tmp/vallaeyjar-mobile.png", full_page=True)
            frame.locator("#home-button").click()
            frame.locator("#add-island").click()
            frame.locator("#stadium-file").set_input_files(stadium_path)
            expect(frame.locator("#confirm-import")).to_be_enabled()
            frame.locator("#confirm-import").click()
            expect(frame.locator("#import-dialog")).not_to_be_visible()
            assert "vistuð" in frame.locator("#toast").inner_text()
            mobile.reload()
            frame = ready(mobile)
            frame.wait_for_function("stadiumViewer.islands.length === 2")
            print("PASS mobile one-finger orbit, pinch zoom, clipboard, import and persistence", flush=True)
        print(f"PASS {width}x{height}: no horizontal overflow, touch drone, creator dialog, fullscreen", flush=True)
        mobile.close()
        ctx.close()
    browser.close()

assert not ERRORS, "\n".join(ERRORS)
print("PASS no browser console errors", flush=True)
