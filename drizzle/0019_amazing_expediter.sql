CREATE TYPE "public"."metodo_pago_enum" AS ENUM('efectivo', 'transferencia', 'tarjeta', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_caja_enum" AS ENUM('efectivo', 'banco', 'billetera', 'pasarela');--> statement-breakpoint
CREATE TYPE "public"."tipo_ingreso_enum" AS ENUM('diezmo', 'ofrenda', 'donacion', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_enum" AS ENUM('ingreso', 'gasto');--> statement-breakpoint
CREATE TABLE "cajas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_caja_enum" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fondos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"es_general" boolean DEFAULT false NOT NULL,
	"color_hex" text,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_enum" NOT NULL,
	"fecha" date NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"importe_con_signo" numeric(14, 2) GENERATED ALWAYS AS (case when tipo = 'ingreso' then importe else -importe end) STORED,
	"concepto" text NOT NULL,
	"fondo_id" uuid NOT NULL,
	"caja_id" uuid NOT NULL,
	"metodo_pago" "metodo_pago_enum" DEFAULT 'efectivo' NOT NULL,
	"referencia" text,
	"tipo_ingreso" "tipo_ingreso_enum",
	"registrado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_movimientos_importe_positivo" CHECK ("movimientos"."importe" > 0),
	CONSTRAINT "ck_movimientos_tipo_ingreso" CHECK (("movimientos"."tipo" = 'ingreso') = ("movimientos"."tipo_ingreso" is not null))
);
--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondos" ADD CONSTRAINT "fondos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cajas_nombre" ON "cajas" USING btree ("iglesia_id",lower("nombre"));--> statement-breakpoint
CREATE INDEX "idx_cajas_iglesia" ON "cajas" USING btree ("iglesia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fondos_general" ON "fondos" USING btree ("iglesia_id") WHERE "fondos"."es_general";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fondos_nombre" ON "fondos" USING btree ("iglesia_id",lower("nombre"));--> statement-breakpoint
CREATE INDEX "idx_fondos_iglesia" ON "fondos" USING btree ("iglesia_id","orden");--> statement-breakpoint
CREATE INDEX "idx_movimientos_libro" ON "movimientos" USING btree ("iglesia_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_movimientos_caja" ON "movimientos" USING btree ("iglesia_id","caja_id");--> statement-breakpoint
CREATE INDEX "idx_movimientos_fondo" ON "movimientos" USING btree ("iglesia_id","fondo_id");