/**
 * Los 66 libros de la Biblia protestante, con sus capítulos.
 *
 * ESTO NO ES TEXTO BÍBLICO Y POR ESO PUEDE ESTAR AQUÍ
 * ---------------------------------------------------
 * Son nombres de libros y cuántos capítulos tiene cada uno: un dato factual que
 * no pertenece a ninguna traducción. El TEXTO sí tiene dueño —la Reina-Valera
 * 1960 es de Sociedades Bíblicas Unidas— y vive aparte, en `texto.ts`, con la
 * versión de 1909 que es de dominio público.
 *
 * La separación no es de orden: permite tener el índice, la navegación y el
 * buscador funcionando antes de que llegue el fichero del texto, y permite
 * cambiar de traducción sin tocar nada de esto.
 *
 * EL ORDEN ES EL CANÓNICO, NO EL ALFABÉTICO
 * -----------------------------------------
 * Una congregación busca Salmos donde está Salmos, entre Job y Proverbios. Una
 * lista alfabética obliga a leer para encontrar, y encima pone Apocalipsis el
 * primero.
 */

export type Libro = {
  /** Para la URL: sin acentos, en minúsculas y con guiones. */
  slug: string;
  nombre: string;
  capitulos: number;
  testamento: 'antiguo' | 'nuevo';
  /** Como se abrevia en una cita: «Gn 1:1». */
  abreviatura: string;
};

export const LIBROS: readonly Libro[] = [
  // --- Antiguo Testamento ---
  { slug: 'genesis', nombre: 'Génesis', capitulos: 50, testamento: 'antiguo', abreviatura: 'Gn' },
  { slug: 'exodo', nombre: 'Éxodo', capitulos: 40, testamento: 'antiguo', abreviatura: 'Ex' },
  { slug: 'levitico', nombre: 'Levítico', capitulos: 27, testamento: 'antiguo', abreviatura: 'Lv' },
  { slug: 'numeros', nombre: 'Números', capitulos: 36, testamento: 'antiguo', abreviatura: 'Nm' },
  { slug: 'deuteronomio', nombre: 'Deuteronomio', capitulos: 34, testamento: 'antiguo', abreviatura: 'Dt' },
  { slug: 'josue', nombre: 'Josué', capitulos: 24, testamento: 'antiguo', abreviatura: 'Jos' },
  { slug: 'jueces', nombre: 'Jueces', capitulos: 21, testamento: 'antiguo', abreviatura: 'Jue' },
  { slug: 'rut', nombre: 'Rut', capitulos: 4, testamento: 'antiguo', abreviatura: 'Rt' },
  { slug: '1-samuel', nombre: '1 Samuel', capitulos: 31, testamento: 'antiguo', abreviatura: '1 S' },
  { slug: '2-samuel', nombre: '2 Samuel', capitulos: 24, testamento: 'antiguo', abreviatura: '2 S' },
  { slug: '1-reyes', nombre: '1 Reyes', capitulos: 22, testamento: 'antiguo', abreviatura: '1 R' },
  { slug: '2-reyes', nombre: '2 Reyes', capitulos: 25, testamento: 'antiguo', abreviatura: '2 R' },
  { slug: '1-cronicas', nombre: '1 Crónicas', capitulos: 29, testamento: 'antiguo', abreviatura: '1 Cr' },
  { slug: '2-cronicas', nombre: '2 Crónicas', capitulos: 36, testamento: 'antiguo', abreviatura: '2 Cr' },
  { slug: 'esdras', nombre: 'Esdras', capitulos: 10, testamento: 'antiguo', abreviatura: 'Esd' },
  { slug: 'nehemias', nombre: 'Nehemías', capitulos: 13, testamento: 'antiguo', abreviatura: 'Neh' },
  { slug: 'ester', nombre: 'Ester', capitulos: 10, testamento: 'antiguo', abreviatura: 'Est' },
  { slug: 'job', nombre: 'Job', capitulos: 42, testamento: 'antiguo', abreviatura: 'Job' },
  { slug: 'salmos', nombre: 'Salmos', capitulos: 150, testamento: 'antiguo', abreviatura: 'Sal' },
  { slug: 'proverbios', nombre: 'Proverbios', capitulos: 31, testamento: 'antiguo', abreviatura: 'Pr' },
  { slug: 'eclesiastes', nombre: 'Eclesiastés', capitulos: 12, testamento: 'antiguo', abreviatura: 'Ec' },
  { slug: 'cantares', nombre: 'Cantares', capitulos: 8, testamento: 'antiguo', abreviatura: 'Cnt' },
  { slug: 'isaias', nombre: 'Isaías', capitulos: 66, testamento: 'antiguo', abreviatura: 'Is' },
  { slug: 'jeremias', nombre: 'Jeremías', capitulos: 52, testamento: 'antiguo', abreviatura: 'Jer' },
  { slug: 'lamentaciones', nombre: 'Lamentaciones', capitulos: 5, testamento: 'antiguo', abreviatura: 'Lm' },
  { slug: 'ezequiel', nombre: 'Ezequiel', capitulos: 48, testamento: 'antiguo', abreviatura: 'Ez' },
  { slug: 'daniel', nombre: 'Daniel', capitulos: 12, testamento: 'antiguo', abreviatura: 'Dn' },
  { slug: 'oseas', nombre: 'Oseas', capitulos: 14, testamento: 'antiguo', abreviatura: 'Os' },
  { slug: 'joel', nombre: 'Joel', capitulos: 3, testamento: 'antiguo', abreviatura: 'Jl' },
  { slug: 'amos', nombre: 'Amós', capitulos: 9, testamento: 'antiguo', abreviatura: 'Am' },
  { slug: 'abdias', nombre: 'Abdías', capitulos: 1, testamento: 'antiguo', abreviatura: 'Abd' },
  { slug: 'jonas', nombre: 'Jonás', capitulos: 4, testamento: 'antiguo', abreviatura: 'Jon' },
  { slug: 'miqueas', nombre: 'Miqueas', capitulos: 7, testamento: 'antiguo', abreviatura: 'Mi' },
  { slug: 'nahum', nombre: 'Nahúm', capitulos: 3, testamento: 'antiguo', abreviatura: 'Nah' },
  { slug: 'habacuc', nombre: 'Habacuc', capitulos: 3, testamento: 'antiguo', abreviatura: 'Hab' },
  { slug: 'sofonias', nombre: 'Sofonías', capitulos: 3, testamento: 'antiguo', abreviatura: 'Sof' },
  { slug: 'hageo', nombre: 'Hageo', capitulos: 2, testamento: 'antiguo', abreviatura: 'Hag' },
  { slug: 'zacarias', nombre: 'Zacarías', capitulos: 14, testamento: 'antiguo', abreviatura: 'Zac' },
  { slug: 'malaquias', nombre: 'Malaquías', capitulos: 4, testamento: 'antiguo', abreviatura: 'Mal' },

  // --- Nuevo Testamento ---
  { slug: 'mateo', nombre: 'Mateo', capitulos: 28, testamento: 'nuevo', abreviatura: 'Mt' },
  { slug: 'marcos', nombre: 'Marcos', capitulos: 16, testamento: 'nuevo', abreviatura: 'Mr' },
  { slug: 'lucas', nombre: 'Lucas', capitulos: 24, testamento: 'nuevo', abreviatura: 'Lc' },
  { slug: 'juan', nombre: 'Juan', capitulos: 21, testamento: 'nuevo', abreviatura: 'Jn' },
  { slug: 'hechos', nombre: 'Hechos', capitulos: 28, testamento: 'nuevo', abreviatura: 'Hch' },
  { slug: 'romanos', nombre: 'Romanos', capitulos: 16, testamento: 'nuevo', abreviatura: 'Ro' },
  { slug: '1-corintios', nombre: '1 Corintios', capitulos: 16, testamento: 'nuevo', abreviatura: '1 Co' },
  { slug: '2-corintios', nombre: '2 Corintios', capitulos: 13, testamento: 'nuevo', abreviatura: '2 Co' },
  { slug: 'galatas', nombre: 'Gálatas', capitulos: 6, testamento: 'nuevo', abreviatura: 'Gá' },
  { slug: 'efesios', nombre: 'Efesios', capitulos: 6, testamento: 'nuevo', abreviatura: 'Ef' },
  { slug: 'filipenses', nombre: 'Filipenses', capitulos: 4, testamento: 'nuevo', abreviatura: 'Fil' },
  { slug: 'colosenses', nombre: 'Colosenses', capitulos: 4, testamento: 'nuevo', abreviatura: 'Col' },
  { slug: '1-tesalonicenses', nombre: '1 Tesalonicenses', capitulos: 5, testamento: 'nuevo', abreviatura: '1 Ts' },
  { slug: '2-tesalonicenses', nombre: '2 Tesalonicenses', capitulos: 3, testamento: 'nuevo', abreviatura: '2 Ts' },
  { slug: '1-timoteo', nombre: '1 Timoteo', capitulos: 6, testamento: 'nuevo', abreviatura: '1 Ti' },
  { slug: '2-timoteo', nombre: '2 Timoteo', capitulos: 4, testamento: 'nuevo', abreviatura: '2 Ti' },
  { slug: 'tito', nombre: 'Tito', capitulos: 3, testamento: 'nuevo', abreviatura: 'Tit' },
  { slug: 'filemon', nombre: 'Filemón', capitulos: 1, testamento: 'nuevo', abreviatura: 'Flm' },
  { slug: 'hebreos', nombre: 'Hebreos', capitulos: 13, testamento: 'nuevo', abreviatura: 'He' },
  { slug: 'santiago', nombre: 'Santiago', capitulos: 5, testamento: 'nuevo', abreviatura: 'Stg' },
  { slug: '1-pedro', nombre: '1 Pedro', capitulos: 5, testamento: 'nuevo', abreviatura: '1 P' },
  { slug: '2-pedro', nombre: '2 Pedro', capitulos: 3, testamento: 'nuevo', abreviatura: '2 P' },
  { slug: '1-juan', nombre: '1 Juan', capitulos: 5, testamento: 'nuevo', abreviatura: '1 Jn' },
  { slug: '2-juan', nombre: '2 Juan', capitulos: 1, testamento: 'nuevo', abreviatura: '2 Jn' },
  { slug: '3-juan', nombre: '3 Juan', capitulos: 1, testamento: 'nuevo', abreviatura: '3 Jn' },
  { slug: 'judas', nombre: 'Judas', capitulos: 1, testamento: 'nuevo', abreviatura: 'Jud' },
  { slug: 'apocalipsis', nombre: 'Apocalipsis', capitulos: 22, testamento: 'nuevo', abreviatura: 'Ap' },
];

const POR_SLUG = new Map(LIBROS.map((l) => [l.slug, l]));

export function libroPorSlug(slug: string | undefined): Libro | null {
  return (slug && POR_SLUG.get(slug)) || null;
}

/**
 * Busca libros por nombre, tolerando cómo escribe la gente de verdad.
 *
 * Sin acentos y sin distinguir mayúsculas, porque nadie teclea «Génesis» con
 * tilde en un móvil. Y por abreviatura, porque quien busca «1co» sabe lo que
 * quiere y no le apetece leer una lista de sesenta y seis.
 */
export function buscarLibros(consulta: string): Libro[] {
  const q = normalizar(consulta);
  if (!q) return [];

  return LIBROS.filter(
    (l) =>
      normalizar(l.nombre).includes(q) ||
      normalizar(l.abreviatura).startsWith(q) ||
      l.slug.includes(q),
  );
}

function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}
