---
sidebar_position: 2
title: "Propiedad y Términos"
---

# Propiedad y Términos

> **Resumen Ejecutivo.** Champollion no tiene un acuerdo universal, por diseño.
> Los términos se establecen por corpus, por idioma y por premio según quien sea
> el custodio que posea los datos — el trabajo de la plataforma es respetar
> cualesquiera que sean esos términos. Esta página describe las dimensiones que
> cubre una hoja de términos y la **Plantilla de Transferencia Comunitaria**,
> el punto de partida predeterminado para premios patrocinados en corpus de
> idiomas indígenas.

## El marco de términos

Champollion está diseñado para ser flexible en sus términos de modo que se
respeten todas las licencias — y para que pueda soportar arreglos novedosos:
corpus secretos, conjuntos de prueba comunitarios, y requisitos de despliegue
soberano. Diferentes idiomas tendrán diferentes acuerdos. Un corpus CC0, un
corpus comunitario solo para investigación, y un conjunto de estándar de oro
sellado gobernado por un consejo tribal pueden todos participar, cada uno bajo
sus propios términos.

Lo que es uniforme es la maquinaria que honra esos términos: carriles de
exposición, compuertas de licencia, cuarentena, y registro de obtención desde
la fuente (véase [Registrando Corpus](/docs/network/sovereignty/registering-corpora)).
Lo que *nunca* es uniforme es el acuerdo en sí.

Cuando un custodio de corpus establece términos — para participación en
evaluaciones comparativas, para un premio patrocinado, o para cualquier otra
cosa — la hoja de términos responde un pequeño conjunto de preguntas:

| Dimensión | La pregunta |
|---|---|
| **Exposición del corpus** | ¿Cuál carril — público, solo investigación, o privado? ¿Se muestran referencias alguna vez? |
| **Propiedad del método** | Si se gana un premio, ¿quién es propietario del método ganador — el desarrollador, la comunidad, o compartido? |
| **Despliegue** | ¿Quién puede desplegar el método, dónde, y bajo qué condiciones? |
| **Auto-hospedaje** | ¿Debe el método ejecutarse completamente en infraestructura controlada por la comunidad? |
| **Secreto** | ¿Está sellado el conjunto de prueba? ¿Quién tiene las claves? ¿Quién autoriza cada ejecución de evaluación? |
| **Compensación** | ¿Qué se paga a constructores, validadores y revisores? (Valores predeterminados publicados: [Cómo se Paga a los Hablantes](/docs/network/perspectives/how-speakers-get-paid)) |

Ninguno de estos tiene respuestas impuestas por la plataforma. Los valores
predeterminados a continuación son una plantilla, no una regla.

## La Plantilla de Transferencia Comunitaria

Para premios patrocinados en corpus de idiomas indígenas, la plantilla
predeterminada — ofrecida como punto de partida para que el órgano de
gobernanza de una comunidad la revise — funciona así:

### 1. Desarrollo del método
Un investigador, estudiante o desarrollador construye un método de traducción —
un pipeline con compuerta FST, un LLM entrenado, un modelo ajustado, o
cualquier otro enfoque — usando sus propios recursos y datos con licencia
abierta.

### 2. Evaluación en red
El método se evalúa mediante el [arnés de evaluación](/docs/network/specifications/harness).
Cada envío se vincula a un commit específico de Git y versión de conjunto de
datos. Las puntuaciones son reproducibles.

### 3. Revisión comunitaria
Los resultados son revisados por trabajadores lingüísticos comunitarios. Una
puntuación alta en la tabla de clasificación prueba que el método *funciona*;
no prueba que sea *apropiado*. Hablantes bilingües validan una muestra de
resultados, y los revisores de la comunidad pueden rechazar un método por
cualquier razón.

### 4. Transferencia de propiedad
Cuando un método cumple con el estándar del premio (métricas automatizadas **y**
validación humana), el desarrollador transfiere el método — código fuente,
pesos entrenados, configuración, datos de entrenamiento — a la organización de
gobernanza de la comunidad (un consejo tribal, autoridad lingüística, u
organismo similar elegido por la comunidad, nunca por Champollion). La
comunidad es propietaria del artefacto completamente: puede inspeccionarlo,
modificarlo, desplegarlo, archivarlo, o licenciarlo, sin ningún reclamo
continuo del desarrollador o de Champollion.

Los componentes de terceros que el desarrollador no posee (un modelo base de
peso abierto, un FST AGPL) no pueden tener su propiedad transferida — pasan a
la comunidad bajo sus propias licencias abiertas, por lo que la admisibilidad
del premio requiere que cada dependencia tenga derechos que la comunidad
realmente pueda recibir. Véase las clases de dependencia en la
[especificación de Interfaz de Método](/docs/network/specifications/methods#method-validity-and-dependency-classes).

El desarrollador conserva lo que los investigadores deben conservar: el derecho
irrestricto de publicar el enfoque y resultados, de reutilizar sus técnicas en
cualquier lugar, y atribución permanente como creador del método.

### 5. Despliegue — si y cómo la comunidad elige
La comunidad decide si el método se despliega en absoluto, por quién, y bajo
qué términos. El despliegue independiente es completamente asunto de la
comunidad: **Champollion no toma ninguna parte de nada que una comunidad gane
de un activo que posee**, y no tiene derechos de despliegue propios.

:::note[Estado: plantilla, no historial]
Ningún premio se ha abierto y ninguna transferencia ha ocurrido aún — la tabla de clasificación actualmente no tiene ejecuciones publicadas. Esta plantilla se documenta para que los términos previstos sean transparentes antes de que alguien invierta esfuerzo, y para que el órgano de gobernanza de una comunidad tenga un borrador concreto para reaccionar en lugar de una página en blanco. Un instrumento firmado, redactado con asesoría legal para las partes específicas, es lo que haría que cualquiera de esto sea vinculante.
:::

## Para investigadores

Si está desarrollando un método para un idioma indígena:

1. **Establezca una relación** con la comunidad lingüística antes de comenzar
2. **Use datos con licencia abierta** para desarrollo (no recursos restringidos
   por la comunidad)
3. **Documente la procedencia** en su [tarjeta de ejecución](/docs/network/specifications/run-card)
   — cada recurso, su licencia, y origen
4. **Lea los términos del premio antes de construir para él** — si los términos
   incluyen transferencia, su contribución es la arquitectura y técnica (suya
   para publicar y reutilizar); la contribución de la comunidad es el
   conocimiento lingüístico que la hace funcionar para su idioma

## Véase También

- [Administración de Datos](/docs/network/sovereignty/data-sovereignty) — la posición que estos términos implementan
- [Cómo Se Financia el Trabajo](/docs/network/sovereignty/economic-model) — dónde se mueve el dinero, y qué toma Champollion (nada)
- [Registrando Corpus](/docs/network/sovereignty/registering-corpora) — carriles de exposición y obtención desde la fuente
- [Especificación de Premio](/docs/network/specifications/prizes) — condiciones de umbral y proceso de reclamación
