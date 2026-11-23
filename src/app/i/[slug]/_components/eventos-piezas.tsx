import type { ReactNode } from 'react';
import { CalendarRange, Clock, ExternalLink, MapPin, Ticket } from 'lucide-react';
import { clsx } from 'clsx';

import type { EventoPublico } from '@/lib/eventos/publica';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { BotonEnlace } from '@/components/ui/boton-enlace';

/**
 * Las piezas de un evento que se repiten en la web pública: el bloque de la
 * fecha y la lista de datos. Las usan la tarjeta de la portada, la página del
 * evento y el «listo», para que las tres digan lo mismo con la misma forma
 * (rediseño de la zona 3, 17-nov).
 *
 * TODO EN LA ZONA DE LA IGLESIA, NUNCA EN LA DEL SERVIDOR
 * -------------------------------------------------------
 * Cada formateador lleva `timeZone`. El contenedor corre en Europa y media
 * congregación está en Bogotá: sin él, un retiro que empieza el viernes a las
 * 20:00 sale en el bloque de la fecha como sábado.
 *
 * Y LO QUE NO HAY AQUÍ: ni plazas, ni «completo», ni cuántos van. El porqué
 * está en `src/lib/eventos/publica.ts`.
 */

function formato(timezone: string, opciones: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es', { timeZone: timezone, ...opciones });
}

function mayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** El día del calendario en la zona de la iglesia, para comparar días. */
function claveDia(instante: Date, timezone: string) {
  // `en-CA` porque da `2026-11-20`: comparable como texto, sin depender del
  // orden día/mes del español.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

function hora(instante: Date, timezone: string) {
  return formato(timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);
}

/**
 * Un evento es «de varios días» si termina otro día del calendario. Uno que
 * acaba a las 21:00 del mismo jueves es de un día, aunque tenga `finEn`.
 */
export function esDeVariosDias(
  e: Pick<EventoPublico, 'inicioEn' | 'finEn'>,
  timezone: string,
) {
  return Boolean(
    e.finEn && claveDia(e.finEn, timezone) !== claveDia(e.inicioEn, timezone),
  );
}

/**
 * Lo que va debajo del título en la tarjeta: «Jueves, 19:00» o «Del 27 al 29».
 * El día y el mes ya los dice el bloque de la fecha, así que aquí va lo que
 * falta para decidir si se puede ir.
 */
export function cuandoCorto(
  e: Pick<EventoPublico, 'inicioEn' | 'finEn'>,
  timezone: string,
) {
  if (e.finEn && esDeVariosDias(e, timezone)) {
    const dia = formato(timezone, { day: 'numeric' });
    const mes = formato(timezone, { month: 'short' });
    const mismoMes = mes.format(e.inicioEn) === mes.format(e.finEn);
    if (mismoMes) {
      return `Del ${dia.format(e.inicioEn)} al ${dia.format(e.finEn)}`;
    }
    const corto = formato(timezone, { day: 'numeric', month: 'short' });
    return `Del ${corto.format(e.inicioEn).replace('.', '')} al ${corto.format(e.finEn).replace('.', '')}`;
  }
  const diaSemana = formato(timezone, { weekday: 'long' }).format(e.inicioEn);
  return `${mayuscula(diaSemana)}, ${hora(e.inicioEn, timezone)}`;
}

/**
 * Lo mismo, entero, para la página del evento: con el año, porque un enlace a
 * un evento se comparte y se abre meses después.
 */
function cuandoLargo(
  e: Pick<EventoPublico, 'inicioEn' | 'finEn'>,
  timezone: string,
): { principal: string; detalle: string | null } {
  if (e.finEn && esDeVariosDias(e, timezone)) {
    const anio = formato(timezone, { year: 'numeric' });
    const mes = formato(timezone, { month: 'long', year: 'numeric' });
    const desde = formato(timezone, {
      weekday: 'long',
      day: 'numeric',
      ...(mes.format(e.inicioEn) === mes.format(e.finEn)
        ? {}
        : { month: 'long' }),
      ...(anio.format(e.inicioEn) === anio.format(e.finEn)
        ? {}
        : { year: 'numeric' }),
    }).format(e.inicioEn);
    const hasta = formato(timezone, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(e.finEn);
    return {
      principal: `Del ${desde} al ${hasta}`.replace(/,/g, ''),
      detalle: `Empieza a las ${hora(e.inicioEn, timezone)}`,
    };
  }
  const empieza = formatearInstante(e.inicioEn, timezone, { conAnio: true });
  return {
    principal: e.finEn
      ? `${empieza} a ${hora(e.finEn, timezone)}`
      : empieza,
    detalle: null,
  };
}

/**
 * El bloque del mes y el día. Es lo primero que se busca de un evento, antes
 * que el título, y por eso va grande y a la izquierda.
 *
 * Para un lector de pantalla, «nov 20» no dice nada: lo visual va oculto y
 * debajo viaja la fecha escrita.
 */
export function FechaEvento({
  inicioEn,
  timezone,
  grande = false,
}: {
  inicioEn: Date;
  timezone: string;
  grande?: boolean;
}) {
  const mes = formato(timezone, { month: 'short' })
    .format(inicioEn)
    .replace('.', '');
  const dia = formato(timezone, { day: 'numeric' }).format(inicioEn);
  const leido = formato(timezone, { day: 'numeric', month: 'long' }).format(
    inicioEn,
  );

  return (
    <span
      className={clsx(
        // `rounded-lg` y no `xl`: vive dentro de una tarjeta, y dentro de una
        // tarjeta nada lleva 12 (regla 8).
        'flex flex-none flex-col items-center justify-center rounded-lg bg-accent text-accent-foreground',
        grande ? 'h-[68px] w-16 sm:h-[76px] sm:w-[72px]' : 'h-[58px] w-[54px]',
      )}
    >
      <span aria-hidden className="text-micro font-bold uppercase tracking-[0.06em]">
        {mes}
      </span>
      <span
        aria-hidden
        className={clsx(
          'font-extrabold leading-none tracking-[-0.02em] tabular-nums',
          grande ? 'text-figure' : 'text-title',
        )}
      >
        {dia}
      </span>
      <span className="sr-only">{leido}</span>
    </span>
  );
}

function Dato({
  icono,
  rotulo,
  children,
}: {
  icono: ReactNode;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
      {icono}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="sr-only">{rotulo}: </span>
        {children}
      </div>
    </li>
  );
}

const ICONO = 'mt-0.5 size-[18px] flex-none text-muted-foreground';

/**
 * Cuándo, dónde y lo que cuesta, en una lista de filas.
 *
 * `conPago` mete en la fila del precio las instrucciones y el enlace de pago:
 * en la página del evento sí, en el «listo» no (allí basta con decir que hay
 * que volver a la página para pagar). `dentro` la baja a 8 de radio cuando va
 * dentro de otra tarjeta.
 */
export function DatosEvento({
  evento: e,
  timezone,
  moneda,
  iglesiaNombre,
  conPago = false,
  dentro = false,
}: {
  evento: EventoPublico;
  timezone: string;
  moneda?: Moneda;
  iglesiaNombre?: string;
  conPago?: boolean;
  dentro?: boolean;
}) {
  const cuando = cuandoLargo(e, timezone);
  const variosDias = esDeVariosDias(e, timezone);
  const hayPago = conPago && Boolean(e.precio || e.enlacePago || e.pagoInstrucciones);

  return (
    <ul
      className={clsx(
        'flex flex-col border border-border',
        dentro ? 'rounded-lg bg-surface-alt text-left' : 'rounded-xl bg-surface',
      )}
    >
      <Dato
        rotulo="Cuándo"
        icono={
          variosDias ? (
            <CalendarRange className={ICONO} strokeWidth={1.8} aria-hidden />
          ) : (
            <Clock className={ICONO} strokeWidth={1.8} aria-hidden />
          )
        }
      >
        <span className="text-body first-letter:uppercase">{cuando.principal}</span>
        {cuando.detalle && (
          <span className="text-label text-muted-foreground">{cuando.detalle}</span>
        )}
      </Dato>

      {e.lugar && (
        <Dato
          rotulo="Dónde"
          icono={<MapPin className={ICONO} strokeWidth={1.8} aria-hidden />}
        >
          <span className="text-body">{e.lugar}</span>
        </Dato>
      )}

      {hayPago && (
        <Dato
          rotulo="Precio"
          icono={<Ticket className={ICONO} strokeWidth={1.8} aria-hidden />}
        >
          <span className="text-body font-semibold">
            {e.precio && moneda ? formatearDinero(e.precio, moneda) : 'Cómo pagar'}
          </span>

          {e.pagoInstrucciones && (
            // Como TEXTO y nunca dentro de un `href`: aquí van bizums,
            // teléfonos de Nequi y números de cuenta, que no son direcciones.
            <p className="whitespace-pre-line text-pretty text-label text-foreground">
              {e.pagoInstrucciones}
            </p>
          )}

          {e.enlacePago && e.enlacePagoHost && (
            <div className="mt-2 flex flex-col gap-1.5">
              <BotonEnlace
                nativo
                href={e.enlacePago}
                target="_blank"
                // `nofollow` además de lo de siempre: este enlace lo pone la
                // iglesia y no tiene por qué transmitir reputación.
                rel="noopener noreferrer nofollow"
                variant="secondary"
                size="sm"
                className="w-fit"
              >
                <ExternalLink strokeWidth={1.8} />
                Pagar la inscripción
              </BotonEnlace>
              {/* El host, delante y en texto. Es la única mitad de esta
                  protección que ve quien va a pulsar: el pastor vio la
                  dirección entera al pegarla, aquí solo se ve el botón. Lo
                  escribió el servidor con `new URL().hostname` y un CHECK de
                  la base impide que contradiga a la URL. */}
              <p className="t-label text-muted-foreground">
                Te lleva a <span className="font-bold">{e.enlacePagoHost}</span>
              </p>
            </div>
          )}

          {/* La misma frase que la ventana de donativos, palabra por palabra.
              En cuanto una página dice «Inscríbete · 50.000», quien la lee
              puede creer razonablemente que el comerciante somos nosotros. */}
          {iglesiaNombre && (
            <p className="mt-1 text-pretty text-label text-muted-foreground">
              Hatril no cobra ni intermedia: el pago va directamente a{' '}
              {iglesiaNombre}.
            </p>
          )}
        </Dato>
      )}
    </ul>
  );
}
