import Link from 'next/link';
import type { Metadata } from 'next';

import { crearCuentaPersonal } from '@/app/solicitar/actions';
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
import { PASSWORD_PISTA } from '@/lib/auth/password';
import { destinoSeguro } from '@/lib/url/destino-seguro';

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
  const parametros = await searchParams;
  const { error } = parametros;
  // Igual que en el acceso: solo una ruta nuestra llega al campo oculto.
  const next = destinoSeguro(parametros.next) ?? undefined;

  // De vuelta al acceso con el mismo destino: quien ya tenía cuenta y pulsó
  // aquí por error no debe perder la iglesia a la que iba.
  const acceso = next ? `/acceso?next=${encodeURIComponent(next)}` : '/acceso';

  return (
    <>
      <Encabezado titulo="Crea tu cuenta">
        Para unirte a una iglesia que ya está en Hatril.
      </Encabezado>

      <Tarjeta>
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
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
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
              aria-describedby="password-pista"
            />
            <p id="password-pista" className="t-label text-muted-foreground">
              {PASSWORD_PISTA}
            </p>
          </div>

          <Button type="submit" size="lg" className={claseEnviar('mt-2')}>
            Crear la cuenta
          </Button>
        </form>
      </Tarjeta>

      <Caminos>
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link href={acceso} className={claseEnlace}>
            Entra
          </Link>
        </p>
      </Caminos>

      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label leading-snug text-muted-foreground">
        ¿Llevas una iglesia y quieres traerla a Hatril? Entonces lo que buscas
        es{' '}
        <Link href="/registro" className={claseEnlace}>
          crear la cuenta de la iglesia
        </Link>
        , que es otra cosa.
      </p>
    </>
  );
}
