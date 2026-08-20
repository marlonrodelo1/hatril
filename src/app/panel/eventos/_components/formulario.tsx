'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_ACOMPANANTES } from '../constantes';

/**
 * El formulario de un evento, compartido por alta y edición.
 *
 * ES CLIENTE POR UNA SOLA COSA: el bloque de cobro se pliega. Todo lo demás es
 * un formulario nativo con `defaultValue`, sin estado.
 *
 * Y el bloque plegado va con `hidden` y NO se desmonta, igual que «Más
 * opciones» en el formulario de movimientos: si se desmontara, los valores que
 * el pastor ya había escrito dejarían de viajar en el envío y se perderían al
 * guardar sin que él lo viera.
 */
export function FormularioEvento({
  accion,
  valores,
  textoEnviar,
  moneda,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  valores: {
    titulo: string;
    descripcion: string;
    lugar: string;
    inicio: string;
    fin: string;
    precio: string;
    cupo: string;
    enlacePago: string;
    pagoInstrucciones: string;
  };
  textoEnviar: string;
  moneda: string;
}) {
  const [cobroAbierto, setCobroAbierto] = useState(
    Boolean(valores.precio || valores.enlacePago || valores.pagoInstrucciones),
  );

  return (
    <form action={accion} className="flex flex-col gap-6">
      <Campo etiqueta="Título" nombre="titulo" requerido>
        <Input
          id="titulo"
          name="titulo"
          required
          autoFocus
          maxLength={140}
          defaultValue={valores.titulo}
          placeholder="Retiro de jóvenes"
        />
      </Campo>

      <Campo
        etiqueta="De qué va"
        nombre="descripcion"
        ayuda="Lo que lee alguien que no os conoce y está pensando si venir."
      >
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          maxLength={4000}
          defaultValue={valores.descripcion}
          className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Empieza"
          nombre="inicio"
          requerido
          ayuda="La hora de tu iglesia."
        >
          <Input
            id="inicio"
            name="inicio"
            type="datetime-local"
            required
            defaultValue={valores.inicio}
          />
        </Campo>

        <Campo
          etiqueta="Termina"
          nombre="fin"
          ayuda="Solo si dura más de un rato. Un retiro de tres días sigue saliendo en la web los tres."
        >
          <Input
            id="fin"
            name="fin"
            type="datetime-local"
            defaultValue={valores.fin}
          />
        </Campo>

        <Campo etiqueta="Dónde" nombre="lugar">
          <Input
            id="lugar"
            name="lugar"
            maxLength={160}
            defaultValue={valores.lugar}
            placeholder="Templo, finca El Retiro…"
          />
        </Campo>

        <Campo
          etiqueta="Plazas"
          nombre="cupo"
          ayuda={`Déjalo vacío si no hay límite. Se cuentan personas: cada inscripción puede traer hasta ${MAX_ACOMPANANTES} acompañantes.`}
        >
          <Input
            id="cupo"
            name="cupo"
            type="text"
            inputMode="numeric"
            maxLength={6}
            defaultValue={valores.cupo}
            placeholder="50"
          />
        </Campo>
      </div>

      {/* ---------- Cobro ---------- */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo">¿Se cobra la entrada?</h2>
            <p className="text-[13px] text-muted-foreground">
              Hatril no cobra ni intermedia. Pones tu propio medio de pago y
              apuntas a mano quién ha pagado.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCobroAbierto((v) => !v)}
          >
            {cobroAbierto ? 'Ocultar' : 'Configurar'}
          </Button>
        </div>

        {/* `hidden` y no desmontar: si se desmontara, lo ya escrito dejaría de
            viajar en el envío y se perdería al guardar. */}
        <div hidden={!cobroAbierto} className="flex flex-col gap-4">
          <Campo
            etiqueta={`Precio (${moneda})`}
            nombre="precio"
            ayuda="Déjalo vacío si es gratis. Cero no vale: o es gratis o tiene precio."
          >
            <Input
              id="precio"
              name="precio"
              // `text` y no `number`, igual que el importe de un movimiento: con
              // `number`, la rueda del ratón cambia la cifra sin que nadie lo
              // note y el separador decimal depende del idioma del navegador.
              type="text"
              inputMode="decimal"
              maxLength={14}
              defaultValue={valores.precio}
              placeholder="50000"
            />
          </Campo>

          <Campo
            etiqueta="Enlace de pago"
            nombre="enlacePago"
            ayuda="La dirección completa que te da tu pasarela: Stripe, Wompi, PayU… Tiene que empezar por https://"
          >
            <Input
              id="enlacePago"
              name="enlacePago"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={600}
              defaultValue={valores.enlacePago}
              placeholder="https://buy.stripe.com/…"
            />
          </Campo>

          <Campo
            etiqueta="Cómo pagar"
            nombre="pagoInstrucciones"
            ayuda="Para Bizum, Nequi o transferencia. Se muestra como texto, no como enlace."
          >
            <textarea
              id="pagoInstrucciones"
              name="pagoInstrucciones"
              rows={2}
              maxLength={300}
              defaultValue={valores.pagoInstrucciones}
              placeholder="Nequi 300 123 4567 a nombre de…"
              className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
          </Campo>
        </div>
      </div>

      <Button type="submit" className="w-fit">
        {textoEnviar}
      </Button>
    </form>
  );
}

function Campo({
  etiqueta,
  nombre,
  ayuda,
  requerido,
  children,
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>
        {etiqueta}
        {!requerido && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            (opcional)
          </span>
        )}
      </Label>
      {children}
      {ayuda && <p className="t-label text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
