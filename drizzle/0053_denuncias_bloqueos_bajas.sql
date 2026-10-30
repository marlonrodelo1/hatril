-- ===========================================================================
-- 0053 -- Denunciar y bloquear en el muro, y borrar la cuenta
--
-- Lo que hoy impide publicar la app (docs/app-nativa/fichas.md §1): Apple pide
-- poder denunciar el contenido de otros, bloquear a quien molesta y que alguien
-- actúe sobre lo denunciado (norma 1.2), y las dos tiendas piden poder borrar la
-- cuenta desde la propia app (Apple 5.1.1(v)).
--
-- 1. QUIÉN VE UNA DENUNCIA
-- ------------------------
-- Quien la hizo, para que el muro le esconda lo que denunció, y quien modera la
-- comunidad (`puede_moderar_comunidad()`, de la 0027). El autor de lo
-- denunciado, nunca. Quien modera solo puede tocar el estado y quién la revisó:
-- el grant de UPDATE va por columnas, y aquí el recorte sí recorta, porque
-- delante va el `revoke all` (CLAUDE.md, la 0012 y la 0022).
--
-- 2. QUIÉN VE UN BLOQUEO
-- ----------------------
-- Solo quien lo hizo. El bloqueado no puede leer ni sus propias filas como
-- bloqueado: que se entere es justo lo que bloquear promete que no pasará.
--
-- 3. HT136 Y HT137
-- ----------------
-- La coherencia de tenant de siempre: `iglesia_id` va repetido para que cada
-- policy sea una comparación directa, y el precio es validarlo. Una denuncia
-- con el `iglesia_id` de Betania sobre una publicación de Sion le enseñaría al
-- moderador de Betania contenido de otra congregación.
--
-- 4. LAS BAJAS SON DE LA PLATAFORMA
-- ---------------------------------
-- `bajas_cuenta` va como `admin_users` y `registro_admin`: RLS activada,
-- ninguna policy, ningún grant. Una cuenta puede ser de varias iglesias y su
-- borrado no es de ninguna; la escriben la action de «Borrar mi cuenta» y el
-- cron, por `dbAdmin`.
--
-- 5. LOS DOS VALORES NUEVOS DEL ENUM DE AVISOS
-- --------------------------------------------
-- `alter type ... add value` no se puede usar en la misma transacción que lo
-- añade (lo cuenta la 0031). Aquí solo se añaden; nada de este fichero los usa.
-- ===========================================================================

CREATE TYPE "public"."estado_denuncia_enum" AS ENUM('pendiente', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."motivo_denuncia_enum" AS ENUM('ofensivo', 'spam', 'sin_permiso', 'privado', 'otro');--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'denuncia_en_comunidad';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE 'contenido_retirado';--> statement-breakpoint
CREATE TABLE "bloqueos_comunidad" (
	"iglesia_id" uuid NOT NULL,
	"bloqueador_miembro_id" uuid NOT NULL,
	"bloqueado_miembro_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bloqueos_comunidad_bloqueador_miembro_id_bloqueado_miembro_id_pk" PRIMARY KEY("bloqueador_miembro_id","bloqueado_miembro_id"),
	CONSTRAINT "ck_bloqueos_no_a_uno_mismo" CHECK ("bloqueos_comunidad"."bloqueador_miembro_id" <> "bloqueos_comunidad"."bloqueado_miembro_id")
);
--> statement-breakpoint
CREATE TABLE "denuncias_comunidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"denunciante_miembro_id" uuid NOT NULL,
	"publicacion_id" uuid,
	"comentario_id" uuid,
	"motivo" "motivo_denuncia_enum" NOT NULL,
	"detalle" text,
	"estado" "estado_denuncia_enum" DEFAULT 'pendiente' NOT NULL,
	"revisada_at" timestamp with time zone,
	"revisada_por_auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_denuncias_un_objeto" CHECK (("denuncias_comunidad"."publicacion_id" is null) <> ("denuncias_comunidad"."comentario_id" is null))
);
--> statement-breakpoint
CREATE TABLE "bajas_cuenta" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"pedida_at" timestamp with time zone DEFAULT now() NOT NULL,
	"borrar_desde" timestamp with time zone NOT NULL,
	"membresias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completada_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bloqueos_comunidad" ADD CONSTRAINT "bloqueos_comunidad_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos_comunidad" ADD CONSTRAINT "bloqueos_comunidad_bloqueador_miembro_id_miembros_id_fk" FOREIGN KEY ("bloqueador_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos_comunidad" ADD CONSTRAINT "bloqueos_comunidad_bloqueado_miembro_id_miembros_id_fk" FOREIGN KEY ("bloqueado_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denuncias_comunidad" ADD CONSTRAINT "denuncias_comunidad_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denuncias_comunidad" ADD CONSTRAINT "denuncias_comunidad_denunciante_miembro_id_miembros_id_fk" FOREIGN KEY ("denunciante_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denuncias_comunidad" ADD CONSTRAINT "denuncias_comunidad_publicacion_id_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denuncias_comunidad" ADD CONSTRAINT "denuncias_comunidad_comentario_id_publicaciones_comentarios_id_fk" FOREIGN KEY ("comentario_id") REFERENCES "public"."publicaciones_comentarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bloqueos_bloqueado" ON "bloqueos_comunidad" USING btree ("bloqueado_miembro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_denuncias_publicacion" ON "denuncias_comunidad" USING btree ("denunciante_miembro_id","publicacion_id") WHERE "denuncias_comunidad"."publicacion_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_denuncias_comentario" ON "denuncias_comunidad" USING btree ("denunciante_miembro_id","comentario_id") WHERE "denuncias_comunidad"."comentario_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_denuncias_iglesia_estado" ON "denuncias_comunidad" USING btree ("iglesia_id","estado","created_at");
--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- 6. Denuncias: RLS, permisos y policies
-- ---------------------------------------------------------------------------
alter table public.denuncias_comunidad enable row level security;

revoke all on public.denuncias_comunidad
  from anon, authenticated, service_role;

grant select, insert on public.denuncias_comunidad to hatril_app;
grant update (estado, revisada_at, revisada_por_auth_user_id)
  on public.denuncias_comunidad to hatril_app;

create policy denuncias_select_propia_o_moderador
  on public.denuncias_comunidad
  for select to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and (
      denunciante_miembro_id = public.miembro_actual(iglesia_id)
      or public.puede_moderar_comunidad(iglesia_id)
    )
  );

-- Nace pendiente y sin revisar: nadie mete una denuncia ya «descartada» para
-- que no le llegue a quien modera.
create policy denuncias_insert_propia
  on public.denuncias_comunidad
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and denunciante_miembro_id = public.miembro_actual(iglesia_id)
    and estado = 'pendiente'
    and revisada_at is null
    and revisada_por_auth_user_id is null
  );

create policy denuncias_update_moderador
  on public.denuncias_comunidad
  for update to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and public.puede_moderar_comunidad(iglesia_id)
  )
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and public.puede_moderar_comunidad(iglesia_id)
  );


-- ---------------------------------------------------------------------------
-- 7. HT136 — la denuncia, quien denuncia y lo denunciado son de la misma
--    iglesia
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_denuncia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.miembros m
     where m.id = new.denunciante_miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT136: la persona que denuncia no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.publicacion_id is not null and not exists (
    select 1 from public.publicaciones p
     where p.id = new.publicacion_id
       and p.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT136: la publicacion no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  if new.comentario_id is not null and not exists (
    select 1 from public.publicaciones_comentarios c
     where c.id = new.comentario_id
       and c.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT136: el comentario no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_denuncia()
  from public, anon, authenticated, service_role;

create trigger trg_denuncias_coherencia
  before insert or update on public.denuncias_comunidad
  for each row execute function public.validar_iglesia_denuncia();


-- ---------------------------------------------------------------------------
-- 8. Bloqueos: RLS, permisos y policies
--
-- Sin UPDATE: un bloqueo no se edita, se quita.
-- ---------------------------------------------------------------------------
alter table public.bloqueos_comunidad enable row level security;

revoke all on public.bloqueos_comunidad
  from anon, authenticated, service_role;

grant select, insert, delete on public.bloqueos_comunidad to hatril_app;

create policy bloqueos_select_propio
  on public.bloqueos_comunidad
  for select to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and bloqueador_miembro_id = public.miembro_actual(iglesia_id)
  );

create policy bloqueos_insert_propio
  on public.bloqueos_comunidad
  for insert to hatril_app
  with check (
    public.pertenece_a_iglesia(iglesia_id)
    and bloqueador_miembro_id = public.miembro_actual(iglesia_id)
  );

create policy bloqueos_delete_propio
  on public.bloqueos_comunidad
  for delete to hatril_app
  using (
    public.pertenece_a_iglesia(iglesia_id)
    and bloqueador_miembro_id = public.miembro_actual(iglesia_id)
  );


-- ---------------------------------------------------------------------------
-- 9. HT137 — las dos personas del bloqueo son de la iglesia del bloqueo
-- ---------------------------------------------------------------------------
create or replace function public.validar_iglesia_bloqueo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    select count(*) from public.miembros m
     where m.id in (new.bloqueador_miembro_id, new.bloqueado_miembro_id)
       and m.iglesia_id = new.iglesia_id
  ) <> 2 then
    raise exception 'HT137: las dos personas del bloqueo tienen que ser de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_iglesia_bloqueo()
  from public, anon, authenticated, service_role;

create trigger trg_bloqueos_coherencia
  before insert or update on public.bloqueos_comunidad
  for each row execute function public.validar_iglesia_bloqueo();


-- ---------------------------------------------------------------------------
-- 10. Bajas de cuenta: de la plataforma, cerrada a todos
-- ---------------------------------------------------------------------------
alter table public.bajas_cuenta enable row level security;

revoke all on public.bajas_cuenta from anon, authenticated, service_role;

-- El cron busca las que ya toca borrar. Parcial: las completadas no se vuelven
-- a mirar.
create index idx_bajas_cuenta_pendientes
  on public.bajas_cuenta (borrar_desde)
  where completada_at is null;
