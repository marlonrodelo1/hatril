'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';

import {
  exigirModulo,
  requireGestionMinisterioAccion,
  requirePermisoAccion,
} from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import {
  consentimientos,
  miembros,
  seguimientoAsignaciones,
  seguimientoContactos,
} from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import {
  resultadoContactoEnum,
  viaContactoEnum,
} from '@/lib/db/schema/seguimiento';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import {
  DIAS_EN_NUEVOS,
  estaEnSeguimiento,
  personasPorFaltas,
} from '@/lib/seguimiento/consultas';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * El seguimiento de personas.
 *
 * DOS GUARDS EN CADA ACTION, NO UNO
 * ---------------------------------
 * `requirePermisoAccion('ver_seguimiento')` dice que esta persona puede tratar
 * datos de por qué la gente deja de venir. `requireGestionMinisterioAccion` dice
 * que manda en ESTE equipo. Hacen falta los dos: con solo el primero, cualquiera
 * con el permiso escribiría en el seguimiento de un ministerio ajeno mandando su
 * uuid; con solo el segundo, el líder de alabanza apuntaría contactos.
 *
 * El layout de la sección comprueba lo mismo para lo que se PINTA. Esto es para
 * lo que se EJECUTA, que es lo que de verdad hay que proteger: una server action
 * es un endpoint y esconder el botón no protege nada.
 */

const DESTINO = '/panel/ministerios';

const base = (ministerioId: string) => `${DESTINO}/${ministerioId}/seguimiento`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

/**
 * Los guards, siempre juntos y siempre en este orden. El tercero, que el
 * seguimiento esté encendido en ESE ministerio, solo lo miraba el `layout.tsx`,
 * que no corre en una server action.
 */
async function permiso(ministerioId: string) {
  await requirePermisoAccion('ver_seguimiento', DESTINO);
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  await exigirModulo(ctx, ministerioId, 'seguimiento');
  return ctx;
}

/**
 * La tercera puerta, la de la persona: solo se escribe sobre quien sale en la
 * lista. El porqué —el permiso de asistencia— está en `estaEnSeguimiento()`.
 *
 * El mensaje no dice por qué no está, y es deliberado. Haber negado el permiso
 * también es un dato de esa persona, y la lista la omite sin explicarlo: la
 * action no puede contar más que la pantalla. Vuelve al listado y no a la ficha,
 * que para esa persona da 404.
 */
async function exigirEnLaLista(
  ctx: UserContext,
  ministerioId: string,
  miembroId: string,
) {
  if (!(await estaEnSeguimiento(ctx, ministerioId, miembroId))) {
    volver('Esa persona no está en la lista de seguimiento.', base(ministerioId));
  }
}

const EsquemaContacto = z.object({
  miembroId: z.string().uuid('Falta a quién se contactó.'),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha.'),
  // Los valores salen del propio enum de Drizzle y no del catálogo de pantalla.
  // Así el tipo que sale de Zod ya es `ViaContacto`, sin castings, y añadir un
  // valor al enum lo acepta esta validación sola — mientras que el catálogo de
  // etiquetas NO compila hasta que alguien escriba cómo se llama en castellano,
  // que es justo el orden correcto de fricciones.
  via: z.enum(viaContactoEnum.enumValues),
  resultado: z.enum(resultadoContactoEnum.enumValues),
  // El mismo 200 que el CHECK de la base. Aquí para dar un mensaje en castellano
  // en lugar de un 500 con un error de Postgres detrás.
  proximoPaso: z
    .string()
    .trim()
    .max(200, 'El próximo paso es demasiado largo: dos líneas bastan.')
    .optional()
    .or(z.literal('')),
});

export async function registrarContacto(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await permiso(ministerioId);

  const parsed = EsquemaContacto.safeParse({
    miembroId: campoObligatorio(formData, 'miembroId'),
    fecha: campoObligatorio(formData, 'fecha'),
    via: campoObligatorio(formData, 'via'),
    resultado: campoObligatorio(formData, 'resultado'),
    proximoPaso: campo(formData, 'proximoPaso'),
  });

  if (!parsed.success) {
    volver(parsed.error.issues[0]!.message, base(ministerioId));
  }

  const d = parsed.data;
  const destino = `${base(ministerioId)}/${d.miembroId}`;

  await exigirEnLaLista(ctx, ministerioId, d.miembroId);

  // Sin ficha no se puede firmar, y la policy lo rechazaría con un 500 seco.
  // Es un caso real: una cuenta puede existir sin `miembros` asociado.
  const autor = ctx.miembroId;
  if (!autor) {
    volver(
      'Tu cuenta no tiene ficha de miembro, así que no puede firmar un contacto.',
      destino,
    );
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(seguimientoContactos).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        miembroId: d.miembroId,
        // No sale del formulario: lo pone el servidor y la policy lo vuelve a
        // comprobar contra `miembro_actual()`. Nadie firma con la ficha de otro.
        autorMiembroId: autor,
        fecha: d.fecha,
        via: d.via,
        resultado: d.resultado,
        proximoPaso: d.proximoPaso?.trim() || null,
      }),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT118')) {
      volver('Esa persona no es de tu iglesia.', destino);
    }
    throw err;
  }

  revalidatePath(base(ministerioId));
  redirect(`${destino}?guardado=contacto`);
}

/**
 * Poner o cambiar quién acompaña a una persona.
 *
 * `responsable` vacío quita la asignación en vez de fallar: en la pantalla es un
 * desplegable con «Sin asignar» arriba, y elegir esa opción tiene que significar
 * algo. Se hace con baja lógica —`activo = false`— y no con un DELETE, porque el
 * índice único es parcial y el histórico de quién lo llevó antes es justo lo que
 * se quiere mirar cuando alguien pregunta si esto ya se intentó.
 */
export async function asignarAcompanante(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  const ctx = await permiso(ministerioId);
  const destino = `${base(ministerioId)}/${miembroId}`;

  const responsable = campo(formData, 'responsable');
  const hoy = campoObligatorio(formData, 'hoy');

  if (responsable && !z.string().uuid().safeParse(responsable).success) {
    volver('Revisa a quién le asignas esta persona.', destino);
  }

  // También al QUITAR la asignación, aunque desactivar no cree nada: a quien no
  // está en la lista la pantalla no le ofrece este formulario, así que una
  // petición así solo puede ser fabricada, y no hay por qué atenderla a medias.
  await exigirEnLaLista(ctx, ministerioId, miembroId);

  try {
    await withUser(ctx.user.id, async (tx) => {
      await tx
        .update(seguimientoAsignaciones)
        .set({ activo: false })
        .where(
          and(
            eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
            eq(seguimientoAsignaciones.ministerioId, ministerioId),
            eq(seguimientoAsignaciones.miembroId, miembroId),
            eq(seguimientoAsignaciones.activo, true),
          ),
        );

      if (!responsable) return;

      await tx.insert(seguimientoAsignaciones).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        miembroId,
        responsableMiembroId: responsable,
        desde: hoy,
      });
    });
  } catch (err) {
    // HT118 cubre el caso útil: elegir a alguien que ya no está en el equipo.
    if (esGuardHatril(err, 'HT118')) {
      volver(
        'Esa persona ya no está en el equipo de este ministerio.',
        destino,
      );
    }
    if (isUniqueViolation(err)) {
      volver('Esa persona ya tiene a alguien acompañándola.', destino);
    }
    throw err;
  }

  revalidatePath(base(ministerioId));
  redirect(`${destino}?guardado=asignado`);
}

/**
 * Borrar un contacto apuntado por error.
 *
 * Existe porque la tabla NO tiene UPDATE concedido: un contacto es un hecho
 * fechado y reescribirlo dejaría una mentira con fecha. Si se apuntó mal, deja
 * de existir. Y hace falta además para el derecho de supresión.
 */
export async function borrarContacto(
  ministerioId: string,
  miembroId: string,
  contactoId: string,
) {
  const ctx = await permiso(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(seguimientoContactos)
      .where(
        and(
          eq(seguimientoContactos.id, contactoId),
          eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
          eq(seguimientoContactos.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base(ministerioId));
  redirect(`${base(ministerioId)}/${miembroId}?guardado=borrado`);
}

const EsquemaVisitante = z.object({
  nombre: z.string().trim().min(2, 'Escribe su nombre.').max(120),
  apellidos: z.string().trim().max(160).optional().or(z.literal('')),
  telefono: z.string().trim().max(40).optional().or(z.literal('')),
  email: z
    .union([
      z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
      z.literal(''),
    ])
    .optional(),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha de su primera visita.'),
});

/**
 * Apuntar a alguien que acaba de llegar, desde el móvil del equipo.
 *
 * HASTA DÓNDE LLEGA, Y POR QUÉ NO MÁS
 * -----------------------------------
 * Crear fichas es de `editar_miembros`, y el líder de consolidación no lo
 * tiene. Esta action le deja hacer UNA cosa de ese permiso: crear una ficha
 * nueva en estado Visitante, con nombre, teléfono, correo y la fecha en que
 * vino. No edita ninguna ficha que ya exista, no toca ministerios, no escribe
 * los campos protegidos (dirección, nacimiento, notas) ni elige otro estado.
 * Completar la ficha o hacerle miembro sigue siendo de quien lleva el fichero.
 *
 * Cabe sin migración porque la RLS de `miembros` solo exige
 * `pertenece_a_iglesia()`: el recorte de quién da de alta lo pone la
 * aplicación, como en `crearMiembro`. Y entra por `withUser`, así que la ficha
 * no puede caer en otra iglesia, y `auditar()` deja escrito quién la creó.
 *
 * LOS DOS PERMISOS SE GUARDAN, Y EL SEGUNDO SOLO SI SE DA
 * -------------------------------------------------------
 * Quien acaba de llegar no está en ninguna de las bases que `/privacidad` §4
 * daba por buenas: no pidió entrar desde el directorio ni «ya era de la casa».
 * La base es su consentimiento, dado a la iglesia de palabra o en una tarjeta:
 * quien le apunta le lee los dos textos y marca lo que dice. Se registra como
 * en `aprobarSolicitud`: el general en la versión vigente, y el de asistencia
 * solo si lo marcó. Sin el segundo, `miembrosSinPermisoDeAsistencia` le saca
 * de «Nuevos» y de las listas, que es lo que tiene que pasar: el silencio no
 * cuenta como sí.
 *
 * Sin IP ni navegador, como en el reparto: serían los del voluntario, y
 * guardarlos como si fueran de esa persona sería fabricar una prueba. La prueba
 * de verdad es la tarjeta firmada, si la hubo, y la guarda la iglesia.
 */
export async function apuntarVisitante(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await permiso(ministerioId);
  const formulario = `${base(ministerioId)}/nuevos/alta`;

  const parsed = EsquemaVisitante.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    apellidos: campo(formData, 'apellidos'),
    telefono: campo(formData, 'telefono'),
    email: campo(formData, 'email'),
    fecha: campoObligatorio(formData, 'fecha'),
  });

  if (!parsed.success) volver(parsed.error.issues[0]!.message, formulario);
  const d = parsed.data;

  if (!casilla(formData, 'permiso')) {
    volver(
      'Sin su permiso no se le puede apuntar. Léele el texto de la primera casilla y márcala si dice que sí.',
      formulario,
    );
  }
  if (!casilla(formData, 'adulto')) {
    volver(
      'Por aquí solo entran personas mayores de edad. Los menores vienen con su familia.',
      formulario,
    );
  }
  const aceptaAsistencia = casilla(formData, 'asistencia');

  // Una fecha fuera de los últimos noventa días crearía una ficha que no sale
  // en «Nuevos», que es la única pantalla desde la que quien la crea la vería.
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  if (d.fecha > hoy || d.fecha < sumarDias(hoy, -DIAS_EN_NUEVOS)) {
    volver(
      `La primera visita tiene que ser de los últimos ${DIAS_EN_NUEVOS} días. Si vino antes, pide que lo den de alta en Miembros.`,
      formulario,
    );
  }

  const telefono = normalizarTelefono(d.telefono || null, ctx.iglesia.pais);

  if (telefono) {
    await noDuplicar(ctx, ministerioId, formulario, {
      nombre: d.nombre,
      apellidos: d.apellidos || null,
      telefono,
      esOtraPersona: casilla(formData, 'otraPersona'),
    });
  }

  const creada = await withUser(ctx.user.id, async (tx) => {
    const [fila] = await tx
      .insert(miembros)
      .values({
        iglesiaId: ctx.iglesia.id,
        nombre: d.nombre,
        apellidos: d.apellidos?.trim() || null,
        email: d.email?.trim() || null,
        telefono,
        // Fijo, no del formulario: es todo lo que esta puerta puede crear.
        estado: 'visitante',
        fechaIngreso: d.fecha,
      })
      .returning({ id: miembros.id });

    await tx.insert(consentimientos).values([
      {
        iglesiaId: ctx.iglesia.id,
        miembroId: fila!.id,
        tipo: 'datos_religiosos' as const,
        versionTexto: VERSION_POLITICA_PRIVACIDAD,
      },
      ...(aceptaAsistencia
        ? [
            {
              iglesiaId: ctx.iglesia.id,
              miembroId: fila!.id,
              tipo: 'asistencia_y_seguimiento' as const,
              versionTexto: VERSION_POLITICA_PRIVACIDAD,
            },
          ]
        : []),
    ]);

    return fila!;
  });

  revalidatePath(base(ministerioId));

  // Sin el permiso de asistencia, su ficha no sale en el seguimiento y la de
  // `[miembroId]` le daría 404. Se vuelve a «Nuevos» diciendo por qué no está.
  if (!aceptaAsistencia) {
    redirect(`${base(ministerioId)}/nuevos?guardado=sinPermiso`);
  }
  redirect(`${base(ministerioId)}/${creada.id}?guardado=alta`);
}

/**
 * Que el mismo visitante no acabe con dos fichas, sin cerrarle la puerta a su
 * pareja ni contar de más.
 *
 * `miembros` no tiene único por teléfono, y el visitante apuntado el domingo
 * por una persona y el miércoles por otra acabaría con su historia partida en
 * dos. Pero un teléfono solo no identifica a nadie: en una familia que viene
 * junta suele haber un móvil para todos. Así que:
 *
 *   - mismo teléfono y mismo nombre, en una ficha que el seguimiento enseña: es
 *     esa persona, y se lleva a su ficha sin crear otra;
 *   - mismo teléfono y otro nombre: se pregunta si es otra persona. Nunca se
 *     lleva sin preguntar a la ficha de alguien que se llama distinto;
 *   - el teléfono solo está en fichas que el seguimiento NO enseña (quien negó
 *     el permiso de asistencia): un mensaje que no dice que la ficha exista.
 *
 * El tercer caso tiene un residuo que no se puede quitar: cualquier respuesta
 * distinta de «apuntado» es una señal. Se acepta, y está escrito en el
 * documento de estado: la alternativa es crear duplicados de quien pidió no
 * aparecer.
 *
 * Con «es otra persona» marcado se crea sin más, salvo que el nombre también
 * coincida con una ficha visible: eso ya no es otra persona.
 */
async function noDuplicar(
  ctx: UserContext,
  ministerioId: string,
  formulario: string,
  nuevo: {
    nombre: string;
    apellidos: string | null;
    telefono: string;
    esOtraPersona: boolean;
  },
) {
  const conEseTelefono = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          eq(miembros.telefono, nuevo.telefono),
          isNull(miembros.archivadoAt),
          ne(miembros.estado, 'baja'),
        ),
      )
      .limit(10),
  );
  if (conEseTelefono.length === 0) return;

  // La lista del seguimiento decide qué se puede enseñar: lo mismo que la
  // ficha y que `exigirEnLaLista`. Una sola consulta para todas.
  const visibles = new Set(
    (await personasPorFaltas(ctx, ministerioId)).map((p) => p.miembroId),
  );
  const enLaLista = conEseTelefono.filter((m) => visibles.has(m.id));

  const misma = enLaLista.find((m) => mismoNombre(m, nuevo));
  if (misma) {
    redirect(`${base(ministerioId)}/${misma.id}?guardado=existe`);
  }
  if (nuevo.esOtraPersona) return;

  if (enLaLista.length > 0) {
    redirect(
      `${formulario}?repetido=1&error=` +
        encodeURIComponent('Ese teléfono ya es de otra ficha. ¿Es otra persona?'),
    );
  }

  volver(
    'No se puede apuntar a esta persona desde aquí. Pide a quien lleva Miembros que la dé de alta.',
    formulario,
  );
}

/**
 * ¿El mismo nombre? Sin tildes, sin mayúsculas y sin espacios de más. Los
 * apellidos solo cuentan si los dos los tienen: en la tarjeta suele faltar
 * alguno, y «Rosa» y «Rosa Medina Pinto» con el mismo móvil son la misma Rosa.
 */
function mismoNombre(
  a: { nombre: string; apellidos: string | null },
  b: { nombre: string; apellidos: string | null },
): boolean {
  if (normalizar(a.nombre) !== normalizar(b.nombre)) return false;
  const ap = normalizar(a.apellidos ?? '');
  const bp = normalizar(b.apellidos ?? '');
  return !ap || !bp || ap === bp;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
