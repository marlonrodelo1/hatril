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


-- ===========================================================================
-- El devocional de HOY, con su versículo
--
-- Corona el muro: primero el versículo y debajo el devocional. Los dos salen de
-- la MISMA fila de `devocionales` —la tabla ya tenía `versiculo` y `referencia`
-- desde la 0012— y por eso no hizo falta tabla nueva.
--
-- El texto del versículo es de la Reina-Valera de 1909, que es de dominio
-- público. La RVR60 tiene derechos de Sociedades Bíblicas Unidas y no puede ir
-- ni siquiera en un fichero de demostración: lo que se copia en las pruebas
-- acaba copiado en producción.
--
-- `on conflict` porque hay un único por (iglesia, fecha): volver a ejecutar el
-- seed actualiza el de hoy en vez de reventar.
-- ===========================================================================

insert into public.devocionales (
  iglesia_id, fecha, titulo, versiculo, referencia, cuerpo,
  imagen_url, autor_miembro_id, publicado
)
select
  i.id,
  (now() at time zone i.timezone)::date,
  'Cuando todo tiembla',
  'Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.',
  'Salmos 46:1 (RV1909)',
  E'Hay semanas en que uno llega al domingo sin nada que ofrecer. El trabajo, una carta del banco, una llamada del hospital. Y entonces se canta «Dios es nuestro amparo» con la voz rota, porque no es un adorno: es lo unico que queda de pie.\n\nEsta semana, antes de pedir nada, dale gracias por tres cosas concretas. No generales. Tres, con nombre y apellido.',
  d.imagen_url,
  m.id,
  true
from public.iglesias i
left join public.miembros m
  on m.iglesia_id = i.id and m.nombre = 'David'
left join lateral (
  select imagen_url from public.devocionales
   where iglesia_id = i.id and imagen_url is not null
   order by fecha desc limit 1
) d on true
where i.slug = 'betania'
on conflict (iglesia_id, fecha) do update set
  titulo      = excluded.titulo,
  versiculo   = excluded.versiculo,
  referencia  = excluded.referencia,
  cuerpo      = excluded.cuerpo,
  imagen_url  = excluded.imagen_url,
  publicado   = true;


-- ===========================================================================
-- Las fotos de la demostración
--
-- DE DÓNDE SALEN
-- --------------
-- Los paisajes son de **Picsum**, que sirve fotografías de Unsplash: licencia
-- de uso comercial y sin atribución obligatoria. Los retratos, de
-- **Pravatar**, caras pensadas para prototipos.
--
-- Se descartó `loremflickr`, que sí deja buscar por tema —«church», «worship»—
-- pero sirve fotos de Flickr con Creative Commons: casi todas exigen
-- atribución. Meter eso en un producto que se cobra es el mismo problema que la
-- Reina-Valera 1960, en pequeño.
--
-- Y NO SE ENLAZAN, SE COPIAN
-- --------------------------
-- Las cuatro escenas y los cinco retratos están SUBIDOS al bucket de la
-- iglesia. Enlazarlos desde el banco dejaría la demo dependiendo de que un
-- tercero siga vivo, y le daría a ese tercero la visita de cada persona que
-- abriera el muro. Se subieron con el script del scratchpad de la sesión del
-- 22-ago-2026; si algún día hay que repetirlo, es descargar y hacer POST al
-- endpoint `/storage/v1/object/` con la clave de servicio.
--
-- QUÉ VA EN CADA COLUMNA, QUE NO ES LO MISMO
-- ------------------------------------------
--   - `publicaciones.imagenes`: la RUTA dentro del bucket PRIVADO. Nunca una
--     URL — se firma al pintar y caduca en una hora, así que una URL guardada
--     aquí sería una cadena que mañana no abre nada.
--   - `devocionales.imagen_url`: una URL permanente del bucket PÚBLICO, porque
--     el devocional sale también en la web de la calle.
--   - `miembros.foto_url`: hoy, URL pública. Y eso NO vale para producción: la
--     foto de un miembro es dato personal y va al bucket privado con URL
--     firmada, igual que las del muro. Lo que falta para eso es firmarla en la
--     consulta; la columna ya es la buena.
-- ===========================================================================

update public.publicaciones p
   set imagenes = v.imgs::jsonb
  from (values
    ('Gracias a todos por el domingo', '["aaaaaaaa-1111-4111-8111-000000000001/demo/paisaje-1.jpg"]'),
    ('Quiero dar gracias',             '["aaaaaaaa-1111-4111-8111-000000000001/demo/paisaje-2.jpg"]'),
    ('El ensayo de alabanza',          '["aaaaaaaa-1111-4111-8111-000000000001/demo/paisaje-3.jpg"]')
  ) as v(busca, imgs)
 where p.texto like '%' || v.busca || '%'
   and p.iglesia_id = (select id from public.iglesias where slug = 'betania');

update public.devocionales d
   set imagen_url = 'https://qutoggpigkdginvburjv.supabase.co/storage/v1/object/public/iglesias-publico/aaaaaaaa-1111-4111-8111-000000000001/demo/portada.jpg'
 where d.iglesia_id = (select id from public.iglesias where slug = 'betania')
   and d.publicado = true;

-- No se le pone foto a todo el mundo a propósito: en una congregación real casi
-- nadie tendrá, porque el pastor da de alta desde una lista. Con la mitad sin
-- foto se ve cómo queda el muro de verdad, mezclando retratos e iniciales.
update public.miembros m
   set foto_url =
     'https://qutoggpigkdginvburjv.supabase.co/storage/v1/object/public/iglesias-publico/aaaaaaaa-1111-4111-8111-000000000001/perfiles/'
     || v.fichero
  from (values
    ('Brandon', 'brandon.jpg'),
    ('Lucía',   'lucia.jpg'),
    ('Pilar',   'pilar.jpg'),
    ('David',   'david.jpg'),
    ('Amparo',  'amparo.jpg')
  ) as v(quien, fichero)
 where m.nombre = v.quien
   and m.iglesia_id = (select id from public.iglesias where slug = 'betania');
