-- ===========================================================================
-- 0008 — Imágenes de la iglesia en Supabase Storage
--
-- Primer uso de Storage en el proyecto. Las columnas `logo_url` y `banner_url`
-- llevaban desde la `0000` y el `remotePatterns` de `next.config.ts` ya apuntaba
-- aquí; lo que faltaba era el sitio donde dejar los ficheros.
--
-- UN BUCKET PÚBLICO, Y ES UNA DECISIÓN
-- ------------------------------------
-- La portada y el logo de una iglesia salen en su web pública y en el
-- directorio. Servirlos con URL firmada obligaría a renovar la firma en cada
-- visita de un visitante anónimo, y a que la caché de la CDN no sirviera de
-- nada.
--
-- Que sea público significa que quien tenga la URL ve la imagen. Es aceptable
-- SOLO porque aquí no va nada que identifique a una persona: son el logo y la
-- fachada del edificio. **Las fotos de los miembros irán en otro bucket,
-- privado y con URL firmada**, y por eso este se llama `iglesias-publico` y no
-- `imagenes` a secas: el nombre impide que alguien meta ahí un retrato por
-- descuido.
--
-- LAS RUTAS LLEVAN EL UUID DE LA IGLESIA
-- --------------------------------------
-- `<iglesia_id>/logo.webp`. Es lo que permite escribir las policies: la primera
-- carpeta del nombre del fichero decide de quién es. Sin eso, cualquier iglesia
-- podría sobrescribir el logo de otra, que es un defacement con todas las letras.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iglesias-publico',
  'iglesias-publico',
  true,
  2097152,  -- 2 MB. Un logo y una portada; por encima de esto es una foto sin redimensionar.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- Policies sobre `storage.objects`
--
-- Storage es otra tabla con RLS, y se le aplica la MISMA regla que al resto del
-- proyecto: el aislamiento lo pone la base de datos. Aquí es más importante
-- todavía, porque el bucket es público de lectura y lo único que separa a una
-- iglesia de otra al ESCRIBIR son estas cuatro policies.
--
-- `storage.foldername(name)` devuelve el array de carpetas del fichero; su
-- primer elemento es el uuid de la iglesia. Se compara con `es_pastor()`, la
-- misma función que gobierna los ajustes: quien puede cambiar el nombre de la
-- iglesia es quien puede cambiar su logo.
-- ---------------------------------------------------------------------------

-- Lectura para cualquiera. Es un bucket público: sin esto, la web no pinta nada.
drop policy if exists iglesias_publico_leer on storage.objects;
create policy iglesias_publico_leer on storage.objects
  for select to public
  using (bucket_id = 'iglesias-publico');

-- Escritura solo del pastor, y solo dentro de la carpeta de SU iglesia.
drop policy if exists iglesias_publico_subir on storage.objects;
create policy iglesias_publico_subir on storage.objects
  for insert to hatril_app
  with check (
    bucket_id = 'iglesias-publico'
    and public.es_pastor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists iglesias_publico_actualizar on storage.objects;
create policy iglesias_publico_actualizar on storage.objects
  for update to hatril_app
  using (
    bucket_id = 'iglesias-publico'
    and public.es_pastor(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'iglesias-publico'
    and public.es_pastor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists iglesias_publico_borrar on storage.objects;
create policy iglesias_publico_borrar on storage.objects
  for delete to hatril_app
  using (
    bucket_id = 'iglesias-publico'
    and public.es_pastor(((storage.foldername(name))[1])::uuid)
  );

-- `es_pastor()` estaba concedida solo a `hatril_app`. Estas policies la invocan
-- desde `storage.objects`, y el rol que las evalúa es el mismo, así que no hace
-- falta abrir nada. Se deja dicho para que nadie «arregle» un permiso que no
-- falta concediéndosela a `authenticated`.
