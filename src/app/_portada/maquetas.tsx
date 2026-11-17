import type { ReactNode } from 'react';
import {
  BatteryFull,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Church,
  Clock,
  HandHeart,
  Heart,
  House,
  Inbox,
  Lock,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Quote,
  ShieldCheck,
  Signal,
  UserPlus,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

import { clsx } from 'clsx';
import { buttonVariants } from '@/components/ui/button';
import { AvatarPersona } from '@/components/avatar-persona';

/**
 * Las maquetas de la portada: el panel y la app, dibujados con los mismos
 * tokens y componentes que la aplicación de verdad.
 *
 * POR QUÉ NO SON CAPTURAS
 * -----------------------
 * Una captura se pixela al ampliarla, pesa, y envejece con cada cambio de la
 * interfaz sin que nadie se entere: la portada seguiría enseñando el verde de
 * dos paletas atrás. Esto se pinta con `bg-surface`, `AvatarPersona` y las
 * clases del botón, así que si la paleta cambia, la portada cambia con ella.
 *
 * SOLO LO QUE EXISTE
 * ------------------
 * Cada pantalla copia una que se puede abrir hoy: Inicio del panel
 * (`/panel/hoy`), los turnos de un ministerio, el muro (`/mi/comunidad`) y la
 * agenda (`/mi/agenda`). Los textos de los botones y de las insignias son los
 * de esas pantallas («Ahí estaré», «Sin contestar», «Quiero ser parte»). Los
 * datos son de mentira, pero de los que tendría una iglesia de verdad: nada de
 * «Lorem ipsum» ni de «Juan Pérez».
 *
 * NO SE PUEDEN PULSAR
 * -------------------
 * Son dibujos. Los botones son `<span>` con las clases del botón, nada es
 * enfocable, y cada maqueta se anuncia como UNA imagen con su descripción
 * (`role="img"`): un lector de pantalla no tiene por qué leer en voz alta un
 * muro inventado.
 *
 * EL ÚNICO NARANJA DE LA PORTADA ES EL DORADO DEL BOTÓN
 * -----------------------------------------------------
 * El compositor del muro lleva «Publicar» en naranja, y aquí se ha quitado: una
 * maqueta con su botón de color al lado del botón de alta serían dos llamadas
 * compitiendo, que es lo que prohíbe la regla 1. Lo elegido va en `bg-accent`,
 * el naranja suave, como en la aplicación.
 *
 * `clsx` Y NO `cn`
 * ----------------
 * `cn` pasa por `tailwind-merge`, que no conoce los tamaños propios de la
 * escala (`text-label`, `text-micro`) y los toma por colores: en
 * `cn('text-label', 'text-muted-foreground')` se queda solo el segundo, y la
 * letra vuelve a 15 sin que nada avise. Aquí no hay clases que resolver, solo
 * que juntar.
 */

/* ------------------------------------------------------------------------ */
/* Envoltorio y piezas sueltas                                               */
/* ------------------------------------------------------------------------ */

export function Maqueta({
  etiqueta,
  className,
  children,
}: {
  /** Lo que se ve, dicho en una frase. Es lo único que lee un lector. */
  etiqueta: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={etiqueta}
      className={clsx('pointer-events-none select-none', className)}
    >
      {children}
    </div>
  );
}

const TONOS = {
  exito: 'bg-badge-success-bg text-badge-success-fg',
  aviso: 'bg-badge-warning-bg text-badge-warning-fg',
  marca: 'bg-badge-accent-bg text-badge-accent-fg',
  neutro: 'bg-badge-neutral-bg text-badge-neutral-fg',
  peligro: 'bg-badge-danger-bg text-badge-danger-fg',
} as const;

/** La pastilla de la guía visual, tal cual (su `text-[12px]` es la excepción
 *  que la guía acepta, y solo dentro de la insignia). */
function Insignia({
  tono,
  children,
}: {
  tono: keyof typeof TONOS;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-[22px] flex-none items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap',
        TONOS[tono],
      )}
    >
      {children}
    </span>
  );
}

/** Un botón que no es un botón. */
function BotonDibujado({
  variante,
  children,
}: {
  variante: 'secondary' | 'outline';
  children: ReactNode;
}) {
  return (
    <span className={buttonVariants({ variant: variante, size: 'sm' })}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Marcos                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Un teléfono, a tamaño real: 360 px de pantalla, casi los 375 de un iPhone. Con
 * menos, las cinco pestañas de abajo no caben con sus nombres a 11,5 px.
 * Quien lo usa lo encoge con `zoom` según el hueco, y por eso todo lo de dentro
 * va en las medidas de la aplicación y no en unas propias de maqueta.
 *
 * Los radios grandes (46 y 37) se salen de la regla de 8 y 12 a propósito: son
 * el dibujo de un aparato, no una superficie de la interfaz. Con 12 se lee como
 * una tarjeta alargada, no como un teléfono.
 *
 * El cuerpo es carbón y no negro: es el `support` de la paleta, y sobre el
 * crema da el contraste suficiente para que el teléfono se despegue de lo que
 * tiene detrás sin necesidad de sombra.
 */
export function MarcoMovil({
  children,
  barra,
  className,
}: {
  children: ReactNode;
  /** La pestaña encendida de la barra de abajo. Sin ella, no hay barra. */
  barra?: Pestana;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'w-[380px] flex-none rounded-[46px] border border-support-active bg-support p-[9px]',
        className,
      )}
    >
      <div className="relative flex h-[720px] flex-col overflow-hidden rounded-[37px] bg-background text-foreground">
        <div className="relative flex h-12 flex-none items-center justify-between px-7 pt-1 text-label font-semibold">
          <span className="tabular-nums">9:41</span>
          <span className="absolute top-3 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-support-active" />
          <span className="flex items-center gap-1.5">
            <Signal className="size-4" strokeWidth={2.2} />
            <Wifi className="size-4" strokeWidth={2.2} />
            <BatteryFull className="size-5" strokeWidth={1.8} />
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {barra && <BarraPestanas activa={barra} />}
      </div>
    </div>
  );
}

/**
 * Una ventana de navegador. Fluida: ocupa lo que le den. Los tres puntos van en
 * gris y no en los colores del semáforo de macOS, que serían tres colores más
 * en una página que tiene uno.
 */
export function MarcoNavegador({
  direccion,
  children,
  className,
}: {
  direccion: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-border bg-surface text-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-surface-alt px-3.5 py-2.5">
        <span className="flex w-[46px] flex-none gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="flex min-w-0 flex-1 justify-center">
          <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-label text-muted-foreground">
            <Lock className="size-3 flex-none" strokeWidth={2} />
            <span className="truncate">{direccion}</span>
          </span>
        </span>
        <span className="w-[46px] flex-none" />
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* La app del miembro                                                        */
/* ------------------------------------------------------------------------ */

type Pestana = 'comunidad' | 'devocional' | 'agenda' | 'biblia' | 'equipo';

const PESTANAS: { clave: Pestana; nombre: string; Icono: LucideIcon }[] = [
  { clave: 'comunidad', nombre: 'Comunidad', Icono: MessagesSquare },
  { clave: 'devocional', nombre: 'Devocional', Icono: BookOpen },
  { clave: 'agenda', nombre: 'Agenda', Icono: CalendarDays },
  { clave: 'biblia', nombre: 'Biblia', Icono: BookMarked },
  { clave: 'equipo', nombre: 'Equipo', Icono: Users },
];

/** `BarraInferior` de `/mi`, con la quinta pestaña de quien sirve en un equipo. */
function BarraPestanas({ activa }: { activa: Pestana }) {
  return (
    <div className="absolute inset-x-2 bottom-5 grid grid-cols-5 gap-0.5 rounded-2xl border border-border bg-surface p-1">
      {PESTANAS.map(({ clave, nombre, Icono }) => (
        <span
          key={clave}
          className={clsx(
            'flex flex-col items-center gap-1 rounded-xl border py-2 text-micro font-semibold',
            clave === activa
              ? 'border-primary/30 bg-accent text-accent-foreground'
              : 'border-transparent text-muted-foreground',
          )}
        >
          <Icono className="size-[18px]" strokeWidth={1.8} />
          {nombre}
        </span>
      ))}
    </div>
  );
}

function CabeceraApp({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-none items-center gap-3 border-b border-border px-4 pt-1 pb-3">
      <span className="flex size-10 flex-none items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
        <Church className="size-5" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-subtitle leading-tight font-bold tracking-[-0.015em]">
          {titulo}
        </span>
        <span className="text-label text-muted-foreground">Iglesia Betania</span>
      </span>
      <Bell className="size-5 text-muted-foreground" strokeWidth={1.8} />
      <AvatarPersona nombre="Lucía Fernández" />
    </div>
  );
}

function Publicacion({
  nombre,
  cuando,
  texto,
  megusta,
  comentarios,
}: {
  nombre: string;
  cuando: string;
  texto: string;
  megusta: number;
  comentarios: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-4">
      <div className="flex items-center gap-3">
        <AvatarPersona nombre={nombre} />
        <span className="flex flex-col">
          <span className="text-body leading-tight font-semibold">{nombre}</span>
          <span className="text-label text-muted-foreground">{cuando}</span>
        </span>
      </div>
      <p className="text-body leading-relaxed text-pretty">{texto}</p>
      <div className="flex items-center gap-5 text-label font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="size-4" strokeWidth={1.8} />
          {megusta}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4" strokeWidth={1.8} />
          {comentarios}
        </span>
      </div>
    </div>
  );
}

/**
 * El muro. Arriba la portada del día sin foto, que en la aplicación es el
 * carbón liso con el texto en blanco: no hay fotos de iglesias que se puedan
 * enseñar aquí, y la portada sin foto existe tal cual en el producto.
 */
export function PantallaMuro() {
  return (
    <>
      <CabeceraApp titulo="Comunidad" />

      <div className="flex flex-none flex-col bg-support text-secondary-foreground">
        <div className="flex flex-col gap-2.5 px-4 py-5">
          <span className="flex items-center gap-2 text-micro font-bold tracking-[0.08em] uppercase">
            <Quote className="size-3.5" strokeWidth={2.2} />
            Versículo de hoy
          </span>
          <p className="text-subtitle leading-normal font-medium tracking-[-0.01em] text-pretty">
            Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las
            tribulaciones.
          </p>
          <span className="text-label font-semibold text-support-muted-foreground">
            Salmos 46:1 (RV1909)
          </span>
        </div>
        <div className="flex items-center gap-3 border-t border-support-hover px-4 py-3.5">
          <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-support-hover">
            <BookOpen className="size-5" strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-micro font-bold tracking-[0.08em] text-support-muted-foreground uppercase">
              Devocional de hoy
            </span>
            <span className="truncate text-body font-semibold">
              Cuando todo tiembla
            </span>
          </span>
          <ChevronRight
            className="size-4 text-support-muted-foreground"
            strokeWidth={1.8}
          />
        </div>
      </div>

      <Publicacion
        nombre="Brandon Molina"
        cuando="Hace 2 horas"
        texto="Gracias por el domingo. Veinte personas se quedaron hasta el final recogiendo sillas: así da gusto."
        megusta={24}
        comentarios={6}
      />
      <Publicacion
        nombre="Ana Lucía Rojas"
        cuando="Ayer"
        texto="El sábado a las 9:00 hay jornada de limpieza en el templo. Cualquier mano viene bien, y habrá desayuno."
        megusta={11}
        comentarios={3}
      />
    </>
  );
}

const SEMANA = [
  { dia: 'Mié', hora: '19:30', que: 'Reunión de oración', donde: 'En el templo' },
  { dia: 'Vie', hora: '19:00', que: 'Célula Los Pinos', donde: 'En casa de Andrés' },
  { dia: 'Sáb', hora: '17:00', que: 'Ensayo de Alabanza', donde: 'Con tu equipo' },
  { dia: 'Dom', hora: '10:00', que: 'Culto de domingo', donde: 'Sirves en guitarra' },
];

/** La agenda en «Semana», con un turno por contestar. */
export function PantallaAgenda() {
  return (
    <>
      <CabeceraApp titulo="Agenda" />

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 text-label font-semibold">
          <span className="rounded-lg py-1.5 text-center text-muted-foreground">
            Día
          </span>
          <span className="rounded-lg bg-accent py-1.5 text-center text-accent-foreground">
            Semana
          </span>
          <span className="rounded-lg py-1.5 text-center text-muted-foreground">
            Mes
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-micro px-1">Te toca servir</span>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-label font-semibold text-muted-foreground">
                Domingo · 10:00
              </span>
              <span className="text-body font-semibold">Culto de domingo</span>
              <span className="text-label text-muted-foreground">
                Alabanza · Guitarra
              </span>
            </span>
            <span className="flex gap-2">
              <BotonDibujado variante="secondary">Ahí estaré</BotonDibujado>
              <BotonDibujado variante="outline">No puedo</BotonDibujado>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-micro px-1">Esta semana</span>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {SEMANA.map((s) => (
              <div
                key={s.que}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <span className="flex w-10 flex-none flex-col items-center">
                  <span className="t-micro">{s.dia}</span>
                  <span className="text-label font-semibold tabular-nums">
                    {s.hora}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-semibold">{s.que}</span>
                  <span className="truncate text-label text-muted-foreground">
                    {s.donde}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* El panel                                                                  */
/* ------------------------------------------------------------------------ */

function ItemMenu({
  Icono,
  activo,
  aviso,
  children,
}: {
  Icono: LucideIcon;
  activo?: boolean;
  aviso?: number;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-label font-medium',
        activo ? 'bg-accent text-accent-foreground' : 'text-foreground',
      )}
    >
      <Icono className="size-4 flex-none" strokeWidth={1.8} />
      <span className="flex-1">{children}</span>
      {aviso ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-badge-accent-bg text-micro font-bold text-badge-accent-fg">
          {aviso}
        </span>
      ) : null}
    </span>
  );
}

function Pendiente({
  Icono,
  titulo,
  detalle,
  accion,
  children,
}: {
  Icono: LucideIcon;
  titulo: string;
  detalle?: string;
  accion: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-support">
          <Icono className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <span className="text-body leading-snug font-semibold">{titulo}</span>
          {detalle && (
            <span className="truncate text-label text-muted-foreground">
              {detalle}
            </span>
          )}
        </span>
        <BotonDibujado variante="outline">{accion}</BotonDibujado>
      </div>
      {children}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3.5">
      <span className="t-micro">{etiqueta}</span>
      <span className="t-cifra tabular-nums">{valor}</span>
    </div>
  );
}

/**
 * Inicio del panel (`/panel/hoy`): lo que espera al pastor al entrar. A tamaño
 * real son 720 px de ancho; quien la pone la encoge con `zoom`.
 */
export function PantallaInicioPanel() {
  return (
    <div className="flex h-[500px] w-[720px] bg-background">
      <div className="flex w-[192px] flex-none flex-col gap-0.5 border-r border-border bg-surface p-2.5">
        <span className="mb-2 flex items-center gap-2.5 px-1.5 py-1.5">
          <span className="flex size-8 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-muted-foreground">
            <Church className="size-4" strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-label leading-tight font-bold">
              Iglesia Betania
            </span>
            <span className="text-label leading-tight text-muted-foreground">
              Bogotá
            </span>
          </span>
        </span>
        <ItemMenu Icono={House} activo>
          Inicio
        </ItemMenu>
        <ItemMenu Icono={Inbox} aviso={2}>
          Solicitudes
        </ItemMenu>
        <span className="t-micro px-2.5 pt-3.5 pb-1">La congregación</span>
        <ItemMenu Icono={Users}>Miembros</ItemMenu>
        <ItemMenu Icono={HandHeart}>Ministerios</ItemMenu>
        <ItemMenu Icono={ShieldCheck}>Líderes</ItemMenu>
        <span className="t-micro px-2.5 pt-3.5 pb-1">La vida de la iglesia</span>
        <ItemMenu Icono={CalendarDays}>Eventos</ItemMenu>
        <ItemMenu Icono={BookOpen}>Devocionales</ItemMenu>
        <ItemMenu Icono={MessagesSquare}>Comunidad</ItemMenu>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <span className="flex flex-col">
          <span className="text-title leading-tight font-bold tracking-[-0.022em]">
            Iglesia Betania
          </span>
          <span className="text-label text-muted-foreground">Bogotá</span>
        </span>

        <span className="t-micro pt-1">Te está esperando</span>
        <Pendiente
          Icono={Inbox}
          titulo="2 personas quieren unirse"
          detalle="Nuria Cabrera, Julián Pardo"
          accion="Revisar"
        />
        <Pendiente
          Icono={HandHeart}
          titulo="1 ministerio sin responsable"
          detalle="Jóvenes"
          accion="Asignar"
        />
        <Pendiente
          Icono={UserPlus}
          titulo="3 personas han llegado y no sirven en ningún equipo"
          accion="Ver el fichero"
        >
          <span className="flex flex-wrap gap-1.5 pl-12">
            {['Camila Restrepo', 'Esteban Cruz', 'Sofía Duque'].map((n) => (
              <span
                key={n}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface-alt py-0.5 pr-2.5 pl-0.5 text-label"
              >
                <AvatarPersona nombre={n} tamano="sm" />
                {n}
              </span>
            ))}
          </span>
        </Pendiente>

        <span className="t-micro pt-1">La congregación</span>
        <div className="grid grid-cols-2 gap-3">
          <Cifra etiqueta="Personas" valor={184} />
          <Cifra etiqueta="Sirviendo en un ministerio" valor={62} />
        </div>
      </div>
    </div>
  );
}

const TURNO: {
  puesto: string;
  nombre: string | null;
  estado: [keyof typeof TONOS, string];
}[] = [
  { puesto: 'Dirección', nombre: 'Laura Gómez', estado: ['exito', 'Confirmado'] },
  { puesto: 'Guitarra', nombre: 'Tomás Herrera', estado: ['exito', 'Confirmado'] },
  { puesto: 'Voces', nombre: 'Valeria Ospina', estado: ['neutro', 'Sin contestar'] },
  { puesto: 'Teclado', nombre: 'Julián Pardo', estado: ['peligro', 'No puede'] },
  { puesto: 'Bajo', nombre: null, estado: ['aviso', 'Sin cubrir'] },
];

/**
 * Los turnos de un ministerio: quién sirve el domingo y en qué puesto. Fluida,
 * sin `zoom`: en el panel de verdad esta tarjeta ya se apaña en un móvil.
 */
export function PantallaTurnos() {
  return (
    <div className="flex flex-col gap-4 bg-background p-4 sm:p-6">
      <span className="flex flex-col gap-0.5">
        <span className="text-label text-muted-foreground">
          Ministerios · Alabanza
        </span>
        <span className="text-title leading-tight font-bold tracking-[-0.022em]">
          Turnos
        </span>
      </span>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-label font-semibold text-muted-foreground">
              Domingo · 10:00
            </span>
            <span className="text-body font-semibold">Culto de domingo</span>
          </span>
          <Insignia tono="aviso">1 sin cubrir</Insignia>
        </div>
        {TURNO.map((t) => (
          <div
            key={t.puesto}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            {/* La fila de lista de la guía: nombre arriba, el dato debajo y la
                insignia a la derecha. Con el puesto en su propia columna, a
                375 px los nombres se quedaban en «Laur…». */}
            {t.nombre ? (
              <AvatarPersona nombre={t.nombre} tamano="sm" />
            ) : (
              <span className="size-8 flex-none rounded-full border border-dashed border-border-strong" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={clsx(
                  'truncate text-body',
                  t.nombre ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {t.nombre ?? 'Nadie todavía'}
              </span>
              <span className="truncate text-label text-muted-foreground">
                {t.puesto}
              </span>
            </span>
            <Insignia tono={t.estado[0]}>{t.estado[1]}</Insignia>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Las tres piezas del camino de alguien nuevo                               */
/* ------------------------------------------------------------------------ */

/** La web pública de la iglesia, en pequeño. */
export function PiezaWebPublica() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <span className="flex flex-col">
        <span className="text-body font-bold">Iglesia Betania</span>
        <span className="text-label text-muted-foreground">Bogotá</span>
      </span>
      <span className="flex flex-col gap-1.5 text-label text-muted-foreground">
        <span className="flex items-center gap-2">
          <Clock className="size-3.5 flex-none" strokeWidth={1.8} />
          Domingos · 10:00 y 12:00
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="size-3.5 flex-none" strokeWidth={1.8} />
          Cómo llegar
        </span>
      </span>
      <span className={clsx(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}>
        Quiero ser parte
      </span>
    </div>
  );
}

/** Una solicitud de ingreso en el panel. */
export function PiezaSolicitud() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <span className="flex items-center gap-3">
        <AvatarPersona nombre="Nuria Cabrera" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold">Nuria Cabrera</span>
          <span className="text-label text-muted-foreground">
            Quiere unirse · hoy
          </span>
        </span>
      </span>
      <span className="text-label leading-relaxed text-pretty text-muted-foreground">
        «Vinimos el domingo con mis hijos y nos gustaría quedarnos.»
      </span>
      <span className="flex gap-2">
        <BotonDibujado variante="secondary">Aprobar</BotonDibujado>
        <BotonDibujado variante="outline">Ver ficha</BotonDibujado>
      </span>
    </div>
  );
}

/** Lo primero que ve dentro: el muro de su congregación. */
export function PiezaYaDentro() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <span className="flex items-center gap-3 px-4 pt-4 pb-3">
        <AvatarPersona nombre="Daniel Ruiz" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold">Daniel Ruiz</span>
          <span className="text-label text-muted-foreground">Pastor · hoy</span>
        </span>
      </span>
      <span className="px-4 pb-3 text-body leading-relaxed text-pretty">
        Hoy damos la bienvenida a Nuria y a sus hijos. ¡Nos vemos el domingo!
      </span>
      <span className="flex items-center gap-5 border-t border-border px-4 py-2.5 text-label font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="size-4" strokeWidth={1.8} />
          38
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4" strokeWidth={1.8} />
          12
        </span>
      </span>
    </div>
  );
}
