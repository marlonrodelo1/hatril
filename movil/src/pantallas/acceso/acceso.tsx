import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  Caminos,
  Encabezado,
  Tarjeta,
  claseEnlace,
  claseEnviar,
} from '@/app/(auth)/_components/marco';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { traducirErrorAuth } from '@/lib/auth/password';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { WEB_URL } from '@movil/lib/entorno';
import { supabase } from '@movil/lib/supabase';
import { AccesoNativo } from './acceso-nativo';
import { MarcoAcceso } from './marco-acceso';

/**
 * Entrar, en la app. Es `src/app/(auth)/acceso/page.tsx` con la misma letra.
 *
 * La contraseña va directa a Supabase Auth desde el teléfono, como hacía la
 * action `acceder`, que no hacía nada más que eso: el límite de intentos lo
 * pone Supabase. A dónde va después lo decide el arranque con `/yo`
 * (`../arranque.tsx`), igual que `inicioDe` en la web.
 *
 * «¿Llevas una iglesia?» abre el registro en el navegador: dar de alta una
 * iglesia es pagar una suscripción, y eso no va dentro del binario
 * (`docs/app-nativa/fichas.md` §1).
 */
export function Acceso() {
  const [parametros] = useSearchParams();
  const next = destinoSeguro(parametros.get('next')) ?? undefined;
  const navegar = useNavigate();
  // Un error puede llegar en la dirección, como en la web: desde «Pedir
  // unirme», si la cuenta se creó pero la sesión no se abrió.
  const [error, setError] = useState<string | null>(parametros.get('error'));
  const [enviando, setEnviando] = useState(false);

  const crearCuenta = next ? `/crear-cuenta?next=${encodeURIComponent(next)}` : '/crear-cuenta';

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const email = String(datos.get('email') ?? '').trim().toLowerCase();
    // Sin recortar: una contraseña que termine en espacio dejaría de valer.
    const password = String(datos.get('password') ?? '');
    if (!email) return setError('Escribe tu correo.');
    if (!password) return setError('Escribe tu contraseña.');

    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.auth.signInWithPassword({ email, password });
    setEnviando(false);

    if (fallo) return setError(traducirErrorAuth(fallo.message));
    navegar(next ?? '/', { replace: true });
  }

  return (
    <MarcoAcceso>
      <Encabezado titulo="Entra en tu iglesia">
        Tu comunidad, la agenda y el devocional del día te esperan dentro.
      </Encabezado>

      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}

        <AccesoNativo next={next} alFallar={setError} />

        <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
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
              placeholder="nombre@correo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                to="/recuperar"
                className={`-mx-1.5 -my-1.5 px-1.5 py-1.5 t-label ${claseEnlace}`}
              >
                La he olvidado
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          <Button type="submit" size="lg" className={claseEnviar('mt-2')} disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Tarjeta>

      <Caminos>
        <p>
          ¿Todavía no tienes cuenta?{' '}
          <Link to={crearCuenta} className={claseEnlace}>
            Créala aquí
          </Link>
        </p>
        <p>
          ¿Llevas una iglesia?{' '}
          <a href={`${WEB_URL}/registro`} target="_blank" rel="noopener" className={claseEnlace}>
            Regístrala en Hatril
          </a>
        </p>
      </Caminos>
    </MarcoAcceso>
  );
}
