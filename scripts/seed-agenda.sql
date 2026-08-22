-- ===========================================================================
-- Agenda de demostración — Iglesia Betania
--
-- POR QUÉ HACE FALTA
-- ------------------
-- El calendario junta tres fuentes: los horarios semanales de la iglesia —que
-- el seed principal ya deja puestos—, los eventos y las reuniones de los
-- ministerios. De las dos últimas Betania tenía cero eventos y dos reuniones,
-- así que la pantalla salía casi vacía y no se podía juzgar: sin varios días
-- marcados no se ve si la rejilla respira, ni cómo queda un día con tres cosas.
--
-- FECHAS RELATIVAS, NUNCA ESCRITAS
-- --------------------------------
-- Todo cuelga de `current_date`. Con fechas fijas, la demo se ve bien la semana
-- que se escribe y en un mes es un calendario de cosas pasadas — que es
-- exactamente lo que no se quiere enseñar a un cliente.
--
-- SE PUEDE REPETIR
-- ----------------
-- Borra antes lo suyo, que va marcado con `[demo]` en la descripción y en las
-- notas. No toca nada creado a mano desde el panel.
--
--   node scratchpad/correr-sql.cjs scripts/seed-agenda.sql
-- ===========================================================================

begin;

delete from public.eventos
 where iglesia_id = (select id from public.iglesias where slug = 'betania')
   and coalesce(descripcion, '') like '%[demo]%';

delete from public.reuniones
 where iglesia_id = (select id from public.iglesias where slug = 'betania')
   and coalesce(notas, '') like '%[demo]%';


-- ---------------------------------------------------------------------------
-- Eventos de la iglesia
--
-- Uno de varios días a propósito —el retiro— porque es el caso que rompe los
-- calendarios: tiene que aparecer marcado en los tres días, no solo el primero.
-- ---------------------------------------------------------------------------
insert into public.eventos
  (iglesia_id, titulo, descripcion, inicio_en, fin_en, lugar, publicado, inscripciones_abiertas)
select
  i.id, v.titulo, v.descripcion,
  (current_date + v.dias) + v.hora,
  case when v.dias_fin is null then null
       else (current_date + v.dias_fin) + v.hora_fin end,
  v.lugar, true, v.abiertas
from (values
  (
    'Retiro de mujeres',
    E'Tres días en la finca de La Vega. Salida el viernes a las 15:00 desde el templo. [demo]',
    9, time '15:00', 11, time '16:00',
    'Finca La Vega, Cundinamarca', true
  ),
  (
    'Bautismos',
    E'Quien quiera bautizarse habla antes con el pastor. Después nos quedamos a almorzar todos. [demo]',
    16, time '10:00', null, null,
    'Río Sumapaz', false
  ),
  (
    'Escuela de liderazgo',
    E'Cuatro sesiones, una por semana. Para quien ya sirve o quiere empezar. [demo]',
    3, time '19:00', null, null,
    'Salón de arriba', true
  ),
  (
    'Almuerzo de la congregación',
    E'Cada familia trae algo. Hay lista en secretaría para no repetir plato. [demo]',
    -4, time '13:00', null, null,
    'Patio', false
  )
) as v(titulo, descripcion, dias, hora, dias_fin, hora_fin, lugar, abiertas)
cross join (select id from public.iglesias where slug = 'betania') i;


-- ---------------------------------------------------------------------------
-- Reuniones de los ministerios
--
-- Van a los ministerios que existan, emparejando por nombre. Si una iglesia no
-- tiene «Alabanza», esa fila sencillamente no se crea.
-- ---------------------------------------------------------------------------
insert into public.reuniones
  (iglesia_id, ministerio_id, titulo, fecha, hora, lugar, notas)
select
  m.iglesia_id, m.id, v.titulo,
  current_date + v.dias, v.hora, v.lugar,
  '[demo]'
from (values
  ('Alabanza', 'Ensayo general',        2,  time '19:30', 'Templo'),
  ('Alabanza', 'Ensayo del domingo',    5,  time '18:00', 'Templo'),
  ('Niños',    'Preparar el material',  4,  time '17:00', 'Salón de niños'),
  ('Niños',    'Reunión de maestras',  12,  time '17:00', 'Salón de niños'),
  ('Jóvenes',  'Planear el campamento', 7,  time '20:00', 'Salón de arriba')
) as v(ministerio, titulo, dias, hora, lugar)
join public.ministerios m
  on m.nombre = v.ministerio
 and m.iglesia_id = (select id from public.iglesias where slug = 'betania');

commit;
