'use client';

import { useState } from 'react';
import { CalendarPlus, TriangleAlert } from 'lucide-react';
import { clsx } from 'clsx';

import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { ampliarPrueba } from '../../actions';
import { esDia, formatearDia, sumarDias } from './dias';
import { CabeceraVentana, PieVentana, Ventana } from './ventana';

/**
 * «Ampliar la prueba», con atajos.
 *
 * LOS ATAJOS SOLO RELLENAN EL CAMPO DE SIEMPRE
 * --------------------------------------------
 * `ampliarPrueba` espera `hasta` como `YYYY-MM-DD` y no sabe nada de «+14
 * días». Cada atajo calcula el día y lo escribe en ese mismo campo, que es el
 * que viaja; «Otra fecha» lo enseña para escribirlo a mano. La action sigue
 * siendo la que decide: solo en `trial`, desde hoy, como mucho un año, y el
 * día cerrado a las 23:59 de la zona de la iglesia.
 *
 * DESDE CUÁNDO CUENTAN LOS DÍAS
 * -----------------------------
 * Desde el final que tiene, si todavía no ha llegado: «+7» a una prueba que
 * acaba el 31-dic es hasta el 7-ene. Si ya acabó, desde hoy: siete días más
 * contados desde un 15-nov pasado darían tres.
 */

type Atajo = 7 | 14 | 30;
const ATAJOS: Atajo[] = [7, 14, 30];

export function VentanaAmpliar(props: {
  id: string;
  nombre: string;
  /** Hoy en la iglesia, `YYYY-MM-DD`: lo mínimo que acepta la action. */
  hoy: string;
  /** El último día que la action deja poner (un año desde ahora). */
  maximo: string;
  /** El día en que acaba ahora, en su zona; `null` si no tiene fecha. */
  finActual: string | null;
  /** «Bogotá»: para decir en qué hora se cierra el día. */
  zona: string;
  describidoPor: string;
  /** Ver `Ventana`: llega abierta desde el inicio con `?ampliar=1`. */
  abiertaAlEntrar?: boolean;
}) {
  return (
    <Ventana
      id={props.id}
      accion={ampliarPrueba}
      abiertaAlEntrar={props.abiertaAlEntrar}
      disparador={{ texto: 'Ampliar', describidoPor: props.describidoPor }}
    >
      <FormularioAmpliar {...props} />
    </Ventana>
  );
}

/**
 * Dentro de la ventana para que el atajo elegido vuelva a empezar cada vez que
 * se abre: se monta al abrir y se desmonta al cerrar.
 */
function FormularioAmpliar({
  nombre,
  hoy,
  maximo,
  finActual,
  zona,
}: {
  nombre: string;
  hoy: string;
  maximo: string;
  finActual: string | null;
  zona: string;
}) {
  const vigente = finActual !== null && finActual >= hoy;
  const base = vigente ? finActual : hoy;
  const diaDe = (n: Atajo) => sumarDias(base, n);
  const cabe = (n: Atajo) => diaDe(n) <= maximo;

  // +14, el de lo aprobado, si cabe en el año; si no, el más largo que quepa;
  // si ninguno, la fecha a mano.
  const inicial: Atajo | 'otra' =
    (cabe(14) ? 14 : ATAJOS.filter(cabe).at(-1)) ?? 'otra';

  const [modo, setModo] = useState<Atajo | 'otra'>(inicial);
  const [dia, setDia] = useState(inicial === 'otra' ? '' : diaDe(inicial));

  function elegir(m: Atajo | 'otra') {
    setModo(m);
    // «Otra fecha» parte del día que había: se corrige desde ahí en vez de
    // empezar con el calendario en blanco.
    if (m !== 'otra') setDia(diaDe(m));
  }

  const formado = esDia(dia);
  const error = !formado
    ? null
    : dia < hoy
      ? 'Esa fecha ya ha pasado. Para cortar el acceso, suspende la iglesia.'
      : dia > maximo
        ? `Como mucho, un año desde hoy: hasta el ${formatearDia(maximo)}.`
        : null;
  const valida = formado && !error;
  const mismo = valida && dia === finActual;
  // Se puede acortar —la action pone el día que se le dé desde hoy, y la ficha
  // de antes lo permitía para corregir—, pero no sin decirlo.
  const acorta = valida && finActual !== null && vigente && dia < finActual;

  return (
    <>
      <CabeceraVentana
        icono={<CalendarPlus className="size-[18px]" strokeWidth={1.8} />}
        titulo={`Ampliar la prueba de ${nombre}`}
      >
        {finActual === null
          ? 'No tiene fecha de fin. Los días cuentan desde hoy.'
          : vigente
            ? `Ahora acaba el ${formatearDia(finActual)}. Los días se suman a esa fecha.`
            : `Acabó el ${formatearDia(finActual)}. Los días cuentan desde hoy.`}
      </CabeceraVentana>

      <div role="group" aria-label="Cuánto más" className="flex flex-wrap gap-2">
        {ATAJOS.map((n) => (
          <OpcionAtajo
            key={n}
            elegida={modo === n}
            deshabilitada={!cabe(n)}
            onClick={() => elegir(n)}
          >
            +{n} días
          </OpcionAtajo>
        ))}
        <OpcionAtajo elegida={modo === 'otra'} onClick={() => elegir('otra')}>
          Otra fecha
        </OpcionAtajo>
      </div>

      {/* El campo que viaja es SIEMPRE este, también con un atajo: entonces
          va escondido con el día ya escrito. `hidden` no lo saca del envío. */}
      <div hidden={modo !== 'otra'} className="anim-aparece">
        <Campo
          etiqueta="Hasta el día"
          htmlFor="ampliar-hasta"
          error={modo === 'otra' ? error : null}
          ayuda={`Como mucho, hasta el ${formatearDia(maximo)}.`}
        >
          <Input
            id="ampliar-hasta"
            name="hasta"
            type="date"
            required
            min={hoy}
            max={maximo}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="max-w-[220px]"
          />
        </Campo>
      </div>

      {/* Lo que va a quedar, dicho antes de pulsar. `aria-live` para que el
          cambio de atajo se oiga sin tener que volver a buscarlo. */}
      <div
        aria-live="polite"
        className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-alt px-3.5 py-3"
      >
        {valida ? (
          <p className="text-body text-pretty">
            Hasta el{' '}
            <strong className="font-semibold tabular-nums">{formatearDia(dia)}</strong>{' '}
            a las 23:59, hora de {zona}.
          </p>
        ) : (
          <p className="text-label text-pretty text-muted-foreground">
            Elige el día en el calendario.
          </p>
        )}
        {mismo && (
          <p className="text-label text-muted-foreground">
            Es el día que ya tiene: no cambiaría nada.
          </p>
        )}
        {acorta && finActual && (
          <p className="flex items-start gap-1.5 text-label font-semibold text-badge-warning-fg">
            <TriangleAlert className="mt-px size-[15px] flex-none" strokeWidth={1.8} aria-hidden />
            Es antes del {formatearDia(finActual)} que tiene ahora: la prueba se acorta.
          </p>
        )}
      </div>

      <PieVentana>
        <BotonEnviar
          pendiente={acorta ? 'Cambiando…' : 'Ampliando…'}
          disabled={!valida || mismo}
        >
          <CalendarPlus strokeWidth={1.8} /> {acorta ? 'Cambiar' : 'Ampliar'}
        </BotonEnviar>
      </PieVentana>
    </>
  );
}

/**
 * Una opción de los atajos. Lo elegido es `bg-accent text-accent-foreground`
 * con borde naranja, porque las demás llevan borde (guía visual, «Pestañas,
 * segmentado y opción elegida»). `clsx`: `text-label` junto a un color.
 */
function OpcionAtajo({
  elegida,
  deshabilitada = false,
  onClick,
  children,
}: {
  elegida: boolean;
  deshabilitada?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      disabled={deshabilitada}
      onClick={onClick}
      className={clsx(
        'h-9 cursor-pointer rounded-full border px-3.5 text-label whitespace-nowrap outline-none',
        'transition-colors duration-150 motion-reduce:transition-none',
        'focus-visible:ring-3 focus-visible:ring-ring/20',
        'disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-surface disabled:text-disabled-text',
        elegida
          ? 'border-primary bg-accent font-semibold text-accent-foreground'
          : 'border-border bg-surface-alt font-medium text-foreground hover:bg-surface-active',
      )}
    >
      {children}
    </button>
  );
}
