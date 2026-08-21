-- ===========================================================================
-- Muro de demostración — Iglesia Betania
--
-- POR QUÉ HACE FALTA ESTE FICHERO
-- -------------------------------
-- `seed-demo.sql` crea las nueve fichas, los ministerios y las cuentas, pero
-- deja el muro vacío. Las únicas publicaciones que había las escribió Marlon
-- probando, las dos con la misma cuenta — y con eso la pantalla parecía decir
-- que la comunidad enseña solo lo tuyo, cuando `listarMuro()` trae lo de toda
-- la congregación desde el primer día.
--
-- Un muro de una sola voz tampoco sirve para juzgar el diseño: no se ve cómo
-- caen dos avatares distintos seguidos, ni una conversación con respuestas, ni
-- un contador de comentarios de dos cifras.
--
-- SE PUEDE VOLVER A EJECUTAR
-- --------------------------
-- Borra antes lo que crea, mirando el texto. No toca las publicaciones escritas
-- a mano fuera de aquí.
--
--   psql "$DATABASE_URL" -f scripts/seed-muro.sql
--
-- NO USA UUIDs ESCRITOS A MANO
-- ----------------------------
-- Cada persona se busca por su nombre dentro de Betania. Un id cableado se
-- queda obsoleto en cuanto alguien vuelve a correr el seed principal, y el
-- fallo se ve tarde: filas que no aparecen y nadie sabe por qué.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Limpieza de lo que crea este fichero, para poder repetirlo.
--
-- Los comentarios y los «me gusta» caen solos por las claves ajenas en cascada.
-- ---------------------------------------------------------------------------
delete from public.publicaciones
 where iglesia_id = (select id from public.iglesias where slug = 'betania')
   and texto like '%[demo]%';


with
  iglesia as (
    select id from public.iglesias where slug = 'betania'
  ),
  gente as (
    select m.id, m.nombre
      from public.miembros m, iglesia i
     where m.iglesia_id = i.id
  ),
  -- Cada publicación con su autor y cuánto hace que se escribió. El texto lleva
  -- la marca `[demo]` al final para que la limpieza de arriba sepa cuál es
  -- suya; se ve en pantalla, y es lo que se quiere en una base de pruebas.
  nuevas as (
    insert into public.publicaciones (iglesia_id, autor_miembro_id, texto, created_at)
    select
      i.id,
      g.id,
      v.texto,
      now() - v.hace
    from (values
      (
        'Brandon',
        E'Gracias a todos por el domingo. Fuimos ciento noventa, y veinte de ustedes se quedaron hasta el final recogiendo sillas.\n\nEsta semana la reunión de oración es el miércoles a las 19:00, como siempre. [demo]',
        interval '5 hours'
      ),
      (
        'Pilar',
        E'Recordatorio: quien vaya al retiro de octubre tiene que apuntarse antes del domingo 30. Vamos ya por veinticuatro personas. [demo]',
        interval '1 day 3 hours'
      ),
      (
        'David',
        E'El ensayo de alabanza se pasa al jueves esta semana, que el salón está ocupado el martes. Misma hora.\n\nY si alguien toca el bajo y quiere acompañarnos, que me escriba. Hace falta. [demo]',
        interval '2 days 4 hours'
      ),
      (
        'Amparo',
        E'Les pido que oren por mi hermana Rosario, que la operan el jueves en Kennedy. Ella no es de la iglesia pero sabe que la estamos acompañando. [demo]',
        interval '4 days'
      ),
      (
        'Rubén',
        E'Quiero dar gracias públicamente. Llevaba siete meses sin trabajo y el lunes empiezo. Muchos de ustedes lo supieron antes que mi familia. [demo]',
        interval '6 days 2 hours'
      )
    ) as v(autor, texto, hace)
    join gente g on g.nombre = v.autor
    cross join iglesia i
    returning id, autor_miembro_id, texto, created_at
  ),

  -- ---------------------------------------------------------------------------
  -- Comentarios de primer nivel. Se cuelgan de la publicación buscándola por un
  -- trozo de su texto, que es estable dentro de este mismo fichero.
  -- ---------------------------------------------------------------------------
  comentarios as (
    insert into public.publicaciones_comentarios
      (iglesia_id, publicacion_id, autor_miembro_id, texto, created_at)
    select i.id, n.id, g.id, v.texto, n.created_at + v.despues
    from (values
      ('Gracias a todos por el domingo', 'Lucía',  'Amén. Yo me llevé la lista de los que faltaron por saludar.', interval '40 minutes'),
      ('Gracias a todos por el domingo', 'Marta',  'Qué bonito estuvo todo.', interval '2 hours'),
      ('El ensayo de alabanza',          'Carmen', 'Mi hijo toca el bajo, David. Le digo que te escriba.', interval '1 hour'),
      ('Les pido que oren',              'Brandon','Estamos orando, Amparo. Avísanos el jueves cómo salió.', interval '3 hours'),
      ('Les pido que oren',              'Elena',  'Aquí estamos para lo que necesites.', interval '5 hours'),
      ('Les pido que oren',              'Pilar',  'La ponemos en la lista de oración del miércoles.', interval '8 hours'),
      ('Quiero dar gracias',             'David',  'Qué alegría, Rubén. Nos lo cuentas el domingo.', interval '1 hour 20 minutes')
    ) as v(busca, autor, texto, despues)
    join nuevas n on n.texto like '%' || v.busca || '%'
    join gente g on g.nombre = v.autor
    cross join iglesia i
    returning id, publicacion_id, autor_miembro_id, texto
  ),

  -- ---------------------------------------------------------------------------
  -- Respuestas. Un solo nivel: responden a un comentario que NO es respuesta, y
  -- si alguien lo cambiara, HT120 lo rechazaría.
  -- ---------------------------------------------------------------------------
  respuestas as (
    insert into public.publicaciones_comentarios
      (iglesia_id, publicacion_id, autor_miembro_id, texto, respuesta_a_id, created_at)
    select i.id, c.publicacion_id, g.id, v.texto, c.id, now() - interval '2 hours'
    from (values
      ('Mi hijo toca el bajo',   'David',  'Perfecto, Carmen. Que venga el jueves y probamos.'),
      ('Estamos orando, Amparo', 'Amparo', 'Gracias, pastor. Les cuento en cuanto salga del quirófano.'),
      ('Qué alegría, Rubén',     'Rubén',  'Allí estaré. Gracias, David.')
    ) as v(busca, autor, texto)
    join comentarios c on c.texto like '%' || v.busca || '%'
    join gente g on g.nombre = v.autor
    cross join iglesia i
    returning id
  ),

  -- ---------------------------------------------------------------------------
  -- «Me gusta» de las publicaciones. Se reparten sin repetir pareja, que es lo
  -- que impide la clave primaria.
  -- ---------------------------------------------------------------------------
  gustos as (
    insert into public.publicaciones_me_gusta (iglesia_id, publicacion_id, miembro_id)
    select i.id, n.id, g.id
    from (values
      ('Gracias a todos por el domingo', 'Lucía'),
      ('Gracias a todos por el domingo', 'Marta'),
      ('Gracias a todos por el domingo', 'Pilar'),
      ('Gracias a todos por el domingo', 'David'),
      ('El ensayo de alabanza',          'Lucía'),
      ('Les pido que oren',              'Brandon'),
      ('Les pido que oren',              'Lucía'),
      ('Les pido que oren',              'Elena'),
      ('Les pido que oren',              'Marta'),
      ('Les pido que oren',              'Carmen'),
      ('Quiero dar gracias',             'Brandon'),
      ('Quiero dar gracias',             'Lucía'),
      ('Quiero dar gracias',             'Amparo'),
      ('Quiero dar gracias',             'Pilar'),
      ('Quiero dar gracias',             'David'),
      ('Quiero dar gracias',             'Elena'),
      ('Quiero dar gracias',             'Marta')
    ) as v(busca, autor)
    join nuevas n on n.texto like '%' || v.busca || '%'
    join gente g on g.nombre = v.autor
    cross join iglesia i
    returning publicacion_id
  )

-- ---------------------------------------------------------------------------
-- Y «me gusta» de comentarios, que es lo que estrena la migración 0035.
-- ---------------------------------------------------------------------------
insert into public.publicaciones_comentarios_me_gusta
  (iglesia_id, comentario_id, miembro_id)
select i.id, c.id, g.id
from (values
  ('Estamos orando, Amparo', 'Amparo'),
  ('Estamos orando, Amparo', 'Lucía'),
  ('Estamos orando, Amparo', 'Elena'),
  ('Aquí estamos para lo que', 'Amparo'),
  ('Qué alegría, Rubén',      'Rubén'),
  ('Qué alegría, Rubén',      'Pilar'),
  ('Amén. Yo me llevé',       'Brandon')
) as v(busca, autor)
join comentarios c on c.texto like '%' || v.busca || '%'
join gente g on g.nombre = v.autor
cross join iglesia i;

commit;
