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
  `parrilla` (día, hora, programa ≤80, minutos 15–480; hasta 40) y `en_web`.
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
  hoja con la programación de la semana y el aviso del servidor y los datos.
- **`/i/[slug]`**: bloque «Radio en directo» entre el devocional y los grupos,
  con su entrada en el menú, solo con `en_web` y la web publicada.
- **Legales**: un párrafo en `/terminos` §3 (la iglesia responde de derechos y
  licencias; Hatril no emite, no retransmite ni graba, y puede retirar el
  enlace) y otro en `/privacidad` §5 (tercero elegido por la iglesia, posible
  fuera de la UE, nada se conecta antes de pulsar, sin registro de oyentes).

### Decisiones tomadas por el camino

- **Si alguien que no es el pastor cambia la señal, la radio sale de la web.**
  El pastor publicó ESA señal; otra distinta en nombre de la iglesia la decide
  él otra vez. Se le dice en la confirmación y en la propia pantalla.
- **La señal se valida al guardar y al leer.** Sin CHECK en la base (no hay
  migraciones), `emisoraDeConfig()` vuelve a pasarla por el esquema antes de
  dársela a ningún `<audio>`.
- **Mensajes con nombre para lo que se pega de verdad**: http (no suena dentro
  de una web https), listas `.pls/.m3u`, HLS `.m3u8`, la ficha de zeno.fm,
  usuario y contraseña en la URL y direcciones de la red de casa.
- **Dos radios en una iglesia**: se usa la primera por orden. Sin selector.
- **El botón ▶ es carbón, no naranja**: `/mi` y la web ya tienen su naranja.
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
- **`exigirModulo()`**: `guardarEmisora` comprueba `tieneModulo` a mano y lo
  dice en un comentario; pasa a la guarda común al fusionar la tanda 1.
- El comentario de cabecera de `modulos.ts` dice «Cuatro módulos»: ya son
  cinco aquí, y más con las otras ramas. Corregirlo al fusionar todas, no en
  cada una.

---

## Datos de prueba

`scripts/seed-radio.sql`, idempotente y con la limpieza al final: en Betania un
ministerio Radio con la señal de SomaFM, tres programas, `en_web` marcado, y
Sara (colider@) como colíder. El ministerio de esta prueba se creó desde
`/panel/modulos`; el seed lo encuentra por tipo y no crea otro.

---

## Trampas que han costado tiempo

- **Las cookies de `localhost` se comparten entre sesiones.** El navegador
  integrado es el mismo para todas y las cookies no distinguen puerto: otra
  sesión entró como lider@ entre mi `navigate` como pastor@ y el clic, y la
  action contestó «No tienes permiso». Se arregla sirviendo en `127.0.0.1`
  (`-H 127.0.0.1`), que tiene su propio tarro. Ojo: `/auth/confirm` sigue
  redirigiendo a `localhost:<puerto>` porque Next arma `request.url` con
  `localhost`, pero la cookie queda en `127.0.0.1`; hay que navegar a mano
  después de canjear el enlace.
- **El pooler de Supabase se satura** con cuatro o cinco servidores de
  desarrollo a la vez: `EMAXCONNSESSION … pool_size: 15`, que sale como un 500
  en cualquier pantalla. `client.ts` ya va con `prepare: false`, así que en el
  `.env.local` de este worktree se cambió el puerto a 6543 (modo transacción).
  No se commitea.
- **SomaFM responde a cualquier ruta.** `ice1.somafm.com/loquesea` suena unos
  treinta segundos y corta: no sirve para probar un fallo. `example.com/x.mp3`
  sí.
- **Dos fallos del reproductor que solo salieron así**: el tope de 20 s miraba
  `a.paused`, que vale `false` en cuanto se llama a `play()` aunque no suene
  nada, y no saltaba nunca; y cuando el servidor corta, Chrome manda `pause`
  antes de `ended`, y se trataba como una pausa del usuario. Los dos están
  arreglados y comentados en `use-senal.ts`.
- `tsc` en un worktree recién montado falla con `comunidad.avif`: falta
  `next-env.d.ts`, que crea `next dev`. No es del código.
