import 'server-only';

import type { Libro } from './libros';

/**
 * El texto bíblico. Reina-Valera 1909, de dominio público.
 *
 * POR QUÉ LA 1909 Y NO LA 1960
 * ----------------------------
 * La Reina-Valera 1960 es la que espera cualquier congregación hispanohablante,
 * y tiene dueño: Sociedades Bíblicas Unidas. Meterla sin licencia en un producto
 * que se cobra no es una zona gris, y el riesgo no lo corre Hatril solo — lo
 * corren las iglesias que lo usen.
 *
 * La de 1909 es de dominio público, así que se puede servir, imprimir y copiar
 * sin pedir permiso a nadie. Suena antigua («empero», «vosotros»), y ese es el
 * precio conocido de la decisión. Si algún día se licencia la 1960, este módulo
 * es lo único que cambia: la pantalla, el índice y el buscador no saben qué
 * traducción están pintando.
 *
 * EL TEXTO TODAVÍA NO ESTÁ, Y ESTA FUNCIÓN LO DICE
 * ------------------------------------------------
 * Faltan unos 4,5 MB de texto que hay que traer al repo. No se ha inventado un
 * ejemplo ni se han dejado tres versículos de muestra: media Biblia rellena de
 * pruebas es peor que ninguna, porque nadie sabe qué falta hasta que un miembro
 * abre Habacuc un domingo.
 *
 * Mientras `cargarCapitulo` devuelva null, la pantalla lo dice con todas las
 * letras. Cuando llegue el fichero, esto es lo único que hay que escribir.
 *
 * QUÉ FORMATO HACE FALTA
 * ----------------------
 * Un JSON por libro, en `public/biblia/rv1909/<slug>.json`, con esta forma:
 *
 *   { "1": ["En el principio crió Dios…", "Y la tierra estaba…"], "2": [...] }
 *
 * Clave el número de capítulo, valor el array de versículos en orden. Sin
 * numerar dentro del texto: el número lo pinta la pantalla, y guardarlo dentro
 * obliga a limpiarlo para buscar.
 *
 * Por libro y no en un fichero único de 4,5 MB porque así se lee solo el que se
 * está mirando. Génesis pesa unos 200 KB; la Biblia entera, veinte veces más, y
 * cargarla para enseñar un salmo es tiempo y memoria por nada.
 *
 * EN `public/` Y LEÍDO CON `fs`, NO IMPORTADO
 * -------------------------------------------
 * El primer intento era `await import('./rv1909/' + slug + '.json')`. Compila,
 * pero deja un aviso de módulo no encontrado en cada build mientras la carpeta
 * esté vacía —y el ruido en un build es lo que hace que un día no se vea el
 * aviso que sí importaba—. Además obliga a recompilar para añadir un libro.
 *
 * Con `fs` sobre `public/` no hay resolución de módulos: el fichero se lee
 * cuando alguien abre el capítulo, y se pueden ir añadiendo libros sin tocar el
 * código. `public/` viaja al contenedor en el build de Docker, así que también
 * está en producción.
 *
 * Que sea públicamente descargable no es un problema: es texto de dominio
 * público. El día que se licencie una traducción con derechos, esto tiene que
 * mudarse fuera de `public/` — y ese es justo el aviso que hay que recordar.
 */

export type Capitulo = {
  libro: Libro;
  numero: number;
  versiculos: string[];
};

export async function cargarCapitulo(
  libro: Libro,
  numero: number,
): Promise<Capitulo | null> {
  if (numero < 1 || numero > libro.capitulos) return null;

  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    /*
     * El slug sale de `LIBROS`, no de la URL: `libroPorSlug()` ya ha rechazado
     * cualquier cosa que no esté en la lista antes de llegar aquí. Aun así se
     * compone con `join` y sin nada del exterior, porque una ruta de fichero
     * armada con texto de fuera es como se leen ficheros que no tocan.
     */
    const ruta = join(process.cwd(), 'public', 'biblia', 'rv1909', `${libro.slug}.json`);
    const crudo = await readFile(ruta, 'utf8');
    const datos = JSON.parse(crudo) as Record<string, string[]>;
    const versiculos = datos[String(numero)];

    if (!versiculos?.length) return null;
    return { libro, numero, versiculos };
  } catch {
    // Todavía no hay fichero para ese libro. No es un error que haya que
    // registrar: es el estado normal hasta que se cargue el texto.
    return null;
  }
}

/** ¿Hay texto cargado? Lo pregunta la pantalla para saber qué contar. */
export async function hayTexto(libro: Libro): Promise<boolean> {
  return (await cargarCapitulo(libro, 1)) !== null;
}
