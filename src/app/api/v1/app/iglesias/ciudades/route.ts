import { endpointApp, publica } from '@/lib/api/app';
import type { RespuestaCiudades } from '@/lib/app-api/iglesias';
import { ciudadesDelDirectorio } from '@/lib/iglesias/directorio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las ciudades con alguna iglesia en el directorio, para sugerir en «¿En qué
 * ciudad buscas?». Como `anon`, igual que en `/buscar/ciudad`.
 */
export const GET = endpointApp({ guarda: publica }, async () => {
  const respuesta: RespuestaCiudades = { ciudades: await ciudadesDelDirectorio() };
  return respuesta;
});
