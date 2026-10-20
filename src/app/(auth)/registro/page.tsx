import Link from 'next/link';
import type { Metadata } from 'next';

import { registrar } from '../actions';
import { Aviso } from '@/components/aviso';
import { CasillaAsistencia } from '@/components/casilla-asistencia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_PISTA } from '@/lib/auth/password';
import { DATOS_RESPONSABLE } from '@/lib/legal/datos-responsable';
import { TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS } from '@/lib/rgpd/consentimiento';

export const metadata: Metadata = { title: 'Crea tu iglesia' };

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="t-titulo">Crea la cuenta de tu iglesia</h1>
        <p className="text-[15px] text-muted-foreground">
          Siete días de prueba, sin tarjeta.{' '}
          <Link href="/acceso" className="font-semibold">
            Ya tengo cuenta
          </Link>
          .
        </p>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <form action={registrar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombreIglesia">Nombre de la iglesia</Label>
          <Input
            id="nombreIglesia"
            name="nombreIglesia"
            required
            autoFocus
            maxLength={120}
            placeholder="Iglesia Cristiana Betania"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pais">País</Label>
            {/* Un `select` nativo y no el de shadcn: define la zona horaria y la
                moneda de la iglesia, así que tiene que viajar en el FormData de
                la server action. El de shadcn guarda el valor en estado de
                React y no envía nada sin un input oculto de por medio. */}
            <select
              id="pais"
              name="pais"
              defaultValue="CO"
              className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            >
              <option value="CO">Colombia</option>
              <option value="ES">España</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" name="ciudad" maxLength={120} placeholder="Bogotá" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombrePastor">Tu nombre</Label>
          <Input
            id="nombrePastor"
            name="nombrePastor"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Brandon Márquez"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="pastor@tuiglesia.org"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
          />
          {/* La regla se enseña ANTES de escribir, no después de fallar. */}
          <p className="t-label text-muted-foreground">{PASSWORD_PISTA}</p>
        </div>

        {/*
         * Consentimiento del art. 9 del RGPD.
         *
         * Sin marcar, no se crea nada: es la base jurídica que permite tratar
         * el vínculo religioso. Va desmarcado y no se puede premarcar — un
         * consentimiento que llega marcado de fábrica no es válido (art. 7.2 y
         * considerando 32). Y por eso es una casilla suya, separada de los
         * términos: mezclarlo con «acepto las condiciones» tampoco valdría.
         *
         * Responde al marcarla igual que la de asistencia de debajo: dos
         * casillas vecinas que se comportan distinto parecen de dos sitios. Y
         * por eso el enlace cambia de color: el naranja sobre el fondo marcado
         * da 4.15:1 y sobre el de `hover` 4.32; `accent-foreground`, 5.6.
         */}
        <label className="group/consentimiento mt-1 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
          {/* `aria-label` con el texto del consentimiento, exacto: sin él la
              casilla se anunciaba como «on», y deducido del `<label>` se
              llevaría pegado «Leer la política de privacidad», que es un
              enlace y no parte de lo que se acepta. */}
          <input
            type="checkbox"
            id="consentimiento"
            name="consentimiento"
            required
            aria-label={TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}
            className="mt-0.5"
          />
          <span className="text-[13.5px] leading-snug text-muted-foreground">
            {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}{' '}
            <Link href="/privacidad" target="_blank" className="font-semibold group-hover/consentimiento:text-accent-foreground group-has-checked/consentimiento:text-accent-foreground">
              Leer la política de privacidad
            </Link>
            .
          </span>
        </label>

        {/*
         * La casilla de `/acepta` y `/solicitar`, también aquí.
         *
         * Sin ella, el pastor quedaba con la política vigente aceptada y sin
         * el permiso de asistencia, que `miembrosSinPermisoDeAsistencia` lee
         * como «dijo que no»: quien registraba la iglesia no salía en la lista
         * de su propio culto. Ahora lo dice él, como cualquier otro.
         */}
        <CasillaAsistencia
          consecuencia={
            <>
              Puedes crear la iglesia igual sin marcarla. Entonces no sales en
              las listas de asistencia ni de seguimiento de tu iglesia.
            </>
          }
        />

        {/*
         * Cómo se cambia de idea, que es lo que promete el texto legal («puedo
         * retirar este permiso cuando quiera») y la línea de `/acepta`. Aquí
         * solo con el correo de Hatril: a quien registra la iglesia, «escribe
         * a tu iglesia» le manda a sí mismo. Y dice «dar» además de «retirar»,
         * porque hoy no hay pantalla para ninguna de las dos cosas: `/acepta`
         * solo sale cuando cambia la versión de la política.
         */}
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Para dar o retirar cualquiera de los dos permisos más adelante,
          escríbenos a{' '}
          <a href={`mailto:${DATOS_RESPONSABLE.email}`} className="underline">
            {DATOS_RESPONSABLE.email}
          </a>
          . Lo que ya pasó antes sigue siendo válido.
        </p>

        <Button type="submit" className="mt-1">
          Crear la iglesia
        </Button>
      </form>
    </div>
  );
}
