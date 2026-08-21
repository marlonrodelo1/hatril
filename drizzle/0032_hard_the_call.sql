CREATE TYPE "public"."resultado_contacto_enum" AS ENUM('contactado', 'no_contesta', 'volvera', 'se_mudo', 'molesto_con_la_iglesia', 'sin_contacto', 'derivado_al_pastor');--> statement-breakpoint
CREATE TYPE "public"."via_contacto_enum" AS ENUM('llamada', 'whatsapp', 'visita', 'presencial');--> statement-breakpoint
CREATE TABLE "seguimiento_asignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"responsable_miembro_id" uuid NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"desde" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seguimiento_contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"autor_miembro_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"via" "via_contacto_enum" NOT NULL,
	"resultado" "resultado_contacto_enum" NOT NULL,
	"proximo_paso" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seguimiento_asignaciones" ADD CONSTRAINT "seguimiento_asignaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_asignaciones" ADD CONSTRAINT "seguimiento_asignaciones_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_asignaciones" ADD CONSTRAINT "seguimiento_asignaciones_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_asignaciones" ADD CONSTRAINT "seguimiento_asignaciones_responsable_miembro_id_miembros_id_fk" FOREIGN KEY ("responsable_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_contactos" ADD CONSTRAINT "seguimiento_contactos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_contactos" ADD CONSTRAINT "seguimiento_contactos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_contactos" ADD CONSTRAINT "seguimiento_contactos_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_contactos" ADD CONSTRAINT "seguimiento_contactos_autor_miembro_id_miembros_id_fk" FOREIGN KEY ("autor_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_seguimiento_miembro_activo" ON "seguimiento_asignaciones" USING btree ("ministerio_id","miembro_id") WHERE activo = true;--> statement-breakpoint
CREATE INDEX "idx_seguimiento_iglesia" ON "seguimiento_asignaciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_seguimiento_ministerio" ON "seguimiento_asignaciones" USING btree ("ministerio_id");--> statement-breakpoint
CREATE INDEX "idx_seguimiento_responsable" ON "seguimiento_asignaciones" USING btree ("responsable_miembro_id") WHERE activo = true;--> statement-breakpoint
CREATE INDEX "idx_contactos_iglesia" ON "seguimiento_contactos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_contactos_miembro_fecha" ON "seguimiento_contactos" USING btree ("miembro_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_contactos_ministerio" ON "seguimiento_contactos" USING btree ("ministerio_id");