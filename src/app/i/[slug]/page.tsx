import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { redesParaPintar } from '@/lib/iglesias/redes';
import { eventosPublicos } from '@/lib/eventos/publica';
import type { Moneda } from '@/lib/db/schema';
import { iniciales } from '@/lib/format/iniciales';
import { devocionalPublico } from '@/lib/devocionales/consultas';
import { pulsoDelMuro } from '@/lib/comunidad/consultas';
import { radioPublica } from '@/lib/emisora/consultas';
import { CabeceraIglesia } from './_components/cabecera';
import { SeccionPortada } from './_components/seccion-portada';
import { SeccionHorarios } from './_components/seccion-horarios';
import { SeccionEventos } from './_components/seccion-eventos';
import { SeccionDevocional } from './_components/seccion-devocional';
import { SeccionRadio } from './_components/seccion-radio';
import { SeccionGrupos } from './_components/seccion-grupos';
import { SeccionComunidad } from './_components/seccion-comunidad';
import { chatDeWhatsapp, SeccionContacto } from './_components/seccion-contacto';
import { PieIglesia } from './_components/pie';

/**
 * La web pública de una iglesia.
 *
 * ISR de 60 segundos: es una página que cambia dos veces al año y que puede
 * recibir una punta de visitas cuando la congregación la comparte por WhatsApp.
 * Sin esto, cada visita sería dos consultas a Irlanda.
 *
 * El `revalidate` hay que ponerlo explícito porque las consultas van por Drizzle
 * y no por `fetch`: Next no las ve y trataría la página como dinámica.
 *
 * QUÉ TRAE DATOS DE VERDAD Y QUÉ NO
 * ---------------------------------
 * Los grupos son los ministerios reales de la iglesia. Del diseño faltan tres
 * bloques y los tres por el mismo motivo —no hay de dónde sacarlos todavía—:
 *
 *   - «El domingo pasado vinieron 142 personas»  → asistencias (v2)
 *   - La agenda de lo próximo                    → eventos (v2)
 *   - El desglose de en qué se gasta lo donado   → finanzas (v2)
 *
 * Se dejan fuera enteros en vez de rellenarlos con cifras de ejemplo. Esta es
 * la página que la iglesia enseña a quien no la conoce: un dato inventado aquí
 * no es un detalle de maqueta, es la primera impresión.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) return { title: 'Iglesia no encontrada' };

  const descripcion =
    iglesia.descripcion ??
    `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}. Horarios, grupos y cómo llegar.`;

  return {
    // `absolute` para saltarse la plantilla «%s · Hatril»: esta es la web de la
    // iglesia, no una pantalla de nuestro producto. Que su nombre salga en la
    // pestaña acompañado de nuestra marca es apropiarse de algo que no es
    // nuestro.
    title: { absolute: `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}` },
    description: descripcion,
    openGraph: {
      title: iglesia.nombre,
      description: descripcion,
      type: 'website',
      images: iglesia.imagenes[0] ? [iglesia.imagenes[0]] : undefined,
    },
  };
}

export default async function WebIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) notFound();

  const destacado = iglesia.horarios.find((h) => h.destacado);
  // «Lo próximo» ya no se calcula aquí: lo hace `SeccionHorarios` en el
  // cliente, con la hora de la iglesia, porque esta página se sirve guardada
  // (ISR) y una hora calculada al generarla puede llevar horas caducada.
  const devocional = await devocionalPublico(iglesia.id, iglesia.timezone);
  const pulso = await pulsoDelMuro(iglesia.id);
  // Con el WhatsApp de un número también: es un botón de la sección de
  // contacto, y una iglesia que solo ha puesto eso se quedaba sin sección.
  const tieneContacto = Boolean(
    iglesia.direccion ||
      iglesia.telefono ||
      iglesia.email ||
      chatDeWhatsapp(iglesia.redes),
  );
  // Tolerante a lo que haya guardado: la columna es de la migración `0000` y
  // puede traer claves anteriores al catálogo. Se ignoran en vez de tumbar la
  // web de la iglesia.
  const redes = redesParaPintar(iglesia.redes);
  // Va por `dbAdmin`, como todo lo de esta página, y NO consulta inscripciones:
  // ni siquiera para contarlas. El porqué, en `src/lib/eventos/publica.ts`.
  const eventosDeLaIglesia = await eventosPublicos(iglesia.id);
  // Solo si el pastor la marcó para la web. Va después de comprobar que la web
  // está publicada: `obtenerIglesiaPublica` ya habría devuelto null.
  const radio = await radioPublica(iglesia.id);
  const monedaIglesia = iglesia.moneda as Moneda;
  const secciones: { href: string; texto: string }[] = [];
  if (iglesia.horarios.length > 0) {
    secciones.push({ href: '#horarios', texto: 'Horarios' });
  }
  // Entre horarios y devocional, en el MISMO orden en que se pintan más abajo.
  if (eventosDeLaIglesia.length > 0) {
    secciones.push({ href: '#eventos', texto: 'Eventos' });
  }
  if (devocional) {
    secciones.push({ href: '#devocional', texto: 'Devocional' });
  }
  if (radio) {
    secciones.push({ href: '#radio', texto: 'Radio' });
  }
  // El orden de este array es el del menú, y tiene que ser el mismo en el que
  // aparecen las secciones al bajar. Si discrepan, los enlaces saltan hacia
  // arriba y hacia abajo y la página parece desordenada.
  if (iglesia.grupos.length > 0) {
    secciones.push({ href: '#grupos', texto: 'Grupos' });
  }
  secciones.push({ href: '#comunidad', texto: 'Comunidad' });
  if (tieneContacto) {
    secciones.push({ href: '#contacto', texto: 'Contacto' });
  }

  return (
    <div className="bg-background">
      {/* El logo si lo han subido; si no, las iniciales. Nunca un hueco: una
          cabecera con un cuadro vacío parece rota. */}
      <CabeceraIglesia
        nombre={iglesia.nombre}
        ciudad={iglesia.ciudad}
        logoUrl={iglesia.logoUrl}
        iniciales={iniciales(iglesia.nombre)}
        secciones={secciones}
        tieneContacto={tieneContacto}
        donativos={
          iglesia.cuentaDonativos
            ? {
                cuenta: iglesia.cuentaDonativos,
                titular: iglesia.titularDonativos,
              }
            : null
        }
        conFoto={iglesia.imagenes.length > 0}
      />


      {/* --- Hero --- (ver `SeccionPortada`) */}
      <SeccionPortada
        iglesia={iglesia}
        destacado={destacado}
        tieneContacto={tieneContacto}
      />

      {/* --- Horarios --- */}
      {iglesia.horarios.length > 0 && (
        <SeccionHorarios
          iglesia={iglesia}
          tieneContacto={tieneContacto}
        />
      )}

      {/* --- Eventos ---
          Entre los horarios y el devocional a propósito: los horarios son lo
          que se repite cada semana y esto es lo que pasa UNA vez, así que se
          leen seguidos. Y el orden de este bloque tiene que ser el mismo que el
          del array `secciones`: la marca del menú recorre ese array y se
          queda con la última sección que ha pasado la línea de lectura, así que
          si discrepan se queda pegada en la equivocada. */}
      {eventosDeLaIglesia.length > 0 && (
        <SeccionEventos
          eventosDeLaIglesia={eventosDeLaIglesia}
          slug={iglesia.slug}
          timezone={iglesia.timezone}
          monedaIglesia={monedaIglesia}
        />
      )}

      {/* --- Devocional --- */}
      {devocional && <SeccionDevocional devocional={devocional} />}

      {/* --- Radio ---
          Detrás del devocional y delante de los grupos, en el mismo orden que
          su entrada en `secciones`. */}
      {radio && <SeccionRadio iglesia={iglesia} radio={radio} />}

      {/* --- Grupos: los ministerios reales --- */}
      {iglesia.grupos.length > 0 && <SeccionGrupos iglesia={iglesia} />}

      {/*
       * Aquí iba «Quiénes somos»: la historia de la iglesia, sus datos en
       * píldoras y el resto plegado.
       *
       * Fuera por ahora; su sitio lo va a ocupar la comunidad. El texto NO se ha
       * borrado: sigue en `iglesias.historia` y se sigue escribiendo desde
       * Ajustes, así que recuperarlo es volver a pintar una sección, no
       * reescribirla.
       */}

      {/*
       * Aquí había una franja verde a todo lo ancho con el número de cuenta.
       *
       * Se fue al botón «Donar» de la cabecera. Pedir dinero es lo único de esta
       * página que nadie lee de paso —se busca a propósito o no se hace—, y una
       * banda entre los grupos y el contacto interrumpía a quien venía a mirar a
       * qué hora es el culto. El dato no se ha perdido: ahora está a un toque
       * desde cualquier punto de la página, que antes no lo estaba.
       */}

      {/* --- Comunidad --- (ver `SeccionComunidad`) */}
      <SeccionComunidad iglesia={iglesia} pulso={pulso} />

      {/* --- Contacto --- */}
      {tieneContacto && <SeccionContacto iglesia={iglesia} />}

      <PieIglesia iglesia={iglesia} redes={redes} />
    </div>
  );
}
