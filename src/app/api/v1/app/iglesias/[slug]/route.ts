import { endpointApp, errorApp, publica } from '@/lib/api/app';
import type { RelacionConIglesia, RespuestaFicha } from '@/lib/app-api/iglesias';
import { usuarioActual } from '@/lib/auth/usuario';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { fichaDeIglesia } from '@/lib/iglesias/directorio';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { mapasConfigurados } from '@/lib/lugares/mapa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La ficha de una iglesia del directorio (`/iglesia/[slug]`) y lo que hace
 * falta para pedir entrar en ella (`/solicitar/[slug]`).
 *
 * PÚBLICA, CON SESIÓN SI LA HAY
 * -----------------------------
 * La ficha es la de la página pública de la web: la ve cualquiera, con o sin
 * sesión. Si la petición trae token, se dice además qué tiene que ver esa
 * persona con la iglesia —lo que en la web decidía la página para pintar
 * «Pedir unirme» o no—. Eso solo cuenta cosas de la propia cuenta: si
 * pertenece a esta iglesia, a otra o tiene una solicitud. De la congregación,
 * nada.
 */
export const GET = endpointApp({ guarda: publica }, async ({ params }) => {
  const slug = params.slug ?? '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return errorApp('Esto no existe.', 404);

  const iglesia = await fichaDeIglesia(slug);
  if (!iglesia) return errorApp('Esto no existe.', 404);

  const user = await usuarioActual();
  let relacion: RelacionConIglesia = 'sin_sesion';
  let pendienteEn: RespuestaFicha['pendienteEn'] = null;
  let miIglesia: string | null = null;

  if (user) {
    const [ctx, solicitud] = await Promise.all([getCurrentUserContext(), solicitudDeUsuario(user.id)]);
    if (ctx) {
      relacion = ctx.iglesia.id === iglesia.id ? 'de_esta' : 'de_otra';
      miIglesia = ctx.iglesia.nombre;
    } else if (solicitud?.estado === 'pendiente') {
      relacion = 'pendiente';
      pendienteEn = { nombre: solicitud.iglesiaNombre, slug: solicitud.iglesiaSlug };
    } else relacion = 'libre';
  }

  const nombre = user?.user_metadata?.nombre;

  const respuesta: RespuestaFicha = {
    iglesia: {
      slug: iglesia.slug,
      nombre: iglesia.nombre,
      denominacion: iglesia.denominacion,
      descripcion: iglesia.descripcion,
      ciudad: iglesia.ciudad,
      pais: iglesia.pais,
      direccion: iglesia.direccion,
      telefono: iglesia.telefono,
      email: iglesia.email,
      logoUrl: iglesia.logoUrl,
      bannerUrl: iglesia.bannerUrl,
      horarios: iglesia.horarios,
      timezone: iglesia.timezone,
      latitud: iglesia.latitud,
      longitud: iglesia.longitud,
      aceptaSolicitudes: iglesia.aceptaSolicitudes,
      webPublica: iglesia.webPublica,
    },
    relacion,
    mapas: mapasConfigurados(),
    pendienteEn,
    miIglesia,
    nombreSugerido: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
  };
  return respuesta;
});
