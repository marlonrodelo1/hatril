import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { denunciasPendientes } from '@/lib/comunidad/moderacion';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { VistaDenuncias } from '../_components/vista-denuncias';

export const metadata: Metadata = { title: 'Denuncias' };
export const dynamic = 'force-dynamic';

/**
 * La cola de quien modera la comunidad.
 *
 * EN `/mi` Y NO EN EL PANEL
 * -------------------------
 * `moderar_comunidad` se puede dar a un miembro raso, y un miembro raso no
 * entra al panel. La moderación se ejerce donde está el muro.
 *
 * LA GUARDA VA AQUÍ, NO EN UN LAYOUT
 * ----------------------------------
 * `requireIglesia()` más el permiso, en la propia página (CLAUDE.md). Y aunque
 * se cayera, la policy de la `0053` solo enseña a quien no modera sus propias
 * denuncias.
 *
 * SIN EL NOMBRE DE QUIEN DENUNCIA
 * -------------------------------
 * Ni se pinta ni se consulta (`denunciasPendientes` no lo devuelve). Lo que
 * decide el moderador es si eso puede estar en el muro, y para eso no hace
 * falta saber quién avisó; saberlo es la forma más corta de que deje de avisar
 * nadie.
 */
export default async function DenunciasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; hecho?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  if (!puedeModerarComunidad(ctx)) redirect('/mi/comunidad');

  const { error, hecho } = await searchParams;
  const cola = await denunciasPendientes(ctx);

  return (
    <VistaDenuncias
      cabecera={
        <CabeceraMiembro
          user={ctx.user}
          titulo="Denuncias"
          subtitulo={ctx.iglesia.nombre}
          volver="/mi/comunidad"
        />
      }
      cola={cola}
      error={error}
      hecho={hecho}
    />
  );
}
