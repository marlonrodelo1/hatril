-- ===========================================================================
-- 0056 -- Diezmos y ofrendas: quién lee qué
--
-- Las cuatro tablas de la 0055 (`cuentas_stripe`, `donativos`,
-- `donativo_lineas`, `donativos_mensuales`) con su RLS, y la coherencia de
-- iglesia de las líneas.
--
-- 1. NADIE ESCRIBE CON `withUser`
-- -------------------------------
-- `hatril_app` solo recibe `select`. Las filas las crea el servidor con
-- `dbAdmin` al abrir el pago en Stripe, y las cambia el webhook firmado de
-- Stripe al confirmarlo. Un POST fabricado con la sesión de un miembro no puede
-- marcar un donativo como pagado ni inventarse uno, porque su rol no tiene
-- permiso de escritura en ninguna de las cuatro.
--
-- 2. QUIÉN DA NO ES ASUNTO DE TODA LA IGLESIA
-- -------------------------------------------
-- Casi toda la RLS de Hatril es por iglesia y deja la puerta a la aplicación
-- (CLAUDE.md). Aquí no basta: que alguien dé a una iglesia dice que pertenece
-- a ella (art. 9 RGPD), y la caja ya se diseñó para no decir quién dio qué
-- (`movimientos` no lleva donante). `ve_donantes()` deja leer solo al pastor y
-- al rol tesorero, y cada persona lee sus propias filas por
-- `donante_auth_user_id`. Si un día falta una guarda en una página, un miembro
-- raso sigue sin ver los donativos de nadie más.
--
-- `ve_donantes()` mira el ROL, no el permiso `gestionar_finanzas`: ese permiso
-- se resuelve en la aplicación con las excepciones de `iglesia_usuarios.permisos`
-- y no tiene espejo en SQL. Quien lleve la caja sin ser tesorero ve los
-- ingresos en Movimientos, sin nombre, como siempre.
--
-- `cuentas_stripe` es solo el estado de la conexión, sin datos de nadie: la lee
-- quien pertenece a la iglesia.
--
-- 3. LA LÍNEA, EL DONATIVO Y EL FONDO SON DE LA MISMA IGLESIA (HT140)
-- ------------------------------------------------------------------
-- Lo escribe solo el servidor, pero la regla del repo es que la coherencia la
-- garantiza la base. Sin esto, un fallo del código podría apuntar una línea de
-- Sion contra un fondo de Betania, y el webhook crearía el ingreso en la caja
-- equivocada.
--
-- Todo con `revoke` delante de cada `grant`, aunque la 0022 ya invirtiera el
-- defecto: el fichero tiene que decir la verdad en cualquier otra base.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Cerrar las cuatro tablas
-- ---------------------------------------------------------------------------
revoke all on public.cuentas_stripe from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.donativos from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.donativo_lineas from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.donativos_mensuales from anon, authenticated, service_role;--> statement-breakpoint

alter table public.cuentas_stripe enable row level security;--> statement-breakpoint
alter table public.donativos enable row level security;--> statement-breakpoint
alter table public.donativo_lineas enable row level security;--> statement-breakpoint
alter table public.donativos_mensuales enable row level security;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `ve_donantes()`: el pastor y el rol tesorero de esta iglesia
-- ---------------------------------------------------------------------------
create or replace function public.ve_donantes(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.iglesia_usuarios
     where iglesia_id = p_iglesia_id
       and auth_user_id = (select auth.uid())
       and estado = 'activo'
       and rol in ('pastor', 'tesorero')
  );
$$;--> statement-breakpoint

revoke execute on function public.ve_donantes(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint
grant execute on function public.ve_donantes(uuid) to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Solo lectura para `hatril_app`
-- ---------------------------------------------------------------------------
grant select on public.cuentas_stripe to hatril_app;--> statement-breakpoint
grant select on public.donativos to hatril_app;--> statement-breakpoint
grant select on public.donativo_lineas to hatril_app;--> statement-breakpoint
grant select on public.donativos_mensuales to hatril_app;--> statement-breakpoint

create policy cuentas_stripe_select_iglesia on public.cuentas_stripe
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

create policy donativos_select on public.donativos
  for select to hatril_app
  using (
    public.ve_donantes(iglesia_id)
    or donante_auth_user_id = (select auth.uid())
  );--> statement-breakpoint

create policy donativos_mensuales_select on public.donativos_mensuales
  for select to hatril_app
  using (
    public.ve_donantes(iglesia_id)
    or donante_auth_user_id = (select auth.uid())
  );--> statement-breakpoint

-- La subconsulta pasa por la RLS de `donativos`, que ya es la misma regla.
create policy donativo_lineas_select on public.donativo_lineas
  for select to hatril_app
  using (
    public.ve_donantes(iglesia_id)
    or exists (
      select 1 from public.donativos d
       where d.id = donativo_id
         and d.donante_auth_user_id = (select auth.uid())
    )
  );--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT140: la línea, su donativo y su fondo son de la misma iglesia; y el
-- donativo, de la misma que su donativo mensual
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_donativo_linea()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.donativos d
     where d.id = new.donativo_id
       and d.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT140: el donativo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.fondos f
     where f.id = new.fondo_id
       and f.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT140: el fondo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_donativo_linea()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_donativo_lineas_validar_iglesia
  before insert or update on public.donativo_lineas
  for each row execute function public.validar_iglesia_donativo_linea();--> statement-breakpoint

create or replace function public.validar_iglesia_donativo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.donativo_mensual_id is not null and not exists (
    select 1 from public.donativos_mensuales m
     where m.id = new.donativo_mensual_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT140: el donativo mensual no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.iglesia_id <> old.iglesia_id then
    raise exception 'HT140: un donativo no puede cambiar de iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_donativo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_donativos_validar_iglesia
  before insert or update on public.donativos
  for each row execute function public.validar_iglesia_donativo();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `updated_at`
-- ---------------------------------------------------------------------------
create trigger trg_cuentas_stripe_touch
  before update on public.cuentas_stripe
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_donativos_touch
  before update on public.donativos
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_donativos_mensuales_touch
  before update on public.donativos_mensuales
  for each row execute function public.touch_updated_at();
