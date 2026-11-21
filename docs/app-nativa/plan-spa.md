# La app empaquetada (SPA) — plan

**Aprobado por Marlon el 19-nov-2026**, con las cuatro decisiones del final
tal como están. No hay nada construido todavía.

Hoy la app es un WebView que carga https://hatril.com (`server.url` en
`capacitor.config.ts`). Pasa a ser como Pidoo (`pido-app`) y Gonper socio: las
pantallas van dentro del binario (`webDir`) y solo los datos viajan por la red.

## Lo que arregla y lo que no

- **Arregla**: cambiar de pestaña deja de esperar al servidor para pintar. La
  pantalla sale al instante y, si ya se había visitado, con sus datos.
- **No arregla solo**: la primera vez que se abre una pantalla, los datos
  siguen tardando lo que tarde el servidor (hoy unos 315 ms por cada `withUser`
  y 174 ms por cada `getUser`). Por eso la fase 0 reduce eso a una sola
  transacción por pantalla. Esa mejora también le sirve a la web.

---

## 1. Alcance

**Recomendación: la app del miembro entera, y nada del panel.**

| Va dentro de la app | Se queda en la web |
|---|---|
| `/bienvenida`, `/empezar`, `/buscar` (+ `ciudad`, `cerca`) | `/panel/*` |
| La ficha del directorio `/iglesia/[slug]` y `/solicitar/[slug]` | La web de cada iglesia `/i/[slug]` (y su `/dar`) |
| `/acceso`, `/crear-cuenta`, `/recuperar` (pedir el correo) | `/registro`, `/suscripcion` (Stripe) |
| La sala de espera (`/mi` sin iglesia) | `/admin`, legales, `/reset-password`, `/auth/*` |
| `/mi/*`: comunidad, devocional, agenda, Biblia, avisos, cuenta y equipo | |

- **Las mismas rutas que la web.** `/mi/comunidad` en la app es
  `/mi/comunidad`. Así el `enlace` de los avisos y de las push vale sin
  traducir nada.
- **El pastor y la secretaria** ven en la app su área de miembro y un botón
  «Abrir el panel», que abre hatril.com/panel en el navegador del teléfono.
  Hoy el WebView les mete el panel dentro. Sacarlo quita además uno de los
  bloqueos de Apple de `fichas.md` §1: el pago de Stripe al alcance dentro de
  la app.
- **A la tienda solo con paridad** (al acabar la fase 4). Antes, TestFlight
  interno y el emulador. Publicar sin la pestaña Equipo sería quitarles a los
  líderes herramientas que hoy ya tienen.

## 2. Cómo llegan los datos sin romper la seguridad

**Recomendación: el teléfono nunca lee la base. Todo pasa por una API JSON en
hatril.com que aplica las mismas guardas y el mismo `withUser()` que la web.**

- **Supabase desde el teléfono, solo para la sesión**: entrar, refrescar el
  token y salir, con la clave publicable que ya viaja hoy en el JavaScript de
  la web. Ni una consulta a PostgREST. **No se tocan policies, ni grants, ni
  `hatril_app`, ni `authenticated`.**
- **Los datos**, en `/api/v1/app/*` (route handlers de Next), con la sesión en
  `Authorization: Bearer <token de Supabase>`.
- **El token se lee en UN sitio**: `usuarioActual()` (`src/lib/auth/usuario.ts`,
  hoy sin commit, de otra sesión). Si llega la cabecera, valida ese token; si
  no, la cookie, como ahora. De ahí para abajo —`getCurrentUserContext`,
  `requireIglesia`, `requireMinisterioEnLaApp`, `withUser`— es el mismo código
  que la web. Gonper hizo un contexto gemelo (`salon-bearer.ts`); aquí no,
  porque dos contextos acaban divergiendo y la puerta que diverge es la que
  deja pasar.
- **Un envoltorio obligatorio**, `rutaApp(guarda, manejador)` en
  `src/lib/api/app.ts`. Sin guarda no compila. Hace cuatro cosas:
  1. CORS con lista cerrada: `capacitor://localhost` (iOS), `https://localhost`
     (Android) y el puerto de Vite solo en desarrollo.
  2. Ejecuta la misma guarda que la página web equivalente y convierte su
     `redirect()` o `notFound()` en JSON `{error, ir}` con 401, 403 o 404. Es
     el truco que ya usa `enLaApp()` con `isRedirectError`. Así la lista de
     quién entra dónde sigue siendo UNA.
  3. Zod con `safeParse`, error como `{error, detalles}`.
  4. `Cache-Control: no-store`.
- **Las escrituras no copian lógica.** Cada server action de `/mi` se parte en
  dos: la lógica baja a `src/lib/<dominio>/`, y la action y el endpoint la
  llaman. Es la regla 2 del README de Gonper socio.
- **Sin CSRF nuevo**: el Bearer no viaja solo como una cookie.
- **La sesión en el teléfono** la guarda supabase-js en el almacenamiento del
  WebView, dentro del espacio aislado de la app. Es el mismo nivel que las
  cookies del WebView de hoy: no empeora nada.
- **Binarios viejos**: una versión instalada vive meses. Un endpoint publicado
  solo crece (se añaden campos, no se quitan). Si hay que romper, `/api/v2/app`.
  Y `/api/v1/app/version` dice la versión mínima: por debajo, la app pide
  actualizar.
- **Se prueba con `npm run test:puertas:app`** (nuevo): las ocho cuentas de
  prueba contra cada endpoint con su token. Un endpoint que no esté en la lista
  lo hace fallar, como ya hace `test:puertas` con las páginas. Además,
  `test:aislamiento` y `get_advisors` sin ningún WARN, aunque la base no cambie.

## 3. Pila de la app

**Recomendación: React 19 + Vite + React Router 7, en TypeScript estricto y
dentro de este repo.**

- **TypeScript estricto.** Pidoo está en JavaScript; aquí no se baja el listón.
- **En este repo, carpeta `movil/`**, con un solo `package.json`. Un solo
  React para los dos lados: con dos versiones, los componentes compartidos se
  rompen. Además Android, iOS y `capacitor.config.ts` ya viven aquí.
- **El contrato, compartido.** Los esquemas Zod de cada endpoint van en
  `src/lib/app-api/` y los importan el servidor y la app. Si el servidor cambia
  un campo, la app no compila.
- **Estilo**: Tailwind 4 con el mismo `globals.css` (tokens, paleta crema y
  naranja quemado). Plus Jakarta Sans va dentro del binario, para que se vea
  igual sin red.
- **Componentes**: los de `src/components/ui/*` que no dependen de Next se
  importan tal cual. Los que usan `next/link` (`boton-enlace`) llevan un
  adaptador. De los 63 ficheros de `/mi`, los 21 de cliente se reaprovechan;
  los 42 de servidor se reescriben para pedir sus datos a la API.
- **Datos**: TanStack Query con caché **solo en memoria**. Volver a una
  pestaña pinta lo último al instante y lo refresca por detrás. Al abrir la
  app se precargan las cuatro pestañas. **Nada se guarda en disco**: son datos
  del art. 9 y al salir tienen que desaparecer.

## 4. Lo nativo que ya existe

**Recomendación: no tocar nada nativo, salvo lo que solo servía al WebView.**

| Pieza | Qué cambia |
|---|---|
| **Push** (`@capacitor-firebase/messaging`, `AppDelegate`, `google-services.json`, el plist, el canal `avisos`) | Nada nativo. `push-nativo.tsx` pasa a la app. `registrarDispositivo` (action + cookie `hatril_push`) pasa a `POST /api/v1/app/push`. Al salir, la app borra su token con `DELETE` antes de cerrar la sesión, que hoy hace `salir()` leyendo la cookie. Tocar una push sigue llevando a su `enlace` |
| **Apple y Google** (`@capgo/capacitor-social-login` 8.7.6, `src/lib/auth/google.ts`) | Nada nativo. `entrarConToken` pasa a `signInWithIdToken` desde el teléfono. **Ojo**: Apple da el nombre solo la primera vez. Se manda a la API en el mismo paso (reusa `asegurarNombre`), o se pierde para siempre |
| **«Dar» en Safari** (norma 3.2.2, `enlace-a-dar.tsx`) | `isNativeApp()` leía el User-Agent en el servidor. Pasa a `Capacitor.getPlatform()` en el teléfono, y el enlace se abre fuera con `@capacitor/browser` |
| **Atrás de Android, barra de estado y arranque** (`app-nativa.tsx`) | Pasa a la raíz de la app. Atrás mira el historial de React Router y no el del WebView. El arranque se esconde al montar, sin esperar a la red |
| **Lo que solo servía al WebView** | Se va: `server.url`, `appStartPath`, `allowNavigation`, `errorPath`, `app-shell/` con `sin-conexion.html` y `appendUserAgent`. `CAP_SERVER_URL` pasa a ser la dirección de la API, con la misma exigencia de https y la marca de PRUEBA para traefik.me (`scripts/app/*.mjs`). Revisar `MainActivity.java`, que abre la página de error cuando falla el certificado |
| **Ubicación** («cerca de mí») | Sigue pendiente `NSLocationWhenInUseUsageDescription` en el `Info.plist`, como hoy |

## 5. Fases

Cada fase acaba en algo que se usa. **A la tienda solo al final.**

| Fase | Qué | Al acabar se puede | Esfuerzo |
|---|---|---|---|
| **0. La puerta** | `usuarioActual()` con Bearer, `rutaApp()`, `/api/v1/app/yo` (quién soy, iglesia, pestañas, radio, a dónde va), `test:puertas:app`. Medir cada pantalla con `Server-Timing` y dejarla en una sola transacción `withUser` | Pedir los datos de cualquier cuenta de prueba con su token, y ver que el miembro raso no saca nada del panel | 3–4 días |
| **1. Esqueleto y acceso** | `movil/` con Vite, rutas y tokens. Bienvenida, empezar, buscar, ficha, solicitar, acceso (contraseña, Google, Apple), crear cuenta, recuperar, sala de espera y salir. Push, atrás y barra de estado | Descargar, buscar iglesia, pedir entrar, entrar y recibir push | 1,5 semanas |
| **2. Lo de cada semana** | Comunidad (publicar con fotos, me gusta, comentarios, denunciar, bloquear, la cola de denuncias), devocional, agenda (turno, reunión, responder), avisos, la barra y el reproductor de la radio | Usar la app un domingo entero como miembro | 2 semanas |
| **3. Cuenta y Biblia** | Mi cuenta (foto, asistencia, letra), bloqueados, borrar la cuenta, donativos (fuera, en iOS) y Biblia | **Paridad para el miembro raso** | 1 semana |
| **4. Equipo** | Las 14 pantallas de `/mi/equipo`. Las actions de `enLaApp()` bajan a `src/lib` | **Paridad total** con el build de hoy | 1,5–2 semanas |
| **5. Tienda** | Un build nuevo de iOS y otro de Android, TestFlight interno, notas para la revisión | Enviar a Apple y a Google | 3–4 días + la revisión |

**Total: unas 8 semanas de trabajo.**

### Cómo se prueba cada fase

1. **Siempre**: typecheck, lint, `test:puertas:app`, `test:aislamiento`, y
   **abrir la pantalla y pulsar el botón** con las cuentas de prueba. Un verde
   no vale sin eso.
2. **Rápido, en Windows**: la app en Chrome a 375 px contra el Next local.
   Ahí se prueba casi todo.
3. **Android**: el emulador Pixel 6, con `npm run app:android`.
4. **iOS**: una vez por fase en el Mac, `git pull` + `npm run app:ios` + el
   simulador (`ios.md` §5).
5. **Push, Apple y Google**: solo en un teléfono de verdad, al final de la
   fase 1 y otra vez en la 5.

Mientras tanto, el build 3 sigue en TestFlight para probar push y Apple y
Google. Lo que se aprenda ahí vale igual para la app nueva.

## 6. Riesgos

| Riesgo | Qué se hace |
|---|---|
| **Una puerta nueva donde olvidar la guarda** | `rutaApp()` no compila sin guarda, y `test:puertas:app` falla con un endpoint que no esté en su lista |
| **Dos áreas del miembro, la web y la app**: cada cosa nueva, dos veces | Mientras dure la obra, **nada nuevo en la web `/mi`**, solo arreglos. La lógica, en `src/lib`. Con la paridad, decidir si la web `/mi` pasa a ser esta misma app: Pidoo sirve la suya también como web |
| **La primera carga sigue dependiendo del servidor** | La fase 0 lo baja a una transacción por pantalla. Caché en memoria y precarga de las pestañas |
| **Un fallo en el binario no se arregla desplegando** | TestFlight interno antes de cada envío. Versión mínima en la API para obligar a actualizar |
| **Binarios viejos vivos** | La API solo crece; si hay que romper, `/api/v2/app` |
| **Apple revisa cada cambio** (1–3 días) | Se asume. A cambio, deja de ser «una web dentro de una app» (norma 4.2, el motivo más probable de rechazo) y el panel con Stripe sale del binario |
| **Otras sesiones tocando `/mi`** | Lo mismo que arriba: nada nuevo en `/mi` web. La app vive en `movil/`, una carpeta que no toca nadie más |
| **`cache()` de React quizá no memoiza en un route handler**, y cada guarda repetiría las consultas | Se mide en la fase 0. Si no memoiza, el contexto se pasa a mano |
| **iOS depende del Mac** | Una compilación por fase, no por pantalla |

---

## Decisiones que necesito de ti

1. **Alcance**: la app del miembro entera, equipo incluido, y el panel fuera
   (con el botón «Abrir el panel» en el navegador). **Recomiendo sí.**
2. **A la tienda solo con paridad** (fin de la fase 4, unas 8 semanas).
   **Recomiendo sí**: publicar antes les quitaría herramientas a los líderes.
3. **Nada nuevo en la web `/mi` mientras dure la obra**, solo arreglos.
   **Recomiendo sí**: si no, la app persigue algo que se mueve.
4. **La app dentro de este repo** (`movil/`), no en uno aparte como Pidoo.
   **Recomiendo sí**: comparte el contrato de la API, los componentes y los
   tokens.

---

## Avance

### Fase 0 — hecha (20-nov)

- `usuarioActual()` (`src/lib/auth/usuario.ts`) entiende `Authorization:
  Bearer`. Todo lo de debajo es el mismo código para la web y la app.
- `endpointApp()` (`src/lib/api/app.ts`): la guarda es obligatoria, los
  `redirect()`/`notFound()` de las guardas de la web salen como JSON
  `{error, ir}`, y el CORS (`src/lib/api/cors-app.ts`) solo deja leer a los
  orígenes de la app. El `OPTIONS` previo lo contesta `src/proxy.ts`.
- **`cache()` de React no memoiza en un route handler** (medido: tres
  llamadas, tres ejecuciones). Lo arregla `cachePorPeticion`
  (`src/lib/peticion.ts`), que además apunta tramos en `Server-Timing`.
- `withUser()` hace un viaje menos: el claim y el rol en una sola sentencia,
  como PostgREST. Unos 85 ms menos por consulta, también en la web.
  `test:aislamiento`: 278 comprobaciones en verde, incluida la que mira que
  entra como `hatril_app`.
- `npm run test:puertas:app`: 41 casos. Falla si aparece un endpoint que no
  esté en su lista.

### Fase 1 — en curso

Hecho, y probado en Chrome a 375 px contra el Next local:

- La SPA en `movil/` (Vite 8, React Router 7, React Query solo en memoria),
  con los estilos de la web (`globals.css`) y Plus Jakarta Sans dentro.
  `next/link` y `next/navigation` se sustituyen por los de React Router, así
  que los componentes de la web se usan sin tocarlos.
- Arranque, acceso con contraseña (Apple y Google, listos para el teléfono),
  salir, sala de espera, bienvenida, empezar, buscar (con sugerencias), por
  ciudad, cerca de mí, la ficha de la iglesia y «Pedir unirme», crear cuenta y
  recuperar la contraseña.
- Las pantallas de la web que comparten con la app se partieron en vista y
  datos (`vista-ficha`, `vista-empezar`, `vista-buscar`, `vista-ciudad`), y la
  lógica de crear cuenta y pedir entrar bajó a `src/lib/solicitudes/alta.ts`.
- `capacitor.config.ts` ya apunta a `movil/dist`. `npm run app:android` /
  `app:ios` compilan la SPA contra `CAP_SERVER_URL` y comprueban la copia
  (`scripts/app/compilar-movil.mjs`). Fuera `app-shell/` y `destino.mjs`.

Y en el emulador (Pixel 6, versión de depuración, 20-nov): la app arranca
desde dentro del binario, con el arranque, la barra de estado de iconos
oscuros, la presentación, «Empezar» y el buscador; el botón atrás vuelve por
el historial; Firebase da su token; la letra se sirve desde el teléfono. Una
vez el emulador se quedó sin memoria y Android cerró la app
(`lowmemorykiller`): no era un fallo de la app.

### Fases 2, 3 y 4 — construidas (20-nov)

Todas las pantallas del miembro están en la app: comunidad (con la cola de
denuncias y «denuncia enviada»), devocional, agenda (con turno y ensayo),
avisos, `/acepta`, `/cuenta-en-baja`, Mi cuenta (bloqueados, borrar la
cuenta, «Lo que he dado»), la Biblia y las quince de Equipo. Ya no queda
ninguna «en construcción».

Cómo, sin copiar la web:

- **Las vistas, compartidas.** Cada página de `/mi` se partió en vista (lo que
  pinta) y datos (lo que consulta). La web pinta la vista con su
  `CabeceraMiembro`; la app, con la suya. En Equipo, la carga de cada pantalla
  vive en su `datos.ts` (`cargar`), con su guarda, y la usan la página y la
  API.
- **Las actions, las mismas.** `POST /api/v1/app/accion` ejecuta las server
  actions de la web, solo las de la lista cerrada de
  `src/lib/api/acciones-app.ts`. En la app, cada módulo de actions se
  sustituye al compilar por llamadas a ese endpoint (plugin de
  `movil/vite.config.ts`). Una action ya es un endpoint público con su guarda
  dentro: esto no abre nada.
- **Equipo, una sola ruta** (`/api/v1/app/mi/equipo/*`) con la tabla cerrada
  de `src/lib/app-api/equipo.ts`. El `ctx` que sale va recortado
  (`ctxParaLaApp`): ni el usuario entero de Supabase ni el plan.
- La cabecera y «Dar» de la web, que consultan en el servidor, se sustituyen
  en la app por las suyas al compilar.
- Vite se niega a compilar si una vista alcanza un módulo `server-only`: es la
  red que caza cuando algo del servidor se cuela en el teléfono.

Probado: `test:puertas:app` con **92 casos en verde** (entre ellos, que el
pastor de Sion no abre ni un turno ni un ensayo de Betania, que quien no
modera no ve la cola de denuncias y que la lista de actions es cerrada),
`test:aislamiento` en verde, la app de producción compila y su paquete no
lleva nada secreto. En Chrome a 375 px, como `miembro@`: comunidad,
devocional, agenda, avisos y Mi cuenta. Las páginas de la web, después de
partirlas, cargadas una a una como `miembro@` y `lider@`.

**Sin probar, por la suscripción de Betania**: la prueba de la iglesia de
demostración caducó el 15-nov, y con ella bloqueada las guardas cortan las
escrituras (publicar, me gusta, responder un turno) y las pantallas de
Equipo, en la web igual que en la app. Se vio que la action llega y que su
guarda la para; no se ha visto escribir.

### El binario contra hatril.com — probado (20-nov)

En el emulador (Pixel 6, versión de depuración compilada contra
https://hatril.com): bienvenida, buscar con sugerencias, la ficha de Betania,
entrar con contraseña como `miembro@`, el permiso de notificaciones y el token
apuntado en `dispositivos_push`, comunidad, devocional, agenda, Biblia (libro,
capítulos y texto), la campana, Mi cuenta, «Personas bloqueadas» y la pantalla
de borrar la cuenta (sin borrar). La sesión aguanta reinstalar la app. Equipo
dice «suscripción en pausa», como debe mientras Betania siga bloqueada.

Dos fallos de la app, arreglados en el momento:

- **No había camino a Mi cuenta.** El menú del avatar solo traía «Cerrar
  sesión», y Mi cuenta es la única puerta a borrar la cuenta, que Apple exige
  dentro de la app (5.1.1(v)). Ahora lleva «Mi cuenta».
- **Cada pantalla se abría con el scroll de la anterior.** Faltaba
  `ScrollRestoration` en `raiz.tsx`; el `scroll={false}` de Next se traduce a
  `preventScrollReset` en los shims.

Y uno de la web, **arreglado en el código pero sin probar en el navegador**:
al miembro raso, «Tus datos» y «Cambiar la contraseña» del menú le llevaban a
`/panel/cuenta`, y la guarda del panel le devolvía a `/mi`. En la web tampoco
tenía camino a Mi cuenta ni a borrar la cuenta desde que la barra de abajo
perdió su pestaña (agosto). Ahora el menú del área del miembro lleva «Mi
cuenta» (prop `miCuenta` de `MenuCuenta`).

Betania, la iglesia de todo lo anterior, **se borró el mismo 20-nov**. Las
pruebas automáticas montan ahora sus propias iglesias
(`scripts/pruebas/demo.mjs`).

Falta:

- ~~Desplegar la API en hatril.com~~: hecho el 20-nov (`4a55a8f`). Responde,
  el CORS deja pasar a `https://localhost` y a nadie más, y sin sesión da 401.
- Probar las escrituras y Equipo de punta a punta, ahora en Cuerpo de Cristo.
- Abrir el menú de la web con una cuenta de Cuerpo de Cristo y ver que llega a
  Mi cuenta.
- Probar en el emulador y en el iPhone con la API desplegada, y push, Apple y
  Google en un teléfono de verdad.
- La fase 5: un build nuevo de iOS y de Android, TestFlight interno y las
  notas para la revisión.
