---
sidebar_position: 3
title: "Ngôn ngữ nhân tạo, Hệ chữ viết & Chính tả"
---

# Ngôn ngữ nhân tạo, Chữ viết & Chính tả

champollion hỗ trợ toàn diện cho các ngôn ngữ nhân tạo (conlang) thông qua các register LLM và bộ chuyển đổi chữ viết tất định (deterministic script converter). Hướng dẫn này sẽ trình bày cách hoạt động của tính năng hỗ trợ conlang, các font chữ bạn cần và cách thêm ngôn ngữ của riêng bạn.

:::tip[Tại sao conlang lại quan trọng]
Conlang không chỉ là một sự mới lạ — chúng vận hành trên cùng một cơ sở hạ tầng được sử dụng cho các ngôn ngữ thực tế chưa được hỗ trợ đầy đủ. Cổng kiểm soát chất lượng (quality gate), hệ thống huấn luyện (coaching system) và quy trình chuyển đổi chữ viết (script conversion pipeline) hoạt động hoàn toàn giống nhau đối với tiếng Klingon và tiếng Plains Cree. Nếu quy trình conlang của bạn hoạt động tốt, quy trình dành cho ngôn ngữ ít tài nguyên (low-resource language) của bạn cũng sẽ hoạt động tốt.
:::

---

## Các ngôn ngữ nhân tạo được hỗ trợ

| Ngôn ngữ | Mã | Bộ chuyển đổi chữ viết | Font chữ yêu cầu |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanization → pIqaD | Font PUA (ví dụ: pIqaD qolqoS) |
| Sindarin (Tiếng Elvish của Tolkien) | `x-elvish-s` | ✅ Latin → Tengwar | Font CSUR PUA |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | Font PUA |
| Pirate English | `x-pirate` | ❌ chỉ register | Không |
| Shakespearean English | `x-shakespeare` | ❌ chỉ register | Không |
| Yoda-speak | `x-yoda` | ❌ chỉ register | Không |

Mã conlang sử dụng tiền tố `x-` theo quy ước sử dụng riêng (private-use) của BCP-47, ngoại trừ tiếng Klingon (`tlh`) có mã [ISO 639-3](https://iso639-3.sil.org/code/tlh) được cấp bởi SIL International.

---

## Yêu cầu về Unicode, PUA và Font chữ

### Vùng sử dụng riêng (Private Use Area - PUA)

Klingon (pIqaD), Sindarin (Tengwar) và Kryptonian sử dụng các ký tự thuộc **Vùng sử dụng riêng (Private Use Area - PUA)** của Unicode. PUA là dải ký tự từ U+E000–U+F8FF — các điểm mã (codepoint) này **không có định nghĩa tiêu chuẩn**. [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) duy trì các ánh xạ được cộng đồng đồng thuận cho các chữ viết giả tưởng, nhưng chúng không phải là một phần của tiêu chuẩn Unicode.

Ý nghĩa thực tế của điều này:

- Văn bản PUA sẽ hiển thị dưới dạng **các ô vuông trống** (□□□) nếu không tải đúng font chữ
- Các font chữ khác nhau có thể ánh xạ các glyph (hình chữ) khác nhau vào cùng một điểm mã PUA
- champollion KHÔNG đi kèm sẵn các font chữ PUA — bạn phải tự tải chúng
- Font chữ hệ thống sẽ không bao giờ hiển thị được các ký tự này

### Các dải PUA theo chữ viết

| Chữ viết | Dải PUA | Tài liệu tham khảo CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | Thay đổi tùy theo font | Không có tiêu chuẩn CSUR |

### Tải Web Font PUA

champollion tích hợp sẵn một lệnh để tải xuống và quản lý các web font PUA:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

Lệnh `fonts install` sẽ tải xuống từ các kho lưu trữ mã nguồn mở đã được xác minh:

| Font chữ | Chữ viết | Giấy phép | Nguồn |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (có ngoại lệ font chữ) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(do người dùng cung cấp)* | Kryptonian | Thay đổi | Không có sẵn font PUA nguồn mở |

Thư mục đầu ra được tự động phát hiện từ cấu trúc dự án của bạn (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, mặc định → `public/fonts/`). Ghi đè bằng `--dir`.

Nếu bạn muốn quản lý font chữ thủ công, hãy thêm các quy tắc `@font-face` trong CSS của bạn:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Hỗ trợ Unicode KHÔNG được đảm bảo]
Unicode Consortium đã [từ chối rõ ràng](https://www.unicode.org/faq/private_use.html) việc mã hóa các chữ viết hư cấu vào tiêu chuẩn chung. Các phân bổ PUA (Private Use Area) do cộng đồng duy trì và có thể xung đột giữa các triển khai phông chữ khác nhau. Hãy luôn chỉ định chính xác phông chữ mà dự án của bạn sử dụng và kiểm tra khả năng hiển thị trên các trình duyệt khác nhau.
:::

---

## Bộ chuyển đổi chữ viết

### Cách thức hoạt động

Việc chuyển đổi chữ viết của champollion là một **hook sau dịch thuật (post-translation hook), chỉ được áp dụng khi cấu hình yêu cầu**:

1. LLM dịch văn bản sang một **chữ viết làm việc (working script)** (thường là Latin hoặc SRO)
2. [Cổng chất lượng (quality gate)](/docs/concepts/quality-gate) xác thực đầu ra
3. Nếu cài đặt `script:` của cặp ngôn ngữ chọn chữ viết hiển thị, bộ chuyển đổi tất định (deterministic converter) sẽ biến đổi văn bản đã được xác thực — các giá trị chứa các chữ cái mà bộ chuyển đổi không thể ánh xạ sẽ được giữ nguyên trong chữ viết làm việc, và có cảnh báo cho từng khóa (key)
4. Kết quả được ghi vào ổ đĩa

Phương pháp hai bước này hiệu quả vì LLM tạo ra kết quả tốt hơn khi làm việc với các chữ viết dựa trên hệ Latin. Bộ chuyển đổi tất định đảm bảo đầu ra chữ viết chính xác mà không cần phụ thuộc vào kiến thức về chữ viết (thường không đáng tin cậy) của mô hình.

Việc bước 3 có chạy hay không là quyết định của từng dự án — xem [Chuyển đổi chữ viết (Script Conversion)](/docs/getting-started/configuration#script-conversion). Các chữ viết hiển thị PUA (pIqaD, Tengwar, Kryptonian) bị tắt theo mặc định vì chúng sẽ không hiển thị gì nếu không có font chữ chuyên dụng; crk và sr hoàn toàn không có mặc định, vì cả hai hệ thống chính tả của chúng đều là thực tế và quyền lựa chọn thuộc về dự án.

### Tất cả năm bộ chuyển đổi

champollion đi kèm với năm bộ chuyển đổi chữ viết tích hợp sẵn:

#### Plains Cree: SRO → Chữ âm tiết (Syllabics) (`crk`)

Chính tả Roman chuẩn (Standard Roman Orthography) sang Chữ âm tiết của Thổ dân Canada (Canadian Aboriginal Syllabics).

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Các nguyên âm dài sử dụng dấu macron/circumflex: ê, î, ô, â. Bộ chuyển đổi xử lý tất cả các dấu phụ SRO và ánh xạ chúng sang các ký tự âm tiết chính xác. Xem [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) để biết toàn bộ quy trình cho tiếng Cree.

#### Tiếng Serbia: Latin → Cyrillic (`sr`)

Chuyển đổi tất định từ Latin sang Cyrillic cho tiếng Serbia.

```
Input:  "zdravo"
Output: "здраво"
```

Bộ chuyển đổi này xử lý toàn bộ ánh xạ bảng chữ cái tiếng Serbia bao gồm cả các chữ ghép (digraph) (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanization → pIqaD (`tlh`)

Hệ thống Latin hóa (romanization) của Marc Okrand sang các ký tự pIqaD PUA.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Ánh xạ Tengwar theo chế độ Sindarin của Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

Ánh xạ chữ viết Kryptonian theo từ điển của người hâm mộ (fan-lexicon).

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Kích hoạt bộ chuyển đổi

Đặt trường `script` thành mã ISO 15924 của hệ thống chính tả mà bạn muốn viết:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Sẽ không có gì được chuyển đổi nếu thiếu trường này. Đối với `crk` và `sr`, trường này là **bắt buộc** — cả hai hệ thống chính tả của chúng đều là thực tế, và `sync` từ chối việc tự động chọn thay cho bạn. Đối với các locale PUA, đây là một tùy chọn (opt-in) thay cho mặc định là Latinh hóa (romanization). Xem [Chuyển đổi chữ viết (Script Conversion)](/docs/getting-started/configuration#script-conversion).

---

## Ngôn ngữ đa chữ viết

Một số ngôn ngữ thực tế sử dụng nhiều hệ chữ viết hoạt động song song:

| Ngôn ngữ | Chữ viết | Cách tiếp cận của champollion |
|----------|---------|-----------------|
| Tiếng Serbia | Latin + Cyrillic | Một locale, lựa chọn rõ ràng: `"script": "Cyrl"` chuyển đổi, `"script": "Latn"` giữ nguyên Latin |
| Tiếng Plains Cree | SRO (Latin) + Syllabics | Một locale, lựa chọn rõ ràng: `"script": "Cans"` hoặc `"script": "Latn"` |
| Tiếng Trung | Giản thể + Phồn thể | Các mã locale riêng biệt (`zh` so với `zh-TW`) với các ngữ vực (registers) khác nhau |

Đối với các ngôn ngữ mà cả hai chữ viết đều phục vụ cùng một đối tượng độc giả (tiếng Serbia, tiếng Plains Cree), một locale cộng với một lựa chọn `script` rõ ràng sẽ duy trì một quy trình (pipeline) dịch thuật duy nhất. Đối với các ngôn ngữ mà các chữ viết phục vụ các đối tượng độc giả khác nhau (tiếng Trung Giản thể cho Trung Quốc đại lục, Phồn thể cho Đài Loan/Hồng Kông), hãy sử dụng các mã locale riêng biệt.

---

## Lưu ý về chính tả

Các register không chỉ là giọng điệu — chúng mang theo **các hướng dẫn chính tả** để định hướng LLM tuân theo các quy ước viết chính xác.

### Các hình thức xưng hô trang trọng

Các register tích hợp sẵn của champollion bao gồm cách xưng hô trang trọng phù hợp với văn hóa của từng ngôn ngữ:

| Ngôn ngữ | Hình thức trang trọng | Hướng dẫn Register |
|----------|------------|---------------------|
| Tiếng Đức | Sie | `Use Sie-form for formal address` |
| Tiếng Pháp | vous | `Use vous-form` |
| Tiếng Nga | вы | `Professional register with вы-form` |
| Tiếng Thổ Nhĩ Kỳ | siz | `Professional register with siz-form` |
| Tiếng Hàn | 합쇼체 | `Formal Korean (합쇼체)` |
| Tiếng Nhật | です/ます | `Polite professional register (です/ます form)` |
| Tiếng Ba Lan | Pan/Pani | `Professional register with Pan/Pani form` |

### Cách viết bao hàm giới tính (Gender-Inclusive Writing)

Mỗi thẻ ngôn ngữ có một trường `gender.inclusiveGuidance` chứa lời khuyên cụ thể cho từng ngôn ngữ. Trường này được đưa vào prompt dịch của LLM tách biệt với thiết lập sẵn (preset) của register, nhờ đó nó được áp dụng một cách nhất quán bất kể người dùng chọn thiết lập mức độ trang trọng nào:

- **Tiếng Pháp**: Écriture inclusive với ký hiệu dấu chấm giữa (ví dụ: "Connecté·e")
- **Tiếng Đức**: Ký hiệu dấu hai chấm (ví dụ: "Benutzer:innen")
- **Tiếng Tây Ban Nha**: Ưu tiên tái cấu trúc trung lập về giới tính; sử dụng ký hiệu dấu gạch chéo (ví dụ: "usuario/a") làm phương án dự phòng

Đối với các ngôn ngữ không có hướng dẫn cụ thể trong thẻ của chúng (ví dụ: tiếng Hàn, conlang), hệ thống sẽ quay về quy tắc chung: *"ưu tiên các hình thức trung lập về giới tính hoặc tùy chọn bao hàm nhất có sẵn."*

### Yêu cầu đối với chữ viết từ phải sang trái (RTL)

Các register tiếng Ả Rập, tiếng Do Thái, tiếng Ba Tư và tiếng Urdu đều lưu ý các yêu cầu viết từ phải sang trái: `Ensure text reads naturally in RTL layout contexts.`

### Ghi đè bất kỳ Register nào

Mỗi register là một giá trị cấu hình — hãy ghi đè nó để phù hợp với văn phong dự án của bạn:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Xem [Cấu hình](/docs/getting-started/configuration) để biết tài liệu tham khảo cấu hình đầy đủ.

---

## Thêm một ngôn ngữ nhân tạo mới

### Các bước thực hiện

1. **Chọn mã sử dụng riêng BCP-47**: Sử dụng tiền tố `x-` (ví dụ: `x-dothraki`, `x-valyrian`).

2. **Thêm vào cấu hình của bạn**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Tùy chọn) Thêm bộ chuyển đổi chữ viết**: Nếu conlang của bạn sử dụng chữ viết hiển thị không phải Latin, hãy thêm một bộ chuyển đổi trong `lib/scripts.js` và đăng ký nó trong `SCRIPT_CONVERTERS`.

4. **Kiểm tra**: Chạy `champollion sync --dry` để xem trước các bản dịch mà không cần ghi file.

5. **Kiểm tra quality gate**: [Quality gate](/docs/concepts/quality-gate) có thể cần được tinh chỉnh cho conlang của bạn — đặc biệt là kiểm tra `requireNonLatin` nếu conlang của bạn sử dụng các ký tự PUA.

:::note[Chất lượng dịch conlang phụ thuộc vào tri thức của LLM]
LLM chỉ có thể dịch sang một conlang mà nó đã từng gặp trong dữ liệu huấn luyện. Các conlang có tài liệu hướng dẫn đầy đủ (Klingon, Sindarin, Dothraki) hoạt động rất tốt. Những conlang ít phổ biến hoặc mới được sáng tạo có thể cho ra kết quả không nhất quán. Hãy sử dụng [dữ liệu huấn luyện (coaching data)](/docs/concepts/coaching-data) để cải thiện chất lượng.
:::

---

## Xem thêm

- [Các ngôn ngữ được hỗ trợ](/docs/reference/supported-languages) — bảng ngôn ngữ đầy đủ với các phương thức khả dụng
- [Bộ chuyển đổi chữ viết](/docs/concepts/script-converters) — chi tiết kỹ thuật của quy trình chuyển đổi
- [Phương thức dịch](/docs/guides/translation-methods) — cách hoạt động của từng phương thức dịch
- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo cấu hình bao gồm thiết lập ngôn ngữ và register
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — cùng một cơ sở hạ tầng được áp dụng cho các ngôn ngữ thực tế ít phổ biến
