import 'server-only';

import { inArray, sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { ninosArchivos } from '@/lib/db/schema';
import { emitirNotificacion } from '@/lib/notificaciones/emitir';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { BUCKETS, borrarFicheros } from './almacen';
import { fechaDeBorrado } from './limites';

/**
 * Lo que hace cumplir «se borra al año»: el cron de una vez al día
 * (`POST /api/v1/cron/ninos`).
 *
 * POR `dbAdmin`
 * -------------
 * Es un cron, uno de los usos que CLAUDE.md permite: recorre TODAS las iglesias
 * y no hay ninguna sesión detrás. Por eso cada paso acota por la fecha de la
 * propia iglesia (`iglesias.timezone`): «hoy» en Canarias no es «hoy» en Bogotá.
 *
 * QUÉ HACE, EN ESTE ORDEN
 * -----------------------
 *   1. Borra lo caducado del drive: primero el fichero en Storage y después la
 *      fila. En ese orden y no al revés porque es lo que deja reintentar: si
 *      Storage falla, la fila sigue y mañana se vuelve a intentar; al revés,
 *      quedaría un fichero que nada apunta.
 *   2. Borra las publicaciones caducadas del tablón, texto incluido.
 *   3. Borra las subidas que nunca se confirmaron (más de 24 horas): alguien
 *      cerró la app a mitad de subida.
 *   4. Barre los ficheros huérfanos de los dos buckets: los que no apunta
 *      ninguna fila y tienen más de 24 horas.
 *   5. Avisa, 30 días antes, de cada mes que se va a borrar. Una vez por
 *      archivo (`avisado_at`), y solo si el tablón sigue encendido: con él
 *      apagado, el drive da 404 y el aviso llevaría a ninguna parte.
 *
 * Borrar no mira si el módulo está encendido: apagarlo no alarga la vida de
 * una foto. La promesa de /privacidad es de doce meses, no «mientras esté
 * encendido».
 */

const TANDA = 100;

export type ResultadoLimpieza = {
  archivosCaducados: number;
  publicacionesCaducadas: number;
  sinConfirmar: number;
  huerfanos: number;
  avisos: number;
  errores: string[];
};

type FilaArchivo = { id: string; tipo: 'foto' | 'video'; ruta: string; miniatura_ruta: string | null };

function filas<T>(res: unknown): T[] {
  return ((res as { rows?: T[] }).rows ?? (res as T[])) as T[];
}

/** Borra en Storage y después las filas, por tandas. Devuelve cuántas filas. */
async function borrarArchivos(archivos: FilaArchivo[], errores: string[]): Promise<number> {
  let borradas = 0;
  for (let i = 0; i < archivos.length; i += TANDA) {
    const tanda = archivos.slice(i, i + TANDA);
    try {
      await borrarFicheros('foto', tanda.filter((a) => a.tipo === 'foto').map((a) => a.ruta));
      await borrarFicheros('video', tanda.filter((a) => a.tipo === 'video').map((a) => a.ruta));
      await borrarFicheros(
        'miniatura',
        tanda.map((a) => a.miniatura_ruta ?? '').filter(Boolean),
      );
    } catch (err) {
      // Sin borrar las filas: mañana se reintenta con ellas.
      errores.push(`storage: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    // Con el constructor y no con `sql`: un array dentro de `sql` se expande en
    // una lista de parámetros, no en uno, y `= any(...)` se rompería.
    await dbAdmin.delete(ninosArchivos).where(inArray(ninosArchivos.id, tanda.map((a) => a.id)));
    borradas += tanda.length;
  }
  return borradas;
}

export async function limpiarNinos(): Promise<ResultadoLimpieza> {
  const errores: string[] = [];

  // 1. Lo caducado del drive, con la fecha de cada iglesia.
  const caducados = filas<FilaArchivo>(
    await dbAdmin.execute(sql`
      select a.id::text, a.tipo::text, a.ruta, a.miniatura_ruta
        from ninos_archivos a
        join iglesias i on i.id = a.iglesia_id
       where a.caduca_el <= (now() at time zone i.timezone)::date
    `),
  );
  const archivosCaducados = await borrarArchivos(caducados, errores);

  // 2. Las publicaciones caducadas. Sus archivos que no caducaban con ellas
  //    (de otro día) se quedan en el drive: `publicacion_id` pasa a null.
  const publicaciones = filas<{ id: string }>(
    await dbAdmin.execute(sql`
      delete from ninos_publicaciones p
       using iglesias i
       where i.id = p.iglesia_id
         and p.caduca_el <= (now() at time zone i.timezone)::date
      returning p.id::text
    `),
  );

  // 3. Las subidas a medias.
  const aMedias = filas<FilaArchivo>(
    await dbAdmin.execute(sql`
      select id::text, tipo::text, ruta, miniatura_ruta
        from ninos_archivos
       where confirmado_at is null
         and created_at < now() - interval '24 hours'
    `),
  );
  const sinConfirmar = await borrarArchivos(aMedias, errores);

  // 4. Los huérfanos: ficheros de más de un día que ninguna fila apunta.
  const huerfanos = filas<{ bucket_id: string; name: string }>(
    await dbAdmin.execute(sql`
      select o.bucket_id, o.name
        from storage.objects o
       where o.bucket_id in (${BUCKETS.foto}, ${BUCKETS.video})
         and o.created_at < now() - interval '24 hours'
         and not exists (
           select 1 from ninos_archivos a
            where (a.ruta = o.name
                   and o.bucket_id = case a.tipo when 'foto' then ${BUCKETS.foto} else ${BUCKETS.video} end)
               or (a.miniatura_ruta = o.name and o.bucket_id = ${BUCKETS.foto})
         )
       limit 1000
    `),
  );
  try {
    for (let i = 0; i < huerfanos.length; i += TANDA) {
      const tanda = huerfanos.slice(i, i + TANDA);
      await borrarFicheros('foto', tanda.filter((h) => h.bucket_id === BUCKETS.foto).map((h) => h.name));
      await borrarFicheros('video', tanda.filter((h) => h.bucket_id === BUCKETS.video).map((h) => h.name));
    }
  } catch (err) {
    errores.push(`huérfanos: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. El aviso de 30 días, por iglesia, ministerio y mes.
  const avisos = await avisarDeLoQueCaduca(errores);

  return {
    archivosCaducados,
    publicacionesCaducadas: publicaciones.length,
    sinConfirmar,
    huerfanos: huerfanos.length,
    avisos,
    errores,
  };
}

type GrupoQueCaduca = {
  iglesia_id: string;
  ministerio_id: string;
  ministerio: string;
  modulos: unknown;
  mes: string;
  caduca_el: string;
  fotos: number;
  videos: number;
  ids: string[];
};

const MESES = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });

async function avisarDeLoQueCaduca(errores: string[]): Promise<number> {
  const grupos = filas<GrupoQueCaduca>(
    await dbAdmin.execute(sql`
      select a.iglesia_id::text, a.ministerio_id::text, m.nombre as ministerio, m.modulos,
             to_char(a.fecha, 'YYYY-MM') as mes, a.caduca_el::text,
             (count(*) filter (where a.tipo = 'foto'))::int as fotos,
             (count(*) filter (where a.tipo = 'video'))::int as videos,
             array_agg(a.id::text) as ids
        from ninos_archivos a
        join iglesias i on i.id = a.iglesia_id
        join ministerios m on m.id = a.ministerio_id
       where a.confirmado_at is not null
         and a.avisado_at is null
         and a.caduca_el > (now() at time zone i.timezone)::date
         and a.caduca_el <= (now() at time zone i.timezone)::date + 30
       group by a.iglesia_id, a.ministerio_id, m.nombre, m.modulos, to_char(a.fecha, 'YYYY-MM'), a.caduca_el
    `),
  );

  let enviados = 0;
  for (const g of grupos) {
    if (!tieneModulo(g.modulos, 'ninos')) continue;

    try {
      // La responsable, con cuenta activa. Si no la hay, los pastores: alguien
      // tiene que enterarse antes de que se borre.
      let destinatarios = filas<{ auth_user_id: string }>(
        await dbAdmin.execute(sql`
          select iu.auth_user_id::text
            from ministerio_miembros mm
            join iglesia_usuarios iu on iu.iglesia_id = mm.iglesia_id and iu.miembro_id = mm.miembro_id
           where mm.ministerio_id = ${g.ministerio_id}::uuid
             and mm.activo and mm.rol_equipo = 'responsable' and iu.estado = 'activo'
        `),
      );
      if (destinatarios.length === 0) {
        destinatarios = filas<{ auth_user_id: string }>(
          await dbAdmin.execute(sql`
            select auth_user_id::text from iglesia_usuarios
             where iglesia_id = ${g.iglesia_id}::uuid and rol = 'pastor' and estado = 'activo'
          `),
        );
      }

      const cuantos = [
        g.fotos > 0 ? `${g.fotos} ${g.fotos === 1 ? 'foto' : 'fotos'}` : null,
        g.videos > 0 ? `${g.videos} ${g.videos === 1 ? 'vídeo' : 'vídeos'}` : null,
      ]
        .filter(Boolean)
        .join(' y ');

      for (const d of destinatarios) {
        await emitirNotificacion({
          iglesiaId: g.iglesia_id,
          destinatarioAuthUserId: d.auth_user_id,
          tipo: 'ninos_caducan',
          datos: {
            fecha: fechaDeBorrado(g.caduca_el),
            mes: MESES.format(new Date(`${g.mes}-01T00:00:00Z`)),
            cuantos,
            ministerio: g.ministerio,
          },
          enlace: `/panel/ministerios/${g.ministerio_id}/ninos/drive`,
        });
      }

      await dbAdmin
        .update(ninosArchivos)
        .set({ avisadoAt: new Date() })
        .where(inArray(ninosArchivos.id, g.ids));
      enviados += destinatarios.length;
    } catch (err) {
      errores.push(`aviso ${g.ministerio_id} ${g.mes}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return enviados;
}
