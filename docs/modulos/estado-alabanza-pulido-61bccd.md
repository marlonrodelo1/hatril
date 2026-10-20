# Alabanza, pulido sin migraciones — estado de la rama

Rama `claude/alabanza-pulido-61bccd`, 20-oct-2026. Tanda 2 del plan
(`plan.md` §2). Agenda, turnos y repertorio ya funcionaban; esto los cose. Sin
migraciones y sin tocar `drizzle/` ni `src/lib/db/schema`.

## Qué hay

1. **Ensayo repetido.** Al apuntar algo en la agenda de un equipo sale
   «Repetir cada semana», de «No, solo ese día» a «Durante 12 semanas». Crea
   filas reales, una por semana, y cada una se cambia o se borra sola. Si alguna
   semana ya tiene algo **del mismo equipo a la misma hora**, esa se salta y el
   aviso lo dice con números: «Apuntado en la agenda: 2 semanas. Otras 4 ya
   tenían algo a esa hora y se han dejado como estaban.». Solo al crear y solo
   en la agenda de un equipo: el formulario de cultos no lo ofrece.
2. **El ensayo dentro del turno**, derivado y sin tabla: la reunión del mismo
   equipo más cercana antes del turno, entre el turno menos 7 días y el turno.
   El mismo día solo cuenta si las dos tienen hora y la reunión va antes, y el
   día de hace una semana, en espejo, solo si fue después de la hora del turno
   (la prueba de sonido del domingo pasado a las 9:30 era de ese domingo). Sale
   en la ficha del turno del panel («Ensayo: jueves 22, 19:30 · La sala de
   música», con enlace a la ficha del ensayo si la agenda está encendida) y en
   `/mi/agenda/turno/[id]`, con las notas recortadas a tres líneas (ver «Las
   notas»). **Solo en equipos con el repertorio encendido**, que son los que
   ensayan: en la radio, la reunión semanal del equipo saldría como ensayo de
   cada programa, y en acción social, la de planificación como ensayo del
   reparto. La etiqueta es el título que le puso el responsable, no «Ensayo»
   fijo («Prueba de sonido» también vale). En el panel, a un equipo con
   repertorio y un turno de hoy en adelante sin ensayo, le dice «No hay ensayo
   apuntado en la semana de antes. Apuntarlo en la agenda».
3. **El músico ve el ensayo.** Ficha nueva `/mi/agenda/reunion/[id]`, de solo
   lectura: día, hora, título, lugar y notas. La fila del calendario de `/mi`
   lleva ahí (antes llevaba a `/mi/agenda`, la misma pantalla). Acotada al
   equipo con `ctx.ministerioIds`, como `turnoParaMiembro`: otro equipo, una
   reunión del culto o un uuid inventado dan 404.

   **Las notas.** Antes solo las leía quien lleva el equipo, desde el panel, y el
   formulario pedía un acta («cómo fue el encuentro»). Ahora las lee todo el
   equipo, así que en la agenda del equipo el campo se llama «Para el equipo»,
   con «Lo ve todo el equipo. Instrucciones del ensayo, no cosas de las
   personas.» y el ejemplo «Traed los in-ear. Empezamos por el coro.», como el
   del turno. Y al voluntario solo se le enseñan las de reuniones **de hoy en
   adelante** —deja fuera las actas antiguas, escritas para otro público— y
   **con la agenda encendida** —apagada, nadie puede corregirlas ni borrarlas—.
   La regla vive en un solo sitio, `notasParaElEquipo` en
   `src/lib/agenda/ensayos.ts`.
4. **«Lista: N canciones» o «Sin lista»** en cada tarjeta de «Próximos» del
   cuadrante, solo si el equipo tiene el repertorio encendido. Un solo `count`
   agrupado para todos los turnos (`cancionesPorTurno`). Los «Anteriores» no lo
   llevan: ya no se preparan.

Además, **editar** una reunión del equipo pasa por la misma comprobación: mover
un ensayo encima de otro es la otra forma de duplicarlo, y el día que llegue el
índice único sería un 500.

## Cómo se evita el duplicado sin índice (y la deuda)

Lo que lo blindaría es un índice único parcial en `reuniones`:

```sql
create unique index ... on public.reuniones (ministerio_id, fecha, hora)
  nulls not distinct where ministerio_id is not null;
```

**Es deuda**: va con la próxima migración que toque `reuniones`. Antes de
crearlo hay que buscar duplicados o la migración se cae:

```sql
select ministerio_id, fecha, hora, count(*) from public.reuniones
 where ministerio_id is not null
 group by 1, 2, 3 having count(*) > 1;
```

Mientras, lo para la action con dos piezas que solo valen juntas (comentado en
`agenda/actions.ts`, al final):

- **Cerrojo** sobre la fila del ministerio (`for no key update`) al empezar la
  transacción. Con un doble clic llegan dos peticiones a la vez y, en READ
  COMMITTED, las dos verían el hueco libre. Con el cerrojo la segunda espera.
  `no key update` y no `update` para no bloquear las comprobaciones de clave
  foránea de otras escrituras que cuelgan del ministerio.
- **Comprobación en la misma transacción**: misma fecha y misma hora
  (dos sin hora también chocan, como hará `nulls not distinct`). El título no
  decide si chocan.

Si todas las semanas pedidas están ocupadas y **alguna** lo está por algo con
el **mismo título**, no es un choque: es el segundo clic. Responde con las
cuentas («Ya estaba apuntado: 2 semanas. Otra tiene otra cosa a esa hora y no
se ha tocado.») en vez de un error. Se vio así al probarlo: las filas bien
creadas y en pantalla «No se ha creado nada», que era la respuesta de la
petición que acaba la última. Con «alguna» y no «todas», porque si el primer
clic saltó semanas ocupadas por otra cosa, el segundo las encuentra igual.

Y además el botón «Apuntar la reunión» se desactiva mientras se envía
(`BotonEnviar`, el de `/panel/modulos`, con `useFormStatus`). Lo del servidor
queda para lo que no pase por el botón.

La fecha se valida antes de repetirla: `sumarDias` pasa por `Date`, que
convierte el 31 de febrero en el 3 de marzo sin avisar.

Lo que no para la aplicación es una fila escrita por otro camino (un script, el
editor de Supabase). Eso solo lo hace el índice.

## Verificado ejecutándolo

`npx tsc --noEmit`, `npx eslint`, `npm run build` y `npm run test:aislamiento`
en verde. En el navegador, a 375 px, en `alabanza.localhost:3003`:

**Como lider@ (responsable de Alabanza)**, comprobando en la base quién escribió
cada fila (`creado_por_miembro_id`):

- «Ensayo», jueves 22-oct 19:30, 4 semanas, con **doble clic**: 4 filas, cero
  duplicadas. Las dos peticiones corrieron a la vez (log del servidor) y la
  segunda esperó al cerrojo.
- Lo mismo con 6 semanas y doble clic: la primera creó 2 y saltó 4
  (`creadas=2&saltadas=4`), la segunda acabó en «Ya estaba apuntado».
- Otro título el mismo jueves a la misma hora: «Ese día a esa hora ya hay algo
  apuntado en la agenda del equipo.», sin crear nada.
- Editar el ensayo del 12-nov al 5-nov (ocupado): error y la fila sin tocar.
  La edición no ofrece «Repetir».
- Ficha del turno del 25-oct: «Ensayo: jueves 22, 19:30 · La sala de música»,
  con enlace al ensayo del 22. El del 18-oct (sin ensayo, ya pasado) no enseña
  nada; antes de limitarlo a turnos futuros enseñaba «Apuntarlo», que no tenía
  sentido.
- Cuadrante: «Lista: 2 canciones» el 25-oct y «Sin lista» en los demás. Sin
  desbordar los 375 px.

**Como miembro@ (voluntaria de Alabanza y de Jóvenes)**:

- `/mi/agenda/turno/[25-oct]`: el ensayo con lugar y las dos líneas de notas.
  Pulsarlo abre `/mi/agenda/reunion/[id]` con todo.
- El calendario de `/mi/agenda` (semana y «Próximos») enlaza al ensayo.
- `/mi/agenda/reunion/[id]`: su ensayo de Alabanza 200, una reunión de Jóvenes
  200, una de Niños 404, el culto del domingo 404, `abc` 404.

**Como pastor.sion@ (otra iglesia)**: el ensayo y el turno de Betania dan 404, y
la ficha del turno del panel le redirige.

Datos de prueba que quedan en la base: seis ensayos de Alabanza (22-oct a
26-nov) y dos canciones en el culto del 25-oct. Documentados, con su borrado, en
`scripts/seed-alabanza-ensayos.sql` (probado dentro de una transacción con
rollback: idempotente y resiembra igual).

## Tras la revisión (20-oct)

Seis hallazgos de la revisión de la rama, todos arreglados y probados:

1. Las notas cambiaban de público sin decirlo (importante): el campo lo dice, y
   en `/mi` solo se ven de hoy en adelante y con la agenda encendida.
2. El doble clic con semanas ocupadas por otra cosa decía «no se ha creado
   nada»: ahora responde con cuentas, y el botón se desactiva al enviar.
3. La ventana del ensayo cogía el día −7 entero: ahora solo si fue después de
   la hora del turno.
4. El desplegable «Repetir» medía 15 px en el móvil y Safari de iOS ampliaba la
   página: 16 px debajo de `md`, como `<Input>`. Lo mismo en el campo de notas
   del mismo formulario.
5. El ejemplo y la ayuda de las notas eran los del acta del culto: ver 1.
6. Una fecha imposible (31-feb) se guardaba como otra: ahora «Revisa la fecha.».

Y main traído a la rama con `git merge main` (la tanda de alimentos), sin
conflictos.

Probado tras arreglarlo, a 375 px y en `alabanza.localhost:3003`:

- **lider@**: el formulario dice «Para el equipo» con su ayuda y su ejemplo, y
  los tres campos miden 16 px (`getComputedStyle`). Un `2026-02-31` mandado a
  mano da «Revisa la fecha.» y no deja fila. «Prueba de voces» desde el 26-nov
  (ocupado por «Ensayo») durante 3 semanas, enviado dos veces seguidas
  saltándose el botón: la primera crea 2 y salta 1, la segunda responde «Ya
  estaba apuntado: 2 semanas. Otra tiene otra cosa a esa hora y no se ha
  tocado.». El botón se ve desactivado y con `aria-busy` mientras tanto.
- **Ventana**: una reunión el domingo 11-oct a las 9:30 no sale como ensayo del
  turno del 18-oct a las 11:00; a las 18:00, sí.
- **miembro@**: el turno del 25-oct enseña el ensayo del 22 con sus notas; la
  ficha de un ensayo de Alabanza de agosto sale sin notas; una reunión futura de
  Jóvenes (agenda apagada) con notas sale sin ellas.

Las reuniones temporales de estas pruebas se borraron al acabar.

Después, dos ajustes más del ensayo de fusión:

- Los comentarios de `agenda/actions.ts` que hablaban de `exigirModulo()` en
  futuro ya estaban reescritos en el commit anterior: la puerta la mira
  `guarda()`, y la de dentro del cerrojo es la segunda mirada.
- **El ensayo derivado, solo con repertorio.** La condición vive en
  `ensayoAntesDelTurno` y vale igual en el panel y en `/mi`. Probado con un
  turno y una reunión temporales de Radio (turnos y agenda encendidos,
  repertorio apagado) como colider@, que es colíder de Radio: ni la ficha del
  turno en `/mi` ni la del panel enseñan la reunión como ensayo, ni el aviso de
  «sin ensayo». Alabanza lo sigue enseñando a lider@ y a miembro@. Borrados
  después.

## Qué falta

- **«Avisar al equipo: ya está la lista»**: necesita un valor nuevo en
  `tipo_notificacion_enum`, y eso es migración. Fuera de esta tanda.
- **El índice único** de arriba.
- Nada de la tanda 1: ya está fusionada. `guarda()` (con `exigirModulo`) mira
  la agenda en la puerta de cada action, y la comprobación de dentro de la
  transacción se queda porque sale gratis con el cerrojo y es la que vale si el
  pastor la apaga entre medias.

## Fuera del encargo, visto de paso

- La agenda del equipo (`/panel/ministerios/[id]/agenda`) lista de la más
  lejana a la más cercana: con doce semanas por delante, lo próximo queda
  abajo del todo. Es `listarReuniones`, compartida con las reuniones del culto.
- Betania tiene en su **horario semanal** un «Ensayo de alabanza» los jueves a
  las 19:30. Con ensayos apuntados en la agenda del equipo, el músico ve dos
  filas el mismo jueves. Es dato de la demo, no código.
- Otros cinco `<select>` del repo llevan `text-[15px]` sin el 16 px del móvil
  (los de turnos y repertorio, entre otros): misma ampliación en iOS. Vienen de
  antes de esta rama.
- Base UI avisa en consola en cada `Button` con `render={<Link>}` («expected a
  native <button>»). Está en todo el repo, no solo aquí.

## Trampas

- **Las cookies de `localhost` no distinguen puerto**, y el navegador integrado
  es uno para todas las sesiones. A mitad de prueba mi sesión pasó de lider@ a
  pastor@ y luego a otra cuenta, porque otras sesiones entraban por
  `localhost:300x`. `127.0.0.1` tampoco vale si otra sesión lo usa. Lo que
  funciona es un host propio, `alabanza.localhost:3003`. `/auth/confirm`
  redirige a `localhost`, pero la cookie queda en el host propio: hay que
  navegar a mano después. **Mirar siempre en la base quién escribió la fila.**
- **No compilar con el servidor de desarrollo encendido.** El build y `next
  dev` se pisan `.next`: el servidor empezó a dar 404 en todas las rutas y el
  build falló con errores de sintaxis en `.next/dev/types/validator.ts`. Parar
  el servidor, borrar `.next/dev` y compilar solo.
- El worktree no trae `next-env.d.ts` (está en `.gitignore`), y sin él
  `tsc --noEmit` falla con un `.avif` de `/i/[slug]`. Lo genera `npm run build`.
- Con cuatro o cinco servidores de desarrollo a la vez, el pooler de Supabase en
  modo sesión (5432) se queda sin clientes (`EMAXCONNSESSION`). A mí no me llegó
  a pasar; otras sesiones cambiaron su `.env.local` al 6543.
