-- ===========================================================================
-- 0028 — Ministerios: identidad y motor de módulos
--
-- Cinco columnas sobre una tabla que ya existe. Ninguna tabla nueva, así que
-- no hay RLS que escribir: las policies de `ministerios` (0001:346, corregidas
-- en la 0005) siguen valiendo tal cual y cubren estas columnas solas.
--
-- LO QUE EL GENERADOR NO ESCRIBE, Y AQUÍ SÍ HACE FALTA
-- ----------------------------------------------------
-- Solo los `comment on column`. No hay `grant`, y esa es la decisión:
--
-- `ministerios` tiene un `grant select` POR COLUMNA a `anon` (0001:250, repetido
-- en la 0004 y ampliado en la 0011 con `foto_url`) para que la web pública de la
-- iglesia liste sus grupos. Una columna nueva **nace invisible** para ese rol, y
-- eso es exactamente lo que se quiere aquí:
--
--   * `/i/[slug]` se sirve con `dbAdmin` (`src/lib/iglesias/publica.ts:105`), que
--     entra como `postgres` y no mira estos grants. Añadirlos no haría que la web
--     pública enseñara nada nuevo; solo abriría `GET /rest/v1/ministerios` con la
--     clave publicable. Es el mismo razonamiento de la 0024 con eventos.
--   * `modulos` NO se concede NUNCA. Qué herramientas usa un equipo por dentro
--     —y en particular si lleva seguimiento de personas— no es asunto de nadie
--     de fuera. Que un ministerio tenga `seguimiento` encendido delata que esa
--     congregación registra quién ha dejado de venir.
--
-- Si algún día la misión o el objetivo salen en la web pública, el grant se
-- añade en su propia migración y **solo para esas columnas**. Sin él la consulta
-- de `anon` no devolvería cero filas: fallaría entera con «permission denied»
-- (pasó con `iglesias.imagenes` en la 0010 y con `foto_url` en la 0011).
--
-- POR QUÉ `tipo` ES `text` Y NO UN ENUM
-- --------------------------------------
-- El conjunto no está cerrado ni lo va a estar: radio, reparto de alimentos,
-- «Ángeles de la Noche». Un enum obligaría a una migración por tipo nuevo. El
-- catálogo vive en `src/lib/ministerios/tipos.ts` y un valor que no reconozca se
-- pinta como «Otro» en vez de romper la pantalla, igual que hace
-- `colorDeMinisterio()` con un hex fuera de la paleta.
--
-- Tampoco lleva CHECK por lo mismo: un CHECK es un enum con otro nombre.
-- ===========================================================================

ALTER TABLE "ministerios" ADD COLUMN "tipo" text DEFAULT 'otro' NOT NULL;--> statement-breakpoint
ALTER TABLE "ministerios" ADD COLUMN "mision" text;--> statement-breakpoint
ALTER TABLE "ministerios" ADD COLUMN "vision" text;--> statement-breakpoint
ALTER TABLE "ministerios" ADD COLUMN "objetivo" text;--> statement-breakpoint
ALTER TABLE "ministerios" ADD COLUMN "modulos" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

comment on column public.ministerios.tipo is
  'De que va el ministerio. Catalogo en src/lib/ministerios/tipos.ts; un valor desconocido cae a otro.';--> statement-breakpoint

comment on column public.ministerios.modulos is
  'Herramientas encendidas: {"agenda":{"activo":true}}. Lo escribe una sola action validada con EsquemaModulos. NUNCA se concede a anon.';
