CREATE TYPE "public"."accion_auditoria_enum" AS ENUM('alta', 'modificacion', 'baja', 'lectura_sensible');--> statement-breakpoint
CREATE TYPE "public"."estado_membresia_enum" AS ENUM('pendiente', 'activo', 'rechazado', 'baja');--> statement-breakpoint
CREATE TYPE "public"."estado_miembro_enum" AS ENUM('visitante', 'nuevo', 'miembro', 'inactivo', 'baja');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud_enum" AS ENUM('pendiente', 'aprobada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."moneda_enum" AS ENUM('COP', 'EUR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."plan_enum" AS ENUM('trial', 'esencial', 'comunidad', 'plus', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."rol_iglesia_enum" AS ENUM('pastor', 'lider', 'tesorero', 'secretaria', 'miembro');--> statement-breakpoint
CREATE TYPE "public"."tipo_consentimiento_enum" AS ENUM('datos_religiosos', 'comunicaciones', 'imagen');--> statement-breakpoint
CREATE TABLE "iglesia_usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"rol" "rol_iglesia_enum" DEFAULT 'miembro' NOT NULL,
	"permisos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estado" "estado_membresia_enum" DEFAULT 'pendiente' NOT NULL,
	"miembro_id" uuid,
	"aprobado_por" uuid,
	"aprobado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iglesia_usuarios_iglesia_auth_unique" UNIQUE("iglesia_id","auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "iglesias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"denominacion" text,
	"descripcion" text,
	"pais" text DEFAULT 'CO' NOT NULL,
	"ciudad" text,
	"direccion" text,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"moneda" "moneda_enum" DEFAULT 'COP' NOT NULL,
	"telefono" text,
	"email" text,
	"web" text,
	"redes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"dominio_propio" text,
	"visible_en_directorio" boolean DEFAULT false NOT NULL,
	"acepta_solicitudes" boolean DEFAULT true NOT NULL,
	"plan" "plan_enum" DEFAULT 'trial' NOT NULL,
	"trial_until" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"activa" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iglesias_slug_unique" UNIQUE("slug"),
	CONSTRAINT "iglesias_dominio_propio_unique" UNIQUE("dominio_propio")
);
--> statement-breakpoint
CREATE TABLE "miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"auth_user_id" uuid,
	"numero_miembro" integer,
	"nombre" text NOT NULL,
	"apellidos" text,
	"email" text,
	"telefono" text,
	"fecha_nacimiento" date,
	"direccion" text,
	"ciudad" text,
	"estado_civil" text,
	"notas" text,
	"foto_url" text,
	"estado" "estado_miembro_enum" DEFAULT 'visitante' NOT NULL,
	"bautizado" boolean DEFAULT false NOT NULL,
	"fecha_bautismo" date,
	"fecha_ingreso" date,
	"ultima_asistencia" date,
	"archivado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "miembros_iglesia_numero_unique" UNIQUE("iglesia_id","numero_miembro")
);
--> statement-breakpoint
CREATE TABLE "solicitudes_ingreso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"email" text,
	"telefono" text,
	"mensaje" text,
	"estado" "estado_solicitud_enum" DEFAULT 'pendiente' NOT NULL,
	"revisado_por" uuid,
	"revisado_at" timestamp with time zone,
	"motivo_rechazo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ministerio_miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"rol_en_ministerio" text,
	"desde" date,
	"hasta" date,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ministerios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"color_hex" text DEFAULT '#2F5D50' NOT NULL,
	"lider_miembro_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"actor_auth_user_id" uuid,
	"accion" "accion_auditoria_enum" NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" uuid,
	"datos_antes" jsonb,
	"datos_despues" jsonb,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consentimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"tipo" "tipo_consentimiento_enum" NOT NULL,
	"version_texto" text NOT NULL,
	"otorgado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_auth_user_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"clave" text NOT NULL,
	"dia" date NOT NULL,
	"contador" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_scope_clave_dia_unique" UNIQUE("scope","clave","dia")
);
--> statement-breakpoint
CREATE TABLE "stripe_events_processed" (
	"event_id" text PRIMARY KEY NOT NULL,
	"tipo" text,
	"procesado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iglesia_usuarios" ADD CONSTRAINT "iglesia_usuarios_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" ADD CONSTRAINT "solicitudes_ingreso_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerio_miembros" ADD CONSTRAINT "ministerio_miembros_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerio_miembros" ADD CONSTRAINT "ministerio_miembros_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerio_miembros" ADD CONSTRAINT "ministerio_miembros_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerios" ADD CONSTRAINT "ministerios_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ministerios" ADD CONSTRAINT "ministerios_lider_miembro_id_miembros_id_fk" FOREIGN KEY ("lider_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iglesia_usuarios_auth" ON "iglesia_usuarios" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_iglesia_usuarios_iglesia" ON "iglesia_usuarios" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_iglesia_usuarios_miembro" ON "iglesia_usuarios" USING btree ("miembro_id");--> statement-breakpoint
CREATE INDEX "idx_iglesias_directorio" ON "iglesias" USING btree ("pais","ciudad") WHERE visible_en_directorio = true AND activa = true;--> statement-breakpoint
CREATE INDEX "idx_iglesias_stripe_customer" ON "iglesias" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_miembros_iglesia" ON "miembros" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_miembros_auth" ON "miembros" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_miembros_iglesia_estado" ON "miembros" USING btree ("iglesia_id","estado");--> statement-breakpoint
CREATE INDEX "idx_miembros_email" ON "miembros" USING btree ("iglesia_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_solicitudes_pendiente_por_persona" ON "solicitudes_ingreso" USING btree ("iglesia_id","auth_user_id") WHERE estado = 'pendiente';--> statement-breakpoint
CREATE INDEX "idx_solicitudes_iglesia_estado" ON "solicitudes_ingreso" USING btree ("iglesia_id","estado");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_auth" ON "solicitudes_ingreso" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ministerio_miembro_activo" ON "ministerio_miembros" USING btree ("ministerio_id","miembro_id") WHERE activo = true;--> statement-breakpoint
CREATE INDEX "idx_ministerio_miembros_iglesia" ON "ministerio_miembros" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_ministerio_miembros_ministerio" ON "ministerio_miembros" USING btree ("ministerio_id");--> statement-breakpoint
CREATE INDEX "idx_ministerio_miembros_miembro" ON "ministerio_miembros" USING btree ("miembro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ministerios_iglesia_nombre" ON "ministerios" USING btree ("iglesia_id",lower("nombre"));--> statement-breakpoint
CREATE INDEX "idx_ministerios_iglesia" ON "ministerios" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_ministerios_lider" ON "ministerios" USING btree ("lider_miembro_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_iglesia_fecha" ON "auditoria" USING btree ("iglesia_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_auditoria_entidad" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_actor" ON "auditoria" USING btree ("actor_auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consentimiento_vivo" ON "consentimientos" USING btree ("miembro_id","tipo") WHERE revocado_at is null;--> statement-breakpoint
CREATE INDEX "idx_consentimientos_iglesia" ON "consentimientos" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_consentimientos_miembro" ON "consentimientos" USING btree ("miembro_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_dia" ON "rate_limits" USING btree ("dia");