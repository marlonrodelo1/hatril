# Estado de Hatril

Última actualización: 16 de agosto de 2026.

Este fichero se actualiza al cerrar cada sesión de trabajo. Va **dentro del
repo** a propósito: Pidoo guardaba su detalle en ficheros `memory/` fuera del
repositorio y hoy no existen, así que cuatro meses de decisiones se perdieron.

---

## Dónde está desplegado

| Qué | Dónde |
|---|---|
| Repo | `github.com/marlonrodelo1/hatril`, rama `main` |
| Despliegue | Dokploy en VPS `187.124.37.206`, autodeploy al hacer push |
| Dominio | `hatril-fronted-y39axf-ee09a0-187-124-37-206.traefik.me` (temporal) |
| Base de datos | Supabase `qutoggpigkdginvburjv`, org `ministeriales`, eu-west-1 |
| Diseños | claude.ai/design `107021c4-dd85-485d-9cc7-34ef639d92ae` |

El despliegue usa el `Dockerfile` del repo (Build Type: Dockerfile, no
Nixpacks). Las tres variables `NEXT_PUBLIC_` tienen que estar **además** en
*Build-time Arguments*: Next las incrusta en el JavaScript al compilar, no las
lee al arrancar.

---

## Qué funciona, verificado ejecutándolo

- **Acceso**: entrar, registrar iglesia, crear cuenta personal, recuperar
  contraseña.
- **Panel**: inicio, miembros (listado con filtros, ficha, alta, edición, baja),
  ministerios (rejilla, detalle, equipo, asignar), solicitudes (bandeja con
  aprobar y rechazar), ajustes.
- **Público**: directorio de iglesias, web pública de cada congregación,
  formulario de solicitud, área `/mi`.
- **Aislamiento**: 15 comprobaciones en `npm run test:aislamiento`, más cuatro
  hechas desde fuera con un JWT real contra la API pública.

## Qué falta

| Pieza | Estado |
|---|---|
| Landing `/` | **Sigue siendo la plantilla de Next.js.** Lo más urgente |
| `/privacidad` y `/terminos` | Enlazadas desde el consentimiento; dan 404 |
| Stripe | Nada. El trial vence y no pasa nada |
| Correo (Resend) | Nada. Ni bienvenida ni aviso de solicitud |
| Exportar y borrar datos | Derecho de supresión del RGPD, sin implementar |
| Eventos, finanzas, asistencias, seguimiento pastoral | v2 |
| App móvil (Capacitor) | v2. `platform/` ya detecta el WebView |

---

## Trampas que ya han costado tiempo

**El rol de Postgres.** `withUser()` entra como `hatril_app`. Si alguien lo
cambia a `authenticated`, el panel entero devuelve 500 sin más pista que un
`permission denied`. Pasó, y estuvo días sin detectarse.

**`formData.get()` devuelve `null`.** Nunca leerlo directo para pasárselo a Zod:
`z.string().optional()` acepta `undefined` pero no `null`, y un campo que
simplemente no viaja en el envío tumba la validación entera. Usar los helpers de
`src/lib/api/formulario.ts`.

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

- **Rotar la clave secreta de Supabase y la contraseña de la base.** Las dos se
  pegaron en un chat el 16-ago-2026. Antes de que entre una iglesia real.
- **Dominio propio.** En textos legales se usa `hatril.app` como relleno.
- **Precio.** En variables de entorno a propósito. La competencia va de 9 a 70
  USD/mes escalados por número de miembros.
- **Encargo de tratamiento (art. 28 RGPD)** que firmar con cada iglesia.

---

## Datos de prueba

`scripts/seed-demo.sql`. Siete cuentas, contraseña `Hatril2026`:
`pastor@`, `secretaria@`, `lider@`, `miembro@`, `visita@`, `admin@` y
`pastor.sion@` (de otra iglesia, para probar el aislamiento), todas
`@hatril.test`.

Dos iglesias: **Betania** (Bogotá, publicada) y **Sion** (Madrid, sin publicar).
