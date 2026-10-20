-- ===========================================================================
-- 0042 -- Reparto: RLS por equipo, coherencia, inmutabilidad y el numero
--
-- Tres tablas de la 0041: el padron de hogares que reciben, cada dia de
-- reparto y quien vino a cada uno.
--
-- QUE PESA ESTO
-- -------------
-- Mas que nada de lo anterior. Son personas que en su mayoria NO son de la
-- congregacion, que estan pasando necesidad, y que dan sus datos a una entidad
-- religiosa. Dos criterios de la lista de la AEPD a la vez. Una fuga aqui no
-- revela solo una confesion: revela quien no tiene para comer.
--
-- 1. RLS POR EQUIPO, NO POR IGLESIA. ES UNA EXCEPCION, Y CONSCIENTE
-- -----------------------------------------------------------------
-- Todos los modulos hasta hoy (0030, 0033, 0037, 0039) aislan IGLESIAS en la
-- base y dejan el "quien de dentro" a la aplicacion. Aqui no basta: con
-- `pertenece_a_iglesia()` cualquier miembro raso que alcanzara una consulta por
-- `withUser()` leeria el padron entero. Las policies piden
--
--   es_pastor(iglesia_id) OR sirve_en_ministerio(ministerio_id)
--
-- y para BORRAR a una persona o un dia de reparto, liderarlo:
--
--   es_pastor(iglesia_id) OR lidera_ministerio(ministerio_id)
--
-- La aplicacion es mas estrecha todavia: en la v1 la puerta la llevan el
-- responsable y los colideres (`puedeGestionarDesdeDentro`). La base deja
-- pasar ya al voluntario del equipo para que la v1.1 —voluntarios marcando
-- desde /mi— no necesite tocar ninguna policy. `gestionar_ministerios` NO
-- entra: organizar los ministerios desde secretaria no es estar en este.
--
-- `sirve_en_ministerio` y `lidera_ministerio` nacen aqui para que las
-- reutilice la escuela dominical. Cerradas como todas y concedidas SOLO a
-- `hatril_app` (CLAUDE.md, y la 0007 para el porque).
--
-- 2. NADA PARA `anon` NI PARA `service_role`, Y REVOKE ANTES DE GRANT
-- --------------------------------------------------------------------
-- Redundante en esta base desde la 0022, que invirtio el defecto, y se escribe
-- igual: el fichero tiene que decir la verdad en cualquier otra. Es la fuga de
-- `devocionales` (0012/0022).
--
-- 3. SIN `auditar()`
-- -----------------
-- `auditar()` copia la fila entera a `auditoria`, que no se puede borrar y que
-- el pastor lee de punta a punta. Borrar a una persona del padron —porque lo
-- pide, o porque lleva un año sin venir— dejaria alli su nombre y su telefono
-- para siempre, y la promesa de /privacidad seria falsa.
--
-- 4. BORRAR A UNA PERSONA NO CAMBIA LO QUE SE REPARTIO
-- ----------------------------------------------------
-- `reparto_entregas.beneficiario_id` es ON DELETE SET NULL (0041). Esa puesta
-- a NULL es un UPDATE que dispara los triggers de abajo, y por eso HT127 deja
-- que la columna vaya a NULL y nada mas: sin eso, borrar a alguien fallaria.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Las dos funciones de equipo
--
-- Por `iglesia_usuarios` y no por `miembro_actual()`: la de la 0015 hace un
-- `limit 1` por iglesia, y aqui se puede comprobar la cuenta y la ficha en el
-- mismo join. La membresia tiene que estar ACTIVA, como en
-- `pertenece_a_iglesia()`: quien espera aprobacion no sirve en nada.
-- ---------------------------------------------------------------------------

create or replace function public.sirve_en_ministerio(p_ministerio_id uuid)
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
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.sirve_en_ministerio(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.sirve_en_ministerio(uuid) to hatril_app;--> statement-breakpoint


create or replace function public.lidera_ministerio(p_ministerio_id uuid)
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
       and mm.rol_equipo in ('responsable', 'colider')
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

revoke execute on function public.lidera_ministerio(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.lidera_ministerio(uuid) to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Permisos de tabla
-- ---------------------------------------------------------------------------

alter table public.reparto_beneficiarios enable row level security;--> statement-breakpoint
alter table public.reparto_jornadas      enable row level security;--> statement-breakpoint
alter table public.reparto_entregas      enable row level security;--> statement-breakpoint

revoke all on public.reparto_beneficiarios from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.reparto_jornadas      from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.reparto_entregas      from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.reparto_beneficiarios to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.reparto_jornadas      to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.reparto_entregas      to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies, `to hatril_app` explicito en todas (ver la 0005).
-- ---------------------------------------------------------------------------

drop policy if exists reparto_beneficiarios_select_equipo on public.reparto_beneficiarios;--> statement-breakpoint
create policy reparto_beneficiarios_select_equipo on public.reparto_beneficiarios
  for select to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_beneficiarios_insert_equipo on public.reparto_beneficiarios;--> statement-breakpoint
create policy reparto_beneficiarios_insert_equipo on public.reparto_beneficiarios
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_beneficiarios_update_equipo on public.reparto_beneficiarios;--> statement-breakpoint
create policy reparto_beneficiarios_update_equipo on public.reparto_beneficiarios
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_beneficiarios_delete_lider on public.reparto_beneficiarios;--> statement-breakpoint
create policy reparto_beneficiarios_delete_lider on public.reparto_beneficiarios
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


drop policy if exists reparto_jornadas_select_equipo on public.reparto_jornadas;--> statement-breakpoint
create policy reparto_jornadas_select_equipo on public.reparto_jornadas
  for select to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_jornadas_insert_equipo on public.reparto_jornadas;--> statement-breakpoint
create policy reparto_jornadas_insert_equipo on public.reparto_jornadas
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_jornadas_update_equipo on public.reparto_jornadas;--> statement-breakpoint
create policy reparto_jornadas_update_equipo on public.reparto_jornadas
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_jornadas_delete_lider on public.reparto_jornadas;--> statement-breakpoint
create policy reparto_jornadas_delete_lider on public.reparto_jornadas
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.lidera_ministerio(ministerio_id));--> statement-breakpoint


-- Las entregas, cualquiera del equipo, borrar incluido: «Quitar» a quien se
-- marco como llegado por error es cosa de la puerta, no del responsable.
drop policy if exists reparto_entregas_select_equipo on public.reparto_entregas;--> statement-breakpoint
create policy reparto_entregas_select_equipo on public.reparto_entregas
  for select to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_entregas_insert_equipo on public.reparto_entregas;--> statement-breakpoint
create policy reparto_entregas_insert_equipo on public.reparto_entregas
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_entregas_update_equipo on public.reparto_entregas;--> statement-breakpoint
create policy reparto_entregas_update_equipo on public.reparto_entregas
  for update to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id))
  with check (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint

drop policy if exists reparto_entregas_delete_equipo on public.reparto_entregas;--> statement-breakpoint
create policy reparto_entregas_delete_equipo on public.reparto_entregas
  for delete to hatril_app
  using (public.es_pastor(iglesia_id) or public.sirve_en_ministerio(ministerio_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- El numero correlativo, por equipo
--
-- Como `asignar_numero_miembro` (0001), con dos diferencias. Se escribe
-- SIEMPRE, no solo cuando llega vacio: nadie elige su numero, y el `default 0`
-- de la columna solo existe para que la aplicacion no tenga que mandarlo. Y va
-- con un cerrojo de transaccion por ministerio: con dos voluntarios dando de
-- alta a la vez, el `max() + 1` de los dos leeria lo mismo y uno chocaria
-- contra el unico. El cerrojo se suelta solo al confirmar.
-- ---------------------------------------------------------------------------

create or replace function public.asignar_numero_reparto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('reparto_numero:' || new.ministerio_id::text, 0)
  );

  select coalesce(max(numero), 0) + 1
    into new.numero
    from public.reparto_beneficiarios
   where ministerio_id = new.ministerio_id;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.asignar_numero_reparto()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_beneficiarios_numero
  before insert on public.reparto_beneficiarios
  for each row execute function public.asignar_numero_reparto();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT126 -- todo es de la misma iglesia Y del mismo equipo
--
-- Sin el atajo de `_escritor_confiable()`, como HT122 y HT124: es integridad,
-- no privilegio, y vale tambien para seeds y migraciones.
--
-- El "mismo equipo" es lo que sostiene la RLS por ministerio: una entrega del
-- reparto de jovenes que apuntara a una persona del padron de accion social
-- haria que quien sirve en jovenes leyera, por la puerta lateral, una fila de un
-- padron que su policy no le abre.
--
-- Y en la entrega, al INSERTAR, copia `personas_hogar` del padron. La pone la
-- base y no la aplicacion: es lo que hace que el total del mes siga siendo
-- cierto cuando la persona se borra o su hogar cambia.
--
-- Quien apunta o marca (`*_miembro_id`, uuid pelado) se comprueba al INSERTAR
-- y no en cada UPDATE. Si se borra la ficha de un voluntario —tiene el mismo
-- derecho de supresion que cualquiera—, sus entregas se quedan con un uuid que
-- ya no existe, y comprobarlo en cada UPDATE impediria despues marcarlas o
-- borrar a la persona del padron. HT127 ya impide cambiarlo desde una sesion.
-- En dos pasos y no con un `or` contra `old`, como en HT122.
-- ---------------------------------------------------------------------------

create or replace function public.validar_reparto_beneficiario()
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
    raise exception 'HT126: el ministerio no es de esta iglesia'
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
    raise exception 'HT126: quien apunta no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_reparto_beneficiario()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_beneficiarios_validar
  before insert or update on public.reparto_beneficiarios
  for each row execute function public.validar_reparto_beneficiario();--> statement-breakpoint


create or replace function public.validar_reparto_jornada()
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
    raise exception 'HT126: el ministerio no es de esta iglesia'
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
    raise exception 'HT126: quien empieza el reparto no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_reparto_jornada()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_jornadas_validar
  before insert or update on public.reparto_jornadas
  for each row execute function public.validar_reparto_jornada();--> statement-breakpoint


create or replace function public.validar_reparto_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_personas smallint;
  v_firma boolean;
begin
  if not exists (
    select 1 from public.reparto_jornadas j
     where j.id = new.jornada_id
       and j.iglesia_id = new.iglesia_id
       and j.ministerio_id = new.ministerio_id
  ) then
    raise exception 'HT126: el dia de reparto no es de este equipo'
      using errcode = 'check_violation';
  end if;

  -- Sin persona solo se queda una fila cuando la persona se BORRA (SET NULL).
  -- Quien se lleva la bolsa sin dar sus datos va al contador
  -- `reparto_jornadas.sin_inscribir`, no a una fila sin nadie.
  if tg_op = 'INSERT' and new.beneficiario_id is null then
    raise exception 'HT126: una entrega se apunta a alguien del padron'
      using errcode = 'check_violation';
  end if;

  if new.beneficiario_id is not null then
    select b.personas_hogar
      into v_personas
      from public.reparto_beneficiarios b
     where b.id = new.beneficiario_id
       and b.iglesia_id = new.iglesia_id
       and b.ministerio_id = new.ministerio_id;

    if not found then
      raise exception 'HT126: esa persona no es del padron de este equipo'
        using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT' then
      new.personas_hogar := v_personas;
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_firma := true;
  else
    v_firma := new.registrado_por_miembro_id is distinct from old.registrado_por_miembro_id;
  end if;

  if v_firma and new.registrado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.registrado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT126: quien marca no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_reparto_entrega()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_entregas_validar
  before insert or update on public.reparto_entregas
  for each row execute function public.validar_reparto_entrega();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT127 -- lo que identifica una fila no cambia
--
-- El caso de siempre (HT111, HT117, HT123, HT125): una cuenta en DOS
-- congregaciones hace ciertos a la vez el `using` y el `with check` de la
-- policy de UPDATE, y mover una fila de iglesia o de equipo seria llevarse una
-- persona vulnerable de un padron a otro.
--
-- Y tres propios de este modulo:
--
--   - El consentimiento de una persona no se reescribe. Es la prueba del art.
--     7.1 de a que texto dijo que si, y cuando.
--   - El numero no cambia: es por lo que se le llama en la puerta.
--   - En una entrega, la persona solo puede pasar a NULL —es el SET NULL de
--     borrarla— y nunca a OTRA persona: eso seria reescribir quien vino un
--     domingo. `personas_hogar` tampoco cambia, que es la cifra del mes.
--
-- CON el atajo de `_escritor_confiable()`: es un guard de privilegio.
-- ---------------------------------------------------------------------------

create or replace function public.guard_reparto_beneficiarios()
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
    raise exception 'HT127: una persona del padron no cambia de iglesia ni de equipo'
      using errcode = 'insufficient_privilege';
  end if;

  if new.numero is distinct from old.numero
     or new.consentimiento_version is distinct from old.consentimiento_version
     or new.consentimiento_at is distinct from old.consentimiento_at
     or new.creado_por_miembro_id is distinct from old.creado_por_miembro_id
     or new.created_at is distinct from old.created_at then
    raise exception 'HT127: el numero y el consentimiento no se reescriben'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_reparto_beneficiarios()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_beneficiarios_guard
  before update on public.reparto_beneficiarios
  for each row execute function public.guard_reparto_beneficiarios();--> statement-breakpoint


create or replace function public.guard_reparto_jornadas()
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
     or new.fecha is distinct from old.fecha
     or new.creado_por_miembro_id is distinct from old.creado_por_miembro_id then
    raise exception 'HT127: un dia de reparto no cambia de iglesia, de equipo ni de fecha'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_reparto_jornadas()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_jornadas_guard
  before update on public.reparto_jornadas
  for each row execute function public.guard_reparto_jornadas();--> statement-breakpoint


create or replace function public.guard_reparto_entregas()
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
     or new.jornada_id is distinct from old.jornada_id then
    raise exception 'HT127: una entrega no cambia de iglesia, de equipo ni de dia'
      using errcode = 'insufficient_privilege';
  end if;

  if new.beneficiario_id is distinct from old.beneficiario_id
     and new.beneficiario_id is not null then
    raise exception 'HT127: una entrega no cambia de persona'
      using errcode = 'insufficient_privilege';
  end if;

  if new.personas_hogar is distinct from old.personas_hogar
     or new.registrado_por_miembro_id is distinct from old.registrado_por_miembro_id
     or new.created_at is distinct from old.created_at then
    raise exception 'HT127: lo apuntado al llegar no se reescribe'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_reparto_entregas()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reparto_entregas_guard
  before update on public.reparto_entregas
  for each row execute function public.guard_reparto_entregas();--> statement-breakpoint


create trigger trg_reparto_beneficiarios_touch
  before update on public.reparto_beneficiarios
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_reparto_jornadas_touch
  before update on public.reparto_jornadas
  for each row execute function public.touch_updated_at();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- La herramienta, encendida donde la plantilla del tipo la trae: accion social.
--
-- El criterio de la 0037 y la 0039: quien configuro su ministerio antes de que
-- existiera el reparto nunca decidio sobre el, asi que se le aplica lo que hoy
-- trae su tipo. Los que estan en `{}` no se tocan —ya les toca la plantilla
-- entera al editarlos— y los que tengan la clave escrita tampoco.
-- ---------------------------------------------------------------------------

update public.ministerios
   set modulos = modulos || '{"reparto": {"activo": true}}'::jsonb
 where tipo = 'accion_social'
   and modulos <> '{}'::jsonb
   and modulos -> 'reparto' is null;--> statement-breakpoint


comment on table public.reparto_beneficiarios is
  'Padron de hogares que reciben del reparto. Aparte de miembros y sin miembro_id: inscribirse no hace miembro a nadie. Sin texto libre. RLS por equipo (es_pastor OR sirve_en_ministerio).';--> statement-breakpoint

comment on column public.reparto_entregas.beneficiario_id is
  'ON DELETE SET NULL a proposito: borrar a la persona se lleva sus datos y deja la entrega contada, sin nadie detras. HT127 solo deja que pase a NULL.';--> statement-breakpoint

comment on column public.reparto_jornadas.sin_inscribir is
  'Entregas a quien no quiso dar sus datos. La comida no se condiciona a inscribirse.';
