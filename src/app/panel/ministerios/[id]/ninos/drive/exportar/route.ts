import { downloadZip } from 'client-zip';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { requireModuloMinisterioApi } from '@/lib/auth/guard-api';
import { withUser } from '@/lib/db';
import { ninosArchivos } from '@/lib/db/schema';
import { BUCKETS, SEGUNDOS_FIRMA } from '@/lib/ninos/almacen';
import { createAdminClient } from '@/lib/supabase/admin';
import { aceptaFamilias } from '../../guarda';

/**
 * Descargar un mes entero del drive en un ZIP, antes de que se borre.
 *
 * QUIÉN: la responsable y el pastor, no los maestros. Cada descarga es una
 * copia de las fotos de los niños fuera de Hatril, de la que ya responde la
 * iglesia; cuantas menos manos, menos copias. Es la misma puerta que aceptar
 * familias (`aceptaFamilias`), por encima de la del módulo.
 *
 * CÓMO: el ZIP se arma según se lee de Storage, fichero a fichero, y sale por
 * la respuesta sin guardarse entero ni en memoria ni en disco
 * (`client-zip`, sin comprimir: fotos y vídeos ya vienen comprimidos). Cada
 * fichero se firma justo antes de pedirlo, con la firma corta de siempre: un
 * mes con muchos vídeos tarda más que esos diez minutos en salir entero.
 *
 * Los nombres de dentro los pone el servidor —`2026-11-21/001-foto.webp`—:
 * ningún nombre de niño viaja en el ZIP.
 *
 * Se apunta `exportado_at` al empezar: es lo que dice que esa foto ya tiene
 * una copia fuera, aunque la descarga se corte (y entonces se repite).
 */
export const dynamic = 'force-dynamic';

const Mes = /^\d{4}-(0[1-9]|1[0-2])$/;

function texto(mensaje: string, status: number): Response {
  return new Response(mensaje, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const guard = await requireModuloMinisterioApi(id, 'ninos', { desdeDentro: true });
  if (!guard.ok) return guard.respuesta;
  const { ctx, ministerio } = guard;

  if (!aceptaFamilias(ctx, ministerio)) {
    return texto('Descargar el drive es de la responsable del ministerio o del pastor.', 403);
  }

  const mes = new URL(request.url).searchParams.get('mes') ?? '';
  if (!Mes.test(mes)) return texto('Ese mes no se entiende. Tiene que ser como 2026-11.', 400);

  const archivos = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ninosArchivos.id,
        tipo: ninosArchivos.tipo,
        ruta: ninosArchivos.ruta,
        fecha: ninosArchivos.fecha,
        createdAt: ninosArchivos.createdAt,
      })
      .from(ninosArchivos)
      .where(
        and(
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, id),
          isNotNull(ninosArchivos.confirmadoAt),
          sql`to_char(${ninosArchivos.fecha}, 'YYYY-MM') = ${mes}`,
        ),
      )
      .orderBy(asc(ninosArchivos.fecha), asc(ninosArchivos.createdAt)),
  );
  if (archivos.length === 0) return texto('No hay fotos ni vídeos de ese mes.', 404);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ninosArchivos)
      .set({ exportadoAt: new Date() })
      .where(
        and(
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          inArray(
            ninosArchivos.id,
            archivos.map((a) => a.id),
          ),
        ),
      ),
  );

  const storage = createAdminClient().storage;
  async function* ficheros() {
    let n = 0;
    for (const a of archivos) {
      const { data } = await storage.from(BUCKETS[a.tipo]).createSignedUrl(a.ruta, SEGUNDOS_FIRMA);
      if (!data?.signedUrl) continue;
      const respuesta = await fetch(data.signedUrl);
      // Uno que falta (borrado a mano, o a medias) no tumba el mes entero.
      if (!respuesta.ok || !respuesta.body) continue;
      n += 1;
      const extension = a.ruta.slice(a.ruta.lastIndexOf('.') + 1);
      yield {
        input: respuesta.body,
        name: `${a.fecha}/${String(n).padStart(3, '0')}-${a.tipo}.${extension}`,
        lastModified: a.createdAt,
      };
    }
  }

  const zip = downloadZip(ficheros());
  const nombre = `ninos-${mes}.zip`;
  return new Response(zip.body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${nombre}"`,
      'cache-control': 'no-store',
    },
  });
}
