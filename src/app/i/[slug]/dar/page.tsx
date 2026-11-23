import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { User } from '@supabase/supabase-js';

import { paginaDeDar } from '@/lib/donativos/consultas';
import { createClient } from '@/lib/supabase/server';
import { darDonativo } from './actions';
import { CabeceraDar } from './_components/cabecera-dar';
import { FormularioDar } from './_components/formulario-dar';
import { Transferencia } from './_components/transferencia';

/**
 * La página de dar de cada iglesia: `/i/[slug]/dar`.
 *
 * Sencilla y enfocada, no la web entera: quien llega aquí ya ha decidido dar,
 * desde el botón «Donar» de la web, desde la app o desde un enlace que la
 * iglesia ha compartido. Sirve igual con cuenta que sin ella.
 *
 * NO EXIGE `web_publica`
 * ----------------------
 * Ni esta página ni `paginaDeDar`: una iglesia puede querer recibir ofrendas
 * de su gente desde la app sin haber publicado su web. `/i/[slug]` no tiene
 * `layout.tsx` que lo impida (la web lo comprueba en su propia página, con
 * `obtenerIglesiaPublica`), así que no hay nada que sortear. Si un día se le
 * pone un layout a `/i/[slug]`, que no exija la web publicada, o esta página
 * deja de existir para la mitad de las iglesias sin que nadie lo note.
 *
 * DINÁMICA, NO ISR COMO LA WEB
 * ----------------------------
 * Lee la sesión para rellenar el nombre y el correo, y `?cancelado=1`. Una
 * versión guardada serviría el correo de una persona a la siguiente.
 *
 * Lo que sale hacia el navegador es lo que `paginaDeDar` deja: nombre, logo,
 * fondos y la cuenta para transferencias. El `stripeAccountId` se queda aquí.
 */
export const dynamic = 'force-dynamic';

// `generateMetadata` y la página la piden en el mismo render: una consulta.
const cargar = cache((slug: string) => paginaDeDar(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const pagina = await cargar((await params).slug);
  if (!pagina) return { title: 'Dar' };
  return {
    // `absolute`, como la web: es la página de la iglesia, no una de Hatril.
    title: { absolute: `Dar a ${pagina.iglesia.nombre}` },
    description: `Diezmos y ofrendas para ${pagina.iglesia.nombre}.`,
  };
}

/**
 * El nombre de la cuenta para el recibo, o nada. `nombreDeLaCuenta` no sirve
 * aquí: a falta de nombre devuelve el principio del correo («pastor»), que en
 * una cabecera vale pero en un recibo no es el nombre de nadie.
 */
function nombreGuardado(user: User | null): string {
  const n = user?.user_metadata?.nombre;
  return typeof n === 'string' ? n.trim() : '';
}

export default async function DarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelado?: string | string[] }>;
}) {
  const { slug } = await params;
  const { cancelado } = await searchParams;

  const pagina = await cargar(slug);
  if (!pagina) notFound();
  const { iglesia, transferencia } = pagina;

  const cabecera = <CabeceraDar titulo={`Dar a ${iglesia.nombre}`} iglesia={iglesia} />;

  // Sin tarjeta, `paginaDeDar` solo devuelve la página si hay cuenta para
  // transferencias: entonces es eso lo que se enseña, sin formulario. Volver
  // a la web ya lo hace la flecha de la cabecera.
  if (!pagina.conTarjeta) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 pt-5 pb-10 sm:px-5 sm:pt-10">
          {cabecera}
          {transferencia && (
            <Transferencia
              iglesiaNombre={iglesia.nombre}
              cuenta={transferencia.cuenta}
              titular={transferencia.titular}
              plegada={false}
            />
          )}
        </main>
      </div>
    );
  }

  // La sesión, si la hay, solo para rellenar. Quien no tiene cuenta da igual.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <FormularioDar
        accion={darDonativo.bind(null, iglesia.slug)}
        slug={iglesia.slug}
        iglesiaNombre={iglesia.nombre}
        fondos={pagina.fondos}
        transferencia={transferencia}
        inicial={{ nombre: nombreGuardado(user), email: user?.email ?? '' }}
        cancelado={cancelado === '1'}
        cabecera={cabecera}
      />
    </div>
  );
}
