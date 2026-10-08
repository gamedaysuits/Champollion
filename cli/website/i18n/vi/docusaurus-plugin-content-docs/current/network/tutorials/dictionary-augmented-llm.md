---
sidebar_position: 4
title: "Cookbook: LLM tăng cường bằng từ điển"
---

# Dictionary-Augmented LLM

> **Ý tưởng:** Bắt buộc sử dụng các bản dịch đã được xác minh và biết trước cho các thuật ngữ cụ thể từ một từ điển song ngữ, và để LLM xử lý cấu trúc câu cũng như từ vựng chưa biết. Từ điển cung cấp các điểm neo chính xác; LLM mang lại sự trôi chảy.

:::info[Đây là cẩm nang hướng dẫn, không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo phương pháp tiếp cận. Chiến lược so khớp từ điển và chèn (injection) cụ thể sẽ phụ thuộc vào cặp ngôn ngữ của bạn và các tài nguyên từ vựng sẵn có.
:::

## Khi nào nên sử dụng

- **Có sẵn từ điển song ngữ** cho cặp ngôn ngữ của bạn (ngay cả một từ điển nhỏ)
- LLM liên tục **gặp hiện tượng ảo giác (hallucinate) với các thuật ngữ chính** — tự tạo ra các từ không tồn tại
- Bạn cần **sự nhất quán về thuật ngữ** trong các bản dịch (cùng một từ được dịch theo cùng một cách ở mọi nơi)
- Bạn đang dịch **nội dung chuyên ngành** nơi các bản dịch LLM tiêu chuẩn thường bị sai (pháp lý, y tế, giáo dục)

## Cách thức Hoạt động

1. **Tải một từ điển song ngữ** — các cặp khóa-giá trị (key-value) ánh xạ các thuật ngữ nguồn sang các bản dịch đích đã được xác minh
2. **So khớp văn bản nguồn với từ điển** — xác định các thuật ngữ trong đầu vào có bản dịch đã biết
3. **Chèn các kết quả khớp vào prompt** — yêu cầu LLM "các thuật ngữ này BẮT BUỘC phải được dịch như sau"
4. **LLM tạo bản dịch** — với các ràng buộc từ điển là các yêu cầu bắt buộc
5. **Hậu xử lý** — xác minh các thuật ngữ trong từ điển xuất hiện trong kết quả đầu ra; thử lại nếu chúng không xuất hiện

## Định dạng từ điển

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Cấu trúc Prompt

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Các quyết định thiết kế quan trọng

**Chiến lược so khớp:** So khớp chính xác (exact match) là đơn giản nhất. So khớp từ nguyên/dạng gốc (lemmatized matching - ví dụ: "teachers" khớp với "teacher") tìm được nhiều kết quả hơn nhưng yêu cầu một bộ phân tích từ nguyên cho ngôn ngữ nguồn. So khớp mờ (fuzzy matching) có nguy cơ tạo ra các kết quả khớp sai (false positives).

**Xử lý biến hình từ (inflection):** Trong các ngôn ngữ đa tổng hợp (polysynthetic), dạng từ điển có thể cần biến hình để phù hợp với ngữ cảnh của câu. Bạn có thể cung cấp từ gốc và để LLM tự biến hình, hoặc cung cấp nhiều dạng biến hình khác nhau. Một [FST](./fst-gated-pipeline) có thể xác thực kết quả.

**Giải quyết xung đột:** Điều gì xảy ra nếu LLM bỏ qua một thuật ngữ trong từ điển? Các lựa chọn: (a) thử lại với chỉ dẫn mạnh mẽ hơn, (b) hậu xử lý bằng cách thay thế chuỗi, (c) chấp nhận và đánh dấu để xem xét lại.

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Loại bỏ hiện tượng ảo giác đối với các thuật ngữ đã biết | ❌ Độ bao phủ của từ điển luôn không đầy đủ |
| ✅ Đảm bảo tính nhất quán cho các từ vựng chính | ❌ Sự biến hình/chia động từ có thể không phù hợp với ngữ cảnh của câu |
| ✅ Dễ dàng kiểm tra và cập nhật | ❌ Ràng buộc quá mức có thể tạo ra kết quả đầu ra không tự nhiên |
| ✅ Từ điển là một tài sản có thể tái sử dụng | ❌ Đòi hỏi phải có sẵn từ điển ngay từ đầu |

## Nơi tìm kiếm từ điển

- **[itwêwina](https://itwewina.altlab.app/)** — Tiếng Plains Cree–Tiếng Anh (được hỗ trợ bởi FST; nền tảng morphodict là mã nguồn mở — bản thân nội dung từ điển không được cấp phép mở)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — tài liệu tham khảo toàn diện về tiếng Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — từ điển song ngữ cho hàng chục cặp ngôn ngữ
- **[Giellatekno](https://giellalt.github.io/)** — từ điển cho tiếng Sámi, tiếng Uralic và các ngôn ngữ thiểu số khác
- Các bảng chú giải thuật ngữ do cộng đồng tạo ra, tài liệu giáo dục, danh sách thuật ngữ

## Kết hợp tốt với

- **[Coached LLM Prompting](./coached-llm-prompting)** — các mục từ điển là một dạng dữ liệu hướng dẫn (coaching data)
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST xác thực rằng các thuật ngữ trong từ điển được biến hình chính xác
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — tra cứu từ điển mang tính quyết định (deterministic) như một lớp quy tắc

## Xem thêm

- [Hỗ trợ ngôn ngữ tài nguyên thấp](/docs/network/community/low-resource-languages) — bối cảnh đầy đủ
- [Giao diện phương thức](/docs/network/specifications/methods) — cách cấu trúc các phương thức
