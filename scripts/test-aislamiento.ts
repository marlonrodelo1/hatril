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

// La aplicación de verdad. Ver `comprobarWithUser` más abajo.
import { withUser } from '../src/lib/db/with-tenant';

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
  MIN_A constant uuid := 'e0000000-0000-4000-8000-00000000000a';
  MIN_B constant uuid := 'e0000000-0000-4000-8000-00000000000b';
  MIE_A1 uuid;
  MIE_A2 uuid;
  MIE_B1 uuid;
  VIN_A1 uuid;
  VIN_A2 uuid;
  PUB_A uuid;
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

  select id into MIE_A1 from public.miembros where nombre = 'Lucia'  and iglesia_id = IGL_A;
  select id into MIE_A2 from public.miembros where nombre = 'Ruben'  and iglesia_id = IGL_A;
  select id into MIE_B1 from public.miembros where nombre = 'Amparo' and iglesia_id = IGL_B;

  -- Un ministerio en cada iglesia. IGL_A esta publicada y IGL_B no: es justo la
  -- diferencia que explotaba la fuga de "ministerios_select_publico".
  insert into public.ministerios (id, iglesia_id, nombre)
  values (MIN_A, IGL_A, 'Alabanza test'),
         (MIN_B, IGL_B, 'Alabanza Sion');

  insert into public.ministerio_miembros (iglesia_id, ministerio_id, miembro_id)
  values (IGL_A, MIN_A, MIE_A1),
         (IGL_A, MIN_A, MIE_A2),
         (IGL_B, MIN_B, MIE_B1);

  select id into VIN_A1 from public.ministerio_miembros
   where ministerio_id = MIN_A and miembro_id = MIE_A1;
  select id into VIN_A2 from public.ministerio_miembros
   where ministerio_id = MIN_A and miembro_id = MIE_A2;

  -- --- Numeración correlativa, que la asigna un trigger ---
  -- Acotado a la iglesia de la prueba. Buscar solo por nombre cogia a la
  -- persona equivocada en cuanto la base tuvo datos de demostracion con
  -- nombres repetidos, y el test fallaba por su culpa, no por la del producto.
  select numero_miembro into n from public.miembros
   where nombre = 'Ruben' and iglesia_id = IGL_A;
  r := r || format(E'  %s numeracion correlativa por iglesia (Ruben=%s)\\n',
                   case when n = 2 then 'OK  ' else 'FALLO' end, n);

  select numero_miembro into n from public.miembros
   where nombre = 'Amparo' and iglesia_id = IGL_B;
  r := r || format(E'  %s la numeracion reinicia en otra iglesia (Amparo=%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- La auditoría se escribe sola ---
  -- Acotado a las iglesias de esta prueba: contar la tabla entera daba un
  -- falso fallo en cuanto la base tuvo datos de demostracion.
  --
  -- Y acotado tambien POR ENTIDAD. Antes se contaban todas las filas y se
  -- esperaban 6, asi que auditar una tabla mas ponia el test en rojo por
  -- contabilidad y no por seguridad: exactamente lo que paso al enganchar
  -- "ministerio_miembros" a la auditoria en la migracion 0005.
  select count(*) into n from public.auditoria
   where iglesia_id in (IGL_A, IGL_B)
     and entidad in ('miembros', 'iglesia_usuarios');
  r := r || format(E'  %s la auditoria se escribe sola (%s filas)\\n',
                   case when n = 6 then 'OK  ' else 'FALLO' end, n);

  -- Quien nombro lider a quien tambien queda registrado. Antes lo cubria la
  -- auditoria de "ministerios", porque el liderazgo era una columna suya.
  select count(*) into n from public.auditoria
   where iglesia_id in (IGL_A, IGL_B) and entidad = 'ministerio_miembros';
  r := r || format(E'  %s los cambios de equipo se auditan (%s filas)\\n',
                   case when n = 3 then 'OK  ' else 'FALLO' end, n);

  -- --- Aislamiento: pastor de Betania ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format(E'  %s pastor de Betania ve SUS 2 miembros (%s)\\n',
                   case when n = 2 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.miembros where iglesia_id = IGL_B;
  r := r || format(E'  %s no alcanza los de Sion ni pidiendolos (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.iglesias where id in (IGL_A, IGL_B);
  r := r || format(E'  %s solo ve su iglesia y el directorio (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- Aislamiento: pastor de Sion, en el sentido contrario ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format(E'  %s pastor de Sion ve SU 1 miembro (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- LAS DOS FUGAS QUE CERRO LA MIGRACION 0005 ---
  --
  -- Sion NO esta en el directorio; Betania SI. Las policies del visitante se
  -- habian concedido tambien a "hatril_app", y como las policies se suman con OR
  -- y el recorte por columnas solo alcanza a "anon", el pastor de Sion leia
  -- filas enteras de Betania. Se prueba desde Sion y no al reves justamente por
  -- eso: en el otro sentido no se ve nada aunque la fuga siga abierta.
  select count(*) into n from public.ministerios where id in (MIN_A, MIN_B);
  r := r || format(E'  %s pastor de Sion no ve ministerios de Betania (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    perform stripe_customer_id from public.iglesias where id = IGL_A;
    get diagnostics n = row_count;
    r := r || format(E'  %s no alcanza la facturacion de otra iglesia (%s)\\n',
                     case when n = 0 then 'OK  ' else 'FALLO' end, n);
  exception when others then
    r := r || E'  OK   no alcanza la facturacion de otra iglesia\\n';
  end;

  -- Y tampoco puede escribir en el equipo de otra congregacion. Es el camino
  -- que abre la pantalla de Equipo, y hasta ahora nadie lo ejercitaba.
  update public.iglesia_usuarios set rol = 'miembro' where iglesia_id = IGL_A;
  get diagnostics n = row_count;
  r := r || format(E'  %s no puede cambiar roles de otra iglesia (%s filas)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- --- Solicitud pendiente: el requisito del art. 9 ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.miembros;
  r := r || format(E'  %s solicitud PENDIENTE no ve la congregacion (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- --- Escalada de privilegios ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  begin
    update public.iglesia_usuarios set rol = 'miembro' where auth_user_id = USR_A;
    r := r || E'  FALLO el pastor puede auto-degradarse\\n';
  exception when others then
    r := r || format(E'  %s auto-degradacion bloqueada (%s)\\n',
                     case when sqlerrm like 'HT101%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 40));
  end;

  begin
    update public.iglesia_usuarios set permisos = '{"ver_datos_sensibles":true}'::jsonb
     where auth_user_id = USR_A;
    r := r || E'  FALLO el pastor puede auto-editarse los permisos\\n';
  exception when others then
    r := r || format(E'  %s auto-edicion de permisos bloqueada\\n',
                     case when sqlerrm like 'HT101%' then 'OK  ' else 'FALLO' end);
  end;

  -- Lo que SI tiene que funcionar: aprobar a otra persona.
  -- Se le engancha ademas su ficha, que es lo que hace la pantalla de
  -- solicitudes de verdad y lo que permite probar HT104 mas abajo.
  update public.iglesia_usuarios
     set estado = 'activo', aprobado_por = USR_A, miembro_id = MIE_A2
   where auth_user_id = USR_C;
  get diagnostics n = row_count;
  r := r || format(E'  %s el pastor SI puede aprobar a otro (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- Un solo responsable por ministerio, y lo dice la base ---
  update public.ministerio_miembros set rol_equipo = 'responsable' where id = VIN_A1;
  get diagnostics n = row_count;
  r := r || format(E'  %s el pastor SI puede nombrar responsable (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    update public.ministerio_miembros set rol_equipo = 'responsable' where id = VIN_A2;
    r := r || E'  FALLO dos responsables activos en el mismo ministerio\\n';
  exception when unique_violation then
    r := r || E'  OK   no caben dos responsables en un ministerio\\n';
  end;

  -- --- La colision por reactivacion ---
  --
  -- Este test existe por "asignarAlMinisterio": reactiva vinculos viejos con un
  -- update, y si esa fila conservaba 'responsable' mientras otra persona ya lo
  -- era, el boton «Asignar miembros» reventaba con un 23505 sin capturar. Por eso
  -- la action resetea a 'voluntario'. Si alguien deshace ese reseteo, salta aqui.
  update public.ministerio_miembros set activo = false, hasta = current_date
   where id = VIN_A1;
  update public.ministerio_miembros set rol_equipo = 'responsable' where id = VIN_A2;

  begin
    update public.ministerio_miembros set activo = true, hasta = null where id = VIN_A1;
    r := r || E'  FALLO reactivar a un ex-responsable duplica el mando\\n';
  exception when unique_violation then
    r := r || E'  OK   reactivar sin resetear el rol choca (por eso se resetea)\\n';
  end;

  -- Se deja a Ruben de voluntario para la prueba de HT104 de mas abajo. Sin
  -- esto, su intento de ascenderse no seria un ascenso —ya seria responsable— y
  -- el trigger lo dejaria pasar con razon, dando un FALLO enganoso.
  update public.ministerio_miembros set rol_equipo = 'voluntario' where id = VIN_A2;

  -- --- HT102 sobre el liderazgo ---
  -- La validacion de coherencia que "lider_miembro_id" nunca tuvo, y que ahora
  -- se hereda por estar el liderazgo en la pivote.
  begin
    insert into public.ministerio_miembros (iglesia_id, ministerio_id, miembro_id, rol_equipo)
    values (IGL_A, MIN_A, MIE_B1, 'colider');
    r := r || E'  FALLO un miembro de otra iglesia entra en el equipo\\n';
  exception when others then
    r := r || format(E'  %s un miembro de otra iglesia no entra (%s)\\n',
                     case when sqlerrm like 'HT102%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  update public.iglesia_usuarios set rol = 'pastor' where auth_user_id = USR_C;
  get diagnostics n = row_count;
  r := r || format(E'  %s un miembro no puede ascenderse (%s filas tocadas)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- --- HT104: ni ascenderse dentro de su ministerio ---
  --
  -- Hermano de HT101. La policy de "ministerio_miembros" es una sola, "for all"
  -- a cualquiera de la iglesia, y "rol_equipo" lleva privilegio desde que existe
  -- "gestionar_su_ministerio": sin este guard, cualquier voluntario con acceso al
  -- panel se nombraba responsable de su equipo y con ello se daba permiso de
  -- escritura sobre el.
  begin
    update public.ministerio_miembros set rol_equipo = 'responsable' where id = VIN_A2;
    r := r || E'  FALLO un voluntario se nombra responsable a si mismo\\n';
  exception when others then
    r := r || format(E'  %s no puede nombrarse lider a si mismo (%s)\\n',
                     case when sqlerrm like 'HT104%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- --- EL MURO DE LA COMUNIDAD (migracion 0015) ---
  --
  -- Es la primera tabla del proyecto donde escribe cualquier miembro, no solo
  -- quien administra. Y donde firmar con la ficha de otro seria suplantarle
  -- delante de su congregacion, asi que eso lo impide la base de datos y no la
  -- aplicacion.
  --
  -- USR_C quedo aprobado mas arriba con miembro_id = MIE_A2 (Ruben).
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  insert into public.publicaciones (iglesia_id, autor_miembro_id, texto)
  values (IGL_A, MIE_A2, 'Peticion de oracion por mi madre');
  get diagnostics n = row_count;
  r := r || format(E'  %s un miembro raso SI puede publicar (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  select id into PUB_A from public.publicaciones where iglesia_id = IGL_A limit 1;

  -- Firmar con la ficha de otra persona de la MISMA iglesia.
  begin
    insert into public.publicaciones (iglesia_id, autor_miembro_id, texto)
    values (IGL_A, MIE_A1, 'Escrito en nombre de Lucia');
    r := r || E'  FALLO se puede publicar en nombre de otro miembro\\n';
  exception when others then
    r := r || E'  OK   no se puede publicar en nombre de otro miembro\\n';
  end;

  -- Dos veces el mismo me gusta no es un contador que sube.
  insert into public.publicaciones_me_gusta (iglesia_id, publicacion_id, miembro_id)
  values (IGL_A, PUB_A, MIE_A2);
  begin
    insert into public.publicaciones_me_gusta (iglesia_id, publicacion_id, miembro_id)
    values (IGL_A, PUB_A, MIE_A2);
    r := r || E'  FALLO el mismo me gusta cuenta dos veces\\n';
  exception when unique_violation then
    r := r || E'  OK   el mismo me gusta no cuenta dos veces\\n';
  end;

  -- --- Aislamiento del muro: el pastor de Sion ---
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.publicaciones;
  r := r || format(E'  %s Sion no ve el muro de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.publicaciones_comentarios;
  r := r || format(E'  %s Sion no ve los comentarios de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  -- Ni escribir en el muro ajeno, que es la otra mitad del aislamiento y la
  -- que nadie prueba nunca.
  begin
    insert into public.publicaciones (iglesia_id, autor_miembro_id, texto)
    values (IGL_A, MIE_A1, 'Colado desde otra iglesia');
    r := r || E'  FALLO Sion escribe en el muro de Betania\\n';
  exception when others then
    r := r || E'  OK   Sion no escribe en el muro de Betania\\n';
  end;

  -- HT107: un comentario que apunta a una publicacion de otra congregacion.
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  begin
    insert into public.publicaciones_comentarios
      (iglesia_id, publicacion_id, autor_miembro_id, texto)
    values (IGL_B, PUB_A, MIE_A2, 'Cruzando iglesias');
    r := r || E'  FALLO un comentario cruza dos iglesias\\n';
  exception when others then
    r := r || format(E'  %s un comentario no cruza dos iglesias (%s)\\n',
                     case when sqlerrm like 'HT107%' or sqlerrm like '%row-level%'
                          then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- El pastor modera: borra lo que no es suyo dentro de SU iglesia.
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  delete from public.publicaciones where id = PUB_A;
  get diagnostics n = row_count;
  r := r || format(E'  %s el pastor SI puede borrar lo de otro (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- anon ---
  execute 'reset role';
  execute 'set local role anon';

  -- El muro es lo mas privado que guarda una iglesia despues del fichero de
  -- miembros: una foto del domingo con menores dentro.
  begin
    select count(*) into n from public.publicaciones;
    r := r || format(E'  FALLO anon lee el muro de la comunidad (%s)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega al muro de la comunidad\\n';
  end;

  begin
    select count(*) into n from public.miembros;
    r := r || format(E'  FALLO anon lee la tabla de miembros (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a la tabla de miembros\\n';
  end;

  select count(*) into n from public.iglesias where id in (IGL_A, IGL_B);
  r := r || format(E'  %s anon ve solo el directorio publicado (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    perform stripe_customer_id from public.iglesias limit 1;
    r := r || E'  FALLO anon lee columnas de facturacion\\n';
  exception when others then
    r := r || E'  OK   anon no ve columnas de facturacion\\n';
  end;

  -- La web publica de una iglesia lista sus grupos. Cerrar la fuga NO puede
  -- haber roto esto: la policy sigue existiendo, solo que ya no se le concede
  -- ademas al rol de la aplicacion.
  select count(*) into n from public.ministerios where id in (MIN_A, MIN_B);
  r := r || format(E'  %s anon sigue viendo los grupos publicados (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- Pero no quien esta en cada equipo. Servir en el ministerio de una iglesia
  -- revela la confesion religiosa de una persona con nombre y apellidos.
  begin
    select count(*) into n from public.ministerio_miembros;
    r := r || format(E'  FALLO anon lee quien sirve en cada equipo (%s)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a la composicion de los equipos\\n';
  end;

  execute 'reset role';

  -- Abortar a proposito: revierte los datos de prueba y devuelve el informe.
  raise exception '%', r;
end $$;
`;

/**
 * Comprueba que `withUser()` —la función que usa la aplicación— entra con el
 * rol que las policies esperan.
 *
 * POR QUÉ EXISTE ESTA COMPROBACIÓN
 * --------------------------------
 * El bloque de arriba hace `set local role hatril_app` en SQL a mano. Eso
 * verifica que las policies están bien escritas, pero NO que la aplicación las
 * use: son dos cosas distintas y durante un tiempo no coincidieron.
 *
 * `with-tenant.ts` se quedó poniendo `set local role authenticated`, que era lo
 * del plan original antes de crear el rol propio. Las policies iban todas
 * `TO hatril_app` y a `authenticated` se le había revocado todo a propósito, así
 * que NINGUNA pantalla del panel podía funcionar. El test seguía en verde,
 * porque probaba el diseño y no el código.
 *
 * Solo se descubrió al desplegar y abrir el panel: quince comprobaciones en
 * verde y todas las páginas dando 500.
 *
 * De ahí esta segunda fase, que llama a la función real.
 */
async function comprobarWithUser(): Promise<string[]> {
  const lineas: string[] = [];
  const USR_A = 'a0000000-0000-4000-8000-00000000000a';

  try {
    const rol = await withUser(USR_A, async (tx) => {
      const filas = await tx.execute<{ actual: string }>(
        `select current_user as actual`,
      );
      const fila =
        (filas as unknown as { rows?: { actual: string }[] }).rows?.[0] ??
        (filas as unknown as Array<{ actual: string }>)[0];
      return fila?.actual ?? '(desconocido)';
    });

    lineas.push(
      `  ${rol === 'hatril_app' ? 'OK  ' : 'FALLO'} withUser() entra como ${rol} (esperado hatril_app)`,
    );

    // Y que con ese rol se puede consultar de verdad. Si los GRANT faltaran,
    // aquí saltaría un 42501 aunque el rol fuera el correcto.
    await withUser(USR_A, (tx) => tx.execute(`select 1 from miembros limit 1`));
    lineas.push('  OK   withUser() puede consultar miembros');

    // Que la columna existe. Caza el «se me olvidó `npm run db:migrate`» aquí y
    // no en la primera pantalla que se abra.
    await withUser(USR_A, (tx) =>
      tx.execute(`select rol_equipo from ministerio_miembros limit 1`),
    );
    lineas.push('  OK   withUser() ve la columna rol_equipo');

    // LA FUGA, CAZADA POR LA FUNCIÓN QUE USA LA APLICACIÓN.
    //
    // `USR_A` aquí no es el de la fase de arriba: aquella transacción se revirtió
    // entera, así que este uuid no pertenece a ninguna iglesia. La cuenta correcta
    // es 0. Con `ministerios_select_publico` concedida a `hatril_app` devolvía los
    // ministerios de toda iglesia publicada — y `seed-demo` publica Betania.
    //
    // Caveat honesto: contra una base sin ninguna iglesia publicada esta línea
    // pasa en verde sin probar nada. La autoritativa es la de la fase SQL, que se
    // fabrica su propia iglesia publicada.
    const ajenos = await withUser(USR_A, async (tx) => {
      const filas = await tx.execute<{ total: string }>(
        `select count(*)::text as total from ministerios`,
      );
      const fila =
        (filas as unknown as { rows?: { total: string }[] }).rows?.[0] ??
        (filas as unknown as Array<{ total: string }>)[0];
      return Number(fila?.total ?? -1);
    });

    lineas.push(
      `  ${ajenos === 0 ? 'OK  ' : 'FALLO'} withUser() sin iglesia no ve ningun ministerio (${ajenos})`,
    );
  } catch (err) {
    const e = err as { message?: string };
    lineas.push(`  FALLO withUser(): ${(e.message ?? String(err)).slice(0, 90)}`);
  }

  return lineas;
}

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

  // Segunda fase: se llama a la función que usa la aplicación, no a SQL escrito
  // a mano. Es la comprobación que faltaba cuando el panel entero daba 500 con
  // este informe en verde.
  const desdeLaApp = await comprobarWithUser();
  console.log('\nLa aplicación usa lo anterior\n');
  console.log(desdeLaApp.join('\n'));
  informe += '\n' + desdeLaApp.join('\n');

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
