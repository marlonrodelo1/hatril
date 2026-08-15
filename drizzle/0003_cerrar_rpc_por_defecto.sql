-- ============================================================================
-- Que ninguna función nueva nazca abierta al exterior.
--
-- POR QUÉ HACÍAN FALTA TRES INTENTOS
-- ----------------------------------
-- Una función en `public` puede tener EXECUTE concedido por dos vías distintas,
-- y hay que cortar las dos:
--
--   1. PUBLIC. Postgres se lo da a toda función nueva. Lo cerró la 0002.
--   2. Concesiones explícitas a `anon` y `authenticated`. Supabase las aplica
--      con un `alter default privileges ... grant execute on functions to anon,
--      authenticated, service_role` para que las RPC funcionen sin configurar
--      nada. Revocar a PUBLIC no las toca, porque son grants con nombre.
--
-- Por eso los cuatro triggers seguían apareciendo en el linter después de la
-- 0002: se les había quitado la herencia por PUBLIC, pero conservaban el grant
-- nominal.
--
-- LA PARTE QUE IMPORTA
-- --------------------
-- Lo de abajo no es solo limpiar las cinco funciones que hay hoy. El
-- `alter default privileges ... revoke` cambia el DEFECTO: a partir de aquí,
-- toda función que se cree en `public` nace cerrada y hay que abrirla a mano si
-- de verdad se quiere exponer como RPC.
--
-- Esa inversión es la diferencia entre acordarse siempre y no tener que
-- acordarse. Pidoo acumuló 35 funciones SECURITY DEFINER accesibles desde
-- `/rest/v1/rpc/` sin que nadie lo decidiera; ninguna se abrió a propósito,
-- simplemente ninguna se cerró.
-- ============================================================================

-- --- El defecto, invertido --------------------------------------------------
-- Se declara para el rol `postgres`, que es el que crea los objetos tanto desde
-- las migraciones como desde el editor SQL del panel de Supabase.

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- --- Las que ya existían ----------------------------------------------------
-- Ninguna de estas cinco se llama nunca a mano: las dispara Postgres al saltar
-- el trigger. Que `auditar()` fuera invocable como RPC era lo más grave de las
-- cinco: es la función que escribe el registro de accesos.
--
-- Revocar EXECUTE no rompe los triggers. El privilegio se comprueba al crear el
-- trigger, no cada vez que salta: en ejecución la función corre en el contexto
-- del propietario de la tabla.

revoke execute on function public.touch_updated_at()
  from anon, authenticated, service_role;
revoke execute on function public.asignar_numero_miembro()
  from anon, authenticated, service_role;
revoke execute on function public.validar_iglesia_ministerio_miembro()
  from anon, authenticated, service_role;
revoke execute on function public.guard_iglesia_usuarios()
  from anon, authenticated, service_role;
revoke execute on function public.auditar()
  from anon, authenticated, service_role;

-- Las auxiliares de las policies ya se cerraron en la 0002, pero se repite el
-- revoke nominal por si alguna se recreó por el camino. Es idempotente.
revoke execute on function public.pertenece_a_iglesia(uuid)
  from anon, authenticated, service_role;
revoke execute on function public.es_pastor(uuid)
  from anon, authenticated, service_role;
revoke execute on function public.es_super_admin()
  from anon, authenticated, service_role;
revoke execute on function public._escritor_confiable()
  from anon, authenticated, service_role;
