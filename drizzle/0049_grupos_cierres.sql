-- ===========================================================================
-- 0049 -- Grupos: lo que dejo abierto la 0047, cerrado
--
-- Seis hallazgos de la revision del 23-oct, comprobados en la base de verdad.
-- Ninguno era una fuga entre iglesias; todos eran huecos de la garantia que la
-- 0047 dice dar dentro de una.
--
-- 1. `solicitud_invitaciones` (0048), CERRADA AL PASTOR
-- -----------------------------------------------------
-- Es quien aprueba, y nadie mas necesita saber con que invitacion llego una
-- solicitud. SELECT y DELETE para `hatril_app` con `es_pastor()`; ni INSERT ni
-- UPDATE: la escribe `/solicitar` por `dbAdmin` y nadie la cambia. Revoke antes
-- de grant, como siempre (CLAUDE.md).
--
-- 2. `grupos` YA NO SE ABRE A CUALQUIERA DEL EQUIPO DE LA RED
-- -----------------------------------------------------------
-- La 0047 lo abria con `sirve_en_ministerio()`, y todo lider de celula esta en
-- el equipo (HT132): cada uno leia la zona, el dia y el codigo de todas las
-- celulas de su red. Con una sola red, que es lo normal, eso es «todas las
-- celulas de la iglesia, con su zona y su dia», justo lo que la cabecera de la
-- 0047 ponia como amenaza. Y uno podia darse ese acceso a si mismo: entrar en
-- un equipo como voluntario no pide permiso de nadie (0001, HT104). Ahora:
-- el pastor, quien LIDERA la red y quien esta en ese grupo.
--
-- 3. NO SE ENTRA EN UN GRUPO CERRADO (HT132)
-- ------------------------------------------
-- Con una ficha abierta en otra pestana se podia sumar gente a una celula ya
-- cerrada. Quedaba activa en un grupo que ninguna pantalla ensena, y para el
-- indice de «una celula por red» ya iba a otra: no se la podia sumar a ninguna.
-- `validar_grupo_miembro` exige ahora el grupo abierto al entrar o al volver a
-- activar una fila. Y `lleva_grupo()` tambien lo pide: cerrar un grupo tiene
-- que quitar la llave aunque quede alguna fila suelta.
--
-- 4. DAR DE BAJA O ARCHIVAR A ALGUIEN LE SACA DE SUS GRUPOS
-- --------------------------------------------------------
-- `darDeBaja` cierra sus equipos, pero no sabia nada de los grupos, y la
-- secretaria que da de baja no puede escribir en `grupo_miembros` (0047: el
-- pastor y quien lidera la red). Lo hace la base, en el mismo UPDATE: la fila
-- queda con su `hasta`, que es lo que /privacidad promete.
--
-- 5. ARCHIVAR UNA RED CIERRA SUS GRUPOS
-- -------------------------------------
-- `archivarMinisterio` cierra el equipo y dejaba vivas sus celulas y su gente,
-- sin nadie que pudiera cerrarlas. Mismo trato que una ficha de baja.
--
-- Las dos cascadas son triggers SECURITY DEFINER: escriben donde la sesion que
-- da de baja o archiva no puede. Cerradas como todas (0007). No llevan el atajo
-- de `_escritor_confiable()`: valen tambien para seeds y migraciones.
--
-- 6. LO QUE YA HUBIERA QUEDADO MAL, SE ARREGLA AL FINAL
-- -----------------------------------------------------
-- Filas activas de grupos cerrados, de fichas de baja o archivadas, y grupos
-- abiertos de redes archivadas. Hoy no hay ninguna; se escribe igual.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. `solicitud_invitaciones`
-- ---------------------------------------------------------------------------

alter table public.solicitud_invitaciones enable row level security;--> statement-breakpoint

revoke all on public.solicitud_invitaciones from anon, authenticated, service_role;--> statement-breakpoint

grant select, delete on public.solicitud_invitaciones to hatril_app;--> statement-breakpoint

drop policy if exists solicitud_invitaciones_select_pastor on public.solicitud_invitaciones;--> statement-breakpoint
create policy solicitud_invitaciones_select_pastor on public.solicitud_invitaciones
  for select to hatril_app
  using (public.es_pastor(iglesia_id));--> statement-breakpoint

drop policy if exists solicitud_invitaciones_delete_pastor on public.solicitud_invitaciones;--> statement-breakpoint
create policy solicitud_invitaciones_delete_pastor on public.solicitud_invitaciones
  for delete to hatril_app
  using (public.es_pastor(iglesia_id));--> statement-breakpoint


-- HT132: la solicitud y el grupo son de la misma iglesia que la fila. La
-- escribe `/solicitar` por `dbAdmin`, y por eso importa que lo diga la base: un
-- codigo de otra iglesia dejaria al aprobado dentro de una celula ajena.
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

create trigger trg_solicitud_invitaciones_validar
  before insert or update on public.solicitud_invitaciones
  for each row execute function public.validar_solicitud_invitacion();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 2. `grupos`, solo para quien lo lleva o va
-- ---------------------------------------------------------------------------

drop policy if exists grupos_select_relacion on public.grupos;--> statement-breakpoint
create policy grupos_select_relacion on public.grupos
  for select to hatril_app
  using (
    public.es_pastor(iglesia_id)
    or public.lidera_ministerio(ministerio_id)
    or public.esta_en_grupo(id)
  );--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 3. Grupo cerrado: ni se entra ni abre nada
-- ---------------------------------------------------------------------------

create or replace function public.lleva_grupo(p_grupo_id uuid)
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
      join public.ministerio_miembros mm
        on mm.ministerio_id = gm.ministerio_id
       and mm.miembro_id = gm.miembro_id
       and mm.activo = true
     where gm.grupo_id = p_grupo_id
       and gm.activo = true
       and gm.rol_grupo in ('lider', 'auxiliar')
       and iu.auth_user_id = (select auth.uid())
       and iu.estado = 'activo'
  );
$$;--> statement-breakpoint

-- `create or replace` conserva los privilegios, pero se escribe igual: el
-- fichero tiene que decir la verdad (0007).
revoke execute on function public.lleva_grupo(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.lleva_grupo(uuid) to hatril_app;--> statement-breakpoint


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

  if v_entra and not exists (
    select 1 from public.grupos g
     where g.id = new.grupo_id
       and g.activo = true
  ) then
    raise exception 'HT132: ese grupo esta cerrado'
      using errcode = 'check_violation';
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
-- 4. Una ficha de baja o archivada sale de sus grupos
--
-- `hasta`, el dia de hoy EN LA IGLESIA, como hace `hoyEnLaIglesia()`: con la
-- fecha del servidor, de noche en Bogota saldria manana.
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

create trigger trg_miembros_sacar_de_grupos
  after update of estado, archivado_at on public.miembros
  for each row execute function public.sacar_de_grupos_al_dar_de_baja();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 5. Una red archivada cierra sus grupos y saca a su gente
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_grupos_de_red_archivada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.activo and not new.activo then
    -- Primero la gente y despues los grupos: al reves, la fila del grupo ya
    -- cerrado no cambiaria nada, pero se lee mejor en el orden en que se
    -- desmonta.
    update public.grupo_miembros gm
       set activo = false,
           hasta = (now() at time zone i.timezone)::date
      from public.iglesias i
     where i.id = new.iglesia_id
       and gm.ministerio_id = new.id
       and gm.activo = true;

    update public.grupos
       set activo = false
     where ministerio_id = new.id
       and activo = true;
  end if;

  return null;
end;
$$;--> statement-breakpoint

revoke execute on function public.cerrar_grupos_de_red_archivada()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_ministerios_cerrar_grupos
  after update of activo on public.ministerios
  for each row execute function public.cerrar_grupos_de_red_archivada();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 6. Lo que ya hubiera quedado mal
-- ---------------------------------------------------------------------------

update public.grupo_miembros gm
   set activo = false,
       hasta = (now() at time zone i.timezone)::date
  from public.iglesias i
 where i.id = gm.iglesia_id
   and gm.activo = true
   and (
     exists (select 1 from public.grupos g where g.id = gm.grupo_id and not g.activo)
     or exists (select 1 from public.ministerios m where m.id = gm.ministerio_id and not m.activo)
     or exists (
       select 1 from public.miembros p
        where p.id = gm.miembro_id
          and (p.estado = 'baja' or p.archivado_at is not null)
     )
   );--> statement-breakpoint

update public.grupos g
   set activo = false
 where g.activo = true
   and exists (select 1 from public.ministerios m where m.id = g.ministerio_id and not m.activo);--> statement-breakpoint


comment on table public.solicitud_invitaciones is
  'La invitacion con la que llego una solicitud: grupo y codigo. Solo la lee y la borra el pastor (0049), y se borra al resolver la solicitud. La escribe /solicitar por dbAdmin.';
