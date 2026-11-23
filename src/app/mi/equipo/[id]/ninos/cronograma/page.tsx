import type { Metadata } from 'next';

import { VistaCronograma } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Cronograma de las clases' };

/** El cronograma de Niños, para leerlo en la app. Lo que pinta: `./vista.tsx`. */
export default async function CronogramaEnLaAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await cargar({ id });
  return <VistaCronograma {...datos} />;
}
