import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { ExternalLink, MessageCircle, Settings } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { getOrigin } from '@/lib/auth/get-origin';
import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import {
  ETIQUETAS_REDES,
  REDES,
  redesParaEditar,
  type Red,
} from '@/lib/iglesias/redes';
import {
  enlaceWhatsapp,
  urlPublicaIglesia,
  urlSolicitar,
} from '@/lib/url/absoluta';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copiar } from './_components/copiar';
import { guardarRedes } from './actions';

export const metadata: Metadata = { title: 'Compartir' };

/**
 * Los enlaces de la iglesia y sus redes sociales.
 *
 * SIN `layout.tsx` PROPIO
 * -----------------------
 * La regla del repo es que el guard va en el layout de la sección, y aquí no
 * hace falta ninguno: el guard efectivo es el `requireIglesia()` de
 * `panel/layout.tsx`, esta ruta no tiene sub-rutas dinámicas donde se pudiera
 * colar un hueco, y un layout que solo repitiera esa llamada haría creer que hay
 * una comprobación extra que no existe. El bloque de redes —lo único que
 * escribe— sí es del pastor, y lo comprueba su propia action.
 *
 * `getOrigin()` obliga a que la pantalla sea dinámica, que es lo correcto: el
 * enlace tiene que decir el dominio por el que ha entrado esta persona, no el
 * que estaba puesto el día que se compiló.
 */
export default async function CompartirPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const [iglesia] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        slug: iglesias.slug,
        nombre: iglesias.nombre,
        dominioPropio: iglesias.dominioPropio,
        webPublica: iglesias.webPublica,
        aceptaSolicitudes: iglesias.aceptaSolicitudes,
        redes: iglesias.redes,
      })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  if (!iglesia) throw new Error('No se pudo cargar la iglesia.');

  const origen = await getOrigin();
  const urlWeb = urlPublicaIglesia(iglesia, origen);
  const urlUnirse = urlSolicitar(iglesia, origen);
  const puedeEditarRedes = esPastor(ctx);
  const valores = redesParaEditar(iglesia.redes);

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Compartir
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Los enlaces de {iglesia.nombre} y dónde encontrarla
        </p>
      </header>

      <div className="flex w-full max-w-[760px] flex-col gap-8 px-5 pb-16 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado === 'redes' && (
          <Aviso tipo="ok">Redes sociales guardadas.</Aviso>
        )}

        {/* ---------- La web de la iglesia ---------- */}
        <Seccion
          titulo="La página de la iglesia"
          nota="Lo que ve quien busca dónde os reunís: horarios, grupos y el devocional del día."
        >
          {iglesia.webPublica ? (
            <>
              <Copiar
                url={urlWeb}
                etiqueta="Dirección de la página de la iglesia"
                destacado
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  render={
                    <a
                      href={enlaceWhatsapp(
                        `Esta es la página de ${iglesia.nombre}:`,
                        urlWeb,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <MessageCircle strokeWidth={1.8} />
                  Enviar por WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  render={
                    <a href={urlWeb} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <ExternalLink strokeWidth={1.8} />
                  Verla
                </Button>
              </div>
              {iglesia.dominioPropio && (
                <p className="t-label text-muted-foreground">
                  Estás usando tu propio dominio. Si algún día lo quitas, la
                  página seguirá donde siempre: {origen}/i/{iglesia.slug}
                </p>
              )}
            </>
          ) : (
            <Aviso>
              Tu página todavía no está publicada, así que este enlace no
              funcionaría. Se activa en Ajustes, en «Web pública».
            </Aviso>
          )}

          {!iglesia.webPublica && (
            <Button
              variant="outline"
              className="w-fit"
              render={<Link href="/panel/ajustes" />}
            >
              <Settings strokeWidth={1.8} />
              Ir a Ajustes
            </Button>
          )}
        </Seccion>

        {/* ---------- Unirse a la congregación ---------- */}
        <Seccion
          titulo="Invitar a formar parte"
          nota="Quien abra este enlace pide unirse, y su solicitud os llega a Solicitudes para aprobarla."
        >
          {iglesia.aceptaSolicitudes ? (
            <>
              <Copiar
                url={urlUnirse}
                etiqueta="Enlace para pedir unirse a la iglesia"
              />
              <Button
                variant="outline"
                className="w-fit"
                render={
                  <a
                    href={enlaceWhatsapp(
                      `Únete a ${iglesia.nombre} desde aquí:`,
                      urlUnirse,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <MessageCircle strokeWidth={1.8} />
                Enviar por WhatsApp
              </Button>
            </>
          ) : (
            <Aviso>
              Tenéis cerradas las solicitudes, así que este enlace diría que no
              se admiten. Se abre en Ajustes, en «Directorio».
            </Aviso>
          )}
        </Seccion>

        {/* ---------- Redes sociales ---------- */}
        {puedeEditarRedes ? (
          <form action={guardarRedes}>
            <Seccion
              titulo="Redes sociales"
              nota="Salen al pie de la página de la iglesia. Lo que dejes en blanco no aparece."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {REDES.map((red) => (
                  <CampoRed key={red} red={red} valor={valores[red]} />
                ))}
              </div>
              <Button type="submit" className="w-fit">
                Guardar redes
              </Button>
            </Seccion>
          </form>
        ) : (
          <Seccion
            titulo="Redes sociales"
            nota="Las cambia el pastor desde esta misma pantalla."
          >
            <ListaRedes valores={valores} />
          </Seccion>
        )}
      </div>
    </>
  );
}

function CampoRed({ red, valor }: { red: Red; valor: string }) {
  const { titulo, ejemplo, ayuda } = ETIQUETAS_REDES[red];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={red}>
        {titulo}
        <span className="ml-1.5 font-normal text-muted-foreground">
          (opcional)
        </span>
      </Label>
      <Input
        id={red}
        name={red}
        maxLength={300}
        defaultValue={valor}
        placeholder={ejemplo}
        // `url` no: aquí se admite «@miiglesia», que el navegador rechazaría
        // antes de que la validación de verdad llegara a verlo.
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="t-label text-muted-foreground">{ayuda}</p>
    </div>
  );
}

/** Lo que ve quien no puede editarlas: para qué esconderle dónde está su iglesia. */
function ListaRedes({ valores }: { valores: Record<Red, string> }) {
  const puestas = REDES.filter((red) => valores[red]);

  if (puestas.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Todavía no hay ninguna puesta.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {puestas.map((red) => (
        <li key={red} className="flex flex-col gap-0.5">
          <span className="t-micro">{ETIQUETAS_REDES[red].titulo}</span>
          <a
            href={valores[red]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] break-all"
          >
            {valores[red]}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Mismo bloque visual que Ajustes: son pantallas hermanas y se leen seguidas. */
function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">{titulo}</h2>
        {nota && <p className="text-[13px] text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  );
}
