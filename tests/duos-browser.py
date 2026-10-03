"""Run with python3 tests/duos-browser.py (no server needed; set PIXEL_PONG_URL to test a deployed copy).

Covers 2 v 2 in all three modes (you + an AI teammate vs two AIs): the menu switch, the double-width
table / rink / court, four different fighters, every player taking part, team scoring and slime,
Volleyball's set-and-attack (max 2 touches, never twice in a row) and the rally speeding up.
"""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = os.environ.get(
    "PIXEL_PONG_URL", (ROOT / "public/projects/pixel-pong/game.html").as_uri()
) + "?debug"
ERRORS = []
BR = 0.32


def check(cond, message):
    if not cond:
        raise AssertionError(message)
    print("ok -", message)


def everyone_played(hits, label):
    check(all(hits.get(str(i), 0) > 0 for i in range(4)), f"{label}: all four players hit it ({hits})")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: ERRORS.append(str(error)))
        page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
        page.goto(GAME)
        page.wait_for_function("Boolean(window.__pong)", timeout=30000)

        # 1. The menu switch: 2 v 2 doubles the width, 1 v 1 brings it back.
        page.locator("#modePong").click()
        page.locator("#size2").click()
        info = page.evaluate("__pong.duoInfo()")
        check(page.locator("#size2").get_attribute("aria-checked") == "true" and page.locator("#duoNote").is_visible(), "a 2 V 2 switch in the menu explains the teams")
        check(info["duo"] and info["HW"] == 10 and info["CW"] == 10, f"2 v 2 makes the table and court twice as wide ({info['HW']}, {info['CW']})")
        check(not page.locator("#btnOnline").is_visible(), "online play stays 1 v 1 for now (the button hides in 2 v 2)")
        page.locator("#btnStart").click()
        page.wait_for_timeout(400)
        info = page.evaluate("__pong.duoInfo()")
        check(all(info["pads"]) and all(info["rigs"]), "four paddles and four fighters are on the table")
        check(len(set(info["keys"])) == 4, f"all four fighters are different ({info['keys']})")
        check(info["mini"] == [2, 2], "the scoreboard shows both teams")
        page.evaluate("__pong.mode('pong')")
        info = page.evaluate("__pong.duoInfo()")
        check(not info["duo"] and info["HW"] == 5 and info["pads"] == [True, False, True, False] and info["rigs"] == [True, False, True, False],
              "back to 1 v 1: normal table, two paddles, two fighters")
        for _ in range(10):  # the random teammate and second opponent never clash with your picks
            keys = page.evaluate("__pong.mode('pong', true), __pong.duoInfo().keys")
            assert len(set(keys)) == 4, keys
        print("ok - every 2 v 2 line-up has four different fighters")

        # 2. Ping Pong 2 v 2.
        r = page.evaluate("__pong.sim(300, { duo: true, spinP: 0.3 })")
        print("pong:", {k: r[k] for k in ("bad", "points", "maxFlight", "maxPins", "hitsBy")})
        check(r["bad"] == 0 and r["maxFlight"] < 3, "the ball always stays on the wide table and reaches a paddle")
        everyone_played(r["hitsBy"], "pong")
        check(r["slimes"]["you"] + r["slimes"]["ai"] == 2 * r["points"], f"both players of the losing team get slimed ({r['slimes']} for {r['points']} points)")
        check(r["pinsAtServe"] == 0 and r["maxPins"] >= 2, "pins still grow in long rallies and clear after each point")
        me = page.evaluate("__pong.simPlayer(150, { duo: true, tapAt: 0.15, noAiPower: true })")
        check(me["bad"] == 0 and me["score"][0] >= 1, f"you and your AI teammate score points together ({me['score']})")
        page.evaluate("__pong.mode('pong', true)")
        page.mouse.move(60, 600)
        try:
            page.wait_for_function("__pong.duoInfo().px[0] < -6", timeout=4000)
        except Exception:
            pass
        check(page.evaluate("__pong.duoInfo().px[0]") < -6, "your paddle reaches the far side of the wide table")
        page.evaluate("__pong.mode('pong')")

        # 3. Air Hockey 2 v 2.
        r = page.evaluate("__pong.hsim(300, { duo: true })")
        print("hockey:", {k: r[k] for k in ("bad", "goals", "maxGoal", "violations", "hitsBy")})
        check(r["bad"] == 0 and r["goals"] >= 5, f"the puck stays on the wide rink and goals happen ({r['goals']})")
        everyone_played(r["hitsBy"], "hockey")
        check(all(abs(g - 3.0) < 1e-9 for g in r["serveGoal"]) and 3 < r["maxGoal"] <= 8 + 1e-9, f"goals start twice as wide (3.0) and still grow ({r['maxGoal']:.2f})")
        me = page.evaluate("__pong.hsimPlayer(150, { duo: true, noAiPower: true })")
        check(me["bad"] == 0 and me["score"][0] >= 1, f"your team scores in 2 v 2 Air Hockey ({me['score']})")

        # 4. Volleyball 2 v 2: set and attack, the rules, and it speeds up.
        logs = []
        for diff in ("easy", "normal", "hard"):
            r = page.evaluate(f"__pong.vsim(300, {{ duo: true, diff: '{diff}' }})")
            logs += r["log"]
            print(diff, {k: r[k] for k in ("points", "score", "vbSets", "vbYouSpikes", "vbAiSpikes", "vbMaxTouches", "vbMaxK", "hitsBy")})
            check(r["bad"] == 0 and r["crossUnder"] == 0 and r["vbBumpNoClear"] == 0, f"{diff}: everyone stays in their half and every ball over clears the net")
            check(max(r["score"]) == 7, f"{diff}: a 2 v 2 match is played out to 7 ({r['score']})")
            check(r["vbDouble"] == 0 and r["vbMaxTouches"] <= 2, f"{diff}: nobody touches twice in a row and a team uses at most 2 touches")
            check(r["vbSets"] >= 3 and r["vbYouSpikes"] + r["vbAiSpikes"] >= 2, f"{diff}: teams set the ball up and spike it")
            everyone_played(r["hitsBy"], f"volley {diff}")
            check(r["vbMaxK"] >= 1.15, f"{diff}: rallies speed up ({r['vbMaxK']:.2f}x)")
        wrong = []
        for e in logs:
            inside = abs(e["x"]) <= 10 + BR * 0.5 and abs(e["z"]) <= 7.5 + BR * 0.5
            want = -(1 if e["z"] > 0 else -1) if inside else -e["last"]
            if (1 if e["you"] else -1) != want:
                wrong.append(e)
        check(not wrong, f"all {len(logs)} 2 v 2 points went to the right team ({wrong[:2]})")
        me = page.evaluate("__pong.vsimPlayer(150, { duo: true })")
        check(me["bad"] == 0 and me["vbSets"] >= 2 and me["hitsBy"].get("1", 0) > 0, "your first touch sets up your AI teammate, who attacks")
        idle = page.evaluate("__pong.vsimPlayer(200, { duo: true, idle: true })")
        check(idle["score"][1] == 7, f"the AIs beat a team that stands still ({idle['score']})")
        title = page.evaluate("__pong.duoInfo().overTitle")
        check("&" in title and title.endswith("WIN!"), f"the winning team is named at the end ({title})")

        # 5. 1 v 1 Volleyball speeds up too: each rally starts faster as the match goes on.
        page.evaluate("__pong.mode('volley')")
        ks = page.evaluate("""(() => { const out = []; for (let i = 0; i < 6; i++) { __pong.netForceScore(i % 2 ? 1 : -1); for (let j = 0; j < 400 && __pong.vball().phase !== 'serve'; j++) __pong.stepFor(1/120); out.push(__pong.duoInfo().k); } return out; })()""")
        check(all(b > a for a, b in zip(ks, ks[1:])) and ks[-1] <= 1.4 + 1e-9, f"every point played starts the next rally faster ({[round(k, 2) for k in ks]})")

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
