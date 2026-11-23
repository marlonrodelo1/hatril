import { CircleDashed, Wallet, type LucideIcon } from 'lucide-react';

import { moduloPorId } from '@/lib/ministerios/modulos';

/**
 * El icono de cada tarjeta de la portada del equipo, por el id de su pieza.
 *
 * POR QUÉ NO VIAJA CON LA TARJETA
 * -------------------------------
 * Viajaba: `TarjetaDePortada.modulo` llevaba el `Icono` del catálogo, y la web
 * lo pintaba sin problema porque todo se resuelve en el servidor. Pero la app
 * empaquetada recibe la portada en JSON, y un componente no sobrevive a
 * `JSON.stringify`: llegaba como un objeto vacío, React no sabía pintarlo, y
 * la portada de Equipo se caía entera para cualquiera que llevara un
 * ministerio. Ahora la tarjeta trae solo el id y el nombre, y el icono se
 * busca aquí, en un fichero sin `server-only` que la web y la app comparten.
 *
 * Los de los módulos salen del catálogo (`modulos.ts`). Las herramientas
 * derivadas (`HerramientaDerivada`, hoy el fondo) no están en él, y declaran
 * su icono aquí: su adaptador lleva `server-only`, y la app no puede
 * importarlo.
 */
export const ICONOS_DERIVADAS: Record<string, LucideIcon> = {
  fondo: Wallet,
};

export function iconoDePieza(id: string): LucideIcon {
  const modulo = moduloPorId(id);
  if (modulo) return modulo.Icono;
  // `Object.hasOwn`: un id «constructor» no puede devolver lo del prototipo.
  if (Object.hasOwn(ICONOS_DERIVADAS, id)) return ICONOS_DERIVADAS[id]!;
  // Una pieza nueva sin icono declarado se pinta con uno neutro, no se cae.
  return CircleDashed;
}
