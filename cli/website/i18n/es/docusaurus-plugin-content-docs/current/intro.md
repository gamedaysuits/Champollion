---
sidebar_position: 1
slug: /intro
title: "Traducción de aplicaciones y sitios"
description: "La referencia para traducir los archivos propios de una aplicación o un sitio web con `champollion sync`: qué hace, cuándo usarlo y una guía de cada página al respecto."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# Traducción de aplicaciones y sitios web

`champollion sync` mantiene las traducciones de una aplicación o de un sitio web al día
con su idioma de origen. Lee sus archivos de idioma (o sus páginas de Markdown),
encuentra lo que falta o está desactualizado, traduce únicamente eso, revisa cada
resultado y lo escribe de vuelta en el formato propio del archivo.

```bash
npx champollion sync
```

Esta sección es la referencia para esa vía de trabajo. Si desea consultar primero
la versión en palabras sencillas, lea [Traducir una aplicación o sitio web](/docs/translate-an-app-or-website).

## Qué hace `sync`

1. **Encuentra sus archivos.** Detecta la carpeta de idiomas y el formato (JSON, TOML,
   YAML, gettext PO, Flutter ARB), o una carpeta de páginas Markdown/MDX (Hugo,
   Docusaurus o cualquier carpeta que usted indique con `--content-dir`).
2. **Determina qué cambió.** Cada valor de origen se registra mediante su hash
   SHA-256 en `.champollion.lock`. Las claves que faltan, están vacías o cuyo texto
   de origen cambió se ponen en cola; todo lo demás se deja intacto.
3. **Traduce con el método que usted eligió para cada par.** Un solo archivo de configuración puede
   enviar un par a un LLM, otro a una API de traducción automática y un tercero
   a un modelo que usted mismo entrenó y aloja. Los métodos con LLM traducen con
   temperatura 0 de forma predeterminada (el único valor predeterminado en `shared/model-defaults.json`);
   un modelo alojado aún puede variar un poco entre ejecuciones, lo cual es una de las razones
   por las que la Memoria de traducción conserva lo que ya obtuvo.
4. **Reutiliza lo que ya pagó.** La Memoria de traducción guarda en caché cada
   traducción según el texto de origen, la configuración regional y el método: el texto que vuelve a aparecer (una
   cadena que volvió a su estado anterior, la misma oración en otro archivo, una repetición) es gratis.
5. **Revisa cada resultado antes de escribirlo.** El control de calidad rechaza salidas
   vacías, copias del texto de origen, bucles de repetición, texto en un sistema de escritura incorrecto,
   marcadores de posición dañados y fallas similares, con un reintento de retroalimentación.
   Detecta resultados rotos, no significados erróneos.
6. **Verifica después de escribir.** Una pasada posterior a la sincronización vuelve a leer los archivos escritos y
   comprueba la paridad de claves, valores vacíos, sistema de escritura y marcadores de posición;
   `champollion verify` y `champollion audit` ejecutan el mismo tipo de comprobaciones como
   filtros de CI.

Nada se escribe en silencio. Una clave que el control de calidad sigue rechazando tras su reintento
se deja sin traducir y se reporta, y la sincronización finaliza con `2`. El rechazo se
recuerda, de modo que la siguiente sincronización normal no pague al mismo modelo por la misma
respuesta: puede volver a solicitarla con `--redo`, añadir un método `fallback` al par o
escribir el valor a mano.

## Cuándo usarlo

- Tiene una aplicación o un sitio web cuyo texto reside en archivos de idioma o Markdown,
  y desea mantener actualizados los demás idiomas a medida que cambia el origen.
- Desea un método diferente por cada par de idiomas en un solo proyecto, con un gasto
  delimitado (`--max-cost`) y visible antes de que se facture nada (`--dry`).
- Construyó un traductor en los rieles y quiere que una aplicación lo utilice:
  `champollion connect` incorpora un modelo alojado en el proyecto de una aplicación y luego `sync`
  traduce con él. Un modelo entrenado con datos de acceso exclusivamente local se conecta
  solo cuando quienes los custodian han dado su consentimiento.

`sync` no es la forma de construir un traductor para un idioma que ningún servicio maneja
bien. Para eso, comience en [Iniciar un proyecto](/docs/start).

## Las páginas de esta sección

**Primeros pasos**

- [Inicio rápido](/docs/getting-started/quick-start) — una primera sincronización en minutos.
- [Instalación](/docs/getting-started/installation) — requisitos, claves de API
  y la licencia.
- [Configuración](/docs/getting-started/configuration) — cada campo en
  `champollion.config.json`, ajustes por par, estructuras de carpetas de idioma y alternativas.

**Su framework y su flujo de trabajo**

- [Integraciones de frameworks](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter y Django con gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` y `audit` como filtros de control.
- [Traducción de contenido](/docs/guides/content-translation) — páginas en Markdown y MDX,
  front matter y lo que se conserva.

**Cómo elegir el método de traducción**

- [Métodos de traducción](/docs/guides/translation-methods) — cada método,
  su clave y cuándo usarlo.
- [Datos de orientación](/docs/concepts/coaching-data) — notas gramaticales y listas de palabras
  proporcionadas a un LLM junto con cada solicitud.
- [Convertidores de sistemas de escritura](/docs/concepts/script-converters) y
  [Lenguas construidas, sistemas de escritura y ortografía](/docs/guides/conlangs-scripts-orthography)
  — sistemas de escritura, tipografías e idiomas inventados.

**Cómo funciona por dentro**

- [Cómo funciona la sincronización](/docs/concepts/how-sync-works) — el flujo de trabajo, paso a paso.
- [Memoria de traducción](/docs/concepts/translation-memory) — la caché y qué criterios
  usa como clave.
- [Control de calidad](/docs/concepts/quality-gate) — cada comprobación y qué ocurre
  con una clave o bloque rechazado.
- [Seguridad](/docs/concepts/security) — claves y rutas manipuladas, bloques de código
  protegidos y fallas explícitas.

**Personas y problemas**

- [Trabajar con traductores profesionales](/docs/guides/professional-translators)
  — exportación e importación en XLIFF para revisión.
- [Resolución de problemas](/docs/guides/troubleshooting) — errores comunes y soluciones.

Cada comando y opción se encuentra en la [Referencia de la CLI](/docs/reference/cli), y el
formato del complemento de método está en la [Especificación de complementos](/docs/reference/plugin-spec).

## Licencia

La CLI de `champollion` es de código disponible bajo la
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
[quién puede usarla](/docs/getting-started/who-may-use-this) detalla quiénes están cubiertos.
¿Tiene problemas o desea ayuda con su proyecto? [Hablemos](/docs/getting-help).
