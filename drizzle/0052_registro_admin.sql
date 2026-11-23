-- ===========================================================================
-- 0052 -- El registro del super admin
--
-- Quién amplió una prueba, suspendió o reactivó una iglesia, la sacó del
-- directorio o le puso una contraseña provisional a una cuenta. Hasta aquí
-- `/admin` cambiaba esas cosas sin dejar rastro, y una de ellas —la
-- contraseña— basta para entrar en la cuenta de un pastor real.
--
-- 1. POR QUÉ 0052 Y NO 0046
-- -------------------------
-- Las 0046-0051 son de células (rama `claude/awesome-driscoll-58a8cc`), y ya
-- están aplicadas en la base aunque todavía no estén en `main`. Esta va detrás,
-- en el orden en que la base las recibe. drizzle no mira el número, sino el
-- `when` del journal, y el de esta es posterior al de todas las de células.
--
-- AL FUSIONAR CÉLULAS EN MAIN: el journal choca (las dos ramas añaden al final)
-- y se resuelve dejando sus seis entradas y luego esta. Y los snapshots
-- 0046 y 0052 salen los dos del 0045, así que el siguiente `db:generate`
-- protesta o, peor, propone crear otra vez las tablas de la otra rama. Lo que
-- se hace: `0052_snapshot.json` pasa a tener como `prevId` el `id` del 0051, y
-- en su `tables` y `enums` entran también los de células (copiados del 0051).
-- Comprobarlo con `npx drizzle-kit check` y con un `db:generate` que diga que no
-- hay cambios.
--
-- 2. LA TABLA ES DE LA PLATAFORMA
-- -------------------------------
-- Como `admin_users`: RLS activada, ninguna policy, ningún grant. Solo la lee y
-- la escribe `dbAdmin` desde `/admin`, detrás de `requireSuperAdmin()`. El
-- `revoke` va escrito aunque la 0022 ya invirtiera el defecto: el fichero tiene
-- que decir la verdad en cualquier otra base (CLAUDE.md).
--
-- 3. SOLO SE AÑADE (HT135)
-- ------------------------
-- Un registro que se puede retocar no prueba nada. El trigger corta UPDATE,
-- DELETE y TRUNCATE para todos, también para `postgres`, que es como entra
-- `dbAdmin`. Quien sea dueño de la tabla podría desactivarlo, pero tendría que
-- hacerlo a propósito y con una sentencia que se ve. Por eso la tabla no tiene
-- claves ajenas: un `on delete set null` convertiría borrar una iglesia en un
-- UPDATE aquí, y HT135 lo pararía.
-- ===========================================================================

CREATE TYPE "public"."accion_admin_enum" AS ENUM('ampliar_prueba', 'suspender_iglesia', 'reactivar_iglesia', 'sacar_del_directorio', 'poner_contrasena');--> statement-breakpoint
CREATE TABLE "registro_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_auth_user_id" uuid NOT NULL,
	"accion" "accion_admin_enum" NOT NULL,
	"iglesia_id" uuid,
	"cuenta_auth_user_id" uuid,
	"detalle" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_registro_admin_objeto" CHECK ("registro_admin"."iglesia_id" is not null or "registro_admin"."cuenta_auth_user_id" is not null)
);
--> statement-breakpoint
CREATE INDEX "idx_registro_admin_fecha" ON "registro_admin" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_registro_admin_iglesia" ON "registro_admin" USING btree ("iglesia_id","created_at" DESC NULLS LAST) WHERE "registro_admin"."iglesia_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_registro_admin_cuenta" ON "registro_admin" USING btree ("cuenta_auth_user_id","created_at" DESC NULLS LAST) WHERE "registro_admin"."cuenta_auth_user_id" is not null;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Cerrada a todo el que no sea `dbAdmin`
-- ---------------------------------------------------------------------------

alter table public.registro_admin enable row level security;--> statement-breakpoint

revoke all on public.registro_admin from anon, authenticated, service_role;--> statement-breakpoint


-- ---------------------------------------------------------------------------
-- Solo se añade: HT135
-- ---------------------------------------------------------------------------

create or replace function public.registro_admin_solo_anadir()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'HT135: el registro del super admin no se cambia ni se borra'
    using errcode = 'insufficient_privilege';
end;
$$;--> statement-breakpoint

-- Una función no nace cerrada (CLAUDE.md, y la 0007 lo cuenta entero).
revoke execute on function public.registro_admin_solo_anadir()
  from public, anon, authenticated, service_role;--> statement-breakpoint

create trigger trg_registro_admin_solo_anadir
  before update or delete on public.registro_admin
  for each row execute function public.registro_admin_solo_anadir();--> statement-breakpoint

create trigger trg_registro_admin_sin_truncate
  before truncate on public.registro_admin
  for each statement execute function public.registro_admin_solo_anadir();
