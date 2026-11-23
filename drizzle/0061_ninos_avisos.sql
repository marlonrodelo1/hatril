-- ===========================================================================
-- 0061 -- Ninos: el aviso de que se borra un mes del drive
--
-- Generada con db:generate y leida antes de aplicar. Dos cosas, y ninguna
-- abre nada:
--
--   - El valor `ninos_caducan` del enum de avisos. Un `add value` no se puede
--     USAR en la misma transaccion que lo crea, y el migrador aplica en una;
--     aqui no se usa (lo usa el cron, despues).
--   - `ninos_archivos.avisado_at`, que pone el cron al avisar 30 dias antes del
--     borrado, para no avisar cada dia de lo mismo. La tabla ya esta revocada a
--     `anon`, `authenticated` y `service_role` (0060), y un permiso de tabla
--     entera alcanza tambien a las columnas nuevas: no hace falta otro revoke.
--     `hatril_app` la puede tocar (UPDATE de tabla), y HT143 no la protege a
--     proposito: es una marca de servicio, no un dato del archivo.
-- ===========================================================================
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'ninos_caducan';--> statement-breakpoint
ALTER TABLE "ninos_archivos" ADD COLUMN "avisado_at" timestamp with time zone;