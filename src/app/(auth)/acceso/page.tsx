import Link from 'next/link';
import type { Metadata } from 'next';

import { acceder } from '../actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = { title: 'Entrar' };

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="t-titulo">Entra en tu iglesia</h1>
        <p className="text-[15px] text-muted-foreground">
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/registro" className="font-semibold">
            Crea la de tu iglesia
          </Link>
          .
        </p>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <form action={acceder} className="flex flex-col gap-4">
        {/* Se arrastra el destino para volver donde iba después de entrar. La
            acción comprueba que sea una ruta interna antes de usarlo. */}
        {next && <input type="hidden" name="next" value={next} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="pastor@tuiglesia.org"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Contraseña</Label>
            <Link href="/recuperar" className="t-label font-medium">
              La he olvidado
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="mt-2">
          Entrar
        </Button>
      </form>
    </div>
  );
}
