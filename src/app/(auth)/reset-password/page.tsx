import type { Metadata } from 'next';

import { cambiarPassword } from '../actions';
import { Encabezado, Tarjeta, claseEnviar } from '../_components/marco';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_PISTA } from '@/lib/auth/password';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <Encabezado titulo="Elige una contraseña nueva">
        Al guardarla entrarás directamente en tu iglesia.
      </Encabezado>

      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}

        <form action={cambiarPassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña nueva</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              aria-describedby="password-pista"
            />
            <p id="password-pista" className="t-label text-muted-foreground">
              {PASSWORD_PISTA}
            </p>
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

          <Button type="submit" size="lg" className={claseEnviar('mt-2')}>
            Guardar y entrar
          </Button>
        </form>
      </Tarjeta>
    </>
  );
}
