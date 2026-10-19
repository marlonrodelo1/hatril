# Plan de los módulos de ministerio

19 de octubre de 2026. Salió de mapear contra el código los siete módulos que
Marlon pidió como primera tanda —entrega de alimentos, escuela dominical,
radio, alabanza, consolidación, células y contabilidad— más la jerarquía común
que los sostiene. Un analista por módulo y un revisor que comprobó sus
afirmaciones contra el repo. El detalle completo de cada uno (tablas, riesgos
legales, decisiones con su recomendación) está en `analisis-2026-10-19.json`.

Este fichero es el plan. Lo que se vaya haciendo se cuenta en `ESTADO.md`, como
siempre.

**Hecho:** la tanda 0, base común (19-oct). Sale con la migración `0040`, así
que la siguiente es la **0041**, y el siguiente código de trigger es **HT126**.
Además de lo de la sección 0 se cerraron, al revisarla, una cuenta en dos
iglesias cruzando de una a otra, guardar una ficha borrando los datos
protegidos y `/panel/reuniones` escribiendo en ensayos. Y se decidió una regla
que no estaba: **los colíderes los nombra el responsable o el pastor**, no otro
colíder. **Siguiente:** la tanda 1, entrega de alimentos, que trae además la
guarda común `exigirModulo()` (ver «Qué falta» en `ESTADO.md`).

---

## Lo que pidió Marlon, en una línea por idea

- Los ministerios son módulos que **el pastor activa** desde el panel.
- Jerarquía: pastor(es) por encima de todo; en cada ministerio un responsable
  (o varios) y después los demás líderes.
- El miembro raso ve lo básico en la app. Quien lidera algo ve, **en la misma
  app**, las herramientas de lo suyo, y además entra al panel web y ve
  directamente lo que lleva.
- Ir uno por uno y dejarlos funcionando.

---

## Lo que ya existe y lo que lo impide hoy

Casi todo el andamiaje está: tipos de ministerio que encienden módulos
(`tipos.ts`, `modulos.ts`), responsable único por índice y colíderes, agenda,
turnos, repertorio, seguimiento, reuniones y asistencia, y Finanzas.

Pero **«el líder entra con su usuario y ve lo suyo» no funciona con datos
reales**, por dos cosas que nadie había visto:

1. **Hacen falta dos llaves.** Nombrar responsable a alguien con rol `miembro`
   no le da `gestionar_su_ministerio` (`DEFECTOS_POR_ROL.miembro` es ninguno):
   `panel/layout.tsx` le devuelve a `/mi` y no abre ni turnos ni repertorio.
   Encima le llegan avisos `turno_no_puede` con enlace al panel, que rebotan.
2. **No hay forma de enlazar una cuenta con la ficha que ya existe.**
   `aprobarSolicitud` siempre inserta una ficha nueva, y `miembros` no tiene
   único por correo. El líder que el pastor ya tenía en el fichero se registra
   y acaba con una segunda ficha sin ministerios.

Y tres más, menores:

- El responsable y los colíderes **encienden y apagan módulos** y cambian el
  tipo de su ministerio (`editarMinisterio` usa
  `requireGestionMinisterioAccion`). Choca con «el pastor activa».
- Un colíder **puede quitar o degradar al responsable** (`quitarDelMinisterio`
  y `cambiarRolEnEquipo` no miran el rol de la persona afectada).
- `PestanasMinisterio` pinta Turnos y Repertorio a quien no lleva ese
  ministerio, y al pulsarlas rebota.

**Fallo legal vivo, aparte de todo lo anterior:** `listaDelEquipo` no excluye a
quien negó el permiso de asistencia, así que `guardarListaDelEquipo` vuelve a
crear las filas que `/acepta` borró. `/privacidad` promete lo contrario.

---

## Orden

| # | Qué | Tamaño | Por qué en este sitio |
|---|---|---|---|
| 0 | **Base común** | M, sin migración | Sin ella ningún líder usa ningún módulo |
| 1 | **Entrega de alimentos** | L | Lo que más vale: la iglesia de Marlon reparte cada domingo y hoy no hay nada |
| 2 | **Alabanza** | S | Casi hecha (agenda, turnos, repertorio). Cerrar y pulir |
| 3 | **Contabilidad** | M | Ya existe como Finanzas. Interruptor del pastor y fondo por ministerio |
| 4 | **Consolidación** | L | El seguimiento existe; falta el embudo de nuevos |
| 5 | **Células** | L | Necesita la pieza de subgrupos |
| 6 | **Radio** | M | Independiente, poco riesgo, entra cuando haya hueco |
| 7 | **Escuela dominical** | L | La de más riesgo: menores, fotos y salud. Espera decisión legal |

Antes de la tanda 0: el **repertorio está sin commitear desde el 15-oct**
(0038, 0039, `src/lib/repertorio`, diffs en turnos, `modulos.ts`, `tipos.ts` y el
test). Toca los mismos ficheros que la base común, así que hay que cerrarlo
primero. Y comprobar que la 0038 y la 0039 están aplicadas en la base remota.
Después, la siguiente migración es la **0040** y el siguiente código **HT126**:
repartirlos por módulo antes de generar nada, porque todos los analistas
reclamaron los mismos números.

---

## 0. Base común (TypeScript, sin migración)

1. **Liderar da acceso.** `gestionar_su_ministerio` pasa a defecto de todos los
   roles, y `esDelEquipo` solo lo cuenta si `ministeriosQueLidera` no está
   vacío. Se decide en un sitio y lo heredan el layout del panel, `inicioDe` y
   la cabecera de `/mi`.
2. **Enlazar cuenta y ficha al aprobar la solicitud.** Quien aprueba ve las
   fichas que coinciden por correo o teléfono y elige «es esta». Se rellenan
   `iglesia_usuarios.miembro_id` y `miembros.auth_user_id` en vez de insertar.
3. **Módulos y tipo, solo el pastor** (o `gestionar_ministerios`).
   `editarMinisterio` conserva los dos cuando guarda un líder acotado, y el
   formulario no le pinta esas casillas. El líder sigue configurando lo de
   dentro (puestos, misión, foto). `guardarPuestos` ya conserva `activo`.
4. **El colíder no toca al responsable**: ni quitarlo ni bajarlo de rango, salvo
   el pastor o `gestionar_ministerios`.
5. **El líder ve lo suyo primero.** Bloque «Lo que llevas» arriba del menú del
   panel; `inicioDe` le manda a su ministerio si solo lleva uno; en `/mi/cuenta`
   la tarjeta de cada ministerio que lidera lleva «Abrir herramientas». Una sola
   entrada para todos los módulos, no una por módulo.
6. **Pestañas solo para quien gestiona**; la de seguimiento además con
   `ver_seguimiento`.
7. **Consentimiento en `listaDelEquipo`** con `miembrosSinPermisoDeAsistencia`.
8. **Catálogo `/panel/modulos`** («Activa lo que usa tu iglesia»): una tarjeta
   por tipo de ministerio; activar = crear el ministerio con su plantilla.
   **Ojo**: desactivar NO puede ser `archivarMinisterio`, que da de baja a todo
   el equipo y no tiene vuelta atrás. Las herramientas de iglesia (Finanzas,
   Eventos, Reuniones, Devocionales) entran aquí con la tanda 3, que es la que
   trae la columna `iglesias.modulos`.
9. **Seed**: un ministerio de Acción social y un colíder con rol `miembro` y
   cuenta, que es justo el caso que hoy se rompe. Sin eso no se puede abrir la
   pantalla y pulsar el botón.

Verificar como `lider@` y como ese colíder `miembro`.

---

## 1. Entrega de alimentos — módulo `reparto`

**v1, solo la puerta:**

- Módulo `reparto` en `modulos.ts`, encendido por el tipo `accion_social`
  (que pasa a llamarse «Acción social y entrega de alimentos»).
- Tablas `reparto_beneficiarios` (padrón **por hogar**, aparte de `miembros`,
  sin `miembro_id`: nombre como quiera que le llamen, personas del hogar,
  teléfono opcional, **sin notas**), `reparto_jornadas` (cada domingo de
  reparto) y `reparto_entregas` (vino / se le entregó).
- **RLS por ministerio** (`es_pastor OR sirve_en_ministerio`): es una excepción
  consciente a «la RLS solo aísla iglesias», porque son datos de terceros
  vulnerables. Las funciones `sirve_en_ministerio` y `lidera_ministerio` nacen
  aquí y las reutiliza la escuela.
- Pantalla **Hoy** para el móvil: empezar la jornada, contadores (inscritos,
  han venido, entregados), buscador por número o nombre, «Ha llegado» y
  «Entregado», y alta en la puerta en 20 segundos con su casilla de aviso leído.
  Se llama por número: la pantalla no se proyecta.
- Padrón con editar, dar de baja y **borrar**, y borrar a quien lleve 12 meses
  sin venir. Historial por jornada y total del mes.
- Consentimiento propio (`VERSION_CONSENTIMIENTO_REPARTO`), párrafo en
  `/privacidad` y la categoría en el anexo del art. 28.

**Desviación de lo que pidió Marlon, a propósito:** «que se inscriban por la
app» va en la v1.1 como **enlace sin cuenta** que el líder manda por WhatsApp.
La mayoría de quien recibe comida no tiene la app, y un botón de «necesito
ayuda» dentro de la app de la congregación enseña a la comunidad quién pasa
necesidad.

**Legal:** personas vulnerables + entidad religiosa son dos criterios de la
lista de la AEPD, así que probablemente la iglesia necesite una evaluación de
impacto (art. 35). Y **nunca condicionar la comida a dar datos**: se puede
entregar sin inscribir.

**v1.1:** enlace público, etiquetas Nuevo / Repite / No viene, voluntarios
marcando desde `/mi`, CSV si un banco de alimentos lo pide, QR.

---

## 2. Alabanza

Casi hecha. Falta:

- Cerrar el repertorio (ver arriba).
- Ensayo fijo: «repetir cada semana N semanas», con tope de 12 y un índice
  único para que un doble clic no duplique.
- El músico ve el ensayo (lugar y notas) desde su turno en `/mi`.
- «Lista: N canciones» o «Sin lista» por turno en el cuadrante.
- Botón «Avisar al equipo: ya está la lista» (valor nuevo del enum de avisos,
  en su propia migración).

Nada de subir PDFs de acordes: Hatril pasaría a alojar obras con derechos.

---

## 3. Contabilidad = Finanzas

En pantalla sigue llamándose **Finanzas**: «Contabilidad» promete partida doble
e impuestos, que no se van a construir.

- Interruptor de iglesia solo del pastor en `/panel/modulos`
  (`iglesias.modulos`, clave ausente = encendido, para que nadie se quede sin
  su caja el lunes). Apagado: fuera del menú, de Hoy y de las rutas (404).
- **Arreglar el corte silencioso del libro a 50 movimientos**
  (`src/lib/finanzas/consultas.ts:146`, `movimientos/page.tsx:38`).
- Fondo vinculado a un ministerio (`fondos.ministerio_id`) y pestaña «Fondo»
  de solo lectura para su responsable: el líder de alimentos ve su dinero.
- Arqueo del culto (quien cuenta no es quien confirma): v1.1.

---

## 4. Consolidación

Distinguir dos preguntas: **¿quién llegó?** (nuevos, lo que falta) y **¿quién
se fue?** (ausentes, lo que ya hace `seguimiento`).

- Primero arreglar tres defectos del seguimiento: las faltas se cuentan desde la
  fecha de ingreso (hoy un visitante sale arriba como «ausente»), quien está en
  el embudo de nuevos no sale en ausentes, y la pestaña que rebota.
- Vista **Nuevos** sobre las fichas en estado visitante o nuevo, reutilizando
  la ficha de seguimiento (acompañante, llamadas, WhatsApp). Etapas calculadas,
  no guardadas: volvió, se queda, miembro.
- Cifras para el pastor en Hoy.
- **La tarjeta por QR sin cuenta espera a una decisión**: una ficha en
  `miembros` cuenta para el precio del plan, se audita con `auditar()` (cuya
  tabla no se puede borrar, así que la promesa de borrar a los 90 días sería
  falsa) y la ve toda la iglesia. Probablemente pide una tabla aparte.

---

## 5. Células

- **Pieza genérica de subgrupos**: `grupos` y `grupo_miembros` (líder, auxiliar,
  participante), encendida como módulo. La reutiliza la escuela dominical para
  sus clases. **Decidir la forma antes de la primera migración**: renombrar
  después cuesta una migración con datos dentro.
- No como ministerios hijos: cada ministerio activo sale en la web pública, y
  «Célula familia Pérez, barrio X» acabaría en internet.
- Las redes (hombres, mujeres, jóvenes) son ministerios de tipo Células; su
  responsable es el líder de red y los colíderes, supervisores. No se impone
  G12.
- El líder de célula trabaja **en `/mi`**, no en el panel: su gente, pasar lista
  o un recuento, el tema de cada semana, e invitar por WhatsApp. Los visitantes
  de la célula entran por `/solicitar` con el código de la célula, y al
  aprobarse ya tienen la app: ese es el puente hacia la iglesia.
- **Ojo**: no colgar las reuniones de célula de `reuniones` sin más. La agenda
  del equipo y el calendario de cada miembro las leerían, y habría que añadir
  `grupo_id is null` a cada consulta existente.
- Sin dirección de la casa (barrio y día bastan), sin teléfonos para el líder en
  la v1, sin ofrenda en el reporte (va a Finanzas).

---

## 6. Radio

- Tipo `radio` propio (sale de `medios`). Módulo `emisora`: URL del stream
  (**solo https**, sin proxy desde Hatril: ni ancho de banda ni comunicación
  pública de la obra), parrilla semanal y reproductor.
- Los programas del mes con sus locutores son **turnos**: confirmación, avisos y
  agenda ya funcionan. Columna `turnos.tema`, que sirve también a células y
  escuela.
- En `/mi`, mini reproductor encima de la barra, sin quinta pestaña. En la web
  pública, si el pastor lo enciende, sin nombres de locutores.
- No registrar quién escucha. Los derechos de lo que suena son de la iglesia
  (SAYCO-ACINPRO en Colombia, SGAE y AGEDI/AIE en España): decirlo en
  `/terminos`. En el iPhone la web puede cortar el audio con la pantalla
  bloqueada; el segundo plano de verdad llega con Capacitor (v2).

---

## 7. Escuela dominical

Lo que describió Marlon (fotos, comportamiento, calificaciones, chat con los
padres) es lo más delicado de todo el producto: datos de menores, su imagen y
su salud (alergias), que además revelan la religión de la familia.

- **La v1 va sin fichas de niños**: clases por edad con su maestro (pieza de
  grupos), el tema de cada domingo con objetivo y versículo, lo que los padres
  ven en la app, y turnos de maestros.
- Las fichas de niños, la entrada y la recogida, las fotos y la alerta
  alimentaria **esperan una revisión legal** para España y Colombia
  (LOPDGDD art. 7, RGPD art. 9, Ley 1581 art. 7, Decreto 1377/2013, LO 1/1996).
  El diseño está en el análisis: tabla `ninos` aparte de `miembros`, la ficha la
  crea el padre, fotos en bucket privado solo para los padres de esa clase y
  borradas a los 90 días, y solo hasta 13 años.
- Calificaciones y comportamiento por niño: **no**. El padre quiere saber qué
  aprendió su hijo, y eso es el «qué hicimos hoy» de la clase.
- Recordar a la iglesia el certificado negativo de delitos sexuales de quien da
  clase (España). Hatril no lo guarda.

---

## Decisiones que son de Marlon

Cada una con la recomendación. Ninguna bloquea la base común salvo las tres
primeras, que van recomendadas dentro de ella.

1. Nombrar a alguien responsable o colíder, ¿le da acceso sin tocarle el rol?
   **Sí.**
2. Encender módulos y cambiar el tipo, ¿solo el pastor? **Sí.**
3. Enlazar cuenta y ficha, ¿al aprobar la solicitud? **Sí**; la invitación por
   correo, cuando haya Resend.
4. ¿«Varios responsables» quita el responsable único? **No**: uno responde y los
   colíderes tienen su mismo poder. Se pueden llamar «Corresponsable» en
   pantalla.
5. Alimentos: padrón aparte, por hogar, datos mínimos, sin enlace público en la
   v1. **Sí.**
6. ¿Los módulos dependen del plan contratado? **No en la v1**: el precio está sin
   validar. Y quitar «Dos personas en el equipo» del plan Esencial, que no se
   comprueba en ningún sitio.
7. ¿Una sola subida de `VERSION_POLITICA_PRIVACIDAD` para toda la tanda o una por
   módulo? Alimentos no la necesita (consentimiento propio). Subirla **una vez**,
   cuando cambie el uso de los datos de los miembros (células, escuela).
8. Escuela dominical: ¿fichas nominales de niños? **No hasta la revisión
   legal.**

## Huecos que no son de ningún módulo

- **No hay correo ni push.** Un aviso solo existe si se abre la app.
- `getCurrentUserContext` hace `.limit(1)` sin orden: una cuenta en dos iglesias
  recibe una cualquiera.
- El test de aislamiento **no cubre el recorte por ministerio dentro de una
  iglesia**: su fase `withUser` ejecuta `select 1`. Con siete módulos más, una
  fuga de un equipo a otro solo se vería abriendo la pantalla.
- La supresión sigue siendo manual y cada módulo añade tablas con personas.
  Hace falta una lista única de tablas que se borran al negarse en `/acepta`.
- `obtenerIglesiaPublica` lista todo ministerio activo en la web: los tipos
  nuevos salen a internet sin que nadie lo decida.
- En Claude Design faltan el área del miembro y las vistas móviles. La pantalla
  de la puerta a 375 px no tiene referencia: fijar un patrón y reutilizarlo.
