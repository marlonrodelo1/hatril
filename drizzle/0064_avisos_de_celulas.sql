-- ===========================================================================
-- 0064 -- Los avisos de las células
--
-- Dos valores nuevos de `tipo_notificacion_enum` (23-nov):
--
--   grupo_nuevo_integrante  alguien ha entrado en tu célula —por el enlace,
--                           al aprobarle con invitación, o porque lo sumó la
--                           red—. Va a quien la lleva, que ya le ve con su
--                           teléfono.
--   grupo_incorporado       la red te ha sumado a una célula sin que lo
--                           pidieras: quien la lleva verá tu teléfono, y
--                           puedes salir desde Mi cuenta.
--
-- En su propia migración y sin nada más: un valor añadido con ALTER TYPE no
-- se puede usar en la misma transacción (ESTADO.md, «Trampas»), y la 0065, que
-- es la que va detrás, no los usa.
-- ===========================================================================

ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'grupo_nuevo_integrante';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'grupo_incorporado';