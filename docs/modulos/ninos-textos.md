# Ministerio de Niños — los textos (fase N0)

21 de noviembre de 2026. **Borrador para el abogado. Todavía no está en el
código ni en `/privacidad`.** Sale de `plan-ninos.md` §4.

Se publican tal cual, palabra por palabra: lo que se guarda con cada permiso es
la versión del texto, y si la letra cambia sin cambiar la versión, el registro
miente (`src/lib/rgpd/consentimiento.ts`).

**Versión de todos los textos de este fichero: `ninos-2026-11`.** Va aparte de
`VERSION_POLITICA_PRIVACIDAD`, para que un cambio en lo de los niños no mande a
toda la congregación a `/acepta`.

---

## 1. Lo que ve el padre al pedir el vínculo

En la app, «Mis hijos» → «Tengo un hijo en Niños». Encima de las casillas, la
primera capa de información (RGPD art. 13), corta:

> **Qué pasa con estos datos**
>
> Los guarda **{iglesia}**, que es quien decide sobre ellos. Hatril es el
> programa que usa la iglesia y solo los trata por encargo suyo.
>
> Se guardan el nombre con el que llamáis a tu hijo o hija, su año de
> nacimiento y que eres su madre, su padre o su tutor. Nada más: ni apellidos,
> ni fecha de nacimiento, ni foto de perfil.
>
> Lo ven la responsable del ministerio, sus maestros y el pastor. Ninguna otra
> familia ve a tu hijo ni sabe que lo has apuntado.
>
> Las publicaciones del ministerio, con sus fotos y vídeos, las ven solo las
> familias que el ministerio ha aceptado, dentro de la app, y se borran al año.
>
> Los datos están en servidores de la Unión Europea, en Irlanda.
>
> Pedir esto es voluntario. Tu hijo puede seguir yendo a la clase igual,
> aunque no lo pidas o aunque no des permiso para las fotos.

Las casillas, **las dos sin marcar**:

**Casilla 1, obligatoria para pedir el vínculo:**

> Soy su madre, su padre o su tutor legal, y he hablado de esto con mi hijo o
> hija según su edad. Autorizo a {iglesia} a guardar su nombre y su año de
> nacimiento en el ministerio de Niños y a enseñarme en la app lo que hacen.
> Sé que esto dice algo de las creencias de mi familia, que son datos
> especialmente protegidos, y que se guardan en servidores de la Unión Europea,
> en Irlanda. Puedo retirar este permiso cuando quiera.

Por qué cada trozo:

- «Soy su madre, su padre o su tutor legal»: lo pide la LOPDGDD art. 7.2 por
  debajo de 14 años, y el Decreto 1377 art. 12 en Colombia (el representante
  legal).
- «He hablado de esto con mi hijo o hija según su edad»: el Decreto 1377
  art. 12, «previo ejercicio del menor de su derecho a ser escuchado». Va para
  los dos países: en España no hace daño, y un solo texto es una sola versión.
- «Dice algo de las creencias de mi familia»: RGPD art. 9 y Ley 1581 art. 5.
  Consentimiento explícito.
- «Servidores de la Unión Europea, en Irlanda»: Ley 1581 art. 26, letra a),
  autorización «expresa e inequívoca» para transferir. No se ha podido
  comprobar si la SIC tiene a la UE por país adecuado; con esto no hace falta.

**Casilla 2, opcional:**

> Puede salir en las fotos y vídeos de las actividades del ministerio de Niños.
> Solo los ven, dentro de la app, sus maestros y las familias que el ministerio
> ha aceptado, y se borran al año. Puedo retirar este permiso cuando quiera.

Debajo, en letra normal, para Colombia y para todos (Decreto 1377 art. 6):

> No estás obligado a dar ninguno de estos dos permisos.

**Lo que dice la pantalla después de enviar:**

> Listo. La responsable del ministerio tiene que aceptarlo, y antes querrá
> saludarte en persona. Hasta entonces no verás nada.

---

## 2. Lo que ve el padre después

**En el tablón, al pie:**

> Estas fotos son de los niños de tu iglesia, no solo del tuyo. No las
> compartas fuera de la app.

**En «Mis hijos», junto a cada permiso:**

- «Fotos: sí. Quitar este permiso». Al quitarlo: «Hecho. Desde ahora no saldrá
  en fotos nuevas. Hemos avisado a la responsable para que quite las que ya
  estén publicadas».
- «Dejar de ver lo de Niños». Al confirmar: «Dejarás de ver el tablón. Si nadie
  más de tu familia está vinculado, se borran el nombre y el año de tu hijo o
  hija».

---

## 3. Lo que ve la responsable al aceptar

> **Acepta solo si has comprobado en persona que {nombre} es su madre, su padre
> o su tutor.** Hatril no puede comprobarlo. Si aceptas a quien no es, verá las
> fotos de todos los niños del ministerio.

Y al rechazar: «Se borra la petición entera. {nombre} no recibe ningún aviso
con el motivo».

---

## 4. La casilla del pastor al encender el módulo

> Al encender esta herramienta, {iglesia}, que es la responsable de estos
> datos, se compromete a:
>
> - Comprobar en persona que quien pide ver lo de un niño es su madre, su padre
>   o su tutor, antes de aceptarle.
> - En España, pedir a quienes dan clase el certificado negativo del Registro
>   Central de Delincuentes Sexuales (Ley Orgánica 8/2021, artículos 57 y 59),
>   también si son voluntarios. Hatril no guarda ese certificado.
> - No sacar de Hatril las fotos de los niños para publicarlas en redes, en la
>   web o en grupos de mensajería sin el permiso de sus familias.
> - Guardar con el mismo cuidado lo que descargue al exportar el drive.
>
> Tratar datos e imágenes de menores puede obligar a la iglesia a hacer una
> evaluación de impacto. Si tienes dudas, consúltalo antes de encenderla.

Se guarda en `ministerios.modulos.ninos` quién la marcó, cuándo y la versión.

---

## 5. Lo que ve la responsable al exportar

> Desde ahora estas fotos y vídeos los guardas tú, fuera de Hatril. Ponlos
> donde solo los vea el ministerio, y no los subas a redes sin el permiso de
> las familias. Los de Hatril se borran el {fecha}.

Y el aviso 30 días antes, en la campana y por push:

> El {fecha} se borran {n} fotos y {m} vídeos de {mes}. Si quieres
> conservarlos, descárgalos antes desde el drive.

---

## 6. Lo que cambia en `/privacidad`

**No se toca todavía.** Va en la próxima subida de
`VERSION_POLITICA_PRIVACIDAD`, la que ya espera con consolidación, radio,
OpenStreetMap y Google y Apple. Cuándo, lo decide Marlon. Lo propuesto:

**§3 Qué guardamos**, un párrafo nuevo:

> **Si tu iglesia usa el ministerio de Niños** y pides ver lo de tu hijo o
> hija: su nombre, su año de nacimiento, que eres su madre, su padre o su
> tutor, los permisos que das y cuándo. Y las publicaciones del ministerio, con
> sus fotos y vídeos, que suben los maestros.

**§4 Por qué podemos guardarlos**, un párrafo nuevo:

> Los datos de un niño menor de 14 años solo se tratan con el permiso de su
> madre, su padre o su tutor, y su imagen solo con un permiso aparte, que no es
> obligatorio. Ninguno de los dos condiciona que el niño vaya a la clase.

**§5 Quién más los toca**, un párrafo nuevo:

> Las fotos y vídeos del ministerio de Niños los ven, dentro de la app, sus
> maestros y las familias que el ministerio ha aceptado, nadie más. Nunca salen
> en el muro, en la web de la iglesia ni en el buscador.

**§6 Cuánto tiempo**, una línea nueva:

> Las fotos y vídeos del ministerio de Niños, y las publicaciones en las que
> van, se borran a los doce meses, el día 1 del mes siguiente. Antes, la
> iglesia puede descargarlos; lo que descargue lo guarda ella, fuera de Hatril.
> El nombre y el año de tu hijo se borran cuando dejas de estar vinculado, si
> nadie más de su familia lo está.

**§8 Si estás en Colombia**, un párrafo nuevo:

> Los datos de niños, niñas y adolescentes solo se tratan si responden a su
> interés superior, y con la autorización de su representante legal después de
> haberle escuchado (Decreto 1377 de 2013, artículo 12). Los datos se guardan
> en la Unión Europea, en Irlanda, y la casilla lo dice para que la
> autorización sea expresa.

---

## 7. Lo que cambia en `/terminos`

**§7, el encargo del artículo 28**, en «Qué datos y de quién», un párrafo
nuevo detrás del de la asistencia:

> **Del ministerio de Niños**, si lo enciendes: el nombre y el año de
> nacimiento de los niños, quién es su madre, su padre o su tutor, los permisos
> que dan, y las fotos y vídeos de las actividades. Son datos de menores, su
> imagen y, por el contexto, sus creencias. Se tratan con permiso propio de su
> familia, solo los ven tus maestros, tu pastor y las familias que aceptes, y
> se borran al año.

**§2** no cambia: ya dice que un menor de 14 no tiene cuenta propia y que su
ficha la lleva la iglesia con el permiso de quien ejerza la patria potestad.

---

## 8. Preguntas para el abogado

1. **LO 1/1982, art. 3.2.** Para un menor sin madurez suficiente pide el
   consentimiento por escrito del representante legal y ponerlo antes en
   conocimiento del Ministerio Fiscal. ¿Aplica a fotos de una actividad que solo
   ven las familias aceptadas, dentro de una app cerrada? ¿Basta la casilla?
2. **Uno o los dos progenitores.** La regla del producto: cualquiera de los dos
   pide el vínculo, y para las fotos hace falta el permiso de todos los
   vinculados. Si solo está vinculado uno, vale el suyo. ¿Es suficiente
   (Código Civil, art. 156)?
3. **Base del art. 9.** Hatril, como encargado, se apoya en el consentimiento
   explícito (9.2.a), igual que en el resto del producto. ¿Bien?
4. **Colombia.** ¿Sirve la frase «he hablado de esto con mi hijo o hija según
   su edad» para el derecho del menor a ser escuchado? ¿Y la casilla para la
   autorización expresa de transferir a Irlanda (Ley 1581, art. 26.a)?
5. **Evaluación de impacto.** ¿La necesita la iglesia? ¿Debería Hatril darle
   una plantilla?
6. **LOPIVI art. 48.** ¿Una escuela dominical es una actividad de ocio
   habitual con menores que obliga a nombrar un delegado de protección?
7. **El plazo.** Doce meses (hasta trece, por el borrado mensual). ¿Bien?

---

## Fuentes

Las de `plan-ninos.md`, «Fuentes consultadas el 20-nov».
