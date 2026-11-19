-- ===========================================================================
-- 0058 -- Los teléfonos que reciben push: RLS, permisos y la única puerta
--
-- 1. CADA CUENTA VE LOS SUYOS Y NADA MÁS
-- --------------------------------------
-- Un token de FCM es la dirección de un teléfono: quien lo tenga puede
-- mandarle avisos a nombre de Hatril, con la clave de servidor, o pedir que le
-- lleguen a él los de otra persona. `hatril_app` solo ve y borra los de la
-- cuenta de la sesión (borrar es lo que hace «Salir» con el de ese teléfono).
-- `anon`, `authenticated` y `service_role`, nada: `revoke all` antes de
-- cualquier `grant` (CLAUDE.md, la 0012 y la 0022).
--
-- 2. ESCRIBIR, SOLO POR `registrar_dispositivo_push()`
-- ----------------------------------------------------
-- Sin grant de INSERT ni de UPDATE. El token es único y tiene que poder
-- cambiar de cuenta cuando en un teléfono entra otra persona; con un INSERT
-- ... ON CONFLICT normal, la RLS lo impediría, porque la fila vieja no es de
-- quien registra. La función lo hace en un paso, con la cuenta sacada de
-- `auth.uid()` y nunca de un parámetro, de modo que nadie puede apuntar un
-- teléfono a nombre de otro.
--
-- Lo que sí permite: quien conozca el token de otro teléfono puede quedárselo.
-- Los avisos de quien lo hace irían a ese teléfono, y su dueño dejaría de
-- recibir los suyos. Para eso hay que tener el token, que solo existe dentro
-- del teléfono y en esta tabla.
--
-- 3. LA CUENTA SE BORRA, SUS TELÉFONOS TAMBIÉN
-- --------------------------------------------
-- Clave foránea a `auth.users` con cascada, que el schema de Drizzle no puede
-- declarar (no conoce el esquema `auth`). Además, `lib/cuenta/baja.ts` los
-- borra al pedir la baja: la cuenta desactivada no debe seguir sonando en un
-- bolsillo durante los treinta días de espera.
-- ===========================================================================

alter table public.dispositivos_push
  add constraint dispositivos_push_auth_user_fk
  foreign key (auth_user_id) references auth.users (id) on delete cascade;

alter table public.dispositivos_push enable row level security;

revoke all on public.dispositivos_push from anon, authenticated, service_role;

grant select, delete on public.dispositivos_push to hatril_app;

create policy dispositivos_push_select_propios
  on public.dispositivos_push
  for select to hatril_app
  using (auth_user_id = (select auth.uid()));

create policy dispositivos_push_delete_propios
  on public.dispositivos_push
  for delete to hatril_app
  using (auth_user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- registrar_dispositivo_push(token, plataforma)
--
-- Si el token ya era de esta cuenta, solo se apunta que sigue vivo. Si era de
-- otra, pasa a esta. Y una cuenta no guarda más de 20 teléfonos: los que
-- llevan más tiempo sin dar señales se caen solos, para que la tabla no crezca
-- sin techo por la puerta de registrar.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_dispositivo_push(
  p_token text,
  p_plataforma text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cuenta uuid := (select auth.uid());
begin
  if v_cuenta is null then
    raise exception 'HT141: registrar un teléfono pide sesión'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.dispositivos_push as d (token, auth_user_id, plataforma)
  values (p_token, v_cuenta, p_plataforma)
  on conflict (token) do update
    set auth_user_id = excluded.auth_user_id,
        plataforma   = excluded.plataforma,
        visto_at     = now(),
        created_at   = case
                         when d.auth_user_id = excluded.auth_user_id then d.created_at
                         else now()
                       end;

  delete from public.dispositivos_push
   where auth_user_id = v_cuenta
     and token in (
       select token from public.dispositivos_push
        where auth_user_id = v_cuenta
        order by visto_at desc
        offset 20
     );
end;
$$;

revoke execute on function public.registrar_dispositivo_push(text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.registrar_dispositivo_push(text, text) to hatril_app;
