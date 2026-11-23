/**
 * El borrado al año del ministerio de Niños (`lib/ninos/caducidad.ts`), de
 * verdad: con filas en la base y ficheros en Storage.
 *
 *   npm run test:ninos
 *
 * Monta una iglesia de usar y tirar (`scripts/pruebas/demo.mjs`), le añade
 * archivos con fechas de hace más de un año, de hace casi un año y de hoy, sube
 * sus ficheros a los buckets, ejecuta la limpieza dos veces y mira qué queda.
 * Al terminar borra la iglesia y los ficheros, también si falla.
 *
 * CUIDADO: LA LIMPIEZA RECORRE TODAS LAS IGLESIAS
 * -----------------------------------------------
 * Es el cron entero, no una versión de prueba: borra lo caducado de cualquier
 * iglesia y barre los huérfanos de los dos buckets. Por eso, antes de nada,
 * comprueba que no hay ni una fila ni un fichero de Niños de una iglesia que no
 * sea de prueba, y si los hay se niega a correr. El día que haya datos de
 * verdad, esta prueba tendrá que ejecutarse contra una rama de Supabase.
 *
 * Con `--tsconfig scripts/pruebas/tsconfig.json` (el script de package.json lo
 * pone): los módulos que prueba llevan `import 'server-only'`, que no es un
 * paquete del repo sino algo que resuelve Next al empaquetar. Ese tsconfig lo
 * apunta a un módulo vacío.
 */

import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';

import { dbAdmin } from '../src/lib/db/client';
import { limpiarNinos } from '../src/lib/ninos/caducidad';
import { conDemo, PREFIJO_SLUG } from './pruebas/demo.mjs';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Fila = Record<string, string | number | null>;
const filas = (res: unknown): Fila[] => (res as { rows?: Fila[] }).rows ?? (res as Fila[]);

const lineas: string[] = [];
const ok = (cond: boolean, texto: string) => lineas.push(`  ${cond ? 'OK  ' : 'FALLO'} ${texto}`);

/** AAAA-MM-DD de hoy más `n` días (o meses, con `meses`). */
function fecha(dias: number, meses = 0): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + meses);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function ajenos(): Promise<number> {
  const [f] = filas(
    await dbAdmin.execute(sql`
      select
        (select count(*) from ninos_archivos a join iglesias i on i.id = a.iglesia_id
          where i.slug not like ${PREFIJO_SLUG + '%'})
      + (select count(*) from ninos_publicaciones p join iglesias i on i.id = p.iglesia_id
          where i.slug not like ${PREFIJO_SLUG + '%'})
      + (select count(*) from storage.objects o
          where o.bucket_id in ('ninos-fotos', 'ninos-videos')
            and not exists (select 1 from iglesias i
                             where i.slug like ${PREFIJO_SLUG + '%'}
                               and o.name like i.id::text || '/%')) as n
    `),
  );
  return Number(f?.n ?? -1);
}

async function main() {
  const fuera = await ajenos();
  if (fuera !== 0) {
    console.error(
      `Hay ${fuera} filas o ficheros de Niños de iglesias que no son de prueba. ` +
        'La limpieza los tocaría: esta prueba no corre contra datos de verdad.',
    );
    process.exitCode = 2;
    return;
  }

  const subidos: { bucket: string; ruta: string }[] = [];

  await conDemo({ cuentas: false, publicada: false }, async (demo) => {
    const B = demo.betel.id;
    const N = demo.ids.ninos;
    const subir = async (bucket: string, ruta: string, tipo: string) => {
      const { error } = await admin.storage
        .from(bucket)
        .upload(ruta, new Blob([new Uint8Array([1, 2, 3, 4])], { type: tipo }), { contentType: tipo });
      if (error) throw new Error(`subir ${ruta}: ${error.message}`);
      subidos.push({ bucket, ruta });
    };
    const archivo = async (nombre: string, f: string, datos: Record<string, unknown> = {}) => {
      const tipo = (datos.tipo as string) ?? 'foto';
      const ruta = `${B}/${N}/${f}/${nombre}.${tipo === 'foto' ? 'webp' : 'mp4'}`;
      const miniatura = tipo === 'foto' ? `${B}/${N}/${f}/${nombre}.min.webp` : null;
      const [fila] = filas(
        await dbAdmin.execute(sql`
          insert into ninos_archivos
            (iglesia_id, ministerio_id, tipo, ruta, miniatura_ruta, bytes, fecha, confirmado_at, created_at)
          values (${B}, ${N}, ${tipo}::tipo_archivo_nino_enum, ${ruta}, ${miniatura}, 4, ${f}::date,
                  ${datos.sinConfirmar ? null : sql`now()`}, now() - ${datos.hace ?? '0 hours'}::interval)
          returning id::text, caduca_el::text
        `),
      );
      await subir(tipo === 'foto' ? 'ninos-fotos' : 'ninos-videos', ruta, tipo === 'foto' ? 'image/webp' : 'video/mp4');
      if (miniatura) await subir('ninos-fotos', miniatura, 'image/webp');
      return { id: String(fila!.id), ruta, miniatura, caduca: String(fila!.caduca_el) };
    };

    const viejo = await archivo('viejo', fecha(0, -14));
    const viejoVideo = await archivo('viejo-video', fecha(0, -14), { tipo: 'video' });
    // El mismo mes del año pasado: se borra el día 1 del mes que viene, dentro
    // de los 30 días del aviso.
    const porCaducar = await archivo('por-caducar', `${fecha(0, -12).slice(0, 7)}-01`);
    const reciente = await archivo('reciente', fecha(0));
    const aMedias = await archivo('a-medias', fecha(0), { sinConfirmar: true, hace: '2 days' });

    const huerfano = `${B}/${N}/${fecha(0, -3)}/huerfano.webp`;
    await subir('ninos-fotos', huerfano, 'image/webp');
    // Storage no deja poner la fecha al subir: se envejece a mano para que el
    // barrido de más de 24 horas lo alcance.
    await dbAdmin.execute(sql`
      update storage.objects set created_at = now() - interval '2 days'
       where bucket_id = 'ninos-fotos' and name = ${huerfano}
    `);

    const [pubVieja] = filas(
      await dbAdmin.execute(sql`
        insert into ninos_publicaciones (iglesia_id, ministerio_id, fecha, texto, publicada_at)
        values (${B}, ${N}, ${fecha(0, -14)}::date, 'Una de hace más de un año', now())
        returning id::text
      `),
    );

    const resultado = await limpiarNinos();
    lineas.push(`  ·    limpieza: ${JSON.stringify(resultado)}`);

    const existe = async (id: string) =>
      filas(await dbAdmin.execute(sql`select 1 from ninos_archivos where id = ${id}::uuid`)).length > 0;
    const enStorage = async (bucket: string, ruta: string | null) =>
      !!ruta &&
      filas(
        await dbAdmin.execute(
          sql`select 1 from storage.objects where bucket_id = ${bucket} and name = ${ruta}`,
        ),
      ).length > 0;

    ok(!(await existe(viejo.id)), 'la foto de hace más de un año sale de la base');
    ok(
      !(await enStorage('ninos-fotos', viejo.ruta)) && !(await enStorage('ninos-fotos', viejo.miniatura)),
      'y su fichero y su miniatura salen de Storage',
    );
    ok(
      !(await existe(viejoVideo.id)) && !(await enStorage('ninos-videos', viejoVideo.ruta)),
      'el vídeo de hace más de un año sale de la base y de Storage',
    );
    ok(
      (await existe(porCaducar.id)) && (await enStorage('ninos-fotos', porCaducar.ruta)),
      `lo que se borra el ${porCaducar.caduca} se queda hasta entonces`,
    );
    ok(
      (await existe(reciente.id)) && (await enStorage('ninos-fotos', reciente.ruta)),
      'la foto de hoy se queda, con su fichero',
    );
    ok(!(await existe(aMedias.id)), 'la subida sin confirmar de hace dos días se borra');
    ok(!(await enStorage('ninos-fotos', huerfano)), 'el fichero huérfano de hace dos días se barre');
    ok(
      filas(await dbAdmin.execute(sql`select 1 from ninos_publicaciones where id = ${pubVieja!.id}::uuid`)).length === 0,
      'la publicación de hace más de un año se borra',
    );
    const [quedan] = filas(
      await dbAdmin.execute(sql`
        select count(*)::int as n from ninos_publicaciones where id in (${demo.ids.pubVieja}::uuid, ${demo.ids.pubNueva}::uuid)
      `),
    );
    ok(Number(quedan?.n) === 2, `las publicaciones de este año se quedan (${quedan?.n} de 2)`);

    const [avisado] = filas(
      await dbAdmin.execute(sql`select avisado_at is not null as si from ninos_archivos where id = ${porCaducar.id}::uuid`),
    );
    const avisos = filas(
      await dbAdmin.execute(sql`
        select destinatario_auth_user_id::text as a, datos::text as d from notificaciones
         where iglesia_id = ${B}::uuid and tipo = 'ninos_caducan'
      `),
    );
    ok(
      String(avisado?.si) === 'true' && avisos.length === 1 && avisos[0]!.a === demo.usuarios.maestra,
      `avisa una vez, a la responsable, de lo que se borra en menos de 30 días (${avisos.length} avisos)`,
    );
    const otraVez = await limpiarNinos();
    const avisosDespues = filas(
      await dbAdmin.execute(sql`select 1 from notificaciones where iglesia_id = ${B}::uuid and tipo = 'ninos_caducan'`),
    );
    ok(avisosDespues.length === 1, `pasada otra vez, no repite el aviso (${otraVez.avisos} nuevos)`);
    ok(resultado.errores.length === 0 && otraVez.errores.length === 0, 'la limpieza no da errores');
  }).finally(async () => {
    // Lo que quede subido (lo que no caducaba) se va con la prueba.
    for (const bucket of ['ninos-fotos', 'ninos-videos']) {
      const rutas = subidos.filter((s) => s.bucket === bucket).map((s) => s.ruta);
      if (rutas.length) await admin.storage.from(bucket).remove(rutas);
    }
  });

  console.log('\nEl borrado al año de Niños\n');
  console.log(lineas.join('\n'));
  if (lineas.some((l) => l.includes('FALLO'))) {
    console.error('\nHay fallos.\n');
    process.exitCode = 1;
  } else {
    console.log('\nTodo correcto.\n');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
