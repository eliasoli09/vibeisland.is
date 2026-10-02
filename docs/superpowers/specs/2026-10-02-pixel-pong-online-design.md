# Pixel Pong — online play (design)

Approved 2026-10-02 (step 2 of "10 s shot clock + online game + AI power-ups").

## Service
- The site's own Supabase project (`uoco…`) no longer exists (its hostname doesn't resolve). The user chose not to pay $10/month for a new project and to **reuse the existing `islensk-fotbolti` project** (Pro org) for live channels only. No tables, no data and no settings changed. The game embeds that project's URL + **publishable key** (public by design).
- Verified: two clients on one channel, 40/40 broadcasts, first in ~72 ms.

## Invites
- **PLAY ONLINE** (menu): the host gets a 4-letter room code, a **QR code** (`qrcode-generator`, loaded on demand), the link `…/verkefni/pixel-pong?join=CODE`, plus COPY and SHARE (Web Share where available).
- The page passes a valid `join` code into the iframe (`game.html?join=CODE`). The friend sees "<HOST> wants to play <MODE>", picks a fighter (not the host's) and taps JOIN GAME.
- **Real browser:** `OpenInBrowser` detects in-app browsers (Instagram, Facebook/Messenger, Snapchat, TikTok, LINE, LinkedIn, X, WeChat, KakaoTalk, Pinterest, Google app).
  - Android: it tries `intent://…;package=com.android.chrome` once.
  - iOS: it tries `x-safari-https://…` once.
  - Then it shows an "Opnaðu í vafra" card with steps and a copy-link button. QR scans open the normal browser anyway.

## Networking
- Supabase Realtime channel `pixelpong:<CODE>` carries the handshake and is the relay.
- The host offers a WebRTC peer connection (Google STUN) with two data channels: `game` (unordered, no retransmits) for snapshots/input and `ctl` (reliable) for events. If it opens, traffic goes direct ("ONLINE - DIRECT"); otherwise everything stays on the relay ("ONLINE - RELAY"). `?net=relay` forces relay (tests).
- **Host authoritative:** the host runs the normal simulation. The far paddle/mallet is the friend's reported position (pong: lag history, which accepts a hit if the friend's paddle was there within the last 150 ms).
  - The friend's SPIN taps count with a 0.15 s lag allowance.
  - Snapshots go out at 30 Hz direct / 20 Hz relay (ball/puck, both paddles, score, phase, decoys/fakes, pins, goal crossings, shot clock).
  - Events go out reliably: sounds (except perspective ones and the slime bucket), bursts, hit pulses, score, game over, spin pops, shared pops, banners.
- **Guest:**
  - It has no physics authority. Its own paddle/mallet moves instantly from input and is sent at 30/20 Hz.
  - Snapshots are mirrored (x → −x, z → −z, near ↔ far, score swapped), advanced by half the measured round trip, and the guest keeps integrating between them.
  - Score events run the local `scorePoint` (banner, slime, rig animations); `over` runs `gameOver`.
- **Rules online:** boosts are off (both sides, including the streak dots) and pause is off. Spin, pins, growing goals, the shot clock and slime all work.
- **Disconnects:** `bye` on pagehide, or 5 s without messages. The other side sees "OPPONENT LEFT" and gets the win. REMATCH restarts (the guest asks the host); CHANGE FIGHTER leaves.

## Testing — `tests/online-browser.py` (two real browsers through the real game server)
- pong/p2p, hockey/relay, hockey/p2p and pong/relay:
  - QR + link
  - the host's fighter is blocked for the friend
  - roles and mirroring
  - transport
  - friend input reaches the host mirrored
  - state reaches the friend mirrored
  - a point syncs and slimes the right side
  - a disconnect gives the win
- With `SITE_URL`:
  - the link opens `/verkefni/pixel-pong?join=`
  - the Instagram browser gets the "open in Safari" card
  - a phone joins from the link through the page's iframe
- Player-boost checks in the hockey and chaos tests now run with `noAiPower` (since step 1 the AI's own boosts can end a test match before yours are used).
