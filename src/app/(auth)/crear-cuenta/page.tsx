import Link from 'next/link';
import type { Metadata } from 'next';

import { crearCuentaPersonal } from '@/app/solicitar/actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_PISTA } from '@/lib/auth/password';

export const metadata: Metadata = { title: 'Crear cuenta' };

/**
 * Cuenta personal, sin iglesia.
 *
 * Distinta de `/registro`, que crea una IGLESIA. La diferencia se dice en la
 * pantalla y no solo en el código: quien busca unirse a su congregación y
 * aterriza en el formulario equivocado acaba fundando una iglesia vacía con el
 * nombre de la suya, y a partir de ahí todo lo que haga estará en el sitio que
 * no es.
 */
export default async function CrearCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="t-titulo">Crea tu cuenta</h1>
        <p className="text-[15px] text-muted-foreground">
          Para unirte a una iglesia que ya está en Hatril.{' '}
          <Link href="/acceso" className="font-semibold">
            Ya tengo cuenta
          </Link>
          .
        </p>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <form action={crearCuentaPersonal} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Tu nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            autoFocus
            maxLength={120}
            autoComplete="name"
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
          <p className="t-label text-muted-foreground">{PASSWORD_PISTA}</p>
        </div>

        <Button type="submit" className="mt-2">
          Crear la cuenta
        </Button>
      </form>

      <p className="rounded-lg border border-border bg-surface p-3.5 text-[13.5px] leading-snug text-muted-foreground">
        ¿Eres pastor y quieres traer tu iglesia a Hatril? Entonces lo que buscas
        es{' '}
        <Link href="/registro" className="font-semibold">
          crear la cuenta de la iglesia
        </Link>
        , que es otra cosa.
      </p>
    </div>
  );
}
