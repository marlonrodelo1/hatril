import type { Metadata } from 'next';
import { z } from 'zod';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misBloqueos, nombreDeMiembro } from '@/lib/comunidad/moderacion';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { VistaDenunciaEnviada } from '../_components/vista-denuncia-enviada';

export const metadata: Metadata = { title: 'Denuncia enviada' };

/**
 * Lo que se ve después de denunciar.
 *
 * Página y no un aviso en el muro porque aquí se ofrece el paso siguiente
 * —bloquear a esa persona—, y un aviso verde que se va al recargar no deja
 * sitio para eso.
 *
 * El `?autor=` es el id de una ficha y nada más: el nombre se resuelve por
 * `withUser`, así que un id de otra iglesia no pinta nada.
 */
export default async function DenunciaEnviadaPage({
  searchParams,
}: {
  searchParams: Promise<{ autor?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { autor } = await searchParams;
  const autorId = z.uuid().safeParse(autor).success ? autor! : null;

  const [nombre, bloqueos] = await Promise.all([
    autorId ? nombreDeMiembro(ctx, autorId) : Promise.resolve(null),
    misBloqueos(ctx),
  ]);
  const yaBloqueado = bloqueos.some((b) => b.miembroId === autorId);

  return (
    <VistaDenunciaEnviada
      cabecera={
        <CabeceraMiembro
          user={ctx.user}
          titulo="Comunidad"
          subtitulo={ctx.iglesia.nombre}
          volver="/mi/comunidad"
        />
      }
      autorId={autorId}
      nombre={nombre}
      yaBloqueado={yaBloqueado}
    />
  );
}
