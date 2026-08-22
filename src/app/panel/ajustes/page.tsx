import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { ExternalLink, Image as ImageIcon, Trash2, Upload } from 'lucide-react';

import { requirePastor } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  anadirFotos,
  cambiarVisibilidadDirectorio,
  guardarDatosIglesia,
  guardarImagen,
  guardarWebPublica,
  quitarFoto,
  quitarImagen,

} from './actions';
import type { Ranura } from '@/lib/iglesias/imagenes';
import { FILAS_HORARIO, MAX_FOTOS } from './constantes';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';

export const metadata: Metadata = { title: 'Ajustes' };

const CONFIRMACIONES: Record<string, string> = {
  datos: 'Datos de la iglesia guardados.',
  web: 'Web pública guardada.',
  directorio: 'Preferencias del directorio guardadas.',
  logo: 'Logo actualizado.',
  banner: 'Portada actualizada.',
  'logo-quitada': 'Logo quitado.',
  'banner-quitada': 'Portada quitada.',
  fotos: 'Fotos añadidas.',
  'foto-quitada': 'Foto quitada.',
};

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requirePastor();
  const { error, guardado } = await searchParams;

  const [iglesia] = await withUser(ctx.user.id, (tx) =>
    tx.select().from(iglesias).where(eq(iglesias.id, ctx.iglesia.id)).limit(1),
  );

  if (!iglesia) throw new Error('No se pudo cargar la iglesia.');

  const horarios = iglesia.horarios;
  const indiceDestacado = horarios.findIndex((h) => h.destacado);

  return (
    <>
      <CabeceraPanel
        titulo="Ajustes"
        subtitulo="Datos de la iglesia y su página pública"
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {/*
         * Dos columnas a partir de `xl` (1280 px), que es un portátil normal.
         *
         * Es la pantalla con más formulario del panel: cuatro tarjetas en una
         * sola columna dejan el directorio a tres pantallas de desplazamiento,
         * y quien entra en Ajustes suele venir a cambiar UNA cosa que no sabe
         * dónde está. Por debajo de `xl` se apilan como antes: partir en dos una
         * tableta da dos columnas donde no cabe ni un campo de fecha.
         *
         * Se reparte a mano, con una columna por lado, en vez de dejar que la
         * rejilla coloque sola las cuatro tarjetas. Con el flujo automático la
         * segunda fila arranca a la altura de la tarjeta más alta de la primera,
         * y como «Datos de la iglesia» es larga e «Imágenes» corta, quedaría un
         * palmo de blanco bajo la segunda.
         *
         * Ninguna tarjeta con `<form>` se parte entre columnas para cuadrar
         * alturas: los campos que quedaran fuera del `<form>` no se enviarían, y
         * el guardado saldría a medias sin dar ningún error.
         */}
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            {/* ---------- Datos de la iglesia ---------- */}
            <form action={guardarDatosIglesia}>
              <Seccion
                titulo="Datos de la iglesia"
                nota="Aparecen en el panel y en tu página pública."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta="Nombre" nombre="nombre" requerido>
                    <Input id="nombre" name="nombre" required maxLength={120} defaultValue={iglesia.nombre} />
                  </Campo>

                  <Campo etiqueta="Denominación" nombre="denominacion">
                    <Input
                      id="denominacion"
                      name="denominacion"
                      maxLength={120}
                      defaultValue={iglesia.denominacion ?? ''}
                      placeholder="Cuadrangular, bautista…"
                    />
                  </Campo>

                  <Campo etiqueta="Ciudad" nombre="ciudad">
                    <Input id="ciudad" name="ciudad" maxLength={120} defaultValue={iglesia.ciudad ?? ''} />
                  </Campo>

                  <Campo etiqueta="Dirección" nombre="direccion">
                    <Input id="direccion" name="direccion" maxLength={240} defaultValue={iglesia.direccion ?? ''} />
                  </Campo>

                  <Campo etiqueta="Teléfono" nombre="telefono">
                    <Input id="telefono" name="telefono" type="tel" maxLength={40} defaultValue={iglesia.telefono ?? ''} />
                  </Campo>

                  <Campo etiqueta="Correo" nombre="email">
                    <Input id="email" name="email" type="email" defaultValue={iglesia.email ?? ''} />
                  </Campo>
                </div>

                <Campo
                  etiqueta="En una frase"
                  nombre="descripcion"
                  ayuda="Es el primer párrafo que lee alguien que no os conoce. Cuéntalo como se lo contarías a un vecino."
                >
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    rows={3}
                    maxLength={400}
                    defaultValue={iglesia.descripcion ?? ''}
                    placeholder="Somos una iglesia de barrio. Unas ciento ochenta personas de todas las edades que se acompañan durante la semana."
                    className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                  />
                </Campo>

                {/*
                 * `outline` y no el naranja, aquí y en los otros dos guardados
                 * de esta pantalla.
                 *
                 * Ajustes tiene tres formularios independientes y al pasar a
                 * dos columnas los tres botones se ven a la vez. Con el naranja
                 * de fábrica eran tres botones idénticos compitiendo, que es
                 * exactamente lo que prohíbe la primera regla del sistema de
                 * diseño: «si todo es naranja, nada destaca».
                 *
                 * Y no hay ninguno que merezca serlo por encima de los otros:
                 * esta pantalla no tiene una acción principal, tiene tres
                 * cosas distintas que se guardan por separado.
                 */}
                <Button type="submit" variant="outline" className="w-fit">
                  Guardar los datos
                </Button>
              </Seccion>
            </form>

            {/* ---------- Web pública ---------- */}
            <form action={guardarWebPublica}>
              <Seccion
                titulo="Página pública"
                nota={`Tu iglesia en hatril.app/i/${iglesia.slug}`}
                accion={
                  iglesia.webPublica ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/i/${iglesia.slug}`} target="_blank" />}
                    >
                      Verla
                      <ExternalLink strokeWidth={1.7} />
                    </Button>
                  ) : undefined
                }
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
                  <input
                    type="checkbox"
                    name="webPublica"
                    defaultChecked={iglesia.webPublica}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium">
                      Publicar la página
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      Mientras esté sin marcar, la dirección no muestra nada. Puedes
                      ir rellenando esto con calma y publicarla cuando esté lista.
                    </span>
                  </span>
                </label>

                <Campo
                  etiqueta="Quiénes sois"
                  nombre="historia"
                  ayuda="Separa los párrafos dejando una línea en blanco."
                >
                  <textarea
                    id="historia"
                    name="historia"
                    rows={7}
                    maxLength={4000}
                    defaultValue={iglesia.historia ?? ''}
                    placeholder={
                      'Empezamos en 2004 en un local pequeño, siendo veinte personas.\n\nNo somos una iglesia grande y no pretendemos serlo. Lo que sí intentamos es que nadie que entre por la puerta un domingo se vaya sin que alguien sepa su nombre.'
                    }
                    className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                  />
                </Campo>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="t-label">Horarios de la semana</span>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      Lo primero que busca quien entra en la web de una iglesia.
                      Marca a la izquierda la reunión a la que dirigir a quien viene
                      por primera vez. Las filas que dejes en blanco no se publican.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {Array.from({ length: FILAS_HORARIO }, (_, i) => {
                      const h = horarios[i];

                      return (
                        <div
                          key={i}
                          className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt p-3 sm:flex-row sm:items-center"
                        >
                          <label
                            className="flex flex-none items-center gap-2 text-[12.5px] text-muted-foreground sm:w-8 sm:justify-center"
                            title="Dirigir aquí a quien viene por primera vez"
                          >
                            <input
                              type="radio"
                              name="horarioDestacado"
                              value={i}
                              defaultChecked={indiceDestacado === i}
                              className="size-[17px] flex-none cursor-pointer accent-primary"
                            />
                            <span className="sm:hidden">
                              Dirigir aquí a quien viene por primera vez
                            </span>
                          </label>

                          <Input
                            name={`horario-${i}-dia`}
                            defaultValue={h?.dia ?? ''}
                            placeholder="Domingo"
                            maxLength={40}
                            aria-label={`Día del horario ${i + 1}`}
                            className="sm:w-32"
                          />
                          <Input
                            name={`horario-${i}-hora`}
                            defaultValue={h?.hora ?? ''}
                            placeholder="11:00"
                            maxLength={20}
                            aria-label={`Hora del horario ${i + 1}`}
                            className="sm:w-24"
                          />
                          <Input
                            name={`horario-${i}-nombre`}
                            defaultValue={h?.nombre ?? ''}
                            placeholder="Culto"
                            maxLength={80}
                            aria-label={`Nombre del horario ${i + 1}`}
                            className="sm:w-40"
                          />
                          <Input
                            name={`horario-${i}-detalle`}
                            defaultValue={h?.detalle ?? ''}
                            placeholder="Hora y media. Los niños tienen su clase a la vez."
                            maxLength={200}
                            aria-label={`Detalle del horario ${i + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Cuenta para donativos"
                    nombre="cuentaDonativos"
                    ayuda="Solo se muestra. Hatril no cobra ni intermedia."
                  >
                    <Input
                      id="cuentaDonativos"
                      name="cuentaDonativos"
                      maxLength={80}
                      defaultValue={iglesia.cuentaDonativos ?? ''}
                      placeholder="Nequi, Bancolombia, IBAN…"
                    />
                  </Campo>

                  <Campo etiqueta="Titular de la cuenta" nombre="titularDonativos">
                    <Input
                      id="titularDonativos"
                      name="titularDonativos"
                      maxLength={160}
                      defaultValue={iglesia.titularDonativos ?? ''}
                    />
                  </Campo>
                </div>

                <Button type="submit" variant="outline" className="w-fit">
                  Guardar la página
                </Button>
              </Seccion>
            </form>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {/* ---------- Imágenes ---------- */}
            {/* Fuera del formulario de «Página pública» a propósito: subir 2 MB
                tarda, y no tiene por qué ir atado a guardar los horarios. */}
            <Seccion
              titulo="Imágenes"
              nota="El logo y la portada que se ven en tu página y en el directorio."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoImagen
                  ranura="logo"
                  titulo="Logo"
                  nota="Cuadrado. Se usa como avatar de la iglesia."
                  url={iglesia.logoUrl}
                  alto="h-[120px]"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium">
                    Fotos de la portada
                  </span>
                  <span className="t-label text-muted-foreground">
                    Se pasan solas arriba del todo de tu página. La primera es la que
                    sale en el directorio y al compartir el enlace.
                  </span>
                </div>

                {iglesia.imagenes.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {iglesia.imagenes.map((url, i) => (
                      <li
                        key={url}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt p-2"
                      >
                        <div className="relative h-[90px] overflow-hidden rounded-md border border-border bg-background">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Foto ${i + 1} de la iglesia`}
                            className="size-full object-cover"
                          />
                          {i === 0 && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-[3px] text-[11px] font-bold text-accent-foreground">
                              Portada
                            </span>
                          )}
                        </div>
                        <form action={quitarFoto.bind(null, url)}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Trash2 strokeWidth={1.7} />
                            Quitar
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                {iglesia.imagenes.length < MAX_FOTOS && (
                  <form
                    action={anadirFotos}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="file"
                      name="fotos"
                      required
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Elegir fotos de la iglesia"
                      className="min-w-0 flex-1 text-[13px] text-muted-foreground file:mr-2.5 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-background"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      <Upload strokeWidth={1.7} />
                      Añadir
                    </Button>
                  </form>
                )}
              </div>

              <p className="t-label text-muted-foreground">
                JPG, PNG o WebP, hasta 2 MB cada una. Máximo {MAX_FOTOS} fotos.
              </p>
            </Seccion>

            {/* ---------- Directorio ---------- */}
            <form action={cambiarVisibilidadDirectorio}>
              <Seccion
                titulo="Directorio de Hatril"
                nota="Cómo os encuentra alguien que busca una iglesia."
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
                  <input
                    type="checkbox"
                    name="visibleEnDirectorio"
                    defaultChecked={iglesia.visibleEnDirectorio}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium">
                      Aparecer en el buscador de iglesias
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      Cualquiera que busque una iglesia en {iglesia.ciudad ?? 'tu ciudad'} os
                      verá en la lista. Sin marcar, vuestra página sigue funcionando
                      para quien tenga la dirección.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
                  <input
                    type="checkbox"
                    name="aceptaSolicitudes"
                    defaultChecked={iglesia.aceptaSolicitudes}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium">
                      Aceptar solicitudes para unirse
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      Quien os encuentre podrá pedir entrar. Nadie ve nada de la
                      congregación hasta que alguien del equipo lo apruebe.
                    </span>
                  </span>
                </label>

                <Button type="submit" variant="outline" className="w-fit">
                  Guardar
                </Button>
              </Seccion>
            </form>
          </div>
        </div>
      </Contenedor>
    </>
  );
}

/**
 * Un hueco de imagen: la que hay, subir otra, y quitarla.
 *
 * `<input type="file">` nativo con su `Subir`, sin previsualización en el
 * navegador. Una previsualización obliga a componente cliente y a estado, y lo
 * que de verdad importa —cómo queda en la página— se ve pulsando «Verla».
 *
 * `<img>` y no `next/image`: el dominio de Supabase ya está en `remotePatterns`,
 * pero aquí son dos miniaturas de un panel privado, no contenido que optimizar y
 * cachear. `next/image` añadiría una petición al optimizador por cada carga.
 */
function CampoImagen({
  ranura,
  titulo,
  nota,
  url,
  alto,
}: {
  ranura: Ranura;
  titulo: string;
  nota: string;
  url: string | null;
  alto: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-alt p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium">{titulo}</span>
        <span className="t-label text-muted-foreground">{nota}</span>
      </div>

      <div
        className={`flex ${alto} items-center justify-center overflow-hidden rounded-lg border border-border bg-background`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${titulo} de la iglesia`}
            className="size-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <ImageIcon className="size-5" strokeWidth={1.6} />
            <span className="text-[13px]">Sin imagen</span>
          </span>
        )}
      </div>

      <form
        action={guardarImagen.bind(null, ranura)}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="file"
          name="imagen"
          required
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Elegir ${titulo.toLowerCase()}`}
          className="min-w-0 flex-1 text-[13px] text-muted-foreground file:mr-2.5 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-background"
        />
        <Button type="submit" variant="outline" size="sm">
          <Upload strokeWidth={1.7} />
          Subir
        </Button>
      </form>

      {/* En su propio formulario: con el de subir al lado, un Enter de más
          borraría la imagen en vez de cambiarla. */}
      {url && (
        <form action={quitarImagen.bind(null, ranura)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 strokeWidth={1.7} />
            Quitarla
          </Button>
        </form>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  nota,
  accion,
  children,
}: {
  titulo: string;
  nota?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="t-subtitulo">{titulo}</h2>
          {nota && (
            <p className="text-[13px] text-muted-foreground">{nota}</p>
          )}
        </div>
        {accion}
      </div>
      {children}
    </section>
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
