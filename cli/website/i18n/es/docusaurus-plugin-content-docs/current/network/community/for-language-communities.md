---
sidebar_position: 1
title: "Para Comunidades Lingüísticas"
---

# Para comunidades lingüísticas

> **Resumen ejecutivo.** Su comunidad puede poseer su propio conjunto de prueba —la "clave de respuestas" con la que se evalúa cada método de traducción— y organizar su propio concurso bajo sus propios términos, sin tener que entregar nunca los datos. Esta página explica lo que la Red solicita a las comunidades lingüísticas (traducciones de referencia, revisión de traducciones, datos de entrenamiento guiado), lo que usted recibe a cambio (trabajo remunerado a tarifas publicadas una vez que el proyecto cuente con financiamiento —hoy no se retienen fondos—, además de la propiedad del código y el control total de la implementación), y las medidas de protección a la soberanía que se priorizan ante todo. No se requiere experiencia en programación. Algunas protecciones están integradas directamente en el software y en la base de datos; otras son compromisos en curso, y en [Limitaciones honestas](/docs/network/honest-limitations) se detalla cuáles son.

No necesita ser programador para contribuir a la Red. Si habla una lengua indígena o de pocos recursos, usted es la persona más importante en este ecosistema.

---

## La soberanía viene primero

Antes de pedirle cualquier cosa, la regla fundamental: **los datos de su idioma son suyos.** Los datos lingüísticos son *biodatos* —portan la identidad y las relaciones de su comunidad y no pueden anonimizarse de manera significativa—, por lo que las personas que los proporcionan poseen las llaves de acceso a ellos y a cualquier elemento que se mida con respecto a ellos. La Red está construida sobre los [principios de soberanía de datos indígenas](/docs/network/sovereignty/data-sovereignty):

- Nunca recopilamos ni almacenamos sus datos lingüísticos en nuestros servidores
- Los métodos de traducción utilizan la arquitectura `api` — todos los datos de entrenamiento, diccionarios y reglas gramaticales permanecen en infraestructura que usted controla
- Usted decide quién puede desarrollar métodos para su lengua
- Las puntuaciones del marcador de posiciones prueban que un método funciona; no otorgan permiso para implementarlo

:::note[Dónde estamos hoy]
El modelo de transferencia de propiedad descrito a continuación es un **diseño comprometido, no aún un programa en funcionamiento.** La tabla de clasificación está abierta para envíos y actualmente no tiene ejecuciones publicadas, y ningún método ha sido transferido a una comunidad aún. Describimos cómo está construido para funcionar para que pueda exigirnos que lo cumplamos — no para sugerir que ya está en movimiento. La relación, y su autoridad sobre sus datos, vienen primero; el resto se deriva de allí.
:::

---

## Sea propietario de su conjunto de pruebas

La posición más fuerte que una comunidad puede ocupar en este sistema es **ser propietaria del
punto de referencia en sí mismo**. Un conjunto de pruebas es la clave de respuestas: quien lo posee decide
qué significa "buena traducción" para la lengua, y cada método — el nuestro,
el de una corporación, el de cualquiera — se mide contra *su* estándar.

- **El registro es metadatos, no contenido.** Registrar un corpus con la
  Red significa publicar una tarjeta descriptiva — nunca cargar el corpus.
  Usted elige su [carril de exposición](/docs/network/sovereignty/registering-corpora):
  abierto, restringido, o completamente soberano.
- **Los puntos de referencia soberanos permanecen secretos.** En el carril soberano, el conjunto de pruebas
  nunca sale de la infraestructura comunitaria y nunca lo vemos. Los métodos se
  califican contra él en su lado; solo la puntuación viaja.
- **Puede ejecutar su propio concurso.** El manual paso a paso —
  [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
  — lo guía a través de la realización de una evaluación controlada por la comunidad en sus propios
  términos: su conjunto de pruebas, sus reglas, su decisión sobre qué (si algo)
  se publica.

Las garantías detrás de todo esto están estipuladas por escrito, no sobreentendidas:
[Custodia de datos](/docs/network/sovereignty/data-sovereignty) (la postura
sobre soberanía de datos/principios CARE y lo que nos prohíbe hacer) y
[Propiedad y términos](/docs/network/sovereignty/ownership-transfer) (lo que
ocurre contractualmente cuando un método resulta ganador).

---

## Qué necesitamos de usted

### Traducciones de referencia

Necesitamos pares de traducción curados para evaluación — inglés de un lado, su lengua del otro. Estos se convierten en la "clave de respuestas" contra la cual se califican todos los métodos de traducción.

Podría crear estos a partir de:
- **Materiales educativos** — ejercicios de libros de texto, planes de lecciones, hojas de trabajo
- **Documentos comunitarios** — actas de reuniones, boletines, anuncios
- **Frases cotidianas** — cadenas de interfaz, etiquetas de aplicaciones, expresiones comunes
- **Contenido cultural** — historias, canciones o descripciones (con permisos apropiados)

El formato es JSON simple:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Revisión de traducciones

Cada método que afirma producir traducciones funcionales necesita validación humana. Los hablantes bilingües revisan los resultados y nos dicen si la computadora lo hizo bien — y más importante aún, *por qué* lo hizo mal.

### Datos de entrenamiento

Reglas gramaticales, entradas de diccionario, patrones morfológicos — estos son los recursos lingüísticos que hacen que los métodos de traducción funcionen. Su conocimiento de cómo funciona su lengua es irreemplazable por cualquier modelo de IA.

---

## Qué recibe a cambio

### Propiedad

Cuando se construye un método de traducción para su lengua y se valida en la Red, la [propiedad se transfiere](/docs/network/sovereignty/ownership-transfer) a la organización de gobernanza de su comunidad. Usted es propietario del código, los pesos del modelo y la implementación.

### Trabajo remunerado, no extracción

La creación de corpus y la revisión de traducciones constituyen trabajo profesional, a ser remunerado a
[tarifas publicadas](/docs/network/perspectives/how-speakers-get-paid) una vez que se cuente con fondos
(hoy en día no se retienen fondos), y el pago no compra sus datos. A usted se le paga por el trabajo *y* conserva la
propiedad de lo que construya. Champollion es un proyecto de investigación no comercial: no
vende nada, no tarifica el uso de servicios y [no toma participación alguna](/docs/network/sovereignty/economic-model)
de lo que su comunidad llegue a percibir a partir de un método del que sea propietaria.

### Control

Su organización de gobernanza controla:
- Quién puede acceder al método
- Si puede ser usado comercialmente — y si es así, en sus términos, manteniendo todo lo que gane
- Cuándo y cómo se actualiza
- Qué datos se utilizan para desarrollo adicional

---

## Cómo involucrarse

:::tip[Algo que los hablantes pueden hacer hoy — si la comunidad está de acuerdo]
Champollion no crea ni aloja corpus: los datos de prueba siempre se obtienen
directamente de su fuente original. Si los hablantes de su comunidad desean aportar oraciones
*ahora mismo*, [Tatoeba](https://tatoeba.org) acepta aportaciones
oración por oración en cualquier idioma, y colecciones abiertas como
[OPUS](https://opus.nlpl.eu/) recopilan texto paralelo a partir del cual la Red genera
evaluaciones comparativas (benchmarks). Las oraciones que se agreguen allí pueden convertirse en datos de evaluación aquí.

Conozca primero las condiciones del intercambio: Tatoeba publica oraciones bajo una licencia abierta
(CC BY 2.0 FR de forma predeterminada), por lo que cualquiera puede copiarlas —incluido el entrenamiento de modelos de
IA— y las copias ya realizadas no se pueden revocar. Esa puede ser la opción
adecuada para oraciones de uso cotidiano. Para cualquier contenido que su comunidad desee mantener
bajo su propio control, conserven los datos ustedes mismos y utilicen en su lugar un
[conjunto de prueba sellado](/docs/network/sovereignty/run-a-sovereign-contest).
Una aplicación de contribución directa para hablantes y una herramienta de creación de corpus están planificadas, pero
aún no se han construido.
:::

1. **Póngase en contacto** — Abra una incidencia (issue) en el [repositorio de la Red](https://github.com/gamedaysuits/Champollion) o escriba a [info@champollion.dev](mailto:info@champollion.dev)
2. **Describa su idioma** — ¿A qué familia pertenece? ¿Cuántos hablantes tiene? ¿Qué sistemas de escritura se utilizan? ¿Qué recursos computacionales existen (FST, diccionarios, corpus)?
3. **Comience con poco** — Incluso 50 pares de traducción curados son suficientes para crear un conjunto de datos de evaluación y abrir una nueva categoría en la tabla de clasificación. El trabajo de corpus se [remunera a tarifas publicadas](/docs/network/perspectives/how-speakers-get-paid) una vez financiado; hoy no se retienen fondos
4. **Manténgalo bajo su propiedad** — Registre el corpus como metadatos en el carril que elija ([Registro de corpus](/docs/network/sovereignty/registering-corpora)); si desea que el conjunto de prueba sea totalmente secreto, el [manual de procedimientos para concursos soberanos](/docs/network/sovereignty/run-a-sovereign-contest) es el camino a seguir
5. **Conéctenos con las instancias de gobernanza** — ¿Quién en su comunidad tiene autoridad sobre los datos lingüísticos y la tecnología? El modelo de soberanía de la Red requiere un socio de gobernanza

---

## Consulte también

- [Organizar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) — el manual de procedimientos para una evaluación controlada por la comunidad
- [Plantillas de términos](/docs/network/sovereignty/terms-templates) — términos legalmente sencillos con orientación trustless (sin intermediarios) que su comunidad puede adaptar, detallando claramente los riesgos de "caballo de Troya"
- [Custodia de datos](/docs/network/sovereignty/data-sovereignty) — la postura institucional y los marcos de referencia (CARE, Te Mana Raraunga y otros instrumentos de soberanía de datos indígenas) que le dieron forma
- [Propiedad y términos](/docs/network/sovereignty/ownership-transfer) — términos específicos por idioma y qué ocurre cuando un método gana
- [Cómo se financia el trabajo](/docs/network/sovereignty/economic-model) — el flujo de los fondos en un proyecto no comercial
- [Apoyar a un idioma de bajos recursos](/docs/network/community/low-resource-languages) — contexto técnico para investigadores que colaboran junto a las comunidades
