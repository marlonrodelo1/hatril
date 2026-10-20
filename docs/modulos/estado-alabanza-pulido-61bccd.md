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
   El mismo día solo cuenta si las dos tienen hora y la reunión va antes. Sale
   en la ficha del turno del panel («Ensayo: jueves 22, 19:30 · La sala de
   música», con enlace a la ficha del ensayo si la agenda está encendida) y en
   `/mi/agenda/turno/[id]`, con las notas recortadas a tres líneas. La etiqueta
   es el título que le puso el responsable, no «Ensayo» fijo: la pantalla de
   turnos es la misma para acción social. En el panel, a un equipo con
   repertorio y un turno de hoy en adelante sin ensayo, le dice «No hay ensayo
   apuntado en la semana de antes. Apuntarlo en la agenda».
3. **El músico ve el ensayo.** Ficha nueva `/mi/agenda/reunion/[id]`, de solo
   lectura: día, hora, título, lugar y notas. La fila del calendario de `/mi`
   lleva ahí (antes llevaba a `/mi/agenda`, la misma pantalla). Acotada al
   equipo con `ctx.ministerioIds`, como `turnoParaMiembro`: otro equipo, una
   reunión del culto o un uuid inventado dan 404.
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

Si **todas** las semanas pedidas están ocupadas por algo con el **mismo
título**, no es un choque: es el segundo clic. Responde «Ya estaba apuntado en
la agenda.» en vez de un error. Se vio así al probarlo: las cuatro filas bien
creadas y en pantalla «No se ha creado nada», que era la respuesta de la
petición que acaba la última.

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

## Qué falta

- **«Avisar al equipo: ya está la lista»**: necesita un valor nuevo en
  `tipo_notificacion_enum`, y eso es migración. Fuera de esta tanda.
- **El índice único** de arriba.
- Al fusionar la tanda 1, `guarda()` (con `exigirModulo`) entra en todas las
  actions de la agenda. Simulé la fusión con `git merge-file` contra la copia de
  trabajo de main del 20-oct: **sale limpia**. Mi comprobación de la agenda
  encendida va dentro de la transacción, en la misma lectura que el cerrojo, y
  puede quedarse.

## Fuera del encargo, visto de paso

- La agenda del equipo (`/panel/ministerios/[id]/agenda`) lista de la más
  lejana a la más cercana: con doce semanas por delante, lo próximo queda
  abajo del todo. Es `listarReuniones`, compartida con las reuniones del culto.
- Betania tiene en su **horario semanal** un «Ensayo de alabanza» los jueves a
  las 19:30. Con ensayos apuntados en la agenda del equipo, el músico ve dos
  filas el mismo jueves. Es dato de la demo, no código.
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
- El worktree no trae `next-env.d.ts` (está en `.gitignore`), y sin él
  `tsc --noEmit` falla con un `.avif` de `/i/[slug]`. Lo genera `npm run build`.
- Con cuatro o cinco servidores de desarrollo a la vez, el pooler de Supabase en
  modo sesión (5432) se queda sin clientes (`EMAXCONNSESSION`). A mí no me llegó
  a pasar; otras sesiones cambiaron su `.env.local` al 6543.
