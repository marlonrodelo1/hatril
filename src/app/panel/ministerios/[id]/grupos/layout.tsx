import { requireGrupos } from './guarda';

/**
 * La guarda de los grupos: pastor o quien lidera la red desde dentro, y la
 * herramienta encendida. Aquí para que la navegación redirija, y en cada
 * página porque el layout no protege nada (`guarda.ts`).
 */
export default async function GruposLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  await requireGrupos(id);

  return <>{children}</>;
}
