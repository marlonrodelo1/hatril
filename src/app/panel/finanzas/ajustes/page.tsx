import type { Metadata } from 'next';
import { Archive } from 'lucide-react';

import { requireFinanzas, requirePastor } from '@/lib/auth/guard-panel';
import { ministeriosParaVincular, opciones } from '@/lib/finanzas/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import {
  archivarCaja,
  archivarFondo,
  crearCaja,
  crearFondo,
  vincularFondo,
} from '../actions';

const CONFIRMACIONES: Record<string, string> = {
  vinculado:
    'Vinculado. Quien lleva ese ministerio ya ve el fondo en su pestaña «Fondo».',
  desvinculado: 'Desvinculado. El fondo ya no sale en ningún ministerio.',
};

export const metadata: Metadata = { title: 'Fondos y cajas' };

/**
 * Los nombres van con ejemplos reales del vertical, no con «Fondo 1».
 *
 * Un placeholder genérico obliga al pastor a inventarse la taxonomía desde
 * cero; uno con «Misiones» o «Construcción» le enseña para qué sirve la
 * pantalla sin un párrafo de ayuda.
 */
export default async function AjustesFinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  // Las dos puertas de los dos layouts, también aquí: el layout no protege la
  // página (CLAUDE.md). Hoy el pastor pasa la de finanzas siempre; si eso
  // cambia, esta página no debe enterarse tarde.
  await requireFinanzas();
  const ctx = await requirePastor();
  const { error, guardado } = await searchParams;
  const [{ fondos, cajas }, ministerios] = await Promise.all([
    opciones(ctx),
    ministeriosParaVincular(ctx),
  ]);
  // Qué ministerio tiene ya fondo, para no ofrecerlo en el desplegable de otro:
  // `uq_fondos_ministerio` lo rechazaría, y mejor no ofrecerlo que rebotar.
  const conFondo = new Map(
    fondos.flatMap((f) => (f.ministerioId ? [[f.ministerioId, f.id] as const] : [])),
  );

  return (
    <>
      <CabeceraPanel
        titulo="Fondos y cajas"
        volver={{ href: '/panel/finanzas', texto: 'Finanzas' }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <Seccion
          titulo="Fondos"
          explicacion="De quién es el dinero. Lo que se da para misiones o para la obra no se puede gastar en otra cosa, y separarlo aquí es lo que permite decir en la asamblea cuánto hay de cada. Si un fondo es de un ministerio —Alimentos, de Acción social—, vincúlalo: quien lo lleva verá su saldo y sus gastos, sin poder tocarlos."
        >
          <ul className="flex flex-col">
            {fondos.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 border-b border-border py-2.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[14.5px] font-medium">
                    {f.nombre}
                    {f.esGeneral && (
                      <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                        por defecto
                      </span>
                    )}
                  </span>
                  {/* El general no se archiva: sin él, un ingreso sin designar no
                      tiene dónde caer y el formulario se queda sin defecto. */}
                  {!f.esGeneral && (
                    <form action={archivarFondo}>
                      <input type="hidden" name="id" value={f.id} />
                      <Button type="submit" variant="ghost" className="h-8 text-[13px]">
                        <Archive className="size-[15px]" strokeWidth={1.7} />
                        Archivar
                      </Button>
                    </form>
                  )}
                </div>

                {/* El general no: es el dinero de toda la iglesia, y vinculado
                    su líder vería cada gasto de la congregación. */}
                {!f.esGeneral && (
                  <form
                    action={vincularFondo}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={f.id} />
                    {/* Sin tamaño de letra en el `select`: la regla de 16 px
                        del móvil de `globals.css` está en `@layer base`, y una
                        utilidad la pisaría (Safari ampliaría la página). */}
                    <label className="t-label flex min-w-[180px] flex-1 flex-col gap-1 text-muted-foreground">
                      Es el fondo de
                      <select
                        name="ministerioId"
                        defaultValue={f.ministerioId ?? ''}
                        className="h-9 rounded-lg border border-border bg-surface-alt px-2.5 text-foreground"
                      >
                        <option value="">Ningún ministerio</option>
                        {ministerios.map((m) => {
                          const otro = conFondo.get(m.id);
                          const ocupado = otro !== undefined && otro !== f.id;
                          return (
                            <option key={m.id} value={m.id} disabled={ocupado}>
                              {m.nombre}
                              {ocupado ? ' (ya tiene fondo)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <Button type="submit" variant="outline" size="sm">
                      Guardar
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          <form action={crearFondo} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
              Nombre del fondo
              <input
                name="nombre"
                required
                maxLength={60}
                placeholder="Misiones"
                className="h-10 rounded-lg border border-border bg-surface-alt px-3 text-[15px] text-foreground"
              />
            </label>
            <Button type="submit" variant="outline" className="h-10">
              Añadir fondo
            </Button>
          </form>
        </Seccion>

        <Seccion
          titulo="Cajas"
          explicacion="Dónde está el dinero. La caja fuerte del templo, la cuenta del banco, el Nequi de la iglesia."
        >
          <ul className="flex flex-col">
            {cajas.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="truncate text-[14.5px] font-medium">
                  {c.nombre}
                  <span className="ml-2 text-[12px] font-normal capitalize text-muted-foreground">
                    {c.tipo}
                  </span>
                </span>
                <form action={archivarCaja}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="ghost" className="h-8 text-[13px]">
                    <Archive className="size-[15px]" strokeWidth={1.7} />
                    Archivar
                  </Button>
                </form>
              </li>
            ))}
          </ul>

          <form action={crearCaja} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
              Nombre de la caja
              <input
                name="nombre"
                required
                maxLength={60}
                placeholder="Cuenta Bancolombia"
                className="h-10 rounded-lg border border-border bg-surface-alt px-3 text-[15px] text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
              Tipo
              <select
                name="tipo"
                defaultValue="banco"
                className="h-10 rounded-lg border border-border bg-surface-alt px-2.5 text-[15px] text-foreground"
              >
                <option value="efectivo">Efectivo</option>
                <option value="banco">Cuenta de banco</option>
                {/* Nequi y Daviplata GUARDAN saldo, así que son un sitio donde
                    el dinero se queda. Bizum no: es una transferencia, y por eso
                    está en métodos de pago y no aquí. */}
                <option value="billetera">Billetera (Nequi, Daviplata)</option>
                <option value="pasarela">Pasarela de pago</option>
              </select>
            </label>
            <Button type="submit" variant="outline" className="h-10">
              Añadir caja
            </Button>
          </form>
        </Seccion>
      </Contenedor>
    </>
  );
}

function Seccion({
  titulo,
  explicacion,
  children,
}: {
  titulo: string;
  explicacion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-bold tracking-[-0.015em]">{titulo}</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {explicacion}
        </p>
      </div>
      {children}
    </section>
  );
}
