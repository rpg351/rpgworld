// data.ts — Age of Titans content tables: classes, skills, monsters, items,
// affixes, quests, NPC dialog. Pure data + item rolling helpers.

// ---------------------------------------------------------------------------
// Classes & skills
// ---------------------------------------------------------------------------
export const CLASS_BASE: Record<string, { str: number; dex: number; int: number; primaryStat: "str" | "dex" | "int" }> = {
  warrior: { str: 10, dex: 6, int: 4, primaryStat: "str" },
  hunter: { str: 6, dex: 10, int: 4, primaryStat: "dex" },
  mage: { str: 4, dex: 6, int: 10, primaryStat: "int" },
  cleric: { str: 6, dex: 5, int: 9, primaryStat: "int" },
};

export interface SkillDef {
  n: number;
  name: string;
  desc: string;
  cost: number; // mana
  cd: number; // ms
  unlock: number; // level (floor; active tree node rank >= 1 also required for n > 1)
  kind: "target" | "point" | "self";
  // Flat damage model: dmg = base + perRank·(rank−1) + coeff·statPrimario
  // (+ weaponShare·daño rodado del arma para habilidades con arma). base 0 = puro apoyo.
  base: number;
  perRank: number;
  coeff: number;
  weaponShare?: number; // fraction of the weapon's rolled damage added (warrior/hunter)
  radius?: number; // aoe radius (self: around caster, point: around x,y)
  stun?: number; // ms
  slow?: { pct: number; ms: number };
  // Flat healing model: cura = base + perRank·(rank−1) + coeff·INT del lanzador.
  heal?: { base: number; perRank: number; coeff: number };
  healParty?: boolean; // also heal living party mates inside radius
  healMostHurt?: boolean; // also heal the single lowest-HP% living party mate in range
  fx: { k: "proj"; style: string } | { k: "aoe"; style: string } | { k: "heal" };
}

// ---------------------------------------------------------------------------
// Tabla de ajuste (rank 1 ≈ salida del antiguo modelo pct al nivel de
// desbloqueo con equipo típico: pct·(daño medio del arma del tier + stat·mult
// de WEAPON_SCALING); stat primario estimado = base + 2·(nivel−1)):
//   guerrero  s1 160% @1  (esp t1 4.5, str 10) ≈ 15 → base 5  + 0.8·str  + 0.5·arma
//             s2 100% @4  (esp t1 4.5, str 16) ≈ 13 → base 2  + 0.5·str  + 0.5·arma
//             s3 220% @8  (esp t2 9,   str 24) ≈ 46 → base 15 + 1.1·str  + 0.5·arma
//             s4 350% @12 (esp t3 15,  str 32) ≈109 → base 45 + 1.75·str + 0.5·arma
//   cazador   s1 180% @1  (arco t1 4,  dex 10) ≈ 16 → base 5  + 0.9·dex  + 0.5·arma
//             s2 120% @4  (arco t1 4,  dex 16) ≈ 14 → base 3  + 0.6·dex  + 0.5·arma
//             s3 250% @8  (arco t2 8,  dex 24) ≈ 50 → base 16 + 1.25·dex + 0.5·arma
//   mago      s1 170% @1  (bastón t1 3.5, int 10) ≈ 16 → base 6  + 1.0·int
//             s2 130% @4  (bastón t1 3.5, int 16) ≈ 17 → base 4  + 0.8·int
//             s3 280% @8  (bastón t2 7,   int 24) ≈ 60 → base 19 + 1.7·int
//   clérigo   s3 150% @8  (bastón t2 7,   int 23) ≈ 31 → base 10 + 0.9·int
//             s4 320% @12 (bastón t3 12,  int 31) ≈ 98 → base 39 + 1.9·int
// perRank ≈ 25% del daño de rank 1 (rank 5 ≈ ×2). Curas: mismas fórmulas con
// valores ajustados al mhp de la franja de nivel de cada hechizo.
// ---------------------------------------------------------------------------
export const SKILLS: Record<string, SkillDef[]> = {
  warrior: [
    { n: 1, name: "Hendidura", desc: "Barre con tu arma en un arco. Daño según tu Fuerza, tu arma y el rango del nodo.", cost: 8, cd: 5000, unlock: 1, kind: "self", base: 5, perRank: 4, coeff: 0.8, weaponShare: 0.5, radius: 2.2, fx: { k: "aoe", style: "cleave" } },
    { n: 2, name: "Grito de guerra", desc: "Aterroriza a los enemigos cercanos: daño en área y 1.5s de aturdimiento.", cost: 12, cd: 10000, unlock: 4, kind: "self", base: 2, perRank: 3, coeff: 0.5, weaponShare: 0.5, radius: 3, stun: 1500, fx: { k: "aoe", style: "cry" } },
    { n: 3, name: "Torbellino", desc: "Gira en un círculo mortal e inflige un gran daño con tu arma.", cost: 20, cd: 12000, unlock: 8, kind: "self", base: 15, perRank: 11, coeff: 1.1, weaponShare: 0.5, radius: 2.5, fx: { k: "aoe", style: "cleave" } },
    { n: 4, name: "Cólera titánica", desc: "ULTIMATE: desatas la furia de Ares — daño masivo en área y 1s de aturdimiento.", cost: 28, cd: 20000, unlock: 12, kind: "self", base: 45, perRank: 27, coeff: 1.75, weaponShare: 0.5, radius: 3.5, stun: 1000, fx: { k: "aoe", style: "titan" } },
    { n: 5, name: "Embestida", desc: "Cargas contra tu objetivo con un golpe veloz y de bajo coste. Daño según tu Fuerza, tu arma y el rango del nodo.", cost: 6, cd: 3500, unlock: 1, kind: "target", base: 4, perRank: 3, coeff: 0.7, weaponShare: 0.5, fx: { k: "proj", style: "arrow" } },
    { n: 6, name: "Golpe Sísmico", desc: "Golpeas el suelo con fuerza descomunal: daño en área y aturde a los enemigos golpeados.", cost: 18, cd: 11000, unlock: 8, kind: "point", base: 14, perRank: 10, coeff: 1.0, weaponShare: 0.5, radius: 2.5, stun: 800, fx: { k: "aoe", style: "slam" } },
    { n: 7, name: "Salto de Escudo", desc: "Saltas sobre tu objetivo escudo en alto: impacto certero que lo aturde brevemente.", cost: 18, cd: 10000, unlock: 8, kind: "target", base: 17, perRank: 12, coeff: 1.15, weaponShare: 0.5, stun: 600, fx: { k: "proj", style: "arrow" } },
    { n: 8, name: "Avatar de Ares", desc: "ULTIMATE: te conviertes en el avatar de Ares — daño masivo a tu alrededor con la furia del dios de la guerra.", cost: 26, cd: 19000, unlock: 12, kind: "self", base: 40, perRank: 24, coeff: 1.6, weaponShare: 0.5, radius: 3, fx: { k: "aoe", style: "titan" } },
    { n: 9, name: "Grito Ancestral", desc: "ULTIMATE: un grito ancestral resuena a tu alrededor — daño en área y un largo aturdimiento a los enemigos cercanos.", cost: 28, cd: 20000, unlock: 12, kind: "self", base: 20, perRank: 14, coeff: 1.0, weaponShare: 0.5, radius: 3.8, stun: 1800, fx: { k: "aoe", style: "cry" } },
  ],
  hunter: [
    { n: 1, name: "Disparo perforante", desc: "Una flecha precisa. Daño según tu Destreza, tu arco y el rango del nodo.", cost: 8, cd: 4000, unlock: 1, kind: "target", base: 5, perRank: 4, coeff: 0.9, weaponShare: 0.5, fx: { k: "proj", style: "arrow" } },
    { n: 2, name: "Ráfaga", desc: "Las flechas cubren un área e hieren a todos los enemigos dentro.", cost: 14, cd: 9000, unlock: 4, kind: "point", base: 3, perRank: 4, coeff: 0.6, weaponShare: 0.5, radius: 2.5, fx: { k: "aoe", style: "volley" } },
    { n: 3, name: "Lluvia de flechas", desc: "Una tormenta de flechas castiga un área amplia.", cost: 22, cd: 14000, unlock: 8, kind: "point", base: 16, perRank: 12, coeff: 1.25, weaponShare: 0.5, radius: 3, fx: { k: "aoe", style: "volley" } },
    { n: 4, name: "Tormenta de Ártemis", desc: "ULTIMATE: invocas la tormenta de Ártemis — una lluvia de flechas letales castiga un área amplia y ralentiza a los enemigos.", cost: 26, cd: 18000, unlock: 12, kind: "point", base: 48, perRank: 29, coeff: 2.0, weaponShare: 0.5, radius: 3.3, slow: { pct: 0.4, ms: 2500 }, fx: { k: "aoe", style: "volley" } },
    { n: 5, name: "Flecha Rápida", desc: "Un disparo veloz y económico. Daño según tu Destreza, tu arco y el rango del nodo.", cost: 6, cd: 3000, unlock: 1, kind: "target", base: 4, perRank: 3, coeff: 0.75, weaponShare: 0.5, fx: { k: "proj", style: "arrow" } },
    { n: 6, name: "Trampa Punzante", desc: "Colocas una trampa que hiere y ralentiza a los enemigos atrapados.", cost: 18, cd: 11000, unlock: 8, kind: "point", base: 13, perRank: 9, coeff: 1.0, weaponShare: 0.5, radius: 2, slow: { pct: 0.35, ms: 2500 }, fx: { k: "aoe", style: "slam" } },
    { n: 7, name: "Tiro de Halcón", desc: "Un tiro certero guiado por la vista del halcón: gran daño a un solo objetivo.", cost: 19, cd: 10000, unlock: 8, kind: "target", base: 18, perRank: 13, coeff: 1.3, weaponShare: 0.6, fx: { k: "proj", style: "arrow" } },
    { n: 8, name: "Danza de Flechas", desc: "ULTIMATE: danzas liberando una ráfaga furiosa de flechas sobre un área amplia.", cost: 26, cd: 19000, unlock: 12, kind: "point", base: 44, perRank: 26, coeff: 1.85, weaponShare: 0.5, radius: 3, fx: { k: "aoe", style: "volley" } },
    { n: 9, name: "Ojo de Águila", desc: "ULTIMATE: concentras tu puntería con el ojo del águila — un disparo devastador a un solo objetivo.", cost: 28, cd: 20000, unlock: 12, kind: "target", base: 50, perRank: 30, coeff: 2.1, weaponShare: 0.6, fx: { k: "proj", style: "arrow" } },
  ],
  mage: [
    { n: 1, name: "Descarga ígnea", desc: "Lanza fuego a un objetivo. Daño según tu Inteligencia y el rango del nodo.", cost: 7, cd: 3000, unlock: 1, kind: "target", base: 6, perRank: 4, coeff: 1.0, fx: { k: "proj", style: "fire" } },
    { n: 2, name: "Nova de escarcha", desc: "Estallido helado: daño en área y 50% de lentitud por 3s.", cost: 14, cd: 10000, unlock: 4, kind: "self", base: 4, perRank: 4, coeff: 0.8, radius: 3, slow: { pct: 0.5, ms: 3000 }, fx: { k: "aoe", style: "nova" } },
    { n: 3, name: "Meteoro", desc: "Invoca un meteoro que arrasa un área amplia.", cost: 24, cd: 15000, unlock: 8, kind: "point", base: 19, perRank: 15, coeff: 1.7, radius: 3, fx: { k: "aoe", style: "meteor" } },
    { n: 4, name: "Supernova Arcana", desc: "ULTIMATE: liberas toda tu energía arcana en una explosión devastadora a tu alrededor.", cost: 26, cd: 18000, unlock: 12, kind: "self", base: 57, perRank: 37, coeff: 2.7, radius: 3.8, fx: { k: "aoe", style: "meteor" } },
    { n: 5, name: "Chispa Arcana", desc: "Una chispa de energía arcana, rápida y económica. Daño según tu Inteligencia y el rango del nodo.", cost: 6, cd: 2500, unlock: 1, kind: "target", base: 5, perRank: 3, coeff: 0.85, fx: { k: "proj", style: "fire" } },
    { n: 6, name: "Cadena de Rayos", desc: "Un rayo salta hacia tu objetivo con gran fuerza arcana.", cost: 19, cd: 10000, unlock: 8, kind: "target", base: 17, perRank: 12, coeff: 1.5, fx: { k: "proj", style: "fire" } },
    { n: 7, name: "Muro Ígneo", desc: "Invocas un muro de fuego que castiga a los enemigos dentro del área.", cost: 18, cd: 11000, unlock: 8, kind: "point", base: 14, perRank: 10, coeff: 1.2, radius: 2.6, fx: { k: "aoe", style: "meteor" } },
    { n: 8, name: "Ira de Zeus", desc: "ULTIMATE: invocas la ira de Zeus — un estallido de rayos devastador sobre un área amplia.", cost: 26, cd: 19000, unlock: 12, kind: "point", base: 50, perRank: 30, coeff: 2.3, radius: 3.4, fx: { k: "aoe", style: "judgment" } },
    { n: 9, name: "Colapso Estelar", desc: "ULTIMATE: colapsas una estrella sobre tu objetivo — el daño arcano más devastador que existe.", cost: 28, cd: 20000, unlock: 12, kind: "target", base: 55, perRank: 34, coeff: 2.5, fx: { k: "proj", style: "holy" } },
  ],
  cleric: [
    { n: 1, name: "Oración", desc: "Invocas la luz de Asclepio: te curas a ti y al compañero de grupo más herido cercano. La cura crece con tu Inteligencia y el rango.", cost: 10, cd: 6000, unlock: 1, kind: "self", base: 0, perRank: 0, coeff: 0, heal: { base: 20, perRank: 8, coeff: 1.2 }, radius: 12, healMostHurt: true, fx: { k: "heal" } },
    { n: 2, name: "Himno sagrado", desc: "Un himno de Asclepio: curas a ti y a tus compañeros de grupo cercanos.", cost: 14, cd: 10000, unlock: 4, kind: "self", base: 0, perRank: 0, coeff: 0, radius: 5, heal: { base: 15, perRank: 7, coeff: 1.2 }, healParty: true, fx: { k: "aoe", style: "holy" } },
    { n: 3, name: "Círculo sagrado", desc: "Bendices el suelo: curas al grupo cercano e infliges daño sagrado a los enemigos.", cost: 20, cd: 14000, unlock: 8, kind: "self", base: 10, perRank: 8, coeff: 0.9, radius: 4, heal: { base: 20, perRank: 9, coeff: 1.5 }, healParty: true, fx: { k: "aoe", style: "holy" } },
    { n: 4, name: "Juicio de Zeus", desc: "ULTIMATE: rayos de Zeus caen a tu alrededor — daño sagrado a todos los enemigos cercanos (no apunta).", cost: 26, cd: 18000, unlock: 12, kind: "self", base: 39, perRank: 24, coeff: 1.9, radius: 3.6, fx: { k: "aoe", style: "judgment" } },
    { n: 5, name: "Luz Menor", desc: "Una luz curativa rápida y económica: cura al compañero de grupo más herido cercano (o a ti si estás solo).", cost: 7, cd: 4000, unlock: 1, kind: "self", base: 0, perRank: 0, coeff: 0, heal: { base: 12, perRank: 5, coeff: 0.9 }, healMostHurt: true, radius: 10, fx: { k: "heal" } },
    { n: 6, name: "Vendaje de Higía", desc: "Un vendaje bendecido por Higía: una gran curación a un solo aliado herido.", cost: 19, cd: 11000, unlock: 8, kind: "self", base: 0, perRank: 0, coeff: 0, heal: { base: 22, perRank: 10, coeff: 1.6 }, healMostHurt: true, radius: 10, fx: { k: "heal" } },
    { n: 7, name: "Llama Purificadora", desc: "Fuego sagrado que castiga a los enemigos y cura ligeramente a tu grupo cercano.", cost: 19, cd: 11000, unlock: 8, kind: "point", base: 16, perRank: 11, coeff: 1.1, radius: 3, heal: { base: 8, perRank: 5, coeff: 0.6 }, healParty: true, fx: { k: "aoe", style: "holy" } },
    { n: 8, name: "Renacer de Asclepio", desc: "ULTIMATE: invocas el renacer de Asclepio — una gran curación a todo tu grupo cercano.", cost: 27, cd: 19000, unlock: 12, kind: "self", base: 0, perRank: 0, coeff: 0, heal: { base: 35, perRank: 18, coeff: 2.0 }, healParty: true, radius: 6, fx: { k: "aoe", style: "holy" } },
    { n: 9, name: "Ira Divina", desc: "ULTIMATE: la ira divina golpea a tu alrededor con puro daño sagrado (no cura).", cost: 28, cd: 20000, unlock: 12, kind: "self", base: 44, perRank: 27, coeff: 2.0, radius: 3.6, fx: { k: "aoe", style: "titan" } },
  ],
};

// ---------------------------------------------------------------------------
// Árboles de habilidades por clase — nodos con rango 1..5 (1 punto por rango).
// Activos: rango 1 desbloquea la habilidad (skillN), rangos 2-5 suben su
// daño/curación (perRank de SKILLS). Pasivos: bono de stats por rango
// (aplicado server-side). Puertas por puntos TOTALES gastados: t1=0, t2=5, t3=12.
// ---------------------------------------------------------------------------
export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  tier: 1 | 2 | 3;
  max: 5;
  kind: "active" | "passive";
  skillN?: number; // active nodes: SKILLS[cls] entry this node unlocks/ranks
  perRankDesc: string;
}

export const TREES: Record<string, AbilityDef[]> = {
  warrior: [
    { id: "hendidura", name: "Hendidura", desc: "Barrido en arco con tu arma. Rango 1 la desbloquea (siempre disponible).", tier: 1, max: 5, kind: "active", skillN: 1, perRankDesc: "+4 de daño por rango" },
    { id: "grito", name: "Grito de guerra", desc: "Daño en área y aturdimiento de 1.5s.", tier: 1, max: 5, kind: "active", skillN: 2, perRankDesc: "+3 de daño por rango" },
    { id: "embestida", name: "Embestida", desc: "Carga veloz y económica contra tu objetivo. Rango 1 la desbloquea.", tier: 1, max: 5, kind: "active", skillN: 5, perRankDesc: "+3 de daño por rango" },
    { id: "w_vigor", name: "Vigor Espartano", desc: "Entrenamiento brutal del cuerpo.", tier: 1, max: 5, kind: "passive", perRankDesc: "+8 de vida máxima por rango" },
    { id: "w_piel", name: "Piel de Bronce", desc: "Tu piel se endurece como el escudo de Aquiles.", tier: 1, max: 5, kind: "passive", perRankDesc: "+2 de armadura por rango" },
    { id: "torbellino", name: "Torbellino", desc: "Giro mortal que golpea todo a tu alrededor.", tier: 2, max: 5, kind: "active", skillN: 3, perRankDesc: "+11 de daño por rango" },
    { id: "golpe_sismico", name: "Golpe Sísmico", desc: "Golpe de suelo que aturde a los enemigos cercanos al impacto.", tier: 2, max: 5, kind: "active", skillN: 6, perRankDesc: "+10 de daño por rango" },
    { id: "salto_escudo", name: "Salto de Escudo", desc: "Salto certero con el escudo que aturde a tu objetivo.", tier: 2, max: 5, kind: "active", skillN: 7, perRankDesc: "+12 de daño por rango" },
    { id: "w_filo", name: "Filo Implacable", desc: "Cada golpe de tus habilidades muerde más hondo.", tier: 2, max: 5, kind: "passive", perRankDesc: "+2 de daño de habilidades por rango" },
    { id: "w_crit", name: "Ojo de Ares", desc: "Detectas el punto débil del enemigo.", tier: 2, max: 5, kind: "passive", perRankDesc: "+1% de crítico por rango" },
    { id: "colera", name: "Cólera titánica", desc: "ULTIMATE: la furia de Ares desatada.", tier: 3, max: 5, kind: "active", skillN: 4, perRankDesc: "+27 de daño por rango" },
    { id: "avatar_ares", name: "Avatar de Ares", desc: "ULTIMATE: te conviertes en el avatar de Ares.", tier: 3, max: 5, kind: "active", skillN: 8, perRankDesc: "+24 de daño por rango" },
    { id: "grito_ancestral", name: "Grito Ancestral", desc: "ULTIMATE: grito ancestral que aturde largamente a tu alrededor.", tier: 3, max: 5, kind: "active", skillN: 9, perRankDesc: "+14 de daño por rango" },
    { id: "w_celeridad", name: "Ímpetu de Batalla", desc: "Tus habilidades se recuperan antes.", tier: 3, max: 5, kind: "passive", perRankDesc: "-3% de enfriamiento por rango" },
    { id: "w_fuerza", name: "Sangre de Heracles", desc: "La fuerza de los héroes corre por tus venas.", tier: 3, max: 5, kind: "passive", perRankDesc: "+1 de fuerza por rango" },
  ],
  hunter: [
    { id: "disparo", name: "Disparo perforante", desc: "Flecha precisa a un objetivo. Rango 1 la desbloquea (siempre disponible).", tier: 1, max: 5, kind: "active", skillN: 1, perRankDesc: "+4 de daño por rango" },
    { id: "rafaga", name: "Ráfaga", desc: "Lluvia corta de flechas sobre un punto.", tier: 1, max: 5, kind: "active", skillN: 2, perRankDesc: "+4 de daño por rango" },
    { id: "flecha_rapida", name: "Flecha Rápida", desc: "Disparo veloz y económico. Rango 1 la desbloquea.", tier: 1, max: 5, kind: "active", skillN: 5, perRankDesc: "+3 de daño por rango" },
    { id: "h_dex", name: "Gracia de Artemisa", desc: "Tus manos se vuelven más rápidas y firmes.", tier: 1, max: 5, kind: "passive", perRankDesc: "+1 de destreza por rango" },
    { id: "h_evasion", name: "Paso del Ciervo", desc: "Esquivas lo que a otros los mata.", tier: 1, max: 5, kind: "passive", perRankDesc: "+2 de armadura por rango" },
    { id: "lluvia", name: "Lluvia de flechas", desc: "Tormenta de flechas en un área amplia.", tier: 2, max: 5, kind: "active", skillN: 3, perRankDesc: "+12 de daño por rango" },
    { id: "trampa_punzante", name: "Trampa Punzante", desc: "Trampa que hiere y ralentiza a los enemigos atrapados.", tier: 2, max: 5, kind: "active", skillN: 6, perRankDesc: "+9 de daño por rango" },
    { id: "tiro_halcon", name: "Tiro de Halcón", desc: "Tiro certero de gran daño a un solo objetivo.", tier: 2, max: 5, kind: "active", skillN: 7, perRankDesc: "+13 de daño por rango" },
    { id: "h_crit", name: "Tiro Certero", desc: "Apuntas a la garganta, no al torso.", tier: 2, max: 5, kind: "passive", perRankDesc: "+1% de crítico por rango" },
    { id: "h_punta", name: "Puntas de Hierro", desc: "Forjas puntas que perforan cualquier pellejo.", tier: 2, max: 5, kind: "passive", perRankDesc: "+2 de daño de habilidades por rango" },
    { id: "h_veloz", name: "Viento del Monte", desc: "Corres como el viento de las cumbres.", tier: 3, max: 5, kind: "passive", perRankDesc: "+1% de velocidad de movimiento por rango" },
    { id: "h_aliento", name: "Aliento Salvaje", desc: "La vida agreste templa tu cuerpo.", tier: 3, max: 5, kind: "passive", perRankDesc: "+8 de vida máxima por rango" },
    { id: "tormenta_artemisa", name: "Tormenta de Ártemis", desc: "ULTIMATE: lluvia de flechas letales en área amplia con lentitud.", tier: 3, max: 5, kind: "active", skillN: 4, perRankDesc: "+29 de daño por rango" },
    { id: "danza_flechas", name: "Danza de Flechas", desc: "ULTIMATE: ráfaga furiosa de flechas sobre un área amplia.", tier: 3, max: 5, kind: "active", skillN: 8, perRankDesc: "+26 de daño por rango" },
    { id: "ojo_aguila", name: "Ojo de Águila", desc: "ULTIMATE: disparo devastador a un solo objetivo.", tier: 3, max: 5, kind: "active", skillN: 9, perRankDesc: "+30 de daño por rango" },
  ],
  mage: [
    { id: "descarga", name: "Descarga ígnea", desc: "Proyectil de fuego a un objetivo. Rango 1 la desbloquea (siempre disponible).", tier: 1, max: 5, kind: "active", skillN: 1, perRankDesc: "+4 de daño por rango" },
    { id: "nova", name: "Nova de escarcha", desc: "Estallido helado que frena a los enemigos.", tier: 1, max: 5, kind: "active", skillN: 2, perRankDesc: "+4 de daño por rango" },
    { id: "chispa_arcana", name: "Chispa Arcana", desc: "Chispa arcana veloz y económica. Rango 1 la desbloquea.", tier: 1, max: 5, kind: "active", skillN: 5, perRankDesc: "+3 de daño por rango" },
    { id: "m_int", name: "Mente de Atenea", desc: "Estudias los arcanos con disciplina.", tier: 1, max: 5, kind: "passive", perRankDesc: "+1 de inteligencia por rango" },
    { id: "m_mana", name: "Pozo del Éter", desc: "Tu reserva de maná se ensancha.", tier: 1, max: 5, kind: "passive", perRankDesc: "+6 de maná máximo por rango" },
    { id: "meteoro", name: "Meteoro", desc: "Invoca un meteoro devastador.", tier: 2, max: 5, kind: "active", skillN: 3, perRankDesc: "+15 de daño por rango" },
    { id: "cadena_rayos", name: "Cadena de Rayos", desc: "Rayo arcano de gran fuerza contra un objetivo.", tier: 2, max: 5, kind: "active", skillN: 6, perRankDesc: "+12 de daño por rango" },
    { id: "muro_igneo", name: "Muro Ígneo", desc: "Muro de fuego que castiga a los enemigos en el área.", tier: 2, max: 5, kind: "active", skillN: 7, perRankDesc: "+10 de daño por rango" },
    { id: "m_poder", name: "Poder Arcano", desc: "Tus hechizos golpean con más fuerza.", tier: 2, max: 5, kind: "passive", perRankDesc: "+2 de daño de hechizos por rango" },
    { id: "m_regen", name: "Flujo Etéreo", desc: "El maná fluye hacia ti sin cesar.", tier: 2, max: 5, kind: "passive", perRankDesc: "+0.2%/s de regeneración de maná por rango" },
    { id: "m_crit", name: "Chispa de Hécate", desc: "Tus hechizos estallan con violencia inesperada.", tier: 3, max: 5, kind: "passive", perRankDesc: "+1% de crítico por rango" },
    { id: "m_celeridad", name: "Tiempo Robado", desc: "Doblas el tiempo a tu favor.", tier: 3, max: 5, kind: "passive", perRankDesc: "-3% de enfriamiento por rango" },
    { id: "supernova", name: "Supernova Arcana", desc: "ULTIMATE: explosión arcana devastadora a tu alrededor.", tier: 3, max: 5, kind: "active", skillN: 4, perRankDesc: "+37 de daño por rango" },
    { id: "ira_zeus", name: "Ira de Zeus", desc: "ULTIMATE: estallido de rayos devastador sobre un área amplia.", tier: 3, max: 5, kind: "active", skillN: 8, perRankDesc: "+30 de daño por rango" },
    { id: "colapso_estelar", name: "Colapso Estelar", desc: "ULTIMATE: colapso estelar devastador contra un objetivo.", tier: 3, max: 5, kind: "active", skillN: 9, perRankDesc: "+34 de daño por rango" },
  ],
  cleric: [
    { id: "oracion", name: "Oración", desc: "Cura a ti y al aliado más herido. Rango 1 la desbloquea (siempre disponible).", tier: 1, max: 5, kind: "active", skillN: 1, perRankDesc: "+8 de curación por rango" },
    { id: "himno", name: "Himno sagrado", desc: "Cura de grupo alrededor tuyo.", tier: 1, max: 5, kind: "active", skillN: 2, perRankDesc: "+7 de curación por rango" },
    { id: "luz_menor", name: "Luz Menor", desc: "Curación rápida y económica al aliado más herido. Rango 1 la desbloquea.", tier: 1, max: 5, kind: "active", skillN: 5, perRankDesc: "+5 de curación por rango" },
    { id: "vital", name: "Bendición Vital", desc: "Asclepio fortalece tu cuerpo y espíritu.", tier: 1, max: 5, kind: "passive", perRankDesc: "+6 de vida y +4 de maná máximos por rango" },
    { id: "escudo", name: "Escudo de Fe", desc: "Tu fe desvía los golpes.", tier: 1, max: 5, kind: "passive", perRankDesc: "+2 de armadura por rango" },
    { id: "circulo", name: "Círculo sagrado", desc: "Suelo bendito: cura aliados y quema enemigos.", tier: 2, max: 5, kind: "active", skillN: 3, perRankDesc: "+8 de daño y +9 de curación por rango" },
    { id: "vendaje_higia", name: "Vendaje de Higía", desc: "Gran curación a un solo aliado herido.", tier: 2, max: 5, kind: "active", skillN: 6, perRankDesc: "+10 de curación por rango" },
    { id: "llama_purificadora", name: "Llama Purificadora", desc: "Fuego sagrado: daño a enemigos y curación ligera al grupo.", tier: 2, max: 5, kind: "active", skillN: 7, perRankDesc: "+11 de daño y +5 de curación por rango" },
    { id: "resistencia", name: "Resistencia Divina", desc: "El favor de los dioses agudiza tus golpes.", tier: 2, max: 5, kind: "passive", perRankDesc: "+1% de crítico por rango" },
    { id: "manos", name: "Manos Curativas", desc: "Tus curaciones canalizan más luz.", tier: 2, max: 5, kind: "passive", perRankDesc: "+3% de poder de curación por rango" },
    { id: "toque_asclepio", name: "Toque de Asclepio", desc: "Tu vida se restaura sola fuera de combate.", tier: 2, max: 5, kind: "passive", perRankDesc: "+0.4%/s de regeneración de vida por rango" },
    { id: "juicio", name: "Juicio de Zeus", desc: "ULTIMATE: rayos divinos a tu alrededor.", tier: 3, max: 5, kind: "active", skillN: 4, perRankDesc: "+24 de daño por rango" },
    { id: "renacer_asclepio", name: "Renacer de Asclepio", desc: "ULTIMATE: gran curación a todo tu grupo cercano.", tier: 3, max: 5, kind: "active", skillN: 8, perRankDesc: "+18 de curación por rango" },
    { id: "ira_divina", name: "Ira Divina", desc: "ULTIMATE: daño sagrado puro a tu alrededor.", tier: 3, max: 5, kind: "active", skillN: 9, perRankDesc: "+27 de daño por rango" },
    { id: "oracion_rapida", name: "Oración Rápida", desc: "Tus plegarias llegan antes al Olimpo.", tier: 3, max: 5, kind: "passive", perRankDesc: "-2% de enfriamiento por rango" },
    { id: "aura_fuente", name: "Aura de la Fuente", desc: "La fuente sagrada de Helike te alcanza más lejos.", tier: 3, max: 5, kind: "passive", perRankDesc: "+0.5 de radio de regeneración junto a la fuente por rango" },
    { id: "comunion", name: "Comunión", desc: "Tu luz abraza a más compañeros.", tier: 3, max: 5, kind: "passive", perRankDesc: "+0.3 de radio en curaciones de grupo por rango" },
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
  lizardman: { spd: 4.0, aggro: 7, range: 1.5, cd: 1400, hpM: 1.3, dmgM: 1.25 },
  wisp: { spd: 4.3, aggro: 7, range: 6.5, cd: 1600, ranged: "spit", hpM: 1.1, dmgM: 1.3 },
  hydra: { spd: 4.0, aggro: 12, range: 2.0, cd: 1900, hpM: 1, dmgM: 1 },
};

// Fixed combat stats for unique bosses (independent of the generic level formula below).
const BOSS_STATS: Record<string, { mhp: number; lo: number; hi: number; arm: number; xp: number; goldBase: number; goldRange: number }> = {
  cyclops: { mhp: 3200, lo: 26, hi: 38, arm: 40, xp: 900, goldBase: 120, goldRange: 80 },
  minotaur: { mhp: 5200, lo: 34, hi: 48, arm: 52, xp: 1600, goldBase: 220, goldRange: 120 },
  // Jefe del pantano (nivel 25): ~1.5x la vida del minotauro, golpea más fuerte.
  hydra: { mhp: 7800, lo: 46, hi: 66, arm: 66, xp: 2600, goldBase: 320, goldRange: 180 },
};

/** Derived monster combat stats by kind+level. */
export function mobStats(kind: string, lvl: number) {
  const d = MOB_DEFS[kind];
  const b = BOSS_STATS[kind];
  if (b) return { mhp: b.mhp, lo: b.lo, hi: b.hi, arm: b.arm, xp: b.xp, gold: () => b.goldBase + Math.floor(Math.random() * b.goldRange) };
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

export const TIER_LVL = [1, 5, 9, 13, 17, 21];

interface WeaponBase {
  icon: string;
  names: string[];
  dmg: [number, number][];
  val: number[];
}
export const WEAPON_TYPES: Record<string, WeaponBase> = {
  sword: { icon: "sword", names: ["Espada de bronce", "Xifos hoplita", "Kopis de acero", "Hoja de titán", "Espada de Cronos"], dmg: [[3, 6], [7, 11], [12, 18], [18, 27], [25, 37]], val: [30, 90, 220, 520, 1150] },
  axe: { icon: "axe", names: ["Hacha de mano", "Hacha barbada", "Labrys de guerra", "Labrys olímpica", "Hacha del Tártaro"], dmg: [[2, 8], [6, 14], [10, 22], [15, 32], [21, 44]], val: [30, 90, 220, 520, 1150] },
  bow: { icon: "bow", names: ["Arco corto", "Arco de cazador", "Arco compuesto", "Arco largo de Artemisa", "Arco solar de Apolo"], dmg: [[3, 5], [6, 10], [11, 16], [17, 24], [23, 33]], val: [30, 90, 220, 520, 1150] },
  staff: { icon: "staff", names: ["Bastón de fresno", "Bastón de roble", "Bastón rúnico", "Bastón de las tormentas", "Bastón del Éter"], dmg: [[2, 5], [5, 9], [9, 15], [14, 23], [19, 31]], val: [30, 90, 220, 520, 1150] },
};
/** Stat scaling per weapon icon: [stat, multiplier]. Unarmed behaves as sword. */
export const WEAPON_SCALING: Record<string, [string, number]> = {
  sword: ["str", 0.5],
  axe: ["str", 0.5],
  bow: ["dex", 0.5],
  staff: ["int", 0.6],
};

export const ARMOR_TYPES: Record<string, { icon: string; names: string[]; arm: number[]; val: number[] }> = {
  armor: { icon: "armor", names: ["Túnica de lino", "Coraza de cuero", "Coraza de bronce", "Placas de titán", "Coraza del Tártaro"], arm: [5, 12, 22, 34, 48], val: [25, 80, 200, 480, 1050] },
  helm: { icon: "helm", names: ["Gorro de cuero", "Yelmo de bronce", "Yelmo hoplita", "Yelmo corintio", "Yelmo de la Hidra"], arm: [3, 8, 14, 22, 32], val: [18, 60, 150, 360, 800] },
  ring: { icon: "ring", names: ["Anillo de cobre", "Anillo de plata", "Anillo de oro", "Sello del Olimpo", "Sello de Cronos"], arm: [0, 0, 0, 0, 0], val: [40, 110, 260, 600, 1350] },
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
  tier = Math.max(1, Math.min(5, tier));
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
// Pets (cosmetic followers with a small passive perk while equipped, bought
// from the pet-shop NPC). `stat` matches a Derived field except "gold",
// which instead boosts gold earned from kills (applied in rollDrops).
// Pets also have a small chance to "fetch" bonus gold on kill (server).
// ---------------------------------------------------------------------------
export type PetStat = "arm" | "crit" | "hp" | "gold" | "spd" | "dmgp" | "mp";
export const PET_DEFS: Record<string, { name: string; cost: number; stat: PetStat; amount: number; desc: string }> = {
  dog: { name: "Perro", cost: 150, stat: "arm", amount: 4, desc: "+4 armadura" },
  cat: { name: "Gato", cost: 150, stat: "crit", amount: 3, desc: "+3% crítico" },
  owl: { name: "Búho", cost: 300, stat: "gold", amount: 15, desc: "+15% oro de las bajas" },
  turtle: { name: "Tortuga", cost: 250, stat: "hp", amount: 40, desc: "+40 vida máxima" },
  fox: { name: "Zorro", cost: 400, stat: "spd", amount: 8, desc: "+8% velocidad" },
  hawk: { name: "Halcón", cost: 450, stat: "dmgp", amount: 8, desc: "+8% daño" },
  raven: { name: "Cuervo", cost: 350, stat: "mp", amount: 30, desc: "+30 maná máximo" },
};

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

export const QUEST_ORDER = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"];
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
  q10: { name: "Escamas del pantano", desc: "Más allá de los vados, hombres lagarto patrullan el Pantano de la Hidra. Elimina a 12 de ellos.", kind: "kill", target: "lizardman", count: 12, rew: { xp: 4500, gold: 2000 } },
  q11: { name: "Luces engañosas", desc: "Los fuegos fatuos atraen a los viajeros hacia las aguas negras. Apaga a 10 de ellos.", kind: "kill", target: "wisp", count: 10, rew: { xp: 5500, gold: 2400, item: "armor" } },
  q12: { name: "Las siete cabezas", desc: "En lo hondo del pantano duerme la Hidra de Lerna. Decapítala y vuelve con la prueba.", kind: "kill", target: "hydra", count: 1, rew: { xp: 8000, gold: 3500, item: "rare" } },
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
    "Cuando Asterión caiga, el pantano te llamará. No vayas solo.",
  ],
  merchant: [
    "¡Pociones, anillos, baratijas! Todo lo que un aventurero olvida hasta que es demasiado tarde.",
    "Recién llegado de las caravanas de Corinto... bueno, bastante fresco.",
  ],
  portal: [
    "Este portal antiguo abre caminos a las regiones que ya has pisado.",
    "Toca un destino para viajar al instante. Helike siempre está disponible.",
  ],
  smith: [
    "Bronce, hierro, acero: el argumento que zanja todas las discusiones.",
    "Lo forjé yo mismo. Si se rompe, lo estabas sujetando mal.",
  ],
  stash: [
    "Guarda aquí lo que no quepa en la mochila. Nadie más puede abrir tu cofre.",
    "Las reliquias del pantano pesan — deja sitio antes de salir.",
  ],
  petshop: [
    "Criaturas de Helike, domesticadas y leales. Elige bien: solo una te sigue a la vez.",
    "Un buen compañero no solo alegra el camino — también te fortalece en combate.",
  ],
  board: [
    "Escribe lo que el pueblo necesita. Los moderadores leen cada petición.",
    "Una idea clara vale más que mil quejas. Sé breve.",
  ],
};
