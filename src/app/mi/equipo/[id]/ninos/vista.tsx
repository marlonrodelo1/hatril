import Link from 'next/link';
import { CalendarDays, Images, Users } from 'lucide-react';

import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/ninos/constantes';
import { Fila, FilaEnlace, Lista, MarcoEquipo, Seccion, Vacio } from '../../_components/marco';
import { Insignia } from '../../_components/insignia';
import { AREA } from '../../_components/estilos';
import { crearPublicacion } from './actions';
import type { cargar } from './datos';

/**
 * El tablón de Niños para los maestros, en la app. Lo pintan igual la web
 * (`./page.tsx`) y la app empaquetada (`movil/`).
 *
 * Lo mismo que el tablón del panel, para hacerlo el domingo desde el
 * teléfono: escribir lo que se hizo, entrar en el borrador, subir las fotos ahí
 * mismo y publicarlo. Del panel se queda fuera el drive suelto —borrar y
 * descargar el mes—, que es trabajo de ordenador, y apuntar clases en el
 * cronograma, que aquí se lee.
 *
 * Un solo botón naranja: «Guardar el borrador».
 */
export type DatosNinos = Awaited<ReturnType<typeof cargar>>;

export function VistaNinos({ id, error, guardado, ctx, ministerio, hoy, familiasEsperando, publicaciones }: DatosNinos) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Tablón de familias"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado && Object.hasOwn(CONFIRMACIONES, guardado) ? CONFIRMACIONES[guardado] : undefined}
    >
      {familiasEsperando > 0 && (
        <Aviso tipo="aviso">
          {familiasEsperando === 1
            ? 'Hay 1 familia esperando a que la aceptes.'
            : `Hay ${familiasEsperando} familias esperando a que las aceptes.`}{' '}
          <Link href={rutaApp(id, 'ninos', 'familias')} className="font-semibold">
            Revisarlas
          </Link>
        </Aviso>
      )}

      <Lista>
        <Fila>
          <FilaEnlace href={rutaApp(id, 'ninos', 'cronograma')}>
            <span className="flex items-center gap-2 text-body font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
              Cronograma de las clases
            </span>
          </FilaEnlace>
        </Fila>
        <Fila>
          <FilaEnlace href={rutaApp(id, 'ninos', 'familias')}>
            <span className="flex items-center gap-2 text-body font-semibold">
              <Users className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
              Familias y quién sale en fotos
            </span>
          </FilaEnlace>
        </Fila>
      </Lista>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Contar lo que se hizo</h2>
          <p className="text-label text-muted-foreground">
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
              className={AREA}
            />
            <p className="text-label text-muted-foreground">De la clase, nunca de un niño en concreto.</p>
          </div>
          <BotonEnviar className="self-start">Guardar el borrador</BotonEnviar>
        </form>
      </section>

      {publicaciones.length === 0 ? (
        <Vacio titulo="El tablón está vacío">
          Lo primero que publiques lo verán las familias aceptadas en su app.
        </Vacio>
      ) : (
        <Seccion rotulo="Publicaciones">
          <Lista>
            {publicaciones.map((p) => (
              <Fila key={p.id}>
                <FilaEnlace
                  href={rutaApp(id, 'ninos', 'publicacion', p.id)}
                  derecha={
                    p.archivos > 0 ? (
                      <span className="flex items-center gap-1 text-label text-muted-foreground tabular-nums">
                        <Images className="size-4" strokeWidth={1.8} aria-hidden />
                        {p.archivos}
                      </span>
                    ) : undefined
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold">{formatearFechaLarga(p.fecha)}</span>
                    {p.publicada ? (
                      <Insignia tono="exito">Publicada</Insignia>
                    ) : (
                      <Insignia tono="neutro">Borrador</Insignia>
                    )}
                  </span>
                  <span className="line-clamp-2 text-label text-muted-foreground">{p.texto}</span>
                </FilaEnlace>
              </Fila>
            ))}
          </Lista>
          <p className="px-1 text-label text-muted-foreground">
            Cada publicación se borra sola, con sus fotos, al cumplir el año.
          </p>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
