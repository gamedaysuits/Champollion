---
sidebar_position: 7
title: "Administración de Datos"
description: "La posición de Champollion sobre datos lingüísticos: los corpus permanecen con sus administradores, se respeta cada licencia, y los términos de la comunidad rigen los datos comunitarios."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Administración de Datos

> **Resumen ejecutivo.** Champollion son herramientas de investigación y desarrollo de traducción automática: su código fuente está disponible y es gratuito para uso no comercial, y su entorno de evaluación es de código abierto. Esta página expone su postura sobre los datos lingüísticos en su totalidad: los corpus pertenecen a las personas de las que provienen, cada licencia y término de la comunidad se respeta de forma mecánica en lugar de mediante promesas, y la plataforma no impone sus propios términos sobre el idioma de nadie.

:::info[Los datos de idioma son biodatos]
Los datos de idioma son **biodatos**. Como los datos genéticos o de salud, un idioma lleva consigo la identidad, el parentesco y las relaciones de las personas que lo hablan — y como un genoma, no puede ser anonimizado de manera significativa: elimine los nombres y el idioma sigue codificando quiénes son sus hablantes. Por lo tanto, las personas que proporcionan un corpus tienen las claves para acceder a él, y a cualquier cosa que se mida contra él. Esta es la premisa en la que se basa todo lo que sigue.
:::

De esa premisa, el diseño se desprende. Champollion trata a cada contribuidor de
corpus como un **administrador**: el corpus sigue siendo suyo — legal, física y
prácticamente — mientras que la infraestructura lo hace *medible*.

## Los compromisos

1. **Nunca tenemos los datos.** Los corpus se registran como tarjetas de
   metadatos fijadas por hash y se obtienen del alojamiento propio del
   administrador en el momento de la evaluación. Nada se copia en este
   repositorio ni se sirve desde nuestra infraestructura. Ponga su archivo sin
   conexión y la evaluación contra él simplemente se detiene. Consulte
   [Registrando Corpus](/docs/network/sovereignty/registering-corpora).

2. **Cada licencia se respeta — por compuerta, no por promesa.** Los corpus no
   comerciales y solo para investigación se excluyen mecánicamente de cualquier
   uso que su licencia no permita. Las restricciones afirmadas por una comunidad
   más allá de la licencia se registran con su fuente y se honran de la misma
   manera. La aplicación vive en compuertas de CI y disparadores de base de
   datos, no en un código de conducta.

3. **Los términos son del administrador, y varían.** Diferentes idiomas tendrán
   diferentes acuerdos — un corpus CC0 público, un corpus comunitario solo para
   investigación, y un conjunto de prueba sellado con requisitos de despliegue
   soberano pueden todos participar, cada uno en sus propios términos. No hay
   contrato universal aquí y ninguna reclamación predeterminada sobre nada.
   Consulte el [Marco de Términos](/docs/network/sovereignty/ownership-transfer).

4. **Los corpus secretos se soportan como arquitectura, no como excepción.** Una
   comunidad puede mantener un conjunto de prueba sellado — alojado en su propia
   infraestructura, nunca visto por Champollion o por desarrolladores — y aún
   así tener métodos puntuados contra él. La medibilidad sin extractabilidad es
   un objetivo de diseño, no una solución alternativa.

5. **La atribución y el crédito viajan con los datos.** El crédito del
   constructor y lingüista es obligatorio en cada superficie donde aparece un
   corpus. Donde una comunidad ha aplicado Etiquetas TK o BC de
   [Local Contexts](https://localcontexts.org/), las mostramos y honramos el
   protocolo que codifican. Llevamos Etiquetas; nunca las acuñamos.

6. **Los contribuidores reciben pago.** La construcción y validación de corpus
   es trabajo profesional a tasas publicadas — consulte
   [Cómo se Pagan los Hablantes](/docs/network/perspectives/how-speakers-get-paid).
   El pago no compra el corpus: el constructor recibe pago *y* sigue siendo el
   administrador.

## Cómo una licencia se convierte en una medida de cumplimiento

El Compromiso 2 tiene una forma específica, y vale la pena exponerlo en su totalidad: así es como funciona realmente la premisa "se respeta cada licencia", no es solo un resumen de buenas intenciones.

**Cada benchmark ingresa en estado de retención.** Un conjunto de pruebas recién catalogado se pone en cuarentena de forma predeterminada: es visible en el índice, pero se excluye de la cola de evaluación, de los concursos y de todas las clasificaciones. No se asume nada sobre un corpus al momento de su ingreso (ni siquiera una licencia que parezca permisiva) hasta que sus términos se revisan frente al texto real de la licencia en una revisión *upstream* fijada.

**Los veredictos de revisión son mecánicos y los casos difíciles se mantienen retenidos.** Una licencia permisiva claramente establecida habilita el corpus para todas las vías. Una licencia no comercial claramente establecida lo habilita para una vía de investigación que queda excluida de toda superficie comercial, de premios y de API. Y una licencia no declarada, modificada, mixta o a medida **nunca se interpreta en nombre del titular de los derechos**: el corpus permanece catalogado pero retenido (fuera de la cola, los concursos y las clasificaciones) hasta que el titular de los derechos establezca los términos o registre una concesión. El veredicto, su fecha, su vía y su fundamento se registran en un formato legible por máquina en la tarjeta del corpus y en sus entradas de registro, de modo que la pregunta "¿por qué es ejecutable esto?" siempre tenga una respuesta citable, al igual que "¿por qué no lo es?".

**Enviar texto a un modelo es una transmisión y está controlada.** Evaluar un modelo significa enviarle oraciones de origen: eso es el corpus saliendo de su entorno de origen, y se rige según su licencia. Los corpus con licencias permisivas pueden usar canales estándar. Los corpus bajo una licencia no comercial declarada viajan solo a través de canales que contractualmente no entrenan con los datos de entrada (declarado exactamente así: una garantía de no entrenamiento, no de no retención). A los corpus bajo concesiones no declaradas o modificadas se les rechaza la evaluación remota por completo hasta que se registre el consentimiento, y los conjuntos comunitarios sellados nunca abandonan la infraestructura de su custodio. Cuando el control de acceso lo rechaza, su mensaje de rechazo cita el veredicto de la revisión de la licencia.

**La aplicación de las normas opera por debajo de cada cliente.** Las retenciones se aplican mediante un disparador de base de datos que ningún cliente puede eludir, la regla de no alojamiento se aplica mediante un control de acceso del repositorio que escanea cada ruta rastreada en busca de contenido del corpus, y el control de acceso de transmisión se ejecuta dentro del propio entorno de evaluación. Cualquiera de estos puede decirnos que no, lo cual es precisamente el objetivo.

## Lo que esto no es

Champollion no es un corredor de datos, no es un proveedor de traducción, y no
es una plataforma comercial. Es herramienta de investigación. Una puntuación
alta en la tabla de clasificación prueba que un método funciona técnicamente; no
es una licencia para publicar traducciones, redistribuir un corpus, o desplegar
nada contra los deseos de una comunidad. Esas decisiones pertenecen al
administrador, siempre.

## Los marcos que dieron forma a este diseño

Esta postura no fue inventada aquí. Está informada por, y en deuda con, el
trabajo de gobernanza de datos indígenas de las últimas dos décadas:

- **Principios de soberanía de datos de las Primeras Naciones** — las Primeras
  Naciones en Canadá han articulado la propiedad, el control, el acceso y la
  posesión comunitarios de su propia información; el modelo de administración
  aquí está diseñado para ser compatible con esas afirmaciones.
- **[Principios CARE](https://www.gida-global.org/care)** (Beneficio Colectivo,
  Autoridad para Controlar, Responsabilidad, Ética) — Alianza Global de Datos
  Indígenas.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — la Red de
  Soberanía de Datos Māori.
- **La [Licencia Kaitiakitanga](https://tehiku.nz/)** — la licencia basada en
  guardianía de Te Hiku Media para datos de te reo Māori, una influencia directa
  en el modelo de custodia de administrador-tiene-las-claves utilizado aquí.

Señalamos a cualquiera que diseñe gobernanza para los datos de su propio idioma
directamente a esas fuentes — son las autoridades, no nosotros. Donde una
comunidad adopta cualquiera de estos marcos para su corpus, la tarjeta de corpus
registra esa afirmación y la herramienta la honra.

Champollion muestra el Aviso **"Abierto para Colaborar"** de Local Contexts:
construimos relaciones con las comunidades cuyos idiomas aparecen aquí, y las
Etiquetas creadas por la comunidad anulan cualquier cosa que digamos sobre sus
datos.

## Consulte también

- [Soberanía de datos, desde cero](/docs/learn/data-sovereignty) — la versión introductoria de esta página, para lectores que no estén familiarizados con el concepto

- [Registrando Corpus y Carriles de Exposición](/docs/network/sovereignty/registering-corpora) — la mecánica
- [Para Comunidades de Idiomas](/docs/network/community/for-language-communities) — una guía en lenguaje simple
- [Cómo se Pagan los Hablantes](/docs/network/perspectives/how-speakers-get-paid) — tasas y términos publicados
- [Métodos de Traducción](https://champollion.dev/docs/guides/translation-methods) — el método `api`, que mantiene los indicadores, diccionarios y datos de entrenamiento de una comunidad en sus propios servidores
