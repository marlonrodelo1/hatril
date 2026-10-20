# Radio v1 — estado de la rama `claude/radio-emisora-b8da75`

20 de octubre de 2026. Tanda 6 de `plan.md`, **sin migraciones**: la radio vive
entera en `ministerios.modulos.emisora`, y los programas del mes con sus
locutores son turnos, que ya existían. Para integrar en `ESTADO.md` al fusionar.

---

## Qué hay

- **Tipo `radio`** (`tipos.ts`): enciende `emisora`, `turnos` y `agenda`, con
  los puestos Locución, Control técnico, Producción y Redes. Medios pierde «y
  radio» de su descripción. El catálogo `/panel/modulos` lo enseña solo.
- **Módulo `emisora`** («Radio en directo», `modulos.ts`), añadido al final del
  catálogo. Su config: `nombre` (≤60), `stream_url` (solo https, ≤500),
  `parrilla` (día, hora, programa ≤80, de qué va ≤140 opcional, minutos
  15–480; hasta 60) y `en_web`.
  Esquema y lectura en `src/lib/emisora/config.ts`; «ahora / luego» en
  `parrilla.ts`, en la hora de la iglesia y en minutos de la semana, así que un
  programa que cruza la medianoche del domingo sigue «en antena» el lunes.
- **`/panel/ministerios/[id]/emisora`**: layout con las dos puertas de turnos
  (`requireGestionMinisterio` + 404 con el módulo apagado), formulario con
  «Probar» que suena en el navegador de quien lo pulsa, parrilla en filas
  numeradas (sin JS para añadir filas: tres vacías de más cada vez) y la casilla
  de la web solo para el pastor. `guardarEmisora` copia `guardarPuestos`: lee y
  escribe la config en una transacción con `conConfigDeModulo`.
- **`/mi`**: `MiniReproductor` en el layout, una línea encima de la barra, solo
  si la iglesia tiene una radio encendida con señal. Pulsar el texto abre una
  hoja con la programación de la semana —con el tema de cada programa— y el
  aviso del servidor y los datos.
- **`/i/[slug]`**: bloque «Radio en directo» entre el devocional y los grupos,
  con su entrada en el menú, solo con `en_web` y la web publicada. Enseña qué
  suena, de qué va y lo que viene después, y la parrilla con sus temas.
- **Legales**: un párrafo en `/terminos` §3 (la iglesia responde de derechos y
  licencias; Hatril no emite, no retransmite ni graba, y puede retirar el
  enlace) y otro en `/privacidad` §5 (tercero elegido por la iglesia, posible
  fuera de la UE, nada se conecta antes de pulsar, sin registro de oyentes).

### Decisiones tomadas por el camino

- **Si alguien que no es el pastor cambia lo que se ve en la web, la radio sale
  de la web**: la señal, el nombre de la emisora, o cualquier programa con su
  tema y su duración. El pastor publicó ESO; otra señal u otro texto en nombre
  de la iglesia lo decide él otra vez. Se dice en la confirmación y en la
  propia pantalla. Al principio solo miraba la señal; la revisión vio que el
  tema, texto libre, podía publicar la fe o la salud de alguien sin que el
  pastor lo viera.
- **La señal se valida al guardar y al leer.** Sin CHECK en la base (no hay
  migraciones), `emisoraDeConfig()` vuelve a pasarla por el esquema antes de
  dársela a ningún `<audio>`.
- **Mensajes con nombre para lo que se pega de verdad**: http (no suena dentro
  de una web https), listas `.pls/.m3u`, HLS `.m3u8`, la ficha de zeno.fm,
  usuario y contraseña en la URL y direcciones de la red de casa.
- **Dos radios en una iglesia**: se usa la primera por orden. Sin selector, pero
  la pantalla de la que no suena lo dice, y su «Guardado» ya no promete que la
  congregación la oye.
- **Dos programas no se pueden pisar**, ni empezar a la vez: la action lo
  rechaza nombrando los dos. Una radio emite una cosa cada vez, y con un solape
  «ahora suena» quitaba uno a media emisión sin aviso.
- **Tope de 60 programas** (era 40), con aviso al llegar. Cada día de un
  programa diario gasta una fila; varios días por fila sería lo cómodo, y queda
  para cuando haga falta.
- **El tema es de cada programa, no de cada emisión.** «De qué va» es fijo
  semana a semana y viaja con la parrilla; el tema de UNA emisión por fecha
  necesita `turnos.tema` y sigue fuera. Una fila con solo el tema escrito no se
  descarta en silencio: la action dice qué le falta.
- **El botón de escuchar es el `secondary` del sistema (carbón)**, no naranja:
  `/mi` y la web ya tienen su acción principal. Va con el componente `Button`,
  así que no hay ningún color escrito a mano.

### Pasada visual (20-oct, a petición de Marlon)

Se compararon a 375 px con turnos (panel), la barra y el muro de `/mi` y los
horarios de la web pública, y se corrigió lo que no se parecía:

- Sin ningún hex ni `text-white` en lo de la radio: el bloque público pasó de
  un recuadro carbón con letra blanca —copiado de «Lo próximo», y dos bloques
  oscuros en la misma página competían— a una tarjeta blanca con borde.
- Sin animaciones: fuera el punto que latía al sonar y el icono girando al
  conectar; el estado lo dice el texto («Conectando con…», «Sonando en
  directo»).
- Sin el carácter ▶ en los textos, que en el iPhone se pinta como emoji: ahora
  es «darle a escuchar».
- Errores y confirmaciones del «Probar» con `Aviso`, con su icono, como el resto
  del panel. «Guardar la radio» se apaga mientras guarda.
- La parrilla del panel, como lista con separadores dentro de la tarjeta (el
  patrón de turnos) en vez de una caja de crema por fila. En el móvil el tema
  queda pegado al nombre y los minutos al final; en escritorio, una fila con
  día, hora, programa y minutos y el tema debajo.
- Textos de tú: «tu congregación», «tu emisora».
- **`VERSION_POLITICA_PRIVACIDAD` no se ha subido.** El párrafo nuevo describe
  a un tercero al que el miembro decide conectarse, no un uso nuevo de sus
  datos. El plan propone subirla una vez para toda la tanda; esa decisión es de
  Marlon.

---

## Qué se ha verificado ejecutándolo

`npx tsc --noEmit`, `npx eslint`, `npm run build` y `npm run test:aislamiento`,
los cuatro en verde. Al test se le ha añadido una comprobación: **anon no puede
leer `ministerios.modulos`**, que es lo que hace que la config de la emisora
solo salga por el `dbAdmin` del bloque público. Sin cambios en la base, así que
`get_advisors` no cambia (y el MCP de Supabase no tiene permiso desde aquí).

En el navegador, en `127.0.0.1:3002`, comprobando cada paso también en la base:

- **pastor@**: «Activar» en la tarjeta Radio de `/panel/modulos` crea el
  ministerio con `emisora`, `turnos` y `agenda` encendidos. En su pestaña
  «Radio en directo»: una dirección http se rechaza sin conectar; «Probar» con
  `https://ice1.somafm.com/groovesalad-128-mp3` (SomaFM, pública, https) suena,
  y «Parar» deja el `<audio>` sin `src` y con `networkState` 0. Guardar escribe
  la config tal cual con `activo` intacto. La página de zeno.fm la rechaza la
  action y la base no cambia.
- **miembro@ a 375 px**: el reproductor sale 6 px encima de la barra, sin `src`
  y con «Al pulsar ▶ te conectas a ice1.somafm.com». Al pulsar suena, la Media
  Session lleva el programa, la emisora y la iglesia, y la segunda línea pasa a
  «Luego: Palabra para hoy, a las 21:00». Sigue sonando al cambiar a Agenda
  (mismo elemento, el tiempo avanza). Parar vacía la descarga y limpia la Media
  Session; reanudar recarga el directo (el tiempo vuelve a cero). Pulsar ▶ no
  genera ninguna petición a nuestro servidor.
- **Web pública** a 375 px: el bloque con «ahora» y «luego», la parrilla con
  hoy marcado y sin desbordar.
- **colider@** (Sara, rol `miembro`, colíder de la radio): entra, ve la casilla
  de la web en solo lectura, y al cambiar la señal —con un `en_web=on` metido a
  mano en el formulario— la base queda con `en_web=false` y la web pública deja
  de enseñar la radio.
- **lider@** rebota de la radio ajena, y su Alabanza da 404 en `/emisora`.
  **pastor.sion@** no llega: su suscripción vencida le manda a `/suscripcion`
  antes. El aislamiento entre iglesias lo cubre el test.
- **El tema**: guardado desde el panel y comprobado en la base; sale debajo de
  cada programa en la hoja de `/mi` y en la web, y el de lo que suena, en la
  tarjeta de la web. Una fila con solo el tema da «Programa 4: Revisa la hora».
- Fallos del reproductor: una dirección que no es audio (example.com) da
  «No se ha podido conectar…», y un servidor que corta la conexión da «La
  emisora ha cortado la señal».

**No verificado**: escuchar con la pantalla bloqueada en un iPhone y en un
Android de verdad. Safari puede cortar el audio de una web en segundo plano; no
se promete en ninguna pantalla, y el comentario de `mini-reproductor.tsx` lo
dice. El segundo plano de verdad llega con Capacitor en la v2.

---

## Lo que falta, y por qué

- **El tema de cada emisión** (`turnos.tema`): necesita columna. Queda fuera.
- **CHECK de `stream_url` en la base**: migración. Hoy lo sostienen el Zod de
  la action y la validación al leer.
- **Planificar los turnos desde la parrilla** de la radio y no desde los cultos
  (`cultosParaPlanificar`), y «marcar todo este programa»: es código de turnos,
  de otra sesión. La parrilla ya se guarda con la forma de `HorarioSemanal`
  (`dia` como «Lunes», `hora`, `nombre`) para que `cultosEntre()` la lea tal
  cual.
- **`guardarPuestos` y `editarMinisterio`** leen y reescriben `modulos` sin
  bloquear la fila, el hueco que la revisión vio aquí. `guardarEmisora` ya
  bloquea (`for update`); esos dos son de otras sesiones.
- **Los `select` nativos de otras pantallas** (Finanzas, Devocionales,
  registro) siguen a 15 px en el móvil. Main arregló el `Input`; el de la radio
  se ha igualado a mano.

---

## Revisión del 20-oct y merge de main

Diez hallazgos, todos menores. Aplicados los diez:

1. **Carrera al guardar**: la lectura de `modulos` va con `for update`. Sin el
   bloqueo, un colíder guardando a la vez que el pastor sacaba la radio de la
   web volvía a publicarla con el dato viejo.
2. **Textos públicos de un no pastor**: ver «Decisiones». Se eligió sacar la
   radio de la web y no una instantánea aprobada aparte: es la misma regla que
   ya había para la señal y no hace falta otra copia de la config.
3. **Radio apagada al guardar**: lo para `exigirModulo()` (de main), que vuelve
   a la pantalla del equipo; y dentro de la transacción, con la fila
   bloqueada, se vuelve a mirar y también vuelve allí, no a la de la radio, que
   daría 404 y se tragaría el mensaje.
4. **Mensajes de la parrilla**: nombran el programa y el día («Nuevo
   (martes): revisa la hora»), o la fila del formulario si no tiene nombre. Antes
   el número salía del array sin las filas en blanco.
5. **Duplicados y solapes**: rechazados al guardar (`choqueEnParrilla`), y la
   clave de la lista lleva el índice.
6. **Tope**: 60 y aviso al llegar.
7. **Dos radios**: aviso en la pantalla de la que no suena.
8. **«Sale en la web» para quien no es pastor**: con las tres condiciones de
   `radioPublica()` —casilla, web publicada y señal—, y dice cuál falta.
9. **«El lunes» dicho un lunes**: ahora «el próximo lunes».
10. **16 px en el móvil**: main ya lo arregló en `Input`; el `select` del día
    llevaba `text-[15px]` a mano y se ha igualado (`text-[16px] md:text-[15px]`).

Verificado después del merge, en `radio.localhost:3002`, a 375 px:

- **colider@**: dos programas que se pisan dan «Alabanza de la tarde (lunes,
  19:00 – 21:00) se pisa con Palabra para hoy, que empieza el lunes a las
  20:00»; cambiar solo el tema de un programa guarda el tema y deja `en_web`
  en false en la base, con su aviso; con la radio apagada en la base mientras
  la pantalla estaba abierta, guardar lleva a la pantalla del equipo con «Esa
  herramienta no está encendida en este ministerio».
- **miembro@** en `/mi`: escucha FIP, Media Session en «playing», y al parar
  `src` vacío y `networkState` 0.
- **pastor@** en el panel: los cinco campos de cada fila miden 16 px en el
  móvil (`getComputedStyle`), y «Probar» suena con su `Aviso`.

Del merge: un solo conflicto, en `modulos.ts`, porque reparto y emisora se
añadieron los dos al final. `guardarEmisora` llama ya a `exigirModulo()`.

---

## Datos de prueba

`scripts/seed-radio.sql`, idempotente y con la limpieza al final: en Betania un
ministerio Radio con la señal de FIP (Radio France), tres programas (dos con tema y uno
sin él), `en_web` marcado, y Sara (colider@) como colíder. El ministerio de esta prueba se creó desde
`/panel/modulos`; el seed lo encuentra por tipo y no crea otro.

---

## Trampas que han costado tiempo

- **Las cookies de `localhost` se comparten entre sesiones.** El navegador
  integrado es el mismo para todas y las cookies no distinguen puerto: otra
  sesión entró como lider@ entre mi `navigate` como pastor@ y el clic, y la
  action contestó «No tienes permiso». Primero se pasó a `127.0.0.1`, que
  tiene su propio tarro, hasta que otra sesión empezó a usarlo también y
  volvió a pasar lo mismo. Lo que aguanta es un nombre propio:
  `radio.localhost` (todo `*.localhost` resuelve a loopback y la herramienta
  del navegador lo admite; `127.0.0.2` no). Ojo: `/auth/confirm` sigue
  redirigiendo a `localhost:<puerto>` porque Next arma `request.url` con
  `localhost`, pero la cookie queda en el host del enlace; hay que navegar a
  mano después de canjearlo. Y si el enlace dice «caducado», es que se canjeó
  dos veces: se pide otro.
- **El pooler de Supabase se satura** con cuatro o cinco servidores de
  desarrollo a la vez: `EMAXCONNSESSION … pool_size: 15`, que sale como un 500
  en cualquier pantalla. `client.ts` ya va con `prepare: false`, así que en el
  `.env.local` de este worktree se cambió el puerto a 6543 (modo transacción).
  No se commitea.
- **SomaFM corta a quien conecta mucho.** A los pocos días de pruebas empezó a
  redirigir esta IP a `somafm.com/alert.mp3`, también la ruta buena. Es lo que
  pasaba con «cualquier ruta suena treinta segundos»: era ese aviso. El seed
  usa ahora FIP de Radio France (`icecast.radiofrance.fr/fip-midfi.mp3`). Para
  probar un fallo de verdad, `example.com/x.mp3`.
- **Dos fallos del reproductor que solo salieron así**: el tope de 20 s miraba
  `a.paused`, que vale `false` en cuanto se llama a `play()` aunque no suene
  nada, y no saltaba nunca; y cuando el servidor corta, Chrome manda `pause`
  antes de `ended`, y se trataba como una pausa del usuario. Los dos están
  arreglados y comentados en `use-senal.ts`.
- `tsc` en un worktree recién montado falla con `comunidad.avif`: falta
  `next-env.d.ts`, que crea `next dev`. No es del código.
- **No lanzar `next build` ni `tsc` con el servidor de desarrollo arrancando
  a la vez.** Comparten `.next`: el build dejó el servidor contestando 404 a
  todo, también a `/panel`, y `tsc` leyó `.next/dev/types/routes.d.ts` a medio
  escribir y dio decenas de errores que no eran del código. Primero las
  comprobaciones, después el servidor.
