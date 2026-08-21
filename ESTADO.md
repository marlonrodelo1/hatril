# Estado de Hatril

Última actualización: 20 de agosto de 2026.

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
- **Devocionales**: calendario de turnos, redacción, imagen de fondo, enlace a
  vídeo y publicación. El devocional del día sale en la web de la iglesia.
- **Comunidad**: el muro de la congregación en `/mi/comunidad`. Publicar con
  texto y hasta cuatro fotos, me gusta, comentarios, y borrado por el autor o
  por el pastor. Solo para miembros con acceso ACTIVO: no sale en la web
  pública, donde únicamente hay una invitación con un recuento. Las fotos van al
  bucket **privado** `comunidad` y se sirven con URL firmada de una hora.
- **Avisos**: las notificaciones de cada persona en `/mi/avisos`, con la campana
  y su punto rojo en el panel. Seis tipos: solicitud recibida, aprobada y
  rechazada, comentario y me gusta en el muro, y turno de devocional. El texto
  se compone al pintarlo desde `notificaciones/textos.ts` —en la fila solo van
  el tipo y los datos—, y las escribe siempre el servidor con `dbAdmin`: quien
  pudiera insertarlas se fabricaría un «solicitud aprobada» o le mandaría a otro
  un enlace a su gusto. La pantalla **solo pide sesión**, sin `requireIglesia`:
  a quien le rechazan la solicitud se le borra la membresía en el mismo
  movimiento y el aviso que se lo explica quedaría fuera de su alcance.
- **Finanzas**: el libro de caja. Fondos (de quién es el dinero) y cajas (dónde
  está), movimientos con alta, edición y borrado, saldo por fondo y por caja,
  resumen del mes, informe imprimible para la asamblea y exportación a CSV.
  Verificado apuntando una ofrenda de 250.000 y borrándola desde la pantalla.
  **Sin nombres de donante**: ver el apartado de decisiones.
- **Compartir**: `/panel/compartir`. La dirección absoluta de la web de la
  iglesia y la de «pedir unirme», con copiar y con enviar por WhatsApp, y el
  formulario de las cinco redes sociales —Instagram, Facebook, YouTube,
  WhatsApp, TikTok— que salen al pie de la web pública. Acepta las tres formas
  en que la gente copia esto (`@nombre`, la dirección pegada, o un teléfono para
  WhatsApp) y las canoniza; una dirección de otro host se rechaza con un mensaje
  legible. La ve todo el equipo, pero las redes solo las escribe el pastor. Si
  la web no está publicada o las solicitudes están cerradas, lo dice en vez de
  dar un enlace que no funciona.
- **Eventos**: `/panel/eventos`. Crear un evento con fecha y hora, aforo, precio
  y el enlace de pago de la iglesia; publicarlo y abrir inscripciones, que son
  dos interruptores separados; la lista de quién viene, marcar plazas pagadas y
  descargar el CSV. Sale en la web de la congregación entre los horarios y el
  devocional, y **cualquiera puede apuntarse sin cuenta**. Verificado creando un
  retiro de 150.000 con aforo 2, apuntando gente y llenándolo. Con permiso
  propio, `gestionar_eventos`, que la secretaría tiene por defecto.
- **Público**: portada, directorio de iglesias, web pública de cada
  congregación (carrusel de fotos con el titular encima, horarios con «lo
  próximo» calculado, devocional, grupos apilados al bajar), formulario de
  solicitud, área `/mi`.
- **Imágenes**: logo y hasta seis fotos de portada por iglesia, foto por
  ministerio y por devocional. Todo en el bucket `iglesias-publico`.
- **Legales**: `/privacidad` y `/terminos`, con el encargo de tratamiento del
  art. 28 como anexo aceptable al registrar la iglesia. Los datos salen todos de
  `src/lib/legal/datos-responsable.ts`, así que se cambian en un solo sitio.
- **Aislamiento**: 45 comprobaciones en `npm run test:aislamiento` más seis que
  llaman a `withUser()` de verdad, y cuatro hechas desde fuera con un JWT real
  contra la API pública. Las diez nuevas son de finanzas: que Sion no vea la caja
  de Betania en ningún sentido, HT110, HT111, el CHECK del tipo de ingreso, que
  el saldo salga de la columna generada, y que ni `anon` ni **`service_role`**
  lleguen. Las nueve nuevas son del muro: publicar siendo miembro
  raso, no poder firmar con la ficha de otro, me gusta duplicado, que Sion no
  lea ni escriba en el muro de Betania, HT107, la moderación del pastor y que
  `anon` no llegue.

  **Pendiente**: el test sigue sin cubrir `devocionales`, que es tabla nueva con
  RLS propia.

## Qué falta

| Pieza | Estado |
|---|---|
| Proveedor de alojamiento en los legales | **Sin rellenar.** Lo más urgente: bloquea publicar |
| Foto en la ficha de miembro | Va en OTRO bucket, privado y con URL firmada. El de iglesias es público |
| Eventos y calendario | Hecho y verificado, con sus textos legales |
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

**Una tabla nueva tampoco, y ahí sí hubo fuga.** El `grant select (columnas)` de
la `0012` no recortaba nada, porque debajo seguía el grant de tabla entera que
Supabase da por defecto a `anon` y `authenticated`. Resultado: durante meses,
`GET /rest/v1/devocionales?select=id,autor_miembro_id,video_url` devolvía 200 con
la clave publicable —la que viaja en el JavaScript del navegador—, y sacaba justo
la columna que esa migración había dejado fuera a propósito. Solo `devocionales`
estaba afectada: es la única migración del repo que hace `grant` sin `revoke`
delante. La RLS impidió lo demás, porque `anon` no tenía ninguna policy de
escritura. Lo cierra la `0022`, que además invierte el defecto de tablas —como la
`0003` hizo con el de funciones— y revoca `service_role` en `auditoria`,
`consentimientos` y `solicitudes_ingreso`, que era lo que este fichero llevaba
pidiendo desde el 19-ago.

**`npm run db:migrate` no aplica nada y sale con código 0.** Sin error, sin
mensaje y sin dejar rastro: parece que ha funcionado. Es `strict: true` en
`drizzle.config.ts`, que pide confirmación por consola; cuando nadie puede
contestarla, drizzle-kit se rinde en silencio. Se descubrió porque las tablas no
aparecían después de dos pasadas «correctas».

Mientras siga así, la vía que sí aplica —y registra igual en
`drizzle.__drizzle_migrations`, así que el repo sigue siendo la fuente de
verdad— es el migrador de `drizzle-orm`:

```bash
node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import { drizzle } from 'drizzle-orm/postgres-js'; import { migrate } from 'drizzle-orm/postgres-js/migrator'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await migrate(drizzle(sql), { migrationsFolder: './drizzle' }); await sql.end();"
```

Y da el error de verdad, que drizzle-kit se tragaba: hay que leer `e.cause`,
porque `e.message` solo trae el SQL entero.

**`miembros.estado` y `iglesia_usuarios.estado` son enums distintos que se
parecen.** El primero es `visitante · nuevo · miembro · inactivo · baja` (la
situación de la persona en la congregación); el segundo, `pendiente · activo ·
rechazado · baja` (si su cuenta tiene acceso). Escribir `miembros.estado =
'activo'` tumbó entera la migración `0015`. Para «¿esta persona puede entrar?»
manda siempre el de `iglesia_usuarios`, que es el que consulta
`pertenece_a_iglesia()`.

**Una policy que consulta otra tabla necesita los GRANT de esa otra tabla.** Una
policy `USING` sobre su propia tabla no comprueba permisos de columna; en cuanto
la expresión mira OTRA tabla, esa lectura va con los privilegios de quien
pregunta. `ministerios_select_publico` consultaba `iglesias.activa`, que `anon`
no tenía concedida, así que `anon` nunca pudo leer ni un ministerio: fallaba con
«permission denied for table iglesias». Llevaba roto desde la `0001` y no se veía
porque `/i/[slug]` va por `dbAdmin`. Lo arregla la `0006`.

**Un texto legal se revisa contra el código, no contra sí mismo.** La primera
redacción de los párrafos de eventos pasaba lectura, era coherente y decía cuatro
cosas falsas. Todas se cazaron comparando frase por frase con lo que el producto
hace: la política declaraba que la IP servía «para frenar inscripciones
automáticas» cuando el propio schema dice que no se usa para eso; afirmaba que
«nada vincula un importe con una persona» tres párrafos después de contar que se
guarda quién ha pagado su plaza; prometía un aviso por correo sin que exista
envío de correo; y el anexo del art. 28 declaraba como medida del art. 32 un
«registro de quién consulta los datos protegidos» que no existe —`lectura_sensible`
está en el enum y no lo escribe nadie—. A eso se suma que `/terminos` prohibía
«guardar datos de personas que no tengan relación con la congregación», que es
literalmente lo que hace el módulo de eventos.

**Y una promesa legal necesita el botón que la cumple.** «Si pides que se borre,
se borra» era falso para un inscrito: solo existía dar de baja —que conserva
nombre, correo, teléfono, nota e IP— o borrar la lista entera. Atender a una
persona obligaba a incumplir con las otras cuarenta. Ahora hay un botón de borrar
los datos de una sola.

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

**Una policy de UPDATE no impide cambiar de iglesia.** Parece que sí: el `using`
mira la fila de origen y el `with check` la de destino. Pero una cuenta puede
pertenecer a DOS congregaciones —`iglesia_usuarios` solo es único por
`(iglesia_id, auth_user_id)`, y un pastor que planta una segunda iglesia o
alguien que se muda son casos reales—, y entonces las dos condiciones son
ciertas a la vez. No es una fuga hacia un extraño, porque quien lo haría ya ve
las dos; es corromper el libro de una con los movimientos de la otra. Lo tapa
**HT111** en la `0020`, y hace falta el mismo guard en cualquier tabla futura.

**`service_role` es una puerta distinta de `dbAdmin`.** Las migraciones hasta la
`0017` revocaban solo `from anon, authenticated`. `dbAdmin` conecta como
`postgres` por `DATABASE_URL` y ahí no hay nada que revocar, pero `service_role`
entra por PostgREST con una clave que viaja en variables de entorno: es la clave
que ESTADO.md lleva desde el 16-ago pidiendo rotar. La `0020` le revoca las tres
tablas de finanzas y no rompe nada, porque ninguna consulta va por supabase-js.
Conviene hacer lo mismo en las tablas que ya existen.

**Un route handler NO queda cubierto por el `layout.tsx` de su carpeta.** Es la
excepción a la regla de «los guards van en el layout»: los handlers no participan
en layouts, y `src/proxy.ts` es comprobación optimista, no autorización. Por eso
existe `src/lib/auth/guard-api.ts`, que devuelve `Response` y no `redirect()` —un
redirect desde un endpoint que sirve un fichero le entrega al navegador una
página HTML con nombre de CSV.

**`capitalize` de Tailwind capitaliza CADA palabra.** `toLocaleDateString` en
español devuelve «agosto de 2026» y salía «Agosto De 2026». Para una sola
mayúscula inicial, `first-letter:uppercase`.

**Un BOM literal en el código es invisible y alguien lo borra.** El CSV necesita
BOM UTF-8 o Excel en español destroza los acentos, y `sep=;` o mete el fichero
entero en una columna. Escrito como carácter literal no se ve en el editor;
va como `﻿`. Y ojo al comprobarlo: `fetch().text()` **elimina el BOM** al
decodificar, así que parece que falta cuando está. Hay que mirar los bytes.

**Una columna interpolada en un `sql` de Drizzle sale SIN cualificar.**
`${eventos.id}` dentro de una subconsulta se escribe como `"id"` a secas, y
Postgres lo resuelve contra la tabla de DENTRO si esa también tiene una columna
`id`. El contador de plazas quedó como `where ei.evento_id = ei.id`: cero
siempre, sin error, sin aviso y con la consulta perfectamente válida para el
compilador y para Postgres. Se vio en pantalla —«0 personas de 2 plazas» con un
inscrito debajo— y no en ninguna comprobación automática. En una subconsulta
correlacionada, el nombre de la tabla de fuera se escribe a mano.

**lucide 1.x ya no trae iconos de marca.** `Instagram`, `Facebook` y `Youtube`
son `undefined`: se retiraron del paquete. Importarlos no da error de
compilación, da un componente vacío en tiempo de ejecución. Por eso las redes
del pie de `/i/[slug]` van como pastillas con el nombre escrito y no como
iconos. Dibujar logotipos a mano junto a un juego coherente se ve peor, y es la
regla de iconografía del sistema de diseño.

**El `<Toaster />` de sonner no está montado en ningún layout.** `src/lib/toast.ts`
y `src/components/ui/sonner.tsx` existen —vienen de Gonper—, pero nadie los
monta: una llamada a `toast()` no pinta nada y no avisa. Para confirmar una
acción en cliente, que el propio botón lo diga. Montarlo traería `next-themes` a
una aplicación de modo claro únicamente.

**Los backticks rompen `scripts/test-aislamiento.ts`.** El bloque SQL vive dentro
de un template literal de TypeScript: un backtick en un comentario SQL cierra la
cadena y el fichero deja de compilar. Y los saltos de línea del informe van como
`\n`, doble, para que llegue `
` a Postgres.

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

**Finanzas, lo que falta.** La v1 está hecha y NO guarda nombres de donante.
`tipo_ingreso` distingue diezmo de ofrenda para poder sumarlos por separado, pero
nada vincula un importe con una persona.

El diezmo nominativo sigue decidido y sigue haciendo falta para el certificado de
donación. Lo que cambió es el **orden**, y el motivo es que hoy no hay base
jurídica: el consentimiento que la gente ha marcado —`datos_religiosos`, art.
9.2.a— dice que se guardan sus datos «para que la congregación pueda
organizarse», y eso no cubre «y cuánto dinero doy, con mi nombre, durante años».
Antes de la tabla satélite hacen falta:

- Un valor nuevo en `tipo_consentimiento_enum` con su casilla separada (art. 7.2,
  granularidad), y decidir por escrito qué pasa con quien se niega.
- Reescribir `/privacidad` §3, que hoy dice que «los donativos no pasan por
  Hatril» y con el módulo ya es falso, y §6, que promete un borrado que
  `auditar()` no cumple.
- Ampliar el anexo del art. 28 en `/terminos` §7, que no menciona aportaciones
  económicas: tratar una categoría que el contrato no nombra convierte al
  encargado en responsable (art. 28.10).
- Cerrar la segunda puerta: `grant select on public.auditoria to hatril_app`
  (0001:226) es de tabla entera y `auditoria_select_pastor` (0001:439) no filtra
  por entidad, así que el mapa diezmo→persona se reconstruiría desde la auditoría
  sin dejar rastro.

Cuando llegue, el nombre NO va como columna de `movimientos`: los GRANT son por
columna pero todas las sesiones entran como el mismo rol, así que una columna no
se puede ocultar a quien ya lee la fila, y filtrarla por RLS haría mentir a
`sum()`. Va en tabla satélite sin GRANT, tras funciones `security definer`.

**Lo que se aplazó a propósito de la v1:** arqueo de la ofrenda con desglose por
denominación, cierre de periodo, categorías de gasto, campo `beneficiario`
(invita a escribir un nombre y con él el motivo, que suele ser de salud),
adjuntar justificante, PDF y XLSX generados en servidor, y la comparativa
interanual —que no tiene con qué comparar hasta que haya un año de datos—.

**Eventos y calendario.** Con fecha y hora, distintos de los horarios semanales
que ya existen. Salen en la web pública.

Las tablas ya están: `eventos` y `evento_inscripciones`, con su RLS, sus tres
guards (HT113, HT114, HT115) y la función `inscribir_en_evento`. Verificado
ejecutándolo: 39 comprobaciones contra la base de verdad, más doce nuevas
permanentes en `npm run test:aislamiento`.

Tres decisiones que conviene no volver a discutir:

- **`anon` no recibe nada, ni una columna, ni un `grant execute`.** La
  inscripción pública no pasa por PostgREST: la server action llama con
  `dbAdmin` a una función `security definer` que no está concedida a nadie. Eso
  quita del mapa `POST /rest/v1/rpc/` y hace que la IP deje de venir de un
  desconocido.
- **La función devuelve un solo escalar.** Un correo ya inscrito responde
  exactamente igual que un alta nueva. Devolver el código de cancelación solo en
  el alta convertiría esto en un oráculo: con una lista de correos se
  reconstruiría quién asiste a un acto religioso sin leer una fila. El código va
  por correo, así que **hasta que Resend esté montado no hay autocancelación**:
  la baja la hace el pastor.
- **Ninguna señal de aforo sale a la calle.** Ni plazas restantes, ni «completo»,
  ni un botón que desaparezca: con cualquiera de las tres se rearma el mismo
  oráculo desde fuera. El rechazo por aforo se entera al enviar.

Lo que falta es todo lo de arriba: `/panel/eventos`, la sección de la web
pública, el permiso `gestionar_eventos`, y los textos de `/privacidad` y
`/terminos` — que **no son opcionales** aquí, porque es la primera vez que la
plataforma guarda datos de gente que no es miembro de ninguna iglesia.

**Web pública, lo que falta:** versículos y servicios. Las redes sociales ya
están, al pie. Los
donativos ya no son una sección: son el botón «Donar» de la cabecera, y ahí es
donde entrará el pago con Stripe. «Quiero ser parte» está en el bloque de
comunidad.

**Comunidad, fase 2:** vídeo (hoy solo enlace de YouTube en el devocional;
subirlo cuesta almacenamiento y tráfico), avisos de la comunidad, menciones,
reportar y ocultar, publicaciones fijadas. Y paginación del muro, que hoy trae
las últimas treinta y ya está.

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
