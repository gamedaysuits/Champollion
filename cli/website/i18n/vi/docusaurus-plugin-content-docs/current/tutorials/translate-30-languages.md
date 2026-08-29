---
sidebar_position: 2
title: "Dịch sang 30 ngôn ngữ"
description: "Cookbook: mở rộng quy mô dự án từ 3 ngôn ngữ lên 30 ngôn ngữ bằng cách kết hợp phương pháp theo từng cặp, xử lý theo lô và tích hợp CI."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Cookbook: Dịch 30 ngôn ngữ

Mở rộng quy mô dự án từ một vài ngôn ngữ (locale) lên phạm vi toàn cầu. Tài liệu hướng dẫn (cookbook) này sẽ đi qua các bước lựa chọn phương pháp, tối ưu hóa chi phí và tích hợp CI cho một đợt triển khai đa ngôn ngữ thực tế.

**Kịch bản:** Bạn có một ứng dụng SaaS với `en`, `fr`, `es`. Bạn cần thêm 27 ngôn ngữ nữa trên ba phân nhóm (tier) yêu cầu chất lượng khác nhau.

---

## Bước 1: Phân loại các ngôn ngữ của bạn

Không phải tất cả 30 ngôn ngữ đều cần cách tiếp cận giống nhau. Hãy nhóm chúng lại theo chất lượng phương pháp hiện có:

| Phân nhóm | Ngôn ngữ | Phương pháp | Lý do |
|------|-----------|--------|-----|
| **Tier 1 — Cao cấp** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Thị trường giá trị cao, ngữ pháp sắc thái phức tạp |
| **Tier 2 — Tiêu chuẩn** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Khối lượng lớn, được Google hỗ trợ tốt |
| **Tier 3 — Có huấn luyện** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Tài nguyên thấp, yêu cầu áp dụng thuật ngữ nghiêm ngặt |

## Bước 2: Cấu hình cho từng cặp ngôn ngữ

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Lưu ý:** Các ngôn ngữ không được liệt kê trong `pairs` sẽ kế thừa `defaultMethod: "google-translate"`. Bạn không cần phải liệt kê cả 30 ngôn ngữ.

:::info
Hỗ trợ cho `crk` đang được phát triển — xem [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) để biết trạng thái và hướng dẫn đóng góp.
:::

## Bước 3: Thiết lập API Key

Bạn sẽ cần cả hai API key cho cấu hình này:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Bước 4: Chạy thử (Dry Run) trước

Luôn xem trước kết quả trước khi dịch 30 ngôn ngữ:

```bash
npx champollion sync --dry
```

Xem lại kết quả đầu ra. Nó sẽ hiển thị:
- Cặp ngôn ngữ nào sử dụng phương pháp nào
- Có bao nhiêu khóa mới/thay đổi trên mỗi ngôn ngữ (locale)
- Ước tính số lượng lệnh gọi API cho mỗi phân nhóm (tier)

## Bước 5: Chạy đồng bộ hóa (Sync)

```bash
npx champollion sync
```

Champollion xử lý từng cặp ngôn ngữ một cách độc lập. Các cặp thuộc Tier 2 sử dụng Google Translate sẽ dịch nhanh. Các cặp LLM thuộc Tier 1 sẽ chậm hơn nhưng chất lượng cao hơn. Các cặp có huấn luyện thuộc Tier 3 sẽ sử dụng dữ liệu huấn luyện (coaching data) của plugin.

### Cập nhật gia tăng (Incremental Updates)

Sau lần đồng bộ hóa đầu tiên, các lần chạy tiếp theo chỉ dịch các khóa **đã thay đổi hoặc mới**:

```bash
# Only keys that changed since last sync
npx champollion sync
```

Tệp khóa (`.champollion.lock`) theo dõi những gì đã được dịch, vì vậy bạn không bao giờ phải dịch lại nội dung đã ổn định.

## Bước 6: Kiểm định chất lượng

Kiểm tra trạng thái của tất cả các cặp ngôn ngữ:

```bash
npx champollion status
```

Lệnh này sẽ xuất ra một bảng hiển thị phương pháp, mô hình, phân nhóm chất lượng của từng cặp, và liệu dữ liệu huấn luyện hoặc điểm số benchmark có sẵn hay không.

### Kết quả đầu ra có tuân thủ văn phong (register) của bạn không?

Trong Bước 2, bạn đã khai báo một [văn phong (register)](/glossary#term-register) cho mỗi ngôn ngữ — `"Polite/formal"` cho tiếng Nhật, `"Formal (Sie)"` cho tiếng Đức. (Bạn mới nghe thuật ngữ này lần đầu? Trang thuật ngữ giải thích nó bằng ngôn ngữ bình dân dễ hiểu.) Những hướng dẫn đó sẽ được đưa vào prompt dịch thuật, nhưng prompt chỉ là một yêu cầu chứ không phải là một sự đảm bảo tuyệt đối.

[Network harness](/docs/network/specifications/harness) — cùng một công cụ vận hành bảng xếp hạng công khai — có thể đo lường mức độ tuân thủ văn phong và phong cách trên một mẫu bản dịch của bạn. Các chỉ số phong cách viết của nó sẽ kiểm tra từng kết quả đầu ra so với văn phong mong đợi (các dấu hiệu trang trọng/thân mật, đại từ nhân xưng lịch sự/thân mật, từ viết tắt, sự thay đổi độ dài câu) và báo cáo một `style_consistency_rate` trong suốt quá trình chạy. Bạn cũng có thể trỏ nó đến một hồ sơ giọng điệu thương hiệu (brand-voice) tùy chỉnh với `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Hai lưu ý trung thực: các chỉ số này mang tính chất **tham khảo** (chúng không bao giờ được tính vào điểm tổng hợp của bảng xếp hạng) và việc phát hiện mức độ trang trọng dựa trên các dấu hiệu nhận biết — một công cụ phát hiện độ lệch chứ không phải là đánh giá của con người. Chi tiết và định nghĩa chỉ số: [Các chỉ số phong cách viết và văn phong](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Bước 7: Tích hợp CI

Thêm vào quy trình làm việc (workflow) GitHub Actions của bạn để các bản dịch luôn được cập nhật sau mỗi lần push:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Ước tính chi phí

Đối với một dự án có 500 khóa nguồn trên 30 ngôn ngữ:

| Phân nhóm | Ngôn ngữ | Phương pháp | Chi phí ước tính |
|------|-----------|--------|-----------------|
| Tier 1 (5 ngôn ngữ) | ja, ko, zh, de, pt | GPT-4o | ~$2.50/đồng bộ toàn bộ |
| Tier 2 (18 ngôn ngữ) | it, nl, pl, v.v. | Google Translate | ~$0.90/đồng bộ toàn bộ |
| Tier 3 (4 ngôn ngữ) | crk, oj, mi, haw | GPT-4o-mini có huấn luyện | ~$0.40/đồng bộ toàn bộ |
| **Tổng cộng** | **30 ngôn ngữ** | **Hỗn hợp** | **~$3.80/đồng bộ toàn bộ** |

Đồng bộ hóa gia tăng (5–20 khóa thay đổi) chỉ tốn một phần nhỏ chi phí so với đồng bộ hóa toàn bộ.

## Xem thêm

- [Phương pháp dịch thuật](/docs/guides/translation-methods) — Cách hoạt động của từng phương pháp dịch và khi nào nên sử dụng
- [Đặc tả Plugin](/docs/reference/plugin-spec) — Tạo dữ liệu huấn luyện cho bất kỳ ngôn ngữ Tier 3 nào của bạn
- [Hướng dẫn CI/CD](/docs/guides/ci-cd) — Các mô hình CI nâng cao bao gồm cả bản dựng xem trước cho PR (PR preview builds)
- [Cổng kiểm soát chất lượng (Quality Gate)](/docs/concepts/quality-gate) — Cách Champollion xác thực mọi bản dịch trước khi ghi vào tệp
- [Ngôn ngữ được hỗ trợ](/docs/reference/supported-languages) — Danh sách đầy đủ các mã ngôn ngữ và khả năng tương thích của phương pháp
- [Các chỉ số phong cách viết và văn phong](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Đo lường mức độ tuân thủ văn phong/phong cách bằng eval harness (chỉ số tham khảo)
- [Thuật ngữ: văn phong (register)](/glossary#term-register) — Ý nghĩa của "văn phong" (register) bằng ngôn ngữ bình dân dễ hiểu
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — Thêm dữ liệu huấn luyện cho các ngôn ngữ chưa được hỗ trợ dịch máy (MT) rộng rãi
