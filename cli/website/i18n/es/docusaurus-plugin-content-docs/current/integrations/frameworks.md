# Guías de Integración

Configuración paso a paso de champollion con frameworks populares.

Los comandos de esta página ejecutan champollion con `npx --yes champollion@0.5 <command>`: fijado a la línea 0.5, como en la [guía de CI](/docs/guides/ci-cd), de modo que su computadora y su CI ejecuten la misma versión y un nuevo lanzamiento nunca altere una ejecución por sorpresa. Una alternativa es la instalación local en el proyecto. En un proyecto de Node, `npm install --save-dev champollion@0.5` lo agrega a `package.json` y luego `npx champollion sync` ejecuta esa copia.

---

## Configuración de Clave API

Antes de integrar con cualquier framework, necesita una clave de API de traducción. Champollion admite dos proveedores:

### Opción A: OpenRouter (recomendado)

[OpenRouter](https://openrouter.ai) proporciona una API unificada para 200+ modelos LLM. Nivel gratuito disponible.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Mejor para: proyectos con mucho contenido, traducción de Markdown, y proyectos que necesitan protección consciente del contenido (bloques de código, shortcodes, variables de interpolación).

### Opción B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Ideal para: pares clave-valor de cadenas de gran volumen (194 idiomas). **No recomendado** para contenido en Markdown — Google Translate no reconoce bloques de código, shortcodes ni variables de interpolación.

Para usar Google Translate explícitamente:

```bash
champollion sync --method google-translate
```

> **Consejo**: Si solo `GOOGLE_TRANSLATE_API_KEY` está configurado (sin clave de OpenRouter), champollion cambia automáticamente a Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estructura del proyecto

Hugo usa `i18n/` para traducciones de cadenas y `content/` para contenido de página:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### Configuración

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Cree `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### Detalles de traducción de contenido

**Front matter**: Admite delimitadores YAML (`---`) y TOML (`+++`). Traduce `title`, `description`, `summary`, `subtitle`, `caption`, y `linkTitle` por defecto. Todos los demás campos (date, draft, tags, weight, slug, etc.) se preservan. Personalice con `translatableFields` en su configuración.

**Protección de bloques**: Los bloques de código, shortcodes de Hugo (`{{< >}}`, `{{% %}}`), código en línea, y HTML sin procesar se protegen automáticamente usando marcadores centinela Unicode. Pasan sin cambios.

**Convención de nombres de archivo**: Sigue el patrón de traducción por nombre de archivo de Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (elimina sufijo de origen)

**Omitir existentes**: Los archivos traducidos existentes nunca se sobrescriben. Elimine un archivo de destino para forzar una re-traducción.

### Formas plurales

Las configuraciones regionales TOML y YAML admiten formas plurales CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Representadas internamente como `items.one` y `items.other` para comparación, luego re-serializadas al formato seccionado correcto al escribir.

---

## next-intl (JSON)

### Estructura del proyecto

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### Configuración

```bash
npm install --save-dev champollion
```

Ejecute `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Encuentra `messages/en.json`, crea los archivos de destino vacíos y escribe una configuración como la siguiente. O bien, cree `champollion.config.json` usted mismo:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": {
    "fr": "formal-vous", "de": "formal-Sie", "ja": "polite", "es": "neutral-latam",
    "ko": "polite-haeyo", "zh": {}, "pt": "professional", "ar": {}
  }
}
```

El registro de cada destino (su tono y formalidad) se escribe en `languages`, de modo que resulta visible y editable: cambie uno por otro de los valores predeterminados del idioma (`champollion status` los enumera) o por sus propias palabras. Un idioma sin valores predeterminados se escribe como `{}`. Una lista simple, `"languages": ["fr", "de"]`, también funciona y utiliza el valor predeterminado de cada idioma.

```bash
npx --yes champollion@0.5 sync
```

Crea `messages/fr.json`, `messages/ja.json`, etc. — completamente traducidos, preservando su estructura de claves anidadas. next-intl los detecta automáticamente.

### Flujo de trabajo de desarrollo

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### Una carpeta por idioma (predeterminado de i18next)

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` encuentra `public/locales/en/` (o `locales/en/`), apunta la configuración hacia él y crea `fr/common.json`, `fr/admin/users.json` y los demás como archivos vacíos. La parte relevante de la configuración que escribe:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.5 sync
```

El archivo de cada espacio de nombres se traduce y se escribe en la misma ruta dentro de la carpeta de cada idioma. Una cadena que aparece en varios espacios de nombres se traduce una sola vez por idioma; los demás archivos la obtienen de la Memoria de Traducción. Las claves de plural (`key_one`, `key_other`) obtienen las formas propias de cada idioma, leídas desde CLDR mediante la API `Intl.PluralRules` de JavaScript: se agrega una forma que el idioma utiliza y de la que la fuente carece, y se omite la que no utiliza. Con una fuente en inglés, el español y el francés obtienen `key_many`, el ruso obtiene `key_few` y `key_many`, y el japonés conserva solo `key_other`. La sincronización indica, para sus propios idiomas, las formas que cada uno adquiere. Consulte [claves de plural en i18next](/docs/getting-started/configuration#i18next-plurals) y [Estructuras de archivos de configuración regional](/docs/getting-started/configuration#locale-layouts).

### Un archivo por idioma

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### Otras estructuras

Si sus archivos siguen otro patrón, descríbalo con `localesPattern` (`{lang}` es el idioma, `{ns}` el espacio de nombres):

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "src/i18n/{ns}/{lang}.json",
  "languages": ["fr", "de", "ja"]
}
```

---

## Flutter (ARB)

### Estructura del proyecto

`flutter gen-l10n` lee un archivo `.arb` por idioma. El archivo en inglés es la plantilla:

```
my_app/
├── l10n.yaml              ← optional: arb-dir, template-arb-file
├── lib/
│   └── l10n/
│       ├── app_en.arb     ← source of truth (template)
│       ├── app_fr.arb
│       └── app_pt_BR.arb
└── pubspec.yaml           ← flutter: generate: true
```

### Configuración

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` lee `pubspec.yaml` y `l10n.yaml` (`arb-dir`, `template-arb-file`), toma el idioma de origen del nombre de la plantilla (`app_en.arb` → `en`) y crea `app_fr.arb`, `app_de.arb` y `app_pt_BR.arb` con su `@@locale`. La configuración que escribe:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Si `l10n.yaml` define `arb-dir: assets/i18n` y `template-arb-file: intl_en.arb`, el patrón es `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Solo se traducen los mensajes. Cada destino recibe `"@@locale"` establecido con su propia configuración regional, escrito de la misma forma en que lo hace el nombre del archivo (`"pt_BR"`), ya que `gen-l10n` rechaza cualquier archivo cuyo `@@locale` no coincida con su nombre. Cada objeto de metadatos `@key`, como los marcadores de posición y sus tipos, se copia desde `app_en.arb` sin cambios. Las claves siguen el orden de la plantilla, y los mensajes que aún no han sido traducidos se omiten, de modo que Flutter recurre al mensaje en inglés.

Las descripciones en los metadatos de la plantilla se envían al modelo como contexto:

```json title="lib/l10n/app_en.arb"
{
  "@@locale": "en",
  "itemCount": "{count, plural, =0{No items} one{1 item} other{{count} items}}",
  "@itemCount": {
    "description": "Badge on the cart icon",
    "placeholders": { "count": { "type": "int" } }
  }
}
```

La sintaxis de `{count, plural, …}`, el marcador de posición `{count}` y los selectores están protegidos: cualquier traducción que los modifique es rechazada y reintentada (consulte [mensajes ICU](/docs/getting-started/configuration#icu)). El francés puede agregar una rama `many` y el polaco `few` y `many`. `champollion verify` también comprueba `@@locale` y los metadatos de marcadores de posición de cada archivo de destino. Si una herramienta anterior los tradujo, `champollion sync --pair en:fr --force` reescribe el archivo. Los mensajes sin cambios se obtienen de la caché sin costo alguno.

### Configuraciones regionales fuera de la propia lista de Flutter {#flutter-locales-outside-flutters-own-list}

Sus mensajes provienen de los archivos `.arb`. El texto dentro de los propios widgets de Flutter —un selector de fecha, «Atrás», «Cancelar», la dirección del texto— proviene de `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), que abarca una lista fija de idiomas ([lista de Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Un código de uso privado como `qaa` y la mayoría de los idiomas de bajos recursos no figuran en ella. Con una configuración regional de este tipo en `supportedLocales`, la aplicación falla en tiempo de ejecución («No MaterialLocalizations found») a menos que un delegado proporcione dicho texto. `init`, y una sincronización que crea un nuevo archivo `.arb`, lo advierten para cada destino fuera de la lista: lo leen desde el SDK de Flutter en la máquina (`FLUTTER_ROOT` o el `flutter` en `PATH`), y sin él indican qué destinos no pudieron verificar.

La solución más simple consiste en prestar a esos widgets el texto de un idioma cubierto por Flutter (inglés en este caso):

```dart title="lib/fallback_localizations.dart"
import 'package:flutter/widgets.dart';

/// Flutter's own widget text for the app's locales flutter_localizations
/// does not cover, borrowed from a locale it does cover.
class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T> {
  const FallbackLocalizationsDelegate(this.covered, this.languages);

  final LocalizationsDelegate<T> covered; // e.g. GlobalMaterialLocalizations.delegate
  final Set<String> languages;            // your codes outside Flutter's list

  @override
  bool isSupported(Locale locale) => languages.contains(locale.languageCode);

  @override
  Future<T> load(Locale locale) => covered.load(const Locale('en'));

  @override
  bool shouldReload(FallbackLocalizationsDelegate<T> old) => false;
}
```

Inclúyalo después de los propios delegados de Flutter:

```dart
MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    FallbackLocalizationsDelegate<MaterialLocalizations>(GlobalMaterialLocalizations.delegate, {'qaa'}),
    FallbackLocalizationsDelegate<CupertinoLocalizations>(GlobalCupertinoLocalizations.delegate, {'qaa'}),
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  // …
)
```

Los widgets mostrarán entonces etiquetas en inglés dentro de una aplicación cuyo texto propio está en su idioma. Para traducir también el texto de los widgets, la guía de Flutter muestra un `MaterialLocalizations` completo para un nuevo idioma: [Agregar compatibilidad con un nuevo idioma](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django y gettext (.po)

La CLI de champollion está disponible con código fuente bajo la [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libre de usar, modificar y compartir para fines no comerciales. Su uso con fines comerciales no está cubierto por esta licencia ([quién puede usar esto](/docs/getting-started/who-may-use-this)).

### Estructura del proyecto

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Ajustes: LOCALE_PATHS y LANGUAGES {#django-locale-paths}

Django busca catálogos en las carpetas que `LOCALE_PATHS` enumera y en la carpeta `locale/` de cada aplicación instalada. Un `locale/` junto a `manage.py` no pertenece a ninguna aplicación, por lo que hasta que `LOCALE_PATHS` no lo mencione, `compilemessages` seguirá generando sus archivos `.mo`, pero el sitio continuará mostrando el texto sin traducir. `LANGUAGES` es la lista de idiomas que ofrece el sitio; el valor predeterminado de Django incluye todos los idiomas con los que se distribuye, así que liste los suyos propios:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Configuración

Cree o actualice primero los catálogos con Django. El catálogo en inglés es la fuente. Sus `msgstr` vacíos significan «el msgid es el texto»:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` encuentra `manage.py` y `locale/en/LC_MESSAGES/django.po` y escribe:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` es el dominio de gettext, por lo que tanto `django.po` como `djangojs.po` se sincronizan.

**Los valores predeterminados son un tono y un estilo de género; `init` imprime ambos.** `formal-vous` le solicita al modelo «Francés formal. Use la forma vous (vouvoiement) de manera coherente. Registro profesional y académico». Las pautas de género para el francés solicitan *écriture inclusive* con el punto medio cuando se desconoce el género del lector (`Connecté·e`, `Utilisateur·rice·s`); las del ruso (`formal-vy`) usan el masculino, el valor predeterminado convencional. Un sitio que requiera algo diferente (por ejemplo, las páginas de pacientes de una clínica) lo modifica en `champollion.config.json`: el registro en `languages` (`"fr": "casual-tu"`, o sus propias palabras), y `genderGuidance` — `false` para ninguna instrucción, o la suya propia, como `"Use the masculine generic."` ([Pautas de género](/docs/getting-started/configuration#gender-guidance)). Un ajuste modificado obtiene sus propias entradas en caché, por lo que `sync --redo all` vuelve a traducir lo que el anterior escribió.

**Qué método traduce y qué clave necesita.** Sin `--method`, `init` configura el predeterminado, `llm`: un modelo en [OpenRouter](https://openrouter.ai), que necesita `OPENROUTER_API_KEY` en el entorno o en un archivo `.env` junto a `manage.py` (`init` imprime la línea que debe definirse cuando falta). En una máquina que ejecuta un servidor de modelos (Ollama, LM Studio, vLLM), `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` no necesita ninguna clave y nada sale de la máquina. Un runner de CI no tiene un servidor de modelos, por lo que CI especifica un modelo alojado para su ejecución (consulte la [guía de CI](/docs/guides/ci-cd)). Todos los métodos y la clave que necesita cada uno: [Métodos de traducción](/docs/guides/translation-methods).

Luego:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

Sync traduce cada entrada con un `msgstr` vacío y cada entrada `fuzzy`, eliminando el indicador `fuzzy`. Las entradas ya traducidas se conservan byte por byte, junto con sus comentarios. Una entrada con un `msgctxt` es su propia clave y su propia entrada de caché, por lo que "Open" como verbo y "Open" como adjetivo se traducen por separado. Los comentarios `#.` y el contexto se envían al modelo; para ver la solicitud exacta sin enviarla, ejecute `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (el contexto y el comentario aparecen bajo "UI context for these keys").

**Volver a traducir una entrada deliberadamente.** Especifíquela por su msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Esto se entrega desde la Memoria de Traducción cuando la caché ya almacena ese texto, de modo que usted obtiene la misma traducción de vuelta sin costo, y la sincronización lo indica mediante el comando `--fresh`. Dicha repetición no necesita un modelo: con `local` y el servidor de modelos detenido, la sincronización advierte que el servidor no responde y que esta ejecución no lo necesita, y continúa (una repetición que deba enviar algo se detiene, indicando el nombre del servidor). Para pagar por una nueva traducción, agregue `--fresh`. Una coma dentro de un msgid se escribe `\,`, y las comillas evitan que la shell interprete el resto. Una entrada con contexto se especifica como la imprimen los informes: `verb␄Open`. Si no puede escribir `␄`, escriba `\x04` en su lugar: `--redo 'keys:verb\x04Open'`. Ambas formas funcionan, y los comandos de reparación muestran ambas. Para especificar la entrada únicamente en un dominio, anteponga el dominio: `django::Welcome`. Un nombre que no coincida con ninguna entrada hace fallar la ejecución (exit 1) y lista las entradas más cercanas, por ejemplo cada contexto del msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Nunca se da por válida como una repetición completada.

Un catálogo creado por champollion (`init --langs`, o la sincronización para un idioma que aún no tiene catálogo) recibe el encabezado estándar de gettext, los campos que `msginit` escribe, por lo que `msgfmt -c` lo acepta. El encabezado de un catálogo existente nunca se reescribe.

**Advertencias de encabezado de `msgfmt -c` en catálogos iniciados por `makemessages`.** `makemessages` escribe el encabezado de plantilla de gettext —`Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, marcado como `#, fuzzy`— y `msgfmt -c` luego advierte en cada compilación que cada campo «still has the initial default value». La sincronización no modifica esos valores (en un encabezado existente solo rellena un `Plural-Forms` de marcador de posición o el juego de caracteres), así que corríjalos una vez a mano en cada catálogo: el nombre y la versión de su proyecto, la fecha, un traductor (o `Automatically generated`) y un equipo (o `none`); además, elimine la línea `#, fuzzy` situada arriba de `msgid ""`, la cual marca el encabezado como aún no revisado. `makemessages` conserva los valores que usted escriba. `compilemessages` (`msgfmt --check-format`) no comprueba el encabezado, por lo que estas advertencias nunca hacen que falle.

**Plurales.** `msgid` + `msgid_plural` se convierten en un solo mensaje que el modelo traduce con todas las formas que el idioma necesita. Las formas se escriben en `msgstr[0]`, `msgstr[1]`, … de acuerdo con el encabezado `Plural-Forms` del catálogo. Django lo escribe por usted. Un catálogo sin este encabezado recibe el que `msginit` escribe para el idioma (francés `nplurals=2; plural=(n > 1);`), o uno derivado de CLDR para un idioma que `msginit` no incluya en su lista:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Cuando la traducción omite una forma que el idioma utiliza para conteos habituales (en ruso, `few` o `many`), la sincronización se la vuelve a solicitar al modelo. Si la respuesta aún carece de ella, la sincronización escribe la forma `other` en su lugar, marca la entrada con un comentario `# champollion:` y la nombra con el comando para volver a solicitarla (`--redo 'keys:django::One file' --fresh`). Cada sincronización finaliza con `2` mientras haya una entrada marcada en el catálogo, no solo la sincronización que la escribió, al igual que con una clave retenida. Su línea de verificación de cierre indica que la ejecución está incompleta en lugar de `[OK]`. Escriba las formas a mano y elimine la línea de comentario, o solicítelas de nuevo con un `--model` más potente. Una sincronización con otro método o modelo (el modelo alojado de CI, después de uno local) vuelve a solicitar la entrada automáticamente, y `sync --redo gaps` solicita todas las entradas marcadas; si la respuesta también carece de las formas, la entrada permanece marcada. En CI, esto hace que el trabajo falle después del commit (consulte la [guía de CI](/docs/guides/ci-cd#plural-gaps)).

**Otras estructuras de gettext.**

| Proyecto | Configuración | Fuente |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, o el único `.pot` en `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, o `messages.pot` en `translations/` o en la carpeta superior |

Los marcadores de posición de `printf` (`%s`, `%(name)s`, `%d`) deben conservarse tras la traducción, y el control de calidad rechaza cualquier valor que pierda alguno. De todos modos, ejecute `msgfmt --check-format` (`compilemessages` lo hace) antes de pasar a producción. También comprueba los tipos de marcadores de posición, pero solo en las entradas marcadas con `#, python-format`: `makemessages` agrega el indicador a las entradas que extrae con un marcador de posición `%`, mientras que un catálogo creado manualmente puede no tenerlo, dejando esas entradas sin verificar. `champollion verify` compara los marcadores de posición de tipo printf de cada entrada (nombre y letra de tipo) sin importar sus indicadores, y la sincronización mantiene los indicadores de la entrada de origen en cada entrada que traduce. Los catálogos deben estar en UTF-8. Consulte [catálogos de gettext](/docs/getting-started/configuration#gettext) para ver las reglas completas.
