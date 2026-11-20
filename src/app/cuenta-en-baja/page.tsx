import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { bajaPendiente } from '@/lib/cuenta/baja';
import { VistaCuentaEnBaja } from './_components/vista-cuenta-en-baja';

export const metadata: Metadata = { title: 'Tu cuenta se va a borrar' };

/**
 * Lo que ve quien pidió borrar su cuenta y vuelve a entrar antes del plazo.
 *
 * Llega aquí desde `/mi`: sus membresías están en `baja`, así que no tiene
 * contexto de iglesia, y `/mi` pregunta si es por una baja antes de contarle
 * nada sobre solicitudes. No se recupera sola al entrar: entrar puede ser
 * mirar, y la decisión de quedarse se toma con un botón.
 */
export default async function CuentaEnBajaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso');

  const baja = await bajaPendiente(user.id);
  if (!baja) redirect('/mi');

  return <VistaCuentaEnBaja borrarDesde={baja.borrarDesde} />;
}
