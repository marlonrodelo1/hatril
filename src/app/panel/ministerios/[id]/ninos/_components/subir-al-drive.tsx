'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { CircleAlert, CircleCheck, Upload } from 'lucide-react';

import {
  LADO_FOTO,
  LADO_MINIATURA,
  MAX_BYTES_FOTO,
  MAX_BYTES_VIDEO,
  MAX_DURACION_VIDEO_S,
  MAX_FICHEROS_POR_SUBIDA,
  TIPOS_VIDEO,
} from '@/lib/ninos/limites';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PreparadaSubida } from '../actions';

/**
 * Subir fotos y vídeos al drive desde el teléfono o el ordenador.
 *
 * QUÉ HACE EL TELÉFONO Y POR QUÉ
 * ------------------------------
 *   - Reduce cada foto a 1.600 px en WebP (JPEG si el navegador no sabe) y saca
 *     una miniatura de 400 px. Una foto de móvil pesa 3-5 MB; reducida, unos
 *     400 KB. Cada megabyte que se guarda y se descarga se paga, y diez veces
 *     menos es la diferencia entre un drive barato y uno caro (`plan-ninos.md`
 *     §5). Y al redibujarla se va el EXIF: la ubicación de la casa donde se
 *     hizo la foto no sube.
 *   - Mira el vídeo antes de mandarlo: tipo, tamaño y duración. Un vídeo de
 *     300 MB se rechaza aquí, sin gastar los datos de quien lo sube.
 *   - Sube directo a Storage con la URL de un solo uso que le da el servidor
 *     (`prepararSubida`), y le pide que confirme (`confirmarSubida`). El VPS
 *     no ve pasar ni un byte.
 *
 * LAS ACTIONS LLEGAN POR PROPS, Y LA SUBIDA ES UN `PUT` A SECAS
 * -------------------------------------------------------------
 * Lo usan el panel y la app empaquetada (`movil/`, Equipo → Niños). La app
 * sustituye cada `actions.ts` que se importa por llamadas a su API, y solo
 * admite los de su lista: las del panel no están, y las de la app son otras
 * (`mi/equipo/[id]/ninos/actions.ts`). Por eso cada pantalla pasa las suyas.
 * Y sin el cliente de Supabase de la web, que lee `process.env` y en la app no
 * existe: la URL firmada ya lleva el permiso, así que basta un `fetch` con el
 * mismo cuerpo que manda supabase-js.
 *
 * De uno en uno y no en paralelo: con la cobertura de un salón de iglesia,
 * veinte subidas a la vez acaban todas a medias.
 */

type Estado = { nombre: string; estado: 'esperando' | 'subiendo' | 'hecho' | 'error'; mensaje?: string };

/**
 * Lo que necesita `prepararSubida`, en un `FormData`: la app solo deja pasar a
 * sus actions texto y formularios, no objetos. Lo que no hay, no viaja.
 */
function datosDeSubida(d: Record<string, string | number | null>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(d)) {
    if (valor !== null) datos.set(campo, String(valor));
  }
  return datos;
}

/** Lo mismo que `uploadToSignedUrl` de supabase-js: multipart, sin pisar nada. */
async function subirFirmado(url: string, cuerpo: Blob): Promise<boolean> {
  const datos = new FormData();
  datos.append('cacheControl', '3600');
  datos.append('', cuerpo);
  try {
    const r = await fetch(url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: datos });
    return r.ok;
  } catch {
    return false;
  }
}

async function reducir(fichero: File, lado: number, calidad: number): Promise<Blob> {
  const imagen = await createImageBitmap(fichero, { imageOrientation: 'from-image' });
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();

  const enTipo = (tipo: string) =>
    new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, tipo, calidad));
  // Un navegador que no codifica WebP devuelve un PNG sin avisar: se mira el tipo.
  const webp = await enTipo('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await enTipo('image/jpeg');
  if (!jpeg) throw new Error('foto');
  return jpeg;
}

function duracionDe(fichero: File): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(fichero);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolver(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('video'));
    };
    video.src = url;
  });
}

export function SubirAlDrive({
  ministerioId,
  hoy,
  preparar,
  confirmar,
  publicacion,
}: {
  ministerioId: string;
  hoy: string;
  preparar: (ministerioId: string, datos: FormData) => Promise<PreparadaSubida>;
  confirmar: (ministerioId: string, archivoId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Si se sube desde una publicación: entra ya en ella, con su fecha, y no se
   * pregunta el día.
   */
  publicacion?: { id: string; fecha: string };
}) {
  const router = useRouter();
  const idFicheros = useId();
  const [fecha, setFecha] = useState(publicacion?.fecha ?? hoy);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const marcar = (i: number, cambio: Partial<Estado>) =>
    setEstados((previos) => previos.map((e, j) => (j === i ? { ...e, ...cambio } : e)));

  async function subirUno(fichero: File, i: number): Promise<void> {
    const esVideo = (TIPOS_VIDEO as readonly string[]).includes(fichero.type);
    const esFoto = fichero.type.startsWith('image/');
    if (!esVideo && !esFoto) {
      marcar(i, { estado: 'error', mensaje: 'Solo fotos, o vídeos en MP4 o MOV.' });
      return;
    }

    marcar(i, { estado: 'subiendo' });

    let cuerpo: Blob = fichero;
    let miniatura: Blob | null = null;
    let duracionS: number | null = null;

    try {
      if (esFoto) {
        cuerpo = await reducir(fichero, LADO_FOTO, 0.82);
        miniatura = await reducir(fichero, LADO_MINIATURA, 0.7);
        if (cuerpo.size > MAX_BYTES_FOTO) {
          marcar(i, { estado: 'error', mensaje: 'Esta foto pesa demasiado incluso reducida.' });
          return;
        }
      } else {
        if (fichero.size > MAX_BYTES_VIDEO) {
          marcar(i, { estado: 'error', mensaje: 'Pesa más de 100 MB. Grábalo en 1080p o recórtalo a un minuto.' });
          return;
        }
        duracionS = Math.max(1, Math.ceil(await duracionDe(fichero)));
        if (duracionS > MAX_DURACION_VIDEO_S) {
          marcar(i, { estado: 'error', mensaje: 'Dura más de un minuto. Recórtalo y vuelve a subirlo.' });
          return;
        }
      }
    } catch {
      marcar(i, {
        estado: 'error',
        mensaje: esFoto
          ? 'Este navegador no sabe abrir esta foto. Prueba desde el teléfono con el que se hizo.'
          : 'No se puede leer este vídeo.',
      });
      return;
    }

    const preparada = await preparar(
      ministerioId,
      datosDeSubida({
        tipo: esVideo ? 'video' : 'foto',
        mime: cuerpo.type,
        bytes: cuerpo.size,
        fecha,
        duracionS,
        mimeMiniatura: miniatura ? miniatura.type : null,
        publicacionId: publicacion?.id ?? null,
      }),
    );
    // En la app, una action que no devuelve nada es una que ha redirigido
    // (sin permiso, el módulo apagado) o que no llegó al servidor: la pantalla
    // ya enseña el porqué arriba.
    if (!preparada) {
      marcar(i, { estado: 'error', mensaje: 'No se ha subido.' });
      return;
    }
    if (!preparada.ok) {
      marcar(i, { estado: 'error', mensaje: preparada.error });
      return;
    }

    if (!(await subirFirmado(preparada.fichero.url, cuerpo))) {
      marcar(i, { estado: 'error', mensaje: 'Se cortó la subida. Vuelve a intentarlo con mejor cobertura.' });
      return;
    }
    // Si la miniatura falla, la foto se pinta con el original: no se pierde nada.
    if (miniatura && preparada.miniatura) await subirFirmado(preparada.miniatura.url, miniatura);

    const confirmada = await confirmar(ministerioId, preparada.id);
    if (!confirmada) {
      marcar(i, { estado: 'error', mensaje: 'No se ha subido.' });
      return;
    }
    marcar(i, confirmada.ok ? { estado: 'hecho' } : { estado: 'error', mensaje: confirmada.error });
  }

  async function alElegir(ficheros: FileList | null) {
    const lista = Array.from(ficheros ?? []).slice(0, MAX_FICHEROS_POR_SUBIDA);
    if (lista.length === 0) return;

    setOcupado(true);
    setEstados(lista.map((f) => ({ nombre: f.name, estado: 'esperando' })));
    for (let i = 0; i < lista.length; i++) {
      try {
        await subirUno(lista[i]!, i);
      } catch {
        marcar(i, { estado: 'error', mensaje: 'Algo falló al subirla. Vuelve a intentarlo.' });
      }
    }
    setOcupado(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {!publicacion && (
        <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
          <Label htmlFor={`${idFicheros}-fecha`}>Día de la actividad</Label>
          <Input
            id={`${idFicheros}-fecha`}
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value || hoy)}
            disabled={ocupado}
          />
        </div>
        )}
        <label
          htmlFor={idFicheros}
          aria-disabled={ocupado}
          className={
            'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-[18px] text-[15px] font-semibold has-focus-visible:ring-[3px] has-focus-visible:ring-primary/30 ' +
            // Dentro de una publicación el naranja es «Publicar»: un solo botón
            // naranja por pantalla. En el drive, subir es la acción de la pantalla.
            (publicacion
              ? 'border border-border bg-surface-alt text-foreground hover:bg-surface-active '
              : 'bg-primary text-primary-foreground hover:bg-accent-hover ') +
            (ocupado ? 'pointer-events-none opacity-70' : '')
          }
        >
          <Upload className="size-4" strokeWidth={1.9} aria-hidden />
          {ocupado ? 'Subiendo…' : 'Elegir fotos y vídeos'}
          <input
            id={idFicheros}
            type="file"
            multiple
            accept="image/*,video/mp4,video/quicktime"
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              void alElegir(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <p className="t-label text-muted-foreground">
        Hasta {MAX_FICHEROS_POR_SUBIDA} de una vez. Las fotos se reducen en el teléfono antes de subir;
        los vídeos, de un minuto como mucho y 100 MB.
      </p>

      {estados.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {estados.map((e, i) => (
            <li key={`${e.nombre}-${i}`} className="flex items-start gap-2 text-[13.5px] leading-snug">
              {e.estado === 'hecho' ? (
                <CircleCheck className="mt-px size-4 shrink-0 text-badge-success-fg" strokeWidth={1.9} aria-hidden />
              ) : e.estado === 'error' ? (
                <CircleAlert className="mt-px size-4 shrink-0 text-danger" strokeWidth={1.9} aria-hidden />
              ) : (
                <span className="mt-[3px] size-3 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
              )}
              <span className="min-w-0">
                <span className="break-all">Archivo {i + 1}</span>
                {e.estado === 'error' && e.mensaje ? `: ${e.mensaje}` : e.estado === 'hecho' ? ': subido' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
