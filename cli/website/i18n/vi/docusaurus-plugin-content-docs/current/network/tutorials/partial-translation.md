---
sidebar_position: 10
title: "Cookbook: Dịch một phần (Người + Máy)"
---

# Dịch một phần (Người + Máy)

> **Ý tưởng:** Dịch thủ công một mẫu đại diện, chứng minh phương pháp dịch máy của bạn khớp với phong cách của con người trên mẫu đó, sau đó tự động dịch phần còn lại. Kết hợp chất lượng của con người với quy mô của máy móc — con người thiết lập tiêu chuẩn, máy móc tuân theo.

:::info[Đây là tài liệu hướng dẫn thực hành, không phải là một bản triển khai hoàn chỉnh]
Hướng dẫn này phác thảo quy trình làm việc kết hợp giữa con người và máy móc. Quy trình này đặc biệt phù hợp với các công ty dịch thuật, những người làm công tác ngôn ngữ cộng đồng và các bối cảnh giáo dục.
:::

## Khi nào nên sử dụng

- Bạn có **thể tiếp cận với những người nói lưu loát** nhưng thời gian của họ có hạn
- Bạn cần dịch một **khối lượng lớn** nhưng chỉ một phần nhỏ cần phải hoàn hảo
- Bạn muốn **thiết lập một mức chất lượng cơ sở** bằng bản dịch của con người, sau đó mở rộng quy mô bằng dịch máy (MT)
- Bạn đang làm việc trong **bối cảnh giáo dục hoặc cộng đồng** nơi việc con người đánh giá một tập hợp con là khả thi

## Cách thức hoạt động

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Chọn một mẫu đại diện** — bao gồm các loại câu, độ dài và chủ đề khác nhau
2. **Dịch mẫu bằng con người** — thiết lập tiêu chuẩn vàng về phong cách, văn phong và thuật ngữ
3. **Cấu hình phương pháp dịch máy của bạn** — sử dụng các bản dịch của con người làm dữ liệu huấn luyện (coaching data), ví dụ few-shot hoặc dữ liệu tinh chỉnh (fine-tuning)
4. **Đánh giá điểm của máy trên mẫu của con người** — liệu máy có khớp với phong cách của con người không?
5. **Tự động dịch phần còn lại** — nếu chất lượng dịch máy ở mức chấp nhận được trên mẫu
6. **Đánh giá tùy chọn bởi con người** — gắn cờ các kết quả đầu ra có độ tin cậy thấp để người bản xứ đánh giá

## Đảm bảo chất lượng: Thử nghiệm khớp phong cách

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Lựa chọn mẫu

**Bao quát phân phối.** 100 mục nhập của bạn nên bao gồm:
- Các cụm từ ngắn (1–3 từ) và các câu đầy đủ
- Từ vựng thông dụng và các thuật ngữ chuyên ngành
- Các cấu trúc đơn giản và phức tạp
- Nhiều đặc điểm ngữ pháp khác nhau (câu hỏi, câu mệnh lệnh, câu điều kiện)

**Đừng chỉ chọn những câu dễ.** Mẫu phải bao gồm các mục nhập mà phương pháp của bạn có khả năng gặp khó khăn — đó là nơi chất lượng dịch của con người quan trọng nhất.

## Quy trình đánh giá của cộng đồng

Đối với các cộng đồng ngôn ngữ bản địa, phương pháp này tôn trọng thời gian của người nói:

1. **Người nói dịch 50–100 mục nhập** (2–4 giờ làm việc tập trung)
2. **Máy dịch 900 mục còn lại** bằng cách sử dụng bản dịch của người nói làm dữ liệu huấn luyện
3. **Người nói đánh giá các mục bị gắn cờ** — chỉ những mục mà máy có độ tin cậy thấp nhất (mất thêm 1–2 giờ)
4. **Kết quả:** 1.000 bản dịch đạt chất lượng gần như con người, chỉ với khoảng 5 giờ làm việc của người nói thay vì khoảng 50 giờ

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Kết hợp chất lượng của con người với quy mô của máy móc | ❌ Đòi hỏi sự đầu tư ban đầu từ con người |
| ✅ Tôn trọng quỹ thời gian hạn chế của người nói | ❌ Máy móc có thể không nắm bắt được tất cả các sắc thái phong cách |
| ✅ Quy trình đảm bảo chất lượng tự nhiên | ❌ Việc lựa chọn mẫu ảnh hưởng đến chất lượng tổng thể |
| ✅ Tuyệt vời cho các bối cảnh cộng đồng/giáo dục | ❌ Nút thắt cổ chai khi con người phải đánh giá các mục bị gắn cờ |

## Kết hợp tốt với

- **[Coached LLM Prompting](./coached-llm-prompting)** — các bản dịch của con người cung cấp thông tin cho dữ liệu huấn luyện
- **[Few-Shot Prompting](./few-shot-prompting)** — các bản dịch của con người đóng vai trò là ví dụ theo ngữ cảnh (in-context examples)
- **[Corpus Creation](./corpus-creation)** — mẫu dịch của con người CHÍNH LÀ việc tạo kho ngữ liệu (corpus creation)

## Xem thêm

- [Dành cho các cộng đồng ngôn ngữ](/docs/network/community/for-language-communities) — mô hình gắn kết cộng đồng
- [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) — quyền sở hữu dữ liệu dịch thuật
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages)
