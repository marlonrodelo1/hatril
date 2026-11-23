import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Images, Newspaper } from 'lucide-react';

import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { publicacionesDelTablon, solicitudesPendientes } from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Input } from '@/components/ui/input';
import { Insignia } from '@/components/ui/insignia';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { SeccionesNinos } from './_components/secciones';
import { crearPublicacion } from './actions';
import { CONFIRMACIONES } from './constantes';
import { aceptaFamilias, requireNinos } from './guarda';

export const metadata: Metadata = { title: 'Tablón de familias' };

const CLASE_TEXTAREA =
  'min-h-[96px] w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

/**
 * El tablón: lo que se hizo cada día, que ven las familias aceptadas en su app.
 *
 * Primero se escribe un borrador (fecha y texto) y después, en su página, se
 * le añaden las fotos del drive y se publica. En dos pasos porque publicar es
 * lo que lo enseña a las familias, y ese botón va donde se ven las fotos y la
 * lista de quién puede salir en ellas, no aquí.
 *
 * Un solo botón naranja: «Guardar el borrador».
 */
export default async function TablonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireNinos(id);
  const { error, guardado } = await searchParams;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const acepta = aceptaFamilias(ctx, ministerio);
  const [publicaciones, pendientes] = await Promise.all([
    publicacionesDelTablon(ctx, id),
    acepta ? solicitudesPendientes(ctx, id) : Promise.resolve([]),
  ]);

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Lo que se hace cada día, para las familias"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="ninos" />
          <SeccionesNinos ministerioId={id} activa="tablon" />
        </div>

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {pendientes.length > 0 && (
          <Aviso tipo="aviso">
            {pendientes.length === 1
              ? 'Hay 1 familia esperando a que la aceptes.'
              : `Hay ${pendientes.length} familias esperando a que las aceptes.`}{' '}
            <Link href={`/panel/ministerios/${id}/ninos/familias`} className="font-semibold">
              Revisarlas
            </Link>
          </Aviso>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Contar lo que se hizo</h2>
            <p className="t-label text-muted-foreground">
              Se guarda como borrador. Las fotos se añaden después, y nadie lo ve
              hasta que lo publiques.
            </p>
          </div>
          <form action={crearPublicacion.bind(null, id)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
              <Label htmlFor="fecha">Día de la actividad</Label>
              <Input id="fecha" name="fecha" type="date" required max={hoy} defaultValue={hoy} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="texto">Qué hicisteis</Label>
              <textarea
                id="texto"
                name="texto"
                required
                maxLength={1000}
                rows={4}
                placeholder="Hoy aprendimos la historia de Noé, cantamos y pintamos el arca entre todos."
                className={CLASE_TEXTAREA}
              />
              <p className="t-label text-muted-foreground">
                De la clase, nunca de un niño en concreto.
              </p>
            </div>
            <BotonEnviar className="self-start">Guardar el borrador</BotonEnviar>
          </form>
        </section>

        {publicaciones.length === 0 ? (
          <EstadoVacio Icono={Newspaper} titulo="El tablón está vacío">
            Lo primero que publiques lo verán las familias aceptadas en su app.
          </EstadoVacio>
        ) : (
          <section className="flex flex-col gap-2">
            <h2 className="t-micro">Publicaciones</h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {publicaciones.map((p) => (
                <li key={p.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/panel/ministerios/${id}/ninos/publicacion/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-semibold">{formatearFechaLarga(p.fecha)}</span>
                        {p.publicadaAt ? (
                          <Insignia tono="exito" punto>
                            Publicada
                          </Insignia>
                        ) : (
                          <Insignia tono="neutro">Borrador</Insignia>
                        )}
                      </span>
                      <span className="line-clamp-2 text-[13.5px] leading-snug text-muted-foreground">
                        {p.texto}
                      </span>
                    </span>
                    {p.archivos.length > 0 && (
                      <span className="flex items-center gap-1 text-[13px] text-muted-foreground tabular-nums">
                        <Images className="size-4" strokeWidth={1.9} aria-hidden />
                        {p.archivos.length}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="t-label text-muted-foreground">
              Cada publicación se borra sola, con sus fotos, al cumplir el año.
            </p>
          </section>
        )}
      </Contenedor>
    </>
  );
}
