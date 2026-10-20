# Contabilidad (Finanzas) — estado de la rama `claude/contabilidad-6d8a11`

20 de octubre de 2026. Tanda 3 de `plan.md`, la primera de la cola con
migración. En pantalla sigue llamándose **Finanzas**: nada de partida doble,
nóminas, facturas ni impuestos, y sigue sin guardarse quién dio cuánto. Para
integrar en `ESTADO.md` al fusionar.

**Numeración:** salen la `0043_finanzas_arqueo` (generada), la
`0044_finanzas_arqueo_rls` (a mano) y, tras la revisión, la
`0045_arqueo_por_cuenta` (generada y completada a mano). **Las tres están
aplicadas en la base compartida** (`drizzle.__drizzle_migrations`: 46 filas).
Cogen **HT128, HT129, HT130 y HT131**, y la 0045 amplía HT101. La siguiente
migración es la **0046** y el siguiente código, **HT132**.

---

## Qué hay

### 1. Finanzas se apaga y se enciende (solo el pastor)

- **`iglesias.modulos`** (jsonb, `{}` por defecto). Al revés que
  `ministerios.modulos`: aquí **la clave ausente es «encendida»** y solo se
  guarda lo apagado (`{ "finanzas": { "activo": false } }`). Ninguna iglesia
  se queda sin caja el lunes y la migración no rellena nada. Se lee solo con
  `src/lib/iglesias/herramientas.ts` (`finanzasEncendida`, `conHerramienta`).
- **`UserContext.iglesia.modulos`**, del mismo `select` de siempre.
- **`/panel/modulos`**, bloque **«Herramientas de la iglesia»** debajo del de
  ministerios (que no se ha tocado), solo para el pastor: tarjeta de Finanzas
  con «Apagar» / «Encender» y, encima del botón, que apagar oculta y no borra.
  Action `cambiarHerramienta` con `requirePastorAccion`; la base dice lo mismo
  (`iglesias_update_pastor`, 0001). Lee la fila con `for update` y conserva lo
  demás del jsonb.
- **Apagada**: fuera del menú (`puedeVerFinanzas`), fuera del bloque «La caja»
  de Inicio, **404 en todas sus páginas** (`requireFinanzas()` en
  `guard-panel.ts`, en cada página y en el layout) y **404 en la exportación**
  (después del 401/403 del permiso). Las actions rebotan a `/panel/hoy` con
  mensaje (`requireFinanzasAccion`).
- **`puedeGestionarFinanzas` exige además la herramienta encendida**, también
  para el pastor. Y `esDelEquipo` deja de contar `gestionar_finanzas` con
  Finanzas apagada: el tesorero que solo lleva la caja sale a `/mi` en vez de
  aterrizar en un panel sin nada suyo. El permiso no se toca; vuelve a valer al
  encender. `ContextoPermisos` gana un `iglesia?` opcional para esto (sin él,
  todo cuenta como encendido).

### 2. Fondo vinculado a un ministerio

- **`fondos.ministerio_id`** (`on delete set null`), con
  `ck_fondos_general_sin_ministerio` (el General no se vincula: su líder vería
  cada gasto de la iglesia) y `uq_fondos_ministerio` (un fondo **vivo** por
  ministerio). **HT128**: el ministerio es de la misma iglesia.
- **Fondos y cajas** (`/panel/finanzas/ajustes`, solo pastor): bajo cada fondo
  que no es el General, «Es el fondo de» con los ministerios vivos; los que ya
  tienen fondo salen deshabilitados. Action `vincularFondo` (también
  desvincula con «Ningún ministerio»).
- **Pestaña «Fondo»** en `/panel/ministerios/[id]/fondo`, de solo lectura:
  saldo de siempre, entró y salió en el mes, y **los gastos con su concepto;
  los ingresos solo en total**. Meses anterior y siguiente con `?mes=`,
  validado con Zod (`src/lib/fecha/mes.ts`): `?mes=hola` o un mes futuro caen
  al actual, no a un 500. Puertas en `fondo/guarda.ts`:
  `requireGestionMinisterio(id, { desdeDentro: true })` + Finanzas encendida
  (`puedeVerFondoDe`) + fondo vivo vinculado, lo que falte da 404. La pestaña
  sale en `PestanasMinisterio` con la misma condición, gracias a
  `MinisterioDetalle.conFondo`.
- Las consultas, aparte, en `src/lib/finanzas/del-ministerio.ts`: todas salen de
  `fondos.ministerio_id` y filtran por ese fondo, porque la RLS de
  `movimientos` es por iglesia y el `where` es la única barrera dentro de ella.
- **App del líder**: tarjeta «Fondo» en la portada de `/mi/equipo/[id]` (solo
  cifras, sin conceptos) y pantalla `/mi/equipo/[id]/fondo` con la misma vista
  que el panel. Sin vista de participante. Para engancharla, el contrato
  (`en-la-app/contrato.ts`) gana dos cosas opcionales:
  - **`HerramientaDerivada`**: lo que sale en la portada sin ser un módulo de
    `ministerios.modulos`, con su `aplica(ctx, ministerio)`. Se registra en
    `DERIVADAS` de `registro.ts`; `modulosDeLaPortada` conserva su firma.
  - **`ResumenDeModulo.cifras`**: una fila de cifras para mirar, que pinta
    `TarjetaModulo`.
- **Formulario de movimientos**: el aviso del concepto dice ahora «Sin nombres
  de personas, tampoco de quien recibe una ayuda, ni motivos de salud. Si el
  fondo es de un ministerio, quienes lo llevan leen los gastos.»

### 3. Arqueo del culto, a dos personas

- **Tabla `arqueos`**: fecha, `total_diezmos` y `total_ofrendas` (en efectivo,
  sin desglose por billete, sin texto libre), fondo y caja (General y la de
  efectivo por defecto), `contado_por_miembro_id`, `confirmado_por_miembro_id`
  y `confirmado_at`. RLS calcada de la 0020 (`pertenece_a_iglesia`, `to
  hatril_app`, revoke a anon, authenticated y service_role antes del grant).
  **`movimientos.arqueo_id`** (`no action`, para que borrar una iglesia en
  cascada no tropiece) y `uq_movimientos_arqueo` (un diezmo y una ofrenda por
  arqueo).
- **Lo garantiza la base, no la pantalla:**
  - **HT129**: fondo, caja, las dos personas —y el arqueo de un ingreso— son de
    la misma iglesia.
  - **HT130**: quien cuenta y quien confirma son la ficha de la **sesión** que
    escribe (`miembro_actual()`), no coinciden, la hora la pone la base, lo
    contado no se reescribe (corregir = descartar y volver a contar), y un
    arqueo confirmado no se toca ni se borra. Los ingresos que salen de él
    tampoco se editan ni se borran, ni se puede colgar uno a mano: corregir es
    apuntar un ajuste aparte. Con el atajo de `_escritor_confiable()`, como
    HT111 y HT127.
  - `ck_arqueos_dos_personas`: la segunda llave, sin atajo para nadie.
  - **Al confirmar, la base apunta los ingresos** en la misma sentencia
    (`arqueo_genera_ingresos`, AFTER UPDATE): «Diezmos del culto del
    20/10/2026 (arqueo)» y «Ofrendas…», a nombre de quien confirmó. Confirmado
    implica apuntado, y por lo contado.
- **Pantallas** (pensadas para el móvil): `/panel/finanzas/arqueos` (los que
  esperan, en tarjeta con «Confirmar el arqueo» en carbón y «Descartar»; quien
  contó ve «Lo contaste tú» y no puede confirmar; debajo los últimos 20
  confirmados) y `/panel/finanzas/arqueos/nuevo` (fecha y dos totales; fondo y
  caja plegados en un `<details>`). En Finanzas, un aviso arriba si hay arqueos
  sin confirmar y el enlace «Arqueo del culto». La ficha de un ingreso de
  arqueo es de solo lectura, con quién contó y quién confirmó.
- Es **opcional**: el tesorero puede seguir apuntando directo en el libro. Sin
  ficha en la iglesia no se cuenta ni se confirma (lo dice la pantalla).

### 3 bis. La revisión: el arqueo, por cuenta y no solo por ficha (`0045`)

La revisión vio que HT130 decidía quién es quién con `miembro_actual()`, es
decir `iglesia_usuarios.miembro_id`, y que el pastor podía reapuntar esa
columna en su propia fila: contaba con su ficha, se ponía la de la secretaria,
confirmaba «como ella» y volvía a la suya. Ningún camino de la aplicación lo
hacía. Dos llaves:

- **HT101 ampliado** (`guard_iglesia_usuarios`): desde una sesión nadie cambia
  su propia ficha, como no cambia su rol. Enlazar la ficha al aprobar una
  solicitud toca la fila de otra persona y sigue funcionando (probado).
- **HT131**: `arqueos.contado_por_auth_id` y `confirmado_por_auth_id`, que
  pone la base con `auth.uid()` y no se reescriben; la misma cuenta no
  confirma lo que contó, aunque cambie de ficha. `ck_arqueos_dos_cuentas` lo
  repite sin atajo. Nulas en el arqueo de la demo anterior a la 0045: no se
  rellenan adivinando la cuenta por la ficha, que es justo lo falsificable.

Y los otros siete hallazgos:

- **Fondo o caja archivados con un arqueo esperando**: `archivarFondo` y
  `archivarCaja` no archivan mientras haya arqueos sin confirmar que van ahí,
  y contar y confirmar comprueban que fondo y caja siguen activos (si no, piden
  descartar y volver a contar).
- **Finanzas apagada a mitad de un formulario**: la action ya no manda a
  `/panel/hoy` (de donde el tesorero salía a `/mi` sin aviso), sino a
  `inicioDe(ctx)` con el mensaje; si es `/mi`, al muro, que lo pinta.
- **Descartar** pide un paso más, sin JavaScript: «Descartar…» abre la zona de
  borrar con lo que pasa y «Sí, descartarlo» en rojo.
- **El resumen plegado de contar** decía siempre «Va a General · Efectivo»
  aunque dentro se eligiera otro fondo; ahora dice «Fondo y caja · por
  defecto, General · Efectivo».
- **Tamaños sueltos** en «Es el fondo de»: el rótulo va con `t-label` y el
  `select` sin tamaño propio, para que le alcance la regla de 16 px del móvil.
- **La caja por defecto** del formulario de movimientos es la de efectivo, no
  la primera por orden alfabético (mismo fallo que el del fondo).
- El de la privacidad, abajo: es de Marlon.

### 4. Textos legales (sin subir `VERSION_POLITICA_PRIVACIDAD`)

- `/privacidad`, párrafo de finanzas: quién contó y quién confirmó el arqueo
  (del equipo, no de quien da), y que quien lleva un ministerio con fondo ve su
  saldo y sus gastos, y lo que entra solo en total.
- `/terminos` §7: «y en el arqueo del culto, quién lo contó y quién lo
  confirmó».
- Es la misma categoría que «con quién lo registró», ya declarada; lo trato
  como precisión. **Subir la versión o no lo decide Marlon.**
- **Pendiente de Marlon (hallazgo 7 de la revisión):** el párrafo añade datos
  (quién contó y quién confirmó) y destinatarios (quien lleva un ministerio ve
  los gastos de su fondo), pero ni `VERSION_POLITICA_PRIVACIDAD`
  (`privacidad-2026-09`) ni «Última actualización» (2026-08-21, en
  `src/lib/legal/datos-responsable.ts`) cambian, y la sección 10 de la misma
  página dice que esa fecha es «la única señal fiable». Quien aceptó la versión
  anterior no tiene forma de ver el párrafo nuevo. Como mínimo habría que mover
  la fecha; si se considera cambio de fondo, subir también la versión y volver
  a pedir el consentimiento. No he tocado ninguna de las dos: va junto con la
  subida que ya esperan consolidación y la radio.

### 5. Arreglos que salieron por el camino

- **El formulario de movimientos ponía por defecto el primer fondo por orden
  alfabético**, no el General. Con un fondo «Alimentos» delante, la ofrenda de
  cada domingo caía en él sin abrir «Más opciones», y la leía su equipo. Ahora
  el defecto es el General.
- `/panel/finanzas/movimientos/<algo que no es uuid>` daba 500: ahora 404.
- Los cinco `<Button render={<Link/>}>` de la pantalla de Finanzas pasan a
  `Link` con `buttonVariants` (ya no ensucian la consola).

---

## Verificado

- **typecheck, eslint, build**: en verde.
- **`npm run test:aislamiento`**: todo correcto, con **31 comprobaciones
  nuevas** en la fase SQL (HT128–HT130, Sion no ve ni confirma ni cuelga
  ingresos de los arqueos de Betania, la hora de la base, los dos ingresos
  generados, inmutabilidad, descartar, la segunda llave sin sesión, anon,
  authenticated y service_role fuera, `iglesias.modulos` cerrada a anon, las
  seis funciones cerradas) y **tres en la fase `withUser`**: las columnas
  nuevas, y con la demo, que `pastor@` no confirma su propio arqueo (HT130) y
  que con la sesión de `secretaria@` se confirma y salen los dos ingresos, todo
  en una transacción que se revierte.
- **`npm run test:puertas`** contra el 3007: **67 rutas, 391 combinaciones, 0
  fallos**, con las nuevas: `/panel/finanzas/arqueos`,
  `/panel/finanzas/arqueos/nuevo` y la pestaña `fondo` en Acción social (con
  fondo: pinta para pastor y colíder; rebota a lider, secretaria y
  consolidación) y en Alabanza (sin fondo, 404). Ojo: una pasada que coincida
  con apagar Finanzas o vincular un fondo falla en esas rutas, porque lee la
  demo al empezar.
- **`get_advisors`**: el conector de Supabase de esta sesión devuelve «sin
  permiso». En su lugar, por SQL: ninguna tabla de `public` sin RLS, ninguna
  función `security definer` sin `search_path`, ninguna función ejecutable por
  `anon` o `authenticated` y ninguna tabla con SELECT de tabla para ellos. Y el
  `proacl` de las seis funciones nuevas es `{postgres=X/postgres}`.
- **En el navegador a 375 px**, cada escritura comprobada en la base:
  - pastor: apagar Finanzas (`{"finanzas":{"activo":false}}`; menú sin
    Finanzas, Inicio sin «La caja», 404 en las cuatro páginas y en el CSV) y
    encender (`{}` otra vez); crear el fondo «Alimentos» y vincularlo a Acción
    social; apuntar un ingreso de 300.000 y un gasto de 85.000 en él;
    confirmar el arqueo que contó otra persona (los dos ingresos aparecen en el
    libro, a su nombre); contar y descartar uno.
  - `colider@` (Sara): pestaña «Fondo» en el panel (215.000 / 300.000 / 85.000,
    el gasto con su concepto, el donativo sin el suyo), tarjeta en la portada
    de la app y su pantalla `/mi/equipo/<id>/fondo`.
  - `secretaria@`, `lider@` y `enlace@`: ni pestaña ni tarjeta; la pestaña les
    rebota o da 404, igual que la pantalla de la app, y la caja les rebota.
  - Para contar hacía falta una segunda persona con la caja: le di
    `gestionar_finanzas` a `consolidacion@` el tiempo de la prueba y se lo
    quité después (vuelve a `{"ver_seguimiento": true}`).
  - Las nueve pantallas nuevas o tocadas miden 375 px, sin nada por fuera
    (el «Cancelar» de contar se salía hasta 474 y se arregló).

**Tras la revisión y con `main` dentro** (app nativa, hatril.com y «quien
solo lidera empieza en la app»), otra vez en verde: tsc, eslint, build,
`test:aislamiento` (con los cuatro casos nuevos de la 0045: HT101 con la ficha
propia, aprobar una solicitud sigue enlazando, la base pone la cuenta de quien
cuenta, HT131 con la ficha reapuntada) y `test:puertas` (67 rutas, 0 fallos).
En el navegador a 375 px: el resumen plegado de contar, «Descartar…» con su
zona roja y el borrado real, archivar «Alimentos» con un arqueo esperando
(rechazado, el fondo sigue activo), la caja por defecto «Efectivo» con
«Cuenta Bancolombia» delante, el `select` de «Es el fondo de» a 16 px, y un
tesorero sin ministerio (`miembro@` con el permiso un momento) que pulsa
«Apuntar» con Finanzas recién apagada: acaba en el muro con «No se ha
guardado…» y el libro sin tocar. Permisos y Finanzas, devueltos a como estaban.

**Queda en la demo de Betania**, a propósito: el fondo «Alimentos» vinculado a
Acción social, sus dos movimientos, la caja «Cuenta Bancolombia» y un arqueo
confirmado del 20-oct (contó Noemí, confirmó Brandon) con sus dos ingresos en
General. Lo confirmado no se
puede borrar desde una sesión (HT130); si hiciera falta, desde `dbAdmin`.

---

## Qué no se hizo, y por qué

- **Eventos, Reuniones y Devocionales** no tienen interruptor todavía: el
  catálogo de `herramientas.ts` está listo para ellas, pero apagarlas exige
  decidir qué pasa con lo que ya publican fuera (un evento abierto en la web,
  el devocional del día).
- **Arqueos pendientes en Inicio**: hoy el aviso está solo en Finanzas.
- **El tesorero de la demo**: no hay cuenta `tesorero@`. Para repetir la prueba
  de dos personas hay que dar el permiso a alguien un rato, como arriba.
- **El informe con `?mes=hola` sigue dando 500**: es de la cola «Zod en los
  parámetros». `src/lib/fecha/mes.ts` (`mesPedido`) ya lo resuelve; el informe
  puede usarlo cuando se haga esa tanda.
- Las pestañas del ministerio, a 375 px, no llevan la activa a la vista cuando
  queda a la derecha (pasa con todas, no solo con «Fondo»).
