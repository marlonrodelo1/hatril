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
  -- Sin membresia ninguna: el rechazado, para la prueba de la 0018.
  USR_D constant uuid := 'd0000000-0000-4000-8000-00000000000d';
  MIN_A constant uuid := 'e0000000-0000-4000-8000-00000000000a';
  MIN_B constant uuid := 'e0000000-0000-4000-8000-00000000000b';
  MIE_A1 uuid;
  MIE_A2 uuid;
  MIE_B1 uuid;
  VIN_A1 uuid;
  VIN_A2 uuid;
  PUB_A uuid;
  COM_A uuid;
  COM_R uuid;
  FON_A uuid;
  FON_B uuid;
  CAJ_A uuid;
  CAJ_B uuid;
  MOV_A uuid;
  EVE_A constant uuid := 'f0000000-0000-4000-8000-00000000000a';
  EVE_B constant uuid := 'f0000000-0000-4000-8000-00000000000b';
  REU_A constant uuid := 'f1000000-0000-4000-8000-00000000000a';
  REU_B constant uuid := 'f1000000-0000-4000-8000-00000000000b';
  v_ultima date;
  ASI_A uuid;
  -- Alguien de Betania que NO esta en el equipo de MIN_A. Se crea abajo, despues
  -- de la prueba de numeracion correlativa, para no moverle el numero a Ruben.
  MIE_A3 uuid;
  -- Lo que responde inscribir_en_evento. Un solo escalar a proposito: ver la
  -- cabecera de la 0024.
  v_res text;
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

  -- --- RESPUESTAS Y ME GUSTA DE COMENTARIOS (migracion 0035) ---
  --
  -- Dos cosas nuevas que tocan datos de una congregacion: quien responde a
  -- quien, y a quien le gusta que. Van con la misma vara que el resto del muro.
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  insert into public.publicaciones_comentarios
    (iglesia_id, publicacion_id, autor_miembro_id, texto)
  values (IGL_A, PUB_A, MIE_A2, 'Estare orando')
  returning id into COM_A;

  -- Responder a un comentario de primer nivel: se puede.
  insert into public.publicaciones_comentarios
    (iglesia_id, publicacion_id, autor_miembro_id, texto, respuesta_a_id)
  values (IGL_A, PUB_A, MIE_A2, 'Gracias', COM_A)
  returning id into COM_R;
  r := r || E'  OK   se puede responder a un comentario\\n';

  -- HT120, primera mitad: responder a una respuesta abriria el tercer nivel.
  begin
    insert into public.publicaciones_comentarios
      (iglesia_id, publicacion_id, autor_miembro_id, texto, respuesta_a_id)
    values (IGL_A, PUB_A, MIE_A2, 'Tercer nivel', COM_R);
    r := r || E'  FALLO se puede responder a una respuesta\\n';
  exception when others then
    r := r || format(E'  %s HT120 impide responder a una respuesta (%s)\\n',
                     case when sqlerrm like 'HT120%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- HT120, segunda mitad: colgar la respuesta de un comentario de OTRA
  -- publicacion. Con otra iglesia de por medio seria una fuga con todas las
  -- letras; sin ella, una respuesta que aparece donde nadie la espera.
  begin
    insert into public.publicaciones (iglesia_id, autor_miembro_id, texto)
    values (IGL_A, MIE_A2, 'Otra publicacion');

    insert into public.publicaciones_comentarios
      (iglesia_id, publicacion_id, autor_miembro_id, texto, respuesta_a_id)
    select IGL_A, p2.id, MIE_A2, 'Cruzada', COM_A
      from public.publicaciones p2
     where p2.iglesia_id = IGL_A and p2.id <> PUB_A
     limit 1;
    r := r || E'  FALLO una respuesta cuelga de otra publicacion\\n';
  exception when others then
    r := r || format(E'  %s HT120 impide responder cruzando publicacion (%s)\\n',
                     case when sqlerrm like 'HT120%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- El me gusta del comentario, y que no cuente dos veces.
  insert into public.publicaciones_comentarios_me_gusta
    (iglesia_id, comentario_id, miembro_id)
  values (IGL_A, COM_A, MIE_A2);

  begin
    insert into public.publicaciones_comentarios_me_gusta
      (iglesia_id, comentario_id, miembro_id)
    values (IGL_A, COM_A, MIE_A2);
    r := r || E'  FALLO el mismo me gusta de comentario cuenta dos veces\\n';
  exception when unique_violation then
    r := r || E'  OK   el mismo me gusta de comentario no cuenta dos veces\\n';
  end;

  -- HT121: el me gusta que dice ser de otra iglesia.
  begin
    insert into public.publicaciones_comentarios_me_gusta
      (iglesia_id, comentario_id, miembro_id)
    values (IGL_B, COM_A, MIE_A2);
    r := r || E'  FALLO un me gusta de comentario cruza dos iglesias\\n';
  exception when others then
    r := r || format(E'  %s HT121 o la RLS paran el me gusta cruzado (%s)\\n',
                     case when sqlerrm like 'HT121%' or sqlerrm like '%row-level%'
                          then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- Y Sion no ve ni toca nada de eso.
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.publicaciones_comentarios_me_gusta;
  r := r || format(E'  %s Sion no ve los me gusta de comentarios de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  begin
    insert into public.publicaciones_comentarios_me_gusta
      (iglesia_id, comentario_id, miembro_id)
    values (IGL_A, COM_A, MIE_A1);
    r := r || E'  FALLO Sion da me gusta a un comentario de Betania\\n';
  exception when others then
    r := r || E'  OK   Sion no da me gusta a un comentario de Betania\\n';
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

  -- --- NOTIFICACIONES (migraciones 0016 a 0018) ---
  --
  -- Se insertan como postgres a proposito: es lo que hace el servidor con
  -- dbAdmin, porque "hatril_app" no tiene INSERT sobre esta tabla.
  execute 'reset role';

  insert into public.notificaciones (iglesia_id, destinatario_auth_user_id, tipo, datos)
  values (IGL_A, USR_A, 'solicitud_recibida', '{"quien":"Nuria"}'::jsonb),
         (IGL_B, USR_B, 'solicitud_recibida', '{"quien":"Otro"}'::jsonb),
         -- USR_D no tiene NI HA TENIDO fila en iglesia_usuarios: es el caso del
         -- rechazado, a quien se le borra la membresia al rechazarle.
         (IGL_A, USR_D, 'solicitud_rechazada', '{"iglesia":"Betania"}'::jsonb);

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.notificaciones;
  r := r || format(E'  %s cada cual ve solo SUS avisos (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- Nadie puede fabricar un aviso: sin grant de INSERT no hay policy que valga.
  begin
    insert into public.notificaciones (iglesia_id, destinatario_auth_user_id, tipo)
    values (IGL_A, USR_C, 'solicitud_aprobada');
    r := r || E'  FALLO una sesion puede fabricar notificaciones\\n';
  exception when others then
    r := r || E'  OK   una sesion no puede fabricar notificaciones\\n';
  end;

  -- Marcar leido SI. Cambiar lo que dice, NO (HT109).
  update public.notificaciones set leida_at = now() where destinatario_auth_user_id = USR_A;
  get diagnostics n = row_count;
  r := r || format(E'  %s se puede marcar leido lo propio (%s fila)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    update public.notificaciones set enlace = 'https://phishing.example'
     where destinatario_auth_user_id = USR_A;
    r := r || E'  FALLO se puede reescribir el destino de un aviso\\n';
  exception when others then
    r := r || format(E'  %s no se puede reescribir un aviso (%s)\\n',
                     case when sqlerrm like 'HT109%' then 'OK  ' else 'FALLO' end,
                     left(sqlerrm, 30));
  end;

  -- LA COMPROBACION QUE MOTIVO LA 0018.
  --
  -- La primera version de la policy exigia ademas "pertenece_a_iglesia()", y
  -- como a quien se rechaza se le BORRA la membresia, su aviso de rechazo nacia
  -- ilegible para el. La fila existia y no la veia nadie jamas.
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_D), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.notificaciones;
  r := r || format(E'  %s el rechazado SI puede leer su aviso (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- --- anon ---
  execute 'reset role';
  execute 'set local role anon';

  -- El muro es lo mas privado que guarda una iglesia despues del fichero de
  -- miembros: una foto del domingo con menores dentro.
  begin
    select count(*) into n from public.publicaciones_comentarios_me_gusta;
    r := r || format(E'  FALLO anon lee los me gusta de comentarios (%s)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los me gusta de comentarios\\n';
  end;

  begin
    select count(*) into n from public.publicaciones;
    r := r || format(E'  FALLO anon lee el muro de la comunidad (%s)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega al muro de la comunidad\\n';
  end;

  begin
    select count(*) into n from public.notificaciones;
    r := r || format(E'  FALLO anon lee las notificaciones (%s)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a las notificaciones\\n';
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

  begin
    perform trial_until from public.iglesias limit 1;
    r := r || E'  FALLO anon lee trial_until\\n';
  exception when others then
    r := r || E'  OK   anon no ve trial_until\\n';
  end;

  begin
    perform plan from public.iglesias limit 1;
    r := r || E'  FALLO anon lee el plan\\n';
  exception when others then
    r := r || E'  OK   anon no ve el plan\\n';
  end;

  -- Y la cara contraria: redes SI tiene que llegarle, porque el pie de la web
  -- publica de la iglesia se pinta con ella. Los GRANT de iglesias son por
  -- columna y se escriben a mano en cada migracion; el dia que alguien toque esa
  -- lista para anadir algo de Stripe, esta linea avisa de que se ha llevado por
  -- delante las redes sociales de todas las congregaciones.
  begin
    perform redes from public.iglesias limit 1;
    r := r || E'  OK   anon sigue viendo las redes sociales\\n';
  exception when others then
    r := r || E'  FALLO anon ya no puede leer redes\\n';
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

  begin
    select count(*) into n from public.movimientos;
    r := r || format(E'  FALLO anon lee la caja de las iglesias (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los movimientos\\n';
  end;

  begin
    select count(*) into n from public.fondos;
    r := r || format(E'  FALLO anon lee los fondos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los fondos\\n';
  end;

  -- ==========================================================================
  -- FACTURACION (HT112)
  --
  -- No es aislamiento entre iglesias: es que nadie se pague solo. La 0001
  -- concede update sobre iglesias entera a hatril_app y la policy del pastor
  -- le deja tocar SU fila, asi que sin el trigger el muro de suscripcion se
  -- salta con un update.
  -- ==========================================================================

  -- Venimos del bloque de anon: hay que soltar ese rol antes de tomar otro.
  execute 'reset role';

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  begin
    update public.iglesias set plan = 'plus' where id = IGL_A;
    r := r || E'  FALLO el pastor pudo subirse el plan a mano\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT112%'
                   then E'  OK   HT112 impide subirse el plan\\n'
                   else format(E'  FALLO error inesperado al subir plan: %s\\n', sqlerrm) end;
  end;

  -- Por separado: regalarse una fecha futura es el mismo salto por otra puerta,
  -- y es la columna de la que salen los tres dias de gracia.
  begin
    update public.iglesias set trial_until = now() + interval '10 years' where id = IGL_A;
    r := r || E'  FALLO el pastor pudo regalarse trial_until\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT112%'
                   then E'  OK   HT112 impide regalarse trial_until\\n'
                   else format(E'  FALLO error inesperado en trial_until: %s\\n', sqlerrm) end;
  end;

  -- Y que el guard NO sea un candado sobre la tabla entera: el pastor tiene que
  -- poder seguir editando los datos de su iglesia. Si esto falla, el trigger
  -- esta comparando de mas y Ajustes deja de funcionar.
  begin
    update public.iglesias set ciudad = 'Bogota DC' where id = IGL_A;
    r := r || E'  OK   el pastor SI puede editar los datos de su iglesia\\n';
  exception when others then
    r := r || format(E'  FALLO HT112 bloquea de mas: %s\\n', sqlerrm);
  end;

  -- La tabla de idempotencia del webhook no la toca ninguna sesion: la escribe
  -- dbAdmin y solo el. No tiene GRANT (0001:228) y esto lo ejercita.
  begin
    select count(*) into n from public.stripe_events_processed;
    r := r || format(E'  FALLO hatril_app lee los eventos de Stripe (%s)\\n', n);
  exception when others then
    r := r || E'  OK   hatril_app no llega a stripe_events_processed\\n';
  end;

  execute 'reset role';

  -- ==========================================================================
  -- FINANZAS
  --
  -- Es el dato mas delicado que guarda Hatril despues de la pertenencia: si la
  -- caja de una congregacion alcanza a otra, no es un listado raro, es su libro
  -- contable entero en manos ajenas.
  -- ==========================================================================

  insert into public.fondos (iglesia_id, nombre, es_general)
  values (IGL_A, 'General', true), (IGL_B, 'General', true);
  select id into FON_A from public.fondos where iglesia_id = IGL_A;
  select id into FON_B from public.fondos where iglesia_id = IGL_B;

  insert into public.cajas (iglesia_id, nombre, tipo)
  values (IGL_A, 'Efectivo', 'efectivo'), (IGL_B, 'Efectivo', 'efectivo');
  select id into CAJ_A from public.cajas where iglesia_id = IGL_A;
  select id into CAJ_B from public.cajas where iglesia_id = IGL_B;

  insert into public.movimientos
    (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id, tipo_ingreso)
  values (IGL_A, 'ingreso', current_date, 250000, 'Ofrenda', FON_A, CAJ_A, 'ofrenda')
  returning id into MOV_A;

  insert into public.movimientos
    (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id)
  values (IGL_B, 'gasto', current_date, 100000, 'Luz de Sion', FON_B, CAJ_B);

  -- El pastor de Betania.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.movimientos;
  r := r || format(E'  %s Betania ve solo su movimiento (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.fondos;
  r := r || format(E'  %s Betania ve solo su fondo (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- La columna generada: el saldo no lo escribe nadie, lo calcula Postgres.
  select sum(importe_con_signo) into n from public.movimientos;
  r := r || format(E'  %s el saldo sale de importe_con_signo (%s)\\n',
                   case when n = 250000 then 'OK  ' else 'FALLO' end, n);

  -- HT110: apuntar contra el fondo de la otra congregacion.
  begin
    insert into public.movimientos
      (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id, tipo_ingreso)
    values (IGL_A, 'ingreso', current_date, 1, 'Colado', FON_B, CAJ_A, 'ofrenda');
    r := r || E'  FALLO se pudo apuntar contra el fondo de otra iglesia\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT110%'
                   then E'  OK   HT110 rechaza el fondo de otra iglesia\\n'
                   else format(E'  FALLO error inesperado: %s\\n', sqlerrm) end;
  end;

  -- HT111: llevarse un movimiento a la otra iglesia por UPDATE. La policy sola
  -- NO lo impide: el using y el with check son ciertos a la vez para quien
  -- pertenece a las dos congregaciones, que es un caso real.
  begin
    update public.movimientos set iglesia_id = IGL_B where id = MOV_A;
    r := r || E'  FALLO un movimiento pudo cambiar de iglesia\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT111%'
                   then E'  OK   HT111 impide mover un movimiento de iglesia\\n'
                   else format(E'  FALLO error inesperado: %s\\n', sqlerrm) end;
  end;

  -- Un gasto con tipo de ingreso: la equivalencia del CHECK.
  begin
    insert into public.movimientos
      (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id, tipo_ingreso)
    values (IGL_A, 'gasto', current_date, 5, 'Gasto con tipo', FON_A, CAJ_A, 'diezmo');
    r := r || E'  FALLO un gasto pudo llevar tipo_ingreso\\n';
  exception when others then
    r := r || E'  OK   un gasto no puede llevar tipo_ingreso\\n';
  end;

  execute 'reset role';

  -- Y en el otro sentido: Sion tampoco ve lo de Betania.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.movimientos where iglesia_id = IGL_A;
  r := r || format(E'  %s Sion no ve la caja de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';

  -- service_role entra por PostgREST con una clave de variable de entorno, y es
  -- una puerta distinta de la de dbAdmin. La 0020 se la cierra.
  execute 'set local role service_role';

  begin
    select count(*) into n from public.movimientos;
    r := r || format(E'  FALLO service_role lee la caja (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   service_role no llega a los movimientos\\n';
  end;

  execute 'reset role';

  -- ==========================================================================
  -- EVENTOS (HT113, HT114, HT115)
  --
  -- Es el unico modulo donde escribe gente SIN cuenta, asi que se comprueban
  -- dos cosas distintas: el aislamiento de siempre, y que la funcion publica no
  -- sea un oraculo. Lo segundo importa porque apuntarse a un acto de una
  -- congregacion dice algo de las creencias de quien se apunta.
  -- ==========================================================================

  -- Las dos iglesias del montaje nacen con web_publica en false, que es el
  -- defecto del schema. La inscripcion publica lo exige —un evento de una
  -- congregacion que todavia no ha publicado su pagina no existe para nadie de
  -- fuera— asi que hay que abrirla aqui de forma explicita.
  update public.iglesias set web_publica = true where id in (IGL_A, IGL_B);

  insert into public.eventos (id, iglesia_id, titulo, inicio_en, cupo,
                              publicado, inscripciones_abiertas)
  values (EVE_A, IGL_A, 'Retiro Betania', now() + interval '30 days', 1, true, true),
         (EVE_B, IGL_B, 'Retiro Sion',    now() + interval '30 days', null, true, true);

  -- La via publica: la ejecuta postgres desde una server action, sin claims.
  select public.inscribir_en_evento(
    EVE_A, 'Visitante', 'visita@ejemplo.test', 'privacidad-2026-08',
    null, 0, null, '203.0.113.7', 'navegador') into v_res;
  r := r || format(E'  %s una inscripcion publica entra (%s)\\n',
                   case when v_res = 'ok' then 'OK  ' else 'FALLO' end, v_res);

  -- El mismo correo otra vez responde EXACTAMENTE igual. Si algun dia esto
  -- devuelve otra cosa, se puede preguntar por una lista de correos quien
  -- asiste a un acto religioso sin leer ni una fila.
  --
  -- Se prueba sobre EVE_B, que no tiene cupo, y no sobre EVE_A, que tiene uno.
  -- No es casualidad: con el aforo lleno, el aforo se evalua ANTES del alta y
  -- las dos llamadas responden 'completo'. Siguen siendo indistinguibles entre
  -- si, que es el invariante, pero medirlo ahi confunde las dos cosas.
  select public.inscribir_en_evento(
    EVE_B, 'Visitante', 'visita@ejemplo.test', 'privacidad-2026-08',
    null, 0, null, '203.0.113.7', 'navegador') into v_res;
  r := r || format(E'  %s una inscripcion en la otra iglesia entra (%s)\\n',
                   case when v_res = 'ok' then 'OK  ' else 'FALLO' end, v_res);

  select public.inscribir_en_evento(
    EVE_B, 'Visitante', 'VISITA@Ejemplo.TEST', 'privacidad-2026-08',
    null, 0, null, '203.0.113.7', 'navegador') into v_res;
  r := r || format(E'  %s un correo repetido no se distingue (%s)\\n',
                   case when v_res = 'ok' then 'OK  ' else 'FALLO' end, v_res);

  select count(*) into n from public.evento_inscripciones where evento_id = EVE_B;
  r := r || format(E'  %s y no creo una segunda fila (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- Cupo 1, ya ocupado.
  select public.inscribir_en_evento(
    EVE_A, 'Otro', 'otro@ejemplo.test', 'privacidad-2026-08',
    null, 0, null, null, null) into v_res;
  r := r || format(E'  %s el aforo se respeta (%s)\\n',
                   case when v_res = 'completo' then 'OK  ' else 'FALLO' end, v_res);

  -- Cuatro causas, una sola palabra: no existe, sin publicar, iglesia de baja y
  -- iglesia sin web publica.
  select public.inscribir_en_evento(
    '99999999-0000-4000-8000-999999999999', 'X', 'x@ejemplo.test',
    'privacidad-2026-08', null, 0, null, null, null) into v_res;
  r := r || format(E'  %s un uuid inventado no delata nada (%s)\\n',
                   case when v_res = 'no_disponible' then 'OK  ' else 'FALLO' end, v_res);

  -- HT113: la inscripcion tiene que ser del evento de SU iglesia.
  begin
    insert into public.evento_inscripciones
      (iglesia_id, evento_id, nombre, email, codigo_cancelacion, consentimiento_version)
    values (IGL_B, EVE_A, 'Intruso', 'intruso@ejemplo.test',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'privacidad-2026-08');
    r := r || E'  FALLO una inscripcion cruzo dos iglesias\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT113%'
                   then E'  OK   HT113 impide la inscripcion cruzada\\n'
                   else format(E'  FALLO error inesperado (HT113): %s\\n', sqlerrm) end;
  end;

  -- HT114: la prueba del consentimiento no se reescribe. Un registro que el
  -- responsable puede editar no prueba nada ante el art. 7.1.
  begin
    update public.evento_inscripciones
       set consentimiento_version = 'privacidad-2020-01'
     where evento_id = EVE_A;
    r := r || E'  FALLO se reescribio el consentimiento\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT114%'
                   then E'  OK   HT114 congela la prueba del consentimiento\\n'
                   else format(E'  FALLO error inesperado (HT114): %s\\n', sqlerrm) end;
  end;

  -- --- Aislamiento, con el pastor de Betania dentro ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.eventos;
  r := r || format(E'  %s Betania ve solo su evento (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  -- HT115: mover un evento de iglesia se llevaria por delante la coherencia de
  -- todas sus inscripciones.
  begin
    update public.eventos set iglesia_id = IGL_B where id = EVE_A;
    r := r || E'  FALLO un evento cambio de iglesia\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT115%'
                   then E'  OK   HT115 impide mover un evento de iglesia\\n'
                   else format(E'  FALLO error inesperado (HT115): %s\\n', sqlerrm) end;
  end;

  execute 'reset role';

  -- --- Y desde Sion, que no debe ver a los inscritos de Betania ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.evento_inscripciones where iglesia_id = IGL_A;
  r := r || format(E'  %s Sion no ve los inscritos de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';

  -- --- anon: ni una columna, y la funcion tampoco es suya ---
  execute 'set local role anon';

  begin
    select count(*) into n from public.evento_inscripciones;
    r := r || format(E'  FALLO anon lee los inscritos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los inscritos\\n';
  end;

  begin
    select count(*) into n from public.eventos;
    r := r || format(E'  FALLO anon lee los eventos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los eventos\\n';
  end;

  -- La funcion no se concede a nadie: la llama dbAdmin como postgres. Si esto
  -- deja de fallar, hay un endpoint /rest/v1/rpc/ abierto a internet.
  begin
    perform public.inscribir_en_evento(
      EVE_A, 'X', 'x@ejemplo.test', 'privacidad-2026-08',
      null, 0, null, null, null);
    r := r || E'  FALLO anon puede ejecutar inscribir_en_evento\\n';
  exception when others then
    r := r || E'  OK   anon no puede ejecutar inscribir_en_evento\\n';
  end;

  execute 'reset role';

  execute 'set local role service_role';

  begin
    select count(*) into n from public.evento_inscripciones;
    r := r || format(E'  FALLO service_role lee los inscritos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   service_role no llega a los inscritos\\n';
  end;

  execute 'reset role';

  -- ==========================================================================
  -- ASISTENCIA (HT116, HT117) -- el dato del art. 9 mas puro de la plataforma
  --
  -- Que una persona estuvo en un culto un domingo concreto revela su practica
  -- religiosa con fecha. Estas comprobaciones son las que impiden que el
  -- historico de una congregacion se lea desde otra, desde anon o desde
  -- service_role.
  -- ==========================================================================

  insert into public.reuniones (id, iglesia_id, titulo, fecha)
  values (REU_A, IGL_A, 'Culto test Betania', date '2026-08-16'),
         (REU_B, IGL_B, 'Culto test Sion',    date '2026-08-16');

  -- HT116: una reunion no puede colgar del ministerio de otra iglesia.
  begin
    insert into public.reuniones (iglesia_id, ministerio_id, titulo, fecha)
    values (IGL_A, MIN_B, 'Ensayo cruzado', date '2026-08-16');
    r := r || E'  FALLO una reunion de Betania acepto el ministerio de Sion\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT116%'
                   then E'  OK   HT116 impide colgar de un ministerio ajeno\\n'
                   else format(E'  FALLO error inesperado (HT116 ministerio): %s\\n', sqlerrm) end;
  end;

  -- HT116: ni apuntar en la lista de Betania a alguien de Sion.
  begin
    insert into public.asistencias (iglesia_id, reunion_id, miembro_id, presente)
    values (IGL_A, REU_A, MIE_B1, true);
    r := r || E'  FALLO la lista de Betania acepto a una persona de Sion\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT116%'
                   then E'  OK   HT116 impide apuntar a alguien de otra iglesia\\n'
                   else format(E'  FALLO error inesperado (HT116 miembro): %s\\n', sqlerrm) end;
  end;

  -- La lista de verdad: uno vino y otro no. Se guarda fila para los dos, que es
  -- lo que distingue "no se paso lista" de "no vino nadie".
  insert into public.asistencias (iglesia_id, reunion_id, miembro_id, presente)
  values (IGL_A, REU_A, MIE_A1, true),
         (IGL_A, REU_A, MIE_A2, false);
  insert into public.asistencias (iglesia_id, reunion_id, miembro_id, presente)
  values (IGL_B, REU_B, MIE_B1, true);

  -- El trigger que resucita miembros.ultima_asistencia, muerta desde la 0000.
  select ultima_asistencia into v_ultima from public.miembros where id = MIE_A1;
  r := r || format(E'  %s el trigger deja la ultima asistencia (%s)\\n',
                   case when v_ultima = date '2026-08-16' then 'OK  ' else 'FALLO' end,
                   coalesce(v_ultima::text, 'null'));

  select ultima_asistencia into v_ultima from public.miembros where id = MIE_A2;
  r := r || format(E'  %s quien falto no tiene ultima asistencia (%s)\\n',
                   case when v_ultima is null then 'OK  ' else 'FALLO' end,
                   coalesce(v_ultima::text, 'null'));

  -- Y se RECALCULA, no se acumula: desmarcar tiene que borrar la fecha. Con un
  -- greatest() se quedaria clavada para siempre, y corregir una lista es la
  -- operacion mas frecuente que va a tener esto.
  update public.asistencias set presente = false
   where reunion_id = REU_A and miembro_id = MIE_A1;
  select ultima_asistencia into v_ultima from public.miembros where id = MIE_A1;
  r := r || format(E'  %s desmarcar recalcula la ultima asistencia (%s)\\n',
                   case when v_ultima is null then 'OK  ' else 'FALLO' end,
                   coalesce(v_ultima::text, 'null'));
  update public.asistencias set presente = true
   where reunion_id = REU_A and miembro_id = MIE_A1;

  -- --- Betania ve lo suyo y nada mas ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.reuniones where iglesia_id = IGL_B;
  r := r || format(E'  %s Betania no ve las reuniones de Sion (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.asistencias where iglesia_id = IGL_B;
  r := r || format(E'  %s Betania no ve la lista de Sion (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.asistencias where iglesia_id = IGL_A;
  r := r || format(E'  %s Betania si ve la suya (%s)\\n',
                   case when n = 2 then 'OK  ' else 'FALLO' end, n);

  -- HT117: mover una reunion de iglesia corromperia el historico de las dos.
  begin
    update public.reuniones set iglesia_id = IGL_B where id = REU_A;
    r := r || E'  FALLO una reunion cambio de iglesia\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT117%'
                   then E'  OK   HT117 impide mover una reunion de iglesia\\n'
                   else format(E'  FALLO error inesperado (HT117 reunion): %s\\n', sqlerrm) end;
  end;

  -- HT117: lo unico que se corrige de una asistencia es presente. Poder moverla
  -- de persona convierte "me equivoque marcando" en "reescribo donde estuvo otro".
  begin
    update public.asistencias set miembro_id = MIE_A2
     where reunion_id = REU_A and miembro_id = MIE_A1;
    r := r || E'  FALLO una asistencia cambio de persona\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT117%'
                   then E'  OK   HT117 impide cambiar de persona una asistencia\\n'
                   else format(E'  FALLO error inesperado (HT117 asistencia): %s\\n', sqlerrm) end;
  end;

  execute 'reset role';

  -- --- Y desde Sion, en el otro sentido. Algunas fugas solo se ven desde la
  --     iglesia que NO esta publicada en el directorio ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.asistencias where iglesia_id = IGL_A;
  r := r || format(E'  %s Sion no ve la lista de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';

  -- --- anon: de aqui no sale nada a la calle, ni una columna ---
  execute 'set local role anon';

  begin
    select count(*) into n from public.reuniones;
    r := r || format(E'  FALLO anon lee las reuniones (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a las reuniones\\n';
  end;

  begin
    select count(*) into n from public.asistencias;
    r := r || format(E'  FALLO anon lee la asistencia (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a la asistencia\\n';
  end;

  execute 'reset role';

  -- service_role tiene BYPASSRLS: aqui no lo para ninguna policy, solo el grant.
  execute 'set local role service_role';

  begin
    select count(*) into n from public.asistencias;
    r := r || format(E'  FALLO service_role lee la asistencia (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   service_role no llega a la asistencia\\n';
  end;

  execute 'reset role';

  -- ==========================================================================
  -- SEGUIMIENTO (HT118, HT119) -- por que la gente dejo de venir
  --
  -- La asistencia dice que alguien fue al culto. Esto dice POR QUE dejo de ir:
  -- quien esta molesto con la iglesia, quien se mudo, a quien no se localiza.
  -- Con nombre y apellidos, y de la congregacion entera.
  -- ==========================================================================

  execute 'reset role';

  insert into public.miembros (iglesia_id, nombre)
  values (IGL_A, 'Tomas fuera del equipo');
  select id into MIE_A3 from public.miembros
   where nombre = 'Tomas fuera del equipo' and iglesia_id = IGL_A;

  -- HT118: el ministerio tiene que ser de la misma iglesia que la fila.
  begin
    insert into public.seguimiento_asignaciones
      (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
    values (IGL_A, MIN_B, MIE_A1, MIE_A2);
    r := r || E'  FALLO una asignacion de Betania acepto el ministerio de Sion\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT118%'
                   then E'  OK   HT118 impide asignar desde un ministerio ajeno\\n'
                   else format(E'  FALLO error inesperado (HT118 ministerio): %s\\n', sqlerrm) end;
  end;

  -- HT118: ni acompanar a alguien de otra congregacion.
  begin
    insert into public.seguimiento_asignaciones
      (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
    values (IGL_A, MIN_A, MIE_B1, MIE_A2);
    r := r || E'  FALLO Betania acepto acompanar a una persona de Sion\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT118%'
                   then E'  OK   HT118 impide acompanar a alguien de otra iglesia\\n'
                   else format(E'  FALLO error inesperado (HT118 miembro): %s\\n', sqlerrm) end;
  end;

  -- HT118: repartir trabajo a quien no esta en el equipo es repartirselo a nadie.
  begin
    insert into public.seguimiento_asignaciones
      (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
    values (IGL_A, MIN_A, MIE_A1, MIE_A3);
    r := r || E'  FALLO se asigno a alguien que no esta en el equipo\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT118%'
                   then E'  OK   HT118 impide asignar a quien no esta en el equipo\\n'
                   else format(E'  FALLO error inesperado (HT118 equipo): %s\\n', sqlerrm) end;
  end;

  -- La buena, y su gemela en Sion.
  insert into public.seguimiento_asignaciones
    (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
  values (IGL_A, MIN_A, MIE_A1, MIE_A2);
  select id into ASI_A from public.seguimiento_asignaciones
   where iglesia_id = IGL_A and miembro_id = MIE_A1 and activo;

  insert into public.seguimiento_asignaciones
    (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
  values (IGL_B, MIN_B, MIE_B1, MIE_B1);

  -- Una persona la acompana UNA sola: dos responsables es que la llaman dos o
  -- que no la llama ninguna.
  -- Ojo con el responsable que se elige aqui: la prueba de reactivacion de mas
  -- arriba deja el vinculo de Lucia con activo = false, asi que ponerla a ella
  -- levantaria HT118 y no la clave duplicada, y el handler de abajo no lo
  -- cazaria. Se repite Ruben, que sigue en el equipo.
  begin
    insert into public.seguimiento_asignaciones
      (iglesia_id, ministerio_id, miembro_id, responsable_miembro_id)
    values (IGL_A, MIN_A, MIE_A1, MIE_A2);
    r := r || E'  FALLO una persona acepto dos acompanantes a la vez\\n';
  exception when unique_violation then
    r := r || E'  OK   una persona no puede tener dos acompanantes activos\\n';
  end;

  -- --- La firma no se elige, se comprueba. USR_C es Ruben (MIE_A2) ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_C), true);
  execute 'set local role hatril_app';

  insert into public.seguimiento_contactos
    (iglesia_id, ministerio_id, miembro_id, autor_miembro_id, fecha, via, resultado)
  values (IGL_A, MIN_A, MIE_A1, MIE_A2, date '2026-08-18', 'llamada', 'no_contesta');
  get diagnostics n = row_count;
  r := r || format(E'  %s se puede apuntar un contacto firmado por uno mismo (%s)\\n',
                   case when n = 1 then 'OK  ' else 'FALLO' end, n);

  begin
    insert into public.seguimiento_contactos
      (iglesia_id, ministerio_id, miembro_id, autor_miembro_id, fecha, via, resultado)
    values (IGL_A, MIN_A, MIE_A1, MIE_A1, date '2026-08-18', 'visita', 'contactado');
    r := r || E'  FALLO se puede apuntar un contacto en nombre de otro\\n';
  exception when others then
    r := r || E'  OK   no se puede apuntar un contacto en nombre de otro\\n';
  end;

  -- Un contacto es un hecho fechado: no hay UPDATE concedido. Reescribirlo
  -- dejaria una mentira con fecha en vez de un intento que dejo de existir.
  begin
    update public.seguimiento_contactos set resultado = 'contactado'
     where iglesia_id = IGL_A;
    r := r || E'  FALLO se puede reescribir un contacto ya apuntado\\n';
  exception when others then
    r := r || E'  OK   un contacto no se puede reescribir, solo borrar\\n';
  end;

  -- El limite del unico campo libre del modulo, dicho por la base.
  begin
    insert into public.seguimiento_contactos
      (iglesia_id, ministerio_id, miembro_id, autor_miembro_id, fecha, via, resultado, proximo_paso)
    values (IGL_A, MIN_A, MIE_A1, MIE_A2, date '2026-08-19', 'llamada', 'contactado',
            repeat('x', 201));
    r := r || E'  FALLO el proximo paso admite mas de 200 caracteres\\n';
  exception when check_violation then
    r := r || E'  OK   el proximo paso esta acotado a 200 caracteres\\n';
  end;

  execute 'reset role';

  -- --- HT119, desde el pastor de Betania ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_A), true);
  execute 'set local role hatril_app';

  begin
    update public.seguimiento_asignaciones set iglesia_id = IGL_B where id = ASI_A;
    r := r || E'  FALLO una asignacion cambio de iglesia\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT119%'
                   then E'  OK   HT119 impide mover una asignacion de iglesia\\n'
                   else format(E'  FALLO error inesperado (HT119 iglesia): %s\\n', sqlerrm) end;
  end;

  begin
    update public.seguimiento_asignaciones set miembro_id = MIE_A2 where id = ASI_A;
    r := r || E'  FALLO una asignacion cambio de persona acompanada\\n';
  exception when others then
    r := r || case when sqlerrm like '%HT119%'
                   then E'  OK   HT119 impide cambiar a quien se acompana\\n'
                   else format(E'  FALLO error inesperado (HT119 persona): %s\\n', sqlerrm) end;
  end;

  select count(*) into n from public.seguimiento_asignaciones where iglesia_id = IGL_B;
  r := r || format(E'  %s Betania no ve las asignaciones de Sion (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';

  -- --- Y desde Sion, en el otro sentido ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', USR_B), true);
  execute 'set local role hatril_app';

  select count(*) into n from public.seguimiento_contactos where iglesia_id = IGL_A;
  r := r || format(E'  %s Sion no ve los contactos de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  select count(*) into n from public.seguimiento_asignaciones where iglesia_id = IGL_A;
  r := r || format(E'  %s Sion no ve las asignaciones de Betania (%s)\\n',
                   case when n = 0 then 'OK  ' else 'FALLO' end, n);

  execute 'reset role';

  -- --- anon y service_role: de aqui no sale nada, por ninguna puerta ---
  execute 'set local role anon';

  begin
    select count(*) into n from public.seguimiento_contactos;
    r := r || format(E'  FALLO anon lee los contactos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a los contactos\\n';
  end;

  begin
    select count(*) into n from public.seguimiento_asignaciones;
    r := r || format(E'  FALLO anon lee las asignaciones (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   anon no llega a las asignaciones\\n';
  end;

  execute 'reset role';

  execute 'set local role service_role';

  begin
    select count(*) into n from public.seguimiento_contactos;
    r := r || format(E'  FALLO service_role lee los contactos (%s filas)\\n', n);
  exception when others then
    r := r || E'  OK   service_role no llega a los contactos\\n';
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

    // Finanzas, por la puerta de la aplicacion. Es la comprobacion que caza el
    // GRANT olvidado: la fase SQL de arriba prueba que las policies estan bien
    // escritas, no que `hatril_app` tenga concedida la tabla. Sin el grant,
    // esto revienta con 42501 y el panel de finanzas daria 500 en la primera
    // pantalla, que es exactamente como se descubrio la ultima vez.
    await withUser(USR_A, (tx) =>
      tx.execute(`select 1 from movimientos limit 1`),
    );
    lineas.push('  OK   withUser() puede consultar movimientos');

    // La columna generada. Caza el «se me olvido aplicar la 0019» aqui y no al
    // abrir el resumen, que es donde se suma.
    await withUser(USR_A, (tx) =>
      tx.execute(`select importe_con_signo from movimientos limit 1`),
    );
    lineas.push('  OK   withUser() ve la columna generada importe_con_signo');

    // Asistencia, por la puerta de la aplicacion. Mismo motivo que finanzas: la
    // fase SQL prueba que `anon` y `service_role` NO llegan, y eso deja sin
    // probar lo contrario — que `hatril_app` si. Un `revoke` sin su `grant`
    // detras pasa las diecisiete comprobaciones de arriba y tumba la seccion
    // entera con 42501 al abrirla.
    await withUser(USR_A, (tx) =>
      tx.execute(`select 1 from reuniones limit 1`),
    );
    lineas.push('  OK   withUser() puede consultar reuniones');

    await withUser(USR_A, (tx) =>
      tx.execute(`select 1 from asistencias limit 1`),
    );
    lineas.push('  OK   withUser() puede consultar asistencias');

    // La columna del motor de modulos. Caza el «se me olvido aplicar la 0028»
    // aqui y no al abrir un ministerio, que es donde se lee.
    await withUser(USR_A, (tx) =>
      tx.execute(`select tipo, modulos from ministerios limit 1`),
    );
    lineas.push('  OK   withUser() ve las columnas tipo y modulos');

    // Seguimiento por la puerta de la aplicacion. Sin esto, un `revoke` sin su
    // `grant` detras pasaria toda la fase SQL de arriba —que solo comprueba que
    // anon y service_role NO llegan— y tumbaria la seccion al abrirla.
    await withUser(USR_A, (tx) =>
      tx.execute(`select 1 from seguimiento_asignaciones limit 1`),
    );
    lineas.push('  OK   withUser() puede consultar las asignaciones');

    await withUser(USR_A, (tx) =>
      tx.execute(`select 1 from seguimiento_contactos limit 1`),
    );
    lineas.push('  OK   withUser() puede consultar los contactos');

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
