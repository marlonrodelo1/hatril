import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, inicioDe } from '@/lib/auth/permisos';
import type { Periodicidad } from '@/lib/stripe/client';
import {
  etiquetaEstado,
  leerEstadoSuscripcion,
} from '@/lib/suscripcion/estado';
import { miembrosQueCuentan } from '@/lib/suscripcion/consultas';
import { Aviso } from '@/components/aviso';
import { ElegirPlan } from '../panel/suscripcion/_components/planes';

export const metadata: Metadata = { title: 'Suscripción' };

/**
 * El muro: lo que ve una iglesia que se ha quedado sin acceso.
 *
 * POR QUÉ ESTÁ FUERA DE `/panel` Y NO DENTRO
 * ------------------------------------------
 * Porque el layout del panel es quien manda aquí, y un muro dentro de `/panel`
 * se redirigiría a sí mismo para siempre. Es el mismo bucle que obligó a sacar
 * `exigirConsentimientoAlDia()` de `requireIglesia()`, y la misma solución: la
 * pantalla que permite SALIR de un estado no puede vivir detrás del guard que
 * lo impone.
 *
 * Y no se resuelve mirando la ruta desde el layout, porque no se puede: un
 * layout de Next no recibe `searchParams` y **no se vuelve a ejecutar al
 * navegar** (`03-file-conventions/layout.md`). Un muro pintado ahí dentro se
 * esquivaría con un clic del menú.
 *
 * LAS DOS PUERTAS, EN LOS DOS SENTIDOS
 * ------------------------------------
 *   `/panel/*`      → si está bloqueada, aquí.
 *   `/suscripcion`  → si NO está bloqueada, de vuelta al panel.
 *
 * Ninguna de las dos puede dispararse a la vez que la otra, porque las dos
 * miran la misma función y la condición es la contraria. Esa simetría es lo que
 * evita el bucle, y por eso las dos consultan `leerEstadoSuscripcion()` y no un
 * booleano suelto por ahí.
 */
export default async function MuroSuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; periodo?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, periodo } = await searchParams;

  const estado = leerEstadoSuscripcion(ctx.iglesia);

  // Quien todavía tiene acceso no pinta nada aquí. Ojo con la condición: es
  // `bloqueada` y no `!puedeEscribir()`, porque en `solo_lectura` el panel sigue
  // navegable a propósito —los tres días de gracia— y mandar ahí a una iglesia
  // que aún puede consultar sus datos un domingo por la mañana sería justo lo
  // que la gracia existe para evitar.
  if (estado.situacion !== 'bloqueada') {
    redirect(esPastor(ctx) ? '/panel/suscripcion' : inicioDe(ctx));
  }

  const pastor = esPastor(ctx);
  const periodicidad: Periodicidad = periodo === 'anual' ? 'anual' : 'mensual';
  const cuentan = pastor ? await miembrosQueCuentan(ctx) : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-12 sm:px-8">
      {error && <Aviso>{error}</Aviso>}

      <div className="flex flex-col gap-3">
        <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface">
          <Lock className="size-[18px] text-muted-foreground" strokeWidth={1.8} />
        </span>
        <h1 className="text-[26px] font-bold tracking-[-0.02em]">
          {ctx.iglesia.nombre}
        </h1>
        <p className="max-w-prose text-[14.5px] leading-relaxed text-muted-foreground">
          {etiquetaEstado(estado)} Nada se ha borrado: las fichas, los
          ministerios y las cuentas siguen donde estaban.
        </p>
      </div>

      {pastor ? (
        <ElegirPlan
          cuentan={cuentan}
          periodicidad={periodicidad}
          // Sin plan actual: quien llega aquí no tiene ninguno vigente, y
          // marcar uno como «el tuyo» sería decirle que tiene lo que acaba de
          // perder.
          planActual={null}
          base="/suscripcion"
        />
      ) : (
        // A quien no es pastor no se le enseñan planes: no puede contratarlos, y
        // ponerle un botón que le va a rebotar es hacerle perder el tiempo dos
        // veces. Se le dice quién lo resuelve y se le deja su área, que sigue
        // siendo suya.
        <div className="flex flex-col gap-3">
          <p className="max-w-prose text-[14px] leading-relaxed">
            Esto lo resuelve el pastor de la congregación desde su panel.
          </p>
          <Link
            href="/mi"
            className="w-fit rounded-lg border border-border bg-surface px-4 py-2 text-[13.5px] font-medium hover:bg-muted"
          >
            Ir a mi área
          </Link>
        </div>
      )}
    </div>
  );
}
