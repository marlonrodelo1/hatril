CREATE TABLE "devocionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"titulo" text,
	"versiculo" text,
	"referencia" text,
	"cuerpo" text,
	"imagen_url" text,
	"autor_miembro_id" uuid,
	"publicado" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_devocional_iglesia_fecha" UNIQUE("iglesia_id","fecha")
);
--> statement-breakpoint
ALTER TABLE "devocionales" ADD CONSTRAINT "devocionales_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_devocionales_iglesia_fecha" ON "devocionales" USING btree ("iglesia_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_devocionales_autor" ON "devocionales" USING btree ("autor_miembro_id");

-- ===========================================================================
-- Lo que el generador no escribe, y que aquí es la mitad importante.
--
-- Una tabla nueva SIN RLS es una tabla abierta: `hatril_app` tiene grants por
-- esquema, así que sin policies vería los devocionales de todas las iglesias.
-- Es exactamente el fallo que este proyecto existe para no cometer.
-- ===========================================================================

alter table public.devocionales enable row level security;

-- --- Permisos base ---------------------------------------------------------
-- `hatril_app` la maneja entera; el recorte lo hacen las policies.
grant select, insert, update, delete on public.devocionales to hatril_app;

-- `anon` solo lee, y solo las columnas que salen publicadas. `autor_miembro_id`
-- NO se concede: el devocional se firma con el nombre, que se resuelve en el
-- servidor, y el id de una ficha no tiene por qué salir a internet.
grant select (
  id, iglesia_id, fecha, titulo, versiculo, referencia, cuerpo, imagen_url, publicado
) on public.devocionales to anon;

-- --- Policies --------------------------------------------------------------

-- Dentro de la iglesia se ve todo, publicado o no: el borrador de mañana lo
-- tiene que poder leer quien lo está escribiendo.
create policy devocionales_select_iglesia on public.devocionales
  for select to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

-- Fuera solo lo publicado, y solo de una iglesia con web pública abierta.
--
-- Se comprueba `web_publica` y no `visible_en_directorio`: son decisiones
-- distintas —una iglesia puede tener página sin salir en el buscador— y lo que
-- gobierna esta tabla es la página.
create policy devocionales_select_publico on public.devocionales
  for select to anon
  using (
    publicado = true
    and exists (
      select 1 from public.iglesias i
      where i.id = devocionales.iglesia_id
        and i.activa = true
        and i.web_publica = true
    )
  );

-- Escribir: cualquiera de la iglesia a ojos de la base de datos. Quién puede de
-- verdad lo decide `escribir_devocionales` en TypeScript, igual que el resto del
-- modelo de permisos (ver `0001:330-339`): la RLS aísla congregaciones, no
-- reparte capacidades dentro de una.
create policy devocionales_write_iglesia on public.devocionales
  for insert to hatril_app
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy devocionales_update_iglesia on public.devocionales
  for update to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id))
  with check (public.pertenece_a_iglesia(iglesia_id));

create policy devocionales_delete_iglesia on public.devocionales
  for delete to hatril_app
  using (public.pertenece_a_iglesia(iglesia_id));

-- --- Coherencia y rastro ---------------------------------------------------

-- El autor tiene que ser de la misma iglesia. Sin esto, una server action con
-- un uuid manipulado firmaría el devocional con alguien de otra congregación.
-- Es el hueco que `ministerios.lider_miembro_id` tuvo hasta la `0005`.
create or replace function public.validar_iglesia_devocional()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.autor_miembro_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.miembros m
     where m.id = new.autor_miembro_id
       and m.iglesia_id = new.iglesia_id
  ) then
    raise exception 'HT105: el autor del devocional no es de esta iglesia'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Cerrada, como manda `CLAUDE.md`. Una función de trigger no necesita EXECUTE
-- para dispararse, y la `0007` demostró que el defecto no basta: hay que
-- revocar a mano.
revoke execute on function public.validar_iglesia_devocional()
  from public, anon, authenticated, service_role;

create trigger trg_devocionales_coherencia
  before insert or update on public.devocionales
  for each row execute function public.validar_iglesia_devocional();

create trigger trg_devocionales_touch
  before update on public.devocionales
  for each row execute function public.touch_updated_at();

-- Se audita como el resto: un devocional lleva el nombre de una persona y sale
-- publicado con él.
create trigger trg_auditar_devocionales
  after insert or update or delete on public.devocionales
  for each row execute function public.auditar();
