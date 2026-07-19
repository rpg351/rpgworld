# La Era de los Titanes (rpgworld)

Browser MMORPG inspired by Titan Quest — Bun WebSocket server + canvas client.

**Live:** https://ideitas.online/rpg/

## Layout

| Path | Role |
|------|------|
| `server.ts` | Authoritative game server (Bun) |
| `data.ts` | Classes, skills, items, quests, mobs |
| `world.ts` | Procedural map / walkability |
| `bot.ts` | Always-online class companion bots |
| `client/` | Static web client (`index.html`, `game.js`, `style.css`, `audio.js`) |
| `docs/` | Protocol, party-follow notes, changelog |
| `deploy/` | Example systemd units + bot env template |

## Run locally

```bash
# needs Bun: https://bun.sh
export PORT=8792
export RPG_DB=./rpg.sqlite
bun run server.ts
```

Serve `client/` with any static file server (or your reverse proxy) and point WebSocket to `/rpg/ws`.

Optional companion bot:

```bash
cp deploy/rpg-bot.env.example ./rpg-bot.env
# edit BOT_NAME / BOT_PASS / BOT_CLS / BOT_ALLOT
set -a && source ./rpg-bot.env && set +a
bun run bot.ts
```

## Notes

- Do **not** commit real bot passwords or production SQLite DBs.
- Client cache-bust query (`?v=…`) is set in `client/index.html`.
