import type { Metadata } from 'next';

import { requirePastor } from '@/lib/auth/guard-panel';
import type { Periodicidad, PlanId } from '@/lib/stripe/client';
import {
  etiquetaEstado,
  leerEstadoSuscripcion,
} from '@/lib/suscripcion/estado';
import { miembrosQueCuentan } from '@/lib/suscripcion/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { irAlPortal } from './actions';
import { ElegirPlan } from './_components/planes';

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
 *
 * QUÉ PASA CUANDO LA IGLESIA YA ESTÁ BLOQUEADA
 * --------------------------------------------
 * Que el layout del panel no pinta ni esta pantalla ni ninguna: pinta el muro,
 * que enseña **los mismos planes** porque los saca del mismo componente. Así no
 * hay que exceptuar esta ruta de nada —el layout no sabe en qué ruta está, ni
 * puede saberlo— y aun así sigue habiendo una forma de pagar.
 */
export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; estado?: string; periodo?: string }>;
}) {
  const ctx = await requirePastor();
  const { error, estado: resultado, periodo } = await searchParams;

  const estado = leerEstadoSuscripcion(ctx.iglesia);
  const cuentan = await miembrosQueCuentan(ctx);

  const periodicidad: Periodicidad = periodo === 'anual' ? 'anual' : 'mensual';

  const planActual: PlanId | null =
    estado.situacion === 'activa' ? estado.plan : null;

  // Que exista suscripción es lo que decide si hay portal que abrir. Se mira
  // `stripeSubscriptionId` y no el plan: una iglesia que canceló sigue teniendo
  // facturas que descargar y una baja que revertir.
  const hayPortal = ctx.iglesia.stripeSubscriptionId !== null;

  return (
    <>
      <CabeceraPanel titulo="Suscripción" subtitulo={etiquetaEstado(estado)} />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {/* Al volver de Stripe. El plan puede tardar unos segundos en cambiar:
            quien lo escribe es el webhook, no esta vuelta, y decir «ya está»
            cuando la pantalla todavía dice «prueba» confunde más que esperar. */}
        {resultado === 'listo' && (
          <Aviso tipo="ok">
            Pago recibido. Tu plan se activa en unos segundos; si esta pantalla
            aún no lo refleja, vuelve a cargarla.
          </Aviso>
        )}
        {resultado === 'cancelado' && (
          <Aviso tipo="ok">
            No se ha cobrado nada. Puedes elegir plan cuando quieras.
          </Aviso>
        )}

        <ElegirPlan
          cuentan={cuentan}
          periodicidad={periodicidad}
          planActual={planActual}
        />

        {hayPortal && (
          <form action={irAlPortal}>
            <Button type="submit" variant="outline">
              Facturas, tarjeta y baja
            </Button>
          </form>
        )}

        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          El precio se muestra antes de pagar, en la pantalla segura de Stripe.
          Puedes cancelar cuando quieras y tu iglesia sigue funcionando hasta el
          final del periodo que hayas pagado.
        </p>
      </Contenedor>
    </>
  );
}
