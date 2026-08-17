ALTER TABLE "iglesias" ADD COLUMN "imagenes" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- ---------------------------------------------------------------------------
-- Y su GRANT, que el generador no pone.
--
-- Los permisos de `iglesias` para `anon` son POR COLUMNA (ver `0001:242-249`),
-- así que una columna nueva nace invisible para el visitante aunque la policy
-- deje ver la fila. Sin esta línea, el carrusel de la web pública saldría vacío
-- y no habría ningún error que lo explicara: es la trampa que `ESTADO.md` avisa
-- desde hace tres sesiones.
--
-- Las fotos del edificio son contenido publicado a propósito: van al mismo saco
-- que `logo_url` y `banner_url`.
-- ---------------------------------------------------------------------------
grant select (imagenes) on public.iglesias to anon;
