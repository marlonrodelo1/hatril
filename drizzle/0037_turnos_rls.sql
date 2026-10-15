-- ===========================================================================
-- 0037 -- Turnos: RLS, coherencia, y quien puede estar en un puesto
--
-- Dos tablas. `turnos` es «Alabanza sirve el domingo 19 a las 11:00», y
-- `turno_asignaciones` dice quien va y a que puesto.
--
-- QUE PESA ESTO
-- -------------
-- Menos que la asistencia y mucho menos que el seguimiento, pero no es inocuo:
-- que Fulana sirvio en el culto del domingo 19 sigue siendo practica religiosa
-- nominal y fechada (art. 9). Quien forma un equipo se anuncia desde el pulpito;
-- el calendario de cada persona, semana a semana, no. De ahi las tres decisiones
-- de abajo, que son las mismas de la 0030 y por los mismos motivos.
--
-- 1. NADA PARA `anon` NI PARA `service_role`
-- -------------------------------------------
-- De aqui no sale nada a la web publica. El revoke es redundante EN ESTA BASE
-- desde que la 0022 invirtio el defecto, y se escribe igual: el fichero tiene
-- que decir la verdad en cualquier otra. Para `service_role` no es redundante ni
-- sobre el papel: tiene BYPASSRLS y lo unico que lo para es el grant.
--
-- 2. `turno_asignaciones` NO LLEVA `auditar()`; `turnos` SI
-- ---------------------------------------------------------
-- `auditar()` copia la fila entera a `auditoria`, que `hatril_app` lee de tabla
-- entera (0001:226) y que no tiene DELETE para nadie. Auditar las asignaciones
-- seria una segunda puerta al calendario de cada persona, y el derecho de
-- supresion pasaria a exigir SQL a mano. Un turno, en cambio, es un hecho del
-- equipo («alabanza sirve el 19»), no de una persona: igual que `reuniones`.
--
-- 3. LA RLS AISLA IGLESIAS; QUIEN GESTIONA LO DECIDE LA APLICACION
-- ----------------------------------------------------------------
-- Las policies comprueban `pertenece_a_iglesia()`. Que solo planifique quien
-- lleva ese ministerio, y que cada cual conteste solo lo suyo, lo deciden
-- `permisos.ts` y las actions. Es la frontera que declaro la 0001:330.
-- ===========================================================================

alter table public.turnos             enable row level security;--> statement-breakpoint
alter table public.turno_asignaciones enable row level security;--> statement-breakpoint

-- Revocar SIEMPRE antes de conceder: un grant por columna no recorta nada si
-- debajo sigue el de tabla entera. Es la fuga de `devocionales` que cerro la 0022.
revoke all on public.turnos             from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.turno_asignaciones from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.turnos             to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.turno_asignaciones to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies. `to hatril_app` explicito en las ocho: se suman con OR, y dos
-- escritas para el visitante y concedidas ademas a este rol fueron la fuga de
-- la 0005.
-- ---------------------------------------------------------------------------

drop policy if exists turnos_select_iglesia on public.turnos;--> statement-breakpoint
create policy turnos_select_iglesia on public.turnos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turnos_insert_iglesia on public.turnos;--> statement-breakpoint
create policy turnos_insert_iglesia on public.turnos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turnos_update_iglesia on public.turnos;--> statement-breakpoint
create policy turnos_update_iglesia on public.turnos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turnos_delete_iglesia on public.turnos;--> statement-breakpoint
create policy turnos_delete_iglesia on public.turnos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


drop policy if exists turno_asignaciones_select_iglesia on public.turno_asignaciones;--> statement-breakpoint
create policy turno_asignaciones_select_iglesia on public.turno_asignaciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_asignaciones_insert_iglesia on public.turno_asignaciones;--> statement-breakpoint
create policy turno_asignaciones_insert_iglesia on public.turno_asignaciones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_asignaciones_update_iglesia on public.turno_asignaciones;--> statement-breakpoint
create policy turno_asignaciones_update_iglesia on public.turno_asignaciones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists turno_asignaciones_delete_iglesia on public.turno_asignaciones;--> statement-breakpoint
create policy turno_asignaciones_delete_iglesia on public.turno_asignaciones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT122 -- todo lo que cuelga de una fila es de la misma iglesia que la fila
--
-- Sin el atajo de `_escritor_confiable()`, igual que HT116 y HT118: es una
-- invariante de integridad, no un guard de privilegio, y se comprueba tambien
-- para migraciones y seeds, que es justo donde un uuid cruzado entraria sin que
-- nadie lo mire.
--
-- Y una cosa mas, como HT118: quien ocupa un puesto tiene que estar en el
-- equipo de ESE ministerio. Ponerle un turno a alguien de fuera es repartirle
-- trabajo a quien no va a ver nunca la pantalla del equipo, y abriria una
-- puerta lateral: cualquiera que lleve un ministerio podria «asignar» a medio
-- fichero de la iglesia y verle el nombre en su cuadrante.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_turno()
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
    raise exception 'HT122: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.creado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.creado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT122: quien crea el turno no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_turno()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turnos_validar_iglesia
  before insert or update on public.turnos
  for each row execute function public.validar_iglesia_turno();--> statement-breakpoint


create or replace function public.validar_iglesia_turno_asignacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comprobar_equipo boolean;
begin
  if not exists (
    select 1 from public.turnos t
     where t.id = new.turno_id
       and t.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT122: el turno no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT122: esa persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.asignado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.asignado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT122: quien asigna el turno no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  -- El equipo se mira al ASIGNAR, no en cada cambio. Quien sale del equipo
  -- conserva sus turnos pasados —ese historico es lo que se quiere poder
  -- mirar— y tiene que poder seguir contestando el de la semana que viene sin
  -- que la base se lo impida.
  --
  -- En dos pasos y no con un `or` contra `old`: en un INSERT no hay fila vieja,
  -- y es el mismo cuidado que ya pide `auditar()` en la 0001.
  if tg_op = 'INSERT' then
    v_comprobar_equipo := true;
  else
    v_comprobar_equipo := new.miembro_id is distinct from old.miembro_id
                       or new.turno_id   is distinct from old.turno_id;
  end if;

  if v_comprobar_equipo and not exists (
    select 1
      from public.turnos t
      join public.ministerio_miembros mm on mm.ministerio_id = t.ministerio_id
     where t.id = new.turno_id
       and mm.miembro_id = new.miembro_id
       and mm.activo = true
  ) then
    raise exception 'HT122: esa persona no esta en el equipo de ese ministerio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_turno_asignacion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turno_asignaciones_validar_iglesia
  before insert or update on public.turno_asignaciones
  for each row execute function public.validar_iglesia_turno_asignacion();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT123 -- nada de esto cambia de iglesia, y una asignacion tampoco de turno
-- ni de persona
--
-- El caso real, como en HT111 y HT117: una cuenta puede pertenecer a DOS
-- congregaciones, y entonces el `using` y el `with check` de la policy de
-- UPDATE son ciertos a la vez. Seria mover el cuadrante de una iglesia a la
-- otra.
--
-- Un turno tampoco cambia de ministerio: con sus asignaciones colgando, dejaria
-- a gente de alabanza «sirviendo» en ninos sin haber pasado por el equipo, que
-- es justo lo que HT122 comprueba al asignar.
--
-- En las asignaciones solo se corrige el puesto y la respuesta. Mover una fila
-- de persona convierte «me equivoque de nombre» en «reescribo donde estuvo
-- otro»: se borra y se asigna de nuevo.
--
-- ESTOS SI llevan el atajo de `_escritor_confiable()`, al reves que HT122: son
-- guards de privilegio y solo los dispara una sesion por `withUser()`.
-- ---------------------------------------------------------------------------

create or replace function public.guard_turnos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if new.iglesia_id is distinct from old.iglesia_id then
    raise exception 'HT123: un turno no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  if new.ministerio_id is distinct from old.ministerio_id then
    raise exception 'HT123: un turno no cambia de ministerio'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_turnos()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turnos_guard
  before update on public.turnos
  for each row execute function public.guard_turnos();--> statement-breakpoint


create or replace function public.guard_turno_asignaciones()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if new.iglesia_id is distinct from old.iglesia_id then
    raise exception 'HT123: una asignacion no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  if new.turno_id is distinct from old.turno_id
     or new.miembro_id is distinct from old.miembro_id then
    raise exception 'HT123: una asignacion no cambia de turno ni de persona'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_turno_asignaciones()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_turno_asignaciones_guard
  before update on public.turno_asignaciones
  for each row execute function public.guard_turno_asignaciones();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Los limites, dichos por la base y no solo por Zod. Zod da el mensaje en
-- castellano; esto es lo que impide que una action olvidada escriba lo que sea.
-- ---------------------------------------------------------------------------

alter table public.turnos
  add constraint ck_turnos_titulo
  check (length(btrim(titulo)) between 1 and 120);--> statement-breakpoint

alter table public.turnos
  add constraint ck_turnos_notas
  check (notas is null or length(notas) <= 1000);--> statement-breakpoint

alter table public.turno_asignaciones
  add constraint ck_turno_asignaciones_puesto
  check (length(btrim(puesto)) between 1 and 40);--> statement-breakpoint


-- `updated_at` y auditoria solo en `turnos`. El porque de que las asignaciones
-- se queden fuera esta en la cabecera.
create trigger trg_turnos_touch
  before update on public.turnos
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_auditar_turnos
  after insert or update or delete on public.turnos
  for each row execute function public.auditar();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- La herramienta, encendida donde la plantilla del tipo la trae
--
-- `modulos` guarda la decision del pastor sobre cada herramienta. Un ministerio
-- de alabanza configurado ANTES de que existieran los turnos tiene la clave
-- `agenda` escrita y la de `turnos` no: no es que la apagara, es que nunca se le
-- pregunto. Se le aplica lo que hoy trae su tipo (`lib/ministerios/tipos.ts`),
-- igual que `sinConfigurar()` hace con un ministerio que no tiene ninguna.
--
-- Los que estan en `{}` no se tocan. No tienen ninguna herramienta encendida
-- —`modulosActivos({})` no devuelve nada—, y la plantilla entera se les propone
-- en el formulario de editar la primera vez que alguien lo guarde. Encenderles
-- solo esta seria darles turnos sin la agenda que trae el mismo tipo. Y los que
-- tengan la clave escrita, en cualquier sentido, tampoco se tocan.
-- ---------------------------------------------------------------------------

update public.ministerios
   set modulos = modulos || '{"turnos": {"activo": true}}'::jsonb
 where tipo in ('alabanza', 'ninos', 'intercesion', 'ujieres', 'medios')
   and modulos <> '{}'::jsonb
   and modulos -> 'turnos' is null;--> statement-breakpoint


comment on table public.turnos is
  'Un culto en el que sirve un equipo. Fecha y hora copiadas del horario: los cultos no son filas, son reglas de iglesias.horarios.';--> statement-breakpoint

comment on column public.turno_asignaciones.puesto is
  'Texto copiado del puesto, no una clave: renombrar o borrar un puesto no reescribe el historico.';--> statement-breakpoint

comment on column public.turno_asignaciones.respuesta is
  'pendiente NO es que no venga: es que no lo sabemos. Mucha gente del equipo no usa la aplicacion.';
