# Guía visual de Hatril

Para quien construye una pantalla nueva. Cada patrón dice **qué copiar y de
dónde**, con sus clases. Si algo no está aquí, copia la pantalla de referencia
más parecida antes de inventar.

Pantallas de referencia, por este orden: **turnos**
(`src/app/panel/ministerios/[id]/turnos/page.tsx`), **repertorio**
(`.../repertorio/page.tsx`), **el muro** (`src/app/mi/comunidad`) y **la
agenda** (`src/app/mi/agenda/page.tsx`).

Los tokens están en `src/app/globals.css`, con el porqué de cada color. Lo que
falla hoy en la aplicación está en [`inventario-visual.md`](inventario-visual.md):
no lo copies aunque lo veas en otra pantalla.

Tres piezas de esta guía **todavía no existen** y llegan en la fase 2:
`BotonEnlace`, `Insignia` y `Campo`/`Bloque` compartidos. Cada apartado dice
qué escribir mientras tanto. En los ejemplos, `<BotonEnlace href={x}>` es hoy
`<Link href={x} className={buttonVariants()}>`.

---

## Las reglas, cortas

1. **Un botón naranja por pantalla, como máximo.** Puede no haber ninguno. En
   una lista, la acción de cada fila nunca es naranja.
2. **Los errores llevan icono.** Siempre con `<Aviso>` (`src/components/aviso.tsx`).
3. **Sin sombras ni degradados.** Profundidad con borde de 1 px. La única
   excepción es el texto sobre una foto, y se hace como la portada del muro.
4. **Un solo modo, el claro.** Nada de `dark:`.
5. **Ningún color a mano.** Ni hex, ni `text-white` sobre crema. El blanco y
   el negro solo encima de una foto; sobre un relleno de color, el token
   `text-primary-foreground` o `text-secondary-foreground`.
6. **El naranja es para acciones.** Ni cifras, ni títulos, ni iconos de
   adorno. Cuidado con los enlaces: ver la regla 11.
7. **Solo los tamaños de la escala** (tabla de abajo). Nada de
   `text-[14.5px]`.
8. **Radios: 8, 12 y redondo.** `rounded-lg` controles, `rounded-xl` tarjetas,
   `rounded-full` insignias y avatares. Dentro de una tarjeta nada lleva 12.
9. **Los campos miden 16 px en el móvil.** Si no, Safari amplía la página.
   Usa `<Input>` y no le pongas tamaño de letra. Hoy **falla en toda la
   aplicación** (inventario M1) y se arregla en un solo sitio, `globals.css`;
   no lo parchees campo a campo.
10. **Iconos de Lucide**, `strokeWidth={1.8}`.
11. **Un enlace con forma de tarjeta o de fila lleva `text-foreground`.**
    `globals.css` pinta de naranja todo `<a>`, y lo que va dentro lo hereda:
    así salieron en naranja las cifras de «La caja» en Inicio.
12. **Un botón que es un enlace no usa `<Button render={<Link/>}>`.** Ver
    «Botones».

---

## Tipografía

Plus Jakarta Sans, en siete tamaños. Escoge por **papel**, no por píxel.

| Papel | Clase | Medida |
|---|---|---|
| Cifra grande (KPI, recuento) | `t-cifra` | 34 |
| Título de página en `/mi`, acceso, `/acepta` | `t-titulo` | 24 |
| Título de página del panel | lo pone `CabeceraPanel`, no lo escribas | 20 / 22 |
| Título de tarjeta o bloque | `t-subtitulo` | 17 |
| Texto, título de una fila (`font-semibold`) | `text-body` | 15 |
| Dato secundario, ayuda, etiqueta de campo | `text-label` o `t-label` | 13 |
| Rótulo de sección y de cifra (mayúsculas) | `t-micro` | 11,5 |

Las insignias y los avatares llevan su tamaño dentro del componente.

La web pública (`/i/[slug]`) y la portada tienen escala de cartel propia
(`t-display`, `clamp(...)`): es la única excepción, y vive solo ahí.

---

## Página del panel

`CabeceraPanel` + `Contenedor`. Siempre los dos.

```tsx
<CabeceraPanel
  titulo="Turnos"
  subtitulo="Quién sirve en cada culto y en qué puesto"
  volver={{ href: `/panel/ministerios/${id}`, texto: 'Alabanza' }}
>
  <BotonEnlace href={`${base}/planificar`}>
    <CalendarPlus strokeWidth={1.8} /> Planificar
  </BotonEnlace>
</CabeceraPanel>

<Contenedor>…</Contenedor>               {/* listas y paneles: 1600 px */}
<Contenedor ancho="formulario">…</Contenedor>  {/* altas y ediciones: 760 px */}
```

- Las acciones de la pantalla van en `children` de la cabecera: el naranja, y
  como mucho una de contorno. «Editar» va aquí, no en una tarjeta lateral.
- Toda pantalla que no sea de primer nivel lleva `volver`. También el informe
  y el libro de movimientos.
- Referencia: `src/app/panel/ministerios/[id]/turnos/page.tsx`.

## Página de `/mi`

`CabeceraMiembro` (`src/app/mi/_components/cabecera-miembro.tsx`) y una
columna de **620 px** centrada:

```tsx
<main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
```

Las once pantallas de `/mi` usan ese ancho; no abras otro. El relleno y el
hueco, también esos (hoy Avisos, Comunidad y Mi cuenta llevan cada una el
suyo).

Referencia: `src/app/mi/agenda/page.tsx`.

## Rótulo de sección

Encima de un grupo de tarjetas o de una lista, fuera de ellas:

```tsx
<section className="flex flex-col gap-2.5">
  <h2 className="t-micro px-1">Próximos</h2>
  …
</section>
```

Dentro de una tarjeta, su título es `t-subtitulo`. No mezcles: «Lo próximo /
Ya pasaron» de Eventos en `t-subtitulo` y «Próximos / Anteriores» de Turnos en
`t-micro` son la misma idea con dos voces. Las palabras, también las mismas:
**Próximos / Anteriores**.

En `/mi` el rótulo se escribe a mano a 12 px: usa `t-micro`.

## Tarjeta

```tsx
<section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
  <div className="flex flex-col gap-1">
    <h2 className="t-subtitulo">Los puestos del equipo</h2>
    <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">…</p>
  </div>
  …
</section>
```

- Relleno `p-5`. `p-4` en tarjetas pequeñas de rejilla; `p-8` solo en estados
  vacíos.
- Lo que va dentro y necesita fondo propio es `rounded-lg bg-surface-alt`,
  nunca otra tarjeta de 12.
- Una tarjeta entera que es enlace:
  `rounded-xl border border-border bg-surface p-4 text-foreground no-underline
  transition-colors hover:border-support-hover hover:bg-surface-alt
  hover:no-underline` (es `TarjetaTurno`).

## Lista

**Una tarjeta con filas separadas por una línea.** Es la forma por defecto.

```tsx
<ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
  {lista.map((c) => (
    <li key={c.id} className="border-b border-border last:border-b-0">
      <FilaCancion … />
    </li>
  ))}
</ul>
```

**Una tarjeta por elemento** solo cuando cada uno trae estado que pide
atención (huecos, sin contestar, aforo). Turnos lo hace bien con las dos: los
próximos en tarjetas con sus insignias, los anteriores en lista.

En el móvil una tabla **no se apila columna a columna**. Se convierte en fila
de lista: nombre arriba, un único renglón de datos debajo y la insignia a la
derecha (ver M4 del inventario).

## Fila con acción

La fila entera es el enlace, con flecha al final:

```tsx
<Link
  href={href}
  className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
>
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <span className="truncate text-body font-semibold">{titulo}</span>
    <span className="truncate text-label text-muted-foreground">{datos}</span>
  </span>
  <ChevronRight className="size-4 flex-none text-disabled-text" strokeWidth={1.8} aria-hidden />
</Link>
```

Referencia: `FilaCancion` en `.../repertorio/page.tsx`.

Si la fila tiene botones propios (quitar, cambiar papel), la fila no es enlace
y los botones son `variant="ghost" size="icon-sm"` con `aria-label`. Referencia:
«Quién forma el equipo» en `src/app/panel/ministerios/[id]/page.tsx`.

## Estado vacío

Dice qué es esto, qué hay que hacer y da el botón para hacerlo.

```tsx
<div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
  <h2 className="t-subtitulo">No hay turnos por delante</h2>
  <p className="max-w-[56ch] text-body leading-relaxed text-muted-foreground">
    Elige en qué cultos de las próximas semanas sirve el equipo y después pon
    a cada persona en su puesto.
  </p>
  <BotonEnlace variant="outline" href={`${base}/planificar`}>
    <CalendarPlus strokeWidth={1.8} /> Planificar las próximas semanas
  </BotonEnlace>
</div>
```

El botón va de contorno aunque la misma acción esté en naranja en la cabecera.
Un vacío de **búsqueda** es una línea: «Ninguna canción coincide con «x»».

No vale: «No hay nada. Lo que crees aparecerá aquí.», ni un texto gris
centrado sin salida.

Referencia: `src/app/panel/ministerios/[id]/turnos/page.tsx`, línea 80.

## Avisos

- Error y confirmación: `<Aviso>` y `<Aviso tipo="ok">`, arriba del
  contenido, debajo de la cabecera. Llevan icono solos.
- Explicación fija de la pantalla (lo que hace, no lo que ha pasado): tarjeta
  sin icono, `rounded-xl border border-border bg-surface px-4 py-3 text-label
  text-muted-foreground`. Referencia: la de arriba de `/panel/lideres`.
- Zona de borrar: tarjeta propia al final, `rounded-xl border
  border-danger-border bg-danger-soft p-5`, con su texto de consecuencias y un
  botón `variant="destructive"` con icono. Referencia: «Borrar» en
  `src/app/panel/eventos/[id]/page.tsx`.
- Un mensaje para el usuario nunca enseña nombres internos (`esencial/mensual`,
  variables de entorno, códigos).

## Formulario

Contenedor `ancho="formulario"`. Los campos **siempre dentro de un bloque**,
nunca sueltos sobre el crema. Dos columnas en `sm`, el envío debajo.

```tsx
<form action={accion} className="flex flex-col gap-6">
  {error && <Aviso>{error}</Aviso>}

  <Bloque titulo="Quién es" nota="Opcional: lo que ayude a explicar el bloque.">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre" nombre="nombre" requerido>
        <Input id="nombre" name="nombre" required />
      </Campo>
      <Campo etiqueta="Teléfono" nombre="telefono" ayuda="Con prefijo si es de fuera.">
        <Input id="telefono" name="telefono" type="tel" />
      </Campo>
    </div>
  </Bloque>

  <div className="flex items-center gap-3">
    <Button type="submit">Añadir a la iglesia</Button>
    <BotonEnlace variant="ghost" href="/panel/miembros">Cancelar</BotonEnlace>
  </div>
</form>
```

- `Campo` y `Bloque` están hoy dentro de
  `src/app/panel/miembros/_components/formulario.tsx`, y `Campo` está copiado
  en Ajustes, Eventos y Movimientos. Hasta que se suban a
  `src/components/formulario.tsx` (fase 2), copia los de miembros.
- `Campo`: `Label` + «(opcional)» en `font-normal text-muted-foreground` +
  ayuda en `t-label text-muted-foreground`. Lo obligatorio no se marca; se
  marca lo opcional.
- **Alturas**: en un formulario todo campo mide 42 (`<Input>`, y el `select`
  nativo con `h-[42px]`). En una barra de filtros todo mide 36: campo,
  desplegable y botón `size="sm"`. No mezcles 40 y 36 en la misma fila.
- `grid-cols-1` explícito: un `select` largo saca la página por la derecha en
  el móvil sin él (trampa de `ESTADO.md`).
- El botón de enviar no va a ancho completo en escritorio.
- Un marcador de posición que parece un dato («Lucía», «Ferrer Ramos») se lee
  como relleno. Si hace falta, «p. ej. Lucía».
- Subir una imagen: como el botón «Fotos» del muro
  (`src/app/mi/comunidad/_components/publicador.tsx`): el
  `<input type="file" className="sr-only">` y un `<label htmlFor>` con las
  clases de `buttonVariants({ variant: 'outline' })` y su icono. No el control
  nativo «Seleccionar archivo · Ningún archivo seleccionado» con un «Subir» al
  lado.

Referencia: `src/app/panel/miembros/_components/formulario.tsx`.

## Botones

`src/components/ui/button.tsx`.

| Variante | Cuándo |
|---|---|
| `default` (naranja) | La acción de la pantalla. Una. |
| `secondary` (carbón) | La acción principal de cada tarjeta cuando hay varias iguales (Aprobar una solicitud). La acción del miembro en su agenda. |
| `outline` | Todo lo demás: filtrar, copiar, editar, estados vacíos. |
| `ghost` | Terciarias: cancelar, acciones de icono en una fila. |
| `destructive` | Borrar. Contorno rojo, se rellena al pulsar, siempre con icono. |

Tamaños: `default` 40, `sm` 36 (filtros y filas), `icon` 40, `icon-sm` 34.

**La misma acción lleva el mismo botón en todas partes.** «Ahí estaré» es
carbón en la agenda y naranja en la ficha del turno; «Copiar» es naranja en
un enlace y de contorno en el de al lado. Elige uno.

**Botón que es un enlace.** No `<Button render={<Link/>}>`: Base UI avisa por
consola en cada pantalla y le pone `type="button"` a un `<a>`. Y
`nativeButton={false}` no lo arregla: le pone `role="button"`, y un lector de
pantalla anuncia un enlace como botón. La forma es pintar un enlace con las
clases del botón:

```tsx
// Hoy, sin componente nuevo:
<Link href="/panel/miembros/nuevo" className={buttonVariants()}>
  <Plus strokeWidth={1.8} /> Añadir miembro
</Link>

// Fase 2: src/components/ui/boton-enlace.tsx hace lo mismo y elige <Link> o <a>
<BotonEnlace href="/panel/miembros/nuevo">…</BotonEnlace>
<BotonEnlace href={`tel:${tel}`} variant="outline">…</BotonEnlace>
```

`<a>` y no `<Link>` para anclas (`#contacto`), `tel:`, `mailto:`, enlaces de
fuera y descargas de un route handler (el CSV): `Link` intentaría precargarlos.

## Insignias

Una sola forma: **pastilla**.

```tsx
<span className="inline-flex h-[22px] items-center rounded-full bg-badge-warning-bg px-2.5 text-[12px] font-semibold text-badge-warning-fg">
  Sin cubrir
</span>
```

| Tono | Fondo / texto | Para |
|---|---|---|
| éxito | `bg-badge-success-bg` / `text-badge-success-fg` | publicado, confirmado, activo |
| aviso | `bg-badge-warning-bg` / `text-badge-warning-fg` | sin cubrir, pendiente, visitante |
| marca | `bg-badge-accent-bg` / `text-badge-accent-fg` | nuevo, tu cuenta, responsable |
| neutro | `bg-badge-neutral-bg` / `text-badge-neutral-fg` | rol, tono, datos |
| peligro | `bg-badge-danger-bg` / `text-badge-danger-fg` | no puede, rechazada |

Fase 2: `src/components/ui/insignia.tsx` con `tono`, que sustituye al
`badge.tsx` de shadcn (no lo usa nadie y trae `dark:`). Hasta entonces, la
pastilla de arriba, que es la de `src/app/panel/eventos/page.tsx`, línea 110.
Su `text-[12px]` es la única medida suelta que se acepta, y solo dentro de la
insignia.

## Pestañas, segmentado y opción elegida

- **Pestañas de sección** (las del ministerio): `PestanasMinisterio`. Activa
  `border-primary bg-accent text-accent-foreground`; las demás, borde gris.
- **Segmentado** (Día / Semana / Mes): pista `rounded-xl border bg-surface
  p-1`, opción activa `bg-accent text-accent-foreground`. Referencia:
  `src/app/mi/agenda/page.tsx`, línea 336. No en negro (`bg-foreground`) como
  «Entra / Sale» de Apuntar movimiento.
- **Opción elegida en una lista de radios**: la fila entera es la `label`,
  elegida con `border-primary bg-accent`. Referencia: «Quién puede publicar»
  en `/panel/comunidad`.

La regla que une las tres: lo elegido es `bg-accent text-accent-foreground`;
lleva borde naranja solo si las no elegidas llevan borde.

## Cifras

```tsx
<div className="flex flex-col gap-1">
  <span className="t-micro">Personas</span>
  <span className="t-cifra tabular-nums">19</span>
</div>
```

`t-cifra` en Inicio, en Finanzas y en el informe: hoy son 34, 24 y 20 para lo
mismo. Una cifra de dinero no va en naranja ni en rojo; si es negativa,
lleva el signo.

## Avatar

`AvatarPersona` (`src/components/avatar-persona.tsx`), en el panel también.
Da a cada persona su color, siempre el mismo, y pone la foto encima si la
hay. No escribas `iniciales()` en un círculo a mano: hoy hay quince, y la
misma persona sale con foto en el muro y en la cabecera, y con sus iniciales
en gris en el panel y en la tarjeta de Mi cuenta. El estado de la persona va
en una insignia, no en el color del avatar.

## Texto sobre una foto

Una sola forma, la de la portada del muro
(`src/app/mi/comunidad/_components/cabecera-del-dia.tsx`): la foto
`absolute inset-0 -z-10 object-cover`, el velo encima y el texto en blanco.
Nada de `drop-shadow` en el texto. Si una pantalla nueva necesita foto con
texto, reutiliza esa pieza; no escribas otro velo.

## La barra de `/mi`

`BarraInferior` (`src/app/mi/_components/barra-inferior.tsx`), la pone el
layout. No se toca desde una página.

- Cuatro pestañas: Comunidad, Devocional, Agenda, Biblia. Una quinta tiene que
  ser un destino de verdad; acciones como «publicar» no van aquí.
- Nombres siempre visibles. Activa `border-primary/30 bg-accent
  text-accent-foreground`, igual que en la regla de selección (aquí con borde
  suave porque va sobre cristal).
- Una sola barra `fixed`: pastilla centrada en escritorio, ancho completo en
  el móvil. El cristal va con guarda `supports-backdrop-filter:`; sin ella el
  texto se pierde sobre lo de debajo.
- Sin sombra. El layout ya deja el hueco debajo (`h-[76px] md:h-[88px]`).
- Lo que hay que mejorar: los nombres miden 10,5 px y el mínimo es 11,5
  (inventario A16).

## Páginas que no existen o fallan

Hoy salen en negro y en inglés (la de Next). Hasta que existan
`not-found.tsx` y `error.tsx` propios (fase 2, inventario M2), no envíes a la
gente a un `notFound()` desde un flujo normal: redirige con un mensaje.

---

## Antes de dar una pantalla por buena

Ábrela a 375 px y a 1280 px y comprueba:

- [ ] Como mucho un botón naranja.
- [ ] Ningún `text-[Npx]`, ningún hex, ningún `text-white` sobre crema.
- [ ] Los campos miden 16 px en el móvil (en el inspector, `font-size` del
      `<input>`). Hasta que se aplique M1 fallará en todas; lo que hay que
      mirar es que no le hayas puesto tú un tamaño.
- [ ] Nada se sale por la derecha a 375 px y las tablas son filas.
- [ ] Cada lista vacía dice qué hacer y tiene botón.
- [ ] Los errores llegan con `<Aviso>`.
- [ ] La consola, limpia: ni el aviso de Base UI ni ningún otro.
- [ ] Los enlaces-tarjeta no heredan el naranja.
