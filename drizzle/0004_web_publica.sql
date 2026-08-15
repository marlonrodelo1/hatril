ALTER TABLE "iglesias" ADD COLUMN "web_publica" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "historia" text;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "horarios" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "cuenta_donativos" text;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "titular_donativos" text;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Permisos de las columnas nuevas.
--
-- Esto Drizzle no lo genera, y es justo lo que hay que recordar cada vez que se
-- añade una columna a `iglesias`: los GRANT son POR COLUMNA, así que una columna
-- nueva NO hereda nada. Nace invisible para `anon`.
--
-- Que el defecto sea el cerrado es lo correcto —una columna sensible añadida sin
-- pensar no se filtra sola—, pero significa que una columna que SÍ es pública se
-- queda muda hasta que se escribe esta línea. Si algún día la web pública deja
-- de mostrar un campo recién añadido, mirar aquí antes que al código.
--
-- Las cinco son contenido de la página: la iglesia las escribe para publicarlas.
-- ---------------------------------------------------------------------------

GRANT SELECT (
  web_publica, historia, horarios, cuenta_donativos, titular_donativos
) ON public.iglesias TO anon;--> statement-breakpoint

-- La descripción del ministerio ya se concedía; se repite el bloque entero por
-- si esta migración se aplica sobre una base creada antes de la 0001.
GRANT SELECT (
  id, iglesia_id, nombre, descripcion, color_hex, orden, activo
) ON public.ministerios TO anon;