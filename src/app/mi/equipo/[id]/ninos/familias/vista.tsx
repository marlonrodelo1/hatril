import { Camera, CameraOff } from 'lucide-react';

import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CONFIRMACIONES, PARENTESCOS } from '@/app/panel/ministerios/[id]/ninos/constantes';
import { Fila, Lista, MarcoEquipo, Seccion, Vacio } from '../../../_components/marco';
import { Insignia } from '../../../_components/insignia';
import { SELECT } from '../../../_components/estilos';
import { aceptarSolicitud, quitarFamilia, rechazarSolicitud } from '../actions';
import type { cargar } from './datos';

/**
 * Las familias en la app: las peticiones «tengo un hijo aquí» y la lista de
 * niños con quién puede salir en fotos.
 *
 * Aceptar y quitar, solo la responsable y el pastor (`acepta`): es la puerta
 * que deja ver las fotos de todos los niños. A un maestro esta pantalla le
 * enseña la lista, que es lo que necesita para saber a quién puede fotografiar.
 * La base dice lo mismo (`0060`, HT144); esto solo evita enseñarle botones que
 * le fallarían.
 *
 * Sin botón naranja: aceptar es una decisión por familia, y va en carbón.
 */
export type DatosFamilias = Awaited<ReturnType<typeof cargar>>;

export function VistaFamilias({ id, error, guardado, ctx, ministerio, acepta, pendientes, ninos, anio }: DatosFamilias) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Familias"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'ninos')}
      error={error}
      ok={guardado && Object.hasOwn(CONFIRMACIONES, guardado) ? CONFIRMACIONES[guardado] : undefined}
    >
      {acepta && pendientes.length > 0 && (
        <Seccion rotulo="Esperando a que las aceptes">
          <Aviso tipo="aviso">
            <strong>Acepta solo si has comprobado en persona</strong> que es su madre, su
            padre o su tutor. Hatril no puede comprobarlo. Si aceptas a quien no es, verá
            las fotos de todos los niños del ministerio.
          </Aviso>
          <ul className="flex flex-col gap-3">
            {pendientes.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-body font-semibold">
                    {s.padre.nombre} · {PARENTESCOS[s.parentesco] ?? s.parentesco}
                  </span>
                  <span className="text-body">
                    De <strong>{s.nombre}</strong>, nacido o nacida en {s.anioNacimiento} (unos{' '}
                    {anio - s.anioNacimiento} años)
                  </span>
                  <span className="text-label text-muted-foreground">
                    {s.permisoImagen
                      ? 'Da permiso para que salga en fotos y vídeos.'
                      : 'No da permiso para fotos ni vídeos.'}
                  </span>
                </div>
                <form action={aceptarSolicitud.bind(null, id, s.id)} className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`nino-${s.id}`} className="text-label font-semibold">
                      ¿Es un niño nuevo?
                    </label>
                    <select id={`nino-${s.id}`} name="nino" defaultValue="nuevo" className={SELECT}>
                      <option value="nuevo">Sí, es nuevo en el ministerio</option>
                      {ninos.map((n) => (
                        <option key={n.id} value={n.id}>
                          No, es {n.nombre} ({n.anioNacimiento}), que ya está
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" variant="secondary" className="self-start">
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
        </Seccion>
      )}

      {ninos.length === 0 ? (
        <Vacio titulo="Todavía no hay familias">
          Cada madre o padre lo pide desde su app, en «Mis hijos»
          {acepta ? ', y te llega aquí para que lo aceptes.' : ', y lo acepta la responsable.'}
        </Vacio>
      ) : (
        <Seccion rotulo={`Niños (${ninos.length})`}>
          <Lista>
            {ninos.map((n) => (
              <Fila key={n.id}>
                <div className="flex flex-col gap-2.5 px-4 py-3 md:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold">{n.nombre}</span>
                    <span className="text-label text-muted-foreground">{n.anioNacimiento}</span>
                    {n.puedeSalir ? (
                      <Insignia tono="exito" Icono={Camera}>
                        Puede salir en fotos
                      </Insignia>
                    ) : (
                      <Insignia tono="neutro" Icono={CameraOff}>
                        Sin fotos
                      </Insignia>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {n.familias.map((f) => (
                      <li key={f.miembroId} className="flex flex-wrap items-center justify-between gap-2 text-label">
                        <span>
                          {f.nombre} · {PARENTESCOS[f.parentesco] ?? f.parentesco}
                          <span className="text-muted-foreground">{f.imagen ? ' · fotos: sí' : ' · fotos: no'}</span>
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
                </div>
              </Fila>
            ))}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
