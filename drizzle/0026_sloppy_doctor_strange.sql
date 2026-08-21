CREATE TYPE "public"."comunidad_quien_publica_enum" AS ENUM('todos', 'equipo', 'pastor');--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "comunidad_activa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "comunidad_quien_publica" "comunidad_quien_publica_enum" DEFAULT 'todos' NOT NULL;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "comunidad_comentarios" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "iglesias" ADD COLUMN "comunidad_fotos" boolean DEFAULT true NOT NULL;