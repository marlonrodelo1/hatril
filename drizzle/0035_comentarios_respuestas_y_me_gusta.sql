-- ===========================================================================
-- 0035 — Responder a un comentario, y darle «me gusta»
--
-- Dos cosas que el muro pedía a gritos y que hasta ahora no se podían hacer:
-- contestarle a alguien —hoy había que escribir «@Lucía, ...» en un comentario
-- suelto y confiar— y decir «amén» sin escribir un comentario más.
--
-- UN SOLO NIVEL DE RESPUESTA
-- --------------------------
-- `respuesta_a_id` apunta a otro comentario de la MISMA publicación, y ese
-- comentario no puede ser a su vez una respuesta. El tope no es de diseño
-- gráfico: sin él, una conversación de siete niveles en un móvil de 360 px
-- termina en una columna de cuatro caracteres de ancho. Instagram y Facebook
-- hacen exactamente esto, y por lo mismo.
--
-- POR QUÉ NO SE REUSA `publicaciones_me_gusta`
-- --------------------------------------------
-- Añadirle una columna `tipo` y dejar que `publicacion_id` apunte unas veces a
-- una publicación y otras a un comentario es una referencia polimórfica: la
-- clave ajena desaparece —no se puede declarar una que apunte a dos tablas— y
-- con ella la garantía de que la fila referida existe. Cada consulta se llena
-- de `case` y cada borrado deja huérfanos. Una tabla más sale más barata.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. La respuesta
-- ---------------------------------------------------------------------------
alter table public.publicaciones_comentarios
  add column respuesta_a_id uuid
    references public.publicaciones_comentarios (id) on delete cascade;

comment on column public.publicaciones_comentarios.respuesta_a_id is
  'A que comentario responde este. NULL es un comentario de primer nivel. Un solo nivel: HT120 impide responder a una respuesta.';

create index idx_comentarios_respuesta
  on public.publicaciones_comentarios (respuesta_a_id, created_at);


-- ---------------------------------------------------------------------------
-- 2. El «me gusta» del comentario
--
-- REVOKE ANTES DE GRANT, Y NO ES CEREMONIA
-- ----------------------------------------
-- La `0022` invirtió el defecto de esta base para que una tabla nueva nazca
-- cerrada, así que aquí sobraría. Se escribe igual porque el fichero tiene que
-- decir la verdad en cualquier otra base, y porque la `0012` —la única que hizo
-- `grant` sin `revoke` delante— dejó `devocionales` legible desde el navegador
-- durante meses con la clave publicable.
-- ---------------------------------------------------------------------------
create table public.publicaciones_comentarios_me_gusta (
  iglesia_id    uuid not null references public.iglesias (id)                     on delete cascade,
  comentario_id uuid not null references public.publicaciones_comentarios (id)    on delete cascade,
  miembro_id    uuid not null references public.miembros (id)                     on delete cascade,
  created_at    timestamptz not null default now(),

  -- La clave primaria ES la regla de «no se puede dar dos veces». Sin ella
  -- habría que consultar antes de insertar, y entre la consulta y el insert
  -- caben dos toques rápidos del mismo pulgar.
  primary key (comentario_id, miembro_id)
);

comment on table public.publicaciones_comentarios_me_gusta is
  'Me gusta de un comentario del muro. Tabla propia y no una columna tipo en publicaciones_me_gusta: ver la cabecera de la 0035.';

create index idx_comentarios_me_gusta_miembro
  on public.publicaciones_comentarios_me_gusta (miembro_id);

alter table public.publicaciones_comentarios_me_gusta enable row level security;

revoke all on public.publicaciones_comentarios_me_gusta
  from anon, authenticated, service_role;

grant select, insert, delete on public.publicaciones_comentarios_me_gusta
  to hatril_app;


-- ---------------------------------------------------------------------------
-- 3. Policies
--
-- Calcadas de `publicaciones_me_gusta` (0015): se leen todos los de la iglesia
-- —hace falta para contar— y solo se pone y se quita el propio. No hay UPDATE:
-- un «me gusta» no se edita, se quita y se vuelve a poner.
-- ---------------------------------------------------------------------------
create policy comentarios_me_gusta_select_iglesia
  on public.publicaciones_comentarios_me_gusta
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

create policy comentarios_me_gusta_insert_propio
  on public.publicaciones_comentarios_me_gusta
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and miembro_id = public.miembro_actual(iglesia_id)
  );

create policy comentarios_me_gusta_delete_propio
  on public.publicaciones_comentarios_me_gusta
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and miembro_id = public.miembro_actual(iglesia_id)
  );


-- ---------------------------------------------------------------------------
-- 4. HT120 — la respuesta se queda en su publicación y en su nivel
--
-- Dos cosas que la RLS no puede mirar, porque no son sobre quién eres sino
-- sobre la forma del árbol:
--
--   a) responder a un comentario de OTRA publicación —o de otra iglesia—
--      colgaría una respuesta donde nadie la espera, y en una iglesia distinta
--      sería una fuga entre congregaciones con todas las letras;
--   b) responder a una respuesta abriría el tercer nivel.
--
-- Va en un trigger y no en un CHECK porque un CHECK no puede consultar otra
-- fila.
-- ---------------------------------------------------------------------------
create or replace function public.guard_respuesta_comentario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_publicacion uuid;
  v_iglesia     uuid;
  v_padre       uuid;
begin
  if new.respuesta_a_id is null then
    return new;
  end if;

  if new.respuesta_a_id = new.id then
    raise exception 'HT120: un comentario no puede responderse a si mismo'
      using errcode = 'check_violation';
  end if;

  select publicacion_id, iglesia_id, respuesta_a_id
    into v_publicacion, v_iglesia, v_padre
    from public.publicaciones_comentarios
   where id = new.respuesta_a_id;

  if not found then
    raise exception 'HT120: la respuesta apunta a un comentario que no existe'
      using errcode = 'check_violation';
  end if;

  if v_publicacion is distinct from new.publicacion_id
     or v_iglesia is distinct from new.iglesia_id then
    raise exception 'HT120: una respuesta pertenece a la misma publicacion que el comentario al que responde'
      using errcode = 'check_violation';
  end if;

  if v_padre is not null then
    raise exception 'HT120: no se puede responder a una respuesta'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Una función NO nace cerrada, pese a lo que llegó a decir este repo. Ver la
-- `0007` y el apartado de funciones de CLAUDE.md.
revoke execute on function public.guard_respuesta_comentario()
  from public, anon, authenticated, service_role;

create trigger trg_comentarios_respuesta
  before insert or update on public.publicaciones_comentarios
  for each row execute function public.guard_respuesta_comentario();


-- ---------------------------------------------------------------------------
-- 5. HT121 — coherencia de tenant en el «me gusta» del comentario
--
-- Mismo motivo que HT102 y que el resto de las hijas: `iglesia_id` está
-- repetido a propósito para que cada policy sea una comparación directa en vez
-- de una subconsulta de tres saltos, y el precio de esa redundancia es que hay
-- que validarla. Una fila con el `iglesia_id` de Betania sobre un comentario de
-- Sion haría mentir a `pertenece_a_iglesia()`.
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_comentario_me_gusta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.publicaciones_comentarios c
     where c.id = new.comentario_id
       and c.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT121: el comentario no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.miembros m
     where m.id = new.miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT121: la persona no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_comentario_me_gusta()
  from public, anon, authenticated, service_role;

create trigger trg_comentarios_me_gusta_coherencia
  before insert or update on public.publicaciones_comentarios_me_gusta
  for each row execute function public.validar_iglesia_comentario_me_gusta();
