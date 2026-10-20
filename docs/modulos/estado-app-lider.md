# La app del líder — estado de la rama `claude/app-lider-551adf`

20 de octubre de 2026. Encargo: que `/mi` esté completa para quien lleva un
ministerio. El miembro raso sigue viendo lo básico; quien lidera tiene, en la
misma app, las herramientas de lo suyo sin salir al panel.

Sin migraciones. No toca `drizzle/`, ni `src/lib/db/schema`, ni ninguna action
del panel.

---

## Qué hay

**Pestaña «Equipo»** (`/mi/equipo`), la quinta de la barra, solo para quien
lidera algo (`ministeriosQueLlevoEnLaApp`: `ministeriosQueLlevo` filtrado por
`puedeGestionarMinisterio`). Va al final: el miembro raso ve sus cuatro pestañas
exactamente donde estaban y el líder no pierde ninguna de sitio. Con un solo
ministerio la pestaña lleva directa a su portada; con varios, a una lista con lo
que pide atención en cada uno. Cinco caben a 375 px; seis no, y por eso la
emisora va encima de la barra y no como pestaña.

**Portada por ministerio** (`/mi/equipo/[id]`): una línea arriba con el total
(«3 cosas piden atención» / «Todo en orden») y una tarjeta por módulo encendido.
Hoy:

| Módulo | Qué enseña la tarjeta |
|---|---|
| Agenda | Ensayos de las últimas 3 semanas (y hoy) sin lista pasada; el siguiente que viene |
| Turnos | Los próximos turnos (3 semanas) con puestos sin cubrir, «no puedo» o sin contestar; si no hay ninguno planificado, eso |
| Repertorio | La lista del próximo culto: «sin lista» (urgente a 3 días) o cuántas canciones y cuáles |
| Seguimiento | Quién más reuniones se ha perdido, con quién le acompaña. Solo con `ver_seguimiento` |

Debajo, el equipo plegado (solo lectura).

**Las tareas, en la app**, con las MISMAS rutas que el panel y otro prefijo:

- `turnos` (lista), `turnos/planificar`, `turnos/[turnoId]`: poner y quitar gente
  por puesto, marcar quién confirmó o no puede, copiar el cuadrante anterior,
  editar y borrar el turno, y **la lista de canciones del culto** (añadir con su
  tono, subir, bajar, cambiar el tono del día, quitar).
- `agenda`, `agenda/nueva`, `agenda/[reunionId]` (**pasar lista**),
  `agenda/[reunionId]/editar`.
- `repertorio`, `repertorio/nueva`, `repertorio/[cancionId]` (enlaces, cuándo ha
  sonado, editar, archivar, borrar si nunca sonó).
- `seguimiento` (con botón de llamar en cada fila) y `seguimiento/[miembroId]`
  (llamar, **apuntar el contacto**, quién le acompaña, historia).

**«Abrir herramientas»** de `/mi/cuenta` lleva ahora a `/mi/equipo/[id]`.

---

## Decisiones, y por qué

**Las actions del panel se reutilizan envueltas, sin tocarlas.** Cada action del
panel acaba en un `redirect()` a su pantalla. `enLaApp()`
(`src/lib/ministerios/en-la-app/acciones.ts`) la ejecuta, atrapa ese `redirect`,
cambia `/panel/ministerios` por `/mi/equipo` (`traducirAlApp`, en `rutas.ts`) y
lo relanza. El mensaje viaja intacto (`?guardado=asignado`, `?error=…`,
`#canciones`). Así no hay ni una línea de lógica copiada —guardas, tercer
cinturón, permiso de asistencia, avisos— y no se toca ningún fichero de
actions, que es justo donde trabajan la tanda 1 (`exigirModulo`) y las ramas de
alabanza y consolidación. La alternativa, darles un parámetro de destino, habría
chocado con las tres.

Antes de llamar a la action del panel, `enLaApp()` comprueba dos cosas con el
destino de la app:

- El muro de suscripción (`exigirPoderEscribir(ctx, volver)`): en `solo_lectura`
  el aviso sale en la pantalla desde la que se pulsó, y no en la raíz de la zona.
- Que el módulo esté encendido (en una lista: la lista de canciones pide
  `turnos` y `repertorio`, como su `guardaDeLaLista` en la tanda 1).
  **Al fusionar la tanda 1 esto pasa a ser redundante**: cada action del panel
  lleva ya su `exigirModulo()`, cuyo destino `/panel/ministerios/[id]?error=` se
  traduce solo a la portada de la app. Se puede cambiar la consulta de
  `enLaApp()` por una llamada a `exigirModulo(ctx, id, m, rutaApp(id))` por
  módulo, o quitarla.

`isRedirectError` y `getURLFromRedirectError` se importan de
`next/dist/client/components/…`: no salen por `next/navigation`, pero son las
que usa Next para leer su propio `redirect`. Si cambian de sitio, el build falla
en esa línea, que es mejor que un `digest` partido a mano que deje de coincidir
en silencio. Si algún día el formato no se entendiera, la action seguiría
redirigiendo al panel: se degrada, no se rompe ni abre nada.

**Versión de app de cada pantalla, no la del panel dentro del marco.** Las del
panel se ven a 375 px, pero:

- Sus campos van a 15 px: `globals.css` pone 16 px a los campos en móvil, pero
  esa regla vive en `@layer base` y la clase `text-[15px]` de `Input` en
  `utilities`, que gana siempre. **Comprobado en el navegador**: un `Input` del
  panel mide 15 px a 375. En la app cada campo lleva `max-md:text-[16px]`
  (`_components/estilos.ts`). Ver «Hallazgos».
- Cambiar la respuesta de alguien en un turno son dos iconos con `title`: sin
  ratón son dibujos sin nombre. En la app van escritas («Confirma», «No puede»,
  «Sin contestar»), solo las dos que no tiene ya.
- Las listas resumen cada culto o ensayo en una línea —lo que falta—, con las
  mismas cuentas que la portada (`estadoDeTurno`).

Lo que no se duplica son las consultas (`src/lib/*/consultas.ts`) ni las
actions. Lo que sí se repite es maquetación.

**Puertas: las del panel, en cada página.** `requireMinisterioEnLaApp(id,
modulo)` (`en-la-app/guarda.ts`): iglesia y consentimiento al día (`/mi` no
tiene guard en su layout), suscripción no `bloqueada` (si lo está, a
`/suscripcion`), `puedeGestionarMinisterio`, ministerio de su iglesia, módulo
encendido y la puerta de más del adaptador (`ver_seguimiento`). Va en cada
página y no en un layout porque un layout no se vuelve a ejecutar al navegar
entre las páginas que cuelgan de él. Para quien no lleva nada, 404 y no un
rebote con mensaje: la zona no existe para él y el mensaje confirmaría que hay
algo detrás de la URL.

**El pastor**: no ve la pestaña si no lidera nada (tiene el panel), pero puede
abrir cualquier `/mi/equipo/[id]`, igual que en el panel.

**Quien negó el permiso de asistencia** no aparece en ninguna lista porque las
listas son las del panel: `listaDelEquipo` para pasar lista y `personasPorFaltas`
para el seguimiento. Los turnos no lo filtran, igual que en el panel: servir en
un culto no es la asistencia que cubre ese permiso.

---

## Cómo engancha su módulo cada rama nueva

Un adaptador en la carpeta del módulo y **una línea** en
`src/lib/ministerios/en-la-app/registro.ts`. La portada lo recoge sola a partir
de `modulosActivos()`. Mientras no tenga adaptador, el módulo sale igualmente en
la portada con una tarjeta de respaldo que lleva a su pantalla del panel.

```ts
// src/lib/reparto/en-la-app.ts
import 'server-only';

import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { jornadaDeHoy } from './consultas'; // la consulta que ya tenga el módulo

export const repartoEnLaApp: ModuloEnLaApp = {
  id: 'reparto',
  abrir: 'Abrir el reparto',
  // 'panel' mientras no exista /mi/equipo/[id]/reparto; 'app' cuando exista.
  pantalla: 'panel',
  async resumen(ctx, ministerio, hoy) {
    const jornada = await jornadaDeHoy(ctx, ministerio.id, hoy);
    return {
      pendientes: jornada?.abierta
        ? [{
            texto: `Jornada de hoy · ${jornada.entregados} de ${jornada.inscritos} entregados`,
            href: rutaApp(ministerio.id, 'reparto'),
            urgente: false,
          }]
        : [],
      proximo: null,
      vacio: 'No hay jornada de reparto abierta.',
    };
  },
};
```

```ts
// src/lib/ministerios/en-la-app/registro.ts
const ADAPTADORES: Partial<Record<ModuloId, ModuloEnLaApp>> = {
  agenda: agendaEnLaApp,
  turnos: turnosEnLaApp,
  repertorio: repertorioEnLaApp,
  seguimiento: seguimientoEnLaApp,
  reparto: repartoEnLaApp, // ← la línea
};
```

Para darle **pantalla en la app** (`pantalla: 'app'`):

1. La página en `src/app/mi/equipo/[id]/reparto/page.tsx`, con la misma ruta que
   en el panel, abriendo con `requireMinisterioEnLaApp(id, 'reparto')` y
   pintando dentro de `MarcoEquipo`.
2. Sus actions en `src/app/mi/equipo/[id]/reparto/actions.ts`, envolviendo las
   del panel:

   ```ts
   export async function marcarEntregado(ministerioId: string, formData: FormData) {
     await enLaApp(
       { ministerioId, modulos: ['reparto'], volver: rutaApp(ministerioId, 'reparto') },
       () => panel.marcarEntregado(ministerioId, formData),
     );
   }
   ```

   Si la action del panel redirige a `/panel/ministerios/[id]/reparto/…`, cada
   subruta que use tiene que existir también bajo `/mi/equipo/[id]/reparto/…`.

Casos concretos:

- **Reparto (tanda 1)**: como el ejemplo. Su pantalla «Hoy» ya está pensada
  para el móvil; la versión de app es la misma pantalla dentro de `MarcoEquipo`.
- **Emisora (radio)**: su tarjeta puede decir el próximo programa y quién lo
  locuta, y si los programas son turnos, sus huecos ya los cuenta
  `turnosEnLaApp`. El reproductor va en el layout de `/mi` y no depende de esto.
- **Nuevos (consolidación)**: si es una vista dentro del seguimiento y no un
  módulo propio, se amplía `seguimientoEnLaApp.resumen` con los nuevos sin
  acompañante y se añade `/mi/equipo/[id]/seguimiento/nuevos` si el panel la
  tiene en `/panel/ministerios/[id]/seguimiento/nuevos`. Si es módulo propio,
  adaptador nuevo como el de arriba.

---

## Verificado ejecutándolo

Navegador integrado a 375 × 812, en `127.0.0.1:3005` para no compartir cookies
con las otras sesiones. Cada escritura, comprobada después en la base.

**lider@ (David, responsable de Alabanza: agenda, turnos, repertorio)**

- Ve la quinta pestaña; con un solo ministerio, `/mi/equipo` le lleva a la
  portada de Alabanza. Portada sin desbordar (`scrollWidth` 375).
- Turno del domingo 25: puso a David en Dirección → fila en
  `turno_asignaciones` con `asignado_por` David, y la app volvió a
  `/mi/equipo/…/turnos/…?guardado=asignado`.
- Marcó que Lucía confirma → `respuesta = confirmado` con `respondido_at`.
- Lista del domingo: añadió «Santo, santo, santo» en Mi → fila en
  `turno_canciones` con `tono = 'E'`, orden 3; la subió → orden 2.
- Agenda: creó un ensayo, pasó lista desmarcando a Marta → tres filas en
  `asistencias`, `registrado_por` David, Marta `presente = false`; lo borró →
  cero filas.
- Planificar: dos cultos marcados → dos turnos `creado_por` David; borrados los
  dos desde su pantalla.
- Repertorio: apuntó una canción y la borró (nunca sonó).
- Al terminar deshizo desde la app todo lo anterior en el turno del 25 (quitar a
  David de Dirección, Lucía a «sin contestar», quitar la canción y dejar el
  orden como estaba), comprobado en la base.
- `/mi/cuenta`: «Abrir herramientas» → `/mi/equipo/eeeeeeee-…-001`.
- 404 en: seguimiento de Alabanza (apagado), Consolidación y Acción social
  (no los lleva), `turnos/hola` y un uuid de turno inexistente.

**colider@ (Sara, rol miembro, colíder de Acción social; agenda)**

- Ve la quinta pestaña. Lleva dos ministerios —la sesión de radio la ha hecho
  líder de Radio en la base compartida—, así que sale la lista y de ahí la
  portada de Acción social, con su agenda.
- Creó una reunión, pasó lista desmarcando a Marcel → filas en `asistencias`
  con `registrado_por` Sara; la borró → cero filas.

**consolidacion@ (Noemí, rol miembro, responsable de Consolidación, con
`ver_seguimiento`)**

- Portada con la tarjeta del seguimiento (y agenda).
- Tomás y Brandon, que negaron el permiso de asistencia, no salen en la lista y
  sus fichas dan 404.
- Apuntó un contacto («No contestó», con próximo paso) → fila en
  `seguimiento_contactos` firmada por Noemí; lo borró → cero filas.
- Con su sesión, el turno de Alabanza da 404.

**miembro@ (Lucía, voluntaria)**: cuatro pestañas, sin «Equipo», y 404 en
`/mi/equipo`, en la portada de Alabanza, en sus turnos y en un turno concreto.

**pastor.sion@**: Sion tiene la suscripción `bloqueada`, y toda la zona le manda
a `/suscripcion`.

**Comprobaciones**: `npx tsc --noEmit`, `npx eslint`, `npm run build` y
`npm run test:aislamiento`, las cuatro en verde.

**Datos de prueba**: ninguno queda. Todo lo que se creó para probar se borró
desde la propia app y se comprobó en la base, así que no hay script en
`scripts/`.

---

## Lo que falta o no se ha podido comprobar

- **`solo_lectura` no se ha ejercitado.** Haría falta mover la fecha de una
  iglesia de la base compartida, y Betania la usan todas las sesiones. El código
  pasa por `exigirPoderEscribir(ctx, volver)` antes de cada action.
- **Una cuenta de otra iglesia abriendo un ministerio de Betania** no se pudo
  probar entrando: Sion está bloqueada y rebota antes. Lo cubren
  `obtenerMinisterio` (acotado a la iglesia del contexto) y el test de
  aislamiento.
- **El aviso «X no puede» enlaza al panel** (`/mi/agenda/actions.ts`,
  `responderTurno`). El líder entra al panel desde la base común, así que
  funciona, pero le saca de la app. Arreglarlo bien es que la campana de `/mi`
  traduzca el enlace con `traducirAlApp`; no se ha tocado porque esa action la
  usa la rama de alabanza.
- **`/mi` sigue mandando al panel a quien solo lidera** (`inicioDe`). Quien abre
  la app y pulsa la pestaña está dentro; quien entra por `/mi` a secas, no. Para
  la app nativa de la v2 conviene decidir si el líder empieza en
  `/mi/equipo`. Es una decisión de Marlon, no se ha tocado.
- **Gestionar el equipo** (sumar gente, nombrar colíderes, los puestos) sigue en
  el panel. La portada solo enseña el equipo.
- **`asistencias.origen` queda `'panel'`** al pasar lista desde la app, porque la
  action es la misma. Distinguirlo pediría un valor de enum: migración.
- Tras una action la página vuelve arriba (es un `redirect`), con el aviso de
  confirmación. En un cuadrante largo, después de poner a alguien en el sexto
  puesto hay que volver a bajar. Las actions del panel no llevan ancla.
- En desarrollo cada pantalla tarda 4–7 s (base en Irlanda, pooler). No se ha
  medido en producción.

---

## Hallazgos fuera del encargo

1. **Los campos del panel miden 15 px en el móvil.** La regla de 16 px de
   `globals.css` está en `@layer base` y pierde contra `text-[15px]` de
   `Input`, que está en `utilities`. Comprobado con `getComputedStyle` a 375 px.
   En Safari de iOS eso amplía la página al tocar cualquier campo del panel. Se
   arregla en `components/ui/input.tsx` (`max-md:text-[16px]`) o sacando la
   regla de `@layer base`.
2. **`/panel/ministerios/<no-uuid>` da 500**: la página del ministerio llama a
   `obtenerMinisterio` sin validar el id y Postgres revienta en el cast
   (`22P02`). Las de módulo se salvan porque su layout valida antes.

---

## Trampas

- **Las cookies de `localhost` no distinguen puerto**: otra sesión que entra con
  un enlace mágico te cambia la cuenta. Usar `127.0.0.1:<puerto>`; tras canjear
  el enlace, `/auth/confirm` redirige a `localhost` y hay que volver a navegar a
  mano a `127.0.0.1`.
- **El pooler en modo sesión (5432) se llena** con varias sesiones a la vez.
  En `.env.local` de este worktree `DATABASE_URL` va al 6543 (transacción); no se
  commitea.
- **Con el panel del navegador oculto** algún clic no llega y `javascript_tool`
  se queda colgado. Comprobar siempre en la base, no en la captura.
- La fecha de «hoy» es la de la iglesia (Bogotá): a las dos de la mañana en
  España, en Betania todavía es ayer.
