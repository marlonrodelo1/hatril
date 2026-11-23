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

## De dónde sale

De eBible.org, el fichero `spaRV1909_vpl.zip` (texto solo, sin notas ni
títulos), descargado el 30-oct-2026: 66 libros y 31.102 versículos. Dominio
público.

Al convertirlo se hicieron dos cosas, y ninguna más:

- **Los corchetes fuera.** La 1909 imprimía en cursiva las palabras que los
  traductores añadían para que la frase se entienda («las aguas que [están]
  debajo»); el fichero las trae entre corchetes. Se quitan los corchetes y se
  quedan las palabras, que es como se leen.
- **La mayúscula de inicio de capítulo.** El impreso abre cada capítulo con la
  primera palabra en versalitas, y el fichero la trae en mayúsculas, a veces
  varias y detrás de una «Y» o una «E» («EN el principio», «DE SIETE años», «Y
  ACONTECIÓ que», «Y SALOMÓN hizo»). Cada palabra recupera la forma con la que
  sale en el resto del texto: «En el principio», «Y aconteció que», «Y Salomón
  hizo». Las mayúsculas que son del propio texto («ESTE ES JESUS EL REY DE LOS
  JUDIOS», «Alabad á JAH») y los encabezados del Salmo 119 («ALEPH.») se quedan
  como están.

Los títulos de los salmos van dentro del versículo 1, como en el fichero de
origen: «Salmo de David. Jehová es mi pastor».

Para volver a generarlo: el script de conversión no se guardó en el repo, pero
son sesenta líneas — leer el VPL línea a línea (`GEN 1:1 texto`), agrupar por
libro y capítulo en el orden de `src/lib/biblia/libros.ts`, comprobar que el
número de capítulos coincide y aplicar las dos limpiezas de arriba.
