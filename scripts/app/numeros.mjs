/**
 * Dónde vive el número de la app, y si cuadra.
 *
 * Son cuatro sitios, y por eso hay un fichero para leerlos:
 *
 *   capacitor.config.ts       const AGENTE = 'HatrilApp/1.0.0'   lo que ve la web
 *   android/app/build.gradle  versionName "1.0.0"  versionCode 1
 *   ios/.../project.pbxproj   MARKETING_VERSION = 1.0.0;  CURRENT_PROJECT_VERSION = 1;
 *                             (dos veces cada uno: Debug y Release)
 *
 * La versión visible (1.0.0) tiene que ser la misma en los tres: la web
 * distingue versiones por el User-Agent, y una app que dice ser la 1.0.0 siendo
 * la 1.0.1 es peor que una que no dice nada. El número de compilación va por
 * separado en cada tienda, porque cada una lleva su cuenta.
 *
 * Lo usan `version.mjs` (que los cambia) e `ios.mjs` (que se niega a
 * sincronizar si no cuadran). `android.mjs` hace su propia comprobación desde
 * antes, con las mismas expresiones.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RUTAS = {
  config: 'capacitor.config.ts',
  gradle: join('android', 'app', 'build.gradle'),
  pbxproj: join('ios', 'App', 'App.xcodeproj', 'project.pbxproj'),
};

export const PATRONES = {
  agente: /const AGENTE = 'HatrilApp\/([^']+)'/,
  versionName: /versionName\s+"([^"]+)"/,
  versionCode: /versionCode\s+(\d+)/,
  marketing: /MARKETING_VERSION = ([^;]+);/g,
  build: /CURRENT_PROJECT_VERSION = ([^;]+);/g,
};

function todos(texto, patron) {
  return [...texto.matchAll(patron)].map((m) => m[1].trim());
}

/** Lee los números de donde estén. Lo que falte sale como `null`. */
export function leerNumeros(raiz) {
  const leer = (ruta) => {
    const completa = join(raiz, ruta);
    return existsSync(completa) ? readFileSync(completa, 'utf8') : null;
  };

  const config = leer(RUTAS.config);
  const gradle = leer(RUTAS.gradle);
  const pbxproj = leer(RUTAS.pbxproj);

  return {
    agente: config?.match(PATRONES.agente)?.[1] ?? null,
    android: gradle
      ? {
          version: gradle.match(PATRONES.versionName)?.[1] ?? null,
          build: Number(gradle.match(PATRONES.versionCode)?.[1] ?? NaN),
        }
      : null,
    ios: pbxproj
      ? {
          versiones: todos(pbxproj, PATRONES.marketing),
          builds: todos(pbxproj, PATRONES.build).map(Number),
        }
      : null,
  };
}

/** Lo que no cuadra, en frases. Vacío si todo está bien. */
export function descuadres(n) {
  const fallos = [];

  if (!n.agente) fallos.push(`No encuentro const AGENTE = 'HatrilApp/x.y.z' en ${RUTAS.config}.`);

  if (n.android) {
    if (!n.android.version) fallos.push(`No encuentro versionName en ${RUTAS.gradle}.`);
    if (!Number.isInteger(n.android.build)) fallos.push(`No encuentro versionCode en ${RUTAS.gradle}.`);
    if (n.agente && n.android.version && n.android.version !== n.agente) {
      fallos.push(`Android dice ${n.android.version} y capacitor.config.ts HatrilApp/${n.agente}.`);
    }
  }

  if (n.ios) {
    const versiones = new Set(n.ios.versiones);
    const builds = new Set(n.ios.builds);
    if (n.ios.versiones.length === 0) fallos.push(`No encuentro MARKETING_VERSION en ${RUTAS.pbxproj}.`);
    if (n.ios.builds.length === 0) fallos.push(`No encuentro CURRENT_PROJECT_VERSION en ${RUTAS.pbxproj}.`);
    if (versiones.size > 1) fallos.push(`iOS tiene dos MARKETING_VERSION distintas (Debug y Release): ${[...versiones].join(' y ')}.`);
    if (builds.size > 1) fallos.push(`iOS tiene dos CURRENT_PROJECT_VERSION distintas (Debug y Release): ${[...builds].join(' y ')}.`);
    if ([...builds].some((b) => !Number.isInteger(b))) fallos.push('CURRENT_PROJECT_VERSION tiene que ser un número entero.');
    const [version] = versiones;
    if (n.agente && version && version !== n.agente) {
      fallos.push(`iOS dice ${version} y capacitor.config.ts HatrilApp/${n.agente}.`);
    }
  }

  return fallos;
}
