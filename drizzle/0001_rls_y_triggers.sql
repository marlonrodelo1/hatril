-- ============================================================================
-- Aislamiento entre iglesias, consentimiento y auditoría.
--
-- Este es el fichero más importante del proyecto. Lo que hay aquí es lo que
-- impide que una congregación vea los datos de otra, y los datos en juego
-- (pertenencia religiosa) son categoría especial del art. 9 del RGPD.
--
-- POR QUÉ UN ROL PROPIO Y NO `authenticated`
-- ------------------------------------------
-- El plan original decía «withUser hace SET LOCAL ROLE authenticated». Al
-- escribirlo se ve el problema: `authenticated` es el rol que PostgREST expone
-- al navegador. Cualquier cosa que se le conceda para que funcione el servidor
-- queda también accesible desde el exterior con la publishable key y un JWT de
-- usuario — y `GET /rest/v1/miembros?select=*` devolvería la congregación
-- entera con direcciones y fechas de nacimiento.
--
-- Así que hay tres roles con tres trabajos distintos:
--
--   hatril_app     El que asume el servidor de Next.js en cada petición
--                  (`withUser`). Tiene los permisos de tabla y las policies.
--                  NO tiene BYPASSRLS y NOLOGIN: no se conecta nadie con él,
--                  solo se entra por SET ROLE desde una transacción.
--   anon           Visitantes. Solo el directorio público y la web de cada
--                  iglesia, y solo por columnas concretas.
--   authenticated  La puerta de PostgREST. Se le revoca todo: el navegador no
--                  consulta tablas directamente, habla con el servidor.
--
-- Gonper no tiene nada de esto: conecta Drizzle como `postgres`, que salta la
-- RLS, y el aislamiento vive en los `WHERE` de la aplicación.
--
-- POR QUÉ `(select auth.uid())` Y NUNCA `auth.uid()`
-- --------------------------------------------------
-- Envuelto en un SELECT, Postgres lo evalúa una vez por consulta (InitPlan);
-- suelto, lo reevalúa FILA A FILA. Pidoo acabó con 114 policies así y necesitó
-- una migración masiva para arreglarlo. Aquí se escribe bien desde el principio.
--
-- CÓDIGOS DE ERROR
-- ----------------
-- Los `raise exception` propios usan HT1xx, para distinguirlos de un error de
-- Postgres y poder mapearlos a un mensaje en castellano.
--   HT101  intento de cambiar el rol propio
--   HT102  incoherencia de iglesia_id entre tablas relacionadas
--   HT103  intento de escribir en la auditoría desde la aplicación
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Rol de la aplicación
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hatril_app') then
    create role hatril_app nologin;
  end if;
end
$$;

-- El rol que usa Drizzle (`postgres`) tiene que poder hacer SET ROLE a este.
grant hatril_app to postgres;

grant usage on schema public to hatril_app;


-- ---------------------------------------------------------------------------
-- 2. Funciones auxiliares
--
-- Todas SECURITY DEFINER: tienen que poder leer `iglesia_usuarios` sin que se
-- les aplique a su vez la policy de esa tabla, que es lo que provocaría una
-- recursión infinita.
--
-- `set search_path = public, pg_temp` en todas: sin fijarlo, quien llame puede
-- anteponer un esquema propio y secuestrar la resolución de nombres dentro de
-- una función que corre con privilegios del creador.
-- ---------------------------------------------------------------------------

-- ¿Esta persona pertenece a esta iglesia, con la membresía ACTIVA?
--
-- El `estado = 'activo'` es la línea que sostiene el flujo de alta: quien
-- solicita el ingreso desde el directorio entra como 'pendiente' y no ve
-- absolutamente nada hasta que un líder lo aprueba. Sin esta condición,
-- solicitar sería equivalente a entrar.
create or replace function public.pertenece_a_iglesia(p_iglesia_id uuid)
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
  );
$$;

-- ¿Manda en esta iglesia? Configuración, equipo, facturación, altas y bajas.
--
-- `pastor` es el equivalente al dueño y no es delegable. `secretaria` administra
-- el fichero de miembros pero NO toca el equipo ni la suscripción, así que no
-- entra aquí: eso se resuelve con permisos en la capa de aplicación.
create or replace function public.es_pastor(p_iglesia_id uuid)
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
      and rol = 'pastor'
  );
$$;

-- Super admin de la plataforma (nosotros).
create or replace function public.es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where auth_user_id = (select auth.uid())
  );
$$;

-- ¿Quién escribe ahora mismo es de fiar para tocar columnas sensibles?
--
-- Contesta que sí al service role, al super admin y a los procesos sin JWT
-- (crons de pg_cron, migraciones por psql). Es la puerta que dejan abierta los
-- triggers guard: sirve para que el sistema pueda hacer lo que a una persona se
-- le prohíbe. Copiado del patrón `_ctx_is_trusted_writer` de Pidoo, que nació
-- después de descubrir que un cliente podía rebajarse el importe de su pedido.
create or replace function public._escritor_confiable()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
  rol_jwt text;
begin
  -- Sin JWT: pg_cron, psql, migraciones. No hay usuario a quien restringir.
  if claims is null or claims = '' then
    return true;
  end if;

  rol_jwt := (claims::jsonb ->> 'role');
  if rol_jwt = 'service_role' then
    return true;
  end if;

  return public.es_super_admin();
end;
$$;

-- Estas funciones no deben poder invocarse desde fuera como RPC. Pidoo dejó 35
-- funciones SECURITY DEFINER ejecutables por `anon` vía /rest/v1/rpc/, algunas
-- de ellas financieras.
revoke execute on function public.pertenece_a_iglesia(uuid) from anon, authenticated;
revoke execute on function public.es_pastor(uuid) from anon, authenticated;
revoke execute on function public.es_super_admin() from anon, authenticated;
revoke execute on function public._escritor_confiable() from anon, authenticated;

grant execute on function public.pertenece_a_iglesia(uuid) to hatril_app;
grant execute on function public.es_pastor(uuid) to hatril_app;
grant execute on function public.es_super_admin() to hatril_app;


-- ---------------------------------------------------------------------------
-- 3. RLS activada en todas las tablas
--
-- Sin esto, una tabla nueva queda abierta a `anon` a través de PostgREST. Los
-- dos incidentes de Gonper (`plataforma_config`, `notificaciones_clientes`)
-- fueron exactamente eso: tablas creadas por un script suelto que se olvidó de
-- la línea.
-- ---------------------------------------------------------------------------

alter table public.iglesias              enable row level security;
alter table public.iglesia_usuarios      enable row level security;
alter table public.miembros              enable row level security;
alter table public.ministerios           enable row level security;
alter table public.ministerio_miembros   enable row level security;
alter table public.solicitudes_ingreso   enable row level security;
alter table public.consentimientos       enable row level security;
alter table public.auditoria             enable row level security;
alter table public.admin_users           enable row level security;
alter table public.stripe_events_processed enable row level security;
alter table public.rate_limits           enable row level security;


-- ---------------------------------------------------------------------------
-- 4. Permisos de tabla: se parte de cero
--
-- Primero se revoca todo a todos, y después se concede lo justo. Al revés
-- —conceder sobre lo que ya había— es como se acumulan permisos que nadie
-- recuerda haber dado.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

-- El rol de la aplicación trabaja con todas las tablas de negocio; lo que puede
-- ver y tocar dentro lo deciden las policies de abajo, no estos grants.
grant select, insert, update, delete on
  public.iglesias,
  public.iglesia_usuarios,
  public.miembros,
  public.ministerios,
  public.ministerio_miembros,
  public.solicitudes_ingreso,
  public.consentimientos
to hatril_app;

-- La auditoría se lee, nunca se escribe desde la aplicación: la escriben los
-- triggers. Un registro de accesos que la propia aplicación puede modificar no
-- sirve para responder a una reclamación.
grant select on public.auditoria to hatril_app;

-- Las tablas de plataforma no las toca `hatril_app` en absoluto. Solo `dbAdmin`.
-- (admin_users, stripe_events_processed, rate_limits: sin grants y sin policies)


-- --- Directorio público: concesión POR COLUMNA, no por policy ---------------
--
-- Esta es la lección más cara de Pidoo: una policy da acceso a la FILA ENTERA.
-- Allí se creó una policy sobre `usuarios` para que un socio viera el nombre de
-- su cliente, y con ella se llevó las siete columnas de la fila, entre ellas los
-- datos de otro socio que era competencia directa.
--
-- Fuera de esta lista quedan, deliberadamente: plan, trial_until,
-- stripe_customer_id, stripe_subscription_id, config y activa. Ninguno tiene por
-- qué salir de la iglesia.
grant select (
  id, slug, nombre, denominacion, descripcion,
  pais, ciudad, direccion, timezone, moneda,
  telefono, email, web, redes,
  logo_url, banner_url, dominio_propio,
  visible_en_directorio, acepta_solicitudes
) on public.iglesias to anon;

-- La web pública de la iglesia lista sus ministerios. `lider_miembro_id` NO se
-- concede: es una persona, y una persona no sale al exterior.
grant select (
  id, iglesia_id, nombre, descripcion, color_hex, orden, activo
) on public.ministerios to anon;

-- `miembros`, `iglesia_usuarios`, `solicitudes_ingreso`, `consentimientos` y
-- `auditoria` no se conceden a `anon` NI UNA COLUMNA. La sola pertenencia a una
-- de esas tablas ya revela la confesión religiosa de una persona.

-- `authenticated` se queda sin nada a propósito: el navegador no consulta
-- tablas, habla con el servidor de Next.js. Si algún día la app móvil necesita
-- ir directa a PostgREST, se le concede aquí lo justo y con intención.


-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------

-- --- iglesias --------------------------------------------------------------

create policy iglesias_select_propia on public.iglesias
  for select to hatril_app
  using (public.pertenece_a_iglesia(id));

-- El directorio. Se restringe por columnas (arriba), no por esta policy.
--
-- Solo las iglesias que se han publicado a propósito. La tentación es aflojarlo
-- a `activa = true` para que la web pública `/i/[slug]` funcione también con las
-- no listadas, pero eso convierte a `anon` en un enumerador de TODAS las
-- congregaciones de la plataforma vía PostgREST — incluidas las que decidieron
-- no aparecer. La página de una iglesia no listada se sirve desde el servidor
-- con `dbAdmin`, buscando por slug y seleccionando solo columnas públicas: un
-- uso estrecho y justificado, y «no listada» sigue significando «no enumerable».
create policy iglesias_select_directorio on public.iglesias
  for select to hatril_app, anon
  using (visible_en_directorio = true and activa = true);

create policy iglesias_update_pastor on public.iglesias
  for update to hatril_app
  using (public.es_pastor(id))
  with check (public.es_pastor(id));

-- Sin policy de INSERT ni de DELETE: crear una iglesia pasa por el alta
-- (`dbAdmin`, antes de que exista membresía) y borrarla es una operación de
-- super admin.


-- --- iglesia_usuarios ------------------------------------------------------

-- Cada cual ve su propia membresía siempre, incluso 'pendiente'. Es lo que
-- permite a la aplicación decirle «tu solicitud está en revisión» en lugar de
-- fingir que la iglesia no existe.
create policy iglesia_usuarios_select_propia on public.iglesia_usuarios
  for select to hatril_app
  using (auth_user_id = (select auth.uid()));

create policy iglesia_usuarios_select_equipo on public.iglesia_usuarios
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy iglesia_usuarios_insert_pastor on public.iglesia_usuarios
  for insert to hatril_app
  with check (public.es_pastor(iglesia_id));

-- El trigger `guard_iglesia_usuarios` impide además que alguien se ascienda a
-- sí mismo. La policy sola no basta: un pastor SÍ puede hacer UPDATE sobre esta
-- tabla, y sin el trigger podría cambiarse el rol a cualquiera de su iglesia
-- incluyendo el suyo, o un líder editar su propia fila si algún día se le
-- concede UPDATE.
create policy iglesia_usuarios_update_pastor on public.iglesia_usuarios
  for update to hatril_app
  using (public.es_pastor(iglesia_id))
  with check (public.es_pastor(iglesia_id));

create policy iglesia_usuarios_delete_pastor on public.iglesia_usuarios
  for delete to hatril_app
  using (public.es_pastor(iglesia_id));


-- --- miembros --------------------------------------------------------------
--
-- La policy garantiza la frontera DURA: nunca se ve un miembro de otra iglesia.
-- Quién ve a quién DENTRO de la congregación (un líder solo su ministerio, un
-- miembro solo su ficha) se resuelve en `src/lib/auth/permisos.ts`.
--
-- Se reparte así a conciencia: el modelo de permisos es un mapa de excepciones
-- sobre defectos por rol, y escribirlo dos veces —una en TypeScript y otra en
-- SQL— garantiza que las dos copias se separen. La que no puede fallar nunca es
-- la de tenant, y esa está aquí.
create policy miembros_all_iglesia on public.miembros
  for all to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));


-- --- ministerios -----------------------------------------------------------

create policy ministerios_select_iglesia on public.ministerios
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy ministerios_select_publico on public.ministerios
  for select to hatril_app, anon
  using (
    activo = true
    and exists (
      select 1 from public.iglesias i
      where i.id = ministerios.iglesia_id
        and i.activa = true
        and i.visible_en_directorio = true
    )
  );

create policy ministerios_write_iglesia on public.ministerios
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy ministerios_update_iglesia on public.ministerios
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy ministerios_delete_iglesia on public.ministerios
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


-- --- ministerio_miembros ---------------------------------------------------

create policy ministerio_miembros_all_iglesia on public.ministerio_miembros
  for all to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));


-- --- solicitudes_ingreso ---------------------------------------------------

-- Quien la envió puede seguirla.
create policy solicitudes_select_propia on public.solicitudes_ingreso
  for select to hatril_app
  using (auth_user_id = (select auth.uid()));

create policy solicitudes_select_iglesia on public.solicitudes_ingreso
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

-- Cualquiera con sesión puede solicitar entrar a una iglesia que lo acepte,
-- pero solo a nombre propio: sin la comparación con auth.uid() se podrían
-- fabricar solicitudes en nombre de otra persona.
create policy solicitudes_insert_propia on public.solicitudes_ingreso
  for insert to hatril_app
  with check (
    auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.iglesias i
      where i.id = iglesia_id
        and i.activa = true
        and i.acepta_solicitudes = true
    )
  );

create policy solicitudes_update_iglesia on public.solicitudes_ingreso
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));


-- --- consentimientos -------------------------------------------------------

create policy consentimientos_select_iglesia on public.consentimientos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy consentimientos_insert_iglesia on public.consentimientos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

-- Revocar es un UPDATE que rellena `revocado_at`. No hay policy de DELETE:
-- un consentimiento no se borra nunca, porque la prueba de que existió durante
-- un periodo es justo lo que hay que conservar.
create policy consentimientos_update_iglesia on public.consentimientos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));


-- --- auditoria -------------------------------------------------------------

create policy auditoria_select_pastor on public.auditoria
  for select to hatril_app
  using (public.es_pastor(iglesia_id));

-- Sin INSERT, UPDATE ni DELETE para nadie. Escriben los triggers, que corren
-- como SECURITY DEFINER y no pasan por policy.


-- --- Plataforma: RLS activa y CERO policies --------------------------------
--
-- Es la forma explícita de decir «aquí solo entra dbAdmin». Con RLS activada y
-- sin ninguna policy, cualquier rol que no sea el dueño de la tabla ve cero
-- filas, haga la consulta que haga.


-- ---------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------

-- --- updated_at ------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_iglesias_touch before update on public.iglesias
  for each row execute function public.touch_updated_at();
create trigger trg_iglesia_usuarios_touch before update on public.iglesia_usuarios
  for each row execute function public.touch_updated_at();
create trigger trg_miembros_touch before update on public.miembros
  for each row execute function public.touch_updated_at();
create trigger trg_ministerios_touch before update on public.ministerios
  for each row execute function public.touch_updated_at();


-- --- Número de miembro correlativo por iglesia -----------------------------
--
-- Va en un trigger y no en la aplicación porque calcularlo con un `max()+1`
-- desde Node es una carrera: dos altas a la vez leen el mismo máximo y una de
-- las dos choca contra el unique. Aquí el bloqueo de fila lo pone Postgres.
create or replace function public.asignar_numero_miembro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.numero_miembro is null then
    select coalesce(max(numero_miembro), 0) + 1
      into new.numero_miembro
      from public.miembros
     where iglesia_id = new.iglesia_id;
  end if;
  return new;
end;
$$;

create trigger trg_miembros_numero before insert on public.miembros
  for each row execute function public.asignar_numero_miembro();


-- --- Coherencia del iglesia_id redundante ----------------------------------
--
-- `ministerio_miembros` lleva `iglesia_id` propio para que su policy sea una
-- comparación directa en vez de una subconsulta encadenada. El precio de esa
-- redundancia es que puede desincronizarse, y una fila con el `iglesia_id`
-- equivocado es exactamente una fuga entre congregaciones. Este trigger es lo
-- que paga ese precio.
create or replace function public.validar_iglesia_ministerio_miembro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  iglesia_ministerio uuid;
  iglesia_miembro uuid;
begin
  select iglesia_id into iglesia_ministerio
    from public.ministerios where id = new.ministerio_id;
  select iglesia_id into iglesia_miembro
    from public.miembros where id = new.miembro_id;

  if iglesia_ministerio is distinct from new.iglesia_id
     or iglesia_miembro is distinct from new.iglesia_id then
    raise exception
      'HT102: el ministerio y el miembro deben ser de la misma iglesia que la fila'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_ministerio_miembros_coherencia
  before insert or update on public.ministerio_miembros
  for each row execute function public.validar_iglesia_ministerio_miembro();


-- --- Nadie se asciende a sí mismo ------------------------------------------
--
-- La policy de UPDATE ya exige ser pastor, pero un pastor también es una fila de
-- esta tabla: sin este guard podría degradarse por error y dejar la iglesia sin
-- nadie que mande, y cualquier permiso de UPDATE que se conceda en el futuro se
-- convertiría en una vía de escalada. La comprobación va en el trigger y no en
-- la aplicación porque así cubre también los UPDATE directos.
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
          or new.permisos is distinct from old.permisos) then
    raise exception
      'HT101: no puedes cambiar tu propio rol, estado ni permisos'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger trg_iglesia_usuarios_guard
  before update on public.iglesia_usuarios
  for each row execute function public.guard_iglesia_usuarios();


-- --- Auditoría -------------------------------------------------------------
--
-- La escriben triggers y no la aplicación. Si dependiera de que cada ruta se
-- acuerde de llamar a un helper, la primera que se olvide deja un hueco
-- silencioso — y un registro de accesos con huecos no sirve para responder a
-- una reclamación.
--
-- `updated_at` se descarta del diff: ensucia cada entrada y nunca es lo que
-- alguien busca cuando abre esto.
create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_iglesia_id uuid;
  v_entidad_id uuid;
  v_accion accion_auditoria_enum;
  v_antes jsonb;
  v_despues jsonb;
begin
  -- Ojo: en un trigger de DELETE, NEW no está asignado, y leer NEW.id ahí no
  -- devuelve null sino que aborta con «record new is not assigned yet». Por eso
  -- iglesia_id y entidad_id se resuelven dentro de cada rama y no con un
  -- coalesce(new.id, old.id) al final, que parece más corto y no funciona.
  if tg_op = 'DELETE' then
    v_iglesia_id := old.iglesia_id;
    v_entidad_id := old.id;
    v_accion := 'baja';
    v_antes := to_jsonb(old) - 'updated_at';
  elsif tg_op = 'UPDATE' then
    v_iglesia_id := new.iglesia_id;
    v_entidad_id := new.id;
    v_accion := 'modificacion';
    v_antes := to_jsonb(old) - 'updated_at';
    v_despues := to_jsonb(new) - 'updated_at';

    -- Un UPDATE que no cambia nada (el patrón «guardar» sin tocar el
    -- formulario) no es un evento y no se registra.
    if v_antes = v_despues then
      return null;
    end if;
  else
    v_iglesia_id := new.iglesia_id;
    v_entidad_id := new.id;
    v_accion := 'alta';
    v_despues := to_jsonb(new) - 'updated_at';
  end if;

  insert into public.auditoria (
    iglesia_id, actor_auth_user_id, accion, entidad, entidad_id,
    datos_antes, datos_despues
  ) values (
    v_iglesia_id,
    (select auth.uid()),
    v_accion,
    tg_table_name,
    v_entidad_id,
    v_antes,
    v_despues
  );

  return null;
end;
$$;

create trigger trg_auditar_miembros
  after insert or update or delete on public.miembros
  for each row execute function public.auditar();

create trigger trg_auditar_iglesia_usuarios
  after insert or update or delete on public.iglesia_usuarios
  for each row execute function public.auditar();

create trigger trg_auditar_ministerios
  after insert or update or delete on public.ministerios
  for each row execute function public.auditar();

create trigger trg_auditar_consentimientos
  after insert or update or delete on public.consentimientos
  for each row execute function public.auditar();
