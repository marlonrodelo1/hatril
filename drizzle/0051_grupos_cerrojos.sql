-- ===========================================================================
-- 0051 -- Grupos: los cerrojos de la 0050, sin interbloqueos
--
-- De una segunda verificacion adversarial, esta vez de la 0050. Tres cosas.
--
-- 1. EL FOR SHARE DE LA FICHA SE CRUZABA CON PASAR LISTA
-- ------------------------------------------------------
-- La 0050 bloqueaba la ficha `FOR SHARE` al entrar en un grupo, para que una
-- baja a la vez esperase. Pero `FOR SHARE` choca con CUALQUIER UPDATE de la
-- ficha, no solo con la baja: `refrescar_ultima_asistencia` (0030) actualiza
-- las fichas de la lista del domingo una a una, en el orden de su plan, y
-- `anadirIntegrantes` las bloqueaba en el suyo. Con dos personas y los dos
-- ordenes cruzados, 40P01 y una pagina de error en una de las dos. Antes de la
-- 0050 la entrada solo tomaba el `FOR KEY SHARE` de la FK, que no choca.
--
-- Ahora el cerrojo es de la baja y no de la fila: uno consultivo por ficha,
-- COMPARTIDO al entrar (dos entradas no se esperan) y EXCLUSIVO en el trigger
-- de la baja. Lo demas que se escriba en la ficha ni lo ve. Si la baja va
-- primero, la entrada espera y, con la instantanea nueva que toma cada
-- sentencia en READ COMMITTED, ya la ve de baja (HT132). Si va despues, espera
-- a que la entrada se confirme y su UPDATE ya ve la fila nueva y la saca.
--
-- Y la cabecera de la 0050 decia que la app no podia bloquear la ficha porque
-- `FOR SHARE` pasa por la policy de UPDATE de `miembros` y la colider de la red
-- no edita fichas. No es verdad: `miembros` tiene una sola policy, FOR ALL por
-- `pertenece_a_iglesia()`. El bloqueo sigue en la base porque vale para todos
-- los caminos, no por eso.
--
-- 2. BAJA Y RED ARCHIVADA, EN ORDEN CONTRARIO (desde la 0049)
-- -----------------------------------------------------------
-- `darDeBaja` sin gobernar los ministerios bloquea primero los equipos de la
-- persona (`planearMinisterios`, FOR UPDATE) y despues, por el trigger, sus
-- filas de grupo. `archivarMinisterio` hacia lo contrario: el trigger sacaba la
-- gente de los grupos y despues la action cerraba el equipo. Con alguien que
-- esta en el equipo de la red y lleva una celula, ciclo. Ahora los dos triggers
-- bloquean el equipo ANTES de tocar los grupos, y todos los caminos van en el
-- mismo orden: `ministerio_miembros`, despues `grupo_miembros`.
--
-- 3. CREAR UN GRUPO MIENTRAS SE ARCHIVA SU RED
-- --------------------------------------------
-- La 0050 cubria entrar en un grupo que ya existe. Uno que se esta creando no
-- lo ve el archivo, que no espera por filas sin confirmar: quedaba abierto, con
-- su lider dentro, en una red archivada. `validar_grupo` bloquea ahora la red
-- `FOR SHARE` y la exige activa al crear un grupo abierto o reabrirlo. El
-- archivo espera, y su trigger, con instantanea nueva, cierra tambien ese.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. La ficha: cerrojo consultivo, compartido al entrar
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
    -- El grupo, `FOR SHARE` (0050): un cierre o un archivo a la vez espera a
    -- que esta fila se confirme, y despues la saca.
    perform 1 from public.grupos g
     where g.id = new.grupo_id
       and g.activo = true
       for share;
    if not found then
      raise exception 'HT132: ese grupo esta cerrado'
        using errcode = 'check_violation';
    end if;

    -- La ficha, con el cerrojo de la baja y no con el de la fila: ver la
    -- cabecera. Compartido, y la comprobacion DESPUES de tenerlo, que es cuando
    -- su instantanea ya ve una baja confirmada mientras se esperaba.
    perform pg_advisory_xact_lock_shared(
      hashtextextended('grupos_ficha:' || new.miembro_id::text, 0)
    );
    if not exists (
      select 1 from public.miembros p
       where p.id = new.miembro_id
         and p.archivado_at is null
         and p.estado <> 'baja'
    ) then
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
-- 1 y 2. La baja: el cerrojo exclusivo, y el equipo antes que los grupos
-- ---------------------------------------------------------------------------

create or replace function public.sacar_de_grupos_al_dar_de_baja()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.estado = 'baja' and old.estado is distinct from 'baja')
     or (new.archivado_at is not null and old.archivado_at is null) then
    -- Exclusivo contra el compartido de la entrada: espera a quien esta
    -- entrando, y el UPDATE de abajo, con instantanea nueva, le saca tambien.
    perform pg_advisory_xact_lock(
      hashtextextended('grupos_ficha:' || new.id::text, 0)
    );

    -- Sus equipos antes que sus grupos, el orden de todos los caminos (ver la
    -- cabecera). `darDeBaja` los cierra despues; aqui solo se bloquean.
    perform 1 from public.ministerio_miembros mm
     where mm.miembro_id = new.id
       and mm.activo = true
       for update;

    update public.grupo_miembros gm
       set activo = false,
           hasta = (now() at time zone i.timezone)::date
      from public.iglesias i
     where i.id = new.iglesia_id
       and gm.miembro_id = new.id
       and gm.activo = true;
  end if;

  return null;
end;
$$;--> statement-breakpoint

revoke execute on function public.sacar_de_grupos_al_dar_de_baja()
  from public, anon, authenticated, service_role;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 2. La red archivada: el equipo, despues los grupos, despues la gente
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_grupos_de_red_archivada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.activo and not new.activo then
    -- El equipo primero, aunque lo cierre `archivarMinisterio` despues: es el
    -- orden de la baja, y al reves se cruzaban (ver la cabecera).
    perform 1 from public.ministerio_miembros mm
     where mm.ministerio_id = new.id
       and mm.activo = true
       for update;

    -- Los grupos antes que la gente (0050): este UPDATE espera a quien esta
    -- entrando, y el de `grupo_miembros`, con instantanea nueva, le saca.
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
-- 3. Un grupo abierto solo en una red activa
-- ---------------------------------------------------------------------------

create or replace function public.validar_grupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_firma boolean;
  v_abre boolean;
begin
  if not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_firma := true;
    v_abre := new.activo;
  else
    v_firma := new.creado_por_miembro_id is distinct from old.creado_por_miembro_id;
    v_abre := new.activo and not old.activo;
  end if;

  if v_firma and new.creado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.creado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT132: quien crea el grupo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  -- `FOR SHARE` contra el UPDATE de `archivarMinisterio`: si archiva a la vez,
  -- espera a este grupo y su trigger lo cierra; si archivo primero, al soltarse
  -- la red ya no esta activa y esto no encuentra nada.
  if v_abre then
    perform 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.activo = true
       for share;
    if not found then
      raise exception 'HT132: esa red esta archivada'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_grupo()
  from public, anon, authenticated, service_role;
