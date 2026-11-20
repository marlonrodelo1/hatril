import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misBloqueos } from '@/lib/comunidad/moderacion';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { VistaBloqueados } from '../_components/vista-bloqueados';

export const metadata: Metadata = { title: 'Personas bloqueadas' };

/**
 * A quién has bloqueado en el muro, y deshacerlo.
 *
 * Bloquear sin poder desbloquear sería una puerta que solo se cierra, y la
 * pantalla del bloqueo promete que se deshace desde aquí.
 */
export default async function BloqueadosPage({
  searchParams,
}: {
  searchParams: Promise<{ desbloqueado?: string; error?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { desbloqueado, error } = await searchParams;
  const bloqueos = await misBloqueos(ctx);

  return (
    <VistaBloqueados
      cabecera={
        <CabeceraMiembro
          user={ctx.user}
          titulo="Personas bloqueadas"
          subtitulo={ctx.iglesia.nombre}
          volver="/mi/cuenta"
        />
      }
      bloqueos={bloqueos}
      timezone={ctx.iglesia.timezone}
      desbloqueado={desbloqueado}
      error={error}
    />
  );
}
