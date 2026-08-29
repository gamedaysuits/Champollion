---
sidebar_position: 3
title: "CI/CD"
---

# Tích hợp CI/CD

Tự động hóa việc dịch thuật trong pipeline build của bạn.

## GitHub Actions: Đồng bộ hóa khi Push

Thêm đồng bộ hóa dịch thuật vào pipeline build hiện tại của bạn:

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions: Đồng bộ hóa theo Lịch trình

Chạy dịch thuật theo lịch trình và tự động commit:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## Phương thức Google Translate

Nếu sử dụng phương thức Google Translate tích hợp sẵn thay vì OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Các nhà cung cấp LLM trực tiếp

Nếu sử dụng trực tiếp các phương thức `openai`, `anthropic`, hoặc `gemini`:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## API Dịch thuật Từ xa

Nếu sử dụng một endpoint dịch thuật từ xa (ví dụ: một dịch vụ dịch thuật được host):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Pipeline CI Ba Lớp

Để đạt được độ phủ i18n tối đa, hãy kiểm soát pipeline của bạn bằng cả ba công cụ:

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| Lớp | Lệnh | Khi nào | Mục đích |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Chặn các commit chứa chuỗi hardcode |
| **Sync** | `sync` | Post-commit / CI | Dịch các key bị thiếu và thay đổi |
| **Audit** | `audit` | Build step | Thất bại bản build nếu có bất kỳ ngôn ngữ nào chưa hoàn thành |

:::tip[Translation Memory trong CI]
Nếu CI runner của bạn có không gian làm việc persistent (hoặc cache `.champollion/`), Translation Memory sẽ tự động kích hoạt — các lần đồng bộ tiếp theo chỉ dịch các khóa có văn bản nguồn thực sự thay đổi. Đối với các ephemeral runner, hãy cân nhắc việc cache `.champollion/tm.json` giữa các lần chạy:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Xem thêm

- [Tài liệu tham khảo CLI](/docs/reference/cli) — tài liệu tham khảo lệnh đầy đủ
- [Cách hoạt động của Sync](/docs/concepts/how-sync-works) — tìm hiểu về đồng bộ hóa tăng dần
- [Bộ nhớ Dịch thuật](/docs/concepts/translation-memory) — lưu cache và tiết kiệm chi phí
- [Phương thức Dịch thuật](/docs/guides/translation-methods) — lựa chọn phương thức cho từng cặp ngôn ngữ
- [Cổng Chất lượng (Quality Gate)](/docs/concepts/quality-gate) — điều gì xảy ra khi dịch thuật thất bại
- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo cấu hình
