import { Trash2 } from 'lucide-react';

import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { fechaDeBorrado } from '@/lib/ninos/limites';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/ninos/constantes';
import { CuadroArchivo } from '@/app/panel/ministerios/[id]/ninos/_components/cuadro-archivo';
import { SubirAlDrive } from '@/app/panel/ministerios/[id]/ninos/_components/subir-al-drive';
import { MarcoEquipo, ZonaDeBorrar } from '../../../../_components/marco';
import { Insignia } from '../../../../_components/insignia';
import { AREA } from '../../../../_components/estilos';
import {
  adjuntarArchivos,
  borrarPublicacion,
  confirmarSubida,
  editarPublicacion,
  prepararSubida,
  publicar,
  quitarDePublicacion,
  retirarPublicacion,
} from '../../actions';
import type { cargar } from './datos';

/**
 * Una publicación del tablón en la app: la de la pantalla del panel, para el
 * teléfono del maestro.
 *
 * LA LISTA DE QUIÉN PUEDE SALIR, ARRIBA DE TODO
 * --------------------------------------------
 * Hatril no sabe quién sale en cada foto, y no debe saberlo: etiquetar niños o
 * reconocer caras sería tratar datos biométricos de menores. Sabe qué niños
 * tienen el permiso de todos sus padres, y eso es lo que mira quien publica
 * antes de pulsar.
 *
 * Las fotos se suben AQUÍ, dentro del borrador, y no a un drive suelto: en el
 * teléfono es un paso menos, y lo que se sube ya está donde se va a revisar.
 * Publicada, no se le añade nada sin retirarla antes (lo comprueba también el
 * servidor): añadir a lo publicado sería saltarse esa revisión.
 *
 * El naranja es «Publicar» mientras es un borrador. Publicada, no hay acción
 * principal: retirar va en contorno.
 */
export type DatosPublicacion = Awaited<ReturnType<typeof cargar>>;

export function VistaPublicacion({
  id,
  publicacionId,
  error,
  guardado,
  ctx,
  hoy,
  publicacion,
  archivos,
  disponibles,
  pueden,
}: DatosPublicacion) {
  const publicada = publicacion.publicada;
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={formatearFechaLarga(publicacion.fecha)}
      subtitulo={publicada ? 'Publicada: la ven las familias' : 'Borrador: todavía no la ve nadie'}
      volver={rutaApp(id, 'ninos')}
      error={error}
      ok={guardado && Object.hasOwn(CONFIRMACIONES, guardado) ? CONFIRMACIONES[guardado] : undefined}
    >
      <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-5">
        <h2 className="t-subtitulo">Pueden salir en fotos y vídeos</h2>
        <p className="text-pretty text-body leading-relaxed">
          {pueden.length > 0 ? `${pueden.join(', ')}.` : 'Ningún niño, todavía.'}
        </p>
        <p className="text-pretty text-label leading-snug text-muted-foreground">
          Ningún otro niño puede salir: tampoco los que no tienen a su familia en la
          app. Si en una foto sale alguien que no está en la lista, no la subas.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Fotos y vídeos</h2>
          <p className="text-label text-muted-foreground">
            {archivos.length === 0
              ? 'Ninguno todavía. Se puede publicar solo con el texto.'
              : `${archivos.length} en la publicación.`}
          </p>
        </div>

        {archivos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {archivos.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5">
                <CuadroArchivo archivo={a} urls={a.urls} />
                <form action={quitarDePublicacion.bind(null, id, publicacionId, a.id)}>
                  <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                    Quitar de aquí
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {publicada ? (
          <p className="text-pretty text-label leading-snug text-muted-foreground">
            Ya está publicada. Para añadir fotos, retírala del tablón, añádelas y
            vuelve a publicarla: así se vuelve a mirar quién sale.
          </p>
        ) : (
          <SubirAlDrive
            ministerioId={id}
            hoy={hoy}
            preparar={prepararSubida}
            confirmar={confirmarSubida}
            publicacion={{ id: publicacionId, fecha: publicacion.fecha }}
          />
        )}

        {!publicada && disponibles.length > 0 && (
          <details className="flex flex-col gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
            <summary className="cursor-pointer text-body font-semibold">
              Añadir del drive ({disponibles.length} sin publicar)
            </summary>
            <form action={adjuntarArchivos.bind(null, id, publicacionId)} className="mt-3 flex flex-col gap-3">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {disponibles.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer flex-col gap-1.5">
                      <CuadroArchivo archivo={a} urls={a.urls} />
                      <span className="flex items-center gap-2 text-label">
                        <input type="checkbox" name="archivos" value={a.id} />
                        {formatearFechaLarga(a.fecha)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button type="submit" variant="outline" className="self-start">
                Añadir los marcados
              </Button>
            </form>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        {publicada ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Insignia tono="exito">Publicada</Insignia>
              <span className="text-label text-muted-foreground">
                {publicacion.caducaEl
                  ? `Se borra con sus fotos el ${fechaDeBorrado(publicacion.caducaEl)}.`
                  : 'Se borra con sus fotos al cumplir el año.'}
              </span>
            </div>
            <form action={retirarPublicacion.bind(null, id, publicacionId)}>
              <Button type="submit" variant="outline">
                Retirar del tablón
              </Button>
            </form>
          </>
        ) : (
          <form action={publicar.bind(null, id, publicacionId)} className="flex flex-col gap-3">
            {archivos.length > 0 && (
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name="revisado" className="mt-1" />
                <span className="text-pretty text-body leading-snug">
                  He mirado las fotos y los vídeos: solo salen niños de la lista de arriba.
                </span>
              </label>
            )}
            <BotonEnviar pendiente="Publicando…" className="self-start">
              Publicar para las familias
            </BotonEnviar>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="t-subtitulo">El texto</h2>
        <form action={editarPublicacion.bind(null, id, publicacionId)} className="flex flex-col gap-4">
          {!publicada && (
            <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
              <Label htmlFor="fecha">Día de la actividad</Label>
              <Input id="fecha" name="fecha" type="date" required max={hoy} defaultValue={publicacion.fecha} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="texto">Qué hicisteis</Label>
            <textarea
              id="texto"
              name="texto"
              required
              maxLength={1000}
              rows={4}
              defaultValue={publicacion.texto}
              className={AREA}
            />
          </div>
          <Button type="submit" variant="outline" className="self-start">
            Guardar el texto
          </Button>
        </form>
      </section>

      <ZonaDeBorrar
        titulo="Borrar la publicación"
        boton={
          <form action={borrarPublicacion.bind(null, id, publicacionId)}>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrarla
            </Button>
          </form>
        }
      >
        Desaparece del tablón de las familias. Sus fotos y vídeos se quedan en el
        drive, y se borran solos al cumplir el año.
      </ZonaDeBorrar>
    </MarcoEquipo>
  );
}
