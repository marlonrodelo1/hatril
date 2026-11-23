import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { EnlaceADar } from '../_components/enlace-a-dar';
import { VistaCuenta } from './_components/vista-cuenta';
import { datosDeMiCuenta } from './datos';

export const metadata: Metadata = { title: 'Mi cuenta' };


/**
 * Mi cuenta, ordenada como los ajustes del móvil: la cara arriba y debajo
 * grupos con la misma fila (`_components/ajustes.tsx`).
 *
 * El orden va de lo que más se mira a lo que casi nunca: tus datos y tus
 * equipos, ofrendar, privacidad, la sesión, y borrar la cuenta al final y
 * sola. Antes todo pesaba lo mismo —bloqueados y la política eran tan grandes
 * como tus equipos— y era una pantalla larga que costaba recorrer.
 *
 * No hay ningún naranja: aquí no hay una acción de la pantalla, cada fila es
 * la suya.
 */
export default async function MiCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const datos = await datosDeMiCuenta(ctx, user!);

  return (
    <VistaCuenta
      cabecera={
        <CabeceraMiembro
          user={user!}
          titulo="Mi cuenta"
          subtitulo={ctx.iglesia.nombre}
          logoUrl={ctx.iglesia.logoUrl}
        />
      }
      EnlaceDar={EnlaceADar}
      error={error}
      guardado={guardado}
      {...datos}
    />
  );
}
