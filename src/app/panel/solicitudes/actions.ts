'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { ambitoMiembros, esPastor } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import {
  asistencias,
  consentimientos,
  iglesiaUsuarios,
  miembros,
  seguimientoAsignaciones,
  seguimientoContactos,
  solicitudesIngreso,
} from '@/lib/db/schema';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { campo } from '@/lib/api/formulario';
import {
  condicionFichaEnlazable,
  motivosDeCoincidencia,
} from '@/lib/solicitudes/consultas';
import {
  cerrarAvisosDeSolicitud,
  emitirNotificacion,
} from '@/lib/notificaciones/emitir';

/**
 * Aprobar o rechazar quien pide entrar en la iglesia.
 *
 * Es la puerta de la congregación: quien apruebe aquí pasa a ver el contenido
 * interno. Por eso va con el permiso `aprobar_solicitudes`, que el pastor
 * reparte a conciencia, y no con el genérico de pertenecer a la iglesia.
 *
 * HOY SOLO LAS RESUELVE EL PASTOR, Y ES UNA DEUDA
 * -----------------------------------------------
 * Las dos acciones escriben en `iglesia_usuarios` —activar la membresía o
 * borrar la pendiente—, y esa tabla solo admite UPDATE y DELETE del pastor
 * (`es_pastor()` en las policies de la 0001). La secretaria tiene
 * `aprobar_solicitudes` por defecto, así que veía los botones y la base le
 * cortaba lo que el permiso le prometía: al aprobar, un error después de
 * pulsar; al rechazar, peor, porque el DELETE filtrado no da error y la
 * solicitud se cerraba con la membresía pendiente todavía viva.
 *
 * Arreglarlo de verdad es una migración aparte —una función que active o
 * borre SOLO membresías pendientes, para que abrir esto a otros roles no les
 * dé también cambiar roles o expulsar a nadie—. Mientras no exista, se dice la
 * verdad: la pantalla no ofrece los botones y las acciones paran aquí, antes
 * de escribir nada. El permiso se queda como está porque sigue sirviendo para
 * VER la bandeja.
 */

function volverCon(error: string): never {
  redirect('/panel/solicitudes?error=' + encodeURIComponent(error));
}

const SOLO_EL_PASTOR =
  'Hoy las aprueba el pastor. Si alguien lleva tiempo esperando, avísale.';

/**
 * `ficha`: con qué ficha se queda la cuenta. `'nueva'` o ausente, se crea una
 * como siempre; un uuid, se enlaza con esa ficha del fichero.
 *
 * Ausente vale lo mismo que `'nueva'` porque sin sugerencias el formulario no
 * pinta la elección, y ahí aprobar tiene que seguir siendo un solo botón.
 */
const EsquemaAprobacion = z.object({
  solicitudId: z.string().uuid(),
  ficha: z.union([z.literal('nueva'), z.string().uuid()]).optional(),
});

/**
 * Salida de la transacción para deshacerla entera. Se lanza y se recoge fuera
 * porque `redirect()` dentro también lanza, y `withUser` lo tomaría por un
 * fallo cualquiera.
 */
class AprobacionDeshecha extends Error {}
class RechazoDeshecho extends Error {}

/**
 * Aprobar es activar la cuenta y darle una ficha: una nueva, o la que el pastor
 * ya tenía en el fichero. Lo segundo es lo que hace que el colíder apuntado hace
 * años entre viendo sus ministerios, en vez de con una ficha vacía y un
 * duplicado en el fichero.
 */
export async function aprobarSolicitud(
  solicitudId: string,
  formData: FormData,
) {
  const ctx = await requirePermisoAccion(
    'aprobar_solicitudes',
    '/panel/solicitudes',
  );

  // Ver la cabecera del fichero. Antes de leer el formulario y antes de abrir
  // la transacción: que no llegue a escribirse ni la ficha.
  if (!esPastor(ctx)) volverCon(SOLO_EL_PASTOR);

  const parsed = EsquemaAprobacion.safeParse({
    solicitudId,
    ficha: campo(formData, 'ficha'),
  });

  if (!parsed.success) {
    // El id de la solicitud lo pone el `bind` del servidor: si no es válido,
    // nadie lo ha tecleado y no hay nada que contarle a quien pulsa.
    if (!z.string().uuid().safeParse(solicitudId).success) {
      redirect('/panel/solicitudes');
    }
    volverCon('No reconocemos la ficha elegida. Vuelve a elegir y aprueba.');
  }

  const enlazarCon =
    parsed.data.ficha && parsed.data.ficha !== 'nueva'
      ? parsed.data.ficha
      : null;

  // La pantalla no le ofrece la elección a quien no ve la congregación entera
  // (`sugerirFichas`). Se repite aquí porque la pantalla no es la frontera: un
  // POST se fabrica sin ella, y enlazar a ciegas es elegir entre fichas que no
  // puede ver. Con solo el pastor aprobando no salta nunca; se queda para el
  // día que se cierre la deuda de arriba.
  if (enlazarCon && ambitoMiembros(ctx).tipo !== 'iglesia') {
    volverCon(
      'Para unir la solicitud con una ficha que ya existe hace falta ver la congregación entera.',
    );
  }

  // La transacción devuelve a quién hay que avisar. El aviso se emite DESPUÉS y
  // fuera: va por `dbAdmin` —la tabla no acepta escrituras de una sesión— y
  // meterlo dentro ataría la aprobación al éxito de una notificación.
  let resultado:
    | { tipo: 'aprobada'; avisarA: string }
    | { tipo: 'ya_resuelta' }
    | { tipo: 'ficha_no_vale' };

  try {
    resultado = await withUser(ctx.user.id, async (tx) => {
      const [solicitud] = await tx
        .select({
          id: solicitudesIngreso.id,
          authUserId: solicitudesIngreso.authUserId,
          nombre: solicitudesIngreso.nombre,
          email: solicitudesIngreso.email,
          telefono: solicitudesIngreso.telefono,
          aceptaAsistencia: solicitudesIngreso.aceptaAsistencia,
          versionTexto: solicitudesIngreso.versionTexto,
        })
        .from(solicitudesIngreso)
        .where(
          and(
            eq(solicitudesIngreso.id, solicitudId),
            eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
            eq(solicitudesIngreso.estado, 'pendiente'),
          ),
        )
        .limit(1)
        // Dos personas del equipo aprobando a la vez: sin el bloqueo, las dos
        // leen «pendiente» y la segunda crea otra ficha, o choca al enlazar y
        // recibe un error que no es suyo. Con él, la segunda espera, ya no la
        // ve pendiente y se va sin hacer nada.
        .for('update');

      // Ya la resolvió otra persona del equipo entre que se cargó la pantalla y
      // se pulsó el botón. No es un error: simplemente no hay nada que hacer.
      if (!solicitud) return { tipo: 'ya_resuelta' } as const;

      let fichaId: string;

      if (enlazarCon) {
        // Todo se vuelve a comprobar aquí, dentro de la transacción y con la
        // fila bloqueada: que es de esta iglesia, que sigue sin cuenta y sin
        // baja, y que coincide con la solicitud. Lo que se vio en la pantalla
        // puede haber cambiado —otra solicitud enlazó esta misma ficha, alguien
        // le cambió el correo—, y el id viaja en un formulario.
        //
        // Coincidir NO prueba que sea la misma persona: el correo de la cuenta
        // no está verificado y el teléfono lo teclea quien solicita. Esto solo
        // impide enlazar con una ficha que ni se le parece; quién es de verdad
        // lo comprueba en persona quien aprueba, y la pantalla se lo pide.
        const [ficha] = await tx
          .select({
            id: miembros.id,
            email: miembros.email,
            telefono: miembros.telefono,
          })
          .from(miembros)
          .where(
            and(
              eq(miembros.id, enlazarCon),
              condicionFichaEnlazable(ctx.iglesia.id),
            ),
          )
          .limit(1)
          .for('update');

        if (
          !ficha ||
          motivosDeCoincidencia(solicitud, ficha, ctx.iglesia.pais).length ===
            0
        ) {
          // Nada escrito todavía: devolver en vez de lanzar no deja nada a
          // medias.
          return { tipo: 'ficha_no_vale' } as const;
        }

        // Solo la cuenta y, si faltaba, el correo. El estado, los ministerios
        // y lo demás son la historia de esta persona en la iglesia, que es
        // justo lo que se quiere conservar al enlazar en vez de crear.
        await tx
          .update(miembros)
          .set({
            authUserId: solicitud.authUserId,
            ...(!ficha.email?.trim() && solicitud.email
              ? { email: solicitud.email }
              : {}),
          })
          .where(eq(miembros.id, ficha.id));

        fichaId = ficha.id;
      } else {
        // La ficha se crea al aprobar, no al solicitar. Mientras la solicitud
        // está pendiente, esa persona NO forma parte del fichero de la
        // congregación: si se creara antes, una solicitud rechazada dejaría una
        // ficha huérfana con los datos de alguien que nunca entró.
        const [ficha] = await tx
          .insert(miembros)
          .values({
            iglesiaId: ctx.iglesia.id,
            authUserId: solicitud.authUserId,
            nombre: solicitud.nombre,
            email: solicitud.email,
            telefono: solicitud.telefono,
            estado: 'nuevo',
            fechaIngreso: new Date().toISOString().slice(0, 10),
          })
          .returning({ id: miembros.id });

        fichaId = ficha!.id;
      }

      // LOS CONSENTIMIENTOS: LO QUE MARCÓ AL SOLICITAR, CON SU VERSIÓN
      // ---------------------------------------------------------------
      // Se registran ahora porque hasta este momento no había ficha a la que
      // colgarlos, pero la decisión y el texto son los de la solicitud. Con la
      // versión de entonces y no la vigente: si la política ha cambiado entre
      // medias, la ficha queda con una versión vieja y `/acepta` se lo vuelve a
      // preguntar al entrar, que es lo que tiene que pasar.
      //
      // Lo que NO puede pasar es registrar la versión vigente sin saber qué
      // dijo de la asistencia: `miembrosSinPermisoDeAsistencia` lee esa
      // combinación como un «no», y era el fallo que dejaba fuera de las
      // listas a todo aprobado. Por eso una solicitud sin respuesta —anterior
      // a la casilla— solo se registra si su versión ya no es la vigente, y
      // una sin versión no registra nada: la ficha queda como las que teclea
      // el pastor, cubierta por la base de la propia iglesia (art. 9.2.d).
      const version = solicitud.versionTexto;
      const registrar =
        version !== null &&
        (solicitud.aceptaAsistencia !== null ||
          version !== VERSION_POLITICA_PRIVACIDAD);

      if (registrar) {
        const ahora = new Date();

        // `uq_consentimiento_vivo` admite uno vivo por ficha y tipo. Una ficha
        // nueva no trae ninguno y una tecleada por el pastor tampoco, pero si
        // la enlazada lo trajera —de una cuenta anterior—, el insert chocaría.
        // Se revoca y se vuelve a insertar, como en `/acepta`: la prueba del
        // anterior se conserva.
        await tx
          .update(consentimientos)
          .set({ revocadoAt: ahora })
          .where(
            and(
              eq(consentimientos.iglesiaId, ctx.iglesia.id),
              eq(consentimientos.miembroId, fichaId),
              eq(consentimientos.tipo, 'datos_religiosos'),
              isNull(consentimientos.revocadoAt),
            ),
          );

        await tx.insert(consentimientos).values({
          iglesiaId: ctx.iglesia.id,
          miembroId: fichaId,
          tipo: 'datos_religiosos',
          versionTexto: version,
        });

        if (solicitud.aceptaAsistencia === true) {
          // Si la ficha enlazada ya lo tenía vivo, se deja: la persona dice lo
          // mismo, y revocar para volver a insertar solo movería la fecha de
          // un permiso que nunca dejó de tener.
          const [vivo] = await tx
            .select({ id: consentimientos.id })
            .from(consentimientos)
            .where(
              and(
                eq(consentimientos.iglesiaId, ctx.iglesia.id),
                eq(consentimientos.miembroId, fichaId),
                eq(consentimientos.tipo, 'asistencia_y_seguimiento'),
                isNull(consentimientos.revocadoAt),
              ),
            )
            .limit(1);

          if (!vivo) {
            await tx.insert(consentimientos).values({
              iglesiaId: ctx.iglesia.id,
              miembroId: fichaId,
              tipo: 'asistencia_y_seguimiento',
              versionTexto: version,
            });
          }
        } else if (solicitud.aceptaAsistencia === false) {
          // DIJO QUE NO: SE RETIRA, Y SE BORRA LO APUNTADO, COMO EN `/acepta`
          // ----------------------------------------------------------------
          // Su última decisión es esta, aunque la ficha enlazada trajera el
          // permiso de una cuenta anterior. Y se borra lo que la ficha tuviera
          // en asistencia y seguimiento por lo mismo que allí: dejarlo
          // contaría en los recuentos de alguien que ya no sale en las listas
          // («7 de 9» con ocho nombres), y seguir enseñándolo es seguir
          // tratándolo. `/solicitar` se lo dice junto a la casilla, y la
          // bandeja se lo dice a quien elige enlazar.
          //
          // Es copia de `/acepta` y no una función compartida porque esa
          // action es de otra pieza; si cambia una, hay que cambiar la otra.
          // En una ficha nueva no hay nada que borrar, y ni se intenta.
          await tx
            .update(consentimientos)
            .set({ revocadoAt: ahora })
            .where(
              and(
                eq(consentimientos.iglesiaId, ctx.iglesia.id),
                eq(consentimientos.miembroId, fichaId),
                eq(consentimientos.tipo, 'asistencia_y_seguimiento'),
                isNull(consentimientos.revocadoAt),
              ),
            );

          if (enlazarCon) {
            await tx
              .delete(asistencias)
              .where(
                and(
                  eq(asistencias.iglesiaId, ctx.iglesia.id),
                  eq(asistencias.miembroId, fichaId),
                ),
              );

            await tx
              .delete(seguimientoContactos)
              .where(
                and(
                  eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
                  eq(seguimientoContactos.miembroId, fichaId),
                ),
              );

            await tx
              .delete(seguimientoAsignaciones)
              .where(
                and(
                  eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
                  eq(seguimientoAsignaciones.miembroId, fichaId),
                ),
              );
          }
        }
      }

      const activada = await tx
        .update(iglesiaUsuarios)
        .set({
          estado: 'activo',
          miembroId: fichaId,
          aprobadoPor: ctx.user.id,
          aprobadoAt: new Date(),
        })
        .where(
          and(
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
            eq(iglesiaUsuarios.authUserId, solicitud.authUserId),
          ),
        )
        .returning({ id: iglesiaUsuarios.id });

      // Si la membresía no se tocó, la persona se quedaría en «pendiente» con
      // la solicitud ya cerrada: fuera de la bandeja y sin poder entrar. Y al
      // enlazar sería peor, porque la ficha quedaría atada a una cuenta que no
      // ve nada. La RLS no da error al filtrar un UPDATE, devuelve cero filas:
      // por eso se cuentan, y con cero se deshace todo.
      if (activada.length === 0) throw new AprobacionDeshecha();

      await tx
        .update(solicitudesIngreso)
        .set({
          estado: 'aprobada',
          revisadoPor: ctx.user.id,
          revisadoAt: new Date(),
        })
        .where(eq(solicitudesIngreso.id, solicitud.id));

      return { tipo: 'aprobada', avisarA: solicitud.authUserId } as const;
    });
  } catch (err) {
    if (err instanceof AprobacionDeshecha) {
      // Con el pastor como único que llega aquí, la RLS ya no es la causa: es
      // una solicitud pendiente sin su membresía pendiente, que `/solicitar`
      // crea juntas. No es algo que quien aprueba pueda arreglar.
      volverCon(
        'No se ha podido activar la cuenta de esta persona, así que no se ha aprobado nada. Escríbenos a hola@hatril.app y lo miramos.',
      );
    }
    throw err;
  }

  if (resultado.tipo === 'ficha_no_vale') {
    volverCon(
      'Esa ficha ya no se puede unir a esta solicitud: tiene cuenta, está de baja o ya no coincide. Vuelve a elegir.',
    );
  }

  const avisarA = resultado.tipo === 'aprobada' ? resultado.avisarA : null;

  // Al resolverla, el «ha llegado una solicitud» que recibió el resto del equipo
  // deja de tener sentido: se da por leído solo.
  await cerrarAvisosDeSolicitud(ctx.iglesia.id, solicitudId);

  await emitirNotificacion({
    iglesiaId: ctx.iglesia.id,
    destinatarioAuthUserId: avisarA,
    tipo: 'solicitud_aprobada',
    datos: { iglesia: ctx.iglesia.nombre },
    enlace: '/mi/comunidad',
  });

  revalidatePath('/panel/solicitudes');
  revalidatePath('/panel/miembros');
  redirect('/panel/solicitudes');
}

const EsquemaRechazo = z.object({
  solicitudId: z.string().uuid(),
  motivo: z.string().trim().max(300).optional().or(z.literal('')),
});

export async function rechazarSolicitud(
  solicitudId: string,
  formData: FormData,
) {
  const ctx = await requirePermisoAccion(
    'aprobar_solicitudes',
    '/panel/solicitudes',
  );

  // Ver la cabecera del fichero: el DELETE de la membresía pendiente es del
  // pastor y de nadie más.
  if (!esPastor(ctx)) volverCon(SOLO_EL_PASTOR);

  const parsed = EsquemaRechazo.safeParse({
    solicitudId,
    motivo: campo(formData, 'motivo'),
  });

  if (!parsed.success) redirect('/panel/solicitudes');

  let avisarA: string | null;

  try {
    avisarA = await withUser(ctx.user.id, async (tx) => {
      const [solicitud] = await tx
        .select({ authUserId: solicitudesIngreso.authUserId })
        .from(solicitudesIngreso)
        .where(
          and(
            eq(solicitudesIngreso.id, solicitudId),
            eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
            eq(solicitudesIngreso.estado, 'pendiente'),
          ),
        )
        .limit(1)
        // Lo mismo que al aprobar: sin el bloqueo, un rechazo y una aprobación
        // a la vez leen las dos «pendiente», y la solicitud acaba rechazada
        // con la persona ya dentro, o aprobada con su membresía borrada.
        .for('update');

      if (!solicitud) return null;

      // `estado = 'pendiente'` otra vez aunque el bloqueo ya lo garantice: si
      // algún día se quita el `for update`, esto no puede pasar a reescribir
      // una solicitud que ya resolvió otra persona.
      await tx
        .update(solicitudesIngreso)
        .set({
          estado: 'rechazada',
          motivoRechazo: parsed.data.motivo || null,
          revisadoPor: ctx.user.id,
          revisadoAt: new Date(),
        })
        .where(
          and(
            eq(solicitudesIngreso.id, solicitudId),
            eq(solicitudesIngreso.estado, 'pendiente'),
          ),
        );

      /*
       * La membresía se BORRA, no se marca como rechazada.
       *
       * El enum tiene un valor 'rechazado' y aun así se borra la fila, porque el
       * unique `(iglesia_id, auth_user_id)` impediría volver a solicitar para
       * siempre. Y eso no vale: un rechazo suele ser «no te conocemos todavía» o
       * un malentendido, no una expulsión.
       *
       * El rastro no se pierde: la solicitud rechazada se queda con su motivo y
       * su fecha, que es donde un pastor lo va a buscar.
       */
      const borrada = await tx
        .delete(iglesiaUsuarios)
        .where(
          and(
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
            eq(iglesiaUsuarios.authUserId, solicitud.authUserId),
            eq(iglesiaUsuarios.estado, 'pendiente'),
          ),
        )
        .returning({ id: iglesiaUsuarios.id });

      // Cero filas es lo que devuelve la RLS al filtrar un DELETE, sin error.
      // Seguir dejaría la solicitud rechazada y la membresía pendiente viva:
      // la persona no podría volver a pedir entrar, porque choca con el unique
      // de membresía. Se deshace entero, como al aprobar.
      if (borrada.length === 0) throw new RechazoDeshecho();

      return solicitud.authUserId;
    });
  } catch (err) {
    if (err instanceof RechazoDeshecho) {
      volverCon(
        'No se ha podido cerrar la petición de esta persona, así que no se ha rechazado nada. Escríbenos a hola@hatril.app y lo miramos.',
      );
    }
    throw err;
  }

  // Se le dice, con el motivo si lo hubo. Dejar a alguien esperando para siempre
  // una respuesta que ya se ha tomado es lo que hacía esta pantalla antes de
  // tener a dónde escribirle.
  await cerrarAvisosDeSolicitud(ctx.iglesia.id, solicitudId);

  await emitirNotificacion({
    iglesiaId: ctx.iglesia.id,
    destinatarioAuthUserId: avisarA,
    tipo: 'solicitud_rechazada',
    datos: {
      iglesia: ctx.iglesia.nombre,
      ...(parsed.data.motivo ? { motivo: parsed.data.motivo } : {}),
    },
    enlace: '/iglesias',
  });

  revalidatePath('/panel/solicitudes');
  redirect('/panel/solicitudes');
}
