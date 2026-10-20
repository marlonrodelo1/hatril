-- ===========================================================================
-- 0044 -- Finanzas: el fondo de un ministerio y el arqueo a dos personas
--
-- Lo que trae la 0043 —`iglesias.modulos`, `fondos.ministerio_id`, la tabla
-- `arqueos` y `movimientos.arqueo_id`— con su RLS y sus tres guards.
--
-- 1. LA RLS DE `arqueos` ES LA DE LA CAJA
-- ---------------------------------------
-- Calcada de la 0020: `pertenece_a_iglesia()` y nada mas, `to hatril_app`
-- explicito, y revoke a anon, authenticated y service_role ANTES del grant.
-- Que solo el tesorero y el pastor entren lo decide `gestionar_finanzas` en la
-- aplicacion, como en el resto de la caja. Redundante en esta base desde la
-- 0022, que invirtio el defecto, y se escribe igual: el fichero tiene que decir
-- la verdad en cualquier otra (CLAUDE.md).
--
-- 2. LO QUE SI VIVE AQUI: QUIEN CUENTA NO ES QUIEN CONFIRMA
-- --------------------------------------------------------
-- El permiso es de la aplicacion; la segregacion, no. Si dependiera de la
-- pantalla seria decorativa: cualquiera con `gestionar_finanzas` podria contar y
-- confirmar el mismo arqueo con un POST fabricado. HT130 exige que la ficha que
-- cuenta y la que confirma sean las de las SESIONES que escriben
-- (`miembro_actual()`), que no coincidan, y que un arqueo confirmado no cambie
-- nunca mas. `ck_arqueos_dos_personas` (0043) lo repite sin atajo.
--
-- 3. LOS INGRESOS LOS CREA LA BASE
-- --------------------------------
-- Al confirmarse, `arqueo_genera_ingresos` apunta el diezmo y la ofrenda en el
-- libro, en la misma sentencia. Hecho en la aplicacion, un arqueo confirmado
-- podria quedarse sin sus ingresos, o con otros importes, por un fallo entre
-- dos consultas. Aqui no: confirmado implica apuntado, y por lo contado. Y
-- HT130 impide colar a mano un ingreso con `arqueo_id`, o editar y borrar los
-- que salen de uno: corregir un arqueo es apuntar un ajuste aparte.
--
-- 4. EL FONDO DE UN MINISTERIO
-- ----------------------------
-- HT128 es la coherencia de siempre (HT110, HT126): el ministerio del fondo es
-- de la misma iglesia. Sin el, un pastor con cuenta en dos iglesias podria
-- vincular un fondo de una a un ministerio de la otra, y el lider de ese
-- ministerio veria dinero ajeno.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- `iglesias.modulos`: nada para `anon`
--
-- `anon` lee `iglesias` por columnas sueltas (0001, 0006, 0010), y una columna
-- nueva no entra en esa lista sola. Se escribe igual: que una iglesia tenga
-- apagada la caja no es asunto de nadie de fuera.
-- ---------------------------------------------------------------------------

revoke select (modulos) on public.iglesias from anon, authenticated;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `arqueos`: permisos de tabla y policies
-- ---------------------------------------------------------------------------

alter table public.arqueos enable row level security;--> statement-breakpoint

revoke all on public.arqueos from anon, authenticated, service_role;--> statement-breakpoint

grant select, insert, update, delete on public.arqueos to hatril_app;--> statement-breakpoint

create policy arqueos_select_iglesia on public.arqueos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

create policy arqueos_insert_iglesia on public.arqueos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

create policy arqueos_update_iglesia on public.arqueos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint

create policy arqueos_delete_iglesia on public.arqueos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT128 -- el ministerio de un fondo es de la misma iglesia
--
-- Sin atajo de `_escritor_confiable()`: es integridad, no privilegio (como
-- HT110 y HT126). Tambien en `iglesia_id`, aunque HT111 ya impide moverlo: un
-- escritor de confianza si puede, y ahi la coherencia sigue haciendo falta.
-- ---------------------------------------------------------------------------

create or replace function public.validar_ministerio_fondo()
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
    raise exception 'HT128: el ministerio no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_ministerio_fondo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_fondos_validar_ministerio
  before insert or update of ministerio_id, iglesia_id on public.fondos
  for each row execute function public.validar_ministerio_fondo();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT129 -- todo lo de un arqueo es de la misma iglesia
--
-- El fondo, la caja y las dos personas. Las personas son uuid pelado sin FK
-- (ver `finanzas.ts`), asi que esto es lo unico que comprueba que existen y
-- que son de aqui. Sin atajo, por lo mismo que HT128.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_arqueo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.fondos f
     where f.id = new.fondo_id and f.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT129: el fondo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.cajas c
     where c.id = new.caja_id and c.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT129: la caja no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros m
     where m.id = new.contado_por_miembro_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT129: quien cuenta no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.confirmado_por_miembro_id is not null and not exists (
    select 1 from public.miembros m
     where m.id = new.confirmado_por_miembro_id and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT129: quien confirma no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_iglesia_arqueo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_arqueos_validar_iglesia
  before insert or update on public.arqueos
  for each row execute function public.validar_iglesia_arqueo();--> statement-breakpoint


-- Y el ingreso que cuelga de un arqueo, del arqueo de su propia iglesia. HT110
-- mira el fondo, la caja y quien apunta; el arqueo es una columna nueva.
create or replace function public.validar_arqueo_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.arqueo_id is not null and not exists (
    select 1 from public.arqueos a
     where a.id = new.arqueo_id and a.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT129: el arqueo no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validar_arqueo_movimiento()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_movimientos_validar_arqueo
  before insert or update of arqueo_id, iglesia_id on public.movimientos
  for each row execute function public.validar_arqueo_movimiento();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- HT130 -- quien cuenta no es quien confirma, y lo confirmado no se toca
--
-- CON el atajo de `_escritor_confiable()`: es un guard de privilegio, como
-- HT111 y HT127. Los procesos sin JWT —una migracion, borrar una iglesia desde
-- el super admin— tienen que poder pasar.
--
-- `miembro_actual()` (0015) es la ficha de la sesion en esa iglesia. Sin ficha
-- no se cuenta ni se confirma: un pastor sin ficha no deja rastro de quien fue,
-- y entonces el control de dos personas no prueba nada.
--
-- Lo que se puede hacer con un arqueo, y nada mas:
--   - crearlo sin confirmar, a nombre de quien tiene la sesion;
--   - confirmarlo una vez, otra persona, a su propio nombre (la hora la pone la
--     base: nadie confirma «ayer»);
--   - borrarlo mientras espera, que es descartarlo. No ha movido dinero.
-- Corregir lo contado es descartar y volver a contar: cambiar los importes de
-- un arqueo pendiente dejaria que quien confirma confirmara SUS numeros.
-- ---------------------------------------------------------------------------

create or replace function public.guard_arqueos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid;
begin
  if public._escritor_confiable() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.confirmado_at is not null then
      raise exception 'HT130: un arqueo confirmado no se borra'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  yo := public.miembro_actual(new.iglesia_id);

  if tg_op = 'INSERT' then
    if new.confirmado_por_miembro_id is not null or new.confirmado_at is not null then
      raise exception 'HT130: un arqueo nace sin confirmar'
        using errcode = 'insufficient_privilege';
    end if;
    if yo is null or new.contado_por_miembro_id is distinct from yo then
      raise exception 'HT130: quien cuenta es quien tiene la sesion'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.confirmado_at is not null then
    raise exception 'HT130: un arqueo confirmado no se toca'
      using errcode = 'insufficient_privilege';
  end if;

  if new.iglesia_id             is distinct from old.iglesia_id
     or new.fecha                  is distinct from old.fecha
     or new.total_diezmos          is distinct from old.total_diezmos
     or new.total_ofrendas         is distinct from old.total_ofrendas
     or new.fondo_id               is distinct from old.fondo_id
     or new.caja_id                is distinct from old.caja_id
     or new.contado_por_miembro_id is distinct from old.contado_por_miembro_id then
    raise exception 'HT130: lo contado no se reescribe; descartalo y vuelve a contar'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un UPDATE que no confirma no cambia nada que importe. Si trae la hora sin
  -- la persona, lo para `ck_arqueos_confirmacion`.
  if new.confirmado_por_miembro_id is null then
    return new;
  end if;

  if yo is null or new.confirmado_por_miembro_id is distinct from yo then
    raise exception 'HT130: quien confirma es quien tiene la sesion'
      using errcode = 'insufficient_privilege';
  end if;

  if new.confirmado_por_miembro_id = old.contado_por_miembro_id then
    raise exception 'HT130: quien conto no puede confirmar su propio arqueo'
      using errcode = 'insufficient_privilege';
  end if;

  new.confirmado_at := now();
  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_arqueos()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_arqueos_guard
  before insert or update or delete on public.arqueos
  for each row execute function public.guard_arqueos();--> statement-breakpoint


-- Los ingresos que salen de un arqueo: exactamente lo confirmado, y fijos.
--
-- El INSERT con `arqueo_id` lo hace `arqueo_genera_ingresos` y los valores
-- coinciden por construccion. Lo que esto para es a una sesion que intente
-- apuntar uno por su cuenta: con importes distintos no pasa, y con los mismos
-- choca con `uq_movimientos_arqueo`, porque la base ya los apunto al confirmar.
create or replace function public.guard_movimientos_arqueo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.arqueos%rowtype;
begin
  if public._escritor_confiable() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.arqueo_id is null then
      return new;
    end if;

    select * into a from public.arqueos where id = new.arqueo_id;

    -- `is distinct from` en todo: con `<>`, un NULL convierte la condicion
    -- entera en NULL, y un `if` NULL deja pasar. Un tipo de ingreso que no sea
    -- diezmo ni ofrenda da NULL en el `case`, y eso SI es distinto del importe.
    if a.id is null
       or a.confirmado_at is null
       or new.tipo         is distinct from 'ingreso'
       or new.fecha        is distinct from a.fecha
       or new.fondo_id     is distinct from a.fondo_id
       or new.caja_id      is distinct from a.caja_id
       -- El `case` entre parentesis: sin ellos, plpgsql corta la condicion
       -- del `if` en el primer `then`, que es el de dentro del `case`.
       or new.importe      is distinct from (case new.tipo_ingreso
                                               when 'diezmo' then a.total_diezmos
                                               when 'ofrenda' then a.total_ofrendas
                                             end) then
      raise exception 'HT130: un ingreso de arqueo es exactamente lo confirmado'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.arqueo_id is not null or new.arqueo_id is not null then
      raise exception 'HT130: un ingreso que sale de un arqueo no se edita'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- DELETE
  if old.arqueo_id is not null then
    raise exception 'HT130: un ingreso que sale de un arqueo no se borra'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;--> statement-breakpoint

revoke execute on function public.guard_movimientos_arqueo()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_movimientos_guard_arqueo
  before insert or update or delete on public.movimientos
  for each row execute function public.guard_movimientos_arqueo();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Al confirmar, el libro
--
-- Un ingreso por cada total que no sea cero, con concepto automatico y sin
-- texto libre. Quien lo registra es quien confirmo: es quien lo hizo efectivo.
-- `efectivo` porque el arqueo es lo que se cuenta en mano al acabar el culto.
--
-- AFTER y no BEFORE: el ingreso apunta al arqueo y HT130 lo comprueba contra la
-- fila ya confirmada. Corre como su dueno —inserta sin pasar por la RLS, que ya
-- paso la sesion al confirmar—, pero HT110, HT129 y HT130 corren igual.
-- ---------------------------------------------------------------------------

create or replace function public.arqueo_genera_ingresos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  dia text := to_char(new.fecha, 'DD/MM/YYYY');
begin
  if old.confirmado_at is not null or new.confirmado_at is null then
    return null;
  end if;

  if new.total_diezmos > 0 then
    insert into public.movimientos
      (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id,
       metodo_pago, tipo_ingreso, registrado_por_miembro_id, arqueo_id)
    values
      (new.iglesia_id, 'ingreso', new.fecha, new.total_diezmos,
       'Diezmos del culto del ' || dia || ' (arqueo)', new.fondo_id, new.caja_id,
       'efectivo', 'diezmo', new.confirmado_por_miembro_id, new.id);
  end if;

  if new.total_ofrendas > 0 then
    insert into public.movimientos
      (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id,
       metodo_pago, tipo_ingreso, registrado_por_miembro_id, arqueo_id)
    values
      (new.iglesia_id, 'ingreso', new.fecha, new.total_ofrendas,
       'Ofrendas del culto del ' || dia || ' (arqueo)', new.fondo_id, new.caja_id,
       'efectivo', 'ofrenda', new.confirmado_por_miembro_id, new.id);
  end if;

  return null;
end;
$$;--> statement-breakpoint

revoke execute on function public.arqueo_genera_ingresos()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_arqueos_genera_ingresos
  after update on public.arqueos
  for each row execute function public.arqueo_genera_ingresos();--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- `updated_at`, y que un arqueo no cambie de iglesia
--
-- HT130 ya impide mover `iglesia_id` desde una sesion; `guard_fondos_cajas`
-- (HT111) no se reutiliza para no tener dos mensajes para lo mismo.
-- ---------------------------------------------------------------------------

create trigger trg_arqueos_touch
  before update on public.arqueos
  for each row execute function public.touch_updated_at();
