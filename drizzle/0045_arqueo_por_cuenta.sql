-- ===========================================================================
-- 0045 -- El arqueo, por cuenta y no solo por ficha
--
-- Lo encontró la revisión de la 0044. HT130 decide quién es quién con
-- `miembro_actual()`, que es `iglesia_usuarios.miembro_id` de la sesión. Y esa
-- columna la podía cambiar el pastor en su PROPIA fila: la policy
-- `iglesia_usuarios_update_pastor` se lo deja, `hatril_app` tiene UPDATE, no
-- hay FK a `miembros`, y HT101 solo miraba rol, estado y permisos. Así que el
-- pastor contaba con su ficha, se ponía la de la secretaria, confirmaba —y el
-- arqueo quedaba confirmado «por ella», con los ingresos a su nombre— y volvía a
-- la suya. Ningún camino de la aplicación lo hace; la base tiene que impedirlo
-- igual, o el control de dos personas es decorativo para el pastor.
--
-- Dos llaves:
--
-- 1. HT101 AMPLIADO. Nadie cambia su propia ficha desde una sesión, como no
--    cambia su propio rol. Enlazar la ficha al aprobar una solicitud toca la
--    fila de OTRA persona (`aprobarSolicitud`), y sigue funcionando.
--
-- 2. HT131. El arqueo guarda también la CUENTA (`auth.uid()`) de quien cuenta
--    y la de quien confirma, las pone la base y no se reescriben, y la misma
--    cuenta no confirma lo que contó. Así la segregación ya no depende de una
--    columna que se puede reapuntar: aunque HT101 se aflojara algún día, el
--    pastor seguiría siendo él. `ck_arqueos_dos_cuentas` lo repite sin atajo.
--
-- Las columnas son nulas en lo que escribe un proceso sin sesión y en el
-- arqueo de la demo anterior a esta migración; no se rellenan adivinando la
-- cuenta por la ficha, que es justo lo que se podía falsear.
-- ===========================================================================

ALTER TABLE "arqueos" ADD COLUMN "contado_por_auth_id" uuid;--> statement-breakpoint
ALTER TABLE "arqueos" ADD COLUMN "confirmado_por_auth_id" uuid;--> statement-breakpoint
ALTER TABLE "arqueos" ADD CONSTRAINT "ck_arqueos_dos_cuentas" CHECK ("arqueos"."confirmado_por_auth_id" <> "arqueos"."contado_por_auth_id");--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT101 -- tampoco la ficha propia
--
-- La misma función de la 0001, con `miembro_id` en la lista. CON el atajo de
-- `_escritor_confiable()`, como siempre: el alta de iglesia y el super admin
-- enlazan fichas sin sesión.
-- ---------------------------------------------------------------------------

create or replace function public.guard_iglesia_usuarios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if new.auth_user_id = (select auth.uid())
     and (new.rol is distinct from old.rol
          or new.estado is distinct from old.estado
          or new.permisos is distinct from old.permisos
          or new.miembro_id is distinct from old.miembro_id) then
    raise exception
      'HT101: no puedes cambiar tu propio rol, estado, permisos ni ficha'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

-- `create or replace` conserva los permisos que tenía, y la 0003 la cerró una
-- a una. Se repite igual: la migración tiene que decir la verdad sola.
revoke execute on function public.guard_iglesia_usuarios()
  from public, anon, authenticated, service_role;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT131 -- la cuenta que cuenta no es la que confirma
--
-- Corre detrás de HT130 (`trg_arqueos_guard` < `trg_arqueos_guard_cuentas`):
-- aquel ya exige fichas distintas y de la sesión; esto, cuentas distintas.
-- CON el atajo de `_escritor_confiable()`, como HT130.
-- ---------------------------------------------------------------------------

create or replace function public.guard_arqueos_cuentas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := (select auth.uid());
begin
  if public._escritor_confiable() then
    return new;
  end if;

  -- Las pone la base, diga lo que diga el INSERT.
  if tg_op = 'INSERT' then
    new.contado_por_auth_id := yo;
    new.confirmado_por_auth_id := null;
    return new;
  end if;

  if new.contado_por_auth_id is distinct from old.contado_por_auth_id then
    raise exception 'HT131: la cuenta que conto no se reescribe'
      using errcode = 'insufficient_privilege';
  end if;

  -- Confirmar: ni la misma cuenta, ni una sesion sin cuenta.
  if old.confirmado_at is null and new.confirmado_por_miembro_id is not null then
    if yo is null or yo is not distinct from old.contado_por_auth_id then
      raise exception 'HT131: la misma cuenta que conto no puede confirmar'
        using errcode = 'insufficient_privilege';
    end if;
    new.confirmado_por_auth_id := yo;
    return new;
  end if;

  if new.confirmado_por_auth_id is distinct from old.confirmado_por_auth_id then
    raise exception 'HT131: la cuenta que confirmo no se reescribe'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_arqueos_cuentas()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_arqueos_guard_cuentas
  before insert or update on public.arqueos
  for each row execute function public.guard_arqueos_cuentas();
