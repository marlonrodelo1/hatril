import type { Metadata } from 'next';
import { z } from 'zod';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { estadoDeDar, misDonativos } from '@/lib/donativos/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { EnlaceADar } from '../../_components/enlace-a-dar';
import { VistaDonativos } from '../_components/vista-donativos';

export const metadata: Metadata = { title: 'Lo que he dado' };

/** `?anio=2025`. Lo que no sea un año se ignora y se enseña el de ahora. */
const Busqueda = z.object({
  anio: z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .optional(),
});

/**
 * «Lo que he dado»: lo que esta persona ha dado con tarjeta a su iglesia.
 *
 * Dentro de la app y no en Safari, al revés que la página de dar: enseñar no
 * es cobrar, y la norma 3.2.2 de Apple va de lo segundo.
 *
 * SOLO LO SUYO, AUNQUE MIRE EL PASTOR
 * -----------------------------------
 * `misDonativos` va por `withUser`, y la RLS de la `0056` le da al pastor y a
 * tesorería los donativos de toda la iglesia. Por eso filtra además por su
 * `auth_user_id`: esta pantalla es la de cada cual, y la de la iglesia está en
 * Finanzas. Lo mismo la action de «Dejarlo».
 *
 * EL CERTIFICADO, PARA DESPUÉS
 * ----------------------------
 * Lo que en España se pide para desgravar lo donado no lo puede emitir
 * cualquier iglesia, y está sin confirmar con un asesor cuáles sí. Queda una
 * línea que lo dice en lugar del botón de la maqueta.
 */
export default async function LoQueHeDadoPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; error?: string; dejado?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { anio: anioCrudo, error, dejado } = await searchParams;
  const busqueda = Busqueda.safeParse({ anio: anioCrudo });
  const anioPedido = busqueda.success ? busqueda.data.anio : undefined;

  const [mios, dar] = await Promise.all([
    misDonativos(ctx, anioPedido),
    estadoDeDar(ctx.iglesia.id),
  ]);

  const actual = Number(hoyEnLaIglesia(ctx.iglesia.timezone).slice(0, 4));

  return (
    <VistaDonativos
      cabecera={
        <CabeceraMiembro
          user={ctx.user}
          titulo="Lo que he dado"
          subtitulo={ctx.iglesia.nombre}
          volver="/mi/cuenta"
        />
      }
      EnlaceDar={EnlaceADar}
      iglesia={ctx.iglesia}
      mios={mios}
      dar={dar}
      actual={actual}
      error={error}
      dejado={dejado}
    />
  );
}
