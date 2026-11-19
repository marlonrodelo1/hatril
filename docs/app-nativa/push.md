# Notificaciones push

Lo que hoy aparece en la campana (tabla `notificaciones`) llega también al
teléfono, con la misma frase, si la persona tiene la app y dio permiso.

## Cómo va

```
emitirNotificacion()            src/lib/notificaciones/emitir.ts
  ├─ apunta el aviso en la campana (dbAdmin, como siempre)
  └─ after(): enviarPush()      src/lib/push/enviar.ts
        ├─ teléfonos de esa cuenta   dispositivos_push (dbAdmin)
        ├─ token OAuth con la cuenta de servicio (JWT RS256, node:crypto)
        └─ FCM HTTP v1, uno por teléfono; los que FCM da por muertos se borran
```

En el teléfono, `src/components/push-nativo.tsx` (montado en el layout raíz):

- **Oyentes siempre**, también en el acceso: si la app estaba cerrada y se abre
  tocando una push, el plugin guarda el toque hasta que alguien escucha.
- **Permiso solo con sesión**: la primera vez que se pisa `/mi` o `/panel`. En
  iOS no se puede volver a preguntar, así que no se gasta en la bienvenida.
- Pide el token y lo apunta con la action `registrarDispositivo`
  (`src/lib/push/acciones.ts`), que guarda además una cookie httpOnly
  `hatril_push` con ese token.
- Tocar la push lleva a `enlace` (validado con `destinoSeguro`) o a `/mi/avisos`.

«Salir» (`salir()` en `src/app/(auth)/actions.ts`) borra el token de la cookie
antes de cerrar la sesión. Pedir la baja de la cuenta borra todos los de esa
cuenta.

## La tabla

`dispositivos_push` (migraciones 0057 y 0058): el token es la clave primaria y
tiene un solo dueño. Cada cuenta ve y borra los suyos; escribir solo se puede
con `registrar_dispositivo_push(token, plataforma)`, que saca la cuenta de
`auth.uid()` y mueve el token si en ese teléfono entra otra persona. Clave
foránea a `auth.users` con cascada. Lo comprueba `npm run test:aislamiento`
(bloque «Los teléfonos de las push»).

## Las cuentas y las claves

| Qué | Dónde |
|---|---|
| Proyecto de Firebase | `hatril-3ac0c` (plan Spark, gratis), con Analytics apagado |
| Apps registradas | Android `app.hatril` y iOS `app.hatril` |
| Configuración del cliente | `android/app/google-services.json` y `ios/App/App/GoogleService-Info.plist`, en el repo. No son secretos: identifican el proyecto, no dan permiso para mandar |
| Clave APNs | «Hatril Push», Key ID `NC7BY93WDQ`, equipo `XR7JH7A8ZY`, Sandbox y Production. Subida a Firebase (Cloud Messaging → apps de Apple) en las dos filas. El `.p8` solo se descarga una vez: la copia la guarda Marlon fuera del ordenador |
| App ID de Apple | `app.hatril`, con Push Notifications y Sign In with Apple |
| Clave del servidor | `FIREBASE_SERVICE_ACCOUNT`: el JSON de la cuenta de servicio en base64. En `.env.local` y en Dokploy (Environment, no Build-time). Sin ella no sale ninguna push y no falla nada |

## Lo nativo

- Plugin `@capacitor-firebase/messaging` (Capawesome). No `@capacitor/push-notifications`:
  en iOS da el token de APNs y FCM necesita el suyo. En Gonper eso obligó a un
  AppDelegate a medida para convertirlo; este lo da hecho.
- **iOS**: `App.entitlements` con `aps-environment` (Xcode lo pasa a
  `production` al exportar), el plist en los Resources del target, y en
  `AppDelegate.swift` los tres avisos que pide el plugin. Firebase lo arranca el
  plugin y solo si el plist está en el binario. `npm run app:ios` se niega a
  sincronizar si el plist falta, no es el de Hatril, trae la API_KEY cortada o
  no está en el target: los dos fallos que en Gonper cerraban la app al abrirla.
  El paquete de Firebase va por Swift Package Manager con `symlink: true`
  (`capacitor.config.ts`); los enlaces los crea el sync en el Mac y están en el
  `.gitignore`. En Windows el sync de iOS falla al crearlos, y da igual: el
  `Package.swift` lo escribe el Mac.
- **Android**: el plugin de `google-services` se aplica solo si existe el
  JSON (`android/app/build.gradle`). Icono de silueta `ic_stat_hatril` (el
  atril de `assets/icono.svg`), color naranja y canal `avisos`, en el
  `AndroidManifest.xml`. El canal lo crea la web al pedir permiso.

Cualquier cambio de aquí pide un build nuevo de las dos apps.

## Probarlo

1. Desplegada la web con esto y `FIREBASE_SERVICE_ACCOUNT` en Dokploy.
2. Instalar el build nuevo, entrar y aceptar el permiso.
3. Comprobar la fila: `select plataforma, visto_at from dispositivos_push`.
4. Provocar un aviso de verdad para esa cuenta: un «me gusta» de otra cuenta en
   una publicación suya, por ejemplo. Con la app cerrada tiene que sonar; al
   tocarlo, abrir la publicación.

Lo que NO prueba nada: que el build compile. Sin la clave APNs subida, sin
`aps-environment` o sin el plist en el target, la app se instala, pide permiso
y no llega nunca nada, sin un error a la vista.
