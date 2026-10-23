---
title: "Quién puede usarlo y cuánto cuesta"
description: "Gratis para familias, escuelas, organizaciones benéficas y servicios públicos; licencias comerciales gratuitas para comunidades de hablantes previa solicitud. La licencia de cada paquete en palabras sencillas — un resumen, no asesoría legal; rige el texto de la licencia."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Quién puede usarlo y cuánto cuesta

**En resumen:**

- **Gratis** para familias, escuelas, organizaciones benéficas, servicios públicos como hospitales,
  oficinas de los propios gobiernos y proyectos personales o de investigación.
- **Uso comercial** —una aplicación de idiomas, un servicio de pago— no está cubierto por la
  licencia gratuita. **Si su comunidad de hablantes desea usar las herramientas
  de forma comercial, solicítelo y la licencia es gratuita.**
  [Solicitar una licencia](mailto:info@champollion.dev?subject=Commercial%20licence%20request).
- **Sin comisiones.** Champollion no se queda con ninguna parte de lo que una comunidad gane con
  su propio idioma. Si un patrocinador financia el trabajo, el dinero pasa íntegramente.
- **La ayuda es opcional.** Si desea que alguien le ayude con su proyecto, [hablemos](/docs/getting-help)
  —las condiciones se acuerdan con cada comunidad y no hay una lista de precios. Nunca nos necesita para terminar.

Eso es todo lo que la mayoría necesita. El resto de esta página contiene los detalles, para abogados y desarrolladores: los paquetes de Champollion no comparten una sola licencia, y esta página explica, en palabras sencillas, a quién cubre cada una.

**Esto es un resumen, no asesoramiento legal. El texto de la licencia prevalece.** Cada licencia está enlazada en la tabla a continuación y se incluye con su respectivo paquete.

## Los paquetes y sus licencias

| Paquete | Qué es | Licencia |
|---|---|---|
| `champollion` (npm) | La herramienta del proyecto: los rieles y la traducción de archivos de aplicaciones y sitios | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | El servidor MCP que proporciona estas herramientas a los agentes de IA | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | El conjunto de entrenamiento de modelos | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; el comando `mt-eval`) | El entorno de evaluación | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), con una [excepción para plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | El plugin del estándar de evaluación para cri de las llanuras | Su propia licencia provisional: uso únicamente con permiso ([en PyPI](https://pypi.org/project/champollion-lyss/)) |

Los registros de datos (`shared/`) y las migraciones de la base de datos (`mt-eval-arena/`) en el [repositorio](https://github.com/gamedaysuits/Champollion) están bajo Apache-2.0.

## La CLI, el servidor MCP y nmt-forge

Estos tres están bajo la Licencia PolyForm Noncommercial 1.0.0. Usted puede usarlos, modificarlos y compartirlos para un **propósito no comercial**. La licencia define esos propósitos. Dos de sus cláusulas resuelven la mayoría de los casos:

> **Usos personales.** El uso personal para investigación, experimentación y pruebas en beneficio del conocimiento público, estudio personal, entretenimiento privado, proyectos de pasatiempo, actividades aficionadas o práctica religiosa, sin ninguna aplicación comercial prevista, es un uso para un propósito permitido.

> **Organizaciones no comerciales.** El uso por parte de cualquier organización benéfica, institución educativa, organización pública de investigación, organización de salud o seguridad pública, organización de protección ambiental o institución gubernamental es un uso para un propósito permitido, independientemente de la fuente de financiamiento o de las obligaciones derivadas de este.

Para una organización de alguno de esos tipos, la forma en que se financie no altera la respuesta: la cláusula establece "independientemente de la fuente de financiamiento".

| Quién | ¿Cubierto? | Por qué |
|---|---|---|
| Una escuela que traduce su aplicación o su boletín informativo | ✓ Sí | Una institución educativa |
| Un hospital público o una clínica de salud pública que traduce instrucciones para pacientes | ✓ Sí | Una organización de salud o seguridad pública |
| Una organización benéfica que traduce su sitio web | ✓ Sí | Una organización benéfica |
| Una oficina gubernamental o un instituto público de investigación | ✓ Sí | Una institución gubernamental o una organización pública de investigación |
| Usted, en un proyecto personal o de investigación sin ninguna aplicación comercial prevista | ✓ Sí | Uso personal para investigación, experimentación, pruebas, estudio privado o un pasatiempo |
| Una tienda que traduce su escaparate comercial | ✗ No | El producto de un negocio con fines de lucro constituye un uso comercial |
| Una clínica privada con fines de lucro que traduce su portal para pacientes | ✗ No | El producto de un negocio con fines de lucro constituye un uso comercial. No es una organización de salud pública |

El propósito comercial no está cubierto: esta licencia no otorga permiso para ello.
Si una comunidad de hablantes desea usar estas herramientas comercialmente, puede solicitar una
licencia comercial, y para una comunidad de hablantes esa licencia es gratuita:
[solicite una](mailto:info@champollion.dev?subject=Commercial%20licence%20request).

## El entorno de evaluación (`mt-eval-harness`)

El entorno de evaluación es de código abierto bajo la Licencia Pública General Affero de GNU, versión 3 o posterior (AGPL-3.0-or-later). La AGPL permite el uso comercial, bajo sus propios términos. Los principales son:

- Si usted distribuye el entorno, modificado o no, debe hacerlo bajo la misma licencia y junto con su código fuente.
- Si usted modifica el entorno y permite que otras personas lo utilicen a través de una red, debe poner a disposición de esas personas el código fuente de su versión modificada (sección 13, "Interacción remota a través de una red").

Una autorización independiente ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), bajo la sección 7 de la AGPL) permite que los complementos de estándares de evaluación bajo otras licencias funcionen con el entorno a través de su interfaz pública de complementos. Esto no modifica la propia licencia del entorno.

## El complemento para cree de las llanuras (`champollion-lyss`)

`champollion-lyss` tiene su propia licencia provisional: solo puede utilizarse con autorización por escrito. Por lo general, la autorización se concede de forma gratuita para investigación no comercial, educación y uso en beneficio de la comunidad. No se permite ningún uso comercial. Es una licencia provisional, pensada para ser reemplazada por términos definidos mediante la gobernanza comunitaria. El texto de la licencia y su aviso NOTICE se incluyen con el paquete.

## Qué no cubren estas licencias

Los servicios de traducción, modelos y corpus que usted utilice a través de estas herramientas conservan sus propios términos: los términos de la API de un proveedor, la licencia de un modelo o la licencia de un corpus. El entorno registra la licencia de cada corpus y aplica sus reglas sobre qué servicios de modelos pueden acceder a él, pero dichos términos los establecen sus propietarios, no las licencias descritas en esta página.

## Los textos de las licencias

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (también en [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): la CLI, y el mismo texto para el [servidor MCP](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) y [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) y su [excepción para complementos](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): el entorno de evaluación
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): su licencia provisional y NOTICE se incluyen en el paquete

Esta página es un resumen, no asesoramiento legal. En caso de discrepancia entre esta página y el texto de una licencia, el texto de la licencia prevalece.
