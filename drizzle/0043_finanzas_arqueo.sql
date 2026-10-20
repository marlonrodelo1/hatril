CREATE TABLE "arqueos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"total_diezmos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_ofrendas" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fondo_id" uuid NOT NULL,
	"caja_id" uuid NOT NULL,
	"contado_por_miembro_id" uuid NOT NULL,
	"confirmado_por_miembro_id" uuid,
	"confirmado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_arqueos_totales" CHECK ("arqueos"."total_diezmos" >= 0 and "arqueos"."total_ofrendas" >= 0 and "arqueos"."total_diezmos" + "arqueos"."total_ofrendas" > 0),
	CONSTRAINT "ck_arqueos_confirmacion" CHECK (("arqueos"."confirmado_por_miembro_id" is null) = ("arqueos"."confirmado_at" is null)),
	CONSTRAINT "ck_arqueos_dos_personas" CHECK ("arqueos"."confirmado_por_miembro_id" <> "arqueos"."contado_por_miembro_id")
);
--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "modulos" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fondos" ADD COLUMN "ministerio_id" uuid;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "arqueo_id" uuid;--> statement-breakpoint
ALTER TABLE "arqueos" ADD CONSTRAINT "arqueos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arqueos" ADD CONSTRAINT "arqueos_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arqueos" ADD CONSTRAINT "arqueos_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_arqueos_iglesia" ON "arqueos" USING btree ("iglesia_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_arqueos_pendientes" ON "arqueos" USING btree ("iglesia_id") WHERE "arqueos"."confirmado_at" is null;--> statement-breakpoint
ALTER TABLE "fondos" ADD CONSTRAINT "fondos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_arqueo_id_arqueos_id_fk" FOREIGN KEY ("arqueo_id") REFERENCES "public"."arqueos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fondos_ministerio" ON "fondos" USING btree ("ministerio_id") WHERE "fondos"."ministerio_id" is not null and "fondos"."activo";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_movimientos_arqueo" ON "movimientos" USING btree ("arqueo_id","tipo_ingreso") WHERE "movimientos"."arqueo_id" is not null;--> statement-breakpoint
ALTER TABLE "fondos" ADD CONSTRAINT "ck_fondos_general_sin_ministerio" CHECK (not ("fondos"."es_general" and "fondos"."ministerio_id" is not null));