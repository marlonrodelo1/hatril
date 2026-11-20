import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { MarcarTodo, VistaAvisos, ZONA_SIN_IGLESIA } from './_components/vista-avisos';

export const metadata: Metadata = { title: 'Avisos' };

/**
 * Los avisos de una persona.
 *
 * SOLO PIDE SESIÓN
 * ----------------
 * Ni `requireIglesia` ni permisos. Es la única pantalla del producto que tiene
 * que funcionar para alguien que NO pertenece a ninguna congregación: a quien le
 * rechazan la solicitud se le borra la membresía en el mismo movimiento, y su
 * aviso —el que le cuenta por qué— se quedaría fuera de su alcance con cualquier
 * guard de iglesia.
 *
 * `dynamic` porque cada persona ve una cosa distinta y cambia a cada minuto.
 *
 * DE UN VISTAZO (zona 2 del rediseño, 17-nov)
 * -------------------------------------------
 * Antes todos los avisos eran iguales: un turno y un comentario solo se
 * distinguían leyendo, y lo de hoy iba pegado a lo de hace un mes. Ahora cada
 * tipo lleva su icono y su color, y van agrupados en Hoy, Esta semana y Antes.
 */
export const dynamic = 'force-dynamic';

export default async function AvisosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/acceso?next=/mi/avisos');

  // El corte del consentimiento, solo para quien SÍ tiene iglesia: los avisos
  // nombran a terceros («Fulano quiere unirse»), y una cuenta que todavía no
  // ha aceptado no los lee aquí lo que no puede leer en el panel. Al rechazado,
  // que no tiene contexto, no le toca, y sigue viendo el aviso que le explica
  // por qué.
  const ctx = await getCurrentUserContext();
  if (ctx) await exigirConsentimientoAlDia(ctx);

  const avisos = await listarNotificaciones(user.id);
  const sinLeer = avisos.filter((a) => !a.leida).length;

  const zona = ctx?.iglesia.timezone ?? ZONA_SIN_IGLESIA;

  return (
    <VistaAvisos
      cabecera={
        <CabeceraMiembro user={user} titulo="Avisos" volver="/mi/comunidad" campana={false}>
          {sinLeer > 0 && (
            <MarcarTodo />
          )}
        </CabeceraMiembro>
      }
      avisos={avisos}
      zona={zona}
    />
  );
}
