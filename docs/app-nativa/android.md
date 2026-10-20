# Android: compilar el .aab y subirlo a Google Play

iOS está en [`ios.md`](ios.md). Lo que pide la ficha de Google Play, con las
respuestas, en [`fichas.md`](fichas.md). **Aquí no va ningún secreto.**

---

## Lo que ya está hecho

- `android/`: el proyecto, con `app.hatril`, versión **1.0.0** y versionCode
  **1**, objetivo Android 16 (API 36, lo que pide Google Play).
- La firma de subida, **fuera del repo**, en el Windows:
  `Versiones/Android/firma/hatril-upload.jks`, con su contraseña en
  `CLAVES.txt` al lado. `android/keystore.properties` apunta a ella y tampoco
  va a GitHub.
- La huella SHA-256 de ese certificado, que es pública y sirve para comprobar
  que Google tiene la buena:
  `9A:8B:E1:C6:18:39:B0:BE:BD:EB:D7:6D:48:FE:D5:66:72:00:6A:EE:D4:40:68:9F:AF:3D:4B:48:7E:B6:F6:4D`
- `Versiones/Android/Hatril-1.0.0-1.aab` y `.apk`: compilados contra
  **https://hatril.com** el 20-oct-2026, firmados y comprobados. El `.aab`
  es el que se sube.
- Sin copia de seguridad en Google Drive (`android:allowBackup="false"`):
  iría con ella la cookie de sesión del WebView. El porqué, en
  `AndroidManifest.xml`.
- `Versiones/Android/icono-play-512.png`: el icono de la ficha.
- `Versiones/Android/pruebas/`: las capturas del emulador de esa compilación
  y de la de depuración (sección 4).

**Haz una copia de `Versiones/Android/firma/` fuera de este ordenador** (un
pendrive, un gestor de contraseñas). Si se pierde, hay que pedir a Google que
cambie la clave de subida, y mientras tanto no se puede publicar nada.

---

## 1. Compilar el .aab

Contra el dominio definitivo, https://hatril.com. En PowerShell, en la
carpeta del repo:

```powershell
$env:CAP_SERVER_URL='https://hatril.com'
```

```powershell
npm run app:android
```

En bash (Git Bash, Mac, Linux), lo mismo en una línea:

```bash
CAP_SERVER_URL=https://hatril.com npm run app:android
```

Deja, firmados y comprobados (`jarsigner -verify` y `apksigner verify`):

- `Versiones/Android/Hatril-1.0.0-1.aab`: el que se sube a Google Play.
- `Versiones/Android/Hatril-1.0.0-1.apk`: para instalar a mano en un teléfono.

Si el nombre lleva `-PRUEBA`, la dirección era la de traefik.me.

**La app carga la web desplegada**, así que lo que se ve dentro es lo que haya
en hatril.com en ese momento. Antes de probarla en un teléfono, despliega la
web con `src/components/app-nativa.tsx`: sin él, atrás en la primera pantalla
no hace nada (sección 4) y el arranque tarda sus 2,5 s enteros en irse.

El script se niega si falta la dirección o no es https, si falta la firma, o
si la versión de `capacitor.config.ts` no coincide con la de
`android/app/build.gradle`. Usa el Java de Android Studio.

**En otro ordenador**: instalar Android Studio, copiar `Versiones/Android/firma/`
al mismo sitio y crear `android/keystore.properties` con estas cuatro líneas,
poniendo en las dos contraseñas la de `CLAVES.txt`:

```properties
storeFile=../Versiones/Android/firma/hatril-upload.jks
storePassword=LA_DE_CLAVES_TXT
keyAlias=hatril-upload
keyPassword=LA_DE_CLAVES_TXT
```

---

## 2. El número, antes de cada subida

Google Play rechaza un versionCode que ya recibió. **Antes de cada subida**:

```bash
npm run app:version -- build android
```

Sube el versionCode en uno. Con `build` a secas sube también el de iOS. Con
una versión nueva, `npm run app:version -- 1.0.1`, cambia la visible en los
tres sitios (capacitor.config.ts, Android e iOS) y sube los dos builds. Sin
nada, enseña los números y dice si cuadran.

Después, commit, y otra vez la sección 1.

El primer envío puede ir con el 1: el `-PRUEBA` nunca llegó a Google.

---

## 3. Google Play Console, la primera vez

Los botones van en inglés, como salen con la consola en inglés. En español
están en el mismo sitio.

### La cuenta

1. Entra en https://play.google.com/console y crea la cuenta de desarrollador
   (25 USD, una vez). Pide verificar la identidad.
2. **Cuenta personal o de organización**: una cuenta **personal** creada después
   del 13 de noviembre de 2023 no puede publicar en producción hasta hacer una
   **prueba cerrada con al menos 12 personas durante 14 días seguidos** (lo dice
   la ayuda de Play Console). La de organización no tiene esa espera, pero pide
   un número D-U-N-S. Hay que decidirlo antes de crearla.

### Crear la app

1. **Home → Create app**.
2. App name: `Hatril`.
3. Default language: **Spanish (Spain) – es-ES**.
4. App or game: **App**. Free or paid: **Free**.
5. Marca las dos declaraciones y pulsa **Create app**.

### Rellenar lo obligatorio

En el **Dashboard** sale la lista *Set up your app*. Cada tarea lleva a su
formulario; las respuestas para Hatril están en [`fichas.md`](fichas.md):

- **Privacy policy**, **App access**, **Ads**, **Content rating**, **Target
  audience**, **Data safety**, **Government apps**, **Financial features**,
  **Health**: en **Policy and programs → App content**.
- **Store listing**: nombre, descripciones, icono 512
  (`Versiones/Android/icono-play-512.png`), gráfico de 1024×500 y capturas.

### Primera subida: prueba interna

La prueba interna llega a los teléfonos en minutos y sin la revisión completa.
Es lo primero, antes que nada público.

1. **Test and release → Testing → Internal testing**.
2. Pestaña **Testers** → **Create email list**. Nombre: `Equipo`. Añade los
   correos (de Google) de quien vaya a probar. **Save changes**.
3. Pestaña **Releases** → **Create new release**.
4. Si pregunta por la firma (*Play App Signing*): deja la opción por defecto,
   **la clave la genera y guarda Google**. Nuestro `.jks` es solo la clave de
   *subida*.
5. Arrastra `Versiones/Android/Hatril-1.0.0-1.aab`.
6. Release notes: `Primera versión.`
7. **Next** → **Save and publish**.
8. En **Testers**, copia el enlace **Join on the web** y ábrelo en el teléfono
   con una de esas cuentas de Google.

### Comprobar que Google tiene la clave buena

1. **Test and release → App integrity**.
2. En **Play app signing**, pulsa **Settings**.
3. **Upload key certificate → SHA-256** tiene que ser la huella de arriba.

### Prueba cerrada (solo si la cuenta es personal)

1. **Test and release → Testing → Closed testing**.
2. Crea la pista, añade una lista de correos con **al menos 12 personas**, y
   sube el mismo `.aab` (desde **Add from library**, sin volver a compilar).
3. Cada una tiene que entrar por el enlace y aceptar. **14 días seguidos** con
   12 dentro. Mejor 15 o 20, por si alguien se sale.
4. Pasados, en el **Dashboard**: **Apply for production**.

### Producción

1. **Test and release → Production**.
2. Pestaña **Countries / regions** → **Add countries / regions**: Colombia y
   España.
3. **Create new release** → **Add from library** → el `.aab` ya probado.
4. **Next** → **Save** → **Go to overview** → **Send changes for review**.

La primera revisión de una app nueva puede tardar varios días.

---

## 4. Cómo carga la web: redirecciones, atrás y sin conexión

Probado el 20-oct-2026 en el emulador (Pixel 6, Android 17, WebView 145) con
una compilación de depuración contra https://hatril.com, leyendo la página
por el protocolo de depuración del WebView. Capturas en
`Versiones/Android/pruebas/`.

### La primera carga es una redirección, y no pasa nada

La app abre `/mi`, que siempre redirige: sin sesión, el proxy manda a
`/acceso?next=/mi`; con sesión, la página reparte a cada quien.

Había un riesgo. Con `server.url`, Capacitor puede pedir él las páginas en
vez del WebView (`WebViewLocalServer.handleProxyRequest`), y entonces sigue
la redirección por su cuenta y entrega la página de destino **con la
dirección pedida**: el acceso pintado con `/mi` en la barra, y el formulario
enviando a donde no es.

No pasa, y el porqué está en `Bridge.loadWebView`: Capacitor solo hace eso
cuando el WebView no sabe inyectar su puente al empezar cada documento
(`WebViewFeature.DOCUMENT_START_SCRIPT`). Si sabe, que es lo normal en un
Android con el WebView al día, Capacitor no toca las navegaciones y el
WebView las sigue como un navegador. Lo que se vio:

- La pantalla, el acceso. `location.href`:
  `https://hatril.com/acceso?next=%2Fmi`, con una redirección en la entrada
  de navegación (`redirectCount: 1`).
- El formulario envía la acción a `/acceso?next=%2Fmi`, con `next=/mi` en el
  campo oculto. Se comprobó interceptando el envío en la página, sin mandar
  nada al servidor.
- Con sesión **no se probó**: no se entra en producción con contraseña, y la
  app exige https, que el servidor de desarrollo no da. Siendo el WebView
  quien navega, es lo mismo que en el Chrome del teléfono.

**Límite conocido**: en un teléfono con el WebView sin actualizar en años
(sin `DOCUMENT_START_SCRIPT`), Capacitor sí pediría él las páginas, y
cualquier carga completa que redirija —el arranque, «Reintentar», recargar
con la sesión caducada— quedaría con la dirección equivocada. No se ha
puesto una ruta de arranque que nunca redirija porque solo taparía el
arranque y «Reintentar», y añadiría un viaje más al servidor en cada
apertura para todos. Si aparece el caso, es por ahí.

### Atrás

- Dentro de la web, atrás vuelve a la pantalla anterior. Con un campo con
  foco, el primer atrás cierra el teclado (lo hace Android).
- En la primera pantalla, atrás tiene que salir de la app. Eso lo hace
  `src/components/app-nativa.tsx`, **que tiene que estar desplegado**: el 20
  de octubre hatril.com aún no lo llevaba, y sin él el plugin de Capacitor se
  traga el botón y no pasa nada.
- En la pantalla de sin conexión, atrás sale (`MainActivity`).

### Sin conexión y «Reintentar»

- Sin red al abrir: la pantalla «Sin conexión», servida desde dentro de la
  app (`https://localhost/sin-conexion.html`).
- «Reintentar» vuelve a `/mi` y llega al acceso con la dirección buena.
- **Al volver la red lo intenta sola**, y para eso hace falta el permiso
  `ACCESS_NETWORK_STATE`: sin él, el WebView no se entera de que no hay red
  (`navigator.onLine` siempre en true) y el evento `online` no llega nunca.
  Probado las dos cosas: sin el permiso, nada; con él, vuelve sola al quitar
  el modo avión.
- Tras volver de esa pantalla, el historial empieza limpio (`MainActivity`):
  la carga que falló a veces quedaba debajo, y el primer atrás recargaba la
  misma pantalla en vez de salir.

### Lo que no hay en Android

- **La hoja de compartir del sistema.** El WebView de Android no trae
  `navigator.share` (comprobado: `undefined`), así que «Compartir» en el
  devocional hace lo mismo que «Copiar» (`compartir.tsx`): copia el texto, no
  abre el menú de Android. Tenerlo pide el plugin `@capacitor/share`.

---

## Si se pierde la clave de subida

**Test and release → App integrity → Play app signing → Request upload key
reset**. Google pide un certificado nuevo y tarda unos días en aceptarlo.
