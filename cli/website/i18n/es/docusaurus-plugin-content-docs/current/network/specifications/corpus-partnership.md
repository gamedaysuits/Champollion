---
sidebar_position: 9
title: "Estrategia de Asociación de Corpus"
slug: '/network/specifications/corpus-partnership'
---

# Estrategia de Asociación de Corpus: Establecimiento de Corpus de Evaluación a Través de Departamentos de Lingüística Académica

Construir un corpus de *entrenamiento* para un idioma de bajos recursos requiere cientos de
miles de pares de oraciones — demasiados para revisarlos, por lo que la calidad varía de
formas que nadie nota hasta que un modelo entrenado con ellos falla. Un corpus de *evaluación*
requiere unos pocos cientos de pares, cada uno de ellos revisado por alguien que
conoce el idioma, y nunca se vuelve obsoleto: cada nuevo modelo o método que
aparece se mide frente a él. Este documento es el flujo de trabajo para construir
esa segunda opción, drásticamente más económica — el único entregable donde la
experiencia de un departamento alcanza cada una de las oraciones — y para lo que sucede
después: con un estándar de evaluación establecido, un
[premio publicado](/docs/network/specifications/prizes) convierte su idioma
en un objetivo al que cualquier creador de métodos en el mundo puede apuntar, y la
tabla de clasificación pública mide cada intento.

> **Propósito.** El flujo de trabajo completo para establecer un corpus de evaluación de traducción automática a través de una asociación con un departamento de lingüística: qué entrega el departamento, cómo debe verse el corpus, cómo se sella criptográficamente, cómo funciona la evaluación en entorno de pruebas (sandbox) y qué obtiene el departamento a cambio. Este es el documento que usted lleva a una reunión con un posible socio académico.
>
> **Audiencia.** Jefes de departamento, investigadores principales, coordinadores de investigación y directores de programas de idiomas indígenas en universidades con programas activos de documentación de idiomas o NLP.
>
> **Documentos complementarios:**
> - [Marco de diseño de corpus](/docs/network/specifications/corpus-design) — la metodología detrás de los corpus de evaluación válidos y confiables
> - [Especificación de premios](/docs/network/specifications/prizes) — la mitad del incentivo: publicar un premio contra su conjunto sellado
> - [Registro de corpus](/docs/network/sovereignty/registering-corpora) — cómo un corpus se une a la red sin salir de sus manos
> - [Protocolo de validación de hablantes](/docs/network/specifications/speaker-validation) — la solicitud para que los hablantes bilingües *marquen* las traducciones existentes (calificación de calidad, validación de linter, revisión de FST)
> - [Especificación de benchmark](/docs/network/specifications/benchmark) — la especificación técnica completa para corpus, tarjetas de ejecución (run cards) y protocolos de evaluación
> - [Soberanía de datos](/docs/network/sovereignty/data-sovereignty) — principios indígenas de soberanía de datos, CARE y por qué es importante la transferencia de propiedad

---

## 1. Lo Que Esta Asociación Produce

Un **corpus de evaluación sellado**: un conjunto curado de pares de texto paralelo (lengua fuente → lengua destino) que se convierte en la verdad fundamental para medir la calidad de la traducción automática. Los métodos se prueban contra este corpus en un sandbox — los desarrolladores nunca ven los datos de prueba.

La asociación produce tres artefactos:

| Artefacto | Qué Es | Quién Lo Controla |
|-----------|--------|-------------------|
| **Corpus de desarrollo** | 100–200+ pares de texto paralelo públicos para desarrollo de métodos | Publicado abiertamente (CC BY-NC-SA 4.0 o equivalente) |
| **Conjunto de prueba de estándar de oro** | 50–150 pares de texto paralelo secretos para evaluación oficial | Organización de gobernanza comunitaria (sellada criptográficamente) |
| **Suite de prueba de diagnóstico** | 10–50 pares contrastivos dirigidos que prueban fenómenos lingüísticos específicos | Publicado abiertamente |

En conjunto, eso suma de 160 a 400 pares — un corpus que un grupo de investigación realmente puede
curar a un estándar profesional, en comparación con los cientos de miles que
exigiría un corpus de entrenamiento. El corpus de desarrollo permite a cualquier persona
construir métodos de traducción. El conjunto de referencia (gold-standard) garantiza que esos métodos se
prueben de manera honesta. La suite de diagnóstico detecta modos de falla específicos
(por ejemplo, "¿puede este sistema manejar la obviación?").

---

## 2. Lo Que el Departamento Necesita Hacer

### Fase 1: Diseño del Corpus (2–4 semanas, tiempo de investigador)

**Responsable:** PI o posdoctorado con experiencia en la lengua destino.

1. **Seleccionar dominios de material fuente.** Elija 4–6 dominios del mundo real donde la traducción es realmente necesaria por la comunidad de hablantes. Nuestra taxonomía admite 16 dominios (ver Especificación de Benchmark §2.7):

   | Prioridad | Dominio | Por Qué |
   |-----------|---------|--------|
   | 🔴 Alta | `edu` — Educativo | Libros de texto, currículos — necesidad comunitaria directa |
   | 🔴 Alta | `gov` — Gobierno | Documentos de consejo de banda, política — necesidad práctica diaria |
   | 🔴 Alta | `medical` — Salud | Formularios de ingreso a clínica, información de salud — crítico para la seguridad |
   | 🟡 Media | `conv` — Conversacional | Habla cotidiana — establece fluidez de referencia |
   | 🟡 Media | `legal` — Legal | Documentos de derechos, tratados — significancia comunitaria |
   | 🟢 Menor | `literary` — Literario/Cultural | Historias, historias orales — preservación cultural |

2. **Redacte un documento de diseño del corpus** especificando:
   - Tamaño objetivo por segmento (desarrollo, gold_standard, diagnóstico)
   - Distribución de nivel de dificultad (ver §3.3 abajo)
   - Cobertura de registro y dominio
   - Criterios de selección de oración fuente (sin texto sintético, sin solo Biblia)
   - Plan de reclutamiento de hablantes

3. **Envíe el diseño para nuestra revisión.** Validamos que cumpla con el esquema del corpus (Especificación de Benchmark §2) y devolvemos comentarios dentro de 1 semana.

### Fase 2: Creación de Oraciones Fuente (4–8 semanas, tiempo de hablante)

**Responsable:** Coordinador de investigación trabajando con hablantes bilingües.

1. **Genere o seleccione oraciones fuente** en los dominios y niveles de dificultad planeados. Las fuentes pueden ser:
   - Materiales bilingües publicados existentes (libros de texto, documentos gubernamentales)
   - Oraciones recién elicitadas diseñadas para cubrir fenómenos lingüísticos específicos
   - Adaptadas de documentos del mundo real (agendas de consejo de banda, formularios de clínica, materiales educativos)

2. **Cada oración fuente debe tener:**
   - Etiqueta de dominio (de la taxonomía de 16 códigos)
   - Etiqueta de registro (conversacional, formal, técnico, ceremonial, educativo)
   - Etiqueta de contexto (saludo, declaración, pregunta, instrucción, narrativa, etiqueta, error)
   - Nivel de dificultad estimado (1–5, ver §3.3)
   - Etiqueta de procedencia (libro de texto, elicitado, corpus, gold_standard)

3. **Traduzca cada oración fuente** a la lengua destino, realizado por hablantes bilingües. Múltiples traducciones de referencia por entrada son valiosas pero no requeridas.

4. **Opcionalmente, agregue análisis morfológico** para cada traducción de referencia:
   - Glosa interlineal (desglose morfema por morfema)
   - Cadena de etiqueta FST (si existe un FST para la lengua)
   - Notas del traductor sobre variantes dialectales, ambigüedad o contexto cultural

### Fase 3: Aseguramiento de Calidad (2–4 semanas)

**Responsable:** Lingüista con experiencia en la lengua destino.

1. **Revisión cruzada.** Cada traducción debe ser revisada por al menos un hablante bilingüe adicional que no produjo la traducción original. El revisor verifica:
   - ¿Es la traducción precisa?
   - ¿Suena natural?
   - ¿Es correcta la calificación de dificultad?
   - ¿Hay variantes aceptables que deban anotarse?

2. **Ejecute a través de nuestro validador de esquema.** Proporcionamos un script que valida el corpus contra el esquema de entrada (Especificación de Benchmark §2.2). Verifica:
   - Campos requeridos presentes
   - Códigos de dominio válidos
   - Niveles de dificultad son enteros 1–5
   - Sin IDs duplicados
   - Codificación de caracteres (normalización UTF-8 NFC)

3. **Si existe un FST para la lengua,** ejecute las traducciones de referencia a través de él. Cada palabra en la referencia debe ser válida en FST. Las palabras que no lo son (préstamos, neologismos, nombres propios) deben documentarse en una lista de permitidos.

### Fase 4: Segmentación y Sellado (1 semana, ingeniería de Champollion)

**Responsable:** Equipo de Champollion, con revisión del departamento.

1. **División estratificada.** Dividimos el corpus en segmentos usando muestreo aleatorio determinista (semilla documentada, reproducible):

   | Segmento | Tamaño Objetivo | Acceso |
   |----------|-----------------|--------|
   | `development` | 60% de entradas (mín. 100) | Público |
   | `gold_standard` | 30% de entradas (mín. 50) | Secreto, sellado |
   | `held_out` | 10% de entradas (mín. 10) | Secreto, sellado, nunca usado hasta activarse |

   La división preserva la distribución de nivel de dificultad (muestreo estratificado) para que cada segmento tenga representación proporcional en todos los niveles.

2. **Sellado criptográfico** de los segmentos gold_standard y held_out:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **El segmento de desarrollo** se confirma en el repositorio público y se publica con licencia completa.

4. **El segmento de diagnóstico** también es público — prueba fenómenos lingüísticos específicos (ver §3.4).

### Fase 5: Integración e Lanzamiento (1–2 semanas, ingeniería de Champollion)

1. **Configuración del arnés.** Agregamos la lengua al arnés de evaluación:
   - Tarjeta de lengua creada o verificada
   - Corpus registrado en el registro de conjunto de datos
   - Métricas LYSS configuradas (LYSS-fst si FST disponible, LYSS-eq si existen reglas de linter)
   - Perfil de puntuación predeterminado seleccionado (Perfil A si FST disponible, Perfil B en caso contrario)

2. **Benchmark de referencia.** Ejecutamos un barrido de 12 modelos contra el segmento de desarrollo para llenar el leaderboard con puntuaciones iniciales.

3. **Anuncio público.** La lengua aparece en el leaderboard de Red con un benchmark de segmento de desarrollo en vivo. El departamento es acreditado como socio del corpus.

---

## 3. Cómo Debe Verse el Corpus

### 3.1 Formato

Cada archivo de corpus es un documento JSON que sigue el esquema en Especificación de Benchmark §2.1–§2.2:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Requisitos de Tamaño Mínimo

| Segmento | Entradas Mínimas | Recomendado |
|----------|-----------------|------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Total** | **170** | **350–530** |

### 3.3 Distribución de Dificultad

El corpus debe incluir entradas en los cinco niveles de dificultad, ponderados hacia los niveles 2–4:

| Nivel | Descripción | Distribución Objetivo |
|-------|-------------|----------------------|
| 1 — Vocabulario básico | Palabras individuales, saludos comunes, números | 10–15% |
| 2 — Oraciones simples | SVO, tiempo presente | 25–30% |
| 3 — Complejidad moderada | Tiempo pasado/futuro, posesivos, animacidad | 30–35% |
| 4 — Morfología compleja | Obviación, pasiva, orden conjuntivo, cláusulas relativas | 15–20% |
| 5 — Avanzado | Multicláusula, registro formal, ceremonial, idiomático | 5–10% |

### 3.4 Suite de Prueba de Diagnóstico

El segmento de diagnóstico prueba fenómenos lingüísticos específicos usando **pares contrastivos**: una traducción correcta y una traducción incorrecta mínimamente diferente. Si la métrica de un sistema puntúa la correcta más alta, la prueba pasa.

Para lenguas polisintéticas, la suite de prueba de diagnóstico debe dirigirse a:

| Fenómeno | Ejemplo (Cree) | Qué Prueba |
|----------|----------------|-----------|
| **Acuerdo de animacidad** | atim (AN) vs. maskisin (IN) — formas verbales diferentes | ¿Sabe el sistema cuáles sustantivos son animados? |
| **Obviación** | Tercera persona proximal vs. obviativa | ¿Rastrea la jerarquía de tercera persona? |
| **Marcación inversa** | Formas verbales directas vs. inversas | ¿Maneja paciente-supera-agente? |
| **Conjuntivo/Independiente** | Verbo de cláusula principal vs. cláusula subordinada | ¿Usa el paradigma verbal correcto? |
| **Inclusivo/Exclusivo** | "Nosotros (incluyéndote)" vs. "Nosotros (excluyéndote)" | ¿Distingue formas de primera persona plural? |

Para otras familias lingüísticas, identifique los 3–5 fenómenos más diagnósticos que distingan traducción competente de incompetente. La experiencia lingüística del departamento es esencial aquí — estas son las pruebas que solo un especialista sabría escribir.

### 3.5 Lo Que NO Queremos

| Antipatrón | Por Qué |
|-----------|--------|
| **Texto solo de Biblia** | Registro arcaico, vocabulario litúrgico, estructura formulaica. OMT-1600 evaluó 1,560 lenguas de esta manera — deliberadamente lo evitamos. |
| **Pares de evaluación sintéticos** | Las referencias generadas por LLM anulan el propósito de la evaluación. La referencia debe ser de autoría humana. |
| **Corpus de registro único** | Todo formal, o todo conversacional. La traducción del mundo real abarca múltiples registros. |
| **Solo dificultad-1** | Palabras individuales y saludos no prueban traducción — prueban búsqueda de vocabulario. |
| **Referencias traducidas por máquina** | Usar salida de Google Translate como "referencia" es circular. |
| **Oraciones sin etiqueta de contexto** | Necesitamos saber la función comunicativa para análisis de diagnóstico. |

---

## 4. Sellado Criptográfico y Prueba en Sandbox {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 ¿Por Qué Sellar el Conjunto de Prueba?

Los benchmarks de ML convencionales publican conjuntos de prueba abiertamente. Una vez publicados, los LLMs fronterizos eventualmente entrenarán en ellos (intencional o a través de web scraping), haciendo que las puntuaciones sean poco confiables. Para datos de lenguas indígenas, hay una preocupación adicional: los datos lingüísticos publicados pueden usarse sin consentimiento comunitario.

El sellado asegura:
- **Integridad del conjunto de prueba:** Los métodos no pueden sobreajustarse a datos que nunca han visto
- **Soberanía de datos:** La comunidad controla quién evalúa contra sus datos
- **Frescura perpetua:** El conjunto de prueba nunca se contamina

### 4.2 Cómo Funciona la Prueba en Sandbox

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Gestión de Claves

La clave de encriptación para el conjunto de prueba sellado se divide usando Shamir Secret Sharing con un umbral de 2 de 3:

| Tenedor de Participación | Rol | Poder de Revocación |
|-------------------------|-----|-------------------|
| **Organización de gobernanza comunitaria** | Custodio principal | Puede revocar acceso de evaluación unilateralmente |
| **Socio del departamento académico** | Cocustodio | Puede participar en reconstrucción de clave |
| **Proyecto Champollion** | Depósito | No puede acceder a datos solo; asegura continuidad si otras partes se vuelven no disponibles |

Cualquier 2 de 3 participaciones reconstruyen la clave. Esto significa:
- La comunidad + departamento pueden acceder a los datos sin Champollion
- La comunidad + Champollion pueden acceder a los datos sin el departamento
- Champollion solo NUNCA puede acceder a los datos

### 4.4 Manifiestos de Hash

Cuando el corpus se sella, un **manifiesto de hash** se publica en una confirmación de Git pública:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Esto prueba:
- El corpus existía en una fecha específica
- Tiene un tamaño y estructura conocidos
- Cualquier modificación de los segmentos sellados rompería la cadena de hash
- La comunidad puede verificar que sus datos no han sido alterados

---

## 5. Lo Que el Departamento Obtiene

### 5.1 Infraestructura de Investigación

| Activo | Descripción |
|-------|------------|
| **Arnés de evaluación** | Un marco de evaluación funcional y probado para su lengua — ahorra meses de construcción de herramientas |
| **Métricas LYSS** | Métricas de evaluación específicas de la lengua (LYSS-fst, LYSS-eq, LYSS-sem) configuradas para su lengua — si existen recursos FST y diccionario |
| **Leaderboard** | Un leaderboard público y en vivo mostrando el estado del arte para su par de lenguas |
| **Benchmark de referencia** | Barrido de 12 modelos proporcionando puntuaciones de referencia inmediatas y publicables |
| **Suite de prueba de diagnóstico** | Pruebas dirigidas para fenómenos lingüísticos específicos — reutilizables para otras evaluaciones |

### 5.2 Publicaciones

La construcción del corpus y los resultados de evaluación apoyan múltiples publicaciones:

| Artículo | Lugar | Rol del Departamento |
|---------|-------|-------------------|
| Metodología de construcción del corpus | LREC, ComputEL | Autor principal o coautor |
| Resultados de evaluación de referencia | ACL, EMNLP | Coautor |
| Validación de métrica LYSS | WMT Metrics Shared Task | Coautor |
| Diseño de suite de prueba de diagnóstico | SIGMORPHON, NAACL | Autor principal o coautor |
| Recursos de PNL específicos de la lengua | Lugares específicos de la lengua | Autor principal |

### 5.3 Posicionamiento de Subvenciones

La asociación proporciona resultados concretos para propuestas de subvenciones:

- "Infraestructura de evaluación de código abierto para MT de [lengua]" — entregable demostrable
- "Soberanía de datos criptográfica para datos lingüísticos indígenas" — aplica marcos indígenas de soberanía de datos establecidos (CARE, Kaitiakitanga, Etiquetas TK) a evaluación de MT; publicable
- "Benchmark gobernado por la comunidad con leaderboard en vivo" — métrica de impacto continuo
- "Evaluación independiente de OMT-1600 / Google Translate para [lengua]" — oportuno, alta visibilidad

### 5.4 Impacto Comunitario

- La comunidad de hablantes gana una **capacidad de evaluación independiente** — pueden evaluar si algún sistema de MT (Google, Meta, o personalizado) realmente funciona para su lengua
- La comunidad **controla los datos de prueba** a través de custodia de clave criptográfica
- Cualquier método probado a través del benchmark **transfiere propiedad** a la comunidad (ver Especificación de Benchmark §8.3), que mantiene todo lo que cualquier despliegue gana — Champollion es no comercial y no toma participación

### 5.5 Lo Que Le Cuesta al Departamento

| Componente | Costo Estimado | Quién Paga |
|-----------|----------------|-----------|
| Tiempo de PI/posdoctorado (diseño, supervisión) | ~40 horas | Departamento (o financiado por subvención) |
| Compensación de hablantes (traducción) | $2,500–6,000 | Financiado por subvención o Champollion |
| Compensación de hablantes (revisión) | $500–1,500 | Financiado por subvención o Champollion |
| Tiempo de coordinador de investigación | ~20 horas | Departamento |
| **Ingeniería, infraestructura, arnés** | **$0** | **Proyecto Champollion** |

Proporcionamos toda la ingeniería, configuración del arnés, configuración de métrica LYSS, integración de leaderboard e infraestructura continua sin costo para el departamento. La contribución del departamento es experiencia lingüística y acceso a hablantes.

---

## 6. Cronograma

| Fase | Duración | Hito Clave |
|------|----------|-----------|
| 1: Diseño del Corpus | 2–4 semanas | Documento de diseño aprobado |
| 2: Oraciones Fuente + Traducción | 4–8 semanas | Corpus bruto completado |
| 3: Aseguramiento de Calidad | 2–4 semanas | Revisado cruzadamente, esquema validado |
| 4: Sellado | 1 semana | Estándar de oro sellado, manifiesto de hash publicado |
| 5: Integración | 1–2 semanas | Lengua en vivo en leaderboard con referencias |
| **Total** | **10–19 semanas** | **Leaderboard en vivo con evaluación sellada** |

---

## 7. Cómo comenzar {#7-how-to-get-started}

1. **Contáctenos** — [correo electrónico/contacto del proyecto]. Programaremos una llamada de 30 minutos para discutir su lengua, recursos disponibles y logística de asociación.

2. **Proporcionamos:**
   - Este documento
   - El esquema del corpus y herramientas de validación
   - Ejemplos de nuestro corpus Cree (CRK) existente
   - Una plantilla de diseño de corpus borrador

3. **Usted proporciona:**
   - Un investigador principal (PI) o posdoctorado para liderar el trabajo lingüístico
   - Acceso a hablantes bilingües (o un plan para reclutarlos)
   - Información sobre los recursos disponibles (FST, diccionario, corpus existentes)
   - Aprobación institucional para la gobernanza de datos (coherente con los principios de soberanía de datos de las Primeras Naciones, o el propio marco de la comunidad)

4. **Codiseñamos el corpus** — selección de dominio, distribución de dificultad, pruebas de diagnóstico, cronograma y presupuesto.

5. **El trabajo comienza.** Nos comunicamos semanalmente. El departamento tiene autonomía completa sobre decisiones lingüísticas; manejamos toda la ingeniería.

---

## 8. Preguntas Frecuentes

### "Ya tenemos un corpus paralelo. ¿Podemos usarlo?"

Sí — si el corpus tiene procedencia clara, es de autoría humana, y la licencia permite su uso en evaluación. Lo ayudaremos a formatearlo a nuestro esquema, agregar metadatos faltantes e integrarlo. Los corpus existentes pueden acelerar dramáticamente el cronograma (omitir Fase 2 o reducirla a un ejercicio de llenar brechas).

### "No tenemos un FST para nuestra lengua."

Está bien. LYSS-fst (validez morfológica) requiere un FST, pero el arnés funciona sin él usando pesos de Perfil B (chrF++, BLEU, COMET, métricas de comportamiento). Si existe un FST de GiellaLT para una lengua relacionada, podemos adaptarlo. Si no, el corpus aún permite evaluación valiosa — solo sin la puerta de validez morfológica.

### "Nuestros hablantes usan un script no latino."

Totalmente soportado. El esquema del corpus maneja cualquier script Unicode. Hemos diseñado para SRO (Ortografía Romana Estándar) y silabarios para Cree, pero la misma infraestructura funciona para Devanagari, script árabe, CJK, Etíope, o cualquier otro sistema de escritura.

### "¿Qué hay sobre variación dialectal?"

Etiquétela. El esquema de entrada del corpus incluye un campo `notes` para información dialectal. Si múltiples dialectos están representados, documéntelos. Las clases de equivalencia del linter (LYSS-eq) pueden configurarse para aceptar variantes dialectales como equivalentes. La suite de prueba de diagnóstico puede incluir contrastes específicos del dialecto.

### "¿Quién es dueño del corpus?"

La comunidad de hablantes, a través de la organización de gobernanza. El departamento es acreditado como socio de investigación. Champollion mantiene una participación de clave de depósito para continuidad operativa pero no puede acceder a los datos sellados solo. El segmento de desarrollo se publica bajo una licencia Creative Commons especificada por la comunidad.

### "¿Qué pasa si queremos parar?"

La comunidad puede revocar acceso de evaluación en cualquier momento negándose a reconstruir la clave de encriptación. Los datos sellados nunca se exponen. El segmento de desarrollo, ya publicado, permanece público bajo su licencia. Los resultados de investigación del departamento (publicaciones, presentaciones) son suyos para mantener independientemente.

### "¿Qué pasa si la organización de gobernanza aún no existe?"

Podemos comenzar con Fases 1–3 (diseño del corpus, creación, QA) sin una organización de gobernanza. El sellado (Fase 4) requiere identificar un custodio de clave. Mientras tanto, el departamento puede servir como cocustodio junto al proyecto Champollion, con el entendimiento de que la custodia se transfiere a la organización de gobernanza comunitaria cuando se establezca una.

---

## Apéndice: Etiquetado vs. Construcción del Corpus

Este documento cubre **construcción del corpus** — crear los pares de texto paralelo que forman la verdad fundamental de evaluación. El etiquetado (anotación morfológica, glosado interlineal, cadenas de etiqueta FST) es una actividad separada que enriquece el corpus pero no es requerida para evaluación básica.

| Actividad | ¿Requerida? | Lo Que Permite |
|-----------|-----------|----------------|
| **Construcción del corpus** (este documento) | ✅ Requerida | Evaluación básica: chrF++, coincidencia exacta, COMET, métricas de comportamiento |
| **Verificación de cobertura FST** | 🟡 Opcional | Métrica de validez morfológica LYSS-fst **y** el `morphological_accuracy` derivado de FST (coincidencia de lema — sin anotación necesaria; Especificación de Puntuación §2.2) |
| **Anotación morfológica** | 🟡 Opcional | Permitiría una futura actualización *validada por oro* de `morphological_accuracy`; la versión derivada de FST (arriba) no necesita ninguna |
| **Reglas de equivalencia de linter** | 🟡 Opcional | Métrica de coincidencia equivalente LYSS-eq |
| **Reglas de validador semántico** | 🟡 Opcional | Métrica de validación semántica LYSS-sem |
| **Calificaciones de calidad de hablante** | Actividad separada | Validación de métrica (ver [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation)) |

El etiquetado y validación de hablantes se cubren en documentos separados y pueden proceder en paralelo con o después de la construcción del corpus.

