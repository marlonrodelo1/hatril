import 'server-only';

import { puedeGestionarDesdeDentro } from '@/lib/auth/permisos';
import type {
  ModuloEnLaApp,
  Pendiente,
  ResumenDeModulo,
} from '@/lib/ministerios/en-la-app/contrato';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { contarLaRed, gruposDeLaRed, guiasDeLaRed } from './consultas';
import { etiquetasDeGrupos, mayuscula } from './etiquetas';
import { lunesDe } from './semanas';
import { vistaDeMisGrupos, type VistaDeMiGrupo } from './vista';

/**
 * Los grupos en la portada de la red, en la app: las dos vistas del contrato.
 *
 * QUIEN LLEVA LA RED (`resumen`)
 * ------------------------------
 * Las células cuya última reunión pasó sin reporte, que es el aviso que pidió
 * Marlon, y cómo va la red: cuántas reportaron, cuántos vinieron, cuántas
 * visitas. Con la puerta estrecha, `puedeGestionarDesdeDentro`, igual que el
 * panel y la base (`0047`): quien organiza los ministerios desde secretaría no
 * ve las células de nadie.
 *
 * QUIEN SIRVE EN LA RED (`participante`)
 * --------------------------------------
 * Casi siempre es un líder de célula que no lleva la red: un voluntario del
 * equipo. Lo suyo es «Tu célula», con el reporte de la semana si le falta. Su
 * enlace va a la pantalla de su célula, que es suya aunque cuelgue de
 * `/mi/equipo/[id]/grupos`: la guarda de esa pantalla (`lib/grupos/guarda.ts`)
 * le abre la suya y ninguna otra. Si va a una célula sin llevarla, la ve como
 * cualquier participante: quién la lleva, cuándo y el próximo tema.
 *
 * Quien va a una célula sin estar en el equipo —la mayoría— no llega aquí: no
 * tiene pestaña «Equipo». Lo suyo lo ve en `/mi/cuenta`, con la misma vista.
 */

const EN_LA_PORTADA = 3;

/** Lo que pide la célula de quien la lleva, si pide algo. */
function pendienteDe(g: VistaDeMiGrupo, hoy: string): Pendiente | null {
  if (!g.llevo) return null;
  const href = rutaApp(g.ministerioId, 'grupos', g.grupoId);
  if (g.reunion.estado === 'sin_reportar') {
    return {
      texto: `${diaCorto(g.reunion.fecha, hoy)} · ${g.nombre}`,
      detalle: 'Sin reportar. Es un momento: cuántos vinieron y el tema.',
      href,
      urgente: true,
    };
  }
  if (g.reunion.estado === 'hoy') {
    return {
      texto: `Hoy · ${g.nombre}`,
      detalle: 'Cuando acabe, cuenta cuántos vinieron y repórtala.',
      href,
    };
  }
  return null;
}

function proximoDe(g: VistaDeMiGrupo, hoy: string) {
  const lleva = g.lideres.find((l) => l.rol === 'lider');
  return {
    texto: `${diaCorto(g.proxima.fecha, hoy)} · ${g.nombre}`,
    detalle:
      [
        g.proxima.tema ? `Tema: ${g.proxima.tema}` : null,
        g.zona,
        !g.llevo && lleva ? `Lleva ${lleva.nombre}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    href: g.llevo ? rutaApp(g.ministerioId, 'grupos', g.grupoId) : '/mi/cuenta',
  };
}

export const gruposEnLaApp: ModuloEnLaApp = {
  id: 'grupos',
  abrir: 'Ver todos los grupos',
  pantalla: 'app',
  visiblePara: (ctx, ministerioId) => puedeGestionarDesdeDentro(ctx, ministerioId),

  async resumen(ctx, ministerio, hoy): Promise<ResumenDeModulo> {
    const e = etiquetasDeGrupos(ministerio.tipo);
    const [lista, guias, mios] = await Promise.all([
      gruposDeLaRed(ctx, ministerio.id, hoy),
      guiasDeLaRed(ctx, ministerio.id, lunesDe(hoy), lunesDe(hoy)),
      vistaDeMisGrupos(ctx, hoy, ministerio.id),
    ]);
    const base = rutaApp(ministerio.id, 'grupos');
    const titulo = mayuscula(e.varios);
    const abrir = `Ver ${e.todos}`;

    if (lista.length === 0) {
      return {
        titulo,
        abrir,
        pendientes: [],
        vacio: `${e.estaRed} todavía no tiene ${e.varios}. Se crean desde el panel, eligiendo entre el equipo quién lleva cada ${e.uno}.`,
      };
    }

    // Lo de su propia célula primero, si la lleva: es lo que puede arreglar él.
    const propios = mios.map((g) => pendienteDe(g, hoy)).filter((p) => p !== null);
    const deLaRed: Pendiente[] = lista
      .filter((g) => g.reunion.estado === 'sin_reportar')
      .filter((g) => !mios.some((m) => m.grupoId === g.id && m.llevo))
      .map((g) => ({
        texto: `${g.nombre} · sin reportar`,
        detalle: [
          diaCorto(g.reunion.fecha, hoy),
          g.lider ? `lleva ${g.lider.nombre}` : 'sin nadie que lo lleve',
        ].join(' · '),
        href: rutaApp(ministerio.id, 'grupos', g.id),
        urgente: true,
      }));
    const pendientes = [...propios, ...deLaRed];

    const cuenta = contarLaRed(lista);
    const guia = guias.get(lunesDe(hoy));

    return {
      titulo,
      abrir,
      pendientes: pendientes.slice(0, EN_LA_PORTADA),
      restantes: Math.max(0, pendientes.length - EN_LA_PORTADA),
      cifras:
        cuenta.total > 0 || cuenta.hoy > 0
          ? [
              {
                rotulo: 'Reportaron la última reunión',
                valor: `${cuenta.reportados} de ${cuenta.total}`,
              },
              { rotulo: 'Vinieron', valor: String(cuenta.asistentes) },
              { rotulo: 'Visitas', valor: String(cuenta.visitas) },
              // Las de hoy no entran en la cuenta hasta que reporten
              // (`contarLaRed`); se dicen para que el «de» no parezca corto.
              ...(cuenta.hoy > 0 ? [{ rotulo: 'Se reúnen hoy', valor: String(cuenta.hoy) }] : []),
            ]
          : undefined,
      proximo: guia
        ? { texto: `Guía de esta semana: ${guia}`, href: `${base}#guia` }
        : {
            texto: 'Esta semana no hay guía común',
            detalle: `Publícala y se propondrá en ${e.todos}.`,
            href: `${base}#guia`,
          },
      vacio: '',
    };
  },

  async participante(ctx, ministerio, hoy): Promise<ResumenDeModulo> {
    const e = etiquetasDeGrupos(ministerio.tipo);
    const mios = await vistaDeMisGrupos(ctx, hoy, ministerio.id);
    const llevo = mios.find((g) => g.llevo);
    const principal = llevo ?? mios[0];

    if (!principal) {
      return {
        titulo: mayuscula(e.varios),
        pendientes: [],
        vacio: `No estás en ${e.ninguno} de ${e.laRed}. Si vas a una reunión, pide a quien lleva ${e.laRed} que te apunte.`,
      };
    }

    return {
      titulo: mios.length === 1 ? `Tu ${e.uno}` : `Tus ${e.varios}`,
      pendientes: mios.map((g) => pendienteDe(g, hoy)).filter((p) => p !== null),
      proximo: proximoDe(principal, hoy),
      vacio: '',
      enlace: llevo
        ? { texto: `Abrir tu ${e.uno}`, href: rutaApp(ministerio.id, 'grupos', llevo.grupoId) }
        : null,
    };
  },
};
