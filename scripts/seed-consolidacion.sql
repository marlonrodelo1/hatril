-- ============================================================================
-- DATOS DE PRUEBA DE CONSOLIDACIÓN (tanda 4 de docs/modulos/plan.md)
--
-- Va DESPUÉS de `seed-demo.sql` y `seed-base-comun.sql`. Mismo aviso que
-- ellos: no es schema, no va en `drizzle/`, y solo contra una base de
-- desarrollo.
--
--   node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFileSync} from 'fs'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await sql.unsafe(readFileSync('scripts/seed-consolidacion.sql','utf8')); await sql.end();"
--
-- Contraseña: Hatril2026, como las demás.
--
--   consolidacion@hatril.test  Noemí Carrasco. Rol de iglesia `miembro`,
--                              RESPONSABLE de Consolidación y con el permiso
--                              `ver_seguimiento` marcado a mano. Es la persona
--                              para la que existe la tanda: lleva el equipo
--                              que llama a los nuevos, sin ser pastora ni
--                              secretaria. Si Consolidación ya tiene
--                              responsable, entra como colíder.
--
-- Y en Betania, además:
--
--   Tres cultos del domingo   Los tres últimos domingos contados desde hoy,
--   con lista                 sin ministerio. Con lista pasada a toda la
--                             congregación que podía salir en ella (como hace
--                             `listaParaPasar`: sin quien negó el permiso de
--                             asistencia y sin fichas creadas después del
--                             culto). Ausentes a propósito: Marta y Elena en
--                             los tres (salen en «faltan 3 o más»), David en
--                             el último, y Amparo y Rubén, que llegaron en
--                             agosto, en los tres.
--
--   Cinco personas nuevas, una por caso de la pantalla «Nuevos»:
--     Esteban Cruz Lara      visitante, llegó el último domingo y vino.
--                            «Aún no se ha pasado lista desde que llegó».
--                            Sin contactar.
--     Valeria Ospina Ríos    visitante, llegó hace dos semanas y no ha
--                            vuelto. Sin contactar: es la que hay que llamar.
--     Julián Pardo Mesa      nuevo, llegó hace dos semanas y volvió el último
--                            domingo. Le acompaña Noemí, con una llamada.
--     Camila Restrepo Gil    nuevo, llegó hace dos semanas y ha venido a los
--                            tres: «se queda».
--     Tomás Herrera Vidal    visitante, llegó hace una semana y NEGÓ el
--                            permiso de asistencia (general al día, sin el de
--                            asistencia). No puede salir en ninguna lista ni
--                            contar en ninguna cifra.
--     Lorena Gaitán Ruiz     visitante, llegó el lunes de esta semana con los
--                            dos permisos, como la deja el alta rápida. Y
--                            alguien volvió a guardar después las listas de los
--                            dos últimos domingos: `guardarLista` escribe una
--                            fila por cada ficha que existe al guardar, así que
--                            le quedó un «no vino» en dos cultos ANTERIORES a
--                            su llegada. No pueden contarle como faltas: tiene
--                            que salir con cero y «no sabemos si ha vuelto».
--
-- Las fichas nuevas se crean HOY, con su fecha de llegada atrás: es la tarjeta
-- de papel tecleada después. Sus filas de asistencia son de listas pasadas con
-- retraso, que es justo el caso que `ausenciasPrevias` cubre en
-- `src/lib/seguimiento/consultas.ts`.
--
-- Las fechas son relativas a hoy, así que la prueba sigue valiendo otro día.
-- Pasados 90 días, eso sí, los nuevos dejan de serlo: se vuelve a ejecutar.
--
-- SE PUEDE VOLVER A EJECUTAR
-- --------------------------
-- Crea lo que falte y no toca lo que ya existe, como `seed-base-comun.sql`.
-- Sin UUIDs escritos a mano: cada cosa se busca por lo que la identifica.
-- ============================================================================

do $$
declare
  v_iglesia uuid;
  v_ministerio uuid;
  v_cuenta uuid;
  v_noemi uuid;
  -- Los tres últimos domingos. `date_trunc('week')` da el lunes de esta
  -- semana; un día antes es el domingo pasado (o el de hoy menos siete, si
  -- hoy es domingo y aún no se ha pasado lista).
  v_d0 date := (date_trunc('week', current_date)::date - 1);
  v_d1 date := (date_trunc('week', current_date)::date - 8);
  v_d2 date := (date_trunc('week', current_date)::date - 15);
  v_reunion uuid;
  v_fecha date;
  v_nuevo record;
  v_id uuid;
begin
  select id into v_iglesia from public.iglesias where slug = 'betania';
  if v_iglesia is null then
    raise exception 'No existe Betania: ejecuta antes scripts/seed-demo.sql';
  end if;

  -- --------------------------------------------------------------------------
  -- 1. El ministerio de Consolidación, con el seguimiento encendido
  -- --------------------------------------------------------------------------
  select id into v_ministerio
    from public.ministerios
   where iglesia_id = v_iglesia
     and lower(nombre) = lower('Consolidación');

  if v_ministerio is null then
    insert into public.ministerios
      (iglesia_id, nombre, descripcion, tipo, modulos, color_hex, orden)
    values (
      v_iglesia,
      'Consolidación',
      'Acompañar a quien llega nuevo y a quien ha dejado de venir.',
      'consolidacion',
      '{"agenda":{"activo":true},"turnos":{"activo":false},"repertorio":{"activo":false},"seguimiento":{"activo":true}}'::jsonb,
      '#7A4B2A',
      100
    )
    returning id into v_ministerio;
  end if;

  -- --------------------------------------------------------------------------
  -- 2. La cuenta de Noemí, con las dos trampas de `seed-base-comun.sql`: la
  --    fila de `auth.identities` y los tokens como cadena vacía, nunca NULL.
  -- --------------------------------------------------------------------------
  select id into v_cuenta from auth.users where email = 'consolidacion@hatril.test';

  if v_cuenta is null then
    v_cuenta := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, email_change, phone_change,
      phone_change_token, reauthentication_token,
      created_at, updated_at
    ) values (
      v_cuenta,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'consolidacion@hatril.test',
      crypt('Hatril2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', 'Noemí Carrasco'),
      '', '', '', '', '', '', '', '',
      now(), now()
    );
  end if;

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_cuenta, v_cuenta::text, 'email',
    jsonb_build_object('sub', v_cuenta::text, 'email', 'consolidacion@hatril.test', 'email_verified', true),
    now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  select id into v_noemi
    from public.miembros
   where iglesia_id = v_iglesia and auth_user_id = v_cuenta;

  if v_noemi is null then
    insert into public.miembros
      (iglesia_id, auth_user_id, nombre, apellidos, email, telefono,
       estado, bautizado, fecha_ingreso, ciudad)
    values
      (v_iglesia, v_cuenta, 'Noemí', 'Carrasco Gil', 'consolidacion@hatril.test',
       '+573001234580', 'miembro', true, '2019-03-10', 'Bogotá')
    returning id into v_noemi;
  end if;

  -- `ver_seguimiento` como excepción explícita: no es defecto de ningún rol, y
  -- el pastor lo reparte a mano (`permisos.ts`). Es lo que se prueba.
  insert into public.iglesia_usuarios
    (iglesia_id, auth_user_id, rol, estado, miembro_id, aprobado_at, permisos)
  values (v_iglesia, v_cuenta, 'miembro', 'activo', v_noemi, now(),
          '{"ver_seguimiento": true}'::jsonb)
  on conflict (iglesia_id, auth_user_id) do nothing;

  -- Las dos casillas de `/acepta`, en la versión vigente
  -- (`VERSION_POLITICA_PRIVACIDAD`). Sin la de asistencia, Noemí no saldría en
  -- la lista del culto, y la prueba de «se queda» saldría coja.
  insert into public.consentimientos (iglesia_id, miembro_id, tipo, version_texto)
  values
    (v_iglesia, v_noemi, 'datos_religiosos', 'privacidad-2026-09'),
    (v_iglesia, v_noemi, 'asistencia_y_seguimiento', 'privacidad-2026-09')
  on conflict do nothing;

  -- Responsable si el equipo no lo tiene; si no, colíder. Las dos cosas son
  -- «liderar», que es lo que abre el panel (tanda 0).
  if not exists (
    select 1 from public.ministerio_miembros
     where ministerio_id = v_ministerio and miembro_id = v_noemi and activo
  ) then
    insert into public.ministerio_miembros
      (iglesia_id, ministerio_id, miembro_id, rol_en_ministerio, rol_equipo, desde)
    values (
      v_iglesia, v_ministerio, v_noemi, 'Consolidación',
      case when exists (
        select 1 from public.ministerio_miembros
         where ministerio_id = v_ministerio and rol_equipo = 'responsable' and activo
      ) then 'colider'::rol_equipo_enum else 'responsable'::rol_equipo_enum end,
      '2024-02-04'
    );
  end if;

  -- --------------------------------------------------------------------------
  -- 3. Las cinco personas nuevas
  --
  -- Tomás lleva el general al día y NO el de asistencia: es como lo deja quien
  -- pasa por `/acepta` y no marca la segunda casilla.
  -- --------------------------------------------------------------------------
  for v_nuevo in
    select * from (values
      ('Esteban', 'Cruz Lara',      '+573001234581', 'visitante'::estado_miembro_enum, v_d0),
      ('Valeria', 'Ospina Ríos',    '+573001234582', 'visitante'::estado_miembro_enum, v_d2),
      ('Julián',  'Pardo Mesa',     '+573001234583', 'nuevo'::estado_miembro_enum,     v_d2),
      ('Camila',  'Restrepo Gil',   '+573001234584', 'nuevo'::estado_miembro_enum,     v_d2),
      ('Tomás',   'Herrera Vidal',  '+573001234585', 'visitante'::estado_miembro_enum, v_d1),
      ('Lorena',  'Gaitán Ruiz',    '+573001234586', 'visitante'::estado_miembro_enum, v_d0 + 1)
    ) as t(nombre, apellidos, telefono, estado, llegada)
  loop
    if not exists (
      select 1 from public.miembros
       where iglesia_id = v_iglesia
         and nombre = v_nuevo.nombre and apellidos = v_nuevo.apellidos
    ) then
      insert into public.miembros
        (iglesia_id, nombre, apellidos, telefono, estado, fecha_ingreso, ciudad)
      values
        (v_iglesia, v_nuevo.nombre, v_nuevo.apellidos, v_nuevo.telefono,
         v_nuevo.estado, v_nuevo.llegada, 'Bogotá')
      returning id into v_id;

      if v_nuevo.nombre = 'Tomás' then
        insert into public.consentimientos (iglesia_id, miembro_id, tipo, version_texto)
        values (v_iglesia, v_id, 'datos_religiosos', 'privacidad-2026-09')
        on conflict do nothing;
      end if;

      -- Como la deja el alta rápida con las dos casillas marcadas.
      if v_nuevo.nombre = 'Lorena' then
        insert into public.consentimientos (iglesia_id, miembro_id, tipo, version_texto)
        values
          (v_iglesia, v_id, 'datos_religiosos', 'privacidad-2026-09'),
          (v_iglesia, v_id, 'asistencia_y_seguimiento', 'privacidad-2026-09')
        on conflict do nothing;
      end if;
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 4. Los tres cultos y su lista
  -- --------------------------------------------------------------------------
  foreach v_fecha in array array[v_d2, v_d1, v_d0]
  loop
    select id into v_reunion
      from public.reuniones
     where iglesia_id = v_iglesia
       and ministerio_id is null
       and fecha = v_fecha
       and titulo = 'Culto del domingo';

    if v_reunion is null then
      insert into public.reuniones (iglesia_id, titulo, fecha, hora, lugar)
      values (v_iglesia, 'Culto del domingo', v_fecha, '10:00', 'Templo')
      returning id into v_reunion;
    end if;

    -- Quién sale en la lista: lo mismo que `listaParaPasar` —fichas vivas, sin
    -- bajas y sin quien negó el permiso— y además solo quien ya existía o ya
    -- había llegado ese domingo. Los cinco nuevos son tarjetas tecleadas hoy:
    -- salen en las listas desde su llegada, como si se hubieran pasado tarde.
    insert into public.asistencias (iglesia_id, reunion_id, miembro_id, presente)
    select
      v_iglesia,
      v_reunion,
      m.id,
      case
        -- Ausentes de siempre.
        when (m.nombre, m.apellidos) in (
          ('Marta', 'Belmonte Vera'), ('Elena', 'Vázquez Soler'),
          ('Amparo', 'Gil Moreno'), ('Rubén', 'Ortega Salas')
        ) then false
        when (m.nombre, m.apellidos) = ('David', 'Quiroga Mena') then v_fecha <> v_d0
        -- Los nuevos, cada uno con su caso.
        when (m.nombre, m.apellidos) = ('Valeria', 'Ospina Ríos') then v_fecha = v_d2
        when (m.nombre, m.apellidos) = ('Julián', 'Pardo Mesa') then v_fecha <> v_d1
        else true
      end
    from public.miembros m
    where m.iglesia_id = v_iglesia
      and m.archivado_at is null
      and m.estado <> 'baja'
      and (
        (m.fecha_ingreso is not null and m.fecha_ingreso <= v_fecha
           and (m.nombre, m.apellidos) in (
             ('Esteban', 'Cruz Lara'), ('Valeria', 'Ospina Ríos'),
             ('Julián', 'Pardo Mesa'), ('Camila', 'Restrepo Gil')))
        or m.created_at::date <= v_fecha
      )
      -- Sin quien negó el permiso: general al día y sin el de asistencia.
      and not (
        exists (select 1 from public.consentimientos c
                 where c.miembro_id = m.id and c.tipo = 'datos_religiosos'
                   and c.version_texto = 'privacidad-2026-09' and c.revocado_at is null)
        and not exists (select 1 from public.consentimientos c
                 where c.miembro_id = m.id and c.tipo = 'asistencia_y_seguimiento'
                   and c.revocado_at is null)
      )
    on conflict (reunion_id, miembro_id) do nothing;
  end loop;

  -- --------------------------------------------------------------------------
  -- 4 bis. Las listas vueltas a guardar después de apuntar a Lorena
  --
  -- Las dos ya existían; al guardarlas otra vez, ella sale desmarcada en las
  -- dos, ocho y un día antes de llegar.
  -- --------------------------------------------------------------------------
  select id into v_id
    from public.miembros
   where iglesia_id = v_iglesia and nombre = 'Lorena' and apellidos = 'Gaitán Ruiz';

  insert into public.asistencias (iglesia_id, reunion_id, miembro_id, presente)
  select v_iglesia, r.id, v_id, false
    from public.reuniones r
   where r.iglesia_id = v_iglesia
     and r.ministerio_id is null
     and r.titulo = 'Culto del domingo'
     and r.fecha in (v_d1, v_d0)
  on conflict (reunion_id, miembro_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 5. Julián: le acompaña Noemí, y ya le llamó
  -- --------------------------------------------------------------------------
  select id into v_id
    from public.miembros
   where iglesia_id = v_iglesia and nombre = 'Julián' and apellidos = 'Pardo Mesa';

  insert into public.seguimiento_asignaciones
    (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id, desde)
  values (v_iglesia, v_ministerio, v_id, v_noemi, v_d2 + 1)
  on conflict do nothing;

  if not exists (
    select 1 from public.seguimiento_contactos
     where ministerio_id = v_ministerio and miembro_id = v_id
  ) then
    insert into public.seguimiento_contactos
      (iglesia_id, ministerio_id, miembro_id, autor_miembro_id, fecha, via, resultado)
    values (v_iglesia, v_ministerio, v_id, v_noemi, v_d2 + 2, 'llamada', 'volvera');
  end if;
end;
$$;
