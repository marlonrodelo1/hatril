import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';

import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { iniciales } from '@/lib/format/iniciales';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { Button } from '@/components/ui/button';

/**
 * La web pública de una iglesia.
 *
 * ISR de 60 segundos: es una página que cambia dos veces al año y que puede
 * recibir una punta de visitas cuando la congregación la comparte por WhatsApp.
 * Sin esto, cada visita sería dos consultas a Irlanda.
 *
 * El `revalidate` hay que ponerlo explícito porque las consultas van por Drizzle
 * y no por `fetch`: Next no las ve y trataría la página como dinámica.
 *
 * QUÉ TRAE DATOS DE VERDAD Y QUÉ NO
 * ---------------------------------
 * Los grupos son los ministerios reales de la iglesia. Del diseño faltan tres
 * bloques y los tres por el mismo motivo —no hay de dónde sacarlos todavía—:
 *
 *   - «El domingo pasado vinieron 142 personas»  → asistencias (v2)
 *   - La agenda de lo próximo                    → eventos (v2)
 *   - El desglose de en qué se gasta lo donado   → finanzas (v2)
 *
 * Se dejan fuera enteros en vez de rellenarlos con cifras de ejemplo. Esta es
 * la página que la iglesia enseña a quien no la conoce: un dato inventado aquí
 * no es un detalle de maqueta, es la primera impresión.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) return { title: 'Iglesia no encontrada' };

  const descripcion =
    iglesia.descripcion ??
    `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}. Horarios, grupos y cómo llegar.`;

  return {
    // `absolute` para saltarse la plantilla «%s · Hatril»: esta es la web de la
    // iglesia, no una pantalla de nuestro producto. Que su nombre salga en la
    // pestaña acompañado de nuestra marca es apropiarse de algo que no es
    // nuestro.
    title: { absolute: `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}` },
    description: descripcion,
    openGraph: {
      title: iglesia.nombre,
      description: descripcion,
      type: 'website',
      images: iglesia.bannerUrl ? [iglesia.bannerUrl] : undefined,
    },
  };
}

export default async function WebIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) notFound();

  const destacado = iglesia.horarios.find((h) => h.destacado);
  const tieneContacto = Boolean(
    iglesia.direccion || iglesia.telefono || iglesia.email,
  );
  const parrafos = (iglesia.historia ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const secciones: { href: string; texto: string }[] = [];
  if (iglesia.horarios.length > 0) {
    secciones.push({ href: '#horarios', texto: 'Horarios' });
  }
  if (parrafos.length > 0) {
    secciones.push({ href: '#quienes', texto: 'Quiénes somos' });
  }
  if (iglesia.grupos.length > 0) {
    secciones.push({ href: '#grupos', texto: 'Grupos' });
  }
  if (tieneContacto) {
    secciones.push({ href: '#contacto', texto: 'Contacto' });
  }

  return (
    <div className="bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-3.5 md:px-10">
          <span className="flex flex-none items-center gap-[11px]">
            <span className="flex size-[38px] flex-none items-center justify-center rounded-[10px] bg-primary text-[14px] font-bold tracking-[-0.02em] text-primary-foreground">
              {iniciales(iglesia.nombre)}
            </span>
            <span className="flex flex-col">
              <span className="text-[15.5px] font-bold tracking-[-0.018em]">
                {iglesia.nombre}
              </span>
              {iglesia.ciudad && (
                <span className="text-[12px] text-muted-foreground">
                  {iglesia.ciudad}
                </span>
              )}
            </span>
          </span>

          <nav className="hidden flex-1 items-center gap-6 lg:flex">
            {/* El menú solo lista las secciones que existen. Un ancla a una
                sección que no se ha pintado deja al visitante en el mismo
                sitio sin que pase nada, y parece que la web está rota. */}
            {secciones.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="text-[14.5px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
              >
                {s.texto}
              </a>
            ))}
          </nav>

          <span className="flex-1 lg:hidden" />

          {tieneContacto && (
            <Button
              className="flex-none"
              render={<a href="#contacto" />}
            >
              Cómo llegar
            </Button>
          )}
        </div>
      </header>

      {/* --- Hero --- */}
      <section className="mx-auto max-w-[1180px] px-5 pt-12 md:px-10 md:pt-14">
        <div className="flex flex-col gap-6 md:max-w-[720px]">
          {destacado && (
            <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-accent py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-accent-foreground">
              <span className="size-[7px] rounded-full bg-primary" />
              Nos reunimos {destacado.dia.toLowerCase()} a las {destacado.hora}
            </span>
          )}

          <h1 className="text-pretty text-[40px] font-extrabold leading-[1.03] tracking-[-0.04em] md:text-[58px]">
            {iglesia.descripcion ? 'Puedes venir tal como estás' : iglesia.nombre}
          </h1>

          {iglesia.descripcion && (
            <p className="max-w-[560px] text-pretty text-[17px] leading-relaxed text-muted-foreground md:text-[19px]">
              {iglesia.descripcion}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {tieneContacto && (
              <Button size="lg" render={<a href="#contacto" />}>
                <MapPin strokeWidth={1.8} />
                Cómo llegar
              </Button>
            )}
            {iglesia.horarios.length > 0 && (
              <Button size="lg" variant="outline" render={<a href="#horarios" />}>
                Ver los horarios
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* --- Horarios --- */}
      {iglesia.horarios.length > 0 && (
        <section id="horarios" className="mx-auto max-w-[1180px] px-5 py-14 md:px-10">
          <div className="overflow-hidden rounded-xl border border-border bg-surface p-6 md:p-9">
            <div className="flex flex-col gap-1.5 pb-6">
              <span className="t-micro text-[#9C3A11]">Cuándo nos vemos</span>
              <h2 className="text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[30px]">
                Horarios de la semana
              </h2>
            </div>

            <div className="flex flex-col">
              {iglesia.horarios.map((h, i) => (
                <div
                  key={`${h.dia}-${h.hora}-${i}`}
                  className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex w-24 flex-none flex-col">
                    <span className="text-[15px] font-bold tracking-[-0.01em]">
                      {h.dia}
                    </span>
                    <span className="text-[14px] text-muted-foreground">
                      {h.hora}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15.5px] font-semibold">{h.nombre}</span>
                    {h.detalle && (
                      <span className="text-[13.5px] leading-snug text-muted-foreground">
                        {h.detalle}
                      </span>
                    )}
                  </div>

                  {h.destacado && (
                    <span className="w-fit flex-none whitespace-nowrap rounded-full bg-accent px-2.5 py-[5px] text-[12px] font-semibold text-accent-foreground">
                      Si vienes, ven aquí
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --- Quiénes somos --- */}
      {parrafos.length > 0 && (
        <section
          id="quienes"
          className="border-y border-border bg-surface"
        >
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 py-14 md:px-10 md:py-16">
            <div className="flex flex-col gap-3">
              <span className="t-micro text-[#9C3A11]">Quiénes somos</span>
              <h2 className="max-w-[700px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
                {iglesia.denominacion
                  ? `Somos una iglesia ${iglesia.denominacion.toLowerCase()}`
                  : 'Un poco de nuestra historia'}
              </h2>
            </div>

            <div className="flex max-w-[760px] flex-col gap-4">
              {parrafos.map((p, i) => (
                <p
                  key={i}
                  className="text-pretty text-[17px] leading-relaxed text-muted-foreground"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --- Grupos: los ministerios reales --- */}
      {iglesia.grupos.length > 0 && (
        <section id="grupos" className="mx-auto max-w-[1180px] px-5 py-14 md:px-10 md:py-16">
          <div className="mb-9 flex flex-col gap-3">
            <span className="t-micro text-[#9C3A11]">Grupos y ministerios</span>
            <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
              Puedes sumarte a cualquiera
            </h2>
            <p className="max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
              Se entra probando, sin compromiso.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {iglesia.grupos.map((g) => {
              const color = colorDeMinisterio(g.colorHex);

              return (
                <div
                  key={g.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface-alt p-6"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3.5 flex-none rounded"
                      style={{ background: color.hex }}
                    />
                    <span className="text-[18px] font-bold tracking-[-0.02em]">
                      {g.nombre}
                    </span>
                  </div>
                  {g.descripcion && (
                    <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                      {g.descripcion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Donativos --- */}
      {iglesia.cuentaDonativos && (
        <section className="bg-support">
          <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 md:grid-cols-2 md:px-10">
            <div className="flex flex-col gap-4">
              <span className="t-micro text-[#CDDDD6]">Ofrendas y donativos</span>
              <h2 className="text-pretty text-[28px] font-extrabold leading-tight tracking-[-0.035em] text-white md:text-[34px]">
                Con lo que se dona sostenemos la iglesia
              </h2>
              <p className="max-w-[520px] text-pretty text-[16px] leading-relaxed text-[#CDDDD6]">
                Se hace por transferencia directamente a la cuenta de la
                iglesia. No pasamos cobros ni guardamos datos de tarjetas.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-6">
              <span className="t-micro">Número de cuenta</span>
              {/* `tabular-nums` para que los dígitos tengan el mismo ancho:
                  un número de cuenta con cifras que bailan es más fácil de
                  copiar mal. */}
              <span className="text-[19px] font-bold tabular-nums tracking-[-0.01em]">
                {iglesia.cuentaDonativos}
              </span>
              {iglesia.titularDonativos && (
                <span className="text-[13.5px] text-muted-foreground">
                  Titular: {iglesia.titularDonativos}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --- Contacto --- */}
      {tieneContacto && (
        <section
          id="contacto"
          className="mx-auto max-w-[1180px] px-5 py-14 md:px-10 md:py-16"
        >
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="t-micro text-[#9C3A11]">Cómo llegar y contacto</span>
              <h2 className="text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
                ¿Alguna pregunta antes de venir?
              </h2>
              <p className="max-w-[460px] text-pretty text-[17px] leading-relaxed text-muted-foreground">
                Escribe o llama y contesta una persona de la iglesia.
              </p>
            </div>

            {/*
             * Datos de contacto directos, no un formulario.
             *
             * El diseño pone aquí un formulario con la promesa de que «contesta
             * una persona, normalmente el mismo día». Para cumplirla hacen falta
             * una bandeja en el panel y avisos por correo, y hasta que existan,
             * un formulario que no va a ninguna parte incumple justo esa
             * promesa: alguien escribe con una duda antes de atreverse a
             * aparecer un domingo, y nadie lo lee nunca.
             *
             * Un teléfono en el que llamar y un correo al que escribir sí
             * funcionan hoy. Y desde el móvil, que es por donde va a entrar casi
             * todo el mundo, `tel:` y `mailto:` son un toque.
             */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
              {iglesia.direccion && (
                <DatoContacto Icono={MapPin} titulo={iglesia.direccion}>
                  {iglesia.ciudad}
                </DatoContacto>
              )}

              {iglesia.telefono && (
                <DatoContacto
                  Icono={Phone}
                  titulo={formatearTelefono(iglesia.telefono)}
                  href={`tel:${iglesia.telefono}`}
                >
                  Llama y te contamos lo que necesites saber.
                </DatoContacto>
              )}

              {iglesia.email && (
                <DatoContacto
                  Icono={Mail}
                  titulo={iglesia.email}
                  href={`mailto:${iglesia.email}`}
                >
                  Escríbenos con toda tranquilidad.
                </DatoContacto>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 py-9 md:flex-row md:items-center md:px-10">
          <div className="flex flex-none items-center gap-[11px]">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
              {iniciales(iglesia.nombre)}
            </span>
            <div className="flex flex-col">
              <span className="text-[14.5px] font-bold tracking-[-0.015em]">
                {iglesia.nombre}
              </span>
              {iglesia.direccion && (
                <span className="text-[12.5px] text-muted-foreground">
                  {iglesia.direccion}
                </span>
              )}
            </div>
          </div>

          <span className="flex-1" />

          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/privacidad"
              className="text-[13.5px] text-muted-foreground no-underline hover:text-foreground hover:no-underline"
            >
              Privacidad
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              Hecho con{' '}
              <Link href="/" className="font-bold">
                Hatril
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DatoContacto({
  Icono,
  titulo,
  href,
  children,
}: {
  Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  titulo: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const contenido = (
    <>
      <Icono
        className="mt-0.5 size-[19px] flex-none text-muted-foreground"
        strokeWidth={1.7}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15.5px] font-semibold text-foreground">
          {titulo}
        </span>
        {children && (
          <span className="text-[14px] leading-snug text-muted-foreground">
            {children}
          </span>
        )}
      </span>
    </>
  );

  if (!href) {
    return <div className="flex items-start gap-3">{contenido}</div>;
  }

  return (
    <a
      href={href}
      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 no-underline hover:bg-background hover:no-underline"
    >
      {contenido}
    </a>
  );
}
