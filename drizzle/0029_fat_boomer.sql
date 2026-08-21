CREATE TABLE "asistencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"reunion_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"presente" boolean NOT NULL,
	"registrado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reuniones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid,
	"titulo" text NOT NULL,
	"fecha" date NOT NULL,
	"hora" time,
	"lugar" text,
	"notas" text,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_reunion_id_reuniones_id_fk" FOREIGN KEY ("reunion_id") REFERENCES "public"."reuniones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reuniones" ADD CONSTRAINT "reuniones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reuniones" ADD CONSTRAINT "reuniones_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asistencia_reunion_miembro" ON "asistencias" USING btree ("reunion_id","miembro_id");--> statement-breakpoint
CREATE INDEX "idx_asistencias_iglesia" ON "asistencias" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_asistencias_reunion" ON "asistencias" USING btree ("reunion_id");--> statement-breakpoint
CREATE INDEX "idx_asistencias_miembro_presente" ON "asistencias" USING btree ("miembro_id") WHERE presente = true;--> statement-breakpoint
CREATE INDEX "idx_reuniones_iglesia_fecha" ON "reuniones" USING btree ("iglesia_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_reuniones_ministerio" ON "reuniones" USING btree ("ministerio_id") WHERE ministerio_id is not null;--> statement-breakpoint
CREATE INDEX "idx_reuniones_congregacion" ON "reuniones" USING btree ("iglesia_id","fecha") WHERE ministerio_id is null;