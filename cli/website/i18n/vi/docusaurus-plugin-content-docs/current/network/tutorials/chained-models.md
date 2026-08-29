---
sidebar_position: 6
title: "Cookbook: Chuỗi mô hình"
---

# Chained Models (Multi-Stage Pipeline)

> **Ý tưởng:** Mô hình A tạo bản dịch thô → Mô hình B hiệu đính (post-edit) → Mô hình C chấm điểm hoặc xác thực kết quả. Mỗi giai đoạn chuyên môn hóa vào một nhiệm vụ. Kết quả đầu ra của pipeline tốt hơn bất kỳ mô hình đơn lẻ nào.

:::info[Đây là cookbook, không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo kiến trúc pipeline nhiều giai đoạn. Các mô hình cụ thể và cấu hình chuỗi (chain) phụ thuộc vào cặp ngôn ngữ và ngân sách của bạn.
:::

## Khi nào nên sử dụng

- Một mô hình đơn lẻ tạo ra **chất lượng không đồng đều** — tốt với một số đầu vào này nhưng lại kém với những đầu vào khác
- Bạn muốn **tách biệt quá trình tạo bản dịch và xác thực** — một mô hình tạo bản dịch, một mô hình khác đánh giá
- Bạn có ngân sách cho **nhiều lượt gọi API cho mỗi bản dịch** (độ trễ và chi phí tăng tuyến tính theo số giai đoạn)
- Bạn muốn kết hợp các mô hình có **thế mạnh khác nhau** (ví dụ: một mô hình tạo bản dịch sáng tạo + một mô hình biên tập chính xác)

## Cách thức hoạt động

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Ví dụ: Pipeline ba giai đoạn

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## Các mô hình chuỗi phổ biến

| Mô hình | Các giai đoạn | Trường hợp sử dụng |
|---------|--------|----------|
| **Tạo → Sửa (Generate → Edit)** | LLM nhanh → LLM mạnh | Cải thiện chất lượng hiệu quả về chi phí |
| **Tạo → Xác thực → Thử lại (Generate → Validate → Retry)** | LLM → FST/quy tắc → LLM (thử lại nếu thất bại) | Độ chính xác về hình thái (xem [FST-Gated](./fst-gated-pipeline)) |
| **Tạo → Dịch ngược → Chấm điểm (Generate → Back-translate → Score)** | LLM(en→crk) → LLM(crk→en) → so sánh | Kiểm tra tính nhất quán hai chiều (round-trip) |
| **Hợp lực → Bỏ phiếu (Ensemble → Vote)** | 3 LLM độc lập → bỏ phiếu theo số đông | Tăng cường độ bền bỉ (robustness) thông qua sự đa dạng |

## Các quyết định thiết kế quan trọng

**Ngân sách độ trễ (Latency budget):** Mỗi giai đoạn sẽ nhân lên độ trễ. Một chuỗi 3 giai đoạn với 2 giây cho mỗi giai đoạn = 6 giây cho mỗi bản dịch. Đối với đánh giá hàng loạt (batch evaluation) thì điều này không thành vấn đề; nhưng đối với thời gian thực (real-time) thì có thể không phù hợp.

**Hệ số chi phí (Cost multiplier):** 3 giai đoạn = gấp 3 lần chi phí API. Hãy sử dụng các mô hình rẻ hơn cho các giai đoạn đầu và các mô hình đắt tiền cho các giai đoạn quan trọng.

**Sự lan truyền lỗi (Error propagation):** Kết quả kém ở Giai đoạn 1 có thể làm lệch hướng Giai đoạn 2. Hãy đưa văn bản gốc vào mọi giai đoạn để các mô hình phía sau có thể khắc phục lỗi.

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Có thể kết hợp thế mạnh của các chuyên gia | ❌ Độ trễ và chi phí nhân lên theo từng giai đoạn |
| ✅ Tách biệt các mối quan tâm (tạo bản dịch so với xác thực) | ❌ Phức tạp khi gỡ lỗi — giai đoạn nào đã gây ra lỗi? |
| ✅ Dễ dàng thay thế các giai đoạn riêng lẻ | ❌ Lỗi bị lan truyền giữa các giai đoạn |
| ✅ Xác thực hai chiều (round-trip) giúp phát hiện hiện tượng ảo tưởng (hallucination) | ❌ Hiệu quả giảm dần khi vượt quá 2-3 giai đoạn |

## Kết hợp tốt với

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST đóng vai trò là giai đoạn xác thực
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — chèn từ điển (dictionary injection) trong giai đoạn tạo bản dịch
- **[Coached LLM Prompting](./coached-llm-prompting)** — hướng dẫn (coaching) trong một hoặc nhiều giai đoạn

## Xem thêm

- [Eval Harness](/docs/network/specifications/harness) — bộ khung (harness) đo lường kết quả đầu ra của pipeline từ đầu đến cuối (end-to-end)
- [Run Card Specification](/docs/network/specifications/run-card) — độ trễ và chi phí được ghi lại trên mỗi mục nhập
- [Hỗ trợ ngôn ngữ nghèo tài nguyên](/docs/network/community/low-resource-languages)
