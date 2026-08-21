import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { PASSWORD_PISTA } from '@/lib/auth/password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { cambiarMiPassword } from '../actions';

export const metadata: Metadata = { title: 'Cambiar la contraseña' };

/**
 * Cambiar la contraseña con la sesión abierta.
 *
 * POR QUÉ NO SE REUTILIZA `/reset-password`
 * -----------------------------------------
 * Existía, funcionaba y era alcanzable estando dentro de la sesión: ni el
 * layout de `(auth)` ni el proxy echan a quien ya está identificado. Pero no
 * estaba enlazada desde ninguna parte, así que nadie la encontraba nunca, y
 * sobre todo **no pide la contraseña actual** — no puede, porque a ella se
 * llega con un enlace enviado al correo, y a quien la ha olvidado no se le
 * puede pedir la que olvidó.
 *
 * Enlazarla desde el panel habría convertido «dejarse la sesión abierta» en
 * «perder la cuenta»: cualquiera que se siente delante cambia la contraseña, y
 * como el `signOut()` de Supabase es global, deja fuera al dueño de todos sus
 * dispositivos. Por eso son dos pantallas y dos acciones distintas, cada una
 * con la prueba de identidad que le corresponde.
 */
export default async function CambiarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireIglesia();
  const { error } = await searchParams;

  return (
    <>
      <CabeceraPanel
        titulo="Cambiar la contraseña"
        volver={{ href: '/panel/cuenta', texto: 'Tu cuenta' }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <form action={cambiarMiPassword}>
          <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actual">Tu contraseña actual</Label>
              <Input
                id="actual"
                name="actual"
                type="password"
                required
                autoComplete="current-password"
              />
              <p className="text-[12.5px] text-muted-foreground">
                Se pide para asegurarnos de que eres tú quien está delante.
              </p>
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-5 sm:grid sm:grid-cols-2 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nueva">Contraseña nueva</Label>
                <Input
                  id="nueva"
                  name="nueva"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="repetir">Repítela</Label>
                <Input
                  id="repetir"
                  name="repetir"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {PASSWORD_PISTA.charAt(0).toUpperCase() + PASSWORD_PISTA.slice(1)}.
            </p>

            <Button type="submit" className="self-start">
              Cambiar la contraseña
            </Button>
          </section>
        </form>
      </Contenedor>
    </>
  );
}
