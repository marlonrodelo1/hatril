import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { AppleProviderResponse, GoogleLoginResponseOnline } from '@capgo/capacitor-social-login';

import { LogoApple, LogoGoogle } from '@/app/(auth)/_components/logos';
import { Separador } from '@/app/(auth)/_components/separador';
import { Button } from '@/components/ui/button';
import { GOOGLE } from '@/lib/auth/google';
import { getPlatform, pluginDisponible } from '@/lib/platform/native-client';
import { supabase } from '@movil/lib/supabase';

/**
 * Apple y Google con la ventana nativa del teléfono.
 *
 * Es `src/app/(auth)/_components/acceso-nativo.tsx` sin la action de en
 * medio: el token de Apple o Google se canjea por la sesión aquí mismo, con
 * `signInWithIdToken`, que es lo único que hacía `entrarConToken` además de
 * guardar el nombre. El porqué de cada camino (el nonce, Android sin nonce,
 * el build mínimo de iOS) está en ese fichero y en `lib/auth/acceso-social.ts`.
 *
 * Sin el plugin en el binario —o en el navegador, en desarrollo— no sale
 * ningún botón.
 */
type Plataforma = 'ios' | 'android' | 'ninguna';

function plataforma(): Plataforma {
  const p = getPlatform();
  if (p === 'web' || !pluginDisponible('SocialLogin')) return 'ninguna';
  return p;
}

function nonceAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(texto: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('');
}

function esCancelacion(err: unknown): boolean {
  const texto =
    err instanceof Error ? `${err.message} ${(err as { code?: unknown }).code ?? ''}` : String(err);
  return /cancel/i.test(texto) || /\b1001\b/.test(texto);
}

async function buildDeIos(): Promise<number> {
  const { App } = await import('@capacitor/app');
  return Number((await App.getInfo()).build) || 0;
}

/**
 * El nombre que pintan las cabeceras sale de `user_metadata.nombre`. Apple lo
 * da UNA vez, la primera, y si se pierde aquí no vuelve. Es la misma regla que
 * `asegurarNombre` (`lib/auth/acceso-social.ts`), que en la web corría en el
 * servidor con la sesión de la persona; aquí corre con la misma sesión, contra
 * el mismo Auth. Solo se escribe si no había nombre.
 */
async function asegurarNombre(sugerido?: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const actual = user.user_metadata?.nombre;
  if (typeof actual === 'string' && actual.trim()) return;

  const candidato = [sugerido, user.user_metadata?.full_name, user.user_metadata?.name]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find((v) => v.length >= 2);
  if (!candidato) return;

  // Si falla no es motivo para no dejarle entrar: el nombre se cambia en Mi cuenta.
  await supabase.auth.updateUser({ data: { nombre: candidato.slice(0, 120) } });
}

export function AccesoNativo({
  next,
  alFallar,
}: {
  next?: string;
  alFallar: (mensaje: string | null) => void;
}) {
  const [donde] = useState(plataforma);
  const [ocupado, setOcupado] = useState<'apple' | 'google' | null>(null);
  const navegar = useNavigate();

  const conApple = donde === 'ios';
  const conGoogle = donde === 'android' || donde === 'ios';
  if (!conApple && !conGoogle) return null;

  async function entrar(proveedor: 'apple' | 'google') {
    const marca = proveedor === 'apple' ? 'Apple' : 'Google';
    setOcupado(proveedor);
    alFallar(null);
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const nonce = nonceAleatorio();
      let idToken: string | null = null;
      let nombre: string | undefined;
      let conNonce = true;

      if (proveedor === 'apple') {
        await SocialLogin.initialize({ apple: { clientId: 'app.hatril' } });
        const res = await SocialLogin.login({
          provider: 'apple',
          options: { scopes: ['email', 'name'], nonce: await sha256(nonce) },
        });
        const r = res.result as AppleProviderResponse;
        idToken = r.idToken;
        nombre = [r.profile?.givenName, r.profile?.familyName].filter(Boolean).join(' ') || undefined;
      } else {
        conNonce = donde === 'ios';
        if (donde === 'ios' && (await buildDeIos()) < GOOGLE.ios.desdeBuild) {
          setOcupado(null);
          alFallar('Para entrar con Google, actualiza Hatril desde la App Store.');
          return;
        }
        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE.web,
            iOSClientId: GOOGLE.ios.cliente,
            mode: 'online',
            skipAuthOnlyAuthorizationAfterSignIn: true,
          },
        });
        const res = await SocialLogin.login({
          provider: 'google',
          options: conNonce ? { nonce: await sha256(nonce) } : {},
        });
        const r = res.result as GoogleLoginResponseOnline;
        idToken = r.idToken;
        nombre = r.profile?.name ?? undefined;
      }

      if (!idToken) throw new Error('sin idToken');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: proveedor,
        token: idToken,
        nonce: conNonce ? nonce : undefined,
      });
      if (error) {
        setOcupado(null);
        alFallar(`No hemos podido entrar con ${marca}. Inténtalo otra vez o entra con tu correo.`);
        return;
      }

      await asegurarNombre(nombre);
      navegar(next ?? '/', { replace: true });
    } catch (err) {
      setOcupado(null);
      if (esCancelacion(err)) return;
      alFallar(`No hemos podido abrir ${marca}. Inténtalo otra vez o entra con tu correo.`);
    }
  }

  return (
    <>
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
