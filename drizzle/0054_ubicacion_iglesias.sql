-- ===========================================================================
-- 0054 -- Dónde está cada iglesia, y la dirección en la solicitud
--
-- Para «iglesias cerca de mí» en la bienvenida de la app. Sin mapa, por
-- decisión de Marlon (30-oct): una lista ordenada por distancia, que con las
-- iglesias que hay hoy es lo que de verdad sirve.
--
-- 1. LAS COORDENADAS SON PÚBLICAS
-- -------------------------------
-- El sitio donde se reúne una congregación ya sale en su web con la
-- dirección. `anon` las lee con un grant por COLUMNA, como el resto de lo que
-- publica el directorio; `hatril_app` ya tenía la tabla entera.
--
-- La distancia la calcula el navegador de quien busca. Su ubicación no llega
-- al servidor, ni en la URL ni en un formulario: «no guardamos tu ubicación»
-- es verdad porque no la tenemos.
--
-- 2. LA DIRECCIÓN DE QUIEN SOLICITA
-- ---------------------------------
-- Opcional, como en el diseño. Se copia a la ficha al aprobar, igual que el
-- teléfono. `hatril_app` ya tenía INSERT sobre la tabla entera.
-- ===========================================================================

ALTER TABLE "iglesias" ADD COLUMN "latitud" double precision;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "longitud" double precision;--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" ADD COLUMN "direccion" text;--> statement-breakpoint
ALTER TABLE "iglesias" ADD CONSTRAINT "ck_iglesias_coordenadas" CHECK (("iglesias"."latitud" is null and "iglesias"."longitud" is null) or ("iglesias"."latitud" is not null and "iglesias"."longitud" is not null and "iglesias"."latitud" between -90 and 90 and "iglesias"."longitud" between -180 and 180));

--> statement-breakpoint

grant select (latitud, longitud) on public.iglesias to anon;
