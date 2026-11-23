import f01 from './fotos/01.webp';
import f02 from './fotos/02.webp';
import f03 from './fotos/03.webp';
import f04 from './fotos/04.webp';
import f05 from './fotos/05.webp';
import f06 from './fotos/06.webp';
import f07 from './fotos/07.webp';
import f08 from './fotos/08.webp';
import f09 from './fotos/09.webp';
import f10 from './fotos/10.webp';
import f11 from './fotos/11.webp';
import f12 from './fotos/12.webp';

/**
 * El carrusel de fotos de la presentación: dos filas que pasan solas, en
 * sentidos contrarios, encima de las tarjetas de cada pantalla. Sustituyó al
 * atril el 23-nov, a petición de Marlon: «las fotos de las iglesias, de las
 * personas, de los ministerios, pasando con un degradado por debajo».
 *
 * LAS FOTOS
 * ---------
 * De Unsplash, con su licencia (uso gratis en la app, sin pedir permiso); de
 * dónde sale cada una, en `fotos/CREDITOS.md`. Elegidas para que no se
 * reconozca a nadie —de espaldas, manos, objetos— y sin caras de niños: en la
 * puerta de entrada de la app, una cara parecería alguien que la usa. Van
 * dentro del paquete, reducidas a 320 px (260 KB las doce): la presentación es
 * lo primero que se abre, a veces sin cobertura, y no puede esperar a la red.
 *
 * Sin `next/image`: el componente lo pinta también la app empaquetada
 * (`movil/`), que no tiene el optimizador de Next. Por la misma razón, un
 * `import` de imagen da en la web un objeto (`StaticImageData`) y en la app la
 * dirección a secas; `direccion()` acepta las dos.
 *
 * TODO CSS
 * --------
 * El movimiento, el fundido y el tamaño viven en `globals.css` («El carrusel
 * de la presentación»): cada fila lleva sus fotos dos veces seguidas y se
 * desplaza la mitad de su ancho, así que el final empalma con el principio sin
 * salto. Decorativo entero, así que `aria-hidden` y sin texto alternativo.
 */
type Importada = string | { src: string };
const direccion = (f: Importada) => (typeof f === 'string' ? f : f.src);

const FOTOS = [f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12].map(direccion);

// La de abajo empieza por la otra mitad: así no pasan las mismas fotos una
// encima de otra.
const FILAS = [FOTOS, [...FOTOS.slice(6), ...FOTOS.slice(0, 6)]];

export function CarruselFotos() {
  return (
    // Dos capas: la de fuera mide el hueco (las consultas de contenedor la
    // miran a ella) y la de dentro lleva el fundido, que así puede cambiar
    // cuando solo cabe una fila.
    <div aria-hidden className="carrusel-presentacion">
      <div className="carrusel-fundido">
        {FILAS.map((fotos, i) => (
          <div key={i} className="carrusel-fila">
            <div className={'carrusel-pista' + (i === 1 ? ' carrusel-pista-inversa' : '')}>
              {[0, 1].map((copia) => (
                <div key={copia} className="carrusel-tanda">
                  {fotos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- también en la app, sin el optimizador de Next
                    <img key={src} src={src} alt="" draggable={false} decoding="async" className="carrusel-foto" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
