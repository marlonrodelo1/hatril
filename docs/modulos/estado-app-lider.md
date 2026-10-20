# Los equipos en la app — estado de la rama `claude/app-lider-551adf`

20 de octubre de 2026. Encargo: que `/mi` esté completa para quien sirve en un
ministerio. La app es UNA para líderes y miembros: quien lleva un equipo tiene
ahí sus herramientas sin salir al panel; quien sirve sin llevarlo ve lo suyo; y
quien no sirve en nada sigue con su barra de siempre.

Sin migraciones. No toca `drizzle/`, ni `src/lib/db/schema`, ni ninguna action
del panel. Sigue la guía visual de la rama `claude/diseno-auditoria-4e606f`
(`docs/diseno/guia-visual.md`).

---

## Qué hay

**Pestaña «Equipo»** (`/mi/equipo`), la quinta de la barra, para todo el que
sirve en algún equipo (`ctx.ministerioIds`), lo lleve o no. Va al final: nadie
pierde ninguna de sus pestañas de sitio, y el miembro que no sirve en nada no
la ve. Con un solo equipo lleva directa a su portada; con varios, a una lista
en dos bloques: «Lo que llevas» y «Donde sirves», con lo pendiente de cada uno.

**Por qué ahí y no un bloque en Agenda o en Mi cuenta.** Para el voluntario
«lo de mi equipo» es un sitio al que volver cada semana —el turno, el ensayo, la
lista del domingo—, no un dato más de su calendario ni un ajuste de su cuenta.
En Agenda ya están sus turnos sueltos entre los cultos y eventos; lo que faltaba
era verlos juntos por equipo, con quién más está y qué se toca. Y una sola
entrada para los dos papeles evita que alguien que es voluntario en un equipo y
líder en otro tenga que saber cuál de los dos sitios toca. Mi cuenta, además,
lleva desde cada ministerio a su portada: «Abrir herramientas» si lo lleva,
«Ver tu equipo» si participa.

**Portada por equipo** (`/mi/equipo/[id]`), en dos modos:

| Módulo | Quien lo LLEVA ve | Quien PARTICIPA ve |
|---|---|---|
| Agenda | Ensayos de las últimas 3 semanas (y hoy) sin lista; el siguiente | El próximo ensayo, con lugar; enlace al día en su agenda |
| Turnos | Próximos turnos con puestos sin cubrir, «no puedo» o sin contestar | Sus turnos: los sin confirmar como pendientes; enlace a su turno en la agenda, donde confirma |
| Repertorio | La lista del próximo culto, urgente si falta a 3 días (solo con los turnos encendidos: la lista cuelga del turno) | La lista del próximo culto del equipo (sin pendiente: no es cosa suya) |
| Seguimiento | Quién más reuniones se ha perdido (solo con `ver_seguimiento`) | Nada: es solo del líder |
| Reparto | Cómo va la puerta de hoy: cuántos esperan y cuántos se han entregado, sin nombres; enlace a su pantalla del panel. Solo a quien lidera ESE equipo (o al pastor) | Nada en la v1 |

Debajo, el equipo: nombres, papel y quién es responsable o colíder. Nunca las
respuestas de los demás a un turno; eso es del líder.

**Las herramientas del líder, en la app**, con las MISMAS rutas que el panel
bajo `/mi/equipo/[id]/…`: turnos (lista, planificar, cuadrante con la lista de
canciones del culto), agenda (lista, nueva, pasar lista, editar), repertorio
(lista, nueva, ficha) y seguimiento (lista con llamada, ficha con apuntar el
contacto). Al voluntario le dan 404.

---

## Decisiones, y por qué

**Las actions del panel se reutilizan envueltas, sin tocarlas.** Cada action del
panel acaba en un `redirect()` a su pantalla. `enLaApp()`
(`src/lib/ministerios/en-la-app/acciones.ts`) la ejecuta, atrapa ese `redirect`,
cambia `/panel/ministerios` por `/mi/equipo` (`traducirAlApp`, en `rutas.ts`) y
lo relanza con su mensaje intacto. Ni una línea de lógica copiada, y nada que
choque con la tanda 1 (`exigirModulo`, ya en main) ni con alabanza y
consolidación, que trabajan sobre esos mismos ficheros.

Antes de llamar a la del panel, `enLaApp()` comprueba con el destino de la app
el muro de suscripción (en `solo_lectura` el aviso sale donde se pulsó) y que
el módulo esté encendido. **Al fusionar con main, esto segundo es redundante**:
cada action del panel ya lleva su `exigirModulo()`, cuyo destino
`/panel/ministerios/[id]?error=` se traduce solo a la portada. Se puede cambiar
por `exigirModulo(ctx, id, m, rutaApp(id))` o quitar.

`isRedirectError` y `getURLFromRedirectError` se importan de
`next/dist/client/components/…`: son las que usa Next para leer su propio
`redirect`. Si cambian de sitio, el build falla en esa línea; si el formato
cambiara sin romper el build, la action seguiría yendo al panel: se degrada, no
abre nada.

**El contrato tiene dos huecos.** `ModuloEnLaApp.resumen` es la tarjeta del que
lleva; `ModuloEnLaApp.participante`, opcional, la del que participa. Sus enlaces
van a pantallas del miembro (`/mi/agenda`, `/mi/agenda/turno/[id]`), nunca a
las herramientas. Un módulo sin `participante` no enseña nada al voluntario, y
para él no hay tarjeta de respaldo (llevaría al panel, que le rebota).

**Pantallas propias y no las del panel dentro del marco.** Las del panel usan
`<Button render={<Link/>}>` (la guía lo descarta: aviso de Base UI en consola),
y en el móvil sus respuestas de turno son iconos con `title` sin ratón. Las
consultas y las actions son las del panel; lo que se repite es maquetación.

**Puertas: las del panel, en cada página.** `requireMiEquipo(id)` decide el
modo (líder si `puedeGestionarMinisterio`, participante si sirve en él, si no
404). `requireMinisterioEnLaApp(id, modulo)` guarda las herramientas: iglesia y
consentimiento al día, suscripción no `bloqueada` (si lo está, a
`/suscripcion`), llevar ese ministerio, ministerio de su iglesia, módulo
encendido y la puerta de más del adaptador: `visiblePara(ctx, ministerioId)`,
que es `ver_seguimiento` en el seguimiento y la estrecha de main
(`puedeGestionarDesdeDentro`) en el reparto. Esa misma puerta la aplican la
tarjeta de la portada y `enLaApp()` en las actions. En cada página
y no en un layout porque un layout no se vuelve a ejecutar al navegar entre las
páginas que cuelgan de él.

**Quien negó el permiso de asistencia** no aparece en ninguna lista: son las
del panel (`listaDelEquipo`, `personasPorFaltas`).

---

## La guía visual, aplicada

- Escala con nombre (`t-subtitulo`, `text-body`, `text-label`, `t-micro`), sin
  `text-[Npx]` salvo dentro de la insignia.
- Insignias en pastilla (`_components/insignia.tsx`, a la espera de la
  compartida de la fase 2), avatares con `AvatarPersona`, iconos a 1.8.
- Rótulos de sección fuera de la tarjeta («Próximos / Anteriores»), listas como
  una tarjeta con filas, filas-enlace en `text-foreground`.
- Estados vacíos con título, qué hacer y botón de contorno.
- Borrar, en su tarjeta roja al final.
- Botones que son enlaces: `<Link>`/`<a>` con `buttonVariants()`.
- Un naranja por pantalla como mucho: la acción de la lista (planificar,
  apuntar) o el envío del formulario. La portada y el cuadrante no llevan
  ninguno.
- **16 px en el móvil.** Main arregló M1 dentro de `Input`
  (`text-[16px] md:text-[15px]`), así que los `<Input>` van sin tamaño propio;
  los `<select>` y `<textarea>` nativos, que no pasan por `Input`, llevan lo
  mismo en `_components/estilos.ts` (`text-[16px] md:text-body`).
- Retoques tras comparar con `/mi/agenda` y el muro a 375 px: el logo en la
  raíz de la pestaña, la lista de pasar lista sin teñir las filas marcadas (la
  lista entera en salmón borraba avatares y líneas), «Vinieron 2 de 3» en una
  línea en vez de cifra grande, la búsqueda a 36 px de alto, y «Tú» en la lista
  del equipo sin cortar el nombre.

---

## Cómo engancha su módulo cada rama nueva

Un adaptador en la carpeta del módulo y **una línea** en
`src/lib/ministerios/en-la-app/registro.ts`. La portada lo recoge sola a partir
de `modulosActivos()`. Sin adaptador, el módulo sale al líder con una tarjeta
que lleva a su pantalla del panel (con la puerta ancha,
`puedeGestionarMinisterio`), y al participante no le sale.

**Si la guarda de tu módulo en el panel es más estrecha** que
`puedeGestionarMinisterio`, el adaptador tiene que llegar en la misma fusión
con su `visiblePara`. Esa puerta la aplican a la vez la tarjeta, las pantallas
(`requireMinisterioEnLaApp`) y las actions (`enLaApp`): declarada una vez, no
hay que escribirla en ningún otro sitio.

El ejemplo real es el del reparto, que ya está en la rama
(`src/lib/reparto/en-la-app.ts`), resumido:

```ts
export const repartoEnLaApp: ModuloEnLaApp = {
  id: 'reparto',
  abrir: 'Abrir el reparto',
  // Su pantalla «Hoy» vive en el panel y ya está hecha para el móvil.
  pantalla: 'panel',
  // La de `requireReparto` y `PestanasMinisterio` en main: pastor o quien
  // lidera ESE equipo. La RLS del reparto (0042) va por equipo.
  visiblePara: (ctx, ministerioId) => puedeGestionarDesdeDentro(ctx, ministerioId),
  async resumen(ctx, ministerio, hoy) {
    const jornada = await jornadaDelDia(ctx, ministerio.id, hoy);
    if (!jornada) {
      const inscritos = await contarInscritos(ctx, ministerio.id);
      return { pendientes: [], vacio: `${inscritos} hogares en el padrón. …` };
    }
    const venidos = await quienHaVenido(ctx, jornada.id);
    // … cuántos esperan y cuántos se han entregado; ni un nombre.
  },
  // Sin `participante`: en la v1 el voluntario no marca entregas.
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

Para darle **pantalla en la app** al líder (`pantalla: 'app'`): la página en
`src/app/mi/equipo/[id]/reparto/page.tsx`, con la misma ruta que en el panel,
abriendo con `requireMinisterioEnLaApp(id, 'reparto')` —que aplica sola la
puerta estrecha del adaptador— y dentro de `MarcoEquipo`; y sus actions en
`…/reparto/actions.ts`, envolviendo las del panel, que también pasan por ella:

```ts
import * as panel from '@/app/panel/ministerios/[id]/reparto/actions';

export async function entregarA(ministerioId: string, beneficiarioId: string) {
  await enLaApp(
    { ministerioId, modulos: ['reparto'], volver: rutaApp(ministerioId, 'reparto') },
    () => panel.entregarA(ministerioId, beneficiarioId),
  );
}
```

Cada subruta a la que redirija la action del panel tiene que existir también
bajo `/mi/equipo/[id]/reparto/…`.

Casos concretos:

- **Reparto**: hecho, como arriba. Al líder del equipo le sale cómo va la
  puerta de hoy; a quien solo tiene `gestionar_ministerios`, no le sale.
- **Emisora**: la tarjeta del líder puede decir el próximo programa; si los
  programas son turnos, sus huecos ya los cuenta `turnosEnLaApp`. La radio la
  escucha cualquiera desde el reproductor del layout de `/mi`, que no depende
  de esto.
- **Nuevos (consolidación)**: si es una vista del seguimiento, se amplía
  `seguimientoEnLaApp.resumen`; si es módulo propio, adaptador nuevo. Sin
  `participante`: quién es nuevo y cómo va no es para todo el equipo.
- **Células y escuela**, cuando existan: «Mi célula» y «la clase de mi hijo»
  son exactamente el `participante` de su módulo. La escuela, además, con la
  puerta estrecha, como el reparto: también son datos de terceros por equipo.

---

## Verificado ejecutándolo

Navegador integrado a 375 × 812 (y a 1280), en `127.0.0.1:3005` para no
compartir cookies con las otras sesiones. Cada escritura, comprobada en la base.

**lider@ (David, responsable de Alabanza)** — en la primera tanda: puso a
alguien en un turno, marcó una respuesta, montó y ordenó la lista del domingo,
creó un ensayo y pasó lista, planificó dos cultos y apuntó una canción; cada
fila comprobada en la base y deshecha desde la propia app. Tras el repaso
visual: portada, turnos, cuadrante, agenda, pasar lista y repertorio otra vez a
375, sin desbordar y sin avisos de Base UI en consola.

**colider@ (Sara, rol miembro, colíder de Acción social y de Radio)**: lista con
sus dos equipos; pasó lista en Acción social (filas con `registrado_por` Sara) y
la borró.

**consolidacion@ (Noemí, responsable de Consolidación, con `ver_seguimiento`)**:
apuntó un contacto (firmado por Noemí) y lo borró. Tomás y Brandon, que negaron
el permiso de asistencia, no salen y su ficha da 404.

**miembro@ (Lucía, voluntaria de Alabanza y de Jóvenes)**: ve la pestaña; la
lista dice «Donde sirves» con sus dos equipos y un pendiente en Alabanza. En
Alabanza, en modo participante: su turno sin confirmar («Te toca Voces»), que
lleva a su ficha en la agenda donde confirma; el próximo ensayo; la lista del
domingo; y el equipo. En Jóvenes (sin herramientas), el estado vacío. 404 en
las herramientas de Alabanza (turnos, un turno, agenda, repertorio) y en
equipos que no son suyos.

**enlace@ (Andrés, voluntario de Acción social)**: la pestaña le lleva directo a
Acción social en modo participante; 404 en su agenda de líder y en Alabanza.

**secretaria@ (no sirve en ningún equipo)**: sin pestaña y 404 en `/mi/equipo`.
Es la cuenta de demo que no sirve en nada; no hay un «miembro» sin equipo en
Betania, y la pestaña depende de servir, no del rol.

**pastor.sion@**: Sion está `bloqueada` y toda la zona le manda a `/suscripcion`.

**Tras la revisión y la fusión con main (reparto)**: Sara, colíder de Acción
social, ve la tarjeta del reparto con la puerta de hoy («1 espera · 2
entregados (1 sin inscribir)», las mismas cifras que la pantalla del panel) y
«Abrir el reparto» le abre esa pantalla; Andrés, voluntario del mismo equipo,
no la ve. Ninguna cuenta de demo tiene `gestionar_ministerios` sin ser pastor,
así que la puerta estrecha se comprobó con un guion contra el código real y
contextos fabricados: quien solo tiene `gestionar_ministerios` ve la agenda y
no el reparto; el colíder, los dos; el pastor, también el seguimiento; y la
tarjeta del repertorio con los turnos apagados devuelve su estado vacío, sin
turno ni enlace. A 375 px, un `<textarea>` y un `<Input>` miden 16 px.

**Comprobaciones**: `npx tsc --noEmit`, `npx eslint`, `npm run build` y
`npm run test:aislamiento`, las cuatro en verde.

**Datos de prueba**: ninguno queda; todo se creó y se borró desde la app.

---

## Lo que falta o no se ha podido comprobar

- **`solo_lectura` no se ha ejercitado**: haría falta mover la fecha de Betania,
  que usan todas las sesiones. Cada action pasa antes por
  `exigirPoderEscribir(ctx, volver)`.
- **Una cuenta de otra iglesia abriendo un ministerio de Betania** no se pudo
  probar entrando: Sion rebota antes por la suscripción. Lo cubren
  `obtenerMinisterio` (acotado a la iglesia) y el test de aislamiento.
- **Las 404 salen con la página de Next**, en inglés (inventario M2). Aquí solo
  se llega por una URL escrita a mano, no desde un flujo normal.
- **El aviso «X no puede» enlaza al panel** (`responderTurno`, en
  `/mi/agenda/actions.ts`). Funciona, pero saca al líder de la app; lo arregla
  que la campana de `/mi` traduzca con `traducirAlApp`. No se ha tocado porque
  esa action la usa la rama de alabanza.
- **`/mi` sigue mandando al panel a quien solo lidera** (`inicioDe`). Para la
  app nativa de la v2 conviene decidir si empieza en `/mi/equipo`. Es de Marlon.
- **Gestionar el equipo** (sumar gente, colíderes, puestos) sigue en el panel.
- **`asistencias.origen` queda `'panel'`** al pasar lista desde la app: es la
  misma action. Distinguirlo pide un valor de enum, es decir, migración.
- Tras una action la página vuelve arriba (es un `redirect`) con su aviso; las
  actions del panel no llevan ancla.

---

## Hallazgos fuera del encargo

1. **`/panel/ministerios/<id-que-no-es-uuid>` da 500**: la página del
   ministerio llama a `obtenerMinisterio` sin validar el id (Postgres `22P02`).
   Las de módulo se salvan porque su layout valida antes.
2. Los campos de 15 px en el móvil estaban en el inventario visual (M1), y
   main ya los arregló dentro de `Input`.

---

## Trampas

- **Las cookies de `localhost` no distinguen puerto**: usar `127.0.0.1:<puerto>`.
  Tras canjear el enlace, `/auth/confirm` redirige a `localhost` y hay que
  volver a navegar a mano a `127.0.0.1`. Ahí el HMR no conecta (el websocket
  sale rechazado en consola): hay que recargar a mano tras cada cambio.
- **El pooler en modo sesión (5432) se llena** con varias sesiones: en el
  `.env.local` de este worktree `DATABASE_URL` va al 6543. No se commitea.
- **Con el panel del navegador oculto** algún clic no llega y las capturas
  salen atrasadas. Comprobar en la base, no en la captura.
- La fecha de «hoy» es la de la iglesia (Bogotá): de madrugada en España, en
  Betania todavía es ayer.
