-- ============================================================================
-- Cerrar las funciones a PUBLIC.
--
-- EL FALLO QUE ARREGLA
-- --------------------
-- La migración 0001 hacía:
--
--     revoke execute on function public.pertenece_a_iglesia(uuid)
--       from anon, authenticated;
--
-- y no servía de nada. Postgres concede `EXECUTE` sobre toda función nueva al
-- pseudo-rol PUBLIC, y quitárselo a `anon` o a `authenticated` por su nombre no
-- toca esa concesión: siguen heredándola por ser miembros de PUBLIC. Hay que
-- revocar A PUBLIC.
--
-- Consecuencia real mientras estuvo mal: `pertenece_a_iglesia`, `es_pastor` y
-- `es_super_admin` eran invocables sin sesión desde `/rest/v1/rpc/…`. Es
-- literalmente el agujero que Pidoo arrastró con 35 funciones SECURITY DEFINER,
-- algunas de ellas financieras. Aquí lo cazó el linter de Supabase antes de que
-- hubiera una sola fila en la base de datos.
--
-- El patrón correcto, y el que hay que repetir con CADA función nueva:
--     revoke execute ... from public;   -- primero cerrar a todos
--     grant  execute ... to hatril_app; -- luego abrir a quien toca
-- ============================================================================

-- --- Funciones auxiliares de las policies -----------------------------------
-- Las usa el planificador al evaluar las policies, y para eso NO hace falta que
-- el rol tenga EXECUTE: dentro de una policy se evalúan con los privilegios del
-- propietario de la tabla. Así que se pueden cerrar del todo.

revoke execute on function public.pertenece_a_iglesia(uuid) from public;
revoke execute on function public.es_pastor(uuid) from public;
revoke execute on function public.es_super_admin() from public;
revoke execute on function public._escritor_confiable() from public;

-- Se le concede explícitamente a `hatril_app` porque el servidor también las
-- llama fuera de las policies (por ejemplo para decidir qué pintar en el panel).
grant execute on function public.pertenece_a_iglesia(uuid) to hatril_app;
grant execute on function public.es_pastor(uuid) to hatril_app;
grant execute on function public.es_super_admin() to hatril_app;

-- --- Funciones de trigger ---------------------------------------------------
-- Estas no las llama nadie a mano: las dispara Postgres. Se cierran a todos y
-- no se le conceden a nadie. Que `auditar()` fuera invocable como RPC es
-- especialmente feo: es la función que escribe el registro de accesos.

revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.asignar_numero_miembro() from public;
revoke execute on function public.validar_iglesia_ministerio_miembro() from public;
revoke execute on function public.guard_iglesia_usuarios() from public;
revoke execute on function public.auditar() from public;

-- --- search_path en touch_updated_at ---------------------------------------
-- Se me olvidó en la 0001. Sin fijarlo, quien dispare el trigger puede
-- anteponer un esquema propio y cambiar a qué resuelve `now()`. En una función
-- de dos líneas parece exagerado; el problema es que la excepción se convierte
-- en costumbre.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public;
