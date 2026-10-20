import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import {
  DIAS_EN_NUEVOS,
  type CifrasSeguimiento,
} from '@/lib/seguimiento/consultas';
import { Button } from '@/components/ui/button';

/**
 * Quién llega y quién falta, en cuatro cifras.
 *
 * SOLO NÚMEROS
 * ------------
 * Los nombres siguen detrás de las tres llaves del seguimiento: `ver_seguimiento`,
 * llevar el ministerio y el módulo encendido. Este bloque solo existe para quien
 * las tiene en al menos un ministerio (`cifrasDeSeguimiento()` devuelve `null`
 * si no), así que cada cifra lleva a una lista que esa persona sí puede abrir.
 *
 * Cuatro preguntas que el pastor se hace el lunes, y no más: cuánta gente nueva,
 * si vuelve, si alguien la ha llamado, y a quién se le está perdiendo.
 */
export function BloqueSeguimiento({ cifras }: { cifras: CifrasSeguimiento }) {
  // Con un solo ministerio con seguimiento —lo normal: Consolidación— cada cifra
  // lleva a su lista. Con dos (Consolidación y Evangelismo) no hay una lista
  // única a la que mandar, y las cifras se quedan quietas: los botones de abajo
  // llevan a cada uno.
  const unico = cifras.ministerios.length === 1 ? cifras.ministerios[0]! : null;
  const nuevos = unico ? `/panel/ministerios/${unico.id}/seguimiento/nuevos` : null;
  const ausentes = unico ? `/panel/ministerios/${unico.id}/seguimiento` : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-micro">Quién llega y quién falta</h2>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Cifra
            etiqueta="Llegaron este mes"
            valor={cifras.llegaronEsteMes}
            href={nuevos}
          />
          <Cifra
            etiqueta="Han vuelto"
            // Sin lista no es cero, es que no se sabe. Un cero aquí diría que
            // no ha vuelto nadie.
            valor={cifras.hayListas ? cifras.volvieron : null}
            detalle={
              cifras.hayListas
                ? `de ${cifras.enNuevos} en nuevos`
                : 'sin lista, no se sabe'
            }
            href={nuevos}
          />
          <Cifra
            etiqueta="Nuevos sin llamar"
            valor={cifras.sinLlamar}
            href={nuevos}
          />
          <Cifra
            etiqueta="Faltan 3 o más reuniones"
            valor={cifras.ausentesTresOMas}
            href={ausentes}
          />
        </div>

        {!cifras.hayListas && (
          <p className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
            En los últimos {DIAS_EN_NUEVOS} días no se ha pasado lista en ningún
            culto. Sin lista no se sabe quién ha vuelto, y las faltas solo
            cuentan los cultos en los que sí se pasó.
          </p>
        )}

        {/* Las cifras ya llevan a su lista, pero no lo parecen: el enlace
            visible es este. En `outline`, porque el naranja de la pantalla no
            es de este bloque. */}
        <div className="flex flex-wrap gap-2">
          {cifras.ministerios.map((m) => (
            <Button
              key={m.id}
              variant="outline"
              size="sm"
              render={<Link href={`/panel/ministerios/${m.id}/seguimiento/nuevos`} />}
            >
              {unico ? `Abrir ${m.nombre}` : m.nombre}
              <ArrowRight strokeWidth={1.9} />
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cifra({
  etiqueta,
  valor,
  detalle,
  href,
}: {
  etiqueta: string;
  valor: number | null;
  detalle?: string;
  href: string | null;
}) {
  const contenido = (
    <>
      <span className="t-micro">{etiqueta}</span>
      <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums">
        {valor ?? '—'}
      </span>
      {detalle && (
        <span className="text-[12.5px] text-muted-foreground">{detalle}</span>
      )}
    </>
  );

  if (!href) return <div className="flex flex-col gap-1.5">{contenido}</div>;

  return (
    <Link
      href={href}
      className="-m-2 flex flex-col gap-1.5 rounded-lg p-2 text-foreground no-underline transition-colors hover:bg-surface-alt hover:no-underline"
    >
      {contenido}
    </Link>
  );
}
