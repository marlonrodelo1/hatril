import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { Presentacion } from './_components/presentacion';

export const metadata: Metadata = { title: 'Bienvenida' };

/**
 * La presentación de la primera vez.
 *
 * Quien ya tiene sesión no la necesita: entra a lo suyo. La decisión de
 * enseñarla o no la toma `/mi` con la cookie; aquí solo se corta a quien ya
 * está dentro.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/mi');

  return <Presentacion />;
}
