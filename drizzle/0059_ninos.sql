CREATE TYPE "public"."parentesco_nino_enum" AS ENUM('madre', 'padre', 'tutor_legal');--> statement-breakpoint
CREATE TYPE "public"."permiso_nino_enum" AS ENUM('vinculo', 'imagen');--> statement-breakpoint
CREATE TYPE "public"."tipo_archivo_nino_enum" AS ENUM('foto', 'video');--> statement-breakpoint
CREATE TABLE "nino_consentimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"nino_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"tipo" "permiso_nino_enum" NOT NULL,
	"version_texto" text NOT NULL,
	"otorgado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "ck_nino_consentimientos_version" CHECK ("nino_consentimientos"."version_texto" ~ '^ninos-[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "ck_nino_consentimientos_ip" CHECK ("nino_consentimientos"."ip" is null or length("nino_consentimientos"."ip") <= 64),
	CONSTRAINT "ck_nino_consentimientos_user_agent" CHECK ("nino_consentimientos"."user_agent" is null or length("nino_consentimientos"."user_agent") <= 512)
);
--> statement-breakpoint
CREATE TABLE "nino_familias" (
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"nino_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"parentesco" "parentesco_nino_enum" NOT NULL,
	"aceptado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"aceptado_por_miembro_id" uuid,
	CONSTRAINT "nino_familias_nino_id_miembro_id_pk" PRIMARY KEY("nino_id","miembro_id")
);
--> statement-breakpoint
CREATE TABLE "ninos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"anio_nacimiento" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_ninos_nombre" CHECK (length(btrim("ninos"."nombre")) between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "ninos_archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"tipo" "tipo_archivo_nino_enum" NOT NULL,
	"ruta" text NOT NULL,
	"miniatura_ruta" text,
	"bytes" integer NOT NULL,
	"duracion_s" smallint,
	"fecha" date NOT NULL,
	"caduca_el" date GENERATED ALWAYS AS ((date_trunc('month', fecha::timestamp) + interval '13 months')::date) STORED,
	"publicacion_id" uuid,
	"subido_por_miembro_id" uuid,
	"confirmado_at" timestamp with time zone,
	"exportado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_ninos_archivos_bytes" CHECK ("ninos_archivos"."bytes" > 0 and "ninos_archivos"."bytes" <= case when "ninos_archivos"."tipo" = 'foto' then 5242880 else 104857600 end),
	CONSTRAINT "ck_ninos_archivos_duracion" CHECK ("ninos_archivos"."duracion_s" is null or ("ninos_archivos"."tipo" = 'video' and "ninos_archivos"."duracion_s" between 1 and 60)),
	CONSTRAINT "ck_ninos_archivos_ruta" CHECK (length("ninos_archivos"."ruta") between 1 and 300),
	CONSTRAINT "ck_ninos_archivos_miniatura" CHECK ("ninos_archivos"."miniatura_ruta" is null or length("ninos_archivos"."miniatura_ruta") between 1 and 300)
);
--> statement-breakpoint
CREATE TABLE "ninos_cronograma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tema" text NOT NULL,
	"puntos" text,
	"maestro_miembro_id" uuid,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_ninos_cronograma_tema" CHECK (length(btrim("ninos_cronograma"."tema")) between 1 and 120),
	CONSTRAINT "ck_ninos_cronograma_puntos" CHECK ("ninos_cronograma"."puntos" is null or length("ninos_cronograma"."puntos") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "ninos_publicaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"texto" text NOT NULL,
	"autor_miembro_id" uuid,
	"publicada_at" timestamp with time zone,
	"caduca_el" date GENERATED ALWAYS AS ((date_trunc('month', fecha::timestamp) + interval '13 months')::date) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_ninos_publicaciones_texto" CHECK (length(btrim("ninos_publicaciones"."texto")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "ninos_solicitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"anio_nacimiento" smallint NOT NULL,
	"parentesco" "parentesco_nino_enum" NOT NULL,
	"permiso_imagen" boolean DEFAULT false NOT NULL,
	"version_texto" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_ninos_solicitudes_nombre" CHECK (length(btrim("ninos_solicitudes"."nombre")) between 1 and 60),
	CONSTRAINT "ck_ninos_solicitudes_version" CHECK ("ninos_solicitudes"."version_texto" ~ '^ninos-[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "ck_ninos_solicitudes_ip" CHECK ("ninos_solicitudes"."ip" is null or length("ninos_solicitudes"."ip") <= 64),
	CONSTRAINT "ck_ninos_solicitudes_user_agent" CHECK ("ninos_solicitudes"."user_agent" is null or length("ninos_solicitudes"."user_agent") <= 512)
);
--> statement-breakpoint
ALTER TABLE "nino_consentimientos" ADD CONSTRAINT "nino_consentimientos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_consentimientos" ADD CONSTRAINT "nino_consentimientos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_consentimientos" ADD CONSTRAINT "nino_consentimientos_nino_id_ninos_id_fk" FOREIGN KEY ("nino_id") REFERENCES "public"."ninos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_consentimientos" ADD CONSTRAINT "nino_consentimientos_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_familias" ADD CONSTRAINT "nino_familias_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_familias" ADD CONSTRAINT "nino_familias_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_familias" ADD CONSTRAINT "nino_familias_nino_id_ninos_id_fk" FOREIGN KEY ("nino_id") REFERENCES "public"."ninos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nino_familias" ADD CONSTRAINT "nino_familias_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos" ADD CONSTRAINT "ninos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos" ADD CONSTRAINT "ninos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_archivos" ADD CONSTRAINT "ninos_archivos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_archivos" ADD CONSTRAINT "ninos_archivos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_archivos" ADD CONSTRAINT "ninos_archivos_publicacion_id_ninos_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."ninos_publicaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_cronograma" ADD CONSTRAINT "ninos_cronograma_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_cronograma" ADD CONSTRAINT "ninos_cronograma_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_cronograma" ADD CONSTRAINT "ninos_cronograma_maestro_miembro_id_miembros_id_fk" FOREIGN KEY ("maestro_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_publicaciones" ADD CONSTRAINT "ninos_publicaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_publicaciones" ADD CONSTRAINT "ninos_publicaciones_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_solicitudes" ADD CONSTRAINT "ninos_solicitudes_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_solicitudes" ADD CONSTRAINT "ninos_solicitudes_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ninos_solicitudes" ADD CONSTRAINT "ninos_solicitudes_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_nino_consentimientos_vivo" ON "nino_consentimientos" USING btree ("nino_id","miembro_id","tipo") WHERE "nino_consentimientos"."revocado_at" is null;--> statement-breakpoint
CREATE INDEX "idx_nino_consentimientos_iglesia" ON "nino_consentimientos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_nino_familias_padre" ON "nino_familias" USING btree ("ministerio_id","miembro_id");--> statement-breakpoint
CREATE INDEX "idx_nino_familias_iglesia" ON "nino_familias" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_ninos_ministerio" ON "ninos" USING btree ("ministerio_id");--> statement-breakpoint
CREATE INDEX "idx_ninos_iglesia" ON "ninos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ninos_archivos_ruta" ON "ninos_archivos" USING btree ("tipo","ruta");--> statement-breakpoint
CREATE INDEX "idx_ninos_archivos_fecha" ON "ninos_archivos" USING btree ("ministerio_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_ninos_archivos_publicacion" ON "ninos_archivos" USING btree ("publicacion_id");--> statement-breakpoint
CREATE INDEX "idx_ninos_archivos_caduca" ON "ninos_archivos" USING btree ("caduca_el");--> statement-breakpoint
CREATE INDEX "idx_ninos_archivos_iglesia" ON "ninos_archivos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_ninos_cronograma_fecha" ON "ninos_cronograma" USING btree ("ministerio_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_ninos_cronograma_iglesia" ON "ninos_cronograma" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_ninos_publicaciones_fecha" ON "ninos_publicaciones" USING btree ("ministerio_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_ninos_publicaciones_caduca" ON "ninos_publicaciones" USING btree ("caduca_el");--> statement-breakpoint
CREATE INDEX "idx_ninos_publicaciones_iglesia" ON "ninos_publicaciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ninos_solicitudes_padre_nombre" ON "ninos_solicitudes" USING btree ("ministerio_id","miembro_id",lower(btrim("nombre")));--> statement-breakpoint
CREATE INDEX "idx_ninos_solicitudes_iglesia" ON "ninos_solicitudes" USING btree ("iglesia_id");