-- ===========================================================================
-- 0005 — Equipo y liderazgo
--
-- Dos cosas que no tienen que ver entre sí, en un solo fichero porque la
-- segunda toca las mismas tablas que la primera:
--
--   1. Se cierran DOS FUGAS entre congregaciones.
--   2. El liderazgo de un ministerio deja de ser una columna con capacidad para
--      una persona y pasa a ser una propiedad de cada fila del equipo.
--
-- El orden importa: las fugas van primero. Un fallo de aislamiento en producción
-- no debe quedar detrás de un backfill que quizá haya que revisar dos veces.
--
-- Este fichero se escribió A MANO sobre lo que generó `drizzle-kit`. Lo generado
-- traía el `DROP COLUMN lider_miembro_id` como cuarta sentencia, antes de que
-- nada hubiera copiado ese dato a ninguna parte: aplicarlo tal cual habría
-- borrado en silencio quién lidera cada ministerio de cada iglesia.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Las dos fugas
--
-- Las policies de Postgres son PERMISIVAS: varias policies de SELECT sobre la
-- misma tabla se suman con OR, no se cruzan con AND. Y el recorte por columnas
-- de `0001` solo alcanza a `anon`, porque a `hatril_app` se le concedió la tabla
-- entera (0001:213-221).
--
-- Juntando las dos cosas: cualquier policy escrita para el visitante y
-- concedida ADEMÁS a `hatril_app` le entrega a toda sesión autenticada las filas
-- completas, sin el recorte de columnas que la hacía segura para `anon`.
--
-- Es la lección de Pidoo que `0001:232-241` ya explica —«una policy da acceso a
-- la FILA ENTERA»— cometida un nivel más arriba: no en las columnas, sino en a
-- quién se le concede la policy.
-- ---------------------------------------------------------------------------

-- --- 1a. `iglesias`: la peor de las dos ------------------------------------
--
-- `iglesias_select_directorio` iba `to hatril_app, anon`. Como `hatril_app`
-- tiene `grant select` sobre la tabla entera, CUALQUIER cuenta con sesión podía
-- leer `stripe_customer_id`, `stripe_subscription_id`, `plan`, `trial_until`,
-- `config` y `activa` de todas las iglesias publicadas. Son exactamente las seis
-- columnas que el comentario de 0001:238-240, tres líneas más arriba de la
-- policy, declara que «ninguno tiene por qué salir de la iglesia».
--
-- `hatril_app` no la necesita: `iglesias_select_propia` (0001:272) ya le da la
-- suya, el directorio `/iglesias` se consulta con `withAnon`
-- (src/lib/iglesias/directorio.ts:44) y la ficha para solicitar ingreso va por
-- `dbAdmin` (directorio.ts:85). Ninguna ruta la invocaba como `hatril_app`.
drop policy if exists iglesias_select_directorio on public.iglesias;

create policy iglesias_select_directorio on public.iglesias
  for select to anon
  using (visible_en_directorio = true and activa = true);

-- --- 1b. `ministerios` -----------------------------------------------------
--
-- Lo mismo: una sesión de la iglesia A leía la fila completa de los ministerios
-- activos de cualquier iglesia publicada, incluido `lider_miembro_id`, que
-- apunta a una persona concreta.
--
-- `ministerios_select_iglesia` (0001:348) ya le da los suyos a `hatril_app`, y
-- la web pública `/i/[slug]` va por `dbAdmin` (src/lib/iglesias/publica.ts:11).
drop policy if exists ministerios_select_publico on public.ministerios;

create policy ministerios_select_publico on public.ministerios
  for select to anon
  using (
    activo = true
    and exists (
      select 1
      from public.iglesias i
      where i.id = ministerios.iglesia_id
        and i.activa = true
        and i.visible_en_directorio = true
    )
  );


-- ---------------------------------------------------------------------------
-- 2. El liderazgo se muda a la pivote
-- ---------------------------------------------------------------------------

create type public.rol_equipo_enum as enum ('responsable', 'colider', 'voluntario');

alter table public.ministerio_miembros
  add column rol_equipo public.rol_equipo_enum not null default 'voluntario';


-- --- 2a. Backfill. Antes de los índices y MUY antes del DROP ---------------

-- Caso 1: el líder podía no estar en el equipo. Nada lo impedía, porque eran dos
-- tablas sin relación entre sí. Se le crea el vínculo para no perderlo.
--
-- Si `lider_miembro_id` apuntaba a un miembro de OTRA iglesia —posible hasta hoy,
-- que es justo una de las razones de esta migración— la fila no se migra. Dos
-- motivos: el trigger de coherencia HT102 abortaría la migración entera, y ese
-- dato es precisamente el que no queremos conservar.
insert into public.ministerio_miembros
  (iglesia_id, ministerio_id, miembro_id, rol_equipo, desde, activo)
select m.iglesia_id, m.id, m.lider_miembro_id, 'responsable', current_date, true
  from public.ministerios m
 where m.lider_miembro_id is not null
   and exists (
     select 1 from public.miembros p
      where p.id = m.lider_miembro_id
        and p.iglesia_id = m.iglesia_id
   )
   and not exists (
     select 1 from public.ministerio_miembros mm
      where mm.ministerio_id = m.id
        and mm.miembro_id = m.lider_miembro_id
        and mm.activo = true
   );

-- Caso 2: quien ya tenía vínculo activo asciende sobre SU PROPIA fila, para
-- conservar su `desde` real. Con un insert nuevo aparecería como si hubiera
-- entrado en el equipo hoy.
update public.ministerio_miembros mm
   set rol_equipo = 'responsable'
  from public.ministerios m
 where m.id = mm.ministerio_id
   and mm.miembro_id = m.lider_miembro_id
   and mm.activo = true;


-- --- 2b. Índices -----------------------------------------------------------

-- UN solo responsable por ministerio, garantizado por la base de datos y no por
-- la aplicación. Parcial por `activo`, igual que `uq_ministerio_miembro_activo`:
-- quien fue responsable y salió conserva su fila sin bloquear a su sucesor.
create unique index uq_ministerio_responsable_activo
  on public.ministerio_miembros (ministerio_id)
  where rol_equipo = 'responsable' and activo = true;

-- Lo consulta `getCurrentUserContext()` en cada carga del panel.
create index idx_ministerio_miembros_lider
  on public.ministerio_miembros (miembro_id)
  where rol_equipo <> 'voluntario' and activo = true;


-- --- 2c. HT104: nadie se nombra líder a sí mismo ---------------------------
--
-- Hermano de HT101 (0001:551-577), y por la misma razón: `rol_equipo` lleva
-- privilegio a partir de ahora —de ella depende `gestionar_su_ministerio`— y la
-- policy de esta tabla es UNA SOLA, `for all` a cualquiera de la iglesia
-- (0001:380-383), porque escribir el modelo de permisos en SQL está descartado a
-- conciencia en 0001:330-339. Sin este guard, un voluntario con acceso al panel
-- podría ascenderse a responsable de su propio ministerio.
--
-- Diferencia con HT101: aquí el PASTOR sí pasa. Que el pastor lleve el
-- ministerio de alabanza es lo normal en una congregación pequeña, y prohibírselo
-- no protege nada, porque ya puede hacerlo todo por otras vías. HT101 no hace esa
-- excepción porque allí lo que se protege es que la iglesia no se quede sin nadie
-- que mande.
create or replace function public.guard_ministerio_miembros()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mi_ficha uuid;
begin
  -- Crons, migraciones y service role. La misma puerta que abre HT101.
  if public._escritor_confiable() then
    return new;
  end if;

  -- Entrar como voluntario no es ascender. Es el caso normal.
  if new.rol_equipo = 'voluntario' then
    return new;
  end if;

  -- Un UPDATE que no toca el rol no es un ascenso: cambiar la fecha de salida de
  -- un responsable no debe chocar contra este guard.
  if tg_op = 'UPDATE' and old.rol_equipo is not distinct from new.rol_equipo then
    return new;
  end if;

  if public.es_pastor(new.iglesia_id) then
    return new;
  end if;

  select miembro_id into v_mi_ficha
    from public.iglesia_usuarios
   where auth_user_id = (select auth.uid())
     and iglesia_id = new.iglesia_id
     and estado = 'activo';

  if v_mi_ficha is not null and v_mi_ficha = new.miembro_id then
    raise exception 'HT104: no puedes nombrarte lider de un ministerio a ti mismo'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Sin `grant execute`, y a propósito: desde `0003` toda función nace cerrada, y
-- una función de trigger no necesita EXECUTE para el rol que dispara el trigger
-- —el permiso se comprueba al crear el trigger, no al ejecutarlo—. Concedérselo
-- a `hatril_app` sería abrir una RPC que nadie necesita. Lo demuestra
-- `guard_iglesia_usuarios`, que tampoco lo tiene y funciona.
create trigger trg_ministerio_miembros_guard
  before insert or update on public.ministerio_miembros
  for each row execute function public.guard_ministerio_miembros();


-- --- 2d. Auditoría de la pivote --------------------------------------------
--
-- Hasta ahora «quién nombró líder a quién» quedaba registrado porque era un
-- UPDATE sobre `ministerios`, que sí se audita (0001:655-657). Al mudar el
-- liderazgo aquí, ese rastro se perdería EN SILENCIO, y va sobre un dato del
-- art. 9: quién sirve en qué ministerio de qué congregación.
--
-- `auditar()` se reutiliza tal cual: solo necesita `iglesia_id` e `id`, que esta
-- tabla tiene, y su `- 'updated_at'` sobre un jsonb sin esa clave no hace nada.
create trigger trg_auditar_ministerio_miembros
  after insert or update or delete on public.ministerio_miembros
  for each row execute function public.auditar();


-- --- 2e. Y ahora sí, fuera la columna vieja --------------------------------
--
-- `anon` nunca la tuvo concedida (0001:250-254 y 0004:26-30 la excluyen a
-- propósito, «una persona no sale al exterior»), así que no hay GRANT que
-- rehacer. Y `rol_equipo` vive en `ministerio_miembros`, tabla donde `anon` no
-- tiene NI UNA columna: quién lidera qué sigue sin salir a la web pública, y
-- sigue siendo una decisión y no un descuido.
alter table public.ministerios
  drop constraint if exists ministerios_lider_miembro_id_miembros_id_fk;

drop index if exists public.idx_ministerios_lider;

alter table public.ministerios drop column lider_miembro_id;
