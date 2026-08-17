CREATE TABLE "publicaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"autor_miembro_id" uuid NOT NULL,
	"texto" text,
	"imagenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_publicaciones_no_vacia" CHECK ("publicaciones"."texto" is not null or jsonb_array_length("publicaciones"."imagenes") > 0)
);
--> statement-breakpoint
CREATE TABLE "publicaciones_comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iglesia_id" uuid NOT NULL,
	"publicacion_id" uuid NOT NULL,
	"autor_miembro_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publicaciones_me_gusta" (
	"iglesia_id" uuid NOT NULL,
	"publicacion_id" uuid NOT NULL,
	"miembro_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publicaciones_me_gusta_publicacion_id_miembro_id_pk" PRIMARY KEY("publicacion_id","miembro_id")
);
--> statement-breakpoint
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_autor_miembro_id_miembros_id_fk" FOREIGN KEY ("autor_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_comentarios" ADD CONSTRAINT "publicaciones_comentarios_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_comentarios" ADD CONSTRAINT "publicaciones_comentarios_publicacion_id_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_comentarios" ADD CONSTRAINT "publicaciones_comentarios_autor_miembro_id_miembros_id_fk" FOREIGN KEY ("autor_miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_me_gusta" ADD CONSTRAINT "publicaciones_me_gusta_iglesia_id_iglesias_id_fk" FOREIGN KEY ("iglesia_id") REFERENCES "public"."iglesias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_me_gusta" ADD CONSTRAINT "publicaciones_me_gusta_publicacion_id_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones_me_gusta" ADD CONSTRAINT "publicaciones_me_gusta_miembro_id_miembros_id_fk" FOREIGN KEY ("miembro_id") REFERENCES "public"."miembros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_publicaciones_iglesia_fecha" ON "publicaciones" USING btree ("iglesia_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_publicaciones_autor" ON "publicaciones" USING btree ("autor_miembro_id");--> statement-breakpoint
CREATE INDEX "idx_comentarios_publicacion" ON "publicaciones_comentarios" USING btree ("publicacion_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_comentarios_autor" ON "publicaciones_comentarios" USING btree ("autor_miembro_id");--> statement-breakpoint
CREATE INDEX "idx_me_gusta_miembro" ON "publicaciones_me_gusta" USING btree ("miembro_id");