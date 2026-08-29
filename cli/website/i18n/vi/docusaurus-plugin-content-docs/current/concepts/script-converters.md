---
sidebar_position: 6
title: "Bộ chuyển đổi chữ viết"
---

# Bộ chuyển đổi chữ viết (Script Converters)

Bộ chuyển đổi chữ viết (script converters) là các hook hậu dịch thuật mang tính xác định (deterministic) và không phụ thuộc vào LLM, giúp chuyển đổi văn bản từ hệ thống chữ viết này sang hệ thống chữ viết khác. Chúng cho phép quy trình làm việc "dịch một lần, hiển thị bằng nhiều chữ viết" — bạn dịch sang một chữ viết làm việc (thường là Latin), sau đó tự động chuyển đổi sang chữ viết hiển thị.

## Tại sao nên dùng Bộ chuyển đổi chữ viết?

Một số ngôn ngữ sử dụng nhiều hệ thống chữ viết cho cùng một ngôn ngữ nói:

- **Plains Cree**: SRO (Latin) để chỉnh sửa → Chữ âm tiết (Syllabics - ᓀᐦᐃᔭᐍᐏᐣ) để hiển thị
- **Serbian**: Chữ Latin để sử dụng quốc tế → Chữ Cyrillic để sử dụng trong nước
- **Klingon**: Chữ Latin hóa (Romanization) để gõ → pIqaD (  ) để hiển thị

Việc dịch trực tiếp sang các chữ viết không phải Latin gây ra nhiều vấn đề: LLM bị ảo giác ký tự, các tệp JSON trở nên khó quản lý phiên bản (version-control), và các công cụ so sánh (diff) không thể so sánh các thay đổi. Các bộ chuyển đổi chữ viết giải quyết vấn đề này bằng cách giữ các bản dịch ở dạng chữ viết thân thiện với hệ thống quản lý phiên bản và chuyển đổi một cách xác định tại thời điểm đồng bộ hóa (sync).

## Các bộ chuyển đổi hiện có

Champollion đi kèm với năm bộ chuyển đổi chữ viết tích hợp sẵn:

| Locale | Từ | Sang | Loại | Yêu cầu Font? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Chữ âm tiết Cree (Cree Syllabics) | Xác định (Deterministic) | Không — Unicode gốc |
| `sr` | Latin | Cyrillic | Xác định (Deterministic) | Không — Unicode gốc |
| `tlh` | Latin hóa (Romanization) | pIqaD | Xác định (Deterministic) | Có — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Chế độ Beleriand) | Xác định (Deterministic) | Có — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Mã hóa dựa trên font (Font-based cipher) | Có — PUA U+E100–E119 |

### Xác định (Deterministic) so với Dựa trên Font (Font-Based)

- **Các bộ chuyển đổi xác định** (Cree, Serbian, Klingon, Tengwar) thực hiện ánh xạ ký tự-sang-ký tự thực tế bằng cách sử dụng các quy tắc ngôn ngữ. Đầu ra chứa các ký tự Unicode thực tế.
- **Các bộ chuyển đổi dựa trên font** (Kryptonian) là các phép mã hóa thay thế 1:1, trong đó đầu ra là các ký tự Unicode PUA chỉ hiển thị chính xác khi một font chữ cụ thể được tải.

## Cách thức hoạt động

Các bộ chuyển đổi chữ viết chạy **sau** khi dịch như một bước hậu xử lý. Quy trình (pipeline) là:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Ví dụ, đối với Plains Cree:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### Khớp tham lam từ trái sang phải (Greedy Left-to-Right Matching)

Tất cả các bộ chuyển đổi đều sử dụng cùng một thuật toán: tại mỗi vị trí ký tự, thử khớp chuỗi dài nhất có thể trước, sau đó giảm dần độ dài. Các ký tự không khớp với bất kỳ mẫu nào (khoảng trắng, dấu câu, chữ số) sẽ được giữ nguyên.

Cách này xử lý chính xác các chữ ghép đôi (digraph) và ghép ba (trigraph):
- Klingon: `tlh` → một ký tự pIqaD duy nhất (không phải `t` + `l` + `h`)
- Serbian: `nj` → `њ` (không phải `н` + `ј`)
- Cree: `twê` → một chữ âm tiết duy nhất (không phải `t` + `w` + `ê`)

## Sử dụng Bộ chuyển đổi chữ viết

Việc chuyển đổi là một **quyết định cấu hình, không bao giờ tự động** (kể từ phiên bản 0.3.0 — các phiên bản trước đó chuyển đổi vô điều kiện, dẫn đến việc xuất văn bản PUA không thể hiển thị cho các dự án mà phông chữ của chúng yêu cầu chuyển tự Latinh):

- **crk và sr có hai hệ thống chính tả thực sự** (SRO/Syllabics, Latin/Cyrillic). Không có mặc định: `champollion init` sẽ hỏi bạn muốn viết bằng hệ thống nào, và `sync` từ chối chạy cho đến khi cấu hình được xác định. Champollion không tự ý chọn hệ thống chữ viết của một cộng đồng.
- **tlh, x-elvish-s và x-kryptonian mặc định là chuyển tự Latinh (romanization)** — hệ thống chữ viết hiển thị của chúng thuộc Khu vực Sử dụng Riêng (Private Use Area - PUA), không thể hiển thị nếu không có phông chữ đặc biệt. Bạn phải chủ động bật tính năng này.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Khi champollion đồng bộ hóa `en:crk` với `"script": "Cans"`, các bản dịch được tạo ra bằng SRO (hệ thống chữ viết làm việc mà cổng kiểm tra xác thực), sau đó được chuyển đổi sang Syllabics trước khi ghi vào `crk.json`. Với `"script": "Latn"` — hoặc đối với tlh hoàn toàn không có `script:` — hệ thống chữ viết làm việc chính là sản phẩm đầu ra và không có gì bị chuyển đổi.

Các chữ cái mà bộ chuyển đổi không thể ánh xạ (tiếng Klingon không có `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — vì vậy "GitHub" không thể chuyển đổi hoàn toàn) sẽ giữ nguyên **toàn bộ giá trị** trong hệ thống chữ viết làm việc thay vì trộn lẫn các hệ thống chữ viết, kèm theo một cảnh báo liệt kê các chữ cái đó. Hãy khai báo các quy tắc chuyển tự của riêng bạn bằng [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Để hoàn tác quá trình chuyển đổi đã xảy ra khi nó còn là vô điều kiện, hãy chạy [`champollion repair-script`](/docs/getting-started/configuration#repair-script); `champollion integrity` sẽ báo lỗi nếu tìm thấy PUA ở nơi tính năng chuyển đổi bị tắt.

### Kiểm tra trạng thái bộ chuyển đổi

```bash
npx champollion status
```

Đầu ra trạng thái hiển thị quyết định hệ thống chữ viết đã được giải quyết của từng cặp — những gì sẽ được ghi lại, và liệu một bộ chuyển đổi có sẵn sàng nhưng chưa được bật hay không.

## Yêu cầu về Web Font

Ba bộ chuyển đổi cho ra các ký tự thuộc Vùng sử dụng riêng (Private Use Area - PUA) của Unicode, yêu cầu phải có web font tùy chỉnh:

### Klingon (pIqaD)

Cài đặt một font pIqaD tương thích với CSUR (ví dụ: "pIqaD qolqoS" hoặc "Klingon pIqaD HaSta"):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

Cài đặt một font Tengwar tương thích với CSUR (ví dụ: "Tengwar Formal CSUR", "Tengwar Annatar"):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

Cài đặt một font Kryptonian được ánh xạ tới các điểm mã (codepoint) PUA U+E100–E119:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Cách tiếp cận thay thế cho Kryptonian]
Vì Kryptonian là một mật mã chữ cái A-Z thuần túy, bạn có thể bỏ qua hoàn toàn bộ chuyển đổi chữ viết và áp dụng phông chữ cho văn bản Latin thông qua CSS. Cách này thường đơn giản hơn cho việc triển khai web — chỉ cần cung cấp phông chữ Kryptonian và thiết lập `font-family` trên các phần tử liên quan.
:::

## Thêm bộ chuyển đổi tùy chỉnh

Để thêm bộ chuyển đổi cho một ngôn ngữ mới, hãy chỉnh sửa `lib/scripts.js`:

1. **Tạo bản đồ chuyển đổi (conversion map)** — một mảng có thứ tự gồm các cặp `[from, to]`, các chuỗi dài nhất được xếp trước
2. **Tạo hàm chuyển đổi (converter function)** — một trình quét tham lam từ trái sang phải (sử dụng `sroToSyllabics` làm mẫu)
3. **Đăng ký nó** trong đối tượng `SCRIPT_CONVERTERS` với mã locale làm khóa (key)
4. **Thêm trường `script`** vào mục đăng ký của ngôn ngữ trong `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## Xem thêm

- [Ngôn ngữ nhân tạo, Chữ viết & Chính tả](/docs/guides/conlangs-scripts-orthography) — Font PUA, Unicode, thêm bộ chuyển đổi mới
- [Cổng chất lượng (Quality Gate)](/docs/concepts/quality-gate) — bước xác thực chạy trước khi chuyển đổi chữ viết
- [Các ngôn ngữ được hỗ trợ](/docs/reference/supported-languages) — những ngôn ngữ nào có bộ chuyển đổi chữ viết
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — SRO→Syllabics trong ngữ cảnh
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — chuyển đổi chữ viết trong một quy trình nhiều giai đoạn
