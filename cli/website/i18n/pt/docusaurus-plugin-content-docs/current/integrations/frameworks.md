# Guias de integração

Configuração passo a passo do champollion com frameworks populares.

Os comandos nesta página executam o champollion com `npx --yes champollion@0.6 <command>`: fixado na linha 0.6, como no [guia de CI](/docs/guides/ci-cd), para que seu notebook e seu CI executem a mesma versão e um novo lançamento nunca altere uma execução de surpresa. Uma instalação local no projeto é a alternativa. Em um projeto Node, `npm install --save-dev champollion@0.6` o adiciona a `package.json`, e `npx champollion sync` então executa essa cópia.

---

## Configuração da chave de API

Antes de integrar com qualquer framework, você precisa de uma chave de API de tradução. O Champollion oferece suporte a dois provedores:

### Opção A: OpenRouter (recomendado)

O [OpenRouter](https://openrouter.ai) oferece uma API unificada para mais de 200 modelos de LLM. Nível gratuito disponível.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Ideal para: projetos com muito conteúdo, tradução de Markdown e projetos que precisam de proteção com reconhecimento de conteúdo (blocos de código, shortcodes, variáveis de interpolação).

### Opção B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Ideal para: pares de strings chave-valor em alto volume (194 idiomas). **Não recomendado** para conteúdo em Markdown — o Google Translate não reconhece blocos de código, shortcodes ou variáveis de interpolação.

Para usar o Google Translate explicitamente:

```bash
champollion sync --method google-translate
```

> **Dica**: se apenas `GOOGLE_TRANSLATE_API_KEY` estiver definida (sem chave do OpenRouter), o champollion muda automaticamente para o Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estrutura do projeto

O Hugo usa `i18n/` para traduções de strings e `content/` para o conteúdo das páginas:

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

**Front matter**: Suporta delimitadores YAML (`---`) e TOML (`+++`). Traduz `title`, `description`, `summary`, `subtitle`, `caption` e `linkTitle` por padrão. Todos os outros campos (date, draft, tags, weight, slug, etc.) são preservados. Personalize com `translatableFields` na sua configuração.

**Proteção de blocos**: Blocos de código, shortcodes do Hugo (`{{< >}}`, `{{% %}}`), código em linha e HTML bruto são protegidos automaticamente usando marcadores sentinela Unicode. Eles passam intocados.

**Convenção de nomes de arquivos**: Segue o padrão de tradução por nome de arquivo do Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (remove o sufixo de origem)

**Ignorar existentes**: Arquivos traduzidos existentes nunca são sobrescritos. Exclua um arquivo de destino para forçar a retradução.

### Formas plurais

Locales TOML e YAML suportam formas plurais do CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Internamente representados como `items.one` e `items.other` para cálculo de diferenças (diffing), depois resserializados para o formato seccionado correto na gravação.

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

Execute `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Ele encontra `messages/en.json`, cria os arquivos de destino vazios e grava uma configuração como a abaixo. Ou crie `champollion.config.json` você mesmo:

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

O registro de cada destino (seu tom e formalidade) é gravado em `languages`, ficando visível e editável: altere um para outro dos presets do idioma (`champollion status` os lista) ou para suas próprias palavras. Um idioma sem presets é gravado como `{}`. Uma lista simples, `"languages": ["fr", "de"]`, também funciona e usa o padrão de cada idioma.

```bash
npx --yes champollion@0.6 sync
```

Cria `messages/fr.json`, `messages/ja.json`, etc. — totalmente traduzidos, preservando sua estrutura de chaves aninhadas. O next-intl os detecta automaticamente.

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

### Pasta por idioma (padrão do i18next)

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,ja
```

O `init` encontra `public/locales/en/` (ou `locales/en/`), aponta a configuração para ele e cria `fr/common.json`, `fr/admin/users.json` e os outros como arquivos vazios. A parte relevante da configuração que ele grava:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.6 sync
```

Cada arquivo de namespace é traduzido e gravado no mesmo caminho na pasta de cada idioma. Uma string que aparece em vários namespaces é traduzida uma vez por idioma; os outros arquivos a obtêm da Memória de Tradução. As chaves de plural (`key_one`, `key_other`) recebem as formas próprias de cada idioma, lidas do CLDR por meio da API `Intl.PluralRules` do JavaScript: uma forma que o idioma usa e que falta na origem é adicionada, e uma que ele não usa é omitida. Com a origem em inglês, o espanhol e o francês ganham `key_many`, o russo ganha `key_few` e `key_many`, e o japonês mantém apenas `key_other`. O sync informa, para seus próprios idiomas, as formas que cada um ganha. Consulte [chaves plurais do i18next](/docs/getting-started/configuration#i18next-plurals) e [Layouts de arquivos de locale](/docs/getting-started/configuration#locale-layouts).

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

### Outros layouts

Se seus arquivos seguirem outro padrão, descreva-o com `localesPattern` (`{lang}` é o idioma, `{ns}` o namespace):

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
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

O `init` lê `pubspec.yaml` e `l10n.yaml` (`arb-dir`, `template-arb-file`), obtém o idioma de origem a partir do nome do modelo (`app_en.arb` → `en`) e cria `app_fr.arb`, `app_de.arb` e `app_pt_BR.arb` com seus `@@locale`. A configuração que ele grava:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Se `l10n.yaml` definir `arb-dir: assets/i18n` e `template-arb-file: intl_en.arb`, o padrão é `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

Apenas as mensagens são traduzidas. Cada destino tem o `"@@locale"` definido para seu próprio locale, grafado da mesma forma que no nome do arquivo (`"pt_BR"`), porque o `gen-l10n` recusa um arquivo cujo `@@locale` não corresponda ao seu nome. Todo objeto de metadados `@key`, como marcadores de posição (placeholders) e seus tipos, é copiado de `app_en.arb` sem alterações. As chaves seguem a ordem do modelo, e uma mensagem que ainda não foi traduzida é omitida, fazendo com que o Flutter use a versão em inglês como fallback.

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

A sintaxe `{count, plural, …}`, o placeholder `{count}` e os seletores são protegidos: uma tradução que os altere é rejeitada e tentada novamente (consulte [mensagens ICU](/docs/getting-started/configuration#icu)). O francês pode adicionar uma ramificação `many` e o polonês `few` e `many`. O `champollion verify` também verifica `@@locale` e os metadados de placeholders de cada arquivo de destino. Se uma ferramenta anterior os tiver traduzido, o `champollion sync --pair en:fr --force` reescreve o arquivo. Mensagens não modificadas vêm do cache sem custo.

### Locales fora da lista própria do Flutter {#flutter-locales-outside-flutters-own-list}

Suas mensagens vêm dos arquivos `.arb`. O texto dentro dos próprios widgets do Flutter — um seletor de data, "Voltar", "Cancelar", a direção do texto — vem de `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), que cobre uma lista fixa de idiomas ([lista do Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Um código de uso privado como `qaa` e a maioria dos idiomas de baixos recursos não estão nela. Com esse tipo de locale em `supportedLocales`, o aplicativo falha em tempo de execução ("No MaterialLocalizations found"), a menos que um delegate forneça esse texto. O `init` e uma sincronização que cria um novo arquivo `.arb` avisam sobre cada destino fora da lista: eles leem isso do Flutter SDK na máquina (`FLUTTER_ROOT` ou o `flutter` no `PATH`) e, sem um SDK, informam quais destinos não puderam verificar.

A solução mais simples empresta a esses widgets o texto de um idioma que o Flutter cobre (inglês neste caso):

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

Os widgets então mostram rótulos em inglês dentro de um aplicativo cujo texto próprio está no seu idioma. Para traduzir também o texto dos widgets, o guia do Flutter mostra um `MaterialLocalizations` completo para um novo idioma: [Como adicionar suporte para um novo idioma](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django e gettext (.po)

A CLI do champollion tem código disponível sob a [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): livre para usar, alterar e compartilhar para fins não comerciais. Usá-la para fins comerciais não é coberto por esta licença ([quem pode usar](/docs/getting-started/who-may-use-this)).

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

O Django procura catálogos nas pastas listadas por `LOCALE_PATHS` e na pasta `locale/` de cada aplicativo instalado. Um diretório `locale/` ao lado de `manage.py` não pertence a nenhum app, portanto, até que `LOCALE_PATHS` o indique, o `compilemessages` continuará gerando seus arquivos `.mo`, mas o site continuará exibindo o texto não traduzido. `LANGUAGES` é a lista de idiomas oferecidos pelo site; o padrão do Django inclui todos os idiomas fornecidos por ele, então liste os seus próprios:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Configuração

Crie ou atualize os catálogos primeiro com o Django. O catálogo em inglês é a origem. Suas `msgstr` vazias significam "o msgid é o texto":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
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

**Os padrões são um tom e um estilo de gênero; o `init` exibe ambos.** O `formal-vous` solicita ao modelo "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." A orientação de gênero para o francês solicita *écriture inclusive* com o ponto mediano quando o gênero do leitor for desconhecido (`Connecté·e`, `Utilisateur·rice·s`); a do russo (`formal-vy`) usa o masculino, o padrão convencional. Um site que queira algo diferente (as páginas de pacientes de uma clínica, por exemplo) altera isso em `champollion.config.json`: o registro em `languages` (`"fr": "casual-tu"` ou suas próprias palavras) e `genderGuidance` — `false` para nenhuma instrução, ou a sua própria, como `"Use the masculine generic."` ([Orientação de gênero](/docs/getting-started/configuration#gender-guidance)). Uma configuração alterada recebe suas próprias entradas de cache, de modo que `sync --redo all` retraduz o que a anterior gravou.

**Qual método traduz e qual chave ele requer.** Sem `--method`, `init` define o padrão, `llm`: um modelo no [OpenRouter](https://openrouter.ai), que precisa de `OPENROUTER_API_KEY` no ambiente ou em um arquivo `.env` ao lado de `manage.py` (`init` exibe a linha a ser definida quando ela estiver ausente). Em uma máquina que executa um servidor de modelos (Ollama, LM Studio, vLLM), `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` não precisa de chave e nada sai da máquina. Um executor de CI não possui um servidor de modelos, portanto o CI especifica um modelo hospedado para sua execução (consulte o [guia de CI](/docs/guides/ci-cd)). Todos os métodos e a chave necessária para cada um: [Métodos de tradução](/docs/guides/translation-methods).

Em seguida:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

O sync traduz cada entrada com um `msgstr` vazio e cada entrada `fuzzy`, removendo a flag `fuzzy`. Entradas já traduzidas são mantidas byte por byte, juntamente com seus comentários. Uma entrada com um `msgctxt` tem sua própria chave e sua própria entrada no cache, de forma que o verbo "Abrir" e o adjetivo "Aberto" sejam traduzidos separadamente. Comentários `#.` e o contexto são enviados ao modelo — para ver a requisição exata sem enviá-la, execute `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` (o contexto e o comentário aparecem sob "UI context for these keys").

**Retraduzir uma entrada intencionalmente.** Indique-a pelo seu msgid:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Isso é servido a partir da Memória de Tradução quando o cache já contém esse texto, de modo que você recebe a mesma tradução de volta sem custo, e o sync indica isso com o comando `--fresh`. Essa repetição não precisa de modelo: com `local` e o servidor de modelos parado, o sync avisa que o servidor não responde e que essa execução não precisa dele, e continua (uma repetição que precisa enviar algo é interrompida, indicando o servidor). Para pagar por uma nova tradução, adicione `--fresh`. Uma vírgula dentro de um msgid é escrita como `\,`, e as aspas impedem que o shell interprete o restante. Uma entrada com contexto é nomeada conforme exibida nos relatórios: `verb␄Open`. Se você não conseguir digitar `␄`, escreva `\x04`: `--redo 'keys:verb\x04Open'`. Ambas as grafias funcionam, e os comandos de reparo mostram as duas. Para indicar a entrada em apenas um domínio, adicione o domínio como prefixo: `django::Welcome`. Um nome que não corresponda a nenhuma entrada faz a execução falhar (código de saída 1) e lista as entradas mais próximas, por exemplo, todos os contextos do msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Isso nunca é considerado uma repetição concluída.

Um catálogo que o champollion cria (`init --langs` ou sync para um idioma que ainda não tenha catálogo) recebe o cabeçalho gettext padrão, com os campos que o `msginit` grava, para que o `msgfmt -c` o aceite. O cabeçalho de um catálogo existente nunca é reescrito.

**Avisos de cabeçalho do `msgfmt -c` em catálogos iniciados por `makemessages`.** O `makemessages` grava o cabeçalho de modelo do gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, marcado como `#, fuzzy` — e o `msgfmt -c` avisa a cada compilação que cada campo "still has the initial default value". O sync não altera esses valores (em um cabeçalho existente, ele preenche apenas um `Plural-Forms` de espaço reservado ou o conjunto de caracteres), portanto, ajuste-os manualmente uma vez em cada catálogo: o nome e a versão do seu projeto, a data, um tradutor (ou `Automatically generated`) e uma equipe (ou `none`); remova também a linha `#, fuzzy` acima de `msgid ""`, que sinaliza o cabeçalho como ainda não revisado. O `makemessages` mantém os valores que você informar. O `compilemessages` (`msgfmt --check-format`) não verifica o cabeçalho, logo esses avisos nunca causam falha nele.

**Plurais.** `msgid` + `msgid_plural` tornam-se uma única mensagem que o modelo traduz com todas as formas necessárias para o idioma. As formas são gravadas em `msgstr[0]`, `msgstr[1]`, … de acordo com o cabeçalho `Plural-Forms` do catálogo. O Django grava isso para você. Um catálogo que não possua esse cabeçalho recebe aquele que o `msginit` grava para o idioma (francês `nplurals=2; plural=(n > 1);`), ou um derivado do CLDR para um idioma não listado pelo `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Quando a tradução omite uma forma usada pelo idioma para contagens comuns (o russo `few` ou `many`), o sync solicita novamente ao modelo. Se a resposta ainda a omitir, o sync grava a forma `other` no lugar dela, marca a entrada com um comentário `# champollion:` e a indica com o comando para solicitar novamente (`--redo 'keys:django::One file' --fresh`). Qualquer sync encerra com código `2` enquanto houver uma entrada marcada no catálogo, e não apenas a execução que a gravou, da mesma forma que ocorre com uma chave retida. Sua linha final de verificação informa que a execução está incompleta em vez de `[OK]`. Escreva as formas manualmente e remova a linha de comentário, ou solicite novamente com um `--model` mais robusto. Uma sincronização com outro método ou modelo (o modelo hospedado do CI, após um local) solicita a entrada novamente por conta própria, e o `sync --redo gaps` solicita todas as entradas marcadas; se a resposta ainda não contiver as formas, a entrada continua marcada. No CI, isso causa falha no job após o commit (consulte o [guia de CI](/docs/guides/ci-cd#plural-gaps)).

**Outros layouts do gettext.**

| Projeto | Configuração | Origem |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` ou o único `.pot` em `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` ou `messages.pot` em `translations/` ou na pasta acima dela |

Os placeholders `printf` (`%s`, `%(name)s`, `%d`) devem ser mantidos na tradução, e o controle de qualidade (quality gate) rejeita qualquer valor que perca algum. Ainda assim, execute `msgfmt --check-format` (como faz `compilemessages`) antes de disponibilizar em produção. Ele também verifica os tipos dos placeholders, mas apenas nas entradas sinalizadas com a flag `#, python-format`: `makemessages` adiciona essa flag às entradas que extrai com um placeholder `%`, enquanto um catálogo criado manualmente pode não tê-la, deixando essas entradas sem verificação. O `champollion verify` compara os placeholders printf de cada entrada (nome e letra de tipo), independentemente de suas flags, e o sync preserva as flags da entrada de origem em cada entrada traduzida. Os catálogos devem estar em UTF-8. Consulte [catálogos gettext](/docs/getting-started/configuration#gettext) para ver as regras completas.
