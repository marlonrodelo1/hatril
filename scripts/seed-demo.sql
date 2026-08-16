-- ============================================================================
-- DATOS DE PRUEBA
--
-- NO ES SCHEMA. No va en `drizzle/` a propósito: si estuviera en la cadena de
-- migraciones, cualquier despliegue limpio metería una iglesia inventada en
-- producción. Esto se ejecuta a mano, y solo contra una base de desarrollo.
--
--   psql "$DATABASE_URL" -f scripts/seed-demo.sql
--
-- Contraseña de todas las cuentas: Hatril2026
--
--   pastor@hatril.test        Pastor de Betania. Lo ve y lo toca todo.
--   secretaria@hatril.test    Secretaría. Ficha de miembros y solicitudes,
--                             pero no ajustes ni facturación.
--   lider@hatril.test         Líder de Alabanza. Ve solo su ministerio.
--   miembro@hatril.test       Miembro. Solo su propia ficha.
--   visita@hatril.test        Sin iglesia, con solicitud pendiente. Para ver
--                             /mi y la bandeja del panel.
--   admin@hatril.test         Super admin de la plataforma.
--   pastor.sion@hatril.test   Pastor de OTRA iglesia. Es la prueba de que el
--                             aislamiento funciona: desde aquí no se ve nada
--                             de Betania.
--
-- Dos iglesias: Betania (publicada, en el directorio) y Sion (sin publicar,
-- para comprobar que no aparece en el buscador ni tiene web pública).
-- ============================================================================

create or replace function public._seed_usuario(
  p_id uuid, p_email text, p_password text, p_nombre text
) returns uuid
language plpgsql
as $$
begin
  /*
   * Replica lo que hace el Auth admin API de Supabase.
   *
   * DOS COSAS QUE COSTARON UN 500 SIN PISTAS
   * ----------------------------------------
   * 1. Hace falta la fila en `auth.identities` con provider 'email'. Sin ella,
   *    GoTrue no encuentra con qué validar la contraseña.
   *
   * 2. Las columnas de token tienen que ser CADENA VACÍA, nunca NULL. GoTrue
   *    las lee en campos `string` de Go y un NULL revienta la consulta con
   *    «Database error querying schema» — un 500 genérico que no menciona ni
   *    la tabla ni la columna. Es el fallo más difícil de diagnosticar de todo
   *    esto, y solo aparece al intentar iniciar sesión de verdad.
   */
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change,
    phone_change_token, reauthentication_token,
    created_at, updated_at
  ) values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre),
    '', '', '', '', '', '', '', '',
    now(), now()
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  )
  on conflict do nothing;

  return p_id;
end;
$$;

select public._seed_usuario('11111111-1111-4111-8111-000000000001','pastor@hatril.test','Hatril2026','Brandon Molina');
select public._seed_usuario('11111111-1111-4111-8111-000000000002','secretaria@hatril.test','Hatril2026','Pilar Ramos');
select public._seed_usuario('11111111-1111-4111-8111-000000000003','lider@hatril.test','Hatril2026','David Quiroga');
select public._seed_usuario('11111111-1111-4111-8111-000000000004','miembro@hatril.test','Hatril2026','Lucía Ferrer');
select public._seed_usuario('11111111-1111-4111-8111-000000000005','visita@hatril.test','Hatril2026','Nuria Cabrera');
select public._seed_usuario('11111111-1111-4111-8111-000000000006','admin@hatril.test','Hatril2026','Marlon Rodelo');
select public._seed_usuario('22222222-2222-4222-8222-000000000001','pastor.sion@hatril.test','Hatril2026','Sergio Peñas');

insert into public.admin_users (auth_user_id, notas)
values ('11111111-1111-4111-8111-000000000006', 'Cuenta de prueba')
on conflict (auth_user_id) do nothing;

insert into public.iglesias (
  id, slug, nombre, denominacion, descripcion, historia,
  pais, ciudad, direccion, timezone, moneda, telefono, email,
  visible_en_directorio, acepta_solicitudes, web_publica,
  horarios, cuenta_donativos, titular_donativos, plan, trial_until
) values (
  'aaaaaaaa-1111-4111-8111-000000000001',
  'betania', 'Iglesia Betania', 'Cuadrangular',
  'Somos una iglesia de barrio. Unas ciento ochenta personas de todas las edades que se acompañan durante la semana. No hace falta avisar, ni vestirse de nada, ni saber nada de antemano.',
  E'Empezamos en 2004 en un local pequeño de la calle Sierra Carbonera, siendo veinte personas. Hoy somos ciento ochenta y cuatro y seguimos a ochocientos metros de allí.\n\nNo somos una iglesia grande y no pretendemos serlo. Lo que sí intentamos es que nadie que entre por la puerta un domingo se vaya sin que alguien sepa su nombre.',
  'CO', 'Bogotá', 'Calle 45 #12-30', 'America/Bogota', 'COP',
  '+573001234567', 'hola@betania.test',
  true, true, true,
  '[
    {"dia":"Domingo","hora":"11:00","nombre":"Culto","detalle":"Hora y media. Los niños tienen su clase a la vez.","destacado":true},
    {"dia":"Martes","hora":"20:00","nombre":"Grupo de jóvenes","detalle":"De 15 a 30 años. Cena ligera y charla."},
    {"dia":"Miércoles","hora":"19:00","nombre":"Reunión de oración","detalle":"Abierta a cualquiera, se puede entrar y salir."},
    {"dia":"Jueves","hora":"19:30","nombre":"Ensayo de alabanza","detalle":"Si tocas algo o cantas, aquí hacen falta manos."}
  ]'::jsonb,
  'Bancolombia 123-456789-01', 'Iglesia Betania',
  'trial', now() + interval '7 days'
) on conflict (id) do nothing;

insert into public.iglesias (
  id, slug, nombre, pais, ciudad, timezone, moneda,
  visible_en_directorio, acepta_solicitudes, web_publica, plan, trial_until
) values (
  'bbbbbbbb-2222-4222-8222-000000000002',
  'sion', 'Iglesia Sion', 'ES', 'Madrid', 'Europe/Madrid', 'EUR',
  false, true, false, 'trial', now() + interval '7 days'
) on conflict (id) do nothing;

insert into public.miembros (id, iglesia_id, auth_user_id, nombre, apellidos, email, telefono, estado, bautizado, fecha_ingreso, fecha_nacimiento, direccion, ciudad, notas)
values
 ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000001','Brandon','Molina','pastor@hatril.test','+573001234567','miembro',true,'2011-03-01','1978-05-14','Calle 45 #12-30','Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002','Pilar','Ramos Ledesma','secretaria@hatril.test','+573001234568','miembro',true,'2017-03-12','1968-01-22','Carrera 7 #44-10','Bogotá','Lleva el fichero desde 2017.'),
 ('cccccccc-0000-4000-8000-000000000003','aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000003','David','Quiroga Mena','lider@hatril.test','+573001234569','miembro',true,'2022-10-03','1988-09-30','Calle 60 #9-15','Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000004','aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000004','Lucía','Ferrer Ramos','miembro@hatril.test','+573001234570','miembro',true,'2021-06-06','1994-03-14','Calle 22 #8-40','Bogotá','Está terminando enfermería y hace prácticas los fines de semana.'),
 ('cccccccc-0000-4000-8000-000000000005','aaaaaaaa-1111-4111-8111-000000000001',null,'Amparo','Gil Moreno',null,'+573001234571','visitante',false,'2026-08-09','1952-11-02',null,'Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000006','aaaaaaaa-1111-4111-8111-000000000001',null,'Rubén','Ortega Salas','ruben@betania.test','+573001234572','nuevo',false,'2026-08-02','1999-07-19',null,'Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000007','aaaaaaaa-1111-4111-8111-000000000001',null,'Carmen','Ibáñez Ruiz','carmen@betania.test','+573001234573','miembro',true,'2016-01-04','1974-02-08','Calle 80 #20-5','Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000008','aaaaaaaa-1111-4111-8111-000000000001',null,'Marta','Belmonte Vera','marta@betania.test','+573001234574','miembro',true,'2020-02-07','1985-12-01',null,'Bogotá',null),
 ('cccccccc-0000-4000-8000-000000000009','aaaaaaaa-1111-4111-8111-000000000001',null,'Elena','Vázquez Soler',null,'+573001234575','inactivo',true,'2019-04-11','1963-06-25',null,'Bogotá',null)
on conflict (id) do nothing;

insert into public.miembros (id, iglesia_id, auth_user_id, nombre, apellidos, estado, fecha_ingreso, direccion)
values ('dddddddd-0000-4000-8000-000000000001','bbbbbbbb-2222-4222-8222-000000000002','22222222-2222-4222-8222-000000000001','Sergio','Peñas Cortés','miembro','2019-09-18','Calle Sion 9, Madrid')
on conflict (id) do nothing;

insert into public.iglesia_usuarios (iglesia_id, auth_user_id, rol, estado, miembro_id, aprobado_at)
values
 ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000001','pastor','activo','cccccccc-0000-4000-8000-000000000001',now()),
 ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002','secretaria','activo','cccccccc-0000-4000-8000-000000000002',now()),
 ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000003','lider','activo','cccccccc-0000-4000-8000-000000000003',now()),
 ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000004','miembro','activo','cccccccc-0000-4000-8000-000000000004',now()),
 ('bbbbbbbb-2222-4222-8222-000000000002','22222222-2222-4222-8222-000000000001','pastor','activo','dddddddd-0000-4000-8000-000000000001',now()),
 ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000005','miembro','pendiente',null,null)
on conflict (iglesia_id, auth_user_id) do nothing;

insert into public.solicitudes_ingreso (iglesia_id, auth_user_id, nombre, email, telefono, mensaje)
values ('aaaaaaaa-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000005','Nuria Cabrera Ledo','visita@hatril.test','+573001234576','Vengo los domingos desde marzo, me presentó Marta. Me gustaría estar al día de lo que hacéis.')
on conflict do nothing;

insert into public.ministerios (id, iglesia_id, nombre, descripcion, color_hex, lider_miembro_id, orden)
values
 ('eeeeeeee-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-000000000001','Alabanza','El equipo de música del domingo. Voces, teclado, guitarra, batería y sonido.','#BD4715','cccccccc-0000-4000-8000-000000000003',1),
 ('eeeeeeee-0000-4000-8000-000000000002','aaaaaaaa-1111-4111-8111-000000000001','Jóvenes','De 15 a 30 años. Grupo semanal, salidas y un retiro al año.','#2F5D50',null,2),
 ('eeeeeeee-0000-4000-8000-000000000003','aaaaaaaa-1111-4111-8111-000000000001','Niños','Clases por edades mientras los padres están en el culto.','#B58A2B','cccccccc-0000-4000-8000-000000000008',3),
 ('eeeeeeee-0000-4000-8000-000000000004','aaaaaaaa-1111-4111-8111-000000000001','Intercesión','Oración por la iglesia y por quien está pasando un mal momento.','#6B645C','cccccccc-0000-4000-8000-000000000007',4)
on conflict (id) do nothing;

insert into public.ministerio_miembros (iglesia_id, ministerio_id, miembro_id, rol_en_ministerio, desde)
values
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000003','Responsable','2022-10-03'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000004','Voz y teclado','2021-06-06'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000008','Voz','2020-02-07'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000004','Apoyo','2024-02-01'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000006','Apoyo','2026-08-02'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000008','Responsable','2020-02-07'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000007','Clase de 3 a 6','2016-01-04'),
 ('aaaaaaaa-1111-4111-8111-000000000001','eeeeeeee-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000007','Responsable','2016-01-04')
on conflict do nothing;

insert into public.consentimientos (iglesia_id, miembro_id, tipo, version_texto)
select 'aaaaaaaa-1111-4111-8111-000000000001', id, 'datos_religiosos', 'privacidad-2026-08'
from public.miembros where iglesia_id = 'aaaaaaaa-1111-4111-8111-000000000001'
on conflict do nothing;

-- La función auxiliar no se queda: era solo para esto.
drop function public._seed_usuario(uuid, text, text, text);
