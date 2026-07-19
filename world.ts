// world.ts — deterministic 160x160 world (+ Campos Asfódelos / Minotaur labyrinth) for Age of Titans: map generation,
// walkability grid, flood-fill reachability, spawn tables, A* pathfinding.

export const W = 160;
export const H = 160;
export const SEED = 20260718;

// Seeded PRNG (mulberry32) — the whole world derives from SEED, so server
// restarts always produce the identical map the clients already understand.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TOWN = { x: 30, y: 80 };
// Safe zone: no monster spawns/aggro, players cannot be hit inside.
export const TOWN_RECT = { x0: 21, y0: 71, x1: 40, y1: 90 };
const PLAZA = { x0: 24, y0: 74, x1: 37, y1: 87 };
// Small non-walkable basin at the plaza's heart, between Nikandros (y≈76.5)
// and the merchant row (y≈83.5) — the "recall" skill also lands players here.
export const FOUNTAIN = { x: 30, y: 79, r: 1.6 };

export const ZONES = [
  { name: "Los Olivares", x0: 48, y0: 55, x1: 80, y1: 105, lvl: "1-5" },
  { name: "Ruinas de Argos", x0: 86, y0: 50, x1: 114, y1: 100, lvl: "6-10" },
  { name: "Hondonada de la Gorgona", x0: 118, y0: 58, x1: 142, y1: 100, lvl: "11-13" },
  { name: "Guarida del Cíclope", x0: 132, y0: 104, x1: 155, y1: 126, lvl: "15" },
  { name: "Campos Asfódelos", x0: 118, y0: 16, x1: 155, y1: 52, lvl: "16-20" },
];

export const NPC_DEFS = [
  { kind: "elder", name: "Nikandros", x: 30.5, y: 76.5 },
  { kind: "merchant", name: "Kora", x: 26.5, y: 83.5 },
  { kind: "smith", name: "Bront", x: 34.5, y: 83.5 },
  { kind: "portal", name: "Piedra de tránsito", x: 22.5, y: 78.5 },
];


export const ZONE_PORTAL_ID: Record<string, string> = {
  "Los Olivares": "olivares",
  "Ruinas de Argos": "argos",
  "Hondonada de la Gorgona": "gorgona",
  "Guarida del Cíclope": "ciclope",
  "Campos Asfódelos": "asfodelos",
};

export const PORTAL_WAYPOINTS: Record<string, { x: number; y: number; label: string }> = {
  helike: { x: 30.5, y: 82, label: "Helike (plaza)" },
  olivares: { x: 62.5, y: 82, label: "Los Olivares" },
  argos: { x: 98.5, y: 78, label: "Ruinas de Argos" },
  gorgona: { x: 128.5, y: 72, label: "Hondonada de la Gorgona" },
  ciclope: { x: 142.5, y: 108, label: "Guarida del Cíclope" },
  asfodelos: { x: 132.5, y: 44, label: "Campos Asfódelos" },
};

export const BOSS_POS = { x: 145.5, y: 115.5 };
export const BOSS2_POS = { x: 140.5, y: 30.5 }; // Asterión the Minotaur — labyrinth heart

export interface SpawnPoint {
  x: number;
  y: number;
  kind: string;
  lvl: number;
}

export interface World {
  tiles: string[]; // 160 strings of 160 chars
  walk: Uint8Array; // 1 = walkable
  reach: Uint8Array; // 1 = reachable from town
  reachCount: number;
  spawns: SpawnPoint[];
}

const BLOCKING = "wtrWF"; // tile chars that block movement ('F' = fountain basin)

export function inRect(
  x: number,
  y: number,
  r: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

export function buildWorld(): World {
  const rng = mulberry32(SEED);
  const g: string[][] = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill("g"));

  // --- water border on all edges; wide sea + beach along the south ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wob = Math.floor(1.6 + 1.4 * Math.sin((x + y) / 7)); // 0..3 wiggle
      if (x < 3 + (y % 5 === 0 ? 1 : 0) || x >= W - 3 - wob * 0 || y < 3) {
        if (x < 3 || x >= W - 3 || y < 3) g[y][x] = "w";
      }
      if (y >= 150 + wob) g[y][x] = "w";
      else if (y >= 146 + wob && g[y][x] === "g") g[y][x] = "s";
    }
  }

  // --- Ruins of Argos: walled buildings with ruined floors and doors ---
  const buildings = [
    { x0: 90, y0: 58, x1: 97, y1: 64, door: "s" },
    { x0: 103, y0: 63, x1: 111, y1: 70, door: "s" },
    { x0: 89, y0: 87, x1: 96, y1: 93, door: "n" },
    { x0: 103, y0: 86, x1: 112, y1: 94, door: "n" },
  ];
  for (const b of buildings) {
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const edge = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
        g[y][x] = edge ? "W" : "f";
      }
    const mid = Math.floor((b.x0 + b.x1) / 2);
    const dy = b.door === "s" ? b.y1 : b.y0;
    g[dy][mid] = "f";
    g[dy][mid + 1] = "f";
  }
  // Crumbled floor patches between buildings (walkable flavor).
  for (let i = 0; i < 10; i++) {
    const cx = 88 + Math.floor(rng() * 25);
    const cy = 54 + Math.floor(rng() * 44);
    for (let y = cy; y < cy + 3; y++)
      for (let x = cx; x < cx + 4; x++)
        if (y < H && x < W && g[y][x] === "g") g[y][x] = "f";
  }

  // --- Gorgon's Hollow: rocky ground ---
  const HZ = ZONES[2];
  for (let y = HZ.y0; y <= HZ.y1; y++)
    for (let x = HZ.x0; x <= HZ.x1; x++)
      if (g[y][x] === "g" && rng() < 0.1) g[y][x] = "r";

  // --- Cyclops arena: ring of rocks around the boss (road cuts the gap) ---
  const AC = { x: 145, y: 115 };
  for (let y = AC.y - 11; y <= AC.y + 11; y++)
    for (let x = AC.x - 11; x <= AC.x + 11; x++) {
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      const d = Math.hypot(x - AC.x, y - AC.y);
      if (d >= 8.5 && d < 10 && g[y][x] !== "w") g[y][x] = "r";
      else if (d < 8.5 && (g[y][x] === "r" || g[y][x] === "t")) g[y][x] = "g";
    }

  // --- scattered trees & rocks (never over town, water, walls, floors) ---
  const OG = ZONES[0];
  for (let y = 4; y < H - 4; y++)
    for (let x = 4; x < W - 4; x++) {
      if (g[y][x] !== "g") continue;
      if (inRect(x, y, { x0: TOWN_RECT.x0 - 2, y0: TOWN_RECT.y0 - 2, x1: TOWN_RECT.x1 + 2, y1: TOWN_RECT.y1 + 2 })) continue;
      const olive = inRect(x, y, OG);
      const roll = rng();
      if (roll < (olive ? 0.11 : 0.05)) g[y][x] = "t";
      else if (roll < (olive ? 0.125 : 0.062)) g[y][x] = "r";
    }

  // --- town plaza (stone) ---
  for (let y = PLAZA.y0; y <= PLAZA.y1; y++)
    for (let x = PLAZA.x0; x <= PLAZA.x1; x++) g[y][x] = "p";
  // Grass apron: clear obstacles in the whole town rect around the plaza.
  for (let y = TOWN_RECT.y0; y <= TOWN_RECT.y1; y++)
    for (let x = TOWN_RECT.x0; x <= TOWN_RECT.x1; x++)
      if (g[y][x] === "t" || g[y][x] === "r") g[y][x] = "g";

  // --- plaza fountain: small non-walkable basin at the heart of Helike, a
  // few tiles south of Nikandros and north of the merchant row, in the open
  // stretch of stone between them. The town anchor tile (flood-fill start,
  // player-facing minimap marker) is force-cleared afterward so it can never
  // land inside the basin regardless of radius tuning.
  for (let y = Math.floor(FOUNTAIN.y - FOUNTAIN.r); y <= Math.ceil(FOUNTAIN.y + FOUNTAIN.r); y++)
    for (let x = Math.floor(FOUNTAIN.x - FOUNTAIN.r); x <= Math.ceil(FOUNTAIN.x + FOUNTAIN.r); x++)
      if (Math.hypot(x - FOUNTAIN.x, y - FOUNTAIN.y) <= FOUNTAIN.r) g[y][x] = "F";
  g[TOWN.y][TOWN.x] = "p";

  // --- dirt roads (carved last so they always cut through scatter) ---
  const roadY = (x: number) => 79 + Math.round(2 * Math.sin(x / 9));
  for (let x = 37; x <= 150; x++) {
    const y = roadY(x);
    for (const yy of [y, y + 1])
      if (g[yy][x] !== "w" && g[yy][x] !== "p") g[yy][x] = "d";
  }
  // Branch south into the Cyclops Lair.
  {
    const bx = 144;
    const top = roadY(bx);
    for (let y = top; y <= 116; y++)
      for (const xx of [bx, bx + 1])
        if (g[y][xx] !== "w") g[y][xx] = "d";
  }

  // Guarantee no wall sits on an NPC tile.
  for (const n of NPC_DEFS) g[Math.floor(n.y)][Math.floor(n.x)] = "p";

  // --- Campos Asfódelos (north of Gorgona): ash / pale ruin patches ---
  const AZ = ZONES[4];
  for (let y = AZ.y0; y <= AZ.y1; y++)
    for (let x = AZ.x0; x <= AZ.x1; x++) {
      if (g[y][x] !== "g") continue;
      if (rng() < 0.08) g[y][x] = "f";
      else if (rng() < 0.06) g[y][x] = "r";
    }

  // --- Labyrinth of Asterión: concentric broken walls around BOSS2 ---
  const LAB = { x: Math.floor(BOSS2_POS.x), y: Math.floor(BOSS2_POS.y) };
  for (let y = LAB.y - 10; y <= LAB.y + 10; y++)
    for (let x = LAB.x - 10; x <= LAB.x + 10; x++) {
      if (x < 4 || x >= W - 4 || y < 4 || y >= H - 4) continue;
      const dx = Math.abs(x - LAB.x), dy = Math.abs(y - LAB.y);
      const ring = (dx === 9 || dy === 9) || (dx === 5 || dy === 5);
      const gate =
        (dx === 9 && dy <= 1) || (dy === 9 && dx <= 1) ||
        (dx === 5 && dy <= 1) || (dy === 5 && dx <= 1);
      if (ring && !gate) g[y][x] = "W";
      else if (dx <= 3 && dy <= 3 && (g[y][x] === "t" || g[y][x] === "r" || g[y][x] === "W"))
        g[y][x] = "f";
    }
  // Clear a walkable heart for the boss.
  for (let y = LAB.y - 2; y <= LAB.y + 2; y++)
    for (let x = LAB.x - 2; x <= LAB.x + 2; x++)
      if (g[y][x] === "W" || g[y][x] === "t" || g[y][x] === "r") g[y][x] = "f";

  // Dirt road branch north from the main road into the Asphodel fields / labyrinth.
  {
    const bx = 136;
    const top = roadY(bx);
    for (let y = 28; y <= top; y++)
      for (const xx of [bx, bx + 1])
        if (g[y][xx] !== "w" && g[y][xx] !== "F") g[y][xx] = "d";
    // spur east into the labyrinth gate
    for (let x = bx; x <= LAB.x; x++)
      for (const yy of [29, 30])
        if (g[yy][x] !== "w" && g[yy][x] !== "F") g[yy][x] = "d";
  }

  const tiles = g.map((row) => row.join(""));
  const walk = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      walk[y * W + x] = BLOCKING.includes(tiles[y][x]) ? 0 : 1;

  // --- flood fill from town: reachability of the whole playfield ---
  const reach = new Uint8Array(W * H);
  let reachCount = 0;
  {
    const q = new Int32Array(W * H);
    let qh = 0,
      qt = 0;
    const start = TOWN.y * W + TOWN.x;
    if (!walk[start]) throw new Error("world: town center is not walkable");
    reach[start] = 1;
    q[qt++] = start;
    while (qh < qt) {
      const c = q[qh++];
      reachCount++;
      const cx = c % W,
        cy = (c / W) | 0;
      for (const [dx, dy] of NB4) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (walk[n] && !reach[n]) {
          reach[n] = 1;
          q[qt++] = n;
        }
      }
    }
  }

  // --- monster spawn points, ~120 total, only on reachable tiles ---
  const spawns: SpawnPoint[] = [];
  const place = (
    n: number,
    kind: string,
    lo: number,
    hi: number,
    rect: { x0: number; y0: number; x1: number; y1: number },
  ) => {
    let attempts = 0;
    while (n > 0 && attempts++ < 20000) {
      const x = rect.x0 + Math.floor(rng() * (rect.x1 - rect.x0 + 1));
      const y = rect.y0 + Math.floor(rng() * (rect.y1 - rect.y0 + 1));
      const t = tiles[y][x];
      if (!reach[y * W + x]) continue;
      if (t !== "g" && t !== "f" && t !== "s") continue; // keep roads clear
      if (spawns.some((s) => Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2)) continue;
      spawns.push({ x: x + 0.5, y: y + 0.5, kind, lvl: lo + Math.floor(rng() * (hi - lo + 1)) });
      n--;
    }
    if (n > 0) throw new Error(`world: could not place all ${kind} spawns (${n} left)`);
  };
  place(30, "boar", 1, 2, { x0: 48, y0: 55, x1: 66, y1: 105 });
  place(25, "satyr", 3, 5, { x0: 64, y0: 55, x1: 80, y1: 105 });
  place(25, "skeleton", 6, 8, ZONES[1]);
  place(15, "harpy", 8, 10, ZONES[1]);
  place(24, "gorgon", 11, 13, ZONES[2]);
  spawns.push({ x: BOSS_POS.x, y: BOSS_POS.y, kind: "cyclops", lvl: 15 });
  place(20, "shade", 16, 18, ZONES[4]);
  place(14, "fury", 18, 20, ZONES[4]);
  spawns.push({ x: BOSS2_POS.x, y: BOSS2_POS.y, kind: "minotaur", lvl: 20 });

  // --- startup assertions: nothing may be walled off ---
  for (const s of spawns) {
    if (!reach[Math.floor(s.y) * W + Math.floor(s.x)])
      throw new Error(`world: spawn ${s.kind}@${s.x},${s.y} unreachable from town`);
  }
  if (!reach[Math.floor(BOSS_POS.y) * W + Math.floor(BOSS_POS.x)])
    throw new Error("world: boss arena unreachable from town");
  if (!reach[Math.floor(BOSS2_POS.y) * W + Math.floor(BOSS2_POS.x)])
    throw new Error("world: minotaur labyrinth unreachable from town");
  for (const npc of NPC_DEFS)
    if (!reach[Math.floor(npc.y) * W + Math.floor(npc.x)])
      throw new Error(`world: NPC ${npc.name} unreachable`);
  if (reachCount < 8000) throw new Error(`world: suspiciously few reachable tiles (${reachCount})`);

  return { tiles, walk, reach, reachCount, spawns };
}

const NB4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NB8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// ---------------------------------------------------------------------------
// A* pathfinding (8-directional, no corner cutting), capped node expansion.
// Reusable stamped arrays avoid per-call allocation of the whole grid.
// ---------------------------------------------------------------------------
const gScore = new Float64Array(W * H);
const came = new Int32Array(W * H);
const stampArr = new Int32Array(W * H);
let stampGen = 0;

/** Find the nearest walkable tile to (tx,ty) within `r` tiles, or -1. */
export function nearestWalkable(walk: Uint8Array, tx: number, ty: number, r = 6): number {
  const cx = Math.floor(tx),
    cy = Math.floor(ty);
  if (cx >= 0 && cy >= 0 && cx < W && cy < H && walk[cy * W + cx]) return cy * W + cx;
  for (let rad = 1; rad <= r; rad++) {
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (walk[ny * W + nx]) return ny * W + nx;
      }
  }
  return -1;
}

/**
 * A* from (sx,sy) to (tx,ty) in world coords. Returns waypoints (tile centers,
 * final waypoint = exact target when its tile is the path end), or null when
 * no path was found within the expansion cap (~4000 nodes).
 */
export function astar(
  walk: Uint8Array,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  cap = 4000,
): { x: number; y: number }[] | null {
  const start = Math.floor(sy) * W + Math.floor(sx);
  const tgt = nearestWalkable(walk, tx, ty);
  if (tgt < 0 || !walk[start]) return null;
  if (start === tgt) return [{ x: tx, y: ty }];

  stampGen++;
  const gen = stampGen;
  const tX = tgt % W,
    tY = (tgt / W) | 0;
  const hCost = (c: number) => {
    const dx = Math.abs((c % W) - tX),
      dy = Math.abs(((c / W) | 0) - tY);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };

  // Binary min-heap of [f, cell].
  const heap: number[] = [];
  const fOf = new Map<number, number>();
  const push = (c: number, f: number) => {
    fOf.set(c, f);
    heap.push(c);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fOf.get(heap[p])! <= f) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      const fl = fOf.get(last)!;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i,
          fm = fl;
        if (l < heap.length && fOf.get(heap[l])! < fm) {
          m = l;
          fm = fOf.get(heap[l])!;
        }
        if (r < heap.length && fOf.get(heap[r])! < fm) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  stampArr[start] = gen;
  gScore[start] = 0;
  came[start] = -1;
  push(start, hCost(start));
  let expanded = 0;

  while (heap.length) {
    const cur = pop();
    if (cur === tgt) {
      // Reconstruct: collect tile centers, then simplify collinear runs.
      const rev: number[] = [];
      for (let c = cur; c !== -1; c = came[c]) rev.push(c);
      rev.reverse();
      const pts: { x: number; y: number }[] = [];
      let pdx = 99,
        pdy = 99;
      for (let i = 1; i < rev.length; i++) {
        const x = (rev[i] % W) + 0.5,
          y = ((rev[i] / W) | 0) + 0.5;
        const dx = Math.sign(rev[i] % W - (rev[i - 1] % W)),
          dy = Math.sign(((rev[i] / W) | 0) - ((rev[i - 1] / W) | 0));
        if (dx === pdx && dy === pdy && pts.length) pts[pts.length - 1] = { x, y };
        else pts.push({ x, y });
        pdx = dx;
        pdy = dy;
      }
      // Walk to the exact click point when it lies in the final tile.
      if (Math.floor(tx) + Math.floor(ty) * W === tgt && walk[tgt]) {
        if (pts.length) pts[pts.length - 1] = { x: tx, y: ty };
        else pts.push({ x: tx, y: ty });
      }
      return pts;
    }
    if (++expanded > cap) return null;
    const cx = cur % W,
      cy = (cur / W) | 0;
    const cg = gScore[cur];
    for (const [dx, dy] of NB8) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!walk[n]) continue;
      // No corner cutting: diagonal moves need both orthogonal tiles open.
      if (dx && dy && (!walk[cy * W + nx] || !walk[ny * W + cx])) continue;
      const ng = cg + (dx && dy ? 1.4142 : 1);
      if (stampArr[n] !== gen || ng < gScore[n]) {
        stampArr[n] = gen;
        gScore[n] = ng;
        came[n] = cur;
        push(n, ng + hCost(n));
      }
    }
  }
  return null;
}
