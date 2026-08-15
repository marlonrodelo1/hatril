import type { Metadata } from 'next';

import { cambiarPassword } from '../actions';
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="t-titulo">Elige una contraseña nueva</h1>
        <p className="text-[15px] text-muted-foreground">
          Al guardarla entrarás directamente en el panel.
        </p>
      </div>

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
          />
          <p className="t-label text-muted-foreground">{PASSWORD_PISTA}</p>
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

        <Button type="submit" className="mt-2">
          Guardar y entrar
        </Button>
      </form>
    </div>
  );
}
