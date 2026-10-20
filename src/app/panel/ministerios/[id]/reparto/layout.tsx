import { requireReparto } from './guarda';

/**
 * El guard del reparto. Las dos puertas de los otros módulos, con la primera
 * más estrecha:
 *
 *   1. `requireGestionMinisterio(id, { desdeDentro: true })` — el pastor, o el
 *      responsable y los colíderes de ESTE equipo. Sin `gestionar_ministerios`:
 *      la RLS de la `0042` es por equipo, y a quien no está en él la base no le
 *      enseña el padrón. Abrirle la pantalla sería darle un listado vacío.
 *   2. El módulo encendido. Apagado, la ruta no existe para ese ministerio.
 *
 * Aquí Y en cada página (`guarda.ts` cuenta por qué el layout solo no basta).
 * Las actions llevan las mismas dos puertas por su cuenta: un layout no corre
 * en una server action.
 */
export default async function RepartoLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  await requireReparto(id);

  return <>{children}</>;
}
