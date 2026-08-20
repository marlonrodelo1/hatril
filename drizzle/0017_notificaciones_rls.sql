-- ===========================================================================
-- 0017 — Notificaciones: RLS y permisos
--
-- La tabla más asimétrica del proyecto: se lee mucho, se marca leída, y NO SE
-- ESCRIBE desde ninguna sesión.
--
-- POR QUÉ NO HAY POLICY DE INSERT
-- -------------------------------
-- Porque una notificación es una afirmación sobre algo que ha pasado, y quien
-- pueda insertarla puede mentir. Si `hatril_app` pudiera escribir aquí,
-- cualquier miembro con acceso al panel podría fabricarse un «el pastor ha
-- aprobado tu solicitud», o mandarle a otro un aviso con el enlace que quisiera
-- —que es phishing dentro de la propia aplicación, con el membrete de su
-- iglesia—.
--
-- Las escribe el servidor con `dbAdmin`, en el mismo sitio donde ocurre el
-- hecho: al aprobar la solicitud, al comentar, al asignar el turno. Es el mismo
-- criterio que con `auditoria`: la aplicación la lee y nunca la escribe.
--
-- Y TAMPOCO DE DELETE
-- -------------------
-- Marcar leída es un UPDATE de `leida_at`. Borrar no hace falta para nada que la
-- pantalla necesite, y una tabla que crece se limpia con un cron cuando haga
-- falta, no dándole a cada persona una forma de perder su propio historial.
-- ===========================================================================

alter table public.notificaciones enable row level security;

revoke all on public.notificaciones from anon, authenticated;

-- Ni INSERT ni DELETE. Lo que no se concede aquí no lo abre ninguna policy.
grant select, update on public.notificaciones to hatril_app;


-- Cada cual las suyas, y solo dentro de la iglesia a la que pertenece.
--
-- Las dos condiciones hacen falta: `auth.uid()` sola bastaría hoy, pero una
-- cuenta puede estar en dos congregaciones —un pastor que planta una segunda
-- iglesia, alguien que se muda— y sin `pertenece_a_iglesia` seguiría viendo los
-- avisos de la iglesia que ya dejó.
create policy notificaciones_select_propias on public.notificaciones
  for select to hatril_app
  using (
    destinatario_auth_user_id = (select auth.uid())
    and public.pertenece_a_iglesia(iglesia_id)
  );

-- Marcar leída. El `with check` repite la condición para que el UPDATE no pueda
-- usarse para regalarle la notificación a otra persona.
create policy notificaciones_update_propias on public.notificaciones
  for update to hatril_app
  using (
    destinatario_auth_user_id = (select auth.uid())
    and public.pertenece_a_iglesia(iglesia_id)
  )
  with check (
    destinatario_auth_user_id = (select auth.uid())
    and public.pertenece_a_iglesia(iglesia_id)
  );


-- ---------------------------------------------------------------------------
-- Lo único que se puede cambiar es `leida_at`
--
-- La policy de UPDATE decide QUÉ FILAS se tocan, no QUÉ COLUMNAS. Sin este
-- guard, el destinatario de un aviso podría reescribir su `tipo`, su `enlace` o
-- sus `datos`: no le serviría para engañar a nadie —solo se los enseña a sí
-- mismo— pero convertiría la tabla en algo que no se puede creer, y estos avisos
-- son la traza de quién se enteró de qué y cuándo.
--
-- `_escritor_confiable()` deja pasar al service role y a los procesos sin JWT,
-- que son los que sí tienen que poder escribirlo todo.
-- ---------------------------------------------------------------------------
create or replace function public.guard_notificaciones()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._escritor_confiable() then
    return new;
  end if;

  if new.iglesia_id is distinct from old.iglesia_id
     or new.destinatario_auth_user_id is distinct from old.destinatario_auth_user_id
     or new.tipo is distinct from old.tipo
     or new.datos is distinct from old.datos
     or new.enlace is distinct from old.enlace
     or new.created_at is distinct from old.created_at then
    raise exception 'HT109: de una notificacion solo puedes marcar que la has leido'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_notificaciones()
  from public, anon, authenticated, service_role;

create trigger trg_notificaciones_guard
  before update on public.notificaciones
  for each row execute function public.guard_notificaciones();
