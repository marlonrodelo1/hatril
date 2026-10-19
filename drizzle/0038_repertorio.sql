CREATE TABLE "canciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"autor" text,
	"tono" text,
	"enlace_audio" text,
	"enlace_partitura" text,
	"notas" text,
	"archivada" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turno_canciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"cancion_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"tono" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canciones" ADD CONSTRAINT "canciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canciones" ADD CONSTRAINT "canciones_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_canciones" ADD CONSTRAINT "turno_canciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_canciones" ADD CONSTRAINT "turno_canciones_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_canciones" ADD CONSTRAINT "turno_canciones_cancion_id_canciones_id_fk" FOREIGN KEY ("cancion_id") REFERENCES "public"."canciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_canciones_ministerio_titulo" ON "canciones" USING btree ("ministerio_id",lower("titulo"),lower(coalesce("autor", '')));--> statement-breakpoint
CREATE INDEX "idx_canciones_iglesia" ON "canciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_canciones_ministerio" ON "canciones" USING btree ("ministerio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_turno_cancion" ON "turno_canciones" USING btree ("turno_id","cancion_id");--> statement-breakpoint
CREATE INDEX "idx_turno_canciones_iglesia" ON "turno_canciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_turno_canciones_turno" ON "turno_canciones" USING btree ("turno_id","orden");--> statement-breakpoint
CREATE INDEX "idx_turno_canciones_cancion" ON "turno_canciones" USING btree ("cancion_id");