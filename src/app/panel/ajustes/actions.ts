'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias, type HorarioSemanal } from '@/lib/db/schema';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import {
  borrarImagenAnterior,
  subirImagenIglesia,
  type Ranura,
} from '@/lib/iglesias/imagenes';
import { FILAS_HORARIO, MAX_FOTOS } from './constantes';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';

/**
 * Ajustes de la iglesia.
 *
 * Todo esto es `requirePastorAccion`: son los datos que identifican a la
 * congregación y lo que sale publicado con su nombre. No es delegable por
 * permisos, igual que la facturación.
 */

function oNulo(v: FormDataEntryValue | null): string | null {
  const limpio = typeof v === 'string' ? v.trim() : '';
  return limpio ? limpio : null;
}

const EsquemaDatos = z.object({
  nombre: z.string().trim().min(2, 'El nombre de la iglesia es obligatorio.').max(120),
  denominacion: z.string().trim().max(120).optional().or(z.literal('')),
  ciudad: z.string().trim().max(120).optional().or(z.literal('')),
  direccion: z.string().trim().max(240).optional().or(z.literal('')),
  telefono: z.string().trim().max(40).optional().or(z.literal('')),
  email: z
    .union([z.string().trim().toLowerCase().email('Ese correo no parece válido.'), z.literal('')])
    .optional(),
  web: z
    .union([z.string().trim().url('La dirección web debe empezar por https://'), z.literal('')])
    .optional(),
  descripcion: z.string().trim().max(400).optional().or(z.literal('')),
});

export async function guardarDatosIglesia(formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const parsed = EsquemaDatos.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    denominacion: campo(formData, 'denominacion'),
    ciudad: campo(formData, 'ciudad'),
    direccion: campo(formData, 'direccion'),
    telefono: campo(formData, 'telefono'),
    email: campo(formData, 'email'),
    web: campo(formData, 'web'),
    descripcion: campo(formData, 'descripcion'),
  });

  if (!parsed.success) {
    redirect(
      '/panel/ajustes?error=' +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({
        nombre: d.nombre,
        denominacion: d.denominacion || null,
        ciudad: d.ciudad || null,
        direccion: d.direccion || null,
        telefono: normalizarTelefono(d.telefono || null, ctx.iglesia.pais),
        email: d.email || null,
        web: d.web || null,
        descripcion: d.descripcion || null,
      })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  revalidatePath('/panel', 'layout');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect('/panel/ajustes?guardado=datos');
}

const EsquemaWeb = z.object({
  webPublica: z.string().optional(),
  historia: z.string().trim().max(4000).optional().or(z.literal('')),
  cuentaDonativos: z.string().trim().max(80).optional().or(z.literal('')),
  titularDonativos: z.string().trim().max(160).optional().or(z.literal('')),
});

export async function guardarWebPublica(formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const parsed = EsquemaWeb.safeParse({
    webPublica: casilla(formData, 'webPublica') ? 'on' : undefined,
    historia: campo(formData, 'historia'),
    cuentaDonativos: campo(formData, 'cuentaDonativos'),
    titularDonativos: campo(formData, 'titularDonativos'),
  });

  if (!parsed.success) {
    redirect(
      '/panel/ajustes?error=' +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  /*
   * Los horarios llegan como campos numerados: `horario-0-dia`, `horario-0-hora`…
   *
   * Es la forma de tener una lista editable en un formulario nativo, sin
   * JavaScript. Se ofrecen seis filas fijas y se descartan las que no tengan
   * día, hora y nombre: una iglesia real tiene entre dos y cinco reuniones
   * semanales, así que seis huecos sobran y nadie echa de menos un botón de
   * «añadir fila».
   *
   * El día que hagan falta más, el sitio para arreglarlo es este.
   */
  const horarios: HorarioSemanal[] = [];

  for (let i = 0; i < FILAS_HORARIO; i++) {
    const dia = oNulo(formData.get(`horario-${i}-dia`));
    const hora = oNulo(formData.get(`horario-${i}-hora`));
    const nombre = oNulo(formData.get(`horario-${i}-nombre`));

    if (!dia || !hora || !nombre) continue;

    horarios.push({
      dia: dia.slice(0, 40),
      hora: hora.slice(0, 20),
      nombre: nombre.slice(0, 80),
      detalle: oNulo(formData.get(`horario-${i}-detalle`))?.slice(0, 200) ?? undefined,
      destacado: formData.get('horarioDestacado') === String(i),
    });
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({
        webPublica: parsed.data.webPublica === 'on',
        historia: parsed.data.historia || null,
        horarios,
        cuentaDonativos: parsed.data.cuentaDonativos || null,
        titularDonativos: parsed.data.titularDonativos || null,
      })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  // La web pública va con ISR de 60 s. Sin este `revalidatePath`, el pastor
  // guarda, abre su página y sigue viendo lo de antes: da por hecho que no se
  // ha guardado y lo vuelve a intentar.
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect('/panel/ajustes?guardado=web');
}

/**
 * Cambiar el logo o la portada.
 *
 * Un formulario propio por imagen, y no metidas en el de «Página pública»: un
 * `multipart/form-data` con una imagen de 2 MB tarda, y no tiene sentido que
 * subirla vaya atada a guardar los horarios.
 */
export async function guardarImagen(ranura: Ranura, formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const fichero = formData.get('imagen');
  if (!(fichero instanceof File)) {
    redirect(
      '/panel/ajustes?error=' + encodeURIComponent('No has elegido ninguna imagen.'),
    );
  }

  const resultado = await subirImagenIglesia(
    ctx.iglesia.id,
    ranura,
    fichero,
    // El sufijo que rompe la caché. Se genera aquí, en la action, para que la
    // función de subida no dependa del reloj y se pueda probar.
    Date.now().toString(36),
  );

  if (!resultado.ok) {
    redirect('/panel/ajustes?error=' + encodeURIComponent(resultado.error));
  }

  const columna = ranura === 'logo' ? 'logoUrl' : 'bannerUrl';

  // La anterior se lee ANTES de pisarla: `returning()` devuelve la fila ya
  // actualizada, así que ahí llegaría la URL nueva y el borrado se llevaría por
  // delante la imagen recién subida.
  const [previa] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: iglesias[columna] })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({ [columna]: resultado.url })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  // Solo después de que la nueva esté guardada. Ver el porqué en `imagenes.ts`.
  await borrarImagenAnterior(previa?.url ?? null);

  revalidatePath('/panel/ajustes');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  revalidatePath('/iglesias');
  redirect(`/panel/ajustes?guardado=${ranura}`);
}

/**
 * Añadir fotos al carrusel.
 *
 * Acepta varias de una vez: quien está montando su página sube las cuatro fotos
 * del templo en el mismo momento, no una por sesión.
 *
 * Si alguna falla, se guardan las que sí subieron y se dice cuántas quedaron
 * fuera. Abortar el lote entero por una foto rota obligaría a repetir el trabajo
 * bueno.
 */
export async function anadirFotos(formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const ficheros = formData
    .getAll('fotos')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (ficheros.length === 0) {
    redirect(
      '/panel/ajustes?error=' + encodeURIComponent('No has elegido ninguna foto.'),
    );
  }

  const [actual] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ imagenes: iglesias.imagenes })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  const yaHay = actual?.imagenes ?? [];
  const hueco = MAX_FOTOS - yaHay.length;

  if (hueco <= 0) {
    redirect(
      '/panel/ajustes?error=' +
        encodeURIComponent(
          `Ya tienes ${MAX_FOTOS} fotos. Quita alguna antes de subir más.`,
        ),
    );
  }

  const nuevas: string[] = [];
  let fallaron = 0;

  for (const [i, fichero] of ficheros.slice(0, hueco).entries()) {
    const r = await subirImagenIglesia(
      ctx.iglesia.id,
      'foto',
      fichero,
      `${Date.now().toString(36)}-${i}`,
    );
    if (r.ok) nuevas.push(r.url);
    else fallaron += 1;
  }

  if (nuevas.length === 0) {
    redirect(
      '/panel/ajustes?error=' +
        encodeURIComponent('No se pudo guardar ninguna foto. Inténtalo otra vez.'),
    );
  }

  const lista = [...yaHay, ...nuevas];

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      // `bannerUrl` sigue siendo la primera: la usan el directorio y OpenGraph,
      // que quieren una sola imagen. Ver el comentario del schema.
      .set({ imagenes: lista, bannerUrl: lista[0] ?? null })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  revalidatePath('/panel/ajustes');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  revalidatePath('/iglesias');

  const sobraron = ficheros.length - Math.min(ficheros.length, hueco);
  if (fallaron > 0 || sobraron > 0) {
    const partes = [
      fallaron > 0 ? `${fallaron} no se pudieron subir` : null,
      sobraron > 0 ? `${sobraron} no caben (máximo ${MAX_FOTOS})` : null,
    ].filter(Boolean);
    redirect(
      '/panel/ajustes?error=' +
        encodeURIComponent(
          `Se guardaron ${nuevas.length}. El resto no: ${partes.join(' y ')}.`,
        ),
    );
  }

  redirect('/panel/ajustes?guardado=fotos');
}

/** Quitar una foto concreta del carrusel. */
export async function quitarFoto(url: string) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const [actual] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ imagenes: iglesias.imagenes })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  const lista = (actual?.imagenes ?? []).filter((u) => u !== url);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({ imagenes: lista, bannerUrl: lista[0] ?? null })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  await borrarImagenAnterior(url);

  revalidatePath('/panel/ajustes');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  revalidatePath('/iglesias');
  redirect('/panel/ajustes?guardado=foto-quitada');
}

/** Quitar la imagen y dejar la iglesia sin ella. */
export async function quitarImagen(ranura: Ranura) {
  const ctx = await requirePastorAccion('/panel/ajustes');
  const columna = ranura === 'logo' ? 'logoUrl' : 'bannerUrl';

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: iglesias[columna] })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({ [columna]: null })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  await borrarImagenAnterior(fila?.url ?? null);

  revalidatePath('/panel/ajustes');
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  revalidatePath('/iglesias');
  redirect(`/panel/ajustes?guardado=${ranura}-quitada`);
}

export async function cambiarVisibilidadDirectorio(formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const visible = casilla(formData, 'visibleEnDirectorio');
  const aceptaSolicitudes = casilla(formData, 'aceptaSolicitudes');

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({
        visibleEnDirectorio: visible,
        aceptaSolicitudes,
      })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  revalidatePath('/iglesias');
  redirect('/panel/ajustes?guardado=directorio');
}
