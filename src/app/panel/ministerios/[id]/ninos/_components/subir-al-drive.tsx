'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { CircleAlert, CircleCheck, Upload } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
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
import { confirmarSubida, prepararSubida } from '../actions';

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
 * De uno en uno y no en paralelo: con la cobertura de un salón de iglesia,
 * veinte subidas a la vez acaban todas a medias.
 */

type Estado = { nombre: string; estado: 'esperando' | 'subiendo' | 'hecho' | 'error'; mensaje?: string };

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

export function SubirAlDrive({ ministerioId, hoy }: { ministerioId: string; hoy: string }) {
  const router = useRouter();
  const idFicheros = useId();
  const [fecha, setFecha] = useState(hoy);
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

    const preparada = await prepararSubida(ministerioId, {
      tipo: esVideo ? 'video' : 'foto',
      mime: cuerpo.type,
      bytes: cuerpo.size,
      fecha,
      duracionS,
      mimeMiniatura: miniatura ? (miniatura.type as 'image/webp' | 'image/jpeg') : null,
    });
    if (!preparada.ok) {
      marcar(i, { estado: 'error', mensaje: preparada.error });
      return;
    }

    const storage = createClient().storage;
    const subida = await storage
      .from(preparada.bucket)
      .uploadToSignedUrl(preparada.fichero.ruta, preparada.fichero.token, cuerpo, {
        contentType: cuerpo.type,
      });
    if (subida.error) {
      marcar(i, { estado: 'error', mensaje: 'Se cortó la subida. Vuelve a intentarlo con mejor cobertura.' });
      return;
    }
    if (miniatura && preparada.miniatura) {
      // Si la miniatura falla, la foto se pinta con el original: no se pierde nada.
      await storage
        .from(preparada.miniatura.bucket)
        .uploadToSignedUrl(preparada.miniatura.ruta, preparada.miniatura.token, miniatura, {
          contentType: miniatura.type,
        });
    }

    const confirmada = await confirmarSubida(ministerioId, preparada.id);
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
        <label
          htmlFor={idFicheros}
          aria-disabled={ocupado}
          className={
            'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-[18px] text-[15px] font-semibold text-primary-foreground hover:bg-accent-hover has-focus-visible:ring-[3px] has-focus-visible:ring-primary/30 ' +
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
