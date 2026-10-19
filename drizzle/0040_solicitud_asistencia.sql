-- ===========================================================================
-- 0040 -- La solicitud guarda la casilla de asistencia y el texto que se leyó
--
-- EL FALLO
-- --------
-- Aprobar registraba `datos_religiosos` en la version vigente y ningun
-- `asistencia_y_seguimiento`. `miembrosSinPermisoDeAsistencia` lee justo esa
-- combinacion como «lo vio en `/acepta` y no marco la casilla», asi que toda
-- persona aprobada desaparecia de asistencia y seguimiento sin haber dicho que
-- no. Con el enlace de ficha, desaparecia una ficha CON historia.
--
-- `/solicitar` enseña ahora la misma casilla que `/acepta`, y la respuesta se
-- guarda aqui hasta que aprobar tiene una ficha a la que colgarla.
--
-- 1. `acepta_asistencia` ES NULL PARA LAS ANTERIORES, NO FALSE
-- ------------------------------------------------------------
-- A quien solicito antes de esta migracion no se le pregunto. Un `default
-- false` habria escrito un «no» que nadie dijo, y al enlazar con una ficha ese
-- «no» borra su historial de asistencia, igual que en `/acepta`. Sin default:
-- `/solicitar` escribe siempre true o false, y NULL queda como «no consta».
--
-- 2. `version_texto`, Y POR QUE SE RELLENA
-- ----------------------------------------
-- La version a la que dijo que si es la de cuando envio la solicitud, no la de
-- cuando alguien la aprueba. Registrar la vigente al aprobar diria que acepto un
-- texto que no leyo y le ahorraria `/acepta`, que es quien vuelve a preguntar.
--
-- Las que ya existian se rellenan con la version que estaba en vigor al
-- enviarlas. `privacidad-2026-09` entro con el commit 5516b0a (21-ago-2026,
-- 15:04:57 UTC); antes regia `privacidad-2026-08`. Las que haya despues de esa
-- fecha y antes de esta migracion se dejan en NULL, a proposito: leyeron la
-- version vigente SIN la casilla, y registrarla al aprobar las volveria a
-- marcar como «dijo que no». Con NULL, aprobar no registra consentimiento
-- ninguno y la ficha queda como las que teclea el pastor (art. 9.2.d). En esta
-- base no hay ninguna: las dos solicitudes que existen son del 16 y 17 de
-- agosto.
--
-- 3. SIN GRANTS NUEVOS
-- --------------------
-- `hatril_app` tiene la tabla entera desde la 0001 —no hay grant por columnas
-- que ampliar—, el INSERT lo hace `/solicitar` por `dbAdmin` y la 0022 dejo a
-- `anon`, `authenticated` y `service_role` sin nada. Una columna nueva hereda
-- eso tal cual.
-- ===========================================================================

ALTER TABLE "solicitudes_ingreso" ADD COLUMN "acepta_asistencia" boolean;--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" ADD COLUMN "version_texto" text;--> statement-breakpoint

update public.solicitudes_ingreso
   set version_texto = 'privacidad-2026-08'
 where version_texto is null
   and created_at < timestamptz '2026-08-21 15:04:57+00';
