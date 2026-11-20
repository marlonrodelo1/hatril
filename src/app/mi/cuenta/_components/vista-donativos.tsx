import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { HandHeart, ReceiptText, Repeat, TriangleAlert } from 'lucide-react';
import { clsx } from 'clsx';

import type { MisDonativos } from '@/lib/donativos/consultas';
import { NOMBRE_TIPO, aCentimos, formatearEuros } from '@/lib/donativos/calculo';
import { Aviso } from '@/components/aviso';
import { buttonVariants } from '@/components/ui/button';
import { Cifra } from '@/components/ui/cifra';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Lista } from '@/components/ui/fila';
import { DejarMensual } from '../donativos/_components/dejar-mensual';

/**
 * Lo que pinta «Lo que he dado», sin consultar nada. Salió de
 * `../donativos/page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`). `EnlaceDar` es el enlace a la página de dar: en la
 * app abre SIEMPRE fuera (norma 3.2.2 de Apple).
 */
type PropsEnlaceDar = { href: string; className?: string; children: ReactNode };

export function VistaDonativos({
  cabecera,
  EnlaceDar,
  iglesia,
  mios,
  dar,
  actual,
  error,
  dejado,
}: {
  cabecera: ReactNode;
  EnlaceDar: ComponentType<PropsEnlaceDar>;
  iglesia: { slug: string; nombre: string };
  mios: MisDonativos;
  dar: { conTarjeta: boolean; conTransferencia: boolean };
  /** El año en curso, en la zona de la iglesia. */
  actual: number;
  error?: string;
  dejado?: string;
}) {
  const esEsteAnio = mios.anio === actual;
  // Lo de cada mes es de ahora: en un año pasado no pinta nada (maqueta).
  const mensuales = esEsteAnio ? mios.mensuales : [];
  const nadaNunca =
    mios.lista.length === 0 && mios.mensuales.length === 0 && mios.aniosConDatos.length <= 1;
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {dejado && (
          <Aviso tipo="ok">
            Hecho. Ya no se cobrará nada más cada mes. Lo que ya habías dado sigue aquí.
          </Aviso>
        )}

        {nadaNunca ? (
          <EstadoVacio
            Icono={ReceiptText}
            titulo="Todavía no has dado con tarjeta"
            accion={dar.conTarjeta ? <BotonDar slug={iglesia.slug} iglesia={iglesia.nombre} EnlaceDar={EnlaceDar} /> : undefined}
          >
            {dar.conTarjeta
              ? `Cuando des a ${iglesia.nombre} con tarjeta desde Hatril, aquí verás cada pago, lo que das cada mes y el total del año.`
              : `Aquí saldrá lo que des con tarjeta cuando ${iglesia.nombre} lo active. Lo que se da por transferencia no pasa por Hatril.`}
          </EstadoVacio>
        ) : (
          <>
            {mios.aniosConDatos.length > 1 && (
              <Anios anios={mios.aniosConDatos} elegido={mios.anio} actual={actual} />
            )}

            {mios.lista.length > 0 && (
              <Cifra
                etiqueta={esEsteAnio ? `En ${mios.anio}, hasta hoy` : `En ${mios.anio}`}
                valor={formatearEuros(Number(mios.total))}
              >
                <span className="text-pretty text-label text-muted-foreground">
                  {desglose(mios)}
                </span>
              </Cifra>
            )}

            {mensuales.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-micro px-1">Cada mes</h2>
                {mensuales.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="flex size-8 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-support [&>svg]:size-4"
                      >
                        <Repeat strokeWidth={1.8} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="text-body font-semibold">
                          Cada mes, {formatearEuros(Number(m.total))}
                        </span>
                        <span className="text-pretty text-label text-muted-foreground">
                          {m.lineas.map((l) => `${NOMBRE_TIPO[l.tipo]} · ${l.fondo}`).join(', ')}
                          {m.dia !== null && ` · el día ${m.dia}`}
                        </span>
                      </span>
                    </div>
                    {m.estado === 'impagado' && (
                      // Con icono y no solo color (regla 2 del sistema).
                      <p className="flex items-start gap-2 text-pretty text-label text-badge-warning-fg">
                        <TriangleAlert className="mt-px size-4 flex-none" strokeWidth={1.8} aria-hidden />
                        El último cobro no se pudo hacer con tu tarjeta.
                      </p>
                    )}
                    <DejarMensual
                      id={m.id}
                      cuanto={formatearEuros(Number(m.total))}
                      iglesia={iglesia.nombre}
                    />
                  </div>
                ))}
              </section>
            )}

            {mios.lista.length > 0 ? (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-micro px-1">Cada pago</h2>
                <Lista>
                  {mios.lista.map((d) => {
                    const sumaLineas = d.lineas.reduce((s, l) => s + aCentimos(Number(l.importe)), 0);
                    const conComision = aCentimos(Number(d.total)) > sumaLineas;
                    const debajo = [
                      d.periodicidad === 'mensual' ? 'Cada mes' : null,
                      conComision ? 'con la comisión cubierta' : null,
                    ].filter(Boolean);
                    return (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                      >
                        {/* 56 px: «18 sept», que es como abrevia septiembre el
                            español de España, no cabía en 48. */}
                        <span className="w-14 flex-none text-label text-muted-foreground tabular-nums">
                          {diaCorto(d.fecha)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          {/* Una línea por cosa: con varias seguidas y un «+»
                              en medio, un pago de dos fondos ocupaba tres
                              renglones y no se veía cuánto iba a cada uno. */}
                          {d.lineas.map((l, i) => (
                            <span key={i} className="text-pretty text-body font-semibold">
                              {NOMBRE_TIPO[l.tipo]} · {l.fondo}
                              {d.lineas.length > 1 && (
                                <span className="font-normal text-muted-foreground tabular-nums">
                                  {' · '}
                                  {formatearEuros(Number(l.importe))}
                                </span>
                              )}
                            </span>
                          ))}
                          {debajo.length > 0 && (
                            <span className="text-label text-muted-foreground">
                              {primeraMayuscula(debajo.join(', '))}
                            </span>
                          )}
                        </span>
                        <span className="flex-none text-body font-bold whitespace-nowrap tabular-nums">
                          {formatearEuros(Number(d.total))}
                        </span>
                      </li>
                    );
                  })}
                </Lista>
              </section>
            ) : (
              // Solo pasa en el año en curso, cuando hay años anteriores con
              // datos: los demás años de la lista son justo los que tienen.
              <EstadoVacio
                Icono={ReceiptText}
                titulo={`En ${mios.anio} todavía no has dado con tarjeta`}
                accion={dar.conTarjeta ? <BotonDar slug={iglesia.slug} iglesia={iglesia.nombre} EnlaceDar={EnlaceDar} /> : undefined}
              />
            )}
          </>
        )}

        {/* En el vacío de una iglesia sin tarjeta no hay nada que aclarar. Con
            tarjeta sí: quien dio desde Safari sin entrar no ve nada aquí, y es
            justo cuando hay que decirle por qué. */}
        {(!nadaNunca || dar.conTarjeta) && (
          <div className="flex flex-col gap-1.5 px-1 text-pretty text-label text-muted-foreground">
            <p>
              Esto lo ves tú y, en el panel de {iglesia.nombre}, el pastor y
              tesorería. Lo que das sin haber entrado en tu cuenta no sale aquí:
              su recibo te llega al correo.
            </p>
            <p>El certificado para la declaración de la renta llegará más adelante.</p>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Los años, como opciones: enlaces a la misma pantalla con `?anio=`, que se
 * pueden copiar, sirven sin JavaScript y vuelven atrás con el navegador.
 * Píldoras porque son opciones, no acciones, y la elegida como el resto de
 * opciones de Hatril (`OpcionAtajo`): naranja suave con borde naranja. El año
 * en curso va sin parámetro, que es lo que se abre por defecto.
 *
 * Con un solo año no salen: una opción sola no es elegir nada.
 */
function Anios({ anios, elegido, actual }: { anios: number[]; elegido: number; actual: number }) {
  return (
    <nav aria-label="Año" className="flex flex-wrap gap-1.5">
      {anios.map((a) => {
        const activo = a === elegido;
        return (
          <Link
            key={a}
            href={a === actual ? '/mi/cuenta/donativos' : `/mi/cuenta/donativos?anio=${a}`}
            scroll={false}
            aria-current={activo ? 'true' : undefined}
            className={clsx(
              'inline-flex h-9 flex-none items-center rounded-full border px-3.5 text-label whitespace-nowrap tabular-nums no-underline transition-colors duration-150 hover:no-underline motion-reduce:transition-none',
              activo
                ? 'border-primary bg-accent font-semibold text-accent-foreground hover:text-accent-foreground'
                : 'border-border bg-surface-alt font-medium text-foreground hover:bg-surface-active hover:text-foreground',
            )}
          >
            {a}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * El enlace a dar del vacío. De contorno: esta pantalla es para mirar lo que
 * ya se dio, y pedir con el botón naranja aquí sería empujar.
 */
function BotonDar({
  slug,
  iglesia,
  EnlaceDar,
}: {
  slug: string;
  iglesia: string;
  EnlaceDar: ComponentType<PropsEnlaceDar>;
}) {
  return (
    <EnlaceDar
      href={`/i/${slug}/dar`}
      className={buttonVariants({ variant: 'outline' })}
    >
      <HandHeart strokeWidth={1.8} aria-hidden />
      Dar a {iglesia}
    </EnlaceDar>
  );
}

/**
 * «550,00 € de diezmo y 60,00 € de ofrendas». El total incluye lo que se
 * añadió para cubrir la comisión de la tarjeta, que no es ni diezmo ni ofrenda
 * (las líneas guardan solo lo que se dio): si lo hay, se nombra, para que las
 * tres cifras sumen el total de arriba.
 */
function desglose(m: MisDonativos): string {
  const total = aCentimos(Number(m.total));
  const diezmo = aCentimos(Number(m.diezmo));
  const ofrendas = aCentimos(Number(m.ofrendas));
  const comision = total - diezmo - ofrendas;
  const partes = [
    `${formatearEuros(diezmo / 100)} de diezmo`,
    `${formatearEuros(ofrendas / 100)} de ofrendas`,
  ];
  if (comision > 0) partes.push(`${formatearEuros(comision / 100)} para cubrir la comisión`);
  return partes.length === 2
    ? partes.join(' y ')
    : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

/**
 * «18 nov». La fecha ya es el día del cobro en la zona de la iglesia
 * (`YYYY-MM-DD`), así que se formatea en UTC: con la zona del servidor, en
 * Bogotá saldría el día anterior.
 */
const FORMATO_DIA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
function diaCorto(fecha: string): string {
  if (!fecha) return '';
  return FORMATO_DIA.format(new Date(`${fecha}T00:00:00Z`)).replace('.', '');
}

function primeraMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
