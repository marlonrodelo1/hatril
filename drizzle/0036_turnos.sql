-- ===========================================================================
-- 0036 -- Turnos: las dos tablas y los dos avisos nuevos
--
-- Generada con `drizzle-kit generate` y RECORTADA A MANO. El generador trajo
-- ademas tres cosas que ya estan en la base, porque la 0034 y la 0035 se
-- escribieron a mano y su snapshot no las recogio:
--
--   - `tipo_consentimiento_enum` + 'asistencia_y_seguimiento'  (0034)
--   - `publicaciones_comentarios_me_gusta`                      (0035)
--   - `publicaciones_comentarios.respuesta_a_id` con su indice  (0035)
--
-- Volver a crearlas tumbaria la migracion entera. Se quitan del SQL y se quedan
-- en el snapshot de esta, que es lo que hacia falta: a partir de aqui el
-- generador vuelve a saber lo que hay de verdad.
--
-- La RLS, los guards y los grants van en la 0037, escrita a mano.
-- ===========================================================================

CREATE TYPE "public"."respuesta_turno_enum" AS ENUM('pendiente', 'confirmado', 'no_puede');--> statement-breakpoint
-- `if not exists` para que una pasada repetida no se caiga aqui. Ojo: un valor
-- nuevo de enum no se puede USAR en la misma transaccion que lo anade, y el
-- migrador aplica todo junto. Ninguna migracion de esta tanda inserta avisos.
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE IF NOT EXISTS 'turno_asignado';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion_enum" ADD VALUE IF NOT EXISTS 'turno_no_puede';--> statement-breakpoint
CREATE TABLE "turno_asignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"puesto" text NOT NULL,
	"respuesta" "respuesta_turno_enum" DEFAULT 'pendiente' NOT NULL,
	"respondido_at" timestamp with time zone,
	"asignado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"ministerio_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"fecha" date NOT NULL,
	"hora" time,
	"notas" text,
	"creado_por_miembro_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_turnos_ministerio_servicio" UNIQUE NULLS NOT DISTINCT("ministerio_id","fecha","hora")
);
--> statement-breakpoint
ALTER TABLE "turno_asignaciones" ADD CONSTRAINT "turno_asignaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_asignaciones" ADD CONSTRAINT "turno_asignaciones_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_asignaciones" ADD CONSTRAINT "turno_asignaciones_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_ministerio_id_ministerios_id_fk" FOREIGN KEY ("ministerio_id") REFERENCES "public"."ministerios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_turno_puesto_miembro" ON "turno_asignaciones" USING btree ("turno_id",lower("puesto"),"miembro_id");--> statement-breakpoint
CREATE INDEX "idx_turno_asignaciones_iglesia" ON "turno_asignaciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_turno_asignaciones_turno" ON "turno_asignaciones" USING btree ("turno_id");--> statement-breakpoint
CREATE INDEX "idx_turno_asignaciones_miembro" ON "turno_asignaciones" USING btree ("miembro_id");--> statement-breakpoint
CREATE INDEX "idx_turnos_ministerio_fecha" ON "turnos" USING btree ("ministerio_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_turnos_iglesia_fecha" ON "turnos" USING btree ("iglesia_id","fecha");
