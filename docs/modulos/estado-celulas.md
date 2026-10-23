# Células sobre una pieza genérica de grupos — estado de la rama `claude/awesome-driscoll-58a8cc`

22 y 23 de octubre de 2026. Encargo: el punto 2 de `cola.md`. Las células como
Marlon las describió —reuniones de oración en casas, cada una con su líder, que
organiza los temas, ve a su gente y cuántos vinieron; quien va se apunta a una
célula concreta, y lo que se busca es que quien va a una célula se baje la app
y conozca la iglesia— sobre una pieza que la escuela dominical reutilizará para
sus clases.

**Migraciones `0046_grupos` y `0047_grupos_rls`, APLICADAS** con el migrador de
drizzle-orm: `drizzle.__drizzle_migrations` pasa de 46 a 48 filas. Códigos
**HT132, HT133 y HT134** cogidos. **La siguiente migración es la 0048 y el
siguiente código, HT135.**

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

Y `solicitudes_ingreso.grupo_id`: el grupo de cuya invitación viene una
solicitud.

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
crear la cuenta y a identificarse, y lo guarda en la solicitud. La bandeja lo
dice al pastor, y **al aprobar, la persona queda en esa célula como
participante** (si sigue abierta y no va ya a otra de esa red). Entra en la
iglesia entera, con la app.

---

## Decisiones, y por qué

**RLS por relación, no solo por iglesia.** Es la segunda excepción a la
doctrina del repo, y la `0047` lo cuenta entero. En corto: la llave es un dato
(la fila de `grupo_miembros`), no un permiso, así que no se duplica
`permisos.ts`; quien la tiene son 40 a 120 líderes de célula con rol `miembro`
entrando por `/mi`, la población más grande del producto con poder sobre datos
ajenos; y la pieza la heredará la escuela, con menores. Lo que ve cada uno:

| | `grupos` | `grupo_miembros` | `grupo_semanas` | `grupo_guias` |
|---|---|---|---|---|
| Pastor | todo | todo | todo | todo |
| Responsable y colíderes de la red | su red | su red | su red | toda la iglesia |
| Voluntario de la red (líder de otra célula) | su red | **solo su célula** | **solo su célula** | toda la iglesia |
| Participante | **su célula** | **su fila y quien la lleva** | su célula | toda la iglesia |
| Resto de la iglesia | nada | nada | nada | toda la iglesia |

Escriben: `grupos` y `grupo_miembros`, el pastor y quien lidera la red;
`grupo_semanas`, además quien lleva ESE grupo. `gestionar_ministerios` no entra
en ninguna. `lleva_grupo()` exige además seguir en el equipo: sacar a alguien
del equipo le quita la célula sin reescribir su fila.

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
enlace, con su consentimiento en `/solicitar`, y a quien no tiene la app lo
suma la red desde el panel. Cerrar no es borrar: la célula sale de las listas
y su gente queda fuera, pero sus semanas se quedan.

**`grupos` se audita; `grupo_miembros`, no.** Como `turnos` y
`turno_asignaciones`: `auditoria` la lee solo el pastor y no se borra, y la
lista de quién va a qué célula no puede quedarse ahí para siempre.

**El contrato de la app tiene dos campos más**, opcionales y sin tocar a nadie:
`ResumenDeModulo.titulo` y `.abrir`, para que la tarjeta diga «Células» o «Tu
célula» y su enlace «Ver todas las células». Y `requireAppAbierta` sale
exportada de `en-la-app/guarda.ts`, para la guarda de la célula.

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
  la demo) desde `/crear-cuenta` en localhost, envió la solicitud (fila con
  `grupo_id` = Los Pinos), el pastor la vio en la bandeja con «Viene con la
  invitación de Los Pinos (Células)» y la aprobó: **ficha nueva, membresía
  activa y fila de participante en Los Pinos**. Inés ve en su cuenta su
  célula, su líder y el próximo tema, que es el de la guía de Sara. No tiene
  pestaña Equipo.

**Comprobaciones**: `npx tsc --noEmit`, `npx eslint src scripts`,
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
- **Avisos en la campana**: «tu célula no ha reportado» y «alguien entró por
  tu enlace» pedirían valores nuevos de `tipo_notificacion_enum`, en su propia
  migración. No se han hecho, como pedía el encargo.
- **Quien ya es de la iglesia y abre el enlace** acaba en `/panel/hoy` →
  `/mi`, como antes, sin quedar en la célula. Unirse con el código desde dentro
  (`/mi/grupo/unirme/[código]`) es una pantalla más.
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
