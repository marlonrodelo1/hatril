-- ============================================================================
-- DATOS DE PRUEBA DE LA RADIO (tanda 6 de docs/modulos/plan.md)
--
-- Va DESPUÉS de `seed-demo.sql` y `seed-base-comun.sql`, que crean Betania y a
-- Sara. Mismo aviso que aquellos: no es schema, no va en `drizzle/`, y solo
-- contra una base de desarrollo.
--
--   node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFileSync} from 'fs'; const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 }); await sql.unsafe(readFileSync('scripts/seed-radio.sql','utf8')); await sql.end();"
--
-- Lo que deja en Betania:
--
--   Radio                 Ministerio de tipo `radio`, como lo crea «Activar»
--                         en /panel/modulos: emisora, turnos y agenda
--                         encendidos. Si ya hay uno de ese tipo no crea otro.
--   Radio Betania         La emisora: señal de SomaFM (Groove Salad, https,
--                         pública y sin registro, que es lo que hacía falta
--                         para probar sin depender de una iglesia de verdad),
--                         tres programas en la parrilla —dos con su tema y
--                         uno sin él, para ver los dos casos— y `en_web`
--                         marcado.
--   Sara Nieto            colider@hatril.test pasa a ser COLÍDER de la radio,
--                         con rol de iglesia `miembro`. Es el caso que prueba
--                         que la casilla de la web es solo del pastor: Sara
--                         lleva la radio, ve la casilla en solo lectura, y si
--                         cambia la señal la radio sale de la web.
--
-- SE PUEDE VOLVER A EJECUTAR
-- --------------------------
-- La config de la emisora SÍ se reescribe cada vez: es lo que hay que tener
-- delante para probar. El resto, solo si falta.
--
-- PARA QUITARLO
-- -------------
-- Al final, comentado. El ministerio se borra entero —no se archiva— porque es
-- de prueba y no tiene turnos ni agenda que conservar; si se le han puesto,
-- se van con él por las claves foráneas.
-- ============================================================================

do $$
declare
  v_iglesia uuid;
  v_ministerio uuid;
  v_ficha_sara uuid;
begin
  select id into v_iglesia from public.iglesias where slug = 'betania';
  if v_iglesia is null then
    raise exception 'No está Betania: ejecuta antes scripts/seed-demo.sql';
  end if;

  select id into v_ministerio
    from public.ministerios
   where iglesia_id = v_iglesia and tipo = 'radio'
   order by orden, nombre
   limit 1;

  if v_ministerio is null then
    insert into public.ministerios (iglesia_id, nombre, color_hex, tipo, modulos, orden)
    values (
      -- El gris de `COLORES_MINISTERIO`: un hex fuera de la paleta caería al
      -- gris de todos modos, y así el fichero dice la verdad.
      v_iglesia, 'Radio', '#6B645C', 'radio',
      '{"agenda": {"activo": true}, "turnos": {"activo": true},
        "emisora": {"activo": true}, "repertorio": {"activo": false},
        "seguimiento": {"activo": false}}'::jsonb,
      100
    )
    returning id into v_ministerio;
  end if;

  -- Solo la clave `emisora`, y conservando su `activo`: lo mismo que hace
  -- `conConfigDeModulo()` desde la pantalla.
  update public.ministerios
     set modulos = modulos || jsonb_build_object(
       'emisora',
       coalesce(modulos -> 'emisora', '{"activo": true}'::jsonb) || '{
         "nombre": "Radio Betania",
         "stream_url": "https://ice1.somafm.com/groovesalad-128-mp3",
         "parrilla": [
           {"dia": "Lunes", "hora": "19:00", "nombre": "Alabanza de la tarde", "tema": "Canciones de la congregación para cerrar el día", "duracion_min": 120},
           {"dia": "Lunes", "hora": "21:00", "nombre": "Palabra para hoy", "tema": "Un capítulo de los Salmos, leído y comentado", "duracion_min": 60},
           {"dia": "Domingo", "hora": "09:00", "nombre": "Culto en directo", "duracion_min": 60}
         ],
         "en_web": true
       }'::jsonb
     )
   where id = v_ministerio;

  select m.id into v_ficha_sara
    from public.miembros m
    join auth.users u on u.id = m.auth_user_id
   where m.iglesia_id = v_iglesia and u.email = 'colider@hatril.test';

  if v_ficha_sara is null then
    raise exception 'No está Sara: ejecuta antes scripts/seed-base-comun.sql';
  end if;

  insert into public.ministerio_miembros
    (iglesia_id, ministerio_id, miembro_id, rol_en_ministerio, rol_equipo, desde)
  values
    (v_iglesia, v_ministerio, v_ficha_sara, 'Locución', 'colider', '2026-10-20')
  on conflict do nothing;
end $$;

-- Para quitarlo todo:
--
-- delete from public.ministerios
--  where tipo = 'radio'
--    and iglesia_id = (select id from public.iglesias where slug = 'betania');
