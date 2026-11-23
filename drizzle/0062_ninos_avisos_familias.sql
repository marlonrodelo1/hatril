-- ===========================================================================
-- 0062 -- Ninos: los avisos de las familias
--
-- Generada con db:generate y leida antes de aplicar. Cuatro valores del enum
-- de avisos, para la fase N4 (las familias en la app). No abre nada: un aviso
-- es una fila de `notificaciones`, con su RLS de siempre (cada cuenta ve los
-- suyos). Un `add value` no se puede usar en la misma transaccion que lo crea,
-- y aqui no se usa.
-- ===========================================================================
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'ninos_solicitud';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'ninos_aceptada';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'ninos_publicacion';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'ninos_sin_fotos';