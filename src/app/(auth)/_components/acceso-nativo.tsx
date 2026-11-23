'use client';

import { useState, useSyncExternalStore } from 'react';
import type {
  AppleProviderResponse,
  GoogleLoginResponseOnline,
} from '@capgo/capacitor-social-login';

import { entrarConToken } from '../actions';
import { LogoApple, LogoGoogle } from './logos';
import { Separador } from './separador';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { getPlatform, pluginDisponible } from '@/lib/platform/native-client';

/**
 * Apple y Google dentro de la app, con la ventana nativa del teléfono.
 *
 * El porqué de cada camino está en `lib/auth/acceso-social.ts`. Aquí, lo que
 * cuesta ver desde fuera:
 *
 * - **Qué botones salen se decide en el teléfono**, no en el servidor: el
 *   servidor solo sabe que es la app por el User-Agent, y el mismo User-Agent
 *   lo lleva un build viejo sin el plugin. Sin plugin no sale nada, y quien
 *   tenga ese build entra con su correo como siempre.
 * - **El nonce**: se inventa aquí, a Apple o a Google se le pasa su SHA-256 y
 *   al servidor el original, que Supabase resume otra vez para compararlo con
 *   el del token. En Android no se usa: el plugin no se lo pasa a Google, el
 *   token llega sin él, y Supabase rechaza un nonce que el token no trae.
 */

type Plataforma = 'ios' | 'android' | 'ninguna';

function suscribir(): () => void {
  // El valor no cambia en la vida de la página: o este binario lleva el plugin
  // o no. Mismo patrón que `use-app-mode.ts`.
  return () => {};
}

function plataformaEnCliente(): Plataforma {
  const p = getPlatform();
  if (p === 'web' || !pluginDisponible('SocialLogin')) return 'ninguna';
  return p;
}

function plataformaEnServidor(): Plataforma {
  return 'ninguna';
}

function nonceAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(texto: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cerrar la ventana de Apple o Google no es un error que haya que contar. */
function esCancelacion(err: unknown): boolean {
  const texto =
    err instanceof Error ? `${err.message} ${(err as { code?: unknown }).code ?? ''}` : String(err);
  return /cancel/i.test(texto) || /\b1001\b/.test(texto);
}

/**
 * ¿Lleva este iPhone el esquema de URL de Google en su `Info.plist`? Sin él, la
 * librería de Google cierra la app al pulsar, así que se mira el build antes
 * (`lib/auth/google.ts`). Se pregunta al pulsar y no al pintar porque la
 * respuesta llega tarde, y para un build así basta con explicarlo.
 */
async function buildDeIos(): Promise<number> {
  const { App } = await import('@capacitor/app');
  return Number((await App.getInfo()).build) || 0;
}

export function AccesoNativo({
  google,
  next,
}: {
  google: { web: string; ios: { cliente: string; desdeBuild: number } | null } | null;
  next?: string;
}) {
  const plataforma = useSyncExternalStore(suscribir, plataformaEnCliente, plataformaEnServidor);
  const [ocupado, setOcupado] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conApple = plataforma === 'ios';
  const conGoogle =
    google !== null && (plataforma === 'android' || (plataforma === 'ios' && google.ios !== null));

  if (!conApple && !conGoogle) return null;

  async function entrar(proveedor: 'apple' | 'google') {
    setOcupado(proveedor);
    setError(null);
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const nonce = nonceAleatorio();
      let idToken: string | null = null;
      let nombre: string | undefined;
      let conNonce = true;

      if (proveedor === 'apple') {
        // En iOS el clientId no viaja a ningún sitio: el plugin solo lo usa
        // para saber qué proveedor arrancar. La audiencia del token es el
        // bundle, `app.hatril`, que es lo que tiene apuntado Supabase.
        await SocialLogin.initialize({ apple: { clientId: 'app.hatril' } });
        const res = await SocialLogin.login({
          provider: 'apple',
          options: { scopes: ['email', 'name'], nonce: await sha256(nonce) },
        });
        const r = res.result as AppleProviderResponse;
        idToken = r.idToken;
        // Apple da el nombre UNA vez, la primera. Si se pierde aquí, no vuelve.
        nombre = [r.profile?.givenName, r.profile?.familyName].filter(Boolean).join(' ') || undefined;
      } else if (google) {
        conNonce = plataforma === 'ios';
        if (google.ios && plataforma === 'ios' && (await buildDeIos()) < google.ios.desdeBuild) {
          setOcupado(null);
          setError('Para entrar con Google, actualiza Hatril desde la App Store.');
          return;
        }
        await SocialLogin.initialize({
          google: {
            webClientId: google.web,
            iOSClientId: google.ios?.cliente,
            mode: 'online',
            // Solo hace falta el token de identidad. Pedir además permisos de
            // acceso cuelga el login en el `BridgeActivity` de serie.
            skipAuthOnlyAuthorizationAfterSignIn: true,
          },
        });
        const res = await SocialLogin.login({
          provider: 'google',
          // Sin `scopes` en Android: con el `BridgeActivity` de serie, el
          // plugin rechaza cualquier lista, aunque sea la de siempre.
          options: conNonce ? { nonce: await sha256(nonce) } : {},
        });
        const r = res.result as GoogleLoginResponseOnline;
        idToken = r.idToken;
        nombre = r.profile?.name ?? undefined;
      }

      if (!idToken) throw new Error('sin idToken');

      const resultado = await entrarConToken({
        proveedor,
        idToken,
        nonce: conNonce ? nonce : undefined,
        nombre,
        next,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        setOcupado(null);
        return;
      }
      // Carga completa: lo que venga después tiene que leer ya la sesión nueva.
      window.location.assign(resultado.destino);
    } catch (err) {
      setOcupado(null);
      if (esCancelacion(err)) return;
      setError(
        `No hemos podido abrir ${proveedor === 'apple' ? 'Apple' : 'Google'}. Inténtalo otra vez o entra con tu correo.`,
      );
    }
  }

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex flex-col gap-2.5">
        {conApple && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={ocupado !== null}
            onClick={() => entrar('apple')}
          >
            <LogoApple />
            {ocupado === 'apple' ? 'Abriendo Apple…' : 'Continuar con Apple'}
          </Button>
        )}
        {conGoogle && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={ocupado !== null}
            onClick={() => entrar('google')}
          >
            <LogoGoogle />
            {ocupado === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
          </Button>
        )}
      </div>
      <Separador />
    </>
  );
}
