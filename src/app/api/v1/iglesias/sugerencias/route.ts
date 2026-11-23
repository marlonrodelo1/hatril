import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sugerirIglesias } from '@/lib/iglesias/directorio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sugerencias del buscador de iglesias mientras se escribe.
 *
 * PÚBLICA A PROPÓSITO, SIN GUARDA
 * -------------------------------
 * Devuelve lo mismo que `/buscar?q=` enseña a cualquiera que no tenga sesión:
 * nombre, ciudad y país de las iglesias publicadas en el directorio. La
 * consulta va como `anon` (`withAnon`), así que la policy solo deja salir las
 * que tienen `visible_en_directorio` y los grants por columna no dejan pedir
 * más que eso. El resto de `/api` lleva su guarda; esta no la necesita porque
 * no hay nada que no sea ya público.
 */
const Consulta = z.object({ q: z.string().trim().min(2).max(80) });

export async function GET(request: NextRequest) {
  const parsed = Consulta.safeParse({ q: request.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Escribe al menos dos letras.', detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sugerencias = await sugerirIglesias(parsed.data.q);
  return NextResponse.json(
    { sugerencias },
    // Lo mismo para todo el mundo: un minuto de caché ahorra consultas a
    // quien escribe, borra y vuelve a escribir.
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
