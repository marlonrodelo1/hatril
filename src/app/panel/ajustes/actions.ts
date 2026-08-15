'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias, type HorarioSemanal } from '@/lib/db/schema';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import { FILAS_HORARIO } from './constantes';

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
    nombre: formData.get('nombre'),
    denominacion: formData.get('denominacion'),
    ciudad: formData.get('ciudad'),
    direccion: formData.get('direccion'),
    telefono: formData.get('telefono'),
    email: formData.get('email'),
    web: formData.get('web'),
    descripcion: formData.get('descripcion'),
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
    webPublica: formData.get('webPublica') ?? undefined,
    historia: formData.get('historia'),
    cuentaDonativos: formData.get('cuentaDonativos'),
    titularDonativos: formData.get('titularDonativos'),
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

export async function cambiarVisibilidadDirectorio(formData: FormData) {
  const ctx = await requirePastorAccion('/panel/ajustes');

  const visible = formData.get('visibleEnDirectorio') === 'on';
  const aceptaSolicitudes = formData.get('aceptaSolicitudes') === 'on';

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
