import { requireNinos } from './guarda';

/**
 * El guard del tablón de familias: el de cada página, repetido para que la
 * navegación redirija. No protege nada por sí solo (`guarda.ts`), y las
 * actions llevan sus dos puertas por su cuenta.
 */
export default async function NinosLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  await requireNinos(id);

  return <>{children}</>;
}
