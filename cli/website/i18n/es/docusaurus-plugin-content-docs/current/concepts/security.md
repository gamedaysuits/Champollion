---
sidebar_position: 4
title: "Seguridad"
---

# Seguridad y Protección

Champollion está diseñado para ser seguro en entornos adversariales — donde los datos de localización podrían provenir de fuentes no confiables, donde nombres de archivo manipulados podrían escapar límites de directorios, y donde la salida del LLM puede contener cualquier cosa.

## Modelo de Amenazas

| Amenaza | Vector de Ataque | Mitigación |
|--------|--------------|-----------|
| **Prototype pollution** | Claves JSON manipuladas (`__proto__`, `constructor`) | Rechazadas en tiempo de análisis |
| **Path traversal** | Códigos de localización como `../../etc/passwd` | Escrituras de archivo validadas en directorios configurados |
| **Corrupción de bloques de código** | LLM traduce dentro de cercas de código | Protección con centinela Unicode |
| **Claves alucinadas** | LLM devuelve claves que no fueron enviadas | Validación de respuesta — solo se escriben claves aceptadas |
| **Gasto de tokens descontrolado** | Bucles de reintentos infinitos | Presupuesto limitado mediante `maxRetries` |

## Protección contra Prototype Pollution

Todas las claves de localización se validan contra una lista de bloqueo antes del procesamiento:

- `__proto__`
- `constructor`
- `prototype`

Cualquier clave que coincida con estos patrones es rechazada con un error. Esto previene que atacantes usen archivos de localización manipulados para modificar prototipos de objetos JavaScript.

## Contención de Rutas

Al escribir archivos de localización, champollion valida que la ruta de salida permanezca dentro de los directorios configurados (`localesDir`, `contentDir`). Los códigos de localización se sanitizan — un código como `../../secrets` no puede escribir fuera del directorio esperado.

## Protección de Bloques

Durante la traducción de contenido Markdown, los elementos estructurados se reemplazan con marcadores centinela Unicode antes de enviar el texto al LLM:

1. **Bloques de código** (cercados e inline) → centinela
2. **Shortcodes de Hugo** (`{{< >}}`, `{{% %}}`) → centinela  
3. **HTML sin procesar** → centinela
4. **Variables de interpolación** (`{{ .Count }}`) → centinela

Después de la traducción, los centinelas se reemplazan con el contenido original. El LLM nunca ve bloques de código, shortcodes o HTML — no puede corromperlos.

## Validación de Respuesta

Cuando el LLM devuelve una respuesta JSON, champollion valida que:
- Solo las claves que fueron enviadas en el lote aparezcan en la respuesta
- No se inyecten claves adicionales
- La respuesta se analice como JSON válido

Las claves alucinadas se descartan silenciosamente. Esto previene que la salida del LLM inyecte traducciones inesperadas en sus archivos de localización.

## Puerta de Calidad

Cada traducción se valida a través de cinco verificaciones determinísticas antes de escribirse en disco. Consulte [Puerta de Calidad](/docs/concepts/quality-gate) para más detalles.

## Retroceso Exponencial

Las llamadas a API utilizan retroceso exponencial con jitter en respuestas 429 (límite de velocidad) y 5xx (error del servidor). Tres reintentos con retrasos crecientes previenen sobrecargar la API durante interrupciones.

## Tiempo de Espera de Solicitud

Cada solicitud a API tiene un tiempo de espera de 30 segundos mediante `AbortController`. Esto previene que el proceso de sincronización se cuelgue indefinidamente en una conexión muerta.

## Fallos de Traducción Ruidosos

Cuando la API no está disponible o una traducción falla, champollion lanza un error ruidoso con orientación accionable en lugar de escribir silenciosamente basura. Nunca se escriben marcadores con prefijo `[EN]` durante la sincronización.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

El fallo de un archivo no detiene toda la sincronización — el error se registra y la tubería continúa al siguiente archivo, para que obtenga el máximo progreso por ejecución.

## Verificación Posterior a la Sincronización

Después de que todas las traducciones se completen, champollion relee los archivos de localización escritos desde disco y ejecuta una pasada de verificación. Esto detecta la brecha entre la sincronización reportando éxito y las traducciones siendo incorrectas en realidad:

- **Paridad de claves** — todas las claves de origen presentes en cada objetivo
- **Marcadores `[EN]`** — marcadores de respaldo heredados de ejecuciones anteriores
- **Traducciones vacías** — valores en blanco que se filtraron
- **Cumplimiento de script** — localizaciones no latinas con traducciones solo ASCII
- **Preservación de marcadores de posición** — marcadores de posición ICU coinciden con la fuente

Omita con `--no-verify` o ejecute de forma independiente con `npx champollion verify`.

## Pruebas

Las propiedades de seguridad se verifican mediante la suite de pruebas adversariales:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Véase También

- [Arquitectura](/docs/concepts/architecture) — cómo se conecta el ecosistema de tres piezas
- [Referencia de CLI — integridad](/docs/reference/cli#integrity) — comando de verificación de integridad
- [Referencia de CLI — procedencia](/docs/reference/cli#provenance) — comando de auditoría de procedencia
- [Especificación de Plugin](/docs/reference/plugin-spec) — campos de procedencia en manifiestos de plugin
- [Puerta de Calidad](/docs/concepts/quality-gate) — verificaciones de seguridad a nivel de traducción
