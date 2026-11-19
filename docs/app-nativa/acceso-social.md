# Entrar con Google y con Apple

Botones «Continuar con Google» y «Continuar con Apple» encima del formulario
de `/acceso` y `/crear-cuenta`. Con cualquiera de los dos, la cuenta se crea al
entrar: es la misma cuenta personal, sin iglesia, que la del formulario.

| Dónde | Google | Apple |
|---|---|---|
| Web | Sí, con el flujo de Supabase (`signInWithOAuth` → `/auth/callback`) | No |
| App iOS | Sí, ventana nativa | Sí, ventana nativa |
| App Android | Sí, ventana nativa (Credential Manager) | No |

El porqué de cada casilla está en la cabecera de `src/lib/auth/acceso-social.ts`.
Lo corto: Google no deja entrar desde un WebView, y Apple solo es obligatorio en
el iPhone (guía 4.8) y en la web pediría una clave que caduca cada seis meses.

## Las piezas

- `src/lib/auth/google.ts`: los clientes de Google, **en el repo** a propósito
  (el de iOS tiene que casar con el `Info.plist` del binario).
- `src/lib/auth/acceso-social.ts`: la configuración y `asegurarNombre`.
- `src/app/(auth)/actions.ts`: `entrarConGoogle` (web) y `entrarConToken`
  (app, canjea el token de la ventana nativa con `signInWithIdToken`).
- `src/app/auth/callback/route.ts`: la vuelta de Google en la web.
- `src/app/(auth)/_components/acceso-social.tsx` y `acceso-nativo.tsx`: los
  botones. En la app, sin el plugin en el binario no sale ninguno.
- Plugin `@capgo/capacitor-social-login` (fijado a 8.7.6), con Facebook y
  Twitter quitados en `capacitor.config.ts`.
- iOS: `com.apple.developer.applesignin` en `App.entitlements` y el esquema del
  cliente de Google en `Info.plist`. `npm run app:ios` se niega si falta
  cualquiera de los dos: sin el esquema, la librería de Google cierra la app.

## Las cuentas

| Qué | Dónde |
|---|---|
| Google Cloud | Proyecto `hatril-3ac0c` (el de Firebase) → Google Auth Platform. Externo, **en producción**, sin logo (con logo Google exige verificar la marca antes de dejar entrar a nadie) |
| Clientes OAuth | «Hatril web» (con el callback de Supabase), «Hatril iOS» (`app.hatril`, equipo `XR7JH7A8ZY`), «Hatril Android» (SHA-1 de la firma de subida) y «Hatril Android pruebas» (SHA-1 del `debug.keystore`) |
| Secreto del cliente web | Solo en Supabase. Copia en `.env.local` (`GOOGLE_OAUTH_WEB_CLIENT_SECRET`), que la app no lee |
| Supabase | Authentication → Sign In / Providers: Google con los clientes web e iOS (en ese orden, separados por coma) y el secreto; Apple con `app.hatril`. URL Configuration: Site URL `https://hatril.com` y `https://hatril.com/**` y `http://localhost:3000/**` en Redirect URLs |
| Apple | El App ID `app.hatril` tiene Sign In with Apple marcado |

## Probado

- **Google en la web, de punta a punta** (19-nov, en local contra la base de
  producción): la cuenta de Google de Marlon quedó unida a su cuenta de
  siempre, con su nombre y su iglesia.
- Apple y Google dentro de la app: **sin probar** hasta el build 2.

## Pendiente

- **El SHA-1 de Play App Signing.** Cuando la app esté en Google Play, Play
  firma con su propia clave: hay que crear otro cliente Android con el SHA-1 de
  Play Console → Integridad de la app → Firma de apps. Sin él, «Continuar con
  Google» falla en las copias bajadas de la tienda con el error 28444.
- **Revocar el token de Apple al borrar la cuenta.** Apple lo pide a las apps
  que crean cuentas con Sign in with Apple. Hace falta una clave de Sign in with
  Apple (`.p8`) y guardar el código de autorización al entrar.
- **La política de privacidad** no dice todavía que se puede entrar con Google
  o Apple (de ellos llegan el nombre y el correo). Va con la próxima subida de
  `VERSION_POLITICA_PRIVACIDAD`, que es decisión de Marlon.
- Verificar la marca en Google (logo y «Hatril» en la ventana de Google en vez
  de la dirección de Supabase): pide demostrar `hatril.com` en Search Console.
