-- ===========================================================================
-- 0021 — La suscripción solo la escribe Stripe
--
-- EL AGUJERO QUE CIERRA
-- ---------------------
-- La `0001` concede `select, insert, update, delete` sobre `public.iglesias`
-- ENTERA a `hatril_app` (0001:212-220), e `iglesias_update_pastor` (0001:288)
-- deja al pastor actualizar su propia fila. Los GRANT de este repo son por
-- columna en otros sitios, pero aquí no hay recorte: `plan`, `trial_until`,
-- `stripe_customer_id` y `stripe_subscription_id` son escribibles desde
-- `withUser()`.
--
-- Hoy ninguna ruta lo hace: `guardarDatosIglesia` arma un `set` explícito con
-- los campos del formulario. Pero la regla de este proyecto es que lo garantiza
-- la base de datos, no la aplicación — y el día que exista el muro de
-- suscripción, esto es el bypass: una server action de más, o un `set` armado
-- con un spread, y el pastor se pone `plan = 'plus'` sin pagar.
--
-- No es un agujero de aislamiento entre iglesias —solo puede tocar la suya— y
-- por eso lleva un código de error propio y no HT101. Es un agujero de
-- facturación.
--
-- POR QUÉ UN TRIGGER Y NO REVOCAR EL GRANT
-- ----------------------------------------
-- `revoke update (plan, trial_until, …) on iglesias from hatril_app` sería más
-- directo. Se descarta porque en Postgres los permisos de columna y las policies
-- de RLS se evalúan por separado, y un `revoke` de columna deja el `UPDATE`
-- fallando con «permission denied for table iglesias» — el MISMO mensaje que
-- produce cambiar mal el rol de `withUser()`, que ya costó días de depuración
-- una vez (ver ESTADO.md). Un trigger con código propio dice qué pasó.
-- ===========================================================================

create or replace function public.guard_facturacion_iglesia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- `_escritor_confiable()` (0001:141) es true cuando NO hay `request.jwt.claims`,
  -- que es exactamente el caso de `dbAdmin`: el webhook de Stripe pasa, y
  -- `withUser()` —que sí fija los claims— no.
  if public._escritor_confiable() then
    return new;
  end if;

  if new.plan                   is distinct from old.plan
     or new.trial_until            is distinct from old.trial_until
     or new.stripe_customer_id     is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'HT112: la suscripcion solo la escribe Stripe'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Una función NO nace cerrada, pese a lo que llegó a decir este repo. Ver la
-- `0007` y el apartado de funciones de CLAUDE.md.
revoke execute on function public.guard_facturacion_iglesia()
  from public, anon, authenticated, service_role;

create trigger trg_iglesias_guard_facturacion
  before update on public.iglesias
  for each row execute function public.guard_facturacion_iglesia();


-- ---------------------------------------------------------------------------
-- Un cliente de Stripe pertenece a UNA iglesia
--
-- `idx_iglesias_stripe_customer` (0000) no es único. El webhook resuelve la
-- iglesia por `stripe_customer_id` cuando el evento no trae metadata, y si dos
-- filas compartieran ese valor la suscripción de una se aplicaría a la otra:
-- una iglesia pagando por la de al lado, en silencio.
--
-- Parcial sobre `not null` porque la inmensa mayoría de filas lo tienen a null
-- —toda iglesia que aún no ha pasado por Checkout— y `null` no colisiona consigo
-- mismo en un índice único, pero indexarlos es tamaño que no se usa nunca.
-- ---------------------------------------------------------------------------
drop index if exists public.idx_iglesias_stripe_customer;

create unique index idx_iglesias_stripe_customer
  on public.iglesias (stripe_customer_id)
  where stripe_customer_id is not null;


-- `trial_until` gana un segundo significado con el muro: no es solo «hasta
-- cuándo dura la prueba», es «hasta cuándo hay acceso». Lo usan los estados
-- `solo_lectura` y `bloqueada`, y también lo escribe el webhook al vencer una
-- suscripción. Renombrarla a `acceso_hasta` sería lo honesto, pero toca cinco
-- ficheros a cambio de cero comportamiento: se documenta y se deja.
comment on column public.iglesias.trial_until is
  'Hasta cuando esta iglesia tiene acceso. En plan trial es el fin de la prueba; con una suscripcion vencida o cancelada, el fin del periodo pagado. De aqui salen los 3 dias de gracia de lectura.';
