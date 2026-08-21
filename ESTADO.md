# Estado de Hatril

Última actualización: 21 de agosto de 2026.

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
  ministerios (rejilla, detalle, equipo, asignar, responsable y colíderes,
  tipo, misión, visión, objetivo y sus herramientas),
  solicitudes (bandeja con aprobar y rechazar), **líderes** (rol y permisos por
  persona, quitar y devolver el acceso), ajustes.
- **Permisos**: el pastor reparte seis capacidades desde `/panel/lideres`. Los
  roles `lider`, `tesorero` y `secretaria` ya son asignables — hasta la sesión
  del 16-ago solo existían por SQL.
- **Ministerios con varios líderes**: un responsable garantizado único por la
  base de datos, más los colíderes que hagan falta. Un líder gestiona los suyos
  y nada más (`gestionar_su_ministerio`).
- **Ministerios que hacen algo, no solo se ven**: cada uno tiene un **tipo**
  (alabanza, consolidación, niños, evangelismo, acción social, medios…) que al
  elegirlo enciende sus **herramientas**, y misión, visión y objetivo. El
  catálogo de tipos vive en `src/lib/ministerios/tipos.ts` y el de módulos en
  `modulos.ts`; lo encendido se guarda en `ministerios.modulos`, un jsonb
  validado con Zod por la única action que lo escribe.

  No se programa una pantalla por tipo: se programan piezas y cada tipo enciende
  las suyas, así que un ministerio de radio o de reparto de alimentos funciona
  sin tocar código. Hoy existen **dos módulos de verdad**, `agenda` y
  `seguimiento`; el resto no se declara hasta que se pueda pulsar.

- **Reuniones y asistencia**: `/panel/reuniones`. Apuntar el culto del domingo o
  el del jueves con su fecha, y marcar quién vino. **Se guarda fila también para
  quien faltó**, con `presente = false`: sin eso, un domingo en el que nadie pasó
  lista sería idéntico a uno en el que no vino nadie, y «lleva cinco domingos sin
  venir» empezaría a mentir. Cero filas significa «no se tomó asistencia».

  `miembros.ultima_asistencia` —columna que existía desde la `0000` y **no la
  escribía nadie**— la mantiene ahora un trigger por sentencia con tabla de
  transición, y se RECALCULA en vez de acumularse: desmarcar a alguien borra la
  fecha en vez de dejarla clavada. Permiso propio, `registrar_asistencia`, que la
  secretaría tiene por defecto. Verificado apuntando un culto, dejando fuera a
  dos personas y viendo moverse la columna en la base.

- **Agenda de cada ministerio**: `/panel/ministerios/[id]/agenda`. Ensayos,
  clases y salidas del equipo, con su propia lista. Dos guards en el layout:
  quién manda en ESE ministerio, y que el módulo esté encendido —si no, 404—. El
  ámbito de la lista es **el equipo**, nunca la congregación, y un ensayo **no**
  toca `ultima_asistencia`: a nadie se le consolida por faltar a un ensayo.

- **Seguimiento de personas** (consolidación): dentro del ministerio que lo
  lleve, `/panel/ministerios/[id]/seguimiento`. La congregación ordenada por
  cuántas reuniones seguidas se ha perdido cada persona, con su teléfono, quién
  la acompaña y lo último que se habló con ella. Dentro, asignar acompañante y
  apuntar cada llamada, visita o mensaje.

  **Se cuentan reuniones con lista tomada, no semanas de calendario.** Contra el
  reloj, una iglesia que lleve tres semanas sin apuntar nada vería a TODA la
  congregación como ausente, y el equipo llamaría a gente que fue el domingo
  pasado. A la tercera llamada así, el pastor deja de fiarse de la pantalla.

  **Sin campo de texto libre**, y es la decisión de todo el módulo: el motivo se
  elige de una lista de siete —hablamos, va a volver, no contestó, se mudó, está
  molesto con la iglesia, no hay forma de localizarle, lo lleva el pastorado—.
  El único campo escrito a mano es «qué toca ahora», acotado a 200 caracteres
  por un CHECK de la base y no solo por un comentario.

  Tres puertas para entrar: el permiso `ver_seguimiento` —que no es defecto de
  ningún rol, ni de secretaría—, ser responsable o colíder de ESE ministerio, y
  que el módulo esté encendido. La firma de cada contacto la comprueba la policy
  contra `miembro_actual()`: nadie apunta nada en nombre de otro. Y la tabla de
  contactos **no tiene UPDATE concedido**: un contacto es un hecho fechado, y si
  se apuntó mal se borra en vez de reescribirse.

- **Área del miembro**: `/mi`, y es una **app, no una página**. Quien pertenece a
  una iglesia y no lleva nada en ella ya no aterriza en el panel — antes veía un
  menú de ocho secciones donde no podía pulsar casi nada, con Miembros y
  Ministerios en la primera línea. Ahora abre y ve el muro de su congregación.

  Cuatro pestañas en una barra fija: **Comunidad · Devocional · Agenda · Mi
  cuenta**. Salieron siete candidatas en la conversación y se quedan las cuatro
  que se usan cada semana; la web de la iglesia y Donar viven dentro de Mi
  cuenta, que es donde se buscan las cosas de una vez al mes.

  - *Comunidad* es `/mi/comunidad`, el muro que ya existía. `/mi` es ahora solo
    el desvío que decide a dónde va cada quien.
  - *Devocional* enseña el del día, y si no hay, el último publicado **diciéndolo**
    — enseñar el de ayer callando hace que alguien se lo lea creyendo que es el
    de esta mañana. Consulta propia con `withUser`, gemela de la pública: aquélla
    exige `web_publica` porque sirve la calle, y a la gente de una congregación
    no se le esconde su devocional por que su web esté sin publicar.
  - *Agenda* junta los eventos de la iglesia y los ensayos de sus equipos. En el
    panel viven separados porque los gestiona gente distinta; para un miembro son
    la misma pregunta —qué tengo yo esta semana— y separarlas le obliga a mirar
    en dos sitios.
  - *Mi cuenta* trae sus ministerios con su papel y su objetivo, **Ofrendar** y
    cerrar sesión.

  **Ofrendar funciona de verdad desde el primer día** y no es una pasarela:
  enseña el `cuenta_donativos` que esa iglesia ya publica en su web, con el
  titular. Si la congregación no lo ha rellenado, **el botón no se pinta** — uno
  que al pulsarlo dice «tu iglesia no ha configurado esto» le pasa el problema a
  quien no puede resolverlo. Por Hatril no pasa dinero, que es lo que
  `/privacidad` §3 promete.

  **La barra es una pastilla flotante con glaseado**, y de dónde salió importa.
  La referencia era un componente de shadcn con `framer-motion`, sombras de dos
  capas, clases `dark:` y los nombres escondidos tras un tooltip. Se trajo el
  aspecto y no la implementación: sin librería —el brief dice «sin librerías de
  animación pesadas» y lo único que animaba era ese tooltip—, sin sombra —regla 3
  del sistema: la profundidad se hace con bordes de 1px—, sin `dark:` —modo claro
  únicamente— y **con los nombres siempre visibles**, porque en un móvil no hay
  ratón y serían cuatro dibujos sin nombre en la pantalla principal.

  El glaseado no es nuevo: es el `supports-[backdrop-filter]` que ya usaba
  `CabeceraMiembro`. Va con guarda a propósito — sin `backdrop-filter`, un fondo
  translúcido deja el texto ilegible sobre lo que haya debajo, y con la guarda
  ese navegador cae a fondo sólido.

  **Una sola barra `fixed`, no dos.** El primer intento eran una pegada abajo en
  móvil y otra en fila arriba para escritorio, y no funciona: la barra vive en el
  layout y cada página de `/mi` pinta su propia cabecera pegajosa, así que la
  superior salía siempre por encima de ella. Arreglarlo obligaba a subir las tres
  cabeceras al layout, y una de ellas es `/mi/avisos`, que funciona sin
  membresía. Con una sola fija el orden del DOM deja de importar: ancho completo
  en móvil, pastilla centrada en escritorio.

  El layout de `/mi` **no lleva guard**, y es la excepción a la regla del repo.
  Bajo `/mi` conviven pantallas con requisitos distintos y `/mi/avisos` tiene que
  seguir siendo alcanzable sin membresía. Cada página pone el suyo; el layout
  solo decide si pinta las pestañas.

  Quién va a cada sitio lo decide `esDelEquipo()` en `permisos.ts`, mirando las
  **capacidades efectivas** y no el nombre del rol: el pastor puede darle la caja
  o el devocional a alguien que sigue siendo `miembro`, y esa persona entra al
  panel sola. El corte vive en `panel/layout.tsx`, no en `requireIglesia()`, que
  lo usa también `/mi/comunidad`. Y el destino de después de entrar lo decide
  `inicioDe()` en un solo sitio: lo tenían escrito a mano tres actions como
  `/panel/hoy`, lo que mandaba al miembro al panel para que el layout lo
  devolviera, con su pantalla en blanco por medio.

  Verificado entrando como `miembro@hatril.test`: aterriza en el muro, las cuatro
  pestañas cargan, y `/panel/miembros` escrito a mano en la barra le devuelve.

  **Lo que falta y se nota:** el repertorio del domingo, los turnos y el material
  del equipo. Son módulos de la tanda siguiente.

- **Re-consentimiento**: `/acepta`. Cuando la política cambia de fondo se sube
  `VERSION_POLITICA_PRIVACIDAD` y el layout del panel corta el paso a quien
  aceptó una versión anterior, hasta que lea qué ha cambiado y vuelva a decidir.
  La casilla de la asistencia va **sin premarcar**: el considerando 32 del RGPD
  dice que una casilla ya marcada NO es consentimiento.

  Aceptar no reescribe la fila vieja, la revoca y escribe una nueva: el art. 7.1
  obliga a poder demostrar a qué redacción dijo que sí cada persona, y un
  `update` borraría esa prueba.

  Y negarse hace algo de verdad: quien no marca la casilla desaparece de la lista
  de asistencia y de la de seguimiento, **y se borran sus filas anteriores** en
  las tres tablas. Sin eso, la pantalla del culto se quedaba diciendo «7 de 9»
  con ocho personas debajo — y un número que no cuadra con la lista es un número
  del que el pastor deja de fiarse.

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
| Área del miembro | Hecha la base. Faltan el repertorio del domingo, los turnos y el material del equipo |
| Stripe | Nada. El trial vence y no pasa nada |
| Correo (Resend) | Nada. Ni bienvenida ni aviso de solicitud |
| Exportar y borrar datos | Derecho de supresión del RGPD, sin implementar |
| Cumpleaños de la semana en Inicio | Se puede: `fecha_nacimiento` existe. Va con `ver_datos_sensibles` y sin enseñar el año |
| Asistencia a escala | **Hecha la base, no la escala.** Marcar casillas una a una no sirve para 1.500 personas. Ver «Decidido y pendiente» |
| Notas de seguimiento en texto libre | A propósito NO están. Necesitan cifrado en reposo y base jurídica antes |
| Legales de la asistencia y el seguimiento | Hechos: `/privacidad` §3, §4 y §6, el anexo del art. 28 en `/terminos`, y el consentimiento propio |
| Los bloques de asistencia en Inicio | El diseño los pinta y siguen sin pintarse: el dato ya existe |
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

**Un `alter type ... add value` no se puede usar en la misma transacción.**
Postgres deja añadir el valor al enum, pero no escribirlo hasta que la
transacción confirme — y una migración ES una transacción. Por eso
`origen_asistencia_enum` nace en la `0031` con los cuatro valores (`panel`,
`lider`, `qr`, `autoconfirmado`) aunque hoy solo se escriba el primero: hacerlo
dentro de un año obligaría a partir la migración en dos pasadas, con meses de
listas dentro. Un enum se completa cuando la tabla está vacía, no cuando hace
falta.

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

**Un `blur` no distingue «me he ido» de «he abierto el diálogo de ficheros».**
Al abrir el selector de archivos del sistema, el foco sale de la página y el
evento llega con `relatedTarget` a `null` — exactamente igual que si la persona
se hubiera ido a otra pestaña. El publicador del muro pliega su fila de acciones
cuando nadie escribe, y sin cubrir este caso la fila desaparecía justo bajo el
dedo mientras se elegía la foto. Se tapa con una bandera que se levanta en el
`pointerdown` de la etiqueta y se baja con el `focus` de la ventana: el navegador
**no avisa de una cancelación** del diálogo —no hay `change`, y `cancel` no llega
en todos—, así que bajarla en el `change` la dejaría levantada para siempre.

Y dos hermanos del mismo caso: moverse entre controles de dentro del formulario
tampoco es salir (`currentTarget.contains(relatedTarget)`), y con texto escrito o
fotos elegidas no se pliega nunca — esconder el botón de publicar encima de un
borrador es peor que ocupar sitio.

**Plegar algo con estado tiene que nacer desplegado.** El mismo publicador
arranca con `abierto = true`, así que el HTML del servidor ya trae el botón de
publicar y quien no tenga JavaScript sigue pudiendo enviar. Y se pliega con
`useLayoutEffect` y no con `useEffect`: con el segundo el navegador alcanza a
dibujar la fila y la quita al fotograma siguiente, un parpadeo en cada carga del
muro. Como `useLayoutEffect` no existe en el servidor, va tras el alias habitual
que elige uno u otro según dónde se ejecute.

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

- **Confirmar el país del centro de datos.** `ALOJAMIENTO` ya está relleno:
  **Hostinger International Limited**, que es el nombre con el que está
  registrado el AS47583 dueño del rango del despliegue —el hostname resuelve a
  `srv1478310.hstgr.cloud`—. Falta afinar una sola cosa: se escribió «Alemania
  (UE)» porque es lo que consta, y la geolocalización de la IP devuelve
  **Francia**. Las dos son UE, así que la frase de `/privacidad` se sostiene
  igual, pero el dato exacto hay que mirarlo en hPanel → VPS → la ficha del
  servidor, no en una base de geolocalización.

  Y de paso: **este fichero decía que la IP del despliegue «no está en un rango
  europeo» y era falso.** `187.124.37.206` pertenece a Hostinger, AS47583, con
  registro europeo. Era una suposición por el `187.x` —que suele ser
  latinoamericano— que nadie había comprobado. Que los datos guardados
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

**Lo que queda de los legales, que ya no es el bloqueo.** Los textos están
reescritos y revisados contra el código, y la versión subió a
`privacidad-2026-09` con su pantalla de re-consentimiento detrás. Queda:

- **`ALOJAMIENTO` sigue con [PENDIENTE]**, y es lo único que mantiene el aviso
  rojo sobre `/privacidad` y `/terminos`. Hacen falta el nombre legal del
  proveedor del VPS y el país del centro de datos. Ojo: la IP del despliegue no
  parece de un rango europeo, así que conviene comprobarlo antes de escribir
  «UE» en una política.
- **El derecho de supresión sigue siendo manual**, como lo era antes: §4 dice
  que se tramita escribiendo a la iglesia o a Hatril, así que el texto no miente.
  Lo que cambia es que ese borrado a mano tiene ahora tres tablas más que
  recordar —`asistencias`, `seguimiento_contactos` y `seguimiento_asignaciones`—
  además de las de siempre. Lo único automatizado es el borrado de un contacto
  suelto, y el borrado completo que dispara negarse en `/acepta`.
- **El diezmo nominativo** sigue esperando su propio valor de consentimiento,
  por las mismas razones de siempre.

**El corte del consentimiento está en TRES sitios y no en uno.**
`exigirConsentimientoAlDia()` se llama desde `panel/layout.tsx`, desde `/mi` y
desde `/mi/comunidad`. No puede vivir dentro de `requireIglesia()`, que sería lo
natural, porque `/acepta` llama a ese mismo guard y la pantalla se redirigiría a
sí misma para siempre. Al añadir una pantalla nueva que trate datos, hay que
acordarse. `/mi/avisos` queda fuera a propósito: a quien le rechazan la solicitud
se le borra la membresía en el mismo movimiento, y el aviso que se lo explica
tiene que seguir siendo alcanzable.

Tres cosas de los legales que conviene no deshacer, porque costaron encontrarlas:

- La casilla de la asistencia **no se premarca**. Considerando 32.
- Negarse **borra**, no solo oculta. Filtrar las pantallas y conservar las filas
  dejaba números que no cuadraban con las listas, y seguir enseñando un dato en
  un recuento es seguir tratándolo.
- `miembrosSinPermisoDeAsistencia()` excluye a quien **vio la casilla y no la
  marcó**, no a quien nunca llegó a verla. La primera versión hacía lo segundo y
  hacía falsa una frase de `/privacidad` §4 recién escrita; lo cazó revisar frase
  por frase contra el código, no releer el texto.

**La asistencia a escala.** Marcar casillas una a una funciona para una
congregación de 40 o 150, que es el mercado inicial. Para 1.500 no. El dato
tendrá que venir también de otro sitio, y por eso `asistencias.origen` ya existe
con sus cuatro valores. Ordenadas de más sólida a menos:

1. **Check-in con QR en la puerta.** La persona escanea y se marca sola. Es lo
   que hacen las iglesias grandes, y **no necesita app**: una URL con token
   rotatorio funciona desde cualquier móvil.
2. **Cada líder marca su grupo.** 1.500 personas son 120 líderes marcando doce
   cada uno. Encaja con los ministerios que ya existen y no añade infraestructura.
3. **Buscador y filtro en la lista actual.** Con 1.500 no se hace scroll, se
   escriben tres letras. Es lo más barato de todo.
4. **Autoconfirmación por aviso**, como complemento.

Y la regla que hace que lo anterior no destruya el dato: **quien no contesta no
es quien no vino.** Si la autoconfirmación llega a alimentar el «lleva cinco
domingos sin venir», el silencio tiene que seguir siendo AUSENCIA DE FILA —«no
lo sabemos»— y nunca una fila con `presente = false`. Confundirlos pone a
consolidación a llamar a gente que vino todas las semanas, y a la tercera
llamada el pastor deja de fiarse del producto.

Ojo con la dependencia: la autoconfirmación necesita app (Capacitor no está ni
en `package.json`), push (cero referencias en el repo) y que la gente tenga
cuenta (`miembros.auth_user_id` es nullable y casi ninguna ficha la tiene).

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
