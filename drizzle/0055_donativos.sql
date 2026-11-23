CREATE TYPE "public"."estado_donativo_enum" AS ENUM('pendiente', 'pagado', 'fallido', 'reembolsado');--> statement-breakpoint
CREATE TYPE "public"."estado_donativo_mensual_enum" AS ENUM('activo', 'impagado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."periodicidad_donativo_enum" AS ENUM('una', 'mensual');--> statement-breakpoint
CREATE TABLE "cuentas_stripe" (
	"iglesia_id" uuid PRIMARY KEY NOT NULL,
	"stripe_account_id" text NOT NULL,
	"cobros_activos" boolean DEFAULT false NOT NULL,
	"datos_completos" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_stripe_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "donativo_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donativo_id" uuid NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"tipo_ingreso" "tipo_ingreso_enum" NOT NULL,
	"fondo_id" uuid NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"movimiento_id" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ck_donativo_lineas_importe" CHECK ("donativo_lineas"."importe" > 0),
	CONSTRAINT "ck_donativo_lineas_tipo" CHECK ("donativo_lineas"."tipo_ingreso" in ('diezmo', 'ofrenda'))
);
--> statement-breakpoint
CREATE TABLE "donativos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"periodicidad" "periodicidad_donativo_enum" NOT NULL,
	"estado" "estado_donativo_enum" DEFAULT 'pendiente' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"comision_cubierta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"comision_stripe" numeric(14, 2),
	"moneda" "moneda_enum" NOT NULL,
	"donante_nombre" text NOT NULL,
	"donante_email" text NOT NULL,
	"donante_auth_user_id" uuid,
	"donativo_mensual_id" uuid,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"fecha" date,
	"pagado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donativos_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "donativos_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "donativos_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"),
	CONSTRAINT "ck_donativos_total_positivo" CHECK ("donativos"."total" > 0),
	CONSTRAINT "ck_donativos_fecha" CHECK ("donativos"."estado" in ('pendiente', 'fallido') or "donativos"."fecha" is not null)
);
--> statement-breakpoint
CREATE TABLE "donativos_mensuales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"estado" "estado_donativo_mensual_enum" DEFAULT 'activo' NOT NULL,
	"lineas" jsonb NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"comision_cubierta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"moneda" "moneda_enum" NOT NULL,
	"donante_nombre" text NOT NULL,
	"donante_email" text NOT NULL,
	"donante_auth_user_id" uuid,
	"token_gestion_hash" text NOT NULL,
	"cancelado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donativos_mensuales_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "donativos_mensuales_token_gestion_hash_unique" UNIQUE("token_gestion_hash")
);
--> statement-breakpoint
ALTER TABLE "fondos" ADD COLUMN "en_donativos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cuentas_stripe" ADD CONSTRAINT "cuentas_stripe_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativo_lineas" ADD CONSTRAINT "donativo_lineas_donativo_id_donativos_id_fk" FOREIGN KEY ("donativo_id") REFERENCES "public"."donativos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativo_lineas" ADD CONSTRAINT "donativo_lineas_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativo_lineas" ADD CONSTRAINT "donativo_lineas_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativo_lineas" ADD CONSTRAINT "donativo_lineas_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativos" ADD CONSTRAINT "donativos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativos" ADD CONSTRAINT "donativos_donativo_mensual_id_donativos_mensuales_id_fk" FOREIGN KEY ("donativo_mensual_id") REFERENCES "public"."donativos_mensuales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donativos_mensuales" ADD CONSTRAINT "donativos_mensuales_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_donativo_lineas_donativo" ON "donativo_lineas" USING btree ("donativo_id");--> statement-breakpoint
CREATE INDEX "idx_donativos_iglesia" ON "donativos" USING btree ("iglesia_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_donativos_donante" ON "donativos" USING btree ("donante_auth_user_id","fecha" DESC NULLS LAST) WHERE "donativos"."donante_auth_user_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_donativos_mensuales_iglesia" ON "donativos_mensuales" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_donativos_mensuales_donante" ON "donativos_mensuales" USING btree ("donante_auth_user_id") WHERE "donativos_mensuales"."donante_auth_user_id" is not null;