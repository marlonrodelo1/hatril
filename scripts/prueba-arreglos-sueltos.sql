-- Datos de prueba de la rama `arreglos-sueltos` (20-oct-2026).
--
-- Dos bloques, cada uno con su limpieza. NADA de esto debe quedarse en la
-- base: se crea, se mira en la pantalla y se borra. Va escrito aquí para que
-- quien repita la prueba sepa exactamente qué se tocó y cómo deshacerlo.
--
-- Se ejecuta por `DATABASE_URL` (el MCP de Supabase es de solo lectura), por
-- ejemplo con un `postgres(...).unsafe(sql)` desde node.


-- ============================================================================
-- 1. El libro de caja con más de una página
-- ============================================================================
--
-- 62 movimientos en Betania en JUNIO de 2026: más de los 50 por página, y en un
-- mes pasado para no ensuciar el mes en curso, que es el que abre el libro y el
-- que miran las demás sesiones. Se ven en
--   /panel/finanzas/movimientos?desde=2026-06-01&hasta=2026-06-30
--   /panel/finanzas/informe?mes=2026-06
--
-- El concepto lleva la marca `[prueba-libro]`, que es lo que usa el borrado.
-- Los 30 días de junio, dos o tres movimientos por día, para que haya fechas
-- repetidas y se vea que el desempate por id no repite ni salta filas al
-- cambiar de página.

insert into movimientos
  (iglesia_id, tipo, fecha, importe, concepto, fondo_id, caja_id, tipo_ingreso)
select
  'aaaaaaaa-1111-4111-8111-000000000001',
  case when n % 5 = 0 then 'gasto' else 'ingreso' end::tipo_movimiento_enum,
  date '2026-06-01' + ((n - 1) % 30),
  1000 * n,
  '[prueba-libro] Movimiento ' || lpad(n::text, 2, '0'),
  f.id,
  c.id,
  case when n % 5 = 0 then null else 'ofrenda' end::tipo_ingreso_enum
from generate_series(1, 62) as n
cross join lateral (
  select id from fondos
   where iglesia_id = 'aaaaaaaa-1111-4111-8111-000000000001' and es_general
   limit 1
) f
cross join lateral (
  select id from cajas
   where iglesia_id = 'aaaaaaaa-1111-4111-8111-000000000001'
   order by nombre
   limit 1
) c;

-- Para ver el aviso del informe («los 500 más recientes de los 512») se
-- añadieron un rato 450 más, `[prueba-libro] Relleno N`, de 100 cada uno. El
-- mismo borrado se los lleva.
--
-- Limpieza:
-- delete from movimientos
--  where iglesia_id = 'aaaaaaaa-1111-4111-8111-000000000001'
--    and concepto like '[prueba-libro]%';


-- ============================================================================
-- 2. La iglesia de prueba registrada por /registro
-- ============================================================================
--
-- No se crea con SQL: se crea pulsando «Crear la iglesia» en
-- http://localhost:3004/registro, que es lo que hay que probar. Los datos:
--
--   Iglesia   Iglesia Prueba Registro
--   Ciudad    Bogotá (Colombia)
--   Pastor    Pastora Prueba Registro
--   Correo    pastor.registro@hatril.test
--   Casilla de asistencia MARCADA
--
-- El alta NO llama a Stripe ni a Resend. Solo toca Supabase: crea el usuario
-- con `auth.admin.createUser({ email_confirm: true })`, que no manda correo, y
-- la iglesia en una transacción (`crear-iglesia.ts`). Un `.test` tampoco
-- tendría a dónde llegar.
--
-- Para ver el resultado: entrar como esa pastora por enlace mágico, apuntar un
-- culto en /panel/reuniones/nueva y mirar que sale en «Quién vino».
--
-- Limpieza. NO vale un `delete from iglesias` a secas, aunque todo cuelgue en
-- cascada: el trigger `auditar()` de las tablas hijas escribe en `auditoria`
-- una fila con el `iglesia_id` que se está borrando, y la clave ajena la
-- rechaza («auditoria_iglesia_id_iglesias_id_fk»). Hay que vaciar antes las
-- tablas auditadas —la iglesia todavía existe y la auditoría se escribe— y
-- borrar la iglesia al final, que se lleva esas filas de auditoría. En una
-- transacción:
--
-- begin;
-- delete from reuniones           where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from turnos              where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from eventos             where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from devocionales        where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from ministerio_miembros where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from ministerios         where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from iglesia_usuarios    where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from consentimientos     where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from miembros            where iglesia_id = (select id from iglesias where slug = 'iglesia-prueba-registro');
-- delete from iglesias            where slug = 'iglesia-prueba-registro';
-- delete from auth.users          where email = 'pastor.registro@hatril.test';
-- commit;
--
-- Se ejecutó así el 20-oct-2026 y no dejó nada: ni la iglesia, ni la cuenta, ni
-- filas en `auditoria` con su id.


-- ============================================================================
-- 3. Una cuenta sin iglesia para ver el formulario de /solicitar
-- ============================================================================
--
-- `/solicitar/[slug]` solo pinta las casillas a quien tiene sesión y no tiene
-- ni iglesia ni solicitud, y ninguna cuenta de la demo cumple las dos cosas
-- (`visita@` ya tiene una pendiente). Se creó con la API de administración,
-- SIN contraseña —se entra por enlace mágico—:
--
--   auth.admin.createUser({ email: 'solicitar.arreglos@hatril.test',
--                           email_confirm: true })
--
-- Se mandó una solicitud a Betania con la casilla de asistencia marcada
-- (quedó `acepta_asistencia = true`, `privacidad-2026-09`) y se deshizo entera.
-- Además de la solicitud deja dos avisos «solicitud recibida» al equipo de
-- Betania, una membresía pendiente y sus dos filas de auditoría (alta y baja).
-- Limpieza, en una transacción:
--
-- delete from notificaciones where tipo = 'solicitud_recibida'
--    and datos::text like '%Prueba Solicitar%';
-- delete from solicitudes_ingreso where auth_user_id =
--    (select id from auth.users where email = 'solicitar.arreglos@hatril.test');
-- delete from iglesia_usuarios where auth_user_id =
--    (select id from auth.users where email = 'solicitar.arreglos@hatril.test');
-- -- Después del anterior, no antes: borrar la membresía escribe su «baja».
-- delete from auditoria where entidad = 'iglesia_usuarios'
--    and coalesce(datos_despues, datos_antes)->>'auth_user_id' =
--        (select id::text from auth.users where email = 'solicitar.arreglos@hatril.test');
-- delete from auth.users where email = 'solicitar.arreglos@hatril.test';
