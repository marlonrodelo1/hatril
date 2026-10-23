-- ============================================================================
-- DATOS DE PRUEBA DE LAS CÉLULAS (punto 2 de docs/modulos/cola.md)
--
-- Va DESPUÉS de `seed-demo.sql` y `seed-base-comun.sql`, que crean Betania, a
-- Sara (colider@) y a Andrés (enlace@). Mismo aviso que aquellos: no es schema,
-- no va en `drizzle/`, y solo contra una base de desarrollo.
--
--   node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFileSync} from 'fs'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await sql.unsafe(readFileSync('scripts/seed-celulas.sql','utf8')); await sql.end();"
--
-- Lo que deja en Betania, que es lo que se creó desde las pantallas el 22-oct
-- al probarlo y que esto reproduce si falta:
--
--   Células      Ministerio de tipo `celulas`, como lo crea «Activar» en
--                /panel/modulos: grupos y agenda encendidos. La red, sin
--                responsable; Sara Nieto (colider@, rol `miembro`) de colíder,
--                que es quien la lleva desde dentro.
--   Los Pinos    Martes 19:30, Kennedy. La lleva Andrés (enlace@, rol
--                `miembro`, voluntario de la red): es el líder de célula de
--                las pruebas. Van Lucía Ferrer (miembro@, la participante con
--                cuenta) y Carmen Ibáñez.
--   El Prado     Miércoles 20:00, Suba. La lleva Marta Belmonte (sin cuenta).
--                Van Marcel Duarte y Julián Pardo. Es «la otra célula»: Andrés
--                no tiene que ver a nadie de aquí.
--
-- Las dos con fecha de alta del 5-oct, para que la del miércoles salga sin
-- reportar en cuanto pasa su día: es el caso del aviso.
--
-- Lo que NO crea, y quedó en la base de las pruebas del 22-oct: el reporte de
-- Los Pinos de la semana del 19-oct (3 y 2 visitas, firmado por Andrés), la
-- guía del 19 y del 26-oct (firmada por Sara), y la cuenta invitada@hatril.test
-- —Inés Invitada, contraseña la de siempre de la demo— con su solicitud
-- aprobada, que entró por el enlace de Los Pinos y está dentro como
-- participante. Son datos de prueba de una pantalla, no de partida.
--
-- SE PUEDE VOLVER A EJECUTAR
-- --------------------------
-- Solo inserta lo que falta, buscando por nombre. No reescribe códigos de
-- invitación ni reportes.
--
-- PARA QUITARLO
-- -------------
-- Al final, comentado. El ministerio se borra entero, con sus grupos, su gente
-- y sus semanas en cascada.
-- ============================================================================

do $$
declare
  v_iglesia uuid;
  v_ministerio uuid;
  v_sara uuid;
  v_andres uuid;
  v_marta uuid;
  v_pinos uuid;
  v_prado uuid;
  -- El mismo alfabeto que `lib/grupos/codigo.ts` y `ck_grupos_codigo`. Los
  -- bytes, de `gen_random_uuid()`, que sale de un generador criptográfico; los
  -- 0..5 y 10..11 porque son los que no lleva fijos la versión 4.
  c_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
  i int;
begin
  select id into v_iglesia from public.iglesias where slug = 'betania';
  if v_iglesia is null then
    raise exception 'No está Betania: ejecuta antes scripts/seed-demo.sql';
  end if;

  select m.id into v_sara from public.miembros m join auth.users u on u.id = m.auth_user_id
   where m.iglesia_id = v_iglesia and u.email = 'colider@hatril.test';
  select m.id into v_andres from public.miembros m join auth.users u on u.id = m.auth_user_id
   where m.iglesia_id = v_iglesia and u.email = 'enlace@hatril.test';
  select id into v_marta from public.miembros
   where iglesia_id = v_iglesia and nombre = 'Marta' and apellidos = 'Belmonte Vera';
  if v_sara is null or v_andres is null or v_marta is null then
    raise exception 'Faltan Sara, Andrés o Marta: ejecuta antes seed-demo.sql y seed-base-comun.sql';
  end if;

  select id into v_ministerio from public.ministerios
   where iglesia_id = v_iglesia and tipo = 'celulas'
   order by orden, nombre limit 1;

  if v_ministerio is null then
    insert into public.ministerios (iglesia_id, nombre, color_hex, tipo, modulos, orden)
    values (
      v_iglesia, 'Células', '#6B645C', 'celulas',
      '{"grupos": {"activo": true}, "agenda": {"activo": true},
        "turnos": {"activo": false}, "repertorio": {"activo": false},
        "seguimiento": {"activo": false}, "reparto": {"activo": false},
        "emisora": {"activo": false}}'::jsonb,
      100
    )
    returning id into v_ministerio;
  end if;

  -- El equipo de la red. Quien lleva una célula tiene que estar en él (HT132).
  insert into public.ministerio_miembros (iglesia_id, ministerio_id, miembro_id, rol_equipo, desde)
  select v_iglesia, v_ministerio, p.id, p.rol::rol_equipo_enum, '2026-10-05'
    from (values (v_sara, 'colider'), (v_andres, 'voluntario'), (v_marta, 'voluntario')) as p(id, rol)
   where not exists (
     select 1 from public.ministerio_miembros mm
      where mm.ministerio_id = v_ministerio and mm.miembro_id = p.id and mm.activo
   );

  -- Las dos células, si faltan.
  for i in 1..2 loop
    v_bytes := uuid_send(gen_random_uuid());
    v_codigo := '';
    for j in 0..7 loop
      v_codigo := v_codigo || substr(
        c_alfabeto,
        1 + (get_byte(v_bytes, case when j < 6 then j else j + 4 end) % 32),
        1
      );
    end loop;

    if i = 1 and not exists (
      select 1 from public.grupos where ministerio_id = v_ministerio and nombre = 'Los Pinos' and activo
    ) then
      insert into public.grupos (iglesia_id, ministerio_id, nombre, zona, dia_semana, hora, codigo, created_at)
      values (v_iglesia, v_ministerio, 'Los Pinos', 'Kennedy', 2, '19:30', v_codigo, timestamptz '2026-10-05 12:00-05');
    elsif i = 2 and not exists (
      select 1 from public.grupos where ministerio_id = v_ministerio and nombre = 'El Prado' and activo
    ) then
      insert into public.grupos (iglesia_id, ministerio_id, nombre, zona, dia_semana, hora, codigo, created_at)
      values (v_iglesia, v_ministerio, 'El Prado', 'Suba', 3, '20:00', v_codigo, timestamptz '2026-10-05 12:00-05');
    end if;
  end loop;

  select id into v_pinos from public.grupos where ministerio_id = v_ministerio and nombre = 'Los Pinos' and activo;
  select id into v_prado from public.grupos where ministerio_id = v_ministerio and nombre = 'El Prado' and activo;

  -- Su gente. Los líderes, primero: el resto no depende de ellos, pero así se
  -- lee en el orden en que se monta una célula.
  insert into public.grupo_miembros (iglesia_id, ministerio_id, grupo_id, miembro_id, rol_grupo, desde)
  select v_iglesia, v_ministerio, g.grupo, g.persona, g.rol::rol_grupo_enum, '2026-10-05'
    from (
      values (v_pinos, v_andres, 'lider'),
             (v_prado, v_marta, 'lider'),
             (v_pinos, (select id from public.miembros where iglesia_id = v_iglesia and nombre = 'Lucía' and apellidos = 'Ferrer Ramos'), 'participante'),
             (v_pinos, (select id from public.miembros where iglesia_id = v_iglesia and nombre = 'Carmen' and apellidos = 'Ibáñez Ruiz'), 'participante'),
             (v_prado, (select id from public.miembros where iglesia_id = v_iglesia and nombre = 'Marcel' and apellidos = 'Duarte Rey'), 'participante'),
             (v_prado, (select id from public.miembros where iglesia_id = v_iglesia and nombre = 'Julián' and apellidos = 'Pardo Mesa'), 'participante')
    ) as g(grupo, persona, rol)
   where g.persona is not null
     and not exists (
       select 1 from public.grupo_miembros gm
        where gm.grupo_id = g.grupo and gm.miembro_id = g.persona and gm.activo
     );
end $$;

-- Para quitarlo todo (antes, la cuenta de las pruebas, si se quiere):
--
-- delete from public.ministerios
--  where tipo = 'celulas'
--    and iglesia_id = (select id from public.iglesias where slug = 'betania');
