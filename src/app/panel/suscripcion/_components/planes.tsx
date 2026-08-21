import Link from 'next/link';
import { Check, TriangleAlert, Users } from 'lucide-react';

import {
  PLANES,
  preciosConfigurados,
  type Periodicidad,
  type PlanId,
} from '@/lib/stripe/client';
import { excesoDeMiembros } from '@/lib/suscripcion/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { irAPagar } from '../actions';

/**
 * Elegir plan. Vive en un componente y no en la pantalla porque hay DOS sitios
 * donde hace falta lo mismo: `/panel/suscripcion` y el muro que sustituye al
 * panel entero cuando una iglesia se queda sin acceso.
 *
 * Duplicarlo era la otra opción, y con ella el día que cambie un plan cambiaría
 * en una de las dos: justo la clase de deriva que hace que la pantalla de pago
 * y la de bloqueo ofrezcan cosas distintas al mismo pastor.
 */
export function ElegirPlan({
  cuentan,
  periodicidad,
  planActual,
  base = '/panel/suscripcion',
}: {
  cuentan: number;
  periodicidad: Periodicidad;
  planActual: PlanId | null;
  /**
   * A dónde apunta el selector de mensual/anual. Son dos rutas porque son dos
   * situaciones: la pantalla del panel y la de una iglesia que ya se quedó sin
   * acceso, que vive fuera del panel para no chocar con su layout. Sin este
   * parámetro, pulsar «Anual» desde la segunda devolvería a la primera, que
   * volvería a echar a quien la abrió.
   */
  base?: string;
}) {
  // Si faltan ids de precio en el entorno, se dice AQUÍ y no se pinta un botón
  // que reventaría al pulsarlo. Es el síntoma de un despliegue con variables a
  // medias, y el pastor no tiene por qué descubrirlo con una pantalla de error.
  const precios = preciosConfigurados();

  return (
    <>
      {!precios.ok && (
        <Aviso>
          Falta configurar los precios ({precios.faltan.join(', ')}). Nadie puede
          suscribirse hasta que estén.
        </Aviso>
      )}

      <TarjetaTamano cuentan={cuentan} planActual={planActual} />

      <Periodo actual={periodicidad} base={base} />

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(PLANES) as PlanId[]).map((id) => (
          <TarjetaPlan
            key={id}
            id={id}
            cuentan={cuentan}
            periodicidad={periodicidad}
            esActual={planActual === id}
            hayPrecios={precios.ok}
          />
        ))}
      </div>
    </>
  );
}

/**
 * Mensual o anual. Dos enlaces, no un interruptor.
 *
 * MENSUAL O ANUAL VIAJA EN LA URL, SIN UNA LÍNEA DE JAVASCRIPT
 * ------------------------------------------------------------
 * Podría ser un interruptor con estado en el cliente. Sería un componente de
 * cliente entero, con su hidratación, para recordar un booleano que el servidor
 * ya sabe leer de `?periodo=`. Y de regalo: el enlace se puede compartir tal
 * cual, y quien vuelva atrás encuentra lo que había elegido.
 *
 * `scroll={false}` porque el cambio ocurre a media pantalla, y saltar arriba al
 * pulsar hace perder de vista justo lo que se acaba de cambiar.
 */
function Periodo({ actual, base }: { actual: Periodicidad; base: string }) {
  const opciones: { id: Periodicidad; texto: string }[] = [
    { id: 'mensual', texto: 'Mensual' },
    { id: 'anual', texto: 'Anual' },
  ];

  return (
    <div
      className="flex w-fit gap-1 rounded-lg border border-border bg-surface p-1"
      role="group"
      aria-label="Cada cuánto se paga"
    >
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={`${base}?periodo=${o.id}`}
          scroll={false}
          aria-current={actual === o.id ? 'true' : undefined}
          className={
            'rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ' +
            (actual === o.id
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground')
          }
        >
          {o.texto}
        </Link>
      ))}
    </div>
  );
}

/**
 * El tamaño de la iglesia, arriba y antes que los planes.
 *
 * Sin este número, elegir plan es adivinar. Con él, la decisión se toma sola:
 * «tenemos 340 personas» descarta Esencial sin leer una sola característica.
 */
function TarjetaTamano({
  cuentan,
  planActual,
}: {
  cuentan: number;
  planActual: PlanId | null;
}) {
  const limite = planActual ? PLANES[planActual].limiteMiembros : null;
  const exceso = planActual ? excesoDeMiembros(cuentan, limite) : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Users className="size-[15px]" strokeWidth={1.8} />
        El tamaño de tu iglesia
      </span>
      <span className="text-[24px] font-bold tracking-[-0.02em] tabular-nums">
        {cuentan} {cuentan === 1 ? 'persona' : 'personas'}
      </span>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Cuentan las fichas activas. Quien está dado de baja no ocupa plaza.
        {limite !== null && ` Tu plan llega a ${limite}.`}
      </p>

      {exceso && (
        // Aviso, no bloqueo: las fichas siguen ahí y se pueden crear más. El
        // icono acompaña al color porque el sistema de diseño no permite
        // distinguir un dato solo por color.
        <p className="mt-1 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-[13px] leading-relaxed text-foreground">
          <TriangleAlert
            className="mt-0.5 size-[16px] flex-none text-accent"
            strokeWidth={1.9}
          />
          <span>
            Tu iglesia ha crecido por encima de tu plan: sobran{' '}
            <strong className="font-semibold">{exceso.sobran}</strong>{' '}
            {exceso.sobran === 1 ? 'persona' : 'personas'}. No se ha bloqueado
            nada y puedes seguir dando de alta, pero conviene subir de plan.
          </span>
        </p>
      )}
    </div>
  );
}

function TarjetaPlan({
  id,
  cuentan,
  periodicidad,
  esActual,
  hayPrecios,
}: {
  id: PlanId;
  cuentan: number;
  periodicidad: Periodicidad;
  esActual: boolean;
  hayPrecios: boolean;
}) {
  const plan = PLANES[id];
  const cabe = plan.limiteMiembros === null || cuentan <= plan.limiteMiembros;

  return (
    <section
      className={
        'flex flex-col gap-3 rounded-xl border bg-surface p-5 ' +
        (esActual ? 'border-foreground' : 'border-border')
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold tracking-[-0.02em]">
          {plan.nombre}
        </h2>
        {esActual && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
            Tu plan
          </span>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {plan.para}
      </p>

      <ul className="flex flex-col gap-1.5">
        {plan.incluye.map((linea) => (
          <li key={linea} className="flex items-start gap-2 text-[13.5px]">
            <Check
              className="mt-0.5 size-[15px] flex-none text-muted-foreground"
              strokeWidth={2}
            />
            {linea}
          </li>
        ))}
      </ul>

      {/* Se dice que este plan NO le sirve antes de que lo elija y descubra el
          aviso después de pagar. */}
      {!cabe && (
        <p className="text-[12.5px] leading-snug text-accent">
          Tu iglesia tiene {cuentan} personas: no cabe en este plan.
        </p>
      )}

      {/* El plan y la periodicidad viajan en campos ocultos y se vuelven a
          validar en la action con Zod. Que estén en el HTML no abre nada: lo
          único que se puede falsear es a qué plan se va, y el precio de cada uno
          lo pone Stripe. */}
      <form action={irAPagar} className="mt-auto">
        <input type="hidden" name="plan" value={id} />
        <input type="hidden" name="periodicidad" value={periodicidad} />
        <Button
          type="submit"
          // Un solo botón naranja por pantalla: el del plan recomendado. Los
          // otros dos, contorno.
          variant={id === 'comunidad' ? 'default' : 'outline'}
          className="w-full"
          disabled={!hayPrecios || esActual}
        >
          {esActual ? 'Es tu plan actual' : `Ver precio de ${plan.nombre}`}
        </Button>
      </form>
    </section>
  );
}
