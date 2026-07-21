// bot.ts — always-online class companion bots (no LLM).
// Speaks the same WebSocket protocol as a browser client. Keeps the hero
// logged in, accepts party invites ONLY from whitelisted humans, assists party
// mates (follow + attack), and when alone hunts the nearest mob.
import { FOUNTAIN, TOWN } from "./world";

const WS_URL = process.env.RPG_WS || "ws://127.0.0.1:8792/rpg/ws";
const HEALTH = process.env.RPG_HEALTH || "http://127.0.0.1:8792/rpg/api/health";
const NAME = process.env.BOT_NAME || "Achilles";
const PASS = process.env.BOT_PASS || "";
const BOT_CLS = (process.env.BOT_CLS || "warrior").toLowerCase();
const BOT_ALLOT = (process.env.BOT_ALLOT || ({ warrior: "str", hunter: "dex", mage: "int", cleric: "int" } as Record<string, string>)[BOT_CLS] || "str") as "str" | "dex" | "int";
const RECONNECT_MS = Number(process.env.BOT_RECONNECT_MS) || 3000;
const TICK_MS = 400;

if (!PASS) {
  console.error("[bot] BOT_PASS is required (set in /etc/ideitas/rpg-bot*.env)");
  process.exit(1);
}
if (!["warrior", "hunter", "mage", "cleric"].includes(BOT_CLS)) {
  console.error(`[bot] BOT_CLS must be warrior|hunter|mage|cleric (got ${BOT_CLS})`);
  process.exit(1);
}
if (!["str", "dex", "int"].includes(BOT_ALLOT)) {
  console.error(`[bot] BOT_ALLOT must be str|dex|int (got ${BOT_ALLOT})`);
  process.exit(1);
}

type Json = Record<string, unknown>;
type Ent = { i: number; k: string; x: number; y: number; h?: number; H?: number; n?: string; s?: number };
type SkillDef = { n: number; cost: number; cd: number; unlock: number; kind: string };

const MOB_KINDS = new Set(["boar", "satyr", "skeleton", "harpy", "gorgon", "cyclops", "shade", "fury", "minotaur"]);
const ALLOWED_PARTY = new Set(["cansao", "cansao2", "mayco"]);
const SQUAD_BOTS = new Set(["Achilles", "Atalanta", "Circe", "Chiron"]);
const SQUAD_LEADER = process.env.BOT_SQUAD_LEADER || "Achilles";
const NAME_RE = new RegExp(`\\b${NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHealthy(timeoutMs = 60000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(HEALTH);
      if (r.ok) return;
    } catch { /* retry */ }
    await sleep(1500);
  }
  throw new Error("game server health check timed out");
}

function skillReach(sk: SkillDef): number {
  if (sk.kind === "target") return 8;
  if (sk.kind === "point") return 10;
  // self AoE radii (approx)
  if (sk.n === 4) return 3.6;
  if (sk.n === 3) return 4.2;
  if (sk.n === 2) return 5.2;
  return 12;
}

class Companion {
  ws: WebSocket | null = null;
  id = -1;
  x = TOWN.x;
  y = TOWN.y + 3;
  hp = 1;
  mhp = 1;
  mp = 0;
  mmp = 0;
  dead = false;
  party: { id: number; name: string; cls: string; lvl: number; online?: boolean }[] = [];
  pendingInvite: string | null = null;
  leaveEmptyAt = 0;
  followId: number | null = null;
  ents = new Map<number, Ent>();
  skills: SkillDef[] = [];
  cds: Record<number, number> = {};
  lvl = 1;
  pts = 0;
  cls = "";
  lastChatAt = 0;
  lastDirAt = 0;
  lastDir: { x: number; y: number } | null = null;
  wanderAt = 0;
  targetXY: { x: number; y: number } | null = null;
  greeted = new Set<string>();
  stopping = false;

  send(msg: Json): void {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  async start(): Promise<void> {
    for (;;) {
      if (this.stopping) return;
      try {
        await waitHealthy();
        await this.connectOnce();
      } catch (e) {
        if (!this.stopping) {
          this._sessionErrs = (this._sessionErrs || 0) + 1;
          if (this._sessionErrs <= 1 || this._sessionErrs % 20 === 0)
            console.error(`[bot:${NAME}] session ended (#${this._sessionErrs}):`, e);
        }
      }
      this.resetSession();
      if (this.stopping) return;
      // Keep reconnect notices rare so journal stays readable across bot restarts.
      this._reconnects = (this._reconnects || 0) + 1;
      if (this._reconnects === 1 || this._reconnects % 50 === 0) {
        console.log(`[bot:${NAME}] reconnecting in ${RECONNECT_MS}ms… (#${this._reconnects})`);
      }
      await sleep(RECONNECT_MS);
    }
  }

  resetSession(): void {
    this.ws = null;
    this.id = -1;
    this.dead = false;
    this.party = [];
    this.pendingInvite = null;
    this.leaveEmptyAt = 0;
    this.followId = null;
    this.ents.clear();
    this.skills = [];
    this.cds = {};
    this.lvl = 1;
    this.pts = 0;
    this.cls = "";
    this.lastDir = null;
    this.targetXY = null;
  }

  connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;
      let tick: ReturnType<typeof setInterval> | null = null;
      let opened = false;

      const cleanup = () => {
        if (tick) clearInterval(tick);
        tick = null;
      };

      ws.onopen = () => {
        opened = true;
        if (!this._seenConnect) { this._seenConnect = true; console.log(`[bot:${NAME}] connected`); }
        this.send({ t: "login", name: NAME, pass: PASS, cls: BOT_CLS });
      };

      ws.onmessage = (ev) => {
        let msg: Json;
        try { msg = JSON.parse(String(ev.data)); }
        catch { return; }
        this.onMsg(msg);
        if (!tick && this.id > 0) {
          tick = setInterval(() => {
            try { this.tick(); } catch (e) {
              this._tickErrs = (this._tickErrs || 0) + 1;
              if (this._tickErrs <= 2 || this._tickErrs % 25 === 0)
                console.error(`[bot:${NAME}] tick error (#${this._tickErrs}):`, e);
            }
          }, TICK_MS);
        }
      };

      ws.onerror = () => { /* reconnect loop logs the failure */ };

      ws.onclose = () => {
        cleanup();
        if (!opened) reject(new Error("ws closed before open"));
        else resolve();
      };
    });
  }

  onMsg(msg: Json): void {
    const t = msg.t;
    if (t === "err") {
      console.error(`[bot:${NAME}] server err:`, msg.msg);
      this.ws?.close();
      return;
    }
    if (t === "welcome") {
      this.id = msg.id as number;
      this.cls = typeof msg.cls === "string" ? msg.cls : BOT_CLS;
      const skills = Array.isArray(msg.skills)
        ? msg.skills as SkillDef[]
        : [];
      this.skills = skills.map((sk) => ({
        n: Number(sk.n) || 0,
        cost: Number(sk.cost) || 0,
        cd: Number(sk.cd) || 0,
        unlock: Number(sk.unlock) || 1,
        kind: typeof sk.kind === "string" ? sk.kind : "self",
      })).filter((sk) => sk.n >= 1 && sk.n <= 4);
      this.cds = {};
      if (!this._seenOnline) { this._seenOnline = true; console.log(`[bot:${NAME}] online id=${this.id} ${this.cls}`); }
      return;
    }
    if (t === "you") {
      this.hp = Number(msg.hp) || this.hp;
      this.mhp = Number(msg.mhp) || this.mhp;
      this.mp = Number(msg.mp) || this.mp;
      this.mmp = Number(msg.mmp) || this.mmp;
      if (typeof msg.lvl === "number") this.lvl = msg.lvl;
      if (typeof msg.pts === "number") this.pts = msg.pts;
      this.autoAllot();
      return;
    }
    if (t === "dead") {
      this.dead = true;
      return;
    }
    if (t === "party") {
      const members = Array.isArray(msg.members)
        ? msg.members as { id: number; name: string; cls: string; lvl: number; online?: boolean }[]
        : [];
      this.party = members;
      if (this.pendingInvite && !this.hasOnlinePartyMate()) {
        const from = this.pendingInvite;
        this.pendingInvite = null;
        this.leaveEmptyAt = 0;
        this.send({ t: "party_accept", from });
        this.maybeSay(`¡Vamos, ${from}! ${NAME} te sigue.`);
        return;
      }
      if (this.party.length && !this.hasOnlinePartyMate() && !this.hasSquadRosterMate()) {
        if (!this.leaveEmptyAt) this.leaveEmptyAt = Date.now() + 1500;
      } else {
        this.leaveEmptyAt = 0;
      }
      return;
    }
    if (t === "party_invited") {
      const from = typeof msg.from === "string" ? msg.from : null;
      if (from) {
        const allowed = this.isAllowedInviter(from);
        if (!allowed) {
          this.send({ t: "party_decline", from });
          return;
        }
        if (this.hasOnlinePartyMate()) {
          this.send({ t: "party_decline", from });
          return;
        }
        if (this.party.length && !this.hasSquadRosterMate()) {
          this.pendingInvite = from;
          this.send({ t: "party_leave" });
          return;
        }
        // Whitelisted humans inviting bots are auto-joined server-side (partyJoinHumanToBotSquad).
        this.send({ t: "party_accept", from });
        this.maybeSay(`¡Vamos, ${from}! ${NAME} te sigue.`);
      }
      return;
    }
    if (t === "follow_state") {
      this.followId = (msg.id as number | null) ?? null;
      return;
    }
    if (t === "chat") {
      const text = typeof msg.text === "string" ? msg.text : "";
      const from = typeof msg.from === "string" ? msg.from : "";
      if (!from || from === NAME || msg.sys) return;
      if (NAME_RE.test(text)) {
        this.maybeSay(`¿Qué necesitas, ${from}?`);
      }
      return;
    }
    if (t === "st") {
      const ents = Array.isArray(msg.ents) ? msg.ents as Ent[] : [];
      const gone = Array.isArray(msg.gone) ? msg.gone as number[] : [];
      for (const id of gone) this.ents.delete(id);
      for (const e of ents) {
        if (typeof e.i !== "number") continue;
        this.ents.set(e.i, e);
        if (e.i === this.id) {
          this.x = e.x;
          this.y = e.y;
          if (typeof e.h === "number") this.hp = e.h;
          if (typeof e.H === "number") this.mhp = e.H;
        }
      }
      for (const e of ents) {
        if (!e.n || e.i === this.id || MOB_KINDS.has(e.k)
          || e.k === "elder" || e.k === "merchant" || e.k === "smith") continue;
        if (this.greeted.has(e.n)) continue;
        if (dist(this.x, this.y, e.x, e.y) <= 10) {
          this.greeted.add(e.n);
          this.maybeSay(`Saludos, ${e.n}.`);
        }
      }
    }
  }

  /** Dump every stat point into the configured primary stat (one per you-msg). */
  autoAllot(): void {
    if (this.pts <= 0) return;
    this.send({ t: "allot", stat: BOT_ALLOT });
  }

  maybeSay(text: string): void {
    const now = Date.now();
    if (now - this.lastChatAt < 8000) return;
    this.lastChatAt = now;
    this.send({ t: "chat", text: text.slice(0, 180) });
  }

  setDir(dx: number, dy: number): void {
    const ix = Math.sign(dx), iy = Math.sign(dy);
    const now = Date.now();
    if (this.lastDir && this.lastDir.x === ix && this.lastDir.y === iy && now - this.lastDirAt < 800) return;
    this.lastDir = { x: ix, y: iy };
    this.lastDirAt = now;
    this.send({ t: "dir", x: ix, y: iy });
  }

  stopMove(): void {
    if (this.lastDir && this.lastDir.x === 0 && this.lastDir.y === 0) return;
    this.lastDir = { x: 0, y: 0 };
    this.lastDirAt = Date.now();
    this.send({ t: "dir", x: 0, y: 0 });
  }

  moveToward(tx: number, ty: number, stopAt = 1.2): boolean {
    const d = dist(this.x, this.y, tx, ty);
    if (d <= stopAt) {
      this.stopMove();
      return true;
    }
    this.setDir(tx - this.x, ty - this.y);
    return false;
  }

  pickWander(): { x: number; y: number } {
    const ang = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 4;
    return { x: FOUNTAIN.x + Math.cos(ang) * r, y: FOUNTAIN.y + Math.sin(ang) * r };
  }

  hasOnlinePartyMate(): boolean {
    return this.party.some((m) => m.id !== this.id && m.id > 0 && m.online !== false);
  }

  hasSquadRosterMate(): boolean {
    return this.party.some((m) => m.id !== this.id && SQUAD_BOTS.has(m.name));
  }

  isAllowedInviter(from: string): boolean {
    const n = from.toLowerCase();
    return ALLOWED_PARTY.has(n) || SQUAD_BOTS.has(from);
  }

  pickPartyMate(): { id: number; name: string; x: number; y: number; visible: boolean } | null {
    const mateRow = (m: { id: number; name: string; online?: boolean }) => {
      if (m.id === this.id || m.id <= 0 || m.online === false) return null;
      const e = this.ents.get(m.id);
      if (e) return { id: m.id, name: m.name, x: e.x, y: e.y, visible: true };
      return { id: m.id, name: m.name, x: this.x, y: this.y, visible: false };
    };

    // Squad followers stick to Achilles so the four bots move as one pack.
    if (NAME !== SQUAD_LEADER) {
      const leader = this.party.find((m) => m.name === SQUAD_LEADER);
      const lm = leader ? mateRow(leader) : null;
      if (lm) return lm;
    } else {
      // Leader follows a whitelisted human in the party, not other bots.
      const human = this.party.find((m) => m.id !== this.id && m.id > 0 && m.online !== false && !SQUAD_BOTS.has(m.name));
      const hm = human ? mateRow(human) : null;
      if (hm) return hm;
      return null;
    }

    let bestVis: { id: number; name: string; x: number; y: number; visible: boolean } | null = null;
    let bestD = Infinity;
    let anyOnline: { id: number; name: string; x: number; y: number; visible: boolean } | null = null;
    for (const m of this.party) {
      const row = mateRow(m);
      if (!row) continue;
      if (row.visible) {
        const d = dist(this.x, this.y, row.x, row.y);
        if (d < bestD) { bestD = d; bestVis = row; }
      } else if (!anyOnline) anyOnline = row;
    }
    return bestVis || anyOnline;
  }

  nearestMob(maxR = 12): Ent | null {
    let best: Ent | null = null;
    let bestD = maxR;
    for (const e of this.ents.values()) {
      if (!MOB_KINDS.has(e.k) || (e.h ?? 1) <= 0) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  pickHuntSpot(): { x: number; y: number } {
    return { x: 52 + Math.random() * 22, y: 70 + Math.random() * 24 };
  }

  castSkill(sk: SkillDef, mob: Ent | null): boolean {
    const now = Date.now();
    if (this.lvl < sk.unlock || this.mp < sk.cost || (this.cds[sk.n] || 0) > now) return false;

    if (sk.kind === "target") {
      if (!mob) return false;
      if (dist(this.x, this.y, mob.x, mob.y) > skillReach(sk)) return false;
      this.send({ t: "skill", n: sk.n, id: mob.i });
    } else if (sk.kind === "point") {
      if (!mob) return false;
      if (dist(this.x, this.y, mob.x, mob.y) > skillReach(sk)) return false;
      this.send({ t: "skill", n: sk.n, x: mob.x, y: mob.y });
    } else {
      if (mob && dist(this.x, this.y, mob.x, mob.y) > skillReach(sk)) return false;
      this.send({ t: "skill", n: sk.n });
    }
    this.cds[sk.n] = now + sk.cd;
    this.mp = Math.max(0, this.mp - sk.cost);
    return true;
  }

  tryUseSkills(nearMob: Ent | null): void {
    if (!this.skills.length) return;

    // Cleric: heal when hurt before attacking.
    if (this.cls === "cleric" && this.hp < this.mhp * 0.65) {
      for (const n of [1, 2, 3]) {
        const sk = this.skills.find((s) => s.n === n);
        if (sk && this.castSkill(sk, nearMob)) return;
      }
    }

    if (!nearMob) return;
    const order = [...this.skills].sort((a, b) => b.n - a.n);
    for (const sk of order) {
      if (this.castSkill(sk, nearMob)) return;
    }
  }

  tick(): void {
    if (this.id < 0) return;

    if (this.dead) {
      this.send({ t: "respawn" });
      this.dead = false;
      this.targetXY = null;
      this.followId = null;
      this.stopMove();
      return;
    }

    if (this.hp < this.mhp * 0.55) {
      this.send({ t: "attack", id: 0 });
      this.moveToward(FOUNTAIN.x, FOUNTAIN.y + 2.2, 1.5);
      return;
    }

    if (this.leaveEmptyAt && Date.now() >= this.leaveEmptyAt && this.party.length && !this.hasOnlinePartyMate() && !this.hasSquadRosterMate()) {
      this.leaveEmptyAt = 0;
      this.send({ t: "party_leave" });
      return;
    }

    const mate = this.pickPartyMate();
    if (mate) {
      if (this.followId !== mate.id) {
        this.send({ t: "party_follow", id: mate.id });
        this.followId = mate.id;
      }
      const mob = this.nearestMob(mate.visible ? 12 : 8);
      if (mob) {
        const nearSelf = dist(this.x, this.y, mob.x, mob.y) < 9;
        const nearMate = mate.visible && dist(mate.x, mate.y, mob.x, mob.y) < 10;
        if (nearSelf || nearMate) {
          this.send({ t: "attack", id: mob.i });
          this.tryUseSkills(mob);
        }
      }
      this.stopMove();
      return;
    }

    if (this.followId != null) {
      this.send({ t: "party_follow", id: null });
      this.followId = null;
    }

    const prey = this.nearestMob(22);
    if (prey) {
      this.targetXY = null;
      this.send({ t: "attack", id: prey.i });
      this.tryUseSkills(prey);
      this.stopMove();
      return;
    }

    const now = Date.now();
    if (!this.targetXY || now >= this.wanderAt
      || dist(this.x, this.y, this.targetXY.x, this.targetXY.y) < 1.5) {
      this.targetXY = this.pickHuntSpot();
      this.wanderAt = now + 5000 + Math.floor(Math.random() * 4000);
    }
    this.moveToward(this.targetXY.x, this.targetXY.y, 1.2);
  }

  stop(): void {
    this.stopping = true;
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

const bot = new Companion();
process.on("SIGTERM", () => { bot.stop(); });
process.on("SIGINT", () => { bot.stop(); });

console.log(`[bot:${NAME}] start ${BOT_CLS}`);
await bot.start();
