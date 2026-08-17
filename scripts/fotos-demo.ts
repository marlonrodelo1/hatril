/**
 * Sube las fotos de prueba de la iglesia de demostración: las tres del carrusel
 * y las que les falten a sus ministerios.
 *
 * Es para tener algo real que mirar al revisar la web pública: con cuadrados de
 * color no se ve si el velo deja legible el texto encima, que es justo lo que
 * hay que juzgar.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/fotos-demo.ts
 *
 * NO ES SEED. No toca el schema y se puede ejecutar las veces que haga falta:
 * cada pasada reemplaza las tres fotos del carrusel por otras tres.
 *
 * A LOS MINISTERIOS SOLO SE LES RELLENA EL HUECO
 * ----------------------------------------------
 * Los que ya tienen foto no se tocan. Alabanza y Niños la tienen subida a mano
 * desde el panel, que es el camino real, y una pasada de este script no puede
 * pisar una foto de verdad con una de relleno.
 *
 * Las imágenes vienen de picsum.photos, que sirve fotos reales con una URL
 * estable. No se meten en el repo: pesan y se regeneran en un comando.
 */

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'iglesias-publico';
const IGLESIA = 'aaaaaaaa-1111-4111-8111-000000000001'; // Betania, del seed

const connectionString = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString || !supabaseUrl || !serviceKey) {
  console.error(
    'Faltan DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, ssl: 'require', max: 1 });
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Descarga de picsum y sube al bucket. Devuelve la URL pública. */
async function subir(semilla: string, ancho: number, alto: number, ruta: string) {
  const origen = `https://picsum.photos/seed/${semilla}/${ancho}/${alto}`;
  const respuesta = await fetch(origen);

  if (!respuesta.ok) {
    console.error(`No se pudo descargar ${origen}: ${respuesta.status}`);
    process.exit(1);
  }

  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error(`No se pudo subir ${ruta}:`, error.message);
    process.exit(1);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  // Sufijo para que el navegador no siga enseñando la anterior si se repite.
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function main() {
  // `--ministerios` salta el carrusel. Cada pasada completa le cambia las tres
  // fotos a la portada, y cuando lo único que falta es rellenar un ministerio
  // nuevo eso es tocar lo que ya estaba bien.
  const soloMinisterios = process.argv.includes('--ministerios');
  const urls: string[] = [];

  if (!soloMinisterios) {
    for (let i = 1; i <= 3; i++) {
      urls.push(
        await subir(`hatril-${i}`, 1600, 900, `${IGLESIA}/foto-demo-${i}.jpg`),
      );
      console.log(`  subida foto ${i}`);
    }

    await sql`
      update public.iglesias
         set imagenes = ${JSON.stringify(urls)}::jsonb,
             banner_url = ${urls[0]!}
       where id = ${IGLESIA}
    `;
  }

  // Los ministerios sin foto salen en la web como un rectángulo de color plano.
  // Se ve bien —está pensado para eso— pero al lado de dos con fotografía
  // parecen los que se quedaron a medias.
  const sinFoto = await sql<{ id: string; nombre: string }[]>`
    select id, nombre
      from public.ministerios
     where iglesia_id = ${IGLESIA}
       and foto_url is null
       and activo
     order by orden
  `;

  for (const m of sinFoto) {
    // Vertical: en escritorio la tarjeta del grupo es más alta que ancha y una
    // foto apaisada se recorta por arriba y por abajo justo donde está el motivo.
    const url = await subir(
      `hatril-min-${m.id.slice(-4)}`,
      1200,
      1500,
      `${IGLESIA}/ministerio-${m.id}.jpg`,
    );
    await sql`update public.ministerios set foto_url = ${url} where id = ${m.id}`;
    console.log(`  foto para ${m.nombre}`);
  }

  console.log(
    `\nListo. ${urls.length} fotos en el carrusel y ${sinFoto.length} en ministerios.`,
  );
  await sql.end();
}

main();
