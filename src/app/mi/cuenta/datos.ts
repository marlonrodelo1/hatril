import 'server-only';

import type { User } from '@supabase/supabase-js';

import type { UserContext } from '@/lib/auth/user-context';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { esDelEquipo, puedeGestionarMinisterio } from '@/lib/auth/permisos';
import { misBloqueos } from '@/lib/comunidad/moderacion';
import { estadoDeDar, misDonativos } from '@/lib/donativos/consultas';
import { donativosDeMiIglesia } from '@/lib/iglesias/donativos';
import { misMinisterios } from '@/lib/ministerios/consultas';
import { miFotoDePerfil } from '@/lib/miembros/foto';
import { estadoConsentimiento } from '@/lib/rgpd/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { vistaDeMisGrupos } from '@/lib/grupos/vista';

/**
 * Lo que consulta Mi cuenta. Lo usan la página de la web y la API de la app
 * (`/api/v1/app/mi/cuenta`). Salió de `./page.tsx` el 20-nov, con sus
 * decisiones: qué nota lleva «Ofrendar», a dónde lleva «Cambiar la
 * contraseña», qué equipos puede gestionar.
 */
export async function datosDeMiCuenta(ctx: UserContext, user: User) {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const [ministerios, donativos, bloqueos, miFoto, consentimiento, dar, grupos] = await Promise.all([
    misMinisterios(ctx),
    donativosDeMiIglesia(ctx),
    misBloqueos(ctx),
    miFotoDePerfil(ctx),
    estadoConsentimiento(ctx),
    estadoDeDar(ctx.iglesia.id),
    // Su célula: quien la lleva, cuándo, la zona y el próximo tema. Nunca la
    // lista de los demás, que la base no le enseña (`0047`).
    vistaDeMisGrupos(ctx, hoy),
  ]);

  /*
   * «Lo que he dado», con el total del año al lado. Solo si hay grupo de
   * Ofrendar que pintar: son tres o cuatro consultas pequeñas, por el índice
   * de donante y solo de esta persona, y no tiene sentido hacerlas donde no
   * hay a dónde dar.
   *
   * La fila sale con tarjeta, o sin ella si la persona ya dio alguna vez: una
   * iglesia que desconecta Stripe no le borra a nadie lo que ya dio. Solo con
   * transferencia y sin nada dado, no: lo de transferencia no pasa por aquí y
   * la pantalla saldría vacía para siempre.
   */
  const hayOfrendar = dar.conTarjeta || donativos !== null;
  const mios = hayOfrendar ? await misDonativos(ctx) : null;
  const yaDio =
    mios !== null &&
    (mios.lista.length > 0 ||
      mios.mensuales.length > 0 ||
      mios.aniosConDatos.some((a) => a !== mios.anio));
  const totalDelAnio = mios ? Number(mios.total) : 0;

  const notaOfrendar =
    dar.conTarjeta && donativos
      ? 'Con tarjeta o por transferencia. El dinero va directo a la iglesia: Hatril no ve tu tarjeta ni se queda comisión.'
      : dar.conTarjeta
        ? 'Con tarjeta, una vez o cada mes. El dinero va directo a la iglesia: Hatril no ve tu tarjeta ni se queda comisión.'
        : `La cuenta de ${ctx.iglesia.nombre}. El dinero va directo a ella: Hatril no cobra nada por su cuenta ni se queda comisión.`;

  const nombre = nombreDeLaCuenta(user);
  const correo = user.email ?? '';

  /*
   * Cambiar la contraseña con la sesión abierta pide la actual, y esa
   * pantalla vive en el panel (`/panel/cuenta/contrasena`, con `requirePanel`):
   * a un miembro raso le devolvería aquí sin decirle nada. Para él, el camino
   * que sí tiene es el del correo, que es la prueba de identidad que le queda.
   * `esDelEquipo` es la misma pregunta que hace la puerta del panel, sin
   * consultar nada.
   */
  const contrasena = esDelEquipo(ctx)
    ? { href: '/panel/cuenta/contrasena', detalle: undefined }
    : { href: '/recuperar', detalle: 'Te mandamos un enlace a tu correo' };

  return {
    iglesia: {
      nombre: ctx.iglesia.nombre,
      slug: ctx.iglesia.slug,
      logoUrl: ctx.iglesia.logoUrl,
      webPublica: ctx.iglesia.webPublica,
    },
    miembroId: ctx.miembroId,
    // Qué equipos abre con herramientas y cuáles solo para ver.
    gestiona: ministerios.filter((m) => puedeGestionarMinisterio(ctx, m.id)).map((m) => m.id),
    ministerios,
    grupos,
    hoy,
    donativos,
    bloqueos,
    miFoto,
    consentimiento,
    dar,
    hayOfrendar,
    mios,
    yaDio,
    totalDelAnio,
    notaOfrendar,
    nombre,
    correo,
    contrasena,
  };
}
