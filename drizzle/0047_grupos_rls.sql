-- ===========================================================================
-- 0047 -- Grupos: RLS por relacion, coherencia, inmutabilidad y nadie se
-- pone a si mismo a llevar un grupo
--
-- Las cuatro tablas de la 0046: el grupo (una celula, manana una clase), quien
-- esta en el, cada semana del grupo y la guia comun de la red.
--
-- 1. RLS POR RELACION, NO SOLO POR IGLESIA. ES LA SEGUNDA EXCEPCION, Y SE
--    DECIDE ASI
-- ---------------------------------------------------------------------------
-- La doctrina del repo (0001, 0033, 0037) es que la base aisla IGLESIAS y que
-- quien ve que dentro de una lo decide la aplicacion. Nacio para no copiar en
-- SQL el mapa de permisos de `permisos.ts`. El reparto (0042) fue la primera
-- excepcion, por datos de terceros vulnerables; el analisis del 19-oct dejo
-- abierto si las celulas eran otra. Lo son, por tres razones que se suman:
--
--   - LA LLAVE ES UN DATO, NO UN PERMISO. Quien lleva una celula lo dice una
--     fila de `grupo_miembros`, igual que `miembro_actual()` en la 0033 o
--     `lidera_ministerio()` en la 0042. No se duplica nada de `permisos.ts`:
--     ningun permiso abre una celula.
--   - QUIEN TIENE LA LLAVE ES MUCHA GENTE. Una iglesia con redes tiene de 40 a
--     120 lideres de celula, casi todos con rol `miembro`, entrando por `/mi`.
--     Es la poblacion mas grande de todo el producto con algun poder sobre
--     datos ajenos, y la pantalla que mas se va a escribir copiando otra. Un
--     fallo de una consulta en una sola de ellas le daria a cada lider la lista
--     de todas las celulas de la iglesia, con su zona y su dia.
--   - LA PIEZA LA REUTILIZA LA ESCUELA DOMINICAL, con clases de menores. Lo que
--     se decida aqui lo hereda ella, y el analisis ya pedia RLS por relacion
--     para lo de los ninos.
--
-- Quien ve que, entonces:
--
--   grupos          el pastor, quien SIRVE en la red y quien esta en el grupo.
--   grupo_miembros  el pastor, quien LIDERA la red (responsable y colideres),
--                   quien lleva ESE grupo, cada cual su propia fila, y del
--                   resto de su grupo solo quien lo lleva: el participante ve
--                   a su lider, no a los demas participantes.
--   grupo_semanas   el pastor, quien lidera la red y quien esta en el grupo
--                   (el proximo tema es para todos los de la celula).
--   grupo_guias     toda la iglesia: es un tema de estudio, no dato de nadie.
--
-- Escribir: en `grupos` y `grupo_miembros`, el pastor y quien lidera la red.
-- El lider de una celula NO da de alta a nadie: la gente entra por el enlace
-- de invitacion, con su propio consentimiento en /solicitar, y a quien no
-- tiene la app la apunta la red. En `grupo_semanas`, ademas, quien lleva el
-- grupo: es su reporte. `gestionar_ministerios` no entra en ninguna, como en
-- el reparto: organizar los ministerios desde secretaria no es estar en este.
--
-- Lo que esto NO cierra, y conviene saberlo: los NOMBRES de la gente siguen en
-- `miembros`, que cualquier sesion activa de la iglesia lee (0001). Lo que se
-- protege aqui es lo nuevo -quien va a que celula, donde y cuando se reune, y
-- como va cada semana-, que es justo lo que junta domicilio y practica
-- religiosa.
--
-- 2. LLEVAR UN GRUPO PIDE SEGUIR EN EL EQUIPO
-- ------------------------------------------
-- `lleva_grupo()` exige ser lider o auxiliar activo del grupo Y seguir activo en
-- el equipo del ministerio. Asi, sacar a alguien del equipo le quita la celula
-- en ese mismo instante, sin trigger que reescriba filas: su fila de lider se
-- queda -el panel la ensena como "ya no esta en el equipo"- y la llave deja
-- de abrir. Al NOMBRARLE, HT132 exige lo mismo.
--
-- 3. UN RECUENTO, NO UNA LISTA DE ASISTENCIA
-- ------------------------------------------
-- `grupo_semanas` guarda cuantos de la celula vinieron y cuantas visitas, sin
-- nadie detras. Se decidio asi por el permiso de asistencia: quien lo nego no
-- puede salir en ninguna lista, y en una lista nominal de celula eso deja dos
-- salidas malas -contar de menos, o apuntarle como visita-. Contar la sala no
-- apunta a nadie, no necesita su permiso y es lo que pidio Marlon ("cuantos
-- vinieron"). Y la asistencia a la celula no cuenta para "lleva N domingos sin
-- venir": esto no toca `asistencias` ni `refrescar_ultima_asistencia`.
--
-- 4. SIN `auditar()` EN `grupo_miembros`
-- --------------------------------------
-- Por lo de siempre (0030, 0037, 0042): `auditoria` no se borra, y la lista de
-- quien va a que celula quedaria alli para siempre. `grupos` si se audita: es
-- un hecho de la red, y `auditoria` solo la lee el pastor, que ya ve el grupo.
--
-- 5. NADA PARA `anon` NI PARA `service_role`, Y REVOKE ANTES DE GRANT
-- --------------------------------------------------------------------
-- Redundante en esta base desde la 0022, y se escribe igual: el fichero tiene
-- que decir la verdad en cualquier otra (CLAUDE.md).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Las dos funciones de relacion
--
-- Por `iglesia_usuarios`, como `sirve_en_ministerio` (0042): la cuenta y la
-- ficha en el mismo join, con la membresia ACTIVA. Quien espera aprobacion no
-- esta en ninguna celula todavia, aunque su solicitud traiga una.
-- ---------------------------------------------------------------------------

create or replace function public.lleva_grupo(p_grupo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.grupo_miembros gm
      join public.iglesia_usuarios iu
        on iu.iglesia_id = gm.iglesia_id
       and iu.miembro_id = gm.miembro_id
      join public.ministerio_miembros mm
        on mm.ministerio_id = gm.ministerio_id
       and mm.miembro_id = gm.miembro_id
       and mm.activo = true
     where gm.grupo_id = p_grupo_id
       and gm.activo = true
       and gm.rol_grupo in ('lider', 'auxiliar')
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.lleva_grupo(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.lleva_grupo(uuid) to hatril_app;--> statement-breakpoint


create or replace function public.esta_en_grupo(p_grupo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.grupo_miembros gm
      join public.iglesia_usuarios iu
        on iu.iglesia_id = gm.iglesia_id
       and iu.miembro_id = gm.miembro_id
     where gm.grupo_id = p_grupo_id
       and gm.activo = true
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.esta_en_grupo(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.esta_en_grupo(uuid) to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Permisos de tabla
-- ---------------------------------------------------------------------------

alter table public.grupos         enable row level security;--> statement-breakpoint
alter table public.grupo_miembros enable row level security;--> statement-breakpoint
alter table public.grupo_semanas  enable row level security;--> statement-breakpoint
alter table public.grupo_guias    enable row level security;--> statement-breakpoint

revoke all on public.grupos         from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.grupo_miembros from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.grupo_semanas  from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.grupo_guias    from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.grupos         to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.grupo_miembros to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.grupo_semanas  to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.grupo_guias    to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies, `to hatril_app` explicito en todas (ver la 0005).
-- ---------------------------------------------------------------------------

drop policy if exists grupos_select_relacion on public.grupos;--> statement-breakpoint
create policy grupos_select_relacion on public.grupos
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.sirve_en_ministerio(ministerio_id)
    or public.esta_en_grupo(id)
  );--> statement-breakpoint

drop policy if exists grupos_insert_red on public.grupos;--> statement-breakpoint
create policy grupos_insert_red on public.grupos
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupos_update_red on public.grupos;--> statement-breakpoint
create policy grupos_update_red on public.grupos
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupos_delete_red on public.grupos;--> statement-breakpoint
create policy grupos_delete_red on public.grupos
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- Del resto de su grupo, el participante ve solo a quien lo lleva: es lo que
-- necesita para saber a quien preguntar, y nada mas.
drop policy if exists grupo_miembros_select_relacion on public.grupo_miembros;--> statement-breakpoint
create policy grupo_miembros_select_relacion on public.grupo_miembros
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.lleva_grupo(grupo_id)
    or miembro_id = public.miembro_actual(iglesia_id)
    or (rol_grupo <> 'participante' and public.esta_en_grupo(grupo_id))
  );--> statement-breakpoint

drop policy if exists grupo_miembros_insert_red on public.grupo_miembros;--> statement-breakpoint
create policy grupo_miembros_insert_red on public.grupo_miembros
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupo_miembros_update_red on public.grupo_miembros;--> statement-breakpoint
create policy grupo_miembros_update_red on public.grupo_miembros
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupo_miembros_delete_red on public.grupo_miembros;--> statement-breakpoint
create policy grupo_miembros_delete_red on public.grupo_miembros
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


drop policy if exists grupo_semanas_select_relacion on public.grupo_semanas;--> statement-breakpoint
create policy grupo_semanas_select_relacion on public.grupo_semanas
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.esta_en_grupo(grupo_id)
  );--> statement-breakpoint

drop policy if exists grupo_semanas_insert_quien_lleva on public.grupo_semanas;--> statement-breakpoint
create policy grupo_semanas_insert_quien_lleva on public.grupo_semanas
  for insert to hatril_app
  with check (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.lleva_grupo(grupo_id)
  );--> statement-breakpoint

drop policy if exists grupo_semanas_update_quien_lleva on public.grupo_semanas;--> statement-breakpoint
create policy grupo_semanas_update_quien_lleva on public.grupo_semanas
  for update to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.lleva_grupo(grupo_id)
  )
  with check (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.lleva_grupo(grupo_id)
  );--> statement-breakpoint

drop policy if exists grupo_semanas_delete_quien_lleva on public.grupo_semanas;--> statement-breakpoint
create policy grupo_semanas_delete_quien_lleva on public.grupo_semanas
  for delete to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.lleva_grupo(grupo_id)
  );--> statement-breakpoint


drop policy if exists grupo_guias_select_iglesia on public.grupo_guias;--> statement-breakpoint
create policy grupo_guias_select_iglesia on public.grupo_guias
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists grupo_guias_insert_red on public.grupo_guias;--> statement-breakpoint
create policy grupo_guias_insert_red on public.grupo_guias
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupo_guias_update_red on public.grupo_guias;--> statement-breakpoint
create policy grupo_guias_update_red on public.grupo_guias
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists grupo_guias_delete_red on public.grupo_guias;--> statement-breakpoint
create policy grupo_guias_delete_red on public.grupo_guias
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT132 -- todo es de la misma iglesia Y del mismo ministerio, y quien lleva un
-- grupo esta en el equipo
--
-- Sin el atajo de `_escritor_confiable()`, como HT122 y HT126: es integridad,
-- no privilegio, y vale tambien para seeds y migraciones.
--
-- El "mismo ministerio" es lo que sostiene la RLS por relacion: una fila de
-- `grupo_miembros` que dijera ser de la red de jovenes y colgara de una celula
-- de la de mujeres le abriria esa celula al lider de jovenes por la puerta
-- lateral.
--
-- Y el equipo: para ser lider o auxiliar de un grupo hay que estar activo en
-- el equipo de su ministerio. Sin esto, la red podria nombrar "lider de celula"
-- a cualquiera de la iglesia y darle la lista de esa celula sin pasar por el
-- equipo, que es donde el pastor ve quien lleva que. Se mira al NOMBRAR -al
-- insertar, o cuando cambian el papel, la persona o se reactiva la fila-, no
-- en cada UPDATE: salir del equipo despues ya lo cubre `lleva_grupo()`, y
-- comprobarlo siempre impediria, por ejemplo, darle de baja del grupo.
--
-- Quien apunta (`*_miembro_id`, uuid pelado) se comprueba al cambiar, en dos
-- pasos y no con un `or` contra `old`, como en HT122.
-- ---------------------------------------------------------------------------

create or replace function public.validar_grupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_firma boolean;
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_firma := true;
  else
    v_firma := new.creado_por_miembro_id is distinct from old.creado_por_miembro_id;
  end if;

  if v_firma and new.creado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.creado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: quien crea el grupo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_grupo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupos_validar
  before insert or update on public.grupos
  for each row execute function public.validar_grupo();--> statement-breakpoint


create or replace function public.validar_grupo_miembro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_persona boolean;
  v_equipo boolean;
begin
  if not exists (
    select 1 from public.grupos g
     where g.id = new.grupo_id
       and g.iglesia_id = new.iglesia_id
       and g.ministerio_id = new.ministerio_id
  ) then
    raise exception 'HT132: el grupo no es de esta iglesia ni de este ministerio'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_persona := true;
  else
    v_persona := new.miembro_id is distinct from old.miembro_id;
  end if;

  if v_persona and not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: esa persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.activo and new.rol_grupo in ('lider', 'auxiliar') then
    if tg_op = 'INSERT' then
      v_equipo := true;
    else
      v_equipo := new.rol_grupo  is distinct from old.rol_grupo
               or new.activo     is distinct from old.activo
               or new.miembro_id is distinct from old.miembro_id
               or new.grupo_id   is distinct from old.grupo_id;
    end if;

    if v_equipo and not exists (
      select 1 from public.ministerio_miembros mm
       where mm.ministerio_id = new.ministerio_id
         and mm.miembro_id = new.miembro_id
         and mm.activo = true
    ) then
      raise exception 'HT132: para llevar un grupo hay que estar en el equipo de su ministerio'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_grupo_miembro()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_miembros_validar
  before insert or update on public.grupo_miembros
  for each row execute function public.validar_grupo_miembro();--> statement-breakpoint


create or replace function public.validar_grupo_semana()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_firma boolean;
begin
  if not exists (
    select 1 from public.grupos g
     where g.id = new.grupo_id
       and g.iglesia_id = new.iglesia_id
       and g.ministerio_id = new.ministerio_id
  ) then
    raise exception 'HT132: la semana no es de un grupo de este ministerio'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_firma := true;
  else
    v_firma := new.reportado_por_miembro_id is distinct from old.reportado_por_miembro_id;
  end if;

  if v_firma and new.reportado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.reportado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: quien reporta no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_grupo_semana()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_semanas_validar
  before insert or update on public.grupo_semanas
  for each row execute function public.validar_grupo_semana();--> statement-breakpoint


create or replace function public.validar_grupo_guia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_firma boolean;
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_firma := true;
  else
    v_firma := new.publicado_por_miembro_id is distinct from old.publicado_por_miembro_id;
  end if;

  if v_firma and new.publicado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.publicado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: quien publica la guia no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_grupo_guia()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_guias_validar
  before insert or update on public.grupo_guias
  for each row execute function public.validar_grupo_guia();--> statement-breakpoint


-- La solicitud que trae la invitacion de un grupo: ese grupo es de la iglesia
-- a la que se pide entrar. La escribe /solicitar por `dbAdmin`, y por eso
-- importa que lo diga la base: un codigo de otra iglesia en la URL dejaria al
-- aprobado dentro de una celula ajena. El SET NULL de borrar el grupo pasa
-- sin comprobar nada.
create or replace function public.validar_solicitud_grupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.grupo_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.grupo_id is not distinct from old.grupo_id then
    return new;
  end if;

  if not exists (
    select 1 from public.grupos g
     where g.id = new.grupo_id
       and g.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: ese grupo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_solicitud_grupo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_solicitudes_ingreso_validar_grupo
  before insert or update of grupo_id on public.solicitudes_ingreso
  for each row execute function public.validar_solicitud_grupo();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT133 -- lo que identifica una fila no cambia
--
-- El caso de siempre (HT111, HT117, HT123, HT127): una cuenta en DOS
-- congregaciones hace ciertos a la vez el `using` y el `with check` de la
-- policy de UPDATE, y mover una fila de iglesia o de red seria llevarse una
-- celula -o a la gente de una celula- de un sitio a otro.
--
-- En `grupo_miembros`, ni el grupo ni la persona: cambiar a alguien de celula
-- es darle de baja en una y de alta en otra, que deja el historial. Y una
-- semana no cambia de semana: seria reescribir que reporto quien.
--
-- CON el atajo de `_escritor_confiable()`: es un guard de privilegio.
-- ---------------------------------------------------------------------------

create or replace function public.guard_grupos()
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
    raise exception 'HT133: un grupo no cambia de iglesia ni de ministerio'
      using errcode = 'insufficient_privilege';
  end if;

  if new.creado_por_miembro_id is distinct from old.creado_por_miembro_id
     or new.created_at is distinct from old.created_at then
    raise exception 'HT133: quien creo el grupo no se reescribe'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_grupos()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupos_guard
  before update on public.grupos
  for each row execute function public.guard_grupos();--> statement-breakpoint


create or replace function public.guard_grupo_miembros()
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
     or new.ministerio_id is distinct from old.ministerio_id
     or new.grupo_id is distinct from old.grupo_id
     or new.miembro_id is distinct from old.miembro_id
     or new.created_at is distinct from old.created_at then
    raise exception 'HT133: una fila de un grupo no cambia de grupo ni de persona'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_grupo_miembros()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_miembros_guard
  before update on public.grupo_miembros
  for each row execute function public.guard_grupo_miembros();--> statement-breakpoint


create or replace function public.guard_grupo_semanas()
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
     or new.ministerio_id is distinct from old.ministerio_id
     or new.grupo_id is distinct from old.grupo_id
     or new.semana is distinct from old.semana
     or new.created_at is distinct from old.created_at then
    raise exception 'HT133: una semana de un grupo no cambia de grupo ni de semana'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_grupo_semanas()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_semanas_guard
  before update on public.grupo_semanas
  for each row execute function public.guard_grupo_semanas();--> statement-breakpoint


create or replace function public.guard_grupo_guias()
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
     or new.ministerio_id is distinct from old.ministerio_id
     or new.semana is distinct from old.semana
     or new.created_at is distinct from old.created_at then
    raise exception 'HT133: una guia no cambia de red ni de semana'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_grupo_guias()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_guias_guard
  before update on public.grupo_guias
  for each row execute function public.guard_grupo_guias();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT134 -- nadie se pone a si mismo a llevar un grupo
--
-- Como HT104 en el equipo: llevar una celula abre su lista y su historial, y
-- quien puede escribir en `grupo_miembros` -el responsable y los colideres de
-- la red- podria nombrarse lider de cualquier celula para verla por dentro.
-- El pastor pasa, por lo mismo que en HT104: ya lo ve todo, y en una iglesia
-- pequena es normal que lleve una.
--
-- Subir es lo que se mira: entrar como lider o auxiliar, pasar de participante
-- a auxiliar o de auxiliar a lider, o reactivar una fila de lider. Bajarse uno
-- mismo -de lider a auxiliar, o salir- solo le quita mando a quien lo pide.
-- ---------------------------------------------------------------------------

create or replace function public.guard_grupo_miembros_ascenso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mi_ficha uuid;
  v_nuevo smallint;
  v_viejo smallint;
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if not new.activo or new.rol_grupo = 'participante' then
    return new;
  end if;

  v_nuevo := case new.rol_grupo when 'lider' then 2 when 'auxiliar' then 1 else 0 end;

  if tg_op = 'UPDATE' and old.activo then
    v_viejo := case old.rol_grupo when 'lider' then 2 when 'auxiliar' then 1 else 0 end;
    if v_nuevo <= v_viejo then
      return new;
    end if;
  end if;

  if public.es_pastor(new.iglesia_id) then
    return new;
  end if;

  v_mi_ficha := public.miembro_actual(new.iglesia_id);

  if v_mi_ficha is not null and v_mi_ficha = new.miembro_id then
    raise exception 'HT134: no puedes ponerte a ti mismo a llevar un grupo'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_grupo_miembros_ascenso()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_grupo_miembros_ascenso
  before insert or update on public.grupo_miembros
  for each row execute function public.guard_grupo_miembros_ascenso();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `updated_at` y auditoria. El porque de que solo se audite `grupos`, en la
-- cabecera.
-- ---------------------------------------------------------------------------

create trigger trg_grupos_touch
  before update on public.grupos
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_grupo_semanas_touch
  before update on public.grupo_semanas
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_grupo_guias_touch
  before update on public.grupo_guias
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_auditar_grupos
  after insert or update or delete on public.grupos
  for each row execute function public.auditar();--> statement-breakpoint


comment on table public.grupos is
  'Grupos pequenos de un ministerio: celulas de una red, clases. Sin direccion, solo zona, dia y hora. RLS por relacion (es_pastor OR sirve_en_ministerio OR esta_en_grupo), 0047.';--> statement-breakpoint

comment on table public.grupo_miembros is
  'Quien esta en cada grupo y con que papel. Lider y auxiliar, del equipo del ministerio (HT132). Sin auditar(): pertenencia religiosa nominal. El participante ve a quien lo lleva, no a los demas.';--> statement-breakpoint

comment on table public.grupo_semanas is
  'Cada semana de un grupo: tema y, al reportar, cuantos vinieron y cuantas visitas. Un recuento sin nombres, a proposito: ver la 0047. No cuenta para ultima_asistencia.';--> statement-breakpoint

comment on column public.solicitudes_ingreso.grupo_id is
  'El grupo de cuya invitacion viene. Al aprobar, la persona queda en el. HT132: de la misma iglesia.';
