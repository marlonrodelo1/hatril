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
- `Versiones/Android/Hatril-1.0.0-1-PRUEBA.aab`: compilado contra traefik.me,
  cuyo certificado rechaza Android. **No se sube.**
- `Versiones/Android/icono-play-512.png`: el icono de la ficha.

**Haz una copia de `Versiones/Android/firma/` fuera de este ordenador** (un
pendrive, un gestor de contraseñas). Si se pierde, hay que pedir a Google que
cambie la clave de subida, y mientras tanto no se puede publicar nada.

---

## 1. Compilar el .aab

Hace falta el dominio definitivo, con certificado válido. En PowerShell, en la
carpeta del repo:

```powershell
$env:CAP_SERVER_URL='https://DOMINIO'
```

```powershell
npm run app:android
```

En bash (Git Bash, Mac, Linux), lo mismo en una línea:

```bash
CAP_SERVER_URL=https://DOMINIO npm run app:android
```

Deja, firmados y comprobados (`jarsigner -verify` y `apksigner verify`):

- `Versiones/Android/Hatril-1.0.0-1.aab`: el que se sube a Google Play.
- `Versiones/Android/Hatril-1.0.0-1.apk`: para instalar a mano en un teléfono.

Si el nombre lleva `-PRUEBA`, la dirección era la de traefik.me.

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

## Si se pierde la clave de subida

**Test and release → App integrity → Play app signing → Request upload key
reset**. Google pide un certificado nuevo y tarda unos días en aceptarlo.
