-- ===========================================================================
-- 0046 -- Grupos: la pieza de celulas (y manana de clases) dentro de un
-- ministerio
--
-- Generada con db:generate y leida antes de aplicar: solo trae lo de esta
-- tanda -- los dos enums completos, las cuatro tablas y `solicitudes_ingreso.
-- grupo_id`--. La RLS, los grants, las funciones de relacion y los triggers
-- van en la 0047, escrita a mano, como 0041/0042.
--
-- Hasta que se aplique la 0047 estas tablas NO estan cerradas por su propio
-- fichero: lo estan por el defecto que invirtio la 0022. Por eso las dos se
-- aplican juntas, en la misma pasada del migrador.
-- ===========================================================================

CREATE TYPE "public"."estado_semana_grupo_enum" AS ENUM('prevista', 'celebrada', 'no_hubo');--> statement-breakpoint
CREATE TYPE "public"."rol_grupo_enum" AS ENUM('lider', 'auxiliar', 'participante');--> statement-breakpoint
CREATE TABLE "grupo_guias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"semana" date NOT NULL,
	"tema" text NOT NULL,
	"publicado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_grupo_guias_lunes" CHECK (extract(isodow from "grupo_guias"."semana") = 1),
	CONSTRAINT "ck_grupo_guias_tema" CHECK (length(btrim("grupo_guias"."tema")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "grupo_miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"rol_grupo" "rol_grupo_enum" DEFAULT 'participante' NOT NULL,
	"desde" date DEFAULT now(),
	"hasta" date,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupo_semanas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"semana" date NOT NULL,
	"estado" "estado_semana_grupo_enum" DEFAULT 'prevista' NOT NULL,
	"tema" text,
	"asistentes" smallint,
	"visitas" smallint,
	"reportado_por_miembro_id" uuid,
	"reportado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_grupo_semanas_lunes" CHECK (extract(isodow from "grupo_semanas"."semana") = 1),
	CONSTRAINT "ck_grupo_semanas_tema" CHECK ("grupo_semanas"."tema" is null or length(btrim("grupo_semanas"."tema")) between 1 and 120),
	CONSTRAINT "ck_grupo_semanas_cifras" CHECK (("grupo_semanas"."asistentes" is null or "grupo_semanas"."asistentes" between 0 and 500)
          and ("grupo_semanas"."visitas" is null or "grupo_semanas"."visitas" between 0 and 200)),
	CONSTRAINT "ck_grupo_semanas_estado" CHECK (("grupo_semanas"."estado" = 'prevista' and "grupo_semanas"."asistentes" is null and "grupo_semanas"."visitas" is null and "grupo_semanas"."reportado_at" is null)
          or ("grupo_semanas"."estado" = 'no_hubo' and "grupo_semanas"."asistentes" is null and "grupo_semanas"."visitas" is null and "grupo_semanas"."reportado_at" is not null)
          or ("grupo_semanas"."estado" = 'celebrada' and "grupo_semanas"."asistentes" is not null and "grupo_semanas"."visitas" is not null and "grupo_semanas"."reportado_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"zona" text,
	"dia_semana" smallint NOT NULL,
	"hora" time,
	"codigo" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_grupos_nombre" CHECK (length(btrim("grupos"."nombre")) between 1 and 80),
	CONSTRAINT "ck_grupos_zona" CHECK ("grupos"."zona" is null or length(btrim("grupos"."zona")) between 1 and 60),
	CONSTRAINT "ck_grupos_dia" CHECK ("grupos"."dia_semana" between 0 and 6),
	CONSTRAINT "ck_grupos_codigo" CHECK ("grupos"."codigo" ~ '^[A-HJ-NP-Z2-9]{8}$')
);
--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" ADD COLUMN "grupo_id" uuid;--> statement-breakpoint
ALTER TABLE "grupo_guias" ADD CONSTRAINT "grupo_guias_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_guias" ADD CONSTRAINT "grupo_guias_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_semanas" ADD CONSTRAINT "grupo_semanas_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_semanas" ADD CONSTRAINT "grupo_semanas_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_semanas" ADD CONSTRAINT "grupo_semanas_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_guias_semana" ON "grupo_guias" USING btree ("ministerio_id","semana");--> statement-breakpoint
CREATE INDEX "idx_grupo_guias_iglesia" ON "grupo_guias" USING btree ("iglesia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_miembro_activo" ON "grupo_miembros" USING btree ("grupo_id","miembro_id") WHERE activo = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_lider_activo" ON "grupo_miembros" USING btree ("grupo_id") WHERE rol_grupo = 'lider' AND activo = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_participante_por_ministerio" ON "grupo_miembros" USING btree ("ministerio_id","miembro_id") WHERE rol_grupo = 'participante' AND activo = true;--> statement-breakpoint
CREATE INDEX "idx_grupo_miembros_iglesia" ON "grupo_miembros" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_grupo_miembros_grupo" ON "grupo_miembros" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "idx_grupo_miembros_miembro" ON "grupo_miembros" USING btree ("miembro_id") WHERE activo = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupo_semanas_semana" ON "grupo_semanas" USING btree ("grupo_id","semana");--> statement-breakpoint
CREATE INDEX "idx_grupo_semanas_iglesia" ON "grupo_semanas" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_grupo_semanas_ministerio" ON "grupo_semanas" USING btree ("ministerio_id","semana");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupos_codigo" ON "grupos" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grupos_nombre_activo" ON "grupos" USING btree ("ministerio_id",lower("nombre")) WHERE activo = true;--> statement-breakpoint
CREATE INDEX "idx_grupos_iglesia" ON "grupos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_grupos_ministerio" ON "grupos" USING btree ("ministerio_id");--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" ADD CONSTRAINT "solicitudes_ingreso_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE set null ON UPDATE no action;