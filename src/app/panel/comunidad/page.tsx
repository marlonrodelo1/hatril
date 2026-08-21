import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Image as IconoImagen,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puedeModerarComunidad } from '@/lib/auth/permisos';
import { pulsoDelMuro } from '@/lib/comunidad/consultas';
import { MAX_IMAGENES } from '@/lib/comunidad/limites';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { guardarComunidad } from './actions';

export const metadata: Metadata = { title: 'Comunidad' };

/**
 * La comunidad, desde el panel: cómo funciona el muro, no el muro.
 *
 * QUÉ HABÍA AQUÍ ANTES: UN ENLACE QUE TE SACABA DEL PANEL
 * -------------------------------------------------------
 * La entrada «Comunidad» del menú llevaba directamente a `/mi/comunidad`, que
 * es el muro y vive en el área del miembro. Al pulsarla desaparecía el menú
 * lateral —`/mi` no tiene layout— y no quedaba forma evidente de volver salvo
 * el botón atrás del navegador. Administrar y participar son dos cosas y
 * estaban en el mismo botón.
 *
 * Y NO HABÍA NADA QUE CONFIGURAR
 * ------------------------------
 * Ni una columna, ni un permiso. El muro estaba fijo en el código y en las
 * policies: publicaba cualquier miembro activo, comentaba cualquiera, moderaba
 * solo el pastor, cuatro fotos como máximo. Las migraciones `0026` y `0027`
 * crearon los cuatro campos y el permiso `moderar_comunidad`; esta pantalla es
 * donde se tocan.
 *
 * QUIÉN ENTRA
 * -----------
 * Todo el mundo, porque desde aquí se llega al muro. Cambiar la configuración
 * es solo del pastor: a los demás se les enseña cómo está, sin formulario. Un
 * formulario deshabilitado invita a pelearse con él.
 */
export default async function ComunidadPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const puedeConfigurar = esPastor(ctx);
  const puedeModerar = puedeModerarComunidad(ctx);
  const config = ctx.iglesia.comunidad;

  const pulso = await pulsoDelMuro(ctx.iglesia.id);

  return (
    <>
      <CabeceraPanel
        titulo="Comunidad"
        subtitulo="El muro interno de la congregación y sus reglas"
      >
        <Button variant="outline" render={<Link href="/mi/comunidad" />}>
          Ver el muro
          <ArrowRight strokeWidth={1.9} />
        </Button>
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && <Aviso tipo="ok">La configuración está guardada.</Aviso>}

        {!config.activa && (
          <Aviso>
            La comunidad está apagada. Nadie puede publicar ni comentar. Lo que
            ya se publicó sigue guardado y vuelve a verse en cuanto la
            enciendas.
          </Aviso>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            {puedeConfigurar ? (
              <form action={guardarComunidad}>
                <section className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-col gap-1">
                    <h2 className="t-subtitulo">Cómo funciona el muro</h2>
                    <p className="text-[13px] text-muted-foreground">
                      Estas reglas las aplica la base de datos, no solo esta
                      pantalla.
                    </p>
                  </div>

                  <Interruptor
                    nombre="activa"
                    marcado={config.activa}
                    titulo="La comunidad está encendida"
                    detalle="Si la apagas, nadie puede publicar, comentar ni dar me gusta. Nada se borra."
                  />

                  <div className="flex flex-col gap-2.5 border-t border-border pt-5">
                    <Label htmlFor="quienPublica">Quién puede publicar</Label>

                    <div className="flex flex-col gap-2">
                      <Opcion
                        valor="todos"
                        actual={config.quienPublica}
                        titulo="Toda la congregación"
                        detalle="Cualquiera con ficha y acceso. Es lo normal en una iglesia pequeña."
                      />
                      <Opcion
                        valor="equipo"
                        actual={config.quienPublica}
                        titulo="Solo el equipo"
                        detalle="Pastor, líderes, tesorería y secretaría. Los demás leen, comentan y dan me gusta."
                      />
                      <Opcion
                        valor="pastor"
                        actual={config.quienPublica}
                        titulo="Solo el pastor"
                        detalle="El muro pasa a ser un tablón de anuncios."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 border-t border-border pt-5">
                    <Interruptor
                      nombre="comentarios"
                      marcado={config.comentarios}
                      titulo="Se puede comentar"
                      detalle="Los comentarios que ya existan siguen viéndose aunque lo apagues."
                    />

                    <Interruptor
                      nombre="fotos"
                      marcado={config.fotos}
                      titulo="Se pueden subir fotos"
                      detalle={`Hasta ${MAX_IMAGENES} por publicación. Una foto de un culto lleva caras de terceros: si tu congregación prefiere no tener esa conversación, apágalo.`}
                    />
                  </div>

                  <Button type="submit" className="self-start">
                    Guardar la configuración
                  </Button>
                </section>
              </form>
            ) : (
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-col gap-1">
                  <h2 className="t-subtitulo">Cómo funciona el muro</h2>
                  <p className="text-[13px] text-muted-foreground">
                    Estas reglas las pone el pastor de la iglesia.
                  </p>
                </div>

                <ul className="flex flex-col gap-2.5">
                  <Hecho
                    Icono={Users}
                    texto={
                      config.quienPublica === 'todos'
                        ? 'Publica toda la congregación.'
                        : config.quienPublica === 'equipo'
                          ? 'Publica solo el equipo: pastor, líderes, tesorería y secretaría.'
                          : 'Publica solo el pastor.'
                    }
                  />
                  <Hecho
                    Icono={MessageSquare}
                    texto={
                      config.comentarios
                        ? 'Se puede comentar.'
                        : 'Los comentarios están cerrados.'
                    }
                  />
                  <Hecho
                    Icono={IconoImagen}
                    texto={
                      config.fotos
                        ? `Se pueden subir hasta ${MAX_IMAGENES} fotos por publicación.`
                        : 'No se pueden subir fotos.'
                    }
                  />
                </ul>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
              <span className="t-micro">Lo que se ha publicado</span>
              <span className="t-cifra">{pulso.publicaciones}</span>
              <span className="text-[13.5px] text-muted-foreground">
                {pulso.ultimaSemana > 0
                  ? `${pulso.ultimaSemana} esta semana`
                  : 'Nada esta semana'}
              </span>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-background text-support">
                <ShieldCheck className="size-[18px]" strokeWidth={1.7} />
              </span>

              <h2 className="t-subtitulo">Quién modera</h2>

              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                El pastor siempre. Además, cualquiera a quien le des el permiso{' '}
                <strong className="font-semibold text-foreground">
                  Moderar la comunidad
                </strong>{' '}
                desde Líderes.
              </p>

              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                Moderar es borrar lo que sobra. Nadie puede editar lo que ha
                escrito otro: cambiarle el texto a alguien y dejar su nombre
                debajo es suplantarle.
              </p>

              {esPastor(ctx) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  render={<Link href="/panel/lideres" />}
                >
                  Repartir el permiso
                </Button>
              )}

              {!esPastor(ctx) && puedeModerar && (
                <p className="text-[13.5px] leading-relaxed text-support">
                  Tú puedes moderar.
                </p>
              )}
            </section>
          </div>
        </div>
      </Contenedor>
    </>
  );
}

/**
 * Una casilla con su explicación.
 *
 * Nativa, como todas las del repo: viaja dentro del `FormData` de la server
 * action sin necesitar un input oculto de por medio. `globals.css` le da el
 * aspecto del sistema de diseño.
 */
function Interruptor({
  nombre,
  marcado,
  titulo,
  detalle,
}: {
  nombre: string;
  marcado: boolean;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      htmlFor={nombre}
      className="flex cursor-pointer items-start gap-3 text-left"
    >
      <input
        id={nombre}
        name={nombre}
        type="checkbox"
        defaultChecked={marcado}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14.5px] font-semibold leading-snug">
          {titulo}
        </span>
        <span className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {detalle}
        </span>
      </span>
    </label>
  );
}

/**
 * Una opción de «quién publica».
 *
 * Radio nativo y no el `Select` de shadcn por lo mismo que el resto del repo:
 * los de Base UI guardan el valor en estado de React y exigen un input oculto.
 * Y en radio se ven las tres opciones a la vez con su explicación, que aquí es
 * justo lo que hay que comparar antes de elegir.
 */
function Opcion({
  valor,
  actual,
  titulo,
  detalle,
}: {
  valor: string;
  actual: string;
  titulo: string;
  detalle: string;
}) {
  const id = `quienPublica-${valor}`;

  return (
    <label
      htmlFor={id}
      className={
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ' +
        (actual === valor
          ? 'border-primary bg-accent'
          : 'border-border bg-surface-alt hover:bg-background')
      }
    >
      <input
        id={id}
        type="radio"
        name="quienPublica"
        value={valor}
        defaultChecked={actual === valor}
        className="mt-1 size-[15px] flex-none accent-[var(--hatril-accent)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold leading-snug">
          {titulo}
        </span>
        <span className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {detalle}
        </span>
      </span>
    </label>
  );
}

function Hecho({
  Icono,
  texto,
}: {
  Icono: React.ElementType;
  texto: string;
}) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-relaxed">
      <Icono
        className="mt-0.5 size-[17px] flex-none text-muted-foreground"
        strokeWidth={1.7}
      />
      {texto}
    </li>
  );
}
