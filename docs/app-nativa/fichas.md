# Las fichas de Google Play y de la App Store

Qué preguntan las dos tiendas y qué hay que contestar para Hatril, sacado del
código y de `/privacidad` a 20 de octubre de 2026. Si el producto cambia (se
encienden Sentry o PostHog, se añaden avisos push, se cobra algo dentro de la
app), **estas respuestas cambian también**, y una ficha que no dice la verdad
es motivo de retirada.

Cómo compilar y subir: [`android.md`](android.md) e [`ios.md`](ios.md).

---

## 1. Antes de enviar a Apple: lo que hoy haría que la rechacen

Por orden de lo que pesa. El 1 lo pide también Google, y el 3 afecta a las
dos tiendas.

1. **Borrar la cuenta desde la app.** *Hecho el 30-oct: `/mi/cuenta/borrar` y `/borrar-cuenta`; la ficha se queda en la iglesia (ver ESTADO.md).* Apple lo exige a toda app en la que se
   pueda crear una cuenta (norma 5.1.1(v)), y Google pide un camino dentro de
   la app **y** una dirección web para pedirlo (sale en el formulario de
   seguridad de datos). Hoy no existe: `/privacidad` dice que se pide por
   correo, y `/mi/cuenta` no tiene botón. Hace falta un «Eliminar mi cuenta» en
   `/mi/cuenta` y una página pública, por ejemplo `/borrar-cuenta`, que
   explique cómo pedirlo y qué se conserva (el registro del consentimiento,
   según `/privacidad` §6). Qué pasa con la ficha del miembro —que es de la
   iglesia— al borrar la cuenta es una decisión de producto.

2. **La Biblia vacía.** *Hecho el 30-oct: la RV1909 entera.* `/mi/biblia` enseña «El texto todavía no está cargado»
   y unas instrucciones para quien lo esté montando. Apple rechaza contenido de
   relleno (norma 2.1). O se carga la Reina-Valera 1909 en
   `public/biblia/rv1909/`, o la pestaña no sale en la app hasta entonces.

3. **El pago de Stripe, accesible dentro de la app.** Desde `/acceso` se llega
   a `/registro` (dar de alta una iglesia, con prueba y después Stripe), y
   `/panel/suscripcion` abre Stripe Checkout. Dentro de una app de iOS no puede
   haber botones ni enlaces que lleven a pagar fuera de la App Store (norma
   3.1.1). La suscripción la paga una organización —la iglesia—, y eso encaja
   en la excepción de servicios a organizaciones (3.1.3(c)): la app puede dar
   acceso a lo que se pagó fuera, pero **sin** botón de pago. Recomendación:
   dentro de la app (el User-Agent lleva `HatrilApp/`,
   `src/lib/platform/is-native-app.ts`), ni enlace a `/registro` ni botones de
   Stripe; en la suscripción, solo el estado. Las normas de pagos de Google
   Play van por el mismo camino; no he comprobado si una suscripción de
   empresa como esta tiene excepción allí, pero con el mismo arreglo no hace
   falta.

4. **«Denunciar» y «Bloquear» en el muro (Apple 1.2).** *Hecho el 30-oct, con la cola del moderador en `/mi/comunidad/denuncias`.* El muro es contenido
   de usuarios, y Apple pide tres cosas: poder **denunciar** una publicación o
   un comentario, poder **bloquear** a quien molesta, y que se actúe sobre lo
   denunciado. Hoy se puede borrar lo propio y quien modera borra lo de otros,
   pero no hay ni «Denunciar» ni «Bloquear».

5. **La regla 4.2: funcionalidad mínima.** Por dentro, la app es un WebView
   que carga la web. Ver la sección 10. Es el riesgo más alto de que Apple
   diga que no.

Y uno más, menor: **la privacidad a mano dentro de la app** (Apple
5.1.1(i)). Hoy se enlaza desde el registro y desde `/acepta`. Conviene un
enlace fijo en `/mi/cuenta`, junto al botón de borrar la cuenta.

### Antes de cualquiera de las dos

- **El correo `hola@hatril.com` no tiene buzón.** El dominio ya sirve la web
  con certificado válido, pero no tiene registros MX (comprobado el
  20-oct-2026). Es el correo de contacto de las fichas y al que `/privacidad`
  manda para ejercer los derechos.
- **La web con la app nativa, desplegada.** La app carga hatril.com, y lo que
  la hace comportarse como app (`src/components/app-nativa.tsx`) vive en la
  web. El 20 de octubre aún no estaba desplegado: sin él, atrás en la primera
  pantalla no hace nada.

**Recomendación**: Google primero (prueba interna, y la cerrada si la cuenta es
personal), arreglando 1, 2 y 3 mientras tanto. Apple cuando estén los cinco.

---

## 2. Direcciones

| Para qué | Dirección | Estado |
|---|---|---|
| Política de privacidad (las dos tiendas) | `https://hatril.com/privacidad` | Responde. Hasta desplegar el cambio de dominio enseña el correo antiguo, `hola@hatril.app` |
| Soporte (Apple la exige) | `https://hatril.com/privacidad#s1` | Sirve: lleva el correo de contacto. Mejor una página `/soporte` |
| Borrar la cuenta (Google la exige) | `https://hatril.com/borrar-cuenta` | **No existe** (sección 1, punto 1) |
| Web de la app (opcional) | `https://hatril.com` | Sirve |

El correo de contacto que se ve en las fichas es público: `hola@hatril.com`,
que **todavía no tiene buzón** (sección 1).

---

## 3. Textos

En español de España, la lengua principal de las dos fichas. Sin promesas que
el producto no cumple: no hay avisos push, ni modo sin conexión, ni la Biblia
mientras no tenga texto.

**Nombre** (30 caracteres): `Hatril`. Si en la App Store está cogido:
`Hatril: tu iglesia`.

**Subtítulo de Apple** (30): `La app de tu congregación`

**Descripción corta de Google** (80):

```
Tu iglesia en el móvil: el muro, la agenda, el devocional y tus equipos.
```

**Palabras clave de Apple** (100, separadas por comas y sin espacios; el
nombre no hace falta, ya cuenta):

```
iglesia,congregación,cristiana,evangélica,ministerio,devocional,culto,agenda,alabanza,pastor
```

**Texto promocional de Apple** (170, opcional, se cambia sin revisión):

```
El muro, la agenda y el devocional de tu iglesia, en el móvil. Para los miembros de iglesias que usan Hatril.
```

**Descripción larga** (las dos tiendas, 4000; esta tiene unos 1500):

```
Hatril es la app de tu iglesia: lo que pasa en tu congregación y lo que te toca a ti, en un solo sitio.

Para usarla, tu iglesia tiene que estar en Hatril. Entras con tu cuenta y pides unirte a tu congregación desde su página; cuando el equipo pastoral te acepta, la app se abre con lo de tu iglesia.

LO QUE ENCUENTRAS
• El muro de tu congregación: publicaciones con fotos, me gusta y comentarios. Solo lo ve la gente de tu iglesia.
• La agenda: cultos, reuniones y eventos de la iglesia, y los ensayos de los equipos donde sirves, en un calendario por mes, semana o día.
• El devocional del día y el archivo de los anteriores, para leerlos y compartirlos.
• Avisos dentro de la app cuando alguien comenta lo que publicaste, te asignan un turno o aceptan tu solicitud.
• La radio de tu iglesia, si tiene una.
• Cómo dar a tu iglesia, con los datos que ella publica. El dinero va directo a la iglesia: Hatril no cobra nada a los miembros.

SI SIRVES EN UN MINISTERIO
• Tus equipos: turnos, ensayos y quién viene a cada uno.
• Si llevas un ministerio, sus herramientas en la propia app.

PARA EL EQUIPO PASTORAL
• Con la misma cuenta, el panel de la iglesia: miembros, ministerios, eventos y solicitudes de ingreso.

TUS DATOS
Pertenecer a una iglesia es un dato especialmente protegido, y Hatril lo trata así. Lo de tu congregación no lo ve ninguna otra, y eso lo impone la base de datos, no solo la pantalla. Sin publicidad, sin rastreo y sin venta de datos.

La política de privacidad completa está en hatril.com/privacidad.
```

Cuando la Biblia tenga texto, añadir en «Lo que encuentras»:
`• La Biblia Reina-Valera 1909, con buscador.`

**Novedades de esta versión**: `Primera versión.`

**Categoría**: Estilo de vida, en las dos. (Apple deja una secundaria:
Productividad.)

---

## 4. Imágenes

| | Google Play | App Store |
|---|---|---|
| Icono | 512×512, ya está: `Versiones/Android/icono-play-512.png` | Sale del binario; no se sube aparte |
| Capturas | Teléfono: de 2 a 8, PNG o JPG, proporción 9:16 (por ejemplo 1080×1920) | iPhone de 6,9": 1320×2868 o 1290×2796, de 1 a 10. Con la app solo para iPhone no se piden de iPad |
| Gráfico destacado | 1024×500, **obligatorio, falta** | No hay |

Las capturas, con la cuenta de revisión (sección 8) en Betania: el muro con
fotos, la agenda, el devocional del día y el equipo. Ninguna con datos de una
iglesia real.

---

## 5. Google: Seguridad de los datos (*Data safety*)

**Preguntas generales**

| Pregunta | Respuesta |
|---|---|
| ¿Recoge o comparte datos de usuario? | Sí |
| ¿Van cifrados en tránsito? | Sí (todo HTTPS) |
| ¿Se puede pedir que se borren? | Sí |
| Formas de crear cuenta | Usuario (correo) y contraseña |
| Dirección para borrar la cuenta | `https://hatril.com/borrar-cuenta` (**falta**, sección 1) |

**Compartir**: **no**. Google no cuenta como «compartir» lo que reciben los
proveedores que trabajan por cuenta de Hatril (Supabase, el alojamiento). No
hay SDK de terceros dentro de la app: solo Capacitor.

**Datos recogidos** (todos: recogidos, **no** compartidos, ligados a la cuenta,
finalidad *Funcionalidad de la app*; nombre, correo e ID también *Gestión de la
cuenta*):

| Tipo de Google | Qué es en Hatril | ¿Obligatorio? |
|---|---|---|
| Información personal → Nombre | Nombre y apellidos | Sí |
| Información personal → Dirección de correo | El de la cuenta | Sí |
| Información personal → IDs de usuario | El identificador de la cuenta | Sí |
| Información personal → Número de teléfono | Ficha del miembro | Opcional |
| Información personal → Dirección | Ficha, si la iglesia la usa | Opcional |
| Información personal → **Creencias políticas o religiosas** | **Pertenecer a una iglesia**, la asistencia a los cultos, el seguimiento pastoral | Sí: es lo que hace la app |
| Información personal → Otra información | Fecha de nacimiento, estado civil, bautismo, notas pastorales | Opcional |
| Fotos y vídeos → Fotos | Lo que se sube al muro, devocionales, ministerios | Opcional |
| Actividad en la app → Otro contenido generado por el usuario | Publicaciones, comentarios, devocionales | Opcional |
| Actividad en la app → Otras acciones | Me gusta, inscripciones a eventos, asistencia a ensayos | Opcional |
| Información financiera → Historial de compras | **Si una persona ha pagado su plaza** en un evento de pago. La marca la iglesia a mano; Hatril no cobra ni ve el pago (`evento_inscripciones.pagado`) | Opcional |
| Información personal → Nombre, Número de teléfono y Otra información | **El reparto de alimentos**: el hogar que recibe ayuda (nombre, teléfono, cuántas personas viven en la casa) y si vino cada día de reparto (`reparto.ts`). Casi nunca son usuarios de la app: los apunta el equipo del ministerio | Opcional |

**No se recogen**: ubicación, otros datos financieros (ni tarjetas ni cuentas
bancarias; la caja de la iglesia no lleva nombres), salud, mensajes, audio,
archivos, calendario del teléfono, contactos del teléfono, historial web,
analítica, registros de fallos, ni identificadores del dispositivo.

Sobre el reparto: que alguien reciba comida de la iglesia dice que pasa
necesidad, y Google no tiene una casilla para eso; va en *Otra información*.
Se declara aunque quien lo recibe no use la app, porque los datos entran por
ella. El módulo ya lo trata aparte (sin texto libre, visible solo para el
equipo del reparto).

Dos notas que importan:

- **Sentry y PostHog están en el código sin claves** y hoy no envían nada
  (`src/lib/observability/`; `track` e `identify` no se llaman desde ningún
  sitio). El día que se enciendan, cambian *Registros de fallos*,
  *Diagnóstico* y, con un id de persona, *Interacciones con la app*.
- **La IP y el navegador** se guardan solo en tres sitios, como prueba de que
  el permiso lo dio esa persona: el consentimiento que se registra **al dar de
  alta una iglesia** (el de quien la registra, `crear-iglesia.ts`), **su copia
  en la auditoría** (el trigger de `consentimientos` copia la fila entera), y
  las **inscripciones a eventos** hechas desde la página pública de la
  iglesia. Quien entra por `/acepta` o por una solicitud no deja ni IP ni
  navegador. Ninguna de las dos tiendas tiene una casilla para la IP mientras
  no se use para saber dónde está alguien, y aquí no se usa.

---

## 6. Apple: Privacidad de la app (*App Privacy*)

**¿Recoge datos?** Sí. **¿Para rastrear (tracking)?** No: ni publicidad ni
cruce con datos de otras empresas, así que no hace falta pedir el permiso de
rastreo (ATT).

Todos: **ligados a la identidad**, **sin rastreo**, finalidad **App
Functionality**.

| Categoría de Apple | Tipo | Qué es en Hatril |
|---|---|---|
| Contact Info | Name | Nombre y apellidos |
| Contact Info | Email Address | El de la cuenta |
| Contact Info | Phone Number | Ficha del miembro |
| Contact Info | Physical Address | Ficha, si la iglesia la usa |
| **Sensitive Info** | Sensitive Info | **Creencias religiosas: pertenecer a una iglesia**, asistencia, seguimiento |
| User Content | Photos or Videos | Fotos del muro, devocionales, ministerios |
| User Content | Other User Content | Publicaciones, comentarios, me gusta, devocionales |
| Identifiers | User ID | El identificador de la cuenta |
| Other Data | Other Data Types | Fecha de nacimiento, estado civil, bautismo, notas pastorales, inscripciones; el reparto de alimentos (hogar, cuántos viven en la casa, si vino) |
| Purchases | Purchase History | Si una persona pagó su plaza en un evento (la marca la iglesia; el pago va fuera de Hatril) |

**No**: Health & Fitness, Financial Info, Location, Contacts, Browsing History,
Search History, Usage Data, Diagnostics. Nada se cobra dentro de la app
(sección 1, punto 3): lo de *Purchases* es solo la marca de la plaza pagada.

---

## 7. Clasificación por edades y público

**Las dos tiendas calculan la clasificación** a partir de un cuestionario; aquí
están las respuestas, no el resultado:

- Violencia, sexo, desnudos, lenguaje soez, drogas, alcohol, tabaco, apuestas,
  terror, contenido médico: **ninguno** por parte de Hatril.
- ¿Los usuarios publican contenido o se relacionan entre sí? **Sí** (el muro y
  los comentarios, dentro de una congregación).
- ¿Navegación web sin restricciones? **No**: la app solo abre Hatril, y los
  enlaces de fuera se van al navegador del teléfono.
- ¿Comparte la ubicación? **No**. ¿Anuncios? **No**. ¿Compras dentro de la
  app? **No** (con el punto 3 de la sección 1 arreglado).

Google, al principio del cuestionario, pide la categoría: la que más se acerca
es la de red social o comunicación, por el muro.

**Público objetivo (Google)**: **13 a 15, 16 a 17 y 18 o más**. `/terminos`
§2 permite cuenta propia **desde los 14** (por debajo, la ficha la lleva la
iglesia con permiso de los padres), así que marcar solo «18 o más» haría que
la ficha contradijera las condiciones. La franja de Google empieza en 13 y la
nuestra en 14; no hay franja más fina. Nunca por debajo de 13: eso metería la
app en el programa de familias de Google.

Dos cosas que quedan abiertas:

- El alta **no pregunta la edad**: los 14 son una regla de las condiciones, no
  una comprobación.
- Los 14 son la edad del consentimiento propio en España. En Colombia la
  mayoría de edad es a los 18 y la Ley 1581 trata aparte los datos de
  menores; `/terminos` no distingue por país. Conviene que lo mire alguien
  que conozca la norma colombiana antes de abrir allí.

---

## 8. La cuenta para quien revisa

Las dos tiendas la exigen: sin cuenta no pueden entrar, y Apple rechaza por eso
(norma 2.1).

**No usar las cuentas de prueba del equipo** (`miembro@hatril.test` y
compañía): su contraseña está escrita en `ESTADO.md` y en los seeds del repo.

Crear una aparte, en el entorno que va a revisar la tienda (el del dominio
definitivo):

1. Un correo que controles, por ejemplo un alias de Gmail con `+revision`.
2. En la app: **Crear cuenta** con ese correo y una contraseña larga y
   aleatoria.
3. Desde el directorio, **pedir unirse a Betania** (la iglesia de demostración).
4. Con la cuenta del pastor de Betania, en el panel: **Solicitudes →
   aceptar**. Mejor aún si se le añade a un ministerio (Alabanza), para que
   quien revisa vea también la pestaña Equipo.

**Dónde está la contraseña**: en `Versiones/CLAVES-tiendas.txt` del Windows
(fuera de Git) y en el gestor de contraseñas. **No se escribe en el repo.** Se
pega solo en:

- Google Play: **Policy and programs → App content → App access** → «All or
  some functionality is restricted» → añadir instrucciones con usuario y
  contraseña.
- App Store Connect: en la versión, **App Review Information → Sign-in
  required** → usuario y contraseña.

El día de la revisión, que Betania tenga publicaciones con fotos, un
devocional de ese día y eventos en las semanas siguientes: si no, quien revisa
ve pantallas vacías.

**Notas para la revisión de Apple** (en inglés, que es como mejor llegan; los
dos últimos párrafos, solo cuando sean ciertos):

```
Hatril is the app of a church congregation. Members sign in, ask to join their church and, once the church accepts them, see the church's private wall (posts, photos, comments), calendar, daily devotional and the ministry teams they serve in.

The demo account belongs to "Betania", a demo church with sample data. It is a member who also serves in a ministry team, so the "Equipo" tab is visible.

Users can delete their account from Mi cuenta > Eliminar mi cuenta. Posts and comments can be reported and users can be blocked from the "..." menu of each post.

Churches subscribe to Hatril as organizations, outside the app. The app has no purchases and no links to buy anything.
```

---

## 9. Otras preguntas

**Google Play** (en *App content*):

| Pregunta | Respuesta |
|---|---|
| Anuncios | No contiene anuncios |
| App de noticias | No |
| Funciones financieras | Ninguna (no hay banca, préstamos ni pagos) |
| Salud | Ninguna |
| App gubernamental | No |
| Permisos de fotos y vídeos | No se declaran: la app no pide ese permiso; elige las fotos con el selector del sistema (el manifiesto solo pide `INTERNET`) |

**App Store Connect**:

| Pregunta | Respuesta |
|---|---|
| Cifrado (*export compliance*) | Ya contestado en el binario (`ITSAppUsesNonExemptEncryption = NO`): no vuelve a preguntar |
| Derechos de contenido (*Content Rights*): ¿contiene contenido de terceros? | Sí: lo que publican las iglesias y sus miembros, la radio que enlaza cada iglesia y la Biblia de 1909 (dominio público). Los términos (`/terminos` §3 y §5) hacen a cada iglesia responsable de lo suyo |
| Precio | Gratis |
| Países | Colombia y España para empezar |

---

## 10. Apple 4.2: una web dentro de una app

La norma 4.2 dice que una app tiene que ser más que una web reempaquetada, y
Hatril, por dentro, es eso: un WebView que carga la web. **Es el motivo más
probable de rechazo en Apple.** Google es mucho menos estricta con esto.

**Lo que ya tiene de app:**

- Arranca en `/mi`, la app del miembro, no en la portada comercial, con su
  barra inferior.
- Icono, arranque y barra de estado propios, siempre en claro.
- Su propia pantalla de «Sin conexión», con «Reintentar», en vez del error del
  navegador; y nunca acepta un certificado malo.
- El selector de fotos y la cámara del sistema al publicar.
- **No prometer la hoja de compartir del sistema.** En Android no sale: el
  WebView no trae `navigator.share` (comprobado en el emulador) y «Compartir»
  del devocional copia el texto. En iOS no se ha probado. Con
  `@capacitor/share` saldría en las dos; mientras, no se cuenta como algo de
  app.
- En Android, el botón atrás cierra primero lo abierto y sale desde la raíz.

**Lo que conviene añadir antes de enviar a Apple**, por orden de lo que pesa:

1. **Avisos push.** Hatril ya genera avisos (comentarios, me gusta, turnos
   asignados, «X no puede», solicitudes: `tipoNotificacionEnum`), pero solo se
   ven al abrir la app. Mandarlos al teléfono es lo que más la separa de una
   web, y el motivo más fácil de explicar a quien revisa. Cuesta: el plugin
   `@capacitor/push-notifications`, Firebase en Android, una clave APNs en
   Apple, guardar el token de cada teléfono y quién manda el aviso desde el
   servidor. Y el día que se haga, cambian las fichas (identificadores del
   dispositivo).
2. **Abrir los enlaces de Hatril en la app** (*Universal Links* y *App Links*):
   que el enlace de un correo de Hatril abra la app y no Safari.
3. **El gesto de volver atrás en iOS** (deslizar desde el borde): hoy no está,
   y en iPhone no hay botón atrás. Es una línea en una subclase de
   `CAPBridgeViewController` (`allowsBackForwardNavigationGestures`), pero hay
   que probarla en el Mac antes de subirla.

Con el 1 hecho, en las notas para la revisión se explica qué hace la app que
no hace la web.
