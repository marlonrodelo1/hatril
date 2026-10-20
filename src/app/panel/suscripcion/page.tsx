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
 * La pantalla de pagar, que nunca puede quedarse sin salida.
 *
 * Lleva `requirePastor()`, y con él la puerta entera del panel, como toda
 * página (CLAUDE.md, «La guarda va en CADA página»). Esa puerta incluye el
 * muro, y no cierra nada: en `solo_lectura` esta pantalla sigue abierta y sus
 * actions van con `sinMuro`; en `bloqueada` la guarda manda a `/suscripcion`,
 * fuera del panel.
 *
 * Lo que no puede llevar es una guarda que corte MÁS que el panel —un
 * `layout.tsx` propio con otro muro, algo que pare también `solo_lectura`—:
 * cerraría la única puerta para pagar justo a quien necesita cruzarla.
 *
 * Y es ruta hermana de `ajustes`, no hija: el muro tiene que preguntar «¿estoy
 * en la ruta que sirve para pagar?», y con una hermana es una comparación de
 * prefijo. Anidada bajo `/panel/ajustes/…` habría que exceptuar a un hijo de una
 * carpeta que sí se bloquea, que es como se cuelan los huecos.
 *
 * QUÉ PASA CUANDO LA IGLESIA YA ESTÁ BLOQUEADA
 * --------------------------------------------
 * Que ni esta pantalla ni ninguna del panel se pinta: la guarda redirige a
 * `/suscripcion`, que enseña **los mismos planes** porque los saca del mismo
 * componente, y devuelve aquí en cuanto vuelve a haber acceso. Las dos miran la
 * misma condición, negada, y eso es lo que impide que se llamen en bucle.
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
