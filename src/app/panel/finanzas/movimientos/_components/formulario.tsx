'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * El formulario de la caja.
 *
 * TRES CAMPOS ARRIBA Y EL RESTO PLEGADO
 * -------------------------------------
 * Quien rellena esto es un profesor o una enfermera, el domingo a las 20:30, de
 * pie, en el móvil, con prisa por irse a casa. Fecha, importe y concepto son lo
 * único que hace falta pensar; fondo, caja, método y tipo tienen un valor por
 * defecto que acierta en la inmensa mayoría de los domingos.
 *
 * Un formulario de nueve campos obligatorios no es más completo: es el motivo
 * por el que vuelve al cuaderno.
 *
 * EL IMPORTE ES `inputMode="decimal"`, NO `type="number"`
 * -------------------------------------------------------
 * `type="number"` en móvil abre un teclado con flechas de incremento, rechaza
 * el punto según el locale del teléfono y en algunos Android permite escribir
 * «e». Con `text` + `inputMode="decimal"` sale el teclado numérico y llega la
 * cadena tal cual la escribió la persona, que es lo que `parsearDinero()`
 * espera: en Colombia teclean «250.000» y en España «250,50».
 */

interface Opcion {
  id: string;
  nombre: string;
}

export function FormularioMovimiento({
  accion,
  fondos,
  cajas,
  valores,
  textoEnviar,
  idMovimiento,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  fondos: Opcion[];
  cajas: Opcion[];
  valores: {
    tipo?: 'ingreso' | 'gasto';
    fecha: string;
    importe?: string;
    concepto?: string;
    fondoId?: string;
    cajaId?: string;
    metodoPago?: string;
    tipoIngreso?: string;
    referencia?: string;
  };
  textoEnviar: string;
  idMovimiento?: string;
}) {
  const [tipo, setTipo] = useState<'ingreso' | 'gasto'>(
    valores.tipo ?? 'ingreso',
  );
  const [abierto, setAbierto] = useState(false);

  return (
    <form action={accion} className="flex flex-col gap-5">
      {idMovimiento && <input type="hidden" name="id" value={idMovimiento} />}

      {/* Entra / sale. Dos botones y no un desplegable: es la decisión más
          frecuente del formulario y tiene exactamente dos respuestas. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13.5px] font-semibold">
          ¿El dinero entra o sale?
        </legend>
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipo('ingreso')}
            aria-pressed={tipo === 'ingreso'}
            className={
              'h-11 cursor-pointer rounded-lg border text-[15px] font-semibold transition-colors ' +
              (tipo === 'ingreso'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-surface text-muted-foreground hover:bg-background')
            }
          >
            Entra
          </button>
          <button
            type="button"
            onClick={() => setTipo('gasto')}
            aria-pressed={tipo === 'gasto'}
            className={
              'h-11 cursor-pointer rounded-lg border text-[15px] font-semibold transition-colors ' +
              (tipo === 'gasto'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-surface text-muted-foreground hover:bg-background')
            }
          >
            Sale
          </button>
        </div>
      </fieldset>

      <Campo etiqueta="Fecha" htmlFor="fecha">
        <input
          id="fecha"
          name="fecha"
          type="date"
          required
          defaultValue={valores.fecha}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
        />
      </Campo>

      <Campo etiqueta="Importe" htmlFor="importe">
        <input
          id="importe"
          name="importe"
          type="text"
          inputMode="decimal"
          required
          autoComplete="off"
          placeholder="250.000"
          defaultValue={valores.importe}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[17px] font-semibold tabular-nums text-foreground"
        />
      </Campo>

      <Campo
        etiqueta="¿Qué fue?"
        htmlFor="concepto"
        // El aviso va PEGADO al campo y no en la política de privacidad. Es el
        // único sitio donde alguien lo va a leer, y este campo es el agujero
        // por el que se cuela lo que el modelo evita estructuralmente: sale tal
        // cual en el CSV que se le pasa al contador.
        ayuda="No escribas aquí nombres de personas ni motivos de salud."
      >
        <input
          id="concepto"
          name="concepto"
          type="text"
          required
          maxLength={200}
          placeholder={
            tipo === 'ingreso' ? 'Ofrenda del culto' : 'Recibo de la luz'
          }
          defaultValue={valores.concepto}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
        />
      </Campo>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex h-11 cursor-pointer items-center justify-between px-3 text-[14px] font-medium text-muted-foreground"
        >
          Más opciones
          <ChevronDown
            className={`size-[17px] transition-transform ${abierto ? 'rotate-180' : ''}`}
            strokeWidth={1.8}
          />
        </button>

        {/* Se mantiene en el DOM al plegarse (`hidden`, no desmontado) para que
            los valores por defecto viajen igual en el envío. Desmontándolo,
            `fondo_id` llegaría vacío y la inserción fallaría por un campo que
            la persona nunca vio. */}
        <div className={`flex flex-col gap-4 px-3 pb-4 ${abierto ? '' : 'hidden'}`}>
          <Campo etiqueta="Fondo" htmlFor="fondoId">
            <select
              id="fondoId"
              name="fondoId"
              defaultValue={valores.fondoId ?? fondos[0]?.id}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
            >
              {fondos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Caja" htmlFor="cajaId">
            <select
              id="cajaId"
              name="cajaId"
              defaultValue={valores.cajaId ?? cajas[0]?.id}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
            >
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Método de pago" htmlFor="metodoPago">
            <select
              id="metodoPago"
              name="metodoPago"
              defaultValue={valores.metodoPago ?? 'efectivo'}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>

          {/* Solo en ingresos: el CHECK de la base PROHÍBE que un gasto lleve
              tipo de ingreso, así que enviarlo con «Sale» marcado tumbaría la
              inserción. La action lo pone a null de todas formas, esto es para
              que no se vea un campo que no aplica. */}
          {tipo === 'ingreso' && (
            <Campo etiqueta="Tipo de ingreso" htmlFor="tipoIngreso">
              <select
                id="tipoIngreso"
                name="tipoIngreso"
                defaultValue={valores.tipoIngreso ?? 'ofrenda'}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
              >
                <option value="ofrenda">Ofrenda</option>
                <option value="diezmo">Diezmo</option>
                <option value="donacion">Donación</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
          )}

          <Campo
            etiqueta="Referencia"
            htmlFor="referencia"
            ayuda="Número de consignación o de transferencia, si lo hay."
          >
            <input
              id="referencia"
              name="referencia"
              type="text"
              maxLength={100}
              defaultValue={valores.referencia}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground"
            />
          </Campo>
        </div>
      </div>

      <Button type="submit" className="h-11 w-full text-[15px]">
        {textoEnviar}
      </Button>
    </form>
  );
}

function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  children,
}: {
  etiqueta: string;
  htmlFor: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold">
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {ayuda}
        </p>
      )}
    </div>
  );
}
