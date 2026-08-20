-- ===========================================================================
-- 0024 — Eventos: RLS, escritura pública y coherencia
--
-- Dos tablas —`eventos` y `evento_inscripciones`— y la primera escritura de la
-- plataforma que hace alguien sin cuenta.
--
-- LA RLS AÍSLA IGLESIAS; EL PERMISO LO PONE LA APLICACIÓN
-- ------------------------------------------------------
-- Las policies comprueban `pertenece_a_iglesia()` y punto, igual que el resto
-- del repo. Que solo entren el pastor y quien tenga `gestionar_eventos` lo
-- decide `puedeGestionarEventos` en `src/lib/auth/permisos.ts`.
--
-- `anon` NO RECIBE NADA, Y ESO SE APARTA DE LA 0012
-- -------------------------------------------------
-- La `0012` concedió `select` por columna a `anon` sobre `devocionales` para
-- que la web pública funcionara. Aquí no se hace, por tres motivos:
--
--   1. `/i/[slug]` se sirve entera con `dbAdmin` (`src/lib/iglesias/publica.ts`)
--      y los eventos van por ahí también. El grant sería peso muerto que solo
--      abre `GET /rest/v1/eventos`.
--   2. Aquel grant por columna resultó ser LETRA MUERTA, y por eso existe la
--      `0022`: el defecto de Supabase concedía la tabla entera y la `0012` no
--      revocó, así que `anon` leía por PostgREST justo las columnas que esa
--      migración creía estar recortando.
--   3. Menos superficie pública es menos superficie pública.
--
-- Tampoco se escribe una policy `_select_publico` inalcanzable «por si acaso»:
-- una policy que nadie puede llegar a evaluar es una línea en `pg_policies` en
-- la que el siguiente confiará.
--
-- REVOCAR SIGUE SIENDO OBLIGATORIO AUNQUE LA 0022 INVIRTIERA EL DEFECTO
-- ---------------------------------------------------------------------
-- Desde la `0022`, una tabla nueva en `public` ya nace sin nada para `anon`,
-- `authenticated` y `service_role`. El revoke de abajo es redundante EN ESTA
-- BASE y se escribe igual: el fichero tiene que decir la verdad en cualquier
-- otra —una rama de Supabase creada antes, la de un compañero, la de mañana—.
-- Es la misma razón por la que CLAUDE.md pide escribirlo siempre.
--
-- Y no es teórico para `service_role`, que tiene BYPASSRLS: ninguna policy lo
-- detiene, solo el grant. Sin él,
-- `GET /rest/v1/evento_inscripciones?select=*` con la clave de servicio
-- devolvería nombre, correo, teléfono, nota e IP de todo inscrito de TODAS las
-- iglesias de la plataforma. Esa clave es la que ESTADO.md lleva desde el
-- 16-ago pidiendo rotar porque se pegó en un chat.
--
-- LA ESCRITURA PÚBLICA NO PASA POR `anon` NI POR POSTGREST
-- --------------------------------------------------------
-- `inscribir_en_evento` NO se concede a nadie. La ejecuta `postgres`, su dueño,
-- cuando la llama `dbAdmin` desde una server action. No aparece en el OpenAPI
-- que PostgREST sirve a `anon`, no hay `POST /rest/v1/rpc/`, y `p_ip` deja de
-- venir de un desconocido.
--
-- La alternativa era `grant insert on evento_inscripciones to anon` con una
-- policy `with check`, y es estrictamente peor: abre
-- `POST /rest/v1/evento_inscripciones` donde el CLIENTE elige cada columna
-- —`iglesia_id`, `pagado`, `codigo_cancelacion`—, obliga además a conceder
-- `select` para que la policy y el `returning` funcionen, y sigue sin poder
-- hacer lo único que importa: contar el aforo bajo cerrojo y generar un secreto
-- en el servidor. Una policy no cuenta filas.
--
-- LA FUNCIÓN DEVUELVE UN SOLO ESCALAR, Y ESO ES EL ARREGLO PRINCIPAL
-- -------------------------------------------------------------------
-- La forma evidente devuelve `(resultado, codigo)` y da `ok` con `codigo` a
-- null cuando el correo ya estaba inscrito. Eso ES un oráculo: alta nueva
-- devuelve código, duplicado devuelve null, y con una lista de correos se
-- reconstruye quién asiste a un acto de una congregación sin leer ni una fila.
-- Confesión religiosa por inferencia, art. 9.
--
-- Aquí devuelve `text` y nada más. `ok` es idéntico para el alta y para el
-- duplicado. El código de cancelación se entrega FUERA DE BANDA, por correo, y
-- como Resend todavía no está montado la consecuencia real es que en la v1 NO
-- hay autocancelación: la baja la hace el pastor. `cancelar_inscripcion` se
-- deja escrita y probada para el día que haya correo.
--
-- Y NINGUNA SEÑAL DE AFORO SALE A LA CALLE
-- ----------------------------------------
-- Ni cifra de plazas, ni «completo», ni un botón que desaparezca. Con cualquiera
-- de esas tres, el oráculo se reconstruye desde fuera de esta función: se
-- ocupan 49 de 50 plazas con correos propios, se prueba con el correo de la
-- víctima y se mira si el número se mueve. El duplicado no consume plaza y el
-- alta sí, y el `for update` de aquí hace además que la medición sea
-- determinista. El rechazo por aforo se entera al enviar, nunca antes.
--
-- Eso es lo que permite además que una cancelación libere la plaza al instante:
-- sin señal observable no hay sondeo que rearmar. Las dos decisiones se
-- sostienen la una a la otra.
--
-- LO QUE QUEDA, Y POR QUÉ SE ACEPTA
-- ---------------------------------
-- El aforo se evalúa ANTES del alta, así que en un evento lleno un correo ya
-- inscrito también recibe `completo`. Las dos llamadas siguen respondiendo
-- igual —que es el invariante—, pero queda un ataque indirecto: el atacante
-- ocupa todas las plazas menos una, prueba el correo de la víctima y luego
-- gasta una llamada más con un correo suyo para ver si la plaza se consumió.
-- Si se consumió, la víctima NO estaba inscrita.
--
-- Comprobar el duplicado antes del aforo no lo arregla, lo empeora: en un evento
-- lleno el repetido daría `ok` y el nuevo `completo`, que es el oráculo directo
-- y sin coste. Así que se deja así y se acota por otro lado: no hay ninguna
-- señal pública de ocupación, el ataque necesita un evento CON cupo, y el
-- contador por evento (500 al día) y por correo (10 al día) lo hacen ruidoso y
-- lento. Está probado en `scripts/test-aislamiento.ts`, y ahí se explica por qué
-- la comprobación de indistinguibilidad se hace sobre un evento SIN cupo.
--
-- POR QUÉ DEVUELVE Y NO LANZA
-- ---------------------------
-- Los contadores de `rate_limits` se incrementan en ESTA transacción. Un
-- `raise exception` haría rollback y se llevaría el incremento por delante, así
-- que los intentos fallidos —los del que enumera— no contarían nunca. Devolver
-- un resultado hace COMMIT y el contador se queda. Los HT1xx siguen siendo para
-- estados imposibles, y esos viven en los triggers.
--
-- HT113 Y HT114 NO LLEVAN EL ATAJO DE `_escritor_confiable()`
-- -----------------------------------------------------------
-- `_escritor_confiable()` devuelve TRUE cuando no hay `request.jwt.claims`, y
-- ese es exactamente el caso de todo el camino público: `dbAdmin` no fija claims
-- y la función definer la ejecuta `postgres` sin claims tampoco. Un guard que
-- empiece con «si es de fiar, pasa» queda DESACTIVADO justo en la escritura no
-- autenticada. HT115, que va sobre `eventos` y solo lo dispara el pastor por
-- `withUser()`, sí lo lleva.
--
-- AUDITORÍA: SÍ EN `eventos`, NO EN `evento_inscripciones`
-- --------------------------------------------------------
-- `auditar()` copia la FILA ENTERA con `to_jsonb(new)`. En una inscripción eso
-- son nombre, correo, teléfono, nota, IP y el `codigo_cancelacion` —el secreto
-- que sustituye a la cuenta— de una persona ajena a la congregación,
-- duplicados en una tabla de la que la aplicación no puede borrar: `auditoria`
-- solo tiene `grant select` y no tiene policy de DELETE para nadie. El derecho
-- de supresión de quien se apuntó a un concierto pasaría a exigir SQL a mano,
-- contra lo que promete `/privacidad`. Y sería una copia inútil: `auditar()`
-- escribe `actor_auth_user_id := auth.uid()`, que en toda inscripción pública
-- vale NULL. Todo el coste, ningún beneficio. Precedente: la `0015` (comunidad)
-- y la `0020` (finanzas) tampoco auditan.
--
-- En `eventos` sí, y por un caso concreto: el pastor con la cuenta comprometida
-- que cambia `enlace_pago` en un evento YA publicado de una iglesia real. Sin
-- trigger, ese cambio es invisible incluso a posteriori.
-- ===========================================================================

alter table public.eventos              enable row level security;
alter table public.evento_inscripciones enable row level security;

revoke all on public.eventos              from anon, authenticated, service_role;
revoke all on public.evento_inscripciones from anon, authenticated, service_role;

grant select, insert, update, delete on public.eventos to hatril_app;
grant select, insert, update, delete on public.evento_inscripciones to hatril_app;


-- ---------------------------------------------------------------------------
-- Policies
--
-- Una por tabla y por acción, todas `to hatril_app` EXPLÍCITO.
--
-- Lo de nombrar el rol no es estilo: la trampa que arregló la `0005` fue
-- conceder dos policies «además» a `authenticated`, y como las policies se
-- suman con OR, cualquier sesión autenticada acabó leyendo filas completas de
-- toda iglesia publicada. Una policy sin `to` va a PUBLIC.
--
-- El INSERT de `evento_inscripciones` es para el pastor que apunta a quien
-- llamó por teléfono (`origen = 'panel'`). La inscripción pública NO pasa por
-- esta policy: la hace `inscribir_en_evento` como `postgres`.
-- ---------------------------------------------------------------------------

create policy eventos_select_iglesia on public.eventos
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy eventos_insert_iglesia on public.eventos
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy eventos_update_iglesia on public.eventos
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy eventos_delete_iglesia on public.eventos
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


create policy inscripciones_select_iglesia on public.evento_inscripciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy inscripciones_insert_iglesia on public.evento_inscripciones
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy inscripciones_update_iglesia on public.evento_inscripciones
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy inscripciones_delete_iglesia on public.evento_inscripciones
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));


-- ---------------------------------------------------------------------------
-- HT113 — el evento, quien lo crea y quien marca el pago son de esta iglesia
--
-- `iglesia_id` está repetido en `evento_inscripciones` a propósito (la
-- convención del repo: cada policy es una comparación directa en vez de una
-- subconsulta de tres saltos). El precio de esa redundancia es que puede
-- mentir, y esto es lo que lo impide.
--
-- Sin esto, una server action con un uuid manipulado apuntaría a alguien de
-- Betania en el retiro de Sion: las policies dirían que sí, porque solo miran
-- `evento_inscripciones.iglesia_id`, y la lista de asistentes de la otra
-- congregación quedaría contaminada sin que nadie de allí pudiera ver por qué.
--
-- SIN `_escritor_confiable()`: ver la cabecera. En el camino público no hay
-- claims, así que el atajo lo desactivaría justo donde hace falta.
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_evento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Uuid pelado sin FK (ver el comentario de la columna en `eventos.ts`), así
  -- que la coherencia la comprueba esto o no la comprueba nadie.
  if new.creado_por_miembro_id is not null and not exists (
    select 1 from public.miembros m
     where m.id = new.creado_por_miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT113: quien crea el evento no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_evento()
  from public, anon, authenticated, service_role;

create trigger trg_eventos_validar_iglesia
  before insert or update on public.eventos
  for each row execute function public.validar_iglesia_evento();


create or replace function public.validar_iglesia_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.eventos e
     where e.id = new.evento_id
       and e.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT113: el evento no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.marcado_por_miembro_id is not null and not exists (
    select 1 from public.miembros m
     where m.id = new.marcado_por_miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT113: quien marca el pago no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_inscripcion()
  from public, anon, authenticated, service_role;

create trigger trg_inscripciones_validar_iglesia
  before insert or update on public.evento_inscripciones
  for each row execute function public.validar_iglesia_inscripcion();


-- ---------------------------------------------------------------------------
-- HT114 — una inscripción no cambia de evento, de iglesia ni de identidad
--
-- Lo que el panel puede tocar de una inscripción es `pagado`, `pagado_at`,
-- `marcado_por_miembro_id` y `cancelada_at`. Todo lo demás es la identidad de
-- la fila y la prueba del consentimiento, y no se reescribe.
--
-- Dos cosas que esto tapa y que la policy de UPDATE no puede:
--
--   - Mover la fila de iglesia. `inscripciones_update_iglesia` evalúa el
--     `using` sobre la iglesia de origen y el `with check` sobre la de destino,
--     y las dos son ciertas a la vez para quien pertenece a las DOS
--     congregaciones —`iglesia_usuarios` es único por
--     `(iglesia_id, auth_user_id)`, así que una cuenta puede estar en varias—.
--     Es el mismo agujero que HT111 tapó en `movimientos`.
--   - Reescribir `consentimiento_version` o `consentimiento_at`. Eso no es
--     corregir un dato: es cambiar a posteriori a qué texto dijo que sí una
--     persona. Un registro de consentimiento que el responsable puede editar no
--     prueba nada ante el art. 7.1.
--
-- Y el `codigo_cancelacion`, que se congela por lo evidente: si se pudiera
-- reescribir, el enlace que ya viajó por correo dejaría de servir, o serviría
-- para otra fila.
--
-- SIN `_escritor_confiable()`, otra vez: ver la cabecera.
-- ---------------------------------------------------------------------------
create or replace function public.guard_evento_inscripciones()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.iglesia_id                is distinct from old.iglesia_id
     or new.evento_id              is distinct from old.evento_id
     or new.origen                 is distinct from old.origen
     or new.email                  is distinct from old.email
     or new.codigo_cancelacion     is distinct from old.codigo_cancelacion
     or new.created_at             is distinct from old.created_at
     or new.consentimiento_version is distinct from old.consentimiento_version
     or new.consentimiento_at      is distinct from old.consentimiento_at
     or new.ip                     is distinct from old.ip then
    raise exception 'HT114: una inscripcion no cambia de evento, de iglesia ni de identidad'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_evento_inscripciones()
  from public, anon, authenticated, service_role;

create trigger trg_inscripciones_guard
  before update on public.evento_inscripciones
  for each row execute function public.guard_evento_inscripciones();


-- ---------------------------------------------------------------------------
-- HT115 — un evento no cambia de iglesia
--
-- Mismo caso que HT111 en `movimientos`, y con una consecuencia peor: mover un
-- evento de iglesia se llevaría por delante la coherencia de todas sus
-- inscripciones, que HT113 solo comprueba al escribir la inscripción y no al
-- mover el evento.
--
-- Este SÍ lleva el atajo de `_escritor_confiable()`, porque a `eventos` solo se
-- escribe desde `withUser()` —que fija claims y por tanto no pasa por el
-- atajo— y desde migraciones, que sí tienen que poder.
-- ---------------------------------------------------------------------------
create or replace function public.guard_eventos()
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
    raise exception 'HT115: un evento no puede cambiar de iglesia'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_eventos()
  from public, anon, authenticated, service_role;

create trigger trg_eventos_guard
  before update on public.eventos
  for each row execute function public.guard_eventos();


-- ---------------------------------------------------------------------------
-- Inscribirse en un evento sin cuenta y sin membresía
--
-- POR QUÉ ESTO NO ES LO QUE RECHAZÓ LA 0006
-- -----------------------------------------
-- La `0006` descartó envolver una comprobación de LECTURA en una función
-- definer concedida a `anon`, por dos motivos: había una alternativa de
-- superficie CERO —conceder la columna `activa`— y la función habría sido un
-- oráculo al que preguntar por cualquier uuid desde `/rest/v1/rpc/`.
--
-- Aquí ninguno de los dos aplica. No hay alternativa de superficie cero para
-- contar un aforo bajo cerrojo, y sobre todo esta función NO SE CONCEDE A
-- NADIE: no hay `/rest/v1/rpc/` que valga. La condición que la `0006` impone
-- —no ser un oráculo— se cumple de todos modos: un uuid inexistente, uno de un
-- evento sin publicar, uno de una iglesia dada de baja y uno de una iglesia sin
-- web pública devuelven todos `no_disponible`, la misma palabra.
--
-- LA EJECUTA `postgres`, QUE TIENE BYPASSRLS
-- ------------------------------------------
-- Dentro no hay policies. Ve las iglesias de toda la plataforma. Cada filtro de
-- aquí está escrito a mano y es lo único que separa una congregación de otra:
-- el `where` ES la RLS.
--
-- QUÉ LÍMITES HAY Y CUÁLES SE CAYERON DEL DISEÑO
-- ----------------------------------------------
-- El contador por IP se cae, y las dos razones son las dos mitades del mismo
-- ataque: la clave la elige quien llama —la IP sale del primer salto de
-- `x-forwarded-for` y es falsificable— y sobre un /64 de IPv6 doméstico hay
-- 2^64 claves distintas. O sea, inútil contra el atacante. Y a la vez HIRIENTE
-- para el caso legítimo: una iglesia de 400 personas anuncia el retiro el
-- domingo, la gente se apunta desde el wifi del templo con una sola IP, y la
-- inscripción 31 se queda fuera.
--
-- El freno por IP se queda donde ya está y donde tiene sentido: en la server
-- action, con el `checkRateLimit` de siempre, que falla ABIERTO. Los límites que
-- de verdad acotan el daño son los dos de aquí abajo, y ninguno tiene una clave
-- que el visitante pueda rotar:
--
--   - por EVENTO, con clave `evento_id`. Impide que un evento gratis y sin
--     aforo se llene de diez mil filas basura que el pastor tendría que borrar
--     una a una desde el móvil. Cuenta INTENTOS, no filas vivas, así que el
--     ciclo apuntarse-cancelar-apuntarse lo consume igual.
--   - por CORREO, con clave SHA-256 del correo. Sin esto, Hatril es un
--     formulario público con el que llenar el buzón de un tercero. Se guarda el
--     hash y no la dirección: `rate_limits` es tabla de plataforma, no lleva
--     `iglesia_id`, no se borra con la iglesia y no tiene por qué guardar
--     direcciones de nadie.
--
-- `digest` va cualificado como `extensions.digest`: pgcrypto vive en el esquema
-- `extensions` y con `search_path = public, pg_temp` la llamada sin cualificar
-- falla con «function does not exist». Comprobado contra esta base.
--
-- `lock_timeout` y `statement_timeout` explícitos: el `for update` serializa el
-- aforo y una avalancha sobre un evento popular encolaría conexiones del pool.
-- El `statement_timeout` que `anon` lleva en su `rolconfig` NO aplica: se
-- asigna al abrir sesión, y aquí se entra como `postgres`.
-- ---------------------------------------------------------------------------
create or replace function public.inscribir_en_evento(
  p_evento_id              uuid,
  p_nombre                 text,
  p_email                  text,
  p_consentimiento_version text,
  p_telefono               text    default null,
  p_acompanantes           integer default 0,
  p_nota                   text    default null,
  -- `text` y no `inet` A PROPÓSITO: la IP puede llegar como la cadena
  -- 'unknown' cuando no hay cabecera. Un parámetro `inet` reventaría en el
  -- bind, ANTES de entrar aquí. Se castea dentro, protegido.
  p_ip                     text    default null,
  p_user_agent             text    default null,
  out resultado            text
)
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
set statement_timeout = '5s'
as $$
declare
  v_nombre      text    := nullif(btrim(p_nombre), '');
  v_email       text    := lower(nullif(btrim(p_email), ''));
  v_tel         text    := nullif(btrim(p_telefono), '');
  v_nota        text    := nullif(btrim(p_nota), '');
  -- Se TRUNCA en vez de rechazar: un navegador real manda cadenas largas y
  -- tirar la inscripcion de alguien por su user agent seria absurdo.
  v_ua          text    := left(nullif(btrim(p_user_agent), ''), 400);
  v_acomp       integer := least(greatest(coalesce(p_acompanantes, 0), 0), 10);
  v_ip          inet;
  v_contador    integer;

  v_iglesia_id  uuid;
  v_inicio      timestamptz;
  v_cupo        integer;
  v_publicado   boolean;
  v_abiertas    boolean;
  v_activa      boolean;
  v_web         boolean;

  v_ocupadas    integer;
  v_codigo      text;
  v_restriccion text;
begin
  -- El defecto es la respuesta que menos dice.
  resultado := 'no_disponible';

  -- ---- 0. Entrada -------------------------------------------------------
  -- Zod valida en la server action. Esto es el invariante, no el mensaje: los
  -- CHECK de las columnas dicen lo mismo, y aqui se comprueba antes para poder
  -- devolver 'datos' en vez de reventar con un error de restriccion.
  if v_nombre is null or length(v_nombre) > 120 then
    resultado := 'datos'; return;
  end if;

  if v_email is null
     or length(v_email) > 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    resultado := 'datos'; return;
  end if;

  if v_tel is not null and length(v_tel) > 32 then
    resultado := 'datos'; return;
  end if;

  if v_nota is not null and length(v_nota) > 500 then
    resultado := 'datos'; return;
  end if;

  -- La version del texto de privacidad es la prueba del art. 7.1. Llega como
  -- parametro porque la constante vive en TypeScript
  -- (VERSION_POLITICA_PRIVACIDAD) y duplicarla aqui crearia una segunda fuente
  -- de verdad que se separaria de la primera, que es justo la mentira que esa
  -- constante existe para evitar. Lo que NO puede es ser nula, ser basura ni
  -- ser de 100 MB, y de eso se encarga esta forma.
  if p_consentimiento_version is null
     or p_consentimiento_version !~ '^privacidad-[0-9]{4}-[0-9]{2}$' then
    resultado := 'datos'; return;
  end if;

  begin
    v_ip := nullif(btrim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  -- ---- 1. El evento, con la fila bloqueada ------------------------------
  -- `for update of e` bloquea SOLO la fila de `eventos`, no la de `iglesias`.
  -- Es lo que serializa el aforo: dos visitantes a la vez y el segundo espera
  -- al commit del primero, asi que cuenta con la fila del primero ya puesta.
  --
  -- Un aforo NO se puede defender con un CHECK ni con un unique: es un
  -- agregado. O hay cerrojo o hay overbooking, y en un evento de pago con
  -- plazas contadas el overbooking se paga devolviendo dinero a mano.
  select e.iglesia_id, e.inicio_en, e.cupo, e.publicado, e.inscripciones_abiertas,
         i.activa, i.web_publica
    into v_iglesia_id, v_inicio, v_cupo, v_publicado, v_abiertas,
         v_activa, v_web
    from public.eventos e
    join public.iglesias i on i.id = e.iglesia_id
   where e.id = p_evento_id
     for update of e;

  -- ---- 2. Una sola respuesta para cuatro causas -------------------------
  -- No existe / no publicado / iglesia de baja / iglesia sin web publica se
  -- responden con la misma palabra. Distinguirlas convertiria esto en el
  -- enumerador que la 0006 rechazo: se sabria que un uuid es un evento real
  -- todavia sin publicar, o que una congregacion existe aunque haya decidido no
  -- tener pagina.
  --
  -- Se comprueba `web_publica` y NO `visible_en_directorio`, igual que la 0012:
  -- son decisiones distintas, y una iglesia con web y sin directorio es justo el
  -- caso que `src/lib/iglesias/publica.ts` resuelve hoy con `dbAdmin`.
  if not found
     or v_publicado is not true
     or v_activa    is not true
     or v_web       is not true then
    resultado := 'no_disponible'; return;
  end if;

  -- ---- 3. Limite por evento ---------------------------------------------
  -- DESPUES de saber que el evento existe y es publico, a proposito: puesto
  -- antes, cualquiera crearia filas en `rate_limits` con uuids inventados y
  -- engordaria la tabla sin limite.
  insert into public.rate_limits (scope, clave, dia, contador)
  values ('evento_inscripcion', p_evento_id::text, current_date, 1)
  on conflict (scope, clave, dia)
    do update set contador = rate_limits.contador + 1, updated_at = now()
  returning contador into v_contador;

  -- Purga oportunista. `rate_limits` existe desde la 0000 y no la vacia nadie:
  -- no hay cron en este proyecto y cada clave nueva seria una fila permanente
  -- escrita por una via sin autenticar. Un contador a 1 significa que la fila es
  -- nueva hoy, asi que esto corre como mucho una vez por evento y dia.
  if v_contador = 1 then
    delete from public.rate_limits where dia < current_date - 30;
  end if;

  if v_contador > 500 then
    resultado := 'limite'; return;
  end if;

  -- ---- 4. Limite por correo ---------------------------------------------
  insert into public.rate_limits (scope, clave, dia, contador)
  values ('email_inscripcion',
          encode(extensions.digest(v_email, 'sha256'), 'hex'),
          current_date, 1)
  on conflict (scope, clave, dia)
    do update set contador = rate_limits.contador + 1, updated_at = now()
  returning contador into v_contador;

  if v_contador > 10 then
    resultado := 'limite'; return;
  end if;

  -- ---- 5. Estado del evento ---------------------------------------------
  -- A partir de aqui SI se puede ser especifico: el evento ya se ha confirmado
  -- publico, asi que su estado es informacion que cualquiera ve en la pagina.
  if v_abiertas is not true then
    resultado := 'cerrado'; return;
  end if;

  if v_inicio <= now() then
    resultado := 'pasado'; return;
  end if;

  -- ---- 6. Aforo, contando PERSONAS --------------------------------------
  -- `sum(1 + acompanantes)` y no `count(*)`: cada fila trae hasta 10
  -- acompanantes, asi que un cupo de 50 contado por filas admite 550
  -- asistentes. En un evento de pago con plazas contadas eso es devolver dinero
  -- a mano, que es justo lo que el cerrojo pretendia evitar.
  if v_cupo is not null then
    select coalesce(sum(1 + ei.acompanantes), 0)
      into v_ocupadas
      from public.evento_inscripciones ei
     where ei.evento_id = p_evento_id
       and ei.cancelada_at is null;

    if v_ocupadas + 1 + v_acomp > v_cupo then
      resultado := 'completo'; return;
    end if;
  end if;

  -- ---- 7. El alta -------------------------------------------------------
  -- `gen_random_uuid()` resuelve por `pg_catalog`, asi que funciona con
  -- `search_path = public, pg_temp`. `gen_random_bytes()` NO: pgcrypto vive en
  -- el esquema `extensions` y sin cualificar falla con «function does not
  -- exist», que es como se acaba cayendo en `substr(md5(random()::text),1,8)`;
  -- y el `random()` de Postgres no es un generador criptografico.
  v_codigo := replace(gen_random_uuid()::text, '-', '');

  begin
    insert into public.evento_inscripciones (
      iglesia_id, evento_id, origen,
      nombre, email, telefono, acompanantes, nota,
      codigo_cancelacion,
      consentimiento_version, consentimiento_at, consentimiento_avisos,
      ip, user_agent
    ) values (
      v_iglesia_id, p_evento_id, 'publico',
      v_nombre, v_email, v_tel, v_acomp, v_nota,
      v_codigo,
      p_consentimiento_version, now(), false,
      v_ip, v_ua
    );
  exception when unique_violation then
    get stacked diagnostics v_restriccion = constraint_name;

    -- Ya estaba apuntado con ese correo: MISMA respuesta que un alta nueva. Es
    -- el anti-oraculo, y es la unica razon de que este bloque exista.
    --
    -- Cualquier otra colision se relanza. La del codigo es astronomicamente
    -- improbable con un uuid, y tragarsela devolveria 'ok' sin fila: mejor un
    -- error visible en el formulario que un exito silencioso que no existe.
    if v_restriccion is distinct from 'uq_inscripcion_viva_por_email' then
      raise;
    end if;
  end;

  resultado := 'ok';
  return;
end;
$$;

-- No se concede a NADIE. La ejecuta `postgres`, su dueño, cuando la llama
-- `dbAdmin` desde la server action. Ver la cabecera.
revoke execute on function public.inscribir_en_evento(
  uuid, text, text, text, text, integer, text, text, text
) from public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Cancelar una inscripción
--
-- Escrita y probada, pero SIN USO en la v1: el código de cancelación solo puede
-- llegar a su dueño por correo, y Resend todavía no está montado. Mientras
-- tanto la baja la hace el pastor desde el panel. Se deja aquí para que el día
-- que haya correo sea encender la pantalla y no escribir la lógica.
--
-- POR QUÉ DOS FACTORES Y RESPUESTA CONSTANTE
-- ------------------------------------------
-- La forma evidente —`update … where codigo = $1 returning evento_id, nombre`—
-- es un buscador: código válido devuelve fila, inválido no devuelve nada
-- (oráculo de existencia), y lo que devuelve es «esta persona iba a este acto de
-- esta iglesia». Aquí hace falta el código Y el correo, y la respuesta es `ok`
-- pase lo que pase: acierto, fallo, límite y formato inválido son
-- indistinguibles desde fuera. Quien canceló de verdad lo comprueba porque deja
-- de recibir los avisos del evento, no porque esta función se lo diga.
--
-- Y el contador global no es adorno: la clave del contador por correo la elige
-- quien llama, así que `global` es el único freno que nadie puede rotar.
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_inscripcion(
  p_codigo text,
  p_email  text,
  out resultado text
)
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '5s'
as $$
declare
  v_codigo   text := nullif(btrim(p_codigo), '');
  v_email    text := lower(nullif(btrim(p_email), ''));
  v_contador integer;
begin
  -- Constante desde la primera linea. Todos los `return` de abajo salen con
  -- esto puesto, y esa es la propiedad que importa.
  resultado := 'ok';

  if v_codigo is null or length(v_codigo) > 64
     or v_email is null or length(v_email) > 200 then
    return;
  end if;

  insert into public.rate_limits (scope, clave, dia, contador)
  values ('cancelacion', 'global', current_date, 1)
  on conflict (scope, clave, dia)
    do update set contador = rate_limits.contador + 1, updated_at = now()
  returning contador into v_contador;

  if v_contador > 2000 then
    return;
  end if;

  insert into public.rate_limits (scope, clave, dia, contador)
  values ('cancelacion', encode(extensions.digest(v_email, 'sha256'), 'hex'),
          current_date, 1)
  on conflict (scope, clave, dia)
    do update set contador = rate_limits.contador + 1, updated_at = now()
  returning contador into v_contador;

  if v_contador > 10 then
    return;
  end if;

  update public.evento_inscripciones
     set cancelada_at = now()
   where codigo_cancelacion = v_codigo
     and email = v_email
     and cancelada_at is null;

  return;
end;
$$;

revoke execute on function public.cancelar_inscripcion(text, text)
  from public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- `updated_at`
-- ---------------------------------------------------------------------------
create trigger trg_eventos_touch
  before update on public.eventos
  for each row execute function public.touch_updated_at();

create trigger trg_inscripciones_touch
  before update on public.evento_inscripciones
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Auditoría: solo `eventos`
--
-- Ver la cabecera para el porqué de que `evento_inscripciones` no la lleve. Lo
-- que aquí se persigue es un caso concreto: el enlace de pago cambiado en un
-- evento ya publicado de una iglesia real, que sin esto es invisible incluso a
-- posteriori.
--
-- El cierre de `auditoria` a `service_role`, que este bloque pedía, ya lo hizo
-- la `0022` al arreglar lo de `devocionales`.
-- ---------------------------------------------------------------------------
create trigger trg_auditar_eventos
  after insert or update or delete on public.eventos
  for each row execute function public.auditar();


comment on column public.evento_inscripciones.pagado is
  'Anotacion del organizador, no un hecho verificado por Hatril. El cobro no pasa por la plataforma.';

comment on column public.eventos.enlace_pago_host is
  'Host de enlace_pago, escrito por el servidor con new URL().hostname. ck_eventos_enlace_host impide que los dos campos se contradigan.';
