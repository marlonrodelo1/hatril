'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';

import {
  requireGestionMinisterioAccion,
  requirePermisoAccion,
} from '@/lib/auth/guard-panel';
import { esPastor, puede, type ContextoPermisos } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import {
  miembros,
  ministerioMiembros,
  ministerios,
  type RolEquipo,
} from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { COLORES_MINISTERIO } from '@/lib/ministerios/colores';
import { componerModulos } from '@/lib/ministerios/modulos';
import { TIPOS_MINISTERIO, modulosDelTipo } from '@/lib/ministerios/tipos';
import {
  borrarImagenAnterior,
  subirImagenIglesia,
} from '@/lib/iglesias/imagenes';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';

const HEX_VALIDOS = COLORES_MINISTERIO.map((c) => c.hex) as [string, ...string[]];

const TIPOS_VALIDOS = TIPOS_MINISTERIO.map((t) => t.id) as [string, ...string[]];

/** Misión, visión y objetivo. Mismo límite: son tres párrafos, no un documento. */
const Parrafo = z.string().trim().max(600).optional().or(z.literal(''));

/**
 * Lo de dentro del ministerio: lo que también escribe su líder.
 *
 * Aparte del tipo porque no lo guarda la misma gente. Ver `editarMinisterio`.
 */
const EsquemaContenido = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del ministerio es demasiado corto.')
    .max(80, 'Ese nombre es demasiado largo.'),
  descripcion: z.string().trim().max(400).optional().or(z.literal('')),
  // Solo se aceptan los cinco colores de la paleta. Que el formulario ofrezca
  // únicamente esos no basta: una server action es un endpoint y se le puede
  // mandar cualquier cosa.
  colorHex: z.enum(HEX_VALIDOS),
  mision: Parrafo,
  vision: Parrafo,
  objetivo: Parrafo,
});

// Mismo criterio con el tipo. En base de datos la columna es `text` sin CHECK
// —el catálogo tiene que poder crecer sin migrar—, así que la única puerta que
// impide guardar cualquier cosa es esta línea.
const EsquemaTipo = z.enum(TIPOS_VALIDOS, {
  message: 'Ese tipo de ministerio no existe.',
});

const EsquemaMinisterio = EsquemaContenido.extend({ tipo: EsquemaTipo });

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

function contenidoDelFormulario(formData: FormData) {
  return {
    nombre: campoObligatorio(formData, 'nombre'),
    descripcion: campo(formData, 'descripcion'),
    colorHex: campoObligatorio(formData, 'colorHex'),
    mision: campo(formData, 'mision'),
    vision: campo(formData, 'vision'),
    objetivo: campo(formData, 'objetivo'),
  };
}

function leer(formData: FormData) {
  return EsquemaMinisterio.safeParse({
    ...contenidoDelFormulario(formData),
    tipo: campoObligatorio(formData, 'tipo'),
  });
}

/**
 * ¿Decide sobre los ministerios de la iglesia, y no solo sobre el suyo?
 *
 * Es la línea entre el pastor y el líder acotado: crear, cerrar, nombrar al
 * responsable, quitarlo, y elegir el tipo y las herramientas de cada equipo.
 */
function gobiernaLosMinisterios(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'gestionar_ministerios');
}

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/** Lo que manda alguien en un equipo, o `null` si no está en él. */
type Mando = RolEquipo | null;

/**
 * Qué manda AHORA en el equipo quien actúa y a quién toca, en una sola lectura.
 *
 * Los dos, y no solo el afectado. El de quien actúa venía del contexto, que se
 * resolvió al empezar la petición: si el pastor acaba de bajarle de colíder,
 * seguiría decidiendo con el mando de hace un instante.
 *
 * Con `for update`, y no es un adorno: entre esta lectura y el UPDATE que la
 * sigue, el pastor podría nombrar responsable al afectado desde otra pestaña, y
 * la action seguiría adelante con el rol viejo. Con las filas bloqueadas, quien
 * llega segundo espera y lee el que de verdad hay.
 *
 * Las dos filas en UNA consulta ordenada por `id`, y no en dos `select`: Postgres
 * bloquea después de ordenar, así que dos actions cruzadas —A toca a B mientras
 * B toca a A— piden los candados en el mismo orden y una espera a la otra. Con
 * dos lecturas sueltas cada una cogería primero su propia fila y acabarían en un
 * interbloqueo.
 */
async function mandoEnElEquipo(
  tx: Tx,
  iglesiaId: string,
  ministerioId: string,
  actor: string | null,
  afectado: string,
): Promise<{ actor: Mando; afectado: Mando }> {
  const filas = await tx
    .select({
      miembroId: ministerioMiembros.miembroId,
      rolEquipo: ministerioMiembros.rolEquipo,
    })
    .from(ministerioMiembros)
    .where(
      and(
        // La iglesia, aunque la RLS ya filtre: la RLS deja ver TODAS las
        // iglesias donde la cuenta está activa, no solo la del contexto. Ver
        // `esMinisterioDeSuIglesia` en guard-panel.ts.
        eq(ministerioMiembros.iglesiaId, iglesiaId),
        eq(ministerioMiembros.ministerioId, ministerioId),
        inArray(
          ministerioMiembros.miembroId,
          actor ? [actor, afectado] : [afectado],
        ),
        eq(ministerioMiembros.activo, true),
      ),
    )
    .orderBy(asc(ministerioMiembros.id))
    .for('update');

  const rolDe = (id: string | null): Mando =>
    filas.find((f) => f.miembroId === id)?.rolEquipo ?? null;

  return { actor: rolDe(actor), afectado: rolDe(afectado) };
}

/*
 * QUIÉN MANDA SOBRE QUIÉN DENTRO DE UN EQUIPO
 * -------------------------------------------
 * `requireGestionMinisterioAccion` contesta «puedes tocar este equipo», que no
 * es lo mismo que «puedes decidir quién lo dirige». Lo segundo lo decidió Marlon:
 *
 *   - El responsable: solo quien gobierna los ministerios lo nombra, lo quita o
 *     lo cambia de papel. Él tampoco se va por su cuenta: el relevo lo decide
 *     quien lo nombró, o el equipo se queda sin cabeza y nadie se entera.
 *   - Los colíderes: los nombra y los quita el responsable de ESE equipo, además
 *     de quien gobierna. Un colíder no: ser colíder abre el panel, y si un
 *     colíder pudiera nombrar a otro metería gente en el panel sin que el pastor
 *     lo supiera.
 *   - Los voluntarios: cualquiera que lleve el equipo, colíderes incluidos. Es el
 *     trabajo diario —quién sirve— y no abre nada a nadie.
 *
 * Bajarse uno mismo sí se deja: quitarse del equipo o dejar de ser colíder solo
 * le quita mando a quien lo pide, que es lo contrario de lo que esto vigila.
 *
 * La pantalla del ministerio repite estas reglas para no ofrecer un botón que
 * acabe en error. Si se cambia una, hay que cambiar las dos.
 */

const YA_NO_LLEVAS = 'Ya no eres responsable ni colíder de este ministerio.';

/**
 * ¿Puede quitar a esta persona del equipo? Devuelve el motivo si no.
 *
 * Solo para quien NO gobierna: a quien gobierna no se le pregunta.
 */
function motivoParaNoQuitar(
  mando: { actor: Mando; afectado: Mando },
  esElMismo: boolean,
): string | null {
  if (mando.actor !== 'responsable' && mando.actor !== 'colider') {
    return YA_NO_LLEVAS;
  }
  if (mando.afectado === 'responsable') {
    return esElMismo
      ? 'Eres el responsable de este ministerio: para dejarlo, pide al pastor que nombre el relevo.'
      : 'Solo el pastor puede quitar al responsable del ministerio.';
  }
  if (
    mando.afectado === 'colider' &&
    mando.actor !== 'responsable' &&
    !esElMismo
  ) {
    return 'Solo el responsable del ministerio o el pastor pueden quitar a un colíder.';
  }
  return null;
}

/**
 * ¿Puede cambiarle el papel a esta persona? Devuelve el motivo si no.
 *
 * Igual que la de arriba, solo para quien no gobierna. Nombrar responsable ni
 * llega: la action lo corta antes de abrir la transacción.
 */
function motivoParaNoCambiar(
  mando: { actor: Mando; afectado: Mando },
  nuevo: RolEquipo,
  esElMismo: boolean,
): string | null {
  if (mando.actor !== 'responsable' && mando.actor !== 'colider') {
    return YA_NO_LLEVAS;
  }
  if (mando.afectado === 'responsable') {
    return 'Solo el pastor puede cambiar el papel del responsable del ministerio.';
  }
  if (nuevo === 'colider' && mando.actor !== 'responsable') {
    return 'Solo el responsable del ministerio o el pastor pueden nombrar colíderes.';
  }
  if (
    mando.afectado === 'colider' &&
    mando.actor !== 'responsable' &&
    !esElMismo
  ) {
    return 'Solo el responsable del ministerio o el pastor pueden quitarle el liderazgo a un colíder.';
  }
  return null;
}

/**
 * Las herramientas marcadas.
 *
 * Fuera de Zod a propósito: `componerModulos()` descarta lo que no está en el
 * catálogo, así que un identificador inventado se ignora en vez de tumbar el
 * guardado entero con un mensaje que el pastor no puede arreglar. Un valor
 * inservible aquí no concede nada — solo no enciende nada.
 */
function modulosMarcados(formData: FormData): string[] {
  return campos(formData, 'modulos');
}

export async function crearMinisterio(formData: FormData) {
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

  const parsed = leer(formData);
  if (!parsed.success) {
    redirect(
      '/panel/ministerios/nuevo?error=' +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  let nuevoId: string;

  try {
    nuevoId = await withUser(ctx.user.id, async (tx) => {
      const [creado] = await tx
        .insert(ministerios)
        .values({
          iglesiaId: ctx.iglesia.id,
          nombre: d.nombre,
          descripcion: oNulo(d.descripcion),
          colorHex: d.colorHex,
          tipo: d.tipo,
          mision: oNulo(d.mision),
          vision: oNulo(d.vision),
          objetivo: oNulo(d.objetivo),
          // La plantilla del tipo, y solo aquí. Al editar mandan las casillas:
          // si el tipo volviera a imponerlas, cambiar «Otro» por «Alabanza» le
          // borraría al pastor lo que hubiera configurado a mano.
          modulos: componerModulos({}, modulosDelTipo(d.tipo)),
          // El responsable se asigna después, desde el detalle: para elegirlo
          // hay que tener equipo, y un ministerio recién creado no lo tiene.
          orden: 100,
        })
        .returning({ id: ministerios.id });

      return creado!.id;
    });
  } catch (err) {
    // Choca contra `uq_ministerios_iglesia_nombre`, que compara en minúsculas:
    // «Jóvenes» y «jóvenes» son el mismo equipo.
    if (isUniqueViolation(err)) {
      redirect(
        '/panel/ministerios/nuevo?error=' +
          encodeURIComponent('Ya tienes un ministerio con ese nombre.'),
      );
    }
    throw err;
  }

  revalidatePath('/panel/ministerios');
  redirect(`/panel/ministerios/${nuevoId}`);
}

export async function editarMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  // Acotado: el responsable de alabanza edita alabanza. Crear y archivar siguen
  // pidiendo el permiso global, porque son decisiones de la iglesia entera.
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const volver = `/panel/ministerios/${ministerioId}/editar?error=`;

  const parsed = EsquemaContenido.safeParse(contenidoDelFormulario(formData));
  if (!parsed.success) {
    redirect(volver + encodeURIComponent(parsed.error.issues[0]!.message));
  }

  const d = parsed.data;

  // EL TIPO Y LAS HERRAMIENTAS, SOLO QUIEN GOBIERNA. Lo pidió Marlon: los
  // módulos los enciende el pastor. El líder lleva lo de dentro de su equipo
  // —nombre, misión, foto, puestos—, pero qué herramientas tiene y de qué tipo
  // es lo decide quien decide crearlo o cerrarlo. Es la misma frontera que
  // `guardarPuestos` en turnos, que guarda la configuración del módulo y
  // conserva su `activo`.
  //
  // Por eso el tipo se valida solo si se va a guardar: al líder el formulario
  // no le pinta el selector, `tipo` no viaja, y exigirlo tumbaría el guardado
  // de una misión con un error sobre un campo que ni ha visto.
  let estructura: { tipo: string; marcados: string[] } | null = null;
  if (gobiernaLosMinisterios(ctx)) {
    const tipo = EsquemaTipo.safeParse(campoObligatorio(formData, 'tipo'));
    if (!tipo.success) {
      redirect(volver + encodeURIComponent(tipo.error.issues[0]!.message));
    }
    estructura = { tipo: tipo.data, marcados: modulosMarcados(formData) };
  }

  const contenido = {
    nombre: d.nombre,
    descripcion: oNulo(d.descripcion),
    colorHex: d.colorHex,
    mision: oNulo(d.mision),
    vision: oNulo(d.vision),
    objetivo: oNulo(d.objetivo),
  };

  const esteMinisterio = and(
    eq(ministerios.id, ministerioId),
    eq(ministerios.iglesiaId, ctx.iglesia.id),
  );

  try {
    await withUser(ctx.user.id, async (tx) => {
      // El líder acotado: `tipo` y `modulos` fuera del SET, y lo que traiga el
      // FormData para ellos se ignora sin mirarlo —el formulario que no los
      // pinta no es lo que impide mandarlos—. Una columna que el UPDATE no
      // nombra se queda como estaba en la misma sentencia, sin el hueco entre
      // leerla y reescribirla por donde se perdería un cambio del pastor.
      if (!estructura) {
        await tx.update(ministerios).set(contenido).where(esteMinisterio);
        return;
      }

      // Leer y escribir en la MISMA transacción. `componerModulos()` conserva la
      // configuración que cada módulo tuviera guardada, y para conservarla hay
      // que haberla leído: con dos `withUser()` seguidos —como todavía hacen las
      // dos actions de la foto, más abajo— un guardado simultáneo desde otra
      // pestaña se perdería entre medias.
      const [actual] = await tx
        .select({ modulos: ministerios.modulos })
        .from(ministerios)
        .where(esteMinisterio)
        .limit(1);

      await tx
        .update(ministerios)
        .set({
          ...contenido,
          tipo: estructura.tipo,
          modulos: componerModulos(actual?.modulos, estructura.marcados),
        })
        .where(esteMinisterio);
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(
        `/panel/ministerios/${ministerioId}/editar?error=` +
          encodeURIComponent('Ya tienes otro ministerio con ese nombre.'),
      );
    }
    throw err;
  }

  revalidatePath('/panel/ministerios');
  redirect(`/panel/ministerios/${ministerioId}`);
}

export async function asignarAlMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  const ids = z
    .array(z.string().uuid())
    .safeParse(campos(formData, 'miembros'));

  if (!ids.success || ids.data.length === 0) {
    redirect(`/panel/ministerios/${ministerioId}`);
  }

  // Sin repetidos: el mismo id dos veces en el FormData serían dos INSERT de la
  // misma persona, y el segundo choca contra `uq_ministerio_miembro_activo`.
  const pedidos = [...new Set(ids.data)];

  try {
    await withUser(ctx.user.id, async (tx) => {
      // Solo fichas vivas de ESTA iglesia. El diálogo ya no ofrece a nadie dado
      // de baja, pero una action es un endpoint: desde que liderar abre el
      // panel, sumar a una ficha de baja y nombrarla colíder le devolvía la
      // entrada a alguien a quien el pastor había sacado. Y la iglesia porque la
      // RLS deja ver todas aquellas donde la cuenta está activa.
      const vivas = await tx
        .select({ id: miembros.id })
        .from(miembros)
        .where(
          and(
            eq(miembros.iglesiaId, ctx.iglesia.id),
            inArray(miembros.id, pedidos),
            isNull(miembros.archivadoAt),
            ne(miembros.estado, 'baja'),
          ),
        );
      const validos = vivas.map((v) => v.id);
      if (validos.length === 0) return;

      // Quien ya estuvo y salió tiene una fila con `activo = false`. Se reactiva
      // en vez de insertar otra: así el histórico no se llena de duplicados y el
      // índice único parcial sigue teniendo sentido.
      //
      // La más reciente primero, para que de quien entró y salió varias veces
      // se reactive su última etapa y no una cualquiera.
      const previos = await tx
        .select({
          id: ministerioMiembros.id,
          miembroId: ministerioMiembros.miembroId,
          activo: ministerioMiembros.activo,
        })
        .from(ministerioMiembros)
        .where(
          and(
            eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
            eq(ministerioMiembros.ministerioId, ministerioId),
            inArray(ministerioMiembros.miembroId, validos),
          ),
        )
        .orderBy(
          desc(ministerioMiembros.createdAt),
          desc(ministerioMiembros.id),
        );

      // QUIEN YA ESTÁ DENTRO NO SE TOCA. Aquí se reactivaban todas las filas de
      // la persona, también la activa, y con ella se le ponía 'voluntario' y
      // `desde = hoy`: un colíder degradaba al responsable con solo mandar su
      // id en este formulario, que no pasa por las reglas de quién manda sobre
      // quién. Asignar es sumar gente; el mando se cambia en
      // `cambiarRolEnEquipo`, que sí las aplica.
      //
      // Siguen contando como «ya con fila» para no insertarlos otra vez.
      const dentro = new Set(
        previos.filter((p) => p.activo).map((p) => p.miembroId),
      );

      // Una sola fila por persona. Con dos inactivas —entró y salió dos veces—
      // reactivarlas las dos la pondría dos veces en el equipo, y el índice
      // único tumbaría el guardado entero.
      const aReactivar = new Map<string, string>();
      for (const p of previos) {
        if (dentro.has(p.miembroId) || aReactivar.has(p.miembroId)) continue;
        aReactivar.set(p.miembroId, p.id);
      }

      const hoy = new Date().toISOString().slice(0, 10);

      if (aReactivar.size > 0) {
        await tx
          .update(ministerioMiembros)
          // `rolEquipo` vuelve a 'voluntario', y no es un detalle: si esta
          // persona fue responsable, salió, y mientras tanto se nombró a otra,
          // reactivar su fila tal cual chocaría contra
          // `uq_ministerio_responsable_activo` con un 23505 en la cara de quien
          // solo pulsó «Asignar miembros».
          //
          // Quien vuelve, vuelve como uno más. Si tiene que volver a mandar, se
          // le nombra a propósito.
          .set({ activo: true, desde: hoy, hasta: null, rolEquipo: 'voluntario' })
          .where(
            and(
              inArray(ministerioMiembros.id, [...aReactivar.values()]),
              // Redundante con el filtro de arriba, y a propósito: es lo que
              // impide que este UPDATE vuelva a pisar a alguien que está dentro.
              eq(ministerioMiembros.activo, false),
            ),
          );
      }

      const conFila = new Set(previos.map((p) => p.miembroId));
      const nuevos = validos.filter((id) => !conFila.has(id));

      if (nuevos.length > 0) {
        await tx.insert(ministerioMiembros).values(
          nuevos.map((miembroId) => ({
            iglesiaId: ctx.iglesia.id,
            ministerioId,
            miembroId,
            desde: hoy,
          })),
        );
      }
    });
  } catch (err) {
    // Dos personas sumando a la misma gente a la vez: las dos leen «no está» y
    // la segunda en escribir choca contra `uq_ministerio_miembro_activo`.
    if (isUniqueViolation(err)) {
      redirect(
        `/panel/ministerios/${ministerioId}?error=` +
          encodeURIComponent(
            'Alguien acaba de sumar a una de esas personas. Recarga la página y vuelve a intentarlo.',
          ),
      );
    }
    throw err;
  }

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  redirect(`/panel/ministerios/${ministerioId}`);
}

export async function quitarDelMinisterio(
  ministerioId: string,
  miembroId: string,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `/panel/ministerios/${ministerioId}`;
  const gobierna = gobiernaLosMinisterios(ctx);

  const error = await withUser(ctx.user.id, async (tx) => {
    // El mando se lee aquí dentro, en la misma transacción que el UPDATE: el
    // que traía la pantalla puede ser de antes de que el pastor nombrara a esta
    // persona, o de antes de que bajara de colíder a quien pulsa.
    const mando = await mandoEnElEquipo(
      tx,
      ctx.iglesia.id,
      ministerioId,
      ctx.miembroId,
      miembroId,
    );

    // Ya no estaba: alguien la quitó desde otra pestaña, o es un doble clic. Lo
    // que se pedía ya es verdad, y contestarlo con un error sería mentir.
    if (!mando.afectado) return null;

    if (!gobierna) {
      const motivo = motivoParaNoQuitar(mando, miembroId === ctx.miembroId);
      if (motivo) return motivo;
    }

    // Se desactiva, no se borra: que alguien sirvió en alabanza tres años es
    // justo lo que un pastor quiere poder mirar dentro de dos.
    //
    // Y aquí había un segundo UPDATE que limpiaba `ministerios.lider_miembro_id`
    // si esta persona era la responsable. Ya no hace falta: al poner
    // `activo = false` la fila sale del predicado del índice parcial, así que
    // deja de ser la responsable en la misma sentencia. Es la simplificación que
    // compró mudar el liderazgo a esta tabla.
    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      );
    return null;
  });

  if (error) {
    redirect(`${destino}?error=` + encodeURIComponent(error));
  }

  revalidatePath(destino);
  // El listado pinta al responsable de cada equipo, y quitarlo lo cambia.
  revalidatePath('/panel/ministerios');
  redirect(destino);
}

const EsquemaRolEquipo = z.object({
  rolEquipo: z.enum(['responsable', 'colider', 'voluntario']),
});

/**
 * Cambiar qué manda alguien dentro de un equipo.
 *
 * DOS GUARDS Y NO UNO. `requireGestionMinisterioAccion` contesta «puedes tocar
 * este ministerio», que no es lo mismo que «puedes decidir quién lo dirige».
 * Nombrar responsable se queda en el pastor y en quien tenga el permiso global:
 * al responsable se le deja traer colíderes, no traspasar el mando y salir por
 * la puerta. Las reglas enteras, encima de `motivoParaNoQuitar`.
 *
 * Y se mira el rol de ORIGEN además del de destino. Mirar solo el de destino
 * dejaba a un colíder convertir al responsable en voluntario, que es deponerlo
 * sin nombrar a nadie.
 */
export async function cambiarRolEnEquipo(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `/panel/ministerios/${ministerioId}`;
  const gobierna = gobiernaLosMinisterios(ctx);

  const parsed = EsquemaRolEquipo.safeParse({
    rolEquipo: campoObligatorio(formData, 'rolEquipo'),
  });
  if (!parsed.success) {
    redirect(`${destino}?error=` + encodeURIComponent('Ese rol no existe.'));
  }

  const nuevo = parsed.data.rolEquipo;

  if (nuevo === 'responsable' && !gobierna) {
    redirect(
      `${destino}?error=` +
        encodeURIComponent(
          'Solo el pastor puede decidir quién es el responsable de un ministerio.',
        ),
    );
  }

  const esElMismo = miembroId === ctx.miembroId;
  let error: string | null;

  try {
    error = await withUser(ctx.user.id, async (tx) => {
      // El rol de ORIGEN, y el de quien pulsa, se leen dentro de la transacción
      // y con las filas bloqueadas: los que traía la pantalla pueden ser de antes
      // de que el pastor nombrara a esta persona o bajara a quien pulsa.
      const mando = await mandoEnElEquipo(
        tx,
        ctx.iglesia.id,
        ministerioId,
        ctx.miembroId,
        miembroId,
      );

      // Comprobarlo no es un adorno. Con `nuevo = 'responsable'`, el UPDATE de
      // abajo degrada primero al responsable actual y después asciende a esta
      // persona; si ya no está en el equipo, el segundo no toca ninguna fila y
      // el ministerio se queda sin responsable sin que nadie lo haya pedido.
      if (!mando.afectado) {
        return 'Esa persona ya no está en el equipo. Recarga la página.';
      }

      // Ya tiene ese papel: doble clic, u otra pestaña que llegó antes.
      if (mando.afectado === nuevo) return null;

      if (!gobierna) {
        const motivo = motivoParaNoCambiar(mando, nuevo, esElMismo);
        if (motivo) return motivo;
      }

      // Lo que HT104 rechazaría, contado antes y con el motivo de verdad. El
      // guard solo deja pasar al pastor, así que esto alcanza a quien gobierna
      // los ministerios con el permiso y sin ser pastor.
      if (!esPastor(ctx)) {
        if (esElMismo && nuevo !== 'voluntario') {
          return 'No puedes nombrarte líder a ti mismo.';
        }
        // Siendo él el responsable, nombrar a otro le bajaría a colíder en su
        // propia fila, y para HT104 eso es nombrarse colíder a sí mismo. Sin
        // esto le llegaría «no puedes nombrarte líder», que no es lo que pidió.
        if (nuevo === 'responsable' && mando.actor === 'responsable') {
          return 'El relevo de tu propio puesto de responsable tiene que hacerlo el pastor.';
        }
      }

      // Degradar al anterior ANTES de ascender al nuevo. En el otro orden hay un
      // instante con dos responsables activos y el índice único aborta la
      // transacción entera.
      if (nuevo === 'responsable') {
        await tx
          .update(ministerioMiembros)
          .set({ rolEquipo: 'colider' })
          .where(
            and(
              eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
              eq(ministerioMiembros.ministerioId, ministerioId),
              eq(ministerioMiembros.rolEquipo, 'responsable'),
              eq(ministerioMiembros.activo, true),
            ),
          );
      }

      await tx
        .update(ministerioMiembros)
        .set({ rolEquipo: nuevo })
        .where(
          and(
            eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
            eq(ministerioMiembros.ministerioId, ministerioId),
            eq(ministerioMiembros.miembroId, miembroId),
            eq(ministerioMiembros.activo, true),
          ),
        );
      return null;
    });
  } catch (err) {
    // Dos personas nombrando responsable a la vez desde dos pestañas.
    if (isUniqueViolation(err)) {
      redirect(
        `${destino}?error=` +
          encodeURIComponent(
            'Ese ministerio ya tiene responsable. Recarga la página y vuelve a intentarlo.',
          ),
      );
    }
    // HT104: el guard de la base de datos. Los dos casos que conoce ya se cortan
    // arriba con su motivo; esto queda de red por si el guard crece y la action
    // no se entera.
    if (esGuardHatril(err, 'HT104')) {
      redirect(
        `${destino}?error=` +
          encodeURIComponent('No puedes nombrarte líder a ti mismo.'),
      );
    }
    throw err;
  }

  if (error) {
    redirect(`${destino}?error=` + encodeURIComponent(error));
  }

  revalidatePath(destino);
  revalidatePath('/panel/ministerios');
  redirect(destino);
}

/**
 * La foto del ministerio para la web pública.
 *
 * La puede cambiar quien lleve ese ministerio, no solo el pastor: es la foto de
 * su propio equipo. Va al mismo bucket que el logo de la iglesia —público, por
 * la misma razón: sale en la web.
 */
export async function guardarFotoMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `/panel/ministerios/${ministerioId}`;

  const fichero = formData.get('foto');
  if (!(fichero instanceof File)) {
    redirect(`${destino}?error=` + encodeURIComponent('No has elegido ninguna imagen.'));
  }

  const resultado = await subirImagenIglesia(
    ctx.iglesia.id,
    'foto',
    fichero,
    `ministerio-${ministerioId.slice(0, 8)}-${Date.now().toString(36)}`,
  );

  if (!resultado.ok) {
    redirect(`${destino}?error=` + encodeURIComponent(resultado.error));
  }

  const [previa] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: ministerios.fotoUrl })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ministerios)
      .set({ fotoUrl: resultado.url })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  await borrarImagenAnterior(previa?.url ?? null);

  revalidatePath(destino);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${destino}?guardado=foto`);
}

/** Quitar la foto del ministerio. */
export async function quitarFotoMinisterio(ministerioId: string) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  const [previa] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: ministerios.fotoUrl })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ministerios)
      .set({ fotoUrl: null })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  await borrarImagenAnterior(previa?.url ?? null);

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`/panel/ministerios/${ministerioId}?guardado=foto-quitada`);
}

export async function archivarMinisterio(ministerioId: string) {
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

  await withUser(ctx.user.id, async (tx) => {
    await tx
      .update(ministerios)
      .set({ activo: false })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      );

    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      );
  });

  revalidatePath('/panel/ministerios');
  redirect('/panel/ministerios');
}
