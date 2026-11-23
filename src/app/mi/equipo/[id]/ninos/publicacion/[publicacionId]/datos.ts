import 'server-only';

import { notFound } from 'next/navigation';

import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { archivosDelDrive, ninosDelMinisterio, publicacionDelTablon } from '@/lib/ninos/consultas';
import { firmarArchivos } from '@/app/panel/ministerios/[id]/ninos/_components/archivo';

/**
 * Una publicación del tablón en la app del equipo: el texto, sus fotos, quién
 * puede salir en ellas, subir más y publicar. La misma puerta que el tablón.
 *
 * Las URL de las fotos se firman aquí (diez minutos) y viajan ya dentro de
 * cada archivo: la app recibe JSON, y una función no viaja. De cada archivo,
 * solo lo que se pinta: la ruta en Storage no sale del servidor.
 */
export async function cargar({
  id,
  publicacionId,
  error,
  guardado,
}: {
  id: string;
  publicacionId: string;
  error?: string;
  guardado?: string;
}) {
  exigirUuid(publicacionId);
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'ninos');

  const [publicacion, drive, ninos] = await Promise.all([
    publicacionDelTablon(ctx, id, publicacionId),
    archivosDelDrive(ctx, id),
    ninosDelMinisterio(ctx, id),
  ]);
  if (!publicacion) notFound();

  const disponibles = drive.filter((a) => a.publicacionId === null).slice(0, 60);
  const urls = await firmarArchivos([...publicacion.archivos, ...disponibles]);
  const conUrls = (a: (typeof drive)[number]) => ({
    id: a.id,
    tipo: a.tipo,
    duracionS: a.duracionS,
    fecha: a.fecha,
    urls: urls(a),
  });

  return {
    id,
    publicacionId,
    error,
    guardado,
    ctx,
    ministerio,
    hoy: hoyEnLaIglesia(ctx.iglesia.timezone),
    publicacion: {
      fecha: publicacion.fecha,
      texto: publicacion.texto,
      publicada: publicacion.publicadaAt !== null,
      caducaEl: publicacion.caducaEl,
    },
    archivos: publicacion.archivos.map(conUrls),
    disponibles: disponibles.map(conUrls),
    pueden: ninos.filter((n) => n.puedeSalir).map((n) => n.nombre),
  };
}
