# Tanda 4 — Consolidación v1, sin migraciones

Rama `claude/consolidacion-nuevos-9b87a5`, 20 de octubre de 2026. Lo que pide
`plan.md` §4 y la clave `consolidacion` del análisis, recortado a lo que cabe sin
tocar la base: dos preguntas, **¿quién llegó?** (los nuevos, que faltaba) y
**¿quién se fue?** (los ausentes, que ya hacía el seguimiento).

## Qué se ha hecho

**1. Los tres defectos del seguimiento.**

- **(a) Las faltas cuentan desde que la persona existe.** Antes, a quien nunca
  se había marcado presente se le contaban todas las reuniones con lista de la
  historia de la iglesia. Ahora se cuentan las posteriores a la más tardía de
  tres fechas: su última asistencia, su `fecha_ingreso` y el día en que se creó
  su ficha (una lista solo puede incluir fichas que ya existen). Con `>`: el día
  que alguien llega estaba allí. Una ausencia **apuntada** de antes del corte
  cuenta (listas pasadas con retraso, cuando la ficha ya existía), pero solo si
  es **posterior a su llegada**: `guardarLista` escribe una fila por cada ficha
  que existe al guardar, y volver a guardar la lista del 11 tras apuntar el 19 a
  un visitante le dejaba un «no vino» ocho días antes de llegar. Es
  `ausenciasPrevias` en `src/lib/seguimiento/consultas.ts`.
- **(b) Quien está en nuevos no sale en ausentes.** Las dos listas salen de una
  sola función (`calcular()`), así que una persona cae en una o en otra, nunca en
  las dos.
- **(c) La pestaña ya no rebota.** Ya lo había arreglado la tanda 0 en
  `pestanas.tsx` (la pestaña de seguimiento exige `ver_seguimiento`, igual que su
  layout). Comprobado en el navegador, ver abajo. Las actions comprueban además
  el módulo encendido con `exigirModulo()`, la guarda común de main.

**2. Vista «Nuevos»** en `/panel/ministerios/[id]/seguimiento/nuevos`. Fichas en
visitante o nuevo con llegada (`fecha_ingreso`, o el día de la ficha si no hay)
de los últimos 90 días. Etapa **calculada, no guardada**:

| Etapa | Regla |
|---|---|
| Vinieron una vez | ninguna presencia en un culto con lista después de la primera visita |
| Volvieron | alguna presencia después de la primera visita |
| Se quedan | 3 presencias en las últimas 6 reuniones con lista |
| Miembro | no es etapa: el pastor cambia el estado de la ficha y sale de aquí |

«Sin contactar» va destacado con icono, y dentro de cada etapa primero quien
nadie ha llamado. Si en 90 días no se ha pasado lista en ningún culto, la
pantalla lo dice en vez de poner a todo el mundo en «vinieron una vez». Por
persona distingue tres cosas: «no ha vuelto en N reuniones», «todavía no ha
salido en ninguna lista desde que tiene ficha» (hubo listas, pero antes de
teclearla) y «aún no se ha pasado lista desde que llegó». Las dice
`queSabemosDeSiVolvio()`, la misma en la lista y en la ficha. La llegada nunca
es posterior a hoy. Reutiliza la ficha de seguimiento tal cual (acompañante,
contactos con motivo cerrado) y le añade el botón de **WhatsApp** (`wa.me`, solo
si el teléfono está en E.164) y la vuelta a «Nuevos».

**Decisión: dentro del módulo `seguimiento`, no como módulo propio.** Con la
regla «solo aparece lo que funciona»: hoy «Nuevos» no tiene nada suyo (mismas
fichas, asistencias, ficha, acompañante y contactos). Un interruptor propio
podría estar encendido con el seguimiento apagado y cada fila llevaría a un 404.
Y al revés es peor: como quien está en nuevos no sale en ausentes, con «Nuevos»
apagado el visitante desaparecería de las dos listas. El día que exista la
tarjeta por QR (tabla `llegadas`, enlace público, consentimiento propio), eso sí
será un módulo con su interruptor. Está contado en la cabecera de
`nuevos/page.tsx`. En la pantalla es un selector «Ausentes · N / Nuevos · N»
debajo de las pestañas del ministerio.

**Preparada para la ruta de crecimiento y la célula**, que llegan en una tanda
con migración. No son etapas (la etapa se calcula de las asistencias; la ruta y
la célula son hechos que alguien apunta), así que no entran en los grupos: son
insignias de cada fila, en el componente `Insignias` de `nuevos/page.tsx`, y
campos `celula` y `ruta` al lado de `etapa` en `PersonaEnSeguimiento.nuevo`.
Los dos sitios lo dicen en un comentario.

**3. Cifras para el pastor en `/panel/hoy`**: llegaron este mes, han vuelto (de
cuántos en nuevos), nuevos sin llamar y faltan 3 o más reuniones, con enlace.
Solo números. Las ve quien puede abrir al menos un ministerio con seguimiento
(las mismas tres llaves del layout), así que el enlace siempre abre. Sin listas,
«han vuelto» sale como «—», no como 0. Bloque en
`src/app/panel/hoy/_components/seguimiento.tsx`; en `page.tsx` va dentro del
`Promise.all` inicial, para no retrasar Inicio con ocho consultas en serie.

**4. Alta rápida de visitante** en `.../seguimiento/nuevos/alta`. Cabía sin
migración porque la RLS de `miembros` y de `consentimientos` solo exige
`pertenece_a_iglesia()`. Crea **una** ficha en estado visitante con nombre,
apellidos, teléfono, correo y fecha de la primera visita (de los últimos 90
días). No edita fichas, no toca ministerios ni campos protegidos, no elige
estado, y no pide `editar_miembros`: pide lo mismo que el resto del seguimiento.
Sin campo de notas.

**El permiso se lee en voz alta y se guarda**, como en el reparto. Dos casillas
sin premarcar: la primera, obligatoria, con el texto exacto del consentimiento
general (`TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS`); la segunda, opcional, es
`CasillaAsistencia`, la misma de `/acepta` y `/solicitar` (copiada idéntica de
la rama `arreglos-sueltos`: mismo blob, así que al fusionar no choca). Al crear
la ficha se registra `datos_religiosos` con la versión vigente y
`asistencia_y_seguimiento` solo si se marcó, sin IP ni navegador (serían los del
voluntario). Si no la marcó, la ficha se crea pero no sale en «Nuevos» ni en las
listas, y la pantalla vuelve a «Nuevos» diciéndolo. Una tercera casilla, «es
mayor de edad», es obligatoria y no se guarda.

**El teléfono repetido**, en `noDuplicar()`:

- mismo teléfono y mismo nombre (sin tildes ni mayúsculas; los apellidos solo
  cuentan si están en las dos), en una ficha que el seguimiento enseña: lleva a
  esa ficha y no crea otra;
- mismo teléfono y otro nombre: vuelve con «Ese teléfono ya es de otra ficha.
  ¿Es otra persona?» y una casilla para crearla igualmente. Hay que volver a
  escribir los datos: este repo devuelve los errores por redirección, y los
  datos de una persona no viajan en la dirección;
- el teléfono solo está en fichas que el seguimiento no enseña (quien negó el
  permiso): «No se puede apuntar a esta persona desde aquí. Pide a quien lleva
  Miembros que la dé de alta.» **Decisión aceptada:** queda un residuo, porque
  cualquier respuesta distinta de «apuntado» es una señal de que ese número es
  de alguien. La alternativa es duplicar a quien pidió no aparecer.

## Verificado ejecutándolo

`npx tsc --noEmit`, `npx eslint`, `npm run build` y `npm run test:aislamiento`
en verde. En el navegador, contra la base, con los datos de
`scripts/seed-consolidacion.sql`:

- **Como `pastor@`**: Hoy enseña 4 · 4 de 6 · 5 · 2, lo que sale a mano de los
  datos. Ausentes: Elena 4, Marta 3, David 1. Antes del arreglo habrían salido
  además Marcel, Sara, Andrés y Noemí con 4 «faltas» de cultos anteriores a su
  ficha, y Amparo, Rubén y Valeria, que son nuevos. Nuevos: Esteban y Valeria en
  «vinieron una vez», Amparo, Rubén y Julián en «volvieron», Camila en «se
  quedan». **Tomás, que negó el permiso de asistencia, no sale en ninguna lista
  ni cuenta en ninguna cifra.** La ficha de Valeria vuelve a «Nuevos» y su
  WhatsApp apunta a `https://wa.me/573001234582`.
- **Como `consolidacion@`** (Noemí, rol miembro, responsable de Consolidación,
  con `ver_seguimiento`): ve el bloque de Hoy con las mismas cifras y su enlace
  abre «Nuevos». Asignó acompañante y apuntó un contacto a Valeria (filas en
  `seguimiento_asignaciones` y `seguimiento_contactos` firmadas por ella). Dio de
  alta a Rosa Medina Pinto desde el móvil, con fila en `auditoria` a su nombre.
- **(c) Sin `ver_seguimiento`** (quitado a Noemí y devuelto): sin pestaña de
  seguimiento en su ministerio, sin bloque en Hoy, y la URL directa rebota con
  «No tienes acceso». Con él, el seguimiento de Alabanza (que no lleva) rebota.

**Repaso visual** (20-oct, a petición de Marlon), con capturas a 375 px y en
escritorio al lado de ausentes, turnos e Inicio:

- La fila de «Nuevos» llevaba las insignias en un lateral: a 375 px dejaba el
  nombre cortado en «Rosa Medi…» y el teléfono desbordado. Ahora van en una fila
  dentro de la columna, como la tarjeta de turnos (`rounded-md px-2 py-0.5`,
  12,5 px), y el teléfono se esconde en el móvil porque se llama desde la ficha.
  «Sin acompañante» pasó a «Sin asignar», la palabra de ausentes, que además
  cabe al lado de «Sin contactar».
- Cabeceras de grupo con `px-1` como en turnos, y el estado vacío con su botón
  `outline` que dice qué hacer.
- Las cifras de Inicio copian a «La caja»: tarjeta entera como enlace,
  `t-micro` y cifra a 22 px. La cuarta etiqueta ocupaba dos líneas y desalineaba
  su cifra: ahora es «Faltan 3 o más» con «reuniones seguidas» debajo.
- Solo tokens de `globals.css` (comprobado con grep: ni hex, ni blancos, ni
  sombras, ni degradados) e iconos de lucide. Un botón naranja por pantalla.

**Tras la revisión del 20-oct** (diez hallazgos), otra vez como
`consolidacion@` a 375 px y contra la base, después de fusionar main:

- Alta de Mateo sin la casilla de asistencia: en `consentimientos` solo
  `datos_religiosos` en `privacidad-2026-09`, sin IP; vuelve a «Nuevos» con el
  aviso y no sale en la lista. Alta de Sofía con las dos y primera visita el
  4-oct: las dos filas, y su ficha dice «Todavía no ha salido en ninguna lista
  desde que tiene ficha» (había listas el 11 y el 18, de antes de teclearla).
- El teléfono de Sofía con «Andrés Duque»: pregunta si es otra persona; con la
  casilla marcada se crea aparte. Con «sofia» (sin tilde) y el mismo teléfono en
  otro formato: lleva a la ficha de Sofía. El de Tomás: el mensaje que no
  confirma nada. En la base, exactamente esas tres fichas con esos teléfonos.
- Lorena, del seed, con dos «no vino» de listas vueltas a guardar antes de su
  llegada: cero faltas y «no sabemos si ha vuelto». Valeria conserva sus 2.
- Inicio: 7 · 4 de 9 · 7 · 2. Mateo y Andrés, sin permiso de asistencia, no
  cuentan.
- Los campos del alta y los desplegables de la ficha miden 16 px a 375
  (`getComputedStyle`), y las cuatro casillas se anuncian con su nombre, no
  como «on».
- `/privacidad` pinta los textos nuevos de §3, §4 y §5.

**Sin ejecutar:** el aviso global «en 90 días no se ha pasado lista». Betania
tiene listas y Sion está detrás del muro de suscripción, que no he tocado porque
es dato de prueba de otras sesiones. Está leído, no pulsado.

## Qué falta

- **Lo que pide migración, fuera a propósito**: la tarjeta por QR sin cuenta, la
  tabla `llegadas` (con `canal` para registrar «lo tecleó el equipo»), el aviso
  `llegada_nueva` y el botón de borrar llegadas caducadas. Ver el plan §4.
- **`/privacidad` está redactada, la versión NO se ha subido.** §3 dice qué se
  guarda de quien apunta el equipo y que se contacta también a quien acaba de
  llegar; §4, la base (su consentimiento, dado a la iglesia; la prueba es la
  tarjeta que guarda ella); §5, que llamar y WhatsApp salen del teléfono de
  quien acompaña y que con WhatsApp el número pasa por Meta (wa.me). Subir
  `VERSION_POLITICA_PRIVACIDAD` lo decide Marlon (plan, decisión 7).
- **Antes de subir esa versión, hay que arreglar una trampa.**
  `miembrosSinPermisoDeAsistencia` solo reconoce la negativa si el
  consentimiento general está en la versión ACTUAL, y negar en `/acepta` no deja
  fila de asistencia. Al subirla, quien negó (Tomás en la demo) volvería a salir
  en ausentes, en nuevos, en las cifras de Inicio y en la lista de pasar hasta
  que vuelva a entrar en `/acepta`. Hay que guardar la negativa como fila, o
  dejar de exigir la versión actual para leerla.
- **El texto versionado de la casilla de asistencia** habla del contacto «porque
  llevo tiempo sin aparecer», y ahora también se llama a quien acaba de llegar.
  No se ha tocado porque cambiarlo pide subir la versión: ampliarlo en esa
  misma subida.
- **Borrado a los 90 días**: la ficha creada por el alta rápida lleva `auditar()`
  como cualquier otra, así que la promesa de borrarla del todo tiene el mismo
  problema que el análisis ya señala.
- **«Te toca acompañar» en `/mi`** para el voluntario acompañante: no está.
- **Rendimiento**: `calcular()` son ocho consultas (dos en paralelo y seis en una
  transacción). En desarrollo, contra la base de Irlanda, «Nuevos» tarda 3,7 s y
  la ficha de un ministerio sin seguimiento 1,9–2,7 s. Si molesta, se pueden
  repartir en `withUser` paralelos. El alta rápida la llama una vez más, solo si
  el teléfono ya existe, para saber qué fichas puede enseñar.
- **El umbral «se queda»** (3 de 6) y los 90 días son constantes en
  `consultas.ts`, no configuración del módulo.

## Trampas

- **Las cookies de `localhost` se comparten entre puertos.** Con varias sesiones
  probando a la vez, un enlace mágico abierto en otro puerto me cambió la cuenta
  dos veces en mitad de una prueba. Funciona `<nombre>.localhost:<puerto>`, que
  tiene su propio tarro. `127.0.0.1` no: Next lo normaliza a `localhost` al
  montar `request.url`. `/auth/confirm` redirige igualmente a `localhost`, pero
  las cookies ya quedan en el subdominio: basta con navegar a mano después.
- **`npm run build` y después `next dev` sobre la misma `.next` da 404** en
  rutas que existen (aquí, `seguimiento/nuevos`), en 30 ms y sin error en el
  log. Borrar `.next` antes de volver a arrancar el servidor de desarrollo.
- **El pooler en modo sesión (5432) admite 15 clientes** y cada servidor de
  desarrollo abre hasta 10: con cinco servidores salta `EMAXCONNSESSION`. Mi
  `.env.local` (sin commitear) apunta al 6543, modo transacción, que la app ya
  soporta (`prepare: false`).

## Datos de prueba

`scripts/seed-consolidacion.sql`, documentado en su cabecera: la cuenta
`consolidacion@hatril.test` (contraseña `Hatril2026`), tres cultos con lista en
los tres últimos domingos y seis personas nuevas, una por caso (Lorena es la de
la lista vuelta a guardar). Fechas relativas a hoy. Además, de la verificación:
Rosa Medina Pinto, Mateo Rincón Vega, Sofía Duque Arango y Andrés Duque
(visitantes; los tres últimos, con sus consentimientos), y la asignación y el
contacto de Valeria.

## Al fusionar

main ya está dentro (merge `b85dac5`, con el reparto y `exigirModulo()`). El
único conflicto fue `permiso()` en `seguimiento/actions.ts`: se quedó la guarda
común y salieron la copia local y sus imports.

- `src/components/casilla-asistencia.tsx`: copia idéntica de la de
  `arreglos-sueltos`. Si esa rama la cambia antes de fusionar, chocará: quedarse
  con la suya.
- `src/app/(legal)/privacidad/page.tsx`: párrafos añadidos en §3, §4 y §5,
  junto a los del reparto. Otras ramas pueden tocar la misma página.
- `src/app/panel/hoy/page.tsx`: el bloque va en su propio componente y la cifra
  entra en el `Promise.all` del principio. Otras ramas tocan la misma página.
- `src/app/panel/miembros/actions.ts`: `hoy()` pasa a la fecha de la iglesia en
  vez de UTC (lo pedía la revisión: «llegó hace -1 días»).
- `src/lib/ministerios/modulos.ts`: solo la descripción de `seguimiento`.
- Sin migraciones ni cambios de schema.
