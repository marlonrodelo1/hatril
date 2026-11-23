import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';
import { ensayoAntesDelTurno } from '@/lib/agenda/ensayos';
import { cancionesDelTurno } from '@/lib/repertorio/consultas';
import { turnoParaMiembro } from '@/lib/turnos/consultas';

/**
 * Lo que consulta la ficha del turno de un miembro, o `null` si el turno no
 * es de su equipo. Lo usan la página de la web y la API de la app
 * (`/api/v1/app/mi/agenda/turno/[id]`). Salió de `./page.tsx` el 20-nov.
 */
export async function datosDelTurno(ctx: UserContext, id: string) {
  const turno = await turnoParaMiembro(ctx, id);
  if (!turno) return null;

  // Después de comprobar que el turno es de su equipo, y no en paralelo: la
  // lista solo se pide para quien ya ha pasado esa puerta.
  //
  // Sin mirar si el repertorio está encendido. Si el equipo lo apagó, la lista
  // de un domingo que ya se preparó sigue siendo lo que se va a tocar.
  //
  // El ensayo, igual: la reunión del mismo equipo en la semana de antes, que es
  // de su equipo por la misma puerta.
  const [canciones, ensayo] = await Promise.all([
    cancionesDelTurno(ctx, turno.id),
    ensayoAntesDelTurno(ctx, {
      ministerioId: turno.ministerio.id,
      fecha: turno.fecha,
      hora: turno.hora,
    }),
  ]);

  return { turno, canciones, ensayo };
}
