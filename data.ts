// data.ts — Age of Titans content tables: classes, skills, monsters, items,
// affixes, quests, NPC dialog. Pure data + item rolling helpers.

// ---------------------------------------------------------------------------
// Classes & skills
// ---------------------------------------------------------------------------
export const CLASS_BASE: Record<string, { str: number; dex: number; int: number }> = {
  warrior: { str: 10, dex: 6, int: 4 },
  hunter: { str: 6, dex: 10, int: 4 },
  mage: { str: 4, dex: 6, int: 10 },
  cleric: { str: 6, dex: 5, int: 9 },
};

export interface SkillDef {
  n: number;
  name: string;
  desc: string;
  cost: number; // mana
  cd: number; // ms
  unlock: number; // level
  kind: "target" | "point" | "self";
  pct: number; // weapon-damage multiplier (0 = pure support)
  radius?: number; // aoe radius (self: around caster, point: around x,y)
  stun?: number; // ms
  slow?: { pct: number; ms: number };
  heal?: number; // heal strength: fraction of max HP, or of missing HP if healMissing
  healMissing?: boolean; // if true, heal restores (missingHP * heal) instead of (mhp * heal)
  healParty?: boolean; // also heal living party mates inside radius
  healMostHurt?: boolean; // also heal the single lowest-HP% living party mate in range
  fx: { k: "proj"; style: string } | { k: "aoe"; style: string } | { k: "heal" };
}

export const SKILLS: Record<string, SkillDef[]> = {
  warrior: [
    { n: 1, name: "Hendidura", desc: "Barre con tu arma en un arco e inflige 160% de daño.", cost: 8, cd: 5000, unlock: 1, kind: "self", pct: 1.6, radius: 2.2, fx: { k: "aoe", style: "cleave" } },
    { n: 2, name: "Grito de guerra", desc: "Aterroriza a los enemigos cercanos: 100% de daño y 1.5s de aturdimiento.", cost: 12, cd: 10000, unlock: 4, kind: "self", pct: 1.0, radius: 3, stun: 1500, fx: { k: "aoe", style: "cry" } },
    { n: 3, name: "Torbellino", desc: "Gira en un círculo mortal e inflige 220% de daño.", cost: 20, cd: 12000, unlock: 8, kind: "self", pct: 2.2, radius: 2.5, fx: { k: "aoe", style: "cleave" } },
    { n: 4, name: "Cólera titánica", desc: "ULTIMATE: desatas la furia de Ares — 350% de daño en área y 1s de aturdimiento.", cost: 28, cd: 20000, unlock: 12, kind: "self", pct: 3.5, radius: 3.5, stun: 1000, fx: { k: "aoe", style: "titan" } },
  ],
  hunter: [
    { n: 1, name: "Disparo perforante", desc: "Una flecha precisa que inflige 180% de daño.", cost: 8, cd: 4000, unlock: 1, kind: "target", pct: 1.8, fx: { k: "proj", style: "arrow" } },
    { n: 2, name: "Ráfaga", desc: "Las flechas cubren un área e infligen 120% de daño.", cost: 14, cd: 9000, unlock: 4, kind: "point", pct: 1.2, radius: 2.5, fx: { k: "aoe", style: "volley" } },
    { n: 3, name: "Lluvia de flechas", desc: "Una tormenta de flechas: 250% de daño en un área amplia.", cost: 22, cd: 14000, unlock: 8, kind: "point", pct: 2.5, radius: 3, fx: { k: "aoe", style: "volley" } },
  ],
  mage: [
    { n: 1, name: "Descarga ígnea", desc: "Lanza fuego a un objetivo e inflige 170% de daño.", cost: 7, cd: 3000, unlock: 1, kind: "target", pct: 1.7, fx: { k: "proj", style: "fire" } },
    { n: 2, name: "Nova de escarcha", desc: "Estallido helado: 130% de daño y 50% de lentitud por 3s.", cost: 14, cd: 10000, unlock: 4, kind: "self", pct: 1.3, radius: 3, slow: { pct: 0.5, ms: 3000 }, fx: { k: "aoe", style: "nova" } },
    { n: 3, name: "Meteoro", desc: "Invoca un meteoro: 280% de daño en un área amplia.", cost: 24, cd: 15000, unlock: 8, kind: "point", pct: 2.8, radius: 3, fx: { k: "aoe", style: "meteor" } },
  ],
  cleric: [
    { n: 1, name: "Oración", desc: "Invocas la luz de Asclepio: curas el 70% de la vida perdida a ti y al compañero de grupo más herido cercano.", cost: 10, cd: 6000, unlock: 1, kind: "self", pct: 0, heal: 0.7, healMissing: true, radius: 12, healMostHurt: true, fx: { k: "heal" } },
    { n: 2, name: "Himno sagrado", desc: "Un himno de Asclepio: curas 30% de vida a ti y a tus compañeros de grupo cercanos.", cost: 14, cd: 10000, unlock: 4, kind: "self", pct: 0, radius: 5, heal: 0.3, healParty: true, fx: { k: "aoe", style: "holy" } },
    { n: 3, name: "Círculo sagrado", desc: "Bendices el suelo: curas 30% a ti y al grupo cercano e infliges 150% de daño sagrado a los enemigos.", cost: 20, cd: 14000, unlock: 8, kind: "self", pct: 1.5, radius: 4, heal: 0.3, healParty: true, fx: { k: "aoe", style: "holy" } },
    { n: 4, name: "Juicio de Zeus", desc: "ULTIMATE: rayos de Zeus caen a tu alrededor — 320% de daño sagrado a todos los enemigos cercanos (no apunta).", cost: 26, cd: 18000, unlock: 12, kind: "self", pct: 3.2, radius: 3.6, fx: { k: "aoe", style: "judgment" } },
  ],
};
export interface MobDef {
  spd: number; // tiles/s (below player 5.0)
  aggro: number;
  range: number; // attack range
  cd: number; // attack cooldown ms
  ranged?: string; // projectile fx style
  slow?: { pct: number; ms: number };
  hpM: number;
  dmgM: number;
}

export const MOB_DEFS: Record<string, MobDef> = {
  boar: { spd: 3.6, aggro: 6, range: 1.5, cd: 1500, hpM: 1.0, dmgM: 1.0 },
  satyr: { spd: 3.9, aggro: 6, range: 1.5, cd: 1400, hpM: 1.05, dmgM: 1.05 },
  skeleton: { spd: 3.5, aggro: 6, range: 1.5, cd: 1500, hpM: 1.15, dmgM: 1.1 },
  harpy: { spd: 4.1, aggro: 6, range: 6, cd: 1800, ranged: "spit", hpM: 0.85, dmgM: 1.0 },
  gorgon: { spd: 3.6, aggro: 6, range: 6, cd: 1900, ranged: "spit", slow: { pct: 0.4, ms: 2000 }, hpM: 1.0, dmgM: 1.1 },
  cyclops: { spd: 4.0, aggro: 10, range: 1.7, cd: 2200, hpM: 1, dmgM: 1 },
  shade: { spd: 4.0, aggro: 7, range: 1.5, cd: 1400, hpM: 1.2, dmgM: 1.15 },
  fury: { spd: 4.2, aggro: 7, range: 6.5, cd: 1700, ranged: "spit", hpM: 1.05, dmgM: 1.2 },
  minotaur: { spd: 4.1, aggro: 11, range: 1.8, cd: 2000, hpM: 1, dmgM: 1 },
};

/** Derived monster combat stats by kind+level. */
export function mobStats(kind: string, lvl: number) {
  const d = MOB_DEFS[kind];
  if (kind === "cyclops")
    return { mhp: 3200, lo: 26, hi: 38, arm: 40, xp: 900, gold: () => 120 + Math.floor(Math.random() * 80) };
  if (kind === "minotaur")
    return { mhp: 5200, lo: 34, hi: 48, arm: 52, xp: 1600, gold: () => 220 + Math.floor(Math.random() * 120) };
  const mhp = Math.round((16 + 13 * lvl) * d.hpM);
  const lo = Math.round((2 + 1.7 * lvl) * d.dmgM);
  return {
    mhp,
    lo,
    hi: lo + Math.round(2 + 0.9 * lvl),
    arm: 2 * lvl,
    xp: 10 + 7 * lvl,
    gold: () => 1 + lvl + Math.floor(Math.random() * (2 * lvl + 1)),
  };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export interface Item {
  id: number;
  base: string;
  name: string;
  slot: string; // weapon|armor|helm|ring|potion|quest
  icon: string;
  tier: number;
  rarity: string; // common|magic|rare
  lvl: number; // level requirement
  dmg?: [number, number];
  arm?: number;
  mods?: Record<string, number>;
  val: number;
  qty?: number;
}

export const TIER_LVL = [1, 5, 9, 13, 17];

interface WeaponBase {
  icon: string;
  names: string[];
  dmg: [number, number][];
  val: number[];
}
export const WEAPON_TYPES: Record<string, WeaponBase> = {
  sword: { icon: "sword", names: ["Espada de bronce", "Xifos hoplita", "Kopis de acero", "Hoja de titán"], dmg: [[3, 6], [7, 11], [12, 18], [18, 27]], val: [30, 90, 220, 520] },
  axe: { icon: "axe", names: ["Hacha de mano", "Hacha barbada", "Labrys de guerra", "Labrys olímpica"], dmg: [[2, 8], [6, 14], [10, 22], [15, 32]], val: [30, 90, 220, 520] },
  bow: { icon: "bow", names: ["Arco corto", "Arco de cazador", "Arco compuesto", "Arco largo de Artemisa"], dmg: [[3, 5], [6, 10], [11, 16], [17, 24]], val: [30, 90, 220, 520] },
  staff: { icon: "staff", names: ["Bastón de fresno", "Bastón de roble", "Bastón rúnico", "Bastón de las tormentas"], dmg: [[2, 5], [5, 9], [9, 15], [14, 23]], val: [30, 90, 220, 520] },
};
/** Stat scaling per weapon icon: [stat, multiplier]. Unarmed behaves as sword. */
export const WEAPON_SCALING: Record<string, [string, number]> = {
  sword: ["str", 0.5],
  axe: ["str", 0.5],
  bow: ["dex", 0.5],
  staff: ["int", 0.6],
};

export const ARMOR_TYPES: Record<string, { icon: string; names: string[]; arm: number[]; val: number[] }> = {
  armor: { icon: "armor", names: ["Túnica de lino", "Coraza de cuero", "Coraza de bronce", "Placas de titán"], arm: [5, 12, 22, 34], val: [25, 80, 200, 480] },
  helm: { icon: "helm", names: ["Gorro de cuero", "Yelmo de bronce", "Yelmo hoplita", "Yelmo corintio"], arm: [3, 8, 14, 22], val: [18, 60, 150, 360] },
  ring: { icon: "ring", names: ["Anillo de cobre", "Anillo de plata", "Anillo de oro", "Sello del Olimpo"], arm: [0, 0, 0, 0], val: [40, 110, 260, 600] },
};

export const POTION_DEFS: Record<string, { name: string; icon: string; tier: number; heal: number; pool: "hp" | "mp"; val: number }> = {
  hp1: { name: "Poción de vida pequeña", icon: "potion_hp", tier: 1, heal: 0.4, pool: "hp", val: 12 },
  mp1: { name: "Poción de maná pequeña", icon: "potion_mp", tier: 1, heal: 0.4, pool: "mp", val: 14 },
  hp3: { name: "Poción de vida mayor", icon: "potion_hp", tier: 3, heal: 0.7, pool: "hp", val: 45 },
  mp3: { name: "Poción de maná mayor", icon: "potion_mp", tier: 3, heal: 0.7, pool: "mp", val: 50 },
};

const MOD_KEYS = ["str", "dex", "int", "hp", "mp", "arm", "dmgp", "crit"];
const MAGIC_SUFFIX: Record<string, string> = {
  str: "del poderío",
  dex: "de la agilidad",
  int: "del sabio",
  hp: "de la fortaleza",
  mp: "del místico",
  arm: "de la protección",
  dmgp: "de la ferocidad",
  crit: "de la precisión",
};
const EPIC_A = ["del Titán", "de la Gorgona", "del Kraken", "del Olimpo", "de la Estigia", "de Delfos", "del Héroe", "de la Tormenta", "del Sol", "de la Noche"];
const EPIC_B: Record<string, string[]> = {
  weapon: ["Colmillo", "Filo", "Ira", "Mordisco", "Furia", "Garra"],
  armor: ["Égida", "Baluarte", "Guardia", "Caparazón", "Amparo"],
  helm: ["Corona", "Semblante", "Mirada", "Cimera"],
  ring: ["Juramento", "Sigilo", "Sello", "Ojo", "Promesa"],
};

let nextItemId = 1;

/** Allocate a globally-unique item instance id (also used when re-hydrating saves). */
export function freshItemId(): number {
  return nextItemId++;
}

function iri(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function rollModValue(key: string, tier: number): number {
  switch (key) {
    case "str":
    case "dex":
    case "int":
      return iri(1, 2 + tier);
    case "hp":
      return iri(4 * tier, 10 * tier);
    case "mp":
      return iri(3 * tier, 8 * tier);
    case "arm":
      return iri(tier, 3 * tier);
    case "dmgp":
      return iri(2, 3 + 2 * tier);
    default:
      return iri(1, 1 + tier); // crit
  }
}

/** Roll rarity for a monster drop: common 70% / magic 25% / rare 5%. */
export function rollRarity(): string {
  const r = Math.random();
  return r < 0.7 ? "common" : r < 0.95 ? "magic" : "rare";
}

/**
 * Roll a full item instance. slotType weapon|armor|helm|ring; wtype picks a
 * specific weapon class (sword/axe/bow/staff), otherwise random.
 */
export function rollItem(slotType: string, tier: number, rarity: string, wtype?: string): Item {
  tier = Math.max(1, Math.min(4, tier));
  const ti = tier - 1;
  let base: string, icon: string, name: string, dmg: [number, number] | undefined, arm: number | undefined, val: number;
  if (slotType === "weapon") {
    const w = wtype && WEAPON_TYPES[wtype] ? wtype : ["sword", "axe", "bow", "staff"][iri(0, 3)];
    const wb = WEAPON_TYPES[w];
    base = `${w}${tier}`;
    icon = wb.icon;
    name = wb.names[ti];
    dmg = [wb.dmg[ti][0], wb.dmg[ti][1]];
    val = wb.val[ti];
  } else {
    const ab = ARMOR_TYPES[slotType];
    base = `${slotType}${tier}`;
    icon = ab.icon;
    name = ab.names[ti];
    arm = ab.arm[ti] || undefined;
    val = ab.val[ti];
  }
  // Rings are pure mod items — a modless ring is useless, so floor at magic.
  if (slotType === "ring" && rarity === "common") rarity = "magic";

  let mods: Record<string, number> | undefined;
  if (rarity !== "common") {
    const count = rarity === "magic" ? iri(1, 2) : iri(3, 4);
    const pool = [...MOD_KEYS];
    mods = {};
    for (let i = 0; i < count && pool.length; i++) {
      const k = pool.splice(iri(0, pool.length - 1), 1)[0];
      mods[k] = rollModValue(k, tier);
    }
    if (rarity === "magic") {
      name = `${name} ${MAGIC_SUFFIX[Object.keys(mods)[0]]}`;
      val = Math.round(val * 1.6);
    } else {
      const b = EPIC_B[slotType];
      name = `${b[iri(0, b.length - 1)]} ${EPIC_A[iri(0, EPIC_A.length - 1)]}`;
      val = Math.round(val * 2.5);
    }
  }
  const item: Item = { id: nextItemId++, base, name, slot: slotType, icon, tier, rarity, lvl: TIER_LVL[ti], val };
  if (dmg) item.dmg = dmg;
  if (arm) item.arm = arm;
  if (mods) item.mods = mods;
  return item;
}

export function makePotion(key: string, qty = 1): Item {
  const p = POTION_DEFS[key];
  return { id: nextItemId++, base: key, name: p.name, slot: "potion", icon: p.icon, tier: p.tier, rarity: "common", lvl: 1, val: p.val, qty };
}

export function makeQuestItem(base: string): Item {
  const name = base === "horn" ? "Cuerno de sátiro" : "Ojo de cíclope";
  const icon = base === "horn" ? "horn" : "eye";
  return { id: nextItemId++, base, name, slot: "quest", icon, tier: 1, rarity: "common", lvl: 1, val: 0, qty: 1 };
}

// ---------------------------------------------------------------------------
// Quests (chain: each requires the previous turned in)
// ---------------------------------------------------------------------------
export interface QuestDef {
  name: string;
  desc: string;
  kind: "kill" | "collect";
  target: string; // mob kind or quest-item base
  count: number;
  rew: { xp: number; gold: number; item?: "weapon" | "armor" | "rare" };
}

export const QUEST_ORDER = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
export const QUESTS: Record<string, QuestDef> = {
  q1: { name: "Jabalíes revoltosos", desc: "Los jabalíes pisotean nuestros olivares. Elimina a 8 de ellos.", kind: "kill", target: "boar", count: 8, rew: { xp: 120, gold: 50 } },
  q2: { name: "Cuernos salvajes", desc: "Tráeme 5 cuernos de sátiro de los juerguistas salvajes de los olivares.", kind: "collect", target: "horn", count: 5, rew: { xp: 250, gold: 100, item: "weapon" } },
  q3: { name: "Los muertos inquietos", desc: "Las Ruinas de Argos están plagadas de muertos. Destruye 10 esqueletos.", kind: "kill", target: "skeleton", count: 10, rew: { xp: 450, gold: 180 } },
  q4: { name: "Plumas y furia", desc: "Las arpías anidan sobre las murallas derruidas. Derriba a 8 de ellas.", kind: "kill", target: "harpy", count: 8, rew: { xp: 700, gold: 280, item: "armor" } },
  q5: { name: "Mirada de piedra", desc: "Mata a 6 gorgonas en la Hondonada — y no las mires a los ojos.", kind: "kill", target: "gorgon", count: 6, rew: { xp: 1000, gold: 420 } },
  q6: { name: "El ojo de la tormenta", desc: "El mismísimo Polifemo se agita en su guarida, en el lejano este. Acaba con él.", kind: "kill", target: "cyclops", count: 1, rew: { xp: 2200, gold: 1000, item: "rare" } },
  q7: { name: "Sombras del Asfódelo", desc: "Más allá de Polifemo se abren los Campos Asfódelos. Disuelve a 12 sombras de los muertos.", kind: "kill", target: "shade", count: 12, rew: { xp: 2800, gold: 1200 } },
  q8: { name: "Alas de venganza", desc: "Las Erinias cazan entre las nieblas. Derriba a 10 furias.", kind: "kill", target: "fury", count: 10, rew: { xp: 3600, gold: 1600, item: "armor" } },
  q9: { name: "El laberinto de Asterión", desc: "En el corazón del laberinto ruge el Minotauro Asterión. Entra y derrota al señor de la bestia.", kind: "kill", target: "minotaur", count: 1, rew: { xp: 5500, gold: 2500, item: "rare" } },
};

/** Class-matched weapon type for the q2 reward. */
export const CLASS_WEAPON: Record<string, string> = {
  warrior: "sword",
  hunter: "bow",
  mage: "staff",
  cleric: "staff",
};

// ---------------------------------------------------------------------------
// NPC dialog flavor
// ---------------------------------------------------------------------------
export const NPC_LINES: Record<string, string[]> = {
  elder: [
    "Bienvenido a Helike, viajero. Los caminos del este se vuelven más peligrosos cada día.",
    "Los dioses nos ponen a prueba: bestias en los olivares, muertos que caminan en Argos.",
    "Demuestra tu valía, y Helike no lo olvidará.",
  ],
  merchant: [
    "¡Pociones, anillos, baratijas! Todo lo que un aventurero olvida hasta que es demasiado tarde.",
    "Recién llegado de las caravanas de Corinto... bueno, bastante fresco.",
  ],
  portal: [
    "Esta piedra antigua abre caminos a las regiones que ya has pisado.",
    "Toca un destino para viajar al instante. Helike siempre está disponible.",
  ],
  smith: [
    "Bronce, hierro, acero: el argumento que zanja todas las discusiones.",
    "Lo forjé yo mismo. Si se rompe, lo estabas sujetando mal.",
  ],
};
