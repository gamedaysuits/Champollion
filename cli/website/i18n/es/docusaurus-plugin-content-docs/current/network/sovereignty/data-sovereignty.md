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

> **Resumen ejecutivo.** Champollion es un conjunto de herramientas de investigación y
> desarrollo para traducción automática: con código disponible y gratuito para uso no comercial, y su
> arnés de evaluación es de código abierto. Esta página establece su postura sobre los datos lingüísticos en
> su totalidad: los corpus pertenecen a las personas de quienes provienen, cada licencia y término
> comunitario se respeta de manera mecánica en lugar de mediante promesas, y la plataforma no impone
> términos propios sobre la lengua de nadie.

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

2. **Cada licencia se respeta: mediante controles, no por promesas.** Los corpus no comerciales y
   exclusivos para investigación se excluyen mecánicamente de cualquier uso que su licencia
   no permita. Las restricciones establecidas por una comunidad más allá de la licencia se
   registran con su fuente y se respetan de la misma manera. El cumplimiento reside en
   controles previos al push ejecutados localmente antes de cada push (la CI está actualmente deshabilitada) y
   en desencadenadores de base de datos, no en un código de conducta.

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

5. **La atribución y el crédito viajan con los datos.** El crédito para los creadores y lingüistas
   es obligatorio en cada superficie donde aparezca un corpus. Donde una comunidad haya
   aplicado etiquetas TK o BC de [Local Contexts](https://localcontexts.org/), tenemos
   la intención de mostrarlas y respetar el protocolo que codifican; la compatibilidad con etiquetas
   aún no está implementada. Portaremos las etiquetas; nunca las emitiremos nosotros.

6. **Los colaboradores recibirán una remuneración.** La creación y validación de corpus son
   un trabajo profesional, que se pagará según las tarifas publicadas una vez que se obtengan fondos (actualmente no
   se dispone de fondos); consulte
   [Cómo se les paga a los hablantes](/docs/network/perspectives/how-speakers-get-paid).
   El pago no compra el corpus: el creador recibe su remuneración *y* se mantiene como
   su custodio.

## Cómo una licencia se convierte en un mecanismo de cumplimiento

El compromiso 2 tiene una forma específica y vale la pena enunciarlo en su totalidad; así es
como "cada licencia se respeta" opera en la práctica, no como un resumen de buenas
intenciones.

**Cada benchmark ingresa en estado retenido.** Un conjunto de pruebas recién catalogado se pone en cuarentena de
forma predeterminada: visible en el índice, pero excluido de la cola de evaluación, de las
competencias y de cualquier clasificación. No se asume nada sobre un corpus al momento de su incorporación
—ni siquiera una licencia de apariencia permisiva— hasta que sus términos se revisen contrastándolos
con el texto real de la licencia en una revisión fija del repositorio original.

**Los veredictos de revisión son mecánicos y los casos difíciles permanecen retenidos.** Una licencia permisiva
expresada con claridad habilita el corpus para todos los canales. Una licencia no comercial
expresada con claridad lo habilita para un canal de investigación que queda excluido de
cualquier superficie comercial, de concursos y de API. Y una licencia que no esté especificada,
esté modificada, sea mixta o personalizada **nunca se interpreta en nombre del titular de los
derechos**: el corpus permanece catalogado pero retenido —fuera de la cola, de las competencias
y de las clasificaciones— hasta que el titular de los derechos defina los términos o registre una autorización. El
veredicto, su fecha, su canal y su fundamento se registran de forma legible por máquina en la
ficha del corpus y en sus entradas de registro, de modo que "¿por qué se puede ejecutar esto?" siempre tenga una
respuesta citable, al igual que "¿por qué no?".

**Enviar texto a un modelo constituye una transmisión, y está sujeta a controles.** Evaluar un
modelo implica enviarle oraciones de origen: eso equivale a que el corpus sale de su origen y
está regulado según la licencia. Los corpus con licencias permisivas pueden utilizar canales
estándar. Los corpus bajo una licencia no comercial declarada viajan únicamente a través de
canales que por contrato no se entrenan con las entradas provistas; estipulado exactamente así: una
garantía de no entrenamiento, no de no retención. A los corpus con autorizaciones no declaradas o
modificadas se les deniega rotundamente la evaluación remota hasta que se registre el consentimiento,
y los conjuntos comunitarios cerrados nunca salen en absoluto de la infraestructura de su custodio. Cuando el
control lo deniega, su mensaje de rechazo cita el veredicto de la revisión de la licencia.

**La aplicación de reglas opera por debajo de cada cliente.** Las retenciones se aplican mediante un
desencadenador de base de datos que ningún cliente puede eludir, la regla de no alojamiento se aplica mediante un
control previo al push, ejecutado localmente antes de cada push (la CI está actualmente deshabilitada), que
analiza cada ruta rastreada y enviada en busca de contenido de corpus, y el
control de transmisión se ejecuta dentro del propio arnés de evaluación. Cualquiera de ellos puede
decirnos que no, y ese es precisamente el objetivo.

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

- **Principios de soberanía de datos de las Primeras Naciones** — Las Primeras Naciones de Canadá
  han articulado la propiedad, el control, el acceso y la posesión comunitaria de
  su propia información; el modelo de custodia aquí planteado está diseñado para ser
  compatible con esas afirmaciones.
- **[Principios CARE](https://www.gida-global.org/care)** (Beneficio Colectivo,
  Autoridad para Controlar, Responsabilidad, Ética) — Alianza Global de Datos Indígenas.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — Red de Soberanía de Datos
  Maorí.
- **La [Licencia Kaitiakitanga](https://tehiku.nz/)** — Licencia basada en la custodia de Te Hiku Media
  para datos en te reo māori, una influencia directa en el modelo de custodia
  donde el custodio conserva las llaves utilizado aquí.

Señalamos a cualquiera que diseñe gobernanza para los datos de su propio idioma
directamente a esas fuentes — son las autoridades, no nosotros. Donde una
comunidad adopta cualquiera de estos marcos para su corpus, la tarjeta de corpus
registra esa afirmación y la herramienta la honra.

Champollion tiene la intención de adoptar el **Aviso "Open to Collaborate"** y las etiquetas
de Local Contexts; ninguno de los dos está implementado aún. Cuando lo estén, las etiquetas
creadas por la comunidad prevalecerán sobre cualquier cosa que digamos sobre los datos de una comunidad.

## Consulte también

- [Soberanía de datos, desde cero](/docs/learn/data-sovereignty) — la versión introductoria de esta página, para lectores que se inician en esta idea

- [Registrando Corpus y Carriles de Exposición](/docs/network/sovereignty/registering-corpora) — la mecánica
- [Para Comunidades de Idiomas](/docs/network/community/for-language-communities) — una guía en lenguaje simple
- [Cómo se Pagan los Hablantes](/docs/network/perspectives/how-speakers-get-paid) — tasas y términos publicados
- [Métodos de Traducción](https://champollion.dev/docs/guides/translation-methods) — el método `api`, que mantiene los indicadores, diccionarios y datos de entrenamiento de una comunidad en sus propios servidores
