# Hatril — Todas las pantallas — Brief de diseño

**Cómo usar este brief.** Son unas cien pantallas, y de golpe Claude Design las hace todas a medias. Se pega **«Lo común» y UN bloque** cada vez, en este orden:

1. Lo común (el sistema de componentes) — primero y solo.
2. Bloque 1 — Bienvenida y acceso.
3. Bloque 2 — La app del miembro.
4. Bloque 3 — La app del equipo (líderes).
5. Bloque 4 — Panel de la iglesia.
6. Bloque 5 — Panel: ministerios y sus herramientas.
7. Bloque 6 — Finanzas.
8. Bloque 7 — Lo público.
9. Bloque 8 — Super admin.
10. Bloque 9 — Correos.

Todo va en el proyecto de Claude Design de Hatril (107021c4-dd85-485d-9cc7-34ef639d92ae), que ya tiene el «Sistema de diseño» y las pantallas de acceso.

---

## LO COMÚN (va siempre delante de cada bloque)

### El producto

Hatril es un SaaS para iglesias, en Colombia y España, en español con tuteo. Cada congregación lleva desde un **panel web** su fichero de miembros, sus ministerios (alabanza, niños, acción social, radio…), su caja y su web pública. Sus miembros usan la **app del móvil** para el muro de la iglesia, el devocional del día, su agenda y sus turnos de servicio. Quien lleva un ministerio tiene sus herramientas en la app. La pertenencia religiosa es dato protegido: todo transmite cuidado y privacidad, sin alarmar.

### Identidad visual (no se cambia)

- **Colores**: fondo crema #FAF9F5 · tarjetas #FFFFFF · campos y tablas #F5F4ED · pulsado #F0EEE6 · bordes #E0DFDB (fuertes #87857E) · texto #141413 · secundario #67665F.
- **Naranja quemado #B15435** (hover #A14C30, pulsado #92442A) para LA acción de cada pantalla. Fondo suave #F5E7DF con texto #92442A para lo elegido o lo activo.
- **Carbón #3D3D3A**: botón secundario relleno.
- **Error #B53333**, siempre con icono. Aviso #875A08. Azul #2C84DB solo para distinguir categorías.
- **Dorado #C99418** con texto #141413: existe solo para el botón de la portada «Crea la de tu iglesia».
- **Insignias** (pastillas de 22 px): éxito #E6ECDE/#245C0E · aviso #F3E9D3/#734500 · marca #F5E7DF/#92442A · neutra #F0EEE6/#5E5D58 · peligro #F3E5E2/#8A2424.
- **Tipografía**: Plus Jakarta Sans y nada más. Escala: cifra 34 · título de app 24 · título de panel 20–22 · título de tarjeta 17 · texto 15 · dato y etiqueta 13 · rótulo de sección 11,5 en mayúsculas espaciadas.
- **Iconos**: Lucide, trazo 1.8.
- **Radios**: 8 controles, 12 tarjetas, redondo en pastillas y avatares. Dentro de una tarjeta nada lleva 12.
- **Sin sombras.** Profundidad con bordes de 1 px.
- **Sin degradados**, salvo uno: texto sobre foto (la portada del muro).
- **Un solo modo**, el claro.
- **Marca**: «Hatril», con la «t» convertida en un atril con la Biblia abierta. El panel no lleva la marca de Hatril: lleva el logo de cada iglesia.

### Reglas que valen para todas las pantallas

1. Un botón naranja por pantalla como mucho. En una lista, la acción de cada fila nunca es naranja.
2. Los errores llevan icono.
3. El naranja es para acciones: ni cifras, ni títulos, ni iconos de adorno.
4. Una tarjeta o fila que es enlace lleva texto negro, no naranja.
5. Los campos miden 16 px de letra en el móvil (si no, Safari amplía la página), y 42 px de alto en formularios; en barras de filtros, 36.
6. Se marca lo opcional («(opcional)»), no lo obligatorio.
7. Un estado vacío dice qué es esto, qué hacer y da el botón para hacerlo.
8. En el móvil una tabla no se apila columna a columna: se convierte en fila de lista (nombre arriba, una línea de datos debajo y la insignia a la derecha).

### Las piezas a diseñar en este primer paso

- Botones: naranja, carbón, contorno, fantasma, borrar (contorno rojo con icono). Tamaños 40 y 36, y de solo icono 40 y 34.
- Campo de texto, área de texto, desplegable, fecha, casilla, radio como fila entera elegible, interruptor, subir imagen (botón con icono, no el control nativo).
- Insignias, avatares (foto, o iniciales sobre un color propio de cada persona), rótulo de sección, tarjeta, lista en tarjeta con filas, fila-enlace con flecha, cifra con rótulo.
- Avisos: error y confirmación con icono; explicación fija de pantalla; zona de borrar roja al final.
- Segmentado (Día / Semana / Mes), pestañas de sección, paginación, buscador.
- Hoja que sube desde abajo (móvil) y diálogo (escritorio); menú «…»; popover.
- **Los tres marcos**:
  - **Panel** (escritorio): menú lateral de 264 px (plegable a 64 de iconos) con el logo de la iglesia arriba y bloques con encabezado («La congregación», «La vida de la iglesia», «Administración»), cabecera con título, subtítulo, «volver», acciones, campana y avatar. Contenido a 1600 px los listados y a 760 los formularios. En el móvil, el menú sale de un botón en la cabecera.
  - **App del miembro**: cabecera con el logo de la iglesia, título y nombre de la iglesia, campana y avatar. Columna de 620 px. Barra inferior fija con Comunidad, Devocional, Agenda, Biblia y (a quien sirve en un equipo) Equipo; pastilla centrada en escritorio, a todo el ancho en el móvil, con efecto cristal.
  - **Super admin**: como el panel, con la marca de Hatril arriba y «Administración».

### Lo que NO quiero

- Estética genérica de «app con IA»: degradados morados, manchas, estrellitas.
- Ilustraciones tipo undraw. Fotos de stock religiosas (manos rezando, cruces luminosas, rayos de luz).
- Más de una fuente. Iconos mezclados.
- Sombras, modo oscuro, degradados fuera de la portada del muro.
- Que parezca un ERP: es una herramienta para pastores y voluntarios, no para contables.

### Restricciones técnicas

Next.js 16 + Tailwind 4 + shadcn sobre Base UI. La app del móvil es la misma web dentro de Capacitor: todo es HTML, sin componentes nativos. Mobile first (375 px) y escritorio (1280 px). Animaciones solo con CSS.

---

## BLOQUE 1 — Bienvenida y acceso

1. **Splash**: crema con el atril.
2. **Presentación animada** (primera vez, 3 pantallas como mucho, «Saltar» siempre visible): la comunidad entre domingos; tu agenda y tus turnos; el devocional de cada día. El atril que se dibuja, fragmentos de la interfaz que entran escalonados. Solo CSS y SVG. Versión con «reducir movimiento».
3. **La pregunta**: «¿Ya eres de una iglesia o estás buscando una?», con dos tarjetas grandes. Abajo, «¿Ya tienes cuenta? Entra».
4. **Buscando iglesia**: explicación previa al permiso de ubicación, radio en pastillas (5/10/25/50 km), mapa cálido con pines y hoja inferior con la lista por distancia. **Estado vacío** muy cuidado («Todavía no hay iglesias de Hatril cerca de ti», ampliar el radio, «¿Tu iglesia no está? Invítala»). Sin permiso: buscar por ciudad.
5. **Ya soy de una**: buscador por nombre con logo y ciudad. Sin resultados: invitar o buscar cerca.
6. **Ficha previa de la iglesia**: logo o portada, nombre, denominación, dirección, horarios, una línea de quiénes son. Un botón: «Solicitar ser miembro» (siempre aprueba el pastor). Variantes: la iglesia no acepta solicitudes; ya eres de otra iglesia o tienes una solicitud pendiente (solo se puede ser de una).
7. **Crear la cuenta** (al solicitar, no antes): nombre completo, correo, teléfono con prefijo CO/ES, contraseña con la regla visible (8 o más, mayúscula, minúscula y número), dirección (opcional), foto (opcional), mensaje al pastor (opcional), casilla obligatoria de consentimiento del dato religioso y casilla opcional de asistencia.
8. **Solicitud enviada / en revisión**: «Tu solicitud está con el pastor de…», qué pasa ahora y cancelar.
9. **Entrar** (correo y contraseña, «La he olvidado»), **Recuperar la contraseña** y **Nueva contraseña**.
10. **Registrar una iglesia** (para pastores): nombre de la iglesia, nombre del pastor, país y ciudad, correo, contraseña, consentimiento. Empieza la prueba gratis.
11. **Aceptar la política nueva**: cuando cambia la política de privacidad, pantalla de re-consentimiento antes de entrar a nada.
12. **Suscripción bloqueada**: la prueba se acabó y también los tres días de solo lectura. Al pastor: elegir plan. A los demás: «Tu iglesia necesita renovar».

## BLOQUE 2 — La app del miembro

1. **Comunidad**, el muro: portada del día con foto (versículo, devocional y «¿Qué quieres compartir?» en una pieza, con el único degradado de la app), publicaciones a sangre en el móvil con hasta 4 fotos, me gusta, comentarios que se abren debajo con respuestas de un nivel, compositor en hoja. Menú «…»: borrar lo tuyo, moderar, y **Denunciar y Bloquear** (no existen y Apple los exige). Estados: muro vacío, no puedes publicar, comentarios apagados, fotos apagadas, comunidad apagada.
2. **Devocional**: el de hoy (título, versículo con su referencia, texto, imagen) y su versión en **vídeo**, como enlace que abre YouTube fuera, no reproductor dentro. Los anteriores.
3. **Agenda**: calendario con **Día / Semana / Mes**, los días con algo marcados y una hoja al tocar un día. Junta cultos semanales, eventos, ensayos y reuniones de sus equipos, y sus turnos.
4. **Un turno**: culto, hora, su puesto, quién más sirve y las canciones. «Ahí estaré» / «No puedo», y cambiar de idea.
5. **Una reunión del equipo** (ensayo): cuándo, dónde y la lista de canciones del domingo.
6. **Biblia**: índice de los 66 libros (Antiguo y Nuevo Testamento), buscador y lectura por capítulo con su navegación. Pensar la lectura larga: tamaño cómodo y versículos numerados.
7. **Avisos**: la lista de notificaciones (te asignaron un turno, aprobaron tu solicitud…), leídas y sin leer.
8. **Mi cuenta**: tus datos, tus equipos (con «Abrir herramientas» si lo llevas, «Ver tu equipo» si participas), cambiar la contraseña, **subir tu foto** (no existe), **dar o retirar el permiso de asistencia** (no existe), **borrar la cuenta** (no existe; Apple y Google lo exigen) y cerrar sesión.
9. **La radio**: si la iglesia tiene emisora, un reproductor que se queda abajo, encima de la barra, con lo que suena ahora.
10. **Sin conexión**: la pantalla de la app cuando no hay internet.

## BLOQUE 3 — La app del equipo (quien sirve o lleva un ministerio)

1. **Equipo**: con un solo equipo va directo a su portada; con varios, la lista en dos bloques, «Lo que llevas» y «Donde sirves», con lo pendiente de cada uno.
2. **Portada del equipo**, en dos modos:
   - **Quien lo lleva**: tarjetas por herramienta (turnos con huecos o «no puedo», el próximo ensayo, la lista del domingo urgente si falta a 3 días, quién se está perdiendo reuniones, cómo va el reparto de hoy) y el equipo debajo.
   - **Quien participa**: su próximo turno, el próximo ensayo, las canciones y el equipo. Nunca las respuestas de los demás.
3. **Turnos**: próximos (en tarjeta, con insignias de sin cubrir o sin contestar) y anteriores (en lista). **Planificar**: elegir en qué cultos de las próximas semanas sirve el equipo. **Cuadrante de un culto**: cada puesto con su persona, las respuestas y la lista de canciones.
4. **Agenda del equipo**: ensayos y reuniones; apuntar una nueva; **pasar lista** (casillas por persona, «Vinieron 2 de 3»); editar.
5. **Repertorio**: canciones con su tono y cuándo sonó cada una; añadir; ficha de canción.
6. **Seguimiento** (solo con permiso): quién más reuniones se ha perdido, botón de llamar o WhatsApp, y en la ficha apuntar que se le contactó.
7. **Fondo del ministerio**: lo que entra y sale de su fondo, solo lectura.

## BLOQUE 4 — Panel de la iglesia

1. **Inicio**: el nombre de la iglesia y su ciudad. Arriba, avisos accionables (solicitudes por contestar, turnos sin cubrir, la prueba que acaba). Debajo, cifras: personas con su desglose (visitantes, nuevos, miembros, inactivos) y altas del mes; sirviendo en un ministerio en proporción; la caja del mes. Diseñar también lo que falta: **asistencia** de los últimos cultos y **cumpleaños de la semana** (sin el año).
2. **Miembros**: lista con buscador, filtros (situación, ministerio) y paginación; la ficha se abre al lado sin salir de la lista. **Añadir a alguien** y **Editar la ficha** (quién es, contacto, en la iglesia, bautizado, ministerios, datos sensibles solo para quien tenga permiso). Baja.
3. **Solicitudes**: bandeja con quien pidió entrar, su mensaje y su teléfono; «Aprobar» en carbón y «Rechazar» con motivo. Al aprobar, ofrecer **enlazar con una ficha que ya existe** (coincidencias por correo o teléfono, ninguna marcada, con el aviso de que esos datos los escribe quien pide).
4. **Líderes**: quién entra en el panel y qué puede hacer; por persona, su rol (líder, tesorero, secretaría) y seis capacidades con interruptor; quitar y devolver el acceso.
5. **Reuniones**: los cultos y quién vino a cada uno; apuntar uno, editar, **pasar lista** a cientos de personas (buscador, marcar rápido).
6. **Eventos**: próximos y anteriores; **Nuevo evento** (se crea sin publicar); ficha con inscritos, aforo y descargar CSV; editar; borrar.
7. **Devocionales**: el calendario de quién escribe cada día (un día sin texto es un turno pendiente), y escribir o editar uno con versículo, texto, imagen y enlace de vídeo.
8. **Comunidad (sus reglas)**: encenderla, quién puede publicar (todos, el equipo, solo el pastor) como radios de fila entera, comentarios sí o no, fotos sí o no, y quién modera.
9. **Módulos**: «Activa lo que usa tu iglesia». Cada herramienta con qué hace y su interruptor.
10. **Ajustes**: datos de la iglesia, logo, la web pública (quiénes somos, horarios con el destacado, fotos del carrusel, cuenta de donativos, redes), salir en el directorio, aceptar solicitudes y dominio propio.
11. **Compartir**: los enlaces de la iglesia (su web, pedir entrar) con copiar y QR para imprimir.
12. **Tu cuenta** y **Cambiar la contraseña**.
13. **Suscripción**: en qué situación está (prueba, al día, canceló, solo lectura), los tres planes (Esencial, Comunidad, Plus) en mensual y anual, y gestionar el pago. El aviso fino que sale arriba en todo el panel cuando quedan 3 días.

## BLOQUE 5 — Panel: ministerios y sus herramientas

1. **Ministerios**: rejilla de tarjetas con su color, tipo, responsable y cuánta gente. **Crear un ministerio**.
2. **Ministerio**: cabecera con su color, misión, visión y objetivo; quién forma el equipo (responsable, colíderes, voluntarios con su función: «Vocalista», «Clase de 3 a 6 años»), asignar gente, cambiar papel, quitar; sus herramientas como pestañas. **Editar el ministerio** (el tipo y las herramientas solo el pastor).
3. **Turnos**: lista, **Planificar turnos** y el **cuadrante** de cada culto (puestos, personas, respuestas, canciones).
4. **Agenda del equipo**: lista, apuntar, ficha con pasar lista, editar.
5. **Repertorio**: canciones y cuándo sonó cada una, añadir, ficha.
6. **Seguimiento**: quién lleva tiempo sin aparecer y quién le acompaña; ficha con el historial de contactos. **Nuevos**: quién ha llegado en los últimos días y si se queda. **Apuntar a alguien nuevo**: alta rápida en la puerta (se crea como Visitante).
7. **Reparto** (banco de alimentos): **la puerta de hoy** (esperando, ha llegado, entregado, en grande y rápido, para usar de pie con el móvil), **padrón** de hogares por número, **ficha del hogar**, **historial** mes a mes e **informe** imprimible para el banco de alimentos.
8. **Radio**: la señal en directo, ¿está sonando?, y la **parrilla de programación** por días y horas.
9. **Fondo**: lo que entra y sale del fondo del ministerio.

## BLOQUE 6 — Finanzas

1. **Finanzas**: el mes en curso; lo que entró y salió; saldo por caja y por fondo; los últimos movimientos.
2. **Libro de movimientos**: lista filtrable por fecha, tipo, caja, fondo y concepto, con paginación y exportar. **Apuntar movimiento** (entra / sale como segmentado, no en negro), **ficha de un movimiento**.
3. **Arqueo del culto**: «Quien cuenta no es quien confirma». **Contar la ofrenda** (diezmos y ofrendas del culto) y la confirmación por una segunda persona, que es la que apunta los ingresos. Arqueos pendientes de confirmar.
4. **Informe del mes** («Entró»): imprimible o para guardar como PDF, para la junta.
5. **Fondos y cajas**: crear y vincular fondos a ministerios, cajas, conceptos.

## BLOQUE 7 — Lo público

1. **Portada de hatril.com**: para pastores que no conocen Hatril. Qué es, para quién, cómo se ve, precio, «Crea la de tu iglesia» (el botón dorado) y el directorio.
2. **Directorio de iglesias**: buscar por país y ciudad; tarjetas con logo, nombre, denominación, ciudad y «Pedir unirme».
3. **La web de cada iglesia**: carrusel de fotos, quiénes somos, horarios con el culto destacado («¿cuándo os reunís?» es la pregunta que trae a la gente), próximos eventos, el devocional del día, cómo llegar, donativos, redes y «Quiero ser parte» si acepta solicitudes. Tiene que poder parecer la web propia de la iglesia, con su logo.
4. **Un evento**: fecha, lugar, descripción, aforo e inscripción; **inscripción hecha**.
5. **Privacidad** y **Términos**: lectura larga, cómoda, con índice.
6. **No encontrado (404)** y **algo ha fallado (error)**: hoy salen las de Next, en negro y en inglés.

## BLOQUE 8 — Super admin (Rogotech)

1. **Inicio**: iglesias por situación, personas, cuentas y solicitudes; las que requieren atención; las últimas altas.
2. **Iglesias**: filtro por situación y buscador; **ficha** con sus cifras, con quién hablar, suscripción (ampliar la prueba), datos, directorio, suspender o reactivar, y lo que se ha hecho con ella.
3. **Cuentas**: a qué iglesia pertenece cada una y cuándo entró; **ficha** con poner una contraseña provisional y su historial.
4. **Registro**: lo que se ha hecho desde aquí, quién y cuándo. No se puede borrar.
Nunca muestra datos de miembros: solo recuentos.

## BLOQUE 9 — Correos (Resend)

Plantilla común: logo de Hatril o de la iglesia según quién escribe, crema y blanco, un solo botón naranja, texto corto, pie con por qué te llega.

1. **Bienvenida al pastor**: tu iglesia está creada, tu prueba acaba el…, tres primeros pasos.
2. **Nueva solicitud** (al pastor): alguien quiere unirse, «Revisar».
3. **Solicitud aceptada** (al miembro): ya eres de tu iglesia, «Abrir la app».
4. **Te toca un turno**: culto, puesto, «Ahí estaré» / «No puedo».
5. **Tu prueba acaba en 3 días** y **se acabó la prueba**.
6. **Pago fallido**.
7. **Recuperar la contraseña**.
