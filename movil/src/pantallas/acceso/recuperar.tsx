import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Caminos, Encabezado, Tarjeta, claseEnlace, claseEnviar } from '@/app/(auth)/_components/marco';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EsquemaRecuperar } from '@/lib/app-api/solicitud';
import { ErrorApi, pedir } from '@movil/lib/api';
import { MarcoAcceso } from './marco-acceso';

/**
 * «He olvidado la contraseña». Es `src/app/(auth)/recuperar/page.tsx`. El
 * correo lo manda la API (`/api/v1/app/cuenta/recuperar`), y su enlace abre la
 * WEB, donde se elige la nueva; luego se entra en la app con ella.
 *
 * Se dice lo mismo exista la cuenta o no: un «ese correo no está registrado»
 * dejaría averiguar quién pertenece a una congregación.
 */
export function Recuperar() {
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function mandar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const parsed = EsquemaRecuperar.safeParse({
      email: String(new FormData(evento.currentTarget).get('email') ?? '').trim(),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);

    setEnviando(true);
    setError(null);
    try {
      await pedir('/cuenta/recuperar', { method: 'POST', datos: parsed.data });
      setEnviado(true);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Algo ha fallado. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso>
      <Encabezado titulo="Recupera tu contraseña">Te mandamos un enlace para elegir una nueva.</Encabezado>

      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}

        {enviado ? (
          <Aviso tipo="ok">
            Si ese correo tiene cuenta en Hatril, el enlace ya va de camino. Revisa también la carpeta de
            spam.
          </Aviso>
        ) : (
          <form onSubmit={mandar} className="flex flex-col gap-4" noValidate>
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
                placeholder="nombre@correo.com"
              />
            </div>

            <Button type="submit" size="lg" className={claseEnviar('mt-2')} disabled={enviando}>
              {enviando ? 'Mandando…' : 'Mandar el enlace'}
            </Button>
          </form>
        )}
      </Tarjeta>

      <Caminos>
        <p>
          {!enviado && <>¿Ya te has acordado? </>}
          <Link to="/acceso" className={claseEnlace}>
            Volver a entrar
          </Link>
        </p>
      </Caminos>
    </MarcoAcceso>
  );
}
