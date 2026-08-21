import type { Metadata } from 'next';
import { Archive } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { opciones } from '@/lib/finanzas/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { archivarCaja, archivarFondo, crearCaja, crearFondo } from '../actions';

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
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error } = await searchParams;
  const { fondos, cajas } = await opciones(ctx);

  return (
    <>
      <CabeceraPanel
        titulo="Fondos y cajas"
        volver={{ href: '/panel/finanzas', texto: 'Finanzas' }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <Seccion
          titulo="Fondos"
          explicacion="De quién es el dinero. Lo que se da para misiones o para la obra no se puede gastar en otra cosa, y separarlo aquí es lo que permite decir en la asamblea cuánto hay de cada."
        >
          <ul className="flex flex-col">
            {fondos.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
              >
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
                className="h-10 rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
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
                className="h-10 rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
              Tipo
              <select
                name="tipo"
                defaultValue="banco"
                className="h-10 rounded-lg border border-border bg-background px-2.5 text-[15px] text-foreground"
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
