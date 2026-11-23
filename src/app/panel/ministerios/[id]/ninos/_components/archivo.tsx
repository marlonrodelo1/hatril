import type { ArchivoDelDrive } from '@/lib/ninos/consultas';
import { firmarLectura } from '@/lib/ninos/almacen';

// El cuadro, aparte y sin nada de servidor: lo pinta también la app (Equipo →
// Niños), que no puede importar `almacen.ts`.
export { CuadroArchivo } from './cuadro-archivo';

/**
 * Las URL firmadas de una tanda de archivos: la miniatura para pintarlos, y el
 * vídeo entero para poder verlo. Diez minutos (`almacen.ts`).
 *
 * Se firman DESPUÉS de que la consulta por `withUser()` haya devuelto las
 * filas: lo que la RLS no enseña, no se firma.
 */
export async function firmarArchivos(archivos: ArchivoDelDrive[]) {
  const [miniaturas, fotos, videos] = await Promise.all([
    firmarLectura(
      'miniatura',
      archivos.map((a) => a.miniaturaRuta ?? ''),
    ),
    // Las fotos sin miniatura (no debería haberlas: el teléfono la saca
    // siempre) se pintan con el original.
    firmarLectura(
      'foto',
      archivos.filter((a) => a.tipo === 'foto' && !a.miniaturaRuta).map((a) => a.ruta),
    ),
    firmarLectura(
      'video',
      archivos.filter((a) => a.tipo === 'video').map((a) => a.ruta),
    ),
  ]);

  return (a: ArchivoDelDrive) => ({
    miniatura: (a.miniaturaRuta && miniaturas.get(a.miniaturaRuta)) || fotos.get(a.ruta) || null,
    video: a.tipo === 'video' ? (videos.get(a.ruta) ?? null) : null,
  });
}
