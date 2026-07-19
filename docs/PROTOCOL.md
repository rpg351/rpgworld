# Age of Titans — protocol & content contract (v1)

Browser ARPG-MMO (Titan Quest style, Greek myth) at `https://ideitas.online/rpg/`.

**Idioma:** todo texto visible para el jugador (UI, misiones, objetos, toasts, chat de sistema) está en **español**. Los identificadores de protocolo (kinds, slots, icons, campos) permanecen en inglés.
Server: Bun + WebSocket, authoritative. Client: vanilla JS canvas, zero assets (all procedural drawing), no build step.

## Transport

- WS endpoint: client connects to `(wss|ws)://<host>/rpg/ws`. Server listens on `127.0.0.1:$PORT` (default **8792**); Caddy reverse-proxies `/rpg/ws` and `/rpg/api/*` to it.
- Health: `GET /rpg/api/health` → `{"ok":true,"pop":<n>}`.
- All messages: single JSON object with `t` (type). Unknown fields ignored. Server closes sockets that send malformed JSON repeatedly.
- Units: world coordinates are **tiles** (floats). Time: ms. Server sim tick 15 Hz; snapshots 10 Hz; AOI radius 24 tiles.

## Login flow

1. Client → `{t:"login", name, pass, cls?}`. `name` 3–16 chars `[A-Za-z0-9_]`, `pass` ≥ 4 chars. New account requires `cls` ∈ `warrior|hunter|mage|cleric`; existing account ignores `cls`. Password hashed with `Bun.password`. Second login for same account kicks the older socket (`{t:"err",msg:"…logged in elsewhere"}` + close).
2. Server → on failure `{t:"err", msg}` (socket stays open, may retry). On success, in order:
   - `{t:"welcome", id, name, cls, skills:[{n,name,desc,cost,cd,unlock,kind}]}` — `n`∈1..4, `cost` mana, `cd` ms, `unlock` level, `kind`∈`"target"|"point"|"self"` (targeting mode for the client).
   - `{t:"map", w:160, h:160, tiles:[…160 strings of 160 chars…], town:{x,y}, zones:[{name,x0,y0,x1,y1,lvl:"1-2"}]}`
   - `{t:"you", …}` (full private state, see below)
   - snapshots begin.

## Tiles (chars in map rows)

Walkable: `g` grass, `d` dirt path, `s` sand, `f` ruins floor, `p` plaza stone.
Blocking: `w` water, `t` tree, `r` rock, `W` ruin wall.
Client renders 32 px/tile, may add procedural per-tile decoration seeded by `(x,y)` hash.

## Client → server messages

- `{t:"dir", x, y}` — **WASD movement** (primary). `x,y` ∈ {-1,0,1}; server normalizes, moves at ~5 tiles/s with wall-slide until a zero vector stops it. A **non-zero** vector clears `atkTarget` (cancels auto-attack lock) and overrides paths/chase. Zero vector only stops movement.
- `{t:"move", x, y}` — legacy click-to-move target (A* path, ~5 tiles/s). Kept server-side; the client no longer sends it. Cancels attack target.
- `{t:"attack", id}` — lock auto-attack on mob `id` (chase + swing when in range). `id:0` clears the lock (empty-ground click). Solo (no party): getting hit by a mob also locks `atkTarget` onto that attacker if you have no living target and are not WASD-steering.
- `{t:"skill", n, id?, x?, y?}` — use skill slot n. `id` for kind:"target", `x,y` for kind:"point"; cast range 7. Server validates level/mana/cooldown/range.
- `{t:"pickup", id}` — lock+chase ground loot `id` (same approach pattern as attack); auto-picks when within 2 tiles. WASD / empty-ground click / attack clears the lock.
- `{t:"talk", id}` — interact with NPC (within 3 tiles) → server replies `dialog` and/or `shop`.
- `{t:"buy", npc, idx}` — buy item `idx` from that NPC's current stock.
- `{t:"drop", slot}` — drop inventory slot onto the ground as shared loot (anyone can pick up). Client: drag item outside the inventory panel. Quest items blocked. Stacks drop 1 unit.
- `{t:"sell", slot}` — sell inventory slot (only while a shop dialog is open server-side is NOT required; selling allowed within 3 tiles of any merchant NPC). Price = `floor(val/4)`.
- `{t:"equip", slot}` — equip inventory slot (validates slot type + level req; swaps with currently equipped).
- `{t:"unequip", eslot}` — `eslot` ∈ `weapon|armor|helm|ring` (needs free inv space).
- `{t:"use", slot}` — consume potion.
- `{t:"allot", stat}` — spend 1 stat point, `stat` ∈ `str|dex|int`.
- `{t:"party_invite", id}` — invite player (entity id) to your party (max 10). Opens from the client's player-click menu.
- `{t:"party_accept", from}` / `{t:"party_decline", from}` — answer a pending invite (`from` = inviter name, invites expire after 30 s).
- `{t:"party_leave"}` — leave; a party of 1 disbands.
- `{t:"quest_accept", qid}` / `{t:"quest_turnin", qid}` — while near the Elder.
- `{t:"chat", text}` — ≤200 chars, rate-limit 1/s.
- `{t:"respawn"}` — after death: revive at town, full hp/mp, lose 10% gold.

Server replies to invalid/denied actions with `{t:"toast", msg}` (short human string).

## Server → client messages

- `{t:"st", pop, ents:[…], gone:[ids], loot:[{i,x,y,name,rarity,icon}]}` — 10 Hz snapshot of AOI. `pop` = players online.
  - ent: `{i, k, x, y, h, H, l}` (+`n` name for players/NPCs/boss, +`m`,`M` mana on YOUR ent only, +`s` bitflags: 1=moving, 2=attacking, 4=slowed, 8=stunned, +`d` facing: 0 right / 1 left).
  - `gone` lists ids that left AOI or despawned. `loot` is the full current AOI ground-loot set each snapshot.
- `{t:"you", lvl, xp, xpNext, gold, pts, str, dex, int, hp, mhp, mp, mmp, arm, dmg:[lo,hi], crit, spd, inv:[item|null ×24], eq:{weapon,armor,helm,ring}, quests:{qid:{n,done,turned}}}` — sent on any private-state change (loot, buy, equip, xp, quest progress…). Item instance:
  `{id, base, name, slot, icon, tier, rarity, lvl, dmg?:[lo,hi], arm?, mods?:{str?,dex?,int?,hp?,mp?,arm?,dmgp?,crit?}, val, qty?}`
  - `slot` ∈ `weapon|armor|helm|ring|potion|quest`; `icon` ∈ `sword|axe|bow|staff|armor|helm|ring|potion_hp|potion_mp|horn|eye`; `rarity` ∈ `common|magic|rare` (client colors: white/#7fb3ff/#ffcf40).
- `{t:"dmg", i, a, c?}` — damage number on entity `i`, `c:1` = crit (client: floating text).
- `{t:"fx", k, ...}` — cosmetic. `k:"proj", from:{x,y}, to:{x,y}, style:"arrow"|"fire"|"spit"` · `k:"aoe", x, y, r, style:"cleave"|"nova"|"meteor"|"volley"|"slam"|"cry"` · `k:"heal", i` · `k:"level", i`.
- `{t:"dialog", npc, name, kind:"elder"|"merchant"|"smith", lines:[…], quests?:[{qid,name,desc,state:"available"|"active"|"complete"|"turned"|"locked",n,count,rew:{xp,gold,item?}}]}`
- `{t:"shop", npc, name, items:[{idx, item, price}]}` — sent with dialog for merchants; re-sent after buy (stock without the bought unique item; potions infinite).
- `{t:"chat", from, text, sys?}` — `sys:1` for system lines (joins, level-ups, boss kills; `from` omitted).
- `{t:"dead"}` — you died (client shows overlay + Respawn button).
- `{t:"toast", msg}` — transient info/error line.
- `{t:"err", msg}` — login-level failure.
- `{t:"party_invited", from, cls, lvl}` — you received an invite (client shows join/decline prompt).
- `{t:"party", members:[{id,name,cls,lvl,online}]}` — full durable roster on every change (join/leave/level-up/reconnect/login); `online:false` + `id:0` = offline member still in the party; empty array = not in a party.

### Party rules
- Max 10 members. XP from a member's kill is shared among members alive, online and within **20 tiles of the mob**: each gets `round(mobXp·falloff(level)·(1+0.15·(n−1))/n)`. Kill-quest credit also applies to every nearby member. Gold and loot go to the killer only. **Party is persistent**: membership is stored in SQLite (`parties` + per-player `partyId`) and survives disconnect, linger expiry, and full server restart. Offline members stay on the roster. Only an explicit `{t:"party_leave"}` removes you (or disbands the leftover solo member).

## Entity kinds `k`

Players: `warrior`, `hunter`, `mage`, `cleric`.
NPCs (static, in town): `elder` (Nikandros — quests), `merchant` (Kora — potions/rings), `smith` (Bront — weapons/armor).
Monsters: `boar` (lvl 1–2), `satyr` (3–5), `skeleton` (6–8), `harpy` (8–10, ranged), `gorgon` (11–13, ranged+slow), `cyclops` (15, boss "Polifemo", named, big).

## World layout (server-authored, deterministic)

160×160. Town **Helike** plaza (`p` tiles) centered near (30, 80) with the 3 NPCs; safe zone = no monster spawns/aggro within town rect, players can't be hit there. Dirt paths lead east. Zones (west→east, with `zones[]` rects in map msg): Olive Groves (boar/satyr), Ruins of Argos (skeleton/harpy, ruin walls + floor tiles), Gorgon's Hollow (gorgon, rocks), Cyclops Lair (boss arena, far east), Campos Asfódelos (shades/furies + Minotaur labyrinth, north-east, lvl 16–20). Water borders map edges/south; trees/rocks scattered as obstacles but zones stay traversable. ~120 monster spawn points, respawn 20 s (boss 180 s). Monsters: aggro radius 6 (boss 10), chase speed slightly below player, leash 15 tiles from spawn then walk home (no heal / no invuln; hitting them re-aggros). Melee monsters hit at 1.5; harpy/gorgon shoot at range 6 (gorgon applies 40% slow 2 s).

## Stats & combat (server-side)

- Base by class (lvl 1): warrior 10/6/4 (str/dex/int), hunter 6/10/4, mage 4/6/10, cleric 6/5/9. +3 stat points per level (player allocates via `allot`).
- `mhp = 40 + 12·lvl + 3·str`, `mmp = 20 + 4·lvl + 3·int`.
- Weapon dmg from item `dmg:[lo,hi]`; unarmed [1,3]. Bonus: sword/axe +0.5·str, bow +0.5·dex, staff +0.6·int; `dmgp` mod = +%.
- Crit: `5 + 0.15·dex` %, ×1.6 dmg.
- Mitigation: `arm/(arm+80)`, capped 60%.
- Regen (out of combat 5 s): 2%/s hp, 3%/s mp (mp regens 1%/s in combat too).
- XP: `xpNext(l) = round(90·l^1.55)`; mob XP scales with mob level, −20%/level beyond 4 levels below player (min 10%). Level cap 25. Level-up: full heal, +3 pts, `fx level`, sys chat line.
- Death: monster kills award XP+gold to the killer (last hitter). Player death → `dead`, waits for `respawn`.
- Kill credit updates kill-quests; collect-quests track quest items in inventory.

## Skills (unlock lvl 1/4/8/12)

Warrior: **Cleave** (160% wpn, radius 2.2 around self, 8 mp, 5 s) · **War Cry** (100% + 1.5 s stun, radius 3 self, 12 mp, 10 s) · **Whirlwind** (220%, radius 2.5 self, 20 mp, 12 s) · **Cólera titánica** ULTIMATE (350% + 1 s stun, radius 3.5 self, 28 mp, 20 s, unlock 12) — all kind:"self".
Hunter: **Piercing Shot** (180% target, 8 mp, 4 s, kind:"target") · **Volley** (120% radius 2.5 at point, 14 mp, 9 s, kind:"point") · **Rain of Arrows** (250% radius 3 at point, 22 mp, 14 s, kind:"point").
Mage: **Firebolt** (170% target, 7 mp, 3 s, kind:"target") · **Frost Nova** (130% + 50% slow 3 s, radius 3 self, 14 mp, 10 s, kind:"self") · **Meteor** (280% radius 3 at point, 24 mp, 15 s, kind:"point").
Cleric: **Oración** (heal self + most-hurt party ally within 12 tiles, **70% of missing HP** each, `healMissing`, 10 mp, 6 s, kind:"self") · **Himno sagrado** (heal 30% max HP self + party in radius 5, 14 mp, 10 s, kind:"self", unlock 4) · **Círculo sagrado** (heal 30% self+party **and** 150% holy damage to enemies in radius 4, 20 mp, 14 s, unlock 8) · **Juicio de Zeus** ULTIMATE (320% holy AoE radius 3.2 self, 26 mp, 18 s, unlock 12).

## Items & shops

- Weapon bases: sword/axe (melee), bow (ranged), staff (spell) — tiers 1–4, level req 1/5/9/13. Armor/helm/ring tiers 1–4 (armor value; ring = mods only).
- Rarity roll on monster drops: common 70% / magic 25% (1–2 mods) / rare 5% (3–4 mods). Mod pool: `str,dex,int,hp,mp,arm,dmgp,crit`, magnitude scales with tier. Magic = "<Prefix> <Base>", rare gets an epic generated name. Drop chance ~35% per kill + gold (auto-granted to killer); boss always drops 2 rares. Loot despawns 60 s.
- Potions: HP/MP small (t1) & large (t3), stack to 10, `use` heals 40%/70% (instant), 3 s shared potion cooldown.
- Kora (merchant): potions (infinite) + a few t1–2 rings/magic items. Bront (smith): weapons/armor t1–3, restocked every 5 min with fresh rolls. Buy at `price = val`; sell anywhere near a merchant at `floor(val/4)`.

## Quests (all from Elder Nikandros, chain — each requires previous turned in)

| qid | name | goal | reward |
|---|---|---|---|
| q1 | Boar Trouble | kill 8 boars | 120 xp, 50 g |
| q2 | Horns of the Wild | collect 5 Satyr Horns (60% drop, quest item) | 250 xp, 100 g, magic weapon (class-matched) |
| q3 | The Restless Dead | kill 10 skeletons | 450 xp, 180 g |
| q4 | Feathers and Fury | kill 8 harpies | 700 xp, 280 g, magic armor |
| q5 | Stone Gaze | kill 6 gorgons | 1000 xp, 420 g |
| q6 | The Eye of the Storm | slay Polyphemus | 2200 xp, 1000 g, rare item |

Turn-in removes quest items. `dialog.quests[].state:"locked"` for not-yet-available chain entries (show greyed with requirement).

## Persistence

SQLite (`bun:sqlite`) at `$RPG_DB` (default `/var/lib/ideitas/rpg/rpg.sqlite`), WAL. Table `players(name PK, pass, cls, data JSON, created, seen)`. Save dirty players every 30 s and on disconnect/shutdown (SIGTERM handler).

## Files

- Server: `/opt/ideitas/rpg/server.ts` (+ optional `data.ts`, `world.ts`). Run: `bun run server.ts`. Env: `PORT`, `RPG_DB`. No npm deps — Bun built-ins only.
- Client: `/var/www/ideitas.online/rpg/index.html`, `style.css`, `game.js`. No external assets/CDNs (CSP is `self`). WS url: `` `${location.protocol==='https:'?'wss':'ws'}://${location.host}/rpg/ws` ``.
