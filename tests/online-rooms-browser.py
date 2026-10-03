"""Run with python3 tests/online-rooms-browser.py

2 v 2 online rooms: up to four browsers in one room through the real game server (Supabase Realtime
on the islensk-fotbolti project; WebRTC when possible). Checks the lobby (seats, fighters, shuffle,
a full room), starting with AI in the empty seats, everyone seeing the match from their own team's
end, movement and taps reaching the host, scoring, and the AI taking over when someone leaves.
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


def open_page(browser, url, small=True):
    # (friends get small windows: up to five 3D pages render at once on this machine's software GPU)
    ctx = browser.new_context(viewport={"width": 480, "height": 320} if small else {"width": 1000, "height": 700})
    page = ctx.new_page()
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_function("Boolean(window.__pong)", timeout=60000)
    return ctx, page


def seats(page):
    return page.evaluate("__pong.net().seats")


def room(browser, mode, transport, guests, label):
    flags = "debug" + ("&net=relay" if transport == "relay" else "")
    hctx, host = open_page(browser, f"{BASE}?{flags}", small=False)
    host.locator(f".mode[data-mode='{mode}']").click()
    host.locator("#size2").click()
    host.locator("#rosterYou .card[data-char='claude']").click()
    host.locator("#btnOnline").click()
    host.wait_for_function("document.querySelector('#onLink').value.includes('join=')", timeout=20000)
    code = host.locator("#onLink").input_value().split("join=")[1][:4]
    check(host.locator("#onLobby").is_visible() and host.locator("#onStart").is_disabled(), f"{label}: the host gets a 2 v 2 room and waits for friends")

    joined = []
    for i in range(guests):
        ctx, g = open_page(browser, f"{BASE}?join={code}&{flags}")
        g.wait_for_selector("#onLobby", state="visible", timeout=20000)
        joined.append((ctx, g))
    host.wait_for_function(f"__pong.net().seats.filter(Boolean).length === {guests + 1}", timeout=15000)
    s = seats(host)
    chars = [x["char"] for x in s if x]
    check(len(chars) == guests + 1 and len(set(chars)) == len(chars), f"{label}: {guests} friends join, each gets a seat and a different fighter ({chars})")
    return hctx, host, joined


def wait_live(pages):
    for pg in pages:
        pg.wait_for_function("__pong.net().live && __pong.net().phase !== 'over'", timeout=20000)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])

        # ---- A. Volleyball, four people, direct connections
        hctx, host, joined = room(browser, "volley", "p2p", 3, "volley")
        g1, g2, g3 = (g for _, g in joined)
        # everyone sees the same room
        for g in (g1, g2, g3):
            g.wait_for_function("__pong.net().seats.filter(Boolean).length === 4", timeout=10000)
        check(all(seats(g) == seats(host) for g in (g1, g2, g3)), "volley: everyone sees the same seats")
        # a friend changes fighter (only to a free one): grok is free, the host's claude is not
        free = [k for k in ["claude", "codex", "muse", "grok", "clawd"] if k not in [x["char"] for x in seats(host)]][0]
        check(g3.locator("#rosterLobby .card[data-char='claude']").is_disabled(), "volley: you can't take a fighter someone else has")
        g3.locator(f"#rosterLobby .card[data-char='{free}']").click()
        host.wait_for_function(f"__pong.net().seats.some((s) => s && s.char === '{free}')", timeout=8000)
        check(True, f"volley: a friend switches to {free} and the host sees it")
        # a fifth person can't get in
        fctx, extra = open_page(browser, f"{BASE}?join={host.locator('#onLink').input_value().split('join=')[1][:4]}&debug")
        extra.wait_for_function("document.querySelector('#onStatus').textContent.includes('full')", timeout=15000)
        check(True, "volley: a fifth person is told the room is full")
        fctx.close()
        # shuffle: still four seats, two per team
        host.locator("#onShuffle").click()
        host.wait_for_timeout(300)
        s = seats(host)
        check(all(s) and len({x["id"] for x in s}) == 4, "volley: SHUFFLE keeps everyone seated in random teams")
        host.locator("#onStart").click()
        wait_live([host, g1, g2, g3])
        h = host.evaluate("__pong.net()")
        check(h["duo"] and h["remote"] == [False, True, True, True], "volley: the match starts with the host and three friends")
        infos = {id(g): g.evaluate("__pong.net()") for g in (g1, g2, g3)}
        # each friend sees themselves as the near main player, with their own fighter
        for g in (g1, g2, g3):
            n = infos[id(g)]
            mine = next(x for x in seats(host) if x["id"] == n["id"])
            check(n["duo"] and n["keys"][0] == mine["char"], f"volley: a friend plays as {n['keys'][0]} from their own end (seat {seats(host).index(mine)})")
        # every friend's movement reaches the host, in the host's frame (servers stand still until they serve)
        for g in (g1, g2, g3):
            g.wait_for_function("__pong.net().phase === 'play'", timeout=15000)
        for g in (g1, g2, g3):
            g.evaluate("__pong.netAim(2.5, 5)")
        host.wait_for_timeout(2500)
        h = host.evaluate("__pong.net()")
        for g in (g1, g2, g3):
            me = infos[id(g)]["me"]
            sign = -1 if me["flip"] else 1
            ex, ez = h["ents"][me["ent"]]
            check(abs(ex - sign * 2.5) < 0.8 and abs(ez - sign * 5) < 1.2, f"volley: a friend's player runs where they steer it (host sees {ex:.1f},{ez:.1f})")
        # the ball: each friend sees the host's ball from their own end
        h = host.evaluate("__pong.net()")
        for g in (g1, g2, g3):
            n = g.evaluate("__pong.net()")
            sign = -1 if n["me"]["flip"] else 1
            check(abs(n["vball"][0] - sign * h["vball"][0]) < 3.5 and abs(n["vball"][2] - sign * h["vball"][2]) < 4.5, f"volley: a friend sees the same ball (host {h['vball'][0]:.1f},{h['vball'][2]:.1f})")
        # a point: the host's team scores; teammates see it as theirs, rivals as the other team's
        before = host.evaluate("__pong.net().score")
        host.evaluate("__pong.netForceScore(1)")
        for g in (g1, g2, g3):
            flip = infos[id(g)]["me"]["flip"]
            idx = 1 if flip else 0
            g.wait_for_function(f"__pong.net().score[{idx}] >= {before[0] + 1}", timeout=6000)
        check(True, "volley: a point reaches everyone, on the right side of their scoreboard")
        # someone leaves: the AI takes over and the match goes on
        leaver = infos[id(g3)]["me"]["ent"]
        joined[2][0].close()
        host.wait_for_function(f"__pong.net().ai[{leaver}] && !__pong.net().remote[{leaver}]", timeout=12000)
        h = host.evaluate("__pong.net()")
        check(h["live"] and not h["over"] and h["peers"] == 2, "volley: when a friend leaves, the AI plays for them and the match goes on")
        check(g1.evaluate("__pong.net().live") and g2.evaluate("__pong.net().live"), "volley: the others keep playing")
        for ctx, _ in joined[:2]:
            ctx.close()
        host.wait_for_function("__pong.net().over", timeout=15000)
        check(host.evaluate("__pong.net().overTitle") == "OPPONENT LEFT", "volley: when everyone has left the host is told")
        hctx.close()

        # ---- B. Ping Pong through the relay: you and one friend as TEAMMATES vs two AIs
        hctx, host, joined = room(browser, "pong", "relay", 1, "pong")
        (gctx, g), = joined
        g.locator("#onLobby .seat[data-seat='3']").click()  # move to the other team...
        host.wait_for_function("!__pong.net().seats[1] && __pong.net().seats[3]", timeout=8000)
        check(True, "pong: a friend can move to another seat")
        g.locator("#onLobby .seat[data-seat='1']").click()  # ...and back next to the host
        host.wait_for_function("__pong.net().seats[1] && !__pong.net().seats[3]", timeout=8000)
        check(host.locator("#onStart").is_enabled(), "pong: two people can start (the AI fills two seats)")
        host.locator("#onStart").click()
        wait_live([host, g])
        h, n = host.evaluate("__pong.net()"), g.evaluate("__pong.net()")
        check(h["remote"] == [False, True, False, False] and h["ai"][2] and h["ai"][3], "pong: the friend is the host's teammate; the AI plays the other team")
        check(not n["me"]["flip"] and n["me"]["swap"] and n["keys"][1] == "claude", "pong: the friend plays from the same end as the host, next to them")
        g.evaluate("__pong.netAim(-6, 5)")
        host.wait_for_function("Math.abs(__pong.net().ents[1][0] + 6) < 0.8", timeout=8000)
        check(True, "pong: the teammate's paddle moves on the host's table (not mirrored)")
        host.evaluate("__pong.netForceScore(1)")
        g.wait_for_function("__pong.net().score[0] >= 1", timeout=6000)
        check(True, "pong: your team's points count for your friend too")
        g.wait_for_function("__pong.net().phase === 'play'", timeout=10000)
        g.keyboard.press("Shift")
        host.wait_for_function("__pong.net().spinA >= 0", timeout=4000)
        check(True, "pong: the friend's SPIN tap reaches the host")
        gctx.close(); hctx.close()

        # ---- C. Air Hockey: host + two friends
        hctx, host, joined = room(browser, "hockey", "p2p", 2, "hockey")
        host.locator("#onStart").click()
        wait_live([host] + [g for _, g in joined])
        h = host.evaluate("__pong.net()")
        check(sum(h["remote"]) == 2 and sum(h["ai"]) == 1, "hockey: two friends + one AI")
        for _, g in joined:
            g.evaluate("__pong.netAim(-3, 4)")
        host.wait_for_timeout(2000)
        h = host.evaluate("__pong.net()")
        for _, g in joined:
            me = g.evaluate("__pong.net().me")
            sign = -1 if me["flip"] else 1
            ex, ez = h["ents"][me["ent"]]
            check(abs(ex - sign * -3) < 1 and abs(ez - sign * 4) < 1.5, f"hockey: a friend's mallet goes where they steer it (host sees {ex:.1f},{ez:.1f})")
        for ctx, _ in joined:
            ctx.close()
        hctx.close()

        check(not ERRORS, f"no page errors ({ERRORS[:3]})")
        browser.close()


if __name__ == "__main__":
    main()
