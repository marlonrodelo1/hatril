# Reina-Valera 1909

Aquí van los 66 ficheros del texto bíblico, uno por libro, con el nombre del
`slug` que usa `src/lib/biblia/libros.ts`:

    genesis.json  exodo.json  …  apocalipsis.json

Formato de cada uno — clave el número de capítulo, valor los versículos en
orden y sin numerar dentro del texto:

```json
{
  "1": ["En el principio crió Dios los cielos y la tierra.", "Y la tierra estaba desordenada y vacía…"],
  "2": ["Y fueron acabados los cielos y la tierra…"]
}
```

## Por qué la de 1909 y no la de 1960

La Reina-Valera 1960 es de Sociedades Bíblicas Unidas. Meterla sin licencia en
un producto que se cobra no es una zona gris, y el riesgo no lo corre solo
Hatril: lo corren las iglesias que lo usen. La de 1909 es de dominio público.

El día que se licencie una traducción con derechos, este texto **tiene que
mudarse fuera de `public/`**: lo que hay en esta carpeta lo puede descargar
cualquiera, que es exactamente lo correcto para dominio público y exactamente lo
que no se puede hacer con una traducción licenciada.

## Mientras esto esté vacío

La pantalla `/mi/biblia` funciona: índice, buscador y navegación por capítulos.
Al abrir un capítulo dice que el texto todavía no está cargado, en vez de
enseñar una página en blanco. No se ha metido un ejemplo de tres versículos a
propósito — media Biblia rellena de pruebas es peor que ninguna, porque nadie
sabe qué falta hasta que alguien abre Habacuc un domingo.
