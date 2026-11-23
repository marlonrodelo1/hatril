-- ===========================================================================
-- 0050 -- Grupos: las tres carreras que dejaba la 0049
--
-- De la verificacion adversarial de los arreglos del 23-oct. Las tres son de
-- milisegundos y ninguna sale de la iglesia, pero las tres dejan justo lo que
-- la 0049 promete que no queda: una fila activa en un grupo cerrado, o en la
-- ficha de alguien que ya se fue, o una invitacion colgada de una solicitud
-- resuelta. Todo en READ COMMITTED, que es lo que usa `withUser` y `dbAdmin`.
--
-- 1. ARCHIVAR LA RED MIENTRAS ALGUIEN ENTRA
-- -----------------------------------------
-- `cerrar_grupos_de_red_archivada` sacaba primero a la gente y despues cerraba
-- los grupos, y su comentario decia que el orden daba igual. No da igual: la
-- primera sentencia toma su instantanea sin la fila que otra transaccion esta
-- metiendo (una aprobacion, `anadirIntegrantes`), la segunda espera a su
-- `FOR SHARE` sobre el grupo, y al soltarse cierra el grupo con esa persona
-- dentro. Al reves, como `cerrarGrupo`: primero el grupo, que espera; despues
-- la gente, con una instantanea nueva que ya la incluye.
--
-- 2. DAR DE BAJA MIENTRAS LA RED SUMA A ESA PERSONA
-- -------------------------------------------------
-- El trigger de la baja tampoco ve una insercion sin confirmar, y nada
-- bloqueaba la ficha. La app no puede: `FOR SHARE` desde `withUser` pasa por
-- la policy de UPDATE de `miembros`, y la colider de la red no edita fichas.
-- Lo hace `validar_grupo_miembro`, que corre como su dueno: al ENTRAR, la ficha
-- viva y bloqueada para compartir. Si la baja va primero, al soltarse ya no es
-- viva y la entrada falla (HT132); si va despues, espera y su trigger saca
-- tambien a quien acaba de entrar.
--
-- Y por lo mismo, el grupo: tambien bloqueado al entrar, para que valga en
-- cualquier camino y no solo en los que llaman a `bloquearAbierto`.
--
-- 3. SUMAR LA INVITACION MIENTRAS SE RESUELVE LA SOLICITUD
-- --------------------------------------------------------
-- `sumarInvitacionASolicitud` mira que la solicitud siga pendiente y despues
-- inserta. Entre las dos, el pastor podia aprobarla o rechazarla, y la
-- invitacion quedaba sobre una solicitud resuelta, contra lo que dice
-- /privacidad («se borra al resolver tu solicitud»). Aprobar y rechazar ya
-- bloquean la solicitud `FOR UPDATE`; basta con que el trigger de la
-- invitacion la bloquee `FOR SHARE` y la exija pendiente.
--
-- Ademas, `esta_en_grupo()` pide el grupo abierto, como `lleva_grupo()` desde
-- la 0049, y el comentario de `grupos` deja de contar la RLS de la 0047.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. La red archivada: primero los grupos
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_grupos_de_red_archivada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.activo and not new.activo then
    -- Primero los grupos y despues la gente, como `cerrarGrupo`: el UPDATE de
    -- `grupos` espera a quien esta entrando (su `FOR SHARE`), y el de
    -- `grupo_miembros`, con una instantanea tomada despues, le saca tambien.
    update public.grupos
       set activo = false
     where ministerio_id = new.id
       and activo = true;

    update public.grupo_miembros gm
       set activo = false,
           hasta = (now() at time zone i.timezone)::date
      from public.iglesias i
     where i.id = new.iglesia_id
       and gm.ministerio_id = new.id
       and gm.activo = true;
  end if;

  return null;
end;
$$;--> statement-breakpoint

revoke execute on function public.cerrar_grupos_de_red_archivada()
  from public, anon, authenticated, service_role;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 2. Al entrar en un grupo: el grupo abierto y la ficha viva, bloqueados
-- ---------------------------------------------------------------------------

create or replace function public.validar_grupo_miembro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_persona boolean;
  v_entra boolean;
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

  -- Entrar: una fila nueva activa, o una que vuelve a activarse. Salir de un
  -- grupo cerrado sigue valiendo: es lo que hace cerrarlo.
  if tg_op = 'INSERT' then
    v_entra := new.activo;
  else
    v_entra := new.activo and (not old.activo or new.grupo_id is distinct from old.grupo_id);
  end if;

  if v_entra then
    -- `FOR SHARE`: un cierre o un archivo a la vez espera a que esta fila se
    -- confirme, y despues la saca. Si va primero, al soltarse el grupo ya no
    -- esta abierto y esto no encuentra nada.
    perform 1 from public.grupos g
     where g.id = new.grupo_id
       and g.activo = true
       for share;
    if not found then
      raise exception 'HT132: ese grupo esta cerrado'
        using errcode = 'check_violation';
    end if;

    -- Lo mismo con la ficha y la baja (`sacar_de_grupos_al_dar_de_baja`).
    perform 1 from public.miembros p
     where p.id = new.miembro_id
       and p.archivado_at is null
       and p.estado <> 'baja'
       for share;
    if not found then
      raise exception 'HT132: esa persona ya no esta en la congregacion'
        using errcode = 'check_violation';
    end if;
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


-- ---------------------------------------------------------------------------
-- 3. La invitacion, solo sobre una solicitud pendiente
-- ---------------------------------------------------------------------------

create or replace function public.validar_solicitud_invitacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.solicitudes_ingreso s
     where s.id = new.solicitud_id
       and s.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: la solicitud no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  -- `FOR SHARE` contra el `FOR UPDATE` de aprobar y rechazar: si van primero,
  -- al soltarse ya no esta pendiente y esto no encuentra nada.
  perform 1 from public.solicitudes_ingreso s
   where s.id = new.solicitud_id
     and s.estado = 'pendiente'
     for share;
  if not found then
    raise exception 'HT132: la solicitud ya esta resuelta'
      using errcode = 'check_violation';
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

revoke execute on function public.validar_solicitud_invitacion()
  from public, anon, authenticated, service_role;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 4. `esta_en_grupo()`, con el grupo abierto
-- ---------------------------------------------------------------------------

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
      join public.grupos g
        on g.id = gm.grupo_id
       and g.activo = true
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


comment on table public.grupos is
  'Grupos pequenos de un ministerio: celulas de una red, clases. Sin direccion, solo zona, dia y hora. RLS por relacion: es_pastor OR lidera_ministerio OR esta_en_grupo (0049). Cerrado, ni se entra ni abre nada (0049, 0050).';
