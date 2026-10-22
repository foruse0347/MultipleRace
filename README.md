# MultipleRace - 3D multiplayer racing (Telegram Mini App)

Node.js + Express + Socket.IO (authoritative server) and Three.js client. Every race has exactly **10 cars**: real players first, AI fills the rest. Bot: **@MultipleRaceBot**.

## Run locally
```bash
npm install
cp .env.example .env      # put your BOT_TOKEN in .env
npm start                 # http://localhost:3000   (health: /health)
npm test                  # smoke test: 2 humans + 8 AI, 10 cars, AI laps
```
Without `BOT_TOKEN` the game runs in guest mode locally (no Telegram verification, no bot).

## Environment variables
| Name | Required | Purpose |
|---|---|---|
| `BOT_TOKEN` | yes (production) | From @BotFather. Server-side only. Used for initData validation and the bot. |
| `GAME_URL` | no | Default `https://multiplerace-7fpw.onrender.com` |
| `BOT_USERNAME` | no | Default `MultipleRaceBot` |
| `PORT` | no | Render sets it; server binds `0.0.0.0` |
| `RUN_BOT` | no | `0` to disable the built-in bot (then run `npm run bot` separately) |
| `LOBBY_SECONDS` / `COUNTDOWN_SECONDS` | no | Defaults 15 / 5 |

In production (`NODE_ENV=production`) the server refuses to start without `BOT_TOKEN`.

## Telegram setup
1. @BotFather -> `/newbot` (or use your existing @MultipleRaceBot) and copy the token.
2. Set `BOT_TOKEN` on Render. On boot the bot sets the chat menu button to **Play Racing** and answers `/start` with a welcome message and a **Play Racing** web-app button.
3. Optional: BotFather -> `/newapp` or `/setmenubutton` with the game URL.
Only one process may poll the bot token at a time - do not run the bot locally while Render is live.

## Deploy on Render
- New **Web Service** from your Git repo. **Root Directory:** the folder that contains `package.json` (repo root, or `multiplerace` if it is a subfolder).
- Build command: `npm install` - Start command: `npm start`
- Health check path: `/health`
- Environment: add `BOT_TOKEN` (and `NODE_ENV=production`).
- Render free instances sleep when idle; the first open can take ~30s.

## Real car models (optional)
Drop `car0.glb`..`car3.glb` into `public/models/` (details in `public/models/README.txt`). Missing slots keep the built-in procedural cars. Not yet tested with a real model file.

## Controls
Keyboard: W/A/S/D or arrows, Space = drift/handbrake, C = camera, R = respawn, Esc = pause. Touch: on-screen steer, gas, brake, drift.

## Implemented
Authoritative 60 Hz server sim, 20 Hz timestamped snapshots, client interpolation (110 ms buffer) + prediction with reconciliation, lobby/countdown/grid, ordered checkpoints + laps (3), positions, results, reconnect by identity (disconnected humans are AI-driven so the grid stays at 10), server-side input validation (clients send only throttle/brake/steer/handbrake), Telegram initData HMAC verification, AI personalities (lane, skill, cornering grip), overtaking-avoidance and stuck recovery, 4 procedural cars with paint colours, adaptive quality + FPS counter, pause/visibility handling.

## Known limitations
- Verified: server, 10-car rooms, multi-client sync, AI laps (`npm test`). **Not yet verified:** rendering/FPS on real phones and inside Telegram - test those after deploying.
- One track; car-to-car collisions are simple circles; no persistent accounts or rankings; the lobby waits up to 15 s then fills with AI.
