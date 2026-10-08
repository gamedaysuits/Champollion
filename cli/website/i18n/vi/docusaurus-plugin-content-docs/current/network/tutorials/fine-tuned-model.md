---
sidebar_position: 5
title: "Cookbook: Mô hình tinh chỉnh"
---

# Mô hình Fine-Tuned

> **Ý tưởng:** Fine-tune một mô hình mã nguồn mở (Llama, Mistral, Gemma) trên văn bản song ngữ (parallel text) cho cặp ngôn ngữ mục tiêu của bạn. Phương pháp này có tiềm năng đạt mức trần chất lượng cao nhất, nhưng đòi hỏi dữ liệu song ngữ vốn có thể khan hiếm — và các quy tắc về rò rỉ dữ liệu đánh giá (eval data contamination) rất nghiêm ngặt.

:::info[Đây là cookbook, không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo phương pháp tiếp cận, các yêu cầu về dữ liệu và những cạm bẫy cần tránh. Cơ sở hạ tầng huấn luyện thực tế nằm ngoài phạm vi của harness.
:::

## Khi nào nên sử dụng

- Bạn có quyền truy cập vào một **kho ngữ liệu song ngữ (parallel corpus)** (từ hàng trăm đến hàng nghìn cặp câu) **hoàn toàn độc lập** với tập dữ liệu đánh giá
- Bạn có **quyền truy cập GPU** để huấn luyện (phần cứng cục bộ, đám mây hoặc cụm máy tính của trường đại học)
- Bạn muốn đạt **mức trần chất lượng cao nhất** cho một cặp ngôn ngữ cụ thể và sẵn sàng đầu tư vào việc huấn luyện
- Các phương pháp tiếp cận khác (coached prompting, few-shot) đã chạm ngưỡng giới hạn về chất lượng

## Cách thức hoạt động

1. **Thu thập dữ liệu song ngữ** — các cặp câu nguồn-đích từ các nguồn độc lập (sách giáo khoa, kho lưu trữ cộng đồng, biên bản Hansard, văn bản tôn giáo, tài liệu giáo dục)
2. **Chuẩn bị định dạng huấn luyện** — định dạng tinh chỉnh theo hướng dẫn (instruction-tuning) (system prompt + input + expected output)
3. **Fine-tune** — LoRA/QLoRA trên một mô hình nền tảng (base model) (lượng tử hóa 4-bit giúp việc này khả thi trên các GPU phổ thông)
4. **Đánh giá với harness** — chạy mô hình đã fine-tune qua bộ công cụ đánh giá (eval harness)
5. **Lặp lại** — điều chỉnh dữ liệu huấn luyện, siêu tham số (hyperparameters), lựa chọn mô hình nền tảng

## Yêu cầu về dữ liệu

| Kích thước ngữ liệu | Kết quả kỳ vọng |
|-------------|----------------|
| 50–200 cặp | Cải thiện không đáng kể so với zero-shot; có thể bị quá khớp (overfit) |
| 200–1.000 cặp | Cải thiện rõ rệt về phong cách và thuật ngữ |
| 1.000–5.000 cặp | Đạt được mức tăng chất lượng đáng kể cho cặp ngôn ngữ cụ thể |
| Trên 5.000 cặp | Tiệm cận mức trần chất lượng của mô hình nền tảng |

:::danger[Nhiễm độc dữ liệu đánh giá = Bị loại]
Dữ liệu huấn luyện của bạn TUYỆT ĐỐI KHÔNG ĐƯỢC trùng lặp với tập dữ liệu đánh giá. Không trùng câu từ, không trùng danh sách từ vựng, và không trùng các cách diễn đạt khác của cùng một nội dung. Harness sẽ tạo dấu vân tay (fingerprint) cho các kết quả đầu ra của bạn; sự trùng lặp về mặt thống kê có thể bị phát hiện. Nếu bạn không chắc chắn liệu một nguồn dữ liệu có độc lập hay không, hãy chọn giải pháp an toàn là loại bỏ nó. Xem [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules).
:::

## Khung mã nguồn (Skeleton): LoRA Fine-Tuning

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Nơi tìm kiếm dữ liệu song ngữ

- **Kho lưu trữ cộng đồng** — tài liệu giáo dục, văn bản chính phủ, ấn phẩm song ngữ
- **Nunavut Hansard** — 1,3 triệu cặp câu tiếng Anh-Inuktitut được căn chỉnh (NRC Canada)
- **Bản dịch Kinh Thánh** — có sẵn cho nhiều ngôn ngữ ít tài nguyên (low-resource languages), nhưng mang tính đặc thù lĩnh vực (domain-specific)
- **Sách giáo khoa giáo dục** — thường là song ngữ trong bối cảnh học ngôn ngữ
- **Tự tạo dữ liệu** — xem [Hướng dẫn tạo ngữ liệu](./corpus-creation)

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Mức trần chất lượng cao nhất | ❌ Yêu cầu dữ liệu song ngữ (khan hiếm đối với các ngôn ngữ ít tài nguyên - LRL) |
| ✅ Mô hình học được các đặc trưng riêng của ngôn ngữ | ❌ Chi phí GPU (mặc dù LoRA giúp giảm bớt) |
| ✅ Có thể vượt trội hơn các phương pháp tiếp cận bằng prompt | ❌ Nguy cơ quá khớp (overfitting) với các tập dữ liệu nhỏ |
| ✅ Chi phí huấn luyện một lần, sau đó suy luận (inference) giá rẻ | ❌ Quy tắc nghiêm ngặt về rò rỉ dữ liệu đánh giá |

## Kết hợp tốt với

- **[Tạo ngữ liệu](./corpus-creation)** — xây dựng dữ liệu huấn luyện bạn cần
- **[Dịch ngược (Back-Translation)](./back-translation)** — mở rộng ngữ liệu song ngữ của bạn bằng phương pháp tổng hợp
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — mô hình fine-tuned + kiểm chứng hình thái (morphological validation)
- **[Coached LLM Prompting](./coached-llm-prompting)** — huấn luyện (coaching) trên nền tảng mô hình đã fine-tune

## Xem thêm

- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — biết những gì bạn KHÔNG ĐƯỢC PHÉP dùng để huấn luyện
- [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules) — chính sách về rò rỉ dữ liệu (contamination)
- [Hỗ trợ một ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages)
