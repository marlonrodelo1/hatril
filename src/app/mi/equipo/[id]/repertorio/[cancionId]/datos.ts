import 'server-only';

import { notFound } from 'next/navigation';
import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { obtenerCancion } from '@/lib/repertorio/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, cancionId, error, guardado }: { id: string; cancionId: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'repertorio');
  exigirUuid(cancionId);

  const cancion = await obtenerCancion(ctx, cancionId);
  // La canción tiene que ser de este equipo, no del de al lado.
  if (!cancion || cancion.ministerioId !== id) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  // La historia lleva a cada turno, y esa pantalla solo existe con los turnos
  // encendidos: sin ellos, la fecha se queda como texto.
  const conTurnos = tieneModulo(ministerio.modulos, 'turnos');
  const enlaces = [
    { href: cancion.enlaceAudio, texto: 'Escuchar' },
    { href: cancion.enlacePartitura, texto: 'Acordes y letra' },
  ].filter((e): e is { href: string; texto: string } => Boolean(e.href));

  return { id, cancionId, error, guardado, ctx, ministerio, cancion, hoy, conTurnos, enlaces };
}
