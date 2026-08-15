import Link from 'next/link';
import type { Metadata } from 'next';

import { pedirRecuperacion } from '../actions';
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="t-titulo">Recupera tu contraseña</h1>
        <p className="text-[15px] text-muted-foreground">
          Te mandamos un enlace para elegir una nueva.
        </p>
      </div>

      {error && <Aviso>{error}</Aviso>}

      {enviado ? (
        <>
          {/*
           * Se dice lo mismo exista la cuenta o no.
           *
           * Un «ese correo no está registrado» permitiría a cualquiera
           * comprobar qué direcciones tienen cuenta, y aquí eso equivale a
           * averiguar quién pertenece a una congregación: exactamente el dato
           * del art. 9 que protegemos en todo lo demás.
           */}
          <Aviso tipo="ok">
            Si ese correo tiene cuenta en Hatril, el enlace ya va de camino.
            Revisa también la carpeta de spam.
          </Aviso>
          <Link href="/acceso" className="text-[15px] font-semibold">
            Volver a entrar
          </Link>
        </>
      ) : (
        <form action={pedirRecuperacion} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="pastor@tuiglesia.org"
            />
          </div>

          <Button type="submit" className="mt-2">
            Mandar el enlace
          </Button>

          <Link
            href="/acceso"
            className="text-center text-[14px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            Volver
          </Link>
        </form>
      )}
    </div>
  );
}
