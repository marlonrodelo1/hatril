# Google Maps en Hatril

Decidido por Marlon el 23-nov: direcciones con sugerencias de Google, mapa en
la ficha de cada iglesia y mapa con pines en «cerca de mí». En la web y en la
app empaquetada.

## Qué usa y dónde

| Qué | API de Google | Dónde se llama | Clave |
|---|---|---|---|
| Sugerencias al escribir una dirección («cerca de una dirección» y Ajustes) | Places API (New): Autocomplete y Place Details | **Nuestro servidor** (`src/lib/lugares/google.ts`), por `/api/v1/lugares/*` (web) y `/api/v1/app/lugares/*` (app) | `GOOGLE_MAPS_CLAVE_SERVIDOR`, secreta |
| El mapa (ficha y «cerca») | Maps JavaScript API | **El teléfono**, dentro de un iframe de `https://hatril.com/mapa` (`src/app/mapa/route.ts`) | `GOOGLE_MAPS_CLAVE_NAVEGADOR`, pública |
| Los pines de colores | Map ID | El mismo iframe | `GOOGLE_MAPS_MAP_ID` |
| «Ir» / cómo llegar | Ninguna: un enlace a `google.com/maps` | — | — |

Las tres variables van en **Environment** de Dokploy, **no** en Build-time: se
leen al pedir cada página, así que cambiarlas no obliga a compilar ni a sacar
otra versión de la app. Sin ellas no se rompe nada: la dirección de Ajustes es
texto libre, el mapa no aparece y «cerca de una dirección» dice que no está
disponible.

### Por qué dos claves

- **La del servidor es secreta** y va restringida a la IP del VPS. El teléfono
  no habla con Google para las sugerencias: Google no ve su IP ni le pone
  cookies, y no hace falta pedir consentimiento.
- **La del mapa es pública** (va en la página) y va restringida a
  `https://hatril.com/*`. Por eso el mapa vive en hatril.com y la app lo mete
  en un iframe: la app de iOS sirve sus pantallas desde `capacitor://localhost`,
  que Google no admite como origen, y el WebView de iOS ni siquiera manda la
  cabecera Referer desde ahí. Una clave restringida «a la app» no funcionaría
  en el iPhone, y una sin restringir se la puede llevar cualquiera.

### Lo que hay que saber de las condiciones de Google

- **Las coordenadas de Places solo se pueden guardar 30 días** (condiciones
  por servicio, §14.3). El identificador del sitio sí, sin límite. Por eso
  `iglesias` guarda `lugar_google_id` y `coordenadas_google_en` (migración
  `0063`), y el cron `POST /api/v1/cron/lugares` las vuelve a pedir a los 25
  días o las borra a los 30. Si el cron no corre, la iglesia deja de salir en
  «cerca» a los 30 días (`src/lib/lugares/vigencia.ts`): es lo seguro.
- Las coordenadas que pone el pastor (su móvil o pegadas) no son de Google y
  no caducan.
- Las sugerencias sin un mapa de Google al lado llevan «Google Maps» debajo.

## Lo que cuesta

Precios de Google a 23-nov
(<https://developers.google.com/maps/billing-and-pricing/pricing>). Cada tipo
de consulta tiene su cupo gratis al mes:

| Consulta | Gratis al mes | Después, cada mil |
|---|---|---|
| Sugerencias (Autocomplete Requests) | 10.000 | 2,83 $ |
| Detalle con ubicación (Place Details Essentials) | 10.000 | 5,00 $ |
| Abrir un mapa (Dynamic Maps) | 10.000 | 7,00 $ |

Con el uso de hoy, 0 €. Una búsqueda escrita letra a letra son unas seis
sugerencias y un detalle; abrir el mapa es una carga, moverlo no cuenta.

## Cómo quedó montado (23-nov)

- Proyecto **`hatril-mapas`** (ID `hatril-mapas`), en la cuenta de Google de
  siempre (la de la M), facturado a **«Pago de Firebase»**: «Mi cuenta de
  facturación» ya estaba en tres proyectos, que es el máximo que deja.
- Claves: **«Hatril servidor»** (Places API (New), IP del VPS y la de casa) y
  **«Hatril mapa»** (Maps JavaScript API, `https://hatril.com/*` y
  `http://localhost:3000/*`). Las dos en `.env.local` y en Dokploy
  (Environment), comprobadas en hatril.com el 23-nov.
- Queda por hacer: borrar la clave **«Maps Platform API Key»** que Google creó
  sola al habilitar (sin restringir, con 32 APIs), el Map ID (paso 18), los
  topes (pasos 20-22) y el cron.
- Si la IP de casa cambia, las sugerencias dejan de funcionar en local con un
  502: se actualiza en la clave «Hatril servidor».
- En otra cuenta de Google se creó por error `hatril-mapas-515618`, sin
  facturación ni APIs. No se usa.

## Pasos en Google Cloud (Marlon)

Un proyecto **nuevo**, no `hatril-3ac0c`: activar la facturación en el de
Firebase lo pasaría del plan gratis al de pago por uso.

1. Abre <https://console.cloud.google.com/projectcreate>.
2. En «Nombre del proyecto» escribe `hatril-mapas` y pulsa **Crear**.
3. Arriba a la izquierda, en el selector de proyectos, elige `hatril-mapas`.
4. Abre <https://console.cloud.google.com/billing/linkedaccount>, pulsa
   **Vincular una cuenta de facturación** y elige la tuya (o crea una con tu
   tarjeta).
5. Abre <https://console.cloud.google.com/apis/library/places.googleapis.com>
   y pulsa **Habilitar**.
6. Abre <https://console.cloud.google.com/apis/library/maps-backend.googleapis.com>
   (Maps JavaScript API) y pulsa **Habilitar**.

**La clave del servidor**

7. Abre <https://console.cloud.google.com/apis/credentials>.
8. Pulsa **+ Crear credenciales** → **Clave de API**. Se abre una ventana con
   la clave: pulsa **Editar clave**.
9. Nombre: `Hatril servidor`.
10. En «Restricciones de aplicaciones» marca **Direcciones IP**. Añade
    `187.124.37.206` (el VPS) y, para probar en tu ordenador, tu IP de casa
    (la ves en <https://www.whatismyip.com/>).
11. En «Restricciones de API» marca **Restringir clave** y elige solo
    **Places API (New)**.
12. Pulsa **Guardar**. Copia la clave (botón **Mostrar clave**).

**La clave del mapa**

13. Otra vez **+ Crear credenciales** → **Clave de API** → **Editar clave**.
14. Nombre: `Hatril mapa`.
15. En «Restricciones de aplicaciones» marca **Sitios web** y añade dos:
    `https://hatril.com/*` y `http://localhost:3000/*`.
16. En «Restricciones de API» → **Restringir clave** → solo **Maps JavaScript
    API**.
17. **Guardar**, y copia la clave.

**El Map ID** (para los pines de colores)

18. Abre <https://console.cloud.google.com/google/maps-apis/studio/maps>.
19. Pulsa **Crear ID de mapa**. Nombre `Hatril`, tipo **JavaScript**,
    **Vectorial**. **Guardar**, y copia el ID.

**El tope de gasto**

20. Abre <https://console.cloud.google.com/apis/api/places.googleapis.com/quotas>.
    En cada fila que acabe en **per day**, pulsa el lápiz y pon `1000`.
21. Lo mismo en
    <https://console.cloud.google.com/apis/api/maps-backend.googleapis.com/quotas>.
22. Abre <https://console.cloud.google.com/billing/budgets>, **Crear
    presupuesto**, importe `5` €: te avisa por correo si se acerca.

**Dónde pegarlas** (nunca en el chat ni en el código)

23. En `.env.local`, para probar en tu ordenador:

    ```
    GOOGLE_MAPS_CLAVE_SERVIDOR=la-del-paso-12
    GOOGLE_MAPS_CLAVE_NAVEGADOR=la-del-paso-17
    GOOGLE_MAPS_MAP_ID=el-del-paso-19
    ```

24. En Dokploy, en la aplicación de Hatril → **Environment** (no Build-time) →
    las mismas tres líneas → **Save** → **Deploy**.

## El cron

`POST /api/v1/cron/lugares` una vez al día, con
`Authorization: Bearer $INTERNAL_API_TOKEN`, como el de las bajas y el de
Niños. Hasta que esté programado, las iglesias que eligieron su dirección de
Google desaparecen de «cerca» a los 30 días.
