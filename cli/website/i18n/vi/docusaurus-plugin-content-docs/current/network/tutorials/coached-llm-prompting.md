---
sidebar_position: 2
title: "Cookbook: Prompting LLM có hướng dẫn"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Coached LLM Prompting

> **Ý tưởng:** Đưa trực tiếp các quy tắc ngữ pháp, từ điển song ngữ và lưu ý phong cách vào system prompt của LLM. Không cần huấn luyện (training), không cần tinh chỉnh (fine-tuning) — chỉ cần kiến thức ngôn ngữ có cấu trúc để định hướng đầu ra hướng tới các bản dịch chuẩn xác.

:::info[Đây là tài liệu hướng dẫn (cookbook), không phải là một bản triển khai hoàn chỉnh]
Tài liệu này phác thảo phương pháp tiếp cận và các quyết định thiết kế chính của nó. Hãy điều chỉnh nó cho phù hợp với cặp ngôn ngữ, tài nguyên sẵn có và mục tiêu đánh giá của bạn.
:::

## Khi nào nên sử dụng

- Bạn có **kiến thức ngôn ngữ** về ngôn ngữ đích (quy tắc ngữ pháp, mục từ điển, tùy chọn phong cách) nhưng không có đủ dữ liệu song song để tinh chỉnh (fine-tuning)
- Bạn muốn **lặp lại nhanh chóng (iterate fast)** — các thay đổi prompt được triển khai trong vài giây, không cần huấn luyện lại
- Ngôn ngữ đích có **các mẫu đã biết** mà LLM hay dịch sai (sự hòa hợp giống/số, quy ước chữ viết, mức độ trang trọng)
- Bạn muốn so sánh coached prompting với một baseline (mức cơ sở) và lặp lại cải tiến dựa trên những gì hiệu quả

## Cách thức hoạt động

1. **Thu thập dữ liệu hướng dẫn (coaching data)** — các quy tắc ngữ pháp, từ điển song ngữ và lưu ý phong cách trong một tệp JSON có cấu trúc
2. **Cấu hình văn phong (register)** — một tiền tố system prompt để thiết lập ngôn ngữ, chữ viết và tông giọng
3. **Chạy harness** — dữ liệu hướng dẫn sẽ được đưa vào mọi prompt của LLM
4. **Xem xét các lỗi** — xem những gì bị cổng kiểm soát chất lượng (quality gate) từ chối, thêm quy tắc để giải quyết các mẫu lỗi đó
5. **Lặp lại** — mỗi phiên bản tệp hướng dẫn là một thử nghiệm mới; harness sẽ theo dõi tất cả chúng

## Cấu trúc dữ liệu hướng dẫn

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Các quyết định thiết kế quan trọng

**Độ cụ thể của quy tắc so với cửa sổ ngữ cảnh (context window):** Nhiều quy tắc hơn sẽ giúp LLM có nhiều hướng dẫn hơn, nhưng lại chiếm dụng cửa sổ ngữ cảnh dành cho việc dịch thuật thực tế. Hãy bắt đầu với 5–10 quy tắc có tác động cao và chỉ thêm nhiều hơn khi bạn thấy các mẫu lỗi cụ thể.

**Độ bao phủ của từ điển:** Bạn không cần một từ điển hoàn chỉnh — hãy tập trung vào các thuật ngữ mà LLM liên tục dịch sai. Ngay cả 20–30 thuật ngữ bắt buộc cũng có thể cải thiện đáng kể tính nhất quán.

**Thứ tự quy tắc rất quan trọng:** Hãy đặt các quy tắc quan trọng nhất lên đầu. LLM chú ý nhiều hơn đến các chỉ dẫn xuất hiện sớm.

## Chạy thử nghiệm

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Chi phí huấn luyện bằng không | ❌ Trần chất lượng bị giới hạn bởi kiến thức nền tảng của LLM |
| ✅ Lặp lại tức thì (thay đổi prompt → chạy lại) | ❌ Cửa sổ ngữ cảnh giới hạn lượng nội dung hướng dẫn có thể đưa vào |
| ✅ Hoạt động với bất kỳ nhà cung cấp LLM nào | ❌ Các quy tắc có thể xung đột — việc gỡ lỗi tương tác prompt là một nghệ thuật |
| ✅ Minh bạch — bạn có thể đọc chính xác những gì LLM nhìn thấy | ❌ Không tạo ra kiến thức mới, chỉ định hướng kiến thức hiện có |

## Kết hợp tốt với

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — việc hướng dẫn + xác thực hình thái học sẽ phát hiện những gì mà chỉ riêng việc hướng dẫn bỏ sót
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — thuật ngữ bắt buộc là một hình thức hướng dẫn
- **[Few-Shot Prompting](./few-shot-prompting)** — ví dụ + quy tắc kết hợp với nhau sẽ mạnh mẽ hơn là chỉ sử dụng riêng lẻ một trong hai

## Xem thêm

- [Giao diện phương thức](/docs/network/specifications/methods) — định dạng dữ liệu hướng dẫn và giao thức TranslationMethod
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — toàn bộ ngữ cảnh
- [Eval Harness](/docs/network/specifications/harness) — cách chạy thử nghiệm
