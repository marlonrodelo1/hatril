import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import {
  TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO,
  TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS,
} from '@/lib/rgpd/consentimiento';
import { Button } from '@/components/ui/button';
import { salir } from '../(auth)/actions';
import { aceptar } from './actions';

export const metadata: Metadata = { title: 'La política ha cambiado' };

/**
 * Volver a pedir el consentimiento cuando la política cambia de fondo.
 *
 * FUERA DE `/panel`, Y ESO ES LO QUE EVITA EL BUCLE
 * -------------------------------------------------
 * El corte vive en `panel/layout.tsx`. Si esta pantalla colgara de ahí, se
 * redirigiría a sí misma para siempre. Colgando de la raíz, quien tiene el
 * consentimiento caducado puede llegar aquí, leer y decidir.
 *
 * SE DICE QUÉ HA CAMBIADO, NO SOLO QUE HA CAMBIADO
 * -------------------------------------------------
 * «Hemos actualizado nuestra política, acepta para continuar» es la fórmula que
 * todo el mundo pulsa sin leer, y un consentimiento que nadie ha leído no es
 * válido aunque esté marcado (art. 7.2). Aquí se enumera lo que se añadió desde
 * la versión anterior, en tres líneas y en castellano.
 */
export default async function AceptaPage() {
  const ctx = await requireIglesia();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-12 sm:px-5">
        <div className="flex flex-col gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" strokeWidth={1.7} />
          </span>
          <h1 className="t-titulo">Ha cambiado lo que guardamos de ti</h1>
          <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Aceptaste una versión anterior de la política de{' '}
            <strong className="font-semibold text-foreground">
              {ctx.iglesia.nombre}
            </strong>{' '}
            en Hatril. Desde entonces el producto guarda cosas que aquel texto
            no nombraba, así que hay que preguntártelo otra vez. Tarda un
            minuto.
          </p>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">Qué es lo nuevo</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-relaxed">
            <li>
              <strong className="font-semibold">
                Si vienes o no a las reuniones.
              </strong>{' '}
              Tu iglesia puede apuntar quién vino a cada culto, y ver quién
              lleva tiempo sin aparecer para poder llamarle.
            </li>
            <li>
              <strong className="font-semibold">
                Lo que se habla contigo en ese caso.
              </strong>{' '}
              Se elige de una lista cerrada —hablamos, no contestó, se mudó…— y
              nadie escribe ahí nada sobre tu salud ni tu vida privada.
            </li>
            <li>
              <strong className="font-semibold">El libro de cuentas</strong> de
              tu iglesia y las{' '}
              <strong className="font-semibold">listas de los eventos</strong>{' '}
              abiertos. Ninguno de los dos guarda cuánto da cada persona.
            </li>
          </ul>
          <p className="t-label text-muted-foreground">
            Está todo en{' '}
            <Link href="/privacidad" className="underline">
              la política de privacidad
            </Link>
            , que puedes leer entera antes de decidir.
          </p>
        </section>

        <form action={aceptar} className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            {/*
             * La primera no es una casilla: aceptarla es pulsar el botón. Una
             * casilla obligatoria que hay que marcar para poder marcar el botón
             * es teatro, y además enseña a marcar sin leer, que es justo lo que
             * arruina la casilla de al lado.
             */}
            <p className="text-pretty text-[14.5px] leading-relaxed">
              {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}
            </p>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-background has-checked:border-primary has-checked:bg-accent">
              {/*
               * SIN `defaultChecked`, y no es un olvido: el considerando 32 del
               * RGPD dice que el silencio, las casillas ya marcadas y la
               * inacción NO constituyen consentimiento. Premarcarla la
               * invalidaría entera, justo en el dato más sensible del producto.
               *
               * Tampoco se premarca a quien ya la tenía aceptada: esta pantalla
               * sale porque el texto ha cambiado, así que lo que aceptó antes
               * era de otra redacción y hay que volver a preguntarlo de cero.
               */}
              <input type="checkbox" name="asistencia" className="mt-0.5" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[14.5px] font-semibold">
                  Que se apunte si vengo y lo que se habla conmigo
                </span>
                <span className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
                  {TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO}
                </span>
                <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
                  Si no la marcas, no sales en las listas de asistencia ni de
                  seguimiento de tu iglesia, y se borra lo que ya hubiera
                  apuntado de ti en ellas. Todo lo demás sigue igual.
                </span>
              </span>
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Acepto y sigo</Button>
            {/* Un formulario aparte: anidar formularios no es válido en HTML y
                el navegador lo resuelve como le parece. */}
          </div>
        </form>

        <form action={salir}>
          <Button type="submit" variant="ghost">
            Ahora no, cerrar sesión
          </Button>
        </form>

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Puedes retirar cualquiera de los dos permisos cuando quieras
          escribiendo a tu iglesia o a{' '}
          <a href="mailto:hola@hatril.app" className="underline">
            hola@hatril.app
          </a>
          . Lo que ya pasó antes sigue siendo válido — lo dice el artículo 7.3
          del RGPD.
        </p>
      </main>
    </div>
  );
}
