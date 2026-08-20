-- ===========================================================================
-- 0018 — El aviso que su destinatario no podía leer
--
-- La `0017` escribió las dos policies así:
--
--   destinatario_auth_user_id = auth.uid() and pertenece_a_iglesia(iglesia_id)
--
-- El segundo término parecía prudencia —«y además que siga en la iglesia»— y
-- rompía el caso más importante de todos.
--
-- `pertenece_a_iglesia()` exige `iglesia_usuarios.estado = 'activo'`, y
-- `rechazarSolicitud` BORRA esa fila (la `0001` documenta por qué: el unique
-- `(iglesia_id, auth_user_id)` impediría volver a solicitar nunca más). O sea
-- que en el mismo instante en que se escribe «tu solicitud no ha salido
-- adelante», su destinatario deja de poder leerla. La fila existe, ocupa sitio y
-- no la ve nadie jamás.
--
-- No se vio probándolo: se vio leyendo las dos reglas juntas. Por separado las
-- dos son razonables.
--
-- LO QUE SE HACE
-- --------------
-- La policy se queda solo con el destinatario. Un aviso es de quien lo recibe, y
-- eso no depende de si sigue perteneciendo a la congregación: quien se da de
-- baja o a quien rechazan tiene derecho a leer lo último que se le dijo.
--
-- Lo que aquel término pretendía —que alguien en dos congregaciones no mezcle
-- sus avisos— no era cosa de la RLS: se resuelve filtrando por `iglesia_id` en
-- la consulta, que es donde estaba ya.
-- ===========================================================================

drop policy if exists notificaciones_select_propias on public.notificaciones;
drop policy if exists notificaciones_update_propias on public.notificaciones;

create policy notificaciones_select_propias on public.notificaciones
  for select to hatril_app
  using (destinatario_auth_user_id = (select auth.uid()));

create policy notificaciones_update_propias on public.notificaciones
  for update to hatril_app
  using (destinatario_auth_user_id = (select auth.uid()))
  with check (destinatario_auth_user_id = (select auth.uid()));
