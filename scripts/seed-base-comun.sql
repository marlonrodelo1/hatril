-- ============================================================================
-- DATOS DE PRUEBA DE LA BASE COMÚN (tanda 0 de docs/modulos/plan.md)
--
-- Va DESPUÉS de `seed-demo.sql`, que es quien crea Betania. Mismo aviso que
-- aquel: no es schema, no va en `drizzle/`, y solo contra una base de
-- desarrollo.
--
--   psql "$DATABASE_URL" -f scripts/seed-base-comun.sql
--
-- o, sin psql, con el mismo postgres-js que usa la aplicación:
--
--   node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFileSync} from 'fs'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await sql.unsafe(readFileSync('scripts/seed-base-comun.sql','utf8')); await sql.end();"
--
-- Contraseña: Hatril2026, como las demás.
--
--   colider@hatril.test   Sara Nieto. Rol de iglesia `miembro` y COLÍDER de
--                         Acción social. Es el caso que la tanda 0 arregla:
--                         liderar un ministerio sin que le hayan tocado el rol
--                         de iglesia. Antes de la tanda 0 esta cuenta no
--                         entra al panel; después tiene que llegar a las
--                         herramientas de Acción social y a ninguna otra, y no
--                         puede quitar ni bajar de rango al responsable.
--
-- Y en Betania, además:
--
--   Acción social         Ministerio de tipo `accion_social`, con la agenda
--                         encendida y lo demás apagado: lo que deja el panel al
--                         crearlo con ese tipo.
--   Marcel Duarte Rey     Responsable de Acción social, SIN cuenta. Que el
--                         responsable no tenga la app es lo normal, y obliga a
--                         que el colíder sea quien la usa.
--   Andrés Prueba Enlace  Ficha SIN cuenta con correo enlace@hatril.test. Para
--                         probar el enlace al aprobar una solicitud: se
--                         registra esa dirección en el navegador, se pide el
--                         ingreso en Betania, y quien aprueba tiene que poder
--                         decir «es esta ficha» en vez de crear otra. La cuenta
--                         NO se crea aquí a propósito: crearla a mano saltaría
--                         justo el camino que hay que probar.
--
-- SE PUEDE VOLVER A EJECUTAR
-- --------------------------
-- Crea lo que falte y no toca lo que ya existe. Si alguien le cambia el rol a
-- la cuenta para probar otra cosa, este fichero no lo deshace: es un seed, no
-- un reset.
--
-- Sin UUIDs escritos a mano, por lo mismo que `seed-muro.sql`: cada cosa se
-- busca por lo que la identifica —la iglesia por su slug, la cuenta por su
-- correo, el ministerio por su nombre— y solo se inserta si no aparece.
-- ============================================================================

-- Un bloque `do` y no la función auxiliar de `seed-demo.sql`: aquí hace falta
-- recordar ids entre pasos, y una función en `public` habría que revocarla
-- (CLAUDE.md) para tirarla tres líneas después. Además el bloque entero es una
-- sola transacción: si algo falla, no queda una cuenta sin ficha.
do $$
declare
  v_iglesia uuid;
  v_ministerio uuid;
  v_cuenta uuid;
  v_ficha_colider uuid;
  v_ficha_responsable uuid;
begin
  select id into v_iglesia from public.iglesias where slug = 'betania';
  if v_iglesia is null then
    raise exception 'No existe Betania: ejecuta antes scripts/seed-demo.sql';
  end if;

  -- --------------------------------------------------------------------------
  -- 1. El ministerio
  --
  -- Se busca como lo compara `uq_ministerios_iglesia_nombre`, en minúsculas:
  -- si el pastor ya creó «Acción Social» desde el panel, se usa ese.
  --
  -- `modulos` es lo que devuelve hoy `componerModulos({}, ['agenda'])`: las
  -- cuatro claves del catálogo, con `activo: false` las apagadas. Se escriben
  -- las cuatro para que el dato sea idéntico al que deja el panel al crear un
  -- ministerio con este tipo, no porque `{agenda}` solo funcionara distinto:
  -- `sinConfigurar()` solo da por no configurado el que no tiene NINGUNA
  -- clave. Si el catálogo de `modulos.ts` crece, esto no hay que tocarlo: una
  -- clave que falta es un módulo apagado.
  --
  -- `orden` 100 por lo mismo que `crearMinisterio`: va detrás de los de
  -- siempre. Y misión, visión y objetivo vacíos, porque rellenarlos es
  -- justo lo que el colíder tiene que poder hacer.
  -- --------------------------------------------------------------------------
  select id into v_ministerio
    from public.ministerios
   where iglesia_id = v_iglesia
     and lower(nombre) = lower('Acción social');

  if v_ministerio is null then
    insert into public.ministerios
      (iglesia_id, nombre, descripcion, tipo, modulos, color_hex, orden)
    values (
      v_iglesia,
      'Acción social',
      'Reparto de alimentos los domingos después del culto y visitas a familias del barrio.',
      'accion_social',
      '{"agenda":{"activo":true},"turnos":{"activo":false},"repertorio":{"activo":false},"seguimiento":{"activo":false}}'::jsonb,
      '#9C3A11',
      100
    )
    returning id into v_ministerio;
  end if;

  -- --------------------------------------------------------------------------
  -- 2. La cuenta del colíder
  --
  -- Lo mismo que `_seed_usuario` en `seed-demo.sql`, con sus dos trampas: la
  -- fila de `auth.identities` con provider 'email', y las columnas de token
  -- como cadena vacía y NUNCA NULL. Sin cualquiera de las dos, iniciar sesión
  -- da un 500 que no dice por qué.
  --
  -- Se busca por correo y no por id: `users_email_partial_key` no deja dos
  -- cuentas con la misma dirección, y si alguien la registró ya desde el
  -- navegador, un insert con id propio reventaría contra ese índice.
  -- --------------------------------------------------------------------------
  select id into v_cuenta from auth.users where email = 'colider@hatril.test';

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
      'colider@hatril.test',
      crypt('Hatril2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', 'Sara Nieto'),
      '', '', '', '', '', '', '', '',
      now(), now()
    );
  end if;

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_cuenta, v_cuenta::text, 'email',
    jsonb_build_object('sub', v_cuenta::text, 'email', 'colider@hatril.test', 'email_verified', true),
    now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  -- --------------------------------------------------------------------------
  -- 3. Su ficha y su membresía
  --
  -- Rol `miembro` y no `lider`, y es el dato que importa de todo el fichero:
  -- con `lider` el panel ya funcionaba antes de la tanda 0 y la prueba no
  -- demostraría nada.
  --
  -- HT101 y HT104 no saltan aunque esto escriba roles: miran `auth.uid()`, y
  -- sin JWT `_escritor_confiable()` deja pasar —es la puerta de crons y
  -- migraciones, la misma por la que entra `seed-demo.sql`—.
  -- --------------------------------------------------------------------------
  select id into v_ficha_colider
    from public.miembros
   where iglesia_id = v_iglesia and auth_user_id = v_cuenta;

  if v_ficha_colider is null then
    insert into public.miembros
      (iglesia_id, auth_user_id, nombre, apellidos, email, telefono,
       estado, bautizado, fecha_ingreso, ciudad)
    values
      (v_iglesia, v_cuenta, 'Sara', 'Nieto Robles', 'colider@hatril.test',
       '+573001234577', 'miembro', true, '2023-05-07', 'Bogotá')
    returning id into v_ficha_colider;
  end if;

  insert into public.iglesia_usuarios
    (iglesia_id, auth_user_id, rol, estado, miembro_id, aprobado_at)
  values (v_iglesia, v_cuenta, 'miembro', 'activo', v_ficha_colider, now())
  on conflict (iglesia_id, auth_user_id) do nothing;

  -- Los consentimientos, como los deja `/acepta` a quien marca las dos
  -- casillas. NO la `privacidad-2026-08` de `seed-demo.sql`: esa ya no es la
  -- vigente, y con ella la cuenta rebotaría a `/acepta` antes de llegar a
  -- ninguna herramienta. Tiene que ser el valor de
  -- `VERSION_POLITICA_PRIVACIDAD` (src/lib/rgpd/consentimiento.ts); si se sube,
  -- se sube aquí.
  --
  -- La de asistencia también, porque si falta, `miembrosSinPermisoDeAsistencia`
  -- la saca de las listas del equipo y la prueba de la agenda saldría coja.
  --
  -- `on conflict do nothing` sin columnas a propósito: el índice que choca es
  -- `uq_consentimiento_vivo`, parcial, y así se cubre sin repetir su `where`.
  insert into public.consentimientos (iglesia_id, miembro_id, tipo, version_texto)
  values
    (v_iglesia, v_ficha_colider, 'datos_religiosos', 'privacidad-2026-09'),
    (v_iglesia, v_ficha_colider, 'asistencia_y_seguimiento', 'privacidad-2026-09')
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 4. El responsable, sin cuenta
  --
  -- Una ficha nueva y no Carmen o Marta, que ya llevan Niños e Intercesión: un
  -- responsable que solo lleva este equipo deja leer la prueba sin preguntarse
  -- de dónde le viene a cada uno el permiso.
  --
  -- Sin consentimiento, a propósito: es una ficha tecleada por el pastor, y esa
  -- vía nunca registra ninguno (ver `estadoConsentimiento()`).
  -- --------------------------------------------------------------------------
  select id into v_ficha_responsable
    from public.miembros
   where iglesia_id = v_iglesia
     and nombre = 'Marcel' and apellidos = 'Duarte Rey';

  if v_ficha_responsable is null then
    insert into public.miembros
      (iglesia_id, nombre, apellidos, telefono, estado, bautizado,
       fecha_ingreso, ciudad)
    values
      (v_iglesia, 'Marcel', 'Duarte Rey', '+573001234578', 'miembro', true,
       '2018-09-02', 'Bogotá')
    returning id into v_ficha_responsable;
  end if;

  -- El responsable primero: así el ministerio nunca tiene un colíder sin nadie
  -- por encima, ni siquiera dentro de esta transacción.
  --
  -- `on conflict do nothing` cubre los dos índices parciales: el de una persona
  -- activa por ministerio y el de un solo responsable. Si el pastor ya nombró
  -- otro responsable a mano, Marcel no entra y la prueba sigue valiendo.
  insert into public.ministerio_miembros
    (iglesia_id, ministerio_id, miembro_id, rol_en_ministerio, rol_equipo, desde)
  values
    (v_iglesia, v_ministerio, v_ficha_responsable, 'Reparto', 'responsable', '2023-01-15')
  on conflict do nothing;

  insert into public.ministerio_miembros
    (iglesia_id, ministerio_id, miembro_id, rol_en_ministerio, rol_equipo, desde)
  values
    (v_iglesia, v_ministerio, v_ficha_colider, 'Cocina', 'colider', '2023-05-07')
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 5. La ficha que se enlazará al aprobar
  --
  -- Se busca por correo y no por nombre: después de la prueba puede llevar
  -- `auth_user_id`, y lo que no cambia es la dirección. Correo Y teléfono, para
  -- que se pueda probar la coincidencia por cualquiera de los dos.
  --
  -- Sin consentimiento por lo mismo que Marcel: es una ficha tecleada por el
  -- pastor, y así llegan las de verdad. La aprobación registra entonces el
  -- `datos_religiosos` que la persona dio al solicitar. Si la ficha ya trajera
  -- uno vivo tampoco chocaría con `uq_consentimiento_vivo`: la aprobación lo
  -- revoca antes de insertar el nuevo.
  -- --------------------------------------------------------------------------
  if not exists (
    select 1 from public.miembros
     where iglesia_id = v_iglesia and lower(email) = 'enlace@hatril.test'
  ) then
    insert into public.miembros
      (iglesia_id, nombre, apellidos, email, telefono, estado, bautizado,
       fecha_ingreso, ciudad)
    values
      (v_iglesia, 'Andrés', 'Prueba Enlace', 'enlace@hatril.test',
       '+573001234579', 'miembro', false, '2024-11-03', 'Bogotá');
  end if;
end;
$$;
