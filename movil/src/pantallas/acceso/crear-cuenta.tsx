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
import { EsquemaCuentaPersonal } from '@/lib/app-api/solicitud';
import { PASSWORD_PISTA, traducirErrorAuth, validarPassword } from '@/lib/auth/password';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { ErrorApi, pedir } from '@movil/lib/api';
import { WEB_URL } from '@movil/lib/entorno';
import { supabase } from '@movil/lib/supabase';
import { AccesoNativo } from './acceso-nativo';
import { MarcoAcceso } from './marco-acceso';

/**
 * Cuenta personal, sin iglesia. Es `src/app/(auth)/crear-cuenta/page.tsx`:
 * la cuenta la crea la API (`/api/v1/app/cuenta`, con el mismo límite y la
 * misma regla de contraseña que la web) y la sesión la abre el teléfono.
 *
 * Distinta de dar de alta una IGLESIA, que se hace en la web: lo dice la
 * pantalla, porque quien se equivoca de formulario acaba fundando una iglesia
 * vacía con el nombre de la suya.
 */
export function CrearCuenta() {
  const [parametros] = useSearchParams();
  const next = destinoSeguro(parametros.get('next')) ?? undefined;
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(parametros.get('error'));
  const [enviando, setEnviando] = useState(false);

  const acceso = next ? `/acceso?next=${encodeURIComponent(next)}` : '/acceso';

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const parsed = EsquemaCuentaPersonal.safeParse({
      nombre: String(datos.get('nombre') ?? '').trim(),
      email: String(datos.get('email') ?? '').trim(),
      password: String(datos.get('password') ?? ''),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    const errorPassword = validarPassword(parsed.data.password);
    if (errorPassword) return setError(errorPassword);

    setEnviando(true);
    setError(null);
    try {
      await pedir('/cuenta', { method: 'POST', datos: parsed.data });
    } catch (e) {
      setEnviando(false);
      return setError(e instanceof ErrorApi ? e.message : 'Algo ha fallado. Inténtalo de nuevo.');
    }

    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setEnviando(false);
    if (fallo) {
      navegar(`${acceso}${acceso.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        `Tu cuenta ya está creada. Entra con tu correo. (${traducirErrorAuth(fallo.message)})`,
      )}`);
      return;
    }
    navegar(next ?? '/', { replace: true });
  }

  return (
    <MarcoAcceso>
      <Encabezado titulo="Crea tu cuenta">Para unirte a una iglesia que ya está en Hatril.</Encabezado>

      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}

        <AccesoNativo next={next} alFallar={setError} />

        <form onSubmit={crear} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Tu nombre</Label>
            <Input id="nombre" name="nombre" required maxLength={120} autoComplete="name" />
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

          <Button type="submit" size="lg" className={claseEnviar('mt-2')} disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear la cuenta'}
          </Button>
        </form>
      </Tarjeta>

      <Caminos>
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link to={acceso} className={claseEnlace}>
            Entra
          </Link>
        </p>
      </Caminos>

      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label leading-snug text-muted-foreground">
        ¿Llevas una iglesia y quieres traerla a Hatril? Entonces lo que buscas es{' '}
        <a href={`${WEB_URL}/registro`} target="_blank" rel="noopener" className={claseEnlace}>
          crear la cuenta de la iglesia
        </a>
        , que es otra cosa.
      </p>
    </MarcoAcceso>
  );
}
