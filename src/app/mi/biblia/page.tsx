import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { libroPorSlug } from '@/lib/biblia/libros';
import { cargarCapitulo } from '@/lib/biblia/texto';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { TamanoLetra } from '../_components/tamano-letra';
import { VistaBiblia } from './_components/vista-biblia';

export const metadata: Metadata = { title: 'Biblia' };

/**
 * La Biblia, dentro de la aplicación.
 *
 * TODO EN UNA RUTA, CON PARÁMETROS
 * --------------------------------
 * `?libro=salmos&cap=46` en vez de `/mi/biblia/salmos/46`. Dos motivos:
 *
 *   - El índice, el buscador y el capítulo son la misma pantalla en tres
 *     estados, no tres pantallas. Con rutas anidadas habría tres archivos
 *     repitiendo la cabecera y el guard.
 *   - **Funciona sin JavaScript.** El buscador es un `<form method="get">` y
 *     cada libro es un enlace: en un móvil viejo con mala cobertura la Biblia
 *     sigue abriéndose, que es exactamente el aparato desde el que se va a leer
 *     un domingo por la mañana.
 *
 * EL CAPÍTULO, PARA LEER (zona 2 del rediseño, 17-nov)
 * ----------------------------------------------------
 * Dentro de un capítulo la cabecera dice solo «Biblia», y el nombre del
 * capítulo va debajo, grande, con su chevron y la versión: es el botón que
 * abre la rejilla para saltar a otro (`SelectorCapitulo`). Con «Salmos» arriba
 * y «Salmos 23» debajo se leía dos veces lo mismo. A− y A+ van en la cabecera,
 * que no se va al bajar, igual que en el devocional.
 *
 * SIN TEXTO TODAVÍA, Y SE DICE
 * ----------------------------
 * `cargarCapitulo` devuelve null mientras no esté el fichero de la Reina-Valera
 * 1909. La pantalla lo cuenta con todas las letras en vez de enseñar un capítulo
 * vacío: un hueco donde debería ir el Salmo 23 parece una aplicación rota, y una
 * Biblia a medias es peor que una Biblia que todavía no está.
 */
export default async function BibliaPage({
  searchParams,
}: {
  searchParams: Promise<{ libro?: string; cap?: string; q?: string }>;
}) {
  const ctx = await requireIglesia();
  // Como las otras tres pestañas: la cabecera pinta los avisos y la foto de la
  // ficha, y `/mi/layout.tsx` no guarda nada.
  await exigirConsentimientoAlDia(ctx);
  const { libro: slug, cap, q } = await searchParams;

  const libro = libroPorSlug(slug);
  const numero = Number(cap);
  const capitulo =
    libro && Number.isInteger(numero)
      ? await cargarCapitulo(libro, numero)
      : null;

  // El capítulo de antes y el de después, cruzando de libro en los bordes.
  return (
    <VistaBiblia
      cabecera={
        <CabeceraMiembro
          // Con flecha, sin logo, como el resto de pantallas de detalle de `/mi`
          // (`equipo/_components/marco.tsx`). En el capítulo, con A−/A+ al lado,
          // el título se quedaba en «Bib…».
          logoUrl={libro ? undefined : ctx.iglesia.logoUrl}
          user={ctx.user}
          titulo={libro && !capitulo ? libro.nombre : 'Biblia'}
          // En el capítulo la versión va bajo el título grande: aquí arriba, al
          // lado de A−/A+, se cortaba en «Reina-Valera 1…».
          subtitulo={
            libro
              ? capitulo
                ? undefined
                : cap
                  ? `Capítulo ${cap} · Reina-Valera 1909`
                  : 'Reina-Valera 1909'
              : ctx.iglesia.nombre
          }
          // Aquí la flecha SÍ tiene sentido, al revés que en el muro: dentro de un
          // libro o de un capítulo hay a dónde volver de verdad.
          volver={libro ? (cap ? `/mi/biblia?libro=${libro.slug}` : '/mi/biblia') : undefined}
        >
          {capitulo && <TamanoLetra para="biblia" />}
        </CabeceraMiembro>
      }
      slug={slug}
      cap={cap}
      q={q}
      capitulo={capitulo}
    />
  );
}
