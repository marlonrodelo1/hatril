# iOS: compilar en el Mac y subir a la App Store

Lo mismo está en `Versiones/iOS/LEEME.md`, en el ordenador de Windows. Esta
copia es la que viaja por GitHub y llega al Mac. **Aquí no va ningún secreto**:
ni Team ID, ni claves, ni contraseñas. Esos datos se escriben en la terminal del
Mac cuando se piden, y no se guardan en el repo.

Android está en [`android.md`](android.md). Lo que piden las dos tiendas, con
las respuestas, en [`fichas.md`](fichas.md).

---

## 0. Antes de nada: que GitHub tenga la app nativa

El Mac compila lo que hay en GitHub, no lo que hay en el Windows. La carpeta
`ios/`, los scripts de `scripts/app/` y esta guía llegaron con el commit
«La app nativa: Capacitor para Android e iOS…» y los que le siguen. **Antes
de abrir la Terminal del Mac**:

1. En el Windows, que esos commits estén subidos (`git push`; en GitHub, la
   carpeta `ios/` tiene que verse en la página del repo).
2. En el Mac, el `git pull` (o el `git clone` de la sección 2) hecho después
   de eso. Si `ios/App/App.xcodeproj` no existe, `npm run app:ios` lo dice y
   se para: falta el pull, no hay que generar nada.

## La dirección: https://hatril.com

La app carga la web desplegada en **https://hatril.com**, con su certificado
válido. Es la dirección de todos los comandos de abajo.

Con una de `traefik.me`, la temporal de Dokploy, iOS rechaza el certificado y
la app abre directamente «Sin conexión»; `npm run app:ios` avisa con
«PRUEBA». Eso no se sube.

---

## Lo que ya está hecho (en el repo)

- `ios/`: el proyecto de Xcode, generado con Capacitor 8.5.3. Usa **Swift
  Package Manager**: no hace falta CocoaPods.
- `app.hatril`, «Hatril», versión **1.0.0**, build **1**.
- **Solo iPhone.** En un iPad se abre igual, en modo iPhone. Así Apple no pide
  capturas de iPad ni revisa el diseño en pantalla de tableta. Para cambiarlo,
  `TARGETED_DEVICE_FAMILY` en `project.pbxproj`.
- Siempre en claro (`UIUserInterfaceStyle = Light`), como la web.
- Iconos y arranque, de `assets/icono.svg` (`npm run app:iconos`). El icono va
  sin canal alfa, que es lo que exige Apple.
- Permisos, con su texto en español: cámara y fotos para subir una imagen (los
  `<input type="file">` del muro, los devocionales, los ministerios y los
  ajustes) y guardar en fotos (mantener el dedo sobre una imagen y «Añadir a
  Fotos»; sin ese texto, la app se cierra de golpe). La web no pide ubicación,
  micrófono ni contactos.
- `ITSAppUsesNonExemptEncryption = NO`: solo HTTPS del sistema. App Store
  Connect deja de preguntar por el cifrado en cada build.
- `ios/ExportOptions.plist`: la exportación para App Store Connect, con un
  hueco, `TU_TEAM_ID`, que rellena el comando del paso B.

**Lo que no está en el repo y crea el Mac**: `ios/App/App/public/` y
`ios/App/App/capacitor.config.json`. Llevan la dirección de la web, y por eso
los escribe `npm run app:ios` en cada compilación. Sin ellos Xcode no compila.

---

## 1. Una sola vez, en la web de Apple

Con la cuenta del Apple Developer Program (99 USD al año).

### Registrar el identificador

1. Entra en https://developer.apple.com/account
2. Pulsa **Certificates, IDs & Profiles**.
3. Pulsa **Identifiers** y luego el **+** azul.
4. Marca **App IDs** y pulsa **Continue**.
5. Marca **App** y pulsa **Continue**.
6. Description: `Hatril`. Bundle ID: **Explicit**, `app.hatril`.
7. No marques ninguna capacidad. Pulsa **Continue** y luego **Register**.

### Crear la app en App Store Connect

1. Entra en https://appstoreconnect.apple.com y pulsa **Apps**.
2. Pulsa el **+** y luego **New App**.
3. Platforms: **iOS**.
4. Name: `Hatril`. Si dice que está cogido: `Hatril: tu iglesia`.
5. Primary Language: **Spanish (Spain)**.
6. Bundle ID: elige `app.hatril` en la lista.
7. SKU: `hatril-ios`.
8. User Access: **Full Access**. Pulsa **Create**.
9. En la app, entra en **App Information** (menú de la izquierda). Apunta el
   número de **Apple ID** (diez cifras): es el `ASC_APP_ID` del paso B.

### El Team ID

1. Entra en https://developer.apple.com/account
2. Pulsa **Membership details**.
3. Apunta **Team ID** (diez letras y números).

### La clave de API (solo para subir por terminal)

1. En App Store Connect pulsa **Users and Access**.
2. Pestaña **Integrations**, luego **App Store Connect API**, luego **Team Keys**.
3. Pulsa el **+**. Name: `Hatril Mac`. Access: **App Manager**.
4. Pulsa **Generate**.
5. Apunta el **Issuer ID** (arriba) y el **Key ID** (en la fila de la clave).
6. Pulsa **Download** y guarda el `AuthKey_XXXXXXXXXX.p8`. **Solo se puede
   descargar una vez.** Copia también en `Versiones/iOS/` del Windows, que está
   fuera de Git.

«App Manager» y no «Admin»: esta clave **solo la usa `altool` para subir** el
`.ipa` (camino B), y para eso basta. Firmar no la usa: `xcodebuild` firma con
la cuenta metida en Xcode (sección 2). Una clave de Admin, además, puede dar
de alta usuarios y tocar los acuerdos y la facturación de la cuenta; si se
pierde el `.p8`, que no pueda.

---

## 2. Una sola vez, en el Mac

Hace falta **Xcode 26 o posterior** (lo exige Capacitor 8, y Apple no acepta
compilaciones con un SDK anterior a iOS 26 desde el 28 de abril de 2026) y
**Node 22 o posterior**. CocoaPods no hace falta.

Instalar Xcode desde la App Store del Mac. Después, en la Terminal:

```bash
xcode-select --install
```

```bash
sudo xcodebuild -license accept
```

```bash
xcodebuild -runFirstLaunch
```

```bash
xcodebuild -version
```

Tiene que decir `Xcode 26` o más.

```bash
node -v
```

Tiene que decir `v22` o más. Si no, instala la versión LTS desde
https://nodejs.org y vuelve a abrir la Terminal.

```bash
cd ~
```

```bash
git clone https://github.com/marlonrodelo1/hatril.git
```

Si el repo es privado, pide usuario y contraseña: la contraseña es un *token*
de GitHub (github.com → Settings → Developer settings → Personal access
tokens), no la de la cuenta.

### Meter la cuenta de Apple en Xcode

1. Abre Xcode.
2. Menú **Xcode → Settings…** y pestaña **Accounts**.
3. Pulsa **+**, elige **Apple ID** y entra con la cuenta de desarrollador.

Con esto, Xcode y `xcodebuild` firman solos.

---

## 3. Cada vez que se compila

```bash
cd ~/hatril
```

```bash
git checkout -- ios
```

Descarta lo que Xcode haya cambiado dentro de `ios/` (el Team que se elige en
el camino A). Sin esto, `git pull` se niega cuando el repo trae cambios en el
mismo fichero, que pasa cada vez que sube el número de build.

```bash
git pull
```

```bash
npm ci
```

```bash
export CAP_SERVER_URL=https://hatril.com
```

```bash
npm run app:ios
```

Comprueba la dirección y que la versión cuadra en los tres sitios, y hace
`npx cap sync ios`. Tiene que terminar con `✓ ios/ sincronizado`.

Ahora, **uno de los dos caminos**.

### Camino A: con Xcode (la primera vez, mejor este)

```bash
open ios/App/App.xcodeproj
```

1. Espera a que termine *Resolving Package Graph* (barra de arriba). La primera
   vez descarga Capacitor de GitHub.
2. En la columna de la izquierda, pulsa **App** (el icono azul de arriba).
3. En el centro, bajo TARGETS, pulsa **App**.
4. Pestaña **Signing & Capabilities**.
5. Marca **Automatically manage signing**.
6. **Team**: elige tu equipo.
7. Comprueba que **Bundle Identifier** dice `app.hatril`.
8. Arriba, en el selector de destino (al lado de «App»), elige **Any iOS
   Device (arm64)**.
9. Menú **Product → Archive**. Tarda unos minutos.
10. Se abre el **Organizer** con el archivo nuevo seleccionado. Pulsa
    **Distribute App**.
11. Elige **App Store Connect** y pulsa **Distribute**.
12. Espera a que diga que se ha subido.

### Camino B: por terminal

Los datos de la sección 1, en la misma Terminal:

```bash
export TEAM_ID=XXXXXXXXXX
```

```bash
export ASC_KEY_ID=XXXXXXXXXX
```

```bash
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

```bash
export ASC_APP_ID=0000000000
```

La clave, en la carpeta donde la busca `altool` (solo la primera vez; cambia
la ruta si la descargaste en otro sitio):

```bash
mkdir -p ~/.appstoreconnect/private_keys && mv ~/Downloads/AuthKey_$ASC_KEY_ID.p8 ~/.appstoreconnect/private_keys/
```

La carpeta de salida, que en un clon recién hecho no existe (está en el
`.gitignore`):

```bash
mkdir -p Versiones/iOS
```

La versión y el build, leídos del proyecto:

```bash
VERSION=$(grep -m1 -o 'MARKETING_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | cut -d' ' -f3)
```

```bash
BUILD=$(grep -m1 -o 'CURRENT_PROJECT_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | cut -d' ' -f3)
```

```bash
echo "Hatril $VERSION ($BUILD)"
```

Archivar:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath "Versiones/iOS/Hatril-$VERSION-$BUILD.xcarchive" -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM_ID" archive
```

Tiene que terminar con `** ARCHIVE SUCCEEDED **`.

Las opciones de exportación con tu Team ID (la copia va a `Versiones/`, que
no se sube a GitHub; el fichero del repo se queda con el hueco):

```bash
sed "s/TU_TEAM_ID/$TEAM_ID/" ios/ExportOptions.plist > Versiones/iOS/ExportOptions.plist
```

Exportar el `.ipa`:

```bash
xcodebuild -exportArchive -archivePath "Versiones/iOS/Hatril-$VERSION-$BUILD.xcarchive" -exportOptionsPlist Versiones/iOS/ExportOptions.plist -exportPath "Versiones/iOS/Hatril-$VERSION-$BUILD" -allowProvisioningUpdates
```

Tiene que terminar con `** EXPORT SUCCEEDED **` y dejar
`Versiones/iOS/Hatril-$VERSION-$BUILD/App.ipa`.

Subirlo:

```bash
xcrun altool --upload-package "Versiones/iOS/Hatril-$VERSION-$BUILD/App.ipa" -t ios --apple-id "$ASC_APP_ID" --bundle-id app.hatril --bundle-short-version-string "$VERSION" --bundle-version "$BUILD" --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
```

**Lee el final del mensaje**: hay versiones de `altool` que terminan sin código
de error aunque la subida falle. La prueba de verdad es que el build aparezca
en App Store Connect → la app → **TestFlight**, normalmente entre 5 y 30
minutos después.

Por qué `--upload-package` y no `--upload-app`: Apple marca `--upload-app` como
obsoleto en la documentación de `altool`. Otras dos formas de subir el mismo
`.ipa`, por si `altool` da guerra:

- La app **Transporter** (gratis en la App Store del Mac): arrastrar el
  `App.ipa` y pulsar **Deliver**.
- Cambiar `export` por `upload` en `destination` de la copia de
  `ExportOptions.plist`: entonces el comando de exportar sube él mismo, con la
  cuenta metida en Xcode.

---

## 4. El número de build, antes de cada envío

App Store Connect rechaza un build con un número que ya recibió
(*Redundant Binary Upload*), aunque el binario sea otro. **Antes de cada
subida**, en el Windows (o en el Mac, es lo mismo):

```bash
npm run app:version -- build ios
```

Sube `CURRENT_PROJECT_VERSION` en uno. Con `build` a secas sube también el de
Android, y con una versión (`npm run app:version -- 1.0.1`) cambia la versión
visible en capacitor.config.ts, Android e iOS a la vez y sube los dos builds.
Sin nada, enseña los números y dice si cuadran.

Después, **commit y push**, y en el Mac la sección 3 desde el principio: el
Mac compila lo que hay en GitHub.

---

## 5. Probar en el simulador antes de subir

```bash
open ios/App/App.xcodeproj
```

1. En el selector de destino, elige un iPhone de la lista de simuladores.
2. Pulsa ▶ (o Cmd+R).

Qué mirar, en este orden:

- **Arranque**: crema con el icono, sin destello blanco.
- **Barra de estado**: iconos oscuros sobre crema, y la web empieza debajo.
- **Barra inferior de `/mi`: que no quede pegada a la raya de inicio** del
  iPhone. Es lo que más probablemente falle: la web usa
  `env(safe-area-inset-bottom)`, pero no declara `viewport-fit=cover`, y sin
  eso Safari y WebKit dan 0. Si queda pegada, el arreglo es añadir
  `viewportFit: 'cover'` al `viewport` de `src/app/layout.tsx`, y mirar
  después la web en Safari de iPhone, porque también la cambia.
- **Subir una foto al muro**: el menú de Fototeca / Hacer foto, y el texto del
  permiso en español.
- **Sin red**: «Sin conexión», y «Reintentar» vuelve a la web.
- **Un enlace de fuera** (WhatsApp, Stripe): se abre en Safari, no dentro.

Con una dirección de traefik.me se ve directamente «Sin conexión»: eso
prueba la página de error en iOS, y que un certificado malo no se acepta
nunca. Con https://hatril.com tiene que llegar al acceso.

Antes de probar, que hatril.com tenga desplegada la web con
`src/components/app-nativa.tsx`: es la que esconde el arranque en cuanto la
web está y pone los iconos oscuros en la barra de estado.

En un iPhone de verdad: la subida aparece en **TestFlight**. En App Store
Connect → la app → TestFlight → **Internal Testing** → **+**, crea un grupo y
añade tu correo. En el iPhone, instala la app **TestFlight** y acepta la
invitación.

---

## 6. Mandar a revisión

1. App Store Connect → la app → la versión **1.0** (columna izquierda, bajo
   iOS App).
2. Rellena capturas, textos y datos con lo que dice [`fichas.md`](fichas.md).
3. En **Build**, pulsa **+** y elige el que acabas de subir.
4. Pulsa **Add for Review** y luego **Submit to App Review**.

**Antes de enviar, lee la primera sección de `fichas.md`**: hay cosas del
producto que hoy harían que Apple la rechace.

---

## Si algo falla

| Mensaje | Qué pasa |
|---|---|
| `CAP_SERVER_URL tiene que ser https` / `Falta CAP_SERVER_URL` | Falta el `export CAP_SERVER_URL=...` en esta Terminal. |
| `Los números de versión no cuadran` | Alguien cambió la versión en un sitio y no en los otros. `npm run app:version` dice cuáles. |
| Xcode no encuentra `public` o `capacitor.config.json` | Falta `npm run app:ios` después del pull. |
| `Missing package product 'CapApp-SPM'` o falla *Resolving Package Graph* | Xcode no llega a GitHub para descargar Capacitor. Comprueba la red y en Xcode: **File → Packages → Reset Package Caches**. |
| `Signing for "App" requires a development team` | Falta elegir el Team (camino A) o `DEVELOPMENT_TEAM` (camino B). |
| `No profiles for 'app.hatril' were found` | Falta `-allowProvisioningUpdates`, o la cuenta en Xcode → Settings → Accounts. |
| `Cloud signing permission error` | La cuenta metida en Xcode no puede crear el certificado de distribución. Con la del titular de la cuenta de desarrollador no pasa; con otra, que el titular le dé permiso. La clave de API no interviene: solo la usa `altool`. |
| *Redundant Binary Upload* | Ese build ya se subió. Sección 4. |
| Correo de Apple con *ITMS-91053: Missing API declaration* | Algún plugin usa una API que Apple obliga a declarar. Hoy ninguno de los tres lo hace (Capacitor trae su propio `PrivacyInfo.xcprivacy`), pero un plugin nuevo puede. Se arregla en Xcode: **File → New → File… → App Privacy**, con la razón que diga el correo. |

Cuando el Team ID esté claro, se puede dejar escrito en el repo
(`DEVELOPMENT_TEAM` en `project.pbxproj` y `teamID` en `ExportOptions.plist`):
no es un secreto, y desaparecen el `git checkout -- ios` y el `sed`.
