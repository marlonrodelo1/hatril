CREATE TYPE "public"."origen_inscripcion_enum" AS ENUM('publico', 'panel');--> statement-breakpoint
CREATE TABLE "evento_inscripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"evento_id" uuid NOT NULL,
	"origen" "origen_inscripcion_enum" DEFAULT 'publico' NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"telefono" text,
	"acompanantes" integer DEFAULT 0 NOT NULL,
	"nota" text,
	"pagado" boolean DEFAULT false NOT NULL,
	"pagado_at" timestamp with time zone,
	"marcado_por_miembro_id" uuid,
	"codigo_cancelacion" text NOT NULL,
	"cancelada_at" timestamp with time zone,
	"consentimiento_version" text NOT NULL,
	"consentimiento_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consentimiento_avisos" boolean DEFAULT false NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inscripciones_nombre_len" CHECK (length("evento_inscripciones"."nombre") between 1 and 120),
	CONSTRAINT "ck_inscripciones_email_len" CHECK (length("evento_inscripciones"."email") between 3 and 200),
	CONSTRAINT "ck_inscripciones_email_minusculas" CHECK ("evento_inscripciones"."email" = lower("evento_inscripciones"."email")),
	CONSTRAINT "ck_inscripciones_telefono_len" CHECK ("evento_inscripciones"."telefono" is null or length("evento_inscripciones"."telefono") <= 32),
	CONSTRAINT "ck_inscripciones_nota_len" CHECK ("evento_inscripciones"."nota" is null or length("evento_inscripciones"."nota") <= 500),
	CONSTRAINT "ck_inscripciones_user_agent_len" CHECK ("evento_inscripciones"."user_agent" is null or length("evento_inscripciones"."user_agent") <= 400),
	CONSTRAINT "ck_inscripciones_consentimiento_len" CHECK (length("evento_inscripciones"."consentimiento_version") between 5 and 40),
	CONSTRAINT "ck_inscripciones_codigo_len" CHECK (length("evento_inscripciones"."codigo_cancelacion") between 20 and 64),
	CONSTRAINT "ck_inscripciones_acompanantes" CHECK ("evento_inscripciones"."acompanantes" between 0 and 10),
	CONSTRAINT "ck_inscripciones_pagado" CHECK ("evento_inscripciones"."pagado" = ("evento_inscripciones"."pagado_at" is not null)),
	CONSTRAINT "ck_inscripciones_origen_evidencia" CHECK ("evento_inscripciones"."origen" = 'publico' or ("evento_inscripciones"."ip" is null and "evento_inscripciones"."user_agent" is null))
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"inicio_en" timestamp with time zone NOT NULL,
	"fin_en" timestamp with time zone,
	"lugar" text,
	"imagen_url" text,
	"precio" numeric(14, 2),
	"cupo" integer,
	"publicado" boolean DEFAULT false NOT NULL,
	"inscripciones_abiertas" boolean DEFAULT false NOT NULL,
	"enlace_pago" text,
	"enlace_pago_host" text,
	"pago_instrucciones" text,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_eventos_titulo_len" CHECK (length("eventos"."titulo") between 1 and 140),
	CONSTRAINT "ck_eventos_descripcion_len" CHECK ("eventos"."descripcion" is null or length("eventos"."descripcion") <= 4000),
	CONSTRAINT "ck_eventos_lugar_len" CHECK ("eventos"."lugar" is null or length("eventos"."lugar") <= 160),
	CONSTRAINT "ck_eventos_pago_instrucciones_len" CHECK ("eventos"."pago_instrucciones" is null or length("eventos"."pago_instrucciones") <= 300),
	CONSTRAINT "ck_eventos_fin_despues" CHECK ("eventos"."fin_en" is null or "eventos"."fin_en" >= "eventos"."inicio_en"),
	CONSTRAINT "ck_eventos_precio" CHECK ("eventos"."precio" is null or "eventos"."precio" > 0),
	CONSTRAINT "ck_eventos_cupo" CHECK ("eventos"."cupo" is null or "eventos"."cupo" > 0),
	CONSTRAINT "ck_eventos_enlace_https" CHECK ("eventos"."enlace_pago" is null or "eventos"."enlace_pago" like 'https://%'),
	CONSTRAINT "ck_eventos_enlace_host" CHECK (("eventos"."enlace_pago" is null and "eventos"."enlace_pago_host" is null)
          or ("eventos"."enlace_pago_host" is not null
              and position('https://' || "eventos"."enlace_pago_host" || '/' in "eventos"."enlace_pago") = 1))
);
--> statement-breakpoint
ALTER TABLE "evento_inscripciones" ADD CONSTRAINT "evento_inscripciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_inscripciones" ADD CONSTRAINT "evento_inscripciones_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inscripcion_viva_por_email" ON "evento_inscripciones" USING btree ("evento_id",lower("email")) WHERE "evento_inscripciones"."cancelada_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inscripcion_codigo" ON "evento_inscripciones" USING btree ("codigo_cancelacion");--> statement-breakpoint
CREATE INDEX "idx_inscripciones_evento_vivas" ON "evento_inscripciones" USING btree ("evento_id") WHERE "evento_inscripciones"."cancelada_at" is null;--> statement-breakpoint
CREATE INDEX "idx_inscripciones_iglesia" ON "evento_inscripciones" USING btree ("iglesia_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_eventos_iglesia_inicio" ON "eventos" USING btree ("iglesia_id","inicio_en");--> statement-breakpoint
CREATE INDEX "idx_eventos_publicados" ON "eventos" USING btree ("iglesia_id","inicio_en") WHERE "eventos"."publicado";
--
-- Aquí el generador había escrito además un DROP y un CREATE de
-- `idx_iglesias_stripe_customer`, y se han quitado a mano.
--
-- No sobra por capricho: ese índice pasó a ser único y parcial en la `0021`,
-- que está escrita a mano y por tanto NO tocó el snapshot de drizzle. El
-- generador comparaba el schema de TypeScript contra un snapshot que no sabía
-- del cambio, así que propuso rehacer un índice que la base ya tiene tal cual
-- —comprobado en `pg_indexes`—. Repetirlo no arregla nada y deja a la
-- facturación un instante sin su índice único.
--
-- El snapshot `0023_snapshot.json` sí lo recoge, que es lo que hace falta para
-- que esto no se vuelva a proponer.