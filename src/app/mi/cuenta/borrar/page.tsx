import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import {
  bajaPendiente,
  fechaDeBorradoSiSePideHoy,
  porQueNoSePuedeBorrar,
  turnosPorVenir,
} from '@/lib/cuenta/baja';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { VistaBorrar } from '../_components/vista-borrar';

export const metadata: Metadata = { title: 'Borrar mi cuenta' };

/**
 * Borrar la cuenta. Lo exigen Apple (5.1.1(v)) y Google.
 *
 * Solo pide sesión, no iglesia: ver la cabecera de `actions.ts`. Por eso no usa
 * `requireIglesia()`, y la guarda es el `getUser()` de aquí mismo.
 */
export default async function BorrarCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso?next=' + encodeURIComponent('/mi/cuenta/borrar'));

  if (await bajaPendiente(user.id)) redirect('/cuenta-en-baja');

  const { error } = await searchParams;
  const [impedimento, turnos] = await Promise.all([
    porQueNoSePuedeBorrar(user.id),
    turnosPorVenir(user.id),
  ]);


  const dia = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(fechaDeBorradoSiSePideHoy());

  return (
    <VistaBorrar
      cabecera={
        <CabeceraMiembro user={user} titulo="Borrar mi cuenta" volver="/mi/cuenta" />
      }
      impedimento={impedimento}
      turnos={turnos}
      dia={dia}
      error={error}
    />
  );
}
