// Cose los snapshots de main (0052 en adelante) detrás de los de células.
//
//   node scripts/migraciones/coser-snapshots-celulas.mjs
//
// Se pasó el 23-nov al fusionar células. Hay que volver a pasarlo cuando entre
// en main una migración cuyo snapshot se generó SIN células (la de una rama
// que salió de main antes de esa fusión): después, `npx drizzle-kit check` y un
// `npm run db:generate` que diga «sin cambios».
//
// La 0052 y las siguientes se generaron sin las tablas de células, porque
// células no estaba en main. drizzle-kit compara el esquema contra el ÚLTIMO
// snapshot por nombre de fichero, así que sin ellas en el último, el siguiente
// `generate` volvería a crear `grupos`. Se copian SOLO las cinco tablas y los
// dos enums que añade células (del 0051), y el 0052 pasa a colgar del 0051.
// Idempotente: se puede volver a pasar después de cada fusión de main.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'drizzle', 'meta');
const s51 = JSON.parse(fs.readFileSync(path.join(dir, '0051_snapshot.json'), 'utf8'));
const s45 = JSON.parse(fs.readFileSync(path.join(dir, '0045_snapshot.json'), 'utf8'));
const tablas = Object.keys(s51.tables).filter((k) => !(k in s45.tables));
const enums = Object.keys(s51.enums).filter((k) => !(k in s45.enums));
if (tablas.length !== 5 || enums.length !== 2) throw new Error(`esperaba 5 tablas y 2 enums: ${tablas} ${enums}`);

const posteriores = fs
  .readdirSync(dir)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f) && Number(f.slice(0, 4)) >= 52)
  .sort();

for (const f of posteriores) {
  const p = path.join(dir, f);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  let cambios = 0;
  if (f === '0052_snapshot.json' && s.prevId !== s51.id) {
    s.prevId = s51.id;
    cambios++;
  }
  for (const t of tablas) if (!(t in s.tables)) { s.tables[t] = s51.tables[t]; cambios++; }
  for (const e of enums) if (!(e in s.enums)) { s.enums[e] = s51.enums[e]; cambios++; }
  if (cambios) fs.writeFileSync(p, JSON.stringify(s, null, 2));
  console.log(`${f}: ${cambios ? cambios + ' cambios' : 'ya estaba'}`);
}
