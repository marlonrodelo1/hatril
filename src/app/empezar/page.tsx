import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { VistaEmpezar } from './_components/vista-empezar';

export const metadata: Metadata = { title: 'Empezar' };

/**
 * «¿Ya eres de una iglesia o estás buscando una?»
 *
 * Las dos respuestas llevan a buscar, por caminos distintos: quien ya es de
 * una sabe su nombre; quien busca quiere ver qué hay cerca. Ninguna pide la
 * cuenta todavía: se pide al final, al solicitar entrar, que es lo que pide
 * Apple y lo que hace que alguien llegue hasta ahí.
 */
export default async function EmpezarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/mi');

  return <VistaEmpezar />;
}
