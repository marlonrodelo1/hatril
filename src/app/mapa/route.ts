/**
 * El mapa de Google, como página suelta para meterla en un iframe.
 *
 * Por qué existe y por qué así, en `lib/lugares/mapa.ts`. En corto: la clave
 * pública de Maps solo se puede restringir de verdad por el origen de la
 * página, y la app de iOS no tiene uno que Google entienda. Aquí el origen es
 * siempre hatril.com.
 *
 * Es un `route.ts` y no una página de React: no necesita nada de Next, y así
 * pesa unos pocos kilobytes y carga antes que el propio mapa.
 *
 * QUÉ ESCUCHA Y QUÉ DICE
 * ----------------------
 * Recibe por `postMessage`, y solo de los orígenes de la web y de la app:
 *
 *   { hatrilMapa: 1, tipo: 'pintar',
 *     iglesias: [{ slug, nombre, lat, lng, logo?, iniciales? }],
 *     yo?: { lat, lng }, gestos?: 'greedy' | 'cooperative', elegida?: slug }
 *
 * y contesta, al mismo origen que le habló:
 *
 *   { hatrilMapa: 1, tipo: 'elegida', slug }   al tocar un pin
 *   { hatrilMapa: 1, tipo: 'error' }           si Google no carga
 *
 * Los nombres se pintan con `title` y `textContent`, nunca como HTML: vienen de
 * lo que escribe cada iglesia. El logo, como `src` de una imagen y solo si es
 * una dirección http(s).
 *
 * EL PIN ES EL LOGO (23-nov, lo pidió Marlon)
 * -------------------------------------------
 * Cada iglesia se pinta con su logo en un cuadrado redondeado, como en la lista,
 * con una punta abajo que marca el sitio exacto. Sin logo, o si no carga, sus
 * iniciales sobre el naranja suave, también como en la lista. La elegida pasa
 * a carbón y crece un poco.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los colores, escritos aquí porque esta página no carga `globals.css`. Son
 * los tokens de allí: `--hatril-bg-base`, `--hatril-text-secondary`,
 * `--hatril-accent`, `--hatril-accent-active`, `--hatril-support` y
 * `--hatril-text-primary`. Si cambia la paleta, cambian aquí también.
 */
const COLORES = {
  fondo: '#faf9f5',
  textoSecundario: '#67665f',
  naranja: '#b15435',
  naranjaOscuro: '#92442a',
  // `--hatril-accent-soft`: el fondo de las iniciales cuando no hay logo.
  naranjaSuave: '#f5e7df',
  carbon: '#3d3d3a',
  carbonOscuro: '#141413',
  // Encima de un relleno de color y de un mapa, que es una imagen: los dos
  // sitios donde el blanco vale (ver «Sistema de diseño» en el CLAUDE.md).
  blanco: '#ffffff',
};

/** Quién puede meter esta página en un iframe y hablarle: la web y la app. */
function origenesPermitidos(): string[] {
  const origenes = ['capacitor://localhost', 'https://localhost'];
  if (process.env.NODE_ENV !== 'production') origenes.push('http://localhost:5173');
  return origenes;
}

/** JSON que se puede pegar dentro de un `<script>` sin cerrarlo. */
function enScript(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

function pagina(cuerpo: string, script: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mapa · Hatril</title>
<style>
  html, body { margin: 0; height: 100%; background: ${COLORES.fondo}; }
  #mapa { position: absolute; inset: 0; }
  #aviso {
    position: absolute; inset: 0; display: flex; align-items: center;
    justify-content: center; padding: 16px; text-align: center;
    font: 500 14px/1.4 system-ui, -apple-system, sans-serif;
    color: ${COLORES.textoSecundario};
  }
  .yo {
    width: 14px; height: 14px; border-radius: 50%;
    background: ${COLORES.carbon}; border: 3px solid ${COLORES.blanco};
  }
  .pin {
    display: flex; flex-direction: column; align-items: center;
    cursor: pointer; transform-origin: bottom center;
  }
  .pin.elegida { transform: scale(1.15); }
  .cara {
    box-sizing: border-box; width: 40px; height: 40px; border-radius: 12px;
    border: 2.5px solid ${COLORES.naranja}; background: ${COLORES.blanco};
    overflow: hidden; display: flex; align-items: center; justify-content: center;
    font: 700 13px/1 system-ui, -apple-system, sans-serif;
  }
  .cara img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cara.sin-logo { background: ${COLORES.naranjaSuave}; color: ${COLORES.naranjaOscuro}; }
  .punta {
    width: 0; height: 0; margin-top: -1px;
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-top: 8px solid ${COLORES.naranja};
  }
  .elegida .cara { border-color: ${COLORES.carbon}; }
  .elegida .punta { border-top-color: ${COLORES.carbon}; }
</style>
</head>
<body>
${cuerpo}
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

export function GET() {
  const clave = process.env.GOOGLE_MAPS_CLAVE_NAVEGADOR?.trim();
  const cabeceras = {
    'Content-Type': 'text/html; charset=utf-8',
    // Solo la web y la app pueden enmarcarla. `frame-ancestors` manda sobre el
    // `X-Frame-Options: SAMEORIGIN` que `next.config.ts` pone a todo: los
    // navegadores ignoran el segundo cuando llega el primero.
    'Content-Security-Policy': `frame-ancestors 'self' ${origenesPermitidos().join(' ')}`,
    // Sin caché: pesa unos kilobytes, y con caché un despliegue nuevo seguía
    // pintando el mapa viejo durante minutos (se vio al cambiar los pines).
    'Cache-Control': 'no-cache',
  };

  if (!clave) {
    return new Response(pagina('<div id="aviso">El mapa no está disponible.</div>', ''), {
      status: 503,
      headers: { ...cabeceras, 'Cache-Control': 'no-store' },
    });
  }

  const src = new URL('https://maps.googleapis.com/maps/api/js');
  src.searchParams.set('key', clave);
  src.searchParams.set('v', 'weekly');
  src.searchParams.set('loading', 'async');
  src.searchParams.set('language', 'es');
  src.searchParams.set('libraries', 'marker');
  src.searchParams.set('callback', 'hatrilIniciarMapa');

  const config = {
    src: src.toString(),
    // Los pines de colores (AdvancedMarkerElement) piden un Map ID. Sin uno
    // propio, el de demostración de Google, que vale para probar.
    mapId: process.env.GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID',
    origenes: origenesPermitidos(),
    colores: COLORES,
  };

  const script = `
(function () {
  var CFG = ${enScript(config)};
  var C = CFG.colores;
  var permitidos = CFG.origenes.concat([location.origin]);
  var padre = null, mapa = null, marcadores = [], pendiente = null, listo = false, encuadre = '';
  var aviso = document.getElementById('aviso');

  function decir(texto) { aviso.textContent = texto; aviso.style.display = texto ? 'flex' : 'none'; }
  function contar(msg) {
    if (!padre) return;
    msg.hatrilMapa = 1;
    parent.postMessage(msg, padre);
  }
  function fallar() { decir('No se ha podido cargar el mapa.'); contar({ tipo: 'error' }); }

  // Google llama a esto si la clave no vale para este origen.
  window.gm_authFailure = fallar;
  window.hatrilIniciarMapa = function () { listo = true; if (pendiente) pintar(pendiente); };

  function numero(v, max) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= max; }
  function punto(p) { return !!p && numero(p.lat, 90) && numero(p.lng, 180); }

  function validar(d) {
    if (!d || d.hatrilMapa !== 1 || d.tipo !== 'pintar' || !Array.isArray(d.iglesias)) return null;
    var iglesias = d.iglesias.filter(function (i) {
      return i && typeof i.slug === 'string' && typeof i.nombre === 'string' && punto(i);
    }).slice(0, 300).map(function (i) {
      return {
        slug: i.slug.slice(0, 120), nombre: i.nombre.slice(0, 160), lat: i.lat, lng: i.lng,
        // Sin expresión regular a propósito: dentro de esta plantilla de
        // TypeScript, «\/» pierde la barra invertida y deja «//», que el
        // navegador lee como un comentario y el script entero se rompe.
        logo: typeof i.logo === 'string' && i.logo.length < 2000 &&
          (i.logo.indexOf('https://') === 0 || i.logo.indexOf('http://') === 0) ? i.logo : null,
        iniciales: typeof i.iniciales === 'string' ? i.iniciales.slice(0, 3) : '?'
      };
    });
    return {
      iglesias: iglesias,
      yo: punto(d.yo) ? { lat: d.yo.lat, lng: d.yo.lng } : null,
      gestos: d.gestos === 'greedy' ? 'greedy' : 'cooperative',
      elegida: typeof d.elegida === 'string' ? d.elegida : null
    };
  }

  window.addEventListener('message', function (e) {
    if (e.source !== parent || permitidos.indexOf(e.origin) === -1) return;
    var datos = validar(e.data);
    if (!datos) return;
    padre = e.origin;
    if (listo) pintar(datos); else pendiente = datos;
  });

  function iniciales(cara, texto) {
    cara.textContent = texto || '?';
    cara.className = 'cara sin-logo';
  }

  function pin(i, elegida) {
    var caja = document.createElement('div');
    caja.className = elegida ? 'pin elegida' : 'pin';
    var cara = document.createElement('div');
    cara.className = 'cara';
    if (i.logo) {
      var img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { iniciales(cara, i.iniciales); };
      img.src = i.logo;
      cara.appendChild(img);
    } else {
      iniciales(cara, i.iniciales);
    }
    var punta = document.createElement('div');
    punta.className = 'punta';
    caja.appendChild(cara);
    caja.appendChild(punta);
    return caja;
  }

  function pintar(d) {
    var M = google.maps, Marcador = M.marker.AdvancedMarkerElement;
    var puntos = d.iglesias.map(function (i) { return { lat: i.lat, lng: i.lng }; });
    if (d.yo) puntos.push(d.yo);
    if (!puntos.length) { decir('No hay nada que enseñar en el mapa.'); return; }

    if (!mapa) {
      mapa = new M.Map(document.getElementById('mapa'), {
        mapId: CFG.mapId, center: puntos[0], zoom: 15,
        disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        gestureHandling: d.gestos
      });
    }

    marcadores.forEach(function (m) { m.map = null; });
    marcadores = [];
    d.iglesias.forEach(function (i) {
      var m = new Marcador({
        map: mapa, position: { lat: i.lat, lng: i.lng }, title: i.nombre,
        content: pin(i, i.slug === d.elegida), gmpClickable: true,
        zIndex: i.slug === d.elegida ? 2 : 1
      });
      m.addEventListener('gmp-click', function () { contar({ tipo: 'elegida', slug: i.slug }); });
      marcadores.push(m);
    });
    if (d.yo) {
      var yo = document.createElement('div');
      yo.className = 'yo';
      marcadores.push(new Marcador({ map: mapa, position: d.yo, title: 'Tú', content: yo, zIndex: 0 }));
    }

    // Encuadrar solo si cambian los puntos: tocar un pin no debe mover el mapa.
    var clave = JSON.stringify(puntos);
    if (clave !== encuadre) {
      encuadre = clave;
      if (puntos.length === 1) { mapa.setCenter(puntos[0]); mapa.setZoom(15); }
      else {
        var caja = new M.LatLngBounds();
        puntos.forEach(function (p) { caja.extend(p); });
        mapa.fitBounds(caja, 48);
      }
    }
    decir('');
  }

  var s = document.createElement('script');
  s.async = true;
  s.src = CFG.src;
  s.onerror = fallar;
  document.head.appendChild(s);
})();`;

  return new Response(pagina('<div id="mapa"></div><div id="aviso">Cargando el mapa…</div>', script), {
    headers: cabeceras,
  });
}
