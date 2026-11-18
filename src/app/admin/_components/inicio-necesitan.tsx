import Link from 'next/link';
import { CircleCheck } from 'lucide-react';

import type { FilaIglesiaDetalle } from '@/lib/admin/iglesias-detalle';
import { GRACIA_DIAS } from '@/lib/suscripcion/estado';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Insignia } from '@/components/ui/insignia';
import { Lista } from '@/components/ui/fila';
import { InicialIglesia } from './iglesias-inicial';
import { fechaCorta } from './iglesias-formato';

/**
 * «Necesitan algo de ti»: cada iglesia con su porqué en palabras, su insignia y
 * el botón que lo arregla.
 *
 * QUIÉN ENTRA
 * -----------
 * Las que tienen la insignia en aviso o en peligro: la prueba acaba en siete
 * días o menos, canceló, está en los días de gracia o está bloqueada. Las
 * suspendidas NO: las suspendió alguien de aquí a propósito, y meterlas en la
 * lista de pendientes las tendría ahí para siempre.
 *
 * EN QUÉ ORDEN
 * ------------
 * Primero lo que todavía se puede salvar antes de que empeore: las que están en
 * gracia (mañana se bloquean), luego las pruebas que acaban, luego las que
 * cancelaron y al final las bloqueadas, que ya no van a cambiar solas. Dentro
 * de cada grupo, la que tiene menos margen arriba.
 *
 * EL BOTÓN
 * --------
 * «Ampliar» solo cuando la iglesia sigue en `trial`: es la única con la que la
 * ficha deja ampliar (`ampliarPrueba`). Con `cancelado` esa fecha es periodo
 * pagado, se cambia en Stripe, y el botón es «Ver». De contorno siempre: en una
 * lista la acción de cada fila nunca es naranja (regla 1).
 */

/*
 * El criterio de «quién entra» vive en `marco-pendientes.ts`, junto al número
 * que sale al lado de «Inicio» en el menú. Estuvo escrito dos veces (los dos
 * se hicieron a la vez el 18-nov) y el día que alguien cambiara uno solo, el
 * número del menú y esta lista dejarían de coincidir. Se cambia allí.
 */
export { requiereAtencion as necesitaAtencion } from './marco-pendientes';

function prioridad(i: FilaIglesiaDetalle): [number, number] {
  const e = i.estado;
  switch (e.situacion) {
    case 'solo_lectura':
      return [0, e.diasDeGracia];
    case 'prueba':
      return [1, e.diasRestantes];
    case 'termina':
      return [2, e.diasRestantes];
    case 'bloqueada':
      return [3, 0];
    case 'activa':
      return [4, 0];
  }
}

export function ordenarPorUrgencia(lista: FilaIglesiaDetalle[]): FilaIglesiaDetalle[] {
  return [...lista].sort((a, b) => {
    const [ga, da] = prioridad(a);
    const [gb, db] = prioridad(b);
    return ga - gb || da - db || a.nombre.localeCompare(b.nombre, 'es');
  });
}

const MS_POR_DIA = 86_400_000;

/**
 * El porqué, escrito desde lo que le pasa a la iglesia y con sus fechas en su
 * hora. El fin de la gracia es `accesoHasta + GRACIA_DIAS` justo: es el
 * instante en que `leerEstadoSuscripcion` pasa de `solo_lectura` a
 * `bloqueada`, así que la frase y el muro de pago no pueden discrepar.
 */
function motivo(i: FilaIglesiaDetalle): string {
  const e = i.estado;
  const f = (d: Date) => fechaCorta(d, i.timezone);
  const esPrueba = i.plan === 'trial';

  switch (e.situacion) {
    case 'prueba':
      return `La prueba acaba el ${f(e.accesoHasta)}. Si no se suscribe antes, pasa a solo lectura.`;
    case 'termina':
      return `Canceló la suscripción. Tiene acceso pagado hasta el ${f(e.accesoHasta)}; después, solo lectura.`;
    case 'solo_lectura': {
      const finGracia = new Date(e.accesoHasta.getTime() + GRACIA_DIAS * MS_POR_DIA);
      return `${esPrueba ? 'La prueba' : 'La suscripción'} acabó el ${f(e.accesoHasta)}. Está en los días de gracia: solo lectura hasta el ${f(finGracia)}.`;
    }
    case 'bloqueada':
      if (!i.trialUntil) return 'Bloqueada: no tiene ninguna fecha de acceso puesta.';
      return esPrueba
        ? `Bloqueada: la prueba acabó el ${f(i.trialUntil)} y los días de gracia ya pasaron, sin pago.`
        : `Bloqueada: la suscripción acabó el ${f(i.trialUntil)} y los días de gracia ya pasaron.`;
    case 'activa':
      // No llega aquí: una iglesia que paga no pide nada. Por si acaso, la
      // verdad y no una frase vacía.
      return 'Paga y está al día.';
  }
}

export function NecesitanAlgo({ lista }: { lista: FilaIglesiaDetalle[] }) {
  if (lista.length === 0) {
    return (
      <p className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
        <CircleCheck className="size-4 flex-none text-support" strokeWidth={1.8} aria-hidden />
        Nada pendiente: ninguna prueba acaba esta semana y no hay iglesias vencidas.
      </p>
    );
  }

  return (
    <Lista>
      {lista.map((i) => {
        const ficha = `/admin/iglesias/${i.id}`;
        const ampliar = i.plan === 'trial';
        return (
          <li
            key={i.id}
            // En el móvil, la insignia y el botón bajan debajo del porqué, en
            // la columna del texto: al lado del nombre dejaban 100 px para la
            // frase, que es lo importante de la fila.
            className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 md:items-center md:px-5"
          >
            <InicialIglesia nombre={i.nombre} logoUrl={i.logoUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center md:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <Link
                  href={ficha}
                  className="w-fit text-body font-semibold text-foreground no-underline hover:text-foreground hover:underline"
                >
                  {i.nombre}
                </Link>
                <p className="text-pretty text-label text-muted-foreground">{motivo(i)}</p>
              </div>
              <div className="flex flex-none flex-wrap items-center gap-2 md:gap-3">
                <Insignia tono={i.situacion.tono} punto>
                  {i.situacion.etiqueta}
                </Insignia>
                {/* `?ampliar=1`: el diseño aprobado lleva a la ficha con la
                    ventana de ampliar abierta. Si la ficha no lo lee, se queda
                    en la ficha, que también es el sitio donde se arregla. */}
                <BotonEnlace
                  href={ampliar ? `${ficha}?ampliar=1` : ficha}
                  variant="outline"
                  size="sm"
                  aria-label={
                    ampliar ? `Ampliar la prueba de ${i.nombre}` : `Ver la ficha de ${i.nombre}`
                  }
                >
                  {/* En un solo `span`: el botón separa sus hijos con `gap-2`,
                      y «Ampliar» y «la prueba» como dos hijos salían con un
                      hueco doble en medio. */}
                  {ampliar ? (
                    <span>
                      Ampliar<span className="md:hidden"> la prueba</span>
                    </span>
                  ) : (
                    'Ver'
                  )}
                </BotonEnlace>
              </div>
            </div>
          </li>
        );
      })}
    </Lista>
  );
}
