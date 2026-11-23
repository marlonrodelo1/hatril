-- ===========================================================================
-- 0048 -- La invitacion de una solicitud sale de `solicitudes_ingreso`
--
-- Generada con db:generate y leida antes de aplicar. A mano, solo dos cosas
-- entre la tabla nueva y el DROP COLUMN, que el generador no sabe hacer:
-- llevarse las invitaciones de las solicitudes que siguen pendientes, y quitar
-- el trigger de la 0047 que dependia de la columna (sin eso el DROP falla).
--
-- POR QUE
-- -------
-- `solicitudes_ingreso.grupo_id` (0046) la lee cualquier sesion activa de la
-- iglesia: las policies de esa tabla son por iglesia (0001). Asi, la
-- participante de una celula sabia, por esa columna, quien mas habia entrado
-- en la suya, que es justo lo que la 0047 le oculta en `grupo_miembros`. Lo
-- encontro la revision del 23-oct en la base de verdad. La tabla nueva solo la
-- lee el pastor (0049) y se vacia al resolver cada solicitud.
--
-- Y guarda el codigo con que llego: cambiar el enlace de una celula tiene que
-- frenar tambien lo que ya se envio con el viejo.
--
-- La RLS, los grants y el trigger de coherencia de la tabla nueva van en la
-- 0049, escrita a mano; se aplican juntas, en la misma pasada del migrador.
-- ===========================================================================

CREATE TABLE "solicitud_invitaciones" (
	"solicitud_id" uuid PRIMARY KEY NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_solicitud_invitaciones_codigo" CHECK ("solicitud_invitaciones"."codigo" ~ '^[A-HJ-NP-Z2-9]{8}$')
);
--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" DROP CONSTRAINT "solicitudes_ingreso_grupo_id_grupos_id_fk";
--> statement-breakpoint
ALTER TABLE "solicitud_invitaciones" ADD CONSTRAINT "solicitud_invitaciones_solicitud_id_solicitudes_ingreso_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_ingreso"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_invitaciones" ADD CONSTRAINT "solicitud_invitaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_invitaciones" ADD CONSTRAINT "solicitud_invitaciones_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_solicitud_invitaciones_iglesia" ON "solicitud_invitaciones" USING btree ("iglesia_id");--> statement-breakpoint
CREATE INDEX "idx_solicitud_invitaciones_grupo" ON "solicitud_invitaciones" USING btree ("grupo_id");--> statement-breakpoint
-- Las pendientes se llevan su invitacion, con el codigo que el grupo tiene hoy:
-- antes de esta migracion no se guardaba con cual llegaron, y el enlace no se
-- ha cambiado nunca en ninguna celula. Las resueltas no se llevan nada: lo que
-- queda de ellas es la fila de `grupo_miembros`.
INSERT INTO "solicitud_invitaciones" ("solicitud_id", "iglesia_id", "grupo_id", "codigo")
SELECT s."id", s."iglesia_id", s."grupo_id", g."codigo"
  FROM "solicitudes_ingreso" s
  JOIN "grupos" g ON g."id" = s."grupo_id" AND g."iglesia_id" = s."iglesia_id"
 WHERE s."estado" = 'pendiente' AND s."grupo_id" IS NOT NULL;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_solicitudes_ingreso_validar_grupo" ON "solicitudes_ingreso";--> statement-breakpoint
DROP FUNCTION IF EXISTS public.validar_solicitud_grupo();--> statement-breakpoint
ALTER TABLE "solicitudes_ingreso" DROP COLUMN "grupo_id";