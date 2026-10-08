---
title: "Quy trình trích dẫn thẻ ngôn ngữ"
sidebar_label: "Citation Procedure"
---

# Quy trình trích dẫn nguồn cho Thẻ ngôn ngữ

*Cách Champollion đảm bảo mọi tuyên bố trên thẻ ngôn ngữ đều có thể truy xuất nguồn gốc từ một nguồn sơ cấp.*

---

## 1. Vấn đề

Các thẻ ngôn ngữ chứa các tuyên bố thực tế — số lượng người nói, tình trạng nguy cấp, ảnh hưởng tiếp xúc, đặc tính hình thái, quy ước typographic, hỗ trợ phương thức dịch — những thông tin này **bắt buộc phải xác minh được**. Hiện tại:

- Trường `dataSources` là một mảng phẳng chứa các chuỗi (ví dụ: `["cldr-48", "glottolog-5.3"]`)
- Không có độ chi tiết trích dẫn cho từng trường
- Các tuyên bố như "~2.8M speakers" (khoảng 2,8 triệu người nói) hoặc "vulnerable" (bị đe dọa) không có nguồn gốc rõ ràng để truy xuất
- Người kiểm duyệt không thể xác định nguồn nào hỗ trợ cho tuyên bố nào

> [!CAUTION]
> **Một tuyên bố không có nguồn là một tuyên bố không thể xác minh.** Đối với một dự án tự định vị là có tính nghiêm ngặt chuyên nghiệp, mọi khẳng định trên thẻ ngôn ngữ phải có thể truy xuất nguồn gốc từ một nguồn sơ cấp cụ thể, có phiên bản rõ ràng.

---

## 2. Các nguồn có thẩm quyền (Xếp hạng theo mức độ ưu tiên)

Đối với mỗi loại tuyên bố, các nguồn sau đây được coi là có thẩm quyền. **Luôn ưu tiên nguồn có thứ hạng cao nhất hiện có.**

### Phân loại và Định danh

| Mức độ ưu tiên | Nguồn | Phạm vi | Giấy phép | Cách trích dẫn |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Họ ngôn ngữ, nguồn gốc, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | Mã ISO, macrolanguage (ngôn ngữ vĩ mô) | Miễn phí | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Định nghĩa chi (genus), đặc điểm loại hình học | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Mã locale, mã chữ viết (script), quy tắc số nhiều | Điều khoản dịch vụ Unicode | `cldr-{version}` |

### Nhân khẩu học người nói và Sức sống ngôn ngữ

| Mức độ ưu tiên | Nguồn | Phạm vi | Giấy phép | Cách trích dẫn |
|---|---|---|---|---|
| 1 | Dữ liệu điều tra dân số quốc gia | Số lượng người nói chính thức | Khác nhau (thường là công khai) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Ước tính người nói, EGIDS | Độc quyền (trả phí) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | Tình trạng nguy cấp | Miễn phí | `unesco-atlas-{year}` |
| 4 | Các bài báo học thuật đã xuất bản | Khảo sát người nói theo khu vực | Theo giấy phép của từng bài báo | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Các ngôn ngữ Philippines | Học thuật | `katig-{year}` |

> [!WARNING]
> **Không bao giờ sử dụng Wikipedia, văn bản do LLM tạo ra hoặc kiến thức tự thân làm nguồn sơ cấp cho các tuyên bố nhân khẩu học.** Đây cùng lắm chỉ là các nguồn thứ cấp/tam cấp. Luôn luôn truy xuất ngược lại dữ liệu sơ cấp.

### Hỗ trợ phương thức dịch (Phạm vi phủ sóng của API dịch thuật)

| Phương thức | Nguồn xác minh | Cách xác minh | Cách trích dẫn |
|---|---|---|---|
| Google Translate | [Danh sách ngôn ngữ](https://cloud.google.com/translate/docs/languages) | Gọi API hoặc trang tài liệu | `google-translate-{date}` |
| DeepL | [Danh sách ngôn ngữ](https://www.deepl.com/docs-api/translate-text/) | Gọi API | `deepl-api-{date}` |
| Microsoft Translator | [Danh sách ngôn ngữ](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Trang tài liệu | `ms-translator-{date}` |
| LibreTranslate | [Danh sách ngôn ngữ](https://libretranslate.com/languages) | Gọi API | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + model card | `nllb-200-{date}` |
| LLM | Luôn là `true` | N/A (chất lượng khác nhau) | `llm-assumed` |

### DLS (Hỗ trợ ngôn ngữ kỹ thuật số)

| Mức độ ưu tiên | Nguồn | Phạm vi | Cách trích dẫn |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | Điểm số DLS (143 công cụ ban đầu) | `simons-2022` |
| 2 | Ethnologue phiên bản 27+ | Điểm số DLS (mở rộng 211 công cụ) | `ethnologue-{edition}-dls` |

### Typography, Số nhiều, Chữ viết

| Mức độ ưu tiên | Nguồn | Phạm vi | Cách trích dẫn |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Quy tắc số nhiều, dấu ngoặc kép, định dạng số | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Mã chữ viết (script) | `iso15924-{date}` |
| 3 | Các tài liệu ngữ pháp đã xuất bản | Quy tắc đặc thù của ngôn ngữ | `{author}-{year}` |

### Ảnh hưởng tiếp xúc

| Mức độ ưu tiên | Nguồn | Phạm vi | Cách trích dẫn |
|---|---|---|---|
| 1 | Các bài báo ngôn ngữ học lịch sử đã xuất bản | Nghiên cứu từ mượn, lịch sử tiếp xúc | `{author}-{year}` |
| 2 | Ngữ pháp tham chiếu | Mô tả ảnh hưởng cấu trúc | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | So sánh loại hình học | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Các tuyên bố về ảnh hưởng tiếp xúc là khó tìm nguồn nhất.** Các tuyên bố như "Spanish superstrate, deep, 1571–1898" (siêu tầng tiếng Tây Ban Nha, sâu sắc, 1571–1898) đòi hỏi chuyên môn về ngôn ngữ học lịch sử. Nếu không thể tìm thấy nguồn đã xuất bản, hãy đánh dấu tuyên bố đó bằng `"citation_needed": true` thay vì tự đoán.

---

## 3. Quy trình trích dẫn (Từng bước)

### Khi tạo một Thẻ ngôn ngữ mới

1. **Bắt đầu với các trường tự động điền:**
   - Chạy `node scripts/build-language-tree.mjs --enrich` → tự động điền `classification` từ Glottolog
   - Ghi lại `"glottolog-{version}"` vào `dataSources`

2. **Thêm dữ liệu CLDR:**
   - Tra cứu quy tắc số nhiều, dấu ngoặc kép, mã chữ viết từ CLDR
   - Ghi lại `"cldr-{version}"` vào `dataSources`

3. **Nghiên cứu nhân khẩu học người nói:**
   - Kiểm tra dữ liệu điều tra dân số quốc gia ĐẦU TIÊN
   - Tham chiếu chéo với Ethnologue (nếu có)
   - Tham chiếu chéo với UNESCO Atlas
   - Ghi lại TẤC CẢ các nguồn đã tham khảo vào `dataSources`

4. **Xác minh hỗ trợ phương thức dịch:**
   - Kiểm tra danh sách ngôn ngữ của TỪNG API (không dựa vào trí nhớ, không tự giả định)
   - Ghi lại ngày xác minh

5. **Nghiên cứu ảnh hưởng tiếp xúc:**
   - Tìm các bài báo ngôn ngữ học lịch sử đã xuất bản
   - Tài liệu hóa giai đoạn, loại hình, mức độ sâu sắc kèm theo trích dẫn
   - Nếu không có nguồn đã xuất bản nào tồn tại, hãy thêm `"citation_needed": true` vào mục ảnh hưởng

6. **Nghiên cứu sức sống ngôn ngữ:**
   - Kiểm tra Ethnologue để lấy EGIDS
   - Kiểm tra UNESCO Atlas để lấy tình trạng nguy cấp
   - Ghi chú lại bất kỳ sự khác biệt nào giữa các nguồn

7. **Điền thông tin vào `dataSources`:**
   - Liệt kê MỌI nguồn đã tham khảo (không chỉ những nguồn cung cấp dữ liệu)
   - Sử dụng định dạng trích dẫn từ các bảng ở trên

### Khi cập nhật một Thẻ ngôn ngữ hiện có

1. **Không bao giờ thay đổi một tuyên bố thực tế mà không cập nhật `dataSources`**
2. **Nếu bạn cập nhật số lượng người nói**, hãy xóa nguồn cũ và thêm nguồn mới
3. **Nếu bạn thêm hỗ trợ phương thức dịch**, hãy xác minh với API và ghi lại ngày
4. **Đóng dấu ngày tháng cho tất cả các kiểm tra hỗ trợ phương thức dịch** — phạm vi phủ sóng của API thay đổi thường xuyên

---

## 4. Đề xuất cải tiến Schema: Trích dẫn theo từng trường

### Schema hiện tại (Mảng phẳng `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Vấn đề:** Trường nào đến từ CLDR? Trường nào từ Glottolog? Trường nào chưa được trích dẫn?

### Đề xuất cải tiến: Cấu trúc hóa `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Lộ trình chuyển đổi

Đây là một thay đổi **tương thích ngược**:
1. Các thẻ hiện có vẫn giữ mảng phẳng (vẫn hợp lệ)
2. Các thẻ mới sử dụng định dạng có cấu trúc
3. Việc xác thực schema chấp nhận cả hai định dạng
4. Chuyển đổi dần các thẻ hiện có khi chúng được kiểm duyệt

> [!TIP]
> **Xác thực bằng một script.** Thêm một script `validate-citations.mjs` để:
> - Kiểm tra xem mỗi thẻ có ít nhất các nguồn `classification` và `vitality` hay không
> - Đánh dấu các thẻ có mảng phẳng `dataSources` để nâng cấp
> - Cảnh báo về các mục `methodSupport` không có xác minh được đóng dấu ngày tháng

---

## 5. Danh sách kiểm tra chất lượng

Trước khi merge bất kỳ thay đổi nào đối với thẻ ngôn ngữ, hãy xác minh:

- [ ] Mọi số lượng người nói đều có nguồn (điều tra dân số hoặc Ethnologue, không phải Wikipedia)
- [ ] Mọi tình trạng UNESCO/EGIDS đều có nguồn
- [ ] Mọi cờ hỗ trợ phương thức dịch đều được xác minh với API thực tế (không tự giả định)
- [ ] Mọi ảnh hưởng tiếp xúc đều có nguồn học thuật đã xuất bản HOẶC được đánh dấu là `citation_needed`
- [ ] Phân loại được tự động điền từ Glottolog (không phải tự điền thủ công)
- [ ] `dataSources` liệt kê TẤT CẢ các nguồn đã tham khảo
- [ ] Không có tuyên bố nào chỉ dựa vào kiến thức do LLM tạo ra
- [ ] `humanReviewed` được đặt thành định danh của người kiểm duyệt và ngày tháng nếu có người bản xứ kiểm duyệt

---

## 6. Trường `humanReviewed`

Schema thẻ ngôn ngữ bao gồm một trường `humanReviewed` hiện đang là `null` trên tất cả các thẻ. Trường này nên được điền thông tin khi một người bản xứ hoặc nhà ngôn ngữ học có trình độ kiểm duyệt thẻ:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Kiểm duyệt từ cộng đồng là tiêu chuẩn vàng.** Dữ liệu tự động và các bài báo học thuật cung cấp nền tảng, nhưng sự kiểm duyệt của người bản xứ mới là bước xác thực cuối cùng. Điều này đặc biệt quan trọng đối với:
> - Các tuyên bố về ảnh hưởng tiếp xúc (thành viên cộng đồng biết những từ mượn nào thực sự được sử dụng)
> - Đánh giá sức sống ngôn ngữ (thành viên cộng đồng biết liệu trẻ em có đang nói ngôn ngữ đó hay không)
> - Hệ thống mức độ trang trọng (các mô tả học thuật có thể bỏ sót các mô hình sử dụng hàng ngày)

---

## 7. Tài liệu tham khảo cho quy trình này

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Miễn phí
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Điều khoản sử dụng Unicode
5. Ethnologue: https://www.ethnologue.com — Độc quyền (trả phí)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — Miễn phí
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
