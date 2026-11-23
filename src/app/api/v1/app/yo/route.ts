import { conSesion, endpointApp } from '@/lib/api/app';
import type { RespuestaYo } from '@/lib/app-api/yo';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { esDelEquipo, inicioDe } from '@/lib/auth/permisos';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { bajaPendiente } from '@/lib/cuenta/baja';
import { estadoDeDar } from '@/lib/donativos/consultas';
import { radioDeLaIglesia } from '@/lib/emisora/consultas';
import { RAIZ_APP } from '@/lib/ministerios/en-la-app/rutas';
import { miFotoDePerfil } from '@/lib/miembros/foto';
import { estadoConsentimiento } from '@/lib/rgpd/consultas';
import { medir } from '@/lib/peticion';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo primero que pide la app al abrirse, y lo que decide a dónde va.
 *
 * Es `src/app/mi/page.tsx` y `src/app/mi/layout.tsx` en una sola respuesta:
 * el desvío de `/mi` (iglesia, baja o sala de espera), las pestañas de abajo
 * y la radio. La app lo guarda en memoria y no lo vuelve a pedir en cada
 * pestaña.
 *
 * LA GUARDA ES `conSesion`, NO `requireIglesia`
 * ---------------------------------------------
 * Quien espera a que le acepten tiene sesión y no iglesia, y es justo quien
 * más necesita saber en qué punto está. Lo que se lee de la iglesia sale de
 * `getCurrentUserContext()`, que solo devuelve una a quien tiene membresía
 * activa, y la radio y la foto van por `withUser`, con su RLS.
 *
 * Fuera a propósito: el super admin. Su sitio es `/admin`, que no está en la
 * app y solo entiende la sesión de la web. Sin iglesia, la app le enseña la
 * sala de espera, como a cualquiera.
 */
export const GET = endpointApp({ guarda: conSesion }, async ({ ctx: user }) => {
  const ctx = await medir('contexto', getCurrentUserContext);

  if (ctx) {
    // Las tres van a la vez: cada una es su propia transacción, y en serie
    // sumarían sus idas y vueltas a Irlanda.
    const [radio, consentimiento, fotoUrl, dar] = await Promise.all([
      medir('radio', () => radioDeLaIglesia(ctx)),
      medir('consentimiento', () => estadoConsentimiento(ctx)),
      medir('foto', () => miFotoDePerfil(ctx)),
      medir('dar', () => estadoDeDar(ctx.iglesia.id)),
    ]);

    // Igual que el layout de `/mi`: con un equipo, directo a su portada; con
    // varios, a la lista.
    const sirvo = ctx.ministerioIds;
    const equipo =
      sirvo.length === 0 ? null : sirvo.length === 1 ? `${RAIZ_APP}/${sirvo[0]}` : RAIZ_APP;

    const respuesta: RespuestaYo = {
      cuenta: { id: user.id, email: user.email ?? null, nombre: nombreDeLaCuenta(user), fotoUrl },
      situacion: 'iglesia',
      iglesia: {
        id: ctx.iglesia.id,
        slug: ctx.iglesia.slug,
        nombre: ctx.iglesia.nombre,
        ciudad: ctx.iglesia.ciudad,
        logoUrl: ctx.iglesia.logoUrl,
        timezone: ctx.iglesia.timezone,
        comunidad: ctx.iglesia.comunidad,
      },
      consentimientoAlDia: consentimiento.alDia,
      pestanas: { equipo },
      panel: esDelEquipo(ctx) ? inicioDe(ctx) : null,
      radio: radio && { nombre: radio.nombre, streamUrl: radio.streamUrl, parrilla: radio.parrilla },
      dar: dar.conTarjeta || dar.conTransferencia ? dar : null,
      solicitud: null,
      baja: null,
    };
    return respuesta;
  }

  const [baja, solicitud] = await Promise.all([
    medir('baja', () => bajaPendiente(user.id)),
    medir('solicitud', () => solicitudDeUsuario(user.id)),
  ]);

  const respuesta: RespuestaYo = {
    cuenta: { id: user.id, email: user.email ?? null, nombre: nombreDeLaCuenta(user), fotoUrl: null },
    situacion: baja ? 'baja' : 'sin_iglesia',
    iglesia: null,
    consentimientoAlDia: true,
    pestanas: { equipo: null },
    panel: null,
    radio: null,
    dar: null,
    solicitud:
      !baja && solicitud
        ? {
            estado: solicitud.estado,
            motivoRechazo: solicitud.motivoRechazo,
            enviadaEl: solicitud.createdAt.toISOString(),
            iglesia: {
              nombre: solicitud.iglesiaNombre,
              slug: solicitud.iglesiaSlug,
              ciudad: solicitud.iglesiaCiudad,
            },
          }
        : null,
    baja: baja ? { borrarDesde: baja.borrarDesde.toISOString() } : null,
  };
  return respuesta;
});
