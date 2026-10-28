# Estado de Hatril

Última actualización: 28 de octubre de 2026.

Este fichero se actualiza al cerrar cada sesión de trabajo. Va **dentro del
repo** a propósito: Pidoo guardaba su detalle en ficheros `memory/` fuera del
repositorio y hoy no existen, así que cuatro meses de decisiones se perdieron.

---

## Dónde está desplegado

| Qué | Dónde |
|---|---|
| Repo | `github.com/marlonrodelo1/hatril`, rama `main` |
| Despliegue | Dokploy en VPS `187.124.37.206`, autodeploy al hacer push |
| Dominio | **`https://hatril.com`**, con certificado válido, resolviendo al VPS (20-oct). Sin registros MX: `hola@hatril.com` todavía no recibe nada. Antes, la temporal de Dokploy en `traefik.me` |
| Apps | `Versiones/Android/Hatril-1.0.0-1.aab` y `.apk` (fuera de Git), contra hatril.com. iOS: `ios/` sincronizado, sin compilar (hace falta el Mac) |
| Base de datos | Supabase `qutoggpigkdginvburjv`, org `ministeriales`, eu-west-1 |
| Diseños | claude.ai/design `107021c4-dd85-485d-9cc7-34ef639d92ae` |

El despliegue usa el `Dockerfile` del repo (Build Type: Dockerfile, no
Nixpacks). Las tres variables `NEXT_PUBLIC_` tienen que estar **además** en
*Build-time Arguments*: Next las incrusta en el JavaScript al compilar, no las
lee al arrancar.

---

## Qué funciona, verificado ejecutándolo

- **La primera iglesia real: Cuerpo de Cristo** (23-oct), la de Marlon, en
  `https://hatril.com/i/cuerpo-de-cristo` (id `4b79f1b9-…-ecd40b943a23`). Datos,
  logo y fachada sacados de cuerpodecristoacentejo.com; zona `Atlantic/Canary`,
  no Madrid; prueba hasta el 31-dic; fuera del directorio. Cinco ministerios
  (Alabanza, Escuela dominical, Acción social, Evangelización, Radio). Israel
  Sanz de Diego, pastor, tiene cuenta desde el 23-oct (los datos de acceso,
  en `altas/`, fuera de git). Su dirección es de un dominio sin buzón, así que
  no puede recuperar la contraseña él solo, y la contraseña es provisional y
  débil: **hay que cambiarla antes de meter a ningún miembro**. Silvia Martín,
  pastora, tiene ficha pero **no cuenta**: falta su correo. Con la cuenta de
  Israel se abrieron las solicitudes de ingreso. Las fotos de Remar de su web NO se subieron:
  salen caras de niños y de personas vulnerables, y falta que la iglesia
  confirme que puede usarlas.
- **Alta asistida** (`npm run alta:asistida -- altas/<carpeta>`): la iglesia la
  da de alta Rogotech, no ella. La carpeta `altas/` está fuera de git y guarda
  `alta.json`, `estado.json` (los ids de lo creado: las pasadas siguientes
  buscan por id, nunca por slug ni por nombre) y `accesos.txt`. Las cuentas
  nacen con `consentimiento_pendiente` en `app_metadata` y entran a `/acepta`
  antes que a nada: probado en local con una cuenta de prueba, las seis puertas
  (`/panel/*`, `/mi`, avisos, comunidad, equipo) la mandaban allí, y al aceptar
  quedó la fila `datos_religiosos` y entró al panel. **No crear cuentas con el
  script hasta que el commit `4a0ba46` esté desplegado**: el código anterior no
  mira esa marca y las dejaría entrar sin aceptar.

- **Super admin, `/admin`** (28-oct). A la manera del de Pidoo, en pequeño:
  **Inicio** (iglesias por situación, personas, cuentas y solicitudes; las
  pruebas que acaban esta semana y las vencidas; las últimas altas),
  **Iglesias** (filtro por situación y buscador; la ficha con sus recuentos,
  sus pastores con correo, la suscripción y los datos) y **Cuentas** (a qué
  iglesia pertenece cada una y cuándo entró por última vez). Las palancas:
  **ampliar la prueba** (solo en `trial`: con `cancelado` esa fecha es periodo
  pagado; hasta las 23:59 de la zona de la iglesia; un año como mucho),
  **suspender y reactivar** (`activa`: fuera del panel, de `/mi`, de la web y
  del directorio; pide casilla), **sacar del directorio** (solo hacia fuera) y
  **poner una contraseña provisional**, que es lo que necesita el pastor de
  Cuerpo de Cristo. Todo por `dbAdmin` y **sin una sola ficha de miembro**:
  solo recuentos, porque somos encargados y nadie nos ha pedido mirar el
  fichero. `requireSuperAdmin()` va en cada página y cada action; mandaba a
  `/login`, que aquí no existe. El super admin sin iglesia aterriza en
  `/admin` al entrar y desde `/mi`. **`npm run test:puertas:admin`**: cinco
  rutas, cuatro cuentas que no pueden más la anónima, normal y con `RSC: 1`,
  30 de 30; con `PUERTAS_CONTROL=1` detecta las 20 fugas simuladas. Probado
  en el navegador como `admin@` sobre Betania, a 1024 y a 375 px, y Betania
  devuelta a como estaba. **Sin probar**: cambiar de verdad una contraseña
  (sí el rechazo de una que no cumple la regla).

- **La paleta es la de Claude en claro, desde el 15-oct**: crema #FAF9F5,
  tarjetas blancas y naranja quemado #B15435. Sustituye al oscuro del 22-ago,
  que a su vez sustituyó al naranja y verde de Claude Design. Marlon descartó
  antes cuatro propuestas (azul, oro, vino y ciruela). Ya no hay verde de marca:
  el secundario es el carbón #3D3D3A, y el azul #2C84DB solo existe para
  distinguir categorías. Valores sacados de la hoja de estilos de claude.ai,
  contrastes medidos uno a uno; el porqué está en la cabecera de `globals.css`.
  Revisado en el navegador: muro, devocional, agenda, cuenta, panel, web
  pública, portada y acceso. Quedan sin arreglar, a propósito, tres contrastes
  que ya eran bajos antes del cambio: los días del mes vecino en el calendario
  (2.6:1), la inscripción cancelada de un evento con `opacity-60` y la muestra
  del color Dorado de ministerio sobre su fondo suave (2.7:1).
- **Guía visual para pantallas nuevas, y su inventario** (20-oct,
  `docs/diseno/`). `guia-visual.md` dice qué copiar y de dónde, con doce reglas
  cortas y cuatro pantallas de referencia —turnos, repertorio, el muro y la
  agenda—; la app del líder ya se construyó con ella. `inventario-visual.md` es
  la fase 1: lo que falla hoy en toda la aplicación, medido a 375 y a 1280 px
  con cinco cuentas, en siete graves (M1–M7), diecisiete que se notan algo y
  quince detalles, cada uno con su fichero y su arreglo. La fase 2, los
  arreglos, está en «Qué falta».
- **La marca: el atril** (20-oct). La «t» de Hatril es un atril con la Biblia
  abierta (la propuesta 3-b; las piezas, la lámina y el veredicto están en
  `Versiones/marca/final/`, fuera del repo). En la web lo pinta
  `src/components/marca/logo.tsx`, en SVG y con tokens: el logotipo en la
  portada (cabecera y pie), el directorio, las legales, la sala de espera de
  `/mi`, `/acepta`, `/suscripcion` y el acceso; el símbolo, arriba del acceso
  en el móvil. Por debajo de 40 px el símbolo usa los favicons dibujados a
  mano. Favicon e iconos de la web en `src/app` (`favicon.ico`, `icon1.png`,
  `icon2.png`, `apple-icon.png`) y los de Android e iOS salen todos de
  `assets/` con `npm run app:iconos`. El panel no lleva la marca de Hatril:
  muestra la de cada iglesia. Comprobado a 375 y 1280 px y en el emulador.
- **Acceso**: entrar, registrar iglesia, crear cuenta personal, recuperar
  contraseña. Rehecho el 20-oct: el mismo marco en las cinco pantallas,
  pensado para el móvil de 375 px, que es lo primero que ve la app nativa.
- **Panel**: inicio (avisos accionables arriba, cifras debajo), miembros
  (listado con filtros, ficha, alta, edición, baja),
  ministerios (rejilla, detalle, equipo, asignar, responsable y colíderes,
  tipo, misión, visión, objetivo y sus herramientas),
  solicitudes (bandeja con aprobar y rechazar), **líderes** (rol y permisos por
  persona, quitar y devolver el acceso), ajustes.
- **Permisos**: el pastor reparte seis capacidades desde `/panel/lideres`. Los
  roles `lider`, `tesorero` y `secretaria` ya son asignables — hasta la sesión
  del 16-ago solo existían por SQL.
- **Ministerios con varios líderes**: un responsable garantizado único por la
  base de datos, más los colíderes que hagan falta. Un líder gestiona los suyos
  y nada más (`gestionar_su_ministerio`).
- **La jerarquía de los ministerios, de punta a punta** (base común de los
  módulos, 19-oct; el plan entero está en `docs/modulos/plan.md`). Verificado
  ejecutándolo como `colider@`, `pastor@`, `secretaria@` y una cuenta recién
  registrada, también a 375 px:

  - **Liderar da acceso, sin tocar el rol.** Antes hacían falta dos llaves:
    nombrar responsable a alguien con rol `miembro` no le dejaba entrar al panel,
    y le llegaban avisos con enlace al panel que rebotaban.
    `gestionar_su_ministerio` es ahora defecto de todos los roles y el ámbito lo
    pone el dato; `esDelEquipo` solo lo cuenta si de verdad lidera algo. Quien
    solo lleva sus ministerios aterriza en la app, en la pestaña Equipo
    (`/mi/equipo`; con uno solo, directo a su portada), y el panel le queda en
    el menú del avatar: lo decidió Marlon el 20-oct. En el panel, el menú abre
    con «Lo que llevas».
    Ojo: una cuenta con rol `lider` que no lidera nada ya no entra al panel.
  - **El pastor activa, el líder configura.** Tipo y herramientas de un
    ministerio solo los cambia el pastor o `gestionar_ministerios`; el líder ve
    las dos cosas como texto y edita lo demás. Probado inyectando `tipo` y
    `modulos` en el formulario: se ignoran.
  - **Quién toca a quién.** El responsable solo lo quita o cambia el pastor. Los
    colíderes los nombra y los quita el responsable o el pastor, no otro colíder:
    si no, cualquier colíder metería gente en el panel sin que el pastor lo
    sepa. Un colíder sí lleva a los voluntarios. Había tres puertas abiertas y
    las tres están cerradas: quitar, cambiar papel y —la que nadie miraba—
    «Asignar miembros», que reactivaba como voluntario también a quien ya estaba
    activo. Probado mandando el id del responsable por esa puerta: sigue igual.
  - **Guardar una ficha ya no quita cargos.** `editarMiembro` desactivaba todas
    las filas de ministerio y las reinsertaba como voluntario: corregir el
    teléfono del responsable dejaba al ministerio sin cabeza. Ahora compara, y
    sacar a un líder desde su ficha queda para el pastor.
  - **Enlazar la cuenta con la ficha que ya existía.** Aprobar insertaba siempre
    una ficha nueva, así que el líder que el pastor ya tenía en el fichero
    entraba sin sus ministerios. Al aprobar se ofrecen las fichas sin cuenta que
    coinciden por correo o teléfono, sin ninguna marcada, con el aviso de que esos
    datos los escribe quien pide entrar. Probado: una sola ficha, con su
    ministerio, y sus consentimientos.
  - **La casilla de asistencia también al solicitar** (migración `0040`).
    Aprobar registraba el consentimiento general en la versión vigente sin el de
    asistencia, y `miembrosSinPermisoDeAsistencia` lee esa combinación como «dijo
    que no»: toda persona aprobada desaparecía de las listas sin haberlo dicho.
    La solicitud guarda ahora la casilla y la versión que se leyó.
  - **Herramientas en la app**: en `/mi/cuenta`, «Abrir herramientas» en cada
    ministerio que la persona lleva.
  - **La lista del ensayo respeta el permiso de asistencia**, y solo escribe en
    reuniones de SU ministerio: antes un colíder podía mandar el id del culto del
    domingo y pisar la asistencia de la congregación. Y al revés: `/panel/reuniones`
    ya no abre ni escribe un ensayo (404). El seguimiento tampoco acepta ya a
    quien negó el permiso.
  - **Una cuenta en dos iglesias no cruza de una a otra.** La RLS deja escribir
    en todas las iglesias donde la cuenta está activa, no solo en la del
    contexto, y `puedeGestionarMinisterio` dejaba pasar al pastor con cualquier
    id: el pastor de A vaciaba el equipo de un ministerio de B, donde es un
    miembro más. Ahora `requireGestionMinisterio(Accion)` comprueba que el
    ministerio es de la iglesia del contexto, y cada escritura de
    `ministerio_miembros` filtra además por iglesia, igual que `darDeBaja`.
  - **Guardar una ficha sin `ver_datos_sensibles` ya no borra** la fecha de
    nacimiento, la dirección, el estado civil y las notas. Esos campos no se
    pintan y no viajar es llegar como null; ahora se quedan fuera del UPDATE.
- **Catálogo de módulos**: `/panel/modulos`, «Activa lo que usa tu iglesia».
  Una tarjeta por tipo con sus herramientas; activar crea el ministerio con su
  plantilla y lleva a él para nombrar responsable. Reconoce los ministerios
  anteriores a la `0028`, que se guardaron como «Otro»: dice «Ya lo tienes» en
  vez de crear un «Jóvenes 2». No tiene «Desactivar» a propósito: cerrar un
  ministerio da de baja a todo su equipo y vive en su pantalla de editar.
- **Ministerios que hacen algo, no solo se ven**: cada uno tiene un **tipo**
  (alabanza, consolidación, niños, evangelismo, acción social, medios…) que al
  elegirlo enciende sus **herramientas**, y misión, visión y objetivo. El
  catálogo de tipos vive en `src/lib/ministerios/tipos.ts` y el de módulos en
  `modulos.ts`; lo encendido se guarda en `ministerios.modulos`, un jsonb
  validado con Zod por la única action que lo escribe.

  No se programa una pantalla por tipo: se programan piezas y cada tipo enciende
  las suyas, así que un ministerio de radio o de reparto de alimentos funciona
  sin tocar código. Hoy existen **seis módulos de verdad**, `agenda`,
  `turnos`, `repertorio`, `seguimiento`, `reparto` y `emisora`; el resto no se
  declara hasta que se pueda pulsar.

  **Cada action de módulo comprueba que el módulo esté encendido**
  (`exigirModulo()` en `guard-panel.ts`, detrás de
  `requireGestionMinisterioAccion`). Hasta el 20-oct solo lo miraba el
  `layout.tsx`, que no corre en una action: quien llevaba un equipo escribía en
  la agenda o el seguimiento apagados con un POST fabricado. Lo usan agenda,
  turnos, repertorio (la lista del culto pide además turnos), seguimiento,
  reparto y emisora. Verificado apagando el reparto en la base con la pantalla
  abierta y pulsando un botón: vuelve al ministerio con «Esa herramienta no está
  encendida» y el contador no se mueve.

  Qué trae cada tipo de salida: Alabanza, agenda, turnos y repertorio; Niños e
  Intercesión, agenda y turnos; Ujieres y Medios, turnos y agenda; Radio,
  emisora, turnos y agenda; Consolidación y Evangelismo, agenda y seguimiento;
  Acción social, reparto y agenda; Jóvenes y Otro, solo agenda. Siguen sin diferenciarse del todo hasta que lleguen
  material e inventario.

- **Reparto** (entrega de alimentos, tanda 1 del plan, v1 «solo la puerta»):
  `/panel/ministerios/[id]/reparto`, con Hoy, Padrón e Historial. Verificado con
  un domingo simulado como `colider@` en un móvil de 375 px, y cada fila
  comprobada en la base: empezar el reparto, tres altas en la puerta (una con
  teléfono, que se guarda en E.164), un alta sin la casilla rechazada por el
  servidor, «Entregado» desde la cola y desde el buscador por número, «Quitar»,
  «Ha llegado» desde el buscador por nombre, «Deshacer», sin apuntar +1 +1 −1,
  editar, baja, reactivar y borrar. Resultado: «4 han venido, 3 entregados, 1
  esperando», todo firmado por Sara, y cero filas en `auditoria`. `lider@`
  (otro equipo) rebota en la URL, y con el módulo apagado la ruta da 404.

  El 20-oct, a petición de Marlon, tres piezas más y una pasada visual,
  verificadas igual como `colider@` a 375 px y con las cifras cuadradas a mano:

  - **«Entregar sin inscribir»** (antes «Sin apuntar»): un botón que suma una
    entrega sin guardar a nadie, y su corrección de menos uno. El día y el mes
    lo enseñan aparte («9 entregas, 4 sin inscribir»).
  - **Aviso «ya recibió hace N días», que no bloquea.** Ventana de hace SEIS
    días a ayer, no siete: casi todas las iglesias reparten un día fijo a la
    semana, y con siete el aviso saltaría con toda familia que viene cada
    domingo, que es lo normal. Sale como insignia en la cola y en el buscador
    —antes de pulsar— y como caja después de marcar (`?ya=`), con el patrón de
    `eleccion-ficha.tsx` (`bg-badge-warning-bg` y `TriangleAlert`, sin
    `role="alert"`, que es para errores). Los botones no cambian.
  - **«Nuevos» del mes**: hogares cuya PRIMERA entrega, en toda su historia,
    cae ese día. Llegar y no llevarse nada no cuenta.
  - **Informe del mes imprimible**, `/reparto/informe?mes=`, enlazado desde el
    historial: repartos, entregas, hogares atendidos, personas alcanzadas,
    nuevos y sin inscribir, y una fila por reparto. Sin nombres. Es el de
    finanzas copiado, sin PDF en el servidor. `BotonImprimir` pasó a
    `src/components`, y el menú lateral y la franja de suscripción llevan ahora
    `print:hidden`: antes no salían en el papel solo porque la hoja suele medir
    menos de 768 px.
  - **El CSV no**: ver «Qué falta».
  - **La puerta del reparto va en cada página, no solo en el layout**
    (`reparto/guarda.ts`). La documentación de Next 16 dice que un layout no
    impide que la página se ejecute ni que su resultado viaje en el payload RSC,
    y aquí la RLS deja pasar a los voluntarios del equipo, que la aplicación no
    deja entrar. Probado pidiendo el informe como `lider@` con `RSC: 1`: ni una
    cifra en la respuesta.
  - Revisado por cuatro revisores con un escéptico cada uno (lógica,
    aislamiento, visual y textos contra el código). Arreglado lo que salió: el
    aviso de después de marcar se pintaba fuera de la pantalla (la vuelta salta
    a `#cola`), `?ya=` no se acotaba a la ventana, `?mes=0050-01` daba un 500,
    «hoy» se calculaba dos veces por action, «−» confirmaba «Entregado sin
    inscribir», la insignia se salía de su columna y el texto de borrar no
    decía todo lo que baja en el informe.
  - **Pasada visual contra turnos, repertorio y agenda**: el contador
    «Esperando» se pintaba de naranja (un segundo naranja sin acción) y las
    cuatro cifras sueltas pasaron a una tarjeta, como en Inicio; títulos de lista
    en `t-micro`; cifras de 24 px; `scroll-mt-24` en los anclajes, que con
    `scroll-mt-4` quedaban tapados por la cabecera fija; botones de fila en
    `ghost` gris; sin `font-mono`; estados vacíos con su botón; y los borrados
    sin tarjeta roja, con el rojo solo en el botón.

  - **Padrón aparte, por hogar y sin texto libre** (`reparto_beneficiarios`):
    el nombre como quiera que le llamen, cuántos viven en la casa y el teléfono
    si lo da. Sin `miembro_id` —inscribirse no hace miembro a nadie, y cruzarlo
    con la ficha sería el mapa «esta persona de la congregación pasa
    necesidad»—, sin documento, dirección, ingresos ni notas, y sin nombres ni
    edades de niños. Número correlativo por equipo, que pone un trigger con
    cerrojo; en la puerta se llama por número, y la pantalla no está hecha para
    proyectarse.
  - **RLS por EQUIPO, no por iglesia** (`0042`): `es_pastor(iglesia_id) OR
    sirve_en_ministerio(ministerio_id)`, y para borrar personas o días,
    `lidera_ministerio()`. Es la primera excepción a «la RLS solo aísla
    iglesias», y consciente: son terceros vulnerables. Las dos funciones nacen
    aquí, revocadas y concedidas solo a `hatril_app`, para que las reutilice la
    escuela. La aplicación es más estrecha que la base:
    `requireGestionMinisterio(id, { desdeDentro: true })` deja al pastor y a
    responsable y colíderes, NO a `gestionar_ministerios` (la base no le
    enseñaría nada) ni todavía a los voluntarios, que no entran al panel. La
    base ya les deja, para la v1.1.
  - **La comida no se condiciona a los datos.** Sin la casilla «se lo he leído»
    no se apunta a nadie, y quien no quiere dar su nombre se suma con
    «Entregar sin inscribir» (`reparto_jornadas.sin_inscribir`), que cuenta
    como venido y entregado. El aviso que se lee en voz alta es `TEXTO_AVISO_REPARTO`, con
    `VERSION_CONSENTIMIENTO_REPARTO` (`reparto-2026-10`), propio y aparte de la
    política: no hizo falta subir `VERSION_POLITICA_PRIVACIDAD`. Sin IP ni
    navegador, que serían los del voluntario.
  - **Borrar a una persona no cambia lo que se repartió.**
    `reparto_entregas.beneficiario_id` es ON DELETE SET NULL, y las personas del
    hogar se COPIAN en la entrega (lo hace HT126, no la aplicación). Se van el
    nombre, el teléfono, el número y el permiso; las entregas de cada día se
    quedan. Lo que sí baja, también en los meses pasados, es lo que se cuenta
    por hogar —hogares atendidos, personas alcanzadas y nuevos—, porque sin
    nombre no se sabe si dos filas eran el mismo hogar. La pantalla lo dice antes
    de borrar. Hay botón para borrar a una persona y otro para borrar
    de una vez a quien lleva un año sin venir —el plazo que promete el aviso—,
    que recalcula la lista en la misma transacción y no borra nada si la cifra
    cambió desde que se vio.
  - **Sin `auditar()`** en ninguna de las tres tablas: `auditoria` copia la fila
    entera y no se puede borrar, y la supresión sería mentira.
  - Legales revisados frase a frase contra el código: `/privacidad` §3, §4 y
    §6, y en `/terminos` el §3 y el anexo del art. 28 (la categoría nueva, los
    tres compromisos de la iglesia y, en el art. 32, el aislamiento también
    entre equipos). Dice además que lo más probable es que la iglesia necesite
    una **evaluación de impacto** (art. 35): personas vulnerables y entidad
    religiosa son dos criterios de la lista de la AEPD. A confirmar con abogado.
  - El nombre del tipo se queda en «Acción social» y no pasa a «Acción social y
    entrega de alimentos», como pedía el plan: el nombre es como el catálogo
    reconoce los ministerios anteriores a los tipos (ver `tipos.ts`). La
    comida va en la descripción.

- **Turnos** (cuadrante de servicio): `/panel/ministerios/[id]/turnos`. Quién
  sirve en cada culto y en qué puesto. Verificado de punta a punta ejecutándolo
  como `lider@` y `miembro@`: planificar seis domingos, poner gente en cada
  puesto, el aviso que le llega a la persona, contestar «no puedo» desde su
  agenda, el aviso que eso le manda al responsable, marcar a mano a quien no
  tiene la aplicación y copiar el cuadrante de un domingo al siguiente.

  - **Los cultos salen del horario semanal**, no de un formulario en blanco: en
    «Planificar» se marcan con un dedo los de las próximas seis semanas, con el
    culto destacado de la iglesia ya marcado. Lo que no está en el horario
    —una vigilia— se crea a mano debajo.
  - **Los puestos** («Guitarra», «Puerta principal») viven en la configuración
    del módulo (`ministerios.modulos.turnos.puestos`) y cada tipo trae los
    suyos de salida (`tipos.ts`). La asignación **copia el texto**, no apunta al
    puesto: renombrar «Voces» a «Coros» no reescribe el pasado, y el turno viejo
    enseña «Voces» con su gente y la marca de que ya no está en la lista.
  - **«Sin contestar» cuenta como cubierto y «no puede» como hueco.** Mucha
    gente del equipo no usa la aplicación; si su silencio contara como hueco, el
    cuadrante saldría medio vacío con el equipo completo. Por eso el responsable
    puede marcar la respuesta de cualquiera («me lo dijo por WhatsApp»).
  - **Solo gente del equipo**, y lo dice la base (HT122): asignar a alguien de
    fuera abriría una puerta lateral al fichero de la iglesia.
  - **El desplegable avisa y no prohíbe** si esa persona ya sirve en otro equipo
    a la misma hora: en una iglesia pequeña es lo normal.
  - **Para el miembro**, en `/mi/agenda`: un bloque «Te toca servir» arriba con
    «Ahí estaré» y «No puedo», el turno en el calendario con su punto blanco, y
    la ficha del turno en `/mi/agenda/turno/[id]` con quién más sirve. Fuera del
    equipo es un 404. Las respuestas ajenas no se enseñan: eso es entre cada
    persona y quien lleva el equipo.
  - **Avisos**: `turno_asignado` (uno por persona y turno, no por puesto) y
    `turno_no_puede`, que va al responsable y a los colíderes. El «confirmo» no
    avisa a nadie, a propósito.
  - **Sin `auditar()` en las asignaciones**, por lo mismo que la asistencia: es
    el calendario religioso de cada persona, y `auditoria` se lee entera y no se
    puede borrar. `turnos` sí se audita, como `reuniones`.

- **Repertorio**: `/panel/ministerios/[id]/repertorio`. Las canciones del
  equipo y la lista de cada culto. Verificado ejecutándolo como `lider@` y
  `miembro@`, también en un móvil de 375 px: alta con un enlace sin `https://`
  (se completa), un `javascript:` rechazado con su mensaje, la lista del 18-oct
  con tres canciones y una en otro tono, subir una de puesto, archivar y
  recuperar, y borrar una que no había sonado.

  - **Sin letra ni acordes dentro**, a propósito: casi todo lo que se canta
    tiene derechos, y guardarlo convertiría a Hatril en quien lo publica. Se
    guardan dos ENLACES —para escucharla y para los acordes— y solo
    `http(s)://`, por Zod y por un CHECK: un `javascript:` se pintaría como
    enlace en el móvil de cada músico.
  - **Del equipo, no de la iglesia.** Cada repertorio cuelga de su ministerio,
    y HT124 impide que la lista de alabanza lleve una canción de otro equipo:
    sería leer por la puerta lateral un repertorio ajeno.
  - **La lista cuelga del turno**, así que el músico la ve en la ficha de su
    turno («Qué se toca», con el tono grande a la derecha y los enlaces con el
    sitio escrito). El responsable la monta dentro del propio turno: añadir,
    subir y bajar, quitar, y el tono de ESE domingo si no es el de siempre.
  - **Una canción que ya sonó no se borra, se archiva.** La clave ajena de
    `turno_canciones` es NO ACTION a propósito, y la pantalla solo ofrece
    borrar si nunca salió en una lista.
  - «Cuándo se cantó» cuenta solo hasta hoy: un domingo planificado no es un
    domingo en que sonara.
  - Sin `auditar()`: es material de trabajo del equipo, no un dato de nadie.

- **Alabanza, cosida** (tanda 2 del plan, sin migración, 20-oct). Agenda,
  turnos y repertorio ya funcionaban; esto los junta. Verificado como `lider@`
  y `miembro@` a 375 px y como `pastor.sion@`, mirando en la base quién firmó
  cada fila:

  - **Ensayo repetido.** «Repetir cada semana», hasta doce, solo al crear y
    solo en la agenda de un equipo. Crea una fila por semana, que luego se
    cambia o se borra sola. La semana que ya tiene algo del mismo equipo a la
    misma hora se salta, y el aviso lo dice con números. Editar pasa por la
    misma comprobación: mover un ensayo encima de otro es la otra forma de
    duplicarlo.
  - **Sin duplicados con doble clic, todavía sin índice.** Cerrojo
    `for no key update` sobre la fila del ministerio y comprobación en la misma
    transacción; el segundo clic contesta «Ya estaba apuntado» con las cuentas,
    y el botón se apaga al enviar. Probado con doble clic: cuatro filas, cero
    repetidas. Lo que entre por otro camino —un script, el editor de
    Supabase— solo lo para el índice único, que está en «Qué falta».
  - **El ensayo dentro del turno**, derivado y sin tabla: la reunión del equipo
    más cercana en la semana de antes del turno (el mismo día, solo si va
    antes; el de hace siete días, solo si fue después de la hora del turno). Sale
    en la ficha del turno del panel y en `/mi/agenda/turno/[id]`, y **solo en
    equipos con el repertorio encendido**: en la radio o en acción social, la
    reunión semanal saldría como ensayo de cada programa o de cada reparto. Si
    no hay, el panel lo dice con un enlace para apuntarlo.
  - **El músico ve el ensayo** en una ficha nueva, `/mi/agenda/reunion/[id]`,
    de solo lectura y acotada al equipo: otro equipo, un culto o un uuid
    inventado dan 404. Las notas pasan a leerlas todos, así que el campo se
    llama «Para el equipo», y en `/mi` solo salen las de hoy en adelante y con
    la agenda encendida: las actas viejas se escribieron para otro público.
  - **«Lista: N canciones» o «Sin lista»** en cada turno de «Próximos» del
    cuadrante, con un solo `count` agrupado.

  Detalle en `docs/modulos/estado-alabanza-pulido-61bccd.md`.

- **Radio en directo** (tanda 6, v1 sin migración, 20-oct). Tipo `radio`
  —enciende `emisora`, `turnos` y `agenda`, con los puestos Locución, Control
  técnico, Producción y Redes; Medios pierde «y radio»— y módulo `emisora`, que
  vive entero en `ministerios.modulos.emisora`: nombre, señal (solo
  `https://`), parrilla semanal con «de qué va» cada programa, y la casilla de
  la web. Los programas del mes con sus locutores son turnos, que ya existían.

  - **En el panel**, `/panel/ministerios/[id]/emisora`: «Probar» suena en el
    navegador de quien lo pulsa, y lo que la gente pega de verdad se rechaza
    con nombre (http, `.pls` y `.m3u`, HLS, la ficha de zeno.fm, usuario y
    contraseña en la URL, la red de casa). Dos programas no se pueden pisar, y
    el tope es de 60. `guardarEmisora` lee la config con `for update` y pasa por
    `exigirModulo()`. La señal se valida también al leer: sin migración no hay
    CHECK.
  - **En `/mi`**, `MiniReproductor` encima de la barra, solo si la iglesia
    tiene una radio encendida con señal, y la parrilla de la semana en una hoja.
    Nada se conecta antes de pulsar, no se registra quién escucha, y sigue
    sonando al cambiar de pestaña. El hueco de abajo para barra y reproductor
    vive entero en `mi/layout.tsx`, medido pantalla a pantalla.
  - **En la web pública**, el bloque «Radio en directo» con lo que suena, lo
    que viene y la parrilla, solo con la casilla, la web publicada y señal.
    **Si quien cambia algo que se ve en la web no es el pastor** —la señal, el
    nombre o cualquier programa—, la radio sale de la web hasta que él la vuelva
    a marcar: el tema es texto libre y podría publicar la fe o la salud de
    alguien sin que lo viera.
  - **Legales**: `/terminos` §3 (los derechos de lo que suena son de la
    iglesia; Hatril no emite, no retransmite ni graba) y `/privacidad` §5 (un
    tercero elegido por la iglesia). Sin subir la versión: ver «Qué falta».

  Verificado como `pastor@`; como `colider@`, colíder de Radio, con un
  `en_web=on` metido a mano que la base deja en `false`; como `miembro@` a
  375 px, con la Media Session; y como `lider@`, que rebota. **Sin verificar:**
  escuchar con la pantalla bloqueada en un móvil de verdad. Safari puede
  cortarlo, y ninguna pantalla lo promete. Detalle en
  `docs/modulos/estado-radio-emisora.md`.

- **Reuniones y asistencia**: `/panel/reuniones`. Apuntar el culto del domingo o
  el del jueves con su fecha, y marcar quién vino. **Se guarda fila también para
  quien faltó**, con `presente = false`: sin eso, un domingo en el que nadie pasó
  lista sería idéntico a uno en el que no vino nadie, y «lleva cinco domingos sin
  venir» empezaría a mentir. Cero filas significa «no se tomó asistencia».

  `miembros.ultima_asistencia` —columna que existía desde la `0000` y **no la
  escribía nadie**— la mantiene ahora un trigger por sentencia con tabla de
  transición, y se RECALCULA en vez de acumularse: desmarcar a alguien borra la
  fecha en vez de dejarla clavada. Permiso propio, `registrar_asistencia`, que la
  secretaría tiene por defecto. Verificado apuntando un culto, dejando fuera a
  dos personas y viendo moverse la columna en la base.

- **Agenda de cada ministerio**: `/panel/ministerios/[id]/agenda`. Ensayos,
  clases y salidas del equipo, con su propia lista. Dos guards en el layout:
  quién manda en ESE ministerio, y que el módulo esté encendido —si no, 404—. El
  ámbito de la lista es **el equipo**, nunca la congregación, y un ensayo **no**
  toca `ultima_asistencia`: a nadie se le consolida por faltar a un ensayo.

- **Seguimiento de personas** (consolidación): dentro del ministerio que lo
  lleve, `/panel/ministerios/[id]/seguimiento`. La congregación ordenada por
  cuántas reuniones seguidas se ha perdido cada persona, con su teléfono, quién
  la acompaña y lo último que se habló con ella. Dentro, asignar acompañante y
  apuntar cada llamada, visita o mensaje.

  **Se cuentan reuniones con lista tomada, no semanas de calendario.** Contra el
  reloj, una iglesia que lleve tres semanas sin apuntar nada vería a TODA la
  congregación como ausente, y el equipo llamaría a gente que fue el domingo
  pasado. A la tercera llamada así, el pastor deja de fiarse de la pantalla.

  **Sin campo de texto libre**, y es la decisión de todo el módulo: el motivo se
  elige de una lista de siete —hablamos, va a volver, no contestó, se mudó, está
  molesto con la iglesia, no hay forma de localizarle, lo lleva el pastorado—.
  El único campo escrito a mano es «qué toca ahora», acotado a 200 caracteres
  por un CHECK de la base y no solo por un comentario.

  Tres puertas para entrar: el permiso `ver_seguimiento` —que no es defecto de
  ningún rol, ni de secretaría—, ser responsable o colíder de ESE ministerio, y
  que el módulo esté encendido. La firma de cada contacto la comprueba la policy
  contra `miembro_actual()`: nadie apunta nada en nombre de otro. Y la tabla de
  contactos **no tiene UPDATE concedido**: un contacto es un hecho fechado, y si
  se apuntó mal se borra en vez de reescribirse.

- **Consolidación: los nuevos** (tanda 4, v1 sin migración, 20-oct). El
  seguimiento contestaba «¿quién se fue?»; faltaba «¿quién llegó?».

  - **Tres defectos del seguimiento, cerrados.** Las faltas cuentan desde que
    la persona existe —la más tardía de su última asistencia, su
    `fecha_ingreso` y el día de su ficha—: antes, a un visitante se le contaban
    todas las reuniones de la historia de la iglesia, y en la demo salían siete
    personas de más. Quien está en nuevos no sale en ausentes, porque las dos
    listas salen de la misma función, `calcular()`. Y la pestaña ya no rebota.
  - **Vista «Nuevos»**, `/panel/ministerios/[id]/seguimiento/nuevos`, dentro
    del módulo `seguimiento` y no como módulo propio: hoy no tiene nada suyo, y
    con un interruptor aparte el visitante podría desaparecer de las dos
    listas. Fichas en visitante o nuevo llegadas en los últimos 90 días, en
    etapas **calculadas, no guardadas**: vinieron una vez, volvieron y se
    quedan (tres de las últimas seis listas). «Sin contactar» va destacado, y la
    ficha gana un botón de WhatsApp (`wa.me`) si el teléfono está en E.164.
  - **Alta rápida de visitante**, `.../nuevos/alta`: una ficha en visitante,
    sin notas, con el mismo permiso que el resto del seguimiento y no con
    `editar_miembros`. **El permiso se lee en voz alta y se guarda**, como en el
    reparto: el consentimiento general y la casilla de asistencia, las dos sin
    premarcar, y sin IP ni navegador, que serían los del voluntario. Sin la
    segunda, la ficha se crea pero no sale en ninguna lista, y la pantalla lo
    dice. Un teléfono repetido lleva a la ficha que ya existe si el nombre
    coincide, pregunta si es otra persona si no, y si el número es de quien negó
    el permiso da un mensaje que no confirma nada.
  - **Cifras para el pastor en Inicio**: llegaron este mes, han vuelto, nuevos
    sin llamar y faltan tres o más reuniones. Solo números, y solo a quien puede
    abrir algún seguimiento, así que el enlace siempre abre.
  - De paso, `hoy()` en `miembros/actions.ts` pasa a la fecha de la iglesia y
    no a la de UTC: salía «llegó hace -1 días».

  Verificado contra la base con `scripts/seed-consolidacion.sql`, como
  `pastor@` (las cifras de Inicio cuadradas a mano) y como `consolidacion@` a
  375 px, con y sin `ver_seguimiento`. Quien negó el permiso de asistencia no
  sale en ninguna lista ni cuenta en ninguna cifra. **Sin pulsar:** el aviso de
  «en 90 días no se ha pasado lista», que no tiene iglesia de demo donde salir.
  Detalle en `docs/modulos/estado-consolidacion-nuevos-9b87a5.md`.

- **Área del miembro**: `/mi`, y es una **app, no una página**. Quien pertenece a
  una iglesia y no lleva nada en ella ya no aterriza en el panel — antes veía un
  menú de ocho secciones donde no podía pulsar casi nada, con Miembros y
  Ministerios en la primera línea. Ahora abre y ve el muro de su congregación.

  Cuatro pestañas en una barra fija: **Comunidad · Devocional · Agenda · Mi
  cuenta**. Salieron siete candidatas en la conversación y se quedan las cuatro
  que se usan cada semana; la web de la iglesia y Donar viven dentro de Mi
  cuenta, que es donde se buscan las cosas de una vez al mes.

  - *Comunidad* es `/mi/comunidad`, el muro que ya existía. `/mi` es ahora solo
    el desvío que decide a dónde va cada quien.
  - *Devocional* enseña el del día, y si no hay, el último publicado **diciéndolo**
    — enseñar el de ayer callando hace que alguien se lo lea creyendo que es el
    de esta mañana. Consulta propia con `withUser`, gemela de la pública: aquélla
    exige `web_publica` porque sirve la calle, y a la gente de una congregación
    no se le esconde su devocional por que su web esté sin publicar.
  - *Agenda* junta los eventos de la iglesia y los ensayos de sus equipos. En el
    panel viven separados porque los gestiona gente distinta; para un miembro son
    la misma pregunta —qué tengo yo esta semana— y separarlas le obliga a mirar
    en dos sitios.
  - *Mi cuenta* trae sus ministerios con su papel y su objetivo, **Ofrendar** y
    cerrar sesión.

  **Ofrendar funciona de verdad desde el primer día** y no es una pasarela:
  enseña el `cuenta_donativos` que esa iglesia ya publica en su web, con el
  titular. Si la congregación no lo ha rellenado, **el botón no se pinta** — uno
  que al pulsarlo dice «tu iglesia no ha configurado esto» le pasa el problema a
  quien no puede resolverlo. Por Hatril no pasa dinero, que es lo que
  `/privacidad` §3 promete.

  **La barra es una pastilla flotante con glaseado**, y de dónde salió importa.
  La referencia era un componente de shadcn con `framer-motion`, sombras de dos
  capas, clases `dark:` y los nombres escondidos tras un tooltip. Se trajo el
  aspecto y no la implementación: sin librería —el brief dice «sin librerías de
  animación pesadas» y lo único que animaba era ese tooltip—, sin sombra —regla 3
  del sistema: la profundidad se hace con bordes de 1px—, sin `dark:` —modo claro
  únicamente— y **con los nombres siempre visibles**, porque en un móvil no hay
  ratón y serían cuatro dibujos sin nombre en la pantalla principal.

  El glaseado no es nuevo: es el `supports-[backdrop-filter]` que ya usaba
  `CabeceraMiembro`. Va con guarda a propósito — sin `backdrop-filter`, un fondo
  translúcido deja el texto ilegible sobre lo que haya debajo, y con la guarda
  ese navegador cae a fondo sólido.

  **Una sola barra `fixed`, no dos.** El primer intento eran una pegada abajo en
  móvil y otra en fila arriba para escritorio, y no funciona: la barra vive en el
  layout y cada página de `/mi` pinta su propia cabecera pegajosa, así que la
  superior salía siempre por encima de ella. Arreglarlo obligaba a subir las tres
  cabeceras al layout, y una de ellas es `/mi/avisos`, que funciona sin
  membresía. Con una sola fija el orden del DOM deja de importar: ancho completo
  en móvil, pastilla centrada en escritorio.

  El layout de `/mi` **no lleva guard**, y es la excepción a la regla del repo.
  Bajo `/mi` conviven pantallas con requisitos distintos y `/mi/avisos` tiene que
  seguir siendo alcanzable sin membresía. Cada página pone el suyo; el layout
  solo decide si pinta las pestañas.

  Quién va a cada sitio lo decide `esDelEquipo()` en `permisos.ts`, mirando las
  **capacidades efectivas** y no el nombre del rol: el pastor puede darle la caja
  o el devocional a alguien que sigue siendo `miembro`, y esa persona entra al
  panel sola. El corte vive en `panel/layout.tsx`, no en `requireIglesia()`, que
  lo usa también `/mi/comunidad`. Y el destino de después de entrar lo decide
  `inicioDe()` en un solo sitio: lo tenían escrito a mano tres actions como
  `/panel/hoy`, lo que mandaba al miembro al panel para que el layout lo
  devolviera, con su pantalla en blanco por medio.

  Verificado entrando como `miembro@hatril.test`: aterriza en el muro, las cuatro
  pestañas cargan, y `/panel/miembros` escrito a mano en la barra le devuelve.

  **Lo que falta y se nota:** el material del equipo. El repertorio del domingo
  y los turnos ya están en la agenda, y lo de cada equipo, en su pestaña.

- **App nativa (Android e iOS)** (20-oct): Capacitor 8.5.3, y la app es un
  WebView que carga **https://hatril.com** y arranca en `/mi`. Lo verificado,
  todo en el emulador (Pixel 6, Android 17, WebView 145), con capturas en
  `Versiones/Android/pruebas/`:

  - La **release** firmada, `Versiones/Android/Hatril-1.0.0-1.aab` y `.apk`:
    `app.hatril`, 1.0.0, versionCode 1, targetSdk 36, `allowBackup=false`;
    pasa `jarsigner -verify` y `apksigner verify`, y la huella del certificado
    es la de la firma de subida. Instalada, arranca, carga hatril.com y llega
    al acceso. Recompilada el 20-oct con el icono del atril (sigue siendo
    versionCode 1: no se ha subido nada a Play); en el emulador, el icono del
    cajón y el del arranque son ya el atril. El primer arranque tras instalar tardó unos 11 s en pintar; el
    segundo, unos 5 (el emulador va a ~480 ms de hatril.com).
  - Con la de **depuración**, leyendo la página por el protocolo de
    depuración del WebView: la redirección de `/mi` deja la barra en
    `/acceso?next=%2Fmi` y el formulario envía la acción ahí (interceptado
    en la página, sin mandar nada). El riesgo de que Capacitor sirviera el
    acceso con la dirección `/mi` no se da con un WebView al día; el porqué y
    el caso en que sí, en `docs/app-nativa/android.md` §4.
  - Sin red, «Sin conexión»; al volver la red se reintenta sola y llega al
    acceso. Eso **no funcionaba** hasta el 20-oct: faltaba el permiso
    `ACCESS_NETWORK_STATE` y el WebView creía tener red siempre. Tras volver,
    el historial empieza limpio (`MainActivity`).
  - Atrás dentro de la web vuelve a la pantalla anterior.

  **Sin probar**: nada con sesión (no se entra en producción con contraseña);
  un teléfono de verdad; iOS entero; y atrás saliendo de la app desde la
  primera pantalla, que hace `src/components/app-nativa.tsx` y **no está
  desplegado**: hoy, en esa pantalla, atrás no hace nada. La hoja de compartir
  del sistema no existe en el WebView de Android («Compartir» copia el texto).

- **Los equipos en la app** (20-oct): `/mi` está completa para quien sirve en un
  ministerio, sin salir al panel. Quinta pestaña, **Equipo** (`/mi/equipo`),
  solo para quien sirve en algo y al final de la barra, para que nadie pierda
  ninguna de sitio. Con un equipo lleva directa a su portada; con varios, a
  «Lo que llevas» y «Donde sirves».

  - **Una portada por equipo, en dos modos.** Quien lo lleva ve lo pendiente de
    cada herramienta: ensayos sin lista, turnos con huecos o sin contestar, la
    lista del próximo culto, quién más reuniones se ha perdido (con
    `ver_seguimiento`) y cómo va la puerta del reparto, sin nombres. Quien
    participa ve lo suyo: sus turnos por confirmar, el próximo ensayo y la
    lista del domingo. Nunca las respuestas de los demás a un turno.
  - **Las herramientas del líder, con las mismas rutas que el panel** bajo
    `/mi/equipo/[id]/…`: turnos, agenda con pasar lista, repertorio y
    seguimiento. Al voluntario le dan 404.
  - **Las actions son las del panel, envueltas y sin tocar.** `enLaApp()`
    ejecuta la del panel, atrapa su `redirect()` y lo relanza hacia
    `/mi/equipo` con el mensaje intacto: ni una línea de lógica copiada. Lee el
    redirect con `isRedirectError`, importado de `next/dist/client/components/…`:
    si cambia de sitio falla el build, y si cambiara el formato, la action
    volvería al panel. Se degrada, no abre nada.
  - **Un contrato por módulo**, en `src/lib/ministerios/en-la-app/`: cada
    módulo engancha un adaptador con `resumen` (la tarjeta del líder),
    `participante` (opcional) y `visiblePara`, la puerta de más que aplican a
    la vez la tarjeta, las pantallas y las actions. El reparto ya lo tiene, con
    la puerta estrecha del panel. **Un módulo con la puerta más estrecha que
    `puedeGestionarMinisterio` trae su adaptador en la misma fusión**: sin él,
    al líder le sale una tarjeta hacia el panel con la puerta ancha. La radio
    no lo tiene ni le hace falta: su puerta es la ancha, y se escucha desde el
    reproductor.
  - **Las puertas, en cada página** (`en-la-app/guarda.ts`): iglesia y
    consentimiento, suscripción no bloqueada, llevar ese ministerio, que sea de
    su iglesia, módulo encendido y la puerta del adaptador. 404 y no un
    rebote: para quien no sirve en nada, la zona no existe.

  Verificado a 375 px, escribiendo cada fila desde la app, comprobándola en la
  base y deshaciéndola, como `lider@`, `colider@` (también el reparto),
  `consolidacion@`, `miembro@` y `enlace@` en modo participante, y
  `secretaria@`, que no sirve en nada y no ve la pestaña. La puerta de quien
  solo tiene `gestionar_ministerios` se probó con un guion contra el código,
  porque ninguna cuenta de demo la tiene. Detalle, con la receta para enganchar
  un módulo, en `docs/modulos/estado-app-lider.md`.

- **Re-consentimiento**: `/acepta`. Cuando la política cambia de fondo se sube
  `VERSION_POLITICA_PRIVACIDAD` y el layout del panel corta el paso a quien
  aceptó una versión anterior, hasta que lea qué ha cambiado y vuelva a decidir.
  La casilla de la asistencia va **sin premarcar**: el considerando 32 del RGPD
  dice que una casilla ya marcada NO es consentimiento.

  Aceptar no reescribe la fila vieja, la revoca y escribe una nueva: el art. 7.1
  obliga a poder demostrar a qué redacción dijo que sí cada persona, y un
  `update` borraría esa prueba.

  Y negarse hace algo de verdad: quien no marca la casilla desaparece de la lista
  de asistencia y de la de seguimiento, **y se borran sus filas anteriores** en
  las tres tablas. Sin eso, la pantalla del culto se quedaba diciendo «7 de 9»
  con ocho personas debajo — y un número que no cuadra con la lista es un número
  del que el pastor deja de fiarse.

- **Devocionales**: calendario de turnos, redacción, imagen de fondo, vídeo y
  publicación. El devocional del día sale en la web de la iglesia.

  La pantalla del miembro se rehízo: **la foto es la portada** —a sangre, con
  fecha y título encima, el mismo patrón que el muro—, el devocional **va
  firmado** por quien lo escribió con su cara, el versículo destaca con su
  comilla y su barra de color, hay **botón de compartir** y, al pie, el
  **archivo** de los anteriores, que se abren con `?d=fecha`. Antes, lo que se
  publicó ayer dejaba de existir en cuanto salía el de hoy.

  El **vídeo se ve dentro**: miniatura con botón de play que solo carga YouTube
  al pulsarlo, en `youtube-nocookie.com`. Con foto propia, la pantalla no habla
  con Google hasta que alguien decide verlo.

  Lo que se comparte es el TEXTO, no el enlace: `/mi/devocional` está detrás de
  sesión y membresía, así que mandar la dirección sería mandar a la gente a una
  pantalla de acceso.
- **Comunidad**: el muro de la congregación en `/mi/comunidad`. Publicar con
  texto y hasta cuatro fotos, me gusta, comentarios con **respuestas de un solo
  nivel** y su propio me gusta, y borrado por el autor o por el pastor. Solo
  para miembros con acceso ACTIVO: no sale en la web pública, donde únicamente
  hay una invitación con un recuento. Las fotos van al bucket **privado**
  `comunidad` y se sirven con URL firmada de una hora.

  **Escribir y comentar viven en una hoja que sube desde abajo**, como en
  cualquier muro que la gente ya usa. Antes el compositor ocupaba la primera
  pantalla del muro y los comentarios salían todos desplegados bajo cada
  publicación: con veinte comentarios, la publicación siguiente quedaba a tres
  pantallazos. Ahora el icono dice cuántos hay —contando respuestas— y al tocarlo
  se abren en su hoja, con el campo de escribir pegado abajo.

  El compositor **sigue funcionando sin JavaScript**: el HTML que manda el
  servidor trae el formulario entero y desplegado, y solo después de hidratar se
  cambia por el disparador. Verificado pidiendo la página con `fetch` y mirando
  que el `<textarea>` y el botón «Publicar» están en la respuesta.

  La barra de abajo tiene **cuatro pestañas**: Comunidad, Devocional, Agenda y
  Biblia. Se la ve todo el que tenga iglesia, no solo el miembro raso — antes se
  les escondía porque «el equipo vive en el panel», y al quitar la flecha de
  volver de la cabecera un pastor que entraba al muro se quedaba sin ninguna
  forma de salir. Esa salida es ahora **«Ir al panel» en el menú del avatar**:
  estuvo un commit siendo una quinta pestaña y se veía forzado, porque la barra
  es la navegación del miembro y salir a la otra mitad es cosa de la cuenta. Han
  vivido ahí dos cosas y las dos se fueron por lo mismo, repetir algo que ya
  estaba a la vista: «Mi cuenta» —el avatar de la cabecera abre el mismo menú— y
  un «+» de publicar que duró una tanda, porque la primera pantalla del muro ya
  trae el disparador. En Instagram el «+» tiene sentido porque su primera
  pantalla NO trae compositor; copiar el patrón sin copiar el motivo llena la
  barra de botones que se pisan. El hueco espera a un cuarto destino de verdad.

  **La foto abre la galería directamente**, sin pasar por la hoja, que es el
  flujo de Instagram. Eso obliga a algo que no es evidente: el `<input
  type="file">` NO puede vivir dentro de la hoja, porque el navegador solo abre
  el diálogo de ficheros dentro del gesto que lo pide y en ese instante la hoja
  todavía no está montada. Vive fuera y se ata al formulario con el atributo
  `form`, que es HTML de toda la vida y funciona también sin JavaScript.
  Verificado metiendo un fichero por `DataTransfer`: el `FormData` lo lleva y la
  ruta acaba en el bucket.

  **Y sin flecha de volver.** La tenía, apuntando a `/mi` — que redirige a esta
  misma pantalla en cuanto quien mira pertenece a una iglesia. Daba la vuelta y
  volvía aquí: un botón que parecía llevar a algún sitio y no llevaba a ninguno.
  La de `/mi/avisos` sí se queda, pero ahora apunta al muro y no a ese rebote.

  **Arriba del muro hay una PORTADA**: una sola pieza con la foto del devocional
  de fondo, un degradado encima y, dentro, el versículo, el devocional y el
  compositor. Eran tres bloques sueltos en fila y se leían como tres cosas sin
  relación.

  El degradado **rompe la regla 3 del sistema** —«sin degradados ni sombras»— y
  es deliberado: sobre una foto cualquiera el texto necesita que el fondo se
  oscurezca justo donde él está, y un velo plano de la opacidad suficiente para
  el peor punto de la imagen apaga la foto entera. Es la única superficie de la
  aplicación con degradado, igual que era el único bloque de color.

  Y lo de antes, que sigue valiendo: el versículo primero y el devocional debajo,
  y los dos pueden faltar por separado. No hizo falta tabla nueva: `devocionales`
  ya tenía `versiculo` y `referencia` desde la `0012`, y una fila sin cuerpo ya
  era un turno a medio llenar. Una iglesia que solo quiera publicar el versículo
  crea la fila del día, escribe esos dos campos y la publica.

  El versículo es **el único bloque de color de la pantalla**: la foto del
  devocional de fondo y encima un cristal verde de verdad —`backdrop-blur`, así
  que lo que se difumina es la foto—. Es deliberado, y es la respuesta a «lo veo
  todo muy gris»: el muro entero es crema sobre crema. Usa `support` y no
  `accent` porque el naranja está reservado a las acciones.

  Del glaseado hay dos números que no se tocan a la ligera. **La opacidad no baja
  de 0.82**: una foto de un culto tiene focos blancos, y con el cristal a 0.6
  media frase del versículo cae sobre uno y desaparece. Y **la etiqueta va en
  blanco puro**, no al 75%: en el peor caso —foto blanca entera detrás— el 75%
  se queda en 3.5:1 y el blanco puro da 4.8:1, que es lo que pide la norma. Sin
  foto, el bloque cae a verde sólido y sube a 7:1.

  Cuando el versículo y el devocional salen de la misma fila, la miniatura del
  segundo desaparece: la foto ya está arriba, y repetirla nítida dos centímetros
  más abajo se lee como un error de maquetación.

  La barra de abajo también estrenó cristal —más desenfoque, menos opacidad y
  `backdrop-saturate`—, que hasta ahora no se distinguía de un fondo sólido
  porque no había nada de color por debajo que difuminar.

  Lo que **falta**: la pantalla del panel para escribir solo el versículo. Hoy se
  escribe desde `/panel/devocionales`, que pide título y cuerpo aunque se dejen
  vacíos. Y el texto bíblico lo pone la iglesia: la RVR60 tiene derechos de
  Sociedades Bíblicas Unidas y no entra en el producto —el seed usa la RV1909,
  que es de dominio público—.

  **Los comentarios se despliegan bajo su publicación**, no en una hoja. Van ya
  tres formas: siempre abiertos —con veinte, la publicación siguiente quedaba a
  tres pantallazos—, en hoja modal —tapaba la pantalla y al cerrarla se perdía
  el sitio— y así. La hoja sigue viva para el compositor, que es donde una capa
  modal sí se justifica: se abre para escribir, no para leer de pasada.

  Las publicaciones van **a sangre en el móvil** y vuelven a ser tarjetas a
  partir de `sm`. Y el muro de demostración se llena con `scripts/seed-muro.sql`:
  siete publicaciones de cinco personas con sus comentarios, respuestas y me
  gusta. Sin eso solo había dos publicaciones, las dos de la misma cuenta, y la
  pantalla parecía decir que la comunidad enseña solo lo tuyo.
- **Avisos**: las notificaciones de cada persona en `/mi/avisos`, con la campana
  y su punto rojo en el panel. Seis tipos: solicitud recibida, aprobada y
  rechazada, comentario y me gusta en el muro, y turno de devocional. El texto
  se compone al pintarlo desde `notificaciones/textos.ts` —en la fila solo van
  el tipo y los datos—, y las escribe siempre el servidor con `dbAdmin`: quien
  pudiera insertarlas se fabricaría un «solicitud aprobada» o le mandaría a otro
  un enlace a su gusto. La pantalla **solo pide sesión**, sin `requireIglesia`:
  a quien le rechazan la solicitud se le borra la membresía en el mismo
  movimiento y el aviso que se lo explica quedaría fuera de su alcance.
- **Finanzas**: el libro de caja. Fondos (de quién es el dinero) y cajas (dónde
  está), movimientos con alta, edición y borrado, saldo por fondo y por caja,
  resumen del mes, informe imprimible para la asamblea y exportación a CSV.
  Verificado apuntando una ofrenda de 250.000 y borrándola desde la pantalla.
  **Sin nombres de donante**: ver el apartado de decisiones.
- **Arreglos de la revisión** (20-oct, sin migración), cada uno probado contra
  la base y deshecho después (`scripts/prueba-arreglos-sueltos.sql`):

  - **El libro de caja ya no corta a escondidas.** Cortaba en 50 y la pantalla
    contaba lo que le llegaba: con 62 movimientos en el mes decía «50» y el más
    antiguo no salía en ningún sitio. Ahora la cabecera dice el total y la
    tabla pagina de 50 en 50 (`?pagina=N`, enlaces de verdad); el informe avisa
    contra el total y el CSV lleva una línea de aviso si corta el tope de
    10.000. Probado con 62 y con 512. `Paginacion` vive ahora en
    `panel/_components`.
  - **El pastor que registra una iglesia ya sale en las listas.** `/registro`
    pregunta la casilla de asistencia, sin premarcar, y `crearIglesiaConSeeds`
    la pide como parámetro obligatorio y sin defecto: una puerta de alta nueva
    que no la pregunte no compila. Probado registrando una iglesia y, como
    control, revocando el consentimiento: la lista dice «No hay nadie en el
    fichero», que es como se quedaba todo pastor recién registrado.
  - **Las casillas tienen nombre accesible**; salían como `checkbox "on"`. La
    de asistencia es un componente, `CasillaAsistencia`, con una sola redacción
    en `/registro`, `/acepta`, `/solicitar` y el alta rápida de consolidación.
  - **`?guardado=constructor` tumbaba la página** con un 500 (ver «Trampas»).
    `Object.hasOwn` en las 21 pantallas que lo tenían; las que llegaron
    después, en «Qué falta».
  - La foto del ministerio confirma al guardar y al quitar. Y en
    `/panel/lideres`, desmarcar «Llevar sus propios ministerios» funciona, y la
    tarjeta dice «Sin permiso para llevarlo» cuando la persona lidera algo que
    no puede llevar, con la misma función que decide la puerta.

  Detalle en `docs/modulos/estado-arreglos-sueltos.md`.
- **Compartir**: `/panel/compartir`. La dirección absoluta de la web de la
  iglesia y la de «pedir unirme», con copiar y con enviar por WhatsApp, y el
  formulario de las cinco redes sociales —Instagram, Facebook, YouTube,
  WhatsApp, TikTok— que salen al pie de la web pública. Acepta las tres formas
  en que la gente copia esto (`@nombre`, la dirección pegada, o un teléfono para
  WhatsApp) y las canoniza; una dirección de otro host se rechaza con un mensaje
  legible. La ve todo el equipo, pero las redes solo las escribe el pastor. Si
  la web no está publicada o las solicitudes están cerradas, lo dice en vez de
  dar un enlace que no funciona.
- **Eventos**: `/panel/eventos`. Crear un evento con fecha y hora, aforo, precio
  y el enlace de pago de la iglesia; publicarlo y abrir inscripciones, que son
  dos interruptores separados; la lista de quién viene, marcar plazas pagadas y
  descargar el CSV. Sale en la web de la congregación entre los horarios y el
  devocional, y **cualquiera puede apuntarse sin cuenta**. Verificado creando un
  retiro de 150.000 con aforo 2, apuntando gente y llenándolo. Con permiso
  propio, `gestionar_eventos`, que la secretaría tiene por defecto.
- **Público**: portada, directorio de iglesias, web pública de cada
  congregación (carrusel de fotos con el titular encima, horarios con «lo
  próximo» calculado, devocional, grupos apilados al bajar), formulario de
  solicitud, área `/mi`.
- **Imágenes**: logo y hasta seis fotos de portada por iglesia, foto por
  ministerio y por devocional. Todo en el bucket `iglesias-publico`.
- **Legales**: `/privacidad` y `/terminos`, con el encargo de tratamiento del
  art. 28 como anexo aceptable al registrar la iglesia. Los datos salen todos de
  `src/lib/legal/datos-responsable.ts`, así que se cambian en un solo sitio.
- **Suscripción**: el circuito de cobro completo. `/panel/suscripcion` con el
  tamaño de la congregación arriba —sin ese número, elegir plan es adivinar—,
  los tres planes, mensual o anual, y el portal de Stripe para facturas, tarjeta
  y baja. La franja de aviso corona el panel los tres últimos días de prueba y
  durante toda la gracia de lectura: hasta ahora el trial vencía y no pasaba
  nada visible.

  **El muro tiene dos capas, y ninguna de las dos está donde uno esperaría.**
  Escribir lo corta `exigirPoderEscribir()` dentro de las cuatro guards de
  server action, así que cubre lo que existe hoy y lo que se escriba dentro de un
  año sin que nadie se acuerde. Leer solo se corta cuando se acabó también la
  gracia, y entonces el layout manda a `/suscripcion` —una ruta de FUERA del
  panel—, porque un layout de Next **no se vuelve a ejecutar al navegar** y un
  muro pintado ahí dentro se esquiva con un clic del menú.

  Cuatro cosas nunca se bloquean: pagar, darse de baja, aceptar la política y
  cambiar la contraseña propia. Cerrar cualquiera de ellas deja a una iglesia sin
  forma de salir del estado en el que está.

  Verificado ejecutándolo, con la fecha de Betania movida a mano: a un día
  vencida el panel sigue navegable, `/panel/cuenta` guarda y `/panel/ajustes`
  responde «no puedes guardar cambios»; a cinco días, `/panel/hoy` acaba en el
  muro, sin menú y con los planes; y al devolver la fecha, `/suscripcion`
  devuelve al panel. El pastor ve los planes y la secretaria, «esto lo resuelve
  el pastor».

- **El webhook de Stripe**: `/api/stripe/webhook`, la única voz autorizada para
  decir quién ha pagado —el trigger HT112 de la `0021` impide escribir la
  suscripción desde cualquier otro sitio—. Verificado con eventos firmados de
  verdad contra la base real, sin tocar Stripe: un alta deja `plan = comunidad`
  con la fecha de fin de periodo, el reenvío del mismo evento contesta
  «repetido» sin volver a trabajar, `cancel_at_period_end` baja a `cancelado`
  conservando la fecha pagada, `past_due` conserva el plan, y una firma que no
  cuadra recibe 400.

- **Aislamiento**: 45 comprobaciones en `npm run test:aislamiento` más seis que
  llaman a `withUser()` de verdad, y cuatro hechas desde fuera con un JWT real
  contra la API pública. Las diez nuevas son de finanzas: que Sion no vea la caja
  de Betania en ningún sentido, HT110, HT111, el CHECK del tipo de ingreso, que
  el saldo salga de la columna generada, y que ni `anon` ni **`service_role`**
  lleguen. Las nueve nuevas son del muro: publicar siendo miembro
  raso, no poder firmar con la ficha de otro, me gusta duplicado, que Sion no
  lea ni escriba en el muro de Betania, HT107, la moderación del pastor y que
  `anon` no llegue.

  Las veinte más nuevas son de turnos: HT122 en sus tres formas (ministerio,
  persona y turno de otra iglesia, y persona fuera del equipo), HT123 (ni
  iglesia, ni ministerio, ni persona cambian), los dos índices únicos —también
  el de dos turnos sin hora el mismo día—, que Sion no vea ni conteste nada de
  Betania, y que ni `anon` ni `service_role` lleguen. Más dos que entran por
  `withUser()` de verdad.

  Y dieciocho del repertorio: HT124 (una canción de otra iglesia o de OTRO
  EQUIPO en la lista), HT125, los dos índices únicos, el CHECK que rechaza un
  `javascript:`, que una canción que ya sonó no se pueda borrar, y las puertas
  de siempre. 160 comprobaciones en total.

  Y treinta y nueve del reparto, las primeras que prueban un recorte DENTRO de
  una iglesia: un voluntario de otro equipo de Betania, con cuenta activa, no ve
  ni escribe nada del padrón; la voluntaria del reparto lo ve y marca pero no
  borra; el colíder borra y la entrega sigue contada sin persona; HT126 en sus
  cuatro formas, HT127, el número correlativo, la versión del aviso, los índices
  únicos, Sion, `anon`, `authenticated` y `service_role`, y las dos funciones
  cerradas. Y por `withUser()` de verdad, con la demo: `lider@` ve 0 del padrón
  de Acción social y `colider@` lo ve entero; sin la demo lo dice en vez de
  pasar en verde. **199 comprobaciones**, cero fallos.

  Y una de la radio: `anon` no puede leer `ministerios.modulos`, que es lo que
  deja la config de la emisora solo al alcance del `dbAdmin` del bloque
  público.

  `get_advisors` no se pudo pasar el 20-oct: el MCP contesta «no tienes
  permiso». Se comprobó a mano lo que mira: ninguna tabla de `public` sin RLS,
  ninguna función sin `search_path`, y ninguna `security definer` ejecutable
  por `anon` o `authenticated`.

  **Pendiente**: el test sigue sin cubrir `devocionales`, que es tabla nueva con
  RLS propia.

## Qué falta

| Pieza | Estado |
|---|---|
| **Super admin: falta la cuenta de Marlon** | **Cerrado el 28-oct**: `admin@hatril.test` tenía `Hatril2026`, escrita aquí y en `seed-demo.sql`, en un repo público, y la base de local es la de hatril.com; desplegado `/admin`, cualquiera habría podido ponerle contraseña a la cuenta del pastor de Cuerpo de Cristo. Ahora tiene una aleatoria que nadie conoce (comprobado en la base: `Hatril2026` ya no casa con el hash) y el seed la crea igual; se entra por enlace mágico y `test:puertas:admin` sigue 30 de 30. **Lo que falta**: la única cuenta en `admin_users` sigue siendo `admin@`, así que Marlon no puede entrar a `/admin` con la suya. Hay que crearle una cuenta (o usar una que ya tenga) e insertar su fila |
| **Super admin, lo que queda** | **No queda rastro de quién amplió o suspendió**: `auditoria` la escriben triggers y por iglesia, y una traza del super admin pide su propia tabla. Sin modo soporte (entrar como el pastor): con datos del art. 9 es una decisión, no un botón. Sin ingresos: los precios viven en Stripe y no hay claves todavía. Cuentas lee mil como mucho y lo avisa |
| Proveedor de alojamiento en los legales | Relleno (Hostinger). Falta confirmar en hPanel el país del centro de datos: pone Alemania y la IP geolocaliza en Francia |
| Módulos de ministerio | **Hechas, y fusionadas el 20-oct, la base común, el reparto v1, alabanza sin migración, consolidación v1 y la radio v1, más los equipos en la app.** Sigue, con migración y de una en una, la **contabilidad completa**; la cola está en `docs/modulos/cola.md` y el plan en `plan.md`. Peticiones de oración y la ficha de los niños esperan una decisión legal: salud y menores |
| **Subir `VERSION_POLITICA_PRIVACIDAD`** | Decisión de Marlon. `/privacidad` ya trae redactado lo de consolidación (§3, §4 y §5: lo que guarda el alta que teclea el equipo, que también se llama a quien acaba de llegar, y que con WhatsApp el número pasa por Meta) y lo de la radio (§5), y sigue en `privacidad-2026-09`: el texto publicado ya no es exactamente el que aceptó la gente. **Antes de subirla, guardar la negativa de asistencia como fila**, o dejar de exigir la versión actual para leerla (ver «Trampas»): si no, quien negó vuelve a salir en todas las listas. En la misma subida, ampliar el texto de la casilla de asistencia, que solo habla de contactar a quien lleva tiempo sin aparecer |
| Reparto v1.1 | Enlace público sin cuenta para inscribirse, QR, etiquetas Nuevo / Repite / No viene en el padrón y voluntarios marcando desde `/mi` (la RLS ya les deja). Fuera de la v1 a propósito |
| Alabanza, lo que queda | **El índice único de `reuniones`**, `(ministerio_id, fecha, hora) nulls not distinct where ministerio_id is not null`, con la próxima migración que toque esa tabla; antes, buscar duplicados o la migración se cae (la consulta está en el estado de la rama). Hasta entonces el doble clic lo para la action, pero no un script. «Avisar al equipo: ya está la lista» pide un valor nuevo del enum de avisos. Y la agenda del equipo lista de lejos a cerca: con doce semanas apuntadas, lo próximo queda abajo del todo |
| Radio, lo que queda | **El tema de cada emisión** necesita `turnos.tema` (migración, y sirve también a células y escuela); hoy el tema es de cada programa, fijo semana a semana. Un CHECK de `stream_url` en la base. Planificar los turnos desde la parrilla y no desde los cultos. Con dos radios en una iglesia suena la primera, sin selector. Y `guardarPuestos` y `editarMinisterio` reescriben `modulos` sin `for update`: dos guardados a la vez se pisan (la radio ya bloquea) |
| Consolidación, lo que queda | Con migración: la tarjeta por QR sin cuenta, la tabla `llegadas`, el aviso `llegada_nueva` y el borrado de las llegadas caducadas. La promesa de borrar a los 90 días una ficha del alta rápida choca con `auditar()`, como ya señalaba el plan. «Te toca acompañar» en `/mi`. «Nuevos» y el alta no están en la app del líder: su seguimiento solo enseña ausentes. «Nuevos» tarda 3,7 s en desarrollo (ocho consultas, repartibles en `withUser` paralelos). El umbral de «se quedan» y los 90 días son constantes de `consultas.ts`, no configuración |
| Los equipos en la app, lo que queda | **Decidido el 20-oct**: quien solo lidera empieza en `/mi/equipo` (`inicioDe`), y `/auth/confirm` sin destino va a `/mi`, que reparte. El aviso «X no puede» enlaza al panel y saca al líder de la app (lo arregla traducir en la campana con `traducirAlApp`). Gestionar el equipo —gente, colíderes, puestos— sigue en el panel. Sin ejercitar `solo_lectura`. Tras una action la página vuelve arriba, porque las del panel no llevan ancla |
| Pase visual, fase 2 del inventario | **M1 primero**: los `<select>` y `<textarea>` nativos que llevan su propio tamaño siguen a 15 px en el móvil, y Safari de iOS amplía la página. El 20-oct se arregló `<Input>`, pero la regla de 16 px de `globals.css` sigue dentro de `@layer base` y cualquier utilidad le gana. Se arregla en un solo sitio, sacando el `@media` de la capa (verificado inyectándolo), no campo a campo; la radio, alabanza y la app del líder igualaron los suyos a mano. Después M2 (el 404 y el error de Next salen en negro y en inglés, y `/panel` a secas da 404), A9, A16 y D2, que son de un fichero; luego M3 y A1, que tocan casi todo; y al final las pantallas. Todo en `docs/diseno/inventario-visual.md` |
| **Las páginas confiaban en el layout** | **Cerrado el 20-oct**, y no era solo de los módulos: era todo el panel. Probado: `miembro@`, un miembro raso, pedía el seguimiento con `RSC: 1` y recibía la lista entera con 13 teléfonos; también finanzas y miembros. Ahora cada página aplica la cadena entera (`requirePanel`, `requirePermiso`, `requirePastor`, `requireModuloMinisterio` en `guard-panel.ts`), las exportaciones la heredan de `requirePermisoApi`, y `npm run test:puertas` lo comprueba con 8 cuentas en 59 rutas, normal y con `RSC: 1`: una página nueva que no esté en su lista lo hace fallar. Entre iglesias nunca cruzó. Pendiente: las guardas de ACTION no miran ser del equipo ni el consentimiento (`devocionales/actions.ts` usa `requireIglesiaAccion` a secas). **Y al fusionar las ramas del 20-oct entraron tres páginas de panel sin la cadena**: `seguimiento/nuevos`, `seguimiento/nuevos/alta` y `emisora`, con `requireIglesia` y `obtenerMinisterio` y fuera de la lista de `test:puertas`, que falla hasta que entren; `seguimiento/nuevos` y `emisora` buscan además `CONFIRMACIONES[guardado]` sin `Object.hasOwn`. Va en la tanda de guardas de después de la fusión. `test:puertas`, además, solo recorre `src/app/panel`: las catorce pantallas de `/mi/equipo` ponen sus guardas en cada página (`en-la-app/guarda.ts`), probadas a mano, pero ninguna prueba las pide con `RSC: 1` |
| CSV del reparto | No se hizo: no era barato. Un route handler no pasa por el `layout.tsx` del reparto, y `guard-api.ts` no tiene guarda por ministerio (haría falta `requireGestionMinisterioApi(id, { desdeDentro, modulo })`). Y hay que decidir antes si una iglesia con el pago caído o el consentimiento pendiente puede descargar: hoy los CSV de eventos y finanzas se saltan esos dos cortes del `panel/layout.tsx` sin que esté decidido. El informe imprimible, con «Guardar como PDF», cubre lo que pide un banco de alimentos |
| El BOM del CSV, literal | `src/lib/format/csv.ts` lleva el BOM como carácter literal, la trampa que este fichero dice evitar. (El `Response` compartido de `guard-api.ts`, que salía vacío desde el segundo 401, lo cerró la tanda de las puertas) |
| Parámetros de la URL que tumban la página | CLAUDE.md pide Zod en toda query y estas no lo tienen: con basura dan 500 el informe de finanzas (`?mes=`), `/panel/miembros?ficha=abc` y `/panel/ministerios/<algo que no es un uuid>`, y probablemente `?desde=` y `?hasta=` del libro. Y el `?guardado=constructor` que cerraron los arreglos vuelve en las pantallas que llegaron después: las ocho de `/mi/equipo` que pintan `CONFIRMACIONES[guardado]` lo buscan sin `Object.hasOwn` (leído en el código, no probado) |
| El muro de pago cierra la puerta del reparto | En `solo_lectura`, `exigirPoderEscribir` impide marcar entregas un domingo. Se puede seguir repartiendo en papel, pero hay que decidir si el reparto entra en la lista corta de `sinMuro`. Es decisión de Marlon, no de código |
| Las personas del hogar se copian al LLEGAR | Si en la puerta se corrige el tamaño del hogar después de «Ha llegado», esa entrega cuenta el número viejo. Hoy se arregla con «Quitar» y «Ha llegado» otra vez; hacerlo solo pide una migración que refresque la copia al pasar a entregado |
| La puerta es lenta en local | Unos 6 s por action desde Canarias contra Irlanda: guard, `esMinisterioDeSuIglesia`, `exigirModulo` y la action, cada una en su transacción. En el VPS la base está al lado y no debería notarse, pero no está medido |
| Contestar un turno con los turnos apagados | `responderTurno` en `/mi/agenda` no pasa por `exigirModulo`: es la respuesta de una persona a SU asignación, no una escritura del equipo. Decidir si se corta |
| La secretaria no puede aprobar solicitudes | Tiene `aprobar_solicitudes` de salida, pero `iglesia_usuarios` solo admite UPDATE y DELETE del pastor (`0001`). Antes aprobaba a medias sin avisar; ahora la pantalla le dice que las aprueba el pastor. Arreglarlo es una función `security definer` que active o borre solo membresías pendientes |
| El correo de una cuenta nueva no se verifica | `/crear-cuenta` la crea con `email_confirm: true`. Pesa más desde que aprobar puede enlazar con una ficha: por eso la pantalla avisa de que el correo y el teléfono no prueban nada |
| Dar o retirar el permiso de asistencia cuando se quiera | No hay pantalla, y el texto de la casilla lo promete («puedo retirar este permiso cuando quiera»): `/acepta` solo sale cuando cambia la versión. Hace falta en `/mi/cuenta` o en la ficha. Mientras, los pastores que se registraron antes del 20-oct siguen fuera de sus propias listas —`/registro` ya pregunta la casilla, pero solo a las altas nuevas—; en la demo, el de Betania |
| Foto en la ficha de miembro | Va en OTRO bucket, privado y con URL firmada. El de iglesias es público |
| Eventos y calendario | Hecho y verificado, con sus textos legales |
| Área del miembro | Comunidad, devocional con vídeo, **agenda como calendario con sus turnos, lo que se toca cada domingo y la ficha del ensayo**, Biblia, **Equipo** para quien sirve y el reproductor de la radio. Falta el material del equipo |
| Agenda | **Calendario con día, semana y mes**, los días marcados y una hoja al tocarlos. Junta los horarios semanales, los eventos y las reuniones de los ministerios de cada persona |
| Stripe | **Hecho el circuito entero**, sin claves todavía. Ver «Qué hay que crear en Stripe» |
| Correo (Resend) | Nada. Ni bienvenida, ni aviso de solicitud, ni el de «se te acaba la prueba» — que ahora es el que más falta hace: el aviso solo se ve entrando al panel |
| El muro en `/mi` | A propósito NO está. Con la iglesia bloqueada, un miembro sigue leyendo su área; lo que no puede es publicar en el muro |
| Exportar y borrar datos | Derecho de supresión del RGPD, sin implementar |
| Cumpleaños de la semana en Inicio | Se puede: `fecha_nacimiento` existe. Va con `ver_datos_sensibles` y sin enseñar el año |
| Asistencia a escala | **Hecha la base, no la escala.** Marcar casillas una a una no sirve para 1.500 personas. Ver «Decidido y pendiente» |
| Notas de seguimiento en texto libre | A propósito NO están. Necesitan cifrado en reposo y base jurídica antes |
| Legales de la asistencia y el seguimiento | Hechos: `/privacidad` §3, §4 y §6, el anexo del art. 28 en `/terminos`, y el consentimiento propio |
| Los bloques de asistencia en Inicio | El diseño los pinta y siguen sin pintarse: el dato ya existe |
| **App nativa: lo que impide enviar a Apple** | Lo cuenta `docs/app-nativa/fichas.md` §1: borrar la cuenta desde la app, la Biblia vacía, el pago de Stripe al alcance dentro de la app (`/registro`, `/panel/suscripcion`), «Denunciar» y «Bloquear» en el muro, y la regla 4.2 (una web metida en una app; lo que más la separaría, los avisos push). Y compilar en el Mac (`docs/app-nativa/ios.md`) |
| **App nativa: lo que pide Google** | Borrar la cuenta dentro de la app **y** una dirección web para pedirlo (`/borrar-cuenta`, no existe). El gráfico de 1024×500 y las capturas. La cuenta para quien revisa. El formulario de seguridad de datos con lo de `fichas.md` §5, que ya incluye la plaza pagada y el reparto. Con cuenta personal de Play Console, la prueba cerrada de 12 personas durante 14 días |
| **App nativa: antes de cualquiera de las dos** | Desplegar la web con `app-nativa.tsx` y el cambio a hatril.com (los legales en producción aún dicen `hola@hatril.app`). Crear el buzón `hola@hatril.com`. Probar con sesión en un teléfono de verdad. **La firma de subida está solo en este ordenador**, en `Versiones/Android/firma/` (el `.jks` y `CLAVES.txt`): copiarla fuera, a un pendrive o un gestor de contraseñas. Si se pierde, Google tarda días en aceptar una nueva y mientras no se publica nada |
| Texto de la Biblia | La pantalla `/mi/biblia` está: índice de los 66 libros, buscador y capítulos. **Falta el texto**: unos 4,5 MB de la Reina-Valera 1909 en `public/biblia/rv1909/`, un JSON por libro. La RVR60 tiene derechos de Sociedades Bíblicas Unidas |
| Foto de perfil del miembro | **Se pinta ya**: `miembros.foto_url` existía desde la `0000` y ahora la usan el muro, los comentarios y el compositor, con las iniciales de color debajo como respaldo. Falta la pantalla para SUBIRLA, que va al bucket privado con URL firmada. Las de la demo son de `randomuser.me`, y eso NO vale para producción: la foto de un miembro es dato personal y no puede servirla un tercero |

---

## Trampas que ya han costado tiempo

**Las cookies de `localhost` se comparten entre puertos y entre sesiones.** El
navegador integrado es uno solo: si otra sesión entra con un enlace mágico en
`localhost:3001`, tu `localhost:3000` pasa a ser esa cuenta sin avisar, y la
pantalla rebota con «No tienes acceso» o da un 404 que parece un fallo del
código. Con varias sesiones a la vez, cada una con su host,
`http://<nombre>.localhost:<puerto>`, y el enlace mágico canjeado en ese host.
Comprobar SIEMPRE quién firmó la fila en la base, no solo la pantalla.

`127.0.0.1` no sirve para separarlas: en desarrollo Next arma `request.url` con
`localhost`, y `/auth/confirm` redirige ahí. La cookie sí se queda en el host
del enlace, así que después de canjearlo hay que volver a navegar a mano a
`<nombre>.localhost`; y si el enlace dice «caducado», es que se canjeó dos
veces. Además, **con el panel del navegador oculto** algún clic no llega y las
capturas salen atrasadas: otra razón para mirar la base y no la captura.

**Y el pooler se satura con varios servidores de desarrollo.** Modo sesión,
`pool_size` 15, y cada `next dev` abre hasta 10: con tres o cuatro sesiones
sale `EMAXCONNSESSION` como un 500 en cualquier pantalla. Es pasajero; si se
repite, el servidor de desarrollo puede ir por el puerto de transacción (6543),
porque `client.ts` ya va con `prepare: false`.

**`npm run lint` desde el checkout principal recorre las worktrees.** Las de las
otras sesiones viven en `.claude/worktrees/`, dentro de este repo, y `eslint`
sin argumentos entra en todas: pasa de un minuto a más de diez, y si acaba
informa de fallos que no son de esta rama. Desde aquí, `npx eslint src scripts`.

**No compilar con el servidor de desarrollo encendido.** `next build`, `tsc` y
`next dev` comparten `.next`: el servidor se pone a contestar 404 a todo, también
a `/panel`, y `tsc` lee `.next/dev/types/routes.d.ts` a medio escribir y da
decenas de errores que no son del código. Y al revés: `npm run build` seguido de
`next dev` sobre la misma `.next` da 404 en rutas que existen, en 30 ms y sin
nada en el log. Primero las comprobaciones, después el servidor, y borrar
`.next` si ya pasó. En un worktree recién montado, además, `tsc` falla con un
`.avif` de `/i/[slug]`: falta `next-env.d.ts`, que crean `next dev` o el build.

**La regla de 16 px de `globals.css` no llegaba a `<Input>`.** Vive en la capa
`base`, y la clase `text-[15px]` del componente es una utilidad, que gana:
todos los campos del panel medían 15 px en el móvil, y Safari de iOS ampliaba la
página al enfocarlos. Lo arregla `input.tsx` con `text-[16px] md:text-[15px]`.
Se vio midiendo con `getComputedStyle`; a ojo no se distingue. **Y no llega
tampoco a ningún `<select>` ni `<textarea>` nativo con su propio tamaño**: la
regla sigue dentro de `@layer base`. Es M1 del inventario visual, y se arregla
sacándola de la capa, no campo a campo (ver «Qué falta»).

**Registrar el consentimiento general en la versión vigente equivale a decir
«no» a la asistencia.** `miembrosSinPermisoDeAsistencia` se apoya en que esa
versión solo se acepta en `/acepta`, donde también sale la casilla. Cualquier
otro sitio que la escriba sin preguntar la casilla convierte el silencio en
negativa. Lo hacían aprobar una solicitud (arreglado con la `0040`) y crear una
iglesia (arreglado el 20-oct: `crearIglesiaConSeeds` exige `aceptaAsistencia`
sin defecto). Al escribir un consentimiento nuevo, mirar esto primero.

**Y la misma deducción muerde al subir la versión.** La negativa no se guarda:
se deduce de tener el general en la versión vigente sin el de asistencia, y
negar en `/acepta` no deja fila. El día que se suba
`VERSION_POLITICA_PRIVACIDAD` nadie tendrá el general en la versión nueva, así
que quien negó dejará de contar como negativa y volverá a salir en ausentes, en
nuevos, en las cifras de Inicio y en la lista de pasar, hasta que vuelva a
entrar en `/acepta`. Antes de subirla, guardar la negativa como fila, o dejar
de exigir la versión actual para leerla. En la demo, el caso es Tomás.

**Una action que reactiva filas puede estar reescribiendo las activas.**
`asignarAlMinisterio` buscaba las filas de esas personas sin filtrar por
`activo` y les ponía `voluntario`: así un colíder degradaba al responsable sin
pasar por las dos actions que vigilaban eso. Al cerrar una regla de quién toca
a quién, buscar con grep TODAS las actions que escriben en esa tabla, no solo
las que se llaman como la regla.

**`drizzle-kit generate` arrastra lo que se escribió a mano.** La 0034 y la 0035
se escribieron como migraciones a mano y su snapshot no recogió lo que creaban,
así que al generar la 0036 el SQL traía de propina un `create table` y un `add
value` que ya existían: aplicada tal cual, se habría caído entera. Se recortó a
mano y su snapshot ya está al día. Al generar, **leer el SQL antes de aplicar**
siempre, y quitar lo que no sea de esa tanda.

**El periodo de prueba de la demo caduca, y con él todo el panel.** Betania
venció el 23-ago y, pasada la gracia, `/panel` entero mandaba a `/suscripcion`:
no había forma de enseñar nada. Se alargó a mano hasta el **15-nov-2026** por
`DATABASE_URL` (HT112 impide hacerlo desde una sesión, a propósito). Cuando
vuelva a pasar, es eso y no un fallo del muro.

**Dos turnos «sin hora» no chocaban.** En SQL dos NULL nunca son iguales, así
que el índice único de (ministerio, fecha, hora) dejaba duplicar una vigilia de
todo el día. Va como `unique nulls not distinct`, que es Postgres 15+.

**Un desplegable largo saca la página por la derecha en el móvil.** La columna
implícita de una rejilla mide lo que su contenido más ancho, y un `<select>`
mide lo que su opción más larga. En el cuadrante, «Lucía Ferrer Ramos — Voz y
teclado» sacaba la pantalla 20 px. Escribir `grid-cols-1`, que es
`minmax(0, 1fr)`, aunque parezca el defecto.

**Un objeto literal usado como diccionario hereda de `Object.prototype`.**
`CONFIRMACIONES[guardado]` con `?guardado=constructor` devuelve la función
`Object`, que es verdadera, y React no la puede pintar: 500. Cualquier búsqueda
con una clave que viene de la URL va con `Object.hasOwn`. Lo tenían 21
pantallas, y las que se escriben copiando una vieja lo vuelven a traer.

**`Date` corrige las fechas imposibles sin avisar.** El 31 de febrero pasa a
ser el 3 de marzo, y se guarda como si alguien lo hubiera pedido. Una fecha que
llega de un formulario se valida antes de sumarle días (`sumarDias`, en la
agenda del equipo).

**«Hoy» es el de la iglesia.** Betania está en Bogotá: de madrugada en España
allí todavía es ayer, y una prueba que dependa de «hoy» sale con el día
anterior. Y al revés: una fecha calculada en UTC adelanta el día de noche en
América; el `hoy()` de `miembros/actions.ts` lo hacía y salía «llegó hace -1
días». La buena es `hoyEnLaIglesia()`.

**Una iglesia no se borra con un `delete from iglesias`**, aunque todo cuelgue
en cascada: el trigger `auditar()` de las tablas hijas inserta en `auditoria`
con el `iglesia_id` que se está borrando, y la clave ajena lo rechaza. Hay que
vaciar antes las tablas auditadas; el orden está en
`scripts/prueba-arreglos-sueltos.sql`. Pesará el día de la supresión de una
iglesia entera.

**Un `<audio>` miente en dos sitios.** `paused` vale `false` en cuanto se llama
a `play()`, suene o no, así que un tope de espera que lo mire no salta nunca; y
cuando el servidor corta, Chrome manda `pause` antes de `ended`, que parece una
pausa de quien escucha. Están comentados en `use-senal.ts`. Para probar la
radio, FIP de Radio France: SomaFM empezó a redirigir esta IP a un `alert.mp3`
a los pocos días de pruebas, y parecía que cualquier ruta sonaba treinta
segundos. Para un fallo de verdad, `example.com/x.mp3`.

**El lector de la herramienta del navegador no es un lector de pantalla.** Toma
el nombre de un campo del placeholder antes que de su `<label for>`, y el de una
casilla de su `value` si no hay `aria-label` ni `label[for]`. Un
`checkbox "on"` ahí no prueba que un lector real diga «on» —Chrome sí sigue la
etiqueta envolvente—, pero el arreglo vale para los dos.

**Cambiar la paleta enseña dónde NO están los tokens.** Al pasar la aplicación a
oscuro aparecieron 79 colores escritos a mano en `.tsx` —17 solo en
`button.tsx`— y casi todos apuntaban a variables que YA existían en
`globals.css`. El motivo es siempre el mismo: la variable estaba definida pero no
expuesta como `--color-*`, así que no había utilidad de Tailwind que la usara y
quien escribió la pantalla puso el hex a mano. Mientras hubo un solo tema no se
notó; al cambiarlo, cada uno de esos hex se quedó clavado en su color claro.

Y una que solo se ve midiendo: **un tono de marca que funciona como relleno no
tiene por qué funcionar como texto.** #BD4715 con letra blanca encima da 5.1:1
—perfecto para un botón— pero como color de TEXTO sobre #1C1C1C da 3.4:1, y
#93231F da 1.6:1. Por eso `danger` se aclaró a #E0655B y los ministerios
ganaron un tercer color (`claro`) además de `hex` y `suave`.

**Las policies se suman con OR, y los GRANT por columna solo recortan a `anon`.**
Dos policies escritas para el visitante —`iglesias_select_directorio` y
`ministerios_select_publico`— se habían concedido **además** a `hatril_app`. Como
a ese rol se le concedió la tabla entera, cualquier sesión autenticada leía las
filas completas de toda iglesia publicada: los ministerios de otra congregación
con su líder, y `stripe_customer_id`, `plan` y `trial_until` de todas. Las cerró
la `0005`. Al conceder una policy, mirar SIEMPRE a qué roles va.

**Una función nueva NO nace cerrada.** Pese a lo que decía este repo. Ver el
apartado de funciones en `CLAUDE.md` y la migración `0007`.

**Una tabla nueva tampoco, y ahí sí hubo fuga.** El `grant select (columnas)` de
la `0012` no recortaba nada, porque debajo seguía el grant de tabla entera que
Supabase da por defecto a `anon` y `authenticated`. Resultado: durante meses,
`GET /rest/v1/devocionales?select=id,autor_miembro_id,video_url` devolvía 200 con
la clave publicable —la que viaja en el JavaScript del navegador—, y sacaba justo
la columna que esa migración había dejado fuera a propósito. Solo `devocionales`
estaba afectada: es la única migración del repo que hace `grant` sin `revoke`
delante. La RLS impidió lo demás, porque `anon` no tenía ninguna policy de
escritura. Lo cierra la `0022`, que además invierte el defecto de tablas —como la
`0003` hizo con el de funciones— y revoca `service_role` en `auditoria`,
`consentimientos` y `solicitudes_ingreso`, que era lo que este fichero llevaba
pidiendo desde el 19-ago.

**Un campo de menos de 16px hace que Safari de iOS amplíe la página entera.**
Y no lo deshace al salir: la página se queda ampliada y desplazada a un lado,
con la cabecera pegajosa fuera de sitio y el contenido cortado por el borde
izquierdo. Es lo que se veía en el muro —«está muy pegado a los bordes y se
mueve todo»— y costó encontrarlo porque **en el navegador de escritorio, con el
mismo ancho de 375px, no pasa nada**: `scrollWidth` sale idéntico al ancho de la
ventana, no hay ni un elemento que desborde, y todas las comprobaciones dan
verde. El campo de comentario medía 14.5px y el de publicar, 15.

Lo arregla una regla en `globals.css` que sube a 16px todo `input`, `textarea` y
`select` por debajo de `md`, **pero solo a los que no llevan clase de tamaño**:
vive en `@layer base` y las utilidades de Tailwind ganan siempre. Por eso no
llegaba a `<Input>` (ya arreglado) y no llega a los campos nativos con tamaño
propio (M1, en «Qué falta»). La otra forma —`maximum-scale=1` en el viewport—
se descarta a propósito: le quita el zoom a quien no ve bien, y en una
congregación con gente mayor eso es cambiar un problema de maquetación por uno
de accesibilidad.

**`current_period_end` ya no está donde dicen los tutoriales.** Desde la
versión de API `basil` vive en cada línea de la suscripción
(`subscription.items.data[].current_period_end`) y no en la suscripción. El SDK
instalado —22.5, OpenAPI v2349— no lo declara arriba, así que copiar
`sub.current_period_end` de cualquier ejemplo de internet no compila. Y con un
`as any` por medio compila y devuelve `undefined`, que es como una iglesia al
día se queda sin fecha de acceso y bloqueada tres días después.

**Un layout de Next no se vuelve a ejecutar al navegar**, y tampoco «controla si
el resto de la ruta se renderiza» — lo dice su propia documentación en
`03-file-conventions/layout.md`. Este repo pone los guards en el layout de cada
sección a propósito y eso sigue estando bien para lo que no cambia dentro de una
sesión: quién eres y a qué iglesia perteneces. Pero un estado que puede cambiar
mientras alguien navega —la suscripción— no se puede vigilar solo desde ahí. Por
eso el muro corta en el guard de cada server action y el layout se limita a
mandar fuera del panel.

Desde el 20-oct se sabe que el layout no basta ni para lo que no cambia: no
impide que su página se ejecute, y lo que la página consulta viaja en el payload
RSC aunque el layout redirija. La guarda va en cada página, antes de consultar
nada (ver «Las páginas confiaban en el layout», en «Qué falta»).

**El MCP de Supabase es de solo lectura.** `execute_sql` sirve para mirar y
falla con «cannot execute UPDATE in a read-only transaction» al escribir. Para
preparar o deshacer un dato de prueba hay que ir por `DATABASE_URL` con un
script suelto; el MCP no vale.

**Un `alter type ... add value` no se puede usar en la misma transacción.**
Postgres deja añadir el valor al enum, pero no escribirlo hasta que la
transacción confirme — y una migración ES una transacción. Por eso
`origen_asistencia_enum` nace en la `0031` con los cuatro valores (`panel`,
`lider`, `qr`, `autoconfirmado`) aunque hoy solo se escriba el primero: hacerlo
dentro de un año obligaría a partir la migración en dos pasadas, con meses de
listas dentro. Un enum se completa cuando la tabla está vacía, no cuando hace
falta.

**`npm run db:migrate` no aplica nada y sale con código 0.** Sin error, sin
mensaje y sin dejar rastro: parece que ha funcionado. Es `strict: true` en
`drizzle.config.ts`, que pide confirmación por consola; cuando nadie puede
contestarla, drizzle-kit se rinde en silencio. Se descubrió porque las tablas no
aparecían después de dos pasadas «correctas».

Mientras siga así, la vía que sí aplica —y registra igual en
`drizzle.__drizzle_migrations`, así que el repo sigue siendo la fuente de
verdad— es el migrador de `drizzle-orm`:

```bash
node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import { drizzle } from 'drizzle-orm/postgres-js'; import { migrate } from 'drizzle-orm/postgres-js/migrator'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await migrate(drizzle(sql), { migrationsFolder: './drizzle' }); await sql.end();"
```

Y da el error de verdad, que drizzle-kit se tragaba: hay que leer `e.cause`,
porque `e.message` solo trae el SQL entero.

**`miembros.estado` y `iglesia_usuarios.estado` son enums distintos que se
parecen.** El primero es `visitante · nuevo · miembro · inactivo · baja` (la
situación de la persona en la congregación); el segundo, `pendiente · activo ·
rechazado · baja` (si su cuenta tiene acceso). Escribir `miembros.estado =
'activo'` tumbó entera la migración `0015`. Para «¿esta persona puede entrar?»
manda siempre el de `iglesia_usuarios`, que es el que consulta
`pertenece_a_iglesia()`.

**Una policy que consulta otra tabla necesita los GRANT de esa otra tabla.** Una
policy `USING` sobre su propia tabla no comprueba permisos de columna; en cuanto
la expresión mira OTRA tabla, esa lectura va con los privilegios de quien
pregunta. `ministerios_select_publico` consultaba `iglesias.activa`, que `anon`
no tenía concedida, así que `anon` nunca pudo leer ni un ministerio: fallaba con
«permission denied for table iglesias». Llevaba roto desde la `0001` y no se veía
porque `/i/[slug]` va por `dbAdmin`. Lo arregla la `0006`.

**Un texto legal se revisa contra el código, no contra sí mismo.** La primera
redacción de los párrafos de eventos pasaba lectura, era coherente y decía cuatro
cosas falsas. Todas se cazaron comparando frase por frase con lo que el producto
hace: la política declaraba que la IP servía «para frenar inscripciones
automáticas» cuando el propio schema dice que no se usa para eso; afirmaba que
«nada vincula un importe con una persona» tres párrafos después de contar que se
guarda quién ha pagado su plaza; prometía un aviso por correo sin que exista
envío de correo; y el anexo del art. 28 declaraba como medida del art. 32 un
«registro de quién consulta los datos protegidos» que no existe —`lectura_sensible`
está en el enum y no lo escribe nadie—. A eso se suma que `/terminos` prohibía
«guardar datos de personas que no tengan relación con la congregación», que es
literalmente lo que hace el módulo de eventos.

**Y una promesa legal necesita el botón que la cumple.** «Si pides que se borre,
se borra» era falso para un inscrito: solo existía dar de baja —que conserva
nombre, correo, teléfono, nota e IP— o borrar la lista entera. Atender a una
persona obligaba a incumplir con las otras cuarenta. Ahora hay un botón de borrar
los datos de una sola.

**Cambiar el texto de privacidad no es gratis.** `VERSION_POLITICA_PRIVACIDAD` se
guarda con cada consentimiento. Si se toca el fondo de `/privacidad` hay que
subir esa constante **y** volver a pedir el consentimiento a quien aceptó la
anterior. Cambiar el texto a solas deja la base diciendo que la gente aceptó algo
que no leyó.

**Una tabla nueva necesita su GRANT por columna para `anon`, y su RLS.** El
generador de Drizzle no escribe ninguna de las dos cosas: hay que añadirlas a
mano al fichero de migración. Pasó con `iglesias.imagenes` (0010) y con
`ministerios.foto_url` (0011); sin el GRANT la consulta pública no devuelve cero
filas, **falla entera** con «permission denied».

**Un `blur` no distingue «me he ido» de «he abierto el diálogo de ficheros».**
Al abrir el selector de archivos del sistema, el foco sale de la página y el
evento llega con `relatedTarget` a `null` — exactamente igual que si la persona
se hubiera ido a otra pestaña. El publicador del muro pliega su fila de acciones
cuando nadie escribe, y sin cubrir este caso la fila desaparecía justo bajo el
dedo mientras se elegía la foto. Se tapa con una bandera que se levanta en el
`pointerdown` de la etiqueta y se baja con el `focus` de la ventana: el navegador
**no avisa de una cancelación** del diálogo —no hay `change`, y `cancel` no llega
en todos—, así que bajarla en el `change` la dejaría levantada para siempre.

Y dos hermanos del mismo caso: moverse entre controles de dentro del formulario
tampoco es salir (`currentTarget.contains(relatedTarget)`), y con texto escrito o
fotos elegidas no se pliega nunca — esconder el botón de publicar encima de un
borrador es peor que ocupar sitio.

**Plegar algo con estado tiene que nacer desplegado.** El mismo publicador
arranca con `abierto = true`, así que el HTML del servidor ya trae el botón de
publicar y quien no tenga JavaScript sigue pudiendo enviar. Y se pliega con
`useLayoutEffect` y no con `useEffect`: con el segundo el navegador alcanza a
dibujar la fila y la quita al fotograma siguiente, un parpadeo en cada carga del
muro. Como `useLayoutEffect` no existe en el servidor, va tras el alias habitual
que elige uno u otro según dónde se ejecute.

**Un fichero `'use server'` solo puede exportar funciones async.** Exportar una
constante desde ahí rompe el build entero, y el typecheck no lo caza porque es
una regla de Next y no de TypeScript: aparece al abrir la pantalla. Las
constantes van a un fichero aparte, como `ajustes/constantes.ts`.

**Storage no usa `hatril_app`.** Sus policies se evalúan con el rol del JWT, que
es `authenticated`; `hatril_app` solo existe dentro de una transacción de
`withUser()`. Por eso las imágenes las sube la server action con el service role
y el navegador no habla con Storage: darle escritura a `authenticated` sería
abrirla desde fuera con la publishable key. Lo cuentan las migraciones `0008` y
`0009`.

**El rol de Postgres.** `withUser()` entra como `hatril_app`. Si alguien lo
cambia a `authenticated`, el panel entero devuelve 500 sin más pista que un
`permission denied`. Pasó, y estuvo días sin detectarse.

**`formData.get()` devuelve `null`.** Nunca leerlo directo para pasárselo a Zod:
`z.string().optional()` acepta `undefined` pero no `null`, y un campo que
simplemente no viaja en el envío tumba la validación entera. Usar los helpers de
`src/lib/api/formulario.ts`.

**Una policy de UPDATE no impide cambiar de iglesia.** Parece que sí: el `using`
mira la fila de origen y el `with check` la de destino. Pero una cuenta puede
pertenecer a DOS congregaciones —`iglesia_usuarios` solo es único por
`(iglesia_id, auth_user_id)`, y un pastor que planta una segunda iglesia o
alguien que se muda son casos reales—, y entonces las dos condiciones son
ciertas a la vez. No es una fuga hacia un extraño, porque quien lo haría ya ve
las dos; es corromper el libro de una con los movimientos de la otra. Lo tapa
**HT111** en la `0020`, y hace falta el mismo guard en cualquier tabla futura.

**`service_role` es una puerta distinta de `dbAdmin`.** Las migraciones hasta la
`0017` revocaban solo `from anon, authenticated`. `dbAdmin` conecta como
`postgres` por `DATABASE_URL` y ahí no hay nada que revocar, pero `service_role`
entra por PostgREST con una clave que viaja en variables de entorno: es la clave
que ESTADO.md lleva desde el 16-ago pidiendo rotar. La `0020` le revoca las tres
tablas de finanzas y no rompe nada, porque ninguna consulta va por supabase-js.
Conviene hacer lo mismo en las tablas que ya existen.

**Un route handler NO queda cubierto por el `layout.tsx` de su carpeta.** Es la
excepción a la regla de «los guards van en el layout»: los handlers no participan
en layouts, y `src/proxy.ts` es comprobación optimista, no autorización. Por eso
existe `src/lib/auth/guard-api.ts`, que devuelve `Response` y no `redirect()` —un
redirect desde un endpoint que sirve un fichero le entrega al navegador una
página HTML con nombre de CSV.

**`capitalize` de Tailwind capitaliza CADA palabra.** `toLocaleDateString` en
español devuelve «agosto de 2026» y salía «Agosto De 2026». Para una sola
mayúscula inicial, `first-letter:uppercase`.

**Un BOM literal en el código es invisible y alguien lo borra.** El CSV necesita
BOM UTF-8 o Excel en español destroza los acentos, y `sep=;` o mete el fichero
entero en una columna. Escrito como carácter literal no se ve en el editor;
va como `﻿`. Y ojo al comprobarlo: `fetch().text()` **elimina el BOM** al
decodificar, así que parece que falta cuando está. Hay que mirar los bytes.

**Una columna interpolada en un `sql` de Drizzle sale SIN cualificar.**
`${eventos.id}` dentro de una subconsulta se escribe como `"id"` a secas, y
Postgres lo resuelve contra la tabla de DENTRO si esa también tiene una columna
`id`. El contador de plazas quedó como `where ei.evento_id = ei.id`: cero
siempre, sin error, sin aviso y con la consulta perfectamente válida para el
compilador y para Postgres. Se vio en pantalla —«0 personas de 2 plazas» con un
inscrito debajo— y no en ninguna comprobación automática. En una subconsulta
correlacionada, el nombre de la tabla de fuera se escribe a mano.

**lucide 1.x ya no trae iconos de marca.** `Instagram`, `Facebook` y `Youtube`
son `undefined`: se retiraron del paquete. Importarlos no da error de
compilación, da un componente vacío en tiempo de ejecución. Por eso las redes
del pie de `/i/[slug]` van como pastillas con el nombre escrito y no como
iconos. Dibujar logotipos a mano junto a un juego coherente se ve peor, y es la
regla de iconografía del sistema de diseño.

**El `<Toaster />` de sonner no está montado en ningún layout.** `src/lib/toast.ts`
y `src/components/ui/sonner.tsx` existen —vienen de Gonper—, pero nadie los
monta: una llamada a `toast()` no pinta nada y no avisa. Para confirmar una
acción en cliente, que el propio botón lo diga. Montarlo traería `next-themes` a
una aplicación de modo claro únicamente.

**Los backticks rompen `scripts/test-aislamiento.ts`.** El bloque SQL vive dentro
de un template literal de TypeScript: un backtick en un comentario SQL cierra la
cadena y el fichero deja de compilar. Y los saltos de línea del informe van como
`\n`, doble, para que llegue `
` a Postgres.

**Los GRANT son por columna.** Una columna nueva en `iglesias` nace invisible
para `anon`. Si la web pública deja de mostrar un campo recién añadido, mirar el
`GRANT SELECT (…)` de la migración antes que el código.

**Crear usuarios de Supabase a mano.** Hace falta la fila en `auth.identities`,
y las columnas de token de `auth.users` tienen que ser cadena vacía y no `NULL`.
Con `NULL` el inicio de sesión falla con «Database error querying schema».

**El pooler.** Modo **sesión** (5432), no transacción (6543). El de transacción
no admite sentencias preparadas y `drizzle-kit migrate` las usa.

**Las migraciones.** Se aplicaron por MCP y luego se registraron sus hashes en
`drizzle.__drizzle_migrations`. A partir de ahora, vía única: `npm run
db:migrate`. Y `.gitattributes` fuerza LF porque el hash es del contenido del
fichero.

---

## Pendiente que no es código

- **Confirmar el país del centro de datos.** `ALOJAMIENTO` ya está relleno:
  **Hostinger International Limited**, que es el nombre con el que está
  registrado el AS47583 dueño del rango del despliegue —el hostname resuelve a
  `srv1478310.hstgr.cloud`—. Falta afinar una sola cosa: se escribió «Alemania
  (UE)» porque es lo que consta, y la geolocalización de la IP devuelve
  **Francia**. Las dos son UE, así que la frase de `/privacidad` se sostiene
  igual, pero el dato exacto hay que mirarlo en hPanel → VPS → la ficha del
  servidor, no en una base de geolocalización.

  Y de paso: **este fichero decía que la IP del despliegue «no está en un rango
  europeo» y era falso.** `187.124.37.206` pertenece a Hostinger, AS47583, con
  registro europeo. Era una suposición por el `187.x` —que suele ser
  latinoamericano— que nadie había comprobado. Que los datos guardados
  estén en Supabase no exime: el contenedor de Next ve cada dato al procesar la
  petición, y eso también es tratamiento.
- **Crear el buzón `hola@hatril.com`.** El dominio es hatril.com (ya no
  hatril.app) y sirve la web, pero no tiene registros MX: el correo de los
  legales, al que la gente escribe para ejercer sus derechos, no llega a
  ninguna parte.
- **Copiar la firma de subida de Android fuera de este ordenador**:
  `Versiones/Android/firma/`, con el `.jks` y `CLAVES.txt`.
- **Rotar la clave secreta de Supabase y la contraseña de la base.** Las dos se
  pegaron en un chat el 16-ago-2026. Antes de que entre una iglesia real.
- **Activar la protección de contraseñas filtradas** en Supabase (Auth →
  Passwords → *Leaked password protection*, que compara contra HaveIBeenPwned).
  Está apagada, y es el único WARN de `get_advisors`. Es un clic, no código.
- **Precio.** En variables de entorno a propósito. La competencia va de 9 a 70
  USD/mes escalados por número de miembros.

### Qué hay que crear en Stripe

El código está entero y verificado; lo que falta son las claves. Sin ellas la
pantalla dice «Falta configurar los precios» y no pinta un botón que reventaría
al pulsarlo.

1. **Seis precios** en el panel de Stripe: Esencial, Comunidad y Plus, cada uno
   mensual y anual. Sus ids van a `STRIPE_PRICE_*` en el entorno. La cifra vive
   en Stripe, no en el repo, y por eso ajustarla no cuesta un despliegue.
2. **`STRIPE_SECRET_KEY`**, de la misma cuenta que los precios. Un id de precio
   de otra cuenta falla al pulsar «Ver precio», no antes.
3. **El endpoint del webhook**, apuntando a
   `https://<dominio>/api/stripe/webhook`, suscrito a cuatro eventos:
   `checkout.session.completed`, `customer.subscription.created`,
   `.updated` y `.deleted`. Su secreto va a `STRIPE_WEBHOOK_SECRET`. Sin esa
   variable el endpoint responde 500 a propósito: es un fallo de despliegue, no
   del evento, y Stripe reintenta hasta que esté puesta.
4. **En Dokploy, además de en `.env.local`.** Ninguna es `NEXT_PUBLIC_`, así que
   basta con las variables de ejecución; no hacen falta como argumentos de
   compilación.

Lo único que NO se ha podido probar sin claves es la vuelta de Checkout —el
evento `checkout.session.completed` es el único que pide un viaje a Stripe para
leer la suscripción—. Los otros tres caminos sí, con eventos firmados de verdad.

Y cuando existan las claves, el primer cobro real conviene hacerlo en modo
prueba con `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## Decidido y pendiente de construir

**Lo que queda de los legales, que ya no es el bloqueo.** Los textos están
reescritos y revisados contra el código, y la versión subió a
`privacidad-2026-09` con su pantalla de re-consentimiento detrás. Queda:

- **`ALOJAMIENTO` sigue con [PENDIENTE]**, y es lo único que mantiene el aviso
  rojo sobre `/privacidad` y `/terminos`. Hacen falta el nombre legal del
  proveedor del VPS y el país del centro de datos. Ojo: la IP del despliegue no
  parece de un rango europeo, así que conviene comprobarlo antes de escribir
  «UE» en una política.
- **El derecho de supresión sigue siendo manual**, como lo era antes: §4 dice
  que se tramita escribiendo a la iglesia o a Hatril, así que el texto no miente.
  Lo que cambia es que ese borrado a mano tiene ahora tres tablas más que
  recordar —`asistencias`, `seguimiento_contactos` y `seguimiento_asignaciones`—
  además de las de siempre. Lo único automatizado es el borrado de un contacto
  suelto, y el borrado completo que dispara negarse en `/acepta`.
- **El diezmo nominativo** sigue esperando su propio valor de consentimiento,
  por las mismas razones de siempre.

**El corte del consentimiento está en TRES sitios y no en uno.**
`exigirConsentimientoAlDia()` se llama desde `panel/layout.tsx`, desde `/mi` y
desde `/mi/comunidad`. No puede vivir dentro de `requireIglesia()`, que sería lo
natural, porque `/acepta` llama a ese mismo guard y la pantalla se redirigiría a
sí misma para siempre. Al añadir una pantalla nueva que trate datos, hay que
acordarse. `/mi/avisos` queda fuera a propósito: a quien le rechazan la solicitud
se le borra la membresía en el mismo movimiento, y el aviso que se lo explica
tiene que seguir siendo alcanzable.

Tres cosas de los legales que conviene no deshacer, porque costaron encontrarlas:

- La casilla de la asistencia **no se premarca**. Considerando 32.
- Negarse **borra**, no solo oculta. Filtrar las pantallas y conservar las filas
  dejaba números que no cuadraban con las listas, y seguir enseñando un dato en
  un recuento es seguir tratándolo.
- `miembrosSinPermisoDeAsistencia()` excluye a quien **vio la casilla y no la
  marcó**, no a quien nunca llegó a verla. La primera versión hacía lo segundo y
  hacía falsa una frase de `/privacidad` §4 recién escrita; lo cazó revisar frase
  por frase contra el código, no releer el texto.

**La asistencia a escala.** Marcar casillas una a una funciona para una
congregación de 40 o 150, que es el mercado inicial. Para 1.500 no. El dato
tendrá que venir también de otro sitio, y por eso `asistencias.origen` ya existe
con sus cuatro valores. Ordenadas de más sólida a menos:

1. **Check-in con QR en la puerta.** La persona escanea y se marca sola. Es lo
   que hacen las iglesias grandes, y **no necesita app**: una URL con token
   rotatorio funciona desde cualquier móvil.
2. **Cada líder marca su grupo.** 1.500 personas son 120 líderes marcando doce
   cada uno. Encaja con los ministerios que ya existen y no añade infraestructura.
3. **Buscador y filtro en la lista actual.** Con 1.500 no se hace scroll, se
   escriben tres letras. Es lo más barato de todo.
4. **Autoconfirmación por aviso**, como complemento.

Y la regla que hace que lo anterior no destruya el dato: **quien no contesta no
es quien no vino.** Si la autoconfirmación llega a alimentar el «lleva cinco
domingos sin venir», el silencio tiene que seguir siendo AUSENCIA DE FILA —«no
lo sabemos»— y nunca una fila con `presente = false`. Confundirlos pone a
consolidación a llamar a gente que vino todas las semanas, y a la tercera
llamada el pastor deja de fiarse del producto.

Ojo con la dependencia: la autoconfirmación necesita app (Capacitor ya está
desde el 20-oct, pero la app aún no se ha publicado), push (cero referencias en
el repo) y que la gente tenga cuenta (`miembros.auth_user_id` es nullable y
casi ninguna ficha la tiene).

**Finanzas, lo que falta.** La v1 está hecha y NO guarda nombres de donante.
`tipo_ingreso` distingue diezmo de ofrenda para poder sumarlos por separado, pero
nada vincula un importe con una persona.

El diezmo nominativo sigue decidido y sigue haciendo falta para el certificado de
donación. Lo que cambió es el **orden**, y el motivo es que hoy no hay base
jurídica: el consentimiento que la gente ha marcado —`datos_religiosos`, art.
9.2.a— dice que se guardan sus datos «para que la congregación pueda
organizarse», y eso no cubre «y cuánto dinero doy, con mi nombre, durante años».
Antes de la tabla satélite hacen falta:

- Un valor nuevo en `tipo_consentimiento_enum` con su casilla separada (art. 7.2,
  granularidad), y decidir por escrito qué pasa con quien se niega.
- Reescribir `/privacidad` §3, que hoy dice que «los donativos no pasan por
  Hatril» y con el módulo ya es falso, y §6, que promete un borrado que
  `auditar()` no cumple.
- Ampliar el anexo del art. 28 en `/terminos` §7, que no menciona aportaciones
  económicas: tratar una categoría que el contrato no nombra convierte al
  encargado en responsable (art. 28.10).
- Cerrar la segunda puerta: `grant select on public.auditoria to hatril_app`
  (0001:226) es de tabla entera y `auditoria_select_pastor` (0001:439) no filtra
  por entidad, así que el mapa diezmo→persona se reconstruiría desde la auditoría
  sin dejar rastro.

Cuando llegue, el nombre NO va como columna de `movimientos`: los GRANT son por
columna pero todas las sesiones entran como el mismo rol, así que una columna no
se puede ocultar a quien ya lee la fila, y filtrarla por RLS haría mentir a
`sum()`. Va en tabla satélite sin GRANT, tras funciones `security definer`.

**Lo que se aplazó a propósito de la v1:** arqueo de la ofrenda con desglose por
denominación, cierre de periodo, categorías de gasto, campo `beneficiario`
(invita a escribir un nombre y con él el motivo, que suele ser de salud),
adjuntar justificante, PDF y XLSX generados en servidor, y la comparativa
interanual —que no tiene con qué comparar hasta que haya un año de datos—.

**Eventos y calendario.** Con fecha y hora, distintos de los horarios semanales
que ya existen. Salen en la web pública.

Las tablas ya están: `eventos` y `evento_inscripciones`, con su RLS, sus tres
guards (HT113, HT114, HT115) y la función `inscribir_en_evento`. Verificado
ejecutándolo: 39 comprobaciones contra la base de verdad, más doce nuevas
permanentes en `npm run test:aislamiento`.

Tres decisiones que conviene no volver a discutir:

- **`anon` no recibe nada, ni una columna, ni un `grant execute`.** La
  inscripción pública no pasa por PostgREST: la server action llama con
  `dbAdmin` a una función `security definer` que no está concedida a nadie. Eso
  quita del mapa `POST /rest/v1/rpc/` y hace que la IP deje de venir de un
  desconocido.
- **La función devuelve un solo escalar.** Un correo ya inscrito responde
  exactamente igual que un alta nueva. Devolver el código de cancelación solo en
  el alta convertiría esto en un oráculo: con una lista de correos se
  reconstruiría quién asiste a un acto religioso sin leer una fila. El código va
  por correo, así que **hasta que Resend esté montado no hay autocancelación**:
  la baja la hace el pastor.
- **Ninguna señal de aforo sale a la calle.** Ni plazas restantes, ni «completo»,
  ni un botón que desaparezca: con cualquiera de las tres se rearma el mismo
  oráculo desde fuera. El rechazo por aforo se entera al enviar.

Lo que falta es todo lo de arriba: `/panel/eventos`, la sección de la web
pública, el permiso `gestionar_eventos`, y los textos de `/privacidad` y
`/terminos` — que **no son opcionales** aquí, porque es la primera vez que la
plataforma guarda datos de gente que no es miembro de ninguna iglesia.

**Web pública, lo que falta:** versículos y servicios. Las redes sociales ya
están, al pie. Los
donativos ya no son una sección: son el botón «Donar» de la cabecera, y ahí es
donde entrará el pago con Stripe. «Quiero ser parte» está en el bloque de
comunidad.

**Comunidad, fase 2:** vídeo (hoy solo enlace de YouTube en el devocional;
subirlo cuesta almacenamiento y tráfico), avisos de la comunidad, menciones,
reportar y ocultar, publicaciones fijadas. Y paginación del muro, que hoy trae
las últimas treinta y ya está.

Dos avisos que **no** se emiten y es deliberado: «le ha gustado tu comentario» y
«te han respondido». Los seis tipos viven en un enum de Postgres con sus textos,
así que cada uno es una migración más un texto; y aunque fueran gratis, la
campana ya recibe un aviso por cada me gusta de publicación. Sumar uno por cada
me gusta de comentario en un muro activo un domingo la convierte en ruido que
nadie mira. Cuando se añadan, van juntos y con una forma de agruparlos.

**Reina-Valera 1960.** Investigar la licencia para poder mostrar el texto
bíblico dentro del producto.

El encargo de tratamiento del art. 28 ya no está pendiente: es el apartado 7 de
`/terminos` y se acepta al registrar la iglesia.

---

## Datos de prueba

Las **imágenes de la demo son fotos de verdad, subidas al bucket**: los paisajes
de Picsum —que sirve fotografías de Unsplash, con licencia de uso comercial y
sin atribución obligatoria— y los retratos de Pravatar. Se descartó
`loremflickr`, que sí busca por tema pero sirve Creative Commons con atribución.

Y se copian, no se enlazan: enlazarlas dejaría la demo dependiendo de que un
tercero siga vivo, y le daría la visita de cada persona que abra el muro.

La foto de PERFIL está hoy en el bucket público, y eso no vale para producción:
es dato personal y va al privado con URL firmada. Lo que falta es firmarla en la
consulta; la columna ya es la buena.

`scripts/seed-demo.sql` crea las cuentas, las fichas y los ministerios, y
`scripts/seed-muro.sql` llena el muro de Betania —siete publicaciones de cinco
personas, con comentarios, respuestas y me gusta—. El segundo se puede repetir:
borra antes lo suyo, que va marcado con `[demo]` en el texto.

Diez cuentas, contraseña `Hatril2026`, todas `@hatril.test`: `pastor@`,
`secretaria@`, `lider@`, `miembro@`, `visita@`, `admin@`, `pastor.sion@` (de
otra iglesia, para probar el aislamiento), `colider@` (Sara Nieto, rol
`miembro`, colíder de Acción social y de Radio), `consolidacion@` (Noemí, rol
`miembro`, responsable de Consolidación y con `ver_seguimiento`; la crea
`scripts/seed-consolidacion.sql`) y `enlace@` (Andrés, voluntario de Acción
social; su ficha nació sin cuenta para probar el enlace al aprobar). Son las
ocho con las que corre `npm run test:puertas`, más `visita@` y `admin@`.

**`admin@` es la excepción: no tiene contraseña conocida** desde el 28-oct.
Es super admin, y con `/admin` una contraseña pública en un repo público
abriría todas las iglesias de producción. Se entra por enlace mágico: la receta
de `generateLink` con `next=%2Fadmin`, o `npm run test:puertas:admin`, que ya
lo hace. Si alguna vez vuelve a tener `Hatril2026`, es un agujero, no una
comodidad.

`lider@` es responsable de Alabanza: es la cuenta con la que se comprueba que el
permiso acotado deja gestionar un ministerio y ninguno más. Alabanza tiene
turnos planificados los domingos del 18-oct al 22-nov, con gente en los dos
primeros, y `miembro@` (Lucía) sirve en Voces: es la pareja para probar los
turnos desde los dos lados. Su repertorio tiene tres canciones, y las tres
están en la lista del 18-oct (una en otro tono). `lider@` y `secretaria@` ya aceptaron la política
`privacidad-2026-09`; las demás cuentas pasan antes por `/acepta`. Y Niños tiene
responsable **y** colíder, que es el caso que el modelo viejo no podía guardar.

Dos iglesias: **Betania** (Bogotá, publicada) y **Sion** (Madrid, sin publicar).

El **reparto** de Acción social de Betania tiene datos de las pruebas del
19 y 20-oct, no de un seed: dos hogares en el padrón (María, la Familia Rojas)
y repartos el 12, 16, 19 y 20 de octubre, con entregas sin inscribir y una
entrega de un hogar ya borrado. Se entra como `colider@` (Sara Nieto, colíder
con rol `miembro`).

De las tandas del 20-oct quedan en la base, cada cosa con su script y su
borrado:

- **Alabanza**: seis ensayos del 22-oct al 26-nov y dos canciones en la lista
  del culto del 25-oct (`scripts/seed-alabanza-ensayos.sql`).
- **Consolidación**: tres cultos con lista en los tres últimos domingos —con
  fechas relativas a hoy— y una persona nueva por cada caso de la pantalla
  (`scripts/seed-consolidacion.sql`). Además, de las pruebas, cuatro visitantes
  dados de alta desde la pantalla —Rosa Medina Pinto, Mateo Rincón Vega, Sofía
  Duque Arango y Andrés Duque, los tres últimos con sus consentimientos— y la
  asignación y el contacto de Valeria. Tomás es el que negó el permiso de
  asistencia.
- **Radio**: un ministerio Radio en Betania con la señal de FIP, tres programas
  y `en_web` marcado, con Sara de colíder (`scripts/seed-radio.sql`).
- Las pruebas de los arreglos y de la app del líder no dejaron nada.

Ojo: Betania tiene en su horario semanal un «Ensayo de alabanza» los jueves a
las 19:30, y con los ensayos de la agenda el músico ve dos filas el mismo
jueves. Es dato de la demo, no código.
