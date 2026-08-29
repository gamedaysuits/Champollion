---
sidebar_position: 1
title: "Para Comunidades Lingüísticas"
---

# Para comunidades lingüísticas

> **Resumen ejecutivo.** Su comunidad puede ser propietaria de su propio conjunto de pruebas — la "clave de respuestas" contra la cual se mide cada método de traducción — y ejecutar su propio concurso en sus propios términos, sin jamás entregar los datos. Esta página explica qué solicita la Red a las comunidades lingüísticas (traducciones de referencia, revisión de traducciones, datos de entrenamiento), qué reciben a cambio (trabajo remunerado a tasas publicadas, propiedad del código, control total de implementación), y las garantías de soberanía que vienen primero. No se requiere programación, y nada aquí requiere confiar en nosotros: las garantías son estructurales, no promesas.

No necesita ser programador para contribuir a la Red. Si habla una lengua indígena o de pocos recursos, usted es la persona más importante en este ecosistema.

---

## La soberanía viene primero

Antes de pedirle algo, la regla fundamental: **sus datos lingüísticos son suyos.** Los datos lingüísticos son *biodatos* — llevan la identidad y las relaciones de su comunidad y no pueden ser anonimizados de manera significativa — por lo que las personas que los proporcionan tienen las llaves de estos, y de todo lo que se mida contra ellos. La Red se construye sobre [principios indígenas de soberanía de datos](/docs/network/sovereignty/data-sovereignty):

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

Las garantías detrás de todo esto están escritas, no implícitas:
[Administración de datos](/docs/network/sovereignty/data-sovereignty) (la posición de soberanía de datos/CARE
y lo que nos prohíbe hacer) y
[Propiedad y términos](/docs/network/sovereignty/ownership-transfer) (qué
sucede, contractualmente, cuando un método gana).

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

La construcción de corpus y la revisión de traducciones son trabajo profesional, remunerado a
[tasas publicadas](/docs/network/perspectives/how-speakers-get-paid) — y
el pago no compra sus datos. Usted es pagado por el trabajo *y* sigue siendo el
propietario de lo que construye. Champollion es un proyecto de investigación no comercial: no
vende nada, no mide nada, y [no toma participación](/docs/network/sovereignty/economic-model)
de nada que su comunidad jamás gane de un método que posee.

### Control

Su organización de gobernanza controla:
- Quién puede acceder al método
- Si puede ser usado comercialmente — y si es así, en sus términos, manteniendo todo lo que gane
- Cuándo y cómo se actualiza
- Qué datos se utilizan para desarrollo adicional

---

## Cómo involucrarse

:::tip[Algo que los hablantes pueden hacer hoy]
Champollion no construye ni aloja corpus — los datos de prueba siempre se obtienen
de su fuente. Si los hablantes en su comunidad desean contribuir oraciones
*ahora mismo*, [Tatoeba](https://tatoeba.org) acepta contribuciones oración por oración
en cualquier idioma, y colecciones abiertas como
[OPUS](https://opus.nlpl.eu/) agregan texto paralelo que la Red construye
puntos de referencia a partir de. Las oraciones agregadas allí pueden convertirse en datos de evaluación aquí en
la próxima construcción de corpus. Una aplicación de contribución directa del hablante y un constructor de corpus
son el próximo paso planeado en nuestro mapa de ruta.
:::

1. **Comuníquese** — Abra un problema en el [repositorio de la Red](https://github.com/gamedaysuits/Champollion) o envíe un correo a [info@champollion.dev](mailto:info@champollion.dev)
2. **Describa su lengua** — ¿A qué familia pertenece? ¿Cuántos hablantes tiene? ¿Qué sistemas de escritura se utilizan? ¿Qué recursos computacionales existen (FST, diccionarios, corpus)?
3. **Comience en pequeño** — Incluso 50 pares de traducción curados son suficientes para crear un conjunto de datos de evaluación y abrir una nueva pista de marcador de posiciones. El trabajo de corpus se [paga a tasas publicadas](/docs/network/perspectives/how-speakers-get-paid)
4. **Manténgalo suyo** — Registre el corpus como metadatos en el carril que elija ([Registrar corpus](/docs/network/sovereignty/registering-corpora)); si desea que el conjunto de pruebas sea completamente secreto, el [manual de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) es el camino
5. **Conéctenos con la gobernanza** — ¿Quién en su comunidad tiene autoridad sobre datos y tecnología lingüística? El modelo de soberanía de la Red requiere un socio de gobernanza

---

## Consulte también

- [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) — el manual para una evaluación controlada por la comunidad
- [Plantillas de términos](/docs/network/sovereignty/terms-templates) — términos legalmente simples, que se inclinan hacia lo sin confianza, que su comunidad puede adaptar, con los riesgos de caballo de Troya explicados
- [Administración de datos](/docs/network/sovereignty/data-sovereignty) — la posición y los marcos (CARE, Te Mana Raraunga y otros instrumentos indígenas de soberanía de datos) que la formaron
- [Propiedad y términos](/docs/network/sovereignty/ownership-transfer) — términos por lengua y qué sucede cuando un método gana
- [Cómo se financia el trabajo](/docs/network/sovereignty/economic-model) — dónde se mueve el dinero en un proyecto no comercial
- [Apoye una lengua de pocos recursos](/docs/network/community/low-resource-languages) — contexto técnico para investigadores que trabajan junto a comunidades

