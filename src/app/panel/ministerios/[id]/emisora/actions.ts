'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import {
  exigirModulo,
  requireGestionMinisterioAccion,
} from '@/lib/auth/guard-panel';
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
  type Emisora,
} from '@/lib/emisora/config';
import { choqueEnParrilla } from '@/lib/emisora/parrilla';
import { FILAS_DE_MAS } from './constantes';

/**
 * Guardar la radio: nombre, señal, parrilla y si sale en la web.
 *
 * Lee la config y la escribe en la misma transacción, como `guardarPuestos`,
 * pero además BLOQUEANDO la fila al leer (`for update`). Sin el bloqueo, estar
 * en la misma transacción no protege de nada en READ COMMITTED: si el pastor
 * saca la radio de la web mientras un colíder guarda, las dos leen
 * `en_web=true`, y la del colíder escribe ese dato viejo encima de la decisión
 * del pastor. Con el bloqueo, la segunda espera y relee lo ya confirmado.
 * `guardarPuestos` y `editarMinisterio` tienen el mismo hueco.
 *
 * QUIÉN DECIDE QUÉ
 * ----------------
 * La señal y la parrilla, quien lleva la radio: el responsable y los colíderes,
 * además del pastor. Que la radio salga en la web de la iglesia, **solo el
 * pastor**: es la identidad pública de la congregación, el mismo criterio que
 * las redes de `/panel/compartir`. La RLS no puede distinguirlo —vive en el
 * mismo jsonb que el resto—, así que lo hace esta action.
 *
 * Y una consecuencia que no es obvia: si alguien que no es el pastor cambia lo
 * que sale en la web —la señal, el nombre de la emisora o cualquier programa
 * de la parrilla con su tema— mientras la radio está publicada, la radio sale
 * de la web. El pastor decidió publicar ESO; otra señal, u otro texto en nombre
 * de la iglesia en internet, lo tiene que decidir él otra vez. No es teórico:
 * el tema de un programa es texto libre, y un «Testimonio de Marta R.: cómo
 * salió del alcohol» escrito por un colíder sería la fe y la salud de una
 * persona en la web de la iglesia sin que el pastor lo hubiera visto.
 */

const emisoraDe = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/emisora`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

export async function guardarEmisora(ministerioId: string, formData: FormData) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  await exigirModulo(ctx, ministerioId, 'emisora');
  const base = emisoraDe(ministerioId);

  // Las filas de la parrilla llegan numeradas, como los horarios de Ajustes.
  // El total lo manda el propio formulario, y se acota: es un número que viene
  // del navegador.
  const total = Math.min(
    Math.max(Number(campo(formData, 'filas') ?? 0) || 0, 0),
    MAX_PROGRAMAS + FILAS_DE_MAS,
  );

  const parrilla: Record<string, unknown>[] = [];
  // Para los mensajes: de qué fila del formulario sale cada programa. Sin esto
  // el número salía del array ya sin las filas en blanco, y «Programa 3» podía
  // señalar una fila que estaba bien.
  const deDonde: { fila: number; nombre?: string; dia?: string }[] = [];
  for (let i = 0; i < total; i++) {
    const hora = campo(formData, `programa-${i}-hora`);
    const nombre = campo(formData, `programa-${i}-nombre`);
    const tema = campo(formData, `programa-${i}-tema`);
    const dia = campo(formData, `programa-${i}-dia`);
    // Una fila sin hora, sin nombre y sin tema es una fila en blanco, aunque el
    // día y la duración vengan rellenos: esos dos tienen valor por defecto. Con
    // solo el tema escrito no se descarta: se le dice que falta lo demás.
    if (!hora && !nombre && !tema) continue;

    parrilla.push({
      dia: dia ?? '',
      hora: hora ?? '',
      nombre: nombre ?? '',
      tema,
      duracion_min: campo(formData, `programa-${i}-duracion`) ?? '60',
    });
    deDonde.push({ fila: i + 1, nombre, dia });
  }

  const parsed = EsquemaEmisora.safeParse({
    nombre: campo(formData, 'nombre'),
    stream_url: normalizarEnlace(campo(formData, 'stream_url')),
    parrilla,
    en_web: casilla(formData, 'en_web'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [clave, indice] = issue?.path ?? [];
    const origen =
      clave === 'parrilla' && typeof indice === 'number' ? deDonde[indice] : null;
    // Por su nombre y su día, que es como lo reconoce quien lo escribió: al
    // volver con el error el formulario se pinta desde la base y lo tecleado
    // ya no está, así que un número de fila apenas ayuda a encontrarlo.
    const prefijo = !origen
      ? ''
      : origen.nombre
        ? `«${origen.nombre}»${origen.dia ? ` (${origen.dia.toLowerCase()})` : ''}: `
        : `La fila ${origen.fila}: `;
    volver(prefijo + (issue?.message ?? 'Revisa los datos.'), base);
  }

  const choque = choqueEnParrilla(parsed.data.parrilla);
  if (choque) volver(choque, base);

  const datos = parsed.data;
  const pastor = esPastor(ctx);

  const resultado = await withUser(ctx.user.id, async (tx) => {
    const donde = and(
      eq(ministerios.id, ministerioId),
      eq(ministerios.iglesiaId, ctx.iglesia.id),
    );

    // Bloqueada: ver la cabecera.
    const [actual] = await tx
      .select({ modulos: ministerios.modulos })
      .from(ministerios)
      .where(donde)
      .limit(1)
      .for('update');

    // `exigirModulo()` ya lo miró antes de entrar, pero el pastor pudo apagar
    // la radio entre aquella consulta y este bloqueo. Aquí, con la fila
    // bloqueada, la respuesta ya no cambia hasta que se escriba.
    if (!actual || !tieneModulo(actual.modulos, 'emisora')) return 'apagado';

    const anterior = emisoraDeModulos(actual.modulos);
    const nueva = {
      nombre: datos.nombre ?? null,
      streamUrl: datos.stream_url ?? null,
      parrilla: ordenarParrilla(datos.parrilla),
    };
    const enWeb = pastor
      ? datos.en_web
      : anterior.enWeb && loPublico(anterior) === loPublico(nueva);

    await tx
      .update(ministerios)
      .set({
        modulos: conConfigDeModulo(actual.modulos, 'emisora', {
          // `null` y no ausente: `conConfigDeModulo` mezcla con lo anterior, y
          // un campo que no viaja dejaría el valor viejo en vez de borrarlo.
          nombre: nueva.nombre,
          stream_url: nueva.streamUrl,
          parrilla: nueva.parrilla,
          en_web: enWeb,
        }),
      })
      .where(donde);

    if (anterior.enWeb && !enWeb && !pastor) return 'fuera-de-la-web';
    return nueva.streamUrl ? 'guardado' : 'guardado-sin-senal';
  });

  // A la pantalla del equipo y no a la de la radio, que con el módulo apagado
  // da 404 y se tragaría el mensaje.
  if (resultado === 'apagado') {
    volver(
      'La radio de este ministerio está apagada. La enciende el pastor.',
      `/panel/ministerios/${ministerioId}`,
    );
  }

  revalidatePath(base);
  // El reproductor vive en el layout de `/mi`, no en una página.
  revalidatePath('/mi', 'layout');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${base}?guardado=${resultado}`);
}

/**
 * Lo que de la radio llega a la web, en una forma que se puede comparar: el
 * nombre, la señal y cada programa con su tema y su duración. Si cambia y quien
 * guarda no es el pastor, la radio sale de la web.
 */
function loPublico(
  e: Pick<Emisora, 'nombre' | 'streamUrl' | 'parrilla'>,
): string {
  return JSON.stringify({
    nombre: e.nombre,
    senal: e.streamUrl,
    parrilla: e.parrilla.map((p) => [
      p.dia,
      p.hora,
      p.nombre,
      p.tema ?? null,
      p.duracion_min,
    ]),
  });
}
