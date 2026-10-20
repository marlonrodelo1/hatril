-- Datos de prueba del pulido de Alabanza (rama alabanza-pulido, 20-oct-2026).
--
-- Se crearon desde la pantalla, como lider@hatril.test, al verificar el ensayo
-- repetido; este fichero los deja escritos para poder rehacerlos o quitarlos.
-- Es lo mínimo para ver las cuatro piezas:
--
--   * Un ensayo semanal de Alabanza (Betania), jueves a las 19:30 en «La sala
--     de música», del 22-oct al 26-nov. Los cuatro primeros llevan notas, que
--     es lo que el músico ve en su turno y en /mi/agenda/reunion/[id].
--   * Dos canciones en la lista del culto del domingo 25-oct, para que el
--     cuadrante enseñe «Lista: 2 canciones» al lado de los «Sin lista».
--
-- Idempotente: no duplica si ya está. Se aplica a mano (psql o el editor de
-- Supabase); no es una migración.

with alabanza as (
  select id, iglesia_id from public.ministerios
   where id = 'eeeeeeee-0000-4000-8000-000000000001'
), lider as (
  select id from public.miembros where email = 'lider@hatril.test'
), semanas(fecha, notas) as (
  values
    (date '2026-10-22', e'Traed los in-ear.\nEmpezamos por el coro.'),
    (date '2026-10-29', e'Traed los in-ear.\nEmpezamos por el coro.'),
    (date '2026-11-05', e'Traed los in-ear.\nEmpezamos por el coro.'),
    (date '2026-11-12', e'Traed los in-ear.\nEmpezamos por el coro.'),
    (date '2026-11-19', null),
    (date '2026-11-26', null)
)
insert into public.reuniones
  (iglesia_id, ministerio_id, titulo, fecha, hora, lugar, notas, creado_por_miembro_id)
select a.iglesia_id, a.id, 'Ensayo', s.fecha, time '19:30', 'La sala de música', s.notas, l.id
  from alabanza a, lider l, semanas s
 where not exists (
   select 1 from public.reuniones r
    where r.ministerio_id = a.id and r.fecha = s.fecha and r.hora = time '19:30'
 );

-- La lista del 25-oct: Way Maker y Cuán grande es Él, en ese orden.
with turno as (
  select id, iglesia_id from public.turnos
   where ministerio_id = 'eeeeeeee-0000-4000-8000-000000000001'
     and fecha = date '2026-10-25' and hora = time '11:00'
), lista(titulo, orden) as (
  values ('Way Maker', 1), ('Cuán grande es Él', 2)
)
insert into public.turno_canciones (iglesia_id, turno_id, cancion_id, orden)
select t.iglesia_id, t.id, c.id, l.orden
  from turno t
  join lista l on true
  join public.canciones c
    on c.titulo = l.titulo
   and c.ministerio_id = 'eeeeeeee-0000-4000-8000-000000000001'
 where not exists (
   select 1 from public.turno_canciones tc
    where tc.turno_id = t.id and tc.cancion_id = c.id
 );

-- Para quitarlo todo:
--
-- delete from public.turno_canciones tc
--  using public.turnos t
--  where tc.turno_id = t.id
--    and t.ministerio_id = 'eeeeeeee-0000-4000-8000-000000000001'
--    and t.fecha = date '2026-10-25';
--
-- delete from public.reuniones
--  where ministerio_id = 'eeeeeeee-0000-4000-8000-000000000001'
--    and titulo = 'Ensayo' and lugar = 'La sala de música'
--    and fecha between date '2026-10-22' and date '2026-11-26';
