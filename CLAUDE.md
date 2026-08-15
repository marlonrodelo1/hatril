@AGENTS.md

# Hatril

SaaS multi-tenant para iglesias. Cada congregación gestiona sus miembros y
ministerios desde un panel web; los miembros se conectan con su iglesia desde
una app móvil (v2). Mercado inicial Colombia y España.

Supabase: proyecto `Hatril` (`qutoggpigkdginvburjv`, eu-west-1).
Repo: https://github.com/marlonrodelo1/hatril

---

## La regla que no se rompe

**Los datos de una iglesia no pueden alcanzar a otra, y eso lo garantiza la base
de datos, no la aplicación.**

La pertenencia religiosa es dato de categoría especial (art. 9 RGPD, y Ley 1581
en Colombia). Una fuga entre congregaciones no es un bug: es una brecha de datos
protegidos que hay que notificar.

De ahí salen casi todas las decisiones raras de este repo.

### Cómo se consulta la base de datos

```ts
// La puerta normal. Aplica la RLS.
const miembros = await withUser(ctx.user.id, (tx) =>
  tx.select().from(miembrosTable)
);

// La puerta de servicio. SALTA la RLS.
const filas = await dbAdmin.select().from(iglesias);
```

No existe un `db` a secas. Hay que elegir, y elegir mal se ve en la revisión.

`withUser` abre una transacción, fija `request.jwt.claims` y hace
`SET LOCAL ROLE hatril_app` — un rol sin BYPASSRLS. Detalle en
`src/lib/db/client.ts` y `src/lib/db/with-tenant.ts`.

`dbAdmin` solo vale para: crons, webhooks, super admin, el alta de iglesia (que
ocurre antes de que exista membresía) y `getCurrentUserContext` (que resuelve la
tabla que las policies consultan). Nada más.

### Antes de dar por buena una migración

```bash
npm run test:aislamiento
```

Y `get_advisors` de Supabase, tipo `security`, sin ningún WARN.

### Al crear una función en Postgres

Nace cerrada desde la migración `0003`. Si de verdad hace falta exponerla:

```sql
grant execute on function public.loquesea() to hatril_app;
```

Nunca a `anon` ni a `authenticated` sin pensarlo dos veces.

---

## Stack

Next 16.3.1 (App Router) · React 19.2.4 · TypeScript estricto · Tailwind 4 ·
shadcn/ui · Drizzle + postgres-js · Supabase (Auth + Postgres + Storage) ·
Stripe · Resend · Zod.

Next se mantiene **al día dentro de la 16.x**: la 16.2.4 arrastra varios CVE de
bypass de proxy y el guard de `/panel` vive ahí.

`src/proxy.ts` es el middleware de Next 16. Según la propia documentación, no
sirve como autorización, solo como comprobación optimista.

---

## Convenciones

- **Español** en nombres de tabla, columna, función y variable de dominio.
  `miembros`, no `members`.
- **Drizzle en toda consulta.** Nada de SQL suelto salvo en migraciones.
- **Zod con `safeParse`** en todo body y query. Error como `{error, detalles}`.
- **Server actions** devuelven errores con `redirect('/ruta?error=' + encodeURIComponent(msg))`.
- **shadcn antes que CSS a medida.** Los tokens están en `globals.css`.
- **Los guards van en el `layout.tsx` de la sección**, no en cada página: así
  quedan cubiertas las rutas dinámicas, que es donde se cuelan los huecos.
- **Comentar el porqué, no el qué.** Lo valioso de este repo es saber qué falló
  antes; el código ya dice lo que hace.

### Migraciones

El repo es la fuente de verdad. Sin excepciones.

```bash
npm run db:generate          # genera el SQL desde el schema
npm run db:generate -- --custom --name loquesea   # migración escrita a mano
npm run db:migrate           # aplica
```

Nada llega a la base de datos sin pasar antes por un fichero versionado. Gonper
aplica medio centenar de `.sql` sueltos con scripts ad-hoc; Pidoo aplicó casi
todo por MCP sin espejarlo, y hoy tiene funciones que sus policies usan y que no
están definidas en ningún archivo.

---

## Sistema de diseño

De Claude Design, proyecto `107021c4-dd85-485d-9cc7-34ef639d92ae`.
Tokens en `src/app/globals.css`. Plus Jakarta Sans.

Tres reglas que el propio sistema declara innegociables:

1. Un solo botón naranja por pantalla.
2. `accent` (#BD4715) y `danger` (#93231F) nunca se tocan. Los errores llevan
   icono, no solo color.
3. Sin degradados ni sombras. La profundidad se hace con bordes de 1px.

**Modo claro únicamente.** El diseño no define paleta oscura y no se inventa una.

Faltan por diseñar: login, registro, onboarding, super admin, directorio de
iglesias, área del miembro y todas las vistas móviles.

---

## Estado

Hecho: schema y RLS aplicados y verificados · núcleo de auth (permisos, guards,
contexto) · alta de iglesia · proxy · Stripe con precios en variables de entorno ·
CI.

Siguiente: pantallas de acceso, panel de miembros, panel de ministerios,
solicitudes de ingreso, dashboard, web pública, checkout.

Fuera de la v1: eventos, finanzas, seguimiento pastoral, informes, feed de
comunidad, notificaciones push, app compilada, multi-sede.

---

## Decisiones que conviene no volver a discutir

**Por qué no se clonó Gonper entero.** Se copió su `src/lib` en bloque y se podó
de 109 ficheros a 42. Fuera todo el dominio de peluquería y marketplace. Clonar
el repo habría traído 40 tablas, 44 páginas de panel y 38 carpetas de `lib` con
el dominio metido en cada nombre, más una RLS decorativa que habría que
desmontar. Borrar es más lento y más peligroso que copiar.

**Por qué `hatril_app` y no `authenticated`.** `authenticated` es el rol que
PostgREST expone al navegador: cualquier permiso que se le dé para que funcione
el servidor queda accesible desde fuera con la publishable key y un JWT. Un
`GET /rest/v1/miembros?select=*` devolvería la congregación entera.

**Por qué `iglesia_id` explícito también en las tablas hijas.** Redundante, sí, y
un trigger lo valida. A cambio, cada policy es una comparación directa en vez de
una subconsulta encadenada de tres niveles con un índice por salto.

**Por qué los precios están en variables de entorno.** La competencia va de 9 a
70 USD/mes escalados por número de miembros, y el precio de este mercado está sin
validar. Va a cambiar varias veces y ningún cambio debe costar un despliegue.

**Ideas rescatadas de Gonper que todavía no están implementadas** y que hay que
recuperar cuando toque el muro de suscripción:

- *Gracia de lectura de 3 días.* Al vencer el trial se bloquea escribir, pero
  consultar sigue funcionando tres días más. Cerrar de golpe deja a una iglesia
  sin su fichero un domingo por la mañana por un recibo devuelto el viernes.
- *402 y no 403.* El 403 significa «tu rol no llega». Una cuenta sin pagar es
  otra cosa y merece su propia pantalla, no un «no tienes permiso» que confunde.
- *Nunca se bloquea lo que sirve para pagar ni para darse de baja.*
