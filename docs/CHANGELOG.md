## 2026-07-21 — Pesca y marca de muerte

- **Pesca (N / `/fish` / `/pescar`)**: junto al agua (fuera de la plaza) lanzas el
  sedal ~3s y capturas sardina/lubina/atún/ostra perlada. Se puede vender o comer
  (cura poca vida). Logros Pescador / Señor del mar.
- **Marca de muerte**: al caer queda una X roja en minimapa y mapa del mundo con
  las coords en un toast; se limpia al revivir.
- Cache bust `?v=20260908`.


## 2026-07-21 — Lista de jugadores y amigos (O)

- **Jugadores (O)**: panel con todos los conectados (nivel, clase, zona), botón
  para susurrar o invitar al grupo, y marcador de compañeros IA.
- **Amigos**: favoritos guardados en el navegador (★); pestaña Amigos muestra
  online/offline.
- Cache bust `?v=20260907`.


## 2026-07-21 — Logros, medidor de sesión, chat de grupo y pestañas

- **Logros (Y)**: 20 logros persistentes (bajas, jefes, niveles, misiones, mascota,
  grupo, oro, portales, rachas) con recompensa de oro y toast al desbloquearlos.
- **Medidor de sesión**: panel con daño infligido/recibido, curación, bajas, muertes
  y DPS de la sesión (opción en Menú → Opciones).
- **Chat de grupo**: `/p`, `/g` o `/grupo mensaje` solo a tu grupo.
- **Pestañas de chat**: Todo / Grupo / Susurro / Sistema.
- Cache bust `?v=20260906`.


## 2026-07-21 — Mapa del mundo, marca personal, coords y FPS

- **Mapa del mundo (M)**: overlay grande con zonas, jefes (y timers), grupo,
  objetivos de misión y tu posición. Clic = ping de grupo; Shift+clic = marca.
- **Marca personal**: Shift+clic en minimapa o mapa; se guarda en el navegador;
  triángulo cian en minimapa/mapa; botón para quitarla.
- **Coords HUD**: casilla X,Y bajo el minimapa.
- **FPS opcional**: casilla en Opciones (apagado por defecto).
- **Logs**: bots silencian casi todas las reconexiones (1ª + cada 50) y el startup
  ya no imprime la URL del WS.
- Cache bust `?v=20260905`.


## 2026-07-21 — Botín reciente, registro de combate y logs aún más limpios

- **Botín reciente**: panel lateral con los últimos recolectables/oro de la sesión
  (se actualiza al recoger y al ganar oro de kills; se puede ocultar en Opciones).
- **Registro de combate**: panel opcional con el daño recibido reciente (quién y cuánto).
- **Logs**: bots solo anuncian connected/online la primera vez; reconexiones y errores
  de sesión/tick mucho menos frecuentes (1ª + cada 20).
- Cache bust `?v=20260904`.


## 2026-07-21 — Tracker de misiones, recap de muerte, inspeccionar y gestos

- **Tracker de misiones**: HUD compacto a la izquierda con hasta 4 misiones activas
  y progreso (se oculta si no hay ninguna en curso).
- **Recap al morir**: el overlay muestra los últimos golpes recibidos (quién y cuánto).
- **Inspeccionar**: clic en otro jugador → botón para ver clase/nivel/equipo/mascota.
- **Gestos**: `/wave`, `/dance`, `/cheer`, `/bow` (también `/me …` y alias en español);
  emoji sobre la cabeza + línea de sistema cercana.
- **Bonus diario**: al entrar el primer login del día da oro según nivel (toast).
- **Logs**: errores de sesión/tick del bot aún más filtrados (primeros + cada N).
- Cache bust `?v=20260903`.


## 2026-07-21 — Recompra, susurros, pings de grupo y timers de jefes

- **Recompra en tienda**: los últimos 6 objetos vendidos en la sesión se pueden
  recuperar al mismo precio de venta (panel bajo el stock del mercader).
- **Ordenar inventario**: botón "Ordenar" compacta por rareza → tipo → tier.
- **Susurros**: `/w nombre mensaje` o `/susurro` (solo lo ven ambos).
- **Ping de grupo**: clic en el minimapa o tecla **G** marca una posición;
  el grupo ve el anillo en el mundo y en el minimapa (~6s).
- **Timers de jefes**: el minimapa muestra la cuenta regresiva de respawn
  cuando Polifemo/Asterión/Hidra están muertos.
- **Logs**: bots ya no spamean cada reconexión (solo las 2 primeras y luego
  cada 10); join/leave de compañeros no ensucian el chat del mundo.
- Cache bust `?v=20260902`.


## 2026-07-21 — Rachas, auto-pociones, minimapa y descanso en la fuente

- **Racha de bajas**: kills seguidos en ≤8s acumulan racha; HUD centrado desde ×2;
  hitos ×5/×10/×20 dan oro extra. Se reinicia al morir.
- **Auto-pociones** (menú Opciones): bebe sola con vida ≤35% y, en modo completo,
  maná ≤22%. No spamea avisos si no quedan pociones.
- **Comparar equipo**: el tooltip de un arma/armadura/yelmo/anillo muestra el
  delta frente a lo que ya llevas equipado (verde/rojo).
- **Minimapa**: jefes siempre marcados (diamante dorado); objetivos de misión
  activa resaltados en rosa; anillo si el jefe es el objetivo.
- **Descanso en la fuente**: 12s junto a la fuente fuera de combate → +20% XP
  durante 8 minutos (toast al activarse).
- **Loot raro**: toast al recoger un objeto raro.
- **Logs**: bot ya no imprime SIGTERM/SIGINT ni errores WS ruidosos de reconexión.
- Cache bust `?v=20260901`.


## 2026-07-21 — Misiones del Pantano, mascotas nuevas y logs limpios

- **Cadena de misiones q10–q12 (Pantano de la Hidra)**: tras Asterión, Nikandros
  envía a matar 12 hombres lagarto, 10 fuegos fatuos y finalmente a la Hidra de
  Lerna. Aceptar q10 (o entregar q9) desbloquea el portal del pantano; matar a
  la Hidra también lo desbloquea para el grupo cercano.
- **Mascotas nuevas**: Zorro (+8% velocidad), Halcón (+8% daño) y Cuervo (+30
  maná). Perks `spd`/`dmgp`/`mp` aplicados en `derive`. Al equipar/desequipar
  hay toast claro; el panel de Personaje muestra la mascota activa y su bono.
- **“Fetch” de mascota**: ~8% de probabilidad al matar de que tu compañero
  encuentre un poco de oro extra (toast corto, sin spamear).
- **Diálogos NPC**: líneas nuevas para Cofre, Criadero y Tablón; Nikandros
  menciona el pantano.
- **Logs**: bot companion deja de imprimir cada follow/invite/leave; startup del
  servidor y del bot más compactos. Errores y reconexión se mantienen.
- Cache bust `?v=20260831`.


## 2026-07-19 — Árboles de rango para todas las clases, daño plano, Pantano de la Hidra

- **Nuevo modelo de daño de habilidades (plano)**: se abandonó el % del daño del arma.
  Ahora `daño = base + porRango·(rango−1) + coef·stat primario` (guerrero=FUE,
  cazador=DES, mago/clérigo=INT); las habilidades con arma (guerrero/cazador) suman
  además el 50% del daño rodado del arma; los hechizos puros no. Crítico, armadura y
  el mod `dmgp%` del equipo funcionan igual que antes. Las curas del clérigo también
  pasan a valores planos que escalan con INT y el rango. Valores de rango 1 ajustados
  para igualar la salida del modelo anterior al nivel de desbloqueo (tabla en data.ts).
- **Árboles de habilidades con rangos para las 4 clases**: nodos de rango 1..5
  (1 punto por rango, 1 punto por subida de nivel), tiers desbloqueados por puntos
  TOTALES gastados (tier 1: 0, tier 2: 5, tier 3: 12). Los nodos activos desbloquean
  su habilidad en rango 1 (la habilidad 1 de cada clase siempre está disponible) y
  suben su daño/curación por rango; los pasivos dan bonos por rango (vida, armadura,
  crítico, daño, velocidad, regeneración, -enfriamiento...). El árbol del clérigo se
  reescribió a este modelo conservando sus temas; los clérigos existentes migran sus
  habilidades a rango 1 y reciben reembolso por los nodos eliminados. TODAS las
  clases reciben puntos retroactivos (1 por nivel ya ganado); nivel/oro/inventario/
  posición intactos. Panel H renovado: pips de rango, insignia Activa/Pasiva y botón
  de mejora por nodo; la barra de habilidades marca con "H" las que faltan por asignar.
- **El mundo crece a 224×224 — Pantano de la Hidra (nivel 21-25)**: nueva frontera al
  este cruzando dos vados sobre la vieja orilla (la vía principal y el ramal del
  laberinto). Hombres lagarto (21-23) y fuegos fatuos (23-25), y en lo hondo la jefa
  **Hidra de Lerna** (nivel 25, ~1.5x la vida de Asterión, 3 raros de tier 5).
  Equipo de **tier 5** (nivel 17+): Espada de Cronos, Hacha del Tártaro, Arco solar
  de Apolo, Bastón del Éter, Coraza del Tártaro, Yelmo de la Hidra y Sello de Cronos.
  Nuevo portal "Pantano de la Hidra" al visitarlo (o retroactivo a nivel 21+).
  El mapa clásico 160×160 no cambia ni una casilla (mismo SEED y orden de generación).
- **Monstruos mucho más repartidos**: separación mínima entre puntos de aparición
  2 → 6 casillas, y nunca a menos de 2 casillas de un camino — viajar por los caminos
  vuelve a ser seguro. Cantidades por zona reajustadas para caber con el nuevo espaciado
  (~113 puntos en total, +30 en el pantano).
- Cache bust `?v=20260814`.


## 2026-07-19 — Ayuda completa: cómo funciona el juego + controles faltantes

- **Panel de Ayuda (menú Esc) reescrito**: nueva sección "Cómo funciona" con 4 párrafos que
  explican el bucle del juego (elegir clase, subir de nivel, árbol de habilidades desde
  nivel 4), los NPCs del pueblo (Anciano/misiones, herrero-Circe/tienda, piedra de
  tránsito/portales, tablón de peticiones), muerte/revivir (30s automático o botón
  "Resucitar", santuario junto a la fuente) y grupos (invitar con clic, "Seguir" al líder,
  XP de caza compartida).
- **Controles que faltaban en la ayuda**: clic en otro jugador (invitar a grupo), botón
  "Seguir" del panel de grupo, clic en un NPC (hablar/comprar/portal/tablón), clic en la
  barra de XP (activar/desactivar ataque automático), arrastrar objeto fuera del inventario
  (tirarlo), clic en objeto con la tienda abierta + botones de venta masiva por rareza,
  joystick táctil en móvil. Ahora organizados en secciones: Movimiento, Combate y objetos,
  Paneles, Pueblo y grupo.
- Cache bust `?v=20260813`.


## 2026-07-19 — Afinación científica (C=256/512 Hz) en toda la audio

- **Audio — afinación "scientific pitch"**: se reemplazó A432 por el estándar de "afinación
  científica" (Sauveur), donde cada nota Do es una potencia de 2 exacta — Do4 = 256 Hz,
  Do5 = 512 Hz. Factor de conversión desde A440: ×(256/261.6256). Aplicado a **las 20**
  raíces de canciones y a **todos los tonos musicales de los efectos de sonido** (golpe
  sagrado, curación, subida de nivel, recoger objeto, invitación, chat, login, espada,
  flecha, muerte, clic de UI) — los sonidos de percusión/impacto sin altura definida
  (slash de ruido, hit, crit, fire) se dejaron intactos por diseño, no son notas.
- Cache bust `?v=20260811`.


## 2026-07-19 — Afinación A432, volumen y HUD

- **Audio — afinación "healing" A432**: todo el catálogo (17 pistas) se re-afinó de A440 a
  A432 (referencia Verdi/"healing") multiplicando cada raíz por 432/440; los intervalos de
  escala no cambian. Se agregaron 3 pistas nuevas en Mi menor (Aeolian) — misma familia
  modal que "Sombra de Circe" (Mi frigio) pero timbre/registro distintos, no una réplica:
  Manantial de Mnemósine, Susurro de las Náyades, Vela de los Dioscuros (20 pistas en total).
- **Audio — volumen**: música y efectos ~50% más fuertes por defecto (`musicGain` 0.28→0.42,
  `sfxGain` 0.85→1.275); se agregó un limitador (`DynamicsCompressorNode`) en el bus maestro
  para evitar recorte cuando se acumulan varias voces a este nivel más alto. Los sliders de
  volumen del menú siguen permitiendo bajarlo.
- **HUD**: Vida/Maná en el panel de Personaje ahora se redondean para mostrar (antes salían
  con decimales); la barra de HP/MP y el HUD principal ya redondeaban correctamente.
- Cache bust `?v=20260810`.


## 2026-07-19 — Árbol de habilidades del clérigo, moderación del tablón, venta masiva

- **Árbol de habilidades (clérigo)**: 10 pasivas en 3 tiers, 1 punto de habilidad por
  subida de nivel (`abilityPts`). Panel nuevo con tecla **H** (+ botón rápido en móvil).
  Bonos server-side: mhp/mmp, armadura, % crítico, potencia de curación, reducción de
  cooldowns, regeneración pasiva, radio de la fuente y radio de curación de grupo.
  Personajes clérigo existentes migrados con puntos retroactivos (1 por nivel ya ganado);
  stats/nivel/oro/inventario intactos.
- **Tablón de peticiones — moderación**: cada cuenta solo puede tener **una** petición
  activa a la vez (bloqueado con aviso claro en el panel, no solo un toast); el cooldown
  entre publicaciones se muestra con cuenta regresiva en vivo y deshabilita el formulario.
  Las cuentas `cansao`/`cansao2` pueden editar o borrar cualquier petición del tablón.
- **Barra de XP**: ahora hace doble función como interruptor de ataque automático — se quitó
  el botón `#autoAtkBtn` por separado, misma funcionalidad con menos UI.
- **Tienda**: botones de venta masiva por rareza (comunes / mágicos / raros) para no tener
  que confirmar la venta ítem por ítem.
- Cache bust `?v=20260808`.


## 2026-07-19 — Auto-revive, marco de objetivo y música renovada

- **Auto-revive (servidor)**: al morir, el jugador revive solo a los 30s (`REVIVE_MS`) sin
  tocar nada; el botón **Resucitar** sigue funcionando para saltarse la espera. `deadAt` +
  `reviveAt` viajan en el paquete `{t:"dead"}`, incluido en el reenvío de reconexión.
- **UI cliente**: overlay de muerte muestra cuenta regresiva ("Revives automáticamente en Ns").
  Nuevo `#targetFrame` arriba-centro con nombre/nivel/barra de vida del enemigo seleccionado
  (`S.targetId`), oculto si no hay objetivo válido.
- **Audio**: se encontró y corrigió `setMuted()` con una línea corrupta (`__omp_shell(...)`)
  que rompía el toggle de silencio — ahora `this.muted = m`. Se rehicieron 4 pistas que
  sonaban infantiles (escalas planas / rebote pentatónico rápido) con motivos sincopados,
  silencios y saltos de octava: Himno de la Fuente, Cacería de Artemisa, Luz de Asclepio,
  Descanso del Héroe. Se agregaron 6 pistas nuevas (18 en total): Sombra de Circe, Forja de
  Hefesto, Lamento de las Nereidas, Trueno de Zeus, Umbral del Inframundo, Coro de las Musas.
  Nombre de la pista actual visible junto al botón 🔊 (`#songLabel`).
- Cache bust `?v=20260802`.


## 2026-07-19 — Diario de misiones: progreso de kills/colección

- **Bug**: `renderQuests()` mostraba `q.done` (booleano) en vez de `q.n` (contador real) → siempre 0/N en curso, 1/N al completar.
- **Fix cliente**: barra y etiqueta usan `q.n`; cache-bust `?v=20260719` en `index.html`.
- **Fix servidor**: `syncCollectQuests()` al cargar personaje (cuernos en inventario); el asesino siempre recibe crédito de misión en `mobDie`.

[/opt/ideitas/rpg/LOG.md#F763]
1:## 2026-07-18 — Auto-contraataque en solitario
2:
3:- Si no estás en grupo y un monstruo te golpea, el servidor fija `atkTarget` a ese
4:  atacante (cuando no tienes ya un blanco vivo).
5:- No pisa WASD (`vel`): si te estás moviendo a propósito, no rebloquea el combate.
6:- Con grupo, el comportamiento no cambia (sigue siendo manual / seguir).
7:
8:## 2026-07-18 — Campos Asfódelos + Laberinto de Asterión
9:
10:- Nueva zona NE (**Campos Asfódelos**, lvl 16–20) con camino desde la ruta este.
11:- Nuevos enemigos: **sombra** (`shade`), **furia** (`fury`).
12:- Nuevo jefe: **Asterión** el Minotauro (laberinto, slam AoE, 3 rares, respawn 3 min).
13:- Misiones q7–q9 tras Polifemo; tope de nivel **25**.
14:- Skills recientes confirmadas: Clérigo 3 hace daño + ultimate 4; Guerrero ultimate 4.
15:
16:## 2026-07-18 — Achilles auto-skills (warrior)
17:
18:- Solo / party combat: Achilles now auto-casts warrior skills when a mob is in AoE range.
19:- Prefers strongest ready skill (4→1): Cólera titánica → Torbellino → Grito → Hendidura.
20:- Respects unlock level, mana cost, and local cooldown tracking from `welcome` skills.
21:
22:## 2026-07-18 — Skill cooldown no longer resets on spam
23:
24:- Client was optimistically setting `S.cds[n] = now+cd` on every keypress,
25:  so pressing a skill already on cooldown restarted the countdown.
26:- Fix: ignore recasts while local CD remains; if the server rejects a fresh
27:  cast (mana/range/target), roll back the optimistic CD via toast handler.
28:
29:## 2026-07-18 — Skill 4 ultimates (warrior/cleric) + Círculo daño
30:
31:- **Círculo sagrado** (cleric 3): ahora cura **y** hace 150% de daño sagrado en radio 4.
32:- Nuevo skill **4** (tecla `4`, unlock 12):
33:  - Guerrero: **Cólera titánica** — 350% AoE + 1s stun, radio 3.5, 28 mp / 20 s.
34:  - Clérigo: **Juicio de Zeus** — 320% AoE sagrado, radio 3.2, 26 mp / 18 s.
35:- Barra de skills ampliada a 4 slots; hunter/mage ocultan el 4º.
36:
37:## 2026-07-18 — Drag-to-drop harden
38:
39:- Native canvas drag blocked (`draggable=false`, `-webkit-user-drag:none`, `dragstart` cancel).
40:- Slot canvases use `pointer-events:none` so mousedown reliably hits the slot.
41:- Threshold lowered slightly; ghost/`drop-ok` still marks outside-panel release.
42:
43:## 2026-07-18 — Mobs no heal / no invuln on leash reset
44:
45:- Returning-to-spawn (`reset`) no longer full-heals the mob.
46:- Hitting a resetting mob draws aggro again (was ignored while `state==="reset"`).
47:- Idle out-of-combat regen unchanged; only death-respawn restores full HP.
48:
49:## 2026-07-18 — Tirar objetos: arrastrar fuera del inventario
50:
51:- Se quitó el clic derecho (abre el menú del navegador).
52:- Arrastra un ítem **fuera del panel de inventario** y suéltalo para tirarlo al suelo.
53:- Sigue siendo loot compartido; clic izquierdo (equipar/usar/vender) no cambia.
54:
55:## 2026-07-18 — Banda sonora ampliada (12 temas)
56:
57:- `audio.js` ahora tiene **12 canciones** procedurales distintas (modo, tempo,
58:  motivo y textura diferentes) y rota sola cada ~24–40 compases.
59:- Temas: Amanecer en Helike, Los Olivares, Ruinas de Argos, Hondonada de la
60:  Gorgona, Marcha de Polifemo, Himno de la Fuente, Vigilia Nocturna, Cacería
61:  de Artemisa, Luz de Asclepio, Brisa del Puerto, Eco del Titán, Descanso del
62:  Héroe.
63:
64:## 2026-07-18 — Achilles caza solo
65:
66:- Sin grupo, Achilles ya no sólo pasea la fuente: busca el enemigo más
67:  cercano (radio ~22) y lo ataca; si no hay ninguno a la vista, camina
68:  hacia Los Olivares hasta encontrar uno.
69:- Con grupo sigue igual (seguir al compañero + ayudar).
70:- Con vida baja (<55%) suelta el blanco y vuelve a la fuente.
71:
72:## 2026-07-18 — Tirar objetos al suelo
73:
74:- Nuevo `{t:"drop", slot}`: saca un ítem del inventario y lo deja como loot
75:  compartido en el suelo (cualquiera puede recogerlo). Las pilas tiran 1 unidad.
76:  Objetos de misión bloqueados.
77:- Cliente (final): **arrastrar fuera del inventario** (el clic derecho se quitó
78:  porque abre el menú del navegador).
79:
80:# La Era de los Titanes — registro de ideas y cambios
81:
82:Este archivo documenta cada característica añadida al juego en la medida que el
83:dueño las fue pidiendo, para tener un historial de cómo evolucionó. Se mantiene
84:a mano a partir de las conversaciones en el chat de desarrollo.
85:
86:## 2026-07-18 — WASD cancela auto-ataque
87:
88:- Bug: al clickear un enemigo quedabas en lock de ataque; WASD movía pero **seguías
89:  pegando en rango**, y al soltar te volvía a perseguir el mismo bicho (el cliente
90:  ya no manda `move`, que era lo único que limpiaba `atkTarget`).
91:- Fix: `dir` distinto de cero limpia `atkTarget`; click en suelo manda `attack id:0`
92:  para soltar el blanco; modo Seguir no re-hereda el target del líder mientras hay `vel`.
93:
94:## 2026-07-18 — Grupo persistente
95:
96:- El grupo ya no se pierde al desconectar, al expirar el linger ni al reiniciar el servidor.
97:- Membresía durable en SQLite (`parties` + `partyId` en el blob del jugador).
98:- Solo se sale con el botón **Salir** (`party_leave`). Los ausentes siguen en el roster (marcados offline).
99:
100:## 2026-07-18 — Fundación
101:
102:- **Idea inicial:** crear un MMORPG multijugador tipo Titan Quest en el navegador,
103:  en ideitas.online. Servidor Bun + protobuf JSON sobre WebSocket, cliente canvas
104:  vanilla JS. Mapa 160×160, zona segura Helike, 3 clases (Guerrero/Cazador/Mago),
105:  combate autoritativo servidor, tiendas, misiones, cofres, sistema de nivel.
106:
107:## 2026-07-18 — WASD
108:
109:- Sustituir click-to-move por movimiento con **WASD** (y flechas). Nuevo mensaje
110:  `dir` (velocidad normalizada). Click izquierdo conserva su función para atacar,
111:  hablar con NPCs, recoger botín.
112:
113:## 2026-07-18 — Click en otro jugador → menú de grupo
114:
115:- Click en un jugador abre menú contextual con "Invitar al grupo".
116:- El invitado recibe un cuadro flotante con las opciones Unirse/Rechazar.
117:- **XP compartida:** miembros del grupo dentro de 20 casillas del monstruo
118:  reparten la XP con bono de 15% por miembro extra. Crédito de misión de caza
119:  también se comparte.
120:- Marcos de grupo con barra de vida en la esquina superior izquierda.
121:- Reconexión automática dentro de 90s no destruye el grupo (party linger).
122:
123:## 2026-07-18 — Todo en español
124:
125:- Traducción completa: interfaz, misiones, objetos, diálogos, habilidades, zonas,
126:  toasts. "Polyphemus" → "Polifemo". Título "Age of Titans" → "La Era de los
127:  Titanes". Página principal actualizada.
128:
129:## 2026-07-18 — Animaciones de ataque
130:
131:- **Melee:** nuevo efecto visual de barrido de hoja (creciente con estela de
132:  movimiento), emitido en cada ataque cuerpo a cuerpo para jugadores y monstruos.
133:- **Arco:** flecha viajando hacia el blanco (ya existía, no se tocó).
134:- **Bastón:** proyectil de fuego hacia el blanco (ya existía, no se tocó).
135:
136:## 2026-07-18 — Teclas rápidas
137:
138:- **Q:** beber poción de vida (la primera en el inventario).
139:- **E:** beber poción de maná (la primera en el inventario).
140:- **L:** abrir/cerrar diario de misiones (antes era Q).
141:- **B:** volver a Helike (recall, 15s de enfriamiento).
142:
143:## 2026-07-18 — Modo "seguir" en grupo
144:
145:- Cada miembro del grupo tiene un botón "Seguir". Al activarlo, tu personaje:
146:  1. **Ataca automáticamente** el mismo blanco que el líder (solo cuando no estás
147:     ya atacando algo distinto tú mismo — tus elecciones manuales siempre ganan).
148:  2. **Camina solo** hacia el líder cuando estás en idle, quedándose a ~2 casillas.
149:  3. WASD interrumpe instantáneamente; al soltar las teclas, si sigues en modo
150:     seguir, retoma.
151:- El servidor sincroniza autoritativamente el estado vía `follow_state`.
152:
153:## 2026-07-18 — Fuente de Helike
154:
155:- Fuente circular de agua en el centro de la plaza de Helike (coordenada 30,79),
156:  entre Nikandros y los mercaderes. Tile 'F' (no transitable, renderiza un
157:  estanque de piedra con agua y un surtidor danzante en el centro).
158:- **Regeneración rápida:** estar cerca de la fuente regenera 10% vida/s + 12%
159:  maná/s (5× lo normal), incluso en combate. Hace de Helike un santuario real.
160:- **B (recall):** teletransporta a una posición aleatoria en el perímetro de la
161:  fuente. 15s de enfriamiento. Efecto visual de anillo + motas.
162:
163:
164:## 2026-07-18 — Aquiles compañero siempre online
165:
166:- Bot Bun sin LLM (`/opt/ideitas/rpg/bot.ts`) que mantiene al personaje de
167:  pruebas **Achilles** conectado 24/7 vía WebSocket al servidor local.
168:- Acepta invitaciones de grupo, sigue al humano con `party_follow`, ayuda en
169:  combates cercanos, patrulla la plaza de Helike y respawnea solo.
170:- Systemd: `ideitas-rpg-bot.service` con `Requires=`/`PartOf=` sobre
171:  `ideitas-rpg.service` (se enciende y apaga con el juego).
172:- Credenciales del bot en `/etc/ideitas/rpg-bot.env`.
173:- Cuenta hermana de tests **Circe** (mage) sigue existiendo en la DB para
174:  pruebas manuales; no tiene bot propio.
175:
176:## 2026-07-18 — Clérigo (4ª clase)
177:
178:- Nueva clase seleccionable al registrarse: **Clérigo** (`cleric`).
179:- Stats base 6/5/9 (str/dex/int), arma de clase: bastón.
180:- Habilidades: Oración (cura propia + al compañero más herido, 40%),
181:  Castigo divino (rayo sagrado), Círculo sagrado (cura de grupo).
182:  El servidor entiende skills de curación (`heal` / `healMostHurt` /
183:  `healParty`) además del daño.
184:- Cliente: 4ª carta en el selector, sprite blanco/dorado, iconos de skill.
185:
186:
187:## 2026-07-18 — Grupo hasta 10 + Aquiles selectivo
188:
189:- `PARTY_MAX` sube de 4 a **10** (invitaciones normales, mismo protocolo).
190:- El bot de Achilles solo acepta invitaciones de **cansao**, **cansao2** y **mayco**;
191:  cualquier otro jugador recibe `party_decline`.
192:
193:## 2026-07-18 — Música y efectos de sonido
194:
195:- Audio procedural con Web Audio API (`/var/www/ideitas.online/rpg/audio.js`), sin
196:  archivos mp3/ogg (encaja con el cliente sin assets).
197:- Música ambiental en bucle (pad + arpegio estilo eolio) al entrar al mundo.
198:- SFX: tajo, flecha, fuego, AoE, curación, crítico, daño, muerte, nivel, recall,
199:  chat, invitación de grupo, loot y UI.
200:- Botón 🔊/🔇 en el HUD; mute persistente en `localStorage`.
201:- Se desbloquea con el primer clic/tecla (requisito de autoplay del navegador).
202:
203:## Propuestas para futuro
204:
205:(Sin implementar, solo pensadas en papel.)
206:
207:- **Aquiles como compañero IA (LLM):** todavía opcional. Ya hay un bot simple
208:  siempre online (sin LLM); la versión con OpenRouter sigue documentada en
209:  `/opt/ideitas/rpg/AI_COMPANION.md`.
210:
211:## 2026-07-18 — Cleric heal tuning
212:- **Oración**: now heals **70% of missing HP** (`healMissing`) to self + most-hurt ally.
213:- Skill 2 **Castigo divino** replaced by **Himno sagrado**: party heal 30% max HP (radius 5).
214:- Círculo sagrado unchanged (30% party, unlock 8).
215:
216:## 2026-07-18 — Click-loot chase
217:- `pickup` now locks `lootTarget` and pathfinds to the item (same chase pattern as enemy click), then picks within 2 tiles.
218:- WASD / cancel / attack clears the loot lock. Enemy click logic unchanged aside from clearing loot lock.
219:
220:## 2026-07-18 — Tooltip stays after equip
221:- Clicking equip/unequip/use/sell no longer hides the item tooltip.
222:- Inventory re-render keeps the tip while the cursor stays in the panel.
223:## 2026-07-18 — Auto-attack HUD toggle
224:- Added `⚔ AUTO` button in `#hudInfo` (next to mute).
225:- When ON, client locks onto nearest enemy within 20 tiles (`tickAutoAtk`).
226:- Persists via `localStorage aot_autoatk`; WASD pauses retarget until you stop.
227:- Toggling OFF clears attack lock (`attack id:0`).
228:- Hard-refresh (`Ctrl+Shift+R`) to pick up client assets.
229:
230:## 2026-07-18 — Achilles ghost party fix
231:- Cleared durable Achilles↔mayco party that blocked new invites (`partyId` stuck).
232:- Bot now **leaves offline-only/ghost parties** automatically and **leave→accept** whitelist invites (`cansao` / `cansao2` / `mayco`).
233:- Achilles ahora hace **party_follow por id del roster** aunque el compañero no esté en su AOI (antes solo seguía si lo veía, y parecía “en grupo pero no”).
234:
235:## 2026-07-18 — Achilles auto-STR
236:
237:- Bot: cada `{t:"you"}` con `pts>0` manda `{t:"allot", stat:"str"}` hasta vaciar.
238:- Build fijo guerrero: **solo Fuerza** en cada subida de nivel.
239:- Puntos acumulados de Achilles aplicados a STR en DB.
240:
241:## 2026-07-18 — Campos Asfódelos visible + portales
242:
243:- **Map fix**: `tiles`/`walk` ahora se generan *después* del camino norte y el laberinto (antes el cliente no mostraba la ruta).
244:- **Portales**: NPC **Piedra de tránsito** en Helike (oeste de la plaza). Viaja a regiones visitadas.
245:- **Desbloqueo**: al pisar una zona, al entregar q6, al aceptar q7, o al matar a Polifemo → portal a Campos Asfódelos.
246:- **Marcadores**: obeliscos violetas en destinos desbloqueados.
247:## 2026-07-18 — Cuatro compañeros bot (una clase cada uno)
248:
249:- `bot.ts` genérico: `BOT_CLS` + `BOT_ALLOT` (str/dex/int) y skills automáticas por clase.
250:- Servicios systemd (siempre online, sin LLM):
251:  - **Achilles** (guerrero) → `ideitas-rpg-bot.service` — Fuerza
252:  - **Atalanta** (cazador) → `ideitas-rpg-bot-atalanta.service` — Destreza
253:  - **Circe** (mago) → `ideitas-rpg-bot-circe.service` — Inteligencia
254:  - **Chiron** (clérigo) → `ideitas-rpg-bot-chiron.service` — Inteligencia
255:- Credenciales en `/etc/ideitas/rpg-bot*.env` (invitaciones solo cansao/cansao2/mayco).

## 2026-07-18 — Escuadrón bot permanente + equipo básico

- Los cuatro bots (**Achilles**, **Atalanta**, **Circe**, **Chiron**) se unen automáticamente al mismo grupo durable (`ensureBotSquadParty` en `server.ts` al login).
- **Achilles** es el líder: los otros tres le siguen con `party_follow`; el líder solo sigue a humanos whitelist si están en el grupo.
- No abandonan el escuadrón por mates offline/AOI; invitaciones whitelist al bot → el humano se une automáticamente al escuadrón (`partyJoinHumanToBotSquad`).
- **Equipo básico** tier 1 al login si van desnudos: arma de clase + armadura + casco + anillo (`ensureBotLoadout`).
- Party persistente: `p_botsquad_olympus`.
256:
257:

## 2026-07-19 — index.html restaurado (login roto)

- **Causa**: `index.html` se corrompió con texto de elisión del editor (`…`, números de línea) en lugar del HTML real; el navegador mostraba solo un recuadro vacío.
- **Fix**: `index.html` reconstruido completo (login, HUD, paneles, muerte, scripts). Cache bust `?v=20260720`.
## 2026-07-19 — UI móvil + grupo minimizable
## 2026-07-19 — Móvil: pulido landscape + botón Héroe

- Botón **Héroe** en controles táctiles (abre panel Personaje).
- Modo **apaisado** (landscape): HUD más bajo, D-pad y paneles ajustados.
- Grupo minimizado se reaplica al redimensionar si ya estabas en party.
- Cache bust `?v=20260724`.



- **Viewport móvil**: HUD/orbes/habilidades más compactos; paneles como hoja inferior; chat y minimapa ajustados; `safe-area` para notch.
- **Controles táctiles**: D-pad (WASD), botones Inv/Misiones; tap en mapa = atacar/hablar/recoger.
- **Grupo minimizable**: toca la pestaña **Grupo** → cuadrado pequeño arriba-izq con 👥 + número; toca otra vez para expandir. Preferencia en `localStorage` (`aot_party_mini`).
- Cache bust `?v=20260722`.

## 2026-07-19 — Móvil: pulido táctil

- Tap en suelo vacío cierra paneles abiertos + tooltip (menos tapas en pantalla).
- `100dvh` para altura real en móvil; `theme-color` en barra del navegador.
- `touch-action: manipulation` en habilidades, D-pad y botones de grupo.
- Grupo minimizado sube a `z-index: 35` (siempre clicable sobre minimapa).
- Cache bust `?v=20260725`.

## 2026-07-19 — Revive stuck / personaje invisible

- **Bug**: al morir y reconectar (o perder el packet `dead`), `welcome` ocultaba el overlay y el servidor **no reenviaba** `{t:"dead"}`. Además los muertos salían del snapshot → sin entidad propia, cámara vacía, sin botón Resucitar.
- **Fix servidor**: tras login, si `player.dead` → reenvía `{t:"dead"}`; el snapshot incluye al jugador local aunque esté muerto (para anclar cámara).
- **Fix cliente**: `you` con `hp<=0` fuerza overlay; `hp>0` lo quita; el cadáver propio no se borra del mapa; overlay z-index/móvil más visible.
- Cache bust `?v=20260726`.

## 2026-07-19 — Juicio cercano + joystick móvil

- **Juicio de Zeus (clérigo 4)**: VFX de tormenta de rayos local (no proyectil dirigido); radio 3.6; `castSkill` nunca apunta skills `self` con coords táctiles viejas.
- **Joystick analógico** reemplaza el D-pad: dirección continua 360°. Servidor `dir` acepta floats sin snap a casillas.
- Cache bust `?v=20260727`.

## 2026-07-19 — Joystick flotante + chat móvil

- El stick **no se muestra** fijo: aparece bajo el dedo solo al arrastrar en zona vacía (no botones/paneles).
- Toque corto sigue siendo atacar/hablar/loot; arrastre = movimiento analógico.
- Chat en móvil **cerrado por defecto**; botón **Chat** lo abre/cierra.
- Cache bust `?v=20260728`.

## 2026-07-19 — Chat botón + stick invisible

- Joystick **invisible** por defecto: aparece bajo el dedo solo al arrastrar zona vacía (tap corto = atacar).
- Chat en móvil **cerrado** por defecto; botón **Chat** lo abre/cierra.
- Mensajes nuevos hacen **ping** en el botón Chat si el panel está cerrado.
- Escape/Enter sincronizan el estado del chat; cache bust `?v=20260730`.

## 2026-07-19 — Móvil: tocar loot del suelo

- Radio de loot más grande en móvil (~1.55 tiles) y prioridad sobre enemigos bajo el dedo.
- Si el toque empieza en loot/NPC/enemigo, el joystick no roba el gesto (no convierte wobble en caminar).
- Tap corto recoge (chase al ítem si está lejos); toast "Recogiendo…".
- Cache bust `?v=20260730`.
