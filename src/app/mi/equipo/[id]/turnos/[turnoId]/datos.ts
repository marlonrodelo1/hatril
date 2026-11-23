import 'server-only';

import { notFound } from 'next/navigation';
import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { cancionesDelTurno, cancionesParaElegir } from '@/lib/repertorio/consultas';
import { obtenerTurno, otrosTurnosDelDia, turnoParaCopiar } from '@/lib/turnos/consultas';
import { estadoDeTurno, textoDelEstado } from '@/lib/turnos/en-la-app';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, turnoId, error, guardado }: { id: string; turnoId: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');
  exigirUuid(turnoId);

  const turno = await obtenerTurno(ctx, turnoId);
  // La guarda comprobó el ministerio de la URL; falta que el turno sea suyo y
  // no del de al lado, igual que en el panel.
  if (!turno || turno.ministerioId !== id) notFound();

  // La lista solo con el repertorio encendido, como en el panel: un equipo de
  // ujieres no tiene nada que tocar.
  const conRepertorio = tieneModulo(ministerio.modulos, 'repertorio');

  const [otrosMapa, paraCopiar, lista, repertorio] = await Promise.all([
    otrosTurnosDelDia(ctx, turno),
    turno.personas.length === 0
      ? turnoParaCopiar(ctx, turno, id)
      : Promise.resolve(null),
    conRepertorio ? cancionesDelTurno(ctx, turnoId) : Promise.resolve([]),
    conRepertorio ? cancionesParaElegir(ctx, id) : Promise.resolve([]),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const puestos = puestosDelMinisterio(ministerio);
  const estado = estadoDeTurno(turno, puestos);
  const falta = textoDelEstado(estado);

  // Los puestos de la lista y, detrás, los que tenga este turno y ya no estén
  // en ella: esa gente sigue yendo, y esconderla haría creer que el puesto
  // está vacío. La misma regla que el panel.
  const enListaSet = new Set(puestos.map((p) => p.toLocaleLowerCase('es')));
  const huerfanos = [
    ...new Set(
      turno.personas
        .map((p) => p.puesto)
        .filter((p) => !enListaSet.has(p.toLocaleLowerCase('es'))),
    ),
  ];
  const filas = [...puestos, ...huerfanos];

  const enLaLista = new Set(lista.map((c) => c.id));
  const candidatas = repertorio.filter((c) => !enLaLista.has(c.id));

  // `enLista` sale como lista y no como `Set`, y `otros` como objeto y no como
  // `Map`: esto viaja por JSON a la app empaquetada, y los dos llegan como
  // `{}`. Hasta el 23-nov la pantalla del turno se caía en el iPhone al tocar
  // un turno («h.has is not a function»); `otros.get` era el siguiente.
  const enLista = [...enListaSet];
  const otros: Record<string, string[]> = Object.fromEntries(otrosMapa);

  return { id, turnoId, error, guardado, ctx, ministerio, turno, conRepertorio, otros, paraCopiar, lista, repertorio, hoy, puestos, estado, falta, enLista, filas, candidatas };
}
