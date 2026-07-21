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
   - `{t:"welcome", id, name, cls, skills:[{n,name,desc,cost,cd,unlock,kind}], abilityTree:[{id,name,desc,tier,max,kind,skillN?,perRankDesc}]}` — `n`∈1..4, `cost` mana, `cd` ms, `unlock` level, `kind`∈`"target"|"point"|"self"` (targeting mode for the client). `abilityTree` = árbol de la clase (todas las clases): nodos `kind:"active"` (referencian su habilidad vía `skillN`; rango 1 la desbloquea, salvo la habilidad 1 que siempre está disponible) y `kind:"passive"` (bono por rango, `perRankDesc`), `tier`∈1..3, `max:5`.
   - `{t:"map", w:224, h:224, tiles:[…224 strings of 224 chars…], town:{x,y}, zones:[{name,x0,y0,x1,y1,lvl:"1-2"}]}`
   - `{t:"you", …}` (full private state, see below)
   - snapshots begin.

## Tiles (chars in map rows)

Walkable: `g` grass, `d` dirt path, `s` sand, `f` ruins floor, `p` plaza stone.
Blocking: `w` water, `t` tree, `r` rock, `W` ruin wall.
Client renders 32 px/tile, may add procedural per-tile decoration seeded by `(x,y)` hash.

## Client

- Tecla **M**: mapa del mundo (zonas/jefes/marca personal). Shift+clic en minimapa/mapa fija una marca local (`localStorage`).
- Tecla **Y**: panel de logros. Chat tabs filter channels; `/p` party chat.
 → server messages

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
- `{t:"ability_alloc", id}` — spend 1 ability point: +1 rango (máx 5) al nodo `id` del árbol de tu clase. Validaciones: vivo, puntos > 0, nodo existe para la clase, rango < 5, y puerta de tier por puntos TOTALES gastados en el árbol (tier1=0, tier2=5, tier3=12). Rechazos → `toast`.
- `{t:"party_invite", id}` — invite player (entity id) to your party (max 10). Opens from the client's player-click menu.
- `{t:"party_accept", from}` / `{t:"party_decline", from}` — answer a pending invite (`from` = inviter name, invites expire after 30 s).
- `{t:"party_leave"}` — leave; a party of 1 disbands.
- `{t:"quest_accept", qid}` / `{t:"quest_turnin", qid}` — while near the Elder.
- `{t:"chat", text}` — ≤200 chars, rate-limit 1/s. Whispers `/w`/`/susurro`. Party `/p`/`/g`/`/grupo`. Emotes `/wave|/dance|/cheer|/bow` (or `/me …`).
- `{t:"inspect", id}` — request another player's public gear summary (range 14).
- Death packet may include `recap:[{n,a}]` (last hits taken). Prefix `/w Name msg` or `/susurro Name msg` for a private whisper.
- `{t:"lootlog"}` / `{t:"combatlog"}` — request current session feeds.
- `{t:"party_ping", x, y}` — mark a world position for your party (2s cooldown).
- `{t:"inv_sort"}` — compact inventory (rarity → slot → tier → name).
- `{t:"buyback", idx}` — repurchase a session-sold item from the vendor buyback list (must be near a merchant).
- `{t:"respawn"}` — after death: revive at town, full hp/mp, lose 10% gold.

Server replies to invalid/denied actions with `{t:"toast", msg}` (short human string).

## Server → client messages

- `{t:"st", pop, ents:[…], gone:[ids], loot:[{i,x,y,name,rarity,icon}]}` — 10 Hz snapshot of AOI. `pop` = players online.
  - ent: `{i, k, x, y, h, H, l}` (+`n` name for players/NPCs/boss, +`m`,`M` mana on YOUR ent only, +`s` bitflags: 1=moving, 2=attacking, 4=slowed, 8=stunned, +`d` facing: 0 right / 1 left).
  - `gone` lists ids that left AOI or despawned. `loot` is the full current AOI ground-loot set each snapshot.
- `{t:"you", lvl, xp, xpNext, gold, pts, str, dex, int, hp, mhp, mp, mmp, arm, dmg:[lo,hi], crit, spd, inv:[item|null ×24], eq:{weapon,armor,helm,ring}, quests:{qid:{n,done,turned}}, abilityPts, abilities:{id:rank}}` — sent on any private-state change (loot, buy, equip, xp, quest progress…). `abilities` es un objeto id→rango 1..5 (antes era un array de ids; el servidor migra el formato viejo al cargar). Item instance:
  `{id, base, name, slot, icon, tier, rarity, lvl, dmg?:[lo,hi], arm?, mods?:{str?,dex?,int?,hp?,mp?,arm?,dmgp?,crit?}, val, qty?}`
  - `slot` ∈ `weapon|armor|helm|ring|potion|quest`; `icon` ∈ `sword|axe|bow|staff|armor|helm|ring|potion_hp|potion_mp|horn|eye`; `rarity` ∈ `common|magic|rare` (client colors: white/#7fb3ff/#ffcf40).
- `{t:"dmg", i, a, c?, s?}` — damage number on entity `i`, `c:1` = crit, optional `s` source id.
- `{t:"fx", k, ...}` — cosmetic. `k:"proj", from:{x,y}, to:{x,y}, style:"arrow"|"fire"|"spit"` · `k:"aoe", x, y, r, style:"cleave"|"nova"|"meteor"|"volley"|"slam"|"cry"` · `k:"heal", i` · `k:"level", i`.
- `{t:"dialog", npc, name, kind:"elder"|"merchant"|"smith", lines:[…], quests?:[{qid,name,desc,state:"available"|"active"|"complete"|"turned"|"locked",n,count,rew:{xp,gold,item?}}]}`
- `{t:"shop", npc, name, items:[{idx, item, price}]}` — sent with dialog for merchants; re-sent after buy (stock without the bought unique item; potions infinite).
- `{t:"chat", from, text, sys?, whisper?, party?}` — `sys:1` for system lines (joins, level-ups, boss kills; `from` omitted). `whisper:1` for private `/w` lines. `party:1` for `/p` party chat.
- `{t:"achs", unlocked:[id], defs:[{id,name,desc,gold}], killCount, goldEarned}` — achievement book (also on unlock).
- `{t:"meter", dealt, taken, healed, kills, deaths, t0}` — session combat meter (throttled).
- `{t:"achs"}` / `{t:"meter"}` — client requests current achievement book / session meter.
- `{t:"dmg", i, a, c?, s?}` — damage on entity `i`; optional `s` = source entity id.
- `{t:"ping", from, x, y}` — party map ping (client shows world + minimap marker ~6s).
- `{t:"buyback", items:[{idx,item,price}]}` — session vendor repurchase list (sent with shop / after sells).
- `{t:"st", …, bosses?:[{k,t}]}` — optional boss timers: `t` = seconds until respawn (0 = alive).
- `{t:"dead"}` — you died (client shows overlay + Respawn button).
- `{t:"streak", n}` — killer-only kill-streak counter (`n=0` on death).
- `{t:"toast", msg}` — transient info/error line.
- `{t:"lootlog", entries:[{name,rarity,icon,gold?,at}]}` — session loot/gold feed (up to 30).
- `{t:"combatlog", entries:[{src,dmg,at}]}` — session damage-taken feed (up to 40).
- `{t:"err", msg}` — login-level failure.
- `{t:"party_invited", from, cls, lvl}` — you received an invite (client shows join/decline prompt).
- `{t:"party", members:[{id,name,cls,lvl,online}]}` — full durable roster on every change (join/leave/level-up/reconnect/login); `online:false` + `id:0` = offline member still in the party; empty array = not in a party.

### Party rules
- Max 10 members. XP from a member's kill is shared among members alive, online and within **20 tiles of the mob**: each gets `round(mobXp·falloff(level)·(1+0.15·(n−1))/n)`. Kill-quest credit also applies to every nearby member. Gold and loot go to the killer only. **Party is persistent**: membership is stored in SQLite (`parties` + per-player `partyId`) and survives disconnect, linger expiry, and full server restart. Offline members stay on the roster. Only an explicit `{t:"party_leave"}` removes you (or disbands the leftover solo member).

## Entity kinds `k`

Players: `warrior`, `hunter`, `mage`, `cleric`.
NPCs (static, in town): `elder` (Nikandros — quests), `merchant` (Kora — potions/rings), `smith` (Bront — weapons/armor).
Monsters: `boar` (lvl 1–2), `satyr` (3–5), `skeleton` (6–8), `harpy` (8–10, ranged), `gorgon` (11–13, ranged+slow), `cyclops` (15, boss "Polifemo", named, big), `shade` (16–18), `fury` (18–20, ranged), `minotaur` (20, boss "Asterión"), `lizardman` (21–23), `wisp` (23–25, ranged), `hydra` (25, boss "Hidra de Lerna", named, big).

## World layout (server-authored, deterministic)

224×224. Town **Helike** plaza (`p` tiles) centered near (30, 80) with the 3 NPCs; safe zone = no monster spawns/aggro within town rect, players can't be hit there. Dirt paths lead east. Zones (west→east, with `zones[]` rects in map msg): Olive Groves (boar/satyr), Ruins of Argos (skeleton/harpy, ruin walls + floor tiles), Gorgon's Hollow (gorgon, rocks), Cyclops Lair (boss arena, far east), Campos Asfódelos (shades/furies + Minotaur labyrinth, north-east, lvl 16–20), **Pantano de la Hidra** (lizardman/wisp + Hydra lair, eastern frontier x≥160, lvl 21–25, conectado por dos vados: la vía principal ~y79 y el ramal del laberinto ~y29). Water borders map edges/south; trees/rocks scattered as obstacles but zones stay traversable. ~113 monster spawn points — separación mínima 6 casillas entre spawns y nunca a <2 casillas de un camino (`d`) — respawn 20 s (bosses 180 s). Monsters: aggro radius 6 (boss 10–12), chase speed slightly below player, leash 15 tiles from spawn then walk home (no heal / no invuln).

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

## Skills & ability trees (unlock lvl 1/4/8/12 + nodo activo rango ≥ 1)

**Modelo de daño plano** (reemplaza el antiguo % de daño de arma): `dmg = base + perRank·(rango−1) + coeff·stat` con stat primario guerrero=str, cazador=dex, mago=int, clérigo=int; las habilidades con arma (guerrero/cazador) suman además `0.5·daño rodado del arma`; luego el pipeline de siempre: pasivo de daño de habilidades, `dmgp%` del equipo, crítico ×1.6 y armadura. Curas: `base + perRank·(rango−1) + coeff·INT del lanzador` (× poder de curación pasivo).

Warrior: **Hendidura** (base 5 +0.8·str +4/rango, radius 2.2 self, 8 mp, 5 s) · **Grito de guerra** (base 2 +0.5·str +3/rango + 1.5 s stun, radius 3, 12 mp, 10 s) · **Torbellino** (base 15 +1.1·str +11/rango, radius 2.5, 20 mp, 12 s) · **Cólera titánica** ULTIMATE (base 45 +1.75·str +27/rango + 1 s stun, radius 3.5, 28 mp, 20 s, unlock 12) — all kind:"self", todas con 50% del arma.
Hunter: **Disparo perforante** (base 5 +0.9·dex +4/rango, target, 8 mp, 4 s) · **Ráfaga** (base 3 +0.6·dex +4/rango, radius 2.5 point, 14 mp, 9 s) · **Lluvia de flechas** (base 16 +1.25·dex +12/rango, radius 3 point, 22 mp, 14 s) — todas con 50% del arco.
Mage: **Descarga ígnea** (base 6 +1.0·int +4/rango, target, 7 mp, 3 s) · **Nova de escarcha** (base 4 +0.8·int +4/rango + 50% slow 3 s, radius 3 self, 14 mp, 10 s) · **Meteoro** (base 19 +1.7·int +15/rango, radius 3 point, 24 mp, 15 s) — hechizos puros, sin parte de arma.
Cleric: **Oración** (cura 20 +1.2·int +8/rango a ti y al aliado más herido a ≤12, 10 mp, 6 s) · **Himno sagrado** (cura 15 +1.2·int +7/rango a grupo en radio 5, 14 mp, 10 s, unlock 4) · **Círculo sagrado** (cura 20 +1.5·int +9/rango **y** daño 10 +0.9·int +8/rango en radio 4, 20 mp, 14 s, unlock 8) · **Juicio de Zeus** ULTIMATE (daño 39 +1.9·int +24/rango, radio 3.6 self, 26 mp, 18 s, unlock 12).

**Árboles**: 1 punto de habilidad por nivel (`abilityPts`), nodos de rango 1..5 (1 punto por rango), tiers por puntos gastados 0/5/12. Cada clase tiene 9–12 nodos: sus activos (la habilidad 1 es lanzable sin nodo; su nodo solo sube el daño) + pasivos por rango — guerrero: vida, armadura, daño de habilidades, crítico, -cd, fuerza; cazador: destreza, armadura, crítico, daño, velocidad, vida; mago: int, maná, daño, regen maná, crítico, -cd; clérigo: vida/maná, armadura, crítico, poder de curación, regen, -cd, radio fuente, radio curación grupal.

## Items & shops

- Weapon bases: sword/axe (melee), bow (ranged), staff (spell) — tiers 1–5, level req 1/5/9/13/17 (`TIER_LVL = [1,5,9,13,17,21]`). Armor/helm/ring tiers 1–5 (armor value; ring = mods only). T5: Espada de Cronos / Hacha del Tártaro / Arco solar de Apolo / Bastón del Éter / Coraza del Tártaro / Yelmo de la Hidra / Sello de Cronos.
- Rarity roll on monster drops: common 70% / magic 25% (1–2 mods) / rare 5% (3–4 mods). Mod pool: `str,dex,int,hp,mp,arm,dmgp,crit`, magnitude scales with tier (t5 incluido). Magic = "<Prefix> <Base>", rare gets an epic generated name. Drop chance ~35% per kill + gold (auto-granted to killer); drop tier por nivel del bicho: ≥21→t5, ≥13→t4, ≥9→t3, ≥5→t2. Polifemo 2 rares t4, Asterión 3 rares t4, Hidra 3 rares **t5**. Loot despawns 60 s.
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
| q7 | Shades of Asphodel | kill 12 shades | 2800 xp, 1200 g |
| q8 | Wings of Vengeance | kill 10 furies | 3600 xp, 1600 g, magic armor |
| q9 | Labyrinth of Asterion | slay Asterion | 5500 xp, 2500 g, rare item |
| q10 | Scales of the Swamp | kill 12 lizardmen | 4500 xp, 2000 g |
| q11 | Deceptive Lights | kill 10 wisps | 5500 xp, 2400 g, magic armor |
| q12 | The Seven Heads | slay the Hydra | 8000 xp, 3500 g, rare item |

Pets (pet-shop NPC): dog/cat/owl/turtle/fox/hawk/raven — one equipped at a time; passive perk while active; ~8% chance to fetch bonus gold on kill.

Turn-in removes quest items. `dialog.quests[].state:"locked"` for not-yet-available chain entries (show greyed with requirement).

## Persistence

SQLite (`bun:sqlite`) at `$RPG_DB` (default `/var/lib/ideitas/rpg/rpg.sqlite`), WAL. Table `players(name PK, pass, cls, data JSON, created, seen)`. Save dirty players every 30 s and on disconnect/shutdown (SIGTERM handler).

## Files

- Server: `/opt/ideitas/rpg/server.ts` (+ optional `data.ts`, `world.ts`). Run: `bun run server.ts`. Env: `PORT`, `RPG_DB`. No npm deps — Bun built-ins only.
- Client: `/var/www/ideitas.online/rpg/index.html`, `style.css`, `game.js`. No external assets/CDNs (CSP is `self`). WS url: `` `${location.protocol==='https:'?'wss':'ws'}://${location.host}/rpg/ws` ``.
