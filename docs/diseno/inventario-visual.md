# Inventario visual de Hatril

20 de octubre de 2026. Fase 1 de dos: qué falla, dónde y cómo se arregla. Los
arreglos (fase 2) se aplican cuando estén fusionadas las ramas de los módulos.
Las reglas para construir bien están en [`guia-visual.md`](guia-visual.md).

## Cómo se hizo

- `main` en `e08ac4b`, servidor de desarrollo en el 3006.
- Cada pantalla a **375 px** y a **1280 px**, con `pastor@`, `lider@`,
  `miembro@`, `colider@` y `visita@`. Lo público, sin sesión.
- En cada pantalla, además de la captura, un script que mide en el navegador:
  botones con fondo naranja, elementos que se salen por la derecha, sombras,
  degradados, tamaño de letra de cada campo, alturas de campo, tamaños de letra
  distintos en uso, iconos que no son de Lucide y zonas táctiles de menos de
  32 px.
- Y en el código: hex, `text-white`, `dark:`, sombras, `text-[Npx]`, radios,
  iconos y componentes duplicados.

Las capturas no van al repo: cada problema dice la ruta y la cuenta con la que
se reproduce. Quedan fuera los tres contrastes bajos que ya recoge `ESTADO.md`.

Lo que está bien, para no tocarlo: ninguna pantalla se sale por la derecha a
375 px; todos los iconos son de Lucide; ningún hex suelto en pantallas (los
de `lib/` son la paleta de ministerios y del avatar, a propósito); todos los
errores de formulario llegan por `<Aviso>`, con icono; el panel entero usa
`CabeceraPanel` y `Contenedor` menos el informe; `/mi` entero va a 620 px.

## Resumen

| ID | Problema | Gravedad |
|---|---|---|
| M1 | Los campos miden 15 px en el móvil y Safari amplía la página | se nota mucho |
| M2 | Página 404 y de error de Next: negra y en inglés; `/panel` da 404 | se nota mucho |
| M3 | Aviso de Base UI en cada pantalla por los botones-enlace | se nota mucho |
| M4 | Miembros en el móvil: la tabla se apila sin etiquetas | se nota mucho |
| M5 | Ajustes, horarios: los campos cortan lo que llevan | se nota mucho |
| M6 | Inicio, «La caja»: las cifras salen en naranja | se nota mucho |
| M7 | Directorio: un botón naranja por iglesia, más el de buscar | se nota mucho |
| A1 | 29 tamaños de letra escritos a mano; la escala no se usa | se nota algo |
| A2 | La misma persona con tres avatares distintos | se nota algo |
| A3 | Insignias con dos formas y medidas sueltas | se nota algo |
| A4 | La misma acción con botones de distinto color | se nota algo |
| A5 | «Próximos / pasados» con tres rótulos distintos | se nota algo |
| A6 | Estados vacíos que no dicen qué hacer | se nota algo |
| A7 | Formularios con tres maquetas y seis alturas de campo | se nota algo |
| A8 | Texto sobre foto resuelto de cuatro maneras, con un segundo degradado | se nota algo |
| A9 | Sombras en los desplegables de shadcn | se nota algo |
| A10 | Colores de ministerio que compiten con el naranja de marca | se nota algo |
| A11 | «Entra / Sale» seleccionado en negro | se nota algo |
| A12 | Subir fotos con el control nativo del navegador | se nota algo |
| A13 | «Editar» en sitios distintos según la pantalla | se nota algo |
| A14 | Informe y libro de movimientos sin vuelta a Finanzas | se nota algo |
| A15 | El panel del líder: cifras que no son suyas | se nota algo |
| A16 | La barra de `/mi` con los nombres a 10,5 px | se nota algo |
| A17 | La portada con el bloque de cuatro iconos de plantilla | se nota algo |
| D1 | Ocho grosores de icono | detalle |
| D2 | Tres velos distintos detrás de los modales | detalle |
| D3 | `text-white` sobre relleno en vez del token | detalle |
| D4 | Letras de 9,5 y 10,5 px | detalle |
| D5 | Barra de desplazamiento visible bajo las pestañas del ministerio | detalle |
| D6 | Barras de filtros con alturas y filas desparejas | detalle |
| D7 | Marcadores de posición que parecen datos | detalle |
| D8 | Mensaje técnico en Suscripción | detalle |
| D9 | «Apuntar la reunión» en la agenda de un ministerio | detalle |
| D10 | Rótulos de sección de `/mi` escritos a mano | detalle |
| D11 | Zonas táctiles de 20 px en el móvil | detalle |
| D12 | Las pantallas de `/mi` sin `h1` | detalle |
| D13 | La web pública con escala y radios propios | detalle |
| D14 | `badge.tsx`, `select.tsx` y `dialog.tsx` de shadcn sin usar | detalle |
| D15 | Rellenos y huecos distintos entre pantallas de `/mi` | detalle |

---

## Se nota mucho

### M1 · Los campos miden 15 px en el móvil y Safari amplía la página

- **Dónde**: todo formulario, público y panel. Medido a 375 px: `/acceso` 15
  px, `/iglesias` 15,5, `/panel/miembros` 14 y 14,5,
  `/panel/ministerios/[id]/turnos/[turnoId]` 14 y 14,5 (quince campos),
  `/panel/miembros/nuevo` 15 (doce campos); y los treinta y seis de
  `/panel/ajustes`, todos `<Input>`.
- **Ficheros**: `src/app/globals.css:418` (la regla),
  `src/components/ui/input.tsx:29` (`text-[15px]`, 80 usos de `<Input>`), y
  42 campos nativos con tamaño propio en 21 ficheros: `(auth)/registro`,
  `i/[slug]/eventos/[id]`, `iglesias`, `solicitar/[slug]`, y en el panel
  `ajustes`, `devocionales`, `eventos/_components/formulario`,
  `finanzas/ajustes`, `finanzas/movimientos` (página y formulario), `lideres`,
  `miembros/_components/formulario`, `ministerios/[id]`,
  `ministerios/[id]/repertorio/_components/formulario-cancion`,
  `ministerios/[id]/seguimiento/[miembroId]`, `ministerios/[id]/turnos`
  (lista, planificar y turno), `ministerios/_components/formulario`,
  `reuniones/_components/formulario` y `solicitudes`.
- **Qué pasa**: la regla de los 16 px está dentro de `@layer base`, y las
  utilidades de Tailwind viven en `@layer utilities`, que gana siempre, tenga
  la especificidad que tenga. Solo funciona en campos sin clase de tamaño,
  como el del muro, que es donde se probó. `ESTADO.md` lo da por resuelto en
  toda la aplicación y no lo está: es exactamente el fallo de «se mueve todo»
  que describe, en cada formulario.
- **Arreglo**: sacar el `@media (max-width: 767px) { … }` fuera de
  `@layer base`; lo que no tiene capa gana a todas. **Verificado** inyectando
  esa regla sin capa en `/panel/miembros/nuevo` a 375 px: los doce campos
  pasan de 15 a 16. Después, `text-[15px]` → `text-body` en `input.tsx`, que
  es el tamaño de escritorio. Un solo sitio, sin tocar los 21 ficheros.

### M2 · Página 404 y de error de Next: negra y en inglés

- **Dónde**: cualquiera de las 42 llamadas a `notFound()` (un turno de otro
  equipo, un módulo apagado, una ficha que no existe), un enlace roto y
  **`/panel` a secas**, que no tiene página. Probado como `lider@`:
  `/panel` da «404 · This page could not be found.» en blanco sobre negro.
- **Ficheros**: no existe ningún `not-found.tsx`, `error.tsx` ni
  `global-error.tsx` en `src/app`.
- **Qué se ve**: la única pantalla oscura de la aplicación, en inglés, sin
  marca y sin salida.
- **Arreglo**: `src/app/not-found.tsx` en crema, con «Esta página no existe»
  y un botón a `/`; `src/app/panel/not-found.tsx` y `src/app/mi/not-found.tsx`
  para que salgan dentro de su layout, con menú; `error.tsx` en `panel` y en
  `mi` con «Algo ha fallado» y «Volver a intentarlo». Y
  `src/app/panel/page.tsx` que redirija a `inicioDe(ctx)`.

### M3 · Aviso de Base UI en cada pantalla por los botones-enlace

- **Dónde**: toda la aplicación. La consola de Next marca «4 issues» en la
  portada y «7 issues» en la web de la iglesia, todos este.
- **Ficheros**: 68 `<Button render={<Link … />}>` o `render={<a … />}` en 33
  ficheros (el de `src/components/ui/dialog.tsx` es otro caso y está bien).
  `src/components/ui/button.tsx:28` ya lo deja como pendiente.
- **Qué pasa**: Base UI espera un `<button>` y recibe un `<a>`. Lo pinta como
  `<a type="button" tabindex="0">` y avisa. La salida que sugiere el propio
  aviso, `nativeButton={false}`, **no sirve**: leído en
  `node_modules/@base-ui/react/internals/use-button/useButton.mjs:177`, con
  `nativeButton={false}` añade `role="button"`, y un lector de pantalla
  anunciaría cada enlace como botón (y la barra espaciadora lo activaría).
- **Arreglo, una sola forma para todo el repo**: un enlace no es un `Button`.
  Se pinta con las clases del botón:

  ```tsx
  // src/components/ui/boton-enlace.tsx
  import Link from 'next/link';
  import type { VariantProps } from 'class-variance-authority';
  import { buttonVariants } from './button';
  import { cn } from '@/lib/utils';

  type Props = React.ComponentProps<'a'> &
    VariantProps<typeof buttonVariants> & {
      href: string;
      /** Descargas de un route handler: sin `Link`, que lo precargaría. */
      nativo?: boolean;
    };

  export function BotonEnlace({ href, variant, size, className, nativo, ...props }: Props) {
    const clases = cn(buttonVariants({ variant, size }), className);
    const fuera = nativo || !href.startsWith('/');   // #ancla, tel:, mailto:, https:
    return fuera
      ? <a href={href} data-slot="button" className={clases} {...props} />
      : <Link href={href} data-slot="button" className={clases} {...props} />;
  }
  ```

  Y sustituir los 68 usos: `<Button variant="outline" render={<Link
  href={x} />}>` → `<BotonEnlace variant="outline" href={x}>`. Es mecánico;
  el CSV de `panel/eventos/[id]/page.tsx:120` lleva `nativo`. Después,
  comprobar la consola limpia en un Chrome de verdad, que es lo que
  `button.tsx` pedía.

### M4 · Miembros en el móvil: la tabla se apila sin etiquetas

- **Dónde**: `/panel/miembros` a 375 px, como `pastor@`.
- **Fichero**: `src/app/panel/miembros/page.tsx:120` (la fila es
  `grid grid-cols-1` en el móvil y cinco columnas en `md`).
- **Qué se ve**: cada persona ocupa unos 175 px: nombre y correo, la insignia
  sola en su renglón, un «—» suelto (sus ministerios), el teléfono y la fecha
  de alta, sin decir qué es cada cosa. Diecinueve personas son 3.300 px de
  scroll.
- **Arreglo**: en el móvil, fila de lista de la guía: avatar, nombre y una
  línea de datos («Alabanza · +57 300…»), la insignia a la derecha, y la fecha
  de alta fuera. Las cinco columnas solo desde `md`.

### M5 · Ajustes, horarios: los campos cortan lo que llevan

- **Dónde**: `/panel/ajustes` a 1280 px, bloque de horarios.
- **Fichero**: `src/app/panel/ajustes/page.tsx:250-290`, dentro de la rejilla
  `xl:grid-cols-2` de la línea 91.
- **Qué se ve**: en media columna caben en una fila el botón de destacar y
  cuatro campos, y ninguno enseña su valor: «11:0», «Marte», «Miérc»,
  «Reunic», «Hora y media. Lo».
- **Arreglo**: cada horario en dos renglones (día y hora; nombre y detalle) o
  la tarjeta de la página pública a ancho completo. A 375 px ya se apilan bien.

### M6 · Inicio, «La caja»: las cifras salen en naranja

- **Dónde**: `/panel/hoy` como `pastor@`, columna derecha.
- **Fichero**: `src/app/panel/hoy/page.tsx:395`. El `Link` que hace de
  tarjeta no lleva color de texto, y `globals.css:336` pinta todo `<a>` de
  naranja. Medido: los dos «$ 0» salen en `rgb(177, 84, 53)`.
- **Qué se ve**: «Salió $0» en naranja rojizo se lee como una alarma, y el
  naranja está reservado a las acciones.
- **Arreglo**: `text-foreground` en esa tarjeta. Buscado en todo el repo con
  un script: es la única que hereda hoy, pero el fallo es de diseño del CSS y
  volverá; por eso es la regla 11 de la guía.

### M7 · Directorio: un botón naranja por iglesia, más el de buscar

- **Dónde**: `/iglesias`, a los dos anchos.
- **Fichero**: `src/app/iglesias/page.tsx:84` («Buscar», naranja a ancho
  completo en el móvil) y `:139` («Pedir unirme», naranja en cada tarjeta).
- **Qué se ve**: con una iglesia publicada ya hay dos; con diez, once.
- **Arreglo**: «Buscar» como botón de icono de contorno pegado al campo, como
  en el repertorio; «Pedir unirme» en `secondary`, «Ver la iglesia» en
  `outline`. La pantalla se queda sin naranja, que está permitido.

---

## Se nota algo

### A1 · 29 tamaños de letra escritos a mano; la escala no se usa

- **Dónde**: todas. El script cuenta entre 4 y 20 tamaños distintos por
  pantalla (`/acceso`: 4; `/panel/miembros`: 10; `/i/betania`: 20).
- **Ficheros**: 723 `text-[Npx]` en `src`: 13 (114), 15 (97), 14,5 (91), 14
  (89), 13,5 (83), 12,5 (54), 12 (50), 17 (31) y veintiún tamaños más. Las
  utilidades de la escala (`text-body`, `text-label`…) existen en
  `globals.css:302` y **no se usan ni una vez**; las clases `t-*`, 174 veces.
- **Qué se ve**: dos escalas paralelas que se mezclan en la misma fila
  (13 y 13,5; 14,5 y 15). Ninguna pantalla se ve mal sola; juntas no
  terminan de parecer del mismo producto.
- **Arreglo**: pasar por papel, no por píxel (tabla de la guía). Como
  primera pasada mecánica: 12,5 / 13 / 13,5 → `text-label`; 14 / 14,5 / 15 /
  15,5 → `text-body`; 16,5 / 17 / 18 → `text-subtitle`; los títulos de 20-24
  → `t-titulo`. Después revisar a ojo turnos, agenda y muro, que son los que
  más cuidan el tamaño. Y una comprobación en `npm run lint` que rechace
  `text-\[\d` fuera de `i/[slug]` y la portada.

### A2 · La misma persona con tres avatares distintos

- **Dónde**: Lucía (`miembro@`) sale con su foto en el muro y en la cabecera
  de `/mi`, y con «LF» gris en la tarjeta de Mi cuenta, en `/panel/miembros`
  y en el equipo de Alabanza. Sara (`colider@`): «SN» de color en la
  cabecera, gris en la tarjeta de Mi cuenta. Quien no tiene foto es de color
  en el muro y gris en el panel.
- **Ficheros**: `src/components/avatar-persona.tsx` existe y solo lo usan el
  muro, el devocional y el menú de cuenta. Quince ficheros pintan
  `iniciales()` de una persona en un círculo a mano: `panel/hoy`,
  `panel/cuenta`, `lideres`, `miembros` (página y ficha), `ministerios`
  (lista, detalle, agenda, seguimiento y su detalle, turno, diálogo de
  asignar), `reuniones/[id]`, `solicitudes` y `mi/cuenta/page.tsx:48`.
- **Arreglo**: `AvatarPersona` en todos, con `fotoUrl` donde la haya. El
  estado de la persona (visitante, nuevo) ya va en la insignia; el avatar del
  panel lo repetía en color.

### A3 · Insignias con dos formas y medidas sueltas

- **Dónde**: pastilla en Miembros, Eventos y Módulos; rectángulo de 6 px en
  Turnos («Sin cubrir», «3 sin contestar»), Repertorio (el tono) y la ficha
  del turno en `/mi`.
- **Ficheros**: `panel/ministerios/[id]/turnos/[turnoId]/page.tsx:215`,
  `turnos/page.tsx`, `repertorio/page.tsx:161`, `mi/agenda/turno/[id]/page.tsx`
  frente a `panel/eventos/page.tsx:110` y `panel/modulos/page.tsx:140`.
  `src/components/ui/badge.tsx` no lo importa nadie.
- **Arreglo**: `src/components/ui/insignia.tsx` con `tono` (éxito, aviso,
  marca, neutro, peligro) y la pastilla de Eventos. El tono de una canción
  (una letra) puede seguir cuadrado: es un dato, no un estado.

### A4 · La misma acción con botones de distinto color

- «**Ahí estaré**»: carbón y pequeño en `/mi/agenda` («Te toca servir»,
  `src/app/mi/agenda/page.tsx:245`) y naranja en la ficha del turno
  (`src/app/mi/agenda/turno/[id]/page.tsx:118`). Es la misma persona
  contestando lo mismo.
- «**Copiar**» en `/panel/compartir`: naranja en el enlace de la web y de
  contorno en el de «pedir unirme» (`compartir/page.tsx:114`, `destacado`).
- **Arreglo**: «Ahí estaré» en `secondary` en los dos sitios (la ficha del
  turno se queda sin naranja). «Copiar» de contorno en los dos.

### A5 · «Próximos / pasados» con tres rótulos distintos

- Eventos: «Lo próximo» y «Ya pasaron» en `t-subtitulo` con una frase debajo
  (`panel/eventos/page.tsx`). Turnos: «Próximos» y «Anteriores» en `t-micro`.
  Devocionales: «Lo que viene» y «Ya publicados» en `t-micro`. En `/mi`:
  «Próximos» a 12 px escrito a mano.
- **Arreglo**: `t-micro` encima de la lista y las mismas palabras,
  **Próximos / Anteriores**, en las cuatro.

### A6 · Estados vacíos que no dicen qué hacer

- `/panel/eventos`, sección vacía: «No hay nada. Lo que crees aparecerá
  aquí.» (`panel/eventos/page.tsx:135`).
- `/panel/finanzas/movimientos`: «No hay movimientos en este periodo.», gris
  y centrado, sin botón (`movimientos/page.tsx:117`). Lo mismo en el informe
  (`informe/page.tsx:117`) y en Finanzas, «Todavía no hay ninguno.»
  (`finanzas/page.tsx:188`).
- **Arreglo**: el patrón de Turnos de la guía: qué es, qué hacer y el botón.
  El de Devocionales (icono y texto centrado) es el segundo mejor, y se pasa
  al primero.

### A7 · Formularios con tres maquetas y seis alturas de campo

- **Maquetas**: campos sueltos sobre el crema en `/panel/eventos/nuevo` y
  `/panel/finanzas/movimientos/nuevo`; todos en una tarjeta en
  `/panel/reuniones/nueva` y en la agenda; bloques con título en
  `/panel/miembros/nuevo`, `/panel/ministerios/nuevo` y la canción.
- **Botón de enviar**: a ancho completo solo en Apuntar movimiento, también
  en escritorio.
- **Alturas**: 42 (`<Input>`), 44 (`movimientos/_components/formulario.tsx:113`),
  40 (buscador de Miembros), 36 (desplegables de filtros y del turno), 34
  (fichero) y 32 (tono en el turno). En la ficha del turno conviven cuatro.
- **Código**: `Campo` está definido cuatro veces (miembros, eventos,
  movimientos y ajustes) y `Bloque` solo existe en miembros; 19 `<select>` y
  19 `<textarea>` copian sus clases a mano. No se usa el
  `Select` de shadcn (bien: viaja en `FormData`), pero tampoco hay uno propio.
- **Arreglo**: `src/components/formulario.tsx` con `Campo` y `Bloque`, y
  `Selector` y `AreaTexto` en `src/components/ui/` con las clases del
  `<Input>`. Todos los formularios en bloques. Alturas: 42 en formularios, 36
  en barras de filtros.

### A8 · Texto sobre foto resuelto de cuatro maneras

- Degradado en la portada del muro (`cabecera-del-dia.tsx:106`), que es la
  excepción que permite `CLAUDE.md`. **Otro degradado** en la portada del
  devocional, con `drop-shadow` en el texto (`mi/devocional/page.tsx:126`).
  Velo plano `bg-black/45` en el carrusel de la web pública
  (`i/[slug]/page.tsx:456` y `:465`) y `bg-black/55` en los grupos apilados
  (`grupos-apilados.tsx:78`).
- `CLAUDE.md`: «Si aparece una segunda, es que la regla se está deshaciendo
  sola». Ya hay una segunda.
- **Arreglo**: una pieza, `PortadaFoto`, sacada de la del muro, y que la usen
  el devocional y la web pública. La regla de `CLAUDE.md` pasa a decir «texto
  sobre foto, con `PortadaFoto`» en vez de nombrar una pantalla. Sin
  `drop-shadow`.

### A9 · Sombras en los desplegables de shadcn

- `src/components/ui/dropdown-menu.tsx:44` (`shadow-md`) y `:138`
  (`shadow-lg`), y `select.tsx:86`. Se ve en el menú de la cabecera de la web
  pública, que es el único que lo usa. `popover.tsx` ya lo quitó y lo explica.
- **Arreglo**: `border border-border` como en el popover, sin `ring` ni
  sombra.

### A10 · Colores de ministerio que compiten con el naranja de marca

- `src/lib/ministerios/colores.ts:40-44`: «Naranja» es #BD4715 (el naranja
  de la primera paleta, no el de ahora), «Teja» #9C3A11 otro naranja, y
  «Verde» #2F5D50 es el verde de marca que se retiró. En `/panel/ministerios`
  y Módulos, el cuadradito naranja de Alabanza al lado del botón «Crear
  ministerio» parece otra acción.
- **Arreglo**, sin migración: el `hex` guardado en `ministerios.color_hex` es
  la clave; se cambian solo los colores que se pintan (`hex` de muestra,
  `suave`, `claro`) por cinco que no sean naranja: carbón, azul `info`, ámbar,
  verde del «hecho» y gris. «Dorado» sigue pendiente de su contraste.

### A11 · «Entra / Sale» seleccionado en negro

- `/panel/finanzas/movimientos/nuevo`, `formulario.tsx:84` y `:97`
  (`bg-foreground text-background`). Es el único segmentado en negro; el de
  la agenda usa `bg-accent`.
- **Arreglo**: el segmentado de la guía. Si se quiere que «Sale» se distinga
  de «Entra», con el icono, no con el negro.

### A12 · Subir fotos con el control nativo del navegador

- Foto del ministerio (`panel/ministerios/[id]/page.tsx:320`), logo y fotos
  de portada en Ajustes (`ajustes/page.tsx:396` y `:526`): «Seleccionar
  archivo · Ningún archivo seleccionado» en gris de sistema y, al lado, un
  botón «Subir» o «Cambiar». Dos controles para una acción, y el único sitio
  con aspecto de formulario de navegador.
- **Arreglo**: el patrón del botón «Fotos» del muro (guía, «Formulario»).

### A13 · «Editar» en sitios distintos según la pantalla

- En la cabecera en Reuniones y en el ministerio («Editar equipo»); en una
  tarjeta lateral, como enlace, en el evento (`panel/eventos/[id]/page.tsx:321`).
- **Arreglo**: en la cabecera, de contorno.

### A14 · Informe y libro de movimientos sin vuelta a Finanzas

- `/panel/finanzas/informe` no usa `CabeceraPanel` (`informe/page.tsx:60`):
  sin migas, sin campana, centrado a 820 px y con sus cifras a 20 px.
  `/panel/finanzas/movimientos` tampoco lleva `volver`.
- **Arreglo**: `volver` en los dos. El informe puede seguir sin cabecera al
  imprimir (`print:hidden`), pero en pantalla la lleva.

### A15 · El panel del líder: cifras que no son suyas

- Como `lider@`: Inicio enseña solo «La congregación: 19 personas, 10
  sirviendo», nada de Alabanza. En Miembros, el subtítulo dice «19 personas en
  la iglesia · 10 se han sumado este mes» y la lista enseña 3, su equipo
  (`panel/miembros/page.tsx:73`). Lo mismo con `colider@`.
- **Arreglo**: el subtítulo cuenta lo que se ve («3 personas en tu equipo»).
  Inicio del líder: lo de su equipo arriba (próximo turno, huecos), que es lo
  que está haciendo la rama `consolidacion-nuevos` para el pastor; coordinar.

### A16 · La barra de `/mi` con los nombres a 10,5 px

- `src/app/mi/_components/barra-inferior.tsx:56`. Es la navegación principal
  de una congregación con gente mayor, y el mínimo de la escala es 11,5.
- **Arreglo**: `text-micro` (11,5) en semibold. Cabe: la más larga es
  «Devocional», y a 375 px cada pestaña tiene unos 80 px.

### A17 · La portada con el bloque de cuatro iconos de plantilla

- `/`, debajo del titular: cuatro iconos en cuadrado beige, título y dos
  líneas cada uno («El fichero, al día», «Ministerios de verdad»…). Es el
  bloque de cualquier plantilla de SaaS, y lo que Marlon pide es lo contrario.
  Además, el titular a 46 px ocupa cinco líneas y casi toda la primera
  pantalla del móvil.
- **Arreglo**: enseñar el producto en vez de describirlo: una captura real de
  turnos o del muro con dos frases, o los cuatro puntos como lista de texto
  sin iconos. `t-display` a 34-36 px por debajo de `sm`.

---

## Detalle

### D1 · Ocho grosores de icono

`strokeWidth` vale 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.2 y 2.4 (81 veces 1.8, 64
veces 1.7, 38 veces 1.9…). **Arreglo**: 1.8 siempre; si algún icono de 14 px
o menos se ve flojo, 2.

### D2 · Tres velos distintos detrás de los modales

`bg-black/10` en `ui/dialog.tsx:34`, `/25` en `hoja.tsx:71` y en el menú del
móvil, `/30` en la ficha de miembro (`ficha.tsx:237`) y en asignar miembros.
**Arreglo**: `/25` en todos.

### D3 · `text-white` sobre relleno en vez del token

Sobre el naranja en `comentarios.tsx:215` y `calendario.tsx:116`; sobre el
carbón en `(auth)/layout.tsx`. No se ve mal hoy, pero es el tipo de color que
se quedó clavado al cambiar de paleta. **Arreglo**: `text-primary-foreground`
y `text-secondary-foreground`.

### D4 · Letras de 9,5 y 10,5 px

El contador de la barra lateral plegada (`sidebar.tsx:311`, 9,5 px) y las
iniciales de Inicio (`hoy/page.tsx:491`, 10,5). **Arreglo**: 11,5 como
mínimo; las iniciales, con `AvatarPersona` (A2).

### D5 · Barra de desplazamiento visible bajo las pestañas del ministerio

A 375 px, las pestañas se desplazan de lado (bien, `pestanas.tsx:82`) y se ve
la barra gris del navegador debajo. **Arreglo**: `[scrollbar-width:none]` y
`[&::-webkit-scrollbar]:hidden`.

### D6 · Barras de filtros con alturas y filas desparejas

`/panel/miembros`: buscador de 40 px junto a desplegables de 36.
`/panel/finanzas/movimientos` a 375 px: «Desde» solo en un renglón y «Hasta»
con «Fondo» en otro (`movimientos/page.tsx:69`, `flex-wrap`). **Arreglo**:
todo a 36 y `grid grid-cols-2` en el móvil.

### D7 · Marcadores de posición que parecen datos

«Lucía», «Ferrer Ramos», «300 123 4567» en Añadir miembro; «Iglesia
Cristiana Betania» y «Brandon Márquez» en el registro
(`(auth)/registro/page.tsx:45` y `:81`). En gris claro sobre el campo
tostado se leen como ya rellenos. **Arreglo**: «p. ej. …» o quitarlos donde
la etiqueta ya lo dice.

### D8 · Mensaje técnico en Suscripción

`/panel/suscripcion`: «Falta configurar los precios (esencial/mensual,
esencial/anual, …)» (`suscripcion/_components/planes.tsx:51`). Al pastor le
llegan claves internas. **Arreglo**: «Los planes todavía no están disponibles.
Escríbenos a hola@hatril.app» y el detalle al registro del servidor.

### D9 · «Apuntar la reunión» en la agenda de un ministerio

`/panel/ministerios/[id]/agenda/nueva` reutiliza `FormularioReunion`, que
cambia título y ejemplos pero no el botón
(`reuniones/_components/formulario.tsx:142`). **Arreglo**: añadir el botón a
`etiquetas` («Apuntarlo en la agenda»).

### D10 · Rótulos de sección de `/mi` escritos a mano

`text-[12px] font-semibold uppercase tracking-[0.08em]` en la agenda
(`mi/agenda/page.tsx:143` y `:172`), la ficha del turno y la Biblia, en vez
de `t-micro` (11,5 bold), que es el del panel. **Arreglo**: `t-micro`.

### D11 · Zonas táctiles de 20 px en el móvil

«Buscar mi iglesia» de la cabecera pública (21 px), los enlaces del pie
(Directorio, Privacidad, Términos: 20), «La he olvidado» en acceso (18), las
migas del panel (20) y los enlaces «Escuchar» y «Acordes» del turno en `/mi`
(20). **Arreglo**: `py-2` o `min-h-10` en los que se tocan con el dedo.

### D12 · Las pantallas de `/mi` sin `h1`

Comunidad, Agenda, Biblia, Mi cuenta y Avisos: el título va en
`CabeceraMiembro` como `span`. Un lector de pantalla no encuentra de qué va la
pantalla. **Arreglo**: que `CabeceraMiembro` pinte su título como `h1` cuando
la página no tiene otro.

### D13 · La web pública con escala y radios propios

`/i/[slug]` usa veinte tamaños de letra y `rounded-2xl` (16 px), que no está
entre los radios del sistema; las tres cabeceras públicas (portada,
directorio, legales) tienen cada una su lado derecho distinto. Es superficie
de cartel y se le permite su escala, pero no tres cabeceras. **Arreglo**: una
`CabeceraPublica` para portada, directorio y legales; los radios, en 12.

### D14 · `badge.tsx`, `select.tsx` y `dialog.tsx` de shadcn sin usar

Ninguno se importa, y `badge.tsx` y `select.tsx` traen `dark:` y sombras.
Son la plantilla que alguien copiará creyendo que es la del sistema.
**Arreglo**: `badge.tsx` se convierte en la `Insignia` de A3; `select.tsx` y
`dialog.tsx`, fuera.

### D15 · Rellenos y huecos distintos entre pantallas de `/mi`

Agenda, turno y Biblia: `gap-4 py-4 sm:py-6`. Avisos: `gap-2 py-5`.
Comunidad: `gap-3 sm:gap-4`. Mi cuenta: `gap-6 py-6`. El contenido arranca a
alturas distintas al cambiar de pestaña. **Arreglo**: el `main` de la guía en
las seis; Avisos puede quedarse con su `gap-2` entre avisos, dentro.

---

## Para la fase 2: qué toca cada rama abierta

Para no pisar a nadie, el orden propuesto: primero lo que es de un solo
fichero y transversal (M1 en `globals.css`, M2, A9, A16, D2), que no choca con
ninguna rama; después M3 y A1, que son mecánicos pero tocan casi todo, cuando
estén fusionadas todas; y al final las pantallas.

| Rama | Qué del inventario toca |
|---|---|
| `alabanza-pulido` | Turnos y su ficha: A3, A4, A7 (alturas del turno) |
| `app-lider` | `/mi/cuenta` y la zona del líder: A2, A15, D10, D15 |
| `consolidacion-nuevos` | Inicio y seguimiento: M6, A15, D4 |
| `arreglos-sueltos` | Registro y libro de caja: D7, A7 (movimientos), A11 |
| `radio-emisora` | `/mi` y la web pública: A8, D13 |
| `main` (reparto) | Pantallas nuevas: que sigan la guía desde el principio |
