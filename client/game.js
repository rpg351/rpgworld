// ../var/www/ideitas.online/rpg/game.js
var $ = (id) => document.getElementById(id);
var BOSS_KINDS = new Set(["cyclops", "minotaur", "hydra"]);
var BOSS_MARKERS = [
  { k: "cyclops", x: 145.5, y: 115.5, n: "Polifemo" },
  { k: "minotaur", x: 140.5, y: 30.5, n: "Asterión" },
  { k: "hydra", x: 196.5, y: 100.5, n: "Hidra" },
];

function requireDom() {
  const need = ["loginForm", "game", "respawnBtn", "hpOrb", "mpOrb", "world"];
  for (const id of need) {
    if (!$(id)) {
      const u = location.pathname + "?v=" + Date.now();
      document.body.innerHTML = "<div style=\"padding:2rem;font-family:Georgia,serif;color:#e8dcc8;background:#1a140c;min-height:100vh;text-align:center\"><h2>Actualización necesaria</h2><p>Tu navegador tiene una versión antigua guardada.</p><p><a href=\"" + u + "\" style=\"color:#c8933b;font-size:18px\">Recargar el juego</a></p><p style=\"margin-top:1.5em;font-size:12px;color:#888\">O pulsa Ctrl+Shift+R</p></div>";
      throw new Error("stale HTML: missing #" + id);
    }
  }
}

var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var lerp = (a, b, t) => a + (b - a) * t;
var TILE = 32;
var now = () => performance.now();
function thash(x, y, salt) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (salt | 0) * 2246822519;
  h = (h ^ h >>> 13) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var RARITY_COLOR = { common: "#e8e0d0", magic: "#7fb3ff", rare: "#ffcf40" };
var MOD_NAMES = { str: "Fuerza", dex: "Destreza", int: "Inteligencia", hp: "Vida", mp: "Maná", arm: "Armadura", dmgp: "% Daño", crit: "% Crítico" };
var PET_LABELS = {
  dog: { name: "Perro", desc: "+4 armadura" },
  cat: { name: "Gato", desc: "+3% crítico" },
  owl: { name: "Búho", desc: "+15% oro" },
  turtle: { name: "Tortuga", desc: "+40 vida" },
  fox: { name: "Zorro", desc: "+8% velocidad" },
  hawk: { name: "Halcón", desc: "+8% daño" },
  raven: { name: "Cuervo", desc: "+30 maná" },
};
var RARITY_ES = { common: "común", magic: "mágico", rare: "raro" };
var SLOT_ES = { weapon: "arma", armor: "armadura", helm: "yelmo", ring: "anillo", potion: "poción", quest: "misión" };
// ---------------------------------------------------------------------------
// i18n — client-side UI-chrome only (menus, buttons, static labels). Content
// that comes from the server (item/quest/npc text, chat, zone names) stays in
// Spanish since it's authored server-side; translating that is a separate,
// much larger content-localization task.
// ---------------------------------------------------------------------------
var I18N = {
  es: {
    "login.subtitle": "Helike · Grecia mítica",
    "login.name": "Nombre del héroe",
    "login.pass": "Contraseña",
    "login.toLogin": "¿Ya tienes cuenta? Iniciar sesión",
    "login.toRegister": "¿No tienes héroe? Crear cuenta",
    "login.hint": "WASD mover · 1–4 habilidades · I inventario · C atacar · J diario",
    "login.enterRegister": "Crear héroe",
    "login.enterLogin": "Entrar al mundo",
    "cls.warrior.name": "Guerrero", "cls.warrior.desc": "Fuerza y armadura. Combate cuerpo a cuerpo.",
    "cls.hunter.name": "Cazador", "cls.hunter.desc": "Destreza y arco. Ataque a distancia.",
    "cls.mage.name": "Mago", "cls.mage.desc": "Inteligencia y hechizos elementales.",
    "cls.cleric.name": "Clérigo", "cls.cleric.desc": "Sanación sagrada y magia divina.",
    "panel.inv": "Inventario",
    "panel.dropHint": "Arrastra un objeto fuera del inventario para tirarlo al suelo.",
    "panel.sellHint": "Clic en un objeto para venderlo al mercader.",
    "panel.char": "Personaje",
    "panel.quest": "Diario de misiones",
    "panel.stash": "Cofre",
    "panel.pets": "Criadero",
    "mob.chat": "Chat", "mob.inv": "Inv", "mob.quest": "Misiones", "mob.char": "Héroe",
    "death.title": "Has caído",
    "death.respawn": "Resucitar en Helike",
    "death.countdown": (s) => `Revives automáticamente en ${s}s`,
    "death.countdownNow": "Revives en un instante…",
    "death.recap": "Últimos golpes",
    "panel.lootlog": "Botín reciente",
    "panel.combatlog": "Registro de combate",
    "lootlog.empty": "Aún no has recogido nada en esta sesión.",
    "combatlog.empty": "Aún no has recibido daño en esta sesión.",
    "opt.lootlog": "Mostrar botín reciente",
    "opt.combatlog": "Mostrar registro de combate",
    "opt.fps": "Mostrar FPS",
    "panel.worldmap": "Mapa del mundo",
    "panel.achs": "Logros",
    "panel.meter": "Sesión de combate",
    "meter.dealt": "Daño infligido",
    "meter.taken": "Daño recibido",
    "meter.healed": "Curado",
    "meter.kills": "Bajas",
    "meter.deaths": "Muertes",
    "meter.dps": "DPS",
    "achs.empty": "Aún no hay logros",
    "achs.stats": (k, g) => `Bajas: ${k} · Oro ganado: ${g}`,
    "chat.tab.all": "Todo",
    "chat.tab.party": "Grupo",
    "chat.tab.whisper": "Susurro",
    "chat.tab.sys": "Sistema",
    "opt.meter": "Mostrar medidor de sesión",
    "help.achs": "Logros",
    "help.who": "Lista de jugadores / amigos",
    "help.fish": "Pescar junto al agua (/fish o /pescar)",
    "help.deathmark": "Al morir queda una marca en el mapa hasta revivir",
    "panel.who": "Jugadores",
    "who.tab.online": "En línea",
    "who.tab.friends": "Amigos",
    "who.empty": "Nadie en línea",
    "who.friendsEmpty": "Sin amigos aún — usa ★ en la lista",
    "who.whisper": "Susurrar",
    "who.invite": "Invitar",
    "who.friendAdd": "Amigo",
    "who.friendDel": "Quitar",
    "who.refresh": "Actualizar",
    "help.partychat": "Chat de grupo: /p mensaje (también /g o /grupo)",
    "help.worldmap": "Abrir mapa del mundo",
    "help.waypoint": "Marca personal (se guarda en este navegador)",
    "help.waypointKey": "Shift+clic (minimapa/mapa)",
    "waypoint.clear": "Quitar marca",
    "waypoint.set": "Marca personal fijada",
    "waypoint.cleared": "Marca personal quitada",
    "help.lootlog": "Botín reciente de la sesión",
    "help.combatlog": "Daño recibido reciente",
    "inspect.title": "Inspeccionar",
    "inspect.btn": "Inspeccionar",
    "inspect.close": "Cerrar",
    "inspect.pet": "Mascota",
    "inspect.empty": "Sin equipo",
    "help.emote": "Gestos: /wave /dance /cheer /bow (o /me …)",
    "help.inspect": "Inspeccionar equipo de otro jugador",
    "reconnect.title": "Reconectando…",
    "reconnecting.login": "Reconectando…",
    "audio.unmute": "Activar sonido",
    "audio.mute": "Silenciar",
    "pop.online": (n) => `${n} en línea`,
    "menu.title": "Menú", "menu.help": "Ayuda", "menu.options": "Opciones", "menu.logout": "Cerrar sesión",
    "help.h.about": "Cómo funciona",
    "help.about1": "Sos un héroe en Helike, un pueblo de la Grecia mítica. Elegís una clase (guerrero, cazador, mago o clérigo) y salís a matar monstruos por el mapa para ganar experiencia, oro y objetos. Cada nivel te da puntos de estadística y, desde el nivel 4, un punto de habilidad para tu árbol de clase.",
    "help.about2": "En el pueblo hay NPCs útiles: el Anciano da misiones, el herrero/Circe compran y venden objetos, el Portal te teleporta a zonas ya visitadas, el Cofre guarda botín, el Criadero vende mascotas con bonos pasivos, y el tablón de peticiones deja ideas para el juego.",
    "help.about3": "Si morís, tu personaje queda caído: revive solo a los 30s, o apretá el botón \"Resucitar\" para volver antes a Helike. Cerca de la fuente de la plaza (zona santuario) la vida y el maná regeneran mucho más rápido, y no llega daño de fuera.",
    "help.about4": "Podés agruparte con otros jugadores: invitalos haciendo clic en ellos, y usá \"Seguir\" en el panel de grupo para que tu personaje camine solo detrás del líder. La experiencia de las misiones de caza se comparte entre los miembros cercanos.",
    "help.h.move": "Movimiento",
    "help.move": "Mover al personaje",
    "help.joystickKey": "Arrastrar en el mapa (móvil)",
    "help.joystick": "Joystick táctil — aparece bajo el dedo",
    "help.h.combat": "Combate y objetos",
    "help.clickKey": "Clic izquierdo",
    "help.click": "Atacar, hablar, recoger objetos del suelo",
    "help.skills": "Usar habilidad",
    "help.xpbarKey": "Clic en la barra de XP",
    "help.xpbar": "Activar/desactivar ataque automático",
    "help.potion": "Poción de vida / maná",
    "help.dragKey": "Arrastrar objeto fuera del inventario",
    "help.drag": "Tirarlo al suelo",
    "help.sellKey": "Clic en objeto (con la tienda abierta)",
    "help.sell": "Venderlo — o usá \"Vender comunes/mágicos/raros\" para vender todo de una rareza",
    "help.h.panels": "Paneles",
    "help.inv": "Inventario",
    "help.char": "Personaje",
    "help.quest": "Diario de misiones",
    "help.ability": "Árbol de habilidades",
    "help.menu": "Abrir/cerrar este menú, cerrar paneles abiertos",
    "help.h.social": "Pueblo y grupo",
    "help.recall": "Volver a Helike (recall)",
    "help.enterKey": "Enter",
    "help.chat": "Escribir en el chat (/w nombre = susurro, /p = grupo)",
    "help.pingKey": "G / clic minimapa",
    "help.ping": "Marcar una posición para tu grupo",
    "help.playerKey": "Clic en otro jugador",
    "help.player": "Invitarlo a tu grupo",
    "help.followKey": "\"Seguir\" (panel de grupo)",
    "help.follow": "Tu personaje camina solo hacia el líder del grupo",
    "help.party": "Minimizar/expandir el panel de grupo",
    "help.npcKey": "Clic en un NPC",
    "help.npc": "Hablar, comprar, teleportarte, guardar objetos en el cofre, adoptar una mascota o escribir en el tablón de peticiones, según el NPC",
    "opt.music": "Música", "opt.fx": "Efectos", "opt.lang": "Idioma",
    "opt.autoloot": "Auto-recogida",
    "opt.autoloot.off": "Desactivada", "opt.autoloot.all": "Todo",
    "opt.autoloot.magic": "Mágico o mejor", "opt.autoloot.rare": "Solo raro",
    "opt.autopotion": "Auto-pociones",
    "opt.autopotion.off": "Desactivadas", "opt.autopotion.on": "Vida y maná bajos",
    "opt.autopotion.hp": "Solo vida baja",
    "hud.autoatk.on": "Ataque automático ON — ataca al enemigo más cercano (clic para apagar)",
    "hud.autoatk.off": "Ataque automático OFF — clic para atacar al enemigo más cercano",
    "board.title": "Tablón de peticiones",
    "board.hint": "Escribe qué te gustaría ver añadido o cambiado en el juego.",
    "board.placeholder": "Escribe tu petición…",
    "board.submit": "Publicar",
    "board.empty": "Aún no hay peticiones. ¡Sé el primero!",
    "board.posted": (n, d) => `${n} · ${d}`,
    "board.hasActive": "Ya tienes una petición activa — espera a que un moderador la resuelva antes de publicar otra.",
    "board.cooldown": (s) => `Puedes publicar de nuevo en ${s}s.`,
    "board.edit": "Editar",
    "board.delete": "Borrar",
    "board.editPrompt": "Editar petición:",
    "sell.all.common": "Vender comunes",
    "sell.all.magic": "Vender mágicos",
    "sell.all.rare": "Vender raros",
    "sell.all.confirm": (r) => `¿Vender todos los objetos ${r}?`,
    "inv.sort": "Ordenar",
    "shop.buyback": "Recompra",
    "shop.buybackEmpty": "Nada que recomprar aún",
    "shop.rebuy": "Recomprar",
    "panel.ability": "Árbol de habilidades",
    "mob.ability": "Hab.",
    "ability.unavailable": "Tu clase aún no tiene árbol de habilidades.",
    "ability.points": (n) => `${n} punto${n === 1 ? "" : "s"} de habilidad disponible${n === 1 ? "" : "s"}`,
    "ability.tier": (n) => `Nivel ${n}`,
    "ability.needMore": (n) => `Requiere ${n} puntos gastados en el árbol`,
    "ability.unlock": "Desbloquear",
    "ability.upgrade": "Mejorar",
    "ability.maxed": "Rango máximo",
    "ability.active": "Activa",
    "ability.passive": "Pasiva",
    "ability.needNode": "Asigna un punto a esta habilidad en el árbol (tecla H)",
    "ability.baseGate": "Disponible desde el inicio",
    "ability.equipSlot": (n) => `Equipar en la ranura ${n}`,
    "ability.resetBtn": "Reiniciar árbol",
    "ability.resetConfirm": "¿Reiniciar el árbol de habilidades? Recuperarás todos los puntos gastados.",
    "char.resetBtn": "Reiniciar características",
    "char.resetConfirm": "¿Reiniciar tus puntos de característica? Recuperarás todos los puntos asignados.",
  },
  en: {
    "login.subtitle": "Helike · Mythic Greece",
    "login.name": "Hero name",
    "login.pass": "Password",
    "login.toLogin": "Already have an account? Log in",
    "login.toRegister": "No hero yet? Create one",
    "login.hint": "WASD move · 1–4 skills · I inventory · C character · L quests",
    "login.enterRegister": "Create hero",
    "login.enterLogin": "Enter the world",
    "cls.warrior.name": "Warrior", "cls.warrior.desc": "Strength and armor. Melee combat.",
    "cls.hunter.name": "Hunter", "cls.hunter.desc": "Dexterity and bow. Ranged attacks.",
    "cls.mage.name": "Mage", "cls.mage.desc": "Intelligence and elemental spells.",
    "cls.cleric.name": "Cleric", "cls.cleric.desc": "Holy healing and divine magic.",
    "panel.inv": "Inventory",
    "panel.dropHint": "Drag an item out of the inventory to drop it on the ground.",
    "panel.sellHint": "Click an item to sell it to the merchant.",
    "panel.char": "Character",
    "panel.quest": "Quest log",
    "panel.stash": "Stash",
    "panel.pets": "Pet shop",
    "mob.chat": "Chat", "mob.inv": "Inv", "mob.quest": "Quests", "mob.char": "Hero",
    "death.title": "You have fallen",
    "death.respawn": "Revive in Helike",
    "death.countdown": (s) => `Auto-revives in ${s}s`,
    "death.countdownNow": "Reviving…",
    "death.recap": "Last hits",
    "panel.lootlog": "Recent loot",
    "panel.combatlog": "Combat log",
    "lootlog.empty": "No loot picked up this session yet.",
    "combatlog.empty": "No damage taken this session yet.",
    "opt.lootlog": "Show recent loot",
    "opt.combatlog": "Show combat log",
    "opt.fps": "Show FPS",
    "panel.worldmap": "World map",
    "panel.achs": "Achievements",
    "panel.meter": "Combat session",
    "meter.dealt": "Damage dealt",
    "meter.taken": "Damage taken",
    "meter.healed": "Healed",
    "meter.kills": "Kills",
    "meter.deaths": "Deaths",
    "meter.dps": "DPS",
    "achs.empty": "No achievements yet",
    "achs.stats": (k, g) => `Kills: ${k} · Gold earned: ${g}`,
    "chat.tab.all": "All",
    "chat.tab.party": "Party",
    "chat.tab.whisper": "Whisper",
    "chat.tab.sys": "System",
    "opt.meter": "Show session meter",
    "help.achs": "Achievements",
    "help.who": "Players / friends list",
    "help.fish": "Fish next to water (/fish or /pescar)",
    "help.deathmark": "On death a map mark stays until you revive",
    "panel.who": "Players",
    "who.tab.online": "Online",
    "who.tab.friends": "Friends",
    "who.empty": "Nobody online",
    "who.friendsEmpty": "No friends yet — tap ★ on the list",
    "who.whisper": "Whisper",
    "who.invite": "Invite",
    "who.friendAdd": "Friend",
    "who.friendDel": "Remove",
    "who.refresh": "Refresh",
    "help.partychat": "Party chat: /p message (also /g or /grupo)",
    "help.worldmap": "Open the world map",
    "help.waypoint": "Personal marker (saved in this browser)",
    "help.waypointKey": "Shift+click (minimap/map)",
    "waypoint.clear": "Clear marker",
    "waypoint.set": "Personal marker set",
    "waypoint.cleared": "Personal marker cleared",
    "help.lootlog": "Recent session loot",
    "help.combatlog": "Recent damage taken",
    "inspect.title": "Inspect",
    "inspect.btn": "Inspect",
    "inspect.close": "Close",
    "inspect.pet": "Pet",
    "inspect.empty": "No gear",
    "help.emote": "Emotes: /wave /dance /cheer /bow (or /me …)",
    "help.inspect": "Inspect another player's gear",
    "reconnect.title": "Reconnecting…",
    "reconnecting.login": "Reconnecting…",
    "audio.unmute": "Unmute",
    "audio.mute": "Mute",
    "pop.online": (n) => `${n} online`,
    "menu.title": "Menu", "menu.help": "Help", "menu.options": "Options", "menu.logout": "Log out",
    "help.h.about": "How it works",
    "help.about1": "You're a hero in Helike, a town in mythic Greece. Pick a class (warrior, hunter, mage or cleric) and go kill monsters across the map to earn experience, gold and loot. Every level grants stat points and, from level 4 on, an ability point for your class tree.",
    "help.about2": "The town has useful NPCs: the Elder gives quests, the smith/Circe buy and sell items, the Portal teleports to visited zones, the Chest stores loot, the Pet shop sells companions with passive perks, and the request board takes ideas for the game.",
    "help.about3": "If you die, your character falls: it revives on its own after 30s, or hit the \"Revive\" button to return to Helike right away. Near the plaza fountain (sanctuary zone) HP/MP regen much faster and no damage from outside reaches you.",
    "help.about4": "You can group up with other players: invite them by clicking them, and use \"Follow\" in the party panel so your character walks behind the leader on its own. Hunt-quest XP is shared with nearby party members.",
    "help.h.move": "Movement",
    "help.move": "Move the character",
    "help.joystickKey": "Drag on the map (mobile)",
    "help.joystick": "Touch joystick — appears under your finger",
    "help.h.combat": "Combat and items",
    "help.clickKey": "Left click",
    "help.click": "Attack, talk, pick up items on the ground",
    "help.skills": "Use skill",
    "help.xpbarKey": "Click the XP bar",
    "help.xpbar": "Toggle auto-attack",
    "help.potion": "HP / MP potion",
    "help.dragKey": "Drag an item out of the inventory",
    "help.drag": "Drop it on the ground",
    "help.sellKey": "Click an item (with the shop open)",
    "help.sell": "Sell it — or use \"Sell common/magic/rare\" to sell everything of one rarity at once",
    "help.h.panels": "Panels",
    "help.inv": "Inventory",
    "help.char": "Character",
    "help.quest": "Quest log",
    "help.ability": "Ability tree",
    "help.menu": "Open/close this menu, close open panels",
    "help.h.social": "Town and party",
    "help.recall": "Return to Helike (recall)",
    "help.enterKey": "Enter",
    "help.chat": "Type in chat (/w name = whisper, /p = party)",
    "help.pingKey": "G / minimap click",
    "help.ping": "Mark a position for your party",
    "help.playerKey": "Click another player",
    "help.player": "Invite them to your party",
    "help.followKey": "\"Follow\" (party panel)",
    "help.follow": "Your character walks on its own toward the party leader",
    "help.party": "Minimize/expand the party panel",
    "help.npcKey": "Click an NPC",
    "help.npc": "Talk, shop, teleport, store items in the chest, adopt a pet, or write on the request board, depending on the NPC",
    "opt.music": "Music", "opt.fx": "Effects", "opt.lang": "Language",
    "opt.autoloot": "Auto-loot",
    "opt.autoloot.off": "Off", "opt.autoloot.all": "Everything",
    "opt.autoloot.magic": "Magic or better", "opt.autoloot.rare": "Rare only",
    "opt.autopotion": "Auto-potions",
    "opt.autopotion.off": "Off", "opt.autopotion.on": "Low HP and MP",
    "opt.autopotion.hp": "Low HP only",
    "hud.autoatk.on": "Auto-attack ON — attacks the nearest enemy (click to turn off)",
    "hud.autoatk.off": "Auto-attack OFF — click to attack the nearest enemy",
    "board.title": "Request board",
    "board.hint": "Write what you'd like to see added or changed in the game.",
    "board.placeholder": "Write your request…",
    "board.submit": "Post",
    "board.empty": "No requests yet. Be the first!",
    "board.posted": (n, d) => `${n} · ${d}`,
    "board.hasActive": "You already have an active request — wait for a moderator to resolve it before posting another.",
    "board.cooldown": (s) => `You can post again in ${s}s.`,
    "board.edit": "Edit",
    "board.delete": "Delete",
    "board.editPrompt": "Edit request:",
    "sell.all.common": "Sell common",
    "sell.all.magic": "Sell magic",
    "sell.all.rare": "Sell rare",
    "sell.all.confirm": (r) => `Sell all ${r} items?`,
    "inv.sort": "Sort",
    "shop.buyback": "Buyback",
    "shop.buybackEmpty": "Nothing to buy back yet",
    "shop.rebuy": "Buy back",
    "panel.ability": "Ability tree",
    "mob.ability": "Skills",
    "ability.unavailable": "Your class doesn't have an ability tree yet.",
    "ability.points": (n) => `${n} ability point${n === 1 ? "" : "s"} available`,
    "ability.tier": (n) => `Tier ${n}`,
    "ability.needMore": (n) => `Requires ${n} points spent in the tree`,
    "ability.unlock": "Unlock",
    "ability.upgrade": "Upgrade",
    "ability.maxed": "Max rank",
    "ability.active": "Active",
    "ability.passive": "Passive",
    "ability.needNode": "Put a point into this skill in your tree (H key)",
    "ability.baseGate": "Available from the start",
    "ability.equipSlot": (n) => `Equip to slot ${n}`,
    "ability.resetBtn": "Reset tree",
    "ability.resetConfirm": "Reset your ability tree? You'll get all spent points back.",
    "char.resetBtn": "Reset stats",
    "char.resetConfirm": "Reset your allotted stat points? You'll get them all back.",
  },
};
var LS_LANG = "aot_lang";
function getLang() {
  try { return localStorage.getItem(LS_LANG) === "en" ? "en" : "es"; } catch (e) { return "es"; }
}
function t(key, ...args) {
  const dict = I18N[getLang()] || I18N.es;
  const v = dict[key] ?? I18N.es[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}
function applyLang(lang) {
  try { localStorage.setItem(LS_LANG, lang === "en" ? "en" : "es"); } catch (e) {}
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  // JS-driven dynamic strings that don't live in the static DOM scan above.
  setMode(!$("clsRow").classList.contains("hidden"));
  if (window.AOTAudio) AOTAudio._updateMuteBtn();
  if (S.pop) $("popHud").textContent = t("pop.online", S.pop);
  updateReviveCountdown();
  if (S.boardEntries) { renderBoard(S.boardEntries); updateBoardFormState(); }
  const xpBarEl = $("xpBar");
  if (xpBarEl) xpBarEl.title = S.autoAtk ? t("hud.autoatk.on") : t("hud.autoatk.off");
  const sel = $("langSelect");
  if (sel) sel.value = getLang();
}
var S = {
  ws: null,
  connected: false,
  loggedIn: false,
  wantReconnect: false,
  retryMs: 800,
  myId: 0,
  myName: "",
  myCls: "",
  skills: [],
  abilityTree: [],
  loadout: [1, 2, 3, 4],
  map: null,
  you: null,
  pop: 0,
  ents: new Map,
  loot: new Map,
  floats: [],
  fx: [],
  particles: [],
  boardEntries: null,
  boardMeta: { isMod: false, hasActive: false, cooldownUntil: 0 },
  autoLoot: "off",
  autoPotion: "off",
  buyback: [],
  bossTimers: {},
  pings: [],
  lootLog: [],
  combatLog: [],
  showLootLog: true,
  showCombatLog: false,
  showMeter: true,
  showFps: false,
  meter: { dealt: 0, taken: 0, healed: 0, kills: 0, deaths: 0, t0: 0 },
  achs: { unlocked: [], defs: [], killCount: 0, goldEarned: 0 },
  chatTab: "all",
  whoList: [],
  whoTab: "online",
  friends: [],
  deathMark: null,
  waypoint: null,
  _fpsFrames: 0,
  _fpsAt: 0,
  _fpsVal: 0,
  emotes: {},
  deathRecap: [],
  streak: 0,
  shakeMag: 0,
  targetId: 0,
  autoAtk: false,
  autoAtkAt: 0,
  hoverId: 0,
  hoverLoot: 0,
  cam: { x: 80, y: 80 },
  mouse: { x: 0, y: 0, wx: 0, wy: 0, in: false },
  cds: [0, 0, 0, 0],
  lastSkill: 0,
  dead: false,
  reviveAt: 0,
  lootTarget: 0,
  zoneName: "",
  shopOpen: false,
  shopNpc: 0,
  shopItems: [],
  stashOpen: false,
  stash: [],
  petShop: { defs: [], owned: [], active: null },
  pendingSell: -1,
  chatIdleT: 0,
  dirKeys: Object.create(null),
  dir: { x: 0, y: 0 },
  party: [],
  partyIds: new Set,
  followId: null,
  partyMinimized: false,
  joy: { x: 0, y: 0 },
  preMsgs: []
};
window.AOT = S;
function wsUrl() {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/rpg/ws`;
}
function send(o) {
  if (S.ws && S.ws.readyState === 1)
    S.ws.send(JSON.stringify(o));
}
function connect() {
  const ws = new WebSocket(wsUrl());
  S.ws = ws;
  ws.onopen = () => {
    S.connected = true;
    S.retryMs = 800;
    $("reconnect").classList.add("hidden");
    if (S.wantReconnect) {
      const c = creds();
      if (c.name && c.pass)
        send({ t: "login", name: c.name, pass: c.pass, cls: c.cls });
    }
  };
  ws.onclose = () => {
    S.connected = false;
    if (S.loggedIn || S.wantReconnect) {
      S.wantReconnect = true;
      $("reconnect").classList.remove("hidden");
      setTimeout(connect, S.retryMs);
      S.retryMs = Math.min(S.retryMs * 1.6, 1e4);
    }
  };
  ws.onerror = () => {
    try {
      ws.close();
    } catch (e) {}
  };
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    handle(m);
  };
}
function creds() {
  try {
    return JSON.parse(localStorage.getItem("aot_creds") || "{}");
  } catch (e) {
    return {};
  }
}
function saveCreds(name, pass, cls) {
  localStorage.setItem("aot_creds", JSON.stringify({ name, pass, cls }));
}
function handle(m) {
  switch (m.t) {
    case "err": {
      if (!S.loggedIn) {
        $("loginErr").textContent = m.msg;
      } else
        toast(m.msg);
      break;
    }
    case "welcome": {
      S.myId = m.id;
      S.myName = m.name;
      S.myCls = m.cls;
      S.skills = m.skills || [];
      S.loadout = Array.isArray(m.loadout) && m.loadout.length === 4 ? m.loadout.slice() : [1, 2, 3, 4];
      S.abilityTree = m.abilityTree || [];
      $("mobAbility") && $("mobAbility").classList.toggle("hidden", !S.abilityTree.length);
      S.loggedIn = true;
      S.wantReconnect = true;
      S.ents.clear();
      S.loot.clear();
      S.floats.length = 0;
      S.fx.length = 0;
      S.particles.length = 0;
      S.dirKeys = Object.create(null);
      S.dir = { x: 0, y: 0 };
      S.followId = null;
      S.dead = false;
      S.reviveAt = 0;
      S.deathMark = null;
      S.streak = 0;
      S.meter = { dealt: 0, taken: 0, healed: 0, kills: 0, deaths: 0, t0: Date.now() };
      S.achs = { unlocked: [], defs: S.achs.defs || [], killCount: 0, goldEarned: 0 };
      updateStreakHud();
      $("deathOverlay").classList.add("hidden");
      enterGame();
      break;
    }
    case "map": {
      S.map = m;
      buildMinimapBase();
      const q = S.preMsgs;
      S.preMsgs = [];
      for (const p of q)
        handle(p);
      break;
    }
    default: {
      if (!S.map && (m.t === "st" || m.t === "you" || m.t === "fx" || m.t === "dmg" || m.t === "dead")) {
        S.preMsgs.push(m);
        return;
      }
      handleWorld(m);
    }
  }
}
function handleWorld(m) {
  switch (m.t) {
    case "you": {
      const prevLvl = S.you ? S.you.lvl : 0;
      S.you = m;
      if (Array.isArray(m.loadout) && m.loadout.length === 4 && m.loadout.some((v, i) => v !== S.loadout[i])) {
        S.loadout = m.loadout.slice();
        buildSkillbar();
      }
      if (Array.isArray(m.visitedZones)) S.you.visitedZones = m.visitedZones;
      // Safety net: if server says hp is gone, force the revive overlay even when
      // the dedicated "dead" packet was missed (disconnect mid-death / reconnect).
      if (typeof m.hp === "number" && m.hp <= 0) {
        S.dead = true;
        const ov = $("deathOverlay");
        if (ov) ov.classList.remove("hidden");
      } else if (S.dead && typeof m.hp === "number" && m.hp > 0) {
        S.dead = false;
        S.reviveAt = 0;
        S.deathMark = null;
        S.deathRecap = [];
        const ov = $("deathOverlay");
        if (ov) ov.classList.add("hidden");
        const dr = $("deathRecap");
        if (dr) dr.innerHTML = "";
      }
      refreshHud();
      renderInventory();
      renderChar();
      renderQuests();
      if (!$("abilityPanel").classList.contains("hidden")) renderAbilities();
      if (S.shopOpen)
        renderShop();
      break;
    }
    case "st": {
      S.pop = m.pop;
      // Named nowT, not t: this whole block runs inside handleWorld(m), and a
      // local `t` here would shadow the global t() i18n helper used below for
      // the population-count HUD text (silently breaking every "st" message).
      const nowT = now();
      for (const e of m.ents || []) {
        let E = S.ents.get(e.i);
        if (!E) {
          E = { buf: [], rx: e.x, ry: e.y, hitT: 0, dieT: 0, spawnT: nowT, bobP: Math.random() * 7 };
          S.ents.set(e.i, E);
        }
        E.k = e.k;
        E.h = e.h;
        E.H = e.H;
        E.l = e.l;
        E.s = e.s || 0;
        E.d = e.d || 0;
        if (e.n !== undefined)
          E.n = e.n;
        E.pet = e.pet || null;
        if (e.m !== undefined) {
          E.m = e.m;
          E.M = e.M;
        }
        E.buf.push({ t: nowT, x: e.x, y: e.y });
        if (E.buf.length > 12)
          E.buf.splice(0, E.buf.length - 12);
        // Local corpse: mark dieT while hp is 0 so we render faded instead of "alive".
        if (e.i === S.myId && e.h <= 0 && !E.dieT) { E.dieT = nowT; spawnParticles(E.rx, E.ry - 0.6, 12, { color: "#ff6a5e", spread: 2.4, size: 2.2, life: 550, grav: 1.6 }); }
        if (e.i === S.myId && e.h > 0) E.dieT = 0;
      }
      for (const id of m.gone || []) {
        const E = S.ents.get(id);
        if (E && E.h <= 0 && !E.dieT) {
          E.dieT = nowT;
          spawnParticles(E.rx, E.ry - 0.6, 10, { color: "#e8dcc0", spread: 2.2, size: 2, life: 500, grav: 1.6 });
        } else
          S.ents.delete(id);
        if (S.targetId === id)
          S.targetId = 0;
      }
      S.loot.clear();
      for (const L of m.loot || [])
        S.loot.set(L.i, L);
      // Auto-loot: only when not already fetching/fighting, and only items
      // already within pickup range — never yanks the player off a target.
      if (S.autoLoot !== "off" && !S.dead && !S.lootTarget && !S.targetId) {
        const me = S.ents.get(S.myId);
        if (me) {
          for (const [id, L] of S.loot) {
            if (!lootMatchesAutoFilter(L)) continue;
            if (Math.hypot(me.rx - L.x, me.ry - L.y) <= 1.8) {
              S.lootTarget = id;
              send({ t: "pickup", id });
              break;
            }
          }
        }
      }
      if (Array.isArray(m.bosses)) {
        const bt = {};
        for (const b of m.bosses) if (b && b.k) bt[b.k] = Number(b.t) || 0;
        S.bossTimers = bt;
      }
      $("popHud").textContent = t("pop.online", S.pop);
      break;
    }
    case "buyback": {
      S.buyback = m.items || [];
      if (S.shopOpen) renderShop();
      break;
    }
    case "ping": {
      const x = Number(m.x), y = Number(m.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      S.pings.push({ x, y, from: m.from || "?", t0: now() });
      if (S.pings.length > 8) S.pings.splice(0, S.pings.length - 8);
      toast(`${m.from || "Grupo"} marcó el mapa`);
      if (window.AOTAudio) AOTAudio.sfx("invite");
      break;
    }
    case "dmg": {
      const E = S.ents.get(m.i);
      if (E) {
        E.hitT = now();
        S.floats.push({
          x: E.rx + (Math.random() - 0.5) * 0.6,
          y: E.ry - 1.4,
          txt: String(m.a),
          t0: now(),
          color: m.c ? "#ffcf40" : m.i === S.myId ? "#ff6a5e" : "#fff",
          size: m.c ? 22 : 15,
          crit: !!m.c
        });
        const onMe = m.i === S.myId;
        spawnParticles(E.rx, E.ry - 0.9, m.c ? 10 : 5, {
          color: m.c ? "#ffd94a" : onMe ? "#ff6a5e" : "#ffe0c0",
          spread: m.c ? 2.6 : 1.6,
          size: m.c ? 2.6 : 1.8,
          life: 380,
        });
        if (m.c) shake(6, 160);
        else if (onMe) shake(3, 110);
      }
      if (window.AOTAudio) {
        if (m.c) AOTAudio.sfx("crit");
        else AOTAudio.sfx("hit", { onMe: m.i === S.myId });
      }
      break;
    }
    case "fx":
      addFx(m);
      break;
    case "portal":
      openPortalPanel(m);
      break;
    case "dialog":
      showDialog(m);
      break;
    case "shop":
      showShop(m);
      break;
    case "board":
      showBoard(m);
      break;
    case "stash":
      showStash(m);
      break;
    case "petshop":
      showPetShop(m);
      break;
    case "chat":
      addChat(m);
      if (window.AOTAudio && !m.sys) AOTAudio.sfx("chat");
      break;
    case "dead": {
      S.dead = true;
      S.reviveAt = typeof m.reviveAt === "number" ? m.reviveAt : 0;
      S.deathRecap = Array.isArray(m.recap) ? m.recap.slice() : [];
      const me = S.ents.get(S.myId);
      if (me) {
        S.deathMark = { x: me.rx, y: me.ry };
        toast(`Caíste en ${me.rx.toFixed(0)}, ${me.ry.toFixed(0)}`);
      }
      stopMove();
      const ov = $("deathOverlay");
      if (ov) ov.classList.remove("hidden");
      renderDeathRecap();
      if (window.AOTAudio) AOTAudio.sfx("dead");
      break;
    }
    case "inspect": {
      showInspect(m);
      break;
    }
    case "streak": {
      S.streak = Math.max(0, Number(m.n) || 0);
      updateStreakHud();
      break;
    }
    case "lootlog": {
      S.lootLog = Array.isArray(m.entries) ? m.entries : [];
      renderLootLog();
      break;
    }
    case "combatlog": {
      S.combatLog = Array.isArray(m.entries) ? m.entries : [];
      renderCombatLog();
      break;
    }
    case "meter": {
      S.meter = {
        dealt: Number(m.dealt) || 0,
        taken: Number(m.taken) || 0,
        healed: Number(m.healed) || 0,
        kills: Number(m.kills) || 0,
        deaths: Number(m.deaths) || 0,
        t0: Number(m.t0) || S.meter.t0 || 0,
      };
      renderMeter();
      break;
    }
    case "achs": {
      S.achs = {
        unlocked: Array.isArray(m.unlocked) ? m.unlocked.slice() : [],
        defs: Array.isArray(m.defs) ? m.defs.slice() : (S.achs.defs || []),
        killCount: Number(m.killCount) || 0,
        goldEarned: Number(m.goldEarned) || 0,
      };
      renderAchs();
      break;
    }
    case "who": {
      S.whoList = Array.isArray(m.players) ? m.players.slice() : [];
      renderWho();
      break;
    }
    case "toast": {
      toast(m.msg);
      if (S.lastSkill && now() - S.lastSkillT < 600) {
        // Server rejected the cast — restore previous cooldown (don't leave a fake full CD).
        if (S.lastSkillPrevCd != null) S.cds[S.lastSkill] = S.lastSkillPrevCd;
        const el = skillBarEl(S.lastSkill);
        if (el) {
          el.classList.remove("deny");
          el.offsetWidth;
          el.classList.add("deny");
        }
      }
      break;
    }
    case "party": {
      S.party = m.members || [];
      S.partyIds = new Set(S.party.map((x) => x.id));
      renderParty();
      break;
    }
    case "party_invited":
      showInvite(m);
      if (window.AOTAudio) AOTAudio.sfx("invite");
      break;
    case "follow_state":
      S.followId = m.id;
      renderParty();
      break;
  }
}
var pickedCls = "warrior";
function setMode(register) {
  if (register) {
    $("clsRow").classList.remove("hidden");
    $("enterBtn").textContent = t("login.enterRegister");
    $("toRegister").classList.add("hidden");
    $("toLogin").classList.remove("hidden");
  } else {
    $("clsRow").classList.add("hidden");
    $("enterBtn").textContent = t("login.enterLogin");
    $("toLogin").classList.add("hidden");
    $("toRegister").classList.remove("hidden");
  }
}
function performLogin(name, pass, cls, opts) {
  opts = opts || {};
  if (window.AOTAudio) AOTAudio.unlock().catch(() => {});
  saveCreds(name, pass, cls);
  const doLogin = () => send({ t: "login", name, pass, cls });
  if (S.connected) {
    doLogin();
  } else {
    S.wantReconnect = false;
    connect();
    S.ws.addEventListener("open", doLogin, { once: true });
    S.ws.addEventListener("close", () => {
      if (!S.loggedIn)
        $("loginErr").textContent = opts.silent ? "" : "No se puede conectar con el servidor. Inténtalo de nuevo.";
    }, { once: true });
  }
}
function initLogin() {
  const c = creds();
  if (c.name)
    $("nameInput").value = c.name;
  if (c.pass)
    $("passInput").value = c.pass;
  if (c.cls)
    pickedCls = c.cls;
  document.querySelectorAll(".cls-card").forEach((card) => {
    const cls = card.dataset.cls;
    drawPortrait(card.querySelector("canvas"), cls);
    if (cls === pickedCls)
      card.classList.add("sel");
    card.addEventListener("click", () => {
      pickedCls = cls;
      document.querySelectorAll(".cls-card").forEach((x) => x.classList.toggle("sel", x === card));
    });
  });
  // Class/race is chosen at signup only; hide the picker when logging in.
  setMode(true);
  $("toLogin").addEventListener("click", (e) => { e.preventDefault(); setMode(false); });
  $("toRegister").addEventListener("click", (e) => { e.preventDefault(); setMode(true); });
  $("muteBtn") && $("muteBtn").addEventListener("click", () => {
    if (window.AOTAudio) { AOTAudio.unlock(); AOTAudio.toggleMute(); AOTAudio.sfx("ui"); }
  });
  const xpBar = $("xpBar");
  if (xpBar) {
    const toggle = () => {
      setAutoAtk(!S.autoAtk);
      if (window.AOTAudio) { AOTAudio.unlock(); AOTAudio.sfx("ui"); }
    };
    xpBar.addEventListener("click", toggle);
    xpBar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  }
  try { setAutoAtk(localStorage.getItem("aot_autoatk") === "1"); } catch (_) { setAutoAtk(false); }
  $("loginForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("nameInput").value.trim(), pass = $("passInput").value;
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      $("loginErr").textContent = "El nombre debe tener 3–16 letras, dígitos o guion bajo.";
      return;
    }
    if (pass.length < 4) {
      $("loginErr").textContent = "La contraseña debe tener al menos 4 caracteres.";
      return;
    }
    $("loginErr").textContent = "";
    performLogin(name, pass, pickedCls);
  });
  // Returning with a saved session (page reload / revisit) skips the manual
  // login step entirely — auto-connect straight into the world. Any failure
  // (stale creds, server down) silently falls back to the empty login form.
  if (/^[A-Za-z0-9_]{3,16}$/.test(c.name || "") && (c.pass || "").length >= 4) {
    $("loginErr").textContent = t("reconnecting.login");
    performLogin(c.name, c.pass, c.cls || pickedCls, { silent: true });
  }
}
function drawPortrait(cv, cls) {
  const g = cv.getContext("2d");
  const { width: w, height: h } = cv;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#100c06";
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2 - 2, 0, 7);
  g.fill();
  g.strokeStyle = "#4a3a1e";
  g.lineWidth = 2;
  g.stroke();
  g.save();
  g.translate(w / 2, h / 2 + 6);
  g.scale(1.5, 1.5);
  drawHumanoid(g, cls, 0, 0, 0, 0, false);
  g.restore();
}
function enterGame() {
  $("login").classList.add("hidden");
  $("game").classList.remove("hidden");
  buildSkillbar();
  resize();
  if (window.AOTAudio) {
    AOTAudio.unlock().then(() => AOTAudio.sfx("login")).catch(() => {});
    AOTAudio._updateMuteBtn();
  }
}
var canvas = $("world");
var ctx = canvas.getContext("2d");
var scratch = document.createElement("canvas");
scratch.width = 180;
scratch.height = 220;
var sctx = scratch.getContext("2d");
var DPR = 1;
var VW = 0;
var VH = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth;
  VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR);
  canvas.height = Math.round(VH * DPR);
  canvas.style.width = VW + "px";
  canvas.style.height = VH + "px";
}
window.addEventListener("resize", resize);
var w2sx = (wx) => (wx - S.cam.x) * TILE + VW / 2;
var w2sy = (wy) => (wy - S.cam.y) * TILE + VH / 2;
var s2wx = (sx) => (sx - VW / 2) / TILE + S.cam.x;
var s2wy = (sy) => (sy - VH / 2) / TILE + S.cam.y;
var INTERP_DELAY = 120;
function sampleEnt(E, t) {
  const buf = E.buf;
  if (!buf.length)
    return;
  if (buf.length === 1 || t <= buf[0].t) {
    E.rx = buf[0].x;
    E.ry = buf[0].y;
    return;
  }
  for (let i = buf.length - 1;i >= 0; i--) {
    if (buf[i].t <= t) {
      const a = buf[i], b = buf[i + 1];
      if (!b) {
        E.rx = a.x;
        E.ry = a.y;
        return;
      }
      const f = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
      E.rx = lerp(a.x, b.x, f);
      E.ry = lerp(a.y, b.y, f);
      return;
    }
  }
  E.rx = buf[0].x;
  E.ry = buf[0].y;
}
// Ambient tint only for boss zones (Cíclope idx 3, Asfódelos/minotaur idx 4) —
// the leveling zones (Olivares/Argos/Gorgona) render with their natural tile
// colors, no color-wash filter.
var ZONE_TINT = {
  3: "rgba(150,60,40,0.08)",
  4: "rgba(90,70,140,0.10)",
  5: "rgba(50,110,70,0.10)",
};
function tileAt(x, y) {
  if (!S.map || x < 0 || y < 0 || x >= S.map.w || y >= S.map.h)
    return "w";
  return S.map.tiles[y][x];
}
function drawTiles(t, curZone) {
  const x0 = Math.floor(s2wx(0)) - 1, x1 = Math.ceil(s2wx(VW)) + 1;
  const y0 = Math.floor(s2wy(0)) - 1, y1 = Math.ceil(s2wy(VH)) + 1;
  for (let ty = y0;ty <= y1; ty++) {
    for (let tx = x0;tx <= x1; tx++) {
      const ch = tileAt(tx, ty);
      const sx = w2sx(tx), sy = w2sy(ty);
      const r = thash(tx, ty, 1), r2 = thash(tx, ty, 2), r3 = thash(tx, ty, 3);
      switch (ch) {
        case "g": {
          const v = 30 + r * 12;
          ctx.fillStyle = `rgb(${30 + r * 8 | 0},${44 + r2 * 10 | 0},${62 + v | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          if (r2 > 0.4) {
            ctx.fillStyle = `rgba(50,${90 + r * 60 | 0},${120 + r2 * 50 | 0},.5)`;
            for (let i = 0;i < 3; i++) {
              const px = sx + thash(tx, ty, 10 + i) * TILE, py = sy + thash(tx, ty, 20 + i) * TILE;
              ctx.fillRect(px, py, 2, 3 + r3 * 2);
            }
          }
          break;
        }
        case "d": {
          ctx.fillStyle = `rgb(${104 + r * 16 | 0},${82 + r2 * 12 | 0},${52 + r3 * 10 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          ctx.fillStyle = "rgba(60,45,28,.45)";
          for (let i = 0;i < 3; i++) {
            const px = sx + thash(tx, ty, 30 + i) * TILE, py = sy + thash(tx, ty, 40 + i) * TILE;
            ctx.beginPath();
            ctx.arc(px, py, 1.5 + thash(tx, ty, 50 + i) * 2, 0, 7);
            ctx.fill();
          }
          break;
        }
        case "s": {
          ctx.fillStyle = `rgb(${176 + r * 18 | 0},${154 + r2 * 14 | 0},${104 + r3 * 12 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          ctx.fillStyle = "rgba(140,118,74,.5)";
          ctx.fillRect(sx + r * 24, sy + r2 * 24, 3, 1);
          ctx.fillRect(sx + r3 * 24, sy + r * 24, 3, 1);
          break;
        }
        case "w": {
          const wv = Math.sin(t / 900 + (tx * 1.7 + ty * 2.3)) * 8;
          ctx.fillStyle = `rgb(${26 + r * 6 | 0},${58 + wv + r2 * 8 | 0},${96 + wv | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          const gl = Math.sin(t / 500 + r * 6.28 + tx + ty * 2);
          if (gl > 0.55) {
            ctx.fillStyle = `rgba(160,210,235,${(gl - 0.55) * 0.7})`;
            ctx.fillRect(sx + r2 * 20, sy + r3 * 22 + Math.sin(t / 700 + r * 9) * 3, 8 + r * 6, 2);
          }
          break;
        }
        case "t": {
          ctx.fillStyle = `rgb(${30 + r * 8 | 0},${44 + r2 * 10 | 0},${62 + 30 + r * 12 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          const cx = sx + TILE / 2 + (r - 0.5) * 6, cy = sy + TILE / 2 + (r2 - 0.5) * 6;
          ctx.fillStyle = "rgba(0,0,0,.28)";
          ctx.beginPath();
          ctx.ellipse(cx, cy + 10, 10, 4, 0, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#4a3620";
          ctx.fillRect(cx - 2, cy, 4, 11);
          const sway = Math.sin(t / 1400 + r * 6) * 1.2;
          ctx.fillStyle = `rgb(${34 + r3 * 14 | 0},${86 + r * 24 | 0},${36 | 0})`;
          ctx.beginPath();
          ctx.arc(cx + sway, cy - 6, 9 + r * 3, 0, 7);
          ctx.arc(cx - 6 + sway, cy - 1, 7, 0, 7);
          ctx.arc(cx + 6 + sway, cy - 1, 7, 0, 7);
          ctx.fill();
          ctx.fillStyle = "rgba(190,230,140,.18)";
          ctx.beginPath();
          ctx.arc(cx + sway - 3, cy - 9, 4, 0, 7);
          ctx.fill();
          break;
        }
        case "r": {
          ctx.fillStyle = `rgb(${30 + r * 8 | 0},${44 + r2 * 10 | 0},${62 + 30 + r * 12 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          const cx = sx + TILE / 2 + (r - 0.5) * 5, cy = sy + TILE / 2 + (r2 - 0.5) * 5;
          ctx.fillStyle = "rgba(0,0,0,.3)";
          ctx.beginPath();
          ctx.ellipse(cx, cy + 7, 11, 4, 0, 0, 7);
          ctx.fill();
          const gr = 108 + r3 * 26;
          ctx.fillStyle = `rgb(${gr | 0},${gr - 6 | 0},${gr - 12 | 0})`;
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy + 7);
          ctx.lineTo(cx - 7, cy - 4 - r * 4);
          ctx.lineTo(cx - 1, cy - 8 - r2 * 3);
          ctx.lineTo(cx + 6, cy - 3);
          ctx.lineTo(cx + 10, cy + 7);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(235,235,225,.22)";
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 4 - r * 4);
          ctx.lineTo(cx - 1, cy - 8 - r2 * 3);
          ctx.lineTo(cx, cy - 3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "W": {
          ctx.fillStyle = `rgb(${86 + r * 10 | 0},${82 + r2 * 8 | 0},${72 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          ctx.fillStyle = `rgb(${120 + r2 * 18 | 0},${114 + r * 14 | 0},${98 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, 6);
          ctx.strokeStyle = "rgba(40,36,28,.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE, TILE);
          ctx.beginPath();
          ctx.moveTo(sx, sy + 14 + r * 6);
          ctx.lineTo(sx + TILE, sy + 14 + r2 * 6);
          ctx.moveTo(sx + 10 + r3 * 12, sy + 8);
          ctx.lineTo(sx + 10 + r3 * 12, sy + TILE);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,246,220,.14)";
          ctx.fillRect(sx, sy, TILE + 1, 2);
          break;
        }
        case "f": {
          const fr = 96 + r * 14;
          ctx.fillStyle = `rgb(${fr | 0},${fr - 4 | 0},${fr - 16 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          ctx.strokeStyle = "rgba(52,48,40,.5)";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
          if (r2 > 0.7) {
            ctx.beginPath();
            ctx.moveTo(sx + r * TILE, sy + 4);
            ctx.lineTo(sx + r3 * TILE, sy + TILE - 4);
            ctx.stroke();
          }
          break;
        }
        case "p": {
          const pr = 128 + r * 20;
          ctx.fillStyle = `rgb(${pr | 0},${pr - 8 | 0},${pr - 26 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          ctx.strokeStyle = "rgba(78,70,52,.55)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "rgba(255,248,225,.08)";
          ctx.fillRect(sx + 2, sy + 2, TILE - 4, 3);
          break;
        }
        case "F": {
          const pr = 128 + r * 20;
          ctx.fillStyle = `rgb(${pr | 0},${pr - 8 | 0},${pr - 26 | 0})`;
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
          const wv = Math.sin(t / 900 + (tx * 1.7 + ty * 2.3)) * 6;
          ctx.fillStyle = `rgb(${40 + r * 6 | 0},${92 + wv + r2 * 10 | 0},${140 + wv | 0})`;
          ctx.beginPath();
          ctx.arc(sx + TILE / 2, sy + TILE / 2, TILE / 2 - 2, 0, 7);
          ctx.fill();
          ctx.strokeStyle = "rgba(90,80,58,.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx + TILE / 2, sy + TILE / 2, TILE / 2 - 2, 0, 7);
          ctx.stroke();
          const gl = Math.sin(t / 480 + r * 6.28 + tx + ty * 2);
          if (gl > 0.5) {
            ctx.fillStyle = `rgba(200,230,245,${(gl - 0.5) * 0.8})`;
            ctx.beginPath();
            ctx.arc(sx + TILE / 2 + r2 * 10 - 5, sy + TILE / 2 + r3 * 10 - 5, 2 + r, 0, 7);
            ctx.fill();
          }
          if (tx === 30 && ty === 79) {
            const spX = sx + TILE / 2, baseY = sy + TILE / 2;
            ctx.fillStyle = "#c9c2ad";
            ctx.beginPath();
            ctx.ellipse(spX, baseY + 2, 6, 3, 0, 0, 7);
            ctx.fill();
            ctx.fillRect(spX - 2, baseY - 10, 4, 12);
            for (let i = 0;i < 4; i++) {
              const jt = (t / 260 + i * 0.25) % 1;
              const jy = baseY - 12 - jt * 16;
              ctx.fillStyle = `rgba(220,240,255,${(1 - jt) * 0.8})`;
              ctx.beginPath();
              ctx.arc(spX + Math.sin(i * 2 + t / 500) * 3, jy, 1.6, 0, 7);
              ctx.fill();
            }
          }
          break;
        }
        default:
          ctx.fillStyle = "#12100b";
          ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      }
    }
  }
  if (curZone && ZONE_TINT[curZone.idx]) {
    ctx.fillStyle = ZONE_TINT[curZone.idx];
    ctx.fillRect(0, 0, VW, VH);
  }
}
function zoneAt(x, y) {
  if (!S.map || !S.map.zones)
    return null;
  for (let i = 0;i < S.map.zones.length; i++) {
    const z = S.map.zones[i];
    if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)
      return { ...z, idx: i };
  }
  return null;
}
function drawHumanoid(g, cls, bob, walk, t, face, inWorld = true) {
  const flip = face ? -1 : 1;
  g.save();
  g.scale(flip, 1);
  const wob = Math.sin(t / 90) * walk * 2;
  g.strokeStyle = "#2c2318";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-3, 2 - bob);
  g.lineTo(-3 - wob, 12);
  g.moveTo(3, 2 - bob);
  g.lineTo(3 + wob, 12);
  g.stroke();
  let body = "#8a5a24", trim = "#e8c470", head = "#d9a970";
  if (cls === "hunter") {
    body = "#3c5c30";
    trim = "#7a9c58";
  }
  if (cls === "mage") {
    body = "#2c4470";
    trim = "#7fb3ff";
  }
  if (cls === "cleric") {
    body = "#d8d0bc";
    trim = "#f0e6a8";
  }
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-6, -8 - bob);
  g.lineTo(6, -8 - bob);
  g.lineTo(5, 4 - bob);
  g.lineTo(-5, 4 - bob);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = "rgba(255,255,255,.16)";
  g.beginPath();
  g.ellipse(-2.4, -5 - bob, 3, 5.5, 0, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,.16)";
  g.beginPath();
  g.ellipse(2.8, -1 - bob, 3, 5, 0, 0, 7);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.3)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-6, -8 - bob);
  g.lineTo(6, -8 - bob);
  g.lineTo(5, 4 - bob);
  g.lineTo(-5, 4 - bob);
  g.closePath();
  g.stroke();
  g.fillStyle = trim;
  g.fillRect(-6, -8 - bob, 12, 2);
  if (cls === "hunter") {
    g.fillStyle = "#31502a";
    g.beginPath();
    g.arc(0, -13 - bob, 5.5, 0, 7);
    g.fill();
    g.fillStyle = head;
    g.beginPath();
    g.arc(1, -12.4 - bob, 3.4, -0.7, 1.6);
    g.fill();
  } else {
    g.fillStyle = head;
    g.beginPath();
    g.arc(0, -13 - bob, 4.5, 0, 7);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = "rgba(255,255,255,.22)";
    g.beginPath();
    g.arc(-1.6, -14.4 - bob, 2.1, 0, 7);
    g.fill();
    g.fillStyle = "rgba(0,0,0,.14)";
    g.beginPath();
    g.arc(1.8, -11.8 - bob, 2.1, 0, 7);
    g.fill();
    g.restore();
    if (cls === "warrior") {
      g.fillStyle = "#c8933b";
      g.beginPath();
      g.arc(0, -14 - bob, 4.6, Math.PI, 0);
      g.fill();
      g.fillStyle = "#a8352b";
      g.beginPath();
      g.moveTo(-1, -20 - bob);
      g.quadraticCurveTo(4, -19 - bob, 5, -14 - bob);
      g.lineTo(2, -14 - bob);
      g.quadraticCurveTo(2, -17 - bob, -1, -18.5 - bob);
      g.closePath();
      g.fill();
    }
    if (cls === "mage") {
      g.fillStyle = "#22355c";
      g.fillRect(-6, -16 - bob, 12, 2);
      g.beginPath();
      g.moveTo(-3, -16 - bob);
      g.lineTo(0, -24 - bob);
      g.lineTo(3, -16 - bob);
      g.closePath();
      g.fill();
    }
    if (cls === "cleric") {
      g.fillStyle = "#f0e6a8";
      g.beginPath();
      g.arc(0, -14.5 - bob, 5.2, Math.PI, 0);
      g.fill();
      g.strokeStyle = "#c8933b";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(0, -14.2 - bob, 5.6, Math.PI + 0.15, -0.15);
      g.stroke();
    }
  }
  const sw = Math.sin(t / 90) * walk * 3;
  if (cls === "warrior") {
    g.fillStyle = "#7a5a28";
    g.beginPath();
    g.arc(-7, -3 - bob, 4.5, 0, 7);
    g.fill();
    g.strokeStyle = "#e8c470";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "#cfd2d6";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(7, -2 - bob + sw * 0.3);
    g.lineTo(12, -12 - bob + sw);
    g.stroke();
    g.strokeStyle = "#8a6527";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(5.6, -4.6 - bob);
    g.lineTo(8.6, -1.6 - bob);
    g.stroke();
  } else if (cls === "hunter") {
    g.strokeStyle = "#6a4a22";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(8, -6 - bob, 7, -1.2, 1.2);
    g.stroke();
    g.strokeStyle = "rgba(230,230,210,.7)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(8 + 7 * Math.cos(-1.2), -6 - bob + 7 * Math.sin(-1.2));
    g.lineTo(8 + 7 * Math.cos(1.2), -6 - bob + 7 * Math.sin(1.2));
    g.stroke();
  } else if (cls === "mage") {
    g.strokeStyle = "#5c4426";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(8, 8 - bob);
    g.lineTo(8, -16 - bob + sw * 0.5);
    g.stroke();
    g.fillStyle = "#7fb3ff";
    g.beginPath();
    g.arc(8, -18 - bob + sw * 0.5, 3, 0, 7);
    g.fill();
    if (inWorld) {
      g.fillStyle = "rgba(127,179,255,.3)";
      g.beginPath();
      g.arc(8, -18 - bob + sw * 0.5, 5.5, 0, 7);
      g.fill();
    }
  } else if (cls === "cleric") {
    g.strokeStyle = "#8a6a2e";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(8, 8 - bob);
    g.lineTo(8, -16 - bob + sw * 0.5);
    g.stroke();
    g.fillStyle = "#fff4b0";
    g.beginPath();
    g.arc(8, -18 - bob + sw * 0.5, 3.2, 0, 7);
    g.fill();
    if (inWorld) {
      g.fillStyle = "rgba(255,230,140,.35)";
      g.beginPath();
      g.arc(8, -18 - bob + sw * 0.5, 5.8, 0, 7);
      g.fill();
    }
  }
  g.restore();
}
// Clips to whatever path is still active from the caller's last fill() (fill()
// doesn't reset the current path) and lays a soft highlight/shadow over it —
// a cheap way to give an otherwise flat silhouette some depth.
function shadeCurrent(g, hlx, hly, hlr, shx, shy, shr) {
  g.save();
  g.clip();
  g.fillStyle = "rgba(255,255,255,.16)";
  g.beginPath();
  g.ellipse(hlx, hly, hlr, hlr * 1.3, 0, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,.16)";
  g.beginPath();
  g.ellipse(shx, shy, shr, shr * 1.3, 0, 0, 7);
  g.fill();
  g.restore();
}
function drawMonster(g, k, bob, walk, t, face, scale) {
  const flip = face ? -1 : 1;
  g.save();
  g.scale(flip * scale, scale);
  const wob = Math.sin(t / 80) * walk * 2;
  switch (k) {
    case "boar": {
      g.fillStyle = "#6a4526";
      g.beginPath();
      g.ellipse(0, -5 - bob, 10, 6.5, 0, 0, 7);
      g.fill();
      shadeCurrent(g, -3, -7 - bob, 4, 4, -3 - bob, 4);
      g.fillStyle = "#7d5530";
      g.beginPath();
      g.arc(9, -6 - bob, 4.5, 0, 7);
      g.fill();
      g.fillStyle = "#4a2f18";
      g.fillRect(-7, 0 - bob, 2.5, 6 + wob);
      g.fillRect(-1, 0 - bob, 2.5, 6 - wob);
      g.fillRect(5, 0 - bob, 2.5, 6 + wob);
      g.strokeStyle = "#efe6d2";
      g.lineWidth = 1.6;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(11, -4 - bob);
      g.quadraticCurveTo(14, -5 - bob, 14, -8 - bob);
      g.stroke();
      g.fillStyle = "#3a2412";
      g.beginPath();
      g.moveTo(-8, -10 - bob);
      g.quadraticCurveTo(0, -14 - bob, 8, -10 - bob);
      g.quadraticCurveTo(0, -11 - bob, -8, -10 - bob);
      g.fill();
      g.fillStyle = "#1a0f06";
      g.beginPath();
      g.arc(10.5, -7 - bob, 1, 0, 7);
      g.fill();
      break;
    }
    case "satyr": {
      g.strokeStyle = "#5c3d20";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-3, 0 - bob);
      g.quadraticCurveTo(-5, 5, -3 - wob, 11);
      g.moveTo(3, 0 - bob);
      g.quadraticCurveTo(5, 5, 3 + wob, 11);
      g.stroke();
      g.fillStyle = "#8a6a45";
      g.beginPath();
      g.ellipse(0, -6 - bob, 6, 8, 0, 0, 7);
      g.fill();
      shadeCurrent(g, -2.2, -9 - bob, 2.6, 2.4, -3 - bob, 2.6);
      g.fillStyle = "#c39a68";
      g.beginPath();
      g.arc(0, -15 - bob, 4.5, 0, 7);
      g.fill();
      g.strokeStyle = "#d9cdb5";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-3, -18 - bob);
      g.quadraticCurveTo(-6, -22 - bob, -4, -24 - bob);
      g.moveTo(3, -18 - bob);
      g.quadraticCurveTo(6, -22 - bob, 4, -24 - bob);
      g.stroke();
      g.strokeStyle = "#5c3d20";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-6, -3 - bob);
      g.quadraticCurveTo(-11, -2 - bob + wob, -10, 2 - bob);
      g.stroke();
      g.strokeStyle = "#7a5c34";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(5, -8 - bob);
      g.lineTo(10, -13 - bob + wob);
      g.stroke();
      g.fillStyle = "#1a0f06";
      g.beginPath();
      g.arc(1.5, -15.5 - bob, 0.9, 0, 7);
      g.fill();
      break;
    }
    case "skeleton": {
      g.strokeStyle = "#e6e0d0";
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-2.5, 1 - bob);
      g.lineTo(-3 - wob, 11);
      g.moveTo(2.5, 1 - bob);
      g.lineTo(3 + wob, 11);
      g.moveTo(0, 1 - bob);
      g.lineTo(0, -9 - bob);
      g.moveTo(-6, -7 - bob);
      g.lineTo(6, -7 - bob);
      g.moveTo(-5, -4 - bob);
      g.lineTo(5, -4 - bob);
      g.moveTo(-4, -1.5 - bob);
      g.lineTo(4, -1.5 - bob);
      g.moveTo(6, -7 - bob);
      g.lineTo(9, -1 - bob + wob);
      g.stroke();
      g.fillStyle = "#efe9dc";
      g.beginPath();
      g.arc(0, -13 - bob, 4.4, 0, 7);
      g.fill();
      shadeCurrent(g, -1.5, -14.5 - bob, 1.8, 1.7, -11.8 - bob, 1.8);
      g.fillStyle = "#141210";
      g.beginPath();
      g.arc(-1.7, -13.5 - bob, 1.1, 0, 7);
      g.arc(1.7, -13.5 - bob, 1.1, 0, 7);
      g.fill();
      g.fillRect(-2, -10.6 - bob, 4, 1);
      g.strokeStyle = "#b9bec4";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(9, -1 - bob + wob);
      g.lineTo(13, -9 - bob + wob);
      g.stroke();
      break;
    }
    case "harpy": {
      const hov = Math.sin(t / 220) * 2.5;
      const flap = Math.sin(t / 130) * 0.8;
      g.translate(0, -8 + hov);
      g.fillStyle = "#7a5c6e";
      g.beginPath();
      g.moveTo(-3, -6);
      g.quadraticCurveTo(-14, -12 - flap * 6, -16, -2 + flap * 4);
      g.quadraticCurveTo(-9, -3, -3, -2);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(3, -6);
      g.quadraticCurveTo(14, -12 - flap * 6, 16, -2 + flap * 4);
      g.quadraticCurveTo(9, -3, 3, -2);
      g.closePath();
      g.fill();
      g.fillStyle = "#9a7888";
      g.beginPath();
      g.ellipse(0, -3, 4.5, 6.5, 0, 0, 7);
      g.fill();
      shadeCurrent(g, -1.7, -5, 2, 1.8, -1, 2);
      g.fillStyle = "#d3a988";
      g.beginPath();
      g.arc(0, -11, 3.8, 0, 7);
      g.fill();
      g.fillStyle = "#4a3a4e";
      g.beginPath();
      g.arc(0, -12.5, 3.8, Math.PI, 0);
      g.fill();
      g.strokeStyle = "#c9a24a";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-2, 3);
      g.lineTo(-3, 7);
      g.moveTo(2, 3);
      g.lineTo(3, 7);
      g.stroke();
      g.fillStyle = "#1a0f06";
      g.beginPath();
      g.arc(1.4, -11, 0.8, 0, 7);
      g.fill();
      break;
    }
    case "gorgon": {
      g.fillStyle = "#3f7a4a";
      g.beginPath();
      g.moveTo(-2, -4 - bob);
      g.quadraticCurveTo(-9, 2, -3, 6);
      g.quadraticCurveTo(4, 10, 9, 6 + wob);
      g.quadraticCurveTo(3, 5, 1, 1 - bob);
      g.closePath();
      g.fill();
      g.fillStyle = "#5c9c62";
      g.beginPath();
      g.ellipse(0, -8 - bob, 5, 7, 0, 0, 7);
      g.fill();
      shadeCurrent(g, -1.8, -10 - bob, 2.2, 2, -6 - bob, 2.2);
      g.fillStyle = "#7cb082";
      g.beginPath();
      g.arc(0, -16 - bob, 4.4, 0, 7);
      g.fill();
      g.strokeStyle = "#2f5c36";
      g.lineWidth = 1.6;
      g.lineCap = "round";
      for (let i = 0;i < 5; i++) {
        const a = -2.4 + i * 0.55, wig = Math.sin(t / 160 + i * 1.9) * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * 3.6, -16 - bob + Math.sin(a) * 3.6);
        g.quadraticCurveTo(Math.cos(a) * 8 + wig, -19 - bob + Math.sin(a) * 7, Math.cos(a) * 10 - wig, -18 - bob + Math.sin(a) * 10);
        g.stroke();
      }
      g.fillStyle = "#e5ee5a";
      g.beginPath();
      g.arc(1.5, -16.4 - bob, 1, 0, 7);
      g.fill();
      break;
    }
    case "cyclops": {
      g.fillStyle = "#8a6a4a";
      g.fillRect(-6, -2 - bob, 4.5, 12 + wob);
      g.fillRect(2, -2 - bob, 4.5, 12 - wob);
      g.fillStyle = "#9c7a52";
      g.beginPath();
      g.moveTo(-9, -18 - bob);
      g.quadraticCurveTo(0, -21 - bob, 9, -18 - bob);
      g.lineTo(7, -1 - bob);
      g.lineTo(-7, -1 - bob);
      g.closePath();
      g.fill();
      shadeCurrent(g, -3.5, -13 - bob, 4, 4, -6 - bob, 4);
      g.fillStyle = "#6a4c2e";
      g.fillRect(-7, -7 - bob, 14, 3);
      g.fillStyle = "#ab8a60";
      g.beginPath();
      g.arc(0, -23 - bob, 6, 0, 7);
      g.fill();
      shadeCurrent(g, -2.2, -25 - bob, 2.6, 2.4, -21 - bob, 2.6);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(0, -24 - bob, 2.6, 0, 7);
      g.fill();
      g.fillStyle = "#7a2e1e";
      g.beginPath();
      g.arc(0, -24 - bob, 1.3, 0, 7);
      g.fill();
      g.fillStyle = "#5c4426";
      g.save();
      g.translate(10, -14 - bob + wob);
      g.rotate(0.5);
      g.beginPath();
      g.moveTo(-1.5, 0);
      g.lineTo(1.5, 0);
      g.lineTo(3.5, -14);
      g.lineTo(-3.5, -14);
      g.closePath();
      g.fill();
      g.restore();
      g.strokeStyle = "#9c7a52";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-8, -16 - bob);
      g.lineTo(-11, -8 - bob - wob);
      g.moveTo(8, -16 - bob);
      g.lineTo(10, -14 - bob + wob);
      g.stroke();
      break;
    }
    case "shade": {
      g.globalAlpha = 0.75;
      g.fillStyle = "#7a88b8";
      g.beginPath();
      g.moveTo(-5, 8);
      g.quadraticCurveTo(-7, -4 - bob, 0, -10 - bob);
      g.quadraticCurveTo(7, -4 - bob, 5, 8);
      g.closePath();
      g.fill();
      shadeCurrent(g, -2.2, -2 - bob, 3, 2.4, 2 - bob, 3);
      g.fillStyle = "#c8d0f0";
      g.beginPath();
      g.arc(0, -14 - bob, 4, 0, 7);
      g.fill();
      g.fillStyle = "#e8f0ff";
      g.beginPath();
      g.arc(-1.5, -14.5 - bob, 1.1, 0, 7);
      g.arc(1.5, -14.5 - bob, 1.1, 0, 7);
      g.fill();
      g.globalAlpha = 1;
      break;
    }
    case "fury": {
      g.fillStyle = "#5a2040";
      g.beginPath();
      g.moveTo(-4, 8);
      g.lineTo(-5, -6 - bob);
      g.lineTo(5, -6 - bob);
      g.lineTo(4, 8);
      g.closePath();
      g.fill();
      shadeCurrent(g, -2, -2 - bob, 2.4, 2, 2 - bob, 2.4);
      g.fillStyle = "#8a3060";
      g.beginPath();
      g.arc(0, -11 - bob, 4.2, 0, 7);
      g.fill();
      // wings
      g.fillStyle = "rgba(160,40,80,.7)";
      g.beginPath();
      g.moveTo(-4, -8 - bob);
      g.quadraticCurveTo(-14, -16 - bob, -12, -2 - bob);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(4, -8 - bob);
      g.quadraticCurveTo(14, -16 - bob, 12, -2 - bob);
      g.closePath();
      g.fill();
      g.fillStyle = "#ff6080";
      g.beginPath();
      g.arc(-1.4, -11.5 - bob, 1, 0, 7);
      g.arc(1.4, -11.5 - bob, 1, 0, 7);
      g.fill();
      break;
    }
    case "minotaur": {
      g.fillStyle = "#5a3a22";
      g.fillRect(-6, -2 - bob, 4.5, 12 + wob);
      g.fillRect(2, -2 - bob, 4.5, 12 - wob);
      g.fillStyle = "#6e4828";
      g.beginPath();
      g.moveTo(-9, -16 - bob);
      g.quadraticCurveTo(0, -19 - bob, 9, -16 - bob);
      g.lineTo(7, -1 - bob);
      g.lineTo(-7, -1 - bob);
      g.closePath();
      g.fill();
      shadeCurrent(g, -3.5, -11 - bob, 4, 4, -4 - bob, 4);
      g.fillStyle = "#4a3018";
      g.beginPath();
      g.arc(0, -22 - bob, 6.5, 0, 7);
      g.fill();
      shadeCurrent(g, -2.4, -24 - bob, 2.8, 2.6, -20 - bob, 2.8);
      // horns
      g.strokeStyle = "#d8c8a0";
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-5, -26 - bob);
      g.quadraticCurveTo(-11, -34 - bob, -8, -22 - bob);
      g.moveTo(5, -26 - bob);
      g.quadraticCurveTo(11, -34 - bob, 8, -22 - bob);
      g.stroke();
      g.fillStyle = "#ffcf40";
      g.beginPath();
      g.arc(-2, -23 - bob, 1.3, 0, 7);
      g.arc(2, -23 - bob, 1.3, 0, 7);
      g.fill();
      g.fillStyle = "#2a1a10";
      g.fillRect(-2, -20 - bob, 4, 2);
      break;
    }
    case "lizardman": {
      // hombre lagarto del pantano: cuerpo escamoso verde, cola y lanza
      g.fillStyle = "#3f6a2e";
      g.fillRect(-5, 0 - bob, 2.6, 7 + wob);
      g.fillRect(1, 0 - bob, 2.6, 7 - wob);
      g.fillStyle = "#4d8038";
      g.beginPath();
      g.moveTo(-6, -12 - bob);
      g.quadraticCurveTo(0, -15 - bob, 6, -12 - bob);
      g.lineTo(5, 1 - bob);
      g.lineTo(-5, 1 - bob);
      g.closePath();
      g.fill();
      shadeCurrent(g, -2.4, -8 - bob, 2.6, 2.4, -3 - bob, 2.6);
      // cola
      g.strokeStyle = "#3f6a2e";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-4, 2 - bob);
      g.quadraticCurveTo(-12, 6 - bob, -14, 0 - bob + wob);
      g.stroke();
      // cabeza con hocico
      g.fillStyle = "#5a9440";
      g.beginPath();
      g.arc(0, -16 - bob, 4.6, 0, 7);
      g.fill();
      g.beginPath();
      g.moveTo(3, -17 - bob);
      g.lineTo(9, -15 - bob);
      g.lineTo(3, -13.5 - bob);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffd84a";
      g.beginPath();
      g.arc(1.2, -17 - bob, 1.1, 0, 7);
      g.fill();
      // lanza
      g.strokeStyle = "#7a5a30";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(6, 6 - bob);
      g.lineTo(9, -20 - bob);
      g.stroke();
      g.fillStyle = "#c8d0d8";
      g.beginPath();
      g.moveTo(9, -20 - bob);
      g.lineTo(7.6, -24 - bob);
      g.lineTo(10.4, -24 - bob);
      g.closePath();
      g.fill();
      break;
    }
    case "wisp": {
      // fuego fatuo: orbe espectral que flota entre los juncos
      const flo = Math.sin(t / 300) * 2;
      g.globalAlpha = 0.35;
      g.fillStyle = "#8af0e0";
      g.beginPath();
      g.arc(0, -10 - bob - flo, 8.5, 0, 7);
      g.fill();
      g.globalAlpha = 0.85;
      g.fillStyle = "#b8fff2";
      g.beginPath();
      g.arc(0, -10 - bob - flo, 4.6, 0, 7);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(0, -11 - bob - flo, 2, 0, 7);
      g.fill();
      // estelas
      g.globalAlpha = 0.5;
      g.strokeStyle = "#8af0e0";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-3, -5 - bob - flo);
      g.quadraticCurveTo(-6, 2 - bob, -2, 6 - bob + wob);
      g.moveTo(3, -5 - bob - flo);
      g.quadraticCurveTo(6, 2 - bob, 2, 6 - bob - wob);
      g.stroke();
      g.globalAlpha = 1;
      break;
    }
    case "hydra": {
      // Hidra de Lerna: cuerpo pantanoso y tres cuellos con cabezas
      g.fillStyle = "#2e5230";
      g.beginPath();
      g.ellipse(0, -4 - bob, 11, 8, 0, 0, 7);
      g.fill();
      shadeCurrent(g, -4, -7 - bob, 5, 4.5, -1 - bob, 5);
      g.fillStyle = "#3a6438";
      g.fillRect(-8, 2 - bob, 4, 6 + wob);
      g.fillRect(4, 2 - bob, 4, 6 - wob);
      // tres cuellos serpenteantes
      g.strokeStyle = "#3f7a40";
      g.lineWidth = 4;
      g.lineCap = "round";
      const sway = Math.sin(t / 260) * 2;
      g.beginPath();
      g.moveTo(-4, -8 - bob);
      g.quadraticCurveTo(-12 - sway, -20 - bob, -10, -26 - bob - sway);
      g.moveTo(0, -9 - bob);
      g.quadraticCurveTo(sway, -22 - bob, 0, -30 - bob + sway);
      g.moveTo(4, -8 - bob);
      g.quadraticCurveTo(12 + sway, -20 - bob, 10, -26 - bob + sway);
      g.stroke();
      // cabezas
      g.fillStyle = "#4d8c48";
      for (const [hx, hy] of [[-10, -27 - sway], [0, -31 + sway], [10, -27 + sway]]) {
        g.beginPath();
        g.arc(hx, hy - bob, 3.6, 0, 7);
        g.fill();
      }
      g.fillStyle = "#ffd84a";
      for (const [hx, hy] of [[-10, -27 - sway], [0, -31 + sway], [10, -27 + sway]]) {
        g.beginPath();
        g.arc(hx + 1, hy - 0.6 - bob, 1, 0, 7);
        g.fill();
      }
      break;
    }
    default: {
      g.fillStyle = "#888";
      g.beginPath();
      g.arc(0, -6 - bob, 6, 0, 7);
      g.fill();
    }
  }
  g.restore();
}
function drawNpc(g, k, bob, t) {
  if (k === "stash") {
    // Wooden chest with a domed lid, iron bands and a glowing lock.
    g.fillStyle = "#6b4423";
    g.beginPath();
    g.moveTo(-10, 9 - bob);
    g.lineTo(-10, 1 - bob);
    g.quadraticCurveTo(-10, -8 - bob, 0, -8 - bob);
    g.quadraticCurveTo(10, -8 - bob, 10, 1 - bob);
    g.lineTo(10, 9 - bob);
    g.closePath();
    g.fill();
    g.fillStyle = "#4a3018";
    g.fillRect(-10, 0.5 - bob, 20, 2.2);
    g.strokeStyle = "#2f2010";
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(-10, 1 - bob); g.lineTo(-10, 9 - bob);
    g.moveTo(10, 1 - bob); g.lineTo(10, 9 - bob);
    g.moveTo(-10, -3 - bob); g.quadraticCurveTo(0, -10 - bob, 10, -3 - bob);
    g.stroke();
    const glow = 0.55 + Math.sin(t / 380) * 0.3;
    g.fillStyle = `rgba(255,214,120,${glow})`;
    g.beginPath();
    g.arc(0, 3 - bob, 2.1, 0, 7);
    g.fill();
    g.strokeStyle = "#8a6527";
    g.lineWidth = 1;
    g.stroke();
    return;
  }
  if (k === "petshop") {
    // Small wooden kennel with an A-frame roof and a paw print out front.
    g.fillStyle = "#8a6a3e";
    g.beginPath();
    g.moveTo(-9, 9 - bob);
    g.lineTo(-9, -2 - bob);
    g.lineTo(0, -12 - bob);
    g.lineTo(9, -2 - bob);
    g.lineTo(9, 9 - bob);
    g.closePath();
    g.fill();
    g.fillStyle = "#5c3a20";
    g.beginPath();
    g.moveTo(-10.5, -2 - bob);
    g.lineTo(0, -13.5 - bob);
    g.lineTo(10.5, -2 - bob);
    g.lineTo(7, -2 - bob);
    g.lineTo(0, -9 - bob);
    g.lineTo(-7, -2 - bob);
    g.closePath();
    g.fill();
    g.fillStyle = "#1a1206";
    g.beginPath();
    g.arc(0, 4 - bob, 3.4, Math.PI, 0);
    g.fill();
    g.fillRect(-3.4, 4 - bob, 6.8, 5);
    g.fillStyle = "#c8933b";
    g.beginPath(); g.arc(13, 8.5 - bob, 1.3, 0, 7); g.fill();
    g.beginPath(); g.arc(15.6, 6.4 - bob, 1, 0, 7); g.fill();
    g.beginPath(); g.arc(15.9, 9.6 - bob, 1, 0, 7); g.fill();
    g.beginPath(); g.arc(12.4, 5.6 - bob, 0.9, 0, 7); g.fill();
    return;
  }
  if (k === "portal") {
    // Stone ring gateway with a swirling energy disc and orbiting sparkles.
    const cy = -6 - bob;
    const pulse = 0.5 + Math.sin(t * 0.006) * 0.3;
    g.fillStyle = `rgba(130,95,225,${0.45 + pulse * 0.2})`;
    g.beginPath();
    g.arc(0, cy, 6.6, 0, 7);
    g.fill();
    g.strokeStyle = `rgba(205,175,255,${0.6 + pulse * 0.3})`;
    g.lineWidth = 1.1;
    for (let i = 0; i < 2; i++) {
      const r = 2.6 + i * 2 + pulse;
      g.beginPath();
      g.arc(0, cy, r, t * 0.002 + i, t * 0.002 + i + 4.5);
      g.stroke();
    }
    g.strokeStyle = "#6b6b74";
    g.lineWidth = 2.6;
    g.beginPath();
    g.arc(0, cy, 9, 0, 7);
    g.stroke();
    g.strokeStyle = "#c9c9d2";
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(0, cy, 9, -0.7, 0.7);
    g.stroke();
    g.fillStyle = "#e8dcff";
    for (let i = 0; i < 3; i++) {
      const a = t / 300 + i * 2.1;
      g.beginPath();
      g.arc(Math.cos(a) * 10.5, cy + Math.sin(a) * 4.2, 1, 0, 7);
      g.fill();
    }
    g.fillStyle = "#4a4a52";
    g.fillRect(-9, cy + 8.5, 18, 2.6);
    return;
  }
  const robes = { elder: ["#d8cfb8", "#8a6527"], merchant: ["#7a4a6a", "#c8933b"], smith: ["#5c3a28", "#8f8f96"] };
  const [robe, trim] = robes[k] || ["#999", "#666"];
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(-6, 10);
  g.quadraticCurveTo(-7, -6 - bob, 0, -8 - bob);
  g.quadraticCurveTo(7, -6 - bob, 6, 10);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = "rgba(255,255,255,.15)";
  g.beginPath();
  g.ellipse(-2.6, -1 - bob, 3, 8, 0, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,.16)";
  g.beginPath();
  g.ellipse(3, 4 - bob, 3, 8, 0, 0, 7);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.28)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-6, 10);
  g.quadraticCurveTo(-7, -6 - bob, 0, -8 - bob);
  g.quadraticCurveTo(7, -6 - bob, 6, 10);
  g.closePath();
  g.stroke();
  g.fillStyle = trim;
  g.fillRect(-6, 7, 12, 2);
  g.fillStyle = "#d9a970";
  g.beginPath();
  g.arc(0, -12 - bob, 4.4, 0, 7);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = "rgba(255,255,255,.2)";
  g.beginPath();
  g.arc(-1.5, -13.3 - bob, 2, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,.12)";
  g.beginPath();
  g.arc(1.7, -10.8 - bob, 2, 0, 7);
  g.fill();
  g.restore();
  if (k === "elder") {
    g.fillStyle = "#eee8da";
    g.beginPath();
    g.moveTo(-3, -10 - bob);
    g.quadraticCurveTo(0, -3 - bob, 3, -10 - bob);
    g.closePath();
    g.fill();
  }
  if (k === "smith") {
    g.strokeStyle = "#444";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(6, -4 - bob);
    g.lineTo(10, -10 - bob);
    g.stroke();
    g.fillStyle = "#8f8f96";
    g.fillRect(8, -13 - bob, 5, 4);
  }
  if (k === "board") {
    g.fillStyle = "#4a3620";
    g.fillRect(-2, -2 - bob, 4, 14);
    g.fillStyle = "#8a6a3e";
    g.beginPath();
    g.moveTo(-11, -6 - bob);
    g.lineTo(11, -6 - bob);
    g.lineTo(9, -19 - bob);
    g.lineTo(-9, -19 - bob);
    g.closePath();
    g.fill();
    g.strokeStyle = "#3a2a16";
    g.lineWidth = 1.2;
    g.strokeRect(-9, -18 - bob, 18, 11);
    g.fillStyle = "#e8dcc0";
    for (let i = 0; i < 3; i++) g.fillRect(-6, -16 - bob + i * 3, 12, 1.4);
    return;
  }
  if (k === "merchant") {
    g.fillStyle = "#8a6527";
    g.fillRect(-9, -2 - bob, 5, 6);
  }
}
var PLAYER_KINDS = { warrior: 1, hunter: 1, mage: 1, cleric: 1 };
var NPC_KINDS = { elder: 1, merchant: 1, smith: 1, portal: 1, board: 1, stash: 1, petshop: 1 };
function drawEntity(E, t) {
  const sx = w2sx(E.rx), sy = w2sy(E.ry);
  if (sx < -80 || sy < -100 || sx > VW + 80 || sy > VH + 100)
    return;
  const moving = (E.s & 1) !== 0;
  const isNpc = NPC_KINDS[E.k], isPlayer = PLAYER_KINDS[E.k];
  const scale = BOSS_KINDS.has(E.k) ? 2 : 1;
  const bob = Math.sin(t / 400 + E.bobP) * (moving ? 0.5 : 1.2);
  const walk = moving ? 1 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (BOSS_KINDS.has(E.k) && !E.dieT) {
    const pulse = 0.5 + Math.sin(t / 260) * 0.5;
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 46 * scale);
    gr.addColorStop(0, `rgba(255,90,40,${0.16 + pulse * 0.1})`);
    gr.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, 46 * scale, 0, 7);
    ctx.fill();
  }
  if (E.k !== "harpy") {
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.beginPath();
    ctx.ellipse(0, 12 * scale, 9 * scale, 3.5 * scale, 0, 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 7, 2.6, 0, 0, 7);
    ctx.fill();
  }
  if (E.pet && isPlayer && !E.dieT) {
    const pb = Math.sin(t / 380 + E.bobP + 1.7) * 1.2;
    ctx.save();
    ctx.translate(-13, 9 + pb);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 5, 2, 0, 0, 7);
    ctx.fill();
    drawPetIcon(ctx, E.pet, 0, 0, 14);
    ctx.restore();
  }
  if (E.dieT) {
    const self = idOf(E) === S.myId;
    const f = 1 - (t - E.dieT) / 700;
    if (f <= 0) {
      // Keep local player entity while dead so the camera still follows and the
      // corpse stays under the revive overlay. Other entities despawn as before.
      if (self) {
        ctx.globalAlpha = 0.35;
      } else {
        ctx.restore();
        S.ents.delete(idOf(E));
        return;
      }
    } else {
      ctx.globalAlpha = f;
    }
  }
  const myTarget = S.targetId && idOf(E) === S.targetId;
  if (idOf(E) === S.hoverId || myTarget) {
    ctx.strokeStyle = myTarget ? "rgba(232,70,50,.85)" : "rgba(236,193,110,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 12 * scale, 11 * scale, 4.5 * scale, 0, 0, 7);
    ctx.stroke();
  }
  if (isPlayer)
    drawHumanoid(ctx, E.k, bob, walk, t, E.d);
  else if (isNpc)
    drawNpc(ctx, E.k, bob, t);
  else
    drawMonster(ctx, E.k, bob, walk, t, E.d, scale);
  if (E.hitT && t - E.hitT < 160) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.translate(90, 140);
    if (isPlayer)
      drawHumanoid(sctx, E.k, bob, walk, t, E.d);
    else if (isNpc)
      drawNpc(sctx, E.k, bob, t);
    else
      drawMonster(sctx, E.k, bob, walk, t, E.d, scale);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = "source-atop";
    sctx.fillStyle = "#ff2a1a";
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = "source-over";
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * (1 - (t - E.hitT) / 160) * 0.6;
    ctx.drawImage(scratch, -90, -140);
    ctx.globalAlpha = prevA;
  }
  if (E.s & 8) {
    ctx.fillStyle = "#ffe680";
    for (let i = 0;i < 3; i++) {
      const a = t / 300 + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8, -20 * scale + Math.sin(a) * 2, 1.6, 0, 7);
      ctx.fill();
    }
  }
  const topY = E.k === "cyclops" || E.k === "minotaur" ? -62 : E.k === "hydra" ? -70 : E.k === "harpy" ? -34 : -26;
  if (E.h < E.H && E.h > 0) {
    const bw = 26 * scale;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(-bw / 2, topY, bw, 4);
    ctx.fillStyle = isPlayer || isNpc ? "#5fae4a" : "#c8382a";
    ctx.fillRect(-bw / 2 + 0.5, topY + 0.5, (bw - 1) * (E.h / E.H), 3);
  }
  if (BOSS_KINDS.has(E.k) && !E.dieT) {
    const sy2 = topY - 17 + Math.sin(t / 340) * 2;
    ctx.save();
    ctx.translate(0, sy2);
    ctx.fillStyle = "#7a1810";
    ctx.beginPath();
    ctx.moveTo(-15, -6);
    ctx.lineTo(15, -6);
    ctx.lineTo(15, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a0a06";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 9px Georgia";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a0805";
    ctx.fillText("BOSS", 0.5, 0.5);
    ctx.fillStyle = "#ffd94a";
    ctx.fillText("BOSS", 0, 0);
    ctx.restore();
  }
  const emo = S.emotes[idOf(E)];
  if (emo && t - emo.t0 < 2200) {
    const glyphs = { wave: "👋", dance: "💃", cheer: "🎉", bow: "🙇" };
    const g = glyphs[emo.e] || "✨";
    const a = 1 - Math.max(0, (t - emo.t0 - 1400) / 800);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.fillText(g, 0, topY - 18 - (t - emo.t0) * 0.01);
    ctx.restore();
  } else if (emo && t - emo.t0 >= 2200) {
    delete S.emotes[idOf(E)];
  }
  if (isPlayer || BOSS_KINDS.has(E.k)) {
    ctx.font = "11px Georgia";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.7)";
    const label = `${E.n || ""} · ${E.l}`;
    ctx.fillText(label, 1, topY - 5 + 1);
    ctx.fillStyle = idOf(E) === S.myId ? "#ecc16e" : S.partyIds.has(idOf(E)) ? "#7de08a" : BOSS_KINDS.has(E.k) ? "#ff9a5e" : "#cfe0ff";
    ctx.fillText(label, 0, topY - 5);
  } else if (isNpc) {
    ctx.font = "11px Georgia";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillText(E.n || E.k, 1, topY - 4 + 1);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(E.n || E.k, 0, topY - 4);
    if (E.k === "elder") {
      const hy = topY - 18 + Math.sin(t / 350) * 2.5;
      ctx.font = "bold 16px Georgia";
      ctx.fillStyle = "#1a1206";
      ctx.fillText("!", 1, hy + 1);
      ctx.fillStyle = "#ffd94a";
      ctx.fillText("!", 0, hy);
    }
  }
  ctx.restore();
}
function idOf(E) {
  if (E._id === undefined) {
    for (const [id, v] of S.ents)
      if (v === E) {
        E._id = id;
        break;
      }
  }
  return E._id;
}
function drawLoot(t) {
  for (const [id, L] of S.loot) {
    const sx = w2sx(L.x), sy = w2sy(L.y);
    if (sx < -40 || sy < -40 || sx > VW + 40 || sy > VH + 40)
      continue;
    const glow = RARITY_COLOR[L.rarity] || "#fff";
    const pulse = 0.55 + Math.sin(t / 400 + id) * 0.2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 8, 3, 0, 0, 7);
    ctx.fill();
    if (L.rarity !== "common") {
      ctx.strokeStyle = glow;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 5, 9 + Math.sin(t / 350 + id) * 1.5, 3.6, 0, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (S.hoverLoot === id) {
      ctx.strokeStyle = "#ecc16e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 5, 10, 4, 0, 0, 7);
      ctx.stroke();
    }
    const bob2 = Math.sin(t / 500 + id) * 1.5;
    ctx.translate(0, -4 + bob2);
    drawItemIcon(ctx, L.icon, L.rarity, 0, 0, 16);
    ctx.restore();
    if (S.hoverLoot === id) {
      ctx.font = "11px Georgia";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(10,8,5,.85)";
      const w = ctx.measureText(L.name).width + 10;
      ctx.fillRect(sx - w / 2, sy - 30, w, 15);
      ctx.fillStyle = glow;
      ctx.fillText(L.name, sx, sy - 19);
    }
  }
}
function drawItemIcon(g, icon, rarity, cx, cy, size) {
  const s = size / 20;
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  const rc = RARITY_COLOR[rarity] || "#ddd";
  g.lineCap = "round";
  g.lineJoin = "round";
  switch (icon) {
    case "sword":
      g.strokeStyle = "#c9ccd2";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(-5, 6);
      g.lineTo(5, -6);
      g.stroke();
      g.strokeStyle = "#e8eef4";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-4.5, 5);
      g.lineTo(5, -6);
      g.stroke();
      g.strokeStyle = "#8a6527";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-7, 2);
      g.lineTo(-3, 6);
      g.stroke();
      g.beginPath();
      g.moveTo(-7.5, 7.5);
      g.lineTo(-5, 5);
      g.stroke();
      break;
    case "axe":
      g.strokeStyle = "#6a4a22";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(-5, 8);
      g.lineTo(4, -6);
      g.stroke();
      g.fillStyle = "#b9bec4";
      g.beginPath();
      g.moveTo(2, -8);
      g.quadraticCurveTo(9, -6, 8, 1);
      g.quadraticCurveTo(5, -3, 1, -3);
      g.closePath();
      g.fill();
      break;
    case "bow":
      g.strokeStyle = "#8a6035";
      g.lineWidth = 2.2;
      g.beginPath();
      g.arc(-2, 0, 8, -1.25, 1.25);
      g.stroke();
      g.strokeStyle = "#ded8c8";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-2 + 8 * Math.cos(-1.25), 8 * Math.sin(-1.25));
      g.lineTo(-2 + 8 * Math.cos(1.25), 8 * Math.sin(1.25));
      g.stroke();
      g.strokeStyle = "#c9ccd2";
      g.beginPath();
      g.moveTo(-4, 0);
      g.lineTo(7, 0);
      g.stroke();
      g.fillStyle = "#c9ccd2";
      g.beginPath();
      g.moveTo(7, 0);
      g.lineTo(4.5, -1.6);
      g.lineTo(4.5, 1.6);
      g.closePath();
      g.fill();
      break;
    case "staff":
      g.strokeStyle = "#5c4426";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(-4, 8);
      g.lineTo(3, -5);
      g.stroke();
      g.fillStyle = rc === "#e8e0d0" ? "#7fb3ff" : rc;
      g.beginPath();
      g.arc(4, -6.5, 2.6, 0, 7);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.5)";
      g.beginPath();
      g.arc(3.2, -7.3, 0.9, 0, 7);
      g.fill();
      break;
    case "armor":
      g.fillStyle = "#9c7a3e";
      g.beginPath();
      g.moveTo(-6, -6);
      g.lineTo(6, -6);
      g.lineTo(7, -2);
      g.quadraticCurveTo(5, 8, 0, 8);
      g.quadraticCurveTo(-5, 8, -7, -2);
      g.closePath();
      g.fill();
      g.fillStyle = "#c8a45e";
      g.fillRect(-6, -6, 12, 2.4);
      g.strokeStyle = "rgba(60,40,14,.7)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, -3);
      g.lineTo(0, 7);
      g.stroke();
      break;
    case "helm":
      g.fillStyle = "#b08a44";
      g.beginPath();
      g.arc(0, -1, 6.5, Math.PI, 0);
      g.lineTo(6.5, 5);
      g.lineTo(3.5, 5);
      g.lineTo(3.5, 1);
      g.lineTo(-3.5, 1);
      g.lineTo(-3.5, 5);
      g.lineTo(-6.5, 5);
      g.closePath();
      g.fill();
      g.fillStyle = "#a8352b";
      g.beginPath();
      g.moveTo(0, -8);
      g.quadraticCurveTo(6, -7, 6, -2);
      g.lineTo(3, -2);
      g.quadraticCurveTo(3, -5.6, 0, -6.4);
      g.closePath();
      g.fill();
      break;
    case "ring":
      g.strokeStyle = "#d4b04a";
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(0, 1.5, 5, 0, 7);
      g.stroke();
      g.fillStyle = rc;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(2.8, -4);
      g.lineTo(0, -1);
      g.lineTo(-2.8, -4);
      g.closePath();
      g.fill();
      break;
    case "potion_hp":
    case "potion_mp": {
      const liq = icon === "potion_hp" ? "#c33a2a" : "#3a6ec3";
      g.fillStyle = "rgba(210,225,235,.35)";
      g.beginPath();
      g.moveTo(-2, -7);
      g.lineTo(2, -7);
      g.lineTo(2, -3);
      g.quadraticCurveTo(6, 0, 5, 4);
      g.quadraticCurveTo(4, 8, 0, 8);
      g.quadraticCurveTo(-4, 8, -5, 4);
      g.quadraticCurveTo(-6, 0, -2, -3);
      g.closePath();
      g.fill();
      g.fillStyle = liq;
      g.beginPath();
      g.moveTo(-4.6, 2);
      g.quadraticCurveTo(0, 0, 4.6, 2);
      g.quadraticCurveTo(4, 8, 0, 8);
      g.quadraticCurveTo(-4, 8, -4.6, 2);
      g.closePath();
      g.fill();
      g.fillStyle = "#8a6527";
      g.fillRect(-2.4, -9, 4.8, 2.4);
      break;
    }
    case "horn":
      g.strokeStyle = "#d9cdb5";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-5, 7);
      g.quadraticCurveTo(-2, -2, 5, -6);
      g.stroke();
      g.strokeStyle = "#a8987c";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-4, 3);
      g.lineTo(-1, 4);
      g.moveTo(-1, -1);
      g.lineTo(2, 0);
      g.stroke();
      break;
    case "fish":
      g.fillStyle = "#5a9ec8";
      g.beginPath();
      g.ellipse(0, 0, 7, 3.6, -0.25, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(10, -3.5);
      g.lineTo(10, 3.5);
      g.closePath();
      g.fill();
      g.fillStyle = "#1a2a3a";
      g.beginPath();
      g.arc(-3, -0.5, 1.1, 0, 7);
      g.fill();
      break;
    case "eye":
      g.fillStyle = "#e8e2d2";
      g.beginPath();
      g.ellipse(0, 0, 7, 4.5, 0, 0, 7);
      g.fill();
      g.fillStyle = "#7a2e1e";
      g.beginPath();
      g.arc(0, 0, 2.8, 0, 7);
      g.fill();
      g.fillStyle = "#1a0f06";
      g.beginPath();
      g.arc(0, 0, 1.2, 0, 7);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.8)";
      g.beginPath();
      g.arc(-1, -1, 0.7, 0, 7);
      g.fill();
      break;
    default:
      g.fillStyle = rc;
      g.fillRect(-5, -5, 10, 10);
  }
  g.restore();
}
// ---- lightweight particle system: sparks/embers/dust, purely cosmetic ----
function spawnParticles(wx, wy, n, opts) {
  opts = opts || {};
  const color = opts.color || "#fff";
  const spread = opts.spread ?? 1.4;
  const life = opts.life ?? 420;
  const size = opts.size ?? 2.2;
  const grav = opts.grav ?? 2.2;
  const riseBias = opts.riseBias ?? 0.6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = spread * (0.4 + Math.random() * 0.9);
    S.particles.push({
      x: wx, y: wy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - riseBias,
      t0: now(),
      life: life * (0.7 + Math.random() * 0.6),
      size: size * (0.6 + Math.random() * 0.8),
      color,
      grav,
    });
  }
  if (S.particles.length > 260) S.particles.splice(0, S.particles.length - 260);
}
function shake(mag) {
  // Exponential decay each frame (see applyShake in frame()); ms duration
  // isn't tracked explicitly — stronger hits simply take longer to settle.
  S.shakeMag = Math.max(S.shakeMag, mag);
}
function applyShake() {
  if (S.shakeMag <= 0.05) {
    S.shakeMag = 0;
    return;
  }
  const dx = (Math.random() * 2 - 1) * S.shakeMag;
  const dy = (Math.random() * 2 - 1) * S.shakeMag;
  ctx.translate(dx, dy);
  S.shakeMag *= 0.82;
}
function updateParticles(t, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const P = S.particles[i];
    const age = t - P.t0;
    if (age >= P.life) {
      S.particles.splice(i, 1);
      continue;
    }
    P.x += P.vx * dt;
    P.y += P.vy * dt;
    P.vy += P.grav * dt;
  }
}
function drawParticles(t) {
  for (const P of S.particles) {
    const age = t - P.t0;
    const p = age / P.life;
    const sx = w2sx(P.x), sy = w2sy(P.y);
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.fillStyle = P.color;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.3, P.size * (1 - p * 0.5)), 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function addFx(m) {
  const t = now();
  if (m.k === "emote") {
    if (m.i) S.emotes[m.i] = { e: m.e || "wave", t0: t };
    return;
  }
  if (m.k === "proj") {
    const d = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
    S.fx.push({ k: "proj", ...m, t0: t, dur: clamp(d * 45, 120, 700) });
  } else if (m.k === "slash") {
    S.fx.push({ k: "slash", x: m.x, y: m.y, tx: m.tx, ty: m.ty, t0: t, dur: 260 });
  } else if (m.k === "aoe") {
    S.fx.push({ k: "aoe", x: m.x, y: m.y, r: m.r, style: m.style, t0: t, dur: m.style === "slam" ? 550 : m.style === "judgment" ? 700 : 450 });
    if (m.style === "slam" || m.style === "meteor") {
      shake(m.style === "meteor" ? 10 : 7, m.style === "meteor" ? 260 : 200);
      spawnParticles(m.x, m.y, 16, { color: "#c8a878", spread: 3.2, size: 2.4, life: 500, grav: 3, riseBias: 1.4 });
    } else if (m.style === "judgment") {
      shake(8, 220);
      spawnParticles(m.x, m.y, 14, { color: "#fff2b0", spread: 3, size: 1.8, life: 420, grav: 0.5, riseBias: 0.2 });
    }
  } else if (m.k === "heal") {
    const E = S.ents.get(m.i);
    if (E)
      S.fx.push({ k: "heal", ent: m.i, t0: t, dur: 700 });
  } else if (m.k === "level") {
    S.fx.push({ k: "level", ent: m.i, t0: t, dur: 1100 });
    if (m.i === S.myId)
      toast("¡Subiste de nivel!");
  } else if (m.k === "recall") {
    S.fx.push({ k: "recall", ent: m.i, t0: t, dur: 650 });
  }
  if (window.AOTAudio) AOTAudio.onFx(m);
}
var AOE_COLOR = {
  cleave: "#e8c470",
  nova: "#8ad4ff",
  meteor: "#ff7a30",
  volley: "#b9e08a",
  slam: "#d8c8a8",
  holy: "#fff0a0",
  cry: "#ff5e4a",
  titan: "#ff6a2a",
  judgment: "#ffe28a"
};

function drawPortals(t) {
  if (!S.map || !S.you || !S.you.visitedZones) return;
  const pts = {
    helike: { x: 30.5, y: 82 },
    olivares: { x: 62.5, y: 82 },
    argos: { x: 98.5, y: 78 },
    gorgona: { x: 128.5, y: 72 },
    ciclope: { x: 142.5, y: 108 },
    asfodelos: { x: 132.5, y: 44 },
    hidra: { x: 170.5, y: 79.5 },
  };
  for (const id of S.you.visitedZones) {
    const p = pts[id];
    if (!p) continue;
    const sx = w2sx(p.x), sy = w2sy(p.y);
    if (sx < -40 || sy < -40 || sx > VW + 40 || sy > VH + 40) continue;
    const pulse = 0.5 + Math.sin(t * 0.005 + p.x) * 0.3;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.fillStyle = "#8a6cff";
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d8c8ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -2, 3 + pulse * 1.5, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFx(t) {
  for (let i = S.fx.length - 1;i >= 0; i--) {
    const f = S.fx[i];
    const p = (t - f.t0) / f.dur;
    if (p >= 1) {
      S.fx.splice(i, 1);
      continue;
    }
    if (f.k === "proj") {
      const x = lerp(f.from.x, f.to.x, p), y = lerp(f.from.y, f.to.y, p);
      const sx = w2sx(x), sy = w2sy(y) - 10;
      const ang = Math.atan2(f.to.y - f.from.y, f.to.x - f.from.x);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      if (f.style === "arrow") {
        ctx.strokeStyle = "#e0d6c0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
        ctx.fillStyle = "#e0d6c0";
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(3, -2.5);
        ctx.lineTo(3, 2.5);
        ctx.closePath();
        ctx.fill();
      } else if (f.style === "fire") {
        ctx.fillStyle = "rgba(255,150,40,.35)";
        ctx.beginPath();
        ctx.arc(-6, 0, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#ff8a2a";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.arc(1, 0, 2, 0, 7);
        ctx.fill();
      } else if (f.style === "holy") {
        ctx.fillStyle = "rgba(255,240,160,.35)";
        ctx.beginPath();
        ctx.arc(-5, 0, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff4b0";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(1, 0, 1.8, 0, 7);
        ctx.fill();
      } else {
        ctx.fillStyle = "#8ad46a";
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, 2.6, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(138,212,106,.4)";
        ctx.beginPath();
        ctx.arc(-5, 0, 2, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    } else if (f.k === "slash") {
      const ang = Math.atan2(f.ty - f.y, f.tx - f.x);
      const wx = lerp(f.x, f.tx, 0.38), wy = lerp(f.y, f.ty, 0.38);
      const sx = w2sx(wx), sy = w2sy(wy) - 18;
      const R = 23, WBAND = 9, ARC = 0.6, SWEEP = 2;
      const q = clamp(p / 0.65, 0, 1);
      const fade = 1 - clamp((p - 0.55) / 0.45, 0, 1);
      const cur = ang - SWEEP / 2 + SWEEP * q;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = fade;
      for (let g = 3;g >= 1; g--) {
        ctx.save();
        ctx.rotate(cur - g * 0.17);
        ctx.fillStyle = `rgba(230,236,255,${0.09 * g})`;
        ctx.beginPath();
        ctx.arc(0, 0, R, -ARC, ARC);
        ctx.arc(0, 0, R - WBAND, ARC, -ARC, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.rotate(cur);
      ctx.fillStyle = "rgba(235,240,255,.92)";
      ctx.beginPath();
      ctx.arc(0, 0, R, -ARC, ARC);
      ctx.arc(0, 0, R - WBAND, ARC, -ARC, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, R, -ARC, ARC);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(Math.cos(ARC) * R, Math.sin(ARC) * R, 2.8, 0, 7);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    } else if (f.k === "aoe") {
      const sx = w2sx(f.x), sy = w2sy(f.y);
      const col = AOE_COLOR[f.style] || "#fff";
      const R = f.r * TILE * (f.style === "meteor" ? 1 : p);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      if (f.style === "meteor") {
        if (p < 0.4) {
          const fy = sy - (1 - p / 0.4) * 260;
          ctx.fillStyle = "#ff7a30";
          ctx.beginPath();
          ctx.arc(sx, fy, 8, 0, 7);
          ctx.fill();
          ctx.fillStyle = "rgba(255,170,60,.4)";
          ctx.beginPath();
          ctx.arc(sx, fy + 12, 6, 0, 7);
          ctx.fill();
        } else {
          const q = (p - 0.4) / 0.6;
          ctx.strokeStyle = col;
          ctx.lineWidth = 4 * (1 - q);
          ctx.beginPath();
          ctx.ellipse(sx, sy, f.r * TILE * q, f.r * TILE * q * 0.55, 0, 0, 7);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,122,48,${0.35 * (1 - q)})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy, f.r * TILE * q * 0.8, f.r * TILE * q * 0.45, 0, 0, 7);
          ctx.fill();
        }
      } else if (f.style === "slam") {
        ctx.strokeStyle = col;
        ctx.lineWidth = 5 * (1 - p);
        ctx.beginPath();
        ctx.ellipse(sx, sy, R, R * 0.55, 0, 0, 7);
        ctx.stroke();
        ctx.strokeStyle = "rgba(150,130,100,.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, R * 0.7, R * 0.38, 0, 0, 7);
        ctx.stroke();
      } else if (f.style === "judgment") {
        // Zeus judgment: local lightning storm around caster (NOT a directed bolt).
        const rad = f.r * TILE;
        ctx.fillStyle = `rgba(255,240,180,${0.22 * (1 - p)})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rad * Math.min(1, p * 1.6), rad * Math.min(1, p * 1.6) * 0.55, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,226,138,${0.9 * (1 - p)})`;
        ctx.lineWidth = 3 * (1 - p);
        ctx.beginPath();
        ctx.ellipse(sx, sy, rad * Math.min(1, 0.35 + p), rad * Math.min(1, 0.35 + p) * 0.55, 0, 0, 7);
        ctx.stroke();
        const bolts = 5;
        for (let b = 0; b < bolts; b++) {
          const seed = (f.t0 * 0.001 + b * 1.7) % 1;
          const ang = seed * Math.PI * 2;
          const dist = rad * (0.15 + (seed * 7 % 1) * 0.7);
          const bx = sx + Math.cos(ang) * dist;
          const by = sy + Math.sin(ang) * dist * 0.55;
          const rise = 90 + (b % 3) * 28;
          const fade = p < 0.7 ? 1 - p * 0.3 : Math.max(0, 1 - (p - 0.7) / 0.3);
          ctx.globalAlpha = fade;
          ctx.strokeStyle = b % 2 ? "#fff8d0" : "#ffe28a";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(bx, by - rise);
          ctx.lineTo(bx + 6, by - rise * 0.55);
          ctx.lineTo(bx - 5, by - rise * 0.35);
          ctx.lineTo(bx + 3, by - 8);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.55 * fade})`;
          ctx.beginPath();
          ctx.arc(bx, by, 3.5, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1 - p;
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 3.5 * (1 - p);
        ctx.beginPath();
        ctx.ellipse(sx, sy, R, R * 0.55, 0, 0, 7);
        ctx.stroke();
        if (f.style === "nova") {
          ctx.strokeStyle = "rgba(200,240,255,.6)";
          ctx.beginPath();
          ctx.ellipse(sx, sy, R * 0.8, R * 0.44, 0, 0, 7);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (f.k === "heal" || f.k === "level" || f.k === "recall") {
      const E = S.ents.get(f.ent);
      if (!E) {
        S.fx.splice(i, 1);
        continue;
      }
      const sx = w2sx(E.rx), sy = w2sy(E.ry);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      if (f.k === "heal") {
        ctx.fillStyle = "#8fd18a";
        for (let j = 0;j < 5; j++) {
          const a = j * 1.26 + f.t0;
          ctx.fillRect(sx + Math.cos(a) * 12, sy - 8 - p * 26 + Math.sin(a) * 4, 3, 3);
        }
      } else if (f.k === "level") {
        ctx.strokeStyle = "#ffd94a";
        ctx.lineWidth = 3 * (1 - p);
        ctx.beginPath();
        ctx.ellipse(sx, sy + 8, 30 * p + 4, 12 * p + 2, 0, 0, 7);
        ctx.stroke();
        ctx.fillStyle = "#ffe89a";
        for (let j = 0;j < 8; j++) {
          const a = j * 0.785;
          const rr = 6 + p * 34;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * rr, sy - 6 - p * 30 + Math.sin(a) * rr * 0.4, 2.2 * (1 - p), 0, 7);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = `rgba(150,210,255,${1 - p})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 6, 24 * (1 - p) + 3, 11 * (1 - p) + 1.5, 0, 0, 7);
        ctx.stroke();
        ctx.fillStyle = "#cfeeff";
        for (let j = 0;j < 6; j++) {
          const a = j * 1.05 + p * 4;
          const rr = 20 * (1 - p);
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * rr, sy - 4 - p * 10 + Math.sin(a) * rr * 0.4, 1.8, 0, 7);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}
function drawFloats(t) {
  ctx.textAlign = "center";
  for (let i = S.floats.length - 1;i >= 0; i--) {
    const F = S.floats[i];
    const p = (t - F.t0) / 900;
    if (p >= 1) {
      S.floats.splice(i, 1);
      continue;
    }
    const sx = w2sx(F.x), sy = w2sy(F.y) - p * 34;
    ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
    const size = F.size * (F.crit && p < 0.2 ? 1 + (0.2 - p) * 2.5 : 1);
    ctx.font = `${F.crit ? "bold " : ""}${size | 0}px Georgia`;
    ctx.fillStyle = "#000";
    ctx.fillText(F.txt, sx + 1.5, sy + 1.5);
    ctx.fillStyle = F.color;
    ctx.fillText(F.txt, sx, sy);
  }
  ctx.globalAlpha = 1;
}
function updateReviveCountdown() {
  const el = $("reviveCountdown");
  if (!el) return;
  if (!S.dead || !S.reviveAt) {
    el.textContent = "";
    return;
  }
  const secs = Math.max(0, Math.ceil((S.reviveAt - Date.now()) / 1000));
  el.textContent = secs > 0 ? t("death.countdown", secs) : t("death.countdownNow");
}

function updateTargetFrame() {
  const tf = $("targetFrame");
  const E = S.targetId ? S.ents.get(S.targetId) : null;
  if (!isEnemyEnt(E, S.targetId) || E.h <= 0) {
    if (!tf.classList.contains("hidden")) tf.classList.add("hidden");
    return;
  }
  tf.classList.remove("hidden");
  $("targetName").textContent = `${E.n || E.k} · Nv ${E.l}`;
  $("targetName").classList.toggle("boss", BOSS_KINDS.has(E.k));
  $("targetFill").style.width = Math.max(0, 100 * E.h / (E.H || 1)) + "%";
}
function isEnemyEnt(E, id) {
  return E && !E.dieT && id !== S.myId && !PLAYER_KINDS[E.k] && !NPC_KINDS[E.k];
}
function nearestEnemy(maxR) {
  let best = 0, bestD = maxR;
  const me = S.ents.get(S.myId);
  if (!me) return 0;
  for (const [id, E] of S.ents) {
    if (!isEnemyEnt(E, id)) continue;
    const d = Math.hypot(E.rx - me.rx, E.ry - me.ry);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}
function setAutoAtk(on) {
  S.autoAtk = !!on;
  try { localStorage.setItem("aot_autoatk", S.autoAtk ? "1" : "0"); } catch (_) {}
  const btn = $("xpBar");
  if (btn) {
    btn.classList.toggle("on", S.autoAtk);
    btn.setAttribute("aria-pressed", S.autoAtk ? "true" : "false");
    btn.title = S.autoAtk ? t("hud.autoatk.on") : t("hud.autoatk.off");
  }
  if (!S.autoAtk) {
    S.targetId = 0;
    send({ t: "attack", id: 0 });
  } else {
    S.autoAtkAt = 0; // force retarget next tick
  }
}
function tickAutoAtk(t) {
  if (!S.autoAtk || !S.loggedIn || S.dead || !S.map) return;
  // A pending loot-fetch (click on ground item) must win over auto-attack —
  // otherwise this retargets onto a nearby enemy every 250ms and the
  // character never walks over to pick the item up.
  if (S.lootTarget && S.loot.has(S.lootTarget)) return;
  // Don't fight the WASD cancel — wait until the player stops steering.
  if (S.dir.x || S.dir.y) return;
  if (t - S.autoAtkAt < 250) return;
  S.autoAtkAt = t;
  const cur = S.targetId ? S.ents.get(S.targetId) : null;
  if (isEnemyEnt(cur, S.targetId)) {
    // Stick while current is alive; retarget only if something is clearly closer.
    const me = S.ents.get(S.myId);
    if (me) {
      const curD = Math.hypot(cur.rx - me.rx, cur.ry - me.ry);
      const nearer = nearestEnemy(Math.max(2.5, curD - 1.5));
      if (nearer && nearer !== S.targetId) {
        S.targetId = nearer;
        send({ t: "attack", id: nearer });
      }
    }
    return;
  }
  const id = nearestEnemy(20);
  if (id) {
    S.targetId = id;
    send({ t: "attack", id });
  }
}

var _lastFrameT = 0;
var _dustAt = 0;
function frame() {
  
(function initWorldMapUi() {
  const cv = $("worldMap");
  if (cv) {
    cv.addEventListener("click", (e) => {
      if (!S.loggedIn || !S.map || S.dead) return;
      const w = worldMapEventToWorld(e);
      if (!w) return;
      if (e.shiftKey) setPersonalWaypoint(w.x, w.y);
      else sendPartyPing(w.x, w.y);
    });
  }
  const clr = $("waypointClearBtn");
  if (clr) clr.addEventListener("click", () => {
    saveWaypoint(null);
    toast(t("waypoint.cleared"));
    drawWorldMap();
  });
  document.querySelectorAll('[data-close="worldMapPanel"]').forEach((x) => {
    x.addEventListener("click", () => $("worldMapPanel").classList.add("hidden"));
  });
})();

requestAnimationFrame(frame);
  const t = now();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!S.loggedIn || !S.map) {
    return;
  }
  const dt = Math.min(0.05, Math.max(0, (t - (_lastFrameT || t)) / 1000));
  _lastFrameT = t;
  tickAutoAtk(t);
  tickAutoPotion(t);
  const rt = t - INTERP_DELAY;
  for (const [, E] of S.ents)
    sampleEnt(E, rt);
  const me = S.ents.get(S.myId);
  if (me) {
    S.cam.x = me.rx;
    S.cam.y = me.ry;
  }
  const curZone = me ? zoneAt(me.rx, me.ry) : null;
  applyShake();
  updateParticles(t, dt);
  ctx.fillStyle = "#12100b";
  ctx.fillRect(0, 0, VW, VH);
  drawTiles(t, curZone);
  drawLoot(t);
  drawPortals(t);
  if (t - _dustAt > 180 && S.particles.length < 260) {
    _dustAt = t;
    const dx = S.cam.x + (Math.random() - 0.5) * (VW / TILE + 4);
    const dy = S.cam.y + (Math.random() - 0.5) * (VH / TILE + 4);
    S.particles.push({
      x: dx, y: dy,
      vx: (Math.random() - 0.5) * 0.15, vy: -0.06 - Math.random() * 0.1,
      t0: t, life: 3200 + Math.random() * 2200,
      size: 0.7 + Math.random() * 0.7,
      color: "rgba(220,208,176,.4)", grav: 0,
    });
  }
  const list = [...S.ents.values()].sort((a, b) => a.ry - b.ry);
  for (const E of list)
    drawEntity(E, t);
  drawFx(t);
  drawParticles(t);
  drawFloats(t);
  // Party pings as world rings (same markers shown on the minimap).
  for (const P of S.pings) {
    const age = t - P.t0;
    if (age > 6000) continue;
    const a = 1 - age / 6000;
    const sx = w2sx(P.x), sy = w2sy(P.y);
    const rad = 10 + (age / 6000) * 28;
    ctx.strokeStyle = `rgba(80,210,255,${0.25 + a * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, 7);
    ctx.stroke();
    ctx.fillStyle = `rgba(180,240,255,${a})`;
    ctx.font = "12px Georgia,serif";
    ctx.textAlign = "center";
    ctx.fillText(P.from, sx, sy - rad - 4);
    ctx.textAlign = "left";
  }
  if (me) {
    // Warm torchlight pool around the local hero — cozier readout in dark zones.
    const psx = w2sx(me.rx), psy = w2sy(me.ry);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lg = ctx.createRadialGradient(psx, psy, 0, psx, psy, 160);
    lg.addColorStop(0, "rgba(255,196,110,.09)");
    lg.addColorStop(1, "rgba(255,196,110,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(psx - 160, psy - 160, 320, 320);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.38, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(8,5,2,.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);
  updateHover();
  updateTargetFrame();
  updateReviveCountdown();
  drawOrbs(t);
  drawSkillCooldowns(t);
  drawMinimapDots();
  checkZone(curZone);
  if (t - S.chatIdleT > 8000)
    $("chatLog").classList.add("idle");
}
function entRadius(E) {
  return BOSS_KINDS.has(E.k) ? 1.4 : 0.7;
}
function pickAt(wx, wy) {
  const mobile = typeof isMobileUi === "function" && isMobileUi();
  // Fat-finger friendly loot radius on phones; desktop stays precise.
  const lootR = mobile ? 1.55 : 0.6;
  let bestE = 0, bestED = 1e9;
  for (const [id, E] of S.ents) {
    if (id === S.myId || E.dieT)
      continue;
    const d = Math.hypot(E.rx - wx, E.ry - (wy + 0.3));
    const r = entRadius(E) * (mobile ? 1.25 : 1);
    if (d < r && d < bestED) {
      bestED = d;
      bestE = id;
    }
  }
  let bestL = 0, bestLD = 1e9;
  for (const [id, L] of S.loot) {
    const d = Math.hypot(L.x - wx, L.y - wy);
    if (d < lootR && d < bestLD) {
      bestLD = d;
      bestL = id;
    }
  }
  // On mobile, prefer ground loot when both are under the finger so gear is easy to grab.
  if (mobile && bestL && bestE && bestLD <= Math.max(1.1, bestED + 0.15)) {
    return { ent: 0, loot: bestL };
  }
  return { ent: bestE, loot: bestL };
}
function updateHover() {
  if (!S.mouse.in) {
    // Note: do NOT hideTooltip() here. The canvas fires "mouseleave" (mouse.in=false)
    // any time the pointer moves onto an overlapping DOM panel (inventory/shop/etc.),
    // which runs every animation frame while hovering those panels and would fight
    // with their own per-slot showTooltip()/hideTooltip() listeners, blanking item
    // stat tooltips almost as soon as they appear.
    S.hoverId = 0;
    S.hoverLoot = 0;
    return;
  }
  S.mouse.wx = s2wx(S.mouse.x);
  S.mouse.wy = s2wy(S.mouse.y);
  const p = pickAt(S.mouse.wx, S.mouse.wy);
  S.hoverId = p.ent;
  S.hoverLoot = p.loot;
  const E = S.ents.get(p.ent);
  canvas.className = "";
  if (p.loot) {
    canvas.classList.add("hover-loot");
    const L = S.loot.get(p.loot);
    if (L) showTooltip({ clientX: S.mouse.x, clientY: S.mouse.y }, L, "Clic para recoger");
  } else {
    hideTooltip();
    if (E) canvas.classList.add(NPC_KINDS[E.k] ? "hover-talk" : "hover-attack");
  }
}
canvas.addEventListener("mousemove", (e) => {
  S.mouse.x = e.clientX;
  S.mouse.y = e.clientY;
  S.mouse.in = true;
});
canvas.addEventListener("mouseleave", () => {
  S.mouse.in = false;
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || S.dead)
    return;
  handleWorldPointer(e.clientX, e.clientY);
});
canvas.addEventListener("touchstart", (e) => {
  if (S.dead || e.touches.length !== 1) return;
  S._touchTap = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
canvas.addEventListener("touchend", (e) => {
  if (S.dead || !S._touchTap || S._joyDrag) { S._touchTap = null; return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - S._touchTap.x, dy = t.clientY - S._touchTap.y;
  const tap = S._touchTap; S._touchTap = null;
  if (!tap || Math.hypot(dx, dy) > 28 || Date.now() - tap.t > 750) return;
  e.preventDefault();
  handleWorldPointer(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
// Rank of the active tree node backing skill n; skill 1 is the baseline skill
// (always castable), and classes without a node for n fall back to available.
function activeNodeRank(n) {
  if (n === 1) return 1;
  const node = S.abilityTree.find((a) => a.kind === "active" && a.skillN === n);
  if (!node) return 1;
  return (S.you && S.you.abilities && S.you.abilities[node.id]) || 0;
}
// Loadout maps skill-bar slots 1-4 -> equipped SkillDef.n; resolve either way
// since the bar's DOM data-n is now a fixed SLOT, not the skillN itself.
function slotForSkill(n) {
  const i = S.loadout.indexOf(n);
  return i >= 0 ? i + 1 : null;
}
function skillBarEl(n) {
  const slot = slotForSkill(n);
  return slot ? document.querySelector(`.skill[data-n="${slot}"]`) : null;
}
function castSkill(n) {
  const sk = S.skills.find((s) => s.n === n);
  if (!sk || S.dead)
    return;
  const el = skillBarEl(n);
  const t = now();
  const deny = () => {
    if (!el) return;
    el.classList.remove("deny");
    el.offsetWidth;
    el.classList.add("deny");
  };
  if (S.you && S.you.lvl < sk.unlock) {
    deny();
    return;
  }
  if (activeNodeRank(n) < 1) {
    deny();
    toast((I18N[getLang()] || I18N.es)["ability.needNode"]);
    return;
  }
  // Already cooling down: keep remaining time — never restart the countdown.
  if ((S.cds[n] || 0) > t) {
    deny();
    return;
  }
  S.lastSkill = n;
  S.lastSkillT = t;
  S.lastSkillPrevCd = S.cds[n] || 0;
  if (window.AOTAudio) AOTAudio.sfx("ui");
  // Self / missing-kind: always cast on self (never aim with stale touch coords).
  // Cleric ultimates & heals are self-AoE even if an old cache drops `kind`.
  const kind = sk.kind || (S.myCls === "cleric" || S.myCls === "warrior" ? "self" : "point");
  if (kind === "self")
    send({ t: "skill", n });
  else if (kind === "target") {
    const id = S.hoverId && !NPC_KINDS[(S.ents.get(S.hoverId) || {}).k] && !PLAYER_KINDS[(S.ents.get(S.hoverId) || {}).k] ? S.hoverId : S.targetId;
    if (!id) {
      toast("Sin objetivo");
      deny();
      return;
    }
    send({ t: "skill", n, id });
  } else {
    // Ground-targeted: prefer last world pointer, else camera center.
    let wx = S.mouse.wx, wy = S.mouse.wy;
    if (!S.mouse.in && S._lastWorld) { wx = S._lastWorld.x; wy = S._lastWorld.y; }
    if (!(wx || wy) && S.ents.get(S.myId)) { wx = S.ents.get(S.myId).rx; wy = S.ents.get(S.myId).ry; }
    send({ t: "skill", n, x: wx, y: wy });
  }
  // Optimistic CD only for a fresh cast; rolled back if server rejects via toast.
  S.cds[n] = t + sk.cd;
}
var LS_AUTOLOOT = "aot_autoloot";
var LS_AUTOPOTION = "aot_autopotion";
var LS_LOOTLOG = "aot_lootlog";
var LS_COMBATLOG = "aot_combatlog";
var LS_METER = "aot_meter";
var LS_FPS = "aot_fps";
var LS_WAYPOINT = "aot_waypoint";
function loadAutoLoot() {
  try {
    const v = localStorage.getItem(LS_AUTOLOOT);
    S.autoLoot = v === "all" || v === "magic" || v === "rare" ? v : "off";
  } catch (e) { S.autoLoot = "off"; }
}
function loadAutoPotion() {
  try {
    const v = localStorage.getItem(LS_AUTOPOTION);
    S.autoPotion = v === "on" || v === "hp" ? v : "off";
  } catch (e) { S.autoPotion = "off"; }
}
function loadLogPanels() {
  try {
    S.showLootLog = localStorage.getItem(LS_LOOTLOG) !== "0";
    S.showCombatLog = localStorage.getItem(LS_COMBATLOG) === "1";
    S.showMeter = localStorage.getItem(LS_METER) !== "0";
    S.showFps = localStorage.getItem(LS_FPS) === "1";
  } catch (e) {
    S.showLootLog = true;
    S.showCombatLog = false;
    S.showMeter = true;
    S.showFps = false;
  }
}
function loadWaypoint() {
  try {
    const raw = localStorage.getItem(LS_WAYPOINT);
    if (!raw) { S.waypoint = null; return; }
    const o = JSON.parse(raw);
    if (o && typeof o.x === "number" && typeof o.y === "number") S.waypoint = { x: o.x, y: o.y };
    else S.waypoint = null;
  } catch (e) { S.waypoint = null; }
}
function saveWaypoint(wp) {
  S.waypoint = wp;
  try {
    if (wp) localStorage.setItem(LS_WAYPOINT, JSON.stringify(wp));
    else localStorage.removeItem(LS_WAYPOINT);
  } catch (e) {}
}
function setPersonalWaypoint(x, y) {
  if (!S.map) return;
  const nx = Math.max(0.5, Math.min(S.map.w - 0.5, x));
  const ny = Math.max(0.5, Math.min(S.map.h - 0.5, y));
  if (S.waypoint && Math.hypot(S.waypoint.x - nx, S.waypoint.y - ny) < 3) {
    saveWaypoint(null);
    toast(t("waypoint.cleared"));
  } else {
    saveWaypoint({ x: nx, y: ny });
    toast(t("waypoint.set"));
  }
  drawWorldMap();
}
var RARITY_RANK = { common: 0, magic: 1, rare: 2 };
function lootMatchesAutoFilter(item) {
  if (S.autoLoot === "off") return false;
  if (S.autoLoot === "all") return true;
  const need = S.autoLoot === "rare" ? RARITY_RANK.rare : RARITY_RANK.magic;
  return (RARITY_RANK[item.rarity] ?? 0) >= need;
}
function syncMenuControls() {
  const vm = $("volMusic"), vf = $("volFx"), lang = $("langSelect"), al = $("autoLootSelect"), ap = $("autoPotionSelect");
  const ll = $("optLootLog"), cl = $("optCombatLog"), fp = $("optFps");
  if (window.AOTAudio) {
    if (vm) vm.value = Math.round((AOTAudio.musicVol ?? 1) * 100);
    if (vf) vf.value = Math.round((AOTAudio.sfxVol ?? 1) * 100);
  }
  if (lang) lang.value = getLang();
  if (al) al.value = S.autoLoot;
  if (ap) ap.value = S.autoPotion;
  if (ll) ll.checked = Boolean(S.showLootLog);
  if (cl) cl.checked = Boolean(S.showCombatLog);
  const mt0 = $("optMeter");
  if (mt0) mt0.checked = Boolean(S.showMeter);
  if (fp) fp.checked = Boolean(S.showFps);
  const fh = $("fpsHud");
  if (fh) fh.classList.toggle("hidden", !S.showFps);
}
function logout() {
  try { localStorage.removeItem("aot_creds"); } catch (e) {}
  S.wantReconnect = false;
  if (S.ws) { try { S.ws.close(); } catch (e) {} }
  location.reload();
}
function initMenu() {
  loadAutoLoot();
  loadAutoPotion();
  loadLogPanels();
  loadWaypoint();
  document.querySelectorAll(".menu-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".menu-tab").forEach((b) => b.classList.toggle("sel", b === btn));
      const target = btn.dataset.tab;
      ["menuHelp", "menuOptions"].forEach((id) => $(id).classList.toggle("hidden", id !== target));
    });
  });
  const vm = $("volMusic"), vf = $("volFx"), lang = $("langSelect"), logoutBtn = $("logoutBtn"), al = $("autoLootSelect"), ap = $("autoPotionSelect");
  if (vm) vm.addEventListener("input", () => { if (window.AOTAudio) AOTAudio.setMusicVolume(vm.value / 100); });
  if (vf) vf.addEventListener("input", () => {
    if (window.AOTAudio) { AOTAudio.setSfxVolume(vf.value / 100); AOTAudio.sfx("ui"); }
  });
  if (lang) lang.addEventListener("change", () => applyLang(lang.value));
  if (al) al.addEventListener("change", () => {
    S.autoLoot = al.value;
    try { localStorage.setItem(LS_AUTOLOOT, S.autoLoot); } catch (e) {}
  });
  if (ap) ap.addEventListener("change", () => {
    S.autoPotion = ap.value;
    try { localStorage.setItem(LS_AUTOPOTION, S.autoPotion); } catch (e) {}
  });
  const ll = $("optLootLog"), cl = $("optCombatLog"), mt = $("optMeter");
  if (ll) ll.addEventListener("change", () => {
    S.showLootLog = Boolean(ll.checked);
    try { localStorage.setItem(LS_LOOTLOG, S.showLootLog ? "1" : "0"); } catch (e) {}
    renderLootLog();
  });
  if (cl) cl.addEventListener("change", () => {
    S.showCombatLog = Boolean(cl.checked);
    try { localStorage.setItem(LS_COMBATLOG, S.showCombatLog ? "1" : "0"); } catch (e) {}
    renderCombatLog();
  });
  if (mt) mt.addEventListener("change", () => {
    S.showMeter = Boolean(mt.checked);
    try { localStorage.setItem(LS_METER, S.showMeter ? "1" : "0"); } catch (e) {}
    renderMeter();
  });
  const fp = $("optFps");
  if (fp) fp.addEventListener("change", () => {
    S.showFps = Boolean(fp.checked);
    try { localStorage.setItem(LS_FPS, S.showFps ? "1" : "0"); } catch (e) {}
    const fh = $("fpsHud");
    if (fh) fh.classList.toggle("hidden", !S.showFps);
  });
  if (logoutBtn) logoutBtn.addEventListener("click", () => logout());
  syncMenuControls();
  applyLang(getLang());
  renderLootLog();
  renderCombatLog();
}
var PANEL_ORDER = ["worldMapPanel", "dialogPanel", "shopPanel", "stashPanel", "petPanel", "invPanel", "charPanel", "questPanel", "menuPanel", "boardPanel", "abilityPanel", "achPanel", "whoPanel", "inspectPanel"];
function closeTopPanel() {
  for (const id of PANEL_ORDER) {
    const el = $(id);
    if (!el.classList.contains("hidden")) {
      el.classList.add("hidden");
      if (id === "shopPanel") {
        S.shopOpen = false;
        renderInventory();
      }
      if (id === "stashPanel") {
        S.stashOpen = false;
        renderInventory();
      }
      return true;
    }
  }
  return false;
}
// NPC-interaction panels: only one of these should ever be open at a time,
// and moving with WASD closes whichever is open (unlike invPanel/charPanel/
// abilityPanel/questPanel, which stay open while walking).
var CITY_PANELS = ["dialogPanel", "shopPanel", "stashPanel", "petPanel", "boardPanel"];
function closeCityPanels(except) {
  let changed = false;
  for (const id of CITY_PANELS) {
    if (id === except) continue;
    const el = $(id);
    if (el && !el.classList.contains("hidden")) {
      el.classList.add("hidden");
      changed = true;
    }
  }
  if (S.shopOpen && except !== "shopPanel") { S.shopOpen = false; changed = true; }
  if (S.stashOpen && except !== "stashPanel") { S.stashOpen = false; changed = true; }
  if (changed) renderInventory();
}
function togglePanel(id) {
  const el = $(id);
  if (!el) return;
  if (el.classList.contains("hidden")) {
    revealPanel(el);
  } else {
    el.classList.add("hidden");
  }
  if (id === "invPanel")
    renderInventory();
  if (id === "charPanel")
    renderChar();
  if (id === "questPanel")
    renderQuests();
  if (id === "abilityPanel")
    renderAbilities();
  if (id === "menuPanel" && !el.classList.contains("hidden"))
    syncMenuControls();
}
var MOVE_KEYS = {
  w: [0, -1],
  a: [-1, 0],
  s: [0, 1],
  d: [1, 0],
  arrowup: [0, -1],
  arrowleft: [-1, 0],
  arrowdown: [0, 1],
  arrowright: [1, 0]
};
function sendDir(force) {
  let x = 0, y = 0;
  if (S.joy && (Math.abs(S.joy.x) > 0.01 || Math.abs(S.joy.y) > 0.01)) {
    x = S.joy.x;
    y = S.joy.y;
  } else {
    for (const k in S.dirKeys) {
      const v = MOVE_KEYS[k];
      x += v[0];
      y += v[1];
    }
    x = Math.sign(x);
    y = Math.sign(y);
  }
  // Avoid spamming identical dirs; allow small analog drift threshold.
  if (!force && Math.abs(x - S.dir.x) < 0.04 && Math.abs(y - S.dir.y) < 0.04)
    return;
  S.dir = { x, y };
  send({ t: "dir", x, y });
}
function stopMove() {
  S.dirKeys = Object.create(null);
  S.joy = { x: 0, y: 0 };
  const knob = $("joyKnob");
  if (knob) { knob.style.transform = "translate(-50%,-50%)"; }
  sendDir(true);
}
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (MOVE_KEYS[k] && S.dirKeys[k]) {
    delete S.dirKeys[k];
    sendDir();
  }
});
window.addEventListener("blur", stopMove);
function quickPotion(icon, silent) {
  const inv = S.you && S.you.inv;
  if (!inv)
    return false;
  const slot = inv.findIndex((it) => it && it.icon === icon);
  if (slot < 0) {
    if (!silent) toast(icon === "potion_hp" ? "Sin pociones de vida" : "Sin pociones de maná");
    return false;
  }
  send({ t: "use", slot });
  return true;
}
var _autoPotAt = 0;
function tickAutoPotion(t) {
  if (S.autoPotion === "off" || S.dead || !S.you) return;
  if (t - _autoPotAt < 480) return;
  const y = S.you;
  if (S.autoPotion !== "mp" && y.mhp > 0 && y.hp / y.mhp <= 0.35) {
    if (quickPotion("potion_hp", true)) { _autoPotAt = t; return; }
  }
  if (S.autoPotion === "on" && y.mmp > 0 && y.mp / y.mmp <= 0.22) {
    if (quickPotion("potion_mp", true)) { _autoPotAt = t; return; }
  }
}
function updateStreakHud() {
  const el = $("streakHud");
  if (!el) return;
  if (S.streak >= 2) {
    el.textContent = `Racha ×${S.streak}`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}
function activeQuestTargets() {
  const y = S.you;
  const set = new Set();
  if (!y || !y.quests) return set;
  for (const qid in y.quests) {
    const q = y.quests[qid];
    const meta = QUEST_META[qid];
    if (!q || q.turned || q.done || !meta || !meta.target) continue;
    set.add(meta.target);
  }
  return set;
}
window.addEventListener("keydown", (e) => {
  if (!S.loggedIn)
    return;
  const chatFocused = document.activeElement === $("chatInput");
  const boardFocused = document.activeElement === $("boardInput");
  if (boardFocused) {
    if (e.key === "Escape") $("boardInput").blur();
    return; // let every other key (typing, Enter for newline, etc.) behave natively
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const inp = $("chatInput");
    if (chatFocused) {
      const txt = inp.value.trim().slice(0, 200);
      if (txt)
        send({ t: "chat", text: txt });
      inp.value = "";
      inp.blur();
      // On mobile keep the log open until user taps Chat again / Escape.
    } else {
      stopMove();
      if (isMobileUi()) setChatOpen(true);
      else inp.focus();
    }
    return;
  }
  if (chatFocused) {
    if (e.key === "Escape")
      $("chatInput").blur();
    return;
  }
  const mk = e.key.toLowerCase();
  if (MOVE_KEYS[mk] && !S.dead) {
    e.preventDefault();
    if (!S.dirKeys[mk]) {
      S.dirKeys[mk] = 1;
      S.targetId = 0; // WASD cancels attack lock (server clears atkTarget on dir)
      S.lootTarget = 0;
      closeCityPanels(); // walking away closes shop/stash/petshop/board/dialog, not inv/char/etc.
      sendDir();
    }
    return;
  }
  switch (e.key) {
    case "1":
    case "2":
    case "3":
    case "4": {
      const n = S.loadout[+e.key - 1];
      if (n) castSkill(n);
      break;
    }
    case "i":
    case "I":
      togglePanel("invPanel");
      break;
    case "c":
    case "C":
      togglePanel("charPanel");
      break;
    case "q":
    case "Q":
      if (!S.dead)
        quickPotion("potion_hp");
      break;
    case "e":
    case "E":
      if (!S.dead)
        quickPotion("potion_mp");
      break;
    case "l":
    case "L":
      togglePanel("questPanel");
      break;
    case "p":
    case "P":
      if (S.party.length) setPartyMinimized(!S.partyMinimized);
      break;
    case "h":
    case "H":
      togglePanel("abilityPanel");
      break;
    case "f":
    case "F":
      setAutoAtk(!S.autoAtk);
      break;
    case "g":
    case "G": {
      if (S.dead) break;
      const me = S.ents.get(S.myId);
      if (me) sendPartyPing(me.rx, me.ry);
      break;
    }
    case "m":
    case "M":
      toggleWorldMap();
      break;
    case "y":
    case "Y":
      togglePanel("achPanel");
      if (!$("achPanel").classList.contains("hidden")) renderAchs();
      break;
    case "o":
    case "O":
      toggleWhoPanel();
      break;
    case "n":
    case "N":
      if (!S.dead) send({ t: "fish" });
      break;
    case "b":
    case "B":
      if (!S.dead)
        send({ t: "recall" });
      break;
    case "Escape": {
      const anyOpen = PANEL_ORDER.some((id) => !$(id).classList.contains("hidden"))
        || !$("playerMenu").classList.contains("hidden")
        || !$("tooltip").classList.contains("hidden")
        || (isMobileUi() && $("chat").classList.contains("open"));
      closePlayerMenu();
      closeTopPanel();
      hideTooltip();
      setChatOpen(false);
      if (!anyOpen)
        togglePanel("menuPanel");
      break;
    }
  }
});
["invPanel", "shopPanel"].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener("mouseleave", hideTooltip);
});
document.querySelectorAll(".chat-tab").forEach((b) => {
  b.addEventListener("click", () => setChatTab(b.dataset.ch || "all"));
});
document.querySelectorAll(".who-tab").forEach((b) => {
  b.addEventListener("click", () => setWhoTab(b.dataset.who || "online"));
});
loadFriends();
document.querySelectorAll(".panel-x").forEach((x) => x.addEventListener("click", () => {
  const id = x.dataset.close;
  $(id).classList.add("hidden");
  if (id === "shopPanel") {
    S.shopOpen = false;
    renderInventory();
  }
  if (id === "stashPanel") {
    S.stashOpen = false;
    renderInventory();
  }
  hideTooltip();
}));
const respawnBtn = $("respawnBtn");
if (respawnBtn) respawnBtn.addEventListener("click", () => {
  stopMove();
  send({ t: "respawn" });
  // Keep overlay up until {t:"you"} confirms hp > 0 (avoids stuck-dead with no button
  // if the click raced a reconnect or the server rejected).
});
var hpOrbCtx = $("hpOrb")?.getContext("2d");
var mpOrbCtx = $("mpOrb")?.getContext("2d");
function drawOrb(g, frac, base, bright, t, label) {
  const W = 112, R = 50, cx = 56, cy = 56;
  g.clearRect(0, 0, W, W);
  g.fillStyle = "#171209";
  g.beginPath();
  g.arc(cx, cy, R + 4, 0, 7);
  g.fill();
  g.strokeStyle = "#4a3a1e";
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = "#8a6527";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, R + 5.5, 0, 7);
  g.stroke();
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, 7);
  g.clip();
  g.fillStyle = "#0c0906";
  g.fillRect(0, 0, W, W);
  const lvl = cy + R - frac * R * 2;
  g.fillStyle = base;
  g.beginPath();
  g.moveTo(0, W);
  g.lineTo(0, lvl);
  for (let x = 0;x <= W; x += 4) {
    g.lineTo(x, lvl + Math.sin(x / 13 + t / 420) * 2 + Math.sin(x / 7 - t / 300) * 1.2);
  }
  g.lineTo(W, W);
  g.closePath();
  g.fill();
  const gr = g.createRadialGradient(cx, cy + R * 0.4, 4, cx, cy + R * 0.4, R);
  gr.addColorStop(0, bright);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 0.5 * frac;
  g.fillStyle = gr;
  g.fillRect(0, lvl - 4, W, W - lvl + 4);
  g.globalAlpha = 1;
  g.fillStyle = "rgba(255,255,255,.13)";
  g.beginPath();
  g.ellipse(cx - 14, cy - 22, 18, 10, -0.5, 0, 7);
  g.fill();
  g.restore();
}
function drawOrbs(t) {
  if (!S.you)
    return;
  const me = S.ents.get(S.myId);
  const hp = me ? me.h : S.you.hp, mhp = S.you.mhp || 1;
  const mp = me && me.m !== undefined ? me.m : S.you.mp, mmp = S.you.mmp || 1;
  drawOrb(hpOrbCtx, clamp(hp / mhp, 0, 1), "#8c231a", "rgba(255,90,60,.9)", t);
  drawOrb(mpOrbCtx, clamp(mp / mmp, 0, 1), "#1e3f7a", "rgba(90,150,255,.9)", t);
  $("hpLabel").textContent = `${Math.max(0, Math.round(hp))} / ${mhp}`;
  $("mpLabel").textContent = `${Math.max(0, Math.round(mp))} / ${mmp}`;
}
function skillIcon(g, cls, n) {
  g.clearRect(0, 0, 52, 52);
  g.fillStyle = "#1d160c";
  g.fillRect(0, 0, 52, 52);
  const grad = g.createRadialGradient(26, 26, 4, 26, 26, 30);
  grad.addColorStop(0, "#33270f");
  grad.addColorStop(1, "#171209");
  g.fillStyle = grad;
  g.fillRect(1, 1, 50, 50);
  g.save();
  g.translate(26, 26);
  g.lineCap = "round";
  const key = cls + n;
  const G = {
    warrior1() {
      g.strokeStyle = "#e8c470";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 4, 15, -2.6, -0.5);
      g.stroke();
      g.strokeStyle = "#fff2cc";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 4, 15, -2.4, -0.7);
      g.stroke();
    },
    warrior2() {
      g.strokeStyle = "#ff5e4a";
      g.lineWidth = 2.5;
      for (let r = 5;r <= 17; r += 6) {
        g.beginPath();
        g.arc(0, 0, r, -0.8, 0.8);
        g.stroke();
      }
      g.fillStyle = "#ffd0b0";
      g.beginPath();
      g.arc(-8, 0, 4, 0, 7);
      g.fill();
    },
    warrior3() {
      g.strokeStyle = "#e8e0c8";
      g.lineWidth = 3;
      g.beginPath();
      for (let a = 0;a < 12; a += 0.3) {
        const r = 2 + a * 1.35;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8);
      }
      g.stroke();
    },
    warrior4() {
      // Titan rage: heavy X slash + ember core
      g.strokeStyle = "#ff6a2a";
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(-12, -12);
      g.lineTo(12, 12);
      g.moveTo(12, -12);
      g.lineTo(-12, 12);
      g.stroke();
      g.fillStyle = "#ffd0a0";
      g.beginPath();
      g.arc(0, 0, 5, 0, 7);
      g.fill();
      g.strokeStyle = "#ff9a4a";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 14, 0, 7);
      g.stroke();
    },
    hunter1() {
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-14, 10);
      g.lineTo(12, -10);
      g.stroke();
      g.fillStyle = "#e8f0d0";
      g.beginPath();
      g.moveTo(15, -12);
      g.lineTo(6, -9);
      g.lineTo(11, -4);
      g.closePath();
      g.fill();
    },
    hunter2() {
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 2;
      for (let i = -1;i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * 9 - 3, 12);
        g.lineTo(i * 9 + 3, -10);
        g.stroke();
        g.fillStyle = "#e8f0d0";
        g.beginPath();
        g.moveTo(i * 9 + 4, -13);
        g.lineTo(i * 9 - 1, -9);
        g.lineTo(i * 9 + 5, -7);
        g.closePath();
        g.fill();
      }
    },
    hunter3() {
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 2;
      for (let i = 0;i < 5; i++) {
        const x = -14 + i * 7;
        g.beginPath();
        g.moveTo(x + 3, -14);
        g.lineTo(x, 6 + i % 2 * 5);
        g.stroke();
      }
      g.strokeStyle = "#7a9c58";
      g.beginPath();
      g.arc(0, 13, 14, Math.PI, 0, true);
      g.stroke();
    },
    mage1() {
      g.fillStyle = "#ff8a2a";
      g.beginPath();
      g.arc(4, -2, 8, 0, 7);
      g.fill();
      g.fillStyle = "#ffe08a";
      g.beginPath();
      g.arc(6, -4, 3.5, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(255,150,60,.7)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-14, 12);
      g.lineTo(-2, 2);
      g.stroke();
    },
    mage2() {
      g.strokeStyle = "#8ad4ff";
      g.lineWidth = 2.5;
      for (let i = 0;i < 6; i++) {
        const a = i * 1.047;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        g.stroke();
        g.beginPath();
        g.moveTo(Math.cos(a) * 9 + Math.cos(a + 1.57) * 3, Math.sin(a) * 9 + Math.sin(a + 1.57) * 3);
        g.lineTo(Math.cos(a) * 9 - Math.cos(a + 1.57) * 3, Math.sin(a) * 9 - Math.sin(a + 1.57) * 3);
        g.stroke();
      }
    },
    mage3() {
      g.fillStyle = "#ff7a30";
      g.beginPath();
      g.arc(3, 3, 9, 0, 7);
      g.fill();
      g.fillStyle = "#ffcf90";
      g.beginPath();
      g.arc(6, 0, 4, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(255,140,60,.6)";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-15, -15);
      g.lineTo(-3, -3);
      g.stroke();
    },
    cleric1() {
      g.strokeStyle = "#f0e6a8";
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 2, 12, 0, 7);
      g.stroke();
      g.fillStyle = "#fff8d0";
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(3, -2);
      g.lineTo(11, -2);
      g.lineTo(4.5, 3);
      g.lineTo(7, 11);
      g.lineTo(0, 6);
      g.lineTo(-7, 11);
      g.lineTo(-4.5, 3);
      g.lineTo(-11, -2);
      g.lineTo(-3, -2);
      g.closePath();
      g.fill();
    },
    cleric2() {
      g.strokeStyle = "#f0e6a8";
      g.lineWidth = 2;
      for (let r = 5; r <= 15; r += 5) {
        g.beginPath();
        g.arc(0, 2, r, Math.PI * 0.15, Math.PI * 0.85);
        g.stroke();
      }
      g.fillStyle = "#fff8d0";
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(2.2, -2.5);
      g.lineTo(8, -2.5);
      g.lineTo(3.2, 1);
      g.lineTo(5, 7);
      g.lineTo(0, 3.5);
      g.lineTo(-5, 7);
      g.lineTo(-3.2, 1);
      g.lineTo(-8, -2.5);
      g.lineTo(-2.2, -2.5);
      g.closePath();
      g.fill();
    },
    cleric3() {
      g.strokeStyle = "#f0e6a8";
      g.lineWidth = 2;
      for (let r = 6; r <= 16; r += 5) {
        g.beginPath();
        g.arc(0, 0, r, 0, 7);
        g.stroke();
      }
      g.fillStyle = "#fff8d0";
      g.beginPath();
      g.arc(0, 0, 4, 0, 7);
      g.fill();
    },
    cleric4() {
      // Zeus judgment: bolt + flash
      g.strokeStyle = "#ffe28a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-2, -16);
      g.lineTo(4, -2);
      g.lineTo(-4, 0);
      g.lineTo(2, 16);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(0, -2, 3.5, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(255,226,138,.7)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        g.beginPath();
        g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
        g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        g.stroke();
      }
    },
    hunter4() {
      // Ártemis storm: converging arrows + wind rings
      g.strokeStyle = "rgba(150,220,190,.6)";
      g.lineWidth = 1.5;
      for (let r = 6; r <= 16; r += 5) {
        g.beginPath();
        g.arc(0, 0, r, 0, 7);
        g.stroke();
      }
      g.strokeStyle = "#e8f0d8";
      g.lineWidth = 2.2;
      for (let i = 0; i < 5; i++) {
        const a = -1.9 + i * 0.95;
        g.beginPath();
        g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
        g.lineTo(0, 3);
        g.stroke();
        g.beginPath();
        g.moveTo(0, 3);
        g.lineTo(Math.cos(a - 0.25) * 4 + Math.cos(a) * 8, Math.sin(a - 0.25) * 4 + Math.sin(a) * 8);
        g.moveTo(0, 3);
        g.lineTo(Math.cos(a + 0.25) * 4 + Math.cos(a) * 8, Math.sin(a + 0.25) * 4 + Math.sin(a) * 8);
        g.stroke();
      }
    },
    mage4() {
      // Arcane supernova: radiant burst core + shockwave rings
      const grad = g.createRadialGradient(0, 0, 1, 0, 0, 16);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#c9a8ff");
      grad.addColorStop(1, "rgba(140,80,220,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 16, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(230,200,255,.85)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        g.beginPath();
        g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
        g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
        g.stroke();
      }
    },
    warrior5() {
      // Embestida: forward lunge thrust with speed lines.
      g.strokeStyle = "#e8c470";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-14, 6);
      g.lineTo(10, -8);
      g.stroke();
      g.fillStyle = "#fff2cc";
      g.beginPath();
      g.moveTo(14, -12);
      g.lineTo(4, -10);
      g.lineTo(10, -2);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(232,196,112,.5)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-16, 10);
      g.lineTo(-6, 2);
      g.moveTo(-12, 13);
      g.lineTo(-2, 5);
      g.stroke();
    },
    warrior6() {
      // Golpe Sísmico: ground-crack half-rings + radiating fractures.
      g.strokeStyle = "#c8a878";
      g.lineWidth = 2.5;
      for (let r = 6; r <= 16; r += 5) {
        g.beginPath();
        g.arc(0, 8, r, Math.PI, 0);
        g.stroke();
      }
      g.strokeStyle = "#8a6a3a";
      g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + i * (Math.PI / 4);
        g.beginPath();
        g.moveTo(0, 8);
        g.lineTo(Math.cos(a) * 15, 8 + Math.sin(a) * 8);
        g.stroke();
      }
    },
    warrior7() {
      // Salto de Escudo: round shield with impact spikes.
      g.strokeStyle = "#cfd6de";
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 13, 0, 7);
      g.stroke();
      g.fillStyle = "#8a97a6";
      g.beginPath();
      g.arc(0, 0, 5, 0, 7);
      g.fill();
      g.strokeStyle = "#fff6d8";
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        g.beginPath();
        g.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
        g.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
        g.stroke();
      }
    },
    warrior8() {
      // Avatar de Ares: radiant war-god aura with a crown flame.
      const grad = g.createRadialGradient(0, 2, 1, 0, 2, 18);
      grad.addColorStop(0, "#fff2cc");
      grad.addColorStop(0.5, "#ff6a2a");
      grad.addColorStop(1, "rgba(255,60,20,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 2, 18, 0, 7);
      g.fill();
      g.strokeStyle = "#ffb060";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -16);
      g.lineTo(-4, -2);
      g.lineTo(4, -2);
      g.closePath();
      g.stroke();
    },
    warrior9() {
      // Grito Ancestral: deep crimson warcry rings.
      g.strokeStyle = "#c83a3a";
      g.lineWidth = 2;
      for (let r = 4; r <= 18; r += 4.5) {
        g.beginPath();
        g.arc(0, 0, r, -1.1, 1.1);
        g.stroke();
      }
      g.fillStyle = "#ffd0c0";
      g.beginPath();
      g.arc(-9, 0, 3, 0, 7);
      g.fill();
    },
    hunter5() {
      // Flecha Rápida: twin fast streak + arrowhead.
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-13, 8);
      g.lineTo(10, -9);
      g.stroke();
      g.strokeStyle = "rgba(185,224,138,.45)";
      g.beginPath();
      g.moveTo(-15, 3);
      g.lineTo(5, -12);
      g.stroke();
      g.fillStyle = "#e8f0d0";
      g.beginPath();
      g.moveTo(13, -11);
      g.lineTo(5, -8);
      g.lineTo(10, -3);
      g.closePath();
      g.fill();
    },
    hunter6() {
      // Trampa Punzante: bear-trap jaws with teeth.
      g.strokeStyle = "#8a9c6a";
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 3, 13, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      g.beginPath();
      g.arc(0, 3, 13, -Math.PI * 0.85, -Math.PI * 0.15);
      g.stroke();
      g.fillStyle = "#e8f0d0";
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(i * 5, -10);
        g.lineTo(i * 5 - 2, -4);
        g.lineTo(i * 5 + 2, -4);
        g.closePath();
        g.fill();
        g.beginPath();
        g.moveTo(i * 5, 16);
        g.lineTo(i * 5 - 2, 10);
        g.lineTo(i * 5 + 2, 10);
        g.closePath();
        g.fill();
      }
    },
    hunter7() {
      // Tiro de Halcón: diving wings + arrow.
      g.strokeStyle = "#e8f0d0";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-3, -14);
      g.quadraticCurveTo(-17, -6, -13, 6);
      g.stroke();
      g.beginPath();
      g.moveTo(3, -14);
      g.quadraticCurveTo(17, -6, 13, 6);
      g.stroke();
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(0, 13);
      g.stroke();
      g.fillStyle = "#e8f0d0";
      g.beginPath();
      g.moveTo(0, 16);
      g.lineTo(-4, 8);
      g.lineTo(4, 8);
      g.closePath();
      g.fill();
    },
    hunter8() {
      // Danza de Flechas: rotating spiral of arrows.
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        const r1 = 6, r2 = 17;
        g.beginPath();
        g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.lineTo(Math.cos(a + 0.6) * r2, Math.sin(a + 0.6) * r2);
        g.stroke();
        g.fillStyle = "#e8f0d0";
        const tx = Math.cos(a + 0.6) * r2, ty = Math.sin(a + 0.6) * r2;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(tx - Math.cos(a + 0.9) * 5, ty - Math.sin(a + 0.9) * 5);
        g.lineTo(tx - Math.cos(a + 0.3) * 5, ty - Math.sin(a + 0.3) * 5);
        g.closePath();
        g.fill();
      }
    },
    hunter9() {
      // Ojo de Águila: eye with crosshair.
      g.strokeStyle = "#e8f0d0";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(0, 0, 15, 8, 0, 0, 7);
      g.stroke();
      g.fillStyle = "#8a5a2a";
      g.beginPath();
      g.arc(0, 0, 6, 0, 7);
      g.fill();
      g.fillStyle = "#1d160c";
      g.beginPath();
      g.arc(0, 0, 3, 0, 7);
      g.fill();
      g.strokeStyle = "#b9e08a";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-19, 0);
      g.lineTo(-9, 0);
      g.moveTo(9, 0);
      g.lineTo(19, 0);
      g.moveTo(0, -13);
      g.lineTo(0, -9);
      g.moveTo(0, 9);
      g.lineTo(0, 13);
      g.stroke();
    },
    mage5() {
      // Chispa Arcana: small spark with radiating filaments.
      g.fillStyle = "#ff8a2a";
      g.beginPath();
      g.arc(0, 0, 5, 0, 7);
      g.fill();
      g.strokeStyle = "#ffe08a";
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        g.beginPath();
        g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
        g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        g.stroke();
      }
    },
    mage6() {
      // Cadena de Rayos: jagged branching bolt.
      g.strokeStyle = "#8ad4ff";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-14, -10);
      g.lineTo(-4, -2);
      g.lineTo(-8, 4);
      g.lineTo(2, 10);
      g.lineTo(-2, 14);
      g.stroke();
      g.strokeStyle = "#c8ecff";
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(-4, -2);
      g.lineTo(8, -8);
      g.moveTo(2, 10);
      g.lineTo(12, 6);
      g.stroke();
    },
    mage7() {
      // Muro Ígneo: row of flame tongues.
      for (let i = -2; i <= 2; i++) {
        const x = i * 7;
        g.fillStyle = i % 2 === 0 ? "#ff8a2a" : "#ff7a30";
        g.beginPath();
        g.moveTo(x, 14);
        g.quadraticCurveTo(x - 5, 0, x, -14);
        g.quadraticCurveTo(x + 5, 0, x, 14);
        g.fill();
      }
      g.fillStyle = "#ffe08a";
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.arc(i * 7, 2, 2, 0, 7);
        g.fill();
      }
    },
    mage8() {
      // Ira de Zeus: radiant burst with jagged bolts.
      const grad = g.createRadialGradient(0, 0, 1, 0, 0, 17);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#fff2b0");
      grad.addColorStop(1, "rgba(255,226,138,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 17, 0, 7);
      g.fill();
      g.strokeStyle = "#ffe28a";
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        g.beginPath();
        g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
        g.lineTo(Math.cos(a + 0.15) * 11, Math.sin(a + 0.15) * 11);
        g.lineTo(Math.cos(a - 0.1) * 17, Math.sin(a - 0.1) * 17);
        g.stroke();
      }
    },
    mage9() {
      // Colapso Estelar: converging rings around a stellar core.
      g.strokeStyle = "#c9d8ff";
      g.lineWidth = 1.5;
      for (let r = 16; r >= 4; r -= 4) {
        g.beginPath();
        g.arc(0, 0, r, 0, 7);
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(0, 0, 3, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(200,216,255,.6)";
      g.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        g.beginPath();
        g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        g.stroke();
      }
    },
    cleric5() {
      // Luz Menor: small light cross.
      g.strokeStyle = "#fff8d0";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(0, 10);
      g.moveTo(-8, 0);
      g.lineTo(8, 0);
      g.stroke();
      g.strokeStyle = "rgba(240,230,168,.4)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(0, 0, 13, 0, 7);
      g.stroke();
    },
    cleric6() {
      // Vendaje de Higía: crossed bandage bands.
      g.strokeStyle = "#e8dcae";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-13, -10);
      g.lineTo(13, 10);
      g.stroke();
      g.beginPath();
      g.moveTo(13, -10);
      g.lineTo(-13, 10);
      g.stroke();
      g.fillStyle = "#fff8d0";
      g.beginPath();
      g.arc(0, 0, 4, 0, 7);
      g.fill();
    },
    cleric7() {
      // Llama Purificadora: sacred flame with a small cross.
      g.fillStyle = "#ff8a2a";
      g.beginPath();
      g.moveTo(0, 14);
      g.quadraticCurveTo(-8, 0, 0, -14);
      g.quadraticCurveTo(8, 0, 0, 14);
      g.fill();
      g.strokeStyle = "#fff8d0";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -3);
      g.lineTo(0, 6);
      g.moveTo(-4, 1.5);
      g.lineTo(4, 1.5);
      g.stroke();
    },
    cleric8() {
      // Renacer de Asclepio: rod of Asclepius (staff + coiling serpent).
      g.strokeStyle = "#fff8d0";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(0, -15);
      g.lineTo(0, 15);
      g.stroke();
      g.strokeStyle = "#8ad46a";
      g.lineWidth = 2;
      g.beginPath();
      for (let t = -14; t <= 14; t += 1) {
        const x = Math.sin(t * 0.5) * 7;
        if (t === -14) g.moveTo(x, t); else g.lineTo(x, t);
      }
      g.stroke();
      g.fillStyle = "#fff8d0";
      g.beginPath();
      g.arc(0, -15, 3, 0, 7);
      g.fill();
    },
    cleric9() {
      // Ira Divina: golden radiant burst (pure damage, no heal glyph).
      g.strokeStyle = "#ffe28a";
      g.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        g.beginPath();
        g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
        g.stroke();
      }
      g.fillStyle = "#fff4c0";
      g.beginPath();
      g.arc(0, 0, 5, 0, 7);
      g.fill();
    }
  };
  (G[key] || (() => {}))();
  g.restore();
}
function buildSkillbar() {
  document.querySelectorAll(".skill").forEach((el) => {
    const slot = +el.dataset.n;
    const n = S.loadout[slot - 1];
    const sk = S.skills.find((s) => s.n === n);
    const cv = el.querySelector("canvas");
    if (!sk) {
      el.classList.add("hidden");
      el.onclick = null;
      return;
    }
    el.classList.remove("hidden");
    skillIcon(cv.getContext("2d"), S.myCls, n);
    el.querySelector(".cost").textContent = sk.cost;
    el.title = `${sk.name} — ${sk.desc} (${sk.cost} de maná, ${(sk.cd / 1000).toFixed(0)}s)`;
    el.onclick = () => castSkill(n);
  });
  refreshSkillLocks();
}
function refreshSkillLocks() {
  if (!S.you)
    return;
  document.querySelectorAll(".skill").forEach((el) => {
    const n = S.loadout[+el.dataset.n - 1];
    const sk = S.skills.find((s) => s.n === n);
    if (!sk)
      return;
    const locked = S.you.lvl < sk.unlock;
    const noNode = !locked && activeNodeRank(n) < 1;
    el.classList.toggle("locked", locked || noNode);
    el.querySelector(".lock").textContent = locked ? `Lv ${sk.unlock}` : noNode ? "H" : "";
  });
}
function drawSkillCooldowns(t) {
  document.querySelectorAll(".skill").forEach((el) => {
    const n = S.loadout[+el.dataset.n - 1];
    const sk = S.skills.find((s) => s.n === n);
    if (!sk)
      return;
    const cv = el.querySelector("canvas"), g = cv.getContext("2d");
    skillIcon(g, S.myCls, n);
    const left = S.cds[n] - t;
    if (left > 0) {
      const frac = left / sk.cd;
      g.fillStyle = "rgba(5,4,2,.7)";
      g.beginPath();
      g.moveTo(26, 26);
      g.arc(26, 26, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.closePath();
      g.fill();
      g.fillStyle = "#fff";
      g.font = "13px Georgia";
      g.textAlign = "center";
      g.fillText((left / 1000).toFixed(left > 3000 ? 0 : 1), 26, 31);
    }
  });
}

function openPortalPanel(m) {
  const body = $("dialogBody");
  const title = $("dialogName");
  if (!body || !title) return;
  closeCityPanels("dialogPanel");
  const xbtn = title.querySelector(".panel-x");
  title.textContent = m.name || "Portal";
  if (xbtn) title.appendChild(xbtn);
  let html = "";
  for (const line of m.lines || []) html += `<p>${line}</p>`;
  html += `<div class="portal-list">`;
  for (const d of m.destinations || []) {
    const cls = d.unlocked ? "portal-btn" : "portal-btn locked";
    const hint = d.unlocked ? "" : " (bloqueado)";
    html += `<button type="button" class="${cls}" data-dest="${d.id}" ${d.unlocked ? "" : "disabled"}>${d.label}${hint}</button>`;
  }
  html += `</div>`;
  body.innerHTML = html;
  body.querySelectorAll(".portal-btn:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", () => {
      send({ t: "portal_travel", dest: btn.dataset.dest });
      $("dialogPanel").classList.add("hidden");
      if (window.AOTAudio) AOTAudio.sfx("ui");
    });
  });
  revealPanel("dialogPanel");
}

function refreshHud() {
  const y = S.you;
  if (!y)
    return;
  $("xpFill").style.width = `${clamp(y.xp / (y.xpNext || 1), 0, 1) * 100}%`;
  $("lvlNum").textContent = `Nivel ${y.lvl}  —  ${y.xp} / ${y.xpNext} XP`;
  $("goldHud").textContent = `${y.gold} de oro`;
  refreshSkillLocks();
}
function checkZone(curZone) {
  const me = S.ents.get(S.myId);
  if (!me || !S.map)
    return;
  const name = curZone ? curZone.name : nearTown(me.rx, me.ry) ? "Helike" : "";
  if (name && name !== S.zoneName) {
    S.zoneName = name;
    $("zoneHud").textContent = name;
    const b = $("zoneBanner");
    b.textContent = name;
    b.classList.add("show");
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove("show"), 2600);
  }
}
function nearTown(x, y) {
  const tn = S.map && S.map.town;
  return tn && Math.hypot(x - tn.x, y - tn.y) < 14;
}
var CLS_ES = { warrior: "Guerrero", hunter: "Cazador", mage: "Mago", cleric: "Clérigo" };
var inviteTimer = 0;
function openPlayerMenu(e, entId) {
  const E = S.ents.get(entId);
  if (!E)
    return;
  const pm = $("playerMenu");
  const inParty = S.partyIds.has(entId);
  pm.innerHTML = `<div class="pm-name">${E.n || ""} · Nv ${E.l}</div>`
    + `<button class="btn" id="pmInspect">${t("inspect.btn")}</button>`
    + (inParty ? '<button class="btn ghost" disabled>Ya está en tu grupo</button>' : '<button class="btn" id="pmInvite">Invitar al grupo</button>');
  pm.classList.remove("hidden");
  pm.style.left = Math.min(window.innerWidth - 200, e.clientX + 6) + "px";
  pm.style.top = Math.min(window.innerHeight - 130, e.clientY + 6) + "px";
  const insp = $("pmInspect");
  if (insp) insp.addEventListener("click", () => {
    send({ t: "inspect", id: entId });
    closePlayerMenu();
  });
  const b = $("pmInvite");
  if (b)
    b.addEventListener("click", () => {
      send({ t: "party_invite", id: entId });
      closePlayerMenu();
    });
}
function closePlayerMenu() {
  $("playerMenu").classList.add("hidden");
}
function showInvite(m) {
  clearTimeout(inviteTimer);
  const box = $("inviteBox");
  box.innerHTML = `<div class="inv-txt"><b>${m.from}</b> (nivel ${m.lvl}, ${CLS_ES[m.cls] || m.cls}) te invita a su grupo</div>
    <div class="inv-btns"><button class="btn green" id="invYes">Unirse</button>
    <button class="btn ghost" id="invNo">Rechazar</button></div>`;
  box.classList.remove("hidden");
  $("invYes").addEventListener("click", () => {
    send({ t: "party_accept", from: m.from });
    box.classList.add("hidden");
  });
  $("invNo").addEventListener("click", () => {
    send({ t: "party_decline", from: m.from });
    box.classList.add("hidden");
  });
  inviteTimer = setTimeout(() => box.classList.add("hidden"), 30000);
}

function setPartyMinimized(on) {
  S.partyMinimized = !!on;
  const pf = $("partyFrames");
  if (pf) pf.classList.toggle("minimized", S.partyMinimized);
  try { localStorage.setItem("aot_party_mini", S.partyMinimized ? "1" : "0"); } catch (_) {}
}
function bindPartyChrome() {
  const toggle = $("pfToggle");
  if (toggle) {
    toggle.onclick = (e) => {
      e.stopPropagation();
      setPartyMinimized(!S.partyMinimized);
    };
  }
  const leave = $("pfLeave");
  if (leave) {
    leave.onclick = (e) => {
      e.stopPropagation();
      send({ t: "party_leave" });
    };
  }
  document.querySelectorAll(".pf-follow").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = +btn.dataset.follow;
      send({ t: "party_follow", id: S.followId === id ? null : id });
    };
  });
}

function isMobileUi() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
}
function setChatOpen(on) {
  const chat = $("chat");
  const btn = $("mobChat");
  if (!chat) return;
  chat.classList.toggle("open", !!on);
  if (btn) {
    btn.classList.toggle("on", !!on);
    if (on) btn.classList.remove("ping");
  }
  const inp = $("chatInput");
  if (on) {
    if (inp) setTimeout(() => inp.focus(), 30);
  } else if (inp) {
    inp.blur();
  }
}
function initMobileUi() {
  try { if (localStorage.getItem("aot_party_mini") === "1") S.partyMinimized = true; } catch (_) {}
  if (S.partyMinimized && $("partyFrames") && S.party.length) setPartyMinimized(true);
  const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
  const hud = $("mobileHud");
  if (hud) hud.style.display = coarse ? "block" : "none";
  if (S._mobileReady) return;
  S._mobileReady = true;
  // Floating virtual stick: appears under finger only while dragging empty screen.
  const joy = $("joystick");
  const knob = $("joyKnob");
  const maxR = 48;
  let joyPid = null, joyOrigin = null, joyArmed = false, joyTapLock = false;
  const setJoyVec = (x, y, force) => {
    S.joy = { x, y };
    if (knob) knob.style.transform = `translate(calc(-50% + ${x * maxR}px), calc(-50% + ${y * maxR}px))`;
    if (x || y) { S.targetId = 0; S.lootTarget = 0; }
    sendDir(!!force);
  };
  const hideJoy = () => {
    if (joy) {
      joy.classList.remove("on", "active");
      joy.classList.add("hidden");
      joy.setAttribute("aria-hidden", "true");
    }
    joyPid = null; joyOrigin = null; joyArmed = false; joyTapLock = false;
    setJoyVec(0, 0, true);
  };
  const showJoyAt = (x, y) => {
    if (!joy) return;
    joy.classList.remove("hidden");
    joy.style.left = x + "px";
    joy.style.top = y + "px";
    joy.classList.add("on", "active");
    joy.setAttribute("aria-hidden", "false");
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  };
  const uiBlocksJoy = (el) => {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el === canvas || el.id === "world" || el.id === "game" || el.id === "mobileHud") return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "button" || tag === "input" || tag === "textarea" || tag === "a" || tag === "select") return true;
    if (el.closest) {
      if (el.closest("button, input, textarea, a, select, .panel, .mob-btn, .skill, #hud, #partyFrames, #playerMenu, #inviteBox, #chat, #minimap, #deathOverlay, #reconnect, #tooltip, #invDragGhost"))
        return true;
    }
    return false;
  };
  const onJoyDown = (e) => {
    if (!S.loggedIn || S.dead) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Desktop mouse keeps click-to-attack; virtual stick is for touch / pen.
    if (e.pointerType === "mouse" && !isMobileUi())
      return;
    if (uiBlocksJoy(e.target)) return;
    if (joyPid != null) return;
    joyPid = e.pointerId;
    joyOrigin = { x: e.clientX, y: e.clientY };
    joyArmed = false;
    // If the finger starts on loot / NPC / enemy, keep this gesture as a TAP
    // so slight wobble doesn't turn into walking and cancel pickup.
    try {
      const wx = s2wx(e.clientX), wy = s2wy(e.clientY);
      const hit = pickAt(wx, wy);
      joyTapLock = !!(hit.loot || hit.ent);
    } catch (_) { joyTapLock = false; }
    S._touchTap = { x: e.clientX, y: e.clientY, t: Date.now() };
    // Don't clear tap yet — only cancel attack-tap once this gesture becomes a drag.
    try { (document.getElementById("game") || canvas).setPointerCapture?.(joyPid); } catch (_) {}
  };
  const onJoyMove = (e) => {
    if (joyPid == null || e.pointerId !== joyPid || !joyOrigin) return;
    const dx = e.clientX - joyOrigin.x, dy = e.clientY - joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (!joyArmed) {
      // Locked taps (loot/target) allow more wobble before becoming a stick drag.
      if (dist < (joyTapLock ? 42 : 16)) return;
      if (joyTapLock) return; // never convert loot/target taps into movement
      joyArmed = true;
      S._touchTap = null; // drag = move, not attack
      S._joyDrag = true;
      showJoyAt(joyOrigin.x, joyOrigin.y);
      try { e.preventDefault(); } catch (_) {}
    }
    const mag = dist || 1;
    const cap = Math.min(mag, maxR);
    const nx = (dx / mag) * (cap / maxR);
    const ny = (dy / mag) * (cap / maxR);
    if (Math.hypot(nx, ny) < 0.16) setJoyVec(0, 0, false);
    else setJoyVec(nx, ny, false);
  };
  const onJoyUp = (e) => {
    if (joyPid == null || (e && e.pointerId !== joyPid)) return;
    const wasArmed = joyArmed;
    const origin = joyOrigin;
    const tap = S._touchTap;
    hideJoy();
    if (wasArmed) {
      S._joyDrag = false;
      S._touchTap = null;
      try { e.preventDefault(); } catch (_) {}
      return;
    }
    // Short tap on world (including loot): pick up / attack / talk.
    // Use the release point, falling back to origin.
    const x = (e && e.clientX != null) ? e.clientX : (origin ? origin.x : 0);
    const y = (e && e.clientY != null) ? e.clientY : (origin ? origin.y : 0);
    if (tap && Date.now() - tap.t <= 750) {
      S._touchTap = null;
      handleWorldPointer(x, y);
      try { e.preventDefault(); } catch (_) {}
    }
  };
  const gameEl = $("game") || document.body;
  gameEl.addEventListener("pointerdown", onJoyDown, { passive: true });
  window.addEventListener("pointermove", onJoyMove, { passive: false });
  window.addEventListener("pointerup", onJoyUp, { passive: false });
  window.addEventListener("pointercancel", onJoyUp, { passive: false });

  const mobChat = $("mobChat");
  if (mobChat && !mobChat._bound) {
    mobChat._bound = true;
    mobChat.addEventListener("click", (e) => {
      e.stopPropagation();
      setChatOpen(!$("chat")?.classList.contains("open"));
    });
  }
  // Start closed on phones.
  if (isMobileUi()) setChatOpen(false);

  const mobInv = $("mobInv");
  if (mobInv) mobInv.addEventListener("click", () => { setChatOpen(false); togglePanel("invPanel"); });
  const mobQuest = $("mobQuest");
  if (mobQuest) mobQuest.addEventListener("click", () => { setChatOpen(false); togglePanel("questPanel"); });
  const mobChar = $("mobChar");
  if (mobChar) mobChar.addEventListener("click", () => { setChatOpen(false); togglePanel("charPanel"); });
  const mobAbility = $("mobAbility");
  if (mobAbility) mobAbility.addEventListener("click", () => { setChatOpen(false); togglePanel("abilityPanel"); });
}
function handleWorldPointer(clientX, clientY) {
  if (!S.loggedIn || S.dead) return;
  const wx = s2wx(clientX), wy = s2wy(clientY);
  S._lastWorld = { x: wx, y: wy };
  S.mouse.wx = wx; S.mouse.wy = wy;
  const p = pickAt(wx, wy);
  if (p.loot) {
    S.targetId = 0;
    S.lootTarget = p.loot;
    send({ t: "pickup", id: p.loot });
    const me = S.ents.get(S.myId);
    const L = S.loot.get(p.loot);
    if (me && L) {
      const dd = Math.hypot(me.rx - L.x, me.ry - L.y);
      if (dd <= 2) {
        if (window.AOTAudio) AOTAudio.sfx("pickup");
      } else if (isMobileUi()) {
        toast("Recogiendo…");
      }
    }
    return;
  }
  if (p.ent) {
    const E = S.ents.get(p.ent);
    if (NPC_KINDS[E.k]) {
      send({ t: "talk", id: p.ent });
      return;
    }
    if (PLAYER_KINDS[E.k]) {
      openPlayerMenu({ clientX, clientY }, p.ent);
      return;
    }
    S.targetId = p.ent;
    S.lootTarget = 0;
    send({ t: "attack", id: p.ent });
    return;
  }
  S.targetId = 0;
  S.lootTarget = 0;
  send({ t: "attack", id: 0 });
  closePlayerMenu();
  closeTopPanel();
  hideTooltip();
}

function renderParty() {
  const pf = $("partyFrames");
  if (!S.party.length) {
    pf.classList.add("hidden");
    pf.innerHTML = "";
    return;
  }
  const leader = S.party.find((m) => m.id === S.followId);
  const n = S.party.length;
  let html = `<div class="pf-head"><button type="button" id="pfToggle" class="pf-toggle" title="Toca para minimizar o expandir el grupo">
    <span class="pf-mini">👥<span class="pf-count">${n}</span></span>
    <span class="pf-full">Grupo${leader ? ` · ${leader.name}` : ""} (${n})</span>
    </button><button type="button" id="pfLeave" class="pf-leave" title="Salir del grupo">Salir</button></div><div class="pf-body">`;
  for (const m of S.party) {
    if (m.id === S.myId)
      continue;
    const online = m.online !== false && m.id > 0;
    const followed = online && m.id === S.followId;
    html += `<div class="pf-row${followed ? " following" : ""}${online ? "" : " offline"}" data-id="${m.id}">
      <span class="pf-name">${m.name}${online ? "" : " · ausente"}</span>
      <span class="pf-lvl">Nv ${m.lvl} · ${CLS_ES[m.cls] || m.cls}</span>
      <div class="pf-bar"><div class="pf-fill" style="width:100%"></div></div>
      ${online ? `<button class="pf-follow${followed ? " active" : ""}" data-follow="${m.id}">${followed ? "Siguiendo ✓" : "Seguir"}</button>` : `<span class="pf-offline">Offline</span>`}
      </div>`;
  }
  html += `</div>`;
  pf.innerHTML = html;
  pf.classList.remove("hidden");
  pf.classList.toggle("minimized", S.partyMinimized);
  bindPartyChrome();
}
setInterval(() => {
  if (!S.party.length)
    return;
  for (const row of $("partyFrames").querySelectorAll(".pf-row")) {
    const E = S.ents.get(+row.dataset.id);
    const fill = row.querySelector(".pf-fill");
    if (E && !E.dieT) {
      fill.style.width = Math.max(0, 100 * E.h / E.H) + "%";
      row.classList.remove("far");
    } else
      row.classList.add("far");
  }
}, 250);
var mmCanvas = $("minimap");
var mmCtx = mmCanvas.getContext("2d");
var mmBase = null;
function buildMinimapBase() {
  const m = S.map;
  const off = document.createElement("canvas");
  off.width = m.w;
  off.height = m.h;
  const g = off.getContext("2d");
  const img = g.createImageData(m.w, m.h);
  for (let y = 0;y < m.h; y++) {
    for (let x = 0;x < m.w; x++) {
      const ch = m.tiles[y][x];
      const o = (y * m.w + x) * 4;
      let c;
      switch (ch) {
        case "g":
          c = [32, 46, 64];
          break;
        case "d":
          c = [104, 82, 52];
          break;
        case "s":
          c = [176, 154, 104];
          break;
        case "f":
          c = [96, 92, 80];
          break;
        case "p":
          c = [140, 132, 106];
          break;
        case "F":
          c = [72, 128, 168];
          break;
        case "w":
          c = [26, 52, 88];
          break;
        case "t":
          c = [22, 30, 46];
          break;
        case "r":
          c = [78, 76, 70];
          break;
        case "W":
          c = [110, 104, 90];
          break;
        default:
          c = [16, 14, 10];
      }
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  mmBase = off;
}
function sendPartyPing(wx, wy) {
  if (!S.party || !S.party.length) return toast("No estás en un grupo");
  send({ t: "party_ping", x: wx, y: wy });
}
function minimapEventToWorld(e) {
  const r = mmCanvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width;
  const my = (e.clientY - r.top) / r.height;
  return { x: mx * S.map.w, y: my * S.map.h };
}
if (mmCanvas) {
  mmCanvas.style.cursor = "crosshair";
  mmCanvas.title = "Clic: ping de grupo · Shift+clic: marca personal";
  mmCanvas.addEventListener("click", (e) => {
    if (!S.loggedIn || !S.map || S.dead) return;
    const w = minimapEventToWorld(e);
    if (e.shiftKey) setPersonalWaypoint(w.x, w.y);
    else sendPartyPing(w.x, w.y);
  });
}
function drawMinimapDots() {
  if (!mmBase)
    return;
  const { width: W, height: H } = mmCanvas;
  mmCtx.clearRect(0, 0, W, H);
  mmCtx.imageSmoothingEnabled = false;
  mmCtx.drawImage(mmBase, 0, 0, W, H);
  const kx = W / S.map.w, ky = H / S.map.h;
  const questTargets = activeQuestTargets();
  const tNow = now();
  for (const b of BOSS_MARKERS) {
    const x = b.x * kx, y = b.y * ky;
    const cd = S.bossTimers[b.k] || 0;
    mmCtx.globalAlpha = cd > 0 ? 0.45 : 1;
    mmCtx.fillStyle = cd > 0 ? "#8a6a3e" : "#ffb04a";
    mmCtx.beginPath();
    mmCtx.moveTo(x, y - 3.2);
    mmCtx.lineTo(x + 2.6, y);
    mmCtx.lineTo(x, y + 3.2);
    mmCtx.lineTo(x - 2.6, y);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.globalAlpha = 1;
    if (cd > 0) {
      mmCtx.fillStyle = "rgba(255,220,180,.95)";
      mmCtx.font = "bold 8px sans-serif";
      mmCtx.textAlign = "center";
      mmCtx.fillText(String(cd), x, y - 5);
      mmCtx.textAlign = "left";
    }
    if (questTargets.has(b.k)) {
      mmCtx.strokeStyle = "rgba(255,220,120,.95)";
      mmCtx.lineWidth = 1;
      mmCtx.beginPath();
      mmCtx.arc(x, y, 5, 0, 7);
      mmCtx.stroke();
    }
  }
  if (S.waypoint) {
    const wx = S.waypoint.x * kx, wy = S.waypoint.y * ky;
    mmCtx.strokeStyle = "rgba(120,220,255,.95)";
    mmCtx.fillStyle = "rgba(80,180,255,.85)";
    mmCtx.lineWidth = 1.2;
    mmCtx.beginPath();
    mmCtx.moveTo(wx, wy - 4);
    mmCtx.lineTo(wx + 3, wy + 2);
    mmCtx.lineTo(wx - 3, wy + 2);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.stroke();
  }
  if (S.deathMark) {
    const dx = S.deathMark.x * kx, dy = S.deathMark.y * ky;
    mmCtx.strokeStyle = "rgba(255,90,90,.95)";
    mmCtx.lineWidth = 1.5;
    mmCtx.beginPath();
    mmCtx.moveTo(dx - 3, dy - 3); mmCtx.lineTo(dx + 3, dy + 3);
    mmCtx.moveTo(dx + 3, dy - 3); mmCtx.lineTo(dx - 3, dy + 3);
    mmCtx.stroke();
  }
  for (let i = S.pings.length - 1; i >= 0; i--) {
    const P = S.pings[i];
    const age = tNow - P.t0;
    if (age > 6000) { S.pings.splice(i, 1); continue; }
    const a = 1 - age / 6000;
    const pulse = 3 + Math.sin(tNow / 120) * 1.2;
    mmCtx.strokeStyle = `rgba(80,220,255,${0.35 + a * 0.55})`;
    mmCtx.lineWidth = 1.4;
    mmCtx.beginPath();
    mmCtx.arc(P.x * kx, P.y * ky, pulse, 0, 7);
    mmCtx.stroke();
    mmCtx.fillStyle = `rgba(120,230,255,${a})`;
    mmCtx.beginPath();
    mmCtx.arc(P.x * kx, P.y * ky, 1.8, 0, 7);
    mmCtx.fill();
  }
  for (const [id, E] of S.ents) {
    if (E.dieT)
      continue;
    let col;
    if (id === S.myId)
      col = "#fff";
    else if (PLAYER_KINDS[E.k])
      col = S.partyIds.has(id) ? "#5ade6a" : "#6aa8ff";
    else if (NPC_KINDS[E.k])
      col = "#ffd94a";
    else if (BOSS_KINDS.has(E.k))
      col = "#ffb04a";
    else
      col = questTargets.has(E.k) ? "#ff7ad9" : "#e0483a";
    mmCtx.fillStyle = col;
    const r = id === S.myId ? 2.4 : BOSS_KINDS.has(E.k) ? 2.6 : questTargets.has(E.k) ? 2.3 : 1.8;
    mmCtx.fillRect(E.rx * kx - r / 2, E.ry * ky - r / 2, r, r);
    if (!PLAYER_KINDS[E.k] && !NPC_KINDS[E.k] && questTargets.has(E.k) && !BOSS_KINDS.has(E.k)) {
      mmCtx.strokeStyle = "rgba(255,170,220,.9)";
      mmCtx.lineWidth = 1;
      mmCtx.strokeRect(E.rx * kx - r, E.ry * ky - r, r * 2, r * 2);
    }
  }
}

function toggleWorldMap() {
  const p = $("worldMapPanel");
  if (!p || !S.map) return;
  if (p.classList.contains("hidden")) {
    revealPanel(p);
    drawWorldMap();
  } else {
    p.classList.add("hidden");
  }
}
function worldMapEventToWorld(e) {
  const cv = $("worldMap");
  if (!cv || !S.map) return null;
  const r = cv.getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width;
  const my = (e.clientY - r.top) / r.height;
  return { x: mx * S.map.w, y: my * S.map.h };
}
function drawWorldMap() {
  const cv = $("worldMap");
  const panel = $("worldMapPanel");
  if (!cv || !S.map || !panel || panel.classList.contains("hidden")) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.imageSmoothingEnabled = false;
  if (mmBase) ctx.drawImage(mmBase, 0, 0, W, H);
  else { ctx.fillStyle = "#0c0a06"; ctx.fillRect(0, 0, W, H); }
  const kx = W / S.map.w, ky = H / S.map.h;
  if (S.map.zones) {
    ctx.font = "12px Georgia";
    ctx.textAlign = "center";
    for (const z of S.map.zones) {
      const x0 = z.x0 * kx, y0 = z.y0 * ky, x1 = z.x1 * kx, y1 = z.y1 * ky;
      ctx.strokeStyle = "rgba(200,147,59,.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = "rgba(232,210,160,.85)";
      ctx.fillText(z.name + (z.lvl ? (" (" + z.lvl + ")") : ""), (x0 + x1) / 2, Math.max(14, y0 + 14));
    }
  }
  const questTargets = activeQuestTargets();
  const tNow = now();
  for (const b of BOSS_MARKERS) {
    const x = b.x * kx, y = b.y * ky;
    const cd = S.bossTimers[b.k] || 0;
    ctx.globalAlpha = cd > 0 ? 0.5 : 1;
    ctx.fillStyle = "#ffb04a";
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffe0a0";
    ctx.font = "11px Georgia";
    ctx.textAlign = "left";
    ctx.fillText(cd > 0 ? (b.n + " " + Math.ceil(cd / 1000) + "s") : b.n, x + 8, y + 4);
    if (questTargets.has(b.k)) {
      ctx.strokeStyle = "rgba(255,220,120,.95)";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 7);
      ctx.stroke();
    }
  }
  for (const [id, E] of S.ents) {
    if (E.dieT) continue;
    const x = E.rx * kx, y = E.ry * ky;
    if (id === S.myId) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke();
    } else if (PLAYER_KINDS[E.k]) {
      ctx.fillStyle = S.partyIds.has(id) ? "#5ade6a" : "#6aa8ff";
      ctx.fillRect(x - 2, y - 2, 4, 4);
    } else if (!NPC_KINDS[E.k] && questTargets.has(E.k)) {
      ctx.fillStyle = "#ff7ad9";
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  if (S.waypoint) {
    const wx = S.waypoint.x * kx, wy = S.waypoint.y * ky;
    ctx.fillStyle = "rgba(80,180,255,.9)";
    ctx.beginPath();
    ctx.moveTo(wx, wy - 8);
    ctx.lineTo(wx + 6, wy + 4);
    ctx.lineTo(wx - 6, wy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9cf";
    ctx.stroke();
  }
  if (S.deathMark) {
    const dx = S.deathMark.x * kx, dy = S.deathMark.y * ky;
    ctx.strokeStyle = "rgba(255,100,100,.95)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx - 7, dy - 7); ctx.lineTo(dx + 7, dy + 7);
    ctx.moveTo(dx + 7, dy - 7); ctx.lineTo(dx - 7, dy + 7);
    ctx.stroke();
  }
  for (const ping of S.pings) {
    if (tNow - ping.t0 > 6000) continue;
    const x = ping.x * kx, y = ping.y * ky;
    const a = 1 - (tNow - ping.t0) / 6000;
    ctx.strokeStyle = "rgba(120,255,160," + (0.4 + a * 0.5) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6 + (1 - a) * 10, 0, 7);
    ctx.stroke();
  }
}
function updateCoordHud() {
  const el = $("coordHud");
  if (!el) return;
  const me = S.ents.get(S.myId);
  if (!me) { el.textContent = ""; return; }
  el.textContent = me.rx.toFixed(0) + ", " + me.ry.toFixed(0);
}
function updateFpsHud(t) {
  S._fpsFrames++;
  if (!S._fpsAt) S._fpsAt = t;
  if (t - S._fpsAt >= 500) {
    S._fpsVal = Math.round(S._fpsFrames * 1000 / (t - S._fpsAt));
    S._fpsFrames = 0;
    S._fpsAt = t;
  }
  const el = $("fpsHud");
  if (!el) return;
  if (!S.showFps) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.textContent = S._fpsVal + " FPS";
}

function toast(msg) {
  const box = $("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4)
    box.firstChild.remove();
  setTimeout(() => el.classList.add("fade"), 2200);
  setTimeout(() => el.remove(), 2900);
}
function chatChannel(m) {
  if (m.sys) return "sys";
  if (m.whisper) return "whisper";
  if (m.party) return "party";
  return "all";
}
function applyChatFilter() {
  const log = $("chatLog");
  if (!log) return;
  const tab = S.chatTab || "all";
  for (const el of log.children) {
    const ch = el.dataset.ch || "all";
    el.classList.toggle("chat-hide", tab !== "all" && ch !== tab);
  }
}
function setChatTab(tab) {
  S.chatTab = tab || "all";
  document.querySelectorAll(".chat-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.ch === S.chatTab);
  });
  applyChatFilter();
}
function addChat(m) {
  const log = $("chatLog");
  if (!log) return;
  const el = document.createElement("div");
  const ch = chatChannel(m);
  el.dataset.ch = ch;
  if (m.sys) {
    el.className = "sys";
    el.textContent = m.text;
  } else {
    if (m.whisper) el.className = "whisper";
    else if (m.party) el.className = "party";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = (m.party ? "[G] " : "") + (m.from || "?") + ": ";
    el.appendChild(who);
    el.appendChild(document.createTextNode(m.text));
  }
  if ((S.chatTab || "all") !== "all" && ch !== S.chatTab) el.classList.add("chat-hide");
  log.appendChild(el);
  while (log.children.length > 80)
    log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
  log.classList.remove("idle");
  S.chatIdleT = now();
  if (isMobileUi()) {
    const chat = $("chat");
    const btn = $("mobChat");
    if (chat && btn && !chat.classList.contains("open")) {
      btn.classList.add("ping");
    }
  }
}
var EQ_SLOTS = ["weapon", "armor", "helm", "ring"];
function slotCanvas(item, w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  if (item)
    drawItemIcon(cv.getContext("2d"), item.icon, item.rarity, w / 2, h / 2, Math.min(w, h) - 12);
  return cv;
}
var invDrag = {
  active: false,
  moved: false,
  suppressClick: false,
  slot: -1,
  item: null,
  startX: 0,
  startY: 0,
  ghost: null
};
function beginInvDrag(e, slot, item) {
  // Prevent native browser drag of the slot canvas (breaks custom drop).
  if (e.cancelable) e.preventDefault();
  invDrag.active = true;
  invDrag.moved = false;
  invDrag.suppressClick = false;
  invDrag.slot = slot;
  invDrag.item = item;
  invDrag.startX = e.clientX;
  invDrag.startY = e.clientY;
}
function endInvDrag() {
  if (invDrag.ghost) {
    invDrag.ghost.remove();
    invDrag.ghost = null;
  }
  document.body.classList.remove("inv-dropping");
  invDrag.active = false;
  invDrag.moved = false;
  invDrag.slot = -1;
  invDrag.item = null;
}
function ensureInvGhost(item) {
  if (invDrag.ghost) return invDrag.ghost;
  const g = document.createElement("div");
  g.id = "invDragGhost";
  const cv = slotCanvas(item, 46, 42);
  cv.draggable = false;
  g.appendChild(cv);
  document.body.appendChild(g);
  document.body.classList.add("inv-dropping");
  invDrag.ghost = g;
  hideTooltip();
  return g;
}
function invOutsidePanel(x, y) {
  const panel = $("invPanel");
  if (!panel || panel.classList.contains("hidden")) return true;
  const r = panel.getBoundingClientRect();
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
}
function onInvDragMove(e) {
  if (!invDrag.active) return;
  const dx = e.clientX - invDrag.startX;
  const dy = e.clientY - invDrag.startY;
  if (!invDrag.moved && dx * dx + dy * dy >= 25) {
    invDrag.moved = true;
    invDrag.suppressClick = true;
    ensureInvGhost(invDrag.item);
  }
  if (!invDrag.moved) return;
  if (e.cancelable) e.preventDefault();
  const ghost = ensureInvGhost(invDrag.item);
  ghost.style.left = e.clientX - 23 + "px";
  ghost.style.top = e.clientY - 21 + "px";
  ghost.classList.toggle("drop-ok", invOutsidePanel(e.clientX, e.clientY));
}
function onInvDragUp(e) {
  if (!invDrag.active) return;
  const moved = invDrag.moved;
  const slot = invDrag.slot;
  const item = invDrag.item;
  const outside = invOutsidePanel(e.clientX, e.clientY);
  endInvDrag();
  if (!moved) return;
  invDrag.suppressClick = true;
  setTimeout(() => { invDrag.suppressClick = false; }, 0);
  if (!outside) return;
  if (!item || item.slot === "quest") {
    toast("No puedes tirar objetos de misión");
    return;
  }
  send({ t: "drop", slot });
  if (window.AOTAudio) AOTAudio.sfx("ui");
}
window.addEventListener("mousemove", onInvDragMove);
window.addEventListener("mouseup", onInvDragUp);
window.addEventListener("blur", () => {
  if (invDrag.active) endInvDrag();
});
// If the pointer leaves the window mid-drag, cancel cleanly.
window.addEventListener("dragstart", (e) => {
  if (invDrag.active) {
    e.preventDefault();
  }
});

function renderInventory() {
  const y = S.you;
  if (!y)
    return;
  const eq = $("eqGrid");
  eq.innerHTML = "";
  for (const es of EQ_SLOTS) {
    const item = y.eq ? y.eq[es] : null;
    const d = document.createElement("div");
    d.className = "eq-slot" + (item ? ` r-${item.rarity}` : "");
    d.appendChild(slotCanvas(item, 66, 56));
    const lbl = document.createElement("div");
    lbl.className = "eq-name";
    lbl.textContent = es;
    d.appendChild(lbl);
    if (item) {
      const act = "Clic para desequipar";
      d._tip = { item, action: act };
      d.addEventListener("mousemove", (e) => showTooltip(e, item, act));
      d.addEventListener("mouseleave", hideTooltip);
      d.addEventListener("click", () => {
        send({ t: "unequip", eslot: es });
      });
    }
    eq.appendChild(d);
  }
  const grid = $("invGrid");
  grid.innerHTML = "";
  const inv = y.inv || [];
  for (let i = 0;i < 24; i++) {
    const item = inv[i];
    const d = document.createElement("div");
    d.className = "inv-slot" + (item ? ` full r-${item.rarity}` : "");
    if (item) {
      d.appendChild(slotCanvas(item, 46, 42));
      if (item.qty > 1) {
        const q = document.createElement("span");
        q.className = "qty";
        q.textContent = item.qty;
        d.appendChild(q);
      }
      const act = S.shopOpen
        ? `Vender por ${Math.floor(item.val / 4)} de oro`
        : S.stashOpen
          ? "Clic para guardar en el cofre"
          : item.slot === "potion"
            ? "Clic: beber · Arrastra fuera: tirar"
            : item.slot === "quest"
              ? "Objeto de misión"
              : "Clic: equipar · Arrastra fuera: tirar";
      d._tip = { item, action: act };
      d.addEventListener("mousemove", (e) => showTooltip(e, item, act));
      d.addEventListener("mouseleave", hideTooltip);
      const slot = i;
      d.addEventListener("click", (e) => {
        if (invDrag.suppressClick) {
          invDrag.suppressClick = false;
          return;
        }
        if (S.shopOpen) {
          if (item.rarity !== "common" && !confirm(`¿Vender ${item.name} (${RARITY_ES[item.rarity] || item.rarity}) por ${Math.floor(item.val / 4)} de oro?`))
            return;
          send({ t: "sell", slot });
        } else if (S.stashOpen) {
          if (item.slot === "quest") return toast("No puedes guardar objetos de misión");
          send({ t: "stash_deposit", slot });
        } else if (item.slot === "potion")
          send({ t: "use", slot });
        else if (item.slot === "quest")
          toast("Objeto de misión — el Anciano los querrá.");
        else
          send({ t: "equip", slot });
      });
      // Drag outside the inventory panel to drop on the ground (shared loot).
      d.querySelectorAll("canvas").forEach((cv) => { cv.draggable = false; });
      if (!S.shopOpen && !S.stashOpen && item.slot !== "quest") {
        d.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          beginInvDrag(e, slot, item);
        });
      }
    }
    grid.appendChild(d);
  }
  $("invGold").textContent = `Oro: ${y.gold}`;
  $("sellHint").classList.toggle("hidden", !S.shopOpen);
  const sar = $("sellAllRow");
  if (sar) sar.classList.toggle("hidden", !S.shopOpen);
  const dh = $("dropHint");
  if (dh) dh.classList.toggle("hidden", !!S.shopOpen);
  refreshHoverTooltip();
}
var tipXY = { x: 0, y: 0, on: false };
function compareItemHtml(item) {
  if (!S.you || !S.you.eq) return "";
  const slot = item.slot;
  if (slot !== "weapon" && slot !== "armor" && slot !== "helm" && slot !== "ring") return "";
  const cur = S.you.eq[slot];
  if (!cur || cur.id === item.id) return "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let html = `<div class="tt-cmp">vs equipado (${esc(cur.name)})</div>`;
  const line = (label, d) => {
    if (!d) return "";
    const cls = d > 0 ? "up" : "down";
    const sign = d > 0 ? "+" : "";
    return `<div class="tt-mod ${cls}">${sign}${d} ${label}</div>`;
  };
  if (item.dmg || cur.dmg) {
    const a = item.dmg ? (item.dmg[0] + item.dmg[1]) / 2 : 0;
    const b = cur.dmg ? (cur.dmg[0] + cur.dmg[1]) / 2 : 0;
    html += line("daño medio", Math.round(a - b));
  }
  html += line("armadura", (item.arm || 0) - (cur.arm || 0));
  const keys = new Set([...(item.mods ? Object.keys(item.mods) : []), ...(cur.mods ? Object.keys(cur.mods) : [])]);
  for (const k of keys) {
    const d = ((item.mods && item.mods[k]) || 0) - ((cur.mods && cur.mods[k]) || 0);
    html += line(MOD_NAMES[k] || k, d);
  }
  return html;
}
function showTooltip(e, item, action) {
  tipXY.x = e.clientX;
  tipXY.y = e.clientY;
  tipXY.on = true;
  const tt = $("tooltip");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let html = `<div class="tt-name ${item.rarity}">${esc(item.name)}</div>`;
  html += `<div class="tt-type">${esc(SLOT_ES[item.slot] || item.slot)} · nivel ${item.tier} · ${esc(RARITY_ES[item.rarity] || item.rarity)}</div>`;
  if (item.dmg)
    html += `<div class="tt-stat">Daño ${item.dmg[0]}–${item.dmg[1]}</div>`;
  if (item.arm)
    html += `<div class="tt-stat">Armadura ${item.arm}</div>`;
  if (item.mods)
    for (const [k, v] of Object.entries(item.mods))
      html += `<div class="tt-mod">+${v} ${MOD_NAMES[k] || k}</div>`;
  html += compareItemHtml(item);
  if (item.lvl > 1) {
    const met = S.you && S.you.lvl >= item.lvl;
    html += `<div class="${met ? "tt-stat" : "tt-req"}">Requiere nivel ${item.lvl}</div>`;
  }
  if (item.qty > 1)
    html += `<div class="tt-stat">Cantidad ${item.qty}</div>`;
  html += `<div class="tt-val">Valor: ${item.val} de oro</div>`;
  if (action)
    html += `<div class="tt-act">${esc(action)}</div>`;
  tt.innerHTML = html;
  tt.classList.remove("hidden");
  const r = tt.getBoundingClientRect();
  let x = e.clientX + 16, ty = e.clientY + 12;
  if (x + r.width > innerWidth - 8)
    x = e.clientX - r.width - 12;
  if (ty + r.height > innerHeight - 8)
    ty = e.clientY - r.height - 8;
  tt.style.left = x + "px";
  tt.style.top = ty + "px";
}
function hideTooltip() {
  tipXY.on = false;
  $("tooltip").classList.add("hidden");
}
function refreshHoverTooltip() {
  if (!tipXY.on)
    return;
  const el = document.elementFromPoint(tipXY.x, tipXY.y);
  const slot = el && el.closest ? el.closest(".inv-slot, .eq-slot, .shop-item") : null;
  if (slot && slot._tip) {
    showTooltip({ clientX: tipXY.x, clientY: tipXY.y }, slot._tip.item, slot._tip.action);
    return;
  }
  // Item may have just moved (equip/unequip). Keep the open tip while the
  // cursor is still inside the inventory/shop UI so the player does not have
  // to jiggle the mouse to read stats again.
  if (el && el.closest && el.closest("#invPanel, #shopPanel"))
    return;
  hideTooltip();
}
function renderChar() {
  const y = S.you;
  if (!y)
    return;
  const b = $("charBody");
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  let html = `<div class="stat-row"><span>${esc(S.myName)}</span><b>${esc(CLS_ES[S.myCls] || S.myCls)} · Nv ${y.lvl}</b></div>`;
  if (y.pts > 0)
    html += `<div class="pts">${y.pts} punto${y.pts > 1 ? "s" : ""} de característica por asignar</div>`;
  for (const st of ["str", "dex", "int"]) {
    const label = { str: "Fuerza", dex: "Destreza", int: "Inteligencia" }[st];
    html += `<div class="stat-row"><span>${label}</span><span><b>${y[st]}</b>` + (y.pts > 0 ? ` <button class="plus" data-st="${st}">+</button>` : "") + `</span></div>`;
  }
  html += `<button type="button" class="btn ghost char-reset-btn" id="charResetBtn" data-i18n="char.resetBtn">${t("char.resetBtn")}</button>`;
  const petInfo = y.activePet && PET_LABELS[y.activePet];
  const petLine = petInfo
    ? `<div class="stat-row"><span>Mascota</span><b>${esc(petInfo.name)} · ${esc(petInfo.desc)}</b></div>`
    : "";
  const restedLine = y.rested > 0
    ? `<div class="stat-row"><span>Descanso</span><b>+20% XP · ${Math.ceil(y.rested / 60)} min</b></div>`
    : "";
  html += `<div class="derived">
    <div class="stat-row"><span>Daño</span><b>${y.dmg[0]}–${y.dmg[1]}</b></div>
    <div class="stat-row"><span>Prob. de crítico</span><b>${(+y.crit).toFixed(1)}%</b></div>
    <div class="stat-row"><span>Armadura</span><b>${y.arm}</b></div>
    <div class="stat-row"><span>Vida</span><b>${Math.max(0, Math.round(y.hp))} / ${Math.round(y.mhp)}</b></div>
    <div class="stat-row"><span>Maná</span><b>${Math.max(0, Math.round(y.mp))} / ${Math.round(y.mmp)}</b></div>
    <div class="stat-row"><span>Velocidad</span><b>${y.spd}</b></div>
    <div class="stat-row"><span>Oro</span><b>${y.gold}</b></div>
    ${petLine}
    ${restedLine}
  </div>`;
  b.innerHTML = html;
  b.querySelectorAll(".plus").forEach((btn) => btn.addEventListener("click", () => send({ t: "allot", stat: btn.dataset.st })));
  const resetBtn = $("charResetBtn");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (!confirm(t("char.resetConfirm"))) return;
    send({ t: "stat_reset" });
  });
}
var QUEST_META = {
  q1: { name: "Jabalíes revoltosos", goal: "Mata 8 jabalíes", target: "boar", count: 8 },
  q2: { name: "Cuernos salvajes", goal: "Reúne 5 cuernos de sátiro", target: "satyr", count: 5 },
  q3: { name: "Los muertos inquietos", goal: "Mata 10 esqueletos", target: "skeleton", count: 10 },
  q4: { name: "Plumas y furia", goal: "Mata 8 arpías", target: "harpy", count: 8 },
  q5: { name: "Mirada de piedra", goal: "Mata 6 gorgonas", target: "gorgon", count: 6 },
  q6: { name: "El ojo de la tormenta", goal: "Derrota a Polifemo", target: "cyclops", count: 1 },
  q7: { name: "Sombras del Asfódelo", goal: "Disuelve 12 sombras", target: "shade", count: 12 },
  q8: { name: "Alas de venganza", goal: "Derriba 10 furias", target: "fury", count: 10 },
  q9: { name: "El laberinto de Asterión", goal: "Derrota al Minotauro", target: "minotaur", count: 1 },
  q10: { name: "Escamas del pantano", goal: "Elimina 12 hombres lagarto", target: "lizardman", count: 12 },
  q11: { name: "Luces engañosas", goal: "Apaga 10 fuegos fatuos", target: "wisp", count: 10 },
  q12: { name: "Las siete cabezas", goal: "Derrota a la Hidra de Lerna", target: "hydra", count: 1 }
};
function renderAbilities() {
  const pts = $("abilityPts"), b = $("abilityBody");
  const y = S.you;
  if (!S.abilityTree.length) {
    pts.textContent = "";
    b.innerHTML = `<p class="ability-empty">${t("ability.unavailable")}</p>`;
    return;
  }
  const ranks = (y && y.abilities) || {};
  let spent = 0;
  for (const k in ranks) spent += ranks[k] || 0;
  const avail = (y && y.abilityPts) || 0;
  pts.textContent = t("ability.points", avail);
  const tierReq = (tier) => tier === 1 ? 0 : tier === 2 ? 5 : 12;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const byTier = { 1: [], 2: [], 3: [] };
  for (const a of S.abilityTree) (byTier[a.tier] || (byTier[a.tier] = [])).push(a);

  // Circular node card: active nodes show their real skill-bar art (scaled onto
  // a smaller canvas), passives show a plain rank badge. Full name/desc/perRank
  // lives in the tooltip so the tree stays readable at a glance.
  const nodeHtml = (a) => {
    const rank = ranks[a.id] || 0;
    const max = a.max || 5;
    const locked = rank === 0 && spent < tierReq(a.tier);
    const canUp = !locked && rank < max && avail > 0 && spent >= tierReq(a.tier);
    let pips = "";
    for (let i = 1; i <= max; i++) pips += `<span class="pip${i <= rank ? " on" : ""}"></span>`;
    const icon = a.kind === "active"
      ? `<canvas class="node-canvas" width="44" height="44" data-skill-n="${a.skillN}"></canvas>`
      : `<div class="node-passive-badge">${rank}/${max}</div>`;
    let equip = "";
    if (a.kind === "active") {
      let btns = "";
      for (let slot = 1; slot <= 4; slot++) {
        const on = S.loadout[slot - 1] === a.skillN;
        btns += `<button type="button" class="equip-btn${on ? " active" : ""}" title="${esc(t("ability.equipSlot", slot))}" data-slot="${slot}" data-n="${a.skillN}" ${rank < 1 ? "disabled" : ""}>${slot}</button>`;
      }
      equip = `<div class="node-equip">${btns}</div>`;
    }
    const tip = `${a.name} — ${a.desc} ${a.perRankDesc || ""}`;
    return `<div class="ability-node ${a.kind}${rank > 0 ? " owned" : ""}${locked ? " locked" : ""}" title="${esc(tip)}">
      <div class="node-circle">${icon}<span class="node-rank">${rank}/${max}</span></div>
      <div class="node-pips">${pips}</div>
      <div class="node-name">${esc(a.name)}<span class="ability-kind ${a.kind}">${t(a.kind === "active" ? "ability.active" : "ability.passive")}</span></div>
      ${locked
        ? `<div class="ability-req">${t("ability.needMore", tierReq(a.tier))}</div>`
        : rank >= max
          ? `<div class="ability-max">${t("ability.maxed")}</div>`
          : `<button type="button" class="btn ability-btn" data-id="${a.id}" ${canUp ? "" : "disabled"}>${rank === 0 ? t("ability.unlock") : t("ability.upgrade")} (${rank}→${rank + 1})</button>`}
      ${equip}
    </div>`;
  };

  // Tier rows stack top-to-bottom (tier 1 first, so the base skills are
  // visible without scrolling), each gate describing what the next row down needs.
  let html = '<div class="ability-tree">';
  html += `<div class="ability-gate ability-root">${t("ability.tier", 1)} · ${t("ability.baseGate")}</div>`;
  for (const tier of [1, 2, 3]) {
    const nodes = byTier[tier] || [];
    if (!nodes.length) continue;
    html += `<div class="ability-tier-row" data-tier="${tier}">${nodes.map(nodeHtml).join("")}</div>`;
    if (tier < 3) html += `<div class="ability-gate">${t("ability.tier", tier + 1)} · ${t("ability.needMore", tierReq(tier + 1))}</div>`;
  }
  html += "</div>";
  b.innerHTML = html;

  b.querySelectorAll(".node-canvas").forEach((cv) => {
    const n = +cv.dataset.skillN;
    const g = cv.getContext("2d");
    g.save();
    g.scale(cv.width / 52, cv.height / 52);
    skillIcon(g, S.myCls, n);
    g.restore();
  });
  b.querySelectorAll(".ability-btn").forEach((btn) => btn.addEventListener("click", () => {
    send({ t: "ability_alloc", id: btn.dataset.id });
  }));
  b.querySelectorAll(".equip-btn").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const slot = +btn.dataset.slot, n = +btn.dataset.n;
    // Click an unassigned skill into the slot; click the already-assigned one again to clear it.
    const next = S.loadout[slot - 1] === n ? 0 : n;
    S.loadout[slot - 1] = next;
    send({ t: "skill_equip", slot, n: next });
    buildSkillbar();
    renderAbilities();
  }));
}
function renderQuests() {
  const y = S.you;
  if (!y)
    return;
  const b = $("questBody");
  const qs = y.quests || {};
  const ids = Object.keys(qs);
  if (!ids.length) {
    b.innerHTML = '<div style="color:var(--ink-dim);font-style:italic">Busca al Anciano Nikandros en Helike.</div>';
    return;
  }
  let html = "";
  for (const qid of ids.sort()) {
    const q = qs[qid], meta = QUEST_META[qid] || { name: qid, goal: "", count: 1 };
    if (q.turned) {
      html += `<div class="quest"><div class="q-name done">✓ ${meta.name}</div></div>`;
      continue;
    }
    const cnt = meta.count || 1;
    const prog = q.n ?? 0;
    const pc = clamp(prog / cnt, 0, 1) * 100;
    const complete = !!q.done || prog >= cnt;
    html += `<div class="quest">
      <div class="q-name${complete ? " done" : ""}">${meta.name}${complete ? " — vuelve con el Anciano" : ""}</div>
      <div class="q-desc">${meta.goal}</div>
      <div class="q-prog"><div style="width:${pc}%"></div></div>
      <div class="q-prog-label">${Math.min(prog, cnt)} / ${cnt}</div>
    </div>`;
  }
  b.innerHTML = html;
  updateQuestTracker();
}

function renderLootLog() {
  const body = $("lootLogBody");
  const panel = $("lootLogPanel");
  if (!body || !panel) return;
  panel.classList.toggle("hidden", !S.showLootLog);
  const rows = S.lootLog || [];
  if (!rows.length) {
    body.innerHTML = `<div class="log-empty">${t("lootlog.empty")}</div>`;
    return;
  }
  body.innerHTML = rows.slice(0, 12).map((e) => {
    const when = e.at ? new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const extra = e.gold ? ` <span class="log-gold">+${e.gold}g</span>` : "";
    const rarity = e.rarity || "common";
    return `<div class="log-row"><span class="log-name ${rarity}">${e.name || "?"}</span>${extra}<span class="log-time">${when}</span></div>`;
  }).join("");
}
function renderCombatLog() {
  const body = $("combatLogBody");
  const panel = $("combatLogPanel");
  if (!body || !panel) return;
  panel.classList.toggle("hidden", !S.showCombatLog);
  const rows = S.combatLog || [];
  if (!rows.length) {
    body.innerHTML = `<div class="log-empty">${t("combatlog.empty")}</div>`;
    return;
  }
  body.innerHTML = rows.slice(0, 14).map((e) => {
    const when = e.at ? new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    return `<div class="log-row"><span class="log-src">${e.src || "?"}</span><span class="log-dmg">-${e.dmg || 0}</span><span class="log-time">${when}</span></div>`;
  }).join("");
}
function renderMeter() {
  const body = $("meterBody");
  const panel = $("meterPanel");
  if (!body || !panel) return;
  panel.classList.toggle("hidden", !S.showMeter);
  const m = S.meter || {};
  const secs = Math.max(1, Math.floor((Date.now() - (m.t0 || Date.now())) / 1000));
  const dps = Math.round((m.dealt || 0) / secs);
  body.innerHTML = [
    ["meter.dealt", m.dealt || 0],
    ["meter.taken", m.taken || 0],
    ["meter.healed", m.healed || 0],
    ["meter.kills", m.kills || 0],
    ["meter.deaths", m.deaths || 0],
    ["meter.dps", dps],
  ].map(([k, v]) => `<div class="meter-row"><span>${t(k)}</span><b>${v}</b></div>`).join("");
}
function renderAchs() {
  const body = $("achBody");
  if (!body) return;
  const a = S.achs || { unlocked: [], defs: [], killCount: 0, goldEarned: 0 };
  const unlocked = new Set(a.unlocked || []);
  const defs = a.defs || [];
  if (!defs.length) {
    body.innerHTML = `<div class="log-empty">${t("achs.empty")}</div>`;
    return;
  }
  const stats = `<div class="ach-stats">${t("achs.stats", a.killCount || 0, a.goldEarned || 0)}</div>`;
  const rows = defs.map((d) => {
    const on = unlocked.has(d.id);
    return `<div class="ach-row${on ? " on" : ""}"><span class="ach-name">${on ? "✓ " : ""}${d.name}</span><span class="ach-gold">+${d.gold}g</span><span class="ach-desc">${d.desc}</span></div>`;
  }).join("");
  body.innerHTML = stats + rows;
}
var LS_FRIENDS = "aot_friends";
function loadFriends() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_FRIENDS) || "[]");
    S.friends = Array.isArray(raw) ? raw.filter((n) => typeof n === "string").slice(0, 40) : [];
  } catch (_) { S.friends = []; }
}
function saveFriends() {
  try { localStorage.setItem(LS_FRIENDS, JSON.stringify(S.friends || [])); } catch (_) {}
}
function isFriend(name) {
  return (S.friends || []).some((n) => n.toLowerCase() === String(name || "").toLowerCase());
}
function toggleFriend(name) {
  if (!name || name === S.myName) return;
  const key = String(name);
  if (isFriend(key)) S.friends = S.friends.filter((n) => n.toLowerCase() !== key.toLowerCase());
  else {
    S.friends.push(key);
    if (S.friends.length > 40) S.friends = S.friends.slice(-40);
  }
  saveFriends();
  renderWho();
}
function toggleWhoPanel() {
  const was = $("whoPanel").classList.contains("hidden");
  togglePanel("whoPanel");
  if (was) {
    send({ t: "who" });
    renderWho();
  }
}
function setWhoTab(tab) {
  S.whoTab = tab === "friends" ? "friends" : "online";
  document.querySelectorAll(".who-tab").forEach((b) => b.classList.toggle("active", b.dataset.who === S.whoTab));
  renderWho();
}
function renderWho() {
  const body = $("whoBody");
  if (!body) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const online = S.whoList || [];
  const byName = new Map(online.map((p) => [String(p.name).toLowerCase(), p]));
  let rows = [];
  if (S.whoTab === "friends") {
    const friends = S.friends || [];
    if (!friends.length) {
      body.innerHTML = `<div class="who-empty">${t("who.friendsEmpty")}</div>`;
      return;
    }
    rows = friends.map((name) => {
      const p = byName.get(name.toLowerCase());
      return p || { name, cls: "?", lvl: "?", zone: "—", id: 0, bot: 0, offline: true };
    });
  } else {
    rows = online.slice();
  }
  if (!rows.length) {
    body.innerHTML = `<div class="who-empty">${t("who.empty")}</div>`;
    return;
  }
  const clsName = (c) => (CLS_ES[c] || c || "?");
  body.innerHTML = `<div class="who-acts" style="justify-content:flex-end;margin-bottom:4px"><button type="button" id="whoRefresh">${t("who.refresh")}</button></div>` + rows.map((p) => {
    const friend = isFriend(p.name);
    const self = p.name === S.myName;
    const offline = !!p.offline && !p.id;
    const bot = !!p.bot;
    const acts = [];
    if (!self && !offline) {
      acts.push(`<button type="button" data-wact="whisper" data-name="${esc(p.name)}">${t("who.whisper")}</button>`);
      if (p.id) acts.push(`<button type="button" data-wact="invite" data-id="${p.id}">${t("who.invite")}</button>`);
    }
    if (!self) acts.push(`<button type="button" data-wact="friend" data-name="${esc(p.name)}">${friend ? t("who.friendDel") : "★ " + t("who.friendAdd")}</button>`);
    return `<div class="who-row${bot ? " bot" : ""}${friend ? " friend" : ""}">
      <span class="who-name">${esc(p.name)}${bot ? " · IA" : ""}${offline ? " · offline" : ""}</span>
      <span class="who-acts">${acts.join("")}</span>
      <span class="who-meta">Nv ${p.lvl} · ${esc(clsName(p.cls))} · ${esc(p.zone || "—")}</span>
    </div>`;
  }).join("");
  const ref = $("whoRefresh");
  if (ref) ref.onclick = () => send({ t: "who" });
  body.querySelectorAll("[data-wact]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.wact;
      if (act === "whisper") {
        const inp = $("chatInput");
        if (inp) {
          inp.value = `/w ${btn.dataset.name} `;
          inp.focus();
          if (isMobileUi()) setChatOpen(true);
        }
      } else if (act === "invite") {
        const id = Number(btn.dataset.id);
        if (id) send({ t: "party_invite", id });
      } else if (act === "friend") {
        toggleFriend(btn.dataset.name);
      }
    });
  });
}
function updateQuestTracker() {
  const el = $("questTracker");
  if (!el) return;
  const y = S.you;
  const qs = (y && y.quests) || {};
  const rows = [];
  for (const qid of Object.keys(qs).sort()) {
    const q = qs[qid];
    const meta = QUEST_META[qid];
    if (!q || q.turned || !meta) continue;
    const cnt = meta.count || 1;
    const prog = Math.min(q.n ?? 0, cnt);
    const done = !!q.done || prog >= cnt;
    rows.push(`<div class="qt-row${done ? " done" : ""}"><span class="qt-name">${meta.name}</span><span class="qt-n">${prog}/${cnt}</span></div>`);
    if (rows.length >= 4) break;
  }
  if (!rows.length) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="qt-title">Misiones</div>` + rows.join("");
  el.classList.remove("hidden");
}
function renderDeathRecap() {
  const el = $("deathRecap");
  if (!el) return;
  const hits = S.deathRecap || [];
  if (!hits.length) { el.innerHTML = ""; return; }
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  el.innerHTML = `<div class="recap-title">${t("death.recap")}</div>` +
    hits.map((h) => `<div class="recap-row"><span>${esc(h.n)}</span><b>${h.a}</b></div>`).join("");
}
function showInspect(m) {
  const panel = $("inspectPanel");
  if (!panel) return;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const cls = CLS_ES[m.cls] || m.cls || "";
  let html = `<div class="panel-title"><span>${t("inspect.title")}</span> <span class="panel-x" data-close="inspectPanel">✕</span></div>`;
  html += `<div class="inspect-head"><b>${esc(m.name || "")}</b> · ${esc(cls)} · Nv ${m.lvl || "?"}</div>`;
  if (m.pet && PET_LABELS[m.pet]) html += `<div class="inspect-pet">${t("inspect.pet")}: ${esc(PET_LABELS[m.pet].name)}</div>`;
  const eq = m.eq || {};
  let any = false;
  html += `<div class="inspect-eq">`;
  for (const s of ["weapon", "armor", "helm", "ring"]) {
    const it = eq[s];
    if (!it) continue;
    any = true;
    html += `<div class="inspect-slot r-${esc(it.rarity || "common")}"><span class="is-slot">${s}</span><span class="is-name">${esc(it.name)}</span></div>`;
  }
  html += `</div>`;
  if (!any) html += `<div class="inspect-empty">${t("inspect.empty")}</div>`;
  html += `<button type="button" class="btn" id="inspectCloseBtn">${t("inspect.close")}</button>`;
  panel.innerHTML = html;
  revealPanel(panel);
  const x = panel.querySelector(".panel-x");
  if (x) x.addEventListener("click", () => panel.classList.add("hidden"));
  const c = $("inspectCloseBtn");
  if (c) c.addEventListener("click", () => panel.classList.add("hidden"));
}
function showDialog(m) {
  closeCityPanels("dialogPanel");
  const p = $("dialogPanel");
  $("dialogName").innerHTML = `${m.name} <span class="panel-x" data-close="dialogPanel">✕</span>`;
  $("dialogName").querySelector(".panel-x").addEventListener("click", () => p.classList.add("hidden"));
  const b = $("dialogBody");
  let html = (m.lines || []).map((l) => `<div class="line">“${l}”</div>`).join("");
  b.innerHTML = html;
  for (const q of m.quests || []) {
    const d = document.createElement("div");
    d.className = "d-quest" + (q.state === "locked" ? " locked" : "");
    let inner = `<div class="dq-name">${q.name}</div><div class="dq-desc">${q.desc}</div>`;
    const rew = q.rew || {};
    inner += `<div class="dq-rew">Recompensa: ${rew.xp} XP, ${rew.gold} de oro${rew.item ? ", " + rew.item : ""}</div>`;
    d.innerHTML = inner;
    const btn = document.createElement("button");
    if (q.state === "available") {
      btn.className = "btn";
      btn.textContent = "Aceptar";
      btn.addEventListener("click", () => {
        send({ t: "quest_accept", qid: q.qid });
      });
    } else if (q.state === "complete") {
      btn.className = "btn green";
      btn.textContent = "Entregar";
      btn.addEventListener("click", () => {
        send({ t: "quest_turnin", qid: q.qid });
      });
    } else if (q.state === "active") {
      btn.className = "btn ghost";
      btn.textContent = `En curso — ${q.n} / ${q.count}`;
    } else if (q.state === "turned") {
      btn.className = "btn ghost";
      btn.textContent = "Completada ✓";
    } else {
      btn.className = "btn ghost";
      btn.textContent = "Bloqueada — termina la tarea anterior";
    }
    d.appendChild(btn);
    b.appendChild(d);
  }
  revealPanel(p);
}
var _boardTick = null;
function updateBoardFormState() {
  const form = $("boardForm"), input = $("boardInput"), status = $("boardStatus");
  if (!form || !status) return;
  const meta = S.boardMeta;
  const now = Date.now();
  if (meta.isMod) {
    // Moderators always get a slot free (they can also clean up others').
    form.classList.remove("hidden");
    input.disabled = false;
    status.textContent = "";
    return;
  }
  if (meta.hasActive) {
    form.classList.add("hidden");
    status.textContent = t("board.hasActive");
    return;
  }
  if (meta.cooldownUntil > now) {
    form.classList.add("hidden");
    status.textContent = t("board.cooldown", Math.ceil((meta.cooldownUntil - now) / 1000));
    return;
  }
  form.classList.remove("hidden");
  input.disabled = false;
  status.textContent = "";
}
function initBoard() {
  const form = $("boardForm"), input = $("boardInput"), count = $("boardCount");
  if (!form || !input) return;
  const updateCount = () => { if (count) count.textContent = `${input.value.length}/240`; };
  input.addEventListener("input", updateCount);
  updateCount();
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send({ t: "board_post", text });
    input.value = "";
    updateCount();
  });
  // Live-refresh the cooldown countdown / re-enable the form once it elapses,
  // without waiting for the next server push — only ticks while the panel is open.
  _boardTick = setInterval(() => {
    if (!$("boardPanel").classList.contains("hidden")) updateBoardFormState();
  }, 1000);
}
function showBoard(m) {
  closeCityPanels("boardPanel");
  S.boardEntries = m.entries || [];
  S.boardMeta = { isMod: !!m.isMod, hasActive: !!m.hasActive, cooldownUntil: m.cooldownUntil || 0 };
  revealPanel("boardPanel");
  renderBoard(S.boardEntries);
  updateBoardFormState();
}
function renderBoard(entries) {
  const b = $("boardBody");
  if (!entries.length) {
    b.innerHTML = `<p class="board-empty">${t("board.empty")}</p>`;
    return;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const mod = S.boardMeta.isMod;
  b.innerHTML = entries.map((e) => {
    const d = new Date(e.ts);
    const stamp = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const modBtns = mod
      ? `<div class="board-mod-btns">
           <button type="button" class="board-mod-btn" data-act="edit" data-id="${e.id}">${t("board.edit")}</button>
           <button type="button" class="board-mod-btn danger" data-act="delete" data-id="${e.id}">${t("board.delete")}</button>
         </div>`
      : "";
    return `<div class="board-row"><div class="board-meta">${t("board.posted", esc(e.author), stamp)}</div><div class="board-text">${esc(e.text)}</div>${modBtns}</div>`;
  }).join("");
  if (mod) {
    b.querySelectorAll(".board-mod-btn").forEach((btn) => btn.addEventListener("click", () => {
      const id = +btn.dataset.id;
      if (btn.dataset.act === "delete") {
        send({ t: "board_delete", id });
      } else {
        const entry = entries.find((e) => e.id === id);
        const next = prompt(t("board.editPrompt"), entry ? entry.text : "");
        if (next != null && next.trim()) send({ t: "board_edit", id, text: next.trim().slice(0, 240) });
      }
    }));
  }
}
function showShop(m) {
  closeCityPanels("shopPanel");
  S.shopOpen = true;
  S.shopNpc = m.npc;
  S.shopItems = m.items || [];
  $("shopName").innerHTML = `${m.name} — Mercancía <span class="panel-x" data-close="shopPanel">✕</span>`;
  $("shopName").querySelector(".panel-x").addEventListener("click", () => {
    $("shopPanel").classList.add("hidden");
    S.shopOpen = false;
    renderInventory();
  });
  renderShop();
  revealPanel("shopPanel");
  revealPanel("invPanel");
  renderInventory();
}
function renderShop() {
  const b = $("shopBody");
  b.innerHTML = "";
  for (const { idx, item, price } of S.shopItems) {
    const row = document.createElement("div");
    row.className = "shop-item";
    const cv = document.createElement("canvas");
    cv.width = 34;
    cv.height = 34;
    drawItemIcon(cv.getContext("2d"), item.icon, item.rarity, 17, 17, 24);
    row.appendChild(cv);
    const nm = document.createElement("div");
    nm.className = `si-name ${item.rarity}`;
    nm.textContent = item.name;
    row.appendChild(nm);
    const pr = document.createElement("div");
    pr.className = "si-price";
    pr.textContent = `${price} g`;
    row.appendChild(pr);
    const buy = document.createElement("button");
    buy.className = "btn";
    buy.textContent = "Comprar";
    if (S.you && S.you.gold < price) {
      buy.className = "btn ghost";
    } else
      buy.addEventListener("click", () => send({ t: "buy", npc: S.shopNpc, idx }));
    row.appendChild(buy);
    const act = `Comprar por ${price} de oro`;
    row._tip = { item, action: act };
    row.addEventListener("mousemove", (e) => showTooltip(e, item, act));
    row.addEventListener("mouseleave", hideTooltip);
    b.appendChild(row);
  }
  // Buyback list (session sales) under the live stock.
  const bbTitle = document.createElement("div");
  bbTitle.className = "shop-buyback-title";
  bbTitle.textContent = t("shop.buyback");
  b.appendChild(bbTitle);
  const bb = S.buyback || [];
  if (!bb.length) {
    const empty = document.createElement("div");
    empty.className = "shop-buyback-empty";
    empty.textContent = t("shop.buybackEmpty");
    b.appendChild(empty);
  } else {
    for (const { idx, item, price } of bb) {
      const row = document.createElement("div");
      row.className = "shop-item buyback";
      const cv = document.createElement("canvas");
      cv.width = 34; cv.height = 34;
      drawItemIcon(cv.getContext("2d"), item.icon, item.rarity, 17, 17, 24);
      row.appendChild(cv);
      const nm = document.createElement("div");
      nm.className = `si-name ${item.rarity}`;
      nm.textContent = item.name;
      row.appendChild(nm);
      const pr = document.createElement("div");
      pr.className = "si-price";
      pr.textContent = `${price} g`;
      row.appendChild(pr);
      const buy = document.createElement("button");
      buy.className = "btn";
      buy.textContent = t("shop.rebuy");
      if (S.you && S.you.gold < price) buy.className = "btn ghost";
      else buy.addEventListener("click", () => send({ t: "buyback", idx }));
      row.appendChild(buy);
      const act = `${t("shop.rebuy")} por ${price} de oro`;
      row._tip = { item, action: act };
      row.addEventListener("mousemove", (e) => showTooltip(e, item, act));
      row.addEventListener("mouseleave", hideTooltip);
      b.appendChild(row);
    }
  }
  $("shopGold").textContent = S.you ? `Tu oro: ${S.you.gold}` : "";
  refreshHoverTooltip();
}
function showStash(m) {
  closeCityPanels("stashPanel");
  S.stashOpen = true;
  S.stash = m.items || [];
  renderStash();
  revealPanel("stashPanel");
  revealPanel("invPanel");
  renderInventory();
}
function drawPetIcon(g, id, cx, cy, size) {
  const s = size / 20;
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.lineCap = "round";
  g.lineJoin = "round";
  switch (id) {
    case "dog":
      g.fillStyle = "#c68a4a";
      g.beginPath(); g.arc(0, 1, 7, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.2)"; g.beginPath(); g.arc(-2.6, -1.6, 3, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.arc(2.8, 3, 3, 0, 7); g.fill();
      g.restore();
      g.beginPath(); g.moveTo(-6, -3); g.lineTo(-9, -9); g.lineTo(-3, -5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(6, -3); g.lineTo(9, -9); g.lineTo(3, -5); g.closePath(); g.fill();
      g.fillStyle = "#2a1a0c";
      g.beginPath(); g.arc(-2.5, 0, 1, 0, 7); g.fill();
      g.beginPath(); g.arc(2.5, 0, 1, 0, 7); g.fill();
      g.beginPath(); g.arc(0, 3, 1.2, 0, 7); g.fill();
      break;
    case "cat":
      g.fillStyle = "#8b8b93";
      g.beginPath(); g.arc(0, 1, 7, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.2)"; g.beginPath(); g.arc(-2.6, -1.6, 3, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.arc(2.8, 3, 3, 0, 7); g.fill();
      g.restore();
      g.beginPath(); g.moveTo(-6, -4); g.lineTo(-8, -10); g.lineTo(-2, -6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(6, -4); g.lineTo(8, -10); g.lineTo(2, -6); g.closePath(); g.fill();
      g.fillStyle = "#12100b";
      g.beginPath(); g.arc(-2.5, -0.5, 1, 0, 7); g.fill();
      g.beginPath(); g.arc(2.5, -0.5, 1, 0, 7); g.fill();
      g.strokeStyle = "#e8e8ec"; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(-1, 3); g.lineTo(-6, 2); g.moveTo(1, 3); g.lineTo(6, 2); g.stroke();
      break;
    case "owl":
      g.fillStyle = "#8a6a45";
      g.beginPath(); g.arc(0, 0, 7.5, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(-2.8, -2.8, 3.2, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.arc(3, 3, 3.2, 0, 7); g.fill();
      g.restore();
      g.fillStyle = "#e8dcc0";
      g.beginPath(); g.arc(-3, -1, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(3, -1, 3, 0, 7); g.fill();
      g.fillStyle = "#1a1206";
      g.beginPath(); g.arc(-3, -1, 1.3, 0, 7); g.fill();
      g.beginPath(); g.arc(3, -1, 1.3, 0, 7); g.fill();
      g.fillStyle = "#d9922e";
      g.beginPath(); g.moveTo(-1, 2); g.lineTo(1, 2); g.lineTo(0, 4.5); g.closePath(); g.fill();
      break;
    case "turtle":
      g.fillStyle = "#4c6e35";
      g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.arc(-2.6, -2.6, 3, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.16)"; g.beginPath(); g.arc(2.8, 2.8, 3, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = "#2f4a20"; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 7); g.moveTo(-6, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = "#7ba14f";
      g.beginPath(); g.arc(-8, 0, 2, 0, 7); g.fill();
      g.beginPath(); g.arc(8, 0, 2, 0, 7); g.fill();
      break;
    case "fox":
      g.fillStyle = "#d4782e";
      g.beginPath(); g.arc(0, 1, 6.5, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.arc(-2.4, -1.4, 2.8, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.arc(2.6, 2.8, 2.8, 0, 7); g.fill();
      g.restore();
      g.beginPath(); g.moveTo(-5.5, -3); g.lineTo(-8.5, -10); g.lineTo(-2, -5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(5.5, -3); g.lineTo(8.5, -10); g.lineTo(2, -5); g.closePath(); g.fill();
      g.fillStyle = "#f2e6d0";
      g.beginPath(); g.ellipse(0, 3.2, 3.2, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = "#1a0e06";
      g.beginPath(); g.arc(-2.2, 0, 0.9, 0, 7); g.fill();
      g.beginPath(); g.arc(2.2, 0, 0.9, 0, 7); g.fill();
      g.beginPath(); g.arc(0, 2.2, 0.9, 0, 7); g.fill();
      break;
    case "hawk":
      g.fillStyle = "#6b4e32";
      g.beginPath(); g.moveTo(0, -8); g.lineTo(7, 2); g.lineTo(0, 7); g.lineTo(-7, 2); g.closePath(); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.arc(-2, -2, 3, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.arc(2.5, 3, 3, 0, 7); g.fill();
      g.restore();
      g.fillStyle = "#c9a46a";
      g.beginPath(); g.arc(-2.2, -1, 1.8, 0, 7); g.fill();
      g.beginPath(); g.arc(2.2, -1, 1.8, 0, 7); g.fill();
      g.fillStyle = "#1a1206";
      g.beginPath(); g.arc(-2.2, -1, 0.8, 0, 7); g.fill();
      g.beginPath(); g.arc(2.2, -1, 0.8, 0, 7); g.fill();
      g.fillStyle = "#e09a2e";
      g.beginPath(); g.moveTo(-1, 2); g.lineTo(1, 2); g.lineTo(0, 5); g.closePath(); g.fill();
      g.strokeStyle = "#4a3420"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(-3, 1); g.moveTo(8, 0); g.lineTo(3, 1); g.stroke();
      break;
    case "raven":
      g.fillStyle = "#2a2a32";
      g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
      g.save(); g.clip();
      g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.arc(-2.6, -2.4, 3, 0, 7); g.fill();
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(2.8, 2.8, 3, 0, 7); g.fill();
      g.restore();
      g.fillStyle = "#e8c84a";
      g.beginPath(); g.arc(-2.5, -0.5, 1.1, 0, 7); g.fill();
      g.beginPath(); g.arc(2.5, -0.5, 1.1, 0, 7); g.fill();
      g.fillStyle = "#111";
      g.beginPath(); g.arc(-2.5, -0.5, 0.45, 0, 7); g.fill();
      g.beginPath(); g.arc(2.5, -0.5, 0.45, 0, 7); g.fill();
      g.fillStyle = "#c9782a";
      g.beginPath(); g.moveTo(-1, 2); g.lineTo(1, 2); g.lineTo(0, 5); g.closePath(); g.fill();
      g.strokeStyle = "#1a1a22"; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-7, 1); g.quadraticCurveTo(-10, -2, -6, -5);
      g.moveTo(7, 1); g.quadraticCurveTo(10, -2, 6, -5); g.stroke();
      break;
    default:
      g.fillStyle = "#ccc";
      g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
  }
  g.restore();
}
function renderStash() {
  const grid = $("stashGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < S.stash.length; i++) {
    const item = S.stash[i];
    const d = document.createElement("div");
    d.className = "inv-slot" + (item ? ` full r-${item.rarity}` : "");
    if (item) {
      d.appendChild(slotCanvas(item, 46, 42));
      if (item.qty > 1) {
        const q = document.createElement("span");
        q.className = "qty";
        q.textContent = item.qty;
        d.appendChild(q);
      }
      const act = "Clic para retirar";
      d._tip = { item, action: act };
      d.addEventListener("mousemove", (e) => showTooltip(e, item, act));
      d.addEventListener("mouseleave", hideTooltip);
      const slot = i;
      d.addEventListener("click", () => send({ t: "stash_withdraw", slot }));
    }
    grid.appendChild(d);
  }
  refreshHoverTooltip();
}
function showPetShop(m) {
  closeCityPanels("petPanel");
  S.petShop = { defs: m.defs || [], owned: m.owned || [], active: m.active || null };
  renderPetShop();
  revealPanel("petPanel");
}
function renderPetShop() {
  const b = $("petBody");
  if (!b) return;
  b.innerHTML = "";
  const { defs, owned, active } = S.petShop;
  for (const def of defs) {
    const has = owned.includes(def.id);
    const row = document.createElement("div");
    row.className = "shop-item";
    const cv = document.createElement("canvas");
    cv.width = 34;
    cv.height = 34;
    drawPetIcon(cv.getContext("2d"), def.id, 17, 17, 24);
    row.appendChild(cv);
    const nm = document.createElement("div");
    nm.className = "si-name";
    nm.textContent = def.name;
    if (def.desc) {
      const desc = document.createElement("div");
      desc.className = "si-desc";
      desc.textContent = def.desc;
      nm.appendChild(desc);
    }
    row.appendChild(nm);
    if (!has) {
      const pr = document.createElement("div");
      pr.className = "si-price";
      pr.textContent = `${def.cost} g`;
      row.appendChild(pr);
      const buy = document.createElement("button");
      buy.className = "btn";
      buy.textContent = "Adoptar";
      if (S.you && S.you.gold < def.cost) buy.className = "btn ghost";
      else buy.addEventListener("click", () => send({ t: "pet_buy", id: def.id }));
      row.appendChild(buy);
    } else {
      const eq = document.createElement("button");
      const equipped = active === def.id;
      eq.className = "btn" + (equipped ? " ghost" : "");
      eq.textContent = equipped ? "Equipada" : "Equipar";
      if (!equipped) eq.addEventListener("click", () => send({ t: "pet_equip", id: def.id }));
      else eq.addEventListener("click", () => send({ t: "pet_equip", id: "" }));
      row.appendChild(eq);
    }
    b.appendChild(row);
  }
}
requireDom();
initLogin();
initMenu();
var PANEL_LAYOUT_KEY = "aot_panel_layout";
function loadPanelLayouts() {
  try { return JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) || "{}"); } catch (_) { return {}; }
}
function savePanelLayout(id, patch) {
  const all = loadPanelLayouts();
  all[id] = Object.assign({}, all[id], patch);
  try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(all)); } catch (_) {}
}
var WINDOW_IDS = ["worldMapPanel", "dialogPanel", "shopPanel", "stashPanel", "petPanel", "invPanel", "charPanel", "questPanel", "menuPanel", "boardPanel", "abilityPanel", "achPanel", "whoPanel", "inspectPanel"];
var WINDOW_GAP = 10;
function listOpenWindows(except) {
  const skip = except instanceof Set ? except : new Set(except ? [except] : []);
  const out = [];
  for (const id of WINDOW_IDS) {
    if (skip.has(id)) continue;
    const el = $(id);
    if (el && !el.classList.contains("hidden")) out.push(el);
  }
  return out;
}
function windowRect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}
function rectsOverlap(a, b, pad) {
  const p = pad == null ? WINDOW_GAP : pad;
  return !(a.right + p <= b.left || b.right + p <= a.left || a.bottom + p <= b.top || b.bottom + p <= a.top);
}
function setWindowPos(el, left, top) {
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "none";
}
function closeWindowsExcept(keepIds) {
  const keep = new Set(keepIds || []);
  let invDirty = false;
  for (const id of WINDOW_IDS) {
    if (keep.has(id)) continue;
    const el = $(id);
    if (!el || el.classList.contains("hidden")) continue;
    el.classList.add("hidden");
    if (id === "shopPanel" && S.shopOpen) { S.shopOpen = false; invDirty = true; }
    if (id === "stashPanel" && S.stashOpen) { S.stashOpen = false; invDirty = true; }
  }
  if (invDirty) renderInventory();
}
function findFreeWindowPos(el, prefLeft, prefTop) {
  const w = Math.max(120, el.offsetWidth || el.getBoundingClientRect().width || 280);
  const h = Math.max(80, el.offsetHeight || el.getBoundingClientRect().height || 180);
  const margin = 8;
  const maxL = Math.max(margin, window.innerWidth - w - margin);
  const maxT = Math.max(margin, window.innerHeight - h - margin);
  const others = listOpenWindows(el.id).map(windowRect);
  function fits(L, T) {
    const cand = { left: L, top: T, right: L + w, bottom: T + h };
    if (L < margin - 0.5 || T < margin - 0.5 || L > maxL + 0.5 || T > maxT + 0.5) return false;
    for (const o of others) {
      if (rectsOverlap(cand, o, WINDOW_GAP)) return false;
    }
    return true;
  }
  let L = clamp(prefLeft, margin, maxL);
  let T = clamp(prefTop, margin, maxT);
  if (fits(L, T)) return { left: L, top: T };
  const step = 24;
  for (let i = 1; i <= 48; i++) {
    const d = i * step;
    const tries = [
      [L + d, T], [L - d, T], [L, T + d], [L, T - d],
      [L + d, T + d], [L - d, T + d], [L + d, T - d], [L - d, T - d],
      [L + d, T + d / 2], [L - d, T + d / 2], [L + d / 2, T + d], [L + d / 2, T - d]
    ];
    for (const [x, y] of tries) {
      const nx = clamp(x, margin, maxL);
      const ny = clamp(y, margin, maxT);
      if (fits(nx, ny)) return { left: nx, top: ny };
    }
  }
  for (let y = margin; y <= maxT; y += step) {
    for (let x = margin; x <= maxL; x += step) {
      if (fits(x, y)) return { left: x, top: y };
    }
  }
  // Last resort: cascade from top-left (may still clip, but avoids stacking on same spot)
  const n = others.length;
  return { left: clamp(margin + (n % 8) * step, margin, maxL), top: clamp(56 + Math.floor(n / 8) * step + (n % 8) * step, margin, maxT) };
}
function placePanelNoOverlap(el) {
  if (!el) return;
  if (typeof isMobileUi === "function" && isMobileUi()) return;
  if (el.id === "worldMapPanel") {
    // Near-fullscreen map: exclusive — close every other window first.
    closeWindowsExcept(["worldMapPanel"]);
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.transform = "";
    return;
  }
  const wm = $("worldMapPanel");
  if (wm && !wm.classList.contains("hidden")) wm.classList.add("hidden");
  // Convert centered/transformed CSS into absolute coords before measuring.
  const r0 = el.getBoundingClientRect();
  setWindowPos(el, r0.left, r0.top);
  void el.offsetWidth;
  const pos = findFreeWindowPos(el, r0.left, r0.top);
  setWindowPos(el, pos.left, pos.top);
}
function revealPanel(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return null;
  const opening = el.classList.contains("hidden");
  if (typeof isMobileUi === "function" && isMobileUi()) {
    // Mobile bottom-sheet panels share one slot — keep only this window (+ paired inv).
    const keep = [el.id];
    if (el.id === "shopPanel" || el.id === "stashPanel") keep.push("invPanel");
    if (el.id === "invPanel" && (S.shopOpen || S.stashOpen)) {
      if (S.shopOpen) keep.push("shopPanel");
      if (S.stashOpen) keep.push("stashPanel");
    }
    closeWindowsExcept(keep);
    el.classList.remove("hidden");
    return el;
  }
  if (opening) {
    const layouts = loadPanelLayouts();
    const saved = layouts[el.id];
    el.classList.remove("hidden");
    if (saved && saved.left != null && saved.top != null) {
      setWindowPos(el, saved.left, saved.top);
    }
    void el.offsetWidth;
    placePanelNoOverlap(el);
  } else {
    // Already open: still ensure it isn't covering another window (e.g. shop re-open).
    placePanelNoOverlap(el);
  }
  return el;
}
function resolveDragOverlap(el) {
  if (!el || (typeof isMobileUi === "function" && isMobileUi())) return;
  const r = el.getBoundingClientRect();
  const pos = findFreeWindowPos(el, r.left, r.top);
  if (Math.abs(pos.left - r.left) > 0.5 || Math.abs(pos.top - r.top) > 0.5) {
    setWindowPos(el, pos.left, pos.top);
  }
}

function initDraggablePanels() {
  const layouts = loadPanelLayouts();
  document.querySelectorAll(".panel").forEach((panel) => {
    const id = panel.id;
    const title = panel.querySelector(".panel-title");
    if (!title) return;
    let collapseBtn = title.querySelector(".panel-collapse");
    if (!collapseBtn) {
      collapseBtn = document.createElement("span");
      collapseBtn.className = "panel-collapse";
      collapseBtn.textContent = "▾";
      collapseBtn.title = "Minimizar/expandir";
      const closeBtn = title.querySelector(".panel-x");
      if (closeBtn) title.insertBefore(collapseBtn, closeBtn);
      else title.appendChild(collapseBtn);
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = panel.classList.toggle("collapsed");
        collapseBtn.textContent = collapsed ? "▸" : "▾";
        savePanelLayout(id, { collapsed });
      });
    }
    const saved = layouts[id];
    if (saved) {
      if (saved.left != null && saved.top != null) {
        panel.style.left = saved.left + "px";
        panel.style.top = saved.top + "px";
        panel.style.right = "auto";
        panel.style.transform = "none";
      }
      if (saved.collapsed) {
        panel.classList.add("collapsed");
        collapseBtn.textContent = "▸";
      }
    }
    let dragging = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
    title.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || (typeof isMobileUi === "function" && isMobileUi())) return;
      if (e.target.closest(".panel-x, .panel-collapse")) return;
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + "px";
      panel.style.top = r.top + "px";
      panel.style.right = "auto";
      panel.style.transform = "none";
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      baseLeft = r.left; baseTop = r.top;
      panel.classList.add("dragging");
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const nx = clamp(baseLeft + (e.clientX - startX), 0, innerWidth - 60);
      const ny = clamp(baseTop + (e.clientY - startY), 0, innerHeight - 40);
      panel.style.left = nx + "px";
      panel.style.top = ny + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("dragging");
      resolveDragOverlap(panel);
      savePanelLayout(id, { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) });
    });
  });
}
function initAbilityReset() {
  const btn = $("abilityResetBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!confirm(t("ability.resetConfirm"))) return;
    send({ t: "ability_reset" });
  });
}
function initShopSellAll() {
  const map = { sellAllCommon: "common", sellAllMagic: "magic", sellAllRare: "rare" };
  for (const [id, rarity] of Object.entries(map)) {
    const btn = $(id);
    if (!btn) continue;
    btn.addEventListener("click", () => {
      const label = RARITY_ES[rarity] || rarity;
      if (!confirm(t("sell.all.confirm", label))) return;
      send({ t: "sell_all", rarity });
    });
  }
  const sortBtn = $("invSortBtn");
  if (sortBtn) sortBtn.addEventListener("click", () => send({ t: "inv_sort" }));
}
initBoard();
initAbilityReset();
initShopSellAll();
initDraggablePanels();
initMobileUi();
resize();
window.addEventListener("resize", () => { initMobileUi(); resize(); });
requestAnimationFrame(frame);
