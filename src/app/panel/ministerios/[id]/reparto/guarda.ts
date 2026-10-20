import 'server-only';

import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * Las dos puertas del reparto, para el layout Y para cada página.
 *
 * POR QUÉ NO BASTA CON EL LAYOUT
 * ------------------------------
 * La convención del repo pone los guards en el `layout.tsx` de la sección. Para
 * el reparto no alcanza, y lo dice la propia documentación de Next 16
 * (`02-guides/authentication.md`, «Layouts and auth checks»): un layout no
 * controla si el resto de la ruta se renderiza; la página se ejecuta igual y su
 * resultado puede viajar en el payload RSC aunque el layout redirija.
 *
 * Aquí eso importa más que en ningún otro módulo. La RLS del padrón (`0042`)
 * deja pasar a cualquiera que SIRVA en el equipo, voluntarios incluidos, y la
 * aplicación es más estrecha a propósito: en la v1 solo el pastor y quien
 * lidera el equipo. Un voluntario que pidiera la página a mano pasaría la base,
 * y lo único que le paraba era un layout que no para. Con la puerta en cada
 * página, no.
 *
 * `getCurrentUserContext` va con `cache()`, así que repetirla en layout y página
 * cuesta una consulta por clave primaria, no un viaje entero.
 */
export async function requireReparto(id: string) {
  const ctx = await requireGestionMinisterio(id, { desdeDentro: true });
  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio || !tieneModulo(ministerio.modulos, 'reparto')) notFound();
  return { ctx, ministerio };
}
