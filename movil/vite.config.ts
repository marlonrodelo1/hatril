import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * La app empaquetada de Hatril (`docs/app-nativa/plan-spa.md`).
 *
 *   npm run movil:dev     → http://localhost:5173, contra el Next de :3000
 *   npm run movil:build   → movil/dist, lo que Capacitor mete en el binario
 *
 * EN ESTE REPO Y CON EL MISMO `package.json`
 * ------------------------------------------
 * Un solo React para la web y la app: con dos, los componentes compartidos de
 * `src/components` se rompen con el error de los hooks. `@/` apunta a `src/`,
 * igual que en Next, así que un componente se importa con la misma ruta en
 * los dos lados.
 *
 * `next/link` y `next/navigation` se sustituyen aquí por los de React Router
 * (`movil/src/shims/`). Así los componentes de cliente de la web que los usan
 * —`boton-enlace`, la barra de abajo— se reaprovechan sin tocarlos.
 *
 * LAS VARIABLES
 * -------------
 * Se leen del `.env.local` de la raíz. Solo pasan al JavaScript las que
 * empiezan por `VITE_` o por `NEXT_PUBLIC_SUPABASE_`: la dirección y la clave
 * publicable de Supabase, que ya van hoy en el JavaScript de la web. La clave
 * secreta y la de la base no empiezan así y no salen nunca.
 */
const raiz = fileURLToPath(new URL('..', import.meta.url));
const aqui = fileURLToPath(new URL('.', import.meta.url));

/** Las rutas con barras normales: en Windows llegan con las invertidas. */
const barras = (ruta: string) => ruta.split('\\').join('/');

/**
 * Lo que va al binario no compila sin una dirección https de la API: la misma
 * regla que tenía `CAP_SERVER_URL` cuando la app era un WebView. Una app que
 * hable con la base en claro, o con localhost, no llega a existir.
 */
function exigirApi(mode: string): void {
  if (mode !== 'production') return;
  const api = (process.env.VITE_API_URL ?? loadEnv(mode, raiz, 'VITE_').VITE_API_URL ?? '').trim();
  if (!api) {
    throw new Error('Falta VITE_API_URL: la dirección https de la API. La pone `npm run app:android` / `app:ios`.');
  }
  if (!api.startsWith('https://')) {
    throw new Error(`VITE_API_URL tiene que ser https y es «${api}».`);
  }
}

/**
 * LAS ACTIONS DE LA WEB, LLAMADAS DESDE LA APP
 * --------------------------------------------
 * Los componentes del área del miembro importan sus server actions
 * (`import { publicar } from '../actions'`). En el teléfono no hay servidor
 * de Next: cada `actions.ts` de `src/app` se sustituye por un módulo con las
 * mismas funciones, que llaman a `POST /api/v1/app/accion`
 * (`movil/src/lib/acciones.ts`). El servidor ejecuta allí la action de verdad,
 * y solo si está en su lista (`src/lib/api/acciones-app.ts`).
 *
 * Así el componente no se toca, y la lógica sigue siendo una.
 *
 * Las de `(auth)` son la excepción: de ese fichero la app solo usa `salir`, y
 * en la app salir es local (borrar el token de push y cerrar la sesión del
 * teléfono, `movil/src/lib/salir.ts`).
 *
 * Y dos componentes de la web que consultan en el servidor se sustituyen por
 * los suyos de la app: `CabeceraMiembro` (la usa `MarcoEquipo`, el marco de
 * las pantallas de equipo) y `EnlaceADar`.
 */
const PREFIJO_VIRTUAL = String.fromCharCode(0) + 'hatril-accion:';
const EXPORTADAS = /^export async function (\w+)/gm;

function accionesDeLaWeb(): Plugin {
  const appWeb = `${barras(raiz)}src/app/`;
  const acciones = `${barras(aqui)}src/lib/acciones.ts`;
  const salir = `${barras(aqui)}src/lib/salir.ts`;
  const sustitutos = {
    cabecera: `${barras(aqui)}src/shims/cabecera-miembro.tsx`,
    dar: `${barras(aqui)}src/shims/enlace-a-dar.tsx`,
  };

  return {
    name: 'hatril-acciones-de-la-web',
    enforce: 'pre',
    async resolveId(origen, importador, opciones) {
      if (!importador) return null;
      // La cabecera y «Dar» de la web consultan en el servidor: en la app,
      // sus versiones (`movil/src/shims/`).
      if (/cabecera-miembro$|enlace-a-dar$/.test(origen)) {
        const resuelto = await this.resolve(origen, importador, { ...opciones, skipSelf: true });
        const ruta = resuelto ? barras(resuelto.id) : '';
        if (ruta.endsWith('src/app/mi/_components/cabecera-miembro.tsx')) return sustitutos.cabecera;
        if (ruta.endsWith('src/app/mi/_components/enlace-a-dar.tsx')) return sustitutos.dar;
        return null;
      }
      if (!/actions(\.ts)?$/.test(origen)) return null;
      const resuelto = await this.resolve(origen, importador, { ...opciones, skipSelf: true });
      if (!resuelto) return null;
      const ruta = barras(resuelto.id);
      if (!ruta.startsWith(appWeb) || !ruta.endsWith('/actions.ts')) return null;
      return PREFIJO_VIRTUAL + ruta.slice(appWeb.length, -'/actions.ts'.length);
    },
    load(id) {
      if (!id.startsWith(PREFIJO_VIRTUAL)) return null;
      const modulo = id.slice(PREFIJO_VIRTUAL.length);
      if (modulo === '(auth)') return `export { salir } from ${JSON.stringify(salir)};`;

      const fuente = readFileSync(`${appWeb}${modulo}/actions.ts`, 'utf8');
      const nombres = [...fuente.matchAll(EXPORTADAS)].map((m) => m[1]);
      return [
        `import { llamarAccion } from ${JSON.stringify(acciones)};`,
        ...nombres.map(
          (n) => `export const ${n} = (...args) => llamarAccion(${JSON.stringify(`${modulo}#${n}`)}, args);`,
        ),
      ].join('\n');
    },
  };
}

export default defineConfig(({ mode }) => {
  exigirApi(mode);
  return configuracion;
});

const configuracion: UserConfig = {
  root: aqui,
  envDir: raiz,
  envPrefix: ['VITE_', 'NEXT_PUBLIC_SUPABASE_'],
  plugins: [accionesDeLaWeb(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: `${aqui}src/shims/next-link.tsx` },
      { find: /^next\/navigation$/, replacement: `${aqui}src/shims/next-navigation.ts` },
      // La hoja de compartir nativa en lugar de `navigator.share`, y los
      // enlaces a hatril.com y no a `capacitor://localhost` (ver el shim).
      // Antes que `@/`, que si no se lo queda.
      { find: /^@\/lib\/compartir$/, replacement: `${aqui}src/shims/compartir.ts` },
      { find: /^@movil\//, replacement: `${aqui}src/` },
      { find: /^@\//, replacement: `${raiz}src/` },
    ],
  },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: `${aqui}dist`,
    emptyOutDir: true,
    // Capacitor sirve desde el propio teléfono: no hay red que ahorrar con
    // trozos pequeños, y un solo fichero arranca antes.
    chunkSizeWarningLimit: 2000,
  },
};
