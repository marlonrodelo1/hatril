import type { ReactNode } from 'react';
import { CalendarPlus, CirclePause, CirclePlay, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

import type { iglesias } from '@/lib/db/schema';
import { situacionDe } from '@/lib/admin/consultas';
import { leerEstadoSuscripcion } from '@/lib/suscripcion/estado';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { fechaLocalATimestamp, timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import { Button } from '@/components/ui/button';
import { fecha } from '../../../_components/piezas';
import { sumarDias } from './dias';
import { VentanaAmpliar } from './ventana-ampliar';
import { VentanaDirectorio, VentanaReactivar, VentanaSuspender } from './ventanas-estado';

type Iglesia = typeof iglesias.$inferSelect;

/**
 * «Lo que puedes hacer»: las palancas del super admin sobre una iglesia,
 * JUNTAS. Antes ampliar vivía dentro de Suscripción, sacar del directorio en
 * su tarjeta y suspender en una caja roja al final, y había que recorrer la
 * ficha entera para saber qué se podía tocar.
 *
 * Cada fila dice cómo está la iglesia AHORA en eso que la palanca cambia, y su
 * botón abre la ventana con lo que va a pasar. La que no se puede usar no se
 * esconde: sale con el botón apagado y el porqué en su línea, que es lo que
 * contesta a «¿por qué no puedo ampliarle la prueba a esta?».
 *
 * Las reglas de cada una NO viven aquí, viven en `../../actions.ts`, que vuelve
 * a leer la iglesia antes de tocar nada. Lo de aquí es solo para no ofrecer lo
 * que la action va a rechazar, y para explicarlo antes.
 */
export function Palancas({
  iglesia,
  abrirAmpliar = false,
}: {
  iglesia: Iglesia;
  /** `?ampliar=1`, desde el «Ampliar» del inicio. Solo si se puede ampliar. */
  abrirAmpliar?: boolean;
}) {
  const hoy = hoyEnLaIglesia(iglesia.timezone);
  const finActual = iglesia.trialUntil
    ? timestampAFechaHoraLocal(iglesia.trialUntil, iglesia.timezone).fecha
    : null;
  const enPrueba = iglesia.plan === 'trial';

  return (
    <section
      aria-labelledby="palancas-titulo"
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
      <h2 id="palancas-titulo" className="t-subtitulo border-b border-border px-4 py-4 md:px-5">
        Lo que puedes hacer
      </h2>

      <ul className="flex flex-col">
        <Palanca
          id="palanca-prueba"
          icono={<CalendarPlus className="size-[18px]" strokeWidth={1.8} />}
          titulo="Ampliar la prueba"
          estado={estadoPrueba(iglesia)}
          apagada={!enPrueba}
          boton={
            enPrueba ? (
              <VentanaAmpliar
                id={iglesia.id}
                nombre={iglesia.nombre}
                hoy={hoy}
                maximo={ultimoDiaPermitido(iglesia.timezone)}
                finActual={finActual}
                zona={nombreDeZona(iglesia.timezone)}
                describidoPor="palanca-prueba"
                abiertaAlEntrar={abrirAmpliar}
              />
            ) : (
              <BotonApagado texto="Ampliar" describidoPor="palanca-prueba" />
            )
          }
        />

        <Palanca
          id="palanca-directorio"
          icono={<EyeOff className="size-[18px]" strokeWidth={1.8} />}
          titulo="Sacar del directorio"
          estado={estadoDirectorio(iglesia)}
          apagada={!iglesia.visibleEnDirectorio}
          boton={
            iglesia.visibleEnDirectorio ? (
              <VentanaDirectorio
                id={iglesia.id}
                nombre={iglesia.nombre}
                activa={iglesia.activa}
                webPublica={iglesia.webPublica}
                describidoPor="palanca-directorio"
              />
            ) : (
              <BotonApagado texto="Sacar" describidoPor="palanca-directorio" />
            )
          }
        />

        {iglesia.activa ? (
          <Palanca
            id="palanca-acceso"
            icono={<CirclePause className="size-[18px]" strokeWidth={1.8} />}
            titulo="Suspender la iglesia"
            estado="Nadie entra hasta que la reactives. No se borra nada."
            peligro
            boton={
              <VentanaSuspender
                id={iglesia.id}
                nombre={iglesia.nombre}
                describidoPor="palanca-acceso"
              />
            }
          />
        ) : (
          <Palanca
            id="palanca-acceso"
            icono={<CirclePlay className="size-[18px]" strokeWidth={1.8} />}
            titulo="Reactivar la iglesia"
            estado="Suspendida: nadie de la congregación entra y su web no se ve."
            boton={
              <VentanaReactivar
                id={iglesia.id}
                nombre={iglesia.nombre}
                alReactivar={situacionDe({ ...iglesia, activa: true }).etiqueta}
                describidoPor="palanca-acceso"
              />
            }
          />
        )}
      </ul>
    </section>
  );
}

function Palanca({
  id,
  icono,
  titulo,
  estado,
  boton,
  apagada = false,
  peligro = false,
}: {
  /** El de la línea de estado: el botón la usa como descripción. */
  id: string;
  icono: ReactNode;
  titulo: string;
  estado: string;
  boton: ReactNode;
  apagada?: boolean;
  peligro?: boolean;
}) {
  return (
    // En el móvil el botón baja debajo del texto, alineado con él: a la
    // derecha, «Suspender» con su icono dejaba la explicación en una columna
    // de tres palabras por línea.
    <li className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 border-b border-border px-4 py-3.5 last:border-b-0 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:items-center md:px-5">
      <span
        aria-hidden
        className={clsx(
          'flex size-[34px] items-center justify-center rounded-lg',
          peligro
            ? 'bg-danger-soft text-danger'
            : apagada
              ? 'bg-surface-alt text-disabled-text'
              : 'bg-surface-active text-foreground',
        )}
      >
        {icono}
      </span>
      {/* La línea de estado se parte en varias y no se corta: es la
          explicación, y cortada a media frase no explica nada. */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold">{titulo}</span>
        <span id={id} className="text-label text-pretty text-muted-foreground">
          {estado}
        </span>
      </span>
      <span className="col-start-2 sm:col-start-3">{boton}</span>
    </li>
  );
}

/** El botón de una palanca que hoy no se puede usar. El porqué, en su línea. */
function BotonApagado({ texto, describidoPor }: { texto: string; describidoPor: string }) {
  return (
    <Button variant="outline" size="sm" disabled aria-describedby={describidoPor}>
      {texto}
    </Button>
  );
}

// ============================================================================
// Cómo está ahora, en una línea
// ============================================================================

function estadoPrueba(iglesia: Iglesia): string {
  const hasta = iglesia.trialUntil ? fecha(iglesia.trialUntil, iglesia.timezone) : null;

  // Con un plan de pago o cancelado no se amplía, y la action lo rechaza: en
  // `cancelado` esa fecha es el fin del periodo PAGADO (ver `ampliarPrueba`).
  if (iglesia.plan === 'cancelado') {
    return hasta
      ? `Canceló en Stripe: el ${hasta} acaba el periodo que pagó, y esa fecha no se toca aquí. Si hay que regalarle tiempo, se hace en Stripe.`
      : 'Canceló en Stripe. Si hay que regalarle tiempo, se hace en Stripe.';
  }
  if (iglesia.plan !== 'trial') {
    return 'Ya paga: su acceso lo lleva Stripe, no una fecha de prueba.';
  }

  const estado = leerEstadoSuscripcion(iglesia);
  const linea = (() => {
    switch (estado.situacion) {
      case 'prueba':
        return estado.diasRestantes === 1
          ? `Acaba el ${hasta}, mañana.`
          : `Acaba el ${hasta}, dentro de ${estado.diasRestantes} días.`;
      case 'solo_lectura':
        return `Acabó el ${hasta}. ${
          estado.diasDeGracia === 1 ? 'Le queda 1 día' : `Le quedan ${estado.diasDeGracia} días`
        } de gracia, solo para consultar.`;
      case 'bloqueada':
        // Pasada la gracia, el muro manda el panel entero a `/suscripcion`
        // (`guard-panel.ts`): entrar, entra, pero solo para pagar.
        return hasta
          ? `Acabó el ${hasta} y ya pasaron los días de gracia: el panel solo le deja ir a pagar.`
          : 'No tiene fecha de fin: el panel solo le deja ir a pagar.';
      default:
        // `activa` y `termina` no se dan con `trial`; si algún día se dieran,
        // la fecha es lo único seguro que decir.
        return hasta ? `Acaba el ${hasta}.` : 'Sin fecha de fin.';
    }
  })();

  // Ampliar no la reactiva: la prueba y la suspensión son palancas distintas.
  return iglesia.activa ? linea : `${linea} Está suspendida: ampliar no la reactiva.`;
}

function estadoDirectorio(iglesia: Iglesia): string {
  if (!iglesia.visibleEnDirectorio) {
    // Solo hacia fuera, como la action: volver a salir lo decide la iglesia.
    return 'No sale en el buscador de iglesias. Volver a salir lo decide la propia iglesia desde sus ajustes.';
  }
  return iglesia.activa
    ? 'Hoy sale en el buscador de iglesias.'
    : 'Tiene marcado salir, pero no sale mientras esté suspendida.';
}

// ============================================================================
// Lo que la ventana de ampliar necesita saber del servidor
// ============================================================================

/**
 * El último día que `ampliarPrueba` acepta, con su misma cuenta: el día
 * cerrado a las 23:59 en la zona de la iglesia no puede pasar de un año desde
 * ahora. Casi siempre es la víspera del mismo día del año que viene.
 *
 * Se calcula al pintar. Si la ficha se queda abierta horas, el tope de la
 * action solo puede haber avanzado, nunca retrocedido: lo que aquí se ofrece
 * sigue valiendo.
 */
function ultimoDiaPermitido(timezone: string): string {
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() + 1);
  const { fecha: dia } = timestampAFechaHoraLocal(limite, timezone);
  return fechaLocalATimestamp(dia, '23:59', timezone) > limite ? sumarDias(dia, -1) : dia;
}

/**
 * «hora de Bogotá». Los nombres de `Intl` no sirven para esto («hora estándar
 * de Colombia», «hora de Europa occidental» para Canarias), así que las zonas
 * que se usan van con su nombre de siempre y las demás, con la ciudad del
 * identificador.
 */
const ZONAS: Record<string, string> = {
  'America/Bogota': 'Bogotá',
  'Europe/Madrid': 'Madrid',
  'Atlantic/Canary': 'Canarias',
};

function nombreDeZona(timezone: string): string {
  return ZONAS[timezone] ?? timezone.split('/').at(-1)?.replaceAll('_', ' ') ?? timezone;
}
