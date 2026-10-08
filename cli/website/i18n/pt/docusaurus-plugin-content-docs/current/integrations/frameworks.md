# Guias de Integração

Configuração passo a passo do champollion com frameworks populares.

Os comandos nesta página executam o champollion com `npx --yes champollion@0.5 <command>`: fixado na linha 0.5, como no [guia de CI](/docs/guides/ci-cd), para que seu computador e sua CI executem a mesma versão e uma nova versão nunca altere uma execução de surpresa. Uma instalação local no projeto é a alternativa. Em um projeto Node, `npm install --save-dev champollion@0.5` o adiciona ao `package.json`, e `npx champollion sync` executa essa cópia.

---

## Configuração de Chave de API

Antes de integrar com qualquer framework, você precisa de uma chave de API de tradução. Champollion suporta dois provedores:

### Opção A: OpenRouter (recomendado)

[OpenRouter](https://openrouter.ai) fornece uma API unificada para 200+ modelos LLM. Camada gratuita disponível.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Melhor para: projetos com muito conteúdo, tradução de Markdown e projetos que precisam de proteção de conteúdo (blocos de código, shortcodes, variáveis de interpolação).

### Opção B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Ideal para: alto volume de pares de strings chave-valor (194 idiomas). **Não recomendado** para conteúdo em Markdown — o Google Translate não reconhece blocos de código, shortcodes ou variáveis de interpolação.

Para usar Google Translate explicitamente:

```bash
champollion sync --method google-translate
```

> **Dica**: Se apenas `GOOGLE_TRANSLATE_API_KEY` estiver definido (sem chave OpenRouter), champollion muda automaticamente para Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estrutura do projeto

Hugo usa `i18n/` para traduções de strings e `content/` para conteúdo de página:

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

### Configuração

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Crie `champollion.config.json`:

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

### Detalhes da tradução de conteúdo

**Front matter**: Suporta delimitadores YAML (`---`) e TOML (`+++`). Traduz `title`, `description`, `summary`, `subtitle`, `caption` e `linkTitle` por padrão. Todos os outros campos (data, draft, tags, weight, slug, etc.) são preservados. Personalize com `translatableFields` na sua configuração.

**Proteção de blocos**: Blocos de código, shortcodes Hugo (`{{< >}}`, `{{% %}}`), código inline e HTML bruto são automaticamente protegidos usando placeholders sentinela Unicode. Eles passam intactos.

**Convenção de nome de arquivo**: Segue o padrão de tradução por nome de arquivo do Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (remove sufixo de origem)

**Pular existentes**: Arquivos traduzidos existentes nunca são sobrescritos. Delete um arquivo de destino para forçar re-tradução.

### Formas plurais

Locales TOML e YAML suportam formas plurais CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Representadas internamente como `items.one` e `items.other` para diff, depois re-serializadas para o formato seccionado correto na escrita.

---

## next-intl (JSON)

### Estrutura do projeto

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

### Configuração

```bash
npm install --save-dev champollion
```

Execute `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Ele encontra `messages/en.json`, cria os arquivos de destino vazios e grava uma configuração como a mostrada abaixo. Ou crie você mesmo o `champollion.config.json`:

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

O registro de cada destino (seu tom e nível de formalidade) é gravado em `languages`, ficando visível e editável: altere um para outro preset do idioma (`champollion status` lista todos eles) ou defina com suas próprias palavras. Um idioma sem presets é gravado como `{}`. Uma lista simples, `"languages": ["fr", "de"]`, também funciona e usa o padrão de cada idioma.

```bash
npx --yes champollion@0.5 sync
```

Cria `messages/fr.json`, `messages/ja.json`, etc. — totalmente traduzidos, preservando sua estrutura de chaves aninhadas. next-intl os detecta automaticamente.

### Fluxo de trabalho de desenvolvimento

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

### Uma pasta por idioma (padrão do i18next)

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

`init` localiza `public/locales/en/` (ou `locales/en/`), aponta a configuração para ele e cria `fr/common.json`, `fr/admin/users.json` e os demais como arquivos vazios. A parte relevante da configuração gerada:

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

Cada arquivo de namespace é traduzido e gravado no mesmo caminho na pasta de cada idioma. Uma string que aparece em vários namespaces é traduzida uma vez por idioma; os outros arquivos a obtêm da Memória de Tradução. Chaves de plural (`key_one`, `key_other`) recebem as formas próprias de cada idioma, lidas do CLDR por meio da API `Intl.PluralRules` do JavaScript: uma forma que o idioma usa e que falta na origem é adicionada, e uma que ele não usa é omitida. Com uma origem em inglês, o espanhol e o francês ganham `key_many`, o russo ganha `key_few` e `key_many`, e o japonês mantém apenas `key_other`. O comando sync lista, para seus próprios idiomas, as formas que cada um ganha. Consulte [chaves de plural do i18next](/docs/getting-started/configuration#i18next-plurals) e [Estruturas de arquivos de localidade](/docs/getting-started/configuration#locale-layouts).

### Um arquivo por idioma

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

### Outras estruturas

Se os seus arquivos seguirem outro padrão, descreva-o com `localesPattern` (`{lang}` é o idioma, `{ns}` o namespace):

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

### Estrutura do projeto

O `flutter gen-l10n` lê um arquivo `.arb` por idioma. O arquivo em inglês é o modelo:

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

### Configuração

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

O `init` lê `pubspec.yaml` e `l10n.yaml` (`arb-dir`, `template-arb-file`), obtém o idioma de origem a partir do nome do modelo (`app_en.arb` → `en`) e cria `app_fr.arb`, `app_de.arb` e `app_pt_BR.arb` com seus `@@locale`. A configuração gerada:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Se `l10n.yaml` definir `arb-dir: assets/i18n` e `template-arb-file: intl_en.arb`, o padrão será `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Apenas as mensagens são traduzidas. Cada destino tem o `"@@locale"` definido para sua própria localidade, grafado da mesma forma que no nome do arquivo (`"pt_BR"`), pois o `gen-l10n` recusa um arquivo cujo `@@locale` não corresponda ao seu nome. Todo objeto de metadados `@key`, como marcadores de posição (placeholders) e seus tipos, é copiado de `app_en.arb` sem alterações. As chaves seguem a ordem do modelo, e uma mensagem que ainda não foi traduzida é omitida, fazendo com que o Flutter use a mensagem em inglês como fallback.

As descrições nos metadados do modelo são enviadas ao modelo como contexto:

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

A sintaxe `{count, plural, …}`, o placeholder `{count}` e os seletores são protegidos: uma tradução que os altere é rejeitada e repetida (consulte [mensagens ICU](/docs/getting-started/configuration#icu)). O francês pode adicionar uma ramificação `many` e o polonês `few` e `many`. O `champollion verify` também verifica `@@locale` e os metadados de placeholders de cada arquivo de destino. Se uma ferramenta anterior os tiver traduzido, o `champollion sync --pair en:fr --force` reescreve o arquivo. Mensagens inalteradas vêm do cache sem custo.

### Localidades fora da lista padrão do Flutter {#flutter-locales-outside-flutters-own-list}

Suas mensagens vêm dos arquivos `.arb`. O texto dentro dos próprios widgets do Flutter — um seletor de data, "Back", "Cancel", a direção do texto — vem de `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), que cobre uma lista fixa de idiomas ([lista do Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Códigos de uso privado, como `qaa`, e a maioria dos idiomas com poucos recursos não estão nela. Com essa localidade em `supportedLocales`, o aplicativo falha em tempo de execução ("No MaterialLocalizations found"), a menos que um delegate forneça esse texto. O `init` e uma sincronização que cria um novo arquivo `.arb` avisam sobre cada destino fora da lista: eles a leem do SDK do Flutter na máquina (`FLUTTER_ROOT` ou o `flutter` no `PATH`) e, se não houver um, informam quais destinos não puderam ser verificados.

A correção mais simples empresta a esses widgets o texto de um idioma que o Flutter cobre (inglês, neste exemplo):

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

Liste-o após os próprios delegates do Flutter:

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

Os widgets passarão a exibir rótulos em inglês dentro de um aplicativo cujo texto próprio está no seu idioma. Para traduzir também o texto dos widgets, o guia do Flutter mostra um `MaterialLocalizations` completo para um novo idioma: [Adicionar suporte para um novo idioma](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django e gettext (.po)

A CLI do champollion está disponível sob a [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): gratuita para usar, modificar e compartilhar para fins não comerciais. Usá-la para fins comerciais não é coberto por esta licença ([quem pode usar](/docs/getting-started/who-may-use-this)).

### Estrutura do projeto

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Configurações: LOCALE_PATHS e LANGUAGES {#django-locale-paths}

O Django procura catálogos nas pastas listadas em `LOCALE_PATHS` e na pasta `locale/` de cada aplicativo instalado. Um `locale/` ao lado de `manage.py` não pertence a nenhum aplicativo; portanto, até que `LOCALE_PATHS` o especifique, o `compilemessages` ainda compilará seus arquivos `.mo`, mas o site continuará exibindo o texto não traduzido. `LANGUAGES` é a lista de idiomas oferecidos pelo site; o padrão do Django são todos os idiomas incluídos nele, então liste os seus próprios:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Configuração

Primeiro, crie ou atualize os catálogos com o Django. O catálogo em inglês é a origem. Seus `msgstr` vazios significam "o msgid é o próprio texto":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

O `init` encontra `manage.py` e `locale/en/LC_MESSAGES/django.po` e grava:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` é o domínio gettext, portanto `django.po` e `djangojs.po` são ambos sincronizados.

**Os padrões definem um tom e um estilo de gênero; `init` exibe ambos.** `formal-vous` solicita ao modelo "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." As orientações de gênero para o francês solicitam a *écriture inclusive* com o ponto medial quando o gênero do leitor for desconhecido (`Connecté·e`, `Utilisateur·rice·s`); as do russo (`formal-vy`) usam o masculino, o padrão convencional. Um site que precise de algo diferente (como páginas de pacientes de uma clínica, por exemplo) altera isso em `champollion.config.json`: o registro em `languages` (`"fr": "casual-tu"` ou com suas próprias palavras) e `genderGuidance` — `false` para nenhuma instrução, ou as suas próprias, como `"Use the masculine generic."` ([Orientações de gênero](/docs/getting-started/configuration#gender-guidance)). Uma configuração alterada recebe suas próprias entradas de cache, de modo que `sync --redo all` retraduz o que a configuração antiga gravou.

**Qual método traduz e qual chave ele precisa.** Sem `--method`, o `init` configura o padrão, `llm`: um modelo no [OpenRouter](https://openrouter.ai), que precisa de `OPENROUTER_API_KEY` no ambiente ou em um arquivo `.env` junto a `manage.py` (o `init` exibe a linha que deve ser configurada quando estiver ausente). Em uma máquina que executa um servidor de modelos (Ollama, LM Studio, vLLM), `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` não precisa de chave, e nada sai da máquina. Um executor de CI não possui servidor de modelos, portanto a CI especifica um modelo hospedado para sua execução (consulte o [guia de CI](/docs/guides/ci-cd)). Todos os métodos e a chave de que cada um precisa: [Métodos de tradução](/docs/guides/translation-methods).

Em seguida:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

O sync traduz todas as entradas com um `msgstr` vazio e todas as entradas `fuzzy`, removendo a flag `fuzzy`. Entradas já traduzidas são mantidas byte por byte, junto com seus comentários. Uma entrada com `msgctxt` constitui sua própria chave e sua própria entrada no cache, de modo que "Open" (verbo) e "Open" (adjetivo) sejam traduzidos separadamente. Os comentários `#.` e o contexto são enviados ao modelo — para ver a requisição exata, sem enviá-la, execute `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (o contexto e o comentário aparecem sob "UI context for these keys").

**Retraduzir uma entrada intencionalmente.** Especifique-a pelo seu msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Isso é fornecido a partir da Memória de Tradução quando o cache já contém aquele texto, de forma que você recebe a mesma tradução de volta sem custo, e o sync indica isso com o comando `--fresh`. Essa repetição não precisa de modelo: com `local` e o servidor de modelos parado, o sync avisa que o servidor não responde e que esta execução não precisa dele, e continua (uma repetição que precisa enviar algo é interrompida, indicando o servidor). Para pagar por uma nova tradução, adicione `--fresh`. Uma vírgula dentro de um msgid é escrita como `\,`, e as aspas evitam que o shell interprete o restante. Uma entrada com contexto é especificada como nos relatórios, `verb␄Open`. Se você não conseguir digitar `␄`, escreva `\x04` em vez disso: `--redo 'keys:verb\x04Open'`. Ambas as grafias funcionam, e os comandos de reparo mostram ambas. Para especificar a entrada em apenas um domínio, adicione o domínio como prefixo: `django::Welcome`. Um nome que não corresponda a nenhuma entrada faz a execução falhar (exit 1) e lista as entradas mais próximas, por exemplo, todos os contextos do msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Isso nunca é aceito como uma repetição concluída.

Um catálogo criado pelo champollion (`init --langs` ou sync para um idioma que ainda não tenha catálogo) recebe o cabeçalho gettext padrão, com os campos que o `msginit` grava, de forma que o `msgfmt -c` o aceite. O cabeçalho de um catálogo existente nunca é reescrito.

**Avisos de cabeçalho do `msgfmt -c` em catálogos iniciados por `makemessages`.** O `makemessages` grava o cabeçalho de modelo do gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, marcado como `#, fuzzy` — e o `msgfmt -c` avisa a cada compilação que cada campo "still has the initial default value". O sync não altera esses valores (em um cabeçalho existente, ele preenche apenas um `Plural-Forms` ou charset de marcador), então ajuste-os manualmente uma vez em cada catálogo: o nome e a versão do seu projeto, a data, um tradutor (ou `Automatically generated`) e uma equipe (ou `none`); remova também a linha `#, fuzzy` acima de `msgid ""`, que marca o cabeçalho como ainda não revisado. O `makemessages` mantém os valores que você inserir. O `compilemessages` (`msgfmt --check-format`) não verifica o cabeçalho, portanto esses avisos nunca fazem com que ele falhe.

**Plurais.** `msgid` + `msgid_plural` tornam-se uma única mensagem que o modelo traduz com todas as formas necessárias para o idioma. As formas são gravadas em `msgstr[0]`, `msgstr[1]`, … de acordo com o cabeçalho `Plural-Forms` do catálogo. O Django grava isso para você. Um catálogo que não possua esse cabeçalho recebe aquele que o `msginit` grava para o idioma (francês `nplurals=2; plural=(n > 1);`), ou um derivado do CLDR para um idioma que o `msginit` não lista:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Quando a tradução omite uma forma que o idioma utiliza para contagens comuns (russo `few` ou `many`), o sync solicita novamente ao modelo. Se a resposta ainda não a contiver, o sync grava a forma `other` em seu lugar, marca a entrada com um comentário `# champollion:` e a referencia com o comando para solicitar novamente (`--redo 'keys:django::One file' --fresh`). Cada execução de sync encerra com `2` enquanto houver uma entrada marcada no catálogo, não apenas a execução que a gravou, da mesma forma que ocorre com uma chave retida. Sua linha de verificação final informa que a execução está incompleta em vez de `[OK]`. Escreva as formas manualmente e remova a linha de comentário, ou solicite novamente com um `--model` mais robusto. Uma sincronização com outro método ou modelo (o modelo hospedado da CI, após um local) solicita a entrada novamente de forma automática, e `sync --redo gaps` solicita todas as entradas marcadas; se a resposta também não contiver as formas, a entrada permanecerá marcada. Na CI, isso causa a falha do job após o commit (consulte o [guia de CI](/docs/guides/ci-cd#plural-gaps)).

**Outras estruturas do gettext.**

| Projeto | Configuração | Origem |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` ou o único `.pot` em `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` ou `messages.pot` em `translations/` ou na pasta acima dela |

Os placeholders `printf` (`%s`, `%(name)s`, `%d`) devem ser mantidos na tradução, e o controle de qualidade (quality gate) rejeita qualquer valor que perca algum deles. Ainda assim, execute `msgfmt --check-format` (o que `compilemessages` faz) antes de publicar. Ele também verifica os tipos dos placeholders, mas apenas nas entradas sinalizadas com `#, python-format`: o `makemessages` adiciona a flag às entradas que extrai com um placeholder `%`, enquanto um catálogo criado manualmente pode não tê-la, deixando essas entradas sem verificação. O `champollion verify` compara os placeholders printf de cada entrada (nome e letra de tipo), independentemente de suas flags, e o sync mantém as flags da entrada de origem em cada entrada traduzida. Os catálogos devem estar em UTF-8. Consulte [catálogos gettext](/docs/getting-started/configuration#gettext) para obter as regras completas.
