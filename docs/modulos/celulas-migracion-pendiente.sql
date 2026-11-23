-- PENDIENTE DE NUMERAR (23-nov). No es una migración todavía: el migrador solo
-- lee las de drizzle/ con su entrada en el journal. Cuando la 0063 de otra
-- sesión esté en main, esto pasa a ser la migración siguiente, escrita a mano
-- (npm run db:generate -- --custom --name grupos_unirse_y_salir), DESPUÉS de la
-- que genere los dos valores nuevos de tipo_notificacion_enum.
--
-- ===========================================================================
-- NNNN -- Entrar en una célula desde dentro, y salir de ella
--
-- Lo que pidió Marlon el 23-nov: el líder de célula comparte el enlace de su
-- célula, y con eso la gente queda en ella. Hasta aquí el enlace solo servía a
-- quien todavía no era de la iglesia (`/solicitar`, `0048`); a quien ya lo era
-- se le decía «pídeselo a quien lleva la red». Y como desde el 23-nov quien
-- lleva la célula ve el teléfono de su gente, cada cual tiene que poder salir.
--
-- 1. POR QUÉ FUNCIONES Y NO POLICIES
-- ---------------------------------
-- `grupo_miembros` solo la escriben el pastor y quien lleva la red (`0047`).
-- Una policy de INSERT para «yo mismo» no puede ver el código del enlace —no
-- es una columna—, así que dejaría a cualquiera de la iglesia meterse en
-- cualquier célula sabiendo su uuid. La llave es el código, y solo una función
-- lo puede comprobar. `security definer`, revocada a todos y concedida solo a
-- `hatril_app` (CLAUDE.md).
--
-- 2. LAS MISMAS REGLAS QUE AL APROBAR (`meterEnElGrupo`)
-- ------------------------------------------------------
-- Grupo abierto con ese código, de una red activa, bloqueado `FOR SHARE OF g`:
-- un cierre o un cambio de enlace a la vez espera a que esto acabe, y después
-- saca también a quien acaba de entrar. La red no se bloquea aquí: archivar va
-- ministerios → equipo → grupos (`0051`), y bloquearla después del grupo podría
-- cruzarse con él. La ficha viva y la baja las cubre el trigger
-- (`validar_grupo_miembro`, su cerrojo consultivo). Quien ya va como
-- participante a otra célula de esa red no entra: una por red.
--
-- Que la herramienta esté encendida lo mira la aplicación antes
-- (`grupoDeLaInvitacion`): `modulos` se valida con Zod, y una copia en SQL
-- acabaría discrepando.
--
-- 3. QUIÉN, POR SU SESIÓN
-- -----------------------
-- `miembro_actual()` de la iglesia del grupo, nunca un argumento. Un código de
-- otra iglesia contesta lo mismo que uno inventado: no revela que existe.
--
-- 4. DEVUELVE UN MOTIVO, NO LANZA
-- -------------------------------
-- `dentro`, `ya_estaba`, `otra` (va a otra célula de la red) o `no_vale`. La
-- aplicación pone la frase.
--
-- 5. SALIR
-- --------
-- Solo de una célula a la que se va como participante: el líder y el auxiliar
-- los cambia la red, que si no la célula se quedaría sin nadie sin decidirlo.
-- Como `quitarIntegrante`: `activo = false` y su `hasta`, que es el historial.
-- ===========================================================================

create or replace function public.unirse_a_grupo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grupo public.grupos%rowtype;
  v_miembro uuid;
  v_tz text;
begin
  if p_codigo is null or p_codigo !~ '^[A-HJ-NP-Z2-9]{8}$' then
    return 'no_vale';
  end if;

  select g.* into v_grupo
    from public.grupos g
    join public.ministerios m on m.id = g.ministerio_id
   where g.codigo = p_codigo
     and g.activo
     and m.activo
     for share of g;

  if not found then
    return 'no_vale';
  end if;

  v_miembro := public.miembro_actual(v_grupo.iglesia_id);
  if v_miembro is null then
    return 'no_vale';
  end if;

  if exists (
    select 1 from public.grupo_miembros gm
     where gm.grupo_id = v_grupo.id
       and gm.miembro_id = v_miembro
       and gm.activo
  ) then
    return 'ya_estaba';
  end if;

  if exists (
    select 1 from public.grupo_miembros gm
     where gm.ministerio_id = v_grupo.ministerio_id
       and gm.miembro_id = v_miembro
       and gm.activo
       and gm.rol_grupo = 'participante'
  ) then
    return 'otra';
  end if;

  select i.timezone into v_tz from public.iglesias i where i.id = v_grupo.iglesia_id;

  begin
    insert into public.grupo_miembros (iglesia_id, ministerio_id, grupo_id, miembro_id, rol_grupo, desde)
    values (
      v_grupo.iglesia_id,
      v_grupo.ministerio_id,
      v_grupo.id,
      v_miembro,
      'participante',
      (now() at time zone coalesce(v_tz, 'UTC'))::date
    );
  exception
    -- Dos pestañas a la vez, o la red la sumó en el mismo momento.
    when unique_violation then
      return 'ya_estaba';
    -- HT132 del trigger: la ficha se dio de baja o el grupo se cerró mientras.
    when check_violation then
      if sqlerrm like 'HT132%' then
        return 'no_vale';
      end if;
      raise;
  end;

  return 'dentro';
end;
$$;--> statement-breakpoint

revoke execute on function public.unirse_a_grupo(text)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.unirse_a_grupo(text) to hatril_app;--> statement-breakpoint

create or replace function public.salir_de_grupo(p_grupo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_iglesia uuid;
  v_miembro uuid;
  v_tz text;
begin
  select g.iglesia_id into v_iglesia from public.grupos g where g.id = p_grupo_id;
  if v_iglesia is null then
    return false;
  end if;

  v_miembro := public.miembro_actual(v_iglesia);
  if v_miembro is null then
    return false;
  end if;

  select i.timezone into v_tz from public.iglesias i where i.id = v_iglesia;

  update public.grupo_miembros gm
     set activo = false,
         hasta = (now() at time zone coalesce(v_tz, 'UTC'))::date
   where gm.grupo_id = p_grupo_id
     and gm.miembro_id = v_miembro
     and gm.activo
     and gm.rol_grupo = 'participante';

  return found;
end;
$$;--> statement-breakpoint

revoke execute on function public.salir_de_grupo(uuid)
  from public, anon, authenticated, service_role;--> statement-breakpoint

grant execute on function public.salir_de_grupo(uuid) to hatril_app;
