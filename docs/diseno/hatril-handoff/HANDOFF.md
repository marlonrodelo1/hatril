# Hatril — Traspaso de diseño a desarrollo

Este paquete recoge el diseño de la app móvil de Hatril: bienvenida, Comunidad, el resto de pestañas y Equipo. Sirve como referencia para construir la app en el repositorio actual (Next.js 16 + Tailwind 4 + shadcn sobre Base UI, dentro de Capacitor).

- **Lienzo con todas las pantallas (fuente de verdad visual):** https://claude.ai/artifact/TWzP7UDNG7LiHYBA97TGbW (es privado: compártelo desde el lienzo para que lo vean otros)
- **`pantallas/`**: el HTML de cada pantalla (`*.dc.html`). No se abre solo en el navegador (necesita el motor del lienzo), pero se lee bien como referencia exacta de estructura, textos, medidas y colores.
- **`pantallas/canvas.json`**: índice de pantallas con su título y su página.

---

## 0. Cómo usarlo con Claude Code

1. Copia la carpeta `hatril-handoff` a `docs/diseno/` dentro del repositorio.
2. Abre Claude Code en el repositorio y pega:

> Lee `docs/diseno/HANDOFF.md` entero. Después revisa cómo está montado el proyecto (rutas, componentes de `components/ui`, estilos globales) y propónme un plan para la **fase 1**, indicando qué archivos vas a tocar. No escribas código hasta que te diga que sí. Usa los `.dc.html` de `docs/diseno/pantallas/` como referencia visual exacta, pero constrúyelo con nuestros componentes, no copiando ese HTML.

3. Una fase cada vez. Revisa cada fase en el móvil antes de pasar a la siguiente.

---

## 1. Fundamentos visuales (tokens)

Pegar en el CSS global (Tailwind 4). Si ya existen con otro nombre, mapear en vez de duplicar.

```css
@theme {
  --color-crema: #FAF9F5;        /* fondo de la app */
  --color-tarjeta: #FFFFFF;
  --color-campo: #F5F4ED;        /* fondo de inputs */
  --color-pulsado: #F0EEE6;
  --color-borde: #E0DFDB;
  --color-texto: #141413;
  --color-texto-2: #67665F;      /* secundario */
  --color-marca: #B15435;        /* naranja: LA acción de la pantalla */
  --color-marca-pulsado: #92442A;
  --color-marca-suave: #F5E7DF;  /* fondo de lo elegido; texto encima #92442A */
  --color-carbon: #3D3D3A;       /* botón secundario relleno */
  --color-error: #B53333;

  /* Insignias (fondo / texto) */
  --color-ok-bg: #E6ECDE;     --color-ok: #245C0E;
  --color-aviso-bg: #F3E9D3;  --color-aviso: #734500;
  --color-neutra-bg: #F0EEE6; --color-neutra: #5E5D58;
  --color-peligro-bg: #F3E5E2; --color-peligro: #8A2424;

  --radius-control: 8px;
  --radius-tarjeta: 12px;
  --radius-hoja: 16px;          /* solo esquinas de arriba de las hojas inferiores */
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
}
```

- **Tipografía:** Plus Jakarta Sans y nada más (400, 500, 600, 700, 800). Títulos en 800 con `letter-spacing: -0.025em`.
- **Iconos:** Lucide, trazo 1.8.
- **Sin sombras**: la profundidad se da con bordes de 1 px. **Sin degradados**, con una única excepción: el velo de la foto de la portada del día (ver 3.2). **Solo modo claro.**
- **Avatares:** la foto, o las iniciales sobre un color fijo para cada persona (elegido a partir de su id). Paleta de fondo/texto: `#F5E7DF/#92442A`, `#E6ECDE/#245C0E`, `#F3E9D3/#734500`, `#E3E8EC/#2F4A5C`, `#ECE3EE/#5B3A66`, `#E7E4DB/#3D3D3A`.
- **Zonas seguras:** respetar `env(safe-area-inset-top/bottom)`; en los diseños hay 47 px arriba y 34 px abajo.

## 2. Reglas de interfaz (obligatorias)

1. **Un solo botón naranja por pantalla, como mucho.** En una lista, la acción de cada fila nunca es naranja.
2. Secundario: contorno (blanco con borde) o carbón relleno.
3. Las acciones destructivas (borrar) van en rojo `#B53333`, siempre con icono. «Bloquear» va en carbón.
4. Una fila o tarjeta que es enlace lleva texto negro y una flecha (chevron) al final.
5. Campos a **16 px** en el móvil (si no, Safari amplía la página). Altura de 48 px.
6. Se marca lo **opcional** con «(opcional)». Lo obligatorio no lleva asterisco.
7. Errores: texto `#B53333` **con icono**, nunca solo color.
8. Estado vacío = qué es esto + qué hacer + el botón para hacerlo.
9. En el móvil, las tablas se convierten en listas: nombre arriba, una línea de datos debajo y la insignia a la derecha.
10. Columna de 620 px como mucho en escritorio.
11. Zonas táctiles de 44 px o más.
12. Animaciones solo con CSS (300–500 ms) y siempre con `@media (prefers-reduced-motion: reduce)`, donde todo aparece ya en su sitio.
13. Textos en español neutro con tuteo, válidos para Colombia y España: **nada de «vosotros» ni de «ustedes» forzado** en la interfaz. El contenido que escriben los usuarios es libre.

## 3. Componentes

| Componente | Base | Notas |
|---|---|---|
| Botón | shadcn `Button` | Variantes: `marca` (naranja), `carbon`, `contorno`, `texto`, `peligro`. Altura 48–52 px |
| Cabecera de pestaña | propio | Logo de la iglesia (36 px), título, nombre de la iglesia debajo; campana con número; avatar que abre el menú de cuenta |
| Barra inferior | propio | Cristal: `rgba(250,249,245,.86)` + `backdrop-filter: blur(14px)` + borde superior. 4 o 5 pestañas (Equipo solo para quien sirve). Etiquetas siempre visibles; la activa con fondo `marca-suave`. En escritorio, pastilla centrada |
| Reproductor de radio | propio | Barra fina encima de la barra inferior, solo si la iglesia tiene emisora |
| Hoja inferior | Base UI `Dialog` como sheet | Esquinas superiores de 16 px, asa, fondo `rgba(20,20,19,.42)` detrás. Entrada: sube 40 px en 300 ms |
| Segmentado | Base UI `ToggleGroup` | Pastilla con fondo `#F0EEE6`; el elegido en blanco con borde |
| Insignia | shadcn `Badge` | 5 tonos de la sección 1 |
| Pastillas de filtro | `ToggleGroup` | La elegida en carbón con texto blanco (no naranja) |
| Interruptor | Base UI `Switch` | Activo en carbón |
| Publicación del muro | propio | En el móvil a sangre (sin bordes laterales); en escritorio, tarjeta |

### 3.1 Me gusta
Corazón en naranja relleno al marcarlo, con un latido de 320 ms (escala 1 → 1,28 → 1). El número sigue gris. Es un formulario (renderizado en el servidor); el estado optimista es opcional.

### 3.2 Portada del día (Comunidad)
Una sola tarjeta con dos partes:
- **Arriba, la foto** (300 px de alto): la fecha en una pastilla blanca y, abajo, el versículo en blanco sobre un velo `linear-gradient(180deg, rgba(20,20,19,0) 0%, rgba(20,20,19,.55) 55%, rgba(20,20,19,.78) 100%)` que cubre solo el 62 % inferior, más `text-shadow: 0 1px 12px rgba(0,0,0,.35)`. Es el único degradado de la app.
- **Abajo, una franja blanca**: el devocional de hoy (enlace) y el disparador «¿Qué quieres compartir?».
- Sin foto: fondo carbón liso con el texto en blanco.

## 4. Pantallas

Rutas propuestas; si el proyecto ya tiene otras, mandan las existentes.

### Página «Bienvenida» (lienzo)
| Archivo | Ruta | Qué es |
|---|---|---|
| Main | `/` (splash nativo) | Atril centrado, 2,5 s |
| Intro1–3 | `/bienvenida` | Presentación de 3 pasos, solo la primera vez. «Saltar» siempre visible |
| Movimiento | — | Tiempos de animación y la versión con «reducir movimiento» |
| Pregunta | `/empezar` | «¿Ya eres de una iglesia o estás buscando una?» |
| Ubicacion | `/buscar/cerca` | Explicación antes de pedir la ubicación |
| Mapa, MapaPin, MapaVacio | `/buscar/mapa` | Mapa + hoja con la lista; radio 5/10/25/50 km; estado vacío con «Invítala» |
| Ciudad | `/buscar/ciudad` | Sin ubicación: buscar por ciudad |
| EstiloMapa | — | Colores de las capas para MapLibre |
| Buscar, BuscarVacio | `/buscar` | Por nombre, con la ciudad para distinguir iglesias que se llaman igual |
| Ficha, FichaEnPersona, FichaOtraIglesia | `/iglesia/[slug]` | Ficha pública y sus variantes |
| Cuenta, CuentaEntrar | `/iglesia/[slug]/unirse` | Crear cuenta (o entrar) al pedir ser miembro |
| Enviada | `/solicitud` | Solicitud con el pastor; también es lo que se ve al abrir la app mientras se espera |
| Tour1–6 | `/iglesia/[slug]/recorrido/[paso]` | Recorrido por la iglesia mientras espera (solo información pública) |

### Página «Comunidad»
| Archivo | Qué es |
|---|---|
| ComMuro | Muro completo: portada del día y publicaciones con 0–4 fotos |
| ComSinFoto | Portada sin foto (carbón) |
| ComPublicar, ComEnviando, ComErrorFoto | Hoja de publicar, publicando y foto de más de 5 MB. Si la iglesia apaga las fotos, desaparece el botón de foto |
| ComComentarios, ComComentariosOff | Comentarios abiertos **debajo** de la publicación; respuestas de un solo nivel |
| ComMenu | Menú «…» según quién mira: tuya / otra persona / pastor o moderador |
| ComDenunciar, ComDenunciaOk, ComBloquear, ComBorrar | Denunciar, bloquear y borrar |
| ComVacio, ComNoPublicar, ComApagada | Estados que decide cada iglesia |
| ComEscritorio | 1280 px: columna de 620 px más una columna lateral con el próximo culto |

### Página «App»
| Archivo | Ruta | Qué es |
|---|---|---|
| AppBarras | — | Cabecera, barra de 4 y 5 pestañas, radio |
| AppMenu | — | Menú del avatar («Ir al panel» solo para quien lleva algo) |
| AppRadio | — | Programación de hoy |
| DevHoy, DevVacio | `/devocional` | De hoy (vídeo: abre YouTube fuera), anteriores y vacío |
| AgSemana, AgMes, AgDia | `/agenda` | Semana por defecto; Mes con puntos y hoja del día; Día |
| AgTurno | `/agenda/turno/[id]` | Turno: Ahí estaré / No puedo; 3 estados |
| AgEnsayo | `/agenda/[id]` | Ensayo o reunión de tu equipo |
| BibIndice, BibCapitulo, BibCapitulos, BibCompartir | `/biblia/...` | Índice AT/NT, lectura, elegir capítulo, compartir versículo |
| AvLista, AvVacio | `/avisos` | Avisos, sin leer resaltados |
| CtaMiCuenta, CtaEditar, CtaPassword, CtaFoto, CtaBloqueados, CtaBorrar | `/cuenta/...` | Mi cuenta y sus subpantallas |
| PEntrar, PRecuperar, PNueva, PPolitica, PSinAcceso, PSinConexion | `/entrar`, etc. | Pantallas de paso |
| EqLista | `/equipo` | Con un solo equipo, ir directo a su portada |
| EqParticipa, EqLleva | `/equipo/[id]` | Portada según el rol |
| EqTurnos, EqPlanificar, EqCuadrante, EqAsignar | `/equipo/[id]/turnos/...` | Turnos (solo quien lleva el equipo) |
| EqAgenda, EqNuevaReunion, EqPasarLista | `/equipo/[id]/agenda/...` | Agenda del equipo y pasar lista |
| EqRepertorio, EqCancion, EqNuevaCancion | `/equipo/[id]/repertorio/...` | Canciones |
| EqSeguimiento, EqPersona | `/equipo/[id]/seguimiento/...` | Solo con permiso del pastor |
| EqPersonas | `/equipo/[id]/personas` | Todo el equipo; teléfonos solo para quien lo lleva |
| EqFondo | `/equipo/[id]/fondo` | Solo lectura |
| EqReparto | `/equipo/[id]/reparto` | Acción social: familias atendidas hoy |

## 5. Decisiones de producto tomadas

**Bienvenida**
- No se pide la cuenta hasta pulsar «Solicitar ser miembro». **Siempre aprueba el pastor**: nada sugiere entrada directa.
- Se es de **una sola iglesia**: con otra iglesia o una solicitud pendiente, no se puede solicitar.
- Consentimiento obligatorio para tratar la pertenencia a la iglesia (dato de categoría especial en el RGPD) y otro opcional para registrar la asistencia.
- Mapa vacío: el botón naranja es «¿Tu iglesia no está? Invítala»; ampliar el radio va de contorno. El círculo del radio se dibuja siempre.
- El recorrido por la iglesia empieza al enviar la solicitud y **solo enseña información pública**. El muro, las personas y los grupos se ven cuando el pastor acepta.

**Comunidad**
- Al **denunciar**, la publicación se oculta para quien denuncia; el resto la sigue viendo hasta que decide el pastor. La denuncia solo la ve el pastor y es anónima para el autor.
- **Bloquear**: dejas de ver lo que publica y comenta; esa persona no se entera. No afecta a equipos ni turnos. Se deshace desde Mi cuenta › Personas bloqueadas.
- Confirmación antes de borrar.
- Escritorio: solo el próximo culto en la columna lateral (los cumpleaños se descartaron por privacidad).

**App**
- Agenda: se abre en **Semana**, con la tarjeta «Te toca» arriba. Cuatro tipos con color e icono: tus turnos (naranja), tu equipo (verde), eventos (ámbar) y cultos (gris).
- Biblia: **Reina-Valera 1909** (dominio público). La RVR 1960 y la NVI necesitan licencia: más adelante.
- Compartir un versículo: como texto con la cita o como imagen cuadrada en crema con el nombre de la iglesia.
- **Borrar la cuenta**: se desactiva al momento y se borra a los 30 días. Si vuelve a entrar antes, la recupera. Se pide la contraseña para confirmar. Los turnos de esa persona quedan sin cubrir y se avisa a quien lleva sus equipos.
- «Tu iglesia no tiene acceso»: al miembro no se le habla de pagos.
- Contraseña: 8 caracteres o más, con mayúscula, minúscula y número. La regla se ve antes de escribir. Al cambiarla, se cierra la sesión en los otros dispositivos.

**Equipo**
- Portada de quien lo lleva: arriba, «Esto pide tu atención»; debajo, una tarjeta por herramienta; al final, el equipo.
- Quien participa nunca ve las respuestas de los demás.
- Al **poner a alguien** en un puesto: primero quien menos ha servido en el último mes, con aviso si ese día ya sirve en otro equipo o si dijo «no puedo» hace poco.
- **Pasar lista**: nadie marcado al empezar; se toca a quien ha venido.
- **Seguimiento**: aparece quien falta a 3 ensayos seguidos o más. Solo con permiso del pastor. Nadie del equipo sabe quién está en la lista. WhatsApp se abre con un mensaje propuesto que se puede editar (`https://wa.me/<tel>?text=...`).
- Teléfonos en «Todo el equipo»: solo para responsable y colíder.
- Fondo: solo lectura; los gastos nuevos se piden a Tesorería desde el panel.
- Reparto (Acción social): contador de familias atendidas y lista que se marca de un toque.

## 6. Fases de trabajo recomendadas

1. **Lo que exige Apple y Google** (bloquea la publicación en tiendas): denunciar, bloquear, personas bloqueadas, borrar la cuenta.
2. **Fundamentos**: tokens, botón, insignias, hoja inferior, cabecera, barra inferior de 4 y 5 pestañas.
3. **Comunidad**: portada del día, muro, publicar, comentarios, estados.
4. **Bienvenida**: presentación, buscar iglesia (mapa con MapLibre), ficha, crear cuenta, solicitud y recorrido.
5. **Agenda y turnos**, **Devocional** y **Avisos**.
6. **Mi cuenta** y pantallas de paso.
7. **Biblia** (cargar el texto de la RVR 1909).
8. **Equipo**: portadas, turnos y cuadrante, agenda y pasar lista, repertorio, seguimiento, fondo y reparto.
9. **Radio**, solo si alguna iglesia la usa ya.

## 7. Pendiente antes de dar el diseño por cerrado

- **Logo y atril oficiales**: los de los diseños son un redibujo provisional. Hay que sustituirlos por los del sistema de diseño de Hatril.
- **Fotos**: en los diseños son ilustraciones de relleno.
- **Versiones tablet (768 px) y web** del resto de pantallas: se harán cuando se apruebe el móvil.
- Los textos de la política de privacidad y del consentimiento debe revisarlos un abogado.
