# Rama `claude/arreglos-sueltos-04ae02` — estado

20 de octubre de 2026. Cinco arreglos que salieron de la última revisión, sin
migraciones. Para integrar en `ESTADO.md` al fusionar.

## Qué se hizo

1. **El libro de caja ya no corta a escondidas.** `libro()` cortaba con un
   `limit 50` y la pantalla contaba las filas que le llegaban: con 62
   movimientos en el mes decía «50 movimientos» y el más antiguo no estaba en
   ninguna parte. Ahora devuelve `{ filas, total, pagina, porPagina }`, la
   cabecera dice el total y hay paginación de 50 en 50 arriba y abajo de la
   tabla (`?pagina=N`, enlaces de verdad). Una página fuera de rango enseña la
   última. El informe imprimible avisa contra el total —antes saltaba con
   `filas.length === 500` y decía «primeros» cuando son los más recientes— y el
   CSV lleva dentro una línea de aviso si el tope de 10.000 corta.
   `Paginacion` sube de `miembros/_components` a `panel/_components` con la
   unidad como parámetro.
2. **El pastor que registra una iglesia ya sale en las listas.** `/registro`
   enseña la casilla de asistencia, sin premarcar y con el texto y la versión
   de `/acepta` y `/solicitar`, y `crearIglesiaConSeeds` registra el
   consentimiento si se marca. `aceptaAsistencia` es obligatorio y sin
   defecto: una puerta de alta nueva que no pregunte la casilla no compila.
   Era la primera trampa de `ESTADO.md` por su segunda puerta; esa línea de la
   tabla «Qué falta» y el «(pendiente)» de la trampa se pueden cerrar.
3. **Las casillas tienen nombre accesible.** La casilla dentro de su `<label>`
   salía como `checkbox "on"` en el lector de la herramienta del navegador, que
   no sigue la etiqueta envolvente ni `aria-labelledby` (sí `aria-label` y
   `label[for]`; comprobado inyectando cada variante). La del art. 9 lleva de
   `aria-label` el texto exacto del consentimiento, sin el «Leer la política»
   pegado. La de asistencia es ahora un componente, `CasillaAsistencia`, que
   usan las tres pantallas: título como nombre y texto legal y consecuencia
   como descripción (`aria-describedby`). Una sola redacción para las tres,
   que guardan la misma versión.
4. **La foto del ministerio confirma.** `/panel/ministerios/[id]` pinta
   «Foto del grupo guardada» y «Foto del grupo quitada» con `?guardado=`, como
   las demás pantallas.
5. **`/panel/lideres`.** Desmarcar «Llevar sus propios ministerios» funciona
   (abajo). Tres retoques para que se entienda: el grupo dice «Viene para
   todos · puedes quitárselo» —«Viene puesto para todos» a secas se leía como
   algo fijo—; la tarjeta cerrada lleva, en su propia línea y con el icono
   `ShieldOff`, «Sin permiso para llevarlo» (o «llevarlos») cuando esa persona
   lidera algo que no puede llevar —antes no se notaba en ningún sitio—; y la
   descripción del permiso dice «desde el panel» en vez de «desde aquí».

## Segunda pasada: el listón visual

Revisadas con capturas a 375 px y en escritorio todas las pantallas tocadas:
el libro con dos páginas, `/registro`, `/acepta`, `/solicitar`, la foto del
ministerio y `/panel/lideres`. El diff no lleva ni un hex ni un `text-white`;
cada clase sale de un token expuesto en `globals.css`. Lo que no se parecía:

- **Las flechas de la paginación medían 32 px** y todos los controles de
  finanzas y de miembros miden 36 (`h-9`). Ahora `size-9`, en las dos.
- **La paginación de abajo dejaba al final de la página siguiente.** Llevaba
  `scroll={false}`, que en miembros es a propósito porque va arriba. La de
  abajo (`alPie`) sube al principio: desde 1.833 px aterriza con la primera
  fila a la vista.
- **Las dos casillas de `/registro` respondían distinto**: la de asistencia se
  tiñe al marcarla y la del art. 9 no hacía nada. En `/solicitar` igual. Las
  dos llevan ahora los mismos estados, y al hacerlo saltó un contraste: el
  enlace «Leer la política» en naranja sobre el fondo marcado da 4.15:1 y
  sobre el de `hover`, 4.32. Pasa a `accent-foreground` en esos dos estados
  (5.64:1), que es lo que CLAUDE.md manda para lo escrito sobre `bg-accent`.
- **El aviso de la tarjeta se leía como un ministerio más.** La primera
  versión lo pegaba detrás de la lista: con dos, «Lidera Acción social, Radio,
  sin poder llevarlo». Ahora es «Sin permiso para llevarlo» / «llevarlos», en
  su línea y con el icono `ShieldOff`.
- **El encabezado del grupo se partía a media frase a 375 px** («…· PUEDES /
  QUITÁRSELO»). Ahora «Viene para todos · puedes quitárselo», medido en una
  línea.

La confirmación de la foto ya era el `Aviso` de las demás, en el mismo sitio
que la agenda y el repertorio pintan las suyas: no cambió.

## Tercera pasada: la revisión, y `main` dentro

Revisión con seis hallazgos, todos menores; aplicados los seis:

- **La tarjeta decía «Sin permiso para llevarlo» a quien sí podía** (dos
  hallazgos, el mismo). Solo miraba `gestionar_su_ministerio`, y
  `puedeGestionarMinisterio` deja pasar también por `gestionar_ministerios`.
  Ahora la tarjeta llama a esa misma función, con la fila del equipo como
  contexto, en vez de copiar la condición: no pueden contradecirse.
- **`/registro` no decía cómo retirar el permiso**, que promete el texto
  legal. Lleva debajo de las casillas la línea de `/acepta`, con el correo de
  `DATOS_RESPONSABLE` y sin «escribe a tu iglesia» —al pastor le mandaba a sí
  mismo—, y dice «dar o retirar»: hoy no hay pantalla para ninguna de las dos
  cosas. La pantalla de verdad sigue en «Qué falta».
- **`?guardado=constructor` tumbaba la página** con un 500. `CONFIRMACIONES`
  es un objeto literal y hereda las claves de `Object.prototype`: la función
  `Object` es verdadera y React no la puede pintar. Reproducido en
  `/panel/lideres` antes de tocar nada. Arreglado con `Object.hasOwn` en las
  **21** pantallas con el patrón (la revisión contaba 10; `main` trajo las
  del reparto, y faltaban las de `/mi/agenda`).
- **La paginación arrastraba `?error=` y `?guardado=`**: un aviso de la acción
  anterior volvía a salir en la página 2. `href()` los quita, como ya quitaba
  `ficha`.
- **Este documento citaba textos que no están en el código.** Corregido.

`main` entró con `git merge main` y sin conflictos: el único fichero común
era `permisos.ts`, cada lado en su zona. Se hizo a mano y no con la
herramienta de la app porque esa trae la base desde `origin`, y la tanda de
alimentos está solo en el `main` local, sin push.

## Verificado ejecutándolo (localhost:3004)

- **Libro**: 62 movimientos de prueba en junio de 2026 en Betania. Cabecera
  «62 movimientos», «1–50 de 62», la flecha lleva a la página 2 con 12, y entre
  las dos páginas salen los 62 ids distintos: ni repetidos ni saltados, con
  dos y tres movimientos por día. `?pagina=9` enseña la última. CSV con los 62
  y sin aviso. Subido a 512 un rato, el informe dice «Se muestran los 500
  movimientos más recientes de los 512 del mes» y las tres cifras de arriba son
  las del mes entero. Borrados los 512; Betania vuelve a 0 movimientos.
- **Registro**: iglesia de prueba creada pulsando «Crear la iglesia» con la
  casilla marcada. En la base, los dos consentimientos en `privacidad-2026-09`
  con IP. Apuntado un culto como esa pastora: sale en «Quién vino»; guardada la
  lista, `ultima_asistencia` se mueve. **Control negativo**: revocado a mano el
  consentimiento, la lista dice «No hay nadie en el fichero» — el estado en que
  quedaba todo pastor recién registrado. Iglesia y cuenta borradas.
- **Casillas**: `read_page` da «Autorizo a que Hatril guarde…» y «Que se
  apunte si vengo…» en `/registro`, `/solicitar/betania` y `/acepta`. Enviada
  una solicitud de prueba con la casilla marcada: `acepta_asistencia = true`.
  Deshecha entera.
- **Foto**: como `colider@`, subida una imagen a Acción social (no tenía) →
  aviso verde; quitada → aviso verde, `foto_url` a null y el fichero fuera de
  `storage.objects`.
- **Líderes**: desmarcado el permiso de Sara (`colider@`) → la base guarda
  `{"gestionar_su_ministerio": false}`, la tarjeta lo dice, y Sara aterriza en
  `/mi/comunidad` y la URL de su ministerio la devuelve allí. Vuelto a marcar →
  `{}` y entra otra vez.
- `npx tsc --noEmit`, `npx eslint`, `npm run build` y
  `npm run test:aislamiento` en verde. Sin cambios de base, así que sin
  `get_advisors` nuevo.

Todos los datos de prueba y su limpieza están en
`scripts/prueba-arreglos-sueltos.sql`. No queda nada en la base.

## El alta no llama a servicios externos

Comprobado antes de registrar: ni Stripe ni Resend. `registrar` crea el
usuario con `auth.admin.createUser({ email_confirm: true })`, que no manda
correo, y la iglesia en una transacción de `dbAdmin`. El único servicio real
es el Supabase del proyecto. La cuenta de prueba fue `@hatril.test`, con una
contraseña aleatoria generada dentro de la página que no se guardó en ningún
sitio: se entró después por enlace mágico y se borró al terminar.

## Qué falta

- **Los pastores que ya se registraron siguen fuera de sus listas.** El
  arreglo cubre las altas nuevas. Hoy solo hay uno en ese estado: el pastor de
  la demo de Betania, que probablemente pasó por `/acepta` sin marcar (no se ha
  tocado). En producción, quien se registró antes de esto no tiene pantalla
  donde dar el permiso: `/acepta` solo sale cuando la versión cambia. Hace
  falta un sitio en `/mi/cuenta` o en la ficha para darlo o retirarlo cuando
  se quiera, que además es lo que promete el texto («puedo retirar este
  permiso cuando quiera»).
- **`/panel/miembros?ficha=abc` da un 500.** Salió probando la paginación:
  el parámetro llega a Postgres sin comprobar que sea un UUID, y la consulta
  revienta con «invalid input syntax for type uuid». Es la misma familia que
  el `?guardado=constructor`, pero en otra pantalla y fuera de este encargo.
  Lo probable es que pase igual con `?desde=` y `?hasta=` del libro si no son
  fechas: CLAUDE.md pide Zod en toda query, y estas pantallas no lo tienen.
- **El aviso de Base UI de los botón-enlace** («expected a native
  `<button>`…») sale en `/panel/lideres` y en el ministerio. Es el pendiente
  que ya documenta `button.tsx`, afecta a 32 ficheros y no es de esta rama.

## Trampas

- **Una iglesia no se borra con un `delete from iglesias`**, aunque todo
  cuelgue en cascada: el trigger `auditar()` de las tablas hijas inserta en
  `auditoria` con el `iglesia_id` que se está borrando y la clave ajena lo
  rechaza. Hay que vaciar antes las tablas auditadas. El orden está en el
  script. Pesará el día que exista la supresión de una iglesia entera.
- **El pooler de Supabase en modo sesión admite 15 clientes**, y con cinco
  ramas con su servidor de desarrollo contra la misma base se llenó: el panel
  dio «This page couldn't load» con `EMAXCONNSESSION` justo después de
  registrar. No era el código; al recargar funcionó.
- **El lector de la herramienta del navegador no es un lector de pantalla.**
  Toma el nombre de un campo del placeholder antes que de su `<label for>`, y
  el de una casilla de su `value` si no hay `aria-label` ni `label[for]`. Un
  «on» ahí no prueba que un lector real diga «on» —Chrome sí sigue la etiqueta
  envolvente—, pero el arreglo vale para los dos.
- **`127.0.0.1` no sirve para separar sesiones**: en desarrollo `request.url`
  vuelve como `localhost` y `/auth/confirm` redirige ahí, sin la cookie.
