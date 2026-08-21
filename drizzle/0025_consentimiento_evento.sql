-- ===========================================================================
-- 0025 — La inscripción guarda la versión de SU casilla, no la de la política
--
-- QUÉ ESTABA MAL
-- --------------
-- `evento_inscripciones.consentimiento_version` guardaba
-- `VERSION_POLITICA_PRIVACIDAD`, y esa constante NO puede subir todavía: hacerlo
-- deja a toda la congregación en estado caducado y no hay forma de re-preguntar
-- —sin correo montado, sin cron y con `consentimientos.miembro_id` NOT NULL—.
--
-- Consecuencia: la etiqueta `privacidad-2026-08` acabó designando dos textos
-- distintos, el de antes de los eventos y el de después. La fila probaba que
-- hubo una casilla, pero no A QUÉ dijo que sí quien la marcó, que es justo lo
-- que el art. 7.1 pide poder demostrar.
--
-- Ahora la casilla del evento tiene su propia versión —`evento-2026-08`— que
-- sube cuando cambia su texto y no arrastra a nadie: el consentimiento de quien
-- se apunta a un concierto se agota con el concierto.
--
-- Lo único que cambia aquí dentro es el patrón que se acepta. El resto del
-- cuerpo es idéntico al de la `0024`, y se repite entero porque `create or
-- replace` sustituye la función completa. El `revoke execute` va detrás otra
-- vez: el fichero tiene que decir la verdad en una base recién creada.
--
-- `ck_inscripciones_consentimiento_len` admite de 5 a 40 caracteres, así que
-- `evento-2026-08` entra sin tocar la tabla.
-- ===========================================================================

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
     or p_consentimiento_version !~ '^(privacidad|evento)-[0-9]{4}-[0-9]{2}$' then
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
