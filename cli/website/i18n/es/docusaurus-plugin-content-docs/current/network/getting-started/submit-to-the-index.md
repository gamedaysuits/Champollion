---
sidebar_position: 0
title: "Enviar al Índice"
description: "Proponga un conjunto de datos, recurso, método, servicio de traducción humana o resultado externo — o sugiera una corrección para la tarjeta de idioma. Cada propuesta es revisada por una persona para verificar el cumplimiento de propiedad intelectual, licencias y soberanía — nada se aprueba automáticamente."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Enviar al Índice

> **Resumen Ejecutivo.** Proponga algo para el índice de Champollion — un benchmark, un recurso, un método de traducción, un servicio de traducción humana, o un resultado publicado externamente. Usted completa un formulario estructurado breve (en su navegador o desde la CLI); un **mantenedor revisa cada envío manualmente** para verificar propiedad intelectual, licencia, y cumplimiento comunitario/soberanía antes de que algo se agregue. **Nada se aprueba automáticamente.**

El índice es el mapa compartido: los conjuntos de datos en los que se comparan métodos, los diccionarios y herramientas que ayudan, los métodos en sí, las personas que traducen manualmente, y los resultados que otros han publicado. Cualquiera puede proponer una adición. Porque esta es infraestructura para comunidades lingüísticas, cada propuesta pasa primero por una puerta de revisión humana.

---

## Qué puede enviar

| Tipo | Qué es | Qué agregamos |
|---|---|---|
| **Benchmark / conjunto de datos** | Un corpus de evaluación o benchmark | Una tarjeta de metadatos + un puntero para *obtener desde la fuente* — nunca el contenido del corpus |
| **Recurso** | Un diccionario, archivo, aplicación, FST (analizador morfológico) o herramienta | Un listado con un puntero + nivel de acceso (abierto / restringido / requiere consentimiento) |
| **Método de traducción** | Un motor de traducción automática, proveedor de LLM o canalización (pipeline) | Una entrada en el registro de métodos para que pueda ejecutarse y evaluarse |
| **Servicio de traducción humana** | Una oficina comunitaria, agencia o traductor individual voluntario | Un listado por par de idiomas (los detalles de contacto se mantienen fuera de banda — nunca en el issue público) |
| **Resultado publicado externo** | Una puntuación reportada por otro sistema o artículo científico | Una **cita** — los resultados externos se citan, nunca se vuelven a alojar ni se reclasifican como nuestra propia medición |
| **Corrección de tarjeta de idioma** | Algo en una [tarjeta de idioma](/catalogue) es incorrecto, está desactualizado o falta — una estimación de hablantes, un estado, un sistema de escritura, un recurso que no hemos listado | Una **corrección citada aplicada en la fuente de datos** (las tarjetas se generan automáticamente, por lo que la corrección se mantiene); cuando las fuentes no están de acuerdo, la tarjeta las muestra todas, con su respectiva atribución |

Cada tarjeta de idioma también incluye un enlace **"Sugerir una corrección o adición"**
que abre el formulario de corrección con el idioma precompletado.

**Solicitudes de eliminación y restricción por parte de la comunidad.** Si usted es miembro
o autoridad de la comunidad y desea que los datos sobre su idioma se restrinjan o eliminen, use el
formulario de corrección (o contacte al mantenedor fuera de banda si prefiere que no sea
público). Estas solicitudes pasan por la [revisión de soberanía](/docs/network/sovereignty/data-sovereignty)
con prioridad — no se requiere cita.

---

## Cómo funciona la revisión

Esta es la parte importante: **los envíos se revisan por una persona, no por un robot.** Cuando envía, abre un issue en GitHub. Ese issue es la cola de revisión. Un mantenedor lo lee y lo verifica contra las reglas del proyecto antes de agregar algo:

- **Propiedad intelectual y licencia.** Debemos estar autorizados a listarlo. El material no comercial, sin redistribución, o con licencia poco clara aún puede ser *catalogado*, pero se excluye de cualquier carril comercial / de premios / de obtención pública.
- **Comunidad y soberanía.** Los datos de lenguas indígenas y comunitarias se listan solo con el consentimiento de la comunidad. Un proveedor o custodio nunca se nombra públicamente antes de que hayan confirmado.
- **Nunca alojamos contenido de corpus.** Los conjuntos de datos se listan como metadatos más un puntero a dónde se obtienen los datos. **No pegue oraciones fuente/referencia en un envío.**
- **Sin datos personales.** Sin correos electrónicos, números telefónicos, u otra información de identificación personal en un issue público. Para servicios de traducción humana, los detalles de contacto se proporcionan al mantenedor fuera de banda.
- **Alcance.** Los corpus bíblicos / litúrgicos y otras imposiciones coloniales están fuera del alcance y serán rechazados.

Cada formulario termina con una atestación requerida:

> *"Confirmo que esto es listable públicamente, NO contiene contenido de corpus o datos personales, y respeta la licencia de la fuente y cualquier restricción comunitaria/soberanía."*

---

## Dos formas de enviar

### Desde su navegador

Abra el selector de issues y elija el formulario que coincida con lo que está enviando:

➡️ **[Abra un formulario de envío en GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Cada formulario solicita solo lo que el índice correspondiente necesita (nombre, idiomas/pares, licencia, URL de fuente, y así sucesivamente) y la casilla de atestación.

### Desde la CLI

Si tiene la [CLI de Champollion](/docs/network/getting-started/submit-a-method), `champollion submit` recopila los campos y le entrega una versión **pre-rellenada** del mismo formulario de GitHub:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

La CLI imprime una URL — ábrala, revise la atestación en el navegador, y envíe. Agregue `--out submission.json` para también guardar una copia local, sin contenido, de lo que está proponiendo. La CLI nunca carga nada por sí misma y nunca escribe en el índice.

---

## Qué sucede después de que envía

1. Su envío llega como un issue en GitHub — la cola de revisión.
2. Un mantenedor lo revisa contra las reglas de propiedad intelectual / licencia / soberanía anteriores.
3. **Si se acepta:** el mantenedor agrega la entrada a la fuente de verdad relevante (el registro de conjuntos de datos, una tarjeta, el registro de métodos o servicios humanos, o el catálogo de resultados externos) a través de un cambio normal, y etiqueta el issue como **aceptado**.
4. **Si no se puede listar tal como está:** el mantenedor lo etiqueta como **rechazado** (o solicita más información) con la razón.

No hay fusión automática ni publicación automática. Una persona toma la decisión cada vez.

---

## Consulte también

- [Enviar un Método](/docs/network/getting-started/submit-a-method) — ¿ya tiene una ejecución de benchmark? Publique la tarjeta de ejecución directamente.
- [Registrar Corpus](/docs/network/sovereignty/registering-corpora) — niveles de exposición (local / privado / público / sellado) para corpus que posee.
- [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) — cómo funciona el control comunitario de datos lingüísticos aquí.
- [Para Comunidades Lingüísticas](/docs/network/community/for-language-communities) — asociación, consentimiento, y custodia de claves.

