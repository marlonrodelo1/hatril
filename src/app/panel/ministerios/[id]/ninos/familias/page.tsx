import type { Metadata } from 'next';
import { Camera, CameraOff, Users } from 'lucide-react';

import { ninosDelMinisterio, solicitudesPendientes } from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Insignia } from '@/components/ui/insignia';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { SeccionesNinos } from '../_components/secciones';
import { aceptarSolicitud, quitarFamilia, rechazarSolicitud } from '../actions';
import { CONFIRMACIONES, PARENTESCOS } from '../constantes';
import { aceptaFamilias, requireNinos } from '../guarda';

export const metadata: Metadata = { title: 'Familias del ministerio' };

const CLASE_SELECT =
  'h-[42px] w-full rounded-lg border border-input bg-surface-alt px-3 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

/**
 * Las familias: quién pide ver lo de su hijo, y qué niños hay con sus padres.
 *
 * ACEPTAR, SOLO LA RESPONSABLE Y EL PASTOR
 * ----------------------------------------
 * Es la puerta que deja ver las fotos de TODOS los niños del ministerio, así que
 * no la abren los maestros aunque sean colíderes (decisión 3 del plan). A ellos
 * esta pantalla les enseña la lista de niños —la necesitan para saber quién
 * puede salir en fotos— y no las peticiones. La base dice lo mismo: las
 * policies de la `0060` no les dejan leer las peticiones, y aceptar les
 * devuelve HT144.
 *
 * Cada petición dice arriba lo único que Hatril no puede hacer por nadie:
 * comprobar en persona que quien lo pide es su madre, su padre o su tutor.
 *
 * Sin botón naranja: aceptar es una decisión por familia, no la acción de la
 * pantalla, y va en carbón.
 */
export default async function FamiliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireNinos(id);
  const { error, guardado } = await searchParams;

  const acepta = aceptaFamilias(ctx, ministerio);
  const anio = new Date().getUTCFullYear();
  const [pendientes, ninos] = await Promise.all([
    acepta ? solicitudesPendientes(ctx, id) : Promise.resolve([]),
    ninosDelMinisterio(ctx, id),
  ]);

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Las familias que ven el tablón"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="ninos" />
          <SeccionesNinos ministerioId={id} activa="familias" />
        </div>

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {acepta && pendientes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="t-micro">Esperando a que las aceptes</h2>
            <Aviso tipo="aviso">
              <strong>Acepta solo si has comprobado en persona</strong> que es su madre, su
              padre o su tutor. Hatril no puede comprobarlo. Si aceptas a quien no es, verá
              las fotos de todos los niños del ministerio.
            </Aviso>
            <ul className="flex flex-col gap-3">
              {pendientes.map((s) => (
                <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-semibold">
                      {s.padre.nombre} · {PARENTESCOS[s.parentesco] ?? s.parentesco}
                    </span>
                    <span className="text-[14px]">
                      De <strong>{s.nombre}</strong>, nacido o nacida en {s.anioNacimiento} (unos{' '}
                      {anio - s.anioNacimiento} años)
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {s.permisoImagen
                        ? 'Da permiso para que salga en fotos y vídeos.'
                        : 'No da permiso para fotos ni vídeos.'}
                    </span>
                  </div>
                  <form
                    action={aceptarSolicitud.bind(null, id, s.id)}
                    className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
                  >
                    <div className="flex flex-1 flex-col gap-1.5">
                      <label htmlFor={`nino-${s.id}`} className="t-label">
                        ¿Es un niño nuevo?
                      </label>
                      <select id={`nino-${s.id}`} name="nino" defaultValue="nuevo" className={CLASE_SELECT}>
                        <option value="nuevo">Sí, es nuevo en el ministerio</option>
                        {ninos.map((n) => (
                          <option key={n.id} value={n.id}>
                            No, es {n.nombre} ({n.anioNacimiento}), que ya está
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="secondary">
                      Aceptar
                    </Button>
                  </form>
                  <form action={rechazarSolicitud.bind(null, id, s.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                      Rechazar y borrar la petición
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ninos.length === 0 ? (
          <EstadoVacio Icono={Users} titulo="Todavía no hay familias">
            Cada madre o padre lo pide desde su app, en «Mis hijos»
            {acepta ? ', y te llega aquí para que lo aceptes.' : ', y lo acepta la responsable.'}
          </EstadoVacio>
        ) : (
          <section className="flex flex-col gap-2">
            <h2 className="t-micro">Niños ({ninos.length})</h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {ninos.map((n) => (
                <li key={n.id} className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 last:border-b-0 md:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{n.nombre}</span>
                    <span className="text-[13px] text-muted-foreground">{n.anioNacimiento}</span>
                    {n.puedeSalir ? (
                      <Insignia tono="exito">
                        <Camera className="size-3" strokeWidth={2} aria-hidden />
                        Puede salir en fotos
                      </Insignia>
                    ) : (
                      <Insignia tono="neutro">
                        <CameraOff className="size-3" strokeWidth={2} aria-hidden />
                        Sin fotos
                      </Insignia>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {n.familias.map((f) => (
                      <li key={f.miembroId} className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                        <span>
                          {f.nombre} · {PARENTESCOS[f.parentesco] ?? f.parentesco}
                          <span className="text-muted-foreground">
                            {f.imagen ? ' · fotos: sí' : ' · fotos: no'}
                          </span>
                        </span>
                        {acepta && (
                          <form action={quitarFamilia.bind(null, id, n.id, f.miembroId)}>
                            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                              Quitar
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Contenedor>
    </>
  );
}
