CREATE TABLE "dispositivos_push" (
	"token" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"plataforma" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visto_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_dispositivos_push_plataforma" CHECK ("dispositivos_push"."plataforma" in ('ios', 'android')),
	CONSTRAINT "ck_dispositivos_push_token" CHECK (length("dispositivos_push"."token") between 20 and 4096)
);
--> statement-breakpoint
CREATE INDEX "idx_dispositivos_push_cuenta" ON "dispositivos_push" USING btree ("auth_user_id");