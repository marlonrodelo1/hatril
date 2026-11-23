# Células sobre una pieza genérica de grupos — estado de la rama `claude/awesome-driscoll-58a8cc`

22 y 23 de octubre de 2026. Encargo: el punto 2 de `cola.md`. Las células como
Marlon las describió —reuniones de oración en casas, cada una con su líder, que
organiza los temas, ve a su gente y cuántos vinieron; quien va se apunta a una
célula concreta, y lo que se busca es que quien va a una célula se baje la app
y conozca la iglesia— sobre una pieza que la escuela dominical reutilizará para
sus clases.

**Migraciones `0046_grupos`, `0047_grupos_rls`, `0048_invitaciones`,
`0049_grupos_cierres`, `0050_grupos_carreras` y `0051_grupos_cerrojos`,
APLICADAS** con el migrador de drizzle-orm: `drizzle.__drizzle_migrations`
pasa de 46 a 52 filas. Códigos **HT132, HT133 y HT134** cogidos; la revisión no
gastó ninguno (lo nuevo es HT132). **La siguiente migración es la 0052 y el
siguiente código, HT135.**

Las cuatro últimas son la respuesta a la revisión adversarial del 23-oct y a
las dos verificaciones de sus arreglos: ver «La revisión del 23-oct», más abajo.

---

## Qué hay

**La pieza (`src/lib/db/schema/grupos.ts`).** Cuatro tablas que no dicen
«célula» en ningún sitio:

| Tabla | Para qué |
|---|---|
| `grupos` | El grupo: nombre, barrio o zona, día y hora, código de invitación, abierto o cerrado. Cuelga de un ministerio. **Sin dirección ni descripción.** |
| `grupo_miembros` | Quién está y con qué papel (`rol_grupo_enum`: `lider`, `auxiliar`, `participante`, completo desde el primer día). Un líder activo por grupo; participante de una sola célula por red. |
| `grupo_semanas` | Cada semana del grupo (por su lunes): el tema y, al reportar, `celebrada` o `no_hubo` con **cuántos vinieron y cuántas visitas, sin nombres**. Las semanas futuras con tema son la planificación. |
| `grupo_guias` | La guía común: el tema de cada semana que la red propone a todas sus células. |

Y `solicitud_invitaciones` (0048): con qué grupo y con qué código llegó una
solicitud pendiente. Hasta la 0048 era `solicitudes_ingreso.grupo_id`, y esa
tabla la lee toda la iglesia.

La palabra la pone el tipo de ministerio (`src/lib/grupos/etiquetas.ts`): en una
red, «célula/células»; en cualquier otro, «grupo/grupos». La escuela añadirá
ahí su «clase».

**El tipo `celulas`** (`tipos.ts`) enciende `['grupos', 'agenda']`, con puestos
«Líder de célula», «Auxiliar» y «Supervisión». Cada red es un ministerio de
este tipo: su responsable es el líder de red y los colíderes, supervisores. No
se impone G12 ni ningún árbol.

**El módulo `grupos`** (`modulos.ts`), el primero del catálogo, con el nombre
«Células y grupos». La pestaña del panel y la tarjeta de la app dicen
«Células» según el tipo.

**Panel**, con la puerta estrecha (`requireModuloMinisterio(id, 'grupos',
{ desdeDentro: true })`: pastor, o responsable y colíderes de ESA red; no
`gestionar_ministerios`):

- `/panel/ministerios/[id]/grupos`: cómo va la red (reportaron N de M,
  cuántos vinieron, visitas, cuántas sin reportar), la lista con la insignia de
  la última reunión de cada una, y la guía de las próximas cuatro semanas.
- `/panel/ministerios/[id]/grupos/nuevo`: crear eligiendo el líder **entre el
  equipo de la red** (quien no es pastor no se ve a sí mismo en la lista).
- `/panel/ministerios/[id]/grupos/[grupoId]`: la ficha. Su líder y
  auxiliares (cambiar de líder, añadir y quitar auxiliar), su gente (sumar
  desde el fichero con el diálogo de siempre, quitar), invitar (enlace, copiar,
  WhatsApp, cambiar el enlace), las últimas seis semanas, los datos y cerrarla.
- En la portada del ministerio (`/panel/ministerios/[id]`), el aviso
  «N células sin reportar su última reunión».

**App** (`/mi/equipo`), enganchada al contrato de módulos con sus dos vistas
(`src/lib/grupos/en-la-app.ts`):

- **Quien lleva la red** (`resumen`, con `visiblePara` estrecha): las células
  sin reportar como pendientes urgentes, las cifras de la red y la guía de
  esta semana (o que no la hay). Su pantalla `/mi/equipo/[id]/grupos` es la
  del panel con las mismas piezas, y en ella publica la guía (la action del
  panel envuelta en `enLaApp`).
- **Quien sirve en la red sin llevarla** (`participante`): casi siempre un
  líder de célula con rol `miembro`. «Tu célula»: si no ha reportado, el
  pendiente; si es hoy, el recordatorio; y la próxima reunión con su tema.
  Lleva a `/mi/equipo/[id]/grupos/[grupoId]`, la pantalla de su célula.
- **La célula de su líder** (`/mi/equipo/[id]/grupos/[grupoId]`): el
  reporte en un toque arriba —viene con la cifra de la semana anterior y el
  tema planificado o el de la guía; «Enviar el reporte» o «No hubo reunión»—,
  los próximos temas, invitar, su gente (nombres y papel, sin teléfonos) y las
  semanas anteriores, cada una con su enlace para reportarla o corregirla.
  `/temas` planifica las cuatro siguientes. La guarda, `requireGrupoEnLaApp`
  (`src/lib/grupos/guarda.ts`): la red desde dentro, o llevar ESA célula y
  seguir en el equipo. El resto, 404.
- **Quien va a una célula sin estar en el equipo** —casi todos—: «Tu célula»
  en `/mi/cuenta`, encima de «Tus ministerios»: quién la lleva, día y hora,
  zona y el próximo tema. **No la lista de los demás.** Si la lleva, «Abrir tu
  célula».

**La invitación, que es el puente.** Cada grupo tiene un código; su enlace es
`/solicitar/<iglesia>?grupo=<código>`. `/solicitar` dice «Vienes con la
invitación de Los Pinos» (solo el nombre, por `dbAdmin`), lo conserva al ir a
crear la cuenta y a identificarse, y lo guarda junto a la solicitud, en
`solicitud_invitaciones`, con el código con que llegó. La bandeja se lo dice al
pastor, y si al aprobar no entrará, por qué. **Al aprobar, la persona queda en
esa célula como participante** si el grupo sigue abierto, su red activa y con
el módulo encendido, el código no ha cambiado y no va ya a otra de esa red.
Entra en la iglesia entera, con la app. La invitación se borra al resolver la
solicitud, se apruebe o se rechace.

Para quien ya es de la iglesia, el enlace no hace nada y lo dice: «Ya eres de
Betania… pídeselo a quien lleva su red». Para quien ya esperaba respuesta sin
invitación, le ofrece sumarla a su solicitud («Sí, entrar también en Los
Pinos»).

---

## Decisiones, y por qué

**RLS por relación, no solo por iglesia.** Es la segunda excepción a la
doctrina del repo, y la `0047` lo cuenta entero. En corto: la llave es un dato
(la fila de `grupo_miembros`), no un permiso, así que no se duplica
`permisos.ts`; quien la tiene son 40 a 120 líderes de célula con rol `miembro`
entrando por `/mi`, la población más grande del producto con poder sobre datos
ajenos; y la pieza la heredará la escuela, con menores. Lo que ve cada uno:

| | `grupos` | `grupo_miembros` | `grupo_semanas` | `grupo_guias` | `solicitud_invitaciones` |
|---|---|---|---|---|---|
| Pastor | todo | todo | todo | todo | todo |
| Responsable y colíderes de la red | su red | su red | su red | toda la iglesia | nada |
| Voluntario de la red (líder de una célula) | **solo su célula** | **solo su célula** | **solo su célula** | toda la iglesia | nada |
| Participante | **su célula** | **su fila y quien la lleva** | su célula | toda la iglesia | nada |
| Resto de la iglesia | nada | nada | nada | toda la iglesia | nada |

La fila del voluntario en `grupos` cambió con la 0049: la 0047 le abría la red
entera por estar en el equipo, y todo líder de célula lo está.

Escriben: `grupos` y `grupo_miembros`, el pastor y quien lidera la red;
`grupo_semanas`, además quien lleva ESE grupo. `gestionar_ministerios` no entra
en ninguna. `solicitud_invitaciones` la escribe `/solicitar` por `dbAdmin`, y
solo el pastor la borra. `lleva_grupo()` exige además seguir en el equipo y el
grupo abierto: sacar a alguien del equipo o cerrar la célula le quita la llave
sin reescribir su fila.

Lo que NO cierra: los nombres siguen en `miembros`, que lee toda la iglesia.
Lo protegido es lo nuevo: quién va a qué célula, dónde y cuándo se reúne, y
cómo va.

**Un recuento, no pasar lista.** Es lo más honrado con el permiso de
asistencia: con una lista nominal, quien negó el permiso no podría salir, y
entonces o el número miente o se le cuenta como visita. Contar a los que estaban
no apunta a nadie, no necesita su permiso, y es lo que pidió Marlon («cuántos
vinieron»). Por eso **no hay tabla de asistencias de célula**, `/acepta` no
tiene nada que borrar, y **ir a la célula no cuenta para «lleva N domingos sin
venir»**: no se toca `asistencias` ni `refrescar_ultima_asistencia`.

**Por semana, no por fecha.** El reporte, los temas y la guía son «de la
semana» (su lunes, exigido por CHECK). Con fechas exactas, una célula que se
reúne el miércoles en vez del martes dejaría el martes sin reportar para
siempre. «La reunión que toca» es la última cuyo día ya llegó: un lunes, la
del viernes pasado; un viernes, la de hoy.

**«Sin reportar» no se reclama antes del alta.** Una célula dada de alta en
Hatril el jueves no sale en el aviso por la reunión del martes, pero su líder
sí puede reportarla si quiere. La primera versión bloqueaba ese reporte: se
cazó al probarlo.

**Sin dirección, sin notas, sin teléfonos.** Una célula se reúne en casa de
alguien: zona sí, calle no. El tema va acotado a 120 caracteres y no hay
campo de peticiones (serían datos de salud). El líder ve nombres, no
teléfonos: con cuarenta líderes serían los teléfonos de la congregación.

**El líder de célula no da de alta a nadie.** Entra quien llega por el
enlace, con su consentimiento en `/solicitar`, y a quien ya es de la iglesia
—tenga la app o no— lo suma la red desde el panel. Cerrar no es borrar: la
célula sale de las listas y su gente queda fuera, pero sus semanas se quedan.
Desde la 0049 eso lo garantiza la base: en un grupo cerrado no entra nadie
(HT132); dar de baja o archivar una ficha le saca de sus grupos con su `hasta`;
y archivar una red cierra sus células y saca a su gente.

**`grupos` se audita; `grupo_miembros`, no.** Como `turnos` y
`turno_asignaciones`: `auditoria` la lee solo el pastor y no se borra, y la
lista de quién va a qué célula no puede quedarse ahí para siempre.

**El contrato de la app tiene dos campos más**, opcionales y sin tocar a nadie:
`ResumenDeModulo.titulo` y `.abrir`, para que la tarjeta diga «Células» o «Tu
célula» y su enlace «Ver todas las células». Y `requireAppAbierta` sale
exportada de `en-la-app/guarda.ts`, para la guarda de la célula.

---

## La revisión del 23-oct

La sesión de módulos hizo una revisión adversarial de la rama antes de
fusionarla (el detalle, en su nota `revision-celulas-2026-10-23.md`). Se
integró `main` primero y se arregló cada punto así:

1. **`solicitudes_ingreso.grupo_id` lo leía toda la iglesia.** Fuera de esa
   tabla: `solicitud_invitaciones` (0048), cerrada al pastor (0049). La 0048
   copia las pendientes que ya traían grupo, borra el trigger y la función de
   la columna, y la quita.
2. **En un grupo cerrado se podía meter gente.** HT132 en
   `validar_grupo_miembro` al entrar o al reactivar una fila, y las actions
   bloquean el grupo con `FOR SHARE` mientras suman (`bloquearAbierto`), así
   que cerrar a la vez da el error del grupo cerrado y no una fila suelta.
3. **La baja o el archivo no sacaban de la célula.** Triggers de la 0049
   sobre `miembros` y `ministerios`. Las consultas de la red, además, no cuentan
   fichas de baja o archivadas (`fichaViva`).
4. **`/solicitar` e Invitar mentían a quien ya es de la iglesia.** Ahora lo
   dicen, y quien esperaba aprobación puede sumar la invitación
   (`sumarInvitacionASolicitud`). Invitar y la pantalla de la célula dicen
   para quién es el enlace.
5. **`grupos_select_relacion` abría la red entera a cada voluntario.** Ahora
   `es_pastor`, `lidera_ministerio` o `esta_en_grupo`. La guarda de la app
   (`requireGrupoAccion`) comprueba también que el grupo esté abierto y sea de
   esa red.
6. **`grupoId` sin atar a `ministerioId` en las actions.** Cada escritura
   filtra por los dos, y quitar devuelve «Nada que hacer» si no tocó ninguna
   fila.
7. **`volverCon` daba `?grupo=X?error=`.** Usa `&` cuando ya hay query.
8. **La aprobación no miraba la red ni el módulo y no era idempotente.**
   `meterEnElGrupo` bloquea el grupo, decide con `motivoDeLaInvitacion` —la
   misma función con la que la bandeja avisa— y hace `onConflictDoNothing`.
9. **`/mi/cuenta` enseñaba la célula con el módulo apagado.** `misGrupos`
   filtra por `tieneModulo`.
10. **`test:puertas`** cubre la portada de la red (`/mi/equipo/[id]`) y
    `/temas` de El Prado con enlace@. Para la portada, donde enlace@ SÍ entra,
    hay un mecanismo nuevo, `ajenos`: lo que esa cuenta no tiene que ver
    aunque la página pinte (El Prado, Suba y su gente fuera del equipo). Se
    comprobó con el control negativo que salta.
11. **«Cambiar el enlace» no paraba las pendientes.** La invitación guarda el
    código con que llegó; si ya no es el del grupo, al aprobar entra en la
    iglesia y no en la célula, y la bandeja lo avisa.
12. **`contarLaRed` contaba en contra el día de reunión.** Las de hoy y las que
    no han empezado quedan fuera de «N de M», y la tarjeta dice cuántas se
    reúnen hoy.
13. **`/privacidad` cambia sin subir versión.** Se deja así, como pidió la
    revisión: ver «Lo que queda».

Lo que la revisión deja a la sesión de módulos: `ESTADO.md` y
`docs/modulos/cola.md`, que actualiza ella al fusionar.

**Y la verificación de los arreglos.** Cuatro revisores leyeron el diff
desde ángulos distintos (SQL, la invitación de punta a punta, las actions, lo
que se pinta) y un escéptico intentó tumbar cada hallazgo. Quedaron ocho, los
ocho de gravedad baja, y se arreglaron así:

- **Tres carreras de milisegundos**, cerradas en la base con la `0050`:
  archivar la red mientras alguien entra (el trigger sacaba a la gente antes de
  cerrar los grupos; ahora al revés, como `cerrarGrupo`); dar de baja mientras
  la red suma a esa persona (`validar_grupo_miembro` bloquea la ficha viva y el
  grupo abierto al entrar); y sumar la invitación mientras el pastor resuelve
  la solicitud (`validar_solicitud_invitacion` la exige pendiente con `FOR
  SHARE`, contra el `FOR UPDATE` de aprobar y rechazar). Las dos primeras se
  reprodujeron con dos conexiones de verdad: la segunda sesión espera al
  bloqueo y la persona queda fuera.
- **`esta_en_grupo()` pide el grupo abierto**, como `lleva_grupo()`, y el
  comentario de `grupos` en la base ya no cuenta la RLS de la `0047`.
- **El aviso de grupo cerrado se perdía** si el cierre llegaba a mitad de la
  action: mandaba a la ficha, que ya da 404. Ahora a la lista de la red. Y la
  ficha de baja tiene su mensaje.
- **Tres textos que prometían de más**: la bandeja («salvo que la unas a una
  ficha que ya va a otro de esa red»), `/mi` tras sumar la invitación («si
  sigue abierto cuando te aprueben…») y, cazado en el navegador, `/solicitar`
  a quien ya va a esa célula («Ya vas a Los Pinos»).
- `sumarInvitacionASolicitud` pasa por Zod, como pide la convención, y si la
  solicitud se resolvió mientras tanto vuelve a `/mi` sin romperse.

Se descartaron cinco: uno ya estaba arreglado, y los otros cuatro no tenían un
caso que fallara.

**Y una segunda verificación, de la 0050.** Tres revisores (bloqueos,
regresiones, la app) y un escéptico por hallazgo. Todo lo que quedó, de
gravedad baja, se arregló con la `0051` y unos textos:

- **El `FOR SHARE` de la ficha que puso la 0050 se cruzaba con pasar lista**
  (`refrescar_ultima_asistencia` actualiza las mismas fichas en otro orden):
  interbloqueo y página de error. El cerrojo ahora es de la baja y no de la
  fila: uno consultivo por ficha, compartido al entrar y exclusivo en el
  trigger de la baja. Tocar la ficha por otra cosa ya no espera.
- **Baja y archivo de la red se cruzaban** (desde la 0049): la baja bloqueaba
  el equipo y después los grupos; el archivo, al revés. Los dos triggers
  bloquean ahora el equipo antes que los grupos.
- **Crear una célula mientras se archiva su red** la dejaba abierta en una red
  archivada. `validar_grupo` bloquea la red y la exige activa (HT132).
- **La 0050 decía algo falso**: que la app no podía bloquear la ficha porque
  `FOR SHARE` pasa por una policy de UPDATE que la colíder no tiene. `miembros`
  tiene una sola policy, FOR ALL por iglesia. Lo cuenta la 0051 y se corrigió
  el comentario de `anadirIntegrantes`.
- **Textos**: `/solicitar` y `/mi` ya no prometen el grupo sin más («si para
  entonces sigue abierto y con este enlace»), y sumar a alguien que se dio de
  baja con el diálogo abierto lo dice.

Las cinco carreras (archivar y dar de baja mientras alguien entra, tocar la
ficha mientras entra, crear una célula mientras se archiva la red, y baja
contra archivo) se reprodujeron con dos conexiones: diez comprobaciones en
verde, con la demo intacta después.

---

## Verificado ejecutándolo

Navegador integrado a **375 × 812**, en `celulas.localhost:3009` (y la
invitada en `invitada.localhost:3009`, con su propio tarro de cookies). Con el
panel del navegador oculto, así que cada escritura se comprobó en la base.

- **pastor@**: activó «Células» en `/panel/modulos` (ministerio creado), sumó
  a Sara, Andrés y Marta al equipo, nombró a Sara colíder, creó **Los Pinos**
  (martes 19:30, Kennedy, líder Andrés) y **El Prado** (jueves 20:00, Suba,
  líder Marta), sumó a Lucía y Carmen a Los Pinos y a Marcel y Julián a El
  Prado (Lucía ya no se ofrecía en El Prado), y cambió El Prado a miércoles
  desde la ficha. Cada fila, en la base con `desde` en la fecha de Bogotá y
  `creado_por` el pastor. La portada del ministerio y el listado avisan de «1
  célula sin reportar».
- **enlace@ (Andrés, rol miembro, voluntario de la red)**: en su pestaña
  Equipo, «Tu célula · Martes 27 · Los Pinos» y «Abrir tu célula». **Reportó
  la semana** con dos toques en «+» y el tema: fila `celebrada`, 3 y 2 visitas,
  firmada por él. **La otra célula le da 404** (sin un solo nombre de El
  Prado), y también la lista de la red y el panel (a `/mi`).
- **colider@ (Sara, rol miembro, colíder de la red)**: en la portada, la
  tarjeta «Células» con «1 de 2», 3 vinieron y 2 visitas, y «Esta semana no
  hay guía común». **Publicó la guía** de esta semana y la siguiente desde la
  app; las dos filas firmadas por Sara, y el aviso volvió a la app.
- **miembro@ (Lucía, participante de Los Pinos, fuera del equipo)**: en
  `/mi/cuenta`, Los Pinos y quién la lleva, sin Carmen. La pantalla de la
  célula y la portada de la red, 404.
- **El enlace de invitación**: sin sesión, `/solicitar/betania?grupo=…` dice
  «Vienes con la invitación de Los Pinos» y el código sobrevive a «Crear mi
  cuenta». Se creó **invitada@hatril.test** (Inés Invitada, contraseña la de
  la demo) desde `/crear-cuenta` en localhost, envió la solicitud (entonces con
  `grupo_id` = Los Pinos; hoy iría a `solicitud_invitaciones`), el pastor la vio en la bandeja con «Viene con la
  invitación de Los Pinos (Células)» y la aprobó: **ficha nueva, membresía
  activa y fila de participante en Los Pinos**. Inés ve en su cuenta su
  célula, su líder y el próximo tema, que es el de la guía de Sara. No tiene
  pestaña Equipo.

**Los arreglos de la revisión, el 23-oct**, a 375 × 812, cada cuenta en su
host (`celulas.`, `visita.`, `pastor.`, `enlace.localhost:3009`):

- **miembro@ (Lucía) abre el enlace de Los Pinos**: «Ya vas a Los Pinos… tú ya
  estás dentro». Con el de El Prado: «Ya eres de Iglesia Betania… pídeselo a
  quien lleva su red». La primera versión le decía a Lucía que pidiera entrar
  en la célula a la que ya va: se cazó aquí.
- **visita@ (solicitud pendiente sin invitación) abre el de Los Pinos**: «Ya
  pediste unirte…», pulsa «Sí, entrar también en Los Pinos» y llega a `/mi`
  con «Hecho: tu solicitud lleva la invitación del grupo…». Fila en
  `solicitud_invitaciones` con el código de Los Pinos. Si vuelve al enlace, va
  a `/mi`. Se repitió con la `0050` aplicada, con el mismo resultado.
- **pastor@, en la bandeja**: «Viene con la invitación de Los Pinos (Células).
  Al aprobarla, quedará en ese grupo, salvo que la unas a una ficha que ya va
  a otro de esa red.» Con el código de la fila cambiado a mano, el aviso de
  enlace cambiado, con su icono. La fila se borró después, las dos veces:
  visita@ queda como estaba. **No se aprobó**: visita@ es la cuenta de «tu
  solicitud está en revisión».
- **pastor@, en el panel**: creó «Prueba viernes» (hoy, viernes) y la tarjeta
  de la red dijo «1 de 2» y «1 se reúne hoy y entra en la cuenta cuando la
  reporte». La cerró en una pestaña y, desde la ficha abierta antes en otra,
  pulsó «Añadir» auxiliar: «Ese grupo ya no está abierto…», con icono, y en la
  base nadie entró; la líder quedó fuera con su `hasta`. La célula de prueba se
  borró después (quedan sus dos filas de `auditoria`).
- **enlace@ (Andrés)**: la portada de la red, «Tu célula · Los Pinos» y el
  equipo, nada de El Prado; su célula, con los textos nuevos de Invitar y de
  «Su gente».
- **No se ejecutó el punto 7** (`volverCon` con `?grupo=`): el formulario de
  `/solicitar` solo se pinta a quien tiene cuenta y ni iglesia ni solicitud, y
  en la demo no hay nadie así. Comprobado leyendo el código.

`npm run test:aislamiento`: 309 comprobaciones SQL y las de `withUser()`, con
las nuevas de la 0049 (invitaciones solo del pastor, la célula de al lado
invisible para su vecino, HT132 al entrar o reactivar en un grupo cerrado, la
baja y el archivo que sacan, la red archivada que cierra, `lleva_grupo` falso en
un grupo cerrado, y enlace@ sin la fila de El Prado) y de la 0050 (quien va a
un grupo cerrado deja de verlo, una ficha de baja no entra, y ninguna
invitación sobre una solicitud resuelta) y de la 0051 (ninguna célula se abre
en una red archivada). Las carreras no caben en una
transacción: se probaron aparte, con dos conexiones, sobre una célula de
prueba que se borró después y con la segunda transacción siempre deshecha. `npm run test:puertas`:
77 rutas y 471 combinaciones, 0 fallos, con el control negativo detectando los
33 casos denegados de la app.

**Comprobaciones de la primera tanda**: `npx tsc --noEmit`, `npx eslint src scripts`,
`npm run build` y `npm run test:aislamiento` en verde. El aislamiento suma 42
comprobaciones SQL de grupos —HT132 en sus seis formas, HT133, HT134, los
índices únicos, los CHECK, cada papel por relación, sacar a la líder del
equipo, Sion, anon, authenticated y service_role, y las funciones cerradas— y
cinco por `withUser()` con las cuentas de la demo (Andrés ve Los Pinos y no El
Prado; Lucía, su fila y quien la lleva; Sara, las dos). `npm run test:puertas`
con las siete rutas nuevas: ver abajo.

**No se pudo**: `get_advisors` de Supabase da «no tienes permiso» desde esta
sesión. Se comprobó a mano lo que mira: RLS activada en las cuatro tablas,
`has_table_privilege` de anon, authenticated y service_role en falso, y el
`proacl` de las doce funciones nuevas (`{postgres=X}` en las de trigger,
`{postgres=X, hatril_app=X}` en las dos de relación).

---

## Lo que queda, y lo que decide Marlon

- **`VERSION_POLITICA_PRIVACIDAD` sin subir**, a propósito: lo decide Marlon.
  El párrafo de células está en `/privacidad` §3 y §6, y la categoría en el
  anexo del art. 28 de `/terminos`, revisados frase a frase contra el código.
  **La revisión del 23-oct volvió a cambiar `/privacidad` sin subirla**, para
  que diga lo que hace ahora la base: quien no lleva esa red ni va a ese grupo
  no ve dónde ni cuándo se reúne; la invitación solo la ve el pastor y se
  borra al resolver la solicitud; al aprobarla se entra si el grupo sigue
  abierto, el enlace no ha cambiado y no se va ya a otro de su red; y darse de
  baja también saca del grupo. `/terminos` (art. 28) seguía siendo cierto y no
  se tocó.
  Se junta con lo ya redactado de consolidación y radio. Antes de subirla,
  la trampa de siempre: guardar la negativa de asistencia como fila. Al
  subirla, cambiar también `ultimaActualizacion` (`lib/legal/datos-responsable.ts`).
- **La supresión manual suma una tabla con personas**: `grupo_miembros`.
  Cuelga de la ficha con ON DELETE CASCADE, así que borrar la ficha se la
  lleva; pero va en la lista de `ESTADO.md` («El derecho de supresión sigue
  siendo manual»), que esta rama no toca. `grupo_semanas` no lleva a nadie.
- **Una iglesia no se borra con un `delete from iglesias`**: `grupos` se
  audita, así que entra en la lista de tablas que vaciar antes (la trampa de
  `ESTADO.md`).
- **Un aviso de consola que no es de esta rama**: en `/mi`, el botón «Ver su
  página» de la solicitud en revisión (`Button` con `render={<Link>}`) hace que
  Base UI se queje de `nativeButton`. Viene de 92897bd.
- **Avisos en la campana**: «tu célula no ha reportado» y «alguien entró por
  tu enlace» pedirían valores nuevos de `tipo_notificacion_enum`, en su propia
  migración. No se han hecho, como pedía el encargo.
- **Quien ya es de la iglesia y abre el enlace** ve que el enlace no es para
  él y que le sume la red. Unirse con el código desde dentro
  (`/mi/grupo/unirme/[código]`) sigue siendo una pantalla más, sin hacer.
- **La reunión de la célula no sale en `/mi/agenda`**. Haría falta un tipo de
  día nuevo en `calendario.ts`.
- **Consolidación v2** (punto 3 de la cola) puede asignar al nuevo a una
  célula con esta misma pieza: es una fila de `grupo_miembros`.
- **La escuela dominical** añade su etiqueta «clase» en `etiquetas.ts` y
  enciende `grupos` en su tipo. Sin participantes niños hasta la revisión legal.

---

## Datos de prueba

`scripts/seed-celulas.sql`, idempotente, va después de `seed-demo.sql` y
`seed-base-comun.sql`: la red «Células» con Sara de colíder, Los Pinos y El
Prado con su gente, dadas de alta el 5-oct. Probado sobre la base tal como
quedó (no duplica nada) y desde cero dentro de una transacción deshecha.

Lo que quedó de las pruebas y la semilla no crea: el reporte de Los Pinos de
la semana del 19-oct, la guía del 19 y el 26-oct, y **invitada@hatril.test**
(Inés Invitada) dentro de Los Pinos con su solicitud aprobada. Ojo, si se
repite la prueba del enlace: hay que borrar antes su membresía, su ficha y su
fila de Los Pinos.

---

## Trampas

- **El panel del navegador oculto** deja las pantallas sin repintar tras una
  action: la captura sigue en el formulario aunque la fila ya esté en la base.
  Navegar otra vez a la URL. Y comprobar siempre en la base.
- **`/auth/confirm` redirige a `localhost`**: con un host propio
  (`celulas.localhost`), después de canjear el enlace hay que volver a
  navegar a mano al host.
- **`test:puertas` contra `127.0.0.1`**, no contra `localhost`: con `-H
  127.0.0.1`, `localhost` puede resolver a `::1` y no conectar.
- **`test:puertas` sale con EXIT 2 y un `TimeoutError`, sin un solo FALLO**:
  casi seguro es Turbopack compactando su caché («Finished filesystem cache
  database compaction in 5.1min» en el log del servidor), que congela el
  servidor de desarrollo varios minutos; de paso el pooler de Supabase cierra
  las conexiones ociosas (`ECONNRESET`). No es una puerta rota: esperar a que
  acabe y repetir. Pasó dos veces seguidas el 23-oct.
- **En Git Bash, `PUERTAS_SOLO="/mi/…"`** lo reescribe MSYS como una ruta de
  Windows y no casa con nada: quitar la barra inicial.
- **Un script con `postgres` y `max: 1` no puede usar la conexión de fuera
  dentro de su propia transacción**: espera a sí mismo para siempre, con la
  transacción abierta y sus bloqueos puestos. Dentro, solo el manejador de la
  transacción.
