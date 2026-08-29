---
sidebar_position: 5
title: "Dữ liệu Huấn luyện"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Dữ liệu Huấn luyện (Coaching Data)

Dữ liệu huấn luyện (coaching data) là cơ chế của Champollion để dạy các LLM về những ngôn ngữ mà chúng chưa từng được đào tạo. Bằng cách cung cấp các quy tắc ngữ pháp, từ điển và lưu ý về văn phong cùng với mỗi yêu cầu dịch thuật, bạn sẽ biến một LLM đa năng thành một trình dịch thuật nhận biết ngữ cảnh cho bất kỳ ngôn ngữ nào — bao gồm cả các ngôn ngữ hoàn toàn chưa được hỗ trợ dịch máy (MT).

## Cách thức hoạt động

Khi bạn thiết lập phương thức của một cặp ngôn ngữ thành `llm-coached`, Champollion sẽ tải một tệp huấn luyện từ `.champollion/coaching/<locale>.json` và đưa nội dung của nó vào mọi prompt của LLM như một phần của thông điệp hệ thống (system message). LLM sẽ nhìn thấy các quy tắc ngôn ngữ của bạn cùng với yêu cầu dịch thuật, từ đó tạo ra kết quả đầu ra tuân theo ngữ pháp và thuật ngữ của bạn thay vì tự đoán mò.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Có hai loại nội dung huấn luyện:

1. **Dữ liệu huấn luyện có cấu trúc** (phương thức `llm-coached`) — Các quy tắc ngữ pháp, từ điển và lưu ý văn phong ở định dạng JSON. Được tải từ `.champollion/coaching/<locale>.json` hoặc thư mục `coaching/` của một plugin.
2. **Prompt huấn luyện dạng văn bản tự do** (trường cấu hình `coachingFile`) — Một tệp văn bản thuần túy chứa hướng dẫn bổ sung được đưa vào system prompt. Hoạt động với bất kỳ phương thức LLM nào, không chỉ riêng `llm-coached`. Được thiết lập thông qua `coachingFile` trong cấu hình của bạn hoặc `--coaching-file` trên CLI.

Cả hai đều có thể được sử dụng cùng nhau. Hệ thống đánh giá (eval harness) sử dụng cấu trúc prompt hoàn toàn giống hệt — vì vậy điểm số benchmark của bạn sẽ phản ánh chính xác các prompt thực tế trong môi trường production.

Vì dữ liệu huấn luyện là một phần của thông điệp hệ thống, nó được hưởng lợi từ **bộ nhớ đệm prompt (prompt caching)** — các nhà cung cấp như Anthropic và Google sẽ lưu bộ nhớ đệm cho các tiền tố hệ thống được lặp lại, vì vậy bạn chỉ phải trả phí cho ngữ cảnh huấn luyện một lần cho mỗi phiên, chứ không phải cho mỗi lượt dịch (batch).

## Định dạng tệp huấn luyện

Tạo một tệp JSON cho mỗi mã ngôn ngữ (locale) trong `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Các trường thông tin

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | Không | Mảng các quy tắc ngữ pháp được đưa vào system prompt. Mỗi quy tắc nên là một hướng dẫn ngắn gọn, có thể thực hiện được để LLM tuân theo. |
| `dictionary` | `object` | Không | Bản đồ khóa-giá trị (key-value) của thuật ngữ tiếng Anh → thuật ngữ ngôn ngữ đích. Được sử dụng cho từ vựng chuyên ngành mà LLM không biết. |
| `style_notes` | `string` | Không | Các hướng dẫn văn phong tự do (văn phong, giọng điệu, quy ước trang trọng). |

Tất cả các trường đều là tùy chọn — bạn có thể bắt đầu chỉ với một từ điển và thêm các quy tắc ngữ pháp khi bạn tinh chỉnh dần.

## Hành vi dự phòng (Fallback)

Nếu một cặp ngôn ngữ được cấu hình cho `llm-coached` nhưng không có tệp huấn luyện nào tồn tại cho mã ngôn ngữ đó, Champollion sẽ **quay về phương thức `llm` tiêu chuẩn** kèm theo một cảnh báo trên console:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Điều này có nghĩa là bạn có thể thiết lập `"defaultMethod": "llm-coached"` trên phạm vi toàn cục một cách an toàn — các ngôn ngữ có dữ liệu huấn luyện sẽ sử dụng nó, và các ngôn ngữ còn lại sẽ nhận bản dịch LLM tiêu chuẩn mà không gặp lỗi.

## Khi nào nên sử dụng Huấn luyện

| Kịch bản | Phương thức khuyến nghị |
|----------|-------------------|
| Ngôn ngữ Nhóm 1 (Tiếng Pháp, Tiếng Tây Ban Nha, Tiếng Đức) | `llm` hoặc `google-translate` — LLM đã biết rất rõ những ngôn ngữ này |
| Ngôn ngữ Nhóm 2 (Tiếng Hàn, Tiếng Thổ Nhĩ Kỳ, Tiếng Thái) | `llm` kèm theo văn phong — LLM xử lý tốt các ngôn ngữ này khi có hướng dẫn văn phong |
| Ngôn ngữ Nhóm 3 (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLM cần các quy tắc ngữ pháp và từ điển |
| Ngôn ngữ nhân tạo (Klingon, Sindarin, Kryptonian) | `llm-coached` — LLM có một số dữ liệu đào tạo nhưng cần sửa lỗi |

## Xây dựng dữ liệu huấn luyện tốt

### Quy tắc ngữ pháp

Hãy viết các quy tắc dưới dạng **hướng dẫn hành động**, không phải mô tả lý thuyết. LLM tuân theo các hướng dẫn tốt hơn là tự diễn giải lý thuyết ngôn ngữ học.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Từ điển

Tập trung vào **các thuật ngữ chuyên ngành** mà LLM dễ dịch sai hoặc tự chế ra. Đừng bận tâm đến các từ thông dụng mà LLM đã xử lý tốt — hãy tập trung vào các thuật ngữ đặc thù trong giao diện người dùng (UI) của ứng dụng của bạn.

### Lưu ý về văn phong

Hãy cụ thể về văn phong, mức độ trang trọng và các quy ước:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Kiểm thử các bản dịch được huấn luyện

Sử dụng [MT Eval Harness](https://github.com/gamedaysuits/Champollion) để đánh giá các bản dịch được huấn luyện của bạn so với một tập dữ liệu tham chiếu:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Công cụ này cung cấp cho bạn các điểm số chrF++, BLEU và khớp chính xác (exact match). Hãy tạo nhiều phiên bản tệp huấn luyện khác nhau và so sánh — các chỉ số khách quan luôn tốt hơn việc đánh giá cảm tính.

---

## Xem thêm

- [Phương thức dịch thuật](/docs/guides/translation-methods) — phương thức llm-coached
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — huấn luyện trong thực tế
- [Đặc tả Plugin](/docs/reference/plugin-spec) — đóng gói dữ liệu huấn luyện trong một plugin
- [Cổng chất lượng (Quality Gate)](/docs/concepts/quality-gate) — cách các bản dịch được huấn luyện được xác thực
- [Cấu hình](/docs/getting-started/configuration) — cấu hình huấn luyện cho từng cặp ngôn ngữ
