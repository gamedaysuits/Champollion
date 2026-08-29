---
sidebar_position: 11
title: "Recetas: Creación de corpus"
---

# Guía de Creación de Corpus

> **La idea:** Antes de poder evaluar un método de traducción, necesita un corpus de evaluación. Esta guía cubre cómo construir uno desde cero — obtención de datos, requisitos de formato, estándares de calidad, licencias y contribución a la Red.

:::info[Esto no es un método de traducción]
Esta guía es un requisito previo para muchos métodos. Un corpus de evaluación bien curado es la base que hace posible todo lo demás. Incluso 50 pares curados son suficientes para abrir una nueva pista en el leaderboard.
:::

## Cuándo Usar Esto

- Desea **agregar un nuevo par de idiomas** al clasificador de la Red
- Es un **maestro de idiomas** que desea evaluar traducciones de estudiantes
- Es un **trabajador de idiomas comunitario** con acceso a materiales bilingües
- Es un **investigador** que necesita un conjunto de evaluación estandarizado para su par de idiomas

## Formato del Corpus

El arnés acepta JSON simple:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Dónde Obtener Datos

| Fuente | Calidad | Volumen | Licencia |
|--------|---------|---------|----------|
| **Libros de texto / materiales educativos** | Alta (revisada por expertos) | Baja-media | Verificar con el editor |
| **Documentos gubernamentales** | Media (registro formal) | Media-alta | A menudo dominio público |
| **Diccionarios bilingües** | Alta (entradas verificadas) | Media | Varía |
| **Ancianos de la comunidad / hablantes** | Más alta (intuición nativa) | Baja (tiempo limitado) | Gobernada por la comunidad |
| **Textos religiosos** | Media (específica del dominio) | Alta | Generalmente abierta |
| **Corpus existentes** (Hansard, FLORES) | Media-alta | Alta | Verificar licencia |
| **Hecha a mano** | Más alta | Baja | Usted es propietario |

## Estándares de Calidad

Un buen corpus de evaluación tiene:

1. **Contenido diverso** — no solo saludos o frases simples. Incluya preguntas, comandos, oraciones complejas, términos específicos del dominio
2. **Traducciones verificadas** — revisadas por al menos un hablante fluido, idealmente dos
3. **Ortografía consistente** — un script, una convención de ortografía en todo
4. **Fuentes independientes** — no derivadas del mismo texto en el que los métodos se entrenarán
5. **Licencia clara** — licencia explícita que permita el uso de evaluación

:::danger[Contaminación del corpus]
El corpus de evaluación debe ser **independiente** de cualquier dato de entrenamiento. Si un método fue entrenado o solicitado con datos del corpus de evaluación, será descalificado. Diseñe su corpus para que sea excluido desde el primer día.
:::

## Directrices de Tamaño

| Tamaño | Lo Que Permite |
|--------|----------------|
| **50 entradas** | Evaluación mínima viable — suficiente para detectar diferencias de calidad graves |
| **100–200 entradas** | Clasificación confiable — suficiente para significancia estadística entre métodos |
| **500+ entradas** | Grado de investigación — puntuaciones compuestas robustas, intervalos de confianza |
| **1,000+ entradas** | Estándar de oro — equivalente a cobertura de devtest de FLORES |

Comience en pequeño. 50 entradas son suficientes para abrir una pista de clasificación. Puede expandir más tarde.

## Contribuir a la Red

1. **Cree su corpus** en el formato JSON anterior
2. **Licéncielo** — CC BY-SA 4.0 se recomienda para evaluación abierta; CC BY-NC-SA 4.0 para uso restringido
3. **Alójelo en una fuente estable** (su propio repositorio, un archivo institucional, o un registro de datos) — Champollion nunca aloja ni rastrea contenido de corpus
4. **Envíe una tarjeta de metadatos de obtención desde la fuente** — abra un PR contra el [repositorio público](https://github.com/gamedaysuits/Champollion) agregando una entrada de registro que apunte el harness a su fuente ascendente (loader/URL, SHA pin, licencia, procedencia); consulte [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) para el formato de la tarjeta
5. **El leaderboard se abre** para su par de idiomas una vez que la tarjeta se fusiona

## Para Comunidades de Idiomas Indígenas

La creación de corpus es un acto de **soberanía lingüística**. Su corpus, sus términos:

- Usted decide la licencia y las condiciones de acceso
- Puede contribuir un **conjunto de desarrollo público** (para desarrollo de métodos) mientras mantiene un **conjunto de prueba secreto** (para evaluación oficial) bajo control comunitario
- El [marco de soberanía](/docs/network/sovereignty/data-sovereignty) protege sus datos en todos los niveles

Incluso un corpus pequeño es un **activo estratégico** — es el punto de referencia que decide qué significa "lo suficientemente bueno" para su idioma.

## Se Combina Bien Con

- **[Traducción Parcial](./partial-translation)** — crear un corpus ES el paso de traducción humana
- **[Traducción Inversa](./back-translation)** — datos sintéticos complementan corpus creados por humanos
- Todos los demás libros de recetas — todos necesitan un corpus de evaluación

## Véase También

- [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets) — corpus existentes (EDTeKLA, FLORES+)
- [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) — propiedad y control
- [Para Comunidades de Idiomas](/docs/network/community/for-language-communities) — participación comunitaria
- [Apoye un Idioma de Recursos Bajos](/docs/network/community/low-resource-languages) — la visión general
