'use client';

import { createContext, useContext } from 'react';

/**
 * El número de pendientes, del layout de `/admin` a los dos menús.
 *
 * POR QUÉ UN CONTEXTO Y NO UNA PROP
 * ---------------------------------
 * El menú lateral lo pinta el layout, pero el de móvil va dentro de la
 * cabecera, y la cabecera la pinta cada página. Para que le llegara por prop
 * habría que pasarlo por las seis páginas de `/admin`, o que la cabecera
 * repitiera la consulta. Y la cabecera se vuelve a pintar en cada navegación,
 * mientras que el layout no: serían una consulta por clic para enseñar un
 * número que ya está en el navegador.
 *
 * Con el contexto, la consulta es una (en el layout), los dos menús enseñan el
 * mismo número, y el número se pone al día cuando el layout se vuelve a pintar:
 * al recargar y tras cada palanca, que hacen `revalidatePath('/admin', 'layout')`.
 */
const Pendientes = createContext(0);

export function MarcoAdmin({
  pendientes,
  children,
}: {
  pendientes: number;
  children: React.ReactNode;
}) {
  return <Pendientes.Provider value={pendientes}>{children}</Pendientes.Provider>;
}

export function usePendientes() {
  return useContext(Pendientes);
}

/** Lo que dice el número a quien no lo ve. Un «2» suelto no significa nada. */
export function textoPendientes(n: number) {
  return n === 1 ? '1 iglesia pide atención' : `${n} iglesias piden atención`;
}
