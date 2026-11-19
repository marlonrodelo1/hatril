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
