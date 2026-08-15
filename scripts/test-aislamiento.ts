/**
 * Prueba de aislamiento entre iglesias.
 *
 * Es la prueba que no puede fallar nunca. Comprueba que una congregación no
 * alcanza los datos de otra, que una solicitud sin aprobar no ve nada, que
 * nadie puede ascenderse a sí mismo y que `anon` no llega a la tabla de
 * miembros. Con datos de categoría especial del art. 9 del RGPD, un fallo aquí
 * no es un bug: es una brecha que hay que notificar.
 *
 *   npm run test:aislamiento
 *
 * CÓMO NO DEJA RASTRO
 * -------------------
 * Todo corre dentro de un bloque que termina lanzando una excepción a
 * propósito. Eso revierte la transacción entera —los datos de prueba
 * desaparecen— y devuelve el resultado por el mensaje de error. Sin ese truco
 * habría que limpiar a mano, y una limpieza que falla a medias deja una iglesia
 * fantasma en producción.
 *
 * Se ejecuta contra la base que apunte DATABASE_URL. En CI, contra una rama de
 * Supabase; en local, contra la de desarrollo. Nunca contra producción con
 * datos reales: no los tocaría, pero no hay razón para arriesgarse.
 */

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    'Falta DATABASE_URL. Cópiala de Supabase → Project Settings → Database.',
  );
  process.exit(1);
}

const sql = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
  max: 1,
});

const PRUEBA = `
do $$
declare
  r text := E'\\n';
  n int;
  IGL_A constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  IGL_B constant uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  USR_A constant uuid := 'a0000000-0000-4000-8000-00000000000a';
  USR_B constant uuid := 'b0000000-0000-4000-8000-00000000000b';
  USR_C constant uuid := 'c0000000-0000-4000-8000-00000000000c';
begin
  -- Montaje: dos iglesias, dos pastores y una solicitud sin aprobar.
  insert into public.iglesias (id, slug, nombre, ciudad, visible_en_directorio)
  values (IGL_A, 'betania-test', 'Iglesia Betania', 'Bogota', true),
         (IGL_B, 'sion-test',    'Iglesia Sion',    'Madrid', false);

  insert into public.iglesia_usuarios (iglesia_id, auth_user_id, rol, estado)
  values (IGL_A, USR_A, 'pastor',  'activo'),
         (IGL_B, USR_B, 'pastor',  'activo'),
         (IGL_A, USR_C, 'miembro', 'pendiente');

  insert into public.miembros (iglesia_id, nombre, direccion)
  values (IGL_A, 'Lucia',  'Calle Betania 1'),
         (IGL_A, 'Ruben',  'Calle Betania 2'),
         (IGL_B, 'Amparo', 'Calle Sion 9');

  -- --- Numeración correlativa, que la asigna un trigger ---
  select numero_miembro into n from public.miembros where nombre = 'Ruben';
  r := r || format('  %s numeracion correlativa por iglesia (Ruben=%s)\\n',
                   case when n = 2 then 'OK  ' else 'FALLO' end, n);

  select numero_miembro into n from public.miembros where nombre = 'Amparo';
  r := r || format('  %s la numeracion reinicia en otra iglesia (Amparo=%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- La auditoría se escribe sola ---
  select count(*) into n from public.auditoria;
  r := r || format('  %s la auditoria se escribe sola (%s filas)\\n',
                   case when n = 6 then 'OK  ' else 'FALLO' end, n);

  -- --- Aislamiento: pastor de Betania ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format('  %s pastor de Betania ve SUS 2 miembros (%s)\\n',
                   case when n = 2 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.miembros where iglesia_id = IGL_B;
  r := r || format('  %s no alcanza los de Sion ni pidiendolos (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.iglesias;
  r := r || format('  %s solo ve su iglesia y el directorio (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- Aislamiento: pastor de Sion, en el sentido contrario ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format('  %s pastor de Sion ve SU 1 miembro (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- Solicitud pendiente: el requisito del art. 9 ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format('  %s solicitud PENDIENTE no ve la congregacion (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- --- Escalada de privilegios ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  begin
    update public.iglesia_usuarios set rol = 'miembro' where auth_user_id = USR_A;
    r := r || '  FALLO el pastor puede auto-degradarse\\n';
  exception when others then
    r := r || format('  %s auto-degradacion bloqueada (%s)\\n',
                     case when sqlerrm like 'HT101%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 40));
  end;

  begin
    update public.iglesia_usuarios set permisos = '{"ver_datos_sensibles":true}'::jsonb
     where auth_user_id = USR_A;
    r := r || '  FALLO el pastor puede auto-editarse los permisos\\n';
  exception when others then
    r := r || format('  %s auto-edicion de permisos bloqueada\\n',
                     case when sqlerrm like 'HT101%' then 'OK  ' else 'FALLO' end);
  end;

  -- Lo que SI tiene que funcionar: aprobar a otra persona.
  update public.iglesia_usuarios set estado = 'activo', aprobado_por = USR_A
   where auth_user_id = USR_C;
  get diagnostics n = row_count;
  r := r || format('  %s el pastor SI puede aprobar a otro (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  update public.iglesia_usuarios set rol = 'pastor' where auth_user_id = USR_C;
  get diagnostics n = row_count;
  r := r || format('  %s un miembro no puede ascenderse (%s filas tocadas)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- --- anon ---
  execute 'reset role';
  execute 'set local role anon';

  begin
    select count(*) into n from public.miembros;
    r := r || format('  FALLO anon lee la tabla de miembros (%s filas)\\n', n);
  exception when others then
    r := r || '  OK   anon no llega a la tabla de miembros\\n';
  end;

  select count(*) into n from public.iglesias;
  r := r || format('  %s anon ve solo el directorio publicado (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    perform stripe_customer_id from public.iglesias limit 1;
    r := r || '  FALLO anon lee columnas de facturacion\\n';
  exception when others then
    r := r || '  OK   anon no ve columnas de facturacion\\n';
  end;

  execute 'reset role';

  -- Abortar a proposito: revierte los datos de prueba y devuelve el informe.
  raise exception '%', r;
end $$;
`;

async function main() {
  let informe: string;

  try {
    await sql.unsafe(PRUEBA);
    // El bloque SIEMPRE termina lanzando. Llegar aquí significa que no se
    // ejecutó, no que todo fuera bien.
    console.error('La prueba no llegó a lanzar el informe. Revisa el bloque.');
    process.exit(1);
    return;
  } catch (err) {
    const e = err as { message?: string };
    informe = e.message ?? String(err);
  } finally {
    await sql.end();
  }

  console.log('\nAislamiento entre iglesias\n');
  console.log(informe.trim());

  if (informe.includes('FALLO')) {
    console.error(
      '\nHay fallos de aislamiento. NO desplegar: los datos de una iglesia' +
        ' alcanzan a otra.\n',
    );
    process.exit(1);
  }

  console.log('\nTodo correcto.\n');
}

main();
