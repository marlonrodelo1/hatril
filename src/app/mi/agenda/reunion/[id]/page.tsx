import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { reunionParaMiembro } from '@/lib/agenda/ensayos';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../../../_components/cabecera-miembro';
import { VistaReunion } from './_components/vista-reunion';

export const metadata: Metadata = { title: 'Agenda del equipo' };

/**
 * Un ensayo, o cualquier reunión de un equipo, visto desde dentro del equipo.
 *
 * Antes la fila del calendario llevaba a la propia agenda, y el músico no tenía
 * forma de leer el lugar entero ni las notas («traed los in-ear», «empezamos
 * por el coro»): las escribía el responsable y no le llegaban a nadie.
 *
 * Solo lectura. Lo que se hace con un ensayo —cambiarlo, pasar lista— lo hace
 * el responsable desde el panel. Fuera del equipo es un 404: lo decide
 * `reunionParaMiembro()`, que mira la pertenencia real.
 */
export default async function ReunionMiembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { id } = await params;

  const reunion = await reunionParaMiembro(ctx, id);
  if (!reunion) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <VistaReunion
      cabecera={
        <CabeceraMiembro
          user={user!}
          titulo="Agenda del equipo"
          subtitulo={reunion.ministerio.nombre}
          volver="/mi/agenda"
        />
      }
      reunion={reunion}
    />
  );
}
