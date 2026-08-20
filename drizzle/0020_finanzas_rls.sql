-- ===========================================================================
-- 0020 — Finanzas: RLS, permisos y coherencia
--
-- Tres tablas —`fondos`, `cajas`, `movimientos`— que solo alcanza quien
-- pertenece a la iglesia. Nada más.
--
-- LA RLS AÍSLA IGLESIAS; EL PERMISO LO PONE LA APLICACIÓN
-- ------------------------------------------------------
-- Las policies de aquí comprueban `pertenece_a_iglesia()` y punto, igual que el
-- resto del repo (ver `0001:330-339` y el comentario de la `0012:69`). Que solo
-- el pastor y el tesorero entren a finanzas lo decide `gestionar_finanzas` en
-- `src/lib/auth/permisos.ts`.
--
-- Escribir el modelo de permisos en SQL está descartado desde la `0001` y aquí
-- se respeta: el jsonb de excepciones se resolvería con una subconsulta en cada
-- fila leída, y el día que se añade un permiso hay que migrar policies.
--
-- `anon` NO RECIBE NADA
-- ---------------------
-- Ni una columna, ni una policy. Las finanzas no salen en `/i/[slug]`, ni en el
-- directorio, ni en el muro. Es la única tabla del proyecto donde la respuesta
-- a «¿y qué ve el visitante?» es «que no existe».
--
-- Y TAMPOCO `service_role`
-- ------------------------
-- Esto es nuevo respecto a las migraciones anteriores, que revocaban solo de
-- `anon, authenticated`. `service_role` conserva lo que Supabase concede por
-- defecto a lo que se crea, y es una puerta DISTINTA de `dbAdmin`: `dbAdmin`
-- conecta como `postgres` por `DATABASE_URL`, mientras que `service_role` entra
-- por PostgREST con una clave que viaja en variables de entorno. Ninguna
-- consulta de finanzas va por supabase-js, así que revocarlo no rompe nada y
-- cierra una puerta entera con una línea.
-- ===========================================================================

alter table public.fondos enable row level security;
alter table public.cajas enable row level security;
alter table public.movimientos enable row level security;

revoke all on public.fondos from anon, authenticated, service_role;
revoke all on public.cajas from anon, authenticated, service_role;
revoke all on public.movimientos from anon, authenticated, service_role;

grant select, insert, update, delete on public.fondos to hatril_app;
grant select, insert, update, delete on public.cajas to hatril_app;
grant select, insert, update, delete on public.movimientos to hatril_app;


-- ---------------------------------------------------------------------------
-- Policies
--
-- Una por tabla y por acción, todas `to hatril_app` EXPLÍCITO.
--
-- Lo de nombrar el rol no es estilo: la trampa que arregló la `0005` fue
-- justamente conceder dos policies «además» a `authenticated`, y como las
-- policies se suman con OR, cualquier sesión autenticada acabó leyendo filas
-- completas de toda iglesia publicada. Una policy sin `to` va a PUBLIC.
--
-- El `with check` repite la condición del `using` en los UPDATE para que la
-- fila no pueda salir de la iglesia por la puerta de atrás. Que además exista un
-- trigger que lo impide es a propósito: ver el guard más abajo.
-- ---------------------------------------------------------------------------

create policy fondos_select_iglesia on public.fondos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy fondos_insert_iglesia on public.fondos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy fondos_update_iglesia on public.fondos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy fondos_delete_iglesia on public.fondos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


create policy cajas_select_iglesia on public.cajas
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy cajas_insert_iglesia on public.cajas
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy cajas_update_iglesia on public.cajas
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy cajas_delete_iglesia on public.cajas
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


create policy movimientos_select_iglesia on public.movimientos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy movimientos_insert_iglesia on public.movimientos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy movimientos_update_iglesia on public.movimientos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy movimientos_delete_iglesia on public.movimientos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


-- ---------------------------------------------------------------------------
-- HT110 — el fondo, la caja y quien lo apunta son de esta iglesia
--
-- `iglesia_id` está repetido en `movimientos` a propósito (es la convención del
-- repo: cada policy es una comparación directa en vez de una subconsulta
-- encadenada). El precio de esa redundancia es que puede mentir, y esto es lo
-- que lo impide.
--
-- Sin este trigger, alguien de Betania podría apuntar un movimiento de Betania
-- contra un fondo de Sion: las policies dirían que sí, porque solo miran
-- `movimientos.iglesia_id`, y el saldo del fondo de la otra congregación
-- quedaría descuadrado sin que nadie de allí pudiera ver por qué.
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.fondos f
     where f.id = new.fondo_id
       and f.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT110: el fondo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.cajas c
     where c.id = new.caja_id
       and c.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT110: la caja no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  -- Uuid pelado sin FK (ver el comentario de la columna en `finanzas.ts`), así
  -- que la coherencia la comprueba esto o no la comprueba nadie.
  if new.registrado_por_miembro_id is not null and not exists (
    select 1 from public.miembros m
     where m.id = new.registrado_por_miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT110: quien registra el movimiento no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_movimiento()
  from public, anon, authenticated, service_role;

create trigger trg_movimientos_validar_iglesia
  before insert or update on public.movimientos
  for each row execute function public.validar_iglesia_movimiento();


-- ---------------------------------------------------------------------------
-- HT111 — un movimiento no cambia de iglesia
--
-- Esto NO lo cubre la policy de UPDATE, y el caso es real. `movimientos_update_iglesia`
-- evalúa el `using` sobre la iglesia de origen y el `with check` sobre la de
-- destino, y las dos condiciones son ciertas a la vez para alguien que pertenece
-- a las DOS congregaciones —`iglesia_usuarios` es único por `(iglesia_id,
-- auth_user_id)` (0000:21), así que una cuenta puede estar en varias: un pastor
-- que planta una segunda iglesia, alguien que se muda—.
--
-- No es una fuga hacia un extraño, porque quien lo haría ya ve las dos
-- iglesias. Es corromper el libro de una con los movimientos de la otra, que
-- para un registro contable es igual de malo y bastante más difícil de
-- detectar. Cuesta un trigger.
-- ---------------------------------------------------------------------------
create or replace function public.guard_movimientos()
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
    raise exception 'HT111: un movimiento no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_movimientos()
  from public, anon, authenticated, service_role;

create trigger trg_movimientos_guard
  before update on public.movimientos
  for each row execute function public.guard_movimientos();


-- Lo mismo para las dos tablas de configuración: mover un fondo o una caja de
-- iglesia dejaría movimientos apuntando a algo que ya no es suyo, y HT110 solo
-- mira el momento de escribir el movimiento, no el de mover el fondo.
create or replace function public.guard_fondos_cajas()
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
    raise exception 'HT111: no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_fondos_cajas()
  from public, anon, authenticated, service_role;

create trigger trg_fondos_guard
  before update on public.fondos
  for each row execute function public.guard_fondos_cajas();

create trigger trg_cajas_guard
  before update on public.cajas
  for each row execute function public.guard_fondos_cajas();


-- ---------------------------------------------------------------------------
-- `updated_at`
-- ---------------------------------------------------------------------------
create trigger trg_fondos_touch
  before update on public.fondos
  for each row execute function public.touch_updated_at();

create trigger trg_cajas_touch
  before update on public.cajas
  for each row execute function public.touch_updated_at();

create trigger trg_movimientos_touch
  before update on public.movimientos
  for each row execute function public.touch_updated_at();
