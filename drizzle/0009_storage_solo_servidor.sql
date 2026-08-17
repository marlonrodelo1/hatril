-- ===========================================================================
-- 0009 — En Storage solo escribe el servidor
--
-- LO QUE LA 0008 ENTENDIÓ MAL
-- ---------------------------
-- Creó las policies de escritura `TO hatril_app`, copiando el patrón del resto
-- del proyecto. Y no funciona: `hatril_app` es el rol que fija `withUser()`
-- dentro de una transacción de Drizzle. La API de Storage no pasa por ahí —
-- opera con el rol del JWT, que es `authenticated`.
--
-- Resultado: subir una imagen fallaba siempre. Se descubrió intentándolo, no
-- leyéndolo.
--
-- POR QUÉ NO SE ARREGLA CONCEDIÉNDOSELO A `authenticated`
-- -------------------------------------------------------
-- Sería lo que hace media internet, y aquí es justo lo que `CLAUDE.md` prohíbe:
-- `authenticated` es el rol que el navegador presenta con la publishable key.
-- Todo lo que se le conceda queda accesible desde fuera de la aplicación.
--
-- Además, las policies llaman a `es_pastor()`, que también habría que abrirle,
-- publicando una RPC más.
--
-- LO QUE SE HACE
-- --------------
-- El navegador no habla con Storage. Habla con una server action que ya ha
-- comprobado que quien sube es pastor, y que construye la ruta con el
-- `iglesia_id` del contexto de servidor — el cliente no elige carpeta ni puede
-- pedir otra. La subida va con el service role.
--
-- Es la misma arquitectura que el resto del producto: el navegador tampoco
-- consulta Postgres directamente. Y deja `storage.objects` sin una sola policy
-- de escritura para los roles del navegador, que es más cerrado que lo que
-- intentó la `0008`.
--
-- La lectura pública se queda: el logo y la portada salen en la web de cada
-- iglesia y en el directorio, y eso lo ve cualquiera.
-- ===========================================================================

drop policy if exists iglesias_publico_subir on storage.objects;
drop policy if exists iglesias_publico_actualizar on storage.objects;
drop policy if exists iglesias_publico_borrar on storage.objects;

-- `iglesias_publico_leer` se mantiene tal cual: es la que hace que las imágenes
-- se vean sin firmar cada URL.
