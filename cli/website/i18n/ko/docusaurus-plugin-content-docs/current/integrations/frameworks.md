# 통합 가이드

인기 프레임워크와 champollion을 연동하기 위한 단계별 설정 안내입니다.

---

## API 키 설정

프레임워크와 연동하기 전에 번역 API 키가 필요해요. Champollion은 두 가지 제공업체를 지원해요:

### 옵션 A: OpenRouter (권장)

[OpenRouter](https://openrouter.ai)는 200개 이상의 LLM 모델을 위한 통합 API를 제공해요. 무료 등급도 이용할 수 있어요.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

가장 적합한 용도: 콘텐츠가 많은 프로젝트, Markdown 번역, 그리고 콘텐츠 인식 보호(코드 블록, 숏코드, 보간 변수)가 필요한 프로젝트에 적합해요.

### 옵션 B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

추천 용도: 대량의 키-값 문자열 쌍(194개 언어). Markdown 콘텐츠에는 **권장하지 않아요** — Google Translate는 코드 블록, 숏코드 또는 보간 변수를 인식하지 못해요.

Google Translate를 명시적으로 사용하려면:

```bash
champollion sync --method google-translate
```

> **팁**: `GOOGLE_TRANSLATE_API_KEY`만 설정되어 있고 OpenRouter 키가 없으면, champollion이 자동으로 Google Translate로 전환해요.

---

## Hugo (TOML / YAML / Markdown)

### 프로젝트 구조

Hugo는 문자열 번역에 `i18n/`을, 페이지 콘텐츠에 `content/`을 사용해요:

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

### 설정

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

`champollion.config.json`을 생성하세요:

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

### 콘텐츠 번역 세부 사항

**Front matter**: YAML(`---`)과 TOML(`+++`) 구분자를 모두 지원해요. 기본적으로 `title`, `description`, `summary`, `subtitle`, `caption`, `linkTitle`를 번역해요. 그 외 모든 필드(date, draft, tags, weight, slug 등)는 그대로 유지돼요. 설정에서 `translatableFields`으로 커스터마이징할 수 있어요.

**블록 보호**: 코드 블록, Hugo 숏코드(`{{< >}}`, `{{% %}}`), 인라인 코드, raw HTML은 Unicode 센티넬 플레이스홀더를 사용해 자동으로 보호돼요. 변경 없이 그대로 통과돼요.

**파일명 규칙**: Hugo의 파일명 기반 번역 패턴을 따라요:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (소스 접미사 제거)

**기존 파일 건너뛰기**: 이미 번역된 파일은 절대 덮어쓰지 않아요. 재번역을 강제하려면 대상 파일을 삭제하세요.

### 복수형

TOML과 YAML 로케일은 CLDR 복수형을 지원해요:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

내부적으로는 diff를 위해 `items.one`과 `items.other`로 표현되며, 작성 시 올바른 섹션 형식으로 다시 직렬화돼요.

---

## next-intl (JSON)

### 프로젝트 구조

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

### 설정

```bash
npm install --save-dev champollion
```

`champollion.config.json`을 생성하세요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

`messages/fr.json`, `messages/ja.json` 등을 생성해요 — 중첩된 키 구조를 유지하며 완전히 번역돼요. next-intl이 자동으로 인식해요.

### 개발 워크플로

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

### 평면 파일 구조 (권장)

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

### 중첩 디렉터리 구조

`{locale}/{namespace}.json` 구조를 사용한다면, 평면화 → 번역 → 비평면화하는 동기화 스크립트를 만드세요. 자세한 내용은 [react-i18next 문서](https://react.i18next.com/)를 참고하세요.
