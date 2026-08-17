-- ===========================================================================
-- 0007 — Cerrar `guard_ministerio_miembros`
--
-- LA SUPOSICIÓN QUE NO SE CUMPLIÓ
-- -------------------------------
-- `CLAUDE.md` dice que toda función nace cerrada desde la `0003`, y la `0005` se
-- escribió creyéndoselo: creó `guard_ministerio_miembros()` sin revocar nada, con
-- un comentario explicando que no hacía falta.
--
-- Sí hacía falta. Comprobando el `proacl` después de aplicarla:
--
--   guard_iglesia_usuarios       {postgres=X/postgres}
--   auditar                      {postgres=X/postgres}
--   guard_ministerio_miembros    {=X/postgres, postgres=X/postgres, service_role=X/postgres}
--
-- Esa primera entrada con el grantee vacío, `=X/postgres`, es **PUBLIC**. La
-- función nueva nació abierta; las viejas están cerradas porque la `0003` las
-- revocó UNA A UNA, no por el cambio de defecto.
--
-- El `alter default privileges` de la `0003` está registrado y es correcto —en
-- `pg_default_acl`, esquema `public`, rol `postgres`, el ACL es
-- `{postgres=X, service_role=X}`, sin PUBLIC—, así que algo vuelve a conceder
-- por detrás al crear la función. No se ha identificado qué, y da igual para lo
-- que hay que hacer:
--
--   **Toda función nueva se revoca explícitamente en su propia migración.**
--   La inversión del defecto es un cinturón, no los tirantes.
--
-- QUÉ RIESGO HABÍA DE VERDAD
-- --------------------------
-- Bajo. `guard_ministerio_miembros()` devuelve `trigger`, y Postgres rechaza
-- invocar una función de trigger fuera de un trigger, así que no era llamable
-- por `/rest/v1/rpc/` aunque el permiso estuviera. Se cierra igual: la próxima
-- función SECURITY DEFINER puede no devolver `trigger`, y entonces el permiso
-- sobrante sí importa. Es la lección de los 35 RPC abiertos de Pidoo, que
-- tampoco se abrieron a propósito: simplemente no se cerraron.
-- ===========================================================================

revoke execute on function public.guard_ministerio_miembros()
  from public, anon, authenticated, service_role;

-- Se repite la inversión del defecto por si se hubiera perdido. Es idempotente y
-- no cuesta nada dejarla dicha otra vez.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
