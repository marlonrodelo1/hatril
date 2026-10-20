import 'server-only';

import { esPastor, puede } from '@/lib/auth/permisos';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { personasPorFaltas } from './consultas';

/**
 * El seguimiento en la portada del líder: a quién hay que llamar.
 *
 * LA PUERTA DE MÁS, Y LA MISMA QUE EN EL PANEL
 * --------------------------------------------
 * `visiblePara` copia la condición del `layout.tsx` del seguimiento en el panel:
 * llevar el ministerio no basta, hace falta `ver_seguimiento`. Sin ella, la
 * tarjeta no sale, y la pantalla de la app da 404 por la misma guarda
 * (`requireMinisterioEnLaApp`).
 *
 * Las personas salen de `personasPorFaltas`, que ya deja fuera a quien negó el
 * permiso de asistencia. No hay otra lista: la portada no puede enseñar a
 * alguien que la pantalla del seguimiento esconde.
 *
 * Quien más se ha perdido va primero, que es el orden en que ya vienen. Sin
 * color de alarma para «nadie le acompaña» en sí —el primer día es lo normal—,
 * pero sí cuando se juntan tres faltas y nadie al lado: ese es el caso en que
 * todos suponen que llama otro.
 */

const EN_LA_PORTADA = 3;
const FALTAS_PARA_AVISAR = 3;

export const seguimientoEnLaApp: ModuloEnLaApp = {
  id: 'seguimiento',
  abrir: 'Ver a quién llamar',
  pantalla: 'app',
  visiblePara: (ctx) => esPastor(ctx) || puede(ctx, 'ver_seguimiento'),
  async resumen(ctx, ministerio) {
    const base = rutaApp(ministerio.id, 'seguimiento');
    const ausentes = (await personasPorFaltas(ctx, ministerio.id)).filter(
      (p) => p.faltasSeguidas > 0,
    );

    return {
      pendientes: ausentes.slice(0, EN_LA_PORTADA).map((p) => ({
        texto: p.nombre,
        detalle:
          `${p.faltasSeguidas} ${p.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} sin venir · ` +
          (p.acompana ? `le acompaña ${p.acompana.nombre}` : 'nadie le acompaña'),
        href: `${base}/${p.miembroId}`,
        urgente: !p.acompana && p.faltasSeguidas >= FALTAS_PARA_AVISAR,
      })),
      restantes: Math.max(0, ausentes.length - EN_LA_PORTADA),
      vacio:
        'Nadie se ha perdido ninguna de las reuniones en las que se pasó lista.',
    };
  },
};
