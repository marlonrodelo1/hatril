-- ===========================================================================
-- 0060 -- Ministerio de Ninos: RLS por relacion, coherencia, aceptar familias
--          y los dos buckets
--
-- Escrita a mano. Va con la 0059, que crea las siete tablas, en la misma pasada
-- del migrador. El plan esta en docs/modulos/plan-ninos.md.
--
-- QUE PESA ESTO
-- -------------
-- Mas que el reparto. Son datos de MENORES, su imagen y, por el contexto, las
-- creencias de su familia (RGPD art. 9; Ley 1581 art. 5 y 7). Una fuga aqui
-- no es solo una brecha que notificar en 72 horas: son fotos de ninos en
-- manos de quien no deberia tenerlas.
--
-- 1. RLS POR RELACION, NO POR IGLESIA
-- ----------------------------------
-- El reparto (0042) ya rompio la doctrina de "la RLS solo aisla iglesias" con
-- una RLS por equipo. Esto va un paso mas alla: la llave del padre es una
-- relacion entre filas, `nino_familias`.
--
--   - El padre: SU hijo, SU vinculo, SUS permisos, y el tablon publicado desde
--     el dia en que se le acepto (`familia_desde()`). Ni otros ninos, ni otros
--     padres, ni el cronograma, ni el drive suelto.
--   - Quien lidera el ministerio (responsable o colider, que son los maestros)
--     y el pastor: todo lo del ministerio.
--   - ACEPTAR una familia, solo la responsable y el pastor
--     (`aceptar_solicitud_nino()`): es la puerta que deja ver a todos los
--     ninos, y los maestros no la abren aunque sean colideres. Decision 3 del
--     plan.
--   - Secretaria, `gestionar_ministerios`, otros lideres, el resto de la
--     congregacion: nada, aunque tengan `ver_todos_los_miembros`.
--
-- 2. NADA PARA `anon` NI PARA `service_role`, Y REVOKE ANTES DE GRANT
-- --------------------------------------------------------------------
-- Redundante en esta base desde la 0022 y se escribe igual (CLAUDE.md). Los
-- grants a `hatril_app` son los justos: el nino no se inserta nunca desde la
-- aplicacion, ni el vinculo; solo desde la funcion de aceptar. Y de un permiso
-- solo se puede tocar `revocado_at`.
--
-- 3. SIN `auditar()`
-- -----------------
-- Por lo mismo que la 0042: `auditoria` copia la fila entera y no se borra.
-- "Se borra al ano" y "al desvincularte se va su nombre" serian falsos.
--
-- 4. LOS BUCKETS, PRIVADOS Y SIN UNA SOLA POLICY
-- ----------------------------------------------
-- La API de Storage opera con el rol del JWT (`authenticated`), no con
-- `hatril_app` (0009). Sin policies en `storage.objects` para estos buckets,
-- ni el navegador ni la publishable key pueden leer, subir ni borrar nada. El
-- servidor firma: las descargas, 10 minutos, despues de que `withUser()` haya
-- devuelto la fila; las subidas, con una URL de un solo uso para una ruta que
-- ya esta apuntada en `ninos_archivos`.
--
-- Ojo: el limite de un bucket no puede pasar del "Global file size limit" del
-- proyecto (Storage > Settings). Si el global es menor de 100 MB, los videos
-- se cortan en el global.
--
-- CODIGOS
-- -------
-- HT142 coherencia (iglesia, ministerio, nino, ruta y edad), HT143 lo que no se
-- reescribe, HT144 aceptar una familia. El siguiente libre es HT145.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Permisos de tabla
-- ---------------------------------------------------------------------------

alter table public.ninos_solicitudes    enable row level security;--> statement-breakpoint
alter table public.ninos                enable row level security;--> statement-breakpoint
alter table public.nino_familias        enable row level security;--> statement-breakpoint
alter table public.nino_consentimientos enable row level security;--> statement-breakpoint
alter table public.ninos_cronograma     enable row level security;--> statement-breakpoint
alter table public.ninos_publicaciones  enable row level security;--> statement-breakpoint
alter table public.ninos_archivos       enable row level security;--> statement-breakpoint

revoke all on public.ninos_solicitudes    from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.ninos                from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.nino_familias        from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.nino_consentimientos from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.ninos_cronograma     from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.ninos_publicaciones  from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.ninos_archivos       from anon, authenticated, service_role;--> statement-breakpoint

-- La peticion la pide el padre y la retira el o la rechaza la responsable. No
-- se edita: si se equivoco de nombre, la retira y la vuelve a pedir.
grant select, insert, delete on public.ninos_solicitudes to hatril_app;--> statement-breakpoint
-- El nino nace en `aceptar_solicitud_nino()`. La responsable puede corregir
-- el nombre o el ano, y nada mas.
grant select, delete on public.ninos to hatril_app;--> statement-breakpoint
grant update (nombre, anio_nacimiento) on public.ninos to hatril_app;--> statement-breakpoint
-- El vinculo nace en la funcion; se rompe borrandolo.
grant select, delete on public.nino_familias to hatril_app;--> statement-breakpoint
-- Dar el permiso de las fotos despues, y retirar cualquiera de los dos.
grant select, insert on public.nino_consentimientos to hatril_app;--> statement-breakpoint
grant update (revocado_at) on public.nino_consentimientos to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.ninos_cronograma    to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.ninos_publicaciones to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.ninos_archivos      to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Las funciones de la relacion
--
-- Como `lidera_ministerio()` (0042): por `iglesia_usuarios`, con la membresia
-- ACTIVA. Quien espera aprobacion o se dio de baja no es responsable ni padre
-- de nadie.
-- ---------------------------------------------------------------------------

create or replace function public.es_responsable_de(p_ministerio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.ministerio_miembros mm
      join public.iglesia_usuarios iu
        on iu.iglesia_id = mm.iglesia_id
       and iu.miembro_id = mm.miembro_id
     where mm.ministerio_id = p_ministerio_id
       and mm.activo = true
       and mm.rol_equipo = 'responsable'
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.es_responsable_de(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.es_responsable_de(uuid) to hatril_app;--> statement-breakpoint


-- ¿Es esta sesion madre, padre o tutor aceptado de este nino?
create or replace function public.es_familia_de(p_nino_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.nino_familias nf
      join public.iglesia_usuarios iu
        on iu.iglesia_id = nf.iglesia_id
       and iu.miembro_id = nf.miembro_id
     where nf.nino_id = p_nino_id
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.es_familia_de(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.es_familia_de(uuid) to hatril_app;--> statement-breakpoint


-- Desde que dia ve el tablon esta sesion: el de su primera aceptacion en el
-- ministerio, en la zona de la iglesia. NULL si no es familia de nadie ahi, y
-- con NULL la comparacion de la policy da falso.
--
-- Una familia nueva no ve el historial de antes de llegar: la AEPD admite que
-- las familias vean las fotos de las actividades "en las que el alumno
-- concreto hubiera participado", y antes de que se le aceptara no se sabe.
create or replace function public.familia_desde(p_ministerio_id uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select min((nf.aceptado_at at time zone i.timezone)::date)
    from public.nino_familias nf
    join public.iglesia_usuarios iu
      on iu.iglesia_id = nf.iglesia_id
     and iu.miembro_id = nf.miembro_id
    join public.iglesias i
      on i.id = nf.iglesia_id
   where nf.ministerio_id = p_ministerio_id
     and iu.auth_user_id = (select auth.uid())
     and iu.estado = 'activo';
$$;--> statement-breakpoint

revoke execute on function public.familia_desde(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.familia_desde(uuid) to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies, `to hatril_app` explicito en todas (ver la 0005).
-- ---------------------------------------------------------------------------

-- La peticion: el padre la suya; la responsable y el pastor, todas.
drop policy if exists ninos_solicitudes_select on public.ninos_solicitudes;--> statement-breakpoint
create policy ninos_solicitudes_select on public.ninos_solicitudes
  for select to hatril_app
  using (
    miembro_id = public.miembro_actual(iglesia_id)
    or public.es_pastor(iglesia_id)
    or public.es_responsable_de(ministerio_id)
  );--> statement-breakpoint

-- Solo para si mismo: nadie pide el vinculo en nombre de otro adulto.
drop policy if exists ninos_solicitudes_insert_propia on public.ninos_solicitudes;--> statement-breakpoint
create policy ninos_solicitudes_insert_propia on public.ninos_solicitudes
  for insert to hatril_app
  with check (miembro_id = public.miembro_actual(iglesia_id));--> statement-breakpoint

-- Retirarla el padre; rechazarla la responsable o el pastor.
drop policy if exists ninos_solicitudes_delete on public.ninos_solicitudes;--> statement-breakpoint
create policy ninos_solicitudes_delete on public.ninos_solicitudes
  for delete to hatril_app
  using (
    miembro_id = public.miembro_actual(iglesia_id)
    or public.es_pastor(iglesia_id)
    or public.es_responsable_de(ministerio_id)
  );--> statement-breakpoint


-- El nino: sus padres, quien lidera y el pastor.
drop policy if exists ninos_select on public.ninos;--> statement-breakpoint
create policy ninos_select on public.ninos
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.es_familia_de(id)
  );--> statement-breakpoint

drop policy if exists ninos_update_responsable on public.ninos;--> statement-breakpoint
create policy ninos_update_responsable on public.ninos
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.es_responsable_de(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.es_responsable_de(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_delete_responsable on public.ninos;--> statement-breakpoint
create policy ninos_delete_responsable on public.ninos
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.es_responsable_de(ministerio_id));--> statement-breakpoint


-- El vinculo: el propio padre, quien lidera y el pastor.
drop policy if exists nino_familias_select on public.nino_familias;--> statement-breakpoint
create policy nino_familias_select on public.nino_familias
  for select to hatril_app
  using (
    miembro_id = public.miembro_actual(iglesia_id)
    or public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
  );--> statement-breakpoint

-- Desvincularse el padre; quitarlo la responsable o el pastor.
drop policy if exists nino_familias_delete on public.nino_familias;--> statement-breakpoint
create policy nino_familias_delete on public.nino_familias
  for delete to hatril_app
  using (
    miembro_id = public.miembro_actual(iglesia_id)
    or public.es_pastor(iglesia_id)
    or public.es_responsable_de(ministerio_id)
  );--> statement-breakpoint


-- Los permisos: el propio padre, quien lidera (necesita saber quien puede
-- salir en fotos) y el pastor.
drop policy if exists nino_consentimientos_select on public.nino_consentimientos;--> statement-breakpoint
create policy nino_consentimientos_select on public.nino_consentimientos
  for select to hatril_app
  using (
    miembro_id = public.miembro_actual(iglesia_id)
    or public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
  );--> statement-breakpoint

-- Dar despues el de las fotos, solo el propio padre y solo sobre su hijo. El
-- del vinculo nace al aceptar, en la funcion.
drop policy if exists nino_consentimientos_insert_imagen on public.nino_consentimientos;--> statement-breakpoint
create policy nino_consentimientos_insert_imagen on public.nino_consentimientos
  for insert to hatril_app
  with check (
    tipo = 'imagen'
    and miembro_id = public.miembro_actual(iglesia_id)
    and public.es_familia_de(nino_id)
  );--> statement-breakpoint

-- Retirar, solo el propio padre. El grant ya no deja tocar mas que
-- `revocado_at`, y HT143 que vuelva atras.
drop policy if exists nino_consentimientos_update_propio on public.nino_consentimientos;--> statement-breakpoint
create policy nino_consentimientos_update_propio on public.nino_consentimientos
  for update to hatril_app
  using (miembro_id = public.miembro_actual(iglesia_id))
  with check (miembro_id = public.miembro_actual(iglesia_id));--> statement-breakpoint


-- El cronograma: interno. Quien lidera y el pastor, para todo.
drop policy if exists ninos_cronograma_select on public.ninos_cronograma;--> statement-breakpoint
create policy ninos_cronograma_select on public.ninos_cronograma
  for select to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_cronograma_insert on public.ninos_cronograma;--> statement-breakpoint
create policy ninos_cronograma_insert on public.ninos_cronograma
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_cronograma_update on public.ninos_cronograma;--> statement-breakpoint
create policy ninos_cronograma_update on public.ninos_cronograma
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_cronograma_delete on public.ninos_cronograma;--> statement-breakpoint
create policy ninos_cronograma_delete on public.ninos_cronograma
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- El tablon: quien lidera y el pastor, todo; la familia, lo publicado desde
-- que se le acepto.
drop policy if exists ninos_publicaciones_select on public.ninos_publicaciones;--> statement-breakpoint
create policy ninos_publicaciones_select on public.ninos_publicaciones
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or (publicada_at is not null and fecha >= public.familia_desde(ministerio_id))
  );--> statement-breakpoint

drop policy if exists ninos_publicaciones_insert on public.ninos_publicaciones;--> statement-breakpoint
create policy ninos_publicaciones_insert on public.ninos_publicaciones
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_publicaciones_update on public.ninos_publicaciones;--> statement-breakpoint
create policy ninos_publicaciones_update on public.ninos_publicaciones
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_publicaciones_delete on public.ninos_publicaciones;--> statement-breakpoint
create policy ninos_publicaciones_delete on public.ninos_publicaciones
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- El drive: quien lidera y el pastor, todo; la familia, solo lo confirmado que
-- va en una publicacion que puede ver. La subconsulta pasa por la RLS de
-- `ninos_publicaciones`, asi que "que puede ver" es exactamente lo de arriba.
drop policy if exists ninos_archivos_select on public.ninos_archivos;--> statement-breakpoint
create policy ninos_archivos_select on public.ninos_archivos
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or (
      confirmado_at is not null
      and publicacion_id is not null
      and exists (
        select 1 from public.ninos_publicaciones p
         where p.id = ninos_archivos.publicacion_id
      )
    )
  );--> statement-breakpoint

drop policy if exists ninos_archivos_insert on public.ninos_archivos;--> statement-breakpoint
create policy ninos_archivos_insert on public.ninos_archivos
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_archivos_update on public.ninos_archivos;--> statement-breakpoint
create policy ninos_archivos_update on public.ninos_archivos
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists ninos_archivos_delete on public.ninos_archivos;--> statement-breakpoint
create policy ninos_archivos_delete on public.ninos_archivos
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT142: coherencia
--
-- Una fila no puede apuntar a un ministerio, un nino, una ficha o una ruta de
-- otra iglesia. La RLS mira la iglesia de la fila; sin esto, una fila de Betel
-- con el ministerio de Sion pasaria la policy de Betel y colgaria de Sion.
-- Las firmas (`creado_por`, `aceptado_por`) se comprueban solo cuando
-- cambian, como en la 0042: si esa ficha se borra despues, la fila se queda
-- con un uuid que ya no existe, y comprobarlo en cada UPDATE la bloquearia.
--
-- Hasta 13 anos: por debajo de 14 consiente quien tiene la patria potestad
-- (LOPDGDD art. 7.2), y este modulo esta hecho para eso. Por el ano: el nino
-- que cumple 14 este ano entra; el que los cumplio el pasado, no.
-- ---------------------------------------------------------------------------

create or replace function public.validar_ninos_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: quien lo pide no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.anio_nacimiento > extract(year from current_date)::int
     or new.anio_nacimiento < extract(year from current_date)::int - 13 then
    raise exception 'HT142: este ministerio es para ninos de hasta 13 anos'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_ninos_solicitud()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_solicitudes_validar
  before insert on public.ninos_solicitudes
  for each row execute function public.validar_ninos_solicitud();--> statement-breakpoint


create or replace function public.validar_nino()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  -- Solo al nacer o al corregir el ano: un nino que cumple 14 con el tiempo
  -- no puede bloquear que se le corrija el nombre.
  if (tg_op = 'INSERT' or new.anio_nacimiento is distinct from old.anio_nacimiento)
     and (new.anio_nacimiento > extract(year from current_date)::int
          or new.anio_nacimiento < extract(year from current_date)::int - 13) then
    raise exception 'HT142: este ministerio es para ninos de hasta 13 anos'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_nino()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_validar
  before insert or update on public.ninos
  for each row execute function public.validar_nino();--> statement-breakpoint


-- El vinculo y el permiso: el nino es de esa iglesia y de ese ministerio, y
-- el adulto, de esa iglesia. Y un permiso solo lo da quien esta vinculado: la
-- funcion de aceptar inserta el vinculo ANTES que los permisos.
create or replace function public.validar_nino_relacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ninos n
     where n.id = new.nino_id
       and n.iglesia_id = new.iglesia_id
       and n.ministerio_id = new.ministerio_id
  ) then
    raise exception 'HT142: el nino no es de este ministerio'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el adulto no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'nino_consentimientos' and not exists (
    select 1 from public.nino_familias nf
     where nf.nino_id = new.nino_id and nf.miembro_id = new.miembro_id
  ) then
    raise exception 'HT142: solo da permisos quien esta vinculado al nino'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_nino_relacion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_nino_familias_validar
  before insert on public.nino_familias
  for each row execute function public.validar_nino_relacion();--> statement-breakpoint

create trigger trg_nino_consentimientos_validar
  before insert on public.nino_consentimientos
  for each row execute function public.validar_nino_relacion();--> statement-breakpoint


create or replace function public.validar_ninos_cronograma()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.maestro_miembro_id is not null
     and (tg_op = 'INSERT' or new.maestro_miembro_id is distinct from old.maestro_miembro_id)
     and not exists (
       select 1 from public.miembros p
        where p.id = new.maestro_miembro_id and p.iglesia_id = new.iglesia_id
     ) then
    raise exception 'HT142: quien da la clase no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_ninos_cronograma()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_cronograma_validar
  before insert or update on public.ninos_cronograma
  for each row execute function public.validar_ninos_cronograma();--> statement-breakpoint


create or replace function public.validar_ninos_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_ninos_publicacion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_publicaciones_validar
  before insert or update on public.ninos_publicaciones
  for each row execute function public.validar_ninos_publicacion();--> statement-breakpoint


-- El archivo: su ruta empieza por `<iglesia>/<ministerio>/`, la miniatura
-- tambien, y si va en una publicacion, es de su mismo ministerio. Sin lo de
-- la ruta, una fila de Betel podria apuntar al fichero de un nino de Sion, y
-- el servidor lo firmaria creyendo que es de Betel.
create or replace function public.validar_ninos_archivo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefijo text := new.iglesia_id::text || '/' || new.ministerio_id::text || '/';
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT142: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if left(new.ruta, length(v_prefijo)) <> v_prefijo
     or position('..' in new.ruta) > 0 then
    raise exception 'HT142: la ruta del archivo no es de este ministerio'
      using errcode = 'check_violation';
  end if;

  if new.miniatura_ruta is not null
     and (left(new.miniatura_ruta, length(v_prefijo)) <> v_prefijo
          or position('..' in new.miniatura_ruta) > 0) then
    raise exception 'HT142: la ruta de la miniatura no es de este ministerio'
      using errcode = 'check_violation';
  end if;

  if new.publicacion_id is not null
     and (tg_op = 'INSERT' or new.publicacion_id is distinct from old.publicacion_id)
     and not exists (
       select 1 from public.ninos_publicaciones p
        where p.id = new.publicacion_id
          and p.iglesia_id = new.iglesia_id
          and p.ministerio_id = new.ministerio_id
     ) then
    raise exception 'HT142: la publicacion no es de este ministerio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_ninos_archivo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_archivos_validar
  before insert or update on public.ninos_archivos
  for each row execute function public.validar_ninos_archivo();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT143: lo que no se reescribe
--
-- Ninguna fila cambia de iglesia ni de ministerio, ni de quien la firmo. Y
-- tres propios de este modulo:
--
--   - Un permiso no se reescribe: es la prueba del art. 7.1. Solo se retira,
--     una vez, y no vuelve: darlo otra vez es otra fila.
--   - Una publicacion ya publicada no cambia de fecha. La fecha decide quien
--     la ve y cuando se borra (`caduca_el`), y moverla hacia delante le
--     alargaria la vida a sus fotos.
--   - Un archivo no cambia de fichero, de tipo, de tamano ni de fecha, y una
--     vez confirmado no se "desconfirma".
--
-- CON el atajo de `_escritor_confiable()`: es un guard de privilegio, y el
-- cron de los borrados entra como servicio.
-- ---------------------------------------------------------------------------

create or replace function public.guard_ninos_inmutables()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if new.iglesia_id is distinct from old.iglesia_id
     or new.ministerio_id is distinct from old.ministerio_id then
    raise exception 'HT143: no cambia de iglesia ni de ministerio'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_table_name = 'nino_consentimientos' then
    if new.nino_id is distinct from old.nino_id
       or new.miembro_id is distinct from old.miembro_id
       or new.tipo is distinct from old.tipo
       or new.version_texto is distinct from old.version_texto
       or new.otorgado_at is distinct from old.otorgado_at
       or new.ip is distinct from old.ip
       or new.user_agent is distinct from old.user_agent then
      raise exception 'HT143: un permiso no se reescribe'
        using errcode = 'insufficient_privilege';
    end if;
    if old.revocado_at is not null
       and new.revocado_at is distinct from old.revocado_at then
      raise exception 'HT143: un permiso retirado no vuelve; se da otra vez'
        using errcode = 'insufficient_privilege';
    end if;

  elsif tg_table_name = 'ninos_cronograma' then
    if new.creado_por_miembro_id is distinct from old.creado_por_miembro_id
       or new.created_at is distinct from old.created_at then
      raise exception 'HT143: quien lo apunto no se reescribe'
        using errcode = 'insufficient_privilege';
    end if;

  elsif tg_table_name = 'ninos_publicaciones' then
    if new.autor_miembro_id is distinct from old.autor_miembro_id
       or new.created_at is distinct from old.created_at then
      raise exception 'HT143: quien la escribio no se reescribe'
        using errcode = 'insufficient_privilege';
    end if;
    if old.publicada_at is not null and new.fecha is distinct from old.fecha then
      raise exception 'HT143: una publicacion ya publicada no cambia de fecha'
        using errcode = 'insufficient_privilege';
    end if;

  elsif tg_table_name = 'ninos_archivos' then
    if new.tipo is distinct from old.tipo
       or new.ruta is distinct from old.ruta
       or new.miniatura_ruta is distinct from old.miniatura_ruta
       or new.bytes is distinct from old.bytes
       or new.fecha is distinct from old.fecha
       or new.subido_por_miembro_id is distinct from old.subido_por_miembro_id
       or new.created_at is distinct from old.created_at then
      raise exception 'HT143: un archivo no cambia de fichero, tamano ni fecha'
        using errcode = 'insufficient_privilege';
    end if;
    if old.confirmado_at is not null
       and new.confirmado_at is distinct from old.confirmado_at then
      raise exception 'HT143: un archivo confirmado no se desconfirma'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_ninos_inmutables()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ninos_guard
  before update on public.ninos
  for each row execute function public.guard_ninos_inmutables();--> statement-breakpoint

create trigger trg_nino_consentimientos_guard
  before update on public.nino_consentimientos
  for each row execute function public.guard_ninos_inmutables();--> statement-breakpoint

create trigger trg_ninos_cronograma_guard
  before update on public.ninos_cronograma
  for each row execute function public.guard_ninos_inmutables();--> statement-breakpoint

create trigger trg_ninos_publicaciones_guard
  before update on public.ninos_publicaciones
  for each row execute function public.guard_ninos_inmutables();--> statement-breakpoint

create trigger trg_ninos_archivos_guard
  before update on public.ninos_archivos
  for each row execute function public.guard_ninos_inmutables();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Al romperse un vinculo
--
-- Lo que prometen los textos (ninos-textos.md §2): al desvincularte se
-- retiran tus permisos sobre ese nino, y si no queda nadie de su familia, se
-- borran su nombre y su ano. Un nino sin padres vinculados no tiene por que
-- estar en ningun sitio.
--
-- Los permisos se RETIRAN, no se borran: son la prueba de que hubo permiso y
-- de cuando se quito. Se van solos con el nino, por la clave ajena.
--
-- `security definer` para poder retirar el permiso aunque quien rompe el
-- vinculo sea la responsable (la policy de UPDATE es solo del propio padre) y
-- borrar al nino aunque quien se desvincula sea el padre (la de DELETE es de la
-- responsable).
-- ---------------------------------------------------------------------------

create or replace function public.al_romper_vinculo_nino()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.nino_consentimientos
     set revocado_at = now()
   where nino_id = old.nino_id
     and miembro_id = old.miembro_id
     and revocado_at is null;

  delete from public.ninos n
   where n.id = old.nino_id
     and not exists (
       select 1 from public.nino_familias nf where nf.nino_id = old.nino_id
     );

  return old;
end;
$$;--> statement-breakpoint

revoke execute on function public.al_romper_vinculo_nino()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_nino_familias_al_romper
  after delete on public.nino_familias
  for each row execute function public.al_romper_vinculo_nino();--> statement-breakpoint


-- updated_at, como en todas.
create trigger trg_ninos_updated_at
  before update on public.ninos
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_ninos_cronograma_updated_at
  before update on public.ninos_cronograma
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_ninos_publicaciones_updated_at
  before update on public.ninos_publicaciones
  for each row execute function public.touch_updated_at();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT144: aceptar una familia
--
-- Lo unico que crea un nino y un vinculo. En una transaccion: el nino (o el
-- que ya existia, si es su otro progenitor), el vinculo, los permisos tal como
-- los dio el padre al pedirlo, y fuera la peticion.
--
-- Por que una funcion y no tres INSERT desde la aplicacion: con la SELECT
-- policy por relacion, el `insert ... returning` del nino fallaria antes de
-- que exista su vinculo, y la responsable no tiene por que poder insertar
-- vinculos a mano para nadie. Igual que `inscribir_en_evento` (0024).
--
-- Los permisos llevan la fecha, la IP y el navegador de la PETICION, no de
-- quien acepta: la prueba del art. 7.1 es lo que hizo el padre.
-- ---------------------------------------------------------------------------

create or replace function public.aceptar_solicitud_nino(
  p_solicitud_id uuid,
  p_nino_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.ninos_solicitudes%rowtype;
  v_nino uuid;
begin
  select * into s
    from public.ninos_solicitudes
   where id = p_solicitud_id
     for update;

  if not found then
    raise exception 'HT144: esa peticion ya no existe'
      using errcode = 'no_data_found';
  end if;

  if not (public.es_pastor(s.iglesia_id) or public.es_responsable_de(s.ministerio_id)) then
    raise exception 'HT144: las familias las aceptan la responsable del ministerio o el pastor'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.iglesia_usuarios iu
     where iu.iglesia_id = s.iglesia_id
       and iu.miembro_id = s.miembro_id
       and iu.estado = 'activo'
  ) then
    raise exception 'HT144: quien lo pidio ya no esta activo en la iglesia'
      using errcode = 'check_violation';
  end if;

  if p_nino_id is null then
    insert into public.ninos (iglesia_id, ministerio_id, nombre, anio_nacimiento)
    values (s.iglesia_id, s.ministerio_id, btrim(s.nombre), s.anio_nacimiento)
    returning id into v_nino;
  else
    select n.id into v_nino
      from public.ninos n
     where n.id = p_nino_id
       and n.iglesia_id = s.iglesia_id
       and n.ministerio_id = s.ministerio_id;

    if v_nino is null then
      raise exception 'HT144: ese nino no es de este ministerio'
        using errcode = 'check_violation';
    end if;

    if exists (
      select 1 from public.nino_familias nf
       where nf.nino_id = v_nino and nf.miembro_id = s.miembro_id
    ) then
      raise exception 'HT144: ya esta vinculado a ese nino'
        using errcode = 'unique_violation';
    end if;
  end if;

  insert into public.nino_familias
    (iglesia_id, ministerio_id, nino_id, miembro_id, parentesco, aceptado_por_miembro_id)
  values
    (s.iglesia_id, s.ministerio_id, v_nino, s.miembro_id, s.parentesco,
     public.miembro_actual(s.iglesia_id));

  insert into public.nino_consentimientos
    (iglesia_id, ministerio_id, nino_id, miembro_id, tipo, version_texto, otorgado_at, ip, user_agent)
  values
    (s.iglesia_id, s.ministerio_id, v_nino, s.miembro_id, 'vinculo', s.version_texto,
     s.created_at, s.ip, s.user_agent);

  if s.permiso_imagen then
    insert into public.nino_consentimientos
      (iglesia_id, ministerio_id, nino_id, miembro_id, tipo, version_texto, otorgado_at, ip, user_agent)
    values
      (s.iglesia_id, s.ministerio_id, v_nino, s.miembro_id, 'imagen', s.version_texto,
       s.created_at, s.ip, s.user_agent);
  end if;

  delete from public.ninos_solicitudes where id = s.id;

  return v_nino;
end;
$$;--> statement-breakpoint

revoke execute on function public.aceptar_solicitud_nino(uuid, uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.aceptar_solicitud_nino(uuid, uuid) to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Los dos buckets, privados
--
-- Separados para que cada uno lleve su limite: una foto que el telefono ya ha
-- reducido a 1.600 px ronda los 400 KB, y 5 MB la deja pasar aunque no se
-- haya reducido; un video de un minuto en 1080p ronda los 60-130 MB segun el
-- telefono. Las miniaturas, de fotos y de videos, van al de fotos.
--
-- Solo WebP y JPEG en fotos: la miniatura y la reduccion las hace el telefono
-- en WebP, y JPEG es la salida de reserva. Un HEIC del iPhone no se sube tal
-- cual: no lo pinta ningun navegador fuera de Safari.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ninos-fotos',
  'ninos-fotos',
  false,
  5242880,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;--> statement-breakpoint

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ninos-videos',
  'ninos-videos',
  false,
  104857600,
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
