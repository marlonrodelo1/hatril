# Estado de Hatril

Última actualización: 17 de agosto de 2026.

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
- **Panel**: inicio (avisos accionables arriba, cifras debajo), miembros
  (listado con filtros, ficha, alta, edición, baja),
  ministerios (rejilla, detalle, equipo, asignar, responsable y colíderes),
  solicitudes (bandeja con aprobar y rechazar), **líderes** (rol y permisos por
  persona, quitar y devolver el acceso), ajustes.
- **Permisos**: el pastor reparte seis capacidades desde `/panel/lideres`. Los
  roles `lider`, `tesorero` y `secretaria` ya son asignables — hasta la sesión
  del 16-ago solo existían por SQL.
- **Ministerios con varios líderes**: un responsable garantizado único por la
  base de datos, más los colíderes que hagan falta. Un líder gestiona los suyos
  y nada más (`gestionar_su_ministerio`).
- **Devocionales**: calendario de turnos, redacción, imagen de fondo y
  publicación. El devocional del día sale en la web de la iglesia.
- **Público**: portada, directorio de iglesias, web pública de cada
  congregación (carrusel de fotos con el titular encima, horarios con «lo
  próximo» calculado, devocional, grupos apilados al bajar), formulario de
  solicitud, área `/mi`.
- **Imágenes**: logo y hasta seis fotos de portada por iglesia, foto por
  ministerio y por devocional. Todo en el bucket `iglesias-publico`.
- **Legales**: `/privacidad` y `/terminos`, con el encargo de tratamiento del
  art. 28 como anexo aceptable al registrar la iglesia. Los datos salen todos de
  `src/lib/legal/datos-responsable.ts`, así que se cambian en un solo sitio.
- **Aislamiento**: 26 comprobaciones en `npm run test:aislamiento` más cuatro que
  llaman a `withUser()` de verdad, y cuatro hechas desde fuera con un JWT real
  contra la API pública.

  **Pendiente**: el test no cubre todavía `devocionales`, que es tabla nueva con
  RLS propia. Es lo primero que hay que añadir la próxima sesión.

## Qué falta

| Pieza | Estado |
|---|---|
| Proveedor de alojamiento en los legales | **Sin rellenar.** Lo más urgente: bloquea publicar |
| Foto en la ficha de miembro | Va en OTRO bucket, privado y con URL firmada. El de iglesias es público |
| Eventos y calendario | Decidido que van, sin empezar. Tabla nueva con fecha y hora |
| Finanzas | **Decidido el modelo**: diezmos CON nombre, ofrendas solo en total. Ver abajo |
| Área del miembro | `/mi` echa al panel a quien tiene iglesia. No hay vista propia |
| Stripe | Nada. El trial vence y no pasa nada |
| Correo (Resend) | Nada. Ni bienvenida ni aviso de solicitud |
| Exportar y borrar datos | Derecho de supresión del RGPD, sin implementar |
| Cumpleaños de la semana en Inicio | Se puede: `fecha_nacimiento` existe. Va con `ver_datos_sensibles` y sin enseñar el año |
| Asistencias y seguimiento pastoral | v2. Son bloques que el diseño pone en Inicio y no se pintan |
| App móvil (Capacitor) | v2. `platform/` ya detecta el WebView |

---

## Trampas que ya han costado tiempo

**Las policies se suman con OR, y los GRANT por columna solo recortan a `anon`.**
Dos policies escritas para el visitante —`iglesias_select_directorio` y
`ministerios_select_publico`— se habían concedido **además** a `hatril_app`. Como
a ese rol se le concedió la tabla entera, cualquier sesión autenticada leía las
filas completas de toda iglesia publicada: los ministerios de otra congregación
con su líder, y `stripe_customer_id`, `plan` y `trial_until` de todas. Las cerró
la `0005`. Al conceder una policy, mirar SIEMPRE a qué roles va.

**Una función nueva NO nace cerrada.** Pese a lo que decía este repo. Ver el
apartado de funciones en `CLAUDE.md` y la migración `0007`.

**Una policy que consulta otra tabla necesita los GRANT de esa otra tabla.** Una
policy `USING` sobre su propia tabla no comprueba permisos de columna; en cuanto
la expresión mira OTRA tabla, esa lectura va con los privilegios de quien
pregunta. `ministerios_select_publico` consultaba `iglesias.activa`, que `anon`
no tenía concedida, así que `anon` nunca pudo leer ni un ministerio: fallaba con
«permission denied for table iglesias». Llevaba roto desde la `0001` y no se veía
porque `/i/[slug]` va por `dbAdmin`. Lo arregla la `0006`.

**Cambiar el texto de privacidad no es gratis.** `VERSION_POLITICA_PRIVACIDAD` se
guarda con cada consentimiento. Si se toca el fondo de `/privacidad` hay que
subir esa constante **y** volver a pedir el consentimiento a quien aceptó la
anterior. Cambiar el texto a solas deja la base diciendo que la gente aceptó algo
que no leyó.

**Una tabla nueva necesita su GRANT por columna para `anon`, y su RLS.** El
generador de Drizzle no escribe ninguna de las dos cosas: hay que añadirlas a
mano al fichero de migración. Pasó con `iglesias.imagenes` (0010) y con
`ministerios.foto_url` (0011); sin el GRANT la consulta pública no devuelve cero
filas, **falla entera** con «permission denied».

**Un fichero `'use server'` solo puede exportar funciones async.** Exportar una
constante desde ahí rompe el build entero, y el typecheck no lo caza porque es
una regla de Next y no de TypeScript: aparece al abrir la pantalla. Las
constantes van a un fichero aparte, como `ajustes/constantes.ts`.

**Storage no usa `hatril_app`.** Sus policies se evalúan con el rol del JWT, que
es `authenticated`; `hatril_app` solo existe dentro de una transacción de
`withUser()`. Por eso las imágenes las sube la server action con el service role
y el navegador no habla con Storage: darle escritura a `authenticated` sería
abrirla desde fuera con la publishable key. Lo cuentan las migraciones `0008` y
`0009`.

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

- **Identificar el proveedor de alojamiento.** `ALOJAMIENTO` en
  `src/lib/legal/datos-responsable.ts` está sin rellenar, y mientras lo esté,
  `/privacidad` y `/terminos` se publican con un aviso rojo encima diciendo que
  no deben usarse. Hace falta el nombre legal y el país del centro de datos.
  Ojo: la IP del despliegue no está en un rango europeo, así que conviene
  comprobarlo antes de escribir «UE» en una política. Que los datos guardados
  estén en Supabase no exime: el contenedor de Next ve cada dato al procesar la
  petición, y eso también es tratamiento.
- **Registrar `hatril.app`.** Los textos legales ya lo dan por hecho, y el correo
  `hola@hatril.app` tiene que existir: es la dirección a la que la gente escribe
  para ejercer sus derechos.
- **Rotar la clave secreta de Supabase y la contraseña de la base.** Las dos se
  pegaron en un chat el 16-ago-2026. Antes de que entre una iglesia real.
- **Activar la protección de contraseñas filtradas** en Supabase (Auth →
  Passwords → *Leaked password protection*, que compara contra HaveIBeenPwned).
  Está apagada, y es el único WARN de `get_advisors`. Es un clic, no código.
- **Precio.** En variables de entorno a propósito. La competencia va de 9 a 70
  USD/mes escalados por número de miembros.

---

## Decidido y pendiente de construir

**Finanzas.** Se separan en dos:

- *Diezmos*: **con nombre**. Hace falta para el certificado de donación. Es lo
  más delicado que guardaría Hatril —dinero cruzado con confesión religiosa—, así
  que va con permiso propio y registro de cada consulta, como `ver_datos_sensibles`.
- *Ofrendas*: **solo el total** por culto o por mes. Nadie queda vinculado a una
  cifra.

**Eventos y calendario.** Con fecha y hora, distintos de los horarios semanales
que ya existen. Salen en la web pública.

**Web pública, lo que falta:** versículos, servicios, sección de donaciones,
«quiero ser parte» y redes sociales.

**Reina-Valera 1960.** Investigar la licencia para poder mostrar el texto
bíblico dentro del producto.

El encargo de tratamiento del art. 28 ya no está pendiente: es el apartado 7 de
`/terminos` y se acepta al registrar la iglesia.

---

## Datos de prueba

`scripts/seed-demo.sql`. Siete cuentas, contraseña `Hatril2026`:
`pastor@`, `secretaria@`, `lider@`, `miembro@`, `visita@`, `admin@` y
`pastor.sion@` (de otra iglesia, para probar el aislamiento), todas
`@hatril.test`.

`lider@` es responsable de Alabanza: es la cuenta con la que se comprueba que el
permiso acotado deja gestionar un ministerio y ninguno más. Y Niños tiene
responsable **y** colíder, que es el caso que el modelo viejo no podía guardar.

Dos iglesias: **Betania** (Bogotá, publicada) y **Sion** (Madrid, sin publicar).
