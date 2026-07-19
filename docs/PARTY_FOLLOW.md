# Diseño: modo "Seguir" en el grupo

Objetivo del usuario: dentro del grupo, poder elegir a un compañero y que tu
personaje (a) **ataque automáticamente lo que esa persona ataque**, y (b) **te
mueva solo para quedarte cerca de ella** cuando no hay combate. Es un modo de
asistencia tipo "seguir al líder", no control remoto — WASD y tus clics manuales
siempre pueden tomar el volante de nuevo.

## Protocolo (nuevo)

Cliente → servidor:
- `{t:"party_follow", id: number|null}` — `id` = id de un compañero de **tu mismo
  grupo** a seguir; `null` para dejar de seguir. El servidor valida que `id`
  pertenezca a `p.party.members`.

Servidor → cliente:
- `{t:"follow_state", id: number|null}` — eco autoritativo cada vez que cambia
  (por tu propia elección, o porque el servidor lo limpia solo: el líder salió del
  grupo, o tú mismo saliste). El cliente nunca decide esto por su cuenta; siempre
  refleja lo último que dijo el servidor.

No hace falta tocar `you` (payload grande) ni el snapshot `st` — es estado aparte,
igual que `party`.

## Lógica servidor (`Player.followId: number | null`)

En cada tick de simulación, **antes** de la cadena de prioridad de movimiento que
ya existe (WASD > combate > camino > directo):

1. **Sincronizar objetivo de combate.** Si tengo `followId` y el líder está en mi
   mismo grupo y tiene un `atkTarget` vivo, y yO **no tengo ya un objetivo propio
   vivo**, y **no estoy moviéndome con WASD** (`!p.vel`), adopto su objetivo
   (`p.atkTarget = leader.atkTarget`). WASD cancela el lock de ataque; no se
   re-hereda el del líder mientras sigues pulsando dirección. Al soltar, si sigues
   en modo Seguir y estás libre, se retoma. Una elección manual propia se respeta
   hasta que el bicho muera o lo canceles.
2. Con `atkTarget` ya sincronizado, la lógica de combate/persecución que ya existe
   (perseguir hasta rango, atacar) funciona sin cambios — no se duplica nada.
3. **Seguir la posición.** Si no hay WASD activo, ni combate, ni un camino/click en
   curso, y tengo `followId`, camino hacia la posición del líder hasta quedar a
   ~2 casillas (no me apilo encima).
4. **Auto-limpieza.** Si el líder ya no está en mi grupo (salió, el grupo se
   disolvió) limpio `followId` y mando `follow_state:null` con un aviso.

Esto reutiliza el 100% del pathing/combate existente — "seguir" es solo una fuente
más de intención (como WASD o un clic), nunca una segunda copia de la lógica.

## Prioridad de movimiento (orden final)

```
WASD (p.vel)  >  combate manual/perseguido (p.atkTarget)  >  camino (p.path/direct)  >  seguir al líder (idle)
```

Seguir es siempre lo último — cualquier acción tuya (moverte, atacar algo distinto)
toma el control inmediatamente; en cuanto vuelves a estar "libre", el modo seguir
retoma solo.

## UI

- En el panel de grupo (`#partyFrames`), cada fila de compañero (no la propia) gana
  un botón pequeño **"Seguir"**. Solo puede haber un líder seguido a la vez —
  clickear otro cambia el objetivo; clickear el mismo lo desactiva.
- La fila seguida se resalta (borde dorado tenue).
- El encabezado del panel muestra `Grupo — Siguiendo a <nombre>` cuando aplica.
- El estado se sincroniza siempre desde `follow_state` del servidor, nunca es
  puramente optimista — evita que la UI mienta si el servidor lo rechaza o lo
  limpia solo.

## Casos borde cubiertos

- Seguir a alguien fuera de tu grupo → rechazado (toast).
- El líder se desconecta brevemente (linkdead, ver `PARTY_LINGER_MS`) → sigo
  "apuntando" a su última posición conocida; si vuelve, retoma normal; si se va
  del todo, el grupo lo expulsa (`partyLeave`) y eso limpia mi `followId`.
- El líder sale del grupo manualmente → limpio mi `followId` en el mismo evento
  que ya actualiza el roster (`partyLeave`/`party_leave`), un solo lugar en el
  código server-side, no un caso especial aparte.
