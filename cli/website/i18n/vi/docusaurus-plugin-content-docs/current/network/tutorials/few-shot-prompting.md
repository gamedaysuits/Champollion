---
sidebar_position: 3
title: "Sổ tay hướng dẫn: Few-Shot Prompting"
---

# Few-Shot Prompting

> **Ý tưởng:** Đưa các cặp bản dịch chất lượng cao đã được xác thực vào làm ví dụ ngữ cảnh (in-context examples) để LLM học hỏi các cấu trúc, phong cách và quy ước của ngôn ngữ đích từ thực tế minh họa thay vì từ hướng dẫn.

:::info[Đây là cẩm nang hướng dẫn (cookbook), không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo phương pháp tiếp cận và các quyết định thiết kế chính của nó. Hãy điều chỉnh nó cho phù hợp với cặp ngôn ngữ và tài nguyên sẵn có của bạn.
:::

## Khi nào nên sử dụng

- Bạn có một **tập hợp nhỏ các bản dịch đã được xác thực** (ngay cả 5–10 cặp bản dịch chuẩn cũng có ích)
- Bạn muốn LLM khớp với một **phong cách hoặc văn phong cụ thể** thông qua ví dụ thay vì quy tắc
- Ngôn ngữ đích của bạn có các cấu trúc **dễ minh họa hơn là mô tả** (trật tự từ, cấu trúc phụ tố, dấu hiệu trang trọng)

## Cách thức hoạt động

1. **Tuyển chọn các cặp ví dụ** — chọn các bản dịch nguồn→đích chất lượng cao thể hiện được các cấu trúc chính
2. **Định dạng dưới dạng ví dụ ngữ cảnh** — đưa chúng vào prompt hệ thống (system prompt) hoặc prompt người dùng (user prompt) trước yêu cầu dịch thực tế
3. **Chạy bộ khung đánh giá (harness)** — đo lường xem các ví dụ có cải thiện các chỉ số so với zero-shot hay không
4. **Lặp lại việc lựa chọn ví dụ** — thay đổi các ví dụ để bao quát các trường hợp lỗi khác nhau

## Cấu trúc Prompt Ví dụ

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Quy tắc quan trọng: Không rò rỉ dữ liệu đánh giá (Eval Data Contamination)

:::danger[KHÔNG ĐƯỢC sử dụng dữ liệu đánh giá làm ví dụ few-shot]
Nếu các ví dụ của bạn đến từ tập dữ liệu đánh giá, phương pháp của bạn sẽ bị **loại** khỏi bảng xếp hạng (leaderboard). Các ví dụ few-shot phải đến từ các nguồn độc lập — từ điển, sách giáo khoa, các cặp ngôn ngữ đã được cộng đồng xác minh, hoặc một tập phát triển (development set) riêng biệt. Khung thử nghiệm (harness) sẽ lưu dấu vân tay (fingerprint) prompt chính xác của bạn; sự nhiễm độc dữ liệu (contamination) hoàn toàn có thể bị phát hiện.
:::

## Các quyết định thiết kế quan trọng

**Bao nhiêu ví dụ là đủ?** Từ 3–8 ví dụ là điểm tối ưu. Ít hơn sẽ khiến LLM có quá ít tín hiệu; nhiều hơn sẽ làm tiêu tốn cửa sổ ngữ cảnh (context window) mà hiệu quả mang lại không tương xứng.

**Nên chọn những ví dụ nào?** Hãy ưu tiên tính đa dạng hơn là độ khó. Hãy bao quát các cấu trúc câu, độ dài từ và đặc điểm ngữ pháp khác nhau. Đừng tập trung quá nhiều ví dụ vào cùng một cấu trúc duy nhất.

**Lựa chọn tĩnh hay động?** Các ví dụ tĩnh (static) thì đơn giản hơn. Lựa chọn động (dynamic selection - chọn các ví dụ tương tự với đầu vào hiện tại) có thể cải thiện chất lượng nhưng làm tăng độ phức tạp — hãy cân nhắc sử dụng [mô hình chuỗi (chained models)](./chained-models) cho bước truy xuất.

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Hiệu quả mạnh mẽ trong việc khớp phong cách | ❌ Cửa sổ ngữ cảnh nhỏ giới hạn số lượng ví dụ |
| ✅ Không yêu cầu huấn luyện | ❌ Việc lựa chọn ví dụ mang tính nghệ thuật hơn là khoa học |
| ✅ Hoạt động với mọi LLM | ❌ Nguy cơ rò rỉ dữ liệu đánh giá (bị loại) |
| ✅ Dễ dàng thử nghiệm A/B các tập ví dụ khác nhau | ❌ Các ví dụ có thể không khái quát hóa được cho mọi loại đầu vào |

## Kết hợp tốt với

- **[Coached LLM Prompting](./coached-llm-prompting)** — kết hợp quy tắc + ví dụ sẽ mang lại hiệu quả tốt hơn là sử dụng riêng lẻ từng phương pháp
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — áp đặt thuật ngữ + ví dụ phong cách
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — ví dụ cho phong cách, FST cho tính chính xác về mặt hình thái học

## Xem thêm

- [Quy tắc đánh giá dịch máy (MT Evaluation Rules)](/docs/network/leaderboard/rules) — những trường hợp nào sẽ bị loại
- [Tập dữ liệu đánh giá (Evaluation Datasets)](/docs/network/leaderboard/datasets) — biết những gì bạn KHÔNG THỂ sử dụng làm ví dụ
- [Hỗ trợ ngôn ngữ nghèo tài nguyên (Support a Low-Resource Language)](/docs/network/community/low-resource-languages)
