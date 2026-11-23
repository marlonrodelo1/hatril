-- ===========================================================================
-- 0063 -- De dónde salieron las coordenadas de una iglesia, si fue de Google
--
-- Desde el 23-nov la dirección de Ajustes se autocompleta con Google Places
-- (`lib/lugares/google.ts`): el pastor elige su dirección y las coordenadas se
-- guardan solas, en vez de pegarlas a mano.
--
-- 1. POR QUÉ HACE FALTA GUARDAR ESTO
-- ----------------------------------
-- Las condiciones de Google Maps Platform (las de cada servicio, §14.3, Places
-- API) dejan guardar una latitud y una longitud **30 días seguidos** como
-- mucho; pasado ese plazo hay que borrarlas. El identificador del sitio
-- (`place_id`) sí se puede guardar sin límite. Así que:
--
--   - `lugar_google_id`: el sitio de Google de esas coordenadas.
--   - `coordenadas_google_en`: cuándo se le pidieron a Google.
--
-- El cron `POST /api/v1/cron/lugares` las vuelve a pedir antes de los 30 días,
-- y si no puede, las borra. Y `iglesiasConUbicacion()` no saca las que hayan
-- pasado de 30 días, por si el cron no corre: se cae la iglesia de «cerca», no
-- se incumple la condición.
--
-- Las coordenadas que pone el pastor (su móvil o pegadas a mano) no son de
-- Google: con ellas, las dos columnas van a null y no caducan nunca.
--
-- 2. QUIÉN LAS LEE
-- ----------------
-- `hatril_app` ya tenía la tabla entera. `anon` lee por columnas desde la
-- `0004`, y aquí se le da solo la fecha, que es lo que necesita el `where` de
-- `iglesiasConUbicacion()` (un `where` sobre una columna pide SELECT sobre
-- ella). El identificador de Google no lo necesita nadie de fuera y no se da.
--
-- Desde la `0022` una columna nueva nace cerrada para `anon` y `authenticated`
-- (no tienen la tabla entera), así que no hay `revoke` que hacer aquí: lo que
-- abre esta migración es exactamente el `grant` de abajo.
-- ===========================================================================

ALTER TABLE "iglesias" ADD COLUMN "lugar_google_id" text;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "coordenadas_google_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "iglesias" ADD CONSTRAINT "ck_iglesias_lugar_google" CHECK (("iglesias"."lugar_google_id" is null and "iglesias"."coordenadas_google_en" is null) or ("iglesias"."lugar_google_id" is not null and "iglesias"."coordenadas_google_en" is not null and "iglesias"."latitud" is not null));

--> statement-breakpoint

grant select (coordenadas_google_en) on public.iglesias to anon;
