# ECHOBOUND

**A tactical card game where every move leaves an echo.**

ECHOBOUND is an original browser-playable, turn-based card game prototype designed for two players. It runs with no account, no third-party services, no installed dependencies, and no backend.

## Play

- Open `index.html` in a browser, or host the folder as a static website.
- Choose **VS. AI** or **2 PLAYERS** (local hot-seat play on one device).
- Choose one of four hand cards, choose a vault, and optionally switch from CAST to CHARGE.
- Click **REVEAL ROUND**. In local mode, hand over the device so your opponent can commit their secret move.
- There are 8 rounds, one simultaneous play per player per round.
- Control more vaults than your opponent to win. If vaults controlled are tied, total Power decides.

### Card rules

- A card has a **Power**, an **Echo**, and a **symbol** (Ember, Tide, Veil).
- Play a card into one of three vaults. Its Power is immediately added to your score in that vault.
- **Symbol match:** Playing Ember to Crucible, Tide to Undertow, or Veil to Between adds +2 Power.
- **CHARGE:** Lose 2 base Power (minimum base 1), but add 2 to the card's Echo. The vault symbol bonus still applies.
- In the following round, your opponent captures the Echo if they play to the **same vault** as that card. Otherwise, you keep the Echo in its original vault. Both players' choices are simultaneous.
- Echoes created on round 8 fade without scoring. This affects both players equally.
- Both players begin with 4 cards, playing 1 and drawing 1 after every round except the last.
- Matching suit bonus applies only to a played card's Power, not its Echo.
- A tied vault belongs to neither player. Winning the most vaults determines the result; total Power is the tie-breaker, then a draw.

## How to host on the web

### GitHub + Vercel

1. Create a new GitHub repository (e.g., `echobound`).
2. Upload the contents of this directory to the repository root.
3. In Vercel, click **Add New > Project**, import the repository, and leave the project as **Other** with **no build command**.
4. Deploy. The site will be accessible through Vercel's generated HTTPS URL and can be opened on phone, tablet, or desktop.

Since this is plain HTML/CSS/JavaScript, it also works with GitHub Pages, Cloudflare Pages, and Netlify.

## Developer notes

- `index.html`: Semantic page structure.
- `styles.css`: Responsive styling and all graphic presentation, without art dependencies.
- `core.js`: Pure game rules, AI move selection, deck, scoring, resolution. CommonJS-compatible for Node tests.
- `game.js`: Browser UI state, event handlers, local stats / XP.
- `tests/core.test.cjs`: Automated rules tests.

Node v18+ is needed only for tests: `node --test tests/*.test.cjs` (or `npm test`). Nothing needs to be compiled to play.

## Current scope / follow-up work

Implemented: offline vs AI (two difficulty modes), local 2-player mode, interactive responsive UI, 8-round match, animated interface hover/select states, hand and deck, card charging, echo capture, 3-vault scoring, persistent browser-based win and XP stats, and optional keyboard controls (`1–4` cards, `Q/W/E` vaults, `C` stance, `Enter` to commit).

Not implemented: remote real-time matchmaking, user accounts, cloud save, progression across devices, ranked ladder, spectating, card collection/deckbuilding, online leaderboards. Those would require a backend and online play authentication/room support. Browser-only local stats don't sync between devices.

ECHOBOUND is a working rules prototype, not a claim of patentable or unprecedented mechanics. Card values, rounds, and difficulty should be playtested and balanced before public launch.