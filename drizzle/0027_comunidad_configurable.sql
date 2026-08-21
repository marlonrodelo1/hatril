-- ===========================================================================
-- 0027 — La comunidad se configura, y se configura EN LA BASE DE DATOS
--
-- La 0026 añadió a `iglesias` los cuatro campos: `comunidad_activa`,
-- `comunidad_quien_publica`, `comunidad_comentarios` y `comunidad_fotos`. Esta
-- migración es la que hace que signifiquen algo.
--
-- POR QUÉ NO BASTA CON ESCONDER EL BOTÓN
-- --------------------------------------
-- Porque un interruptor que solo vive en el JSX es decoración. El muro se
-- escribe con server actions, sí, pero la lección de este repo está escrita en
-- CLAUDE.md y costó meses descubrirla: la `0012` recortó `devocionales` por
-- columnas confiando en un `grant select (col, col)` y el recorte no recortaba
-- nada, porque debajo seguía el grant de tabla entera. Durante meses una
-- petición con la clave publicable devolvía 200 sobre la columna que esa misma
-- migración creía haber cerrado.
--
-- Aquí el riesgo es el mismo con otra forma: el día que alguien añada una
-- action nueva —o un endpoint para la app móvil de la v2, que ya está en el
-- plan— tendría que acordarse de comprobar los cuatro campos a mano. La base
-- de datos no se olvida.
--
-- QUÉ SE PUEDE HACER Y QUIÉN, DESPUÉS DE ESTA MIGRACIÓN
-- -----------------------------------------------------
--   leer            → cualquier miembro ACTIVO. NO depende de `comunidad_activa`
--   publicar        → miembro activo, con SU ficha, y solo si la comunidad está
--                     encendida y su rol entra en `comunidad_quien_publica`
--   fotos           → además, solo si `comunidad_fotos`
--   me gusta        → miembro activo, el suyo, y solo con la comunidad encendida
--   comentar        → igual, y además solo si `comunidad_comentarios`
--   editar          → solo el autor. Ni el pastor, como antes
--   borrar          → el autor, o quien puede moderar (ver más abajo)
--
-- POR QUÉ APAGARLA NO CIERRA LA LECTURA
-- -------------------------------------
-- Apagar la comunidad es dejar de escribir en ella, no borrarla. Si el SELECT
-- dependiera de `comunidad_activa`, apagarla un domingo dejaría inaccesible
-- todo lo publicado y volver a encenderla sería la única forma de recuperarlo —
-- con el pánico de por medio de creer que se ha perdido. La aplicación deja de
-- pintar la sección; el contenido sigue ahí, y el día que se vuelva a encender
-- está donde estaba.
--
-- SOBRE `puede_moderar_comunidad` Y EL jsonb DE PERMISOS
-- ------------------------------------------------------
-- La 0001 dejó escrito, y con razón, que el modelo de permisos NO se escribe
-- dos veces —una en TypeScript y otra en SQL— porque las dos copias se separan.
-- Esta función es la única excepción del repo y está acotada para poder serlo:
-- NO replica la tabla de defectos por rol. Solo mira dos cosas, que son las dos
-- que no dependen de esa tabla:
--
--   1. Si es pastor, por `es_pastor()`. El pastor modera por serlo.
--   2. Si en `iglesia_usuarios.permisos` hay un `"moderar_comunidad": true`
--      literal.
--
-- Eso funciona porque `moderar_comunidad` no es defecto de ningún rol en
-- `src/lib/auth/permisos.ts` — está documentado ahí mismo y es la razón de que
-- lo sea. El jsonb guarda solo las EXCEPCIONES sobre el defecto, así que para
-- este permiso concreto «estar en el jsonb como true» y «tenerlo» son lo mismo.
-- Si algún día se convirtiera en defecto de un rol, esta función se quedaría
-- corta y la interfaz enseñaría un botón de borrar que la RLS rechazaría.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Las preguntas que hacen las policies
--
-- Cuatro funciones cortas en vez de meter los `exists` dentro de cada policy:
-- las condiciones se repiten en varias tablas y una sola definición evita que
-- publicar y comentar acaben comprobando cosas distintas.
--
-- Todas `stable` y `security definer`, como sus hermanas de la 0001 y la 0015:
-- consultan `iglesias` e `iglesia_usuarios`, que tienen sus propias policies, y
-- sin `definer` la comprobación se mordería la cola.
-- ---------------------------------------------------------------------------

create or replace function public.comunidad_activa(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iglesias
    where id = p_iglesia_id
      and comunidad_activa = true
  );
$$;

-- ¿Puede ESTA persona publicar en el muro de ESTA iglesia?
--
-- Junta las dos condiciones que dependen de la configuración: que la comunidad
-- esté encendida y que su rol entre en `comunidad_quien_publica`. Lo que NO
-- comprueba es la ficha —eso lo sigue haciendo `miembro_actual()` en la propia
-- policy— porque son preguntas distintas y mezclarlas haría imposible saber
-- cuál de las dos falló al depurar.
create or replace function public.comunidad_admite_publicacion(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iglesias i
    join public.iglesia_usuarios u
      on u.iglesia_id = i.id
     and u.auth_user_id = (select auth.uid())
     and u.estado = 'activo'
    where i.id = p_iglesia_id
      and i.comunidad_activa = true
      and (
        i.comunidad_quien_publica = 'todos'
        or (i.comunidad_quien_publica = 'equipo' and u.rol <> 'miembro')
        or (i.comunidad_quien_publica = 'pastor' and u.rol = 'pastor')
      )
  );
$$;

create or replace function public.comunidad_admite_fotos(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iglesias
    where id = p_iglesia_id
      and comunidad_activa = true
      and comunidad_fotos = true
  );
$$;

create or replace function public.comunidad_admite_comentario(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iglesias
    where id = p_iglesia_id
      and comunidad_activa = true
      and comunidad_comentarios = true
  );
$$;

-- Quién puede borrar lo de otro. Ver la nota larga de la cabecera.
create or replace function public.puede_moderar_comunidad(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iglesia_usuarios
    where iglesia_id = p_iglesia_id
      and auth_user_id = (select auth.uid())
      and estado = 'activo'
      and (
        rol = 'pastor'
        -- `->>` y comparación con la cadena 'true': el jsonb guarda booleanos
        -- de JSON, y `->>` los devuelve como texto. Con `->` habría que
        -- comparar contra `'true'::jsonb`, que es más fácil de escribir mal.
        or coalesce(permisos ->> 'moderar_comunidad', 'false') = 'true'
      )
  );
$$;

-- Cerradas por defecto, una a una. Esto NO lo hace el `alter default
-- privileges` de la 0003 —la 0007 explica por qué y lo comprobó con `proacl`—,
-- así que se revoca a mano igual que en la 0015.
revoke execute on function public.comunidad_activa(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.comunidad_admite_publicacion(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.comunidad_admite_fotos(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.comunidad_admite_comentario(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.puede_moderar_comunidad(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.comunidad_activa(uuid) to hatril_app;
grant execute on function public.comunidad_admite_publicacion(uuid) to hatril_app;
grant execute on function public.comunidad_admite_fotos(uuid) to hatril_app;
grant execute on function public.comunidad_admite_comentario(uuid) to hatril_app;
grant execute on function public.puede_moderar_comunidad(uuid) to hatril_app;


-- ---------------------------------------------------------------------------
-- 2. Policies que cambian
--
-- Se hace `drop` + `create` y no `alter policy`: `alter` solo admite cambiar la
-- expresión entera de todas formas, y con drop/create queda en el fichero el
-- texto completo de la policy nueva. Quien lea esta migración dentro de un año
-- no tiene que ir a buscar la 0015 para saber qué quedó.
-- ---------------------------------------------------------------------------

-- --- publicaciones ---------------------------------------------------------

drop policy if exists publicaciones_insert_propia on public.publicaciones;

create policy publicaciones_insert_propia on public.publicaciones
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
    and public.comunidad_admite_publicacion(iglesia_id)
    -- Fotos solo si la iglesia las admite. Si no, se puede publicar igual
    -- mientras el array venga vacío: apagar las fotos no apaga el muro.
    and (
      public.comunidad_admite_fotos(iglesia_id)
      or jsonb_array_length(imagenes) = 0
    )
  );

-- El UPDATE también, y por un motivo que no es evidente: sin la condición de
-- las fotos, quien publica un texto con la cámara apagada podría añadirle
-- imágenes con un UPDATE posterior. Se comprueba en el `with check` —la fila
-- que queda— y no en el `using`, para que una publicación que ya tenía fotos de
-- antes de apagarlas se pueda seguir editando, e incluso quitárselas.
drop policy if exists publicaciones_update_autor on public.publicaciones;

create policy publicaciones_update_autor on public.publicaciones
  for update to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  )
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
    and (
      public.comunidad_admite_fotos(iglesia_id)
      or jsonb_array_length(imagenes) = 0
    )
  );

-- Borrar: el autor, o quien modera. Antes era «el autor o el pastor» y por eso
-- cambia de nombre — dejarle el nombre viejo a una policy que ya no dice eso es
-- lo que hace que la siguiente persona confíe en lo que no es.
drop policy if exists publicaciones_delete_autor_o_pastor on public.publicaciones;

create policy publicaciones_delete_autor_o_moderador on public.publicaciones
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and (
      autor_miembro_id = public.miembro_actual(iglesia_id)
      or public.puede_moderar_comunidad(iglesia_id)
    )
  );


-- --- me gusta --------------------------------------------------------------
--
-- Poner un me gusta con la comunidad apagada no tendría dónde verse, pero sí
-- dispararía un aviso al autor. Quitarlo se deja abierto: nadie debería quedar
-- atrapado en un me gusta que ya no puede retirar.

drop policy if exists me_gusta_insert_propio on public.publicaciones_me_gusta;

create policy me_gusta_insert_propio on public.publicaciones_me_gusta
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and miembro_id = public.miembro_actual(iglesia_id)
    and public.comunidad_activa(iglesia_id)
  );


-- --- comentarios -----------------------------------------------------------

drop policy if exists comentarios_insert_propio on public.publicaciones_comentarios;

create policy comentarios_insert_propio on public.publicaciones_comentarios
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
    and public.comunidad_admite_comentario(iglesia_id)
  );

drop policy if exists comentarios_delete_autor_o_pastor on public.publicaciones_comentarios;

create policy comentarios_delete_autor_o_moderador on public.publicaciones_comentarios
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and (
      autor_miembro_id = public.miembro_actual(iglesia_id)
      or public.puede_moderar_comunidad(iglesia_id)
    )
  );


-- ---------------------------------------------------------------------------
-- 3. Las cuatro columnas nuevas, contadas donde se van a leer
-- ---------------------------------------------------------------------------

comment on column public.iglesias.comunidad_activa is
  'Interruptor del muro interno. Apagarlo impide escribir, NO borra ni oculta lo publicado: la policy de SELECT no lo mira a propósito.';

comment on column public.iglesias.comunidad_quien_publica is
  'todos | equipo (rol distinto de miembro) | pastor. Se aplica en la policy de INSERT de publicaciones, no solo en la interfaz.';

comment on column public.iglesias.comunidad_comentarios is
  'Si es false, nadie comenta. Los comentarios que ya existan siguen viéndose.';

comment on column public.iglesias.comunidad_fotos is
  'Si es false, no se admiten publicaciones con imagenes. Las que ya existan siguen viéndose.';
