import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { listarMuro } from '@/lib/comunidad/consultas';
import { cuantasDenunciasPendientes } from '@/lib/comunidad/moderacion';
import { porQueNoPuedesPublicar, puedePublicarEnMuro } from '@/lib/comunidad/reglas';
import { devocionalDeHoy, versiculoDelDia } from '@/lib/devocionales/consultas';
import { miFotoDePerfil } from '@/lib/miembros/foto';

/**
 * Lo que consulta el muro. Lo usan la página de la web y la API de la app
 * (`/api/v1/app/mi/comunidad`), para que las dos pidan lo mismo y decidan lo
 * mismo (quién publica, quién modera). Salió de `./page.tsx` el 20-nov.
 */
export async function datosDelMuro(ctx: UserContext) {
  const config = ctx.iglesia.comunidad;
  const puedePublicar = puedePublicarEnMuro(ctx);

  // Con la comunidad apagada no se pide el muro siquiera: no se va a pintar, y
  // son cuatro consultas y una firma de imágenes contra Storage.
  //
  // El versículo y el devocional SÍ se piden aunque el muro esté apagado: no son
  // del muro, son de la iglesia. Apagar la comunidad es cerrar las
  // publicaciones, no dejar a la congregación sin lo que le toca leer hoy.
  const moderador = puedeModerarComunidad(ctx);

  const [muro, versiculo, devocional, miFoto, denuncias] = await Promise.all([
    config.activa ? listarMuro(ctx) : Promise.resolve([]),
    versiculoDelDia(ctx),
    devocionalDeHoy(ctx),
    miFotoDePerfil(ctx),
    // Se cuenta aunque el muro esté apagado: lo denunciado sigue ahí, y quien
    // modera tiene que poder quitarlo antes de volver a encenderlo.
    moderador ? cuantasDenunciasPendientes(ctx) : Promise.resolve(0),
  ]);

  const nombre = nombreDeLaCuenta(ctx.user);

  return {
    iglesiaNombre: ctx.iglesia.nombre,
    config,
    puedePublicar,
    // El porqué, ya escrito: la regla vive en el servidor.
    porQueNo: puedePublicar ? null : porQueNoPuedesPublicar(ctx),
    moderador,
    muro,
    versiculo,
    devocional,
    miFoto,
    denuncias,
    nombre,
  };
}
