import { entrarConGoogle } from '../actions';
import { AccesoNativo } from './acceso-nativo';
import { LogoGoogle } from './logos';
import { Separador } from './separador';
import { Button } from '@/components/ui/button';
import { configGoogle } from '@/lib/auth/acceso-social';
import { isNativeApp } from '@/lib/platform/is-native-app';

/**
 * Los botones de «Continuar con…» de `/acceso` y `/crear-cuenta`, encima del
 * formulario del correo.
 *
 * En la web, Google con un formulario de servidor (funciona sin JavaScript y
 * no hay nada que esperar a que cargue). En la app, el componente de cliente
 * con la ventana nativa: Google no deja entrar desde un WebView, y Apple solo
 * se ofrece en el iPhone. Por qué cada cosa, en `lib/auth/acceso-social.ts`.
 *
 * Sin `GOOGLE_WEB_CLIENT_ID` no sale nada en la web: un botón que lleva a un
 * error es peor que no tenerlo.
 */
export async function AccesoSocial({
  next,
  vuelta,
}: {
  next?: string;
  vuelta: '/acceso' | '/crear-cuenta';
}) {
  const google = configGoogle();

  if (await isNativeApp()) {
    return <AccesoNativo google={google} next={next} />;
  }

  if (!google) return null;

  return (
    <>
      <form action={entrarConGoogle}>
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="vuelta" value={vuelta} />
        <Button type="submit" variant="outline" size="lg" className="w-full">
          <LogoGoogle />
          Continuar con Google
        </Button>
      </form>
      <Separador />
    </>
  );
}
