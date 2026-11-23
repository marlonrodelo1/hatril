# Hatril — La app del móvil (el resto de pantallas) — Brief de diseño

Continúa en el proyecto de Claude Design de Hatril (107021c4-dd85-485d-9cc7-34ef639d92ae). La **bienvenida** y la **Comunidad** ya tienen su propio brief: aquí va todo lo demás que se ve en la app del móvil. Tiene que ser de la misma familia que esas dos.

## Contexto del producto

Hatril es la app de las iglesias (Colombia y España, español con tuteo). En el móvil la usan los miembros de una congregación para el muro, el devocional del día, su agenda y la Biblia. Y quien sirve en un ministerio (alabanza, niños, acción social, radio…) tiene además la pestaña **Equipo**: si solo participa, ve lo suyo; si lo lleva (responsable o colíder), tiene ahí sus herramientas, sin tener que ir al panel web.

## Identidad visual (ya existe: no cambiarla)

- Fondo crema #FAF9F5 · tarjetas #FFFFFF · campos #F5F4ED · pulsado #F0EEE6 · bordes de 1 px #E0DFDB · texto #141413 · secundario #67665F.
- Naranja quemado #B15435 (pulsado #92442A) para LA acción de cada pantalla. Fondo suave #F5E7DF con texto #92442A para lo elegido.
- Carbón #3D3D3A: botón secundario relleno. Error #B53333, siempre con icono.
- Insignias en pastilla: éxito #E6ECDE/#245C0E · aviso #F3E9D3/#734500 · marca #F5E7DF/#92442A · neutra #F0EEE6/#5E5D58 · peligro #F3E5E2/#8A2424.
- Plus Jakarta Sans y nada más. Lucide con trazo 1.8. Radios 8 / 12 / redondo.
- Sin sombras, sin degradados, solo modo claro.
- Avatares: foto, o iniciales sobre un color propio de cada persona.

## Reglas

- Un botón naranja por pantalla como mucho. En una lista, la acción de cada fila nunca es naranja.
- Una fila o tarjeta que es enlace lleva texto negro con flecha al final.
- Campos a 16 px en el móvil. Se marca lo opcional, no lo obligatorio.
- Estado vacío: qué es esto, qué hacer y el botón para hacerlo.
- Columna de 620 px como mucho; móvil primero (375 × 812) con zonas seguras de notch y barra.
- Las tablas en el móvil son listas: nombre arriba, una línea de datos debajo y la insignia a la derecha.

## Pantallas a diseñar

### A. El marco de la app
- **Cabecera**: el logo de la iglesia, el título de la pestaña y el nombre de la iglesia debajo; a la derecha la campana (con número sin leer) y el avatar.
- **Menú del avatar**: nombre, correo, rol; «Tus datos», «Cambiar la contraseña», «Ir al panel» (solo a quien lleva algo) y «Cerrar sesión».
- **Barra inferior** fija: Comunidad, Devocional, Agenda, Biblia y, a quien sirve en un equipo, Equipo. Nombres siempre visibles, la activa en el fondo suave naranja. Efecto cristal. Diseñarla con 4 y con 5 pestañas.
- **Reproductor de la radio**: si la iglesia tiene emisora, una barra fina encima de la barra inferior con play/pausa, el programa que suena ahora y «En directo». Al tocarla, la programación del día.

### B. Devocional
- El de hoy: imagen, título, el versículo con su referencia en grande, el texto largo cómodo de leer y quién lo escribió.
- Si tiene vídeo: un botón «Verlo en vídeo» que abre YouTube fuera de la app (no un reproductor dentro).
- Los de los días anteriores, en lista.
- Vacío: la iglesia no ha publicado el de hoy.

### C. Agenda
- Calendario con segmentado **Día / Semana / Mes**. En el mes, los días con algo llevan un punto; al tocar uno sube una hoja con lo de ese día.
- Junta cuatro cosas, distinguibles de un vistazo: los cultos semanales, los eventos de la iglesia, los ensayos y reuniones de tus equipos, y **tus turnos** (que pesan más: te toca a ti).
- **Un turno**: culto, día y hora, tu puesto, quién más sirve contigo y las canciones. Dos botones: «Ahí estaré» (carbón) y «No puedo», y cómo se cambia de idea. Estados: sin contestar, confirmado, no puedo.
- **Una reunión de tu equipo** (un ensayo): cuándo, dónde y la lista de canciones del domingo, con su tono.

### D. Biblia
- Índice de los 66 libros, separados en Antiguo y Nuevo Testamento, con buscador.
- Lectura de un capítulo: versículos numerados, letra cómoda para leer un rato, pasar al capítulo anterior y siguiente, y elegir otro capítulo sin volver al índice.
- Pensar cómo se vería compartir o copiar un versículo.

### E. Avisos
- Lista de notificaciones con su icono y cuándo: te asignaron un turno, alguien no puede ir, aprobaron tu solicitud, nuevo devocional… Sin leer resaltadas, «Marcar todo como leído».
- Vacío: «No tienes avisos».

### F. Mi cuenta
- Tus datos (nombre, correo, teléfono) y editarlos.
- Tus equipos, cada uno con «Abrir herramientas» si lo llevas o «Ver tu equipo» si participas.
- **Tu foto de perfil**: subirla, cambiarla, quitarla. No existe todavía.
- **El permiso de asistencia**: darlo o retirarlo cuando quieras, explicado en una frase. No existe todavía.
- Cambiar la contraseña.
- **Borrar mi cuenta**, al final, en su zona roja, con lo que pasa y la confirmación. No existe y Apple y Google lo exigen.
- Cerrar sesión.

### G. Equipo (quien sirve en algún ministerio)
1. **La lista**: con un solo equipo va directo a su portada. Con varios, dos bloques: «Lo que llevas» y «Donde sirves», cada equipo con su color y lo que tiene pendiente.
2. **La portada del equipo**, en dos modos:
   - **Quien participa**: su próximo turno, el próximo ensayo, las canciones del domingo y quién forma el equipo (con quién es responsable y colíder). Nunca las respuestas de los demás.
   - **Quien lo lleva**: una tarjeta por herramienta con lo que pide atención (turnos con huecos, «no puedo» o sin contestar; la lista del domingo urgente si falta a 3 días; quién se está perdiendo reuniones; cómo va el reparto de hoy) y el equipo debajo.
3. **Turnos** (quien lo lleva): próximos en tarjeta con insignias (sin cubrir, sin contestar, no puede) y anteriores en lista. **Planificar**: elegir en qué cultos de las próximas semanas sirve el equipo. **El cuadrante de un culto**: cada puesto (voz, guitarra, sonido…) con su persona y su respuesta, poner o cambiar a alguien, y la lista de canciones de ese culto.
4. **Agenda del equipo**: ensayos y reuniones; **apuntar uno nuevo**; **pasar lista**, con una fila por persona que se marca de un toque y «Vinieron 8 de 12»; **editar**.
5. **Repertorio**: las canciones con su tono y cuándo sonaron por última vez; **apuntar una canción**; **ficha** (tono, enlace, letra o acordes, veces que ha sonado).
6. **Seguimiento** (solo si el pastor da ese permiso): quién lleva más reuniones sin venir, con botones de llamar y WhatsApp; **ficha de la persona** con el historial y «Apuntar que le he contactado».
7. **Fondo del ministerio**: lo que entró y salió del fondo, solo para leer.

### H. Las pantallas de paso
- **Entrar**: correo, contraseña y «La he olvidado». **Recuperar la contraseña** y **Nueva contraseña**.
- **Aceptar la política nueva**: cuando cambia la política de privacidad, una pantalla tranquila con lo que cambia, la casilla y «Aceptar y seguir», antes de entrar a nada.
- **Tu iglesia no tiene acceso ahora mismo**: la suscripción de la iglesia venció. Al miembro no se le habla de pagos: «Tu iglesia tiene que renovar Hatril; mientras, no puedes entrar».
- **Sin conexión**: la app sin internet, con «Reintentar».

## Lo que NO quiero

- Estética genérica de «app con IA»: degradados morados, manchas, estrellitas.
- Ilustraciones tipo undraw, fotos de stock religiosas.
- Más de una fuente, iconos mezclados, sombras, modo oscuro.
- Que las herramientas del líder parezcan un panel de escritorio metido en el móvil: tienen que usarse con una mano, de pie, un domingo.
