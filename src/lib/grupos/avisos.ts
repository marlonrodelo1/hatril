import 'server-only';

import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import {
  cuentaDeMiembro,
  cuentasQueLlevanElGrupo,
  emitirNotificaciones,
} from '@/lib/notificaciones/emitir';

type Aviso = Parameters<typeof emitirNotificaciones>[0][number];

/**
 * Los avisos de que alguien ha entrado en una célula (23-nov).
 *
 * A quien la lleva, uno por cada vez que entra gente y no uno por persona:
 * «Lucía ha entrado en Los Pinos», o «3 personas han entrado…» cuando la red
 * suma a varias de golpe. Es lo que cierra el círculo de la invitación: el
 * líder compartió el enlace y se entera de que alguien llegó.
 *
 * Y a quien sumó la red sin que lo pidiera, el suyo: desde ese momento quien
 * lleva la célula ve su teléfono, así que se le dice, y que puede salir desde
 * Mi cuenta. Quien entró por el enlace ya lo leyó en `/solicitar`.
 *
 * Siempre después de la transacción y fuera de ella, como todos los avisos:
 * dentro avisaría también de lo que luego se deshizo.
 */
export async function avisarDeEntrada(entrada: {
  iglesiaId: string;
  ministerioId: string;
  grupoId: string;
  /** El nombre de la célula, tal como lo ve quien la lleva. */
  grupo: string;
  /** Quién ha entrado. */
  personas: { miembroId: string; nombre: string }[];
  /** La cuenta que lo ha hecho: a ella no se le avisa de lo suyo. */
  provocadoPor: string;
  /** La sumó la red sin que ella lo pidiera: se le avisa también. */
  sumadasPorLaRed: boolean;
}): Promise<void> {
  const { iglesiaId, ministerioId, grupoId, grupo, personas, provocadoPor } = entrada;
  if (personas.length === 0) return;

  const lideres = await cuentasQueLlevanElGrupo(iglesiaId, grupoId);
  const datos: Record<string, string> =
    personas.length === 1
      ? { quien: personas[0]!.nombre, grupo }
      : { cuantos: String(personas.length), grupo };

  const avisos: Aviso[] = lideres.map((destinatario) => ({
    iglesiaId,
    destinatarioAuthUserId: destinatario,
    tipo: 'grupo_nuevo_integrante',
    datos,
    enlace: rutaApp(ministerioId, 'grupos', grupoId),
    provocadoPor,
  }));

  if (entrada.sumadasPorLaRed) {
    const cuentas = await Promise.all(personas.map((p) => cuentaDeMiembro(iglesiaId, p.miembroId)));
    for (const cuenta of cuentas) {
      avisos.push({
        iglesiaId,
        destinatarioAuthUserId: cuenta,
        tipo: 'grupo_incorporado',
        datos: { grupo },
        enlace: '/mi/cuenta',
        provocadoPor,
      });
    }
  }

  await emitirNotificaciones(avisos);
}
