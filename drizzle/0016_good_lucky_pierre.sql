CREATE TYPE "public"."tipo_notificacion_enum" AS ENUM('solicitud_recibida', 'solicitud_aprobada', 'solicitud_rechazada', 'comentario_en_publicacion', 'me_gusta_en_publicacion', 'turno_devocional');--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"destinatario_auth_user_id" uuid NOT NULL,
	"tipo" "tipo_notificacion_enum" NOT NULL,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enlace" text,
	"leida_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notificaciones_destinatario" ON "notificaciones" USING btree ("destinatario_auth_user_id","iglesia_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notificaciones_sin_leer" ON "notificaciones" USING btree ("destinatario_auth_user_id","iglesia_id") WHERE "notificaciones"."leida_at" is null;