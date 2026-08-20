-- ===========================================================================
-- 0022 — Una tabla nueva NO nace cerrada, y `devocionales` lo demuestra
--
-- LA FUGA, COMPROBADA DESDE INTERNET
-- ----------------------------------
-- Con la clave publicable —la que viaja en el JavaScript del navegador y es
-- pública por diseño— esta petición devolvía 200 y datos:
--
--   GET /rest/v1/devocionales?select=id,iglesia_id,autor_miembro_id,video_url
--
-- `autor_miembro_id` es exactamente la columna que la `0012` dejó fuera del
-- `grant select (…)` a propósito, y lo dejó escrito: «el id de una ficha no
-- tiene por qué salir a internet». Salía igual.
--
-- POR QUÉ, Y POR QUÉ ESTE REPO CREÍA LO CONTRARIO
-- -----------------------------------------------
-- Porque el `grant` por columna no recorta nada si antes no se ha revocado el
-- grant de tabla, y `devocionales` tenía el de tabla. No se lo dio nadie: lo
-- trae el defecto de Supabase. `pg_default_acl` para tablas en `public` dice
--
--   {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}
--
-- así que TODA tabla creada en `public` nace con los cuatro privilegios para
-- `anon` y `authenticated`. Lo único que las cierra es el `revoke` explícito
-- que escriben todas las migraciones de este repo… menos la `0012`, que es la
-- única que hace `grant` sin `revoke` delante. Por eso es la única tabla con el
-- agujero: se comprobó una por una con `has_table_privilege`.
--
-- La `0003` ya invirtió este defecto, pero SOLO PARA FUNCIONES. Su propio texto
-- explica por qué invertir un defecto es mejor que acordarse cada vez —«la
-- diferencia entre acordarse siempre y no tener que acordarse»— y luego se dejó
-- las tablas fuera. CLAUDE.md avisa de esto mismo para las funciones y hasta hoy
-- nadie lo había comprobado en las tablas.
--
-- QUÉ NO PASÓ, PARA NO ASUSTAR DE MÁS
-- -----------------------------------
-- La RLS aguantó. `anon` tenía también insert, update y delete sobre la tabla,
-- pero `devocionales` solo tiene una policy para `anon` y es de SELECT, así que
-- no pudo escribir nada. Y lo que leyó fue lo que la policy le dejaba ver:
-- devocionales publicados de iglesias con web pública. Ningún nombre salió; sí
-- un identificador de ficha, con el que se puede correlacionar cuántos
-- devocionales firma cada persona de una congregación.
--
-- Es la segunda vez que las dos capas se confunden. La primera fue la `0005`:
-- «las policies se suman con OR, y los GRANT por columna solo recortan a
-- `anon`». La lección hermana es esta: **un GRANT por columna no recorta nada
-- si el GRANT de tabla sigue puesto.**
-- ===========================================================================

-- --- 1. Cerrar la tabla que quedó abierta ----------------------------------
-- `revoke all` se lleva por delante también el grant por columna de la `0012`,
-- así que hay que volver a concederlo justo después. El orden importa.
revoke all on public.devocionales from anon, authenticated, service_role;

-- Y se repone, palabra por palabra, el recorte que la `0012` quiso hacer.
-- Ahora sí recorta: sin grant de tabla debajo, esta lista es la lista.
--
-- `autor_miembro_id`, `video_url`, `created_at` y `updated_at` NO están, y no es
-- olvido: el devocional se firma con el nombre del autor, que se resuelve en el
-- servidor, y el enlace de vídeo lo pinta `/i/[slug]`, que va por `dbAdmin`.
grant select (
  id, iglesia_id, fecha, titulo, versiculo, referencia, cuerpo, imagen_url, publicado
) on public.devocionales to anon;

-- --- 2. Invertir el defecto, para que esto no vuelva a pasar ---------------
-- Lo mismo que hizo la `0003` con las funciones. A partir de aquí, una tabla
-- nueva en `public` nace SIN nada para los roles del navegador, y abrirla es un
-- acto deliberado que se ve en la revisión.
--
-- Se incluye `service_role` —la `0003` no lo hizo con las funciones— porque es
-- una puerta distinta de `dbAdmin`: `dbAdmin` entra como `postgres` por
-- `DATABASE_URL`, mientras que `service_role` entra por PostgREST con una clave
-- que viaja en variables de entorno y ADEMÁS tiene BYPASSRLS. Es la clave que
-- ESTADO.md lleva desde el 16-ago pidiendo rotar.
--
-- No rompe nada porque en este repo NINGUNA consulta de datos va por
-- supabase-js: todo pasa por `withUser`, `withAnon` o `dbAdmin`, que son
-- conexiones directas de postgres-js. Storage vive en el esquema `storage` y no
-- le afecta.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

-- --- 3. La auditoría, que ESTADO.md llevaba pidiendo -----------------------
-- Es la tabla que guarda copia de los datos antes y después de cada cambio
-- sobre miembros: el sitio con más dato del art. 9 por metro cuadrado de toda
-- la base. `service_role` la leía entera saltándose la RLS.
revoke all on public.auditoria from anon, authenticated, service_role;

-- Y las otras dos que se quedaron atrás por lo mismo, porque las migraciones
-- anteriores a la `0017` revocaban solo `from anon, authenticated`.
revoke all on public.consentimientos from anon, authenticated, service_role;
revoke all on public.solicitudes_ingreso from anon, authenticated, service_role;
