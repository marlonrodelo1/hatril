import type { Metadata } from 'next';
import { Check, TriangleAlert, Users } from 'lucide-react';

import { requirePastor } from '@/lib/auth/guard-panel';
import { PLANES, preciosConfigurados, type PlanId } from '@/lib/stripe/client';
import {
  etiquetaEstado,
  leerEstadoSuscripcion,
} from '@/lib/suscripcion/estado';
import {
  excesoDeMiembros,
  miembrosQueCuentan,
} from '@/lib/suscripcion/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';

export const metadata: Metadata = { title: 'Suscripción' };

/**
 * La pantalla que NUNCA se bloquea.
 *
 * Lleva `requirePastor()` en la propia página y **no tiene `layout.tsx`
 * propio**, a propósito. Es la excepción documentada a la regla de que los
 * guards van en el layout: si alguien «arregla» el patrón y le pone un layout
 * que herede el muro de suscripción, la única puerta para pagar queda cerrada
 * justo para quien necesita cruzarla.
 *
 * Y es ruta hermana de `ajustes`, no hija: el muro tiene que preguntar «¿estoy
 * en la ruta que sirve para pagar?», y con una hermana es una comparación de
 * prefijo. Anidada bajo `/panel/ajustes/…` habría que exceptuar a un hijo de una
 * carpeta que sí se bloquea, que es como se cuelan los huecos.
 */
export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; estado?: string }>;
}) {
  const ctx = await requirePastor();
  const { error } = await searchParams;

  const estado = leerEstadoSuscripcion(ctx.iglesia);
  const cuentan = await miembrosQueCuentan(ctx);

  // Si faltan ids de precio en el entorno, se dice AQUÍ y no se pinta un botón
  // que reventaría al pulsarlo. Es el síntoma de un despliegue con variables a
  // medias, y el pastor no tiene por qué descubrirlo con una pantalla de error.
  const precios = preciosConfigurados();

  const planActual: PlanId | null =
    estado.situacion === 'activa' ? estado.plan : null;

  return (
    <>
      <CabeceraPanel titulo="Suscripción" subtitulo={etiquetaEstado(estado)} />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {!precios.ok && (
          <Aviso>
            Falta configurar los precios ({precios.faltan.join(', ')}). Nadie
            puede suscribirse hasta que estén.
          </Aviso>
        )}

        <TarjetaTamano cuentan={cuentan} planActual={planActual} />

        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(PLANES) as PlanId[]).map((id) => (
            <TarjetaPlan
              key={id}
              id={id}
              cuentan={cuentan}
              esActual={planActual === id}
              hayPrecios={precios.ok}
            />
          ))}
        </div>

        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          El precio se muestra antes de pagar, en la pantalla segura de Stripe.
          Puedes cancelar cuando quieras y tu iglesia sigue funcionando hasta el
          final del periodo que hayas pagado.
        </p>
      </Contenedor>
    </>
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
  esActual,
  hayPrecios,
}: {
  id: PlanId;
  cuentan: number;
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

      <Button
        // Un solo botón naranja por pantalla: el del plan recomendado. Los otros
        // dos, contorno.
        variant={id === 'comunidad' ? 'default' : 'outline'}
        className="mt-auto"
        disabled={!hayPrecios || esActual}
      >
        {esActual ? 'Es tu plan actual' : `Ver precio de ${plan.nombre}`}
      </Button>
    </section>
  );
}
