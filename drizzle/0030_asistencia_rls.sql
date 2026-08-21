-- ===========================================================================
-- 0030 — Asistencia: RLS, coherencia y la columna que llevaba un año muerta
--
-- Dos tablas, `reuniones` y `asistencias`, y el dato más sensible que esta
-- plataforma va a guardar nunca.
--
-- POR QUE ESTO ES DISTINTO DE TODO LO ANTERIOR
-- --------------------------------------------
-- Que Fulana estuvo en el culto del domingo 24 revela su practica religiosa con
-- fecha y hora. Es el art. 9 del RGPD en su forma mas pura: no es un dato del
-- que se infiera la religion, ES la religion, nominal y semanal. La pertenencia
-- a la congregacion ya estaba en `miembros`, pero una ficha dice «es de esta
-- iglesia» una vez; esto dice donde estuvo cada domingo del año.
--
-- De ahi salen las tres decisiones de abajo, y ninguna es cosmetica.
--
-- 1. NI UNA COLUMNA PARA `anon`, Y TAMPOCO PARA `service_role`
-- ------------------------------------------------------------
-- Ninguna de las dos tablas sale a la web publica: `/i/[slug]` no lista quien
-- vino a nada, y no hay pantalla publica que lo pida. El `revoke` de abajo es
-- redundante EN ESTA BASE desde que la 0022 invirtio el defecto, y se escribe
-- igual, porque el fichero tiene que decir la verdad en cualquier otra.
--
-- Para `service_role` no es redundante ni sobre el papel: tiene BYPASSRLS y
-- ninguna policy lo detiene, solo el grant. Sin el,
-- `GET /rest/v1/asistencias?select=*` con la clave de servicio devolveria el
-- mapa de asistencia de TODAS las iglesias de la plataforma. Esa clave es la que
-- ESTADO.md lleva desde el 16-ago pidiendo rotar porque se pego en un chat.
--
-- 2. `asistencias` NO LLEVA TRIGGER `auditar()`
-- ----------------------------------------------
-- Y no es un olvido. `auditar()` copia la fila entera con `to_jsonb(new)` a
-- `public.auditoria`, donde `hatril_app` tiene `grant select` DE TABLA ENTERA
-- (0001:226) y la policy `auditoria_select_pastor` (0001:439) no filtra por
-- entidad. Auditar esta tabla dejaria el mapa completo de quien va a la iglesia
-- reconstruible por una segunda puerta, sin tocar `asistencias` y sin dejar
-- rastro — exactamente el problema por el que el diezmo nominativo sigue
-- esperando, escrito en ESTADO.md.
--
-- `reuniones` SI lleva auditoria: una reunion es un hecho de la congregacion
-- («hubo culto el domingo 24»), no de una persona, y saber quien borro una
-- reunion entera con las listas colgando de ella si importa.
--
-- 3. LA RLS AISLA IGLESIAS; EL PERMISO LO PONE LA APLICACION
-- -----------------------------------------------------------
-- Las policies comprueban `pertenece_a_iglesia()` y punto, igual que el resto
-- del repo. Que solo entren el pastor y quien tenga el permiso lo decide
-- `src/lib/auth/permisos.ts`. Es la frontera que la 0001:330 declaro: la de
-- tenant va en SQL, el reparto interno en TypeScript, y no se escribe dos veces.
--
-- ---------------------------------------------------------------------------
-- ===========================================================================

alter table public.reuniones   enable row level security;--> statement-breakpoint
alter table public.asistencias enable row level security;--> statement-breakpoint

-- Revocar SIEMPRE antes de conceder. Un `grant select (columnas)` no recorta
-- nada si debajo sigue el grant de tabla entera: es la fuga de `devocionales`
-- que la 0022 tuvo que cerrar meses despues.
revoke all on public.reuniones   from anon, authenticated, service_role;--> statement-breakpoint
revoke all on public.asistencias from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.reuniones   to hatril_app;--> statement-breakpoint
grant select, insert, update, delete on public.asistencias to hatril_app;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Policies
--
-- `to hatril_app` explicito en las ocho. Las policies se suman con OR, y dos
-- que se escribieron para el visitante y se concedieron ademas a `hatril_app`
-- fueron la fuga que cerro la 0005.
-- ---------------------------------------------------------------------------

drop policy if exists reuniones_select_iglesia on public.reuniones;--> statement-breakpoint
create policy reuniones_select_iglesia on public.reuniones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists reuniones_insert_iglesia on public.reuniones;--> statement-breakpoint
create policy reuniones_insert_iglesia on public.reuniones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists reuniones_update_iglesia on public.reuniones;--> statement-breakpoint
create policy reuniones_update_iglesia on public.reuniones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists reuniones_delete_iglesia on public.reuniones;--> statement-breakpoint
create policy reuniones_delete_iglesia on public.reuniones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


drop policy if exists asistencias_select_iglesia on public.asistencias;--> statement-breakpoint
create policy asistencias_select_iglesia on public.asistencias
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asistencias_insert_iglesia on public.asistencias;--> statement-breakpoint
create policy asistencias_insert_iglesia on public.asistencias
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asistencias_update_iglesia on public.asistencias;--> statement-breakpoint
create policy asistencias_update_iglesia on public.asistencias
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

drop policy if exists asistencias_delete_iglesia on public.asistencias;--> statement-breakpoint
create policy asistencias_delete_iglesia on public.asistencias
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT116 — todo lo que cuelga de una fila es de la misma iglesia que la fila
--
-- SIN el atajo de `_escritor_confiable()`, y a proposito: esto no es un guard de
-- privilegio sino una invariante de integridad. `_escritor_confiable()` devuelve
-- TRUE cuando no hay claims —migraciones, seeds, `dbAdmin`—, y ahi es justo
-- donde un uuid cruzado entraria sin que nadie lo mire. La coherencia se
-- comprueba siempre; el privilegio, no. Mismo criterio que HT113 en la 0024.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_reunion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.ministerio_id is not null and not exists (
    select 1 from public.ministerios m
     where m.id = new.ministerio_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT116: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.creado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.creado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT116: quien crea la reunion no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_reunion()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reuniones_validar_iglesia
  before insert or update on public.reuniones
  for each row execute function public.validar_iglesia_reunion();--> statement-breakpoint


create or replace function public.validar_iglesia_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.reuniones r
     where r.id = new.reunion_id
       and r.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT116: la reunion no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros p
     where p.id = new.miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT116: esa persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.registrado_por_miembro_id is not null and not exists (
    select 1 from public.miembros p
     where p.id = new.registrado_por_miembro_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT116: quien pasa lista no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_asistencia()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_asistencias_validar_iglesia
  before insert or update on public.asistencias
  for each row execute function public.validar_iglesia_asistencia();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT117 — nada de esto cambia de iglesia, y una asistencia tampoco de identidad
--
-- El caso real no es una fuga hacia un extraño: `iglesia_usuarios` solo es unico
-- por (iglesia_id, auth_user_id), asi que una cuenta puede pertenecer a DOS
-- congregaciones —un pastor que planta una segunda iglesia, alguien que se
-- muda—, y entonces el `using` y el `with check` de la policy de UPDATE son
-- ciertos A LA VEZ. Es corromper el historico de una con las listas de la otra.
-- Lo descubrio HT111 en la 0020 y hace falta el mismo guard en cada tabla nueva.
--
-- En `asistencias` se congelan ademas `reunion_id` y `miembro_id`: lo unico que
-- se corrige al repasar una lista es `presente`. Poder mover una fila de persona
-- convierte «me equivoque marcando» en «reescribo donde estuvo otro».
--
-- ESTOS SI llevan el atajo de `_escritor_confiable()`, al reves que HT116: son
-- guards de privilegio, solo los dispara una sesion por `withUser()`, y sin el
-- atajo una migracion futura que rehiciera filas se estrellaria contra su propio
-- guard. Es el criterio de HT115.
-- ---------------------------------------------------------------------------

create or replace function public.guard_reuniones()
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
    raise exception 'HT117: una reunion no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_reuniones()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_reuniones_guard
  before update on public.reuniones
  for each row execute function public.guard_reuniones();--> statement-breakpoint


create or replace function public.guard_asistencias()
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
    raise exception 'HT117: una asistencia no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  if new.reunion_id is distinct from old.reunion_id
     or new.miembro_id is distinct from old.miembro_id then
    raise exception 'HT117: una asistencia no cambia de reunion ni de persona'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_asistencias()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_asistencias_guard
  before update on public.asistencias
  for each row execute function public.guard_asistencias();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `miembros.ultima_asistencia`, que existia desde la 0000 y no la escribia nadie
--
-- El schema decia «se actualiza desde el modulo de asistencias (v2); en la v1 se
-- escribe a mano», y a mano no la escribia nada: un grep por `ultimaAsistencia`
-- en todo `src/` devolvia UNA linea, su propia declaracion. Columna muerta.
--
-- La mantiene un TRIGGER y no la aplicacion, porque una columna derivada que
-- depende de que alguien se acuerde de actualizarla vuelve a quedarse muerta a
-- la tercera pantalla que escriba en la tabla.
--
-- SE RECALCULA, NO SE ACUMULA
-- ---------------------------
-- Lo barato seria `greatest(ultima_asistencia, fecha)`. No sirve: desmarcar a
-- alguien a quien se marco por error dejaria la fecha equivocada para siempre,
-- y corregir una lista es la operacion mas frecuente que va a tener esto. El
-- `max()` completo se apoya en `idx_asistencias_miembro_presente`.
--
-- SOLO CUENTAN LAS REUNIONES DE LA CONGREGACION (`ministerio_id is null`)
-- ----------------------------------------------------------------------
-- Si contaran los ensayos, `ultima_asistencia` diria que el guitarrista viene
-- cada semana aunque lleve dos meses sin pisar un culto — y esa es exactamente
-- la persona a la que hay que llamar. A nadie se le consolida por faltar a un
-- ensayo.
--
-- POR SENTENCIA Y NO POR FILA
-- ---------------------------
-- Pasar lista de un culto son 300 filas en un solo INSERT. Un trigger `for each
-- row` haria 300 UPDATE con su subconsulta cada uno. Con tabla de transicion se
-- hace uno. Hacen falta tres triggers porque NEW TABLE solo existe en INSERT y
-- UPDATE, y OLD TABLE en UPDATE y DELETE; los tres llaman a la misma funcion,
-- que solo conoce el nombre `tocados`.
--
-- ES `security definer` Y ESCRIBE EN `miembros`, QUE TIENE RLS
-- ------------------------------------------------------------
-- Corre como `postgres` y se salta la RLS de `miembros`, asi que conviene ver
-- por que no abre nada: solo toca las fichas que aparecen en las filas de
-- `asistencias` recien escritas, y esas ya pasaron la policy de INSERT
-- (`pertenece_a_iglesia`) y HT116 (la persona es de esa iglesia). No hay uuid
-- que llegue aqui sin haber sido validado dos veces, y lo unico que escribe es
-- una fecha derivada de datos que quien la escribe ya podia leer.
-- ---------------------------------------------------------------------------

create or replace function public.refrescar_ultima_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.miembros m
     set ultima_asistencia = (
       select max(r.fecha)
         from public.asistencias a
         join public.reuniones r on r.id = a.reunion_id
        where a.miembro_id = m.id
          and a.presente = true
          and r.ministerio_id is null
     )
   where m.id in (select t.miembro_id from tocados t);

  return null;
end;
$$;--> statement-breakpoint

revoke execute on function public.refrescar_ultima_asistencia()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_asistencias_ultima_alta
  after insert on public.asistencias
  referencing new table as tocados
  for each statement execute function public.refrescar_ultima_asistencia();--> statement-breakpoint

create trigger trg_asistencias_ultima_cambio
  after update on public.asistencias
  referencing new table as tocados
  for each statement execute function public.refrescar_ultima_asistencia();--> statement-breakpoint

create trigger trg_asistencias_ultima_baja
  after delete on public.asistencias
  referencing old table as tocados
  for each statement execute function public.refrescar_ultima_asistencia();--> statement-breakpoint


-- Auditoria y `updated_at` solo en `reuniones`. El porque de que `asistencias`
-- se quede fuera esta en la cabecera de este fichero.
create trigger trg_reuniones_touch
  before update on public.reuniones
  for each row execute function public.touch_updated_at();--> statement-breakpoint

create trigger trg_auditar_reuniones
  after insert or update or delete on public.reuniones
  for each row execute function public.auditar();--> statement-breakpoint


comment on column public.reuniones.ministerio_id is
  'Nulo = reunion de la congregacion (culto). Con valor = del equipo (ensayo, clase). Solo las nulas cuentan para el historico de asistencia.';--> statement-breakpoint

comment on column public.asistencias.presente is
  'false es un dato, no la ausencia de dato. Cero filas en una reunion significa que no se paso lista, y eso evita contar esa fecha como falta de toda la iglesia.';
