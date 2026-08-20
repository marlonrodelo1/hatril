import { requirePermisoApi } from '@/lib/auth/guard-api';
import { evento, inscritosParaExportar } from '@/lib/eventos/consultas';
import { celda, ficheroCsv } from '@/lib/format/csv';
import { timestampAFechaHoraLocal } from '@/lib/fecha/zona';

/**
 * La lista de inscritos en CSV, para llevarla a la puerta del evento.
 *
 * SU PROPIO GUARD, Y NO ES REDUNDANTE
 * -----------------------------------
 * `../layout.tsx` hace `requirePermiso('gestionar_eventos')` y NO cubre esto:
 * los route handlers no participan en layouts. Y `src/proxy.ts` tampoco vale,
 * porque es comprobación optimista y no autorización. Sin esta línea, la lista
 * de asistentes de cualquier iglesia se descarga con la dirección a pelo.
 *
 * Devuelve `Response` y nunca `redirect()`: un redirect desde un endpoint que
 * sirve un fichero le entrega al navegador una página HTML con nombre de CSV.
 *
 * QUÉ NO SALE EN EL FICHERO
 * -------------------------
 * `codigo_cancelacion`, que es el secreto que sustituye a la cuenta de quien se
 * apuntó. No tiene por qué estar en un fichero que va a acabar en el WhatsApp
 * del equipo de logística. Tampoco la IP ni el navegador: son la prueba del
 * consentimiento y viven en la base, no en una hoja de cálculo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requirePermisoApi('gestionar_eventos');
  if (!guard.ok) return guard.respuesta;

  const { ctx } = guard;
  const { id } = await params;

  const e = await evento(ctx, id);
  if (!e) {
    return new Response('Ese evento no existe.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const filas = await inscritosParaExportar(ctx, id);
  const tz = ctx.iglesia.timezone;

  const CABECERA = [
    'Nombre',
    'Correo',
    'Telefono',
    'Acompanantes',
    'Personas',
    'Pagado',
    'Estado',
    'Se apunto el',
    'Nota',
  ];

  const lineas = [
    CABECERA.join(';'),
    ...filas.map((i) => {
      const alta = timestampAFechaHoraLocal(i.createdAt, tz);
      return [
        celda(i.nombre),
        celda(i.email),
        celda(i.telefono),
        // Números sin pasar por `celda()`: el prefijo de la neutralización de
        // fórmulas los convertiría en texto y dejarían de poder sumarse.
        String(i.acompanantes),
        String(1 + i.acompanantes),
        i.pagado ? 'Si' : 'No',
        i.canceladaAt ? 'Se dio de baja' : 'Viene',
        `${alta.fecha} ${alta.hora}`,
        celda(i.nota),
      ].join(';');
    }),
    '',
    // El aviso viaja DENTRO del fichero. Puesto solo en la pantalla se queda en
    // la pantalla, y quien reenvía el CSV ya no lo está viendo.
    celda(
      'Aviso: esta lista lleva nombres y correos de personas, algunas ajenas a la congregacion. Apuntarse a un acto de una iglesia dice algo de las creencias de quien se apunta, asi que trata este fichero como lo que es. Borralo cuando el evento haya pasado.',
    ),
  ];

  // `titulo` sale del pastor, así que puede traer barras, comillas o acentos.
  // Se recorta a lo que un nombre de fichero admite en cualquier sistema.
  const apodo =
    e.titulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'evento';

  return new Response(ficheroCsv(lineas), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="inscritos-${apodo}.csv"`,
      'cache-control': 'no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
