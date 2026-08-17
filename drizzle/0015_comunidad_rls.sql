-- ===========================================================================
-- 0015 — El muro de la comunidad: RLS, permisos y el bucket privado
--
-- La 0014 creó las tres tablas. Vacías de policies, una tabla nueva en este
-- proyecto es exactamente el incidente que `CLAUDE.md` cuenta de Gonper: queda
-- abierta a `anon` por PostgREST. Aquí está todo lo que falta.
--
-- QUÉ SE PUEDE HACER Y QUIÉN
-- --------------------------
--   leer            → cualquier miembro ACTIVO de la iglesia
--   publicar        → cualquier miembro activo, y solo firmando con SU ficha
--   me gusta        → igual, y solo el suyo
--   comentar        → igual
--   editar          → solo el autor. Ni el pastor: cambiarle el texto a otro y
--                     dejar su nombre debajo es suplantarle.
--   borrar          → el autor, o el pastor. El pastor no puede reescribir,
--                     pero sí tiene que poder quitar. Es su congregación y
--                     responde ella de lo que se publica.
--
-- «Miembro activo» sale de `pertenece_a_iglesia()`, que ya exige
-- `iglesia_usuarios.estado = 'activo'`: quien solicitó el ingreso y espera
-- aprobación no ve el muro. Que es justo lo que se pidió.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Quién soy yo dentro de esta iglesia
--
-- Las policias de escritura tienen que comprobar que la fila se firma con la
-- ficha de quien escribe, no con la de otro. `pertenece_a_iglesia()` contesta
-- «sí, es de la casa», que no basta: sin esto, cualquier miembro podría publicar
-- en nombre del pastor.
--
-- Devuelve el `miembros.id` de quien pide, o NULL si no tiene ficha en esa
-- iglesia. NULL hace fallar la comparación de la policy, que es lo correcto:
-- una cuenta sin ficha no publica.
--
-- SALE DE `iglesia_usuarios`, NO DE `miembros`
-- --------------------------------------------
-- La primera versión buscaba en `miembros` por `auth_user_id` y `estado =
-- 'activo'`, y la migración se cayó entera: `miembros.estado` es
-- `estado_miembro_enum` —visitante, nuevo, miembro, inactivo, baja— y ahí
-- 'activo' no existe. El que sí lo tiene es `iglesia_usuarios.estado`
-- (pendiente, activo, rechazado, baja), que es OTRA cosa: uno describe la
-- situación de la persona en la congregación, el otro si su cuenta tiene acceso.
--
-- Los dos enums se parecen y significan cosas distintas. Aquí manda el del
-- acceso, el mismo que usa `pertenece_a_iglesia()`, y la ficha se toma del
-- vínculo en vez de volver a buscarla.
-- ---------------------------------------------------------------------------
create or replace function public.miembro_actual(p_iglesia_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select iu.miembro_id
    from public.iglesia_usuarios iu
   where iu.iglesia_id = p_iglesia_id
     and iu.auth_user_id = (select auth.uid())
     and iu.estado = 'activo'
   limit 1;
$$;

-- Cerrada por defecto, como todas. Esto NO lo hace el `alter default
-- privileges` de la 0003 —la 0007 explica por qué—, así que se revoca a mano.
revoke execute on function public.miembro_actual(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.miembro_actual(uuid) to hatril_app;


-- ---------------------------------------------------------------------------
-- 2. RLS activada antes que nada
-- ---------------------------------------------------------------------------
alter table public.publicaciones              enable row level security;
alter table public.publicaciones_me_gusta     enable row level security;
alter table public.publicaciones_comentarios  enable row level security;


-- ---------------------------------------------------------------------------
-- 3. Permisos de tabla
--
-- A `hatril_app` lo justo; a `anon` y `authenticated`, nada. Ni una columna:
-- saber que una persona ha comentado en el muro de una iglesia ya revela su
-- confesión religiosa.
-- ---------------------------------------------------------------------------
revoke all on public.publicaciones             from anon, authenticated;
revoke all on public.publicaciones_me_gusta    from anon, authenticated;
revoke all on public.publicaciones_comentarios from anon, authenticated;

grant select, insert, update, delete on
  public.publicaciones,
  public.publicaciones_me_gusta,
  public.publicaciones_comentarios
to hatril_app;


-- ---------------------------------------------------------------------------
-- 4. Policies
-- ---------------------------------------------------------------------------

-- --- publicaciones ---------------------------------------------------------

create policy publicaciones_select_iglesia on public.publicaciones
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy publicaciones_insert_propia on public.publicaciones
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  );

-- Editar, solo lo tuyo. Y el `with check` repite la condición para que no se
-- pueda usar un UPDATE para cambiarle el autor a la fila.
create policy publicaciones_update_autor on public.publicaciones
  for update to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  )
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  );

create policy publicaciones_delete_autor_o_pastor on public.publicaciones
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and (
      autor_miembro_id = public.miembro_actual(iglesia_id)
      or public.es_pastor(iglesia_id)
    )
  );


-- --- me gusta --------------------------------------------------------------
--
-- Se leen todos los de la iglesia —hace falta para contar— pero solo se pone y
-- se quita el propio.

create policy me_gusta_select_iglesia on public.publicaciones_me_gusta
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy me_gusta_insert_propio on public.publicaciones_me_gusta
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and miembro_id = public.miembro_actual(iglesia_id)
  );

create policy me_gusta_delete_propio on public.publicaciones_me_gusta
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and miembro_id = public.miembro_actual(iglesia_id)
  );


-- --- comentarios -----------------------------------------------------------

create policy comentarios_select_iglesia on public.publicaciones_comentarios
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy comentarios_insert_propio on public.publicaciones_comentarios
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  );

create policy comentarios_update_autor on public.publicaciones_comentarios
  for update to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  )
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and autor_miembro_id = public.miembro_actual(iglesia_id)
  );

create policy comentarios_delete_autor_o_pastor on public.publicaciones_comentarios
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and (
      autor_miembro_id = public.miembro_actual(iglesia_id)
      or public.es_pastor(iglesia_id)
    )
  );


-- ---------------------------------------------------------------------------
-- 5. Coherencia de tenant en las tablas hijas
--
-- `iglesia_id` está repetido en las hijas a propósito —cada policy es una
-- comparación directa en vez de una subconsulta de tres saltos— y el precio de
-- esa redundancia es que hay que validarla. Igual que HT102 en
-- `ministerio_miembros`.
-- ---------------------------------------------------------------------------

create or replace function public.validar_iglesia_me_gusta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  iglesia_publicacion uuid;
  iglesia_miembro uuid;
begin
  select iglesia_id into iglesia_publicacion
    from public.publicaciones where id = new.publicacion_id;
  select iglesia_id into iglesia_miembro
    from public.miembros where id = new.miembro_id;

  if iglesia_publicacion is distinct from new.iglesia_id
     or iglesia_miembro is distinct from new.iglesia_id then
    raise exception
      'HT106: la publicacion y el miembro deben ser de la misma iglesia que la fila'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_me_gusta()
  from public, anon, authenticated, service_role;

create trigger trg_me_gusta_coherencia
  before insert or update on public.publicaciones_me_gusta
  for each row execute function public.validar_iglesia_me_gusta();


create or replace function public.validar_iglesia_comentario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  iglesia_publicacion uuid;
  iglesia_autor uuid;
begin
  select iglesia_id into iglesia_publicacion
    from public.publicaciones where id = new.publicacion_id;
  select iglesia_id into iglesia_autor
    from public.miembros where id = new.autor_miembro_id;

  if iglesia_publicacion is distinct from new.iglesia_id
     or iglesia_autor is distinct from new.iglesia_id then
    raise exception
      'HT107: la publicacion y el autor deben ser de la misma iglesia que la fila'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_comentario()
  from public, anon, authenticated, service_role;

create trigger trg_comentarios_coherencia
  before insert or update on public.publicaciones_comentarios
  for each row execute function public.validar_iglesia_comentario();


-- La publicación también: su autor tiene que ser de su misma iglesia.
create or replace function public.validar_iglesia_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  iglesia_autor uuid;
begin
  select iglesia_id into iglesia_autor
    from public.miembros where id = new.autor_miembro_id;

  if iglesia_autor is distinct from new.iglesia_id then
    raise exception 'HT108: el autor debe ser de la misma iglesia que la publicacion'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_publicacion()
  from public, anon, authenticated, service_role;

create trigger trg_publicaciones_coherencia
  before insert or update on public.publicaciones
  for each row execute function public.validar_iglesia_publicacion();


-- `updated_at` al día, con la función que ya existe desde la 0001.
create trigger trg_publicaciones_touch
  before update on public.publicaciones
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- 6. El bucket de las fotos del muro: PRIVADO
--
-- La 0008 lo dejó escrito cuando creó `iglesias-publico`: «las fotos de los
-- miembros irán en otro bucket, privado y con URL firmada». Este es ese bucket.
--
-- La diferencia no es de matiz. En una foto del muro de una iglesia sale gente
-- reconocible, y con frecuencia menores. Pública, cualquiera con la URL la ve
-- para siempre y sin dejar rastro; privada, cada visita necesita una firma que
-- caduca y que solo emite el servidor después de comprobar que quien mira es de
-- la congregación.
--
-- SIN POLICIES DE ESCRITURA PARA LOS ROLES DEL NAVEGADOR
-- ------------------------------------------------------
-- Es la lección de la 0009: la API de Storage opera con el rol del JWT
-- (`authenticated`), no con `hatril_app`, así que una policy `to hatril_app`
-- aquí no serviría de nada y una `to authenticated` abriría el bucket a
-- cualquiera con la publishable key. El navegador no habla con Storage: habla
-- con una server action que ya ha comprobado quién es y sube con el service
-- role, que se salta las policies por definición.
--
-- El límite de tamaño es 5 MB: una foto de móvil sin redimensionar ronda los 3-4
-- y la aplicación no comprime todavía.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comunidad',
  'comunidad',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
