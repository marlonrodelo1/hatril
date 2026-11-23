# Ministerio de Células — plan (23-nov)

Aprobado por Marlon el 23-nov. Lo que se hizo y lo que queda, en
`estado-celulas.md`.

## Contexto

Marlon pide el ministerio de células: el pastor lo activa y encarga a los
líderes de célula; cada líder trabaja desde la pestaña **Equipo**, en la web y
en la app; comparte la iglesia para que la gente entre; tiene a su gente a la
vista para **llamarla o escribirle por WhatsApp**, también a toda la célula; y
pregunta cómo distinguir a quien va a una célula.

**La v1 de células ya existe y nunca se fusionó.** Rama
`claude/awesome-driscoll-58a8cc` (22-23 oct), worktree
`.claude/worktrees/awesome-driscoll-58a8cc`, estado en
`docs/modulos/estado-celulas.md`:

- Pieza genérica `grupos` (`grupos`, `grupo_miembros`, `grupo_semanas`,
  `grupo_guias`, `solicitud_invitaciones`), tipo `celulas`, RLS por relación:
  el líder ve solo su célula; el participante, solo a quien la lleva.
- Panel de la red; app del líder (reporte semanal en un toque, temas,
  invitar); «Tu célula» en Mi cuenta; invitación por enlace hacia `/solicitar`
  que deja a la persona en la célula al aprobarla.
- Dos revisiones adversariales y verificado en el navegador a 375 px.
- **Migraciones 0046-0051 aplicadas en la base de producción; 0048-0051 y
  1.256 líneas de código sin commitear desde el 23-oct**: solo existen en el
  disco de esa worktree.
- `main` siguió 36 commits: 0052-0062, la app pasó a SPA empaquetada
  (`movil/`) y Betania se borró (la semilla y las pruebas de células cuelgan de
  ella).

**Decidido por Marlon el 23-nov:**

1. El líder ve **nombre y teléfono de la gente de SU célula**, con Llamar,
   WhatsApp y «Escribir a la célula». Nada de otras células. Cambia lo que
   decía `docs/modulos/plan.md` §5 («sin teléfonos para el líder en la v1»).
2. El líder **no da de alta a nadie**: comparte el enlace y cada persona entra
   con su propio consentimiento. Se queda como está.
3. Asistencia **por recuento** (cuántos vinieron y cuántas visitas). Se queda
   como está.

No se empieza de cero: se rescata, se fusiona y se amplía.

## Recomendación: quien va a una célula

Marlon preguntó qué recomiendo.

- **El mismo acceso que cualquiera de la iglesia**: comunidad, devocional,
  agenda, Biblia. Recortárselo iría contra lo que se busca, que conozca la
  iglesia.
- **Sin etiqueta pública en el muro.** Hoy la base protege quién va a qué
  célula: solo lo ven la red y el pastor. Una insignia «Célula Los Pinos» en el
  muro se lo enseñaría a toda la congregación.
- **Lo que le distingue lo ve él y lo ven quienes le cuidan.** Él: «Tu célula»
  (quién la lleva, día, hora, zona, tema de la semana). El pastor y la red:
  «Va a Los Pinos» en su ficha y un filtro «Va a célula» en Miembros (fase 4).

## Lo que pide Marlon frente a lo que hay

| Pide | En la rama | Falta |
|---|---|---|
| El pastor activa el ministerio | Tipo «Células» en `/panel/modulos` | — |
| El pastor encarga a los líderes | Crear célula eligiendo líder **del equipo** de la red | Elegirlo de toda la congregación (fase 3) |
| El líder, en la web y en la app, en Equipo | Solo web `/mi/equipo`, anterior a la SPA | Fase 1 |
| Compartir la iglesia, invitar | Enlace con código + WhatsApp hacia `/solicitar` | Que sirva también a quien ya es de la iglesia (fase 3) |
| Control de su gente | Nombres y recuento semanal | Teléfonos (fase 2) |
| Llamar y WhatsApp, también a todos | No | Fase 2 |
| Enterarse de quién entra | No | Aviso al líder (fase 3) |
| Distinguir a quien va a célula | «Tu célula» en Mi cuenta | Ficha y filtro en el panel (fase 4) |

---

## Fases

Todo se trabaja en la worktree de la rama de células. Lo que lleva migración
va de uno en uno (`docs/modulos/cola.md`): **siguiente migración 0063,
siguiente código HT145**, y antes de aplicar se mira que ninguna otra sesión
esté aplicando.

### Fase 0 — Poner a salvo lo que hay (lo primero)

1. En la worktree, commit de todo lo pendiente del 23-oct: las cuatro
   migraciones con sus snapshots y los 23 ficheros tocados (no
   `.claude/launch.json`). Son tablas de producción cuyo SQL vive solo en un
   disco: un `clean_up_worktrees` se lo llevaría.
2. Push de la rama a `origin`, para tener copia fuera de este ordenador.
   Antes, grep de contraseñas (la semilla solo nombra «la de siempre de la
   demo», sin escribirla).
3. Copiar este plan a `docs/modulos/plan-celulas.md` y corregir `plan.md` §5
   con lo decidido el 23-nov.

Hecho cuando: `git status` limpio en la worktree y la rama en `origin`.

### Fase 1 — Fusionar con `main` y poner las células en la app

**Migraciones** (receta en la cabecera de `drizzle/0052_registro_admin.sql`):

- Journal: las seis entradas de células, luego 0052-0062, en ese orden (manda
  el `when`, no el número; la base ya tiene todo aplicado y el migrador no
  repetirá nada).
- Snapshots: el `prevId` del 0052 pasa a ser el `id` del 0051
  (`61ac401b-…`), y las cinco tablas de células más `rol_grupo_enum` y
  `estado_semana_grupo_enum` entran en **todos** los snapshots 0052-0062
  (copiados del 0051), con un script, no a mano. La cabecera de la 0052 solo
  habla del suyo, pero `generate` compara contra el último: sin ellas en el
  0062, la 0063 volvería a crear `grupos`, como pasó con la 0034-0036.
- Comprobar con `npx drizzle-kit check` y un `db:generate` que diga «sin
  cambios». Los códigos HT132-HT134 de células no los usa nadie en `main`
  (allí van de HT135 a HT144).

**Conflictos de código**: 21 ficheros tocados por los dos lados. Tres piden
rehacer, no solo resolver:

- **`/solicitar`**: `main` lo pasó a un formulario de tres pasos
  (`pasos-solicitud.tsx`) y la lógica a `src/lib/solicitudes/alta.ts`
  (`registrarSolicitud`) y `src/lib/app-api/solicitud.ts`. El aviso «Vienes
  con la invitación de…», el campo oculto `grupo` y su guardado en
  `solicitud_invitaciones` se vuelven a poner encima, también en
  `crearCuentaYSolicitar`.
- **«Tu célula» en Mi cuenta**: `main` la partió en `datos.ts` y
  `_components/vista-cuenta.tsx`, compartidas con la app por
  `/api/v1/app/mi/cuenta` (`RespuestaCuenta`). La tarjeta va ahí, y así sale
  igual en la web y en la app sin hacerse dos veces (congelación de `/mi`).
- **Las pruebas**: ver «Pruebas sin Betania».

El resto es trivial (journal, `error.ts`, `schema/index.ts`, pestañas, `/mi`
con su parámetro nuevo). En `modulos.ts` los dos lados dicen «Siete módulos»:
ahora son ocho. Niños no choca con grupos (tablas, enums y claves distintas) y
dejó sus clases por edad para cuando esta pieza esté en `main`.

**Las pantallas al patrón de la SPA** (receta: Niños N5, commit `a325339`):

- Las tres pantallas de `src/app/mi/equipo/[id]/grupos/**` se parten en
  `datos.ts` (`server-only`, `cargar()` con la guarda `requireGrupoEnLaApp` y
  `exigirUuid` dentro, y el `getOrigin()` que hoy está en la página),
  `vista.tsx` (solo pintar, con `MarcoEquipo` y `BotonEnlace`) y un `page.tsx`
  fino.
- Se registran en cuatro sitios: `PANTALLAS_EQUIPO`
  (`src/lib/app-api/equipo.ts`), `CARGAS`
  (`src/app/api/v1/app/mi/equipo/[[...ruta]]/route.ts`), `VISTAS`
  (`movil/src/pantallas/mi/equipo.tsx`) y `MODULOS_DE_ACCIONES`
  (`src/lib/api/acciones-app.ts`, claves `'mi/equipo/[id]/grupos'` y
  `'mi/equipo/[id]/grupos/[grupoId]'`). La app cambia cada `actions.ts` por una
  llamada a `/api/v1/app/accion`: una action del panel ahí da 404, así que lo
  de la app va envuelto con `enLaApp()` en su `actions.ts` de `/mi`.
- El adaptador de grupos en `ADAPTADORES`
  (`src/lib/ministerios/en-la-app/registro.ts`), con el contrato de `main`.

**Pruebas sin Betania:**

- `scripts/seed-celulas.sql` no entra en `main` (los seeds se borraron el
  21-nov). Lo que montaba —una red, dos células, líder, colíder,
  participantes— pasa a `scripts/pruebas/demo.mjs`, en sus iglesias de usar y
  tirar. Su borrado ya vacía las tablas `grupo_*` (línea 94); falta `grupos`
  en `ORDEN_BORRADO` si no está, porque se audita.
- `comprobarCelulasConLaDemo` (`test-aislamiento.ts`) lee las cuentas fijas de
  Betania: se reescribe sobre `conDemo`, con las 42 comprobaciones SQL y las 5
  por `withUser()`. Las rutas nuevas, en `test:puertas` (también su lista
  `ajenos`) y `test:puertas:app`.

**Entrar en `main`**: solo cuando ninguna otra sesión tenga cambios sin
commitear en los mismos ficheros (hoy los hay en `/mi/equipo/turnos` y
`src/lib/api/app.ts`). Push a `main` → Dokploy despliega solo.

Hecho cuando: todo en verde (ver «Verificación») y células en `main`.

### Fase 2 — Teléfono, Llamar y WhatsApp

- **Quién ve el teléfono**: quien lleva esa célula (líder y auxiliares), la
  red y el pastor. El participante, nunca el de otro. Lo decide `cargar()` de
  la pantalla de la célula, que ya sabe en qué modo entra cada uno; la RLS de
  `miembros` es por iglesia, así que **la guarda es la única puerta** y la
  prueba tiene que demostrarlo.
- **Su gente**: cada persona con dos botones, Llamar (`tel:`) y WhatsApp
  (`wa.me/<E.164>`), con nombre accesible («Llamar a Lucía»). Sin teléfono
  válido, «Sin teléfono». Desde el 19-nov `/solicitar` lo pide obligatorio,
  así que quien entra por el enlace siempre lo trae.
- **Escribir a la célula**: un texto ya redactado (día, hora y tema de la
  semana) que se puede cambiar, y un botón que abre WhatsApp con él para
  elegir el grupo de la célula o varias personas (`enlaceWhatsapp(texto)` de
  `src/lib/url/absoluta.ts`). No se guarda nada. **El límite de WhatsApp**:
  no deja mandar un mensaje a varios números desde fuera sin su API de pago,
  así que se manda al grupo de WhatsApp de la célula, que casi todas tienen.
- **Un solo ayudante**: sacar el `enlaceWhatsApp(telefono)` privado de
  `panel/ministerios/[id]/seguimiento/[miembroId]/page.tsx:380` a
  `src/lib/telefono/` junto a `normalizarTelefono`, y usarlo en seguimiento y
  en células.
- **En la app nativa**: comprobar en el emulador que `tel:` abre el marcador y
  `wa.me` abre WhatsApp desde el WebView. Si no, pasar por `abrirFuera`
  (`movil/src/lib/fuera.ts`).
- **Legales**: `/privacidad` (el párrafo de células): quien lleva tu célula ve
  tu nombre y tu teléfono para llamarte o escribirte. Y `/solicitar` con
  invitación lo dice antes de enviar.
- Quitar el comentario «SIN TELÉFONOS NI ALTAS» de la pantalla de la célula y
  dejar el porqué nuevo: lo decidió Marlon el 23-nov.

### Fase 3 — Cerrar el círculo de la invitación

- **Unirse desde dentro.** Quien ya es de la iglesia y abre el enlace hoy lee
  «pídeselo a quien lleva la red». Pasa a ver «Unirte a Los Pinos», con el
  aviso del teléfono, y entra como participante. Función `security definer`
  `unirse_a_grupo(codigo)` en su migración, revocada a todos y concedida solo
  a `hatril_app`, con las mismas comprobaciones que al aprobar
  (`motivoDeLaInvitacion`): grupo abierto, red activa, módulo encendido,
  código vigente, ficha viva, y no ir ya a otra célula de esa red. Código
  HT145 para «no puedes unirte».
- **Aviso al líder**: valor nuevo `grupo_nuevo_integrante` de
  `tipo_notificacion_enum`, en su propia migración (`db:generate`). Salta al
  aprobar con invitación, al unirse desde dentro y cuando la red suma a alguien.
  Va al líder y a los auxiliares, con su texto en `notificaciones/textos.ts`,
  la push de siempre (`emitirNotificacion`, después de escribir y fuera de la
  transacción) y el enlace traducido a la app.
- **Encargar en un paso**: en «Nueva célula», el pastor o la red eligen al
  líder de toda la congregación, y si no está en el equipo de la red entra
  como voluntario en la misma transacción (HT132 lo sigue exigiendo).

### Fase 4 — La distinción en el panel

- En la ficha del miembro: «Va a Los Pinos» (el pastor ve todas; la red, las
  suyas, que es lo que ya deja la RLS).
- En `/panel/miembros`: filtro «Va a célula / No va a ninguna».

### Después, fuera de esta tanda (por orden)

1. La reunión de la célula en la Agenda de quien va (tipo de día nuevo en
   `calendario.ts`).
2. Aviso «tu célula no ha reportado» (otro valor del enum y un cron, que
   todavía no hay ninguno programado).
3. El enlace del grupo de WhatsApp de la célula, visible a su gente.
4. Aviso push del líder a toda su célula, dentro de Hatril.
5. Que el enlace abra la app si está instalada (App Links / Universal Links).
6. Multiplicación de células (célula madre, supervisores): sin G12 impuesto.

## Lo que decide Marlon, no el código

- **Subir `VERSION_POLITICA_PRIVACIDAD`.** Con células se suman al texto
  pendiente (consolidación, radio) quién ve la célula y ahora el teléfono.
  Antes de subirla, guardar la negativa de asistencia como fila (la trampa de
  `ESTADO.md`).
- **Build nuevo de la app.** Las pantallas de la SPA van dentro del binario:
  hasta que salga el build con células, el líder trabaja desde hatril.com, y
  en la app vieja la tarjeta de la célula lleva a «No existe». Publicar el
  build justo después de desplegar.

## Verificación

**Automática** (sin servidor de desarrollo encendido al compilar):
`npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`,
`npm run test:aislamiento`, y con `npm run dev`, `test:puertas`,
`test:puertas:app` y `test:puertas:admin`. Cada prueba monta sus iglesias con
`demo.mjs`: **nunca contra Cuerpo de Cristo**, que es real, y la base de local
es la de producción. `get_advisors` no tiene permiso desde el MCP: comprobar
a mano `has_table_privilege` de anon, authenticated y service_role y el
`proacl` de las funciones nuevas.

Comprobaciones nuevas que tienen que estar:

- El líder de una célula no recibe los teléfonos de otra, ni por la web con
  `RSC: 1` ni por la API de la app.
- El participante no recibe el teléfono de nadie.
- `unirse_a_grupo`: grupo cerrado, red archivada, módulo apagado, código
  cambiado, ya en otra célula de la red y persona de otra iglesia, todos
  rechazados.

**Ejecutándolo** (en el Chrome de Marlon, a 375 px; cada escritura,
comprobada en la base con quién la firmó):

1. Pastor: activa Células, crea una célula eligiendo líder de la congregación.
2. Líder (rol miembro): Equipo → su célula, reporte, temas; su gente con
   teléfono; Llamar, WhatsApp y Escribir a la célula abren lo que deben. Otra
   célula: 404, sin un nombre ni un teléfono.
3. Participante: Mi cuenta → Tu célula, sin teléfonos.
4. Alguien nuevo con el enlace: crea cuenta, lee lo del teléfono, el pastor
   aprueba, queda en la célula y al líder le llega el aviso.
5. Alguien de la iglesia con el enlace: «Unirte», entra, aviso al líder.
6. Lo mismo en la SPA (Chrome contra la API local) y en el emulador de
   Android para `tel:` y `wa.me`.
