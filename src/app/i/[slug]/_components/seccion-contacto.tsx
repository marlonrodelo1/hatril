import { clsx } from 'clsx';
import { Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { IglesiaPublica } from '@/lib/iglesias/publica';
import { redesParaPintar } from '@/lib/iglesias/redes';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { MapaAlTocar } from '@/components/lugares/mapa-google';
import { mapaWeb } from '@/lib/lugares/mapa';

type Accion = {
  clave: string;
  Icono: LucideIcon;
  texto: string;
  href: string;
  /** Lo que se ve debajo en escritorio: el número o el correo. */
  dato: string | null;
  deFuera?: boolean;
};

// Escritas enteras y no `grid-cols-${n}`: Tailwind solo genera las clases que
// encuentra literalmente en el código.
const COLUMNAS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

/** Cómo llegar y cómo contactar. Solo si la iglesia ha puesto algún dato. */
export function SeccionContacto({ iglesia }: { iglesia: IglesiaPublica }) {
  const whatsapp = chatDeWhatsapp(iglesia.redes);
  const mapa = mapaWeb();

  // Solo los que la iglesia haya rellenado. Un botón «Escribir» que no lleva
  // a ninguna parte es peor que no tenerlo: quien lo pulsa cree que la web
  // está rota.
  const acciones: Accion[] = [];
  if (iglesia.telefono) {
    acciones.push({
      clave: 'llamar',
      Icono: Phone,
      texto: 'Llamar',
      href: `tel:${iglesia.telefono}`,
      dato: formatearTelefono(iglesia.telefono),
    });
  }
  if (whatsapp) {
    acciones.push({
      clave: 'whatsapp',
      Icono: MessageCircle,
      texto: 'WhatsApp',
      href: whatsapp.url,
      dato: whatsapp.telefono,
      deFuera: true,
    });
  }
  if (iglesia.email) {
    acciones.push({
      clave: 'escribir',
      Icono: Mail,
      texto: 'Escribir',
      href: `mailto:${iglesia.email}`,
      dato: iglesia.email,
    });
  }

  return (
    <section
      id="contacto"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="grid items-start gap-6 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col gap-3 md:gap-4">
          <span className="t-micro text-badge-accent-fg">Cómo llegar y contacto</span>
          <h2 className="text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
            ¿Alguna pregunta antes de venir?
          </h2>
          <p className="max-w-[460px] text-pretty text-[17px] leading-relaxed text-muted-foreground">
            Contesta una persona de la iglesia.
          </p>
        </div>

        {/*
         * Datos de contacto directos, no un formulario.
         *
         * El diseño pone aquí un formulario con la promesa de que «contesta
         * una persona, normalmente el mismo día». Para cumplirla hacen falta
         * una bandeja en el panel y avisos por correo, y hasta que existan,
         * un formulario que no va a ninguna parte incumple justo esa
         * promesa: alguien escribe con una duda antes de atreverse a
         * aparecer un domingo, y nadie lo lee nunca.
         *
         * Un teléfono en el que llamar y un correo al que escribir sí
         * funcionan hoy. Y desde el móvil, que es por donde va a entrar casi
         * todo el mundo, `tel:` y `mailto:` son un toque.
         *
         * Por eso son botones y no una lista para leer: antes, para llamar
         * había que copiar el número a mano.
         */}
        <div className="flex flex-col gap-3">
          {acciones.length > 0 && (
            <ul className={clsx('grid gap-2 sm:gap-3', COLUMNAS[acciones.length])}>
              {acciones.map(({ clave, Icono, texto, href, dato, deFuera }) => (
                <li key={clave} className="flex">
                  <a
                    href={href}
                    {...(deFuera
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    // `text-foreground` explícito: `globals.css` pinta de
                    // naranja todo `<a>`, y el naranja es para la acción de la
                    // página, que es el «Cómo llegar» de la portada.
                    className="flex w-full flex-col items-center gap-2 rounded-xl border border-border bg-surface px-2 py-3.5 text-center text-label font-semibold text-foreground no-underline transition-colors duration-150 ease-hatril hover:border-border-strong hover:bg-surface-alt hover:text-foreground hover:no-underline motion-reduce:transition-none md:py-4"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-surface-active">
                      <Icono className="size-[18px]" strokeWidth={1.8} aria-hidden />
                    </span>
                    {texto}
                    {/*
                     * El número y el correo, solo en escritorio.
                     *
                     * En un ordenador `tel:` no suele abrir nada y `mailto:`
                     * abre un programa de correo que casi nadie tiene
                     * configurado: sin el dato a la vista, quien entra desde
                     * casa se queda sin forma de contactar. En el móvil el
                     * botón ya lo hace todo y el dato solo alargaría la fila.
                     * `break-all`: un correo no tiene por dónde partirse y
                     * sacaría la tarjeta de su columna.
                     */}
                    {dato && (
                      <span className="hidden break-all text-label font-normal text-muted-foreground md:block">
                        {dato}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {iglesia.direccion && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 sm:p-4">
              <MapPin
                className="size-[18px] flex-none text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              {/* `min-w-0` y `break-words`: una dirección con nombre de barrio
                  no tiene dónde partir y estira la tarjeta hasta sacarla de la
                  pantalla en un móvil. */}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-body font-semibold">
                  {iglesia.direccion}
                </span>
                {iglesia.ciudad && (
                  <span className="text-label text-muted-foreground">
                    {iglesia.ciudad}
                  </span>
                )}
              </span>
              {/*
               * «Ir» abre la búsqueda de Google Maps con la dirección y la
               * ciudad. Es una dirección web normal y no un esquema propio
               * (`geo:`, `maps:`): en Android la abre la aplicación de Maps, en
               * un iPhone la de Google si está instalada o la web si no, y en
               * un ordenador la web. Un esquema propio solo funciona en unos
               * teléfonos y en el resto no hace nada.
               *
               * La ciudad va en la búsqueda aunque no se escriba en la fila:
               * «Calle 45 #12-30» existe en muchas ciudades.
               */}
              <BotonEnlace
                href={enlaceMapa(iglesia)}
                nuevaPestana
                variant="outline"
                size="sm"
                className="flex-none"
              >
                <Navigation strokeWidth={1.8} aria-hidden />
                Ir
                <span className="sr-only"> a la dirección en Google Maps</span>
              </BotonEnlace>
            </div>
          )}

          {/* El mapa, solo con coordenadas y solo al tocarlo: abrirlo manda a
              Google la conexión de quien mira (`lib/lugares/mapa.ts`). */}
          {mapa && iglesia.latitud !== null && iglesia.longitud !== null && (
            <MapaAlTocar
              desde={mapa.desde}
              iglesia={{
                slug: iglesia.slug,
                nombre: iglesia.nombre,
                latitud: iglesia.latitud,
                longitud: iglesia.longitud,
                logoUrl: iglesia.logoUrl,
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * La búsqueda de Google Maps, con la forma documentada (`api=1`).
 *
 * Con coordenadas, las coordenadas: son el sitio exacto que eligió el pastor,
 * y una dirección escrita a mano puede no encontrarse. Es lo que ya hacía la
 * ficha del directorio (`/iglesia/[slug]`); aquí faltaba.
 */
function enlaceMapa(iglesia: IglesiaPublica): string {
  const consulta =
    iglesia.latitud !== null && iglesia.longitud !== null
      ? `${iglesia.latitud},${iglesia.longitud}`
      : [iglesia.direccion, iglesia.ciudad].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

/**
 * El WhatsApp de la iglesia, si lleva a una conversación.
 *
 * `redes.whatsapp` puede ser un número (`wa.me/57…`) o el enlace de invitación
 * a un grupo (`chat.whatsapp.com/…`). Lo segundo no es «escribir a la
 * iglesia»: quien pulsa con una duda acabaría metido en un grupo con toda la
 * congregación. Ese sigue saliendo entre las redes del pie, que es lo que es,
 * pero aquí no.
 *
 * `api.whatsapp.com` tampoco: `normalizarRed` le quita la consulta al guardar,
 * y en esos enlaces el número viaja justo ahí (`/send?phone=…`), así que lo
 * guardado ya no lleva a nadie.
 */
export function chatDeWhatsapp(
  redes: IglesiaPublica['redes'],
): { url: string; telefono: string | null } | null {
  const red = redesParaPintar(redes).find((r) => r.red === 'whatsapp');
  if (!red) return null;

  let url: URL;
  try {
    url = new URL(red.url);
  } catch {
    return null;
  }
  if (url.hostname !== 'wa.me' || url.pathname.length <= 1) return null;

  const digitos = url.pathname.slice(1);
  return {
    url: red.url,
    telefono: /^\d+$/.test(digitos) ? formatearTelefono(`+${digitos}`) : null,
  };
}
