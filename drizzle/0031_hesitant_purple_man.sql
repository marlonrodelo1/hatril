-- ===========================================================================
-- 0031 -- Asistencia: de donde salio cada marca
--
-- Una columna sobre una tabla de un dia y nueve filas, y ese es el motivo de
-- hacerlo ahora. Un `alter type ... add value` NO puede usarse en la misma
-- transaccion que lo anade, asi que estrenar el check-in por QR dentro de un
-- ano obligaria a partir la migracion en dos pasadas, con meses de listas
-- dentro. Los cuatro valores se declaran hoy aunque solo se escriba `panel`.
--
-- POR QUE IMPORTA, Y NO ES ESTADISTICA
-- ------------------------------------
-- Marcar casillas una a una no escala a una congregacion de 1.500 personas: el
-- dato tendra que venir tambien del propio miembro (un QR en la puerta) o de
-- quien lleva su grupo. Y una marca no vale lo mismo segun quien la puso: que
-- alguien se registrara al entrar y que un ujier supusiera que estaba son cosas
-- distintas el dia que consolidacion llame a esa persona.
--
-- LO QUE ESTA COLUMNA NO ARREGLA
-- ------------------------------
-- Quien no contesta un aviso NO es quien no vino. Si `autoconfirmado` llega a
-- alimentar el «lleva cinco domingos sin venir», el silencio tiene que seguir
-- siendo AUSENCIA DE FILA —«no lo sabemos»— y nunca una fila con
-- `presente = false`. Confundirlos pone a consolidacion a llamar a gente que
-- vino todas las semanas, y a la tercera llamada el pastor deja de fiarse.
--
-- Sin grants ni policies nuevas: la columna hereda las de `asistencias` (0030),
-- que no concede nada a `anon` ni a `service_role`.
-- ===========================================================================

CREATE TYPE "public"."origen_asistencia_enum" AS ENUM('panel', 'lider', 'qr', 'autoconfirmado');--> statement-breakpoint
ALTER TABLE "asistencias" ADD COLUMN "origen" "origen_asistencia_enum" DEFAULT 'panel' NOT NULL;--> statement-breakpoint

comment on column public.asistencias.origen is
  'De donde salio la marca. Hoy solo se escribe panel. Ver la cabecera de la 0031: quien no contesta un aviso no es quien no vino.';
