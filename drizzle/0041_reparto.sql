-- ===========================================================================
-- 0041 -- Reparto: el padron de quien recibe, cada dia de reparto y la puerta
--
-- Generada con db:generate y leida antes de aplicar: solo trae las tres tablas
-- de esta tanda. La RLS, los grants, los triggers y el numero correlativo van
-- en la 0042, escrita a mano, como 0036/0037 y 0038/0039.
--
-- Hasta que se aplique la 0042 estas tablas NO estan cerradas por su propio
-- fichero: lo estan por el defecto que invirtio la 0022. Por eso las dos se
-- aplican juntas, en la misma pasada del migrador.
-- ===========================================================================

CREATE TABLE "reparto_beneficiarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"numero" integer DEFAULT 0 NOT NULL,
	"nombre" text NOT NULL,
	"personas_hogar" smallint DEFAULT 1 NOT NULL,
	"telefono" text,
	"consentimiento_version" text NOT NULL,
	"consentimiento_at" timestamp with time zone DEFAULT now() NOT NULL,
	"baja_at" timestamp with time zone,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reparto_beneficiarios_numero" CHECK ("reparto_beneficiarios"."numero" > 0),
	CONSTRAINT "ck_reparto_beneficiarios_nombre" CHECK (length(btrim("reparto_beneficiarios"."nombre")) between 1 and 80),
	CONSTRAINT "ck_reparto_beneficiarios_personas" CHECK ("reparto_beneficiarios"."personas_hogar" between 1 and 20),
	CONSTRAINT "ck_reparto_beneficiarios_telefono" CHECK ("reparto_beneficiarios"."telefono" is null or length("reparto_beneficiarios"."telefono") between 1 and 32),
	CONSTRAINT "ck_reparto_beneficiarios_consentimiento" CHECK ("reparto_beneficiarios"."consentimiento_version" ~ '^reparto-[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "reparto_entregas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"jornada_id" uuid NOT NULL,
	"beneficiario_id" uuid,
	"personas_hogar" smallint DEFAULT 1 NOT NULL,
	"entregado" boolean DEFAULT false NOT NULL,
	"entregado_at" timestamp with time zone,
	"registrado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reparto_entregas_personas" CHECK ("reparto_entregas"."personas_hogar" between 1 and 20),
	CONSTRAINT "ck_reparto_entregas_entregado" CHECK ("reparto_entregas"."entregado" = ("reparto_entregas"."entregado_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "reparto_jornadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"sin_inscribir" integer DEFAULT 0 NOT NULL,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reparto_jornadas_sin_inscribir" CHECK ("reparto_jornadas"."sin_inscribir" between 0 and 2000)
);
--> statement-breakpoint
ALTER TABLE "reparto_beneficiarios" ADD CONSTRAINT "reparto_beneficiarios_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_beneficiarios" ADD CONSTRAINT "reparto_beneficiarios_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_entregas" ADD CONSTRAINT "reparto_entregas_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_entregas" ADD CONSTRAINT "reparto_entregas_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_entregas" ADD CONSTRAINT "reparto_entregas_jornada_id_reparto_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."reparto_jornadas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_entregas" ADD CONSTRAINT "reparto_entregas_beneficiario_id_reparto_beneficiarios_id_fk" FOREIGN KEY ("beneficiario_id") REFERENCES "public"."reparto_beneficiarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_jornadas" ADD CONSTRAINT "reparto_jornadas_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto_jornadas" ADD CONSTRAINT "reparto_jornadas_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reparto_beneficiarios_numero" ON "reparto_beneficiarios" USING btree ("ministerio_id","numero");--> statement-breakpoint
CREATE INDEX "idx_reparto_beneficiarios_iglesia" ON "reparto_beneficiarios" USING btree ("iglesia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reparto_entregas_jornada_beneficiario" ON "reparto_entregas" USING btree ("jornada_id","beneficiario_id");--> statement-breakpoint
CREATE INDEX "idx_reparto_entregas_iglesia" ON "reparto_entregas" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_reparto_entregas_beneficiario" ON "reparto_entregas" USING btree ("beneficiario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reparto_jornadas_fecha" ON "reparto_jornadas" USING btree ("ministerio_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_reparto_jornadas_iglesia" ON "reparto_jornadas" USING btree ("iglesia_id");