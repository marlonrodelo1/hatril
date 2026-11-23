# Hatril — La Comunidad (el muro de la iglesia) — Brief de diseño

Continúa en el proyecto de Claude Design de Hatril (107021c4-dd85-485d-9cc7-34ef639d92ae), con su «Sistema de diseño». Es un rediseño: la pantalla existe y funciona, y queremos ver cómo podría quedar mejor sin perder lo que ya se decidió.

## Contexto del producto

Hatril es la app de las iglesias (Colombia y España). La Comunidad es la primera pestaña que ve un miembro al abrir la app y la única que cambia cada día: el muro privado de SU congregación. Ahí la gente comparte fotos del domingo, peticiones de oración, avisos y lo que pasa entre semana. Lo ve solo la gente de esa iglesia: nada sale a la web ni a nadie de fuera.

La pantalla tiene que dar ganas de abrirla cada día y sentirse como la casa de la iglesia, no como otra red social.

## Identidad visual (ya existe: no cambiarla)

- Fondo crema #FAF9F5. Tarjetas blancas #FFFFFF. Superficie de campos #F5F4ED. Bordes de 1 px #E0DFDB.
- Naranja quemado #B15435 para LA acción de cada pantalla (pulsado #92442A). Su fondo suave, #F5E7DF, con texto #92442A encima.
- Carbón #3D3D3A para el botón secundario relleno y para la portada sin foto.
- Texto #141413, secundario #67665F. Error #B53333, siempre con icono.
- Tipografía: Plus Jakarta Sans y nada más.
- Iconos: Lucide, trazo 1.8.
- Radios: 8 px controles, 12 px tarjetas, redondo en pastillas y avatares.
- Sin sombras: profundidad con bordes de 1 px. Un solo modo, el claro.
- Sin degradados, con UNA excepción que ya existe y se mantiene: la portada del día, donde el texto va sobre una foto (ver abajo).
- Avatares: la foto de la persona si la tiene; si no, sus iniciales sobre un color propio, siempre el mismo para la misma persona.
- Tono: cálido, cercano y sereno.

## Lo que hay hoy (para mejorarlo, no para copiarlo)

De arriba abajo, en una columna de 620 px como mucho:

1. **Cabecera**: el logo de la iglesia, «Comunidad» y el nombre de la iglesia debajo; a la derecha, la campana de avisos y el avatar con el menú de la cuenta.
2. **La portada del día**: una sola pieza con foto de fondo (la del devocional de hoy). Dentro van el versículo del día, el devocional (título y comienzo, que lleva a leerlo entero) y, al pie, el disparador para publicar. Sin foto, el fondo es carbón liso con el texto en blanco.
3. **El muro**: publicaciones de la más nueva a la más antigua.
4. **Pie**: «Lo que se publica aquí no sale en la web de la iglesia ni lo ve nadie de fuera. Si subes una foto donde salen otras personas, pídeles permiso antes».
5. **Barra inferior** fija: Comunidad, Devocional, Agenda, Biblia y, a quien sirve en algún ministerio, Equipo. Pastilla centrada en escritorio, ancho completo en el móvil, efecto cristal.

## Pantallas y estados a diseñar (móvil primero, 375 × 812)

### A. El muro con contenido
- La portada del día y debajo cuatro o cinco publicaciones variadas: solo texto, texto largo (con «Ver más»), una foto, dos, tres, cuatro fotos (el máximo).
- Cada publicación: avatar, nombre, cuándo («hace 2 h», «ayer»), el texto y las fotos. Propuesta nueva, que hoy no está: una etiqueta discreta con su papel si lo tiene (Pastor, Líder de Alabanza). Debajo: me gusta con el número y comentarios con el número.
- En el móvil las publicaciones van a sangre: ocupan el ancho entero, sin borde a los lados, con la foto de lado a lado. En escritorio vuelven a ser tarjetas. Mantenerlo.
- La portada: mantener la idea (foto, versículo, devocional y publicar en una sola pieza) y proponer cómo hacerla más bonita. Sobre la foto se permite un velo degradado de transparente arriba a oscuro abajo, y una sombra suave en el texto blanco. Es la única excepción a «sin degradados» de toda la app. La foto tiene que reconocerse, no quedar emborronada.

### B. Publicar
- El disparador: avatar, «¿Qué quieres compartir?» y el icono de foto.
- Al tocarlo, una hoja que sube desde abajo con el campo de texto grande, añadir hasta 4 fotos con vista previa (y quitar cada una), el contador «2 de 4» y el botón «Publicar», que es el naranja de la pantalla.
- Estado enviando y error (foto demasiado grande: 5 MB por foto).

### C. Comentarios
- Se abren DEBAJO de su publicación, empujando el muro, no en una capa encima (se probó y se perdía el sitio). Un toque en el icono los abre y otro los cierra.
- Comentario: avatar pequeño, nombre, texto, cuándo, me gusta y «Responder».
- Respuestas de UN solo nivel, sangradas bajo su comentario. No se responde a una respuesta.
- Campo para escribir al final, con «Respondiendo a Lucía ×» cuando se responde a alguien.

### D. Acciones sobre una publicación o un comentario
- Menú «…» con lo que toque según quién mira:
  - Lo tuyo: Borrar.
  - Si eres pastor o moderador: Borrar cualquiera.
  - De otra persona: **Denunciar** y **Bloquear a esta persona**. Hoy NO existen y Apple los exige para publicar la app. Diseñarlos enteros: el motivo de la denuncia en una hoja corta, la confirmación de que la ha recibido el pastor, y qué significa bloquear (dejas de ver lo que publica; ella no se entera).
- Confirmación antes de borrar.

### E. Estados de la comunidad (los decide cada iglesia)
- **Muro vacío**, el primer día: no es un error. «Todavía no hay nada por aquí. Una foto del domingo o una petición de oración son buenas maneras de empezar.»
- **No puedes publicar**: la iglesia ha dejado publicar solo al equipo o solo al pastor. Una línea sobria que lo explica, sin el disparador de publicar. Se sigue pudiendo leer, dar me gusta y comentar.
- **Comentarios apagados**: se ven los que ya había, pero no se puede escribir.
- **Fotos apagadas**: el compositor sin el botón de foto.
- **Comunidad apagada**: «La comunidad está apagada ahora mismo», explicando que lo publicado sigue guardado. La portada del día (versículo y devocional) se sigue viendo: no es del muro, es de la iglesia.
- **Sin foto en la portada**: fondo carbón liso.

### F. Escritorio (1280 px)
- La misma columna centrada, con las publicaciones como tarjetas. Proponer si a los lados cabe algo útil (próximo culto, cumpleaños de la semana) o si es mejor dejarlo limpio.

## Restricciones técnicas

- Next.js 16 + Tailwind 4 + componentes shadcn sobre Base UI. Va dentro de una app nativa (Capacitor), pero todo es HTML.
- Casi todo se pinta en el servidor: el me gusta y el borrar son formularios. Nada de efectos que obliguen a una app entera en el navegador (scroll infinito con animaciones de entrada por tarjeta, por ejemplo).
- Campos a 16 px en el móvil. Un solo botón naranja por pantalla; en una lista, la acción de cada fila nunca es naranja.
- El me gusta se puede marcar en naranja (es una acción), pero las cifras no.
- Animaciones discretas y solo con CSS (el corazón al marcarlo, la hoja al subir).

## Lo que NO quiero

- Que parezca Facebook o Instagram con otros colores: es el muro de una iglesia, más tranquilo.
- Historias, reels, contadores de seguidores, «tendencias» o cualquier cosa que convierta esto en una competición.
- Estética genérica de «app con IA»: degradados morados, manchas, estrellitas.
- Ilustraciones tipo undraw, fotos de stock religiosas (manos rezando, rayos de luz).
- Más de una fuente o iconos mezclados (solo Lucide).
- Sombras en las tarjetas, modo oscuro, degradados fuera de la portada.
