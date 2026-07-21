// server.ts — Age of Titans authoritative game server (Bun built-ins only).
// Transport & content contract: /opt/ideitas/rpg/PROTOCOL.md
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ServerWebSocket } from "bun";
import {
  ACHIEVEMENTS, BREW_MAP, CLASS_BASE, CLASS_WEAPON, ELIXIR_DEFS, FISH_DEFS, FOOD_DEFS, MOB_DEFS, MOUNT_DEFS, NPC_LINES, PET_DEFS, POTION_DEFS, QUESTS, QUEST_ORDER,
  SKILLS, TREES, WEAPON_SCALING, foodFromFish, freshItemId, makeElixir, makeFish, makeFood, makeHerb, makePotion, makeQuestItem, mobStats,
  rollFish, rollHerb, rollItem, rollRarity,
} from "./data";
import type { AbilityDef, Item, SkillDef } from "./data";
import {
  BOSS2_POS, BOSS3_POS, BOSS_POS, FOUNTAIN, NPC_DEFS, PORTAL_WAYPOINTS, TOWN, TOWN_RECT, W, ZONES, ZONE_PORTAL_ID, astar, buildWorld, inRect,
} from "./world";

const PORT = Number(process.env.PORT) || 8792;
const DB_PATH = process.env.RPG_DB || "/var/lib/ideitas/rpg/rpg.sqlite";

const TICK_MS = 1000 / 15;
const SNAP_MS = 100;
const AOI = 24;
const AOI2 = AOI * AOI;
const PLAYER_SPD = 5;
const ATTACK_CD = 1100;
const MELEE_RANGE = 1.7;
const RANGED_RANGE = 7;
const CAST_RANGE = 7;
const LEASH = 15;
const LOOT_TTL = 60000;
const INV_SIZE = 24;
const STASH_SIZE = 32;
const COMBAT_MS = 5000;
const POTION_CD = 3000;
const RECALL_CD = 15000;
const REVIVE_MS = 30000; // auto-revive delay after death (manual "Resucitar" button skips this)
const BOARD_POST_CD = 30000; // per-player cooldown between request-board posts
const FOUNTAIN_REGEN_R = 5; // tiles from the fountain that count as "near"
const FOUNTAIN_HP_REGEN = 0.10; // 10%/s hp — 5x the normal 2%/s
const FOUNTAIN_MP_REGEN = 0.12; // 12%/s mp — 4x the normal 3%/s
const LEVEL_CAP = 25;

const EQUIP_SLOTS = ["weapon", "armor", "helm", "ring"] as const;
const BOSS_KINDS = new Set(["cyclops", "minotaur", "hydra"]);

function pickSlot(slots: readonly string[]): string {
  return slots[Math.floor(Math.random() * slots.length)];
}

// Always-online companion bots — shared squad party + starter gear.
const BOT_SQUAD = new Set(["Achilles", "Atalanta", "Circe", "Chiron"]);
const BOT_SQUAD_LEADER = "Achilles";
/** Humans who auto-join the bot squad when they invite any companion bot. */
const ALLOWED_PARTY_HUMANS = new Set(["cansao", "cansao2", "mayco"]);

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const world = buildWorld();

function walkableAt(x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  return tx >= 0 && ty >= 0 && tx < W && ty < W && world.walk[ty * W + tx] === 1;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
interface Session { player: Player | null; badJson: number; loggingIn: boolean; ip: string; tokens: number; lastRefill: number }
type WS = ServerWebSocket<Session>;

// ---------------------------------------------------------------------------
// Abuse guards: per-connection message rate limit, per-IP connection cap,
// and login brute-force throttling (per-IP and per-account, exponential backoff).
// ---------------------------------------------------------------------------
const MSG_BUCKET_CAP = 40; // burst allowance
const MSG_REFILL_PER_SEC = 20; // steady-state messages/sec
const MAX_CONN_PER_IP = 8;
const connByIp = new Map<string, number>();

/** True = message allowed (consumes a token); false = drop (client over budget). */
function takeToken(sess: Session): boolean {
  const now = Date.now();
  const elapsed = (now - sess.lastRefill) / 1000;
  sess.lastRefill = now;
  sess.tokens = Math.min(MSG_BUCKET_CAP, sess.tokens + elapsed * MSG_REFILL_PER_SEC);
  if (sess.tokens < 1) return false;
  sess.tokens -= 1;
  return true;
}

interface ThrottleState { fails: number; lockUntil: number }
const loginThrottle = new Map<string, ThrottleState>();

/** ms remaining before `key` (ip or account name) may attempt login again; 0 = allowed now. */
function loginLockedMs(key: string): number {
  const st = loginThrottle.get(key);
  if (!st) return 0;
  return Math.max(0, st.lockUntil - Date.now());
}

/** Exponential backoff: 5 fails free, then 2^(fails-5) seconds capped at 5 min. */
function recordLoginFail(key: string): void {
  const st = loginThrottle.get(key) ?? { fails: 0, lockUntil: 0 };
  st.fails++;
  if (st.fails > 5) {
    const secs = Math.min(300, 2 ** (st.fails - 5));
    st.lockUntil = Date.now() + secs * 1000;
  }
  loginThrottle.set(key, st);
}

function clearLoginFails(key: string): void {
  loginThrottle.delete(key);
}

// Periodic sweep so the maps don't grow unbounded from one-off/expired entries.
setInterval(() => {
  const now = Date.now();
  for (const [k, st] of loginThrottle) if (st.lockUntil < now && st.fails <= 5) loginThrottle.delete(k);
}, 60000);

interface StatusHolder {
  slowUntil: number; slowPct: number; stunUntil: number;
  lastAtk: number; moving: boolean; d: number;
}

interface Player extends StatusHolder {
  id: number; ws: WS | null; name: string; cls: string;
  lvl: number; xp: number; gold: number; pts: number;
  abilityPts: number; abilities: Map<string, number>; // class ability tree: unspent points + node ranks (id -> 1..5)
  loadout: number[]; // 4 SkillDef.n values equipped to skill-bar slots 1-4
  pets: Set<string>; activePet: string | null; // owned pet ids + the one currently following (cosmetic only)
  mounts: Set<string>; activeMount: string | null; // owned mounts + preferred mount
  mounted: boolean; // session: currently riding activeMount
  sitting: boolean;
  forageCount: number; forageUntil: number;
  brewCount: number;
  bindX: number; bindY: number; // hearth bind (0,0 = unbound) // session: sitting for OOC regen
  tradeId: string | null; // active trade session
  lastTradeReqAt: number;
  duelWith: number | null; // partner entity id while dueling
  duelWins: number;
  salvageCount: number;
  lastDuelReqAt: number;
  duelInvites: Map<string, number>; // fromName -> expiry
  lastPayAt: number; // gold /pay rate limit
  str: number; dex: number; int: number;
  hp: number; mp: number; x: number; y: number;
  inv: (Item | null)[]; stash: (Item | null)[]; eq: Record<string, Item | null>;
  quests: Record<string, { n: number; done: boolean; turned: boolean }>;
  path: { x: number; y: number }[] | null;
  direct: { x: number; y: number } | null; // straight-line fallback target
  vel: { x: number; y: number } | null; // WASD velocity (normalized), overrides path/chase
  atkTarget: number | null; lootTarget: number | null; npcTarget: number | null; nextAtk: number; repathAt: number;
  skillCds: number[]; potCdUntil: number; combatUntil: number; recallCdUntil: number;
  killStreak: number; killStreakAt: number; // consecutive kills within a short window
  restedUntil: number; restAccum: number; // fountain rest XP buff
  buyback: { item: Item; price: number }[]; // last sold items this session (vendor repurchase)
  lastPingAt: number; // party map-ping rate limit
  lastWhoAt: number; // who-list rate limit
  recentHits: { n: string; a: number; t: number }[]; // last hits taken (death recap)
  lootHist: { name: string; rarity: string; icon: string; gold?: number; at: number }[]; // session loot feed
  combatLog: { src: string; dmg: number; at: number }[]; // session hits taken
  lastDaily: string; // YYYY-MM-DD of last daily login reward
  lastEmoteAt: number;
  achs: Set<string>; // unlocked achievement ids
  killCount: number; // lifetime kills (for achievements)
  goldEarned: number; // lifetime gold gained (for achievements)
  fishCount: number; // lifetime fish caught
  fishUntil: number; // fishing channel end time
  cookCount: number; // lifetime meals cooked
  cookUntil: number; // cooking channel end
  cookSlot: number; // inv slot being cooked
  title: string; // equipped achievement title
  buffUntil: number; // food buff expiry
  buffDmgp: number; buffArm: number; buffSpd: number; buffXp: number;
  session: { dealt: number; taken: number; healed: number; kills: number; deaths: number; t0: number };
  meterAt: number; // last meter push timestamp
  dead: boolean; deadAt: number; lastChat: number; dirty: boolean;
  visitedZones: string[]; // portal destinations unlocked by visiting regions
  party: Party | null; partyId: string | null; // live party + durable id (survives logout/restart)
  invites: Map<string, number>; // invitaciones pendientes (nombre → expira)
  followId: number | null; // id de un compañero de grupo a seguir (auto-mover/auto-atacar)
  followStuck: number; // ticks without progress while following a path/leader
  disconnectedAt: number | null; // set on drop; cleared on reconnect, reaped after LINGER_MS
  seen: Set<number>; // entity ids sent in the previous snapshot
}

interface Mob extends StatusHolder {
  id: number; kind: string; lvl: number; name?: string;
  x: number; y: number; hp: number; mhp: number;
  lo: number; hi: number; arm: number; xp: number; gold: () => number;
  spawn: { x: number; y: number };
  state: "idle" | "chase" | "reset";
  target: Player | null; nextAtk: number; nextScan: number; slamAt: number;
  dead: boolean; respawnAt: number; resetStuck: number;
  path: { x: number; y: number }[] | null;
  repathAt: number;
  mobStuck: number; // ticks without chase progress; then give up / reset
}

interface Npc { id: number; kind: string; name: string; x: number; y: number }
interface Loot { id: number; x: number; y: number; item: Item; exp: number }

// ---------------------------------------------------------------------------
// Árboles de habilidades por clase (defs en data.ts TREES). Nodos con rango
// 1..5, 1 punto de habilidad por subida de nivel (ver addXp), gastado vía
// {t:"ability_alloc", id}. Los activos desbloquean/suben la habilidad skillN;
// los pasivos dan bonos por rango aplicados en derive()/useSkill()/simTick().
// ---------------------------------------------------------------------------
const TREE_BY_ID: Record<string, Record<string, AbilityDef>> = Object.fromEntries(
  Object.entries(TREES).map(([cls, nodes]) => [cls, Object.fromEntries(nodes.map((a) => [a.id, a]))]),
);
/** Total points already SPENT in the tree required before a tier opens: t1=0, t2=5, t3=12. */
function tierReq(tier: number): number { return tier === 1 ? 0 : tier === 2 ? 5 : 12; }
/** Node rank (0 = not allocated). Ids are unique per class, so no cls check needed. */
function abilityRank(p: Player, id: string): number { return p.abilities.get(id) ?? 0; }
function spentPoints(p: Player): number {
  let s = 0;
  for (const r of p.abilities.values()) s += r;
  return s;
}
/** Cooldown multiplier from the class cd-reduction passives (floored at 50%). */
function cdMult(p: Player): number {
  return Math.max(0.5, 1
    - 0.03 * (abilityRank(p, "w_celeridad") + abilityRank(p, "m_celeridad"))
    - 0.02 * abilityRank(p, "oracion_rapida"));
}

let nextEntId = 1;
const players = new Map<string, Player>(); // online players by account name
const playersById = new Map<number, Player>(); // kept in sync with `players` for O(1) lookup by id
const mobs: Mob[] = [];
const mobsById = new Map<number, Mob>(); // mobs never leave the array after startup, so this is filled once
const loot = new Map<number, Loot>();
const boardCdUntil = new Map<number, number>(); // player id -> next allowed board_post time

const npcs: Npc[] = NPC_DEFS.map((n) => ({ id: nextEntId++, kind: n.kind, name: n.name, x: n.x, y: n.y }));
const elder = npcs[0], kora = npcs[1], bront = npcs[2];
const portalNpc = npcs.find((n) => n.kind === "portal")!;
const board = npcs.find((n) => n.kind === "board")!;
const stashNpc = npcs.find((n) => n.kind === "stash")!;
const petshopNpc = npcs.find((n) => n.kind === "petshop")!;

for (const s of world.spawns) {
  const st = mobStats(s.kind, s.lvl);
  mobs.push({
    id: nextEntId++, kind: s.kind, lvl: s.lvl,
    name: s.kind === "cyclops" ? "Polifemo" : s.kind === "minotaur" ? "Asterión" : s.kind === "hydra" ? "Hidra de Lerna" : undefined,
    x: s.x, y: s.y, hp: st.mhp, mhp: st.mhp, lo: st.lo, hi: st.hi, arm: st.arm,
    xp: st.xp, gold: st.gold, spawn: { x: s.x, y: s.y },
    state: "idle", target: null, nextAtk: 0, nextScan: 0, slamAt: 0,
    dead: false, respawnAt: 0, resetStuck: 0,
    path: null, repathAt: 0, mobStuck: 0,
    slowUntil: 0, slowPct: 0, stunUntil: 0, lastAtk: 0, moving: false, d: 0,
  });
}
for (const m of mobs) mobsById.set(m.id, m);

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`CREATE TABLE IF NOT EXISTS players(
  name TEXT PRIMARY KEY, pass TEXT NOT NULL, cls TEXT NOT NULL,
  data TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS parties(
  id TEXT PRIMARY KEY,
  members TEXT NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS requests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL)`);
const qGet = db.query<{ name: string; pass: string; cls: string; data: string }, [string]>(
  "SELECT name, pass, cls, data FROM players WHERE name = ?1",
);
const qInsert = db.query(
  "INSERT INTO players(name, pass, cls, data, created, seen) VALUES(?1, ?2, ?3, ?4, ?5, ?5)",
);
const qSave = db.query("UPDATE players SET data = ?2, seen = ?3 WHERE name = ?1");
const qBoardInsert = db.query("INSERT INTO requests(author, text, created) VALUES(?1, ?2, ?3)");
const qBoardList = db.query<{ id: number; author: string; text: string; created: number }, []>(
  "SELECT id, author, text, created FROM requests ORDER BY id DESC LIMIT 50",
);
const qBoardFindByAuthor = db.query<{ id: number }, [string]>(
  "SELECT id FROM requests WHERE author = ?1 LIMIT 1",
);
const qBoardDelete = db.query("DELETE FROM requests WHERE id = ?1");
const qBoardUpdate = db.query("UPDATE requests SET text = ?2 WHERE id = ?1");
const BOARD_MODS = new Set(["cansao", "cansao2"]);
function isBoardMod(p: Player): boolean {
  return BOARD_MODS.has(p.name.toLowerCase());
}

function serialize(p: Player): string {
  return JSON.stringify({
    lvl: p.lvl, xp: p.xp, gold: p.gold, pts: p.pts,
    str: p.str, dex: p.dex, int: p.int, hp: p.hp, mp: p.mp,
    x: p.x, y: p.y, inv: p.inv, stash: p.stash, eq: p.eq, quests: p.quests,
    partyId: p.partyId,
    visitedZones: p.visitedZones,
    abilityPts: p.abilityPts, abilities: Object.fromEntries(p.abilities), loadout: p.loadout,
    pets: [...p.pets], activePet: p.activePet,
    mounts: [...p.mounts], activeMount: p.activeMount,
    lastDaily: p.lastDaily || "",
    achs: [...p.achs],
    killCount: p.killCount,
    goldEarned: p.goldEarned,
    fishCount: p.fishCount,
    cookCount: p.cookCount,
    forageCount: p.forageCount,
    brewCount: p.brewCount,
    duelWins: p.duelWins,
    salvageCount: p.salvageCount,
    bindX: p.bindX, bindY: p.bindY,
    title: p.title || "",
  });
}

function savePlayer(p: Player): void {
  qSave.run(p.name, serialize(p), Date.now());
  p.dirty = false;
}

function saveAll(): void {
  for (const p of players.values()) savePlayer(p);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function strMsg(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Parse an inventory/stash slot index from a client message. */
function readSlot(msg: { slot?: unknown }, size = INV_SIZE): number | null {
  const slot = num(msg.slot);
  if (slot == null || !Number.isInteger(slot) || slot < 0 || slot >= size) return null;
  return slot;
}

function send(ws: WS | null, msg: unknown): void {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function toast(p: Player, msg: string): void {
  send(p.ws, { t: "toast", msg });
}

function toastQuestDone(p: Player, name: string): void {
  toast(p, `Misión completada: ${name} — volvé con Nikandros`);
}

function waitToast(p: Player, lastAt: number, ms: number, now: number, msg = "Esperá un momento…"): boolean {
  if (now - lastAt < ms) { toast(p, msg); return true; }
  return false;
}

function stillDigesting(p: Player, now: number): boolean {
  if (now < p.potCdUntil) { toast(p, "Aún estás digiriendo"); return true; }
  return false;
}

function invFull(p: Player, detail?: string): void {
  toast(p, detail ? `Inventario lleno — ${detail}` : "Inventario lleno");
}

function consumeInvSlot(p: Player, slot: number): void {
  const it = p.inv[slot];
  if (!it) return;
  it.qty = (it.qty ?? 1) - 1;
  if (it.qty <= 0) p.inv[slot] = null;
}

function applyFoodBuff(p: Player, now: number, def: { dur: number; dmgp?: number; arm?: number; spd?: number; xp?: number }): string {
  p.buffUntil = now + def.dur;
  p.buffDmgp = def.dmgp || 0;
  p.buffArm = def.arm || 0;
  p.buffSpd = def.spd || 0;
  p.buffXp = def.xp || 0;
  const bits: string[] = [];
  if (def.dmgp) bits.push(`+${def.dmgp}% daño`);
  if (def.arm) bits.push(`+${def.arm} armadura`);
  if (def.spd) bits.push(`+${def.spd}% velocidad`);
  if (def.xp) bits.push(`+${def.xp}% XP`);
  return bits.join(", ");
}

function tooFar(p: Player, q: { x: number; y: number }, range: number): boolean {
  if (dist(p.x, p.y, q.x, q.y) > range) { toast(p, "Está demasiado lejos"); return true; }
  return false;
}

function pushLootLog(p: Player, entry: { name: string; rarity: string; icon: string; gold?: number }): void {
  p.lootHist.unshift({ ...entry, at: Date.now() });
  if (p.lootHist.length > 30) p.lootHist.length = 30;
  send(p.ws, { t: "lootlog", entries: p.lootHist });
}

function sendLootLog(p: Player): void {
  send(p.ws, { t: "lootlog", entries: p.lootHist });
}

function sendCombatLog(p: Player): void {
  send(p.ws, { t: "combatlog", entries: p.combatLog });
}

function sendMeter(p: Player, force = false): void {
  const now = Date.now();
  if (!force && now - p.meterAt < 900) return;
  p.meterAt = now;
  send(p.ws, { t: "meter", ...p.session });
}

function sendAchs(p: Player): void {
  send(p.ws, {
    t: "achs",
    unlocked: [...p.achs],
    defs: Object.entries(ACHIEVEMENTS).map(([id, d]) => ({ id, name: d.name, desc: d.desc, gold: d.gold })),
    killCount: p.killCount,
    goldEarned: p.goldEarned,
    title: p.title || "",
  });
}

function zoneNameAt(x: number, y: number): string {
  const zx = Math.floor(x), zy = Math.floor(y);
  if (inTown(x, y)) return "Helike";
  for (const z of ZONES) if (inRect(zx, zy, z)) return z.name;
  return "Ermos";
}

function sendWho(p: Player): void {
  const list = [];
  for (const q of players.values()) {
    if (!q.ws || q.ws.readyState !== 1) continue;
    list.push({
      id: q.id, name: q.name, cls: q.cls, lvl: q.lvl,
      zone: zoneNameAt(q.x, q.y),
      bot: BOT_SQUAD.has(q.name) ? 1 : 0,
    });
  }
  list.sort((a, b) => a.lvl !== b.lvl ? b.lvl - a.lvl : a.name.localeCompare(b.name));
  send(p.ws, { t: "who", players: list });
}

function grantAch(p: Player, id: string): void {
  if (!ACHIEVEMENTS[id] || p.achs.has(id)) return;
  if (BOT_SQUAD.has(p.name)) return;
  p.achs.add(id);
  const def = ACHIEVEMENTS[id];
  p.gold += def.gold;
  p.goldEarned += def.gold;
  p.dirty = true;
  toast(p, `Logro: ${def.name} (+${def.gold} oro)`);
  pushLootLog(p, { name: `Logro: ${def.name}`, rarity: "rare", icon: "coin", gold: def.gold });
  sendAchs(p);
  sendYou(p);
}

/** Unlock count-based achievements for a profession counter. */
function grantCountAchs(p: Player, count: number, ...tiers: [number, string][]): void {
  for (const [n, id] of tiers) if (count >= n) grantAch(p, id);
}

/** Mark dirty and grant profession-count achievements. */
function noteProf(p: Player, count: number, ...tiers: [number, string][]): void {
  p.dirty = true;
  grantCountAchs(p, count, ...tiers);
}

function noteGold(p: Player, amount: number): void {
  if (amount <= 0) return;
  p.goldEarned += amount;
  if (p.goldEarned >= 1000) grantAch(p, "gold_1k");
  if (p.goldEarned >= 10000) grantAch(p, "gold_10k");
}

function checkProgressAchs(p: Player): void {
  if (p.lvl >= 5) grantAch(p, "lvl_5");
  if (p.lvl >= 10) grantAch(p, "lvl_10");
  if (p.lvl >= 15) grantAch(p, "lvl_15");
  if (p.lvl >= 20) grantAch(p, "lvl_20");
  const turned = QUEST_ORDER.filter((qid) => p.quests[qid]?.turned).length;
  if (turned >= 1) grantAch(p, "quest_1");
  if (turned >= 6) grantAch(p, "quest_6");
  if (turned >= QUEST_ORDER.length) grantAch(p, "quest_all");
  const portals = Object.keys(PORTAL_WAYPOINTS);
  if (portals.length && portals.every((id) => p.visitedZones.includes(id))) grantAch(p, "portals");
  if (p.pets.size > 0) grantAch(p, "pet_1");
  if (p.party) grantAch(p, "party_1");
}

/** Broadcast to every online player whose AOI covers (x,y). */
function bcastAt(x: number, y: number, msg: unknown): void {
  const s = JSON.stringify(msg);
  for (const p of players.values()) {
    const dx = p.x - x, dy = p.y - y;
    if (dx * dx + dy * dy <= AOI2 && p.ws && p.ws.readyState === 1) p.ws.send(s);
  }
}

function sysChat(text: string): void {
  const s = JSON.stringify({ t: "chat", text, sys: 1 });
  for (const p of players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function inTown(x: number, y: number): boolean {
  return inRect(x, y, TOWN_RECT);
}

// ---------------------------------------------------------------------------
// Derived player stats (contract formulas)
// ---------------------------------------------------------------------------
interface Derived {
  str: number; dex: number; int: number; arm: number;
  mhp: number; mmp: number; lo: number; hi: number; crit: number;
  dmgp: number; spd: number;
}

function derive(p: Player): Derived {
  let str = p.str, dex = p.dex, int_ = p.int;
  let arm = 0, dmgp = 0, crit = 0, hpB = 0, mpB = 0;
  for (const slot of EQUIP_SLOTS) {
    const it = p.eq[slot];
    if (!it) continue;
    arm += it.arm || 0;
    if (it.mods) {
      str += it.mods.str || 0; dex += it.mods.dex || 0; int_ += it.mods.int || 0;
      arm += it.mods.arm || 0; dmgp += it.mods.dmgp || 0; crit += it.mods.crit || 0;
      hpB += it.mods.hp || 0; mpB += it.mods.mp || 0;
    }
  }
  // Pasivos del árbol (por rango; ids únicos por clase, ranks 0 si no es tu clase).
  str += abilityRank(p, "w_fuerza");
  dex += abilityRank(p, "h_dex");
  int_ += abilityRank(p, "m_int");
  arm += 2 * (abilityRank(p, "w_piel") + abilityRank(p, "h_evasion") + abilityRank(p, "escudo"));
  crit += abilityRank(p, "w_crit") + abilityRank(p, "h_crit") + abilityRank(p, "m_crit") + abilityRank(p, "resistencia");
  hpB += 8 * (abilityRank(p, "w_vigor") + abilityRank(p, "h_aliento")) + 6 * abilityRank(p, "vital");
  mpB += 6 * abilityRank(p, "m_mana") + 4 * abilityRank(p, "vital");
  // Equipped pet's passive perk (gold bonus is applied separately in rollDrops).
  const pet = p.activePet ? PET_DEFS[p.activePet] : null;
  if (pet?.stat === "arm") arm += pet.amount;
  if (pet?.stat === "crit") crit += pet.amount;
  if (pet?.stat === "hp") hpB += pet.amount;
  if (pet?.stat === "mp") mpB += pet.amount;
  if (pet?.stat === "dmgp") dmgp += pet.amount;
  const petSpdPct = pet?.stat === "spd" ? pet.amount : 0;
  // Active cooked-food buff (session-only).
  if (Date.now() < p.buffUntil) {
    dmgp += p.buffDmgp || 0;
    arm += p.buffArm || 0;
  }
  const w = p.eq.weapon;
  const [lo0, hi0] = w?.dmg ?? [1, 3];
  const [stat, mult] = WEAPON_SCALING[w?.icon ?? "sword"] ?? ["str", 0.5];
  const sv = stat === "str" ? str : stat === "dex" ? dex : int_;
  const bonus = sv * mult;
  const dm = 1 + dmgp / 100;
  return {
    str, dex, int: int_, arm,
    mhp: 40 + 12 * p.lvl + 3 * str + hpB,
    mmp: 20 + 4 * p.lvl + 3 * int_ + mpB,
    lo: (lo0 + bonus) * dm, hi: (hi0 + bonus) * dm,
    crit: 5 + 0.15 * dex + crit,
    dmgp,
    spd: PLAYER_SPD * (1 + 0.01 * abilityRank(p, "h_veloz") + petSpdPct / 100 + ((Date.now() < p.buffUntil ? p.buffSpd : 0) / 100)
      + (p.mounted && p.activeMount && MOUNT_DEFS[p.activeMount] ? MOUNT_DEFS[p.activeMount].spd / 100 : 0)),
  };
}

function xpNext(lvl: number): number {
  return Math.round(90 * Math.pow(lvl, 1.55));
}

function weaponRange(p: Player): number {
  const icon = p.eq.weapon?.icon;
  return icon === "bow" || icon === "staff" ? RANGED_RANGE : MELEE_RANGE;
}

function sendYou(p: Player): void {
  const d = derive(p);
  p.hp = Math.min(p.hp, d.mhp);
  p.mp = Math.min(p.mp, d.mmp);
  send(p.ws, {
    t: "you",
    lvl: p.lvl, xp: p.xp, xpNext: xpNext(p.lvl), gold: p.gold, pts: p.pts,
    str: d.str, dex: d.dex, int: d.int,
    hp: Math.round(p.hp), mhp: d.mhp, mp: Math.round(p.mp), mmp: d.mmp,
    arm: d.arm, dmg: [Math.round(d.lo), Math.round(d.hi)],
    crit: Math.round(d.crit * 10) / 10, spd: Math.round(d.spd * 100) / 100,
    inv: p.inv, eq: p.eq, quests: p.quests, visitedZones: p.visitedZones,
    abilityPts: p.abilityPts, abilities: Object.fromEntries(p.abilities), loadout: p.loadout,
    pets: [...p.pets], activePet: p.activePet,
    mounts: [...p.mounts], activeMount: p.activeMount, mounted: Boolean(p.mounted), sitting: Boolean(p.sitting),
    bind: (p.bindX || p.bindY) ? { x: Math.round(p.bindX * 10) / 10, y: Math.round(p.bindY * 10) / 10 } : null,
    rested: p.restedUntil > Date.now() ? Math.ceil((p.restedUntil - Date.now()) / 1000) : 0,
    title: p.title || "",
    fishCount: p.fishCount, cookCount: p.cookCount, forageCount: p.forageCount, brewCount: p.brewCount,
    duelWins: p.duelWins, salvageCount: p.salvageCount, duelWith: p.duelWith,
    buff: p.buffUntil > Date.now() ? {
      left: Math.ceil((p.buffUntil - Date.now()) / 1000),
      dmgp: p.buffDmgp, arm: p.buffArm, spd: p.buffSpd, xp: p.buffXp,
    } : null,
  });
  p.dirty = true;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
/** Add item to a slot array (stacks potions/quest items to 10). False = full. */
function addToSlots(arr: (Item | null)[], item: Item): boolean {
  if (item.slot === "potion" || item.slot === "quest" || item.slot === "fish" || item.slot === "food" || item.slot === "herb" || item.slot === "elixir") {
    for (const it of arr) {
      if (it && it.base === item.base && (it.qty ?? 1) < 10) {
        it.qty = (it.qty ?? 1) + (item.qty ?? 1);
        return true;
      }
    }
  }
  const free = arr.indexOf(null);
  if (free < 0) return false;
  arr[free] = item;
  return true;
}

/** Add item to inventory (stacks potions/quest items to 10). False = full. */
function invAdd(p: Player, item: Item): boolean {
  return addToSlots(p.inv, item);
}

function hornCount(p: Player): number {
  let n = 0;
  for (const it of p.inv) if (it && it.base === "horn") n += it.qty ?? 1;
  return n;
}

/** Remove `n` units of quest item `base` from inventory. */
function removeQuestItems(p: Player, base: string, n: number): void {
  for (let i = 0; i < p.inv.length && n > 0; i++) {
    const it = p.inv[i];
    if (!it || it.base !== base) continue;
    const take = Math.min(it.qty ?? 1, n);
    n -= take;
    it.qty = (it.qty ?? 1) - take;
    if (it.qty <= 0) p.inv[i] = null;
  }
}

/** Sync collect-quest progress (q2) with inventory contents. */
function updateCollect(p: Player): void {
  const q = p.quests.q2;
  if (!q || q.turned) return;
  const def = QUESTS.q2;
  const n = Math.min(def.count, hornCount(p));
  if (n !== q.n) {
    q.n = n;
    const wasDone = q.done;
    q.done = n >= def.count;
    if (q.done && !wasDone) toastQuestDone(p, def.name);
  }
}

/** Re-sync collect-quest counters from inventory (e.g. after login). */
function syncCollectQuests(p: Player): void {
  for (const qid of QUEST_ORDER) {
    if (QUESTS[qid].kind === "collect") updateCollect(p);
  }
}

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------
function dropItem(x: number, y: number, item: Item): void {
  const jx = x + (Math.random() - 0.5) * 1.4;
  const jy = y + (Math.random() - 0.5) * 1.4;
  loot.set(item.id, {
    id: item.id,
    x: walkableAt(jx, jy) ? jx : x,
    y: walkableAt(jx, jy) ? jy : y,
    item, exp: Date.now() + LOOT_TTL,
  });
}

// Boss-only guaranteed rare drops: how many, at what item tier.
const BOSS_LOOT: Record<string, { count: number; tier: number }> = {
  cyclops: { count: 2, tier: 4 },
  minotaur: { count: 3, tier: 4 },
  hydra: { count: 3, tier: 5 },
};

// Boss-kill chat announcements (cyclops also unlocks a portal — handled separately in mobDie).
const BOSS_KILL_MSG: Record<string, (killer: string) => string> = {
  cyclops: (k) => `¡${k} ha derrotado a Polifemo, el terror del este!`,
  minotaur: (k) => `¡${k} ha derrotado a Asterión en el laberinto de los Asfódelos!`,
  hydra: (k) => `¡${k} ha decapitado a la Hidra de Lerna en lo hondo del pantano!`,
};

const BOSS_ACH: Record<string, string> = {
  cyclops: "boss_cyclops",
  minotaur: "boss_minotaur",
  hydra: "boss_hydra",
};

const BOSS_PORTAL: Record<string, string> = {
  cyclops: "asfodelos",
  hydra: "hidra",
};

function announceBossKill(killer: Player, kind: string): void {
  const msg = BOSS_KILL_MSG[kind];
  if (msg && !BOT_SQUAD.has(killer.name)) sysChat(msg(killer.name));
}

function rewardBossKill(killer: Player, sharers: Player[], kind: string): void {
  announceBossKill(killer, kind);
  const portal = BOSS_PORTAL[kind];
  if (!portal) return;
  unlockPortal(killer, portal, true);
  for (const q of sharers) unlockPortal(q, portal, true);
}

function rollDrops(m: Mob, killer: Player): void {
  const petDef = killer.activePet ? PET_DEFS[killer.activePet] : null;
  const petGoldPct = petDef?.stat === "gold" ? petDef.amount : 0;
  const goldGain = Math.round(m.gold() * (1 + petGoldPct / 100));
  killer.gold += goldGain;
  noteGold(killer, goldGain);
  if (goldGain > 0) pushLootLog(killer, { name: "Oro", rarity: "common", icon: "coin", gold: goldGain });
  // Equipped pet occasionally "fetches" a little extra gold (toast rate kept low).
  if (petDef && Math.random() < 0.08) {
    const bonus = 2 + Math.floor(Math.random() * (3 + Math.max(1, Math.floor(m.lvl / 2))));
    killer.gold += bonus;
    noteGold(killer, bonus);
    toast(killer, `Tu ${petDef.name} encontró ${bonus} de oro`);
  }
  const boss = BOSS_LOOT[m.kind];
  if (boss) {
    for (let i = 0; i < boss.count; i++)
      dropItem(m.x, m.y, rollItem(pickSlot(EQUIP_SLOTS), boss.tier, "rare"));
    return;
  }
  // Satyr Horn: 60% while q2 is active and the killer still needs horns.
  const q2 = killer.quests.q2;
  if (m.kind === "satyr" && q2 && !q2.turned && hornCount(killer) < QUESTS.q2.count && Math.random() < 0.6)
    dropItem(m.x, m.y, makeQuestItem("horn"));
  if (Math.random() >= 0.35) return;
  const tier = m.lvl >= 21 ? 5 : m.lvl >= 13 ? 4 : m.lvl >= 9 ? 3 : m.lvl >= 5 ? 2 : 1;
  if (Math.random() < 0.25) {
    const key = (m.lvl >= 9 ? ["hp3", "mp3"] : ["hp1", "mp1"])[Math.random() < 0.5 ? 0 : 1];
    dropItem(m.x, m.y, makePotion(key));
  } else {
    const slots = ["weapon", "weapon", "armor", "helm", "ring"] as const;
    dropItem(m.x, m.y, rollItem(pickSlot(slots), tier, rollRarity()));
  }
}

// ---------------------------------------------------------------------------
// XP / leveling / death
// ---------------------------------------------------------------------------
function addXp(p: Player, amount: number): void {
  if (p.lvl >= LEVEL_CAP) return;
  if (Date.now() < p.restedUntil) amount = Math.max(1, Math.round(amount * 1.2));
  if (Date.now() < p.buffUntil && p.buffXp > 0) amount = Math.max(1, Math.round(amount * (1 + p.buffXp / 100)));
  p.xp += amount;
  let leveled = false;
  while (p.lvl < LEVEL_CAP && p.xp >= xpNext(p.lvl)) {
    p.xp -= xpNext(p.lvl);
    p.lvl++;
    p.pts += 3;
    p.abilityPts += 1;
    leveled = true;
    if (!BOT_SQUAD.has(p.name)) sysChat(`¡${p.name} subió al nivel ${p.lvl}!`);
    bcastAt(p.x, p.y, { t: "fx", k: "level", i: p.id });
  }
  if (leveled) {
    const d = derive(p);
    p.hp = d.mhp;
    p.mp = d.mmp;
    if (p.party) partyBcast(p.party); // refresca niveles en los marcos del grupo
    checkProgressAchs(p);
  }
  if (p.lvl >= LEVEL_CAP) p.xp = 0;
}

function noteKillStreak(p: Player): void {
  const now = Date.now();
  if (now - p.killStreakAt > 8000) p.killStreak = 0;
  p.killStreak++;
  p.killStreakAt = now;
  send(p.ws, { t: "streak", n: p.killStreak });
  const bonus = p.killStreak === 5 ? 15 : p.killStreak === 10 ? 40 : p.killStreak === 20 ? 100 : 0;
  if (bonus) {
    p.gold += bonus;
    noteGold(p, bonus);
    toast(p, `¡Racha ×${p.killStreak}! +${bonus} oro`);
    sendYou(p);
  }
  if (p.killStreak >= 10) grantAch(p, "streak_10");
}

function mobDie(m: Mob, killer: Player): void {
  m.dead = true;
  m.target = null;
  m.respawnAt = Date.now() + (BOSS_KINDS.has(m.kind) ? 180000 : 20000);
  // XP compartida: miembros del grupo vivos y conectados a ≤PARTY_XP_RANGE casillas
  // se reparten la XP con un bono del 15% por miembro extra. Oro solo al que mata.
  const sharers = killer.party
    ? killer.party.members.filter(q => q.ws && !q.dead && dist(q.x, q.y, m.x, m.y) <= PARTY_XP_RANGE)
    : [];
  if (!sharers.some((q) => q.id === killer.id)) sharers.push(killer);
  const bonus = 1 + 0.15 * (sharers.length - 1);
  for (const q of sharers) {
    // Reducción por sobre-nivel: -20% por nivel más allá de 4 por encima, mín. 10%.
    const gap = q.lvl - m.lvl;
    const mult = gap > 4 ? Math.max(0.1, 1 - 0.2 * (gap - 4)) : 1;
    addXp(q, Math.max(1, Math.round((m.xp * mult * bonus) / sharers.length)));
  }
  noteKillStreak(killer);
  killer.killCount++;
  killer.session.kills++;
  grantAch(killer, "first_blood");
  if (killer.killCount >= 50) grantAch(killer, "kills_50");
  if (killer.killCount >= 200) grantAch(killer, "kills_200");
  if (killer.killCount >= 500) grantAch(killer, "kills_500");
  const bossAch = BOSS_ACH[m.kind];
  if (bossAch) grantAch(killer, bossAch);
  sendMeter(killer);
  rollDrops(m, killer);
  // Crédito de misiones de caza para todos los miembros cercanos.
  for (const member of sharers) {
    for (const qid of QUEST_ORDER) {
      const def = QUESTS[qid];
      const q = member.quests[qid];
      if (def.kind !== "kill" || def.target !== m.kind || !q || q.turned || q.done) continue;
      q.n++;
      if (q.n >= def.count) {
        q.done = true;
        toastQuestDone(member, def.name);
      }
    }
    sendYou(member);
  }
  rewardBossKill(killer, sharers, m.kind);
}

function noteHitTaken(p: Player, src: string, dmg: number): void {
  const at = Date.now();
  p.recentHits.push({ n: src, a: dmg, t: at });
  if (p.recentHits.length > 8) p.recentHits.splice(0, p.recentHits.length - 8);
  p.combatLog.unshift({ src, dmg, at });
  if (p.combatLog.length > 40) p.combatLog.length = 40;
  send(p.ws, { t: "combatlog", entries: p.combatLog });
}

function playerDie(p: Player): void {
  p.dead = true;
  p.deadAt = Date.now();
  p.killStreak = 0;
  if (p.tradeId) cancelTrade(p, "Intercambio cancelado");
  if (p.duelWith) cancelDuel(p, "Duelo cancelado");
  p.killStreakAt = 0;
  p.session.deaths++;
  sendMeter(p, true);
  send(p.ws, { t: "streak", n: 0 });
  p.hp = 0;
  clearMobility(p);
  stopChannels(p);
  p.moving = false;
  dropMountSit(p);
  const recap = p.recentHits.slice(-5).map((h) => ({ n: h.n, a: h.a }));
  send(p.ws, { t: "dead", reviveAt: p.deadAt + REVIVE_MS, recap });
}

// Shared by the manual "Resucitar" button and the 30s auto-revive tick.
function revivePlayer(p: Player): void {
  p.dead = false;
  p.deadAt = 0;
  p.recentHits = [];
  p.x = TOWN.x + 0.5 + (Math.random() - 0.5) * 2;
  p.y = TOWN.y + 3.5;
  const d = derive(p);
  p.hp = d.mhp;
  p.mp = d.mmp;
  p.gold = Math.floor(p.gold * 0.9);
  p.combatUntil = 0;
  p.slowUntil = 0;
  p.stunUntil = 0;
}

// ---------------------------------------------------------------------------
// Grupos (parties): XP compartida entre miembros cercanos
// ---------------------------------------------------------------------------
const PARTY_MAX = 10;
const PARTY_XP_RANGE = 20; // casillas para compartir XP y crédito de misión

interface PartyMemberMeta { name: string; cls: string; lvl: number }
interface Party {
  id: string;
  members: Player[];          // currently loaded (online or linger) Player objects
  roster: PartyMemberMeta[];  // durable roster including offline members
}

const liveParties = new Map<string, Party>();

const qPartyGet = db.query<{ id: string; members: string }, [string]>(
  "SELECT id, members FROM parties WHERE id = ?1",
);
const qPartyUpsert = db.query(
  "INSERT INTO parties(id, members) VALUES(?1, ?2) ON CONFLICT(id) DO UPDATE SET members = excluded.members",
);
const qPartyDel = db.query("DELETE FROM parties WHERE id = ?1");

function newPartyId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function playerById(id: number): Player | null {
  const q = playersById.get(id);
  return q && q.ws ? q : null;
}

function syncRosterFromOnline(pt: Party): void {
  for (const m of pt.members) {
    const row = pt.roster.find(r => r.name === m.name);
    if (row) { row.cls = m.cls; row.lvl = m.lvl; }
    else pt.roster.push({ name: m.name, cls: m.cls, lvl: m.lvl });
  }
}

function persistParty(pt: Party): void {
  syncRosterFromOnline(pt);
  qPartyUpsert.run(pt.id, JSON.stringify(pt.roster));
}

function deletePartyRow(id: string): void {
  qPartyDel.run(id);
  liveParties.delete(id);
}


/** Parse a durable roster JSON blob, keeping only entries whose name passes `nameOk`. */
function parseRosterJson(raw: string, nameOk: (name: string) => boolean): PartyMemberMeta[] {
  const roster: PartyMemberMeta[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const x of parsed) {
        if (!x || typeof x !== "object") continue;
        const name = typeof (x as { name?: unknown }).name === "string" ? (x as { name: string }).name : "";
        if (!nameOk(name)) continue;
        const cls = typeof (x as { cls?: unknown }).cls === "string" ? (x as { cls: string }).cls : "warrior";
        const lvl = clampInt((x as { lvl?: unknown }).lvl, 1, LEVEL_CAP, 1);
        roster.push({ name, cls, lvl });
      }
    }
  } catch { /* ignore */ }
  return roster;
}

function findBotSquadParty(): Party | null {
  let best: Party | null = null;
  let bestN = 0;
  for (const pt of liveParties.values()) {
    const n = pt.roster.filter(r => BOT_SQUAD.has(r.name)).length;
    if (n > bestN) { best = pt; bestN = n; }
  }
  if (best) return best;
  const rows = db.query("SELECT id, members FROM parties").all() as { id: string; members: string }[];
  for (const row of rows) {
    const roster = parseRosterJson(row.members, (name) => BOT_SQUAD.has(name));
    if (roster.length > bestN) {
      const pt = getOrLoadParty(row.id);
      if (pt) { best = pt; bestN = roster.length; }
    }
  }
  return best;
}

/** Tier-1 common kit per class (weapon matched via CLASS_WEAPON). */
function ensureBotLoadout(p: Player): void {
  if (!BOT_SQUAD.has(p.name)) return;
  let changed = false;
  const wtype = CLASS_WEAPON[p.cls];
  if (!p.eq.weapon) { p.eq.weapon = rollItem("weapon", 1, "common", wtype); changed = true; }
  if (!p.eq.armor) { p.eq.armor = rollItem("armor", 1, "common"); changed = true; }
  if (!p.eq.helm) { p.eq.helm = rollItem("helm", 1, "common"); changed = true; }
  if (!p.eq.ring) { p.eq.ring = rollItem("ring", 1, "magic"); changed = true; }
  if (!changed) return;
  const d = derive(p);
  p.hp = Math.min(p.hp, d.mhp);
  p.mp = Math.min(p.mp, d.mmp);
  p.dirty = true;
  savePlayer(p);
}

/** Merge all online companion bots into one durable party. */
function ensureBotSquadParty(p: Player): void {
  if (!BOT_SQUAD.has(p.name)) return;

  let pt = findBotSquadParty();
  if (p.party) {
    const squadN = p.party.roster.filter(r => BOT_SQUAD.has(r.name)).length;
    if (!pt || squadN >= (pt.roster.filter(r => BOT_SQUAD.has(r.name)).length))
      pt = p.party;
  }

  if (!pt) {
    pt = { id: newPartyId(), members: [], roster: [] };
    attachPlayerToParty(p, pt);
    persistParty(pt);
    partyBcast(pt);
  } else {
    if (p.party && p.party.id !== pt.id) partyLeave(p, false);
    if (!pt.roster.some(r => r.name === p.name) && pt.roster.length < PARTY_MAX)
      attachPlayerToParty(p, pt);
    else if (!p.party || p.party.id !== pt.id)
      attachPlayerToParty(p, pt);
  }

  for (const other of players.values()) {
    if (!BOT_SQUAD.has(other.name) || other.name === p.name) continue;
    if (pt.roster.some(r => r.name === other.name)) {
      if (!other.party || other.party.id !== pt.id) attachPlayerToParty(other, pt);
      continue;
    }
    if (pt.roster.length >= PARTY_MAX) break;
    if (other.party && other.party.id !== pt.id) partyLeave(other, false);
    attachPlayerToParty(other, pt);
    other.dirty = true;
    savePlayer(other);
  }

  persistParty(pt);
  partyBcast(pt);
}

function partyWireRoster(pt: Party): { id: number; name: string; cls: string; lvl: number; online: boolean }[] {
  syncRosterFromOnline(pt);
  return pt.roster.map(r => {
    const live = pt.members.find(m => m.name === r.name);
    if (live) return { id: live.id, name: live.name, cls: live.cls, lvl: live.lvl, online: Boolean(live.ws) };
    return { id: 0, name: r.name, cls: r.cls, lvl: r.lvl, online: false };
  });
}


/** Whitelisted human invited a companion bot → join that bot's durable squad party. */
function partyJoinHumanToBotSquad(human: Player, bot: Player): boolean {
  if (!ALLOWED_PARTY_HUMANS.has(human.name.toLowerCase())) return false;
  if (!BOT_SQUAD.has(bot.name)) return false;

  let pt = bot.party || (bot.partyId ? getOrLoadParty(bot.partyId) : null);
  if (!pt) {
    ensureBotSquadParty(bot);
    pt = bot.party || (bot.partyId ? getOrLoadParty(bot.partyId) : null);
  }
  if (!pt) {
    toast(human, "Los compañeros aún no tienen grupo");
    return true;
  }

  if (human.party?.id === pt.id || (human.partyId === pt.id && pt.roster.some(r => r.name === human.name))) {
    if (!human.party) attachPlayerToParty(human, pt);
    partyBcast(pt);
    toast(human, "Ya estás en el grupo de compañeros");
    return true;
  }

  if (human.party || human.partyId) partyLeave(human, false);

  if (pt.roster.length >= PARTY_MAX) {
    toastPartyFull(human);
    return true;
  }

  attachPlayerToParty(human, pt);
  human.dirty = true;
  savePlayer(human);
  persistParty(pt);
  partyBcast(pt);
  for (const m of pt.members) if (m !== human && m.ws) toast(m, `${human.name} se unió al grupo`);
  toast(human, `Te uniste al grupo de ${bot.name}`);
  for (const m of pt.members) if (BOT_SQUAD.has(m.name)) m.invites.delete(human.name);
  return true;
}

function partyBcast(pt: Party): void {
  const roster = partyWireRoster(pt);
  for (const m of pt.members) if (m.ws) send(m.ws, { t: "party", members: roster });
}

function clearFollowIfInvalid(pl: Player): void {
  if (pl.followId == null) return;
  // Only follow currently-loaded, online party mates.
  if (pl.party && pl.party.members.some(m => m.id === pl.followId && m.ws)) return;
  pl.followId = null;
  if (pl.ws) send(pl.ws, { t: "follow_state", id: null });
}

/** Detach a loaded player from the live party object without clearing durable membership. */
function partyUnload(p: Player): void {
  const pt = p.party;
  if (!pt) return;
  const idx = pt.members.indexOf(p);
  if (idx >= 0) pt.members.splice(idx, 1);
  p.party = null;
  persistParty(pt);
  partyBcast(pt);
  clearFollowIfInvalid(p);
  for (const m of pt.members) clearFollowIfInvalid(m);
}

function attachPlayerToParty(p: Player, pt: Party): void {
  if (!pt.members.includes(p)) pt.members.push(p);
  p.party = pt;
  p.partyId = pt.id;
  const row = pt.roster.find(r => r.name === p.name);
  if (row) { row.cls = p.cls; row.lvl = p.lvl; }
  else pt.roster.push({ name: p.name, cls: p.cls, lvl: p.lvl });
  liveParties.set(pt.id, pt);
  grantAch(p, "party_1");
}

function getOrLoadParty(id: string): Party | null {
  const live = liveParties.get(id);
  if (live) return live;
  const row = qPartyGet.get(id);
  if (!row) return null;
  const roster = parseRosterJson(row.members, (name) => /^[A-Za-z0-9_]{3,16}$/.test(name));
  if (roster.length === 0) {
    deletePartyRow(id);
    return null;
  }
  const pt: Party = { id, members: [], roster };
  liveParties.set(id, pt);
  return pt;
}

/** Restore durable party after login/load. No-op if partyId missing/invalid. */
function restoreParty(p: Player): void {
  if (!p.partyId) return;
  const pt = getOrLoadParty(p.partyId);
  if (!pt || !pt.roster.some(r => r.name === p.name)) {
    p.partyId = null;
    p.party = null;
    p.dirty = true;
    return;
  }
  // Pull in any other already-online roster mates that somehow lack the link.
  for (const r of pt.roster) {
    const other = players.get(r.name);
    if (other && other !== p && !pt.members.includes(other)) {
      other.party = pt;
      other.partyId = pt.id;
    }
  }
  attachPlayerToParty(p, pt);
  persistParty(pt);
}

function partyLeave(p: Player, notify = true): void {
  // Explicit leave only — clears durable membership.
  const pt = p.party || (p.partyId ? getOrLoadParty(p.partyId) : null);
  if (!pt) {
    p.party = null;
    p.partyId = null;
    if (p.ws) send(p.ws, { t: "party", members: [] });
    return;
  }
  const originalOnline = [...pt.members];
  const idxLive = pt.members.indexOf(p);
  if (idxLive >= 0) pt.members.splice(idxLive, 1);
  pt.roster = pt.roster.filter(r => r.name !== p.name);
  p.party = null;
  p.partyId = null;
  p.dirty = true;
  savePlayer(p);
  if (p.ws) send(p.ws, { t: "party", members: [] });
  clearFollowIfInvalid(p);

  if (pt.roster.length <= 1) {
    // Disband leftover solo member.
    for (const m of [...pt.members]) {
      m.party = null;
      m.partyId = null;
      m.dirty = true;
      savePlayer(m);
      if (m.ws) {
        send(m.ws, { t: "party", members: [] });
        if (notify) toast(m, "El grupo se ha disuelto");
      }
      clearFollowIfInvalid(m);
    }
    // Also clear durable id for the remaining offline roster name, if any.
    for (const r of pt.roster) {
      const offline = players.get(r.name);
      if (offline) {
        offline.party = null;
        offline.partyId = null;
        offline.dirty = true;
        savePlayer(offline);
      } else {
        // Patch saved blob for offline account so restart doesn't revive a solo party.
        const row = qGet.get(r.name);
        if (row) {
          try {
            const data = JSON.parse(row.data) as Record<string, unknown>;
            data.partyId = null;
            qSave.run(r.name, JSON.stringify(data), Date.now());
          } catch { /* ignore */ }
        }
      }
    }
    pt.members.length = 0;
    pt.roster.length = 0;
    deletePartyRow(pt.id);
  } else {
    persistParty(pt);
    partyBcast(pt);
    if (notify) for (const m of pt.members) if (m.ws) toast(m, `${p.name} dejó el grupo`);
    for (const m of originalOnline) if (m !== p) clearFollowIfInvalid(m);
  }
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
function mitigate(raw: number, arm: number): number {
  const mit = Math.min(0.6, arm / (arm + 80));
  return Math.max(1, Math.round(raw * (1 - mit)));
}

/** Player damages a mob. `raw` = pre-rolled damage before crit/armor (dmgp% already included). */
function playerHit(p: Player, m: Mob, raw: number, d: Derived = derive(p)): void {
  if (m.dead) return;
  const crit = Math.random() * 100 < d.crit;
  if (crit) raw *= 1.6;
  const dmg = mitigate(raw, m.arm);
  m.hp -= dmg;
  p.combatUntil = Date.now() + COMBAT_MS;
  p.lastAtk = Date.now();
  p.d = m.x < p.x ? 1 : 0;
  p.session.dealt += dmg;
  sendMeter(p);
  const ev: Record<string, unknown> = { t: "dmg", i: m.id, a: dmg, s: p.id };
  if (crit) ev.c = 1;
  bcastAt(m.x, m.y, ev);
  if (m.hp <= 0) {
    mobDie(m, p);
    return;
  }
  // Getting hit always draws aggro (even beyond the scan radius / while walking home).
  if (!m.target) {
    m.target = p;
    m.state = "chase";
  }
}

/** Mob damages a player. */
function mobHit(m: Mob, p: Player, mul = 1): void {
  if (p.dead || inTown(p.x, p.y)) return;
  const d = derive(p);
  const raw = (m.lo + Math.random() * (m.hi - m.lo)) * mul;
  const dmg = mitigate(raw, d.arm);
  p.hp -= dmg;
  p.combatUntil = Date.now() + COMBAT_MS;
  m.lastAtk = Date.now();
  m.d = p.x < m.x ? 1 : 0;
  bcastAt(p.x, p.y, { t: "dmg", i: p.id, a: dmg, s: m.id });
  noteHitTaken(p, m.name || m.kind, dmg);
  p.session.taken += dmg;
  sendMeter(p);
  // Solo auto-retaliate: if not in a party and not WASD-steering, lock onto the attacker
  // when we have no living target (manual click / party follow still win when set).
  if (!p.party && !p.vel && !p.dead) {
    const cur = p.atkTarget != null ? mobById(p.atkTarget) : null;
    if (!cur || cur.dead) {
      p.atkTarget = m.id;
      p.lootTarget = null;
      p.repathAt = 0;
    }
  }
  if (p.hp <= 0) playerDie(p);
}

function applySlow(t: StatusHolder, pct: number, ms: number): void {
  const until = Date.now() + ms;
  if (until > t.slowUntil || pct > t.slowPct) {
    t.slowUntil = until;
    t.slowPct = pct;
  }
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
function useSkill(p: Player, n: number, targetId: number | null, px: number | null, py: number | null): void {
  const def = SKILLS[p.cls]?.find((s) => s.n === n);
  if (!def) return;
  dismountAndStand(p);
  const now = Date.now();
  // Nodo activo del árbol: rango >= 1 desbloquea la habilidad (n=1 siempre
  // disponible como habilidad básica); los rangos 2-5 suben daño/curación.
  const node = TREES[p.cls]?.find((a) => a.kind === "active" && a.skillN === n) ?? null;
  const rank = node ? abilityRank(p, node.id) : 0;
  if (n !== 1 && rank < 1) return toast(p, "Asigna un punto a esta habilidad en tu árbol (tecla H)");
  if (p.lvl < def.unlock) return toast(p, `Se desbloquea al nivel ${def.unlock}`);
  if (now < p.skillCds[n]) return toast(p, `${def.name} está en enfriamiento`);
  if (p.mp < def.cost) return toast(p, "No tenés suficiente maná");
  const effRank = Math.max(1, rank);
  const d = derive(p);

  const hits: Mob[] = [];
  const duelHits: Player[] = [];
  let fxMsg: Record<string, unknown> | null = null;
  const isHealFx = def.fx.k === "heal";
  if (def.kind === "target") {
    const m = targetId != null ? mobById(targetId) : null;
    const foe = targetId != null ? playerById(targetId) : null;
    if (m && !m.dead) {
      if (outOfCastRange(p, m.x, m.y)) return;
      hits.push(m);
      fxMsg = { t: "fx", k: "proj", from: { x: r2(p.x), y: r2(p.y) }, to: { x: r2(m.x), y: r2(m.y) }, style: def.fx.style };
      p.d = m.x < p.x ? 1 : 0;
    } else if (foe && areDueling(p, foe) && def.base > 0) {
      if (outOfCastRange(p, foe.x, foe.y)) return;
      duelHits.push(foe);
      fxMsg = { t: "fx", k: "proj", from: { x: r2(p.x), y: r2(p.y) }, to: { x: r2(foe.x), y: r2(foe.y) }, style: def.fx.style };
      p.d = foe.x < p.x ? 1 : 0;
    } else {
      return toast(p, "Sin objetivo");
    }
  } else if (!isHealFx || def.fx.k === "aoe") {
    const cx = def.kind === "self" ? p.x : px;
    const cy = def.kind === "self" ? p.y : py;
    if (cx == null || cy == null) return toast(p, "Punto de destino inválido");
    if (def.kind === "point" && outOfCastRange(p, cx, cy)) return;
    const r = def.radius ?? 2;
    // Pure support heals skip the mob sweep; damaging self/point skills still hit.
    if (def.base > 0) {
      for (const m of mobs)
        if (!m.dead && dist(m.x, m.y, cx, cy) <= r) hits.push(m);
      const foe = duelPartner(p);
      if (foe && dist(foe.x, foe.y, cx, cy) <= r) duelHits.push(foe);
    }
    if (def.fx.k === "aoe")
      fxMsg = { t: "fx", k: "aoe", x: r2(cx), y: r2(cy), r, style: def.fx.style };
  }

  p.mp -= def.cost;
  p.skillCds[n] = now + def.cd * cdMult(p);
  if (def.base > 0 || hits.length || duelHits.length) p.combatUntil = now + COMBAT_MS;
  if (fxMsg) bcastAt(p.x, p.y, fxMsg);

  // Healing (cleric): flat amount from the CASTER's int + node rank, boosted
  // by the Manos Curativas passive; always self, then optional party modes.
  if (def.heal) {
    const amount = (def.heal.base + def.heal.perRank * (effRank - 1) + def.heal.coeff * d.int)
      * (1 + 0.03 * abilityRank(p, "manos"));
    const applyHeal = (pl: Player) => {
      if (pl.dead || !pl.ws) return;
      const dm = derive(pl);
      const before = pl.hp;
      pl.hp = Math.min(dm.mhp, pl.hp + amount);
      if (pl.hp > before) {
        p.session.healed += pl.hp - before;
        sendMeter(p);
        bcastAt(pl.x, pl.y, { t: "fx", k: "heal", i: pl.id });
        sendYou(pl);
      }
    };
    applyHeal(p);
    if (p.party) {
      const r = (def.radius ?? 4) + 0.3 * abilityRank(p, "comunion");
      if (def.healMostHurt) {
        // Oración: also heal the single most damaged living ally in range.
        let best: Player | null = null;
        let bestRatio = 1;
        for (const mate of p.party.members) {
          if (mate === p || mate.dead || !mate.ws) continue;
          if (dist(p.x, p.y, mate.x, mate.y) > r) continue;
          const d = derive(mate);
          const ratio = d.mhp > 0 ? mate.hp / d.mhp : 1;
          if (ratio < bestRatio - 1e-9 || (Math.abs(ratio - bestRatio) < 1e-9 && best && mate.id < best.id)) {
            bestRatio = ratio;
            best = mate;
          }
        }
        if (best && bestRatio < 0.999) applyHeal(best);
      } else if (def.healParty) {
        for (const mate of p.party.members) {
          if (mate === p) continue;
          if (dist(p.x, p.y, mate.x, mate.y) <= r) applyHeal(mate);
        }
      }
    }
  }

  // Daño plano: base + perRank·(rango−1) + coeff·stat primario (+ 50% del
  // daño rodado del arma en habilidades con arma) + pasivo de daño de
  // habilidades; luego dmgp% del equipo y el pipeline crítico/armadura de siempre.
  const stat = d[CLASS_BASE[p.cls].primaryStat];
  const flatPassive = 2 * (abilityRank(p, "w_filo") + abilityRank(p, "h_punta") + abilityRank(p, "m_poder"));
  const [wLo, wHi] = p.eq.weapon?.dmg ?? [1, 3];
  for (const m of hits) {
    if (def.stun) m.stunUntil = Math.max(m.stunUntil, now + def.stun);
    if (def.slow) applySlow(m, def.slow.pct, def.slow.ms);
    if (def.base > 0) {
      const weaponRoll = (def.weaponShare ?? 0) * (wLo + Math.random() * (wHi - wLo));
      const raw = (def.base + def.perRank * (effRank - 1) + def.coeff * stat + weaponRoll + flatPassive)
        * (1 + d.dmgp / 100);
      playerHit(p, m, raw, d);
    }
  }
  for (const foe of duelHits) {
    if (def.base > 0) {
      const weaponRoll = (def.weaponShare ?? 0) * (wLo + Math.random() * (wHi - wLo));
      const raw = (def.base + def.perRank * (effRank - 1) + def.coeff * stat + weaponRoll)
        * (1 + d.dmgp / 100);
      playerHitPlayer(p, foe, raw, d);
    }
  }
  sendYou(p);
}

function mobById(id: number): Mob | null {
  return mobsById.get(id) ?? null;
}

/** Sale value at the merchant: 25% of an item's base value, scaled by stack size. */

function playerByName(name: string, onlineOnly = false): Player | null {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;
  for (const q of players.values()) {
    if (q.name.toLowerCase() !== key) continue;
    if (onlineOnly && !q.ws) continue;
    return q;
  }
  return null;
}

/** Stop movement / chase so a channelled action can start cleanly. */
function clearMobility(p: Player, keepVel = false): void {
  p.path = null;
  p.direct = null;
  if (!keepVel) p.vel = null;
  p.atkTarget = null;
  p.lootTarget = null;
  p.npcTarget = null;
}

/** A* toward a point, with straight-line fallback when blocked. */
function setPathTo(p: Player, x: number, y: number): void {
  const path = astar(world.walk, p.x, p.y, x, y);
  if (path) {
    p.path = path;
    p.direct = null;
  } else {
    p.path = null;
    p.direct = { x, y };
  }
}

function clearPath(p: Player): void {
  p.path = null;
  p.direct = null;
}

function repathTo(p: Player, x: number, y: number, now: number, cd = 500): void {
  if (now < p.repathAt) return;
  p.repathAt = now + cd;
  setPathTo(p, x, y);
}

function alreadyBusy(p: Player, until: number, now: number, msg: string): boolean {
  if (until && now < until) { toast(p, msg); return true; }
  return false;
}

function notInTown(p: Player, msg: string): boolean {
  if (!inTown(p.x, p.y)) return false;
  toast(p, msg);
  return true;
}

/** First inventory slot matching a predicate, or -1. */
function findInvSlot(p: Player, pred: (it: Item) => boolean): number {
  for (let i = 0; i < p.inv.length; i++) {
    const it = p.inv[i];
    if (it && pred(it)) return i;
  }
  return -1;
}

/** Channel finished but player died / left the station. */
function channelGone(p: Player, stillValid: boolean, msg: string): boolean {
  if (!p.dead && stillValid) return false;
  toast(p, msg);
  return true;
}

function needWater(p: Player): boolean {
  if (nearWater(p)) return false;
  toast(p, "Tenés que estar junto al agua");
  return true;
}

function needTree(p: Player): boolean {
  if (nearTree(p)) return false;
  toast(p, "Tenés que estar junto a un árbol");
  return true;
}


function dropMountSit(p: Player): void {
  p.mounted = false;
  p.sitting = false;
}

function questItemBlocked(p: Player, verb: string): void {
  toast(p, `No podés ${verb} objetos de misión`);
}

function stopChannels(p: Player): void {
  p.fishUntil = 0;
  p.cookUntil = 0;
  p.cookSlot = -1;
  p.forageUntil = 0;
}

function abortChannel(p: Player, msg: string): void {
  stopChannels(p);
  toast(p, msg);
}

function interruptChannels(p: Player, now: number): void {
  if (p.fishUntil && channelInterrupted(p, now)) return abortChannel(p, "Dejas de pescar");
  if (p.forageUntil && channelInterrupted(p, now)) return abortChannel(p, "Dejas de recolectar");
  if (p.cookUntil && (channelInterrupted(p, now) || !nearNpc(p, bront))) abortChannel(p, "Dejas de cocinar");
}

function needOnline(p: Player, q: Player | null, msg = "Ese jugador no está en línea"): q is Player {
  if (q && q.ws) return true;
  toast(p, msg);
  return false;
}

function toastReject(p: Player, other: Player | null | undefined, otherMsg: string, selfMsg: string): void {
  if (other && other.ws) toast(other, otherMsg);
  toast(p, selfMsg);
}

function dismountAndStand(p: Player): void {
  dismount(p, true);
  standUp(p, true);
}

function channelBusy(p: Player, now: number): boolean {
  return Boolean(
    (p.fishUntil && now < p.fishUntil) ||
    (p.cookUntil && now < p.cookUntil) ||
    (p.forageUntil && now < p.forageUntil),
  );
}

function channelInterrupted(p: Player, now: number): boolean {
  return Boolean(p.vel || p.path || p.direct || p.atkTarget != null || p.combatUntil > now);
}

function sellValue(it: Item): number {
  return Math.floor(it.val / 4) * (it.qty ?? 1);
}

function nearAnyMerchant(p: Player): boolean {
  return nearNpc(p, kora) || nearNpc(p, bront);
}

function needMerchant(p: Player): boolean {
  if (!nearAnyMerchant(p)) { toast(p, "No hay ningún mercader cerca"); return true; }
  return false;
}

function needGold(p: Player, amount: number): boolean {
  if (p.gold < amount) { toast(p, "No tenés suficiente oro"); return true; }
  return false;
}

function channelBlocked(p: Player, now: number): boolean {
  if (!channelBusy(p, now)) return false;
  toast(p, "Terminá lo que estás haciendo primero");
  return true;
}

function toastPartyFull(p: Player): void {
  toast(p, "El grupo está lleno");
}

function outOfCastRange(p: Player, x: number, y: number): boolean {
  if (dist(p.x, p.y, x, y) > CAST_RANGE + 0.5) { toast(p, "Fuera de alcance"); return true; }
  return false;
}
function needParty(p: Player): boolean {
  if (p.party) return false;
  toast(p, "No estás en un grupo");
  return true;
}

function inCombatBlock(p: Player, now: number, msg: string): boolean {
  if (now < p.combatUntil) { toast(p, msg); return true; }
  return false;
}

/** Shared preamble for channelled crafts (fish/cook/forage). Returns true if blocked. */
function beginChannelGate(p: Player, now: number, until: number, busyMsg: string, combatMsg: string): boolean {
  if (p.dead) return true;
  dismountAndStand(p);
  if (alreadyBusy(p, until, now, busyMsg)) return true;
  if (channelBlocked(p, now)) return true;
  if (inCombatBlock(p, now, combatMsg)) return true;
  return false;
}

function alreadyDueling(p: Player): boolean {
  if (!p.duelWith) return false;
  toast(p, "Ya estás en un duelo");
  return true;
}

function targetDown(p: Player, q: Player): boolean {
  if (!q.dead) return false;
  toast(p, "Ese jugador ha caído");
  return true;
}



function tileAt(x: number, y: number): string {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= W || ty >= W) return "w";
  return world.tiles[ty][tx];
}


function nearTile(p: Player, tile: string): boolean {
  const cx = Math.floor(p.x), cy = Math.floor(p.y);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (tileAt(cx + dx + 0.5, cy + dy + 0.5) === tile) return true;
  return false;
}
function nearTree(p: Player): boolean { return nearTile(p, "t"); }
function nearWater(p: Player): boolean { return nearTile(p, "w"); }

function nearFountainBind(p: Player): boolean {
  return dist(p.x, p.y, FOUNTAIN.x, FOUNTAIN.y) <= FOUNTAIN_REGEN_R + 1.5;
}

function needFountain(p: Player): boolean {
  if (nearFountainBind(p)) return false;
  toast(p, "Liga tu hogar junto a la fuente de Helike");
  return true;
}

function tryFinishForage(p: Player, now: number): void {
  if (!p.forageUntil || now < p.forageUntil) return;
  p.forageUntil = 0;
  if (channelGone(p, nearTree(p), "La recolección se interrumpió")) return;
  const herb = rollHerb();
  if (!invAdd(p, herb)) {
    invFull(p, "perdiste la hierba");
    return;
  }
  p.forageCount++;
  noteProf(p, p.forageCount, [20, "forage_20"]);
  const rare = herb.rarity === "magic";
  toastRare(p, rare, `¡Encontraste ${herb.name}!`, `Recolectaste: ${herb.name}`);
  lootFx(p, { name: herb.name, rarity: herb.rarity, icon: "herb" }, "forage");
}


function beginFish(p: Player, now: number): void {
  if (beginChannelGate(p, now, p.fishUntil, "Ya estás pescando…", "No podés pescar en combate")) return;
  if (needWater(p)) return;
  if (notInTown(p, "No podés pescar en la plaza")) return;
  clearMobility(p);
  p.fishUntil = now + 2800;
  channelCast(p, "Lanzas el sedal…", "fishcast");
}

function beginForage(p: Player, now: number): void {
  if (beginChannelGate(p, now, p.forageUntil, "Ya estás recolectando…", "No podés recolectar en combate")) return;
  if (needTree(p)) return;
  if (notInTown(p, "No podés recolectar en la plaza")) return;
  clearMobility(p);
  p.forageUntil = now + 2400;
  channelCast(p, "Buscas hierbas…", "foragecast");
}



function beginBrew(p: Player, now: number): void {
  if (beginChannelGate(p, now, 0, "Ya estás preparando…", "No podés preparar brebajes en combate")) return;
  if (needNpc(p, kora, MSG_KORA)) return;
  const slot = findInvSlot(p, (it) => it.slot === "herb" && Boolean(BREW_MAP[it.base]));
  if (slot < 0) return toast(p, "No tenés hierbas para preparar");
  const it = p.inv[slot]!;
  const herbBase = it.base;
  const herbName = it.name;
  const recipe = BREW_MAP[herbBase];
  consumeInvSlot(p, slot);
  const outItem = recipe.kind === "potion" ? makePotion(recipe.id) : makeElixir(recipe.id);
  if (!invAdd(p, outItem)) {
    invAdd(p, makeHerb(herbBase));
    invFull(p, "no pudiste preparar el brebaje");
    sendYou(p);
    return;
  }
  p.brewCount++;
  noteProf(p, p.brewCount, [15, "brew_15"]);
  toast(p, `Preparaste: ${outItem.name} (con ${herbName})`);
  lootFx(p, { name: outItem.name, rarity: outItem.rarity, icon: outItem.icon }, "brew");
}

function tryBind(p: Player): void {
  if (p.dead) return;
  if (needFountain(p)) return;
  p.bindX = p.x;
  p.bindY = p.y;
  p.dirty = true;
  grantAch(p, "bind_1");
  toast(p, `Hogar ligado (${Math.floor(p.bindX)}, ${Math.floor(p.bindY)})`);
  sendYou(p);
}

// ---------------------------------------------------------------------------
// Player trade
// ---------------------------------------------------------------------------
const TRADE_SLOTS = 6;
const TRADE_RANGE = 12;
const DUEL_RANGE = 14;
const INVITE_MS = 30000;

interface TradeSide {
  items: (Item | null)[];
  gold: number;
  locked: boolean;
  confirmed: boolean;
}
interface TradeSession {
  id: string;
  aId: number;
  bId: number;
  aName: string;
  bName: string;
  a: TradeSide;
  b: TradeSide;
  invitesUntil: number; // 0 once open
}

const trades = new Map<string, TradeSession>();
const tradeInvites = new Map<string, { fromId: number; fromName: string; until: number }>(); // key = targetName lower


function areDueling(a: Player, b: Player): boolean {
  return Boolean(a) && Boolean(b) && a !== b && a.duelWith === b.id && b.duelWith === a.id;
}

function duelPartner(p: Player): Player | null {
  if (!p.duelWith) return null;
  const q = playersById.get(p.duelWith) || null;
  return q && q.ws && areDueling(p, q) ? q : null;
}

function clearDuelState(p: Player): void {
  p.duelWith = null;
  if (p.atkTarget != null && !mobById(p.atkTarget)) p.atkTarget = null;
}

function endDuel(a: Player, b: Player, reason: string, winner: Player | null = null): void {
  if (!a.duelWith && !b.duelWith) return;
  clearDuelState(a);
  clearDuelState(b);
  a.combatUntil = 0;
  b.combatUntil = 0;
  a.atkTarget = null;
  b.atkTarget = null;
  // Soft reset — no death penalty.
  const da = derive(a), db = derive(b);
  if (a.hp < 1) a.hp = Math.max(1, Math.floor(da.mhp * 0.5));
  if (b.hp < 1) b.hp = Math.max(1, Math.floor(db.mhp * 0.5));
  if (winner === a) {
    a.duelWins++;
    a.dirty = true;
    grantAch(a, "duel_1");
    if (a.duelWins >= 5) grantAch(a, "duel_5");
    toast(a, `Victoria en duelo contra ${b.name}`);
    toast(b, `Derrota en duelo contra ${a.name}`);
    bcastAt(a.x, a.y, { t: "fx", k: "level", i: a.id });
  } else if (winner === b) {
    b.duelWins++;
    b.dirty = true;
    grantAch(b, "duel_1");
    if (b.duelWins >= 5) grantAch(b, "duel_5");
    toast(b, `Victoria en duelo contra ${a.name}`);
    toast(a, `Derrota en duelo contra ${b.name}`);
    bcastAt(b.x, b.y, { t: "fx", k: "level", i: b.id });
  } else {
    toast(a, reason || "Duelo cancelado");
    toast(b, reason || "Duelo cancelado");
  }
  send(a.ws, { t: "duel", state: "end", reason: reason || "end", wins: a.duelWins });
  send(b.ws, { t: "duel", state: "end", reason: reason || "end", wins: b.duelWins });
  sendYou(a);
  sendYou(b);
}

function cancelDuel(p: Player, reason: string): void {
  const q = p.duelWith != null ? (playersById.get(p.duelWith) || null) : null;
  if (q && q.duelWith === p.id) endDuel(p, q, reason, null);
  else clearDuelState(p);
}

function tryDuelReq(p: Player, targetId: number, now: number): void {
  if (p.dead) return;
  if (alreadyDueling(p)) return;
  if (p.tradeId) return toast(p, "Terminá el intercambio primero");
  if (waitToast(p, p.lastDuelReqAt, 1500, now)) return;
  const target = playerById(targetId);
  if (!target || target === p || !needOnline(p, target)) return;
  if (BOT_SQUAD.has(target.name)) return toast(p, "Los compañeros no aceptan duelos");
  if (targetDown(p, target)) return;
  if (target.duelWith) return toast(p, `${target.name} ya está en un duelo`);
  if (target.tradeId) return toast(p, `${target.name} está intercambiando`);
  if (tooFar(p, target, DUEL_RANGE)) return;
  p.lastDuelReqAt = now;
  target.duelInvites.set(p.name, now + INVITE_MS);
  send(target.ws, { t: "duel_invited", from: p.name, fromId: p.id, cls: p.cls, lvl: p.lvl });
  toast(p, `Desafío de duelo enviado a ${target.name}`);
}

function tryDuelAccept(p: Player, fromName: string, now: number): void {
  if (p.dead) return;
  if (alreadyDueling(p)) return;
  const name = String(fromName || "").trim();
  const exp = p.duelInvites.get(name);
  if (!exp || now > exp) {
    p.duelInvites.delete(name);
    return toast(p, "El desafío expiró");
  }
  p.duelInvites.delete(name);
  const other = playerByName(name, true);
  if (!needOnline(p, other)) return;
  if (other.duelWith) return toast(p, `${other.name} ya está en un duelo`);
  if (targetDown(p, other)) return;
  if (tooFar(p, other, DUEL_RANGE)) return;
  dismountAndStand(p);
  dismountAndStand(other);
  if (p.tradeId) cancelTrade(p, "Intercambio cancelado");
  if (other.tradeId) cancelTrade(other, "Intercambio cancelado");
  p.duelWith = other.id;
  other.duelWith = p.id;
  p.atkTarget = null;
  other.atkTarget = null;
  toast(p, `¡Duelo contra ${other.name}!`);
  toast(other, `¡Duelo contra ${p.name}!`);
  send(p.ws, { t: "duel", state: "start", id: other.id, name: other.name });
  send(other.ws, { t: "duel", state: "start", id: p.id, name: p.name });
  bcastAt(p.x, p.y, { t: "fx", k: "slash", x: r2(p.x), y: r2(p.y), tx: r2(other.x), ty: r2(other.y) });
  sendYou(p);
  sendYou(other);
}

function tryDuelDecline(p: Player, fromName: string): void {
  const name = String(fromName || "").trim();
  p.duelInvites.delete(name);
  const requester = playerByName(name, true);
  toastReject(p, requester, `${p.name} rechazó el duelo`, "Desafío rechazado");
}

function playerHitPlayer(p: Player, q: Player, raw: number, d: Derived = derive(p)): void {
  if (q.dead || p.dead || !areDueling(p, q)) return;
  const crit = Math.random() * 100 < d.crit;
  if (crit) raw *= 1.6;
  const td = derive(q);
  const dmg = mitigate(raw, td.arm);
  q.hp -= dmg;
  const now = Date.now();
  p.combatUntil = now + COMBAT_MS;
  q.combatUntil = now + COMBAT_MS;
  p.lastAtk = now;
  p.d = q.x < p.x ? 1 : 0;
  p.session.dealt += dmg;
  sendMeter(p);
  const ev: Record<string, unknown> = { t: "dmg", i: q.id, a: dmg, s: p.id };
  if (crit) ev.c = 1;
  bcastAt(q.x, q.y, ev);
  noteHitTaken(q, p.name, dmg);
  q.session.taken += dmg;
  sendMeter(q);
  sendYou(q);
  if (q.hp <= 0) {
    q.hp = 0;
    endDuel(p, q, "finish", p);
  }
}

function maintainDuels(now: number): void {
  for (const p of players.values()) {
    if (!p.ws || !p.duelWith) continue;
    const q = playersById.get(p.duelWith) || null;
    if (!q || !q.ws || q.duelWith !== p.id) {
      clearDuelState(p);
      send(p.ws, { t: "duel", state: "end", reason: "gone" });
      toast(p, "Duelo cancelado");
      continue;
    }
    // Only process once per pair
    if (p.id > q.id) continue;
    if (p.dead || q.dead) { endDuel(p, q, "dead", null); continue; }
    if (dist(p.x, p.y, q.x, q.y) > 42) endDuel(p, q, "Os alejasteis demasiado", null);
  }
}

const SALVAGE_SLOTS = new Set(["weapon", "armor", "helm", "ring"]);

function salvageValue(it: Item): number {
  const mul = it.rarity === "rare" ? 0.85 : it.rarity === "magic" ? 0.65 : 0.45;
  return Math.max(1, Math.floor(it.val * mul) * (it.qty ?? 1));
}

function trySalvage(p: Player, slot: number): void {
  if (p.dead) return;
  if (needNpc(p, bront, MSG_SALVAGE)) return;
  if (slot < 0 || slot >= INV_SIZE) return;
  const it = p.inv[slot];
  if (!it) return;
  if (!SALVAGE_SLOTS.has(it.slot)) return toast(p, "Solo se desguaza armas y armaduras");
  if (it.slot === "quest") return questItemBlocked(p, "desguazar");
  const gain = salvageValue(it);
  const name = it.name;
  p.inv[slot] = null;
  p.gold += gain;
  noteGold(p, gain);
  p.salvageCount++;
  noteProf(p, p.salvageCount, [1, "salvage_1"], [20, "salvage_20"]);
  toast(p, `Desguazaste ${name} (+${gain} oro)`);
  lootFx(p, { name: `Desguace: ${name}`, rarity: it.rarity, icon: it.icon || "armor", gold: gain }, "brew");
}


function emptyTradeSide(): TradeSide {
  return { items: new Array(TRADE_SLOTS).fill(null), gold: 0, locked: false, confirmed: false };
}

function tradeOf(p: Player): TradeSession | null {
  return p.tradeId ? (trades.get(p.tradeId) || null) : null;
}

function tradePartner(sess: TradeSession, p: Player): Player | null {
  const otherId = p.id === sess.aId ? sess.bId : sess.aId;
  return playerById(otherId);
}

function tradeSide(sess: TradeSession, p: Player): TradeSide {
  return p.id === sess.aId ? sess.a : sess.b;
}

function tradeOtherSide(sess: TradeSession, p: Player): TradeSide {
  return p.id === sess.aId ? sess.b : sess.a;
}

function countFreeInv(p: Player): number {
  let n = 0;
  for (const it of p.inv) if (!it) n++;
  return n;
}

function tradeItemView(it: Item | null): Item | null {
  return it ? { ...it, mods: it.mods ? { ...it.mods } : undefined, dmg: it.dmg ? [it.dmg[0], it.dmg[1]] as [number, number] : undefined } : null;
}

function sendTradeState(p: Player, sess: TradeSession): void {
  if (!p.ws) return;
  const mine = tradeSide(sess, p);
  const theirs = tradeOtherSide(sess, p);
  const partner = tradePartner(sess, p);
  send(p.ws, {
    t: "trade",
    id: sess.id,
    partner: partner ? { id: partner.id, name: partner.name, cls: partner.cls, lvl: partner.lvl } : { id: 0, name: p.id === sess.aId ? sess.bName : sess.aName, cls: "?", lvl: 0 },
    you: mine.items.map(tradeItemView),
    them: theirs.items.map(tradeItemView),
    goldYou: mine.gold,
    goldThem: theirs.gold,
    lockYou: Boolean(mine.locked),
    lockThem: Boolean(theirs.locked),
    confirmYou: Boolean(mine.confirmed),
    confirmThem: Boolean(theirs.confirmed),
    phase: (!mine.locked || !theirs.locked) ? "offer" : "confirm",
  });
}

function syncTrade(sess: TradeSession): void {
  const a = playerById(sess.aId);
  const b = playerById(sess.bId);
  if (a) sendTradeState(a, sess);
  if (b) sendTradeState(b, sess);
}

function returnTradeItems(p: Player, side: TradeSide): void {
  for (let i = 0; i < side.items.length; i++) {
    const it = side.items[i];
    if (!it) continue;
    if (!invAdd(p, it)) {
      // emergency: drop near player
      // reuse ground drop helper if present — otherwise toast and keep trying stash
      if (!addToSlots(p.stash, it)) toast(p, `No se pudo devolver ${it.name}`);
    }
    side.items[i] = null;
  }
  side.gold = 0;
  side.locked = false;
  side.confirmed = false;
}

function tradeLocked(p: Player, side: { locked: boolean }): boolean {
  if (side.locked) { toast(p, "Oferta bloqueada — desbloqueá para cambiar"); return true; }
  return false;
}

function cancelTrade(p: Player, reason?: string): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const a = playersById.get(sess.aId) || null;
  const b = playersById.get(sess.bId) || null;
  if (a) { returnTradeItems(a, sess.a); a.tradeId = null; }
  if (b) { returnTradeItems(b, sess.b); b.tradeId = null; }
  trades.delete(sess.id);
  if (a && a.ws) { send(a.ws, { t: "trade_end", reason: reason || "cancel" }); sendYou(a); }
  if (b && b.ws) { send(b.ws, { t: "trade_end", reason: reason || "cancel" }); sendYou(b); }
  if (reason) {
    if (a && a.ws) toast(a, reason);
    if (b && b.ws && b !== a) toast(b, reason);
  }
}

function unlockTrade(sess: TradeSession): void {
  sess.a.locked = false; sess.b.locked = false;
  sess.a.confirmed = false; sess.b.confirmed = false;
}

function canTradeItem(it: Item): boolean {
  if (it.slot === "quest") return false;
  return true;
}

function tryTradeReq(p: Player, targetId: number, now: number): void {
  if (p.dead) return;
  if (p.tradeId) return toast(p, "Ya estás intercambiando");
  if (waitToast(p, p.lastTradeReqAt, 1200, now)) return;
  const target = playerById(targetId);
  if (!target || target === p || !needOnline(p, target)) return;
  if (BOT_SQUAD.has(target.name)) return toast(p, "No podés comerciar con compañeros IA");
  if (BOT_SQUAD.has(p.name)) return;
  if (tooFar(p, target, TRADE_RANGE)) return;
  if (target.dead) return toast(p, "Ese jugador no puede comerciar ahora");
  if (target.tradeId) return toast(p, `${target.name} ya está intercambiando`);
  p.lastTradeReqAt = now;
  tradeInvites.set(target.name.toLowerCase(), { fromId: p.id, fromName: p.name, until: now + INVITE_MS });
  send(target.ws, { t: "trade_invited", from: p.name, fromId: p.id, cls: p.cls, lvl: p.lvl });
  toast(p, `Propuesta de intercambio enviada a ${target.name}`);
}

function tryTradeAccept(p: Player, fromName: string, now: number): void {
  if (p.dead || p.tradeId) return;
  const key = String(fromName || "").trim().toLowerCase();
  const inv = tradeInvites.get(key);
  tradeInvites.delete(key);
  if (!inv || now > inv.until) return toast(p, "La propuesta expiró");
  const other = playerById(inv.fromId);
  if (!needOnline(p, other)) return;
  if (other.name.toLowerCase() !== key) return toast(p, "La propuesta expiró");
  if (other.tradeId) return toast(p, `${other.name} ya está intercambiando`);
  if (tooFar(p, other, TRADE_RANGE)) return;
  const id = `tr_${other.id}_${p.id}_${now}`;
  const sess: TradeSession = {
    id, aId: other.id, bId: p.id, aName: other.name, bName: p.name,
    a: emptyTradeSide(), b: emptyTradeSide(), invitesUntil: 0,
  };
  trades.set(id, sess);
  other.tradeId = id;
  p.tradeId = id;
  dismountAndStand(other);
  dismountAndStand(p);
  toast(other, `${p.name} aceptó el intercambio`);
  toast(p, `Intercambio con ${other.name}`);
  syncTrade(sess);
  sendYou(other); sendYou(p);
}

function tryTradeDecline(p: Player, fromName: string): void {
  const key = String(fromName || "").trim().toLowerCase();
  const inv = tradeInvites.get(key);
  if (!inv) return;
  tradeInvites.delete(key);
  const other = playerById(inv.fromId);
  toastReject(p, other, `${p.name} rechazó el intercambio`, "Intercambio rechazado");
}

function tradePut(p: Player, tradeSlot: number, invSlot: number): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const side = tradeSide(sess, p);
  if (tradeLocked(p, side)) return;
  if (!Number.isInteger(tradeSlot) || tradeSlot < 0 || tradeSlot >= TRADE_SLOTS) return;
  if (!Number.isInteger(invSlot) || invSlot < 0 || invSlot >= INV_SIZE) return;
  const it = p.inv[invSlot];
  if (!it) return;
  if (!canTradeItem(it)) return questItemBlocked(p, "intercambiar");
  if (side.items[tradeSlot]) return toast(p, "Ese hueco ya tiene un objeto");
  // move whole stack into trade
  p.inv[invSlot] = null;
  side.items[tradeSlot] = it;
  unlockTrade(sess);
  p.dirty = true;
  syncTrade(sess);
  sendYou(p);
}

function tradeTake(p: Player, tradeSlot: number): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const side = tradeSide(sess, p);
  if (tradeLocked(p, side)) return;
  if (!Number.isInteger(tradeSlot) || tradeSlot < 0 || tradeSlot >= TRADE_SLOTS) return;
  const it = side.items[tradeSlot];
  if (!it) return;
  if (!invAdd(p, it)) return invFull(p);
  side.items[tradeSlot] = null;
  unlockTrade(sess);
  p.dirty = true;
  syncTrade(sess);
  sendYou(p);
}

function tradeGold(p: Player, gold: number): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const side = tradeSide(sess, p);
  if (tradeLocked(p, side)) return;
  const g = Math.floor(gold);
  if (!Number.isFinite(g) || g < 0) return;
  if (g > 100000) return toast(p, "Máximo 100.000 de oro");
  if (needGold(p, g)) return;
  side.gold = g;
  unlockTrade(sess);
  syncTrade(sess);
}

function tradeLock(p: Player): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const side = tradeSide(sess, p);
  const partner = tradePartner(sess, p);
  if (!partner) return cancelTrade(p, "Intercambio cancelado");
  if (dist(p.x, p.y, partner.x, partner.y) > TRADE_RANGE) return cancelTrade(p, "Demasiado lejos — intercambio cancelado");
  if (side.gold > p.gold) return toast(p, "No tenés el oro ofrecido");
  side.locked = true;
  side.confirmed = false;
  tradeOtherSide(sess, p).confirmed = false;
  syncTrade(sess);
  toast(p, "Oferta bloqueada");
}

function tradeUnlock(p: Player): void {
  const sess = tradeOf(p);
  if (!sess) return;
  unlockTrade(sess);
  syncTrade(sess);
  toast(p, "Oferta desbloqueada");
}

function freeSlotsForIncoming(p: Player, incoming: (Item | null)[]): number {
  // Approximate: each non-stackable needs a free slot; stackables may merge.
  let free = countFreeInv(p);
  // Also account for items we're giving away already removed from inv.
  for (const it of incoming) {
    if (!it) continue;
    if (it.slot === "potion" || it.slot === "fish" || it.slot === "food" || it.slot === "herb" || it.slot === "elixir") {
      let merged = false;
      for (const have of p.inv) {
        if (have && have.base === it.base && (have.qty ?? 1) < 10) { merged = true; break; }
      }
      if (!merged) free--;
    } else free--;
  }
  return free;
}

function tradeConfirm(p: Player): void {
  const sess = tradeOf(p);
  if (!sess) return;
  const side = tradeSide(sess, p);
  const otherSide = tradeOtherSide(sess, p);
  if (!side.locked || !otherSide.locked) return toast(p, "Ambos deben bloquear primero");
  side.confirmed = true;
  syncTrade(sess);
  if (!otherSide.confirmed) {
    toast(p, "Esperando confirmación del otro…");
    return;
  }
  // Execute
  const a = playerById(sess.aId);
  const b = playerById(sess.bId);
  if (!a || !b || !a.ws || !b.ws) return cancelTrade(p, "Intercambio cancelado");
  if (dist(a.x, a.y, b.x, b.y) > TRADE_RANGE) return cancelTrade(p, "Demasiado lejos — intercambio cancelado");
  if (a.dead || b.dead) return cancelTrade(p, "Intercambio cancelado");
  if (sess.a.gold > a.gold || sess.b.gold > b.gold) return cancelTrade(p, "Oro insuficiente — cancelado");
  if (freeSlotsForIncoming(a, sess.b.items) < 0 || freeSlotsForIncoming(b, sess.a.items) < 0) {
    invFull(a, "no se pudo completar");
    invFull(b, "no se pudo completar");
    // unlock to let them adjust
    unlockTrade(sess);
    syncTrade(sess);
    return;
  }
  // Transfer gold
  a.gold -= sess.a.gold; b.gold += sess.a.gold;
  b.gold -= sess.b.gold; a.gold += sess.b.gold;
  a.dirty = true; b.dirty = true;
  // Transfer items
  const itemsToB = sess.a.items.map((x) => x);
  const itemsToA = sess.b.items.map((x) => x);
  sess.a.items.fill(null);
  sess.b.items.fill(null);
  for (const it of itemsToB) if (it && !invAdd(b, it)) addToSlots(b.stash, it);
  for (const it of itemsToA) if (it && !invAdd(a, it)) addToSlots(a.stash, it);
  a.tradeId = null; b.tradeId = null;
  trades.delete(sess.id);
  grantAch(a, "trade_1");
  grantAch(b, "trade_1");
  a.dirty = true; b.dirty = true;
  toast(a, `Intercambio completado con ${b.name}`);
  toast(b, `Intercambio completado con ${a.name}`);
  send(a.ws, { t: "trade_end", reason: "done" });
  send(b.ws, { t: "trade_end", reason: "done" });
  sendYou(a); sendYou(b);
}

function maintainTrades(now: number): void {
  for (const [k, inv] of [...tradeInvites.entries()]) {
    if (now > inv.until) tradeInvites.delete(k);
  }
  for (const sess of [...trades.values()]) {
    const a = playersById.get(sess.aId) || null;
    const b = playersById.get(sess.bId) || null;
    if (!a || !b || !a.ws || !b.ws) {
      if (a) cancelTrade(a, "Intercambio cancelado");
      else if (b) cancelTrade(b, "Intercambio cancelado");
      else trades.delete(sess.id);
      continue;
    }
    if (a.dead || b.dead) { cancelTrade(a, "Intercambio cancelado"); continue; }
    if (dist(a.x, a.y, b.x, b.y) > TRADE_RANGE + 2) cancelTrade(a, "Demasiado lejos — intercambio cancelado");
  }
}


function tryFinishFish(p: Player, now: number): void {
  if (!p.fishUntil || now < p.fishUntil) return;
  p.fishUntil = 0;
  if (channelGone(p, nearWater(p), "La pesca se interrumpió")) return;
  const fish = rollFish();
  if (!invAdd(p, fish)) {
    invFull(p, "la captura se escapó");
    return;
  }
  p.fishCount++;
  noteProf(p, p.fishCount, [10, "fish_10"], [50, "fish_50"]);
  const rare = fish.rarity === "magic";
  toastRare(p, rare, `¡Capturaste ${fish.name}!`, `Pescaste: ${fish.name}`);
  lootFx(p, { name: fish.name, rarity: fish.rarity, icon: "fish" }, "fish");
}

function tryFinishCook(p: Player, now: number): void {
  if (!p.cookUntil || now < p.cookUntil) return;
  p.cookUntil = 0;
  const slot = p.cookSlot;
  p.cookSlot = -1;
  if (channelGone(p, nearNpc(p, bront), "La cocina se interrumpió")) return;
  if (slot < 0 || slot >= INV_SIZE) return;
  const it = p.inv[slot];
  if (!it || it.slot !== "fish") {
    toast(p, "Ya no tenés ese pescado");
    return;
  }
  const foodId = foodFromFish(it.base);
  if (!foodId) return toast(p, "No podés cocinar eso");
  const fishBase = it.base;
  const food = makeFood(foodId);
  consumeInvSlot(p, slot);
  if (!invAdd(p, food)) {
    // refund the consumed fish unit if inventory is somehow full
    invAdd(p, makeFish(fishBase));
    invFull(p, "no pudiste cocinar");
    return;
  }
  p.cookCount++;
  noteProf(p, p.cookCount, [10, "cook_10"], [40, "cook_40"]);
  toast(p, `Cocinaste: ${food.name}`);
  lootFx(p, { name: food.name, rarity: food.rarity, icon: "food" }, "cook");
}

function beginCook(p: Player, now: number): void {
  if (beginChannelGate(p, now, p.cookUntil, "Ya estás cocinando…", "No podés cocinar en combate")) return;
  if (needNpc(p, bront, MSG_COOK)) return;
  const slot = findInvSlot(p, (it) => it.slot === "fish" && Boolean(foodFromFish(it.base)));
  if (slot < 0) return toast(p, "No tenés pescado para cocinar");
  clearMobility(p);
  p.cookSlot = slot;
  p.cookUntil = now + 2200;
  channelCast(p, `Cocinas ${p.inv[slot]!.name}…`, "cookcast");
}



function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------
interface StockEntry { item: Item; infinite: boolean }
let koraStock: StockEntry[] = [];
let brontStock: StockEntry[] = [];

function restock(): void {
  koraStock = [
    { item: makePotion("hp1"), infinite: true },
    { item: makePotion("mp1"), infinite: true },
    { item: makePotion("hp3"), infinite: true },
    { item: makePotion("mp3"), infinite: true },
    { item: rollItem("ring", 1, "magic"), infinite: false },
    { item: rollItem("ring", 2, "magic"), infinite: false },
    { item: rollItem(Math.random() < 0.5 ? "helm" : "armor", 2, "magic"), infinite: false },
  ];
  brontStock = [];
  for (const wt of ["sword", "axe", "bow", "staff"]) {
    brontStock.push({ item: rollItem("weapon", 1, "common", wt), infinite: false });
    brontStock.push({ item: rollItem("weapon", Math.random() < 0.5 ? 2 : 3, Math.random() < 0.3 ? "magic" : "common", wt), infinite: false });
  }
  for (const at of ["armor", "armor", "helm", "helm"])
    brontStock.push({ item: rollItem(at, 1 + Math.floor(Math.random() * 3), Math.random() < 0.3 ? "magic" : "common"), infinite: false });
}
restock();

function pushBuyback(p: Player, item: Item, price: number): void {
  // Session-only repurchase list (newest first). Cap at 6 to keep the panel short.
  p.buyback.unshift({ item, price });
  if (p.buyback.length > 6) p.buyback.length = 6;
}

function sendBuyback(p: Player): void {
  send(p.ws, {
    t: "buyback",
    items: p.buyback.map((b, idx) => ({ idx, item: b.item, price: b.price })),
  });
}

function sendShop(p: Player, npc: Npc): void {
  const stock = npc === kora ? koraStock : brontStock;
  send(p.ws, {
    t: "shop", npc: npc.id, name: npc.name,
    items: stock.map((s, idx) => ({ idx, item: s.item, price: s.item.val })),
  });
  sendBuyback(p);
}

function sendStash(p: Player): void {
  send(p.ws, { t: "stash", items: p.stash });
}

function sendPetShop(p: Player): void {
  send(p.ws, {
    t: "petshop",
    defs: Object.entries(PET_DEFS).map(([id, d]) => ({ id, name: d.name, cost: d.cost, desc: d.desc })),
    owned: [...p.pets], active: p.activePet,
    mounts: Object.entries(MOUNT_DEFS).map(([id, d]) => ({ id, name: d.name, cost: d.cost, desc: d.desc })),
    ownedMounts: [...p.mounts], activeMount: p.activeMount, mounted: Boolean(p.mounted),
  });
}

function dismount(p: Player, quiet = false): void {
  if (!p.mounted) return;
  p.mounted = false;
  if (!quiet) toast(p, "Te apeás");
  sendYou(p);
}

function standUp(p: Player, quiet = false): void {
  if (!p.sitting) return;
  p.sitting = false;
  if (!quiet) toast(p, "Te levantás");
  sendYou(p);
}

/** Shared out-of-combat gate for mount / sit. */
function oocActionGate(p: Player, combatMsg: string): boolean {
  if (p.dead) return true;
  const now = Date.now();
  if (inCombatBlock(p, now, combatMsg)) return true;
  if (channelBlocked(p, now)) return true;
  return false;
}

function tryMount(p: Player): void {
  if (p.mounted) { dismount(p); return; }
  if (!p.activeMount || !p.mounts.has(p.activeMount) || !MOUNT_DEFS[p.activeMount]) {
    // Prefer saved mount; else first owned.
    const first = [...p.mounts][0];
    if (!first) return toast(p, "No tenés montura — comprá una en el Criadero");
    p.activeMount = first;
  }
  if (oocActionGate(p, "No podés montar en combate")) return;
  standUp(p, true);
  p.mounted = true;
  p.dirty = true;
  toast(p, `Montás: ${MOUNT_DEFS[p.activeMount!].name}`);
  sendYou(p);
}

function trySit(p: Player): void {
  if (p.sitting) { standUp(p); return; }
  if (p.mounted) return toast(p, "Apeáte antes de sentarte");
  if (oocActionGate(p, "No podés sentarte en combate")) return;
  clearMobility(p);
  p.sitting = true;
  toast(p, "Te sentás a descansar");
  sendYou(p);
}

function tryPay(p: Player, targetName: string, amount: number, now: number): void {
  if (p.dead) return;
  const name = String(targetName || "").trim();
  const gold = Math.floor(amount);
  if (!name || !Number.isFinite(gold) || gold < 1) return toast(p, "Uso: /pay Nombre cantidad");
  if (gold > 50000) return toast(p, "Máximo 50.000 de oro por envío");
  if (waitToast(p, p.lastPayAt, 1500, now)) return;
  if (name.toLowerCase() === p.name.toLowerCase()) return toast(p, "No podés pagarte a vos mismo");
  const target = playerByName(name, true);
  if (!needOnline(p, target)) return;
  if (tooFar(p, target, DUEL_RANGE)) return;
  if (needGold(p, gold)) return;
  p.gold -= gold;
  target.gold += gold;
  noteGold(target, gold);
  p.lastPayAt = now;
  p.dirty = true;
  target.dirty = true;
  toast(p, `Le diste ${gold} de oro a ${target.name}`);
  toast(target, `${p.name} te dio ${gold} de oro`);
  sendYou(p);
  sendYou(target);
}

// ---------------------------------------------------------------------------
// Quests / dialog
// ---------------------------------------------------------------------------
function questState(p: Player, qid: string): string {
  const q = p.quests[qid];
  if (q) return q.turned ? "turned" : q.done ? "complete" : "active";
  const idx = QUEST_ORDER.indexOf(qid);
  if (idx === 0) return "available";
  const prev = p.quests[QUEST_ORDER[idx - 1]];
  return prev?.turned ? "available" : "locked";
}

const REWARD_WEAPON_ES: Record<string, string> = {
  sword: "espada mágica", axe: "hacha mágica", bow: "arco mágico", staff: "bastón mágico",
};

function rewardText(item: string | undefined, cls: string): string | undefined {
  if (!item) return undefined;
  if (item === "weapon") return REWARD_WEAPON_ES[CLASS_WEAPON[cls]] ?? "arma mágica";
  if (item === "armor") return "armadura mágica";
  return "objeto raro";
}



function retroUnlockPortals(p: Player): void {
  // Veterans who cleared the east: unlock portals without forcing a re-walk.
  if (p.lvl >= 5) unlockPortal(p, "olivares", true);
  if (p.lvl >= 8) unlockPortal(p, "argos", true);
  if (p.lvl >= 11) unlockPortal(p, "gorgona", true);
  if (p.lvl >= 15 || p.quests.q6?.done || p.quests.q6?.turned) unlockPortal(p, "ciclope", true);
  if (p.quests.q6?.done || p.quests.q6?.turned || p.quests.q7) unlockPortal(p, "asfodelos", true);
  if (p.lvl >= 21) unlockPortal(p, "hidra", true);
}

function unlockPortal(p: Player, id: string, silent = false): void {
  if (!PORTAL_WAYPOINTS[id]) return;
  if (!p.visitedZones.includes(id)) {
    p.visitedZones.push(id);
    p.dirty = true;
    if (!silent) toast(p, `Portal desbloqueado: ${PORTAL_WAYPOINTS[id].label}`);
    checkProgressAchs(p);
  }
}

function checkZoneVisit(p: Player): void {
  const zx = Math.floor(p.x), zy = Math.floor(p.y);
  for (const z of ZONES) {
    if (!inRect(zx, zy, z)) continue;
    const pid = ZONE_PORTAL_ID[z.name];
    if (pid) unlockPortal(p, pid);
  }
}

function sendBoard(p: Player): void {
  const rows = qBoardList.all();
  send(p.ws, {
    t: "board", npc: board.id, name: board.name,
    isMod: isBoardMod(p),
    hasActive: rows.some((r) => r.author === p.name),
    cooldownUntil: boardCdUntil.get(p.id) ?? 0,
    entries: rows.map((r) => ({ id: r.id, author: r.author, text: r.text, ts: r.created })),
  });
}

function sendPortalDialog(p: Player): void {
  const destinations = Object.entries(PORTAL_WAYPOINTS).map(([id, wp]) => ({
    id,
    label: wp.label,
    unlocked: id === "helike" || p.visitedZones.includes(id),
  }));
  send(p.ws, {
    t: "portal",
    npc: portalNpc.id,
    name: portalNpc.name,
    lines: NPC_LINES.portal,
    destinations,
  });
}

function sendElderDialog(p: Player): void {
  send(p.ws, {
    t: "dialog", npc: elder.id, name: elder.name, kind: "elder",
    lines: NPC_LINES.elder,
    quests: QUEST_ORDER.map((qid) => {
      const def = QUESTS[qid];
      return {
        qid, name: def.name, desc: def.desc, state: questState(p, qid),
        n: p.quests[qid]?.n ?? 0, count: def.count,
        rew: { xp: def.rew.xp, gold: def.rew.gold, item: rewardText(def.rew.item, p.cls) },
      };
    }),
  });
}

function questReward(p: Player, item: "weapon" | "armor" | "rare"): Item {
  if (item === "weapon") return rollItem("weapon", 2, "magic", CLASS_WEAPON[p.cls]);
  if (item === "armor") return rollItem("armor", 3, "magic");
  return rollItem(pickSlot(EQUIP_SLOTS), 4, "rare", CLASS_WEAPON[p.cls]);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function defaultPlayer(name: string, cls: string, ws: WS): Player {
  const base = CLASS_BASE[cls];
  const p: Player = {
    id: nextEntId++, ws, name, cls,
    lvl: 1, xp: 0, gold: 25, pts: 0,
    abilityPts: 0, abilities: new Map<string, number>(), loadout: [1, 2, 3, 4],
    pets: new Set<string>(), activePet: null,
    mounts: new Set<string>(), activeMount: null, mounted: false, sitting: false, lastPayAt: 0,
    tradeId: null, lastTradeReqAt: 0,
    duelWith: null, duelWins: 0, salvageCount: 0, lastDuelReqAt: 0, duelInvites: new Map(),
    forageCount: 0, forageUntil: 0, brewCount: 0, bindX: 0, bindY: 0,
    str: base.str, dex: base.dex, int: base.int,
    hp: 0, mp: 0,
    x: TOWN.x + 0.5 + (Math.random() - 0.5) * 2, y: TOWN.y + 3.5,
    inv: new Array(INV_SIZE).fill(null),
    stash: new Array(STASH_SIZE).fill(null),
    eq: { weapon: null, armor: null, helm: null, ring: null },
    quests: {},
    visitedZones: ["helike"],
    path: null, direct: null, vel: null, atkTarget: null, lootTarget: null, npcTarget: null, nextAtk: 0, repathAt: 0,
    skillCds: [0, 0, 0, 0, 0], potCdUntil: 0, combatUntil: 0, recallCdUntil: 0,
    killStreak: 0, killStreakAt: 0, restedUntil: 0, restAccum: 0,
    buyback: [], lastPingAt: 0, lastWhoAt: 0,
    recentHits: [], lootHist: [], combatLog: [], lastDaily: "", lastEmoteAt: 0,
    achs: new Set<string>(), killCount: 0, goldEarned: 0, fishCount: 0, fishUntil: 0,
    cookCount: 0, cookUntil: 0, cookSlot: -1, title: "",
    buffUntil: 0, buffDmgp: 0, buffArm: 0, buffSpd: 0, buffXp: 0,
    session: { dealt: 0, taken: 0, healed: 0, kills: 0, deaths: 0, t0: Date.now() },
    meterAt: 0,
    dead: false, deadAt: 0, lastChat: 0, dirty: true, seen: new Set(),
    party: null, partyId: null, invites: new Map(), disconnectedAt: null, followId: null,
    followStuck: 0,
    slowUntil: 0, slowPct: 0, stunUntil: 0, lastAtk: 0, moving: false, d: 0,
  };
  const d = derive(p);
  p.hp = d.mhp;
  p.mp = d.mmp;
  return p;
}

function sanitizeItem(v: unknown): Item | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.base !== "string" || typeof o.slot !== "string" || typeof o.name !== "string") return null;
  const it: Item = {
    id: freshItemId(), base: o.base, name: String(o.name).slice(0, 48),
    slot: String(o.slot), icon: typeof o.icon === "string" ? o.icon : "sword",
    tier: clampInt(o.tier, 1, 5, 1), rarity: typeof o.rarity === "string" ? o.rarity : "common",
    lvl: clampInt(o.lvl, 1, 21, 1), val: clampInt(o.val, 0, 100000, 0),
  };
  if (Array.isArray(o.dmg) && o.dmg.length === 2)
    it.dmg = [clampInt(o.dmg[0], 1, 999, 1), clampInt(o.dmg[1], 1, 999, 3)];
  if (typeof o.arm === "number") it.arm = clampInt(o.arm, 0, 999, 0);
  if (o.mods && typeof o.mods === "object") {
    it.mods = {};
    for (const [k, mv] of Object.entries(o.mods as Record<string, unknown>))
      if (typeof mv === "number" && Number.isFinite(mv)) it.mods[k] = clampInt(mv, 0, 999, 0);
  }
  if (typeof o.qty === "number") it.qty = clampInt(o.qty, 1, 10, 1);
  return it;
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : dflt;
  return Math.max(lo, Math.min(hi, n));
}

function loadPlayer(name: string, cls: string, data: string, ws: WS): Player {
  const p = defaultPlayer(name, cls, ws);
  try {
    const d = JSON.parse(data) as Record<string, unknown>;
    p.lvl = clampInt(d.lvl, 1, LEVEL_CAP, 1);
    p.xp = clampInt(d.xp, 0, 10000000, 0);
    p.gold = clampInt(d.gold, 0, 100000000, 0);
    p.pts = clampInt(d.pts, 0, 3 * LEVEL_CAP, 0);
    // Migración: blobs antiguos (pre-árbol) no traen abilityPts — se rellenan
    // retroactivamente para TODAS las clases (1 por nivel ya ganado). Los
    // `abilities` legados de clérigo eran un array de ids: cada id que siga
    // existiendo en el árbol nuevo pasa a rango 1; los eliminados devuelven
    // su punto. El formato nuevo es un objeto {id: rango}. Nivel/xp/oro/
    // inventario/posición no se tocan.
    p.abilityPts = clampInt(d.abilityPts ?? (p.lvl - 1), 0, LEVEL_CAP, 0);
    const byId = TREE_BY_ID[cls] ?? {};
    if (Array.isArray(d.abilities)) {
      for (const id of d.abilities) {
        if (typeof id !== "string") continue;
        if (byId[id]) p.abilities.set(id, 1);
        else p.abilityPts = Math.min(LEVEL_CAP, p.abilityPts + 1); // nodo eliminado: reembolso
      }
    } else if (d.abilities && typeof d.abilities === "object") {
      for (const [id, rv] of Object.entries(d.abilities as Record<string, unknown>)) {
        const r = clampInt(rv, 0, 5, 0);
        if (r < 1) continue;
        if (byId[id]) p.abilities.set(id, Math.min(r, byId[id].max));
        else p.abilityPts = Math.min(LEVEL_CAP, p.abilityPts + r); // nodo eliminado: reembolso
      }
    }
    // Loadout: qué SkillDef.n de la clase está equipado en cada slot 1-4 de la
    // barra. Blobs legados (o corruptos) sin un array válido de 4 números
    // caen al mapeo fijo original 1-2-3-4 para que la barra nunca quede vacía.
    if (
      Array.isArray(d.loadout) && d.loadout.length === 4 &&
      d.loadout.every((v) => typeof v === "number" && Number.isInteger(v) && (v === 0 || SKILLS[cls]?.some((s) => s.n === v)))
    ) {
      p.loadout = d.loadout as number[];
    }
    const base = CLASS_BASE[cls];
    p.str = clampInt(d.str, base.str, 200, base.str);
    p.dex = clampInt(d.dex, base.dex, 200, base.dex);
    p.int = clampInt(d.int, base.int, 200, base.int);
    if (typeof d.x === "number" && typeof d.y === "number" && walkableAt(d.x, d.y)) {
      p.x = d.x;
      p.y = d.y;
    }
    if (Array.isArray(d.inv))
      for (let i = 0; i < INV_SIZE; i++) p.inv[i] = sanitizeItem(d.inv[i]);
    if (Array.isArray(d.stash))
      for (let i = 0; i < STASH_SIZE; i++) p.stash[i] = sanitizeItem(d.stash[i]);
    if (Array.isArray(d.pets))
      p.pets = new Set((d.pets as unknown[]).filter((v): v is string => typeof v === "string" && Boolean(PET_DEFS[v])));
    if (typeof d.activePet === "string" && p.pets.has(d.activePet)) p.activePet = d.activePet;
    if (Array.isArray(d.mounts))
      p.mounts = new Set((d.mounts as unknown[]).filter((v): v is string => typeof v === "string" && Boolean(MOUNT_DEFS[v])));
    if (typeof d.activeMount === "string" && p.mounts.has(d.activeMount)) p.activeMount = d.activeMount;
    if (typeof d.lastDaily === "string") p.lastDaily = d.lastDaily.slice(0, 16);
    if (Array.isArray(d.achs))
      p.achs = new Set((d.achs as unknown[]).filter((v): v is string => typeof v === "string" && Boolean(ACHIEVEMENTS[v])));
    p.killCount = clampInt(d.killCount, 0, 100000000, 0);
    p.goldEarned = clampInt(d.goldEarned, 0, 100000000, 0);
    p.fishCount = clampInt(d.fishCount, 0, 100000000, 0);
    p.cookCount = clampInt(d.cookCount, 0, 100000000, 0);
    p.forageCount = clampInt(d.forageCount, 0, 100000000, 0);
    p.brewCount = clampInt(d.brewCount, 0, 100000000, 0);
    p.duelWins = clampInt(d.duelWins, 0, 100000000, 0);
    p.salvageCount = clampInt(d.salvageCount, 0, 100000000, 0);
    p.bindX = typeof d.bindX === "number" && Number.isFinite(d.bindX) ? d.bindX : 0;
    p.bindY = typeof d.bindY === "number" && Number.isFinite(d.bindY) ? d.bindY : 0;
    p.title = typeof d.title === "string" && ACHIEVEMENTS[d.title] && p.achs.has(d.title) ? d.title : "";
    if (d.eq && typeof d.eq === "object") {
      const eq = d.eq as Record<string, unknown>;
      for (const slot of EQUIP_SLOTS) {
        const it = sanitizeItem(eq[slot]);
        p.eq[slot] = it && it.slot === slot ? it : null;
      }
    }
    if (d.quests && typeof d.quests === "object") {
      for (const [qid, qv] of Object.entries(d.quests as Record<string, unknown>)) {
        if (!QUESTS[qid] || !qv || typeof qv !== "object") continue;
        const q = qv as Record<string, unknown>;
        p.quests[qid] = {
          n: clampInt(q.n, 0, QUESTS[qid].count, 0),
          done: q.done === true,
          turned: q.turned === true,
        };
      }
    }
    const dv = derive(p);
    p.hp = clampInt(d.hp, 1, dv.mhp, dv.mhp);
    p.mp = clampInt(d.mp, 0, dv.mmp, dv.mmp);
    if (Array.isArray(d.visitedZones)) {
      const ok = new Set(Object.keys(PORTAL_WAYPOINTS));
      p.visitedZones = d.visitedZones.filter((z): z is string => typeof z === "string" && ok.has(z));
      if (!p.visitedZones.includes("helike")) p.visitedZones.unshift("helike");
    }
    if (typeof d.partyId === "string" && d.partyId.length > 0 && d.partyId.length <= 64)
      p.partyId = d.partyId;
  } catch {
    // corrupted blob: keep freshly-rolled defaults
  }
  syncCollectQuests(p);
  return p;
}

async function handleLogin(ws: WS, msg: Record<string, unknown>): Promise<void> {
  const sess = ws.data;
  if (sess.player || sess.loggingIn) return;
  const name = strMsg(msg.name);
  const pass = strMsg(msg.pass);
  const cls = strMsg(msg.cls);
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return send(ws, { t: "err", msg: "El nombre debe tener 3-16 letras, dígitos o _" });
  if (pass.length < 4) return send(ws, { t: "err", msg: "La contraseña debe tener al menos 4 caracteres" });
  const ipKey = `ip:${sess.ip}`, acctKey = `acct:${name.toLowerCase()}`;
  const lockedMs = Math.max(loginLockedMs(ipKey), loginLockedMs(acctKey));
  if (lockedMs > 0)
    return send(ws, { t: "err", msg: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(lockedMs / 1000)}s` });

  sess.loggingIn = true;
  try {
    const row = qGet.get(name);
    let player: Player;
    if (row) {
      const ok = await Bun.password.verify(pass, row.pass).catch(() => false);
      if (!ok) {
        recordLoginFail(ipKey);
        recordLoginFail(acctKey);
        return send(ws, { t: "err", msg: "Contraseña incorrecta" });
      }
      const existing = players.get(name);
      if (existing) {
        // Kick the older socket, keep the live in-memory state.
        const old = existing.ws;
        existing.ws = null;
        if (old) {
          old.data.player = null;
          send(old, { t: "err", msg: "Iniciaste sesión en otro lugar" });
          old.close();
        }
        savePlayer(existing);
        existing.ws = ws;
        existing.disconnectedAt = null; // reconnected within the grace window — keeps party, invites, etc.
        existing.seen = new Set();
        player = existing;
      } else {
        player = loadPlayer(name, row.cls, row.data, ws);
        players.set(name, player);
        playersById.set(player.id, player);
      }
    } else {
      if (!CLASS_BASE[cls]) return send(ws, { t: "err", msg: "Elige una clase: guerrero, cazador, mago o clérigo" });
      const hash = await Bun.password.hash(pass);
      player = defaultPlayer(name, cls, ws);
      qInsert.run(name, hash, cls, serialize(player), Date.now());
      players.set(name, player);
      playersById.set(player.id, player);
    }
    sess.player = player;
    clearLoginFails(ipKey);
    clearLoginFails(acctKey);
    // Reattach durable party (survives logout + server restart) unless already linked via linger reconnect.
    if (!player.party) restoreParty(player);
    else persistParty(player.party);
    ensureBotLoadout(player);
    ensureBotSquadParty(player);
    send(ws, {
      t: "welcome", id: player.id, name: player.name, cls: player.cls,
      skills: SKILLS[player.cls].map((s) => ({ n: s.n, name: s.name, desc: s.desc, cost: s.cost, cd: s.cd, unlock: s.unlock, kind: s.kind })),
      abilityTree: TREES[player.cls] ?? [],
      loadout: player.loadout,
    });
    ws.send(MAP_MSG);
    sendYou(player);
    // Reconnecting while dead used to hide the revive UI (welcome clears it) and never
    // re-send {t:"dead"}, leaving the player invisible/stuck with no Resucitar button.
    if (player.dead) send(ws, { t: "dead", reviveAt: player.deadAt + REVIVE_MS });
    // Test-only: drop a potion ~8 tiles east so loot-chase can be verified without a kill.
    if (process.env.RPG_TEST_LOOT === "1") {
      let dx = 8, dy = 0;
      while (dx > 1 && !walkableAt(player.x + dx, player.y + dy)) dx -= 1;
      dropItem(player.x + dx, player.y + dy, makePotion("hp1"));
    }
    retroUnlockPortals(player);
    checkZoneVisit(player);
    if (player.party) partyBcast(player.party); // reenvía el roster tras reconectar / restaurar
    if (player.followId != null) send(ws, { t: "follow_state", id: player.followId });
    sendLootLog(player);
    sendCombatLog(player);
    sendAchs(player);
    sendMeter(player, true);
    checkProgressAchs(player);
    if (!BOT_SQUAD.has(player.name)) {
      const day = new Date().toISOString().slice(0, 10);
      if (player.lastDaily !== day) {
        const bonus = 40 + 12 * player.lvl;
        player.gold += bonus;
        noteGold(player, bonus);
        player.lastDaily = day;
        player.dirty = true;
        toast(player, `Bonus diario: +${bonus} de oro`);
        pushLootLog(player, { name: "Bonus diario", rarity: "magic", icon: "coin", gold: bonus });
        sendYou(player);
      }
      sysChat(`${player.name} ha entrado en Helike.`);
    }
  } finally {
    sess.loggingIn = false;
  }
}

const MAP_MSG = JSON.stringify({
  t: "map", w: W, h: W, tiles: world.tiles, town: { x: TOWN.x, y: TOWN.y }, zones: ZONES,
});

// ---------------------------------------------------------------------------
// Client message handlers
// ---------------------------------------------------------------------------
function nearNpc(p: Player, npc: Npc, range = 3): boolean {
  return dist(p.x, p.y, npc.x, npc.y) <= range;
}

const MSG_STASH = "Tenés que estar junto al cofre";
const MSG_CRIADERO = "Tenés que estar junto al criadero";
const MSG_ELDER = "Tenés que hablar con Nikandros";
const MSG_BOARD = "Tenés que estar junto al tablón de peticiones";
const MSG_PORTAL = "Tenés que estar junto al Portal";
const MSG_KORA = "Prepara brebajes junto a Kora";
const MSG_COOK = "Cocina junto a la forja de Bront";
const MSG_SALVAGE = "Desguazá equipo en la forja de Bront";

function needNpc(p: Player, npc: Npc, msg: string, range = 3): boolean {
  if (!nearNpc(p, npc, range)) { toast(p, msg); return true; }
  return false;
}

function buyAtCriadero(
  p: Player,
  owned: Set<string>,
  id: string,
  def: { cost: number; name: string } | undefined,
  alreadyMsg: string,
): def is { cost: number; name: string } {
  if (p.dead) return false;
  if (needNpc(p, petshopNpc, MSG_CRIADERO)) return false;
  if (!def || !id) return false;
  if (owned.has(id)) { toast(p, alreadyMsg); return false; }
  if (needGold(p, def.cost)) return false;
  p.gold -= def.cost;
  return true;
}

function finishCriaderoBuy(
  p: Player,
  owned: Set<string>,
  id: string,
  def: { cost: number; name: string } | undefined,
  alreadyMsg: string,
  achId: string,
  doneMsg: string,
  afterPay?: () => void,
): boolean {
  if (!buyAtCriadero(p, owned, id, def, alreadyMsg)) return false;
  owned.add(id);
  if (afterPay) afterPay();
  p.dirty = true;
  grantAch(p, achId);
  syncPetShop(p);
  toast(p, doneMsg);
  return true;
}
function equipCriadero(
  p: Player,
  id: string,
  owned: Set<string>,
  defs: Record<string, { name: string }>,
  setActive: (next: string | null) => void,
  onMsg: (active: string | null) => string,
  onClear?: () => void,
): void {
  if (p.dead) return;
  if (id && (!defs[id] || !owned.has(id))) return;
  const next = id || null;
  setActive(next);
  if (!next && onClear) onClear();
  p.dirty = true;
  toast(p, onMsg(next));
  syncPetShop(p);
}


function syncPetShop(p: Player): void {
  sendYou(p);
  sendPetShop(p);
}

function syncStash(p: Player): void {
  sendYou(p);
  sendStash(p);
}

function syncElder(p: Player): void {
  sendYou(p);
  sendElderDialog(p);
}

function syncBuyback(p: Player): void {
  sendYou(p);
  sendBuyback(p);
}

function syncShop(p: Player, npc: Npc): void {
  sendShop(p, npc);
  sendYou(p);
}

/** After a sale, refresh the nearby merchant panel (or buyback alone). */
function syncMerchant(p: Player): void {
  sendYou(p);
  if (nearNpc(p, kora)) sendShop(p, kora);
  else if (nearNpc(p, bront)) sendShop(p, bront);
  else sendBuyback(p);
}

function channelCast(p: Player, msg: string, fx: string): void {
  toast(p, msg);
  bcastAt(p.x, p.y, { t: "fx", k: fx, i: p.id });
}

const QUEST_PORTAL_ACCEPT: Record<string, string> = {
  q7: "asfodelos",
  q10: "hidra",
};
const QUEST_PORTAL_TURNIN: Record<string, string> = {
  q6: "asfodelos",
  q9: "hidra",
};

function unlockQuestPortal(p: Player, qid: string, table: Record<string, string>): void {
  const id = table[qid];
  if (id) unlockPortal(p, id, true);
}

function readIdx(msg: { idx?: unknown }, size: number): number | null {
  const idx = num(msg.idx);
  if (idx == null || !Number.isInteger(idx) || idx < 0 || idx >= size) return null;
  return idx;
}

/** Loot log + local FX + you refresh after a gather/craft success. */
function lootFx(p: Player, entry: { name: string; rarity: string; icon: string; gold?: number }, fx: string): void {
  pushLootLog(p, entry);
  bcastAt(p.x, p.y, { t: "fx", k: fx, i: p.id });
  sendYou(p);
}

function toastRare(p: Player, rare: boolean, rareMsg: string, normalMsg: string): void {
  toast(p, rare ? rareMsg : normalMsg);
}

function notePickup(p: Player, item: Item): void {
  pushLootLog(p, { name: item.name, rarity: item.rarity || "common", icon: item.icon || "sword" });
  if (item.rarity === "rare") toast(p, `¡Raro! Recogiste ${item.name}`);
  updateCollect(p);
  sendYou(p);
}


/** Open an NPC's dialog/shop/board panel for the player. Assumes proximity already checked. */
function openNpcDialog(p: Player, npc: Npc): void {
  if (npc.kind === "elder") sendElderDialog(p);
  else if (npc.kind === "portal") sendPortalDialog(p);
  else if (npc.kind === "board") sendBoard(p);
  else if (npc.kind === "stash") sendStash(p);
  else if (npc.kind === "petshop") sendPetShop(p);
  else {
    send(p.ws, { t: "dialog", npc: npc.id, name: npc.name, kind: npc.kind, lines: NPC_LINES[npc.kind] });
    sendShop(p, npc);
  }
}

/** Pick ground loot if in range. true = done (picked / gone / full), false = still need to approach. */
function tryPickupLoot(p: Player, id: number): boolean {
  const l = loot.get(id);
  if (!l) return true;
  if (dist(p.x, p.y, l.x, l.y) > 2) return false;
  if (!invAdd(p, l.item)) {
    invFull(p);
    return true;
  }
  loot.delete(id);
  notePickup(p, l.item);
  return true;
}

function handleMsg(ws: WS, raw: string | Buffer): void {
  let msg: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    msg = parsed as Record<string, unknown>;
  } catch {
    if (++ws.data.badJson >= 5) ws.close();
    return;
  }
  if (!takeToken(ws.data)) return; // over the per-connection message budget: silently drop
  const t = msg.t;
  if (t === "login") {
    void handleLogin(ws, msg).catch((e) => {
      console.error("[rpg] login error:", e);
      send(ws, { t: "err", msg: "Error al iniciar sesión, inténtalo de nuevo" });
    });
    return;
  }
  const p = ws.data.player;
  if (!p) return;
  const now = Date.now();
  const stunned = now < p.stunUntil;

  switch (t) {
    case "move": {
      if (p.dead || stunned) return;
      const x = num(msg.x), y = num(msg.y);
      if (x == null || y == null) return;
      if (p.sitting) standUp(p);
      const tx = Math.max(0.5, Math.min(W - 0.5, x));
      const ty = Math.max(0.5, Math.min(W - 0.5, y));
      clearMobility(p);
      setPathTo(p, tx, ty);
      break;
    }
    case "dir": {
      // Velocity movement: accepts cardinal WASD (-1..1) or analog joystick floats.
      // Non-zero also cancels the auto-attack / loot locks.
      if (p.dead) return;
      const dx = num(msg.x), dy = num(msg.y);
      if (dx == null || dy == null) return;
      const cx = Math.max(-1, Math.min(1, dx));
      const cy = Math.max(-1, Math.min(1, dy));
      const mag = Math.hypot(cx, cy);
      if (mag < 0.2) { p.vel = null; break; }
      if (p.sitting) standUp(p);
      // Keep direction continuous (no 4/8-way snap) so mobile joystick feels natural.
      p.vel = { x: cx / mag, y: cy / mag };
      clearMobility(p, true);
      break;
    }
    case "attack": {
      if (p.dead || stunned) return;
      dismountAndStand(p);
      const id = num(msg.id);
      if (id == null) return;
      // id:0 = explicit cancel (empty-ground click / drop target).
      if (id === 0) {
        clearMobility(p);
        break;
      }
      const m = mobById(id);
      if (m && !m.dead) {
        clearMobility(p);
        p.atkTarget = m.id;
        p.repathAt = 0;
        break;
      }
      const foe = playerById(id);
      if (foe && areDueling(p, foe)) {
        clearMobility(p);
        p.atkTarget = foe.id;
        p.repathAt = 0;
        break;
      }
      break;
    }
    case "skill": {
      if (p.dead || stunned) return;
      const n = num(msg.n);
      if (n == null || n < 1 || n > (SKILLS[p.cls]?.length ?? 4)) return;
      useSkill(p, n, num(msg.id), num(msg.x), num(msg.y));
      break;
    }
    case "skill_equip": {
      if (p.dead) return;
      const slot = num(msg.slot);
      const n = num(msg.n);
      if (slot == null || slot < 1 || slot > 4) return;
      if (n == null || (n !== 0 && !SKILLS[p.cls]?.some((s) => s.n === n))) return;
      p.loadout[slot - 1] = n;
      p.dirty = true;
      sendYou(p);
      break;
    }
    case "pickup": {
      if (p.dead) return;
      const id = num(msg.id);
      if (id == null) return;
      if (!loot.get(id)) return;
      // Same lock+chase pattern as attack: approach until within 2 tiles, then pick.
      clearMobility(p);
      p.lootTarget = id;
      p.repathAt = 0;
      if (tryPickupLoot(p, id)) p.lootTarget = null;
      break;
    }
    case "talk": {
      if (p.dead) return;
      const id = num(msg.id);
      const npc = npcs.find((n) => n.id === id);
      if (!npc) return;
      if (nearNpc(p, npc)) {
        clearMobility(p);
        openNpcDialog(p, npc);
      } else {
        // Same lock+chase pattern as attack/pickup: walk over, then open once in range.
        clearMobility(p);
        p.npcTarget = npc.id;
        p.repathAt = 0;
      }
      break;
    }
    case "board_post": {
      if (p.dead) return;
      if (needNpc(p, board, MSG_BOARD)) return;
      if (!isBoardMod(p) && qBoardFindByAuthor.get(p.name)) {
        sendBoard(p);
        return toast(p, "Ya tenés una petición activa — esperá a que un moderador la resuelva");
      }
      const raw = strMsg(msg.text).trim();
      if (raw.length < 3) return toast(p, "Escribe un poco más");
      if (raw.length > 240) return toast(p, "Máximo 240 caracteres");
      const readyAt = boardCdUntil.get(p.id) ?? 0;
      if (now < readyAt) return toast(p, `Esperá ${Math.ceil((readyAt - now) / 1000)}s para publicar de nuevo`);
      boardCdUntil.set(p.id, now + BOARD_POST_CD);
      qBoardInsert.run(p.name, raw, now);
      sendBoard(p);
      toast(p, "Petición publicada — ¡gracias!");
      break;
    }
    case "board_delete": {
      if (p.dead) return;
      if (!isBoardMod(p)) return toast(p, "No tenés permiso para borrar peticiones");
      const id = num(msg.id);
      if (id == null) return;
      qBoardDelete.run(id);
      sendBoard(p);
      break;
    }
    case "board_edit": {
      if (p.dead) return;
      if (!isBoardMod(p)) return toast(p, "No tenés permiso para editar peticiones");
      const id = num(msg.id);
      const raw = strMsg(msg.text).trim();
      if (id == null || raw.length < 3 || raw.length > 240) return;
      qBoardUpdate.run(id, raw);
      sendBoard(p);
      break;
    }
    case "ability_alloc": {
      if (p.dead) return;
      const id = strMsg(msg.id);
      const def = TREE_BY_ID[p.cls]?.[id];
      if (!def) return;
      const cur = abilityRank(p, id);
      if (cur >= def.max) return toast(p, "Ese nodo ya está al rango máximo");
      if (p.abilityPts < 1) return toast(p, "No tenés puntos de habilidad");
      if (spentPoints(p) < tierReq(def.tier))
        return toast(p, `Necesitas ${tierReq(def.tier)} puntos gastados en el árbol`);
      p.abilities.set(id, cur + 1);
      p.abilityPts -= 1;
      sendYou(p);
      break;
    }
    case "ability_reset": {
      if (p.dead) return;
      let refund = 0;
      for (const r of p.abilities.values()) refund += r;
      if (refund === 0) return toast(p, "No tenés puntos de habilidad gastados");
      p.abilities.clear();
      p.abilityPts += refund;
      p.dirty = true;
      sendYou(p);
      toast(p, "Árbol de habilidades reiniciado");
      break;
    }
    case "stat_reset": {
      if (p.dead) return;
      const base = CLASS_BASE[p.cls];
      const refund = (p.str - base.str) + (p.dex - base.dex) + (p.int - base.int);
      if (refund === 0) return toast(p, "No tenés puntos de característica gastados");
      p.pts += refund;
      p.str = base.str; p.dex = base.dex; p.int = base.int;
      p.dirty = true;
      sendYou(p);
      toast(p, "Características reiniciadas");
      break;
    }
    case "buy": {
      if (p.dead) return;
      const npcId = num(msg.npc), idx = num(msg.idx);
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || (npc !== kora && npc !== bront) || !nearNpc(p, npc)) return;
      const stock = npc === kora ? koraStock : brontStock;
      if (idx == null || !Number.isInteger(idx) || idx < 0 || idx >= stock.length) return;
      const entry = stock[idx];
      const price = entry.item.val;
      if (needGold(p, price)) return;
      // Infinite stock hands out fresh copies; uniques transfer + leave stock.
      const bought = entry.infinite ? makePotion(entry.item.base) : entry.item;
      if (!invAdd(p, bought)) return invFull(p);
      p.gold -= price;
      if (!entry.infinite) stock.splice(idx, 1);
      syncShop(p, npc);
      break;
    }
    case "sell": {
      if (p.dead) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      if (needMerchant(p)) return;
      const it = p.inv[slot];
      if (!it) return;
      if (it.slot === "quest") return questItemBlocked(p, "vender");
      const gain = sellValue(it);
      p.gold += gain;
      noteGold(p, gain);
      p.inv[slot] = null;
      pushBuyback(p, it, gain);
      toast(p, `Vendiste ${it.name} por ${gain} de oro`);
      syncMerchant(p);
      break;
    }
    case "sell_all": {
      if (p.dead) return;
      const rarity = strMsg(msg.rarity);
      if (rarity !== "common" && rarity !== "magic" && rarity !== "rare") return;
      if (needMerchant(p)) return;
      let gain = 0, count = 0;
      for (let i = 0; i < INV_SIZE; i++) {
        const it = p.inv[i];
        if (!it || it.slot === "quest" || it.rarity !== rarity) continue;
        const price = sellValue(it);
        gain += price;
        count++;
        pushBuyback(p, it, price);
        p.inv[i] = null;
      }
      if (count === 0) return toast(p, "No tenés objetos de esa rareza para vender");
      p.gold += gain;
      noteGold(p, gain);
      toast(p, `Vendiste ${count} objeto${count === 1 ? "" : "s"} por ${gain} de oro`);
      syncMerchant(p);
      break;
    }
    case "buyback": {
      if (p.dead) return;
      if (needMerchant(p)) return;
      const idx = readIdx(msg, p.buyback.length);
      if (idx == null) return;
      const entry = p.buyback[idx];
      if (needGold(p, entry.price)) return;
      if (!invAdd(p, entry.item)) return invFull(p);
      p.gold -= entry.price;
      p.buyback.splice(idx, 1);
      toast(p, `Recompraste ${entry.item.name}`);
      syncBuyback(p);
      break;
    }
    case "inv_sort": {
      if (p.dead) return;
      const rank: Record<string, number> = { rare: 0, magic: 1, common: 2 };
      const slotRank: Record<string, number> = { weapon: 0, armor: 1, helm: 2, ring: 3, potion: 4, quest: 5 };
      const items = p.inv.filter((it): it is Item => Boolean(it));
      items.sort((a, b) => {
        const rr = (rank[a.rarity] ?? 9) - (rank[b.rarity] ?? 9);
        if (rr) return rr;
        const sr = (slotRank[a.slot] ?? 9) - (slotRank[b.slot] ?? 9);
        if (sr) return sr;
        const tr = (b.tier || 0) - (a.tier || 0);
        if (tr) return tr;
        return a.name.localeCompare(b.name, "es");
      });
      for (let i = 0; i < INV_SIZE; i++) p.inv[i] = items[i] ?? null;
      p.dirty = true;
      sendYou(p);
      break;
    }
    case "stash_deposit": {
      if (p.dead) return;
      if (needNpc(p, stashNpc, MSG_STASH)) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      const it = p.inv[slot];
      if (!it) return;
      if (it.slot === "quest") return questItemBlocked(p, "guardar");
      if (!addToSlots(p.stash, it)) return toast(p, "El cofre está lleno");
      p.inv[slot] = null;
      syncStash(p);
      break;
    }
    case "stash_withdraw": {
      if (p.dead) return;
      if (needNpc(p, stashNpc, MSG_STASH)) return;
      const slot = readSlot(msg, STASH_SIZE);
      if (slot == null) return;
      const it = p.stash[slot];
      if (!it) return;
      if (!invAdd(p, it)) return invFull(p);
      p.stash[slot] = null;
      syncStash(p);
      break;
    }
    case "pet_buy": {
      const id = strMsg(msg.id);
      const def = PET_DEFS[id];
      finishCriaderoBuy(p, p.pets, id, def, "Ya tenés esa mascota", "pet_1", def ? `Adoptaste a ${def.name}` : "");
      break;
    }
    case "pet_equip": {
      const id = strMsg(msg.id);
      equipCriadero(p, id, p.pets, PET_DEFS, (next) => { p.activePet = next; }, (active) =>
        active ? `Tu ${PET_DEFS[active].name} te sigue` : "Mandaste tu mascota al Criadero");
      break;
    }
    case "mount_buy": {
      const id = strMsg(msg.id);
      const def = MOUNT_DEFS[id];
      finishCriaderoBuy(p, p.mounts, id, def, "Ya tenés esa montura", "mount_1", def ? `Compraste: ${def.name}` : "", () => {
        if (!p.activeMount) p.activeMount = id;
      });
      break;
    }
    case "mount_equip": {
      const id = strMsg(msg.id);
      equipCriadero(p, id, p.mounts, MOUNT_DEFS, (next) => { p.activeMount = next; }, (active) =>
        active ? `Montura lista: ${MOUNT_DEFS[active].name}` : "Sin montura activa", () => dismount(p, true));
      break;
    }
    case "mount": {
      if (p.dead || stunned) return;
      tryMount(p);
      break;
    }
    case "sit": {
      if (p.dead || stunned) return;
      trySit(p);
      break;
    }
    case "pay": {
      const name = strMsg(msg.name);
      const gold = num(msg.gold);
      if (gold == null) return;
      tryPay(p, name, gold, now);
      break;
    }
    case "drop": {
      if (p.dead || stunned) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      const it = p.inv[slot];
      if (!it) return;
      if (it.slot === "quest") return questItemBlocked(p, "tirar");
      // Drop one unit from stacks; full item otherwise. Shared ground loot — anyone can pick it up.
      let dropped: Item;
      const qty = it.qty ?? 1;
      if (qty > 1) {
        it.qty = qty - 1;
        dropped = { ...it, id: freshItemId(), qty: 1 };
      } else {
        p.inv[slot] = null;
        dropped = it;
      }
      dropItem(p.x, p.y, dropped);
      updateCollect(p);
      toast(p, `Tiraste ${dropped.name}`);
      sendYou(p);
      break;
    }
    case "equip": {
      if (p.dead || stunned) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      const it = p.inv[slot];
      if (!it) return;
      if (it.slot !== "weapon" && it.slot !== "armor" && it.slot !== "helm" && it.slot !== "ring")
        return toast(p, "No podés equipar eso");
      if (p.lvl < it.lvl) return toast(p, `Requiere nivel ${it.lvl}`);
      p.inv[slot] = p.eq[it.slot];
      p.eq[it.slot] = it;
      sendYou(p);
      break;
    }
    case "unequip": {
      if (p.dead || stunned) return;
      const eslot = msg.eslot;
      if (eslot !== "weapon" && eslot !== "armor" && eslot !== "helm" && eslot !== "ring") return;
      const it = p.eq[eslot];
      if (!it) return;
      const free = p.inv.indexOf(null);
      if (free < 0) return invFull(p);
      p.inv[free] = it;
      p.eq[eslot] = null;
      sendYou(p);
      break;
    }
    case "use": {
      if (p.dead || stunned) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      const it = p.inv[slot];
      if (!it) return;
      if (it.slot === "herb") return toast(p, "Lleva la hierba a Kora y usa /brew (V)");
      if (it.slot === "fish") {
        const fdef = FISH_DEFS[it.base];
        if (!fdef) return;
        if (stillDigesting(p, now)) return;
        const d = derive(p);
        p.hp = Math.min(d.mhp, p.hp + d.mhp * fdef.heal);
        p.potCdUntil = now + POTION_CD;
        consumeInvSlot(p, slot);
        toast(p, `Comiste ${it.name}`);
        bcastAt(p.x, p.y, { t: "fx", k: "heal", i: p.id });
        sendYou(p);
        break;
      }
      if (it.slot === "elixir" || it.slot === "food") {
        const def = it.slot === "elixir" ? ELIXIR_DEFS[it.base] : FOOD_DEFS[it.base];
        if (!def) return;
        if (stillDigesting(p, now)) return;
        const d0 = derive(p);
        p.hp = Math.min(d0.mhp, p.hp + d0.mhp * def.heal);
        p.potCdUntil = now + POTION_CD;
        const bits = applyFoodBuff(p, now, def);
        const verb = it.slot === "elixir" ? "Bebiste" : "Comiste";
        consumeInvSlot(p, slot);
        toast(p, bits ? `${verb} ${it.name} (${bits})` : `${verb} ${it.name}`);
        bcastAt(p.x, p.y, { t: "fx", k: "heal", i: p.id });
        sendYou(p);
        break;
      }
      if (it.slot !== "potion") return;
      if (now < p.potCdUntil) return toast(p, "Las pociones están en enfriamiento");
      const pdef = POTION_DEFS[it.base];
      if (!pdef) return;
      const d = derive(p);
      if (pdef.pool === "hp") p.hp = Math.min(d.mhp, p.hp + d.mhp * pdef.heal);
      else p.mp = Math.min(d.mmp, p.mp + d.mmp * pdef.heal);
      p.potCdUntil = now + POTION_CD;
      consumeInvSlot(p, slot);
      bcastAt(p.x, p.y, { t: "fx", k: "heal", i: p.id });
      sendYou(p);
      break;
    }
    case "allot": {
      const stat = msg.stat;
      if (stat !== "str" && stat !== "dex" && stat !== "int") return;
      if (p.pts <= 0) return toast(p, "No tenés puntos de característica disponibles");
      p.pts--;
      p[stat]++;
      sendYou(p);
      break;
    }
    case "quest_accept": {
      if (p.dead) return;
      const qid = strMsg(msg.qid);
      if (!QUESTS[qid]) return;
      if (needNpc(p, elder, MSG_ELDER)) return;
      if (questState(p, qid) !== "available") return toast(p, "Aún no podés aceptar esa misión");
      p.quests[qid] = { n: 0, done: false, turned: false };
      if (QUESTS[qid].kind === "collect") updateCollect(p);
      toast(p, `Misión aceptada: ${QUESTS[qid].name}`);
      unlockQuestPortal(p, qid, QUEST_PORTAL_ACCEPT);
      syncElder(p);
      break;
    }
    case "quest_turnin": {
      if (p.dead) return;
      const qid = strMsg(msg.qid);
      const def = QUESTS[qid];
      if (!def) return;
      if (needNpc(p, elder, MSG_ELDER)) return;
      if (questState(p, qid) !== "complete") return toast(p, "Esa misión no está completa");
      let rewardItem: Item | null = null;
      if (def.rew.item) {
        rewardItem = questReward(p, def.rew.item);
        if (!invAdd(p, rewardItem)) return toast(p, "Primero libera espacio en el inventario");
      }
      if (def.kind === "collect") removeQuestItems(p, def.target, def.count);
      p.quests[qid].turned = true;
      p.gold += def.rew.gold;
      noteGold(p, def.rew.gold);
      addXp(p, def.rew.xp);
      toast(p, `Misión completada: +${def.rew.xp} de experiencia, +${def.rew.gold} de oro${rewardItem ? `, ${rewardItem.name}` : ""}`);
      unlockQuestPortal(p, qid, QUEST_PORTAL_TURNIN);
      checkProgressAchs(p);
      syncElder(p);
      break;
    }
    case "inspect": {
      const id = num(msg.id);
      if (id == null) return;
      const target = playerById(id);
      if (!target || target === p) return;
      if (tooFar(p, target, DUEL_RANGE)) return;
      const eq: Record<string, unknown> = {};
      for (const slot of EQUIP_SLOTS) {
        const it = target.eq[slot];
        if (it) eq[slot] = { name: it.name, rarity: it.rarity, icon: it.icon, tier: it.tier, lvl: it.lvl, dmg: it.dmg, arm: it.arm };
      }
      send(p.ws, {
        t: "inspect",
        id: target.id, name: target.name, cls: target.cls, title: target.title && ACHIEVEMENTS[target.title] ? ACHIEVEMENTS[target.title].name : "", lvl: target.lvl,
        pet: target.activePet, eq,
      });
      break;
    }
    case "party_invite": {
      const id = num(msg.id);
      if (id == null) return;
      const target = playerById(id);
      if (!target || target === p) return;
      if (!needOnline(p, target)) return;
      if (partyJoinHumanToBotSquad(p, target)) break;
      const myPt = p.party || (p.partyId ? getOrLoadParty(p.partyId) : null);
      if (myPt && myPt.roster.length >= PARTY_MAX) return toastPartyFull(p);
      if (target.party || target.partyId) return toast(p, `${target.name} ya está en un grupo`);
      target.invites.set(p.name, now + INVITE_MS);
      send(target.ws, { t: "party_invited", from: p.name, cls: p.cls, lvl: p.lvl });
      toast(p, `Invitación enviada a ${target.name}`);
      break;
    }
    case "party_accept": {
      const from = strMsg(msg.from) || null;
      if (!from) return;
      const exp = p.invites.get(from);
      p.invites.delete(from);
      if (!exp || now > exp) return toast(p, "La invitación ya no es válida");
      const inviter = players.get(from) || null;
      if (!needOnline(p, inviter)) return;
      if (p.party || p.partyId) return toast(p, "Ya estás en un grupo — sal primero");
      let pt = inviter.party || (inviter.partyId ? getOrLoadParty(inviter.partyId) : null);
      if (!pt) {
        pt = { id: newPartyId(), members: [], roster: [] };
        attachPlayerToParty(inviter, pt);
        inviter.dirty = true;
        savePlayer(inviter);
      } else if (!inviter.party) {
        attachPlayerToParty(inviter, pt);
      }
      if (pt.roster.length >= PARTY_MAX) return toastPartyFull(p);
      if (pt.roster.some(r => r.name === p.name)) return toast(p, "Ya estás en ese grupo");
      attachPlayerToParty(p, pt);
      p.dirty = true;
      savePlayer(p);
      persistParty(pt);
      partyBcast(pt);
      for (const m of pt.members) if (m !== p && m.ws) toast(m, `${p.name} se unió al grupo`);
      break;
    }
    case "party_decline": {
      const from = strMsg(msg.from) || null;
      if (!from) return;
      if (p.invites.delete(from)) {
        const inviter = players.get(from) || null;
        toastReject(p, inviter, `${p.name} rechazó la invitación`, "Invitación rechazada");
      }
      break;
    }
    case "party_leave": {
      partyLeave(p);
      break;
    }
    case "party_follow": {
      const id = num(msg.id);
      if (id !== null) {
        if (!p.party || id === p.id || !p.party.members.some(m => m.id === id))
          return toast(p, "Ese jugador no está en tu grupo");
      }
      p.followId = id;
      send(p.ws, { t: "follow_state", id });
      break;
    }
    case "lootlog": {
      sendLootLog(p);
      break;
    }
    case "combatlog": {
      sendCombatLog(p);
      break;
    }
    case "meter": {
      sendMeter(p, true);
      break;
    }
    case "achs": {
      sendAchs(p);
      break;
    }
    case "who": {
      if (now - p.lastWhoAt < 1500) return;
      p.lastWhoAt = now;
      sendWho(p);
      break;
    }
    case "fish": {
      if (p.dead || stunned) return;
      beginFish(p, now);
      break;
    }
    case "cook": {
      if (p.dead || stunned) return;
      beginCook(p, now);
      break;
    }
    case "forage": {
      if (p.dead || stunned) return;
      beginForage(p, now);
      break;
    }
    case "brew": {
      if (p.dead || stunned) return;
      beginBrew(p, now);
      break;
    }

    case "trade_req": {
      const id = num(msg.id);
      if (id == null) return;
      tryTradeReq(p, id, now);
      break;
    }
    case "trade_accept": {
      const from = strMsg(msg.from);
      tryTradeAccept(p, from, now);
      break;
    }
    case "trade_decline": {
      const from = strMsg(msg.from);
      tryTradeDecline(p, from);
      break;
    }
    case "trade_put": {
      const ts = num(msg.slot), inv = num(msg.inv);
      if (ts == null || inv == null) return;
      tradePut(p, ts, inv);
      break;
    }
    case "trade_take": {
      const ts = num(msg.slot);
      if (ts == null) return;
      tradeTake(p, ts);
      break;
    }
    case "trade_gold": {
      const g = num(msg.gold);
      if (g == null) return;
      tradeGold(p, g);
      break;
    }
    case "trade_lock": {
      tradeLock(p);
      break;
    }
    case "trade_unlock": {
      tradeUnlock(p);
      break;
    }
    case "trade_confirm": {
      tradeConfirm(p);
      break;
    }
    case "trade_cancel": {
      cancelTrade(p, "Intercambio cancelado");
      break;
    }
    case "duel_req": {
      const id = num(msg.id);
      if (id == null) return;
      tryDuelReq(p, id, now);
      break;
    }
    case "duel_accept": {
      const from = strMsg(msg.from);
      tryDuelAccept(p, from, now);
      break;
    }
    case "duel_decline": {
      const from = strMsg(msg.from);
      tryDuelDecline(p, from);
      break;
    }
    case "duel_cancel": {
      if (p.duelWith) cancelDuel(p, "Duelo cancelado");
      break;
    }
    case "salvage": {
      if (p.dead || stunned) return;
      const slot = readSlot(msg);
      if (slot == null) return;
      trySalvage(p, slot);
      break;
    }
    case "bind": {
      if (p.dead || stunned) return;
      tryBind(p);
      break;
    }
    case "title": {
      const id = strMsg(msg.id);
      if (!id) {
        p.title = "";
        p.dirty = true;
        toast(p, "Título quitado");
        sendAchs(p);
        sendYou(p);
        break;
      }
      if (!ACHIEVEMENTS[id] || !p.achs.has(id)) return toast(p, "Aún no tenés ese logro");
      p.title = id;
      p.dirty = true;
      toast(p, `Título: ${ACHIEVEMENTS[id].name}`);
      sendAchs(p);
      sendYou(p);
      break;
    }
    case "party_ping": {
      if (p.dead) return;
      if (needParty(p)) return;
      if (now - p.lastPingAt < 2000) return;
      const x = num(msg.x), y = num(msg.y);
      if (x == null || y == null) return;
      if (x < 0 || y < 0 || x >= W || y >= W) return;
      p.lastPingAt = now;
      const pkt = { t: "ping", from: p.name, x: r2(x), y: r2(y) };
      for (const m of p.party.members) if (m.ws) send(m.ws, pkt);
      break;
    }
    case "portal_travel": {
      if (p.dead || stunned) return;
      const dest = strMsg(msg.dest);
      const wp = PORTAL_WAYPOINTS[dest];
      if (!wp) return;
      if (dest !== "helike" && !p.visitedZones.includes(dest))
        return toast(p, "Primero tenés que visitar esa región a pie");
      if (needNpc(p, portalNpc, MSG_PORTAL)) return;
      if (inCombatBlock(p, now, "No podés viajar en combate")) return;
      p.x = wp.x;
      p.y = wp.y;
      clearMobility(p);
      p.followStuck = 0;
      p.combatUntil = 0;
      sendYou(p);
      toast(p, `Viajaste a ${wp.label}`);
      break;
    }
    case "chat": {
      const text = strMsg(msg.text).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
      if (!text) return;
      if (waitToast(p, p.lastChat, 1000, now, "Estás escribiendo demasiado rápido")) return;
      p.lastChat = now;
      if (/^\/mount$/i.test(text) || /^\/montar$/i.test(text) || /^\/dismount$/i.test(text) || /^\/apear$/i.test(text)) {
        tryMount(p);
        return;
      }
      if (/^\/sit$/i.test(text) || /^\/sentar$/i.test(text) || /^\/rest$/i.test(text)) {
        trySit(p);
        return;
      }
      {
        const pay = text.match(/^\/(?:pay|dar|pagar)\s+(\S+)\s+(\d+)\s*$/i);
        if (pay) {
          tryPay(p, pay[1], Number(pay[2]), now);
          return;
        }
      }
      if (/^\/cook$/i.test(text) || /^\/cocinar$/i.test(text)) {
        beginCook(p, now);
        return;
      }
      if (/^\/forage$/i.test(text) || /^\/recolectar$/i.test(text) || /^\/herbs$/i.test(text)) {
        beginForage(p, now);
        return;
      }
      if (/^\/brew$/i.test(text) || /^\/alquimia$/i.test(text) || /^\/pocima$/i.test(text)) {
        beginBrew(p, now);
        return;
      }

      if (/^\/trade\s+(.+)$/i.test(text) || /^\/comercio\s+(.+)$/i.test(text) || /^\/intercambiar\s+(.+)$/i.test(text)) {
        const m = text.match(/^\/(?:trade|comercio|intercambiar)\s+(.+)$/i);
        const name = (m && m[1] || "").trim();
        const target = playerByName(name);
        if (!target) return toast(p, "Jugador no encontrado");
        tryTradeReq(p, target.id, now);
        return;
      }
      if (/^\/bind$/i.test(text) || /^\/ligar$/i.test(text) || /^\/hogar$/i.test(text)) {
        tryBind(p);
        return;
      }
      {
        const duel = text.match(/^\/(?:duel|desafiar|reto)\s+(.+)$/i);
        if (duel) {
          const nm = duel[1].trim();
          const target = playerByName(nm, true);
          if (!target) { toast(p, "Ese jugador no está en línea"); return; }
          tryDuelReq(p, target.id, now);
          return;
        }
      }
      if (/^\/salvage$/i.test(text) || /^\/desguazar$/i.test(text) || /^\/fundir$/i.test(text)) {
        let slot = findInvSlot(p, (it) => SALVAGE_SLOTS.has(it.slot));
        if (slot < 0) toast(p, "No tenés equipo para desguazar");
        else trySalvage(p, slot);
        return;
      }
      if (/^\/fish$/i.test(text) || /^\/pescar$/i.test(text)) {
        beginFish(p, now);
        return;
      }
      // Party chat: /p|/g|/grupo message
      const pm = text.match(/^\/(?:p|g|grupo)\s+(.+)$/i);
      if (pm) {
        if (needParty(p)) return;
        const body = pm[1].slice(0, 180);
        const line = JSON.stringify({ t: "chat", from: p.name, text: body, party: 1 });
        for (const m of p.party.members) if (m.ws && m.ws.readyState === 1) m.ws.send(line);
        break;
      }
      // Whisper: /w Name message  |  /susurro Name message
      const wm = text.match(/^\/(?:w|susurro)\s+(\S+)\s+(.+)$/i);
      if (wm) {
        const targetName = wm[1];
        const body = wm[2].slice(0, 180);
        const target = playerByName(targetName, true);
        if (!target) return toast(p, `No hay nadie online llamado ${targetName}`);
        if (target.id === p.id) return toast(p, "No podés susurrarte a vos mismo");
        send(p.ws, { t: "chat", from: `Para ${target.name}`, text: body, whisper: 1 });
        send(target.ws, { t: "chat", from: `De ${p.name}`, text: body, whisper: 1 });
        break;
      }
      const em = text.match(/^\/(?:me\s+)?(wave|dance|cheer|bow|salute|saludo|bailar|aplaudir|reverencia)\s*$/i);
      if (em) {
        if (waitToast(p, p.lastEmoteAt, 2500, now, "Esperá un momento para otro gesto")) return;
        p.lastEmoteAt = now;
        const rawE = em[1].toLowerCase();
        const map: Record<string, string> = {
          wave: "wave", salute: "wave", saludo: "wave",
          dance: "dance", bailar: "dance",
          cheer: "cheer", aplaudir: "cheer",
          bow: "bow", reverencia: "bow",
        };
        const e = map[rawE] || "wave";
        const label: Record<string, string> = { wave: "saluda", dance: "baila", cheer: "aplaude", bow: "hace una reverencia" };
        bcastAt(p.x, p.y, { t: "fx", k: "emote", i: p.id, e });
        const line = JSON.stringify({ t: "chat", text: `* ${p.name} ${label[e]} *`, sys: 1 });
        for (const q of players.values()) {
          if (!q.ws || q.ws.readyState !== 1) continue;
          if (dist(q.x, q.y, p.x, p.y) <= 18) q.ws.send(line);
        }
        break;
      }
      const s = JSON.stringify({ t: "chat", from: p.name, text });
      for (const q of players.values()) if (q.ws && q.ws.readyState === 1) q.ws.send(s);
      break;
    }
    case "respawn": {
      if (!p.dead) return;
      revivePlayer(p);
      sendYou(p);
      break;
    }
    case "recall": {
      if (p.dead || stunned) return;
      if (now < p.recallCdUntil) return toast(p, `Regreso en enfriamiento (${Math.ceil((p.recallCdUntil - now) / 1000)}s)`);
      p.recallCdUntil = now + RECALL_CD;
      dismountAndStand(p);
      const hasBind = Boolean(p.bindX || p.bindY);
      if (hasBind) {
        p.x = p.bindX + (Math.random() - 0.5) * 0.4;
        p.y = p.bindY + (Math.random() - 0.5) * 0.4;
      } else {
        // Random point in a ring just outside the fountain basin — always lands
        // on plaza stone since the whole plaza around it is walkable by build.
        const ang = Math.random() * Math.PI * 2;
        const r = FOUNTAIN.r + 1 + Math.random() * 1.5;
        p.x = FOUNTAIN.x + Math.cos(ang) * r;
        p.y = FOUNTAIN.y + Math.sin(ang) * r;
      }
      clearMobility(p);
      p.combatUntil = 0;
      bcastAt(p.x, p.y, { t: "fx", k: "recall", i: p.id });
      toast(p, hasBind ? "Has vuelto a tu hogar ligado" : "Has vuelto a Helike");
      break;
    }
    default:
      break; // unknown types ignored per contract
  }
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------
/** Move entity toward (tx,ty) by `step`, sliding along walls. True if moved. */
function stepToward(e: { x: number; y: number; d: number }, tx: number, ty: number, step: number): boolean {
  const dx = tx - e.x, dy = ty - e.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return false;
  const s = Math.min(step, len);
  const nx = e.x + (dx / len) * s;
  const ny = e.y + (dy / len) * s;
  if (dx !== 0) e.d = dx < 0 ? 1 : 0;
  if (walkableAt(nx, ny)) {
    e.x = nx;
    e.y = ny;
    return true;
  }
  if (walkableAt(nx, e.y)) {
    e.x = nx;
    return true;
  }
  if (walkableAt(e.x, ny)) {
    e.y = ny;
    return true;
  }
  return false;
}

type PathBody = {
  x: number; y: number; d: number; moving: boolean;
  path: { x: number; y: number }[] | null;
};

/** Consume waypoints along e.path for up to speed*dt. Marks e.moving when it advances. */
function followPath(e: PathBody, speed: number, dt: number): void {
  let budget = speed * dt;
  while (budget > 1e-6 && e.path && e.path.length) {
    const wp = e.path[0];
    const dx = wp.x - e.x, dy = wp.y - e.y;
    const d = Math.hypot(dx, dy);
    if (dx !== 0) e.d = dx < 0 ? 1 : 0;
    if (d <= budget) {
      e.x = wp.x;
      e.y = wp.y;
      budget -= d;
      e.path.shift();
    } else {
      e.x += (dx / d) * budget;
      e.y += (dy / d) * budget;
      budget = 0;
    }
    e.moving = true;
  }
  if (e.path && !e.path.length) e.path = null;
}

// ---------------------------------------------------------------------------
// Simulation (15 Hz)
// ---------------------------------------------------------------------------
let lastTick = Date.now();

function simTick(): void {
  const now = Date.now();
  const dt = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;

  // --- players ---
  maintainTrades(now);
  maintainDuels(now);
  for (const p of players.values()) {
    if (!p.ws) continue;
    p.moving = false;
    if (p.dead) {
      if (now >= p.deadAt + REVIVE_MS) {
        revivePlayer(p);
        sendYou(p);
      }
      continue;
    }
    checkZoneVisit(p);
    tryFinishFish(p, now);
    tryFinishCook(p, now);
    tryFinishForage(p, now);
    // Cancel channelled actions if the player moves / fights / leaves the station.
    interruptChannels(p, now);
    if (p.sitting && (channelInterrupted(p, now) || p.moving)) {
      standUp(p);
    }
    if (p.mounted && p.combatUntil > now) {
      dismount(p, true);
      toast(p, "El combate te apeó");
    }
    if (p.tradeId && p.combatUntil > now) cancelTrade(p, "Combate — intercambio cancelado");

    // Regen: 2%/s hp + 3%/s mp out of combat (5s), 1%/s mp in combat. Near
    // the plaza fountain (sanctuary — town already blocks all incoming
    // damage) both rates jump to a fast blanket regen regardless of combat.
    const d = derive(p);
    const inCombat = now < p.combatUntil;
    const nearFountain = dist(p.x, p.y, FOUNTAIN.x, FOUNTAIN.y) <= FOUNTAIN_REGEN_R + 0.5 * abilityRank(p, "aura_fuente");
    if (nearFountain) {
      if (p.hp < d.mhp) p.hp = Math.min(d.mhp, p.hp + d.mhp * FOUNTAIN_HP_REGEN * dt);
      if (p.mp < d.mmp) p.mp = Math.min(d.mmp, p.mp + d.mmp * FOUNTAIN_MP_REGEN * dt);
      if (!inCombat) {
        p.restAccum += dt;
        if (p.restAccum >= 12) {
          const fresh = p.restedUntil < now;
          p.restedUntil = now + 480000;
          p.restAccum = 0;
          if (fresh) toast(p, "Descansas en la fuente — +20% XP (8 min)");
        }
      } else {
        p.restAccum = 0;
      }
    } else {
      const sitting = p.sitting && !inCombat;
      if (!sitting) p.restAccum = 0;
      const hpRegenPct = (sitting ? 0.05 : 0.02) + 0.004 * abilityRank(p, "toque_asclepio");
      const mpRegenPct = (inCombat ? 0.01 : (sitting ? 0.06 : 0.03)) + 0.002 * abilityRank(p, "m_regen");
      if (sitting) {
        p.restAccum += dt;
        if (p.restAccum >= 18) {
          const fresh = p.restedUntil < now;
          // Camp rest is shorter than fountain rest; don't shorten an active fountain buff.
          if (p.restedUntil < now + 240000) p.restedUntil = Math.max(p.restedUntil, now + 240000);
          p.restAccum = 0;
          if (fresh) toast(p, "Descanso de campamento — +20% XP (4 min)");
          sendYou(p);
        }
      }
      if (!inCombat && p.hp < d.mhp) p.hp = Math.min(d.mhp, p.hp + d.mhp * hpRegenPct * dt);
      if (p.mp < d.mmp) p.mp = Math.min(d.mmp, p.mp + d.mmp * mpRegenPct * dt);
    }

    if (now < p.stunUntil) continue;
    const speed = d.spd * (now < p.slowUntil ? 1 - p.slowPct : 1);

    // Modo "seguir": si no tengo blanco propio vivo, heredo el del líder de grupo.
    // Self-healing: si el líder ya no está en mi grupo, limpio followId aquí mismo.
    let followLeader: Player | null = null;
    if (p.followId != null) {
      followLeader = p.party?.members.find(m => m.id === p.followId) ?? null;
      if (!followLeader) { p.followId = null; send(p.ws, { t: "follow_state", id: null }); }
    }
    // While the player is steering with WASD, do not re-lock onto the leader's
    // target — otherwise canceling combat with movement gets undone next tick.
    if (followLeader && followLeader.atkTarget != null && !p.vel) {
      const myTarget = p.atkTarget != null ? mobById(p.atkTarget) : null;
      if (!myTarget || myTarget.dead) {
        const theirTarget = mobById(followLeader.atkTarget);
        if (theirTarget && !theirTarget.dead) p.atkTarget = followLeader.atkTarget;
      }
    }

    // WASD velocity steering has priority over click paths and attack-chase.
    // Starting WASD clears atkTarget (see "dir" handler), so no auto-hit while moving.
    if (p.vel) {
      const tx = Math.max(0.5, Math.min(W - 0.5, p.x + p.vel.x * 2));
      const ty = Math.max(0.5, Math.min(W - 0.5, p.y + p.vel.y * 2));
      if (stepToward(p, tx, ty, speed * dt)) p.moving = true;
    }

    if (p.atkTarget != null) {
      const m = mobById(p.atkTarget);
      const foe = (!m || m.dead) ? (() => {
        const q = playerById(p.atkTarget!);
        return q && areDueling(p, q) ? q : null;
      })() : null;
      if ((!m || m.dead) && !foe) {
        p.atkTarget = null;
        clearPath(p);
      } else {
        const tx = m && !m.dead ? m.x : foe!.x;
        const ty = m && !m.dead ? m.y : foe!.y;
        const range = weaponRange(p);
        const dd = dist(p.x, p.y, tx, ty);
        if (dd <= range) {
          clearPath(p);
          p.d = tx < p.x ? 1 : 0;
          if (now >= p.nextAtk) {
            p.nextAtk = now + ATTACK_CD;
            const icon = p.eq.weapon?.icon;
            if (range === RANGED_RANGE)
              bcastAt(p.x, p.y, { t: "fx", k: "proj", from: { x: r2(p.x), y: r2(p.y) }, to: { x: r2(tx), y: r2(ty) }, style: icon === "bow" ? "arrow" : "fire" });
            else
              bcastAt(p.x, p.y, { t: "fx", k: "slash", x: r2(p.x), y: r2(p.y), tx: r2(tx), ty: r2(ty) });
            if (m && !m.dead) playerHit(p, m, d.lo + Math.random() * (d.hi - d.lo), d);
            else if (foe) playerHitPlayer(p, foe, d.lo + Math.random() * (d.hi - d.lo), d);
          }
        } else if (!p.vel) {
          repathTo(p, tx, ty, now);
          if (p.path) followPath(p, speed, dt);
          else if (p.direct && !stepToward(p, p.direct.x, p.direct.y, speed * dt)) p.direct = null;
          else if (p.direct) p.moving = true;
        }
      }
    } else if (p.lootTarget != null) {
      const l = loot.get(p.lootTarget);
      if (!l) {
        p.lootTarget = null;
        clearPath(p);
      } else {
        const dd = dist(p.x, p.y, l.x, l.y);
        if (dd <= 2) {
          clearPath(p);
          if (tryPickupLoot(p, p.lootTarget)) p.lootTarget = null;
        } else if (!p.vel) {
          repathTo(p, l.x, l.y, now);
          if (p.path) followPath(p, speed, dt);
          else if (p.direct && !stepToward(p, p.direct.x, p.direct.y, speed * dt)) p.direct = null;
          else if (p.direct) p.moving = true;
        }
      }
    } else if (p.npcTarget != null) {
      const npc = npcs.find((n) => n.id === p.npcTarget);
      if (!npc) {
        p.npcTarget = null;
        clearPath(p);
      } else if (nearNpc(p, npc)) {
        clearPath(p);
        openNpcDialog(p, npc);
        p.npcTarget = null;
      } else if (!p.vel) {
        repathTo(p, npc.x, npc.y, now);
        if (p.path) followPath(p, speed, dt);
        else if (p.direct && !stepToward(p, p.direct.x, p.direct.y, speed * dt)) p.direct = null;
        else if (p.direct) p.moving = true;
      }
    } else if (p.path && !p.vel) {
      followPath(p, speed, dt);
    } else if (p.direct && !p.vel) {
      if (dist(p.x, p.y, p.direct.x, p.direct.y) < 0.15 || !stepToward(p, p.direct.x, p.direct.y, speed * dt))
        p.direct = null;
      else p.moving = true;
    } else if (followLeader && !p.vel) {
      // Seguir: A* around walls instead of a straight shove that freezes on obstacles.
      const fd = dist(p.x, p.y, followLeader.x, followLeader.y);
      if (fd <= 2) {
        clearPath(p);
        p.followStuck = 0;
      } else {
        const end = p.path && p.path.length ? p.path[p.path.length - 1] : null;
        const drifted = !end || dist(end.x, end.y, followLeader.x, followLeader.y) > 2.5;
        if (drifted) repathTo(p, followLeader.x, followLeader.y, now, 400);
        const ox = p.x, oy = p.y;
        if (p.path && p.path.length) {
          followPath(p, speed, dt);
        } else if (stepToward(p, followLeader.x, followLeader.y, speed * dt)) {
          p.moving = true;
        }
        if (Math.hypot(p.x - ox, p.y - oy) > 1e-4) {
          p.followStuck = 0;
        } else if (++p.followStuck > 40) {
          // Path went stale / wedged — drop it and force a fresh repath next tick.
          clearPath(p);
          p.followStuck = 0;
          p.repathAt = 0;
        }
      }
    }
  }

  // --- monsters ---
  for (const m of mobs) {
    if (m.dead) {
      if (now >= m.respawnAt) {
        m.dead = false;
        m.hp = m.mhp;
        m.x = m.spawn.x;
        m.y = m.spawn.y;
        m.state = "idle";
        m.target = null;
        m.stunUntil = 0;
        m.slowUntil = 0;
        m.path = null;
        m.repathAt = 0;
        m.mobStuck = 0;
      }
      continue;
    }
    m.moving = false;
    if (now < m.stunUntil) continue;
    const def = MOB_DEFS[m.kind];
    const speed = def.spd * (now < m.slowUntil ? 1 - m.slowPct : 1);

    if (m.state === "reset") {
      // Walk home only — no heal, no invulnerability. A hit mid-walk re-aggros (see playerHit).
      m.path = null;
      if (m.target && !m.target.dead && m.target.ws) {
        m.state = "chase";
        m.resetStuck = 0;
        // fall through into chase logic this tick
      } else if (dist(m.x, m.y, m.spawn.x, m.spawn.y) < 1) {
        m.state = "idle";
        m.resetStuck = 0;
        m.mobStuck = 0;
        continue;
      } else if (stepToward(m, m.spawn.x, m.spawn.y, speed * 1.5 * dt)) {
        m.moving = true;
        m.resetStuck = 0;
        continue;
      } else if (++m.resetStuck > 30) {
        // Wedged against scenery on the way home — snap back.
        m.x = m.spawn.x;
        m.y = m.spawn.y;
        m.state = "idle";
        m.resetStuck = 0;
        m.mobStuck = 0;
        continue;
      } else {
        continue;
      }
    }

    // Leash: too far from home → give up and walk back (no heal / no invuln).
    if (dist(m.x, m.y, m.spawn.x, m.spawn.y) > LEASH) {
      m.state = "reset";
      m.target = null;
      m.path = null;
      m.mobStuck = 0;
      continue;
    }

    // Validate / acquire target.
    let t = m.target;
    if (t && (t.dead || !t.ws || inTown(t.x, t.y) || dist(m.x, m.y, t.x, t.y) > def.aggro * 4)) {
      m.target = t = null;
      m.state = dist(m.x, m.y, m.spawn.x, m.spawn.y) > 3 ? "reset" : "idle";
      m.path = null;
      m.mobStuck = 0;
    }
    if (!t) {
      if (now >= m.nextScan) {
        m.nextScan = now + 500;
        let best: Player | null = null, bestD = def.aggro;
        for (const p of players.values()) {
          if (p.dead || !p.ws || inTown(p.x, p.y)) continue;
          const dd = dist(m.x, m.y, p.x, p.y);
          if (dd <= bestD) {
            best = p;
            bestD = dd;
          }
        }
        if (best) {
          m.target = best;
          m.state = "chase";
        }
      }
      // Idle regen while unengaged.
      if (m.state === "idle" && m.hp < m.mhp) m.hp = Math.min(m.mhp, m.hp + m.mhp * 0.05 * dt);
      continue;
    }

    const dd = dist(m.x, m.y, t.x, t.y);
    if (dd <= def.range) {
      m.path = null;
      m.mobStuck = 0;
      m.d = t.x < m.x ? 1 : 0;
      if (now >= m.nextAtk) {
        m.nextAtk = now + def.cd;
        if ((m.kind === "cyclops" || m.kind === "minotaur" || m.kind === "hydra") && now >= m.slamAt) {
          // Boss AoE slam at the target's feet.
          m.slamAt = now + 7000 + Math.random() * 4000;
          const sx = t.x, sy = t.y, r = 3;
          bcastAt(sx, sy, { t: "fx", k: "aoe", x: r2(sx), y: r2(sy), r, style: "slam" });
          for (const p of players.values())
            if (!p.dead && p.ws && dist(p.x, p.y, sx, sy) <= r) mobHit(m, p, 1.5);
        } else {
          if (def.ranged)
            bcastAt(m.x, m.y, { t: "fx", k: "proj", from: { x: r2(m.x), y: r2(m.y) }, to: { x: r2(t.x), y: r2(t.y) }, style: def.ranged });
          else
            bcastAt(m.x, m.y, { t: "fx", k: "slash", x: r2(m.x), y: r2(m.y), tx: r2(t.x), ty: r2(t.y) });
          mobHit(m, t, 1);
          if (def.slow && !t.dead) applySlow(t, def.slow.pct, def.slow.ms);
        }
      }
    } else {
      // Chase with A* so walls don't freeze the mob mid-aggro.
      const end = m.path && m.path.length ? m.path[m.path.length - 1] : null;
      const drifted = !end || dist(end.x, end.y, t.x, t.y) > 2.5;
      if (drifted && now >= m.repathAt) {
        m.repathAt = now + 500;
        m.path = astar(world.walk, m.x, m.y, t.x, t.y);
      }
      const ox = m.x, oy = m.y;
      if (m.path && m.path.length) {
        followPath(m, speed, dt);
      } else if (stepToward(m, t.x, t.y, speed * dt)) {
        m.moving = true;
      }
      if (Math.hypot(m.x - ox, m.y - oy) > 1e-4) {
        m.mobStuck = 0;
      } else if (++m.mobStuck > 40) {
        // Unreachable / wedged: drop target and return home instead of freezing forever (no heal).
        m.target = null;
        m.state = dist(m.x, m.y, m.spawn.x, m.spawn.y) > 3 ? "reset" : "idle";
        m.path = null;
        m.mobStuck = 0;
        m.repathAt = 0;
      }
    }
  }

  // --- loot expiry ---
  for (const [id, l] of loot) if (now >= l.exp) loot.delete(id);
}

// ---------------------------------------------------------------------------
// Snapshots (10 Hz)
// ---------------------------------------------------------------------------
function entFlags(e: StatusHolder, now: number): number {
  const pl = e as Player;
  return (
    (e.moving ? 1 : 0) |
    (now - e.lastAtk < 500 ? 2 : 0) |
    (now < e.slowUntil ? 4 : 0) |
    (now < e.stunUntil ? 8 : 0) |
    (pl.sitting ? 16 : 0) |
    (pl.mounted ? 32 : 0)
  );
}

function snapshotTick(): void {
  const now = Date.now();
  const pop = players.size;
  // Compact boss timers (alive=0, else seconds until respawn) — shared across all snapshots.
  const bossTimers: { k: string; t: number }[] = [];
  for (const m of mobs) {
    if (!BOSS_KINDS.has(m.kind)) continue;
    bossTimers.push({ k: m.kind, t: m.dead ? Math.max(0, Math.ceil((m.respawnAt - now) / 1000)) : 0 });
  }
  for (const p of players.values()) {
    if (!p.ws || p.ws.readyState !== 1) continue;
    const ents: Record<string, unknown>[] = [];
    const seen = new Set<number>();

    for (const n of npcs) {
      const dx = n.x - p.x, dy = n.y - p.y;
      if (dx * dx + dy * dy > AOI2) continue;
      seen.add(n.id);
      ents.push({ i: n.id, k: n.kind, x: n.x, y: n.y, h: 100, H: 100, l: 1, n: n.name, s: 0, d: 0 });
    }
    for (const m of mobs) {
      if (m.dead) continue;
      const dx = m.x - p.x, dy = m.y - p.y;
      if (dx * dx + dy * dy > AOI2) continue;
      seen.add(m.id);
      const e: Record<string, unknown> = {
        i: m.id, k: m.kind, x: r2(m.x), y: r2(m.y),
        h: Math.max(0, Math.round(m.hp)), H: m.mhp, l: m.lvl,
        s: entFlags(m, now), d: m.d,
      };
      if (m.name) e.n = m.name;
      ents.push(e);
    }
    for (const q of players.values()) {
      if (!q.ws) continue;
      // Keep the local dead player in their own snapshot so the camera still has a body;
      // other clients should not see corpses wandering the AOI.
      if (q.dead && q !== p) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy > AOI2) continue;
      seen.add(q.id);
      const d = derive(q);
      const e: Record<string, unknown> = {
        i: q.id, k: q.cls, x: r2(q.x), y: r2(q.y),
        h: Math.max(0, Math.round(q.hp)), H: d.mhp, l: q.lvl, n: q.name,
        s: entFlags(q, now), d: q.d,
      };
      if (q.activePet) e.pet = q.activePet;
      if (q.mounted && q.activeMount) e.mount = q.activeMount;
      if (q.title && ACHIEVEMENTS[q.title]) e.title = ACHIEVEMENTS[q.title].name;
      if (q === p) {
        e.m = Math.round(q.mp);
        e.M = d.mmp;
      }
      ents.push(e);
    }

    const gone: number[] = [];
    for (const id of p.seen) if (!seen.has(id)) gone.push(id);
    p.seen = seen;

    const lootList: Record<string, unknown>[] = [];
    for (const l of loot.values()) {
      const dx = l.x - p.x, dy = l.y - p.y;
      if (dx * dx + dy * dy > AOI2) continue;
      lootList.push({
        i: l.id, x: r2(l.x), y: r2(l.y),
        name: l.item.name, rarity: l.item.rarity, icon: l.item.icon,
        slot: l.item.slot, tier: l.item.tier, lvl: l.item.lvl,
        dmg: l.item.dmg, arm: l.item.arm, mods: l.item.mods,
        val: l.item.val, qty: l.item.qty,
      });
    }

    send(p.ws, { t: "st", pop, ents, gone, loot: lootList, bosses: bossTimers });
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = Bun.serve<Session, Record<string, never>>({
  hostname: "127.0.0.1",
  port: PORT,
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/rpg/api/health")
      return Response.json({ ok: true, pop: players.size });
    if (url.pathname === "/rpg/ws") {
      // Behind Caddy: real client IP is the first X-Forwarded-For hop, not the
      // loopback peer address `srv.requestIP` would report.
      const xff = req.headers.get("x-forwarded-for");
      const ip = (xff ? xff.split(",")[0].trim() : null) || srv.requestIP(req)?.address || "unknown";
      if ((connByIp.get(ip) ?? 0) >= MAX_CONN_PER_IP)
        return new Response("too many connections", { status: 429 });
      if (srv.upgrade(req, { data: { player: null, badJson: 0, loggingIn: false, ip, tokens: MSG_BUCKET_CAP, lastRefill: Date.now() } })) return undefined;
      return new Response("websocket upgrade required", { status: 426 });
    }
    return new Response("not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      connByIp.set(ws.data.ip, (connByIp.get(ws.data.ip) ?? 0) + 1);
    },
    message(ws, raw) {
      try {
        handleMsg(ws, raw);
      } catch (e) {
        console.error("[rpg] message error:", e);
      }
    },
    close(ws) {
      const n = (connByIp.get(ws.data.ip) ?? 1) - 1;
      if (n <= 0) connByIp.delete(ws.data.ip); else connByIp.set(ws.data.ip, n);
      const p = ws.data.player;
      ws.data.player = null;
      if (p && p.ws === ws) {
        if (p.tradeId) cancelTrade(p, "Intercambio cancelado");
        if (p.duelWith) cancelDuel(p, "Tu rival se desconectó");
        p.ws = null;
        p.disconnectedAt = Date.now(); // linger in memory so a quick reconnect keeps party/state
        savePlayer(p);
        if (!BOT_SQUAD.has(p.name)) sysChat(`${p.name} se ha ido.`);
      }
    },
  },
});

setInterval(simTick, TICK_MS);
setInterval(snapshotTick, SNAP_MS);
setInterval(saveAll, 30000);

// Finalizes players who dropped and never reconnected within the grace window.
// Party membership is durable (SQLite) — logout/disconnect/restart do NOT leave
// the party. Only an explicit party_leave clears it. Linger just frees memory.
const PARTY_LINGER_MS = 90000;
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.disconnectedAt && !p.ws && now - p.disconnectedAt > PARTY_LINGER_MS) {
      savePlayer(p);
      partyUnload(p); // stay in durable roster; drop live handle only
      players.delete(p.name);
      playersById.delete(p.id);
    }
  }
}, 10000);
setInterval(restock, 300000);

function shutdown(): void {
  for (const pt of liveParties.values()) persistParty(pt);
  saveAll();
  db.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(
  `[rpg] listening :${server.port} world ${W}x${W} spawns=${world.spawns.length} reach=${world.reachCount} npcs=${npcs.length} db=${DB_PATH}`,
);
