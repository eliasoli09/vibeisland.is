"""Run with python3 tests/volleyball-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Covers the Volleyball mode: the court, AI-vs-AI matches on every difficulty, the scoring rules
(in / out / net, the loser serves), the landing marker, auto-bumps and the tap-to-spike.
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []
CW, CL, BR = 5, 7.5, 0.32


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def expected_winner(e):
    """1 = you, -1 = the AI. In: the side it lands on loses the point. Out: whoever touched it last loses."""
    inside = abs(e["x"]) <= CW + BR * 0.5 and abs(e["z"]) <= CL + BR * 0.5
    return -(1 if e["z"] > 0 else -1) if inside else -e["last"]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
        page.goto(GAME)
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        # 1. A third mode with its own court; switching back restores the table.
        page.locator("#modeVolley").click()
        check(page.locator("#modeVolley").get_attribute("aria-checked") == "true", "VOLLEYBALL is a third mode in the menu")
        check(page.locator("#hintVolley").is_visible() and not page.locator("#hintPong").is_visible(), "the menu explains how Volleyball works")
        parts = page.evaluate("__pong.parts()")
        check(parts["volley"] and not parts["pong"] and not parts["hockey"], f"the court replaces the table ({parts})")
        page.locator("#modePong").click()
        parts = page.evaluate("__pong.parts()")
        check(parts["pong"] and not parts["volley"], "switching back to Ping Pong brings the table back")

        # 2. AI-vs-AI on every difficulty: glitch-free, every ball clears the net, the marker is right.
        logs = []
        for diff in ("easy", "normal", "hard"):
            r = page.evaluate(f"__pong.vsim(300, {{ diff: '{diff}' }})")
            logs += r["log"]
            print(diff, {k: r[k] for k in ("points", "score", "maxRally", "vbBumps", "vbYouSpikes", "vbAiSpikes", "minNetY", "landErr")})
            check(r["bad"] == 0, f"{diff}: the ball and players always stay valid (and in their own half)")
            check(r["crossUnder"] == 0 and r["vbBumpNoClear"] == 0, f"{diff}: every bump, serve and spike clears the net (lowest {r['minNetY']:.2f})")
            check(max(r["score"]) == 7, f"{diff}: a match is played out to 7 ({r['score']})")
            check(r["maxRally"] < 60, f"{diff}: rallies end ({r['maxRally']:.1f}s longest)")
            check(r["landErr"] < 0.3, f"{diff}: the landing marker shows where the ball comes down (off by {r['landErr']:.2f})")
            check(r["vbYouSpikes"] + r["vbAiSpikes"] >= 2, f"{diff}: players jump and spike near the net")
        wrong = [e for e in logs if (1 if e["you"] else -1) != expected_winner(e) or e["you"] + e["ai"] != 1]
        check(not wrong and len(logs) >= 21, f"all {len(logs)} points went to the right side ({wrong[:2]})")

        # 3. The rules, one at a time (nobody touches the ball).
        cases = [
            ("your hit lands in the AI's court", {"x": 0, "y": 3, "z": 3, "vx": 1, "vy": 6, "vz": -4}, 1, "you"),
            ("your hit goes out long", {"x": 0, "y": 3, "z": 3, "vx": 0, "vy": 4, "vz": -12}, 1, "ai"),
            ("the AI's hit goes out wide", {"x": 0, "y": 3, "z": -3, "vx": 6, "vy": 3, "vz": 1.5}, -1, "you"),
            ("the AI's hit lands in your court", {"x": 0, "y": 3, "z": -3, "vx": -1, "vy": 6, "vz": 4}, -1, "ai"),
        ]
        for name, ball, last, winner in cases:
            r = page.evaluate(f"__pong.vdrop({ball}, {last})")
            got = "you" if r["you"] else "ai"
            check(r["phase"] != "play" and got == winner, f"{name}: point to {winner} (landed at {r['at'][0]:.1f}, {r['at'][1]:.1f})")
            check(r["server"] != winner, f"{name}: the side that lost the point serves next")
            check(abs(r["serverAt"][1]) > CL - 1, f"{name}: the serve comes from the baseline ({r['serverAt'][1]:.1f})")
        r = page.evaluate("__pong.vdrop({ x: 0, y: 1.6, z: 2, vx: 0, vy: 1, vz: -8 }, 1)")
        check(r["net"] >= 1 and r["at"][1] > 0 and r["ai"] == 1, f"a ball hit into the net drops back on your side and the AI scores ({r})")

        # 4. You: auto-bump by standing under the ball, spike by tapping near the net.
        bump = page.evaluate("__pong.vsimPlayer(90, {})")
        check(bump["vbBumps"] >= 10 and bump["bad"] == 0 and bump["crossUnder"] == 0,
              f"standing under the ball bumps it back over the net automatically ({bump['vbBumps']} bumps)")
        spike = page.evaluate("__pong.vsimPlayer(150, { spike: true })")
        print("spiker:", {k: spike[k] for k in ("taps", "vbYouSpikes", "score")})
        check(spike["vbYouSpikes"] >= 3 and spike["vbYouSpikes"] >= spike["taps"] * 0.6, f"a well-timed tap near the net spikes ({spike['vbYouSpikes']}/{spike['taps']} taps)")
        check(spike["score"][0] >= 3, f"spikes win points ({spike['score']})")
        idle = page.evaluate("__pong.vsimPlayer(120, { idle: true })")
        check(idle["score"] == [0, 7], f"standing still loses 0-7 ({idle['score']})")
        info = page.evaluate("__pong.slimeInfo('you')")
        check(info["active"] or info["visible"], "the point loser gets slimed")

        # 5. Real input: the mouse moves your player in your half; a click jumps (and only spikes in range).
        page.evaluate("__pong.mode('volley')")
        page.mouse.move(640, 760)
        try:  # (headless rendering can be slow: wait for the player to get there)
            page.wait_for_function("__pong.state().vz > 5", timeout=4000)
        except Exception:
            pass
        s = page.evaluate("__pong.state()")
        check(s["vz"] > 5, f"pointing low on the court runs your player back ({s['vx']:.2f}, {s['vz']:.2f})")
        page.mouse.move(200, 520)
        try:
            page.wait_for_function(f"__pong.state().vx < {s['vx'] - 1.5}", timeout=4000)
        except Exception:
            pass
        s2 = page.evaluate("__pong.state()")
        check(s2["vx"] < s["vx"] - 1.5 and 0.59 <= s2["vz"], f"pointing left runs left, and never past the net ({s2['vx']:.2f}, {s2['vz']:.2f})")
        page.wait_for_function("__pong.state().phase === 'play'", timeout=15000)
        page.mouse.down(); page.mouse.up()
        check(page.evaluate("__pong.state().vJump") > 0, "a click makes your player jump")
        page.wait_for_function("__pong.vball().ring", timeout=5000)
        check(True, "the landing ring shows while the ball is in the air")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
