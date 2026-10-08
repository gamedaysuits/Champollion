---
sidebar_position: 8
title: "Sổ tay hướng dẫn: Tăng cường bằng dịch ngược"
---

# Tăng cường Dữ liệu bằng Dịch ngược (Back-Translation Augmentation)

> **Ý tưởng:** Tạo dữ liệu song song tổng hợp (synthetic parallel data) bằng cách dịch ngược văn bản hiện có ở ngôn ngữ đích sang ngôn ngữ nguồn, sau đó sử dụng các cặp dữ liệu tổng hợp này để huấn luyện hoặc tạo gợi ý (prompt) cho mô hình dịch xuôi. Phương pháp này giúp mở rộng kho ngữ liệu song song của bạn một cách tiết kiệm — nhưng cần lưu ý về mặt chất lượng.

:::info[Đây là cookbook, không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo chiến lược và các lỗi nghiêm trọng dễ mắc phải. Dịch ngược (back-translation) rất mạnh mẽ nhưng có thể khuếch đại sai số nếu không được thực hiện cẩn thận.
:::

## Khi nào nên sử dụng

- Bạn có **văn bản đơn ngữ ở ngôn ngữ đích** nhưng dữ liệu song song lại hạn chế
- Bạn muốn **mở rộng kho ngữ liệu huấn luyện** để [tinh chỉnh (fine-tuning)](./fine-tuned-model) mà không cần dịch thủ công
- Bạn cần **thêm các ví dụ few-shot** nhưng không thể có được bản dịch do con người thực hiện đủ nhanh
- Bạn sẵn sàng **lọc chất lượng** dữ liệu tổng hợp một cách nghiêm ngặt

## Cách thức hoạt động

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Thu thập văn bản đơn ngữ** — sách, bài báo, bản ghi chép (transcript), mạng xã hội bằng ngôn ngữ đích
2. **Dịch ngược (Back-translate)** — sử dụng một LLM hoặc API dịch máy để dịch từng câu sang ngôn ngữ nguồn
3. **Lọc chất lượng** — dịch khứ hồi (round-trip - dịch ngược lại một lần nữa) và so sánh; giữ lại các cặp câu có bản dịch khứ hồi gần như trùng khớp với bản gốc (round-trip ≈ original)
4. **Sử dụng kho ngữ liệu tổng hợp** — để tinh chỉnh (fine-tuning), làm ví dụ few-shot, hoặc làm dữ liệu huấn luyện kèm hướng dẫn (coaching data)

## Lọc chất lượng: Thử nghiệm dịch khứ hồi (Round-Trip Test)

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Lỗi nghiêm trọng cần tránh: Khuếch đại sai sót (Error Amplification)

:::warning[Dịch ngược làm khuếch đại các thiên kiến sẵn có của mô hình]
Nếu mô hình dịch ngược của bạn liên tục mắc cùng một lỗi, kho ngữ liệu tổng hợp (synthetic corpus) của bạn sẽ mã hóa những lỗi đó thành "đúng". Điều này tạo ra một vòng lặp phản hồi: huấn luyện trên dữ liệu xấu → tạo ra các bản dịch kém hơn → tạo ra dữ liệu tổng hợp tệ hơn. **Hãy luôn lọc chất lượng một cách quyết liệt** và kết hợp dữ liệu tổng hợp với các bản dịch đã được con người xác minh.
:::

## Nơi tìm kiếm văn bản đơn ngữ

- Bản tin cộng đồng, báo chí và các ấn phẩm
- Tài liệu chính phủ bằng ngôn ngữ đích (ví dụ: Nunavut Hansard cho tiếng Inuktitut)
- Tài liệu giáo dục và sách giáo khoa
- Văn bản tôn giáo (phổ biến rộng rãi cho nhiều ngôn ngữ)
- Mạng xã hội (với sự cho phép phù hợp và có lọc chất lượng)
- Bản ghi âm/video từ các chương trình ngôn ngữ

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Mở rộng dữ liệu huấn luyện một cách tiết kiệm | ❌ Khuếch đại sai sót của mô hình nếu không được lọc |
| ✅ Tận dụng được nguồn văn bản đơn ngữ dồi dào | ❌ Giới hạn chất lượng bị phụ thuộc vào mô hình dịch ngược |
| ✅ Dễ dàng tạo ra ở quy mô lớn | ❌ Việc lọc khứ hồi (round-trip) tốn nhiều tài nguyên tính toán |
| ✅ Bổ trợ tốt cho các phương pháp khác | ❌ Dữ liệu tổng hợp không bao giờ tốt bằng bản dịch do con người thực hiện |

## Kết hợp tốt với

- **[Mô hình tinh chỉnh (Fine-Tuned Model)](./fine-tuned-model)** — dịch ngược tạo ra dữ liệu huấn luyện để tinh chỉnh
- **[Tạo kho ngữ liệu (Corpus Creation)](./corpus-creation)** — dữ liệu tổng hợp bổ sung cho kho ngữ liệu do con người tạo ra
- **[Gợi ý LLM kèm hướng dẫn (Coached LLM Prompting)](./coached-llm-prompting)** — các ví dụ tổng hợp có thể cung cấp thông tin cho từ điển hướng dẫn (coaching dictionary)

## Xem thêm

- [Tập dữ liệu đánh giá (Evaluation Datasets)](/docs/network/leaderboard/datasets) — dữ liệu tổng hợp không được trùng lặp với dữ liệu đánh giá
- [Quy tắc bảng xếp hạng (Leaderboard Rules)](/docs/network/leaderboard/rules) — chính sách về rò rỉ dữ liệu (contamination policy)
- [Hỗ trợ ngôn ngữ nghèo tài nguyên (Support a Low-Resource Language)](/docs/network/community/low-resource-languages)
