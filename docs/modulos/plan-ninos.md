# Ministerio de Niños — plan

20 de noviembre de 2026. **Aprobado por Marlon el 20-nov-2026, con las doce
decisiones del final tal como están.** La 2 (sin clases en la v1) depende de
que la profesora tenga una o dos clases: falta preguntárselo.

**Estado, 21-nov.** Marlon: «Sí, arráncalo». Confirmó la 2 (una o dos clases:
v1 sin clases) y la 10 (versión propia `ninos-2026-11`).

- **N0 hecha**: los textos, en `ninos-textos.md`, para el abogado. No están en
  el código ni en `/privacidad`.
- **N1 hecha**: `0059` (siete tablas) y `0060` (RLS, funciones, triggers
  HT142-HT144 y los buckets `ninos-fotos` y `ninos-videos`), aplicadas.
  `test:aislamiento` en verde con 36 comprobaciones nuevas de Niños sobre la
  demo de usar y tirar (`maestra`, `auxiliar`, `madre` y `madre2` en
  `scripts/pruebas/demo.mjs`). `get_advisors` no se pudo pasar (el conector de
  Supabase no tiene permiso); sus comprobaciones de seguridad, repetidas por
  SQL, salen limpias.
- **N2 hecha**, sin migración: el módulo «Tablón de familias» en
  `modulos.ts`, y `/panel/ministerios/[id]/ninos` con Tablón (borrador →
  fotos del drive → publicar, con la casilla de «he mirado las fotos»),
  Cronograma, Drive (el teléfono reduce las fotos a WebP y sube con una URL
  firmada de un solo uso; los vídeos, de un minuto y 100 MB) y Familias
  (aceptar, «es el mismo que…», rechazar, quitar). Lo enciende el pastor
  marcando el compromiso, que se guarda en `modulos.ninos.compromiso`. En un
  ministerio con el tablón, los colíderes y la responsable tienen que tener
  cuenta. Probado en el navegador con una iglesia de prueba, a 375 px, cada
  botón; `test:puertas` 77 rutas y 483 combinaciones sin fallos, con la
  maestra, la auxiliar y la madre; `test:aislamiento` en verde. Y un
  adaptador mínimo para la portada del equipo (`lib/ninos/en-la-app.ts`, con
  `visiblePara` estrecho): sin él, la tarjeta de respaldo le saldría a
  secretaría y le rebotaría. Lleva al panel; lo de la app de verdad es la N5.
- **Cambio sobre §7**: el tablón NO va en la plantilla del tipo «Niños»
  (`tipos.ts`). Compromete a la iglesia, así que no se enciende solo al crear
  el ministerio: lo enciende el pastor desde «Editar», con el compromiso.
- **Pendiente de Marlon**: mirar en Supabase (Storage → Settings) el «Global
  file size limit». Si es menor de 100 MB, los vídeos se cortan ahí.
- **Antes de desplegar la N2**: con ella en hatril.com, el pastor de Cuerpo de
  Cristo podría encender el tablón y los maestros subir fotos de niños de
  verdad antes de que el abogado revise los textos. Desplegar cuando esté la
  revisión, o desplegar y no encenderlo.
- **Lo siguiente**: N3 (el cron del año, el aviso de 30 días y el ZIP por
  mes). Mientras no esté, nada se borra solo: la fecha de borrado que enseña
  la pantalla es una promesa sin cron detrás.

Lo pidió la líder del ministerio de niños de Cuerpo de Cristo, contado por
Marlon el 20-nov: un tablón para los padres, un cronograma para los maestros,
un «drive» de fotos y vídeos que se vacía al año, y que ella invite a los
maestros.

Parte del análisis de la escuela dominical del 19-oct
(`analisis-2026-10-19.json`, clave `escuela`) y lo recorta a lo que se ha
pedido ahora. Aquel diseño (fichas completas, entrada y recogida, alergias)
sigue siendo la v2.

---

## 1. Qué es la v1 y qué se queda fuera

**Recomendación: v1 = las cuatro cosas pedidas, y nada más.**

| Entra en la v1 | Se queda fuera, a propósito |
|---|---|
| **Vínculo padre → hijo**: el padre dice «tengo un hijo aquí» y la líder lo acepta | La ficha completa del niño (apellidos, fecha de nacimiento, foto de perfil) |
| **Tablón**: lo que se hizo cada día, con texto, fotos y vídeos. Lo ven solo las familias aceptadas | Comentarios de los padres, chat con la maestra, «me gusta» |
| **Cronograma**: fecha, tema y puntos de cada clase. Solo maestros | Notas o comportamiento por niño. Nunca: en texto libre acaban diciendo salud o situación familiar |
| **Drive**: fotos y vídeos del ministerio, que se exportan y se borran al año | Entrada y recogida con código, alergias (v2, el diseño del 19-oct) |
| **Maestros**: la líder los nombra, deben tener cuenta en la iglesia | Clases por edad: ver decisión 2 |
| | Etiquetar niños en las fotos o reconocer caras (sería dato biométrico) |

**Bien separado de lo demás**: nada de esto sale en el muro, en la web
pública, en el directorio ni en el bucket público. Tablas propias, buckets
propios y RLS propia.

**Hasta 13 años** (por año de nacimiento). En España, desde los 14 consiente
el propio menor (LOPDGDD art. 7.1), y este flujo de «lo autoriza el padre» ya
no vale. Los adolescentes van a Jóvenes, sin fotos.

---

## 2. Cómo funciona, en una pasada

1. **El pastor enciende el módulo** en el ministerio de Niños, con una casilla
   de compromiso de la iglesia (ver §4). Hoy los módulos los encienden el
   pastor y `gestionar_ministerios`; este, solo el pastor, porque la casilla
   compromete a la iglesia.
2. **La líder (responsable) nombra a los maestros** como colíderes, que es como
   ya funciona hoy. Solo salen en la lista personas con cuenta activa en esa
   iglesia: sin cuenta no pueden usar la app.
3. **El padre, en la app**: «Mis hijos» → «Tengo un hijo en Niños»: nombre con
   el que le llaman, año de nacimiento, parentesco y las casillas de §4. Queda
   **pendiente**, y no ve nada.
4. **La líder lo acepta o lo rechaza** después de comprobar EN PERSONA que es su
   padre o su madre. Hatril no puede comprobarlo; la pantalla lo dice. Si es el
   segundo progenitor de un niño que ya está, elige «es el mismo que…». Rechazar
   borra la solicitud entera.
5. **Los maestros** suben fotos y vídeos al drive, publican en el tablón lo que
   se hizo (texto y archivos elegidos del drive) y leen el cronograma. Al
   publicar ven arriba **la lista de niños que pueden salir en fotos**.
6. **El padre aceptado** recibe un aviso con cada publicación y ve el tablón
   **desde el día en que se le aceptó**, no antes.
7. **Al año**, cada mes de archivos se exporta en un ZIP y se borra (§5).

---

## 3. Tablas y RLS

Todas con `iglesia_id` y `ministerio_id` (redundantes a propósito, como dice
`CLAUDE.md`), triggers HT de coherencia de iglesia y ministerio, sin
`auditar()` (su tabla no se puede borrar y lo lee entera `hatril_app`), y en
cada migración: **`revoke all ... from anon, authenticated, service_role`
primero, y después `grant` a `hatril_app`**. Cada función nueva, revocada en su
propia migración y concedida solo a `hatril_app`.

| Tabla | Qué guarda | Quién la ve (RLS) | Quién escribe |
|---|---|---|---|
| `ninos_solicitudes` | La petición del padre: nombre del niño, año, parentesco, las casillas marcadas, versión del texto, IP y user agent. **Se borra al resolverse** | El padre que la pidió; la responsable y el pastor | El padre (insertar y retirar la suya) |
| `ninos` | Nombre como le llaman (≤ 60), año de nacimiento. Nada más | Sus padres aceptados; quien lidera ese ministerio; el pastor | Solo vía `aceptar_solicitud_nino()` |
| `nino_familias` | Padre (ficha) ↔ niño, parentesco, quién aceptó y cuándo | El propio padre; quien lidera; el pastor | Aceptar: responsable o pastor. Desvincularse: el propio padre |
| `nino_consentimientos` | Por niño, padre y tipo (`vinculo`, `imagen`): versión, fecha, IP, user agent, `revocado_at` | El propio padre; quien lidera; el pastor | Los crea la función de aceptar; el padre solo puede poner `revocado_at` (grant por columna) |
| `ninos_cronograma` | Fecha, tema (≤ 120), puntos (≤ 2.000), maestro que la da | **Quien lidera ese ministerio y el pastor. Nadie más** | Quien lidera |
| `ninos_publicaciones` | Fecha, texto (≤ 1.000), autor, `publicada_at`, `caduca_at` | Quien lidera; el pastor; **las familias aceptadas, solo publicadas y con fecha ≥ su aceptación** | Quien lidera |
| `ninos_archivos` | El drive: ruta, miniatura, foto o vídeo, bytes, duración, quién lo subió, publicación (si va en una), `caduca_at`, `exportado_at` | Quien lidera; el pastor; las familias, **solo los que van en una publicación que pueden ver** | Quien lidera |

**Funciones de RLS**: reutiliza `lidera_ministerio()` (responsable o colíder,
de la `0042`) y `es_pastor()`. Nuevas: `es_responsable_de(ministerio)`,
`es_familia_de(nino)` y `familia_desde(ministerio)` (la fecha de aceptación más
antigua del padre en ese ministerio). Y `aceptar_solicitud_nino(solicitud,
nino_existente)`, `security definer`, que comprueba que quien llama es
responsable o pastor y en una transacción crea el niño (o usa el existente), el
vínculo y los consentimientos, y borra la solicitud.

**Quién ve qué, en una frase por persona:**

- **El padre**: su hijo, su vínculo, sus permisos y el tablón publicado desde
  que le aceptaron. Ni otros niños, ni otros padres, ni el cronograma, ni el
  drive.
- **El padre pendiente o rechazado**: nada.
- **Maestros (colíderes) y responsable**: todo lo del ministerio. Aceptar padres,
  solo la responsable (decisión 3).
- **El pastor**: todo.
- **Secretaría, `gestionar_ministerios`, otros líderes, miembros**: nada, aunque
  tengan `ver_todos_los_miembros`. En la app la puerta es
  `puedeGestionarDesdeDentro`, como el reparto.

Es una excepción consciente a «la RLS solo aísla iglesias», la misma que ya
hizo el reparto (`0042`): aquí la llave es la relación padre–hijo, y un fallo
de la aplicación no puede enseñar el niño de una familia a otra de la misma
iglesia.

**Storage**: dos buckets **privados** y sin ninguna policy para `anon` ni
`authenticated`: `ninos-fotos` (5 MB, `image/webp` y `image/jpeg`) y
`ninos-videos` (100 MB, `video/mp4` y `video/quicktime`). Las URL las firma el
servidor (10 minutos) solo después de que `withUser()` haya devuelto la fila.

**Numeración**: la siguiente libre en `main` hoy es la **0059** y **HT142**.
Va en la cola de migraciones (`cola.md`): confirmarlo al empezar.

---

## 4. Menores: qué consentimiento hace falta y quién lo da

Lo verificado en el texto oficial (BOE, AEPD y el régimen legal de Bogotá). Lo
que no pude verificar está marcado.

### España

- **Menores de 14: consiente quien tiene la patria potestad o tutela**
  (LOPDGDD art. 7.2), «con el alcance que determinen» ellos.
- **La AEPD admite que las familias vean fotos de actividades en un espacio
  cerrado**, con identificación previa y «limitándose a las imágenes» de las
  actividades en que participó su hijo, y recuerda que quien las ve no puede
  publicarlas en internet. Para cualquier otro uso, consentimiento. De ahí que
  el padre vea solo desde que se le acepta y nunca fuera de la app.
- **Imagen (LO 1/1982 art. 3)**: el menor sin madurez suficiente consiente por
  escrito a través de su representante legal, que debe ponerlo **antes en
  conocimiento del Ministerio Fiscal**. Los colegios no lo hacen para fotos de
  uso interno, pero eso es práctica, no lo que dice la norma. **Lo tiene que
  resolver un abogado.**
- **Religión**: que un niño vaya a la escuela dominical revela la religión de
  él y de su familia (RGPD art. 9). Se pide el consentimiento explícito, como
  ya hace Hatril. El RGPD art. 9.2 no lo leí en esta sesión.
- **Uno o los dos progenitores**: la ley dice «el titular» en singular. No he
  podido verificar el art. 156 del Código Civil ni un criterio de la AEPD.
- **Maestros (LOPIVI, LO 8/2021, arts. 57 y 59)**: certificado negativo del
  Registro Central de Delincuentes Sexuales para actividades, «retribuidas o
  no», con contacto habitual con menores, voluntariado incluido. Es obligación
  de la iglesia. **Hatril no lo guarda** (antecedentes penales, RGPD art. 10):
  solo lo recuerda en la casilla de activación.

### Colombia

- **Ley 1581 art. 7**: «Queda proscrito» tratar datos de niños, niñas y
  adolescentes, salvo los de naturaleza pública, y se asegurarán sus derechos
  prevalentes.
- **Decreto 1377 art. 12**: se puede si responde a su **interés superior** y
  respeta sus derechos fundamentales. Autoriza **el representante legal**,
  «previo ejercicio del menor de su derecho a ser escuchado», según su
  madurez. La Sentencia C-748/2011, que modula el art. 7, no la pude leer
  entera.
- **Datos sensibles (Ley 1581 art. 5)**: las convicciones religiosas y los
  datos biométricos. Hay que decir que **no está obligado a autorizarlos**
  (Decreto 1377 art. 6). Una foto normal no es biométrica mientras no se use
  para identificar a nadie; esto último es lectura mía, sin criterio de la SIC.
- **Menor es hasta los 18** (Ley 1098 art. 3; niño hasta los 12). Con el corte
  de 13 años, el flujo del padre cubre los dos países.
- **Intimidad** (Ley 1098 art. 33): protección contra toda injerencia
  arbitraria. No menciona la imagen expresamente.
- **Los datos se guardan en Irlanda** (eu-west-1). La Ley 1581 art. 26 prohíbe
  transferir a países sin nivel adecuado, salvo autorización «expresa e
  inequívoca». No pude verificar si la SIC tiene a la UE por adecuada (su web
  falló). **Recomendación**: decirlo en la casilla, y así vale la excepción.

### Lo que se pide en la app, y quién

El **padre, la madre o el tutor legal**, al pedir el vínculo. Dos casillas
**sin premarcar**:

1. **Obligatoria**: «Soy su madre, padre o tutor legal. Autorizo a [iglesia] a
   guardar su nombre y año de nacimiento en el ministerio de Niños y a
   enseñarme lo que hacen. Sus datos se guardan en servidores de la Unión
   Europea (Irlanda).» Y, para Colombia: «He hablado con mi hijo o hija y lo
   sabe».
2. **Opcional**: «Puede salir en las fotos y vídeos de las actividades, que
   solo ven las familias del ministerio en la app y se borran al año». No
   marcarla **no impide** el vínculo (RGPD art. 7.4: no condicionar).

**Reglas de producto que salen de aquí:**

- Un niño **solo puede salir en fotos si todos sus padres vinculados lo
  permiten**. Si uno lo retira, deja de poder.
- Retirar el permiso de imagen avisa a la responsable para que quite las fotos
  en las que salga. Hatril no sabe quién sale en cada foto y no debe saberlo.
- Al publicar, el maestro ve **«pueden salir en fotos: …»**. Cualquier niño que
  no esté en esa lista, incluidos los que no tienen padres en la app, no sale.
- El padre ve, no descarga. Las capturas de pantalla no se pueden impedir: el
  tablón lo recuerda («no compartas fotos de otros niños»).
- La casilla de activación del pastor: la iglesia comprueba en persona quién es
  cada padre, pide el certificado negativo a sus maestros (España) y no sube
  estas fotos a redes ni a la web.

### `/privacidad` y `/terminos` cambian

Sí. Hay una categoría nueva (datos e imagen de menores y el vínculo con sus
padres), un plazo nuevo (un año) y quien ve las fotos (las familias del
ministerio). También el anexo del art. 28 de `/terminos` §7.

**Recomendación**: el consentimiento del niño lleva **su propia versión**
(`ninos-2026-11`), para no mandar a toda la congregación a `/acepta`. El
apartado nuevo de `/privacidad` y `/terminos` entra en la subida de versión que
ya está pendiente (consolidación, radio, OpenStreetMap, Google y Apple).
**Esa versión la decides tú.**

**Y antes de la primera foto real de un niño, que un abogado de protección de
datos revise los dos textos**, sobre todo la LO 1/1982 y lo de uno o dos
progenitores. Es lo mismo que se hizo con las fotos de Remar: no se subieron
porque salían niños.

---

## 5. El drive

**Recomendación: Supabase Storage, comprimir las fotos en el teléfono, vídeos de
un minuto como mucho.**

- **Fotos**: el teléfono las reduce a 1.600 px en WebP (unos 400 KB) y saca una
  miniatura de 400 px (unos 40 KB). Sin las transformaciones de imagen de
  Supabase: cobran 5 $ por cada 1.000 imágenes de origen, pasadas las 100
  incluidas del plan Pro.
- **Vídeos**: 60 segundos y 100 MB como mucho. En 1080p eso son entre 45
  segundos y un minuto, según el teléfono; en 4K, unos 15. La pantalla dice
  «grábalo en 1080p o recórtalo». Comprimir vídeo en el teléfono pide un plugin
  nativo: v1.1.
- **La subida no pasa por el VPS**. El servidor comprueba la guarda, apunta la
  fila y pide a Storage una **URL de subida firmada de un solo uso para esa
  ruta** (`createSignedUploadUrl`), y el teléfono sube con ella. Después
  confirma, y el servidor comprueba tamaño y tipo. Es una excepción a «el
  navegador no habla con Storage», pero `authenticated` sigue sin ningún
  permiso. Un vídeo de 100 MB por una server action habría que subir el límite
  de 21 MB y pasarlo entero por el VPS. Subida reanudable (TUS) para vídeo: la
  recomienda Supabase a partir de 6 MB; se mide en la fase N2.

### Coste estimado (precios oficiales de Supabase, plan Pro)

Una escuela de unos 30 niños, cada domingo: 15 fotos y 2 vídeos de un minuto.

| | Por iglesia | Precio | Coste |
|---|---|---|---|
| Almacenado (un año, y se borra) | ~5,5 GB (0,35 de fotos, 5,2 de vídeo) | 100 GB incluidos, luego 0,0213 $/GB/mes | ~0,12 $/mes |
| Descargas (la mitad de familias ve los vídeos) | ~7 GB/mes | 250 GB incluidos, luego 0,09 $/GB | ~0,63 $/mes |

**Menos de 1 $ al mes por iglesia que lo use a fondo**, y nada hasta pasar de
unas 15–35 iglesias (lo incluido es para todo Hatril). El 90 % es vídeo. Sin
comprimir las fotos, se multiplica por diez.

### «Extraer al año»

**Recomendación: por meses, con aviso.**

- Los archivos de un mes se borran **el día 1 del mes siguiente al cumplir el
  año** (lo de noviembre de 2026, el 1-dic-2027). Así se exporta un mes entero
  de una vez y nada vive más de 13 meses.
- **30 días antes**, aviso a la responsable: «el 1 de diciembre se borran 84
  fotos y 9 vídeos de noviembre de 2026. Descárgalos».
- **Exportar**: botón «Descargar noviembre» en el panel web, un ZIP que el
  servidor va armando según lo lee de Storage, sin guardarlo. Pide la guarda de
  API por ministerio que hoy no existe (`requireGestionMinisterioApi`, la misma
  que le faltó al CSV del reparto). Al descargar: «desde ahora estas fotos las
  guardas tú; no las subas a redes sin permiso de las familias».
- **Las publicaciones del tablón se borran con sus fotos**, texto incluido.
- **El cron**, `POST /api/v1/cron/ninos`, una vez al día: avisa, borra lo
  caducado (Storage y filas) y las subidas que nunca se confirmaron. **Tiene el
  mismo problema que el cron de las bajas**: no hay ninguno programado. Se
  programan los dos a la vez, con `INTERNAL_API_TOKEN` en Dokploy, antes de que
  se suba la primera foto real.

---

## 6. Dónde va cada pantalla

**Recomendación: lo de la líder y los maestros, ya, en el panel web; lo de los
padres, solo en la SPA de `movil/`.** La web `/mi` está congelada.

| Quién | Qué | Dónde |
|---|---|---|
| Pastor | Encender el módulo con la casilla de compromiso | Panel web, como hoy |
| Responsable | Aceptar padres, nombrar maestros, cronograma, drive, publicar, exportar | Panel web, `/panel/ministerios/[id]/ninos/*` (responsive: el panel ya funciona a 375 px) |
| Maestros | Cronograma, drive, publicar | Panel web ya (son colíderes, entran al panel) y **en la app** con la fase 4 de la SPA |
| Padres | Pedir el vínculo, ver el tablón, retirar permisos, desvincularse | **Solo en la app** (`/mi/hijos`), tras la fase 3 de la SPA |

**El orden, encajado en las fases de `plan-spa.md`:**

- **Ahora**, en paralelo a la obra de la SPA (no toca `movil/` ni `/mi`):
  N1, N2 y N3.
- **Tras la fase 3 de la SPA** (cuenta y Biblia; la pestaña de cuenta ya
  existirá): N4, los padres.
- **Con la fase 4 de la SPA** (Equipo): N5, los maestros en la app, por el
  contrato `ModuloEnLaApp` de `en-la-app/contrato.ts`.

Consecuencia: el cronograma y el drive funcionan en unas dos semanas, y **los
padres no ven el tablón hasta dentro de unas cinco o seis**. Hacerlo antes en
`/mi` sería hacerlo dos veces.

Los endpoints de los padres (`/api/v1/app/hijos/*`) van detrás de `rutaApp()`
y en `test:puertas:app`. `src/lib/api/app.ts` y `src/app/api/v1/app/` son hoy
de la sesión de la SPA: se coordina con ella al llegar a N4.

---

## 7. Fases

| Fase | Qué | Cómo se prueba | Esfuerzo |
|---|---|---|---|
| **N0. Textos** | Las dos casillas, la casilla del pastor, `/privacidad` y `/terminos` §7 redactados. Tu decisión de versión. La revisión del abogado | Leerlos frase a frase contra lo que hará el código | ½ día + el abogado |
| **N1. Base** | Migraciones (tablas, funciones, buckets), módulo `ninos` en `modulos.ts`, tipo Niños con él encendido | `test:aislamiento` con un bloque nuevo (abajo). `get_advisors` de seguridad sin ningún WARN. `has_table_privilege` de `anon` y `authenticated` en falso para las siete tablas. `proacl` de cada función nueva | 3–4 días |
| **N2. Panel** | Encender con la casilla; solicitudes (aceptar, rechazar, «es el mismo que…»); maestros con cuenta; cronograma; drive con subida de fotos y vídeos; tablón con vista previa | `test:puertas` con las rutas nuevas (8 cuentas, normal y `RSC: 1`). Abrir y pulsar como responsable, colíder, pastor, secretaria y miembro: subir un vídeo de 90 MB desde el móvil, publicar, comprobar que `miembro@` y `secretaria@` reciben 404 | 1–1,5 semanas |
| **N3. El año** | Cron, aviso, ZIP por mes, guarda de API por ministerio | El cron contra filas con `caduca_at` en el pasado: borra en Storage y en la base, y deja lo demás. Descargar y abrir el ZIP | 2–3 días |
| **N4. Padres (SPA)** | Endpoints, «Mis hijos», pedir vínculo, tablón, retirar permisos, desvincularse, avisos y push | `test:puertas:app`. En Chrome a 375 px contra el Next local: pedir, aceptar, ver solo desde la aceptación, retirar la imagen y ver que el niño sale de «pueden salir». Push en el emulador | 1 semana |
| **N5. Maestros (SPA)** | Cronograma y publicar desde Equipo | `test:puertas:app` y abrir y pulsar como colíder en la app | 3–4 días |

**Total: unas 4 semanas**, 2 ya y 2 encajadas en la SPA.

**Lo que tiene que probar `test:aislamiento`** (y con la segunda fase por
`withUser()`, no solo SQL a mano):

- El padre aceptado ve a su hijo y no al de otra familia del mismo ministerio.
- El padre pendiente, el rechazado y el desvinculado no ven nada.
- El padre no ve publicaciones anteriores a su aceptación, ni las no
  publicadas, ni el cronograma, ni archivos sin publicación.
- Un colíder de otro ministerio, la secretaria y un miembro raso: nada.
- Un colíder de Niños no puede aceptar padres (si se decide así, decisión 3).
- El padre no puede tocar más que su `revocado_at`.
- Sion no ve Betania.

Cuentas de prueba nuevas: `maestra@` (responsable de Niños en Betania) y
`madre@` (madre de un niño de prueba). Niños ya tiene responsable y colíder en
la demo, pero sin cuenta conocida.

---

## 8. Riesgos

| Riesgo | Qué se hace |
|---|---|
| **Alguien se hace pasar por padre** y ve las fotos de todos los niños | Acepta solo la responsable (o el pastor), en persona; la pantalla lo pide. Ve solo desde que se le acepta. Queda quién aceptó y cuándo |
| **Sale en una foto un niño sin permiso** | La lista «pueden salir» al publicar, y quitar la foto en un toque. No se puede impedir con código sin reconocer caras, y eso no se hace |
| **Un padre hace capturas** y las comparte | No se puede impedir. Se avisa en el consentimiento y en el tablón |
| **Brecha con fotos de menores**: aviso en 72 h (RGPD art. 33) y casi seguro a las familias | Buckets privados, URL de 10 minutos, nada en el público, nada guardado en disco en la app (`plan-spa.md` §3) |
| **El cron no está programado** y el «se borra al año» es falso | Programarlo con el de las bajas antes de la primera foto real |
| **La LO 1/1982 y uno o dos progenitores**, sin resolver | Abogado antes de la primera foto real |
| **Vídeos grandes** que fallan con mala cobertura, y el coste | 100 MB y 60 s; reanudable si hace falta; el 90 % del coste es vídeo |
| **Los padres esperan** a la SPA | Es el precio de no hacerlo dos veces. Cronograma y drive salen antes |
| **El aviso de una publicación en la campana web** lleva a `/mi/hijos`, que en la web no existe | Que la campana web diga «ábrelo en la app» para ese tipo |
| **La numeración**, con células sin fusionar | Va en la cola de `cola.md`, de una en una |
| **La iglesia**, como responsable del tratamiento, probablemente necesita una evaluación de impacto (menores y categoría especial) | Decírselo en la activación. Una plantilla, fuera de la v1. La lista vigente de la AEPD no la verifiqué |

---

## 9. Decisiones que necesito de ti

1. **Alcance**: la v1 de §1, sin fichas completas, sin recogida, sin alergias,
   sin chat. **Recomiendo sí.**
2. **Clases**: un solo tablón y un solo cronograma por ministerio en la v1; las
   clases por edad, sobre la pieza de grupos de células cuando esté en `main`.
   **Recomiendo sí**, si la profesora tiene una o dos clases. **Pregúntale
   cuántas tiene.**
3. **Quién acepta a los padres**: la responsable, y el pastor de respaldo. Los
   maestros no, aunque sean colíderes: es la puerta que deja ver a todos los
   niños. **Recomiendo sí.**
4. **Quién invita a los maestros**: la responsable, como ya funciona con los
   colíderes; el pastor nombra a la responsable. Solo personas con cuenta en
   esa iglesia. **Recomiendo sí.** No hace falta nada nuevo, salvo el filtro
   «con cuenta».
5. **Fotos**: permiso opcional por niño, sin premarcar; sale solo si lo dan
   todos sus padres vinculados. **Recomiendo sí.**
6. **El padre nuevo ve desde que se le acepta**, no el historial. **Recomiendo
   sí** (es el criterio de la AEPD).
7. **Vídeo**: 60 s y 100 MB, sin comprimir en la v1. **Recomiendo sí.**
8. **Subida directa a Storage con URL firmada de un solo uso.** **Recomiendo
   sí.**
9. **«Extraer al año»** por meses, con aviso 30 días antes, ZIP desde el panel
   y el tablón borrado con sus fotos. **Recomiendo sí.**
10. **Textos legales**: versión propia del consentimiento del niño
    (`ninos-2026-11`) y el apartado de `/privacidad` y `/terminos` en la
    próxima subida. **La versión la decides tú.**
11. **Abogado antes de la primera foto real.** **Recomiendo sí.**
12. **El orden** de §6: panel ya; padres tras la fase 3 de la SPA; maestros en
    la app con la fase 4. **Recomiendo sí.**

---

## Fuentes consultadas el 20-nov

- [LOPDGDD (LO 3/2018), arts. 7 y 9 — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673)
- [LO 1/1982, art. 3 — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-1982-11196)
- [LO 1/1996, art. 4 — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-1996-1069)
- [LOPIVI (LO 8/2021), arts. 48, 57 y 59 — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2021-9347)
- [AEPD: ¿pueden los colegios tomar imágenes de los alumnos?](https://www.aepd.es/prensa-y-comunicacion/blog/pueden-los-colegios-tomar-imagenes-de-los-alumnos-durante-su-actividad)
- [AEPD: guía para centros educativos](https://www.aepd.es/guias/guia-centros-educativos.pdf) (marcada «en revisión»; la frase de las familias sale de aquí, leída en el extracto del buscador, no en el PDF)
- [AEPD: infografía del consentimiento de menores](https://www.aepd.es/infografias/infografia-consentimiento-menores.pdf)
- [Ley 1581 de 2012, arts. 5, 6, 7 y 26 — Régimen legal de Bogotá](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981)
- [Decreto 1377 de 2013, arts. 6 y 12 — Régimen legal de Bogotá](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646)
- [Ley 1098 de 2006, arts. 3 y 33 — Régimen legal de Bogotá](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=22106)
- [Supabase: precios](https://supabase.com/pricing), [límites de subida](https://supabase.com/docs/guides/storage/uploads/file-limits), [subida reanudable](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [almacenamiento](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) y [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

**Sin verificar en esta sesión**: el art. 156 del Código Civil y un criterio de
la AEPD sobre uno o dos progenitores; el RGPD art. 9.2; la Sentencia C-748/2011
entera; si la SIC tiene a la UE por país adecuado (su web no respondía); la
lista de la AEPD de tratamientos que piden evaluación de impacto.
