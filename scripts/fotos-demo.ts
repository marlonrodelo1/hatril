/**
 * Sube tres fotos de prueba a la iglesia de demostración.
 *
 * Es para tener algo real en el carrusel al revisar la web pública: con
 * cuadrados de color no se ve si el velo deja legible el texto encima, que es
 * justo lo que hay que juzgar.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/fotos-demo.ts
 *
 * NO ES SEED. No toca el schema y se puede ejecutar las veces que haga falta:
 * cada pasada reemplaza las fotos de Betania por otras tres.
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

async function main() {
  const urls: string[] = [];

  for (let i = 1; i <= 3; i++) {
    // `?random=` obliga a picsum a devolver una distinta en cada posición.
    const origen = `https://picsum.photos/seed/hatril-${i}/1600/900`;
    const respuesta = await fetch(origen);

    if (!respuesta.ok) {
      console.error(`No se pudo descargar ${origen}: ${respuesta.status}`);
      process.exit(1);
    }

    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    const ruta = `${IGLESIA}/foto-demo-${i}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, bytes, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      console.error(`No se pudo subir ${ruta}:`, error.message);
      process.exit(1);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
    // Sufijo para que el navegador no siga enseñando la anterior si se repite.
    urls.push(`${data.publicUrl}?v=${Date.now()}`);
    console.log(`  subida foto ${i}`);
  }

  await sql`
    update public.iglesias
       set imagenes = ${JSON.stringify(urls)}::jsonb,
           banner_url = ${urls[0]!}
     where id = ${IGLESIA}
  `;

  console.log(`\nListo. ${urls.length} fotos en la web pública de Betania.`);
  await sql.end();
}

main();
