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
  que alguien llega estaba allí. Y una ausencia **apuntada** cuenta siempre,
  aunque sea de antes del corte (listas pasadas con retraso):
  `ausenciasPrevias` en `src/lib/seguimiento/consultas.ts`.
- **(b) Quien está en nuevos no sale en ausentes.** Las dos listas salen de una
  sola función (`calcular()`), así que una persona cae en una o en otra, nunca en
  las dos.
- **(c) La pestaña ya no rebota.** Ya lo había arreglado la tanda 0 en
  `pestanas.tsx` (la pestaña de seguimiento exige `ver_seguimiento`, igual que su
  layout). Comprobado en el navegador, ver abajo. Además, las actions del
  seguimiento comprueban ahora que el módulo esté encendido: el layout solo
  protegía lo que se pinta.

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
pantalla lo dice en vez de poner a todo el mundo en «vinieron una vez»; y por
persona distingue «no ha vuelto en N reuniones» de «aún no se ha pasado lista
desde que llegó». Reutiliza la ficha de seguimiento tal cual (acompañante,
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

**3. Cifras para el pastor en `/panel/hoy`**: llegaron este mes, han vuelto (de
cuántos en nuevos), nuevos sin llamar y faltan 3 o más reuniones, con enlace.
Solo números. Las ve quien puede abrir al menos un ministerio con seguimiento
(las mismas tres llaves del layout), así que el enlace siempre abre. Sin listas,
«han vuelto» sale como «—», no como 0. Bloque en
`src/app/panel/hoy/_components/seguimiento.tsx`; en `page.tsx` son dos líneas.

**4. Alta rápida de visitante** en `.../seguimiento/nuevos/alta`. Cabía sin
migración porque la RLS de `miembros` solo exige `pertenece_a_iglesia()`. Crea
**una** ficha en estado visitante con nombre, apellidos, teléfono, correo y fecha
de la primera visita (de los últimos 90 días). No edita fichas, no toca
ministerios ni campos protegidos, no elige estado, y no pide `editar_miembros`:
pide lo mismo que el resto del seguimiento. Sin campo de notas. Dos casillas
obligatorias (le he preguntado / es mayor de edad) que **no se guardan**: ver
«Qué falta». Si el teléfono ya está en una ficha visible, lleva a esa ficha en
vez de duplicar; si es de alguien que negó el permiso de asistencia, para con un
mensaje que no dice de quién es.

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
  alta a Rosa Medina Pinto desde el móvil (375 px): ficha visitante, teléfono
  `+573001234590`, sin consentimientos ni ministerios, y fila en `auditoria` con
  ella como autora. El mismo teléfono escrito como `+57 300-123-4590` llevó a la
  ficha de Rosa sin crear otra. El teléfono de Tomás dio el mensaje genérico y no
  creó nada. Hoy pasó a 5 · 4 de 7 · 5 · 2.
- **(c) Sin `ver_seguimiento`** (quitado a Noemí y devuelto): sin pestaña de
  seguimiento en su ministerio, sin bloque en Hoy, y la URL directa rebota con
  «No tienes acceso». Con él, el seguimiento de Alabanza (que no lleva) rebota.

**Sin ejecutar:** el aviso global «en 90 días no se ha pasado lista». Betania
tiene listas y Sion está detrás del muro de suscripción, que no he tocado porque
es dato de prueba de otras sesiones. Está leído, no pulsado.

## Qué falta

- **Lo que pide migración, fuera a propósito**: la tarjeta por QR sin cuenta, la
  tabla `llegadas` (con `canal` para registrar «lo tecleó el equipo»), el aviso
  `llegada_nueva` y el botón de borrar llegadas caducadas. Ver el plan §4.
- **Las dos casillas del alta no dejan rastro.** Guardarlas como fila de
  `consentimientos` diría que la persona aceptó la política de Hatril, que no ha
  leído, y además `miembrosSinPermisoDeAsistencia` la sacaría de la lista. La
  prueba es la tarjeta que guarda la iglesia, como en el alta de Miembros, que
  tampoco registra ninguno.
- **Borrado a los 90 días**: la ficha creada por el alta rápida lleva `auditar()`
  como cualquier otra, así que la promesa de borrarla del todo tiene el mismo
  problema que el análisis ya señala.
- **Textos legales que Marlon tiene que mirar**: `/privacidad` §4 habla de
  contactar a quien «lleva tiempo sin aparecer»; ahora también se contacta a
  quien acaba de llegar, y por WhatsApp desde el teléfono del voluntario (el
  número pasa a Meta). No lo he tocado: puede pedir subir
  `VERSION_POLITICA_PRIVACIDAD`, y esa decisión es suya (plan, decisión 7).
- **«Te toca acompañar» en `/mi`** para el voluntario acompañante: no está.
- **`exigirModulo()`**: las actions comprueban el módulo con `tieneModulo` en su
  `permiso()`, con un comentario. Al fusionar la tanda 1, cambiarlo.
- **Rendimiento**: `calcular()` son ocho consultas (dos en paralelo y seis en una
  transacción). En desarrollo, contra la base de Irlanda, «Nuevos» tarda 3,7 s y
  la ficha de un ministerio sin seguimiento 1,9–2,7 s. Si molesta, se pueden
  repartir en `withUser` paralelos.
- **El umbral «se queda»** (3 de 6) y los 90 días son constantes en
  `consultas.ts`, no configuración del módulo.

## Trampas

- **Las cookies de `localhost` se comparten entre puertos.** Con varias sesiones
  probando a la vez, un enlace mágico abierto en otro puerto me cambió la cuenta
  dos veces en mitad de una prueba. Funciona `<nombre>.localhost:<puerto>`, que
  tiene su propio tarro. `127.0.0.1` no: Next lo normaliza a `localhost` al
  montar `request.url`. `/auth/confirm` redirige igualmente a `localhost`, pero
  las cookies ya quedan en el subdominio: basta con navegar a mano después.
- **El pooler en modo sesión (5432) admite 15 clientes** y cada servidor de
  desarrollo abre hasta 10: con cinco servidores salta `EMAXCONNSESSION`. Mi
  `.env.local` (sin commitear) apunta al 6543, modo transacción, que la app ya
  soporta (`prepare: false`).

## Datos de prueba

`scripts/seed-consolidacion.sql`, documentado en su cabecera: la cuenta
`consolidacion@hatril.test` (contraseña `Hatril2026`), tres cultos con lista en
los tres últimos domingos y cinco personas nuevas, una por caso. Fechas relativas
a hoy. Además, de la verificación: Rosa Medina Pinto (visitante), y la
asignación y el contacto de Valeria.

## Al fusionar

- `src/app/panel/hoy/page.tsx`: un import y una línea; el bloque va en su propio
  componente. Otras ramas tocan la misma página.
- `src/lib/ministerios/modulos.ts`: solo la descripción de `seguimiento`.
- Sin migraciones ni cambios de schema.
