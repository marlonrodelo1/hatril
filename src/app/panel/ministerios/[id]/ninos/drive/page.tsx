import type { Metadata } from 'next';
import { Download, FolderOpen, Trash2 } from 'lucide-react';

import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { fechaDeBorrado } from '@/lib/ninos/limites';
import { archivosDelDrive, type ArchivoDelDrive } from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Insignia } from '@/components/ui/insignia';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { CuadroArchivo, firmarArchivos } from '../_components/archivo';
import { SeccionesNinos } from '../_components/secciones';
import { SubirAlDrive } from '../_components/subir-al-drive';
import { borrarArchivo, confirmarSubida, prepararSubida } from '../actions';
import { CONFIRMACIONES } from '../constantes';
import { aceptaFamilias, requireNinos } from '../guarda';

export const metadata: Metadata = { title: 'Drive del ministerio' };

const MESES = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * El drive: las fotos y los vídeos de las actividades, por meses.
 *
 * Interno, como el cronograma: lo ven quien lleva el ministerio y el pastor.
 * Las familias solo ven lo que va en una publicación del tablón.
 *
 * POR MESES, PORQUE SE BORRA POR MESES
 * ------------------------------------
 * Cada mes se borra entero el día 1 del mes siguiente al cumplir el año
 * (`caduca_el`, `0059`), y cada cabecera lo dice. Descargar el mes antes de que
 * se vaya llega con la fase N3, junto con el aviso de 30 días.
 */
export default async function DrivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireNinos(id);
  const { error, guardado } = await searchParams;

  const archivos = await archivosDelDrive(ctx, id);
  const urls = await firmarArchivos(archivos);
  // Descargar es de la responsable y del pastor, como en `drive/exportar`.
  const descarga = aceptaFamilias(ctx, ministerio);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const enUnMes = sumarDias(hoy, 30);

  const porMes = new Map<string, ArchivoDelDrive[]>();
  for (const a of archivos) {
    const mes = a.fecha.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), a]);
  }

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Las fotos y los vídeos del ministerio"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="ninos" />
          <SeccionesNinos ministerioId={id} activa="drive" />
        </div>

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Subir</h2>
            <p className="t-label text-muted-foreground">
              Lo ven los maestros y el pastor. Las familias, solo lo que publiques en el tablón.
            </p>
          </div>
          <SubirAlDrive
            ministerioId={id}
            hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
            preparar={prepararSubida}
            confirmar={confirmarSubida}
          />
        </section>

        {archivos.length === 0 ? (
          <EstadoVacio Icono={FolderOpen} titulo="El drive está vacío">
            Sube las fotos y los vídeos del domingo. Después elige cuáles van al tablón.
          </EstadoVacio>
        ) : (
          [...porMes.entries()].map(([mes, delMes]) => (
            <section key={mes} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex flex-col gap-0.5">
                  <h2 className="t-micro">{MESES.format(new Date(`${mes}-01T00:00:00Z`))}</h2>
                  {delMes[0]?.caducaEl && (
                    <span className="text-[12.5px] text-muted-foreground">
                      Se borra el {fechaDeBorrado(delMes[0].caducaEl)}
                      {delMes[0].caducaEl <= enUnMes ? ': descárgalo antes si lo quieres conservar.' : ''}
                    </span>
                  )}
                </div>
                {descarga && (
                  // Un `<a>` de los de siempre y no un `Link`: es una descarga,
                  // no una navegación del router. Con forma de botón como en
                  // Finanzas (`buttonVariants`), sin `render`, que Base UI
                  // denuncia en consola.
                  <a
                    href={`/panel/ministerios/${id}/ninos/drive/exportar?mes=${mes}`}
                    download
                    className={buttonVariants({ variant: 'outline', size: 'sm', className: 'no-underline hover:no-underline' })}
                  >
                    <Download className="size-4" strokeWidth={1.9} aria-hidden />
                    Descargar el mes ({cuantos(delMes)})
                  </a>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {delMes.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1.5">
                    <CuadroArchivo archivo={a} urls={urls(a)} />
                    <div className="flex items-center justify-between gap-2">
                      {a.publicacionId ? (
                        <Insignia tono="exito">En el tablón</Insignia>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">
                          {formatearFechaLarga(a.fecha)}
                        </span>
                      )}
                      <form action={borrarArchivo.bind(null, id, a.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Borrar del drive"
                          className="text-muted-foreground"
                        >
                          <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Contenedor>
    </>
  );
}

/** «12 fotos y 2 vídeos». */
function cuantos(archivos: ArchivoDelDrive[]): string {
  const fotos = archivos.filter((a) => a.tipo === 'foto').length;
  const videos = archivos.length - fotos;
  return [
    fotos > 0 ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : null,
    videos > 0 ? `${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}` : null,
  ]
    .filter(Boolean)
    .join(' y ');
}

/** AAAA-MM-DD más `n` días, partida a mano como `formatearFechaLarga`. */
function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a!, m! - 1, d! + n));
  return f.toISOString().slice(0, 10);
}
