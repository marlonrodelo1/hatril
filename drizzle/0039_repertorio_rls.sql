-- ===========================================================================
-- 0039 -- Repertorio: RLS, coherencia, y que cada lista sea de su equipo
--
-- Dos tablas. `canciones` es el repertorio de un equipo y `turno_canciones` la
-- lista de cada culto, colgada de su turno (0036).
--
-- QUE PESA ESTO
-- -------------
-- Poco, y conviene decirlo para no sobreproteger: una cancion no es un dato de
-- nadie. Lo que si importa es lo de siempre —que no cruce de iglesia— y una
-- cosa propia de esta tabla: que la lista de alabanza no pueda llevar canciones
-- del repertorio de otro equipo, que es lo que HT124 comprueba.
--
-- 1. NADA PARA `anon` NI PARA `service_role`
-- -------------------------------------------
-- Ni siquiera esto sale a la web publica. El revoke es redundante EN ESTA BASE
-- desde la 0022 y se escribe igual: el fichero tiene que decir la verdad en
-- cualquier otra.
--
-- 2. SIN `auditar()`
-- ------------------
-- Es el contenido de trabajo de un equipo, no una decision de la iglesia ni un
-- dato de una persona. Auditarlo llenaria `auditoria` de «se cambio el tono de
-- Way Maker», y esa tabla es la que el pastor mira para saber quien toco el
-- fichero de su congregacion.
--
-- 3. LA RLS AISLA IGLESIAS; QUIEN EDITA LO DECIDE LA APLICACION
-- --------------------------------------------------------------
-- Como en la 0030, la 0033 y la 0037: `pertenece_a_iglesia()` en las policies,
-- y el ambito (quien lleva ese ministerio) en `permisos.ts` y las actions.
-- ===========================================================================

alter table public.canciones       enable row level security;--> statement-breakpoint
alter table public.turno_canciones enable row level security;--> statement-breakpoint

-- Revocar SIEMPRE antes de conceder. Es la fuga de `devocionales` (0022).
revoke all on public.canciones       from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.turno_canciones from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.canciones       to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.turno_canciones to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies, `to hatril_app` explicito en las ocho (ver la 0005).
-- ---------------------------------------------------------------------------

drop policy if exists canciones_select_iglesia on public.canciones;--> statement-breakpoint
create policy canciones_select_iglesia on public.canciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists canciones_insert_iglesia on public.canciones;--> statement-breakpoint
create policy canciones_insert_iglesia on public.canciones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists canciones_update_iglesia on public.canciones;--> statement-breakpoint
create policy canciones_update_iglesia on public.canciones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists canciones_delete_iglesia on public.canciones;--> statement-breakpoint
create policy canciones_delete_iglesia on public.canciones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


drop policy if exists turno_canciones_select_iglesia on public.turno_canciones;--> statement-breakpoint
create policy turno_canciones_select_iglesia on public.turno_canciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_canciones_insert_iglesia on public.turno_canciones;--> statement-breakpoint
create policy turno_canciones_insert_iglesia on public.turno_canciones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_canciones_update_iglesia on public.turno_canciones;--> statement-breakpoint
create policy turno_canciones_update_iglesia on public.turno_canciones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_canciones_delete_iglesia on public.turno_canciones;--> statement-breakpoint
create policy turno_canciones_delete_iglesia on public.turno_canciones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT124 -- todo lo que cuelga de una fila es de la misma iglesia, y la lista de
-- un culto solo lleva canciones del repertorio de SU equipo
--
-- Sin el atajo de `_escritor_confiable()`, como HT116, HT118 y HT122: es
-- integridad, no privilegio, y se comprueba tambien para migraciones y seeds.
--
-- Lo del mismo equipo no es estetica. Sin ello, el responsable de jovenes —que
-- solo puede tocar lo suyo— metiendo en su lista el uuid de una cancion de
-- alabanza veria su titulo y sus enlaces, que es leer por la puerta lateral un
-- repertorio que su permiso no le abre.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_cancion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT124: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_cancion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_canciones_validar_iglesia
  before insert or update on public.canciones
  for each row execute function public.validar_iglesia_cancion();--> statement-breakpoint


create or replace function public.validar_iglesia_turno_cancion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.turnos t
     where t.id = new.turno_id
       and t.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT124: el turno no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
      from public.canciones c
      join public.turnos t on t.ministerio_id = c.ministerio_id
     where c.id = new.cancion_id
       and t.id = new.turno_id
       and c.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT124: la cancion no es del repertorio de ese equipo'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_turno_cancion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turno_canciones_validar_iglesia
  before insert or update on public.turno_canciones
  for each row execute function public.validar_iglesia_turno_cancion();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT125 -- una cancion no cambia de iglesia ni de equipo, y una fila de la
-- lista no cambia de culto ni de cancion
--
-- Lo primero por el caso de siempre: una cuenta en DOS congregaciones hace
-- ciertos a la vez el `using` y el `with check` de la policy de UPDATE (HT111).
-- Lo segundo porque mover una cancion de equipo dejaria colgando listas de
-- domingos con una cancion que su equipo ya no tiene, saltandose HT124 por el
-- otro lado.
--
-- En la lista solo se corrige el orden y el tono: cambiar la cancion de una
-- fila es quitar una y poner otra.
--
-- CON el atajo de `_escritor_confiable()`: es un guard de privilegio.
-- ---------------------------------------------------------------------------

create or replace function public.guard_canciones()
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
    raise exception 'HT125: una cancion no cambia de iglesia ni de equipo'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_canciones()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_canciones_guard
  before update on public.canciones
  for each row execute function public.guard_canciones();--> statement-breakpoint


create or replace function public.guard_turno_canciones()
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
     or new.turno_id is distinct from old.turno_id
     or new.cancion_id is distinct from old.cancion_id then
    raise exception 'HT125: una fila de la lista no cambia de culto ni de cancion'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_turno_canciones()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turno_canciones_guard
  before update on public.turno_canciones
  for each row execute function public.guard_turno_canciones();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Los limites, dichos por la base. Y los enlaces, solo `http(s)://`: un
-- `javascript:` guardado aqui se pintaria como enlace en el movil de cada
-- musico del equipo. Zod lo comprueba antes y da el mensaje; esto es lo que
-- impide que una action olvidada lo escriba igual.
-- ---------------------------------------------------------------------------

alter table public.canciones
  add constraint ck_canciones_titulo
  check (length(btrim(titulo)) between 1 and 120);--> statement-breakpoint

alter table public.canciones
  add constraint ck_canciones_textos
  check (
    (autor is null or length(autor) <= 120)
    and (tono is null or length(tono) <= 12)
    and (notas is null or length(notas) <= 500)
  );--> statement-breakpoint

alter table public.canciones
  add constraint ck_canciones_enlaces
  check (
    (enlace_audio is null
      or (enlace_audio ~* '^https?://' and length(enlace_audio) <= 500))
    and (enlace_partitura is null
      or (enlace_partitura ~* '^https?://' and length(enlace_partitura) <= 500))
  );--> statement-breakpoint

alter table public.turno_canciones
  add constraint ck_turno_canciones_tono
  check (tono is null or length(tono) <= 12);--> statement-breakpoint

create trigger trg_canciones_touch
  before update on public.canciones
  for each row execute function public.touch_updated_at();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- La herramienta, encendida donde la plantilla del tipo la trae: alabanza.
--
-- Mismo criterio que la 0037 con los turnos: quien configuro su ministerio
-- antes de que existiera el repertorio nunca decidio sobre el, asi que se le
-- aplica lo que hoy trae su tipo. Los que estan en `{}` no se tocan, y los que
-- tengan la clave escrita tampoco.
-- ---------------------------------------------------------------------------

update public.ministerios
   set modulos = modulos || '{"repertorio": {"activo": true}}'::jsonb
 where tipo = 'alabanza'
   and modulos <> '{}'::jsonb
   and modulos -> 'repertorio' is null;--> statement-breakpoint


comment on table public.canciones is
  'Repertorio de un equipo. Sin letra ni acordes dentro: solo enlaces a donde ya estan, por los derechos de autor.';--> statement-breakpoint

comment on column public.turno_canciones.cancion_id is
  'FK NO ACTION a proposito: una cancion que ya se canto no se borra, se archiva. Asi las listas pasadas no se quedan con huecos.';
