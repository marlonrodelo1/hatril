'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { requireGestionMinisterioAccion } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import { ministerios } from '@/lib/db/schema';
import { campo, casilla } from '@/lib/api/formulario';
import { conConfigDeModulo, tieneModulo } from '@/lib/ministerios/modulos';
import { normalizarEnlace } from '@/lib/repertorio/enlaces';
import {
  EsquemaEmisora,
  MAX_PROGRAMAS,
  emisoraDeModulos,
  ordenarParrilla,
} from '@/lib/emisora/config';
import { FILAS_DE_MAS } from './constantes';

/**
 * Guardar la radio: nombre, señal, parrilla y si sale en la web.
 *
 * Copia de `guardarPuestos` de los turnos, a propósito: leer la config y
 * escribirla en la MISMA transacción, para que dos personas guardando a la vez
 * no se pisen la mitad del jsonb que no estaban tocando.
 *
 * QUIÉN DECIDE QUÉ
 * ----------------
 * La señal y la parrilla, quien lleva la radio: el responsable y los colíderes,
 * además del pastor. Que la radio salga en la web de la iglesia, **solo el
 * pastor**: es la identidad pública de la congregación, el mismo criterio que
 * las redes de `/panel/compartir`. La RLS no puede distinguirlo —vive en el
 * mismo jsonb que el resto—, así que lo hace esta action.
 *
 * Y una consecuencia que no es obvia: si alguien que no es el pastor cambia la
 * señal mientras la radio está en la web, la radio sale de la web. El pastor
 * decidió publicar ESA señal; otra distinta en nombre de la iglesia, en
 * internet, la tiene que decidir él otra vez.
 */

const emisoraDe = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/emisora`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

export async function guardarEmisora(ministerioId: string, formData: FormData) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = emisoraDe(ministerioId);

  // Las filas de la parrilla llegan numeradas, como los horarios de Ajustes.
  // El total lo manda el propio formulario, y se acota: es un número que viene
  // del navegador.
  const total = Math.min(
    Math.max(Number(campo(formData, 'filas') ?? 0) || 0, 0),
    MAX_PROGRAMAS + FILAS_DE_MAS,
  );

  const parrilla: Record<string, unknown>[] = [];
  for (let i = 0; i < total; i++) {
    const hora = campo(formData, `programa-${i}-hora`);
    const nombre = campo(formData, `programa-${i}-nombre`);
    const tema = campo(formData, `programa-${i}-tema`);
    // Una fila sin hora, sin nombre y sin tema es una fila en blanco, aunque el
    // día y la duración vengan rellenos: esos dos tienen valor por defecto. Con
    // solo el tema escrito no se descarta: se le dice que falta lo demás.
    if (!hora && !nombre && !tema) continue;

    parrilla.push({
      dia: campo(formData, `programa-${i}-dia`) ?? '',
      hora: hora ?? '',
      nombre: nombre ?? '',
      tema,
      duracion_min: campo(formData, `programa-${i}-duracion`) ?? '60',
    });
  }

  const parsed = EsquemaEmisora.safeParse({
    nombre: campo(formData, 'nombre'),
    stream_url: normalizarEnlace(campo(formData, 'stream_url')),
    parrilla,
    en_web: casilla(formData, 'en_web'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [clave, fila] = issue?.path ?? [];
    const prefijo =
      clave === 'parrilla' && typeof fila === 'number'
        ? `Programa ${fila + 1}: `
        : '';
    volver(prefijo + (issue?.message ?? 'Revisa los datos.'), base);
  }

  const datos = parsed.data;
  const pastor = esPastor(ctx);

  const resultado = await withUser(ctx.user.id, async (tx) => {
    const donde = and(
      eq(ministerios.id, ministerioId),
      eq(ministerios.iglesiaId, ctx.iglesia.id),
    );

    const [actual] = await tx
      .select({ modulos: ministerios.modulos })
      .from(ministerios)
      .where(donde)
      .limit(1);

    // La segunda puerta del layout, que una action no atraviesa. Pasará a ser
    // `exigirModulo()` cuando se fusione la tanda 1, que la trae para todos.
    if (!actual || !tieneModulo(actual.modulos, 'emisora')) return 'apagado';

    const anterior = emisoraDeModulos(actual.modulos);
    const senal = datos.stream_url ?? null;
    const enWeb = pastor
      ? datos.en_web
      : anterior.enWeb && senal === anterior.streamUrl;

    await tx
      .update(ministerios)
      .set({
        modulos: conConfigDeModulo(actual.modulos, 'emisora', {
          // `null` y no ausente: `conConfigDeModulo` mezcla con lo anterior, y
          // un campo que no viaja dejaría el valor viejo en vez de borrarlo.
          nombre: datos.nombre ?? null,
          stream_url: senal,
          parrilla: ordenarParrilla(datos.parrilla),
          en_web: enWeb,
        }),
      })
      .where(donde);

    if (anterior.enWeb && !enWeb && !pastor) return 'fuera-de-la-web';
    return senal ? 'guardado' : 'guardado-sin-senal';
  });

  if (resultado === 'apagado') {
    volver('La radio de este ministerio está apagada. La enciende el pastor.', base);
  }

  revalidatePath(base);
  // El reproductor vive en el layout de `/mi`, no en una página.
  revalidatePath('/mi', 'layout');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${base}?guardado=${resultado}`);
}
