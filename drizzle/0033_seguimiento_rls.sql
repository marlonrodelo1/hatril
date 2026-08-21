-- ===========================================================================
-- 0033 — Seguimiento: RLS, coherencia y la firma que no se elige
--
-- Dos tablas. `seguimiento_asignaciones` dice quien acompana a quien, y
-- `seguimiento_contactos` guarda cada llamada, visita o mensaje.
--
-- QUE ES ESTO Y POR QUE PESA MAS QUE LA ASISTENCIA
-- ------------------------------------------------
-- La asistencia dice que alguien fue al culto. Esto dice POR QUE dejo de ir.
-- Aunque el motivo se elija de una lista cerrada —y por eso NO hay campo de
-- texto libre, ver el schema—, el conjunto sigue siendo un mapa de quien esta
-- molesto con la iglesia, quien se mudo y a quien no se puede localizar. Con
-- nombre y apellidos.
--
-- De ahi salen las cuatro decisiones de abajo.
--
-- 1. NADA PARA `anon` NI PARA `service_role`
-- -------------------------------------------
-- De aqui no sale a la web ni un recuento. El revoke es redundante EN ESTA BASE
-- desde que la 0022 invirtio el defecto, y se escribe igual porque el fichero
-- tiene que decir la verdad en cualquier otra. Para `service_role` no es
-- redundante ni sobre el papel: tiene BYPASSRLS y ninguna policy lo detiene,
-- solo el grant.
--
-- 2. NINGUNA DE LAS DOS LLEVA `auditar()`
-- ----------------------------------------
-- Mismo motivo que `asistencias` en la 0030, y aqui es peor. `auditar()` copia
-- la fila entera con `to_jsonb(new)` a `public.auditoria`, donde `hatril_app`
-- tiene `grant select` DE TABLA ENTERA (0001:226) y `auditoria_select_pastor`
-- (0001:439) no filtra por entidad: el mapa completo quedaria reconstruible por
-- una segunda puerta. Y `auditoria` no tiene policy de DELETE para NADIE, asi
-- que el derecho de supresion de esa persona pasaria a exigir SQL a mano,
-- contra lo que promete `/privacidad`.
--
-- 3. LA FIRMA NO SE ELIGE, SE COMPRUEBA
-- --------------------------------------
-- `autor_miembro_id` tiene que ser la ficha de quien escribe, y lo exige la
-- POLICY, no la aplicacion. Sin eso, cualquiera del equipo podria apuntar
-- «Fulano visito a Mengana y se molesto» firmando con la ficha de Fulano. Es el
-- mismo patron de `publicaciones_insert_propia` en la 0027.
--
-- 4. LA RLS AISLA IGLESIAS; QUIEN ENTRA LO DECIDE LA APLICACION
-- --------------------------------------------------------------
-- Las policies comprueban `pertenece_a_iglesia()`. Que ademas haga falta el
-- permiso `ver_seguimiento` Y ser responsable de ese ministerio lo deciden
-- `src/lib/auth/permisos.ts` y el layout de la seccion. Es la frontera que la
-- 0001:330 declaro y que no se escribe dos veces.
-- ===========================================================================

alter table public.seguimiento_asignaciones enable row level security;--> statement-breakpoint
alter table public.seguimiento_contactos    enable row level security;--> statement-breakpoint

-- Revocar SIEMPRE antes de conceder: un grant por columna no recorta nada si
-- debajo sigue el de tabla entera. Es la fuga de `devocionales` que cerro la 0022.
revoke all on public.seguimiento_asignaciones from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.seguimiento_contactos    from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.seguimiento_asignaciones to hatril_app;--> statement-breakpoint

-- `seguimiento_contactos` NO recibe UPDATE, y es deliberado. Un contacto es un
-- hecho fechado: «el 14 la llame y no contesto». Poder reescribirlo despues
-- convierte el historial en algo que dice lo que convenga hoy, y el valor de
-- esta tabla es precisamente que nadie discuta que se intento y cuando. Si se
-- apunto mal, se borra y se apunta otra vez — eso deja de existir, que es
-- honesto; reescribirlo deja una mentira con fecha.
grant select, insert, delete on public.seguimiento_contactos to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies. `to hatril_app` explicito en todas: se suman con OR, y dos escritas
-- para el visitante y concedidas ademas a este rol fueron la fuga de la 0005.
-- ---------------------------------------------------------------------------

drop policy if exists asignaciones_select_iglesia on public.seguimiento_asignaciones;--> statement-breakpoint
create policy asignaciones_select_iglesia on public.seguimiento_asignaciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asignaciones_insert_iglesia on public.seguimiento_asignaciones;--> statement-breakpoint
create policy asignaciones_insert_iglesia on public.seguimiento_asignaciones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asignaciones_update_iglesia on public.seguimiento_asignaciones;--> statement-breakpoint
create policy asignaciones_update_iglesia on public.seguimiento_asignaciones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asignaciones_delete_iglesia on public.seguimiento_asignaciones;--> statement-breakpoint
create policy asignaciones_delete_iglesia on public.seguimiento_asignaciones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


drop policy if exists contactos_select_iglesia on public.seguimiento_contactos;--> statement-breakpoint
create policy contactos_select_iglesia on public.seguimiento_contactos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

-- La firma comprobada. `miembro_actual()` la creo la 0027 y devuelve la ficha de
-- la sesion en esa iglesia, o NULL: una cuenta sin ficha no puede firmar nada,
-- que es el comportamiento correcto y no un caso raro (`ctx.miembroId` es
-- nullable en toda la aplicacion).
drop policy if exists contactos_insert_propio on public.seguimiento_contactos;--> statement-breakpoint
create policy contactos_insert_propio on public.seguimiento_contactos
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  );--> statement-breakpoint

-- Se puede borrar lo de cualquiera del equipo, no solo lo propio: un contacto
-- apuntado en la persona equivocada lo tiene que poder quitar quien lo ve, y
-- quien llega aqui ya pasa por `ver_seguimiento` mas ser responsable de este
-- ministerio. Ademas el derecho de supresion del RGPD necesita que exista
-- alguien capaz de borrar las filas de una persona concreta.
drop policy if exists contactos_delete_iglesia on public.seguimiento_contactos;--> statement-breakpoint
create policy contactos_delete_iglesia on public.seguimiento_contactos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT118 — todo lo que cuelga de una fila es de la misma iglesia que la fila
--
-- Sin el atajo de `_escritor_confiable()`, igual que HT116: esto es una
-- invariante de integridad y no un guard de privilegio. La coherencia se
-- comprueba siempre, tambien para migraciones y seeds.
--
-- Y comprueba una cosa mas que sus hermanas: que el RESPONSABLE este de verdad
-- en el equipo de ese ministerio. Asignarle personas a quien no forma parte del
-- equipo es repartir trabajo a alguien que no va a ver nunca esa pantalla.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_asignacion()
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
    raise exception 'HT118: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT118: esa persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.ministerio_miembros mm
     where mm.miembro_id = new.responsable_miembro_id
       and mm.ministerio_id = new.ministerio_id
       and mm.activo = true
  ) then
    raise exception 'HT118: quien acompana no esta en el equipo de ese ministerio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_asignacion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_asignaciones_validar_iglesia
  before insert or update on public.seguimiento_asignaciones
  for each row execute function public.validar_iglesia_asignacion();--> statement-breakpoint


create or replace function public.validar_iglesia_contacto()
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
    raise exception 'HT118: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT118: esa persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.autor_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT118: quien apunta el contacto no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_contacto()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_contactos_validar_iglesia
  before insert on public.seguimiento_contactos
  for each row execute function public.validar_iglesia_contacto();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT119 — una asignacion no cambia de iglesia
--
-- El caso real no es una fuga hacia un extrano: una cuenta puede pertenecer a
-- DOS congregaciones —`iglesia_usuarios` solo es unico por (iglesia_id,
-- auth_user_id)—, y entonces el `using` y el `with check` de la policy de UPDATE
-- son ciertos A LA VEZ. Lo descubrio HT111 en la 0020 y hace falta el mismo
-- guard en cada tabla nueva.
--
-- `seguimiento_contactos` no necesita el suyo porque no tiene UPDATE concedido.
--
-- ESTE SI lleva el atajo de `_escritor_confiable()`, al reves que HT118: es un
-- guard de privilegio y solo lo dispara una sesion por `withUser()`.
-- ---------------------------------------------------------------------------

create or replace function public.guard_asignaciones()
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
    raise exception 'HT119: una asignacion no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  if new.miembro_id is distinct from old.miembro_id then
    raise exception 'HT119: una asignacion no cambia de persona acompanada'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_asignaciones()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_asignaciones_guard
  before update on public.seguimiento_asignaciones
  for each row execute function public.guard_asignaciones();--> statement-breakpoint


-- El limite que el comentario de abajo promete, dicho por la base y no solo por
-- el comentario. Es la leccion de los textos legales aplicada al schema: algo
-- que solo esta escrito en prosa no es una garantia, es una intencion. Zod lo
-- valida ademas en la action, para dar un mensaje en castellano en vez de un 500.
alter table public.seguimiento_contactos
  add constraint ck_contactos_proximo_paso_corto
  check (proximo_paso is null or length(proximo_paso) <= 200);--> statement-breakpoint

comment on table public.seguimiento_contactos is
  'Cada llamada, visita o mensaje. SIN texto libre a proposito: el motivo se elige de resultado_contacto_enum. Ver la 0033 y el schema.';--> statement-breakpoint

comment on column public.seguimiento_contactos.proximo_paso is
  'Unico campo escrito a mano del modulo, acotado a 200 caracteres. Recordatorio de que toca ahora, NUNCA el estado de salud o la situacion personal de nadie.';
