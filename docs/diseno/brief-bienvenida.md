# Hatril — La bienvenida de la app — Brief de diseño

Continúa en el proyecto de Claude Design de Hatril (107021c4-dd85-485d-9cc7-34ef639d92ae), con su «Sistema de diseño» y las pantallas de acceso ya hechas. Lo de este brief tiene que parecer de la misma familia.

## Contexto del producto

Hatril es la app de las iglesias: cada congregación lleva su fichero, sus ministerios y su comunidad, y sus miembros la usan desde el móvil para ver el muro de la iglesia, el devocional del día, su agenda y sus turnos de servicio. Mercado: Colombia y España, en español con tuteo.

Este brief es lo PRIMERO que ve una persona que descarga la app: una presentación que enamore y, justo después, el camino para encontrar su iglesia (o una cerca) y pedir entrar en ella. Hoy esa persona aterriza en una pantalla de «Entra en tu iglesia» con correo y contraseña, y si no tiene cuenta no sabe qué hacer.

## Identidad visual (ya existe: no cambiarla)

- Fondo crema #FAF9F5. Tarjetas blancas #FFFFFF. Superficie de campos #F5F4ED. Bordes de 1 px #E0DFDB.
- Naranja quemado #B15435 para LA acción de cada pantalla (pulsado #92442A). Su fondo suave, #F5E7DF, con texto #92442A encima.
- Carbón #3D3D3A para el botón secundario relleno.
- Texto #141413, secundario #67665F.
- Error #B53333, siempre con icono, nunca solo color.
- Tipografía: Plus Jakarta Sans y nada más. Títulos con tracking negativo ligero.
- Iconos: Lucide, trazo 1.8.
- Radios: 8 px controles, 12 px tarjetas, redondo en pastillas y avatares.
- Sin sombras: la profundidad se hace con bordes de 1 px. Sin degradados.
- Un solo modo, el claro. No hay modo oscuro.
- La marca: la palabra «Hatril» donde la «t» es un atril con la Biblia abierta (pupitre inclinado, libro abierto, asta como columna). El símbolo suelto, el atril, es el icono de la app.
- Tono: cálido, cercano y sereno. Una casa, no una startup. Referencias de sensación: Claude.ai (crema y calma), Airbnb (cercanía), Headspace (animación amable sin ruido).

## Pantallas a diseñar (móvil primero, 375 × 812, con zonas seguras de notch y barra inferior)

### A. Splash (ya existe, dibujarlo para dar continuidad)
- Crema con el atril en el centro. Dura 2,5 s. La presentación tiene que arrancar desde aquí como si el atril «cobrara vida», sin corte.

### B. Presentación animada (3 pantallas como mucho)
- Solo la primera vez que se abre la app. Botón «Saltar» siempre visible arriba a la derecha. Indicador de página.
- Tres mensajes, uno por pantalla (proponer el texto final; estos son la idea):
  1. Tu iglesia, contigo toda la semana: el muro de la comunidad, lo que se comparte entre domingos.
  2. Lo que te toca, a tiempo: tu agenda, tus turnos de servicio y el ensayo del jueves, sin grupos de WhatsApp.
  3. Una palabra cada día: el devocional de tu iglesia, escrito por los tuyos.
- Animación con personalidad pero ligera: el atril se dibuja trazo a trazo, los elementos entran escalonados, fragmentos de la propia interfaz (una tarjeta del muro, un turno, el devocional) aparecen y se colocan. Transiciones de 300–500 ms. Sin vídeo, sin Lottie pesado: tiene que poder hacerse con CSS y SVG.
- Indicar cómo queda con «reducir movimiento» activado: mismo contenido, sin desplazamientos.
- Última pantalla con el botón naranja «Empezar».

### C. La pregunta
- «¿Ya eres de una iglesia o estás buscando una?»
- Dos opciones grandes, en tarjeta, con icono y una línea de explicación: «Ya soy de una iglesia» y «Estoy buscando iglesia».
- Abajo, discreto: «¿Ya tienes cuenta? Entra».

### D. Estoy buscando iglesia
1. Antes del permiso de ubicación: una pantalla que explica por qué la pedimos («para enseñarte las iglesias cerca de ti; no la guardamos») con «Usar mi ubicación» y la alternativa «Buscar por ciudad».
2. Selector de radio en pastillas: 5, 10, 25 y 50 km.
3. Mapa con pines de las iglesias, en un estilo de mapa cálido y desaturado que combine con el crema (el pin con el atril o en naranja quemado). Una hoja inferior que se arrastra con la lista ordenada por distancia: logo, nombre, denominación, barrio o ciudad, distancia y el próximo culto.
4. Tocar un pin abre su tarjeta resumida, que lleva a la ficha (pantalla F).
5. **Estado vacío, muy importante**: hoy hay muy pocas iglesias y casi siempre saldrá vacío. No puede parecer un error: «Todavía no hay iglesias de Hatril cerca de ti» con dos salidas, ampliar el radio y «¿Tu iglesia no está? Invítala» (compartir un enlace).
6. Ubicación denegada: se queda en «Buscar por ciudad», sin reñir.

### E. Ya soy de una iglesia
- Buscador por nombre con resultados al escribir: logo, nombre y ciudad, para distinguir las que se llaman igual («Iglesia Betania» hay muchas).
- Sin resultados: «No encontramos “…”» con «Invita a tu iglesia» y «Buscar cerca de mí».

### F. Ficha de la iglesia (antes de pedir entrar)
- Logo o portada, nombre, denominación, dirección, horarios de culto (el principal destacado) y una línea de quiénes son.
- Un solo botón naranja: «Solicitar ser miembro». **Siempre aprueba el pastor**: no hay entrada directa, y el diseño no debe sugerirla.
- Variante: la iglesia no acepta solicitudes desde la app → «Esta iglesia gestiona las altas en persona» y su contacto.
- Variante: la persona ya es de otra iglesia, o tiene una solicitud pendiente → explicar que solo se puede ser de UNA iglesia y que para cambiar primero tiene que salir de la suya. Sin botón de solicitar.

### G. Crear la cuenta (aparece al pulsar «Solicitar ser miembro», no antes)
- Campos, en este orden: nombre completo, correo, teléfono (obligatorio, con prefijo de país CO/ES), contraseña (8 o más, con mayúscula, minúscula y número, con la regla visible antes de escribir), dirección (opcional), foto de perfil (opcional, con «Ahora no»).
- Mensaje a la iglesia (opcional): «Cuéntale al pastor quién eres».
- Consentimiento obligatorio, en una casilla, para tratar el dato de pertenencia a la iglesia (texto legal corto con enlace a la política). Una segunda casilla, opcional, para que la iglesia registre su asistencia.
- Lo obligatorio no se marca con asterisco: se marca lo opcional, con «(opcional)».
- Botón «Enviar solicitud». Arriba, recordatorio de a qué iglesia se está pidiendo entrar.
- Variante: ya tiene cuenta → entra con correo y contraseña, y vuelve aquí con la solicitud lista.

### H. Solicitud enviada
- Confirmación cálida: «Tu solicitud está con el pastor de Iglesia Betania». Qué pasa ahora (te avisaremos cuando te acepte), qué puede hacer mientras (ver la web de la iglesia) y cómo cancelar la solicitud.
- La misma pantalla es la que verá al abrir la app mientras espera.

## Restricciones técnicas

- Es una app web (Next.js 16 + Tailwind 4 + componentes shadcn sobre Base UI) dentro de una app nativa de Capacitor. Nada de componentes nativos de iOS o Android: todo es HTML.
- Mobile first a 375 px; que también se vea bien a 768 px (tablet) y en la web.
- Campos de formulario a 16 px en el móvil (si no, Safari amplía la página).
- Un solo botón naranja por pantalla. Los secundarios, de contorno o carbón.
- Animaciones solo con CSS y SVG, sin librerías pesadas, y respetando «reducir movimiento».
- El mapa se hará con MapLibre o Leaflet y teselas tipo OpenStreetMap: proponer el estilo de colores del mapa.
- Textos en español neutro con tuteo, que valgan para Colombia y España.

## Lo que NO quiero

- Estética genérica de «app con IA»: degradados morados, manchas de color, estrellitas, brillos.
- Ilustraciones tipo undraw o personajes planos genéricos.
- Fotos de stock de manos rezando, cruces luminosas o cielos con rayos de luz.
- Más de una fuente.
- Iconos mezclados (solo Lucide).
- Sombras, degradados, modo oscuro.
- Pedir la cuenta antes de dejar mirar.
- Un mapa vacío que parezca roto.
