import Link from 'next/link';
import type { Metadata } from 'next';

import { acceder } from '../actions';
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
import { destinoSeguro } from '@/lib/url/destino-seguro';

export const metadata: Metadata = { title: 'Entrar' };

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const parametros = await searchParams;
  const { error } = parametros;
  // Lo que no sea una ruta nuestra ni se pinta: así no viaja en el formulario
  // ni en el enlace a crear cuenta. La acción lo vuelve a comprobar igual.
  const next = destinoSeguro(parametros.next) ?? undefined;

  // Quien llega aquí desde «pedir unirme» y todavía no tiene cuenta tiene que
  // volver a esa iglesia después de crearla, no aterrizar en el directorio.
  // `/crear-cuenta` acepta el mismo `next` y lo comprueba igual que el acceso.
  const crearCuenta = next
    ? `/crear-cuenta?next=${encodeURIComponent(next)}`
    : '/crear-cuenta';

  return (
    <>
      <Encabezado titulo="Entra en tu iglesia">
        Tu comunidad, la agenda y el devocional del día te esperan dentro.
      </Encabezado>

      <Tarjeta>
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
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
              placeholder="nombre@correo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              {/* Con relleno y margen negativo: la zona que se pulsa crece
                  hasta unos 30 px de alto sin mover la fila. */}
              <Link
                href="/recuperar"
                className={`-mx-1.5 -my-1.5 px-1.5 py-1.5 t-label ${claseEnlace}`}
              >
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

          <Button type="submit" size="lg" className={claseEnviar('mt-2')}>
            Entrar
          </Button>
        </form>
      </Tarjeta>

      <Caminos>
        <p>
          ¿Todavía no tienes cuenta?{' '}
          <Link href={crearCuenta} className={claseEnlace}>
            Créala aquí
          </Link>
        </p>
        <p>
          ¿Llevas una iglesia?{' '}
          <Link href="/registro" className={claseEnlace}>
            Regístrala en Hatril
          </Link>
        </p>
      </Caminos>
    </>
  );
}
