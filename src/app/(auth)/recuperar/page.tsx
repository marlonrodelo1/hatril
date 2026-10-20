import Link from 'next/link';
import type { Metadata } from 'next';

import { pedirRecuperacion } from '../actions';
import {
  Caminos,
  Encabezado,
  Tarjeta,
  claseEnlace,
  claseEnviar,
} from '../_components/marco';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = { title: 'Recuperar la contraseña' };

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  return (
    <>
      <Encabezado titulo="Recupera tu contraseña">
        Te mandamos un enlace para elegir una nueva.
      </Encabezado>

      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}

        {enviado ? (
          /*
           * Se dice lo mismo exista la cuenta o no.
           *
           * Un «ese correo no está registrado» permitiría a cualquiera
           * comprobar qué direcciones tienen cuenta, y aquí eso equivale a
           * averiguar quién pertenece a una congregación: exactamente el dato
           * del art. 9 que protegemos en todo lo demás.
           */
          <Aviso tipo="ok">
            Si ese correo tiene cuenta en Hatril, el enlace ya va de camino.
            Revisa también la carpeta de spam.
          </Aviso>
        ) : (
          <form action={pedirRecuperacion} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                autoComplete="email"
                placeholder="nombre@correo.com"
              />
            </div>

            <Button type="submit" size="lg" className={claseEnviar('mt-2')}>
              Mandar el enlace
            </Button>
          </form>
        )}
      </Tarjeta>

      <Caminos>
        <p>
          {!enviado && <>¿Ya te has acordado?{' '}</>}
          <Link href="/acceso" className={claseEnlace}>
            Volver a entrar
          </Link>
        </p>
      </Caminos>
    </>
  );
}
