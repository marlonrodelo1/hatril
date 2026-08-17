ALTER TABLE "ministerios" ADD COLUMN "foto_url" text;

-- ---------------------------------------------------------------------------
-- Y su GRANT.
--
-- `anon` lee `ministerios` por columnas (`0001:252-254`, repetido en
-- `0004:26-30`): sin esta línea, la web pública pediría `foto_url` y la consulta
-- fallaría entera con «permission denied», no devolvería null. Es el mismo
-- descuido que la `0006` tuvo que arreglar para `iglesias.activa`.
--
-- Se concede solo la foto. `lider_miembro_id` desapareció en la `0005`, y el
-- resto de columnas que no están en esa lista siguen sin salir: la composición
-- del equipo no es contenido público.
-- ---------------------------------------------------------------------------
grant select (foto_url) on public.ministerios to anon;
