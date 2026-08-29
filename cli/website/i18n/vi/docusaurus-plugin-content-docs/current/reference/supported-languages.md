---
sidebar_position: 4
title: "Ngôn ngữ được hỗ trợ"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Các ngôn ngữ được hỗ trợ

champollion đi kèm với các **Language Card** (Thẻ ngôn ngữ) — các tệp cấu hình có cấu trúc dành cho 50 ngôn ngữ. Mỗi thẻ chứa các thiết lập trước về văn phong (register preset), siêu dữ liệu hệ thống mức độ trang trọng (formality), cờ hỗ trợ phương thức dịch, quy tắc trình bày văn bản (typography) và thông tin về hệ chữ viết (script). Bất kỳ ngôn ngữ nào mà LLM của bạn biết đều có thể được thêm vào chỉ với một dòng cấu hình duy nhất — đây là những ngôn ngữ đã có sẵn các văn phong được tinh chỉnh và sẵn sàng cho môi trường production.

---

## Các phương thức dịch

Mỗi ngôn ngữ có thể sử dụng một hoặc nhiều phương thức dịch sau:

| Biểu tượng | Phương thức | Cách hoạt động | Chi phí |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Nền tảng dịch máy nơ-ron. 194 ngôn ngữ. Chỉ hỗ trợ chuỗi key-value — không thể dịch nội dung Markdown một cách an toàn. | ~$20/1 triệu ký tự |
| 🔵 | **LLM (OpenRouter)** | Bất kỳ ngôn ngữ nào mà mô hình biết. Các prompt được điều hướng theo ngữ vực. Xử lý cả chuỗi key-value và nội dung Markdown. | Tùy thuộc vào mô hình |
| 🟣 | **LLM-Coached** | LLM + từ điển ngữ pháp + dữ liệu huấn luyện được đưa vào prompt. Tốt nhất cho các ngôn ngữ có hình thái phức tạp. | Tùy thuộc vào mô hình |
| 🟠 | **API (Plugin)** | Các pipeline dịch thuật do cộng đồng lưu trữ được phục vụ qua HTTP. [Hướng tới chủ quyền dữ liệu](/docs/network/community/low-resource-languages). | Tùy thuộc vào nhà cung cấp |

Thiết lập `GOOGLE_TRANSLATE_API_KEY` cho Google Translate, hoặc `OPENROUTER_API_KEY` cho các phương thức LLM. Xem [Các phương thức dịch](/docs/guides/translation-methods) để biết thêm chi tiết.

---

## Các ngôn ngữ ưu tiên

Đây là các locale được yêu cầu phổ biến nhất cho các ứng dụng web và di động, được liệt kê theo thứ tự ưu tiên khả năng tiếp cận do champollion khuyến nghị.

| Quốc kỳ | Ngôn ngữ | Mã | Google | LLM | Coached | Hệ chữ viết | Ghi chú |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Tiếng Ả Rập | `ar` | ✅ | ✅ | ✅ | — | RTL (Phải sang trái). Tiếng Ả Rập chuẩn hiện đại (فصحى). |
| 🇵🇭 | Tiếng Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Sử dụng `fil` trong cấu hình Docusaurus. champollion tự động phân giải cả hai. |
| 🇫🇷 | Tiếng Pháp | `fr` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (Vous). Bao hàm giới tính (Connecté·e). |
| 🇪🇸 | Tiếng Tây Ban Nha | `es` | ✅ | ✅ | ✅ | — | Tiếng Tây Ban Nha Mỹ Latinh trung tính. |
| 🇩🇪 | Tiếng Đức | `de` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (Sie). Bao hàm giới tính (Benutzer:innen). |
| 🇯🇵 | Tiếng Nhật | `ja` | ✅ | ✅ | ✅ | — | Thể lịch sự です/ます cho văn bản nội dung, thể từ điển する cho nhãn giao diện (UI). |
| 🇨🇳 | Tiếng Trung (Giản thể) | `zh` | ✅ | ✅ | ✅ | — | 简体中文 (Trung văn Giản thể). |
| 🇮🇹 | Tiếng Ý | `it` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (Lei). |
| 🇧🇷 | Tiếng Bồ Đào Nha (Brazil) | `pt` | ✅ | ✅ | ✅ | — | Tiếng Bồ Đào Nha Brazil. |
| 🇰🇷 | Tiếng Hàn | `ko` | ✅ | ✅ | ✅ | — | Văn phong lịch sự kính ngữ 해요체. |

## Các ngôn ngữ lớn trên thế giới

| Quốc kỳ | Ngôn ngữ | Mã | Google | LLM | Coached | Hệ chữ viết | Ghi chú |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Tiếng Bengal | `bn` | ✅ | ✅ | ✅ | — | Ưu tiên ngôn ngữ chuẩn (শুদ্ধ ভাষা). |
| 🇧🇬 | Tiếng Bulgaria | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Tiếng Séc | `cs` | ✅ | ✅ | ✅ | — | Ngôi trang trọng Vykání (thể vy). |
| 🇩🇰 | Tiếng Đan Mạch | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Tiếng Hy Lạp | `el` | ✅ | ✅ | ✅ | — | Tiếng Hy Lạp hiện đại (Δημοτική). |
| 🇮🇷 | Tiếng Ba Tư | `fa` | ✅ | ✅ | ✅ | — | RTL (Phải sang trái). |
| 🇫🇮 | Tiếng Phần Lan | `fi` | ✅ | ✅ | ✅ | — | Không có giống ngữ pháp. |
| 🇮🇱 | Tiếng Do Thái | `he` | ✅ | ✅ | ✅ | — | RTL (Phải sang trái). |
| 🇮🇳 | Tiếng Hindi | `hi` | ✅ | ✅ | ✅ | — | Tiếng Hindi chuẩn (शुद्ध हिन्दी). Hạn chế tối đa từ mượn tiếng Anh. |
| 🇭🇺 | Tiếng Hungary | `hu` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể Ön). |
| 🇮🇩 | Tiếng Indonesia | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Tiếng Mã Lai | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Tiếng Hà Lan | `nl` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể U). |
| 🇳🇴 | Tiếng Na Uy | `nb` | ✅ | ✅ | ✅ | — | Tiếng Na Uy Bokmål. |
| 🇵🇱 | Tiếng Ba Lan | `pl` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể Pan/Pani). |
| 🇵🇹 | Tiếng Bồ Đào Nha (Châu Âu) | `pt-PT` | ✅ | ✅ | ✅ | — | Tiếng Bồ Đào Nha Châu Âu. |
| 🇷🇴 | Tiếng Romania | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Tiếng Nga | `ru` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể Вы). |
| 🇸🇰 | Tiếng Slovak | `sk` | ✅ | ✅ | ✅ | — | Ngôi trang trọng Vykanie (thể vy). |
| 🇷🇸 | Tiếng Serbia | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cyrillic | Bộ chuyển đổi hệ chữ viết đơn trị (deterministic). |
| 🇸🇪 | Tiếng Thụy Điển | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Tiếng Swahili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Tiếng Thái | `th` | ✅ | ✅ | ✅ | — | Các từ đệm lịch sự ครับ/ค่ะ. |
| 🇹🇷 | Tiếng Thổ Nhĩ Kỳ | `tr` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể Siz). |
| 🇺🇦 | Tiếng Ukraine | `uk` | ✅ | ✅ | ✅ | — | Ngôi trang trọng (thể Ви). |
| 🇵🇰 | Tiếng Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL (Phải sang trái). Ngôi trang trọng (thể آپ). |
| 🇻🇳 | Tiếng Việt | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Tiếng Trung (Phồn thể) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文 (Trung văn Phồn thể). |
| 🇬🇪 | Tiếng Gruzia | `ka` | ✅ | ✅ | — | — | ქართული. Ngữ hệ Nam Kavkaz (Kartvelian). |
| 🇳🇬 | Tiếng Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Ngôn ngữ thanh điệu (3 thanh). |

## Các biến thể khu vực

| Quốc kỳ | Ngôn ngữ | Mã | Google | LLM | Coached | Hệ chữ viết | Ghi chú |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Tiếng Tây Ban Nha Mexico | `es-MX` | ✅ | ✅ | ✅ | — | Ngôi thân mật (thể Tú). Văn phong ấm áp. |
| 🇨🇦 | Tiếng Pháp Canada | `fr-CA` | ✅ | ✅ | ✅ | — | Thành ngữ vùng Québec (Québécois). |

---

## Ngôn ngữ bản địa & Ngôn ngữ ít tài nguyên

Các ngôn ngữ này không được hỗ trợ bởi các dịch vụ dịch máy thương mại. champollion cung cấp công cụ để các cộng đồng ngôn ngữ tự xây dựng phương thức của riêng họ theo [các nguyên tắc chủ quyền dữ liệu](/docs/network/community/low-resource-languages).

| | Ngôn ngữ | Mã | Google | LLM | Coached | Hệ chữ viết | Trạng thái |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Tiếng Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabics | 🚧 Đang phát triển |
| 🌄 | Tiếng Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Hậu tố chỉ nguồn chứng cứ (evidential suffixes). |

:::info[Plains Cree đang được tích cực phát triển]
Ngữ vực, cơ sở hạ tầng huấn luyện, bộ chuyển đổi chữ viết và bộ công cụ đánh giá cho tiếng Plains Cree đều đã hoạt động, nhưng pipeline dịch thuật **vẫn chưa được phát hành**. Chúng tôi đang làm việc với các cộng đồng ngôn ngữ theo [các nguyên tắc chủ quyền dữ liệu](/docs/network/community/low-resource-languages) để đảm bảo chất lượng trước khi phát hành. Xem [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) để biết toàn bộ câu chuyện — và cách bạn có thể đóng góp.
:::

:::tip[Thêm các ngôn ngữ ít tài nguyên khác]
Hệ thống plugin phương thức của Champollion được thiết kế cho việc này. Một cộng đồng ngôn ngữ có thể xây dựng một phương thức dịch thuật tùy chỉnh, tự lưu trữ và kiểm soát nó, rồi cung cấp qua [phương thức API](/docs/guides/serving-a-method). [Bảng xếp hạng Phương thức](/leaderboard) theo dõi điểm số cho bất kỳ cặp ngôn ngữ nào — hãy xây dựng một phương thức, chạy khung đánh giá và giành điểm số cao nhất.
:::

---

## Ngôn ngữ nhân tạo

Các ngôn ngữ nhân tạo (conlang) được hỗ trợ thông qua văn phong LLM và các bộ chuyển đổi hệ chữ viết tùy chọn. Chúng sử dụng cùng một cơ sở hạ tầng như các ngôn ngữ thực tế — quy trình kiểm soát chất lượng (quality gate), hệ thống huấn luyện (coaching) và quy trình chuyển đổi hệ chữ viết hoạt động hoàn toàn giống nhau.

| | Ngôn ngữ | Mã | Google | LLM | Hệ chữ viết | Ghi chú |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Tiếng Klingon | `tlh` | ❌ | ✅ | 🔤 Romanization→pIqaD | Yêu cầu font PUA. Từ vựng của Marc Okrand. |
| 🧝 | Tiếng Sindarin (Tiếng Elves của Tolkien) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | Yêu cầu font CSUR PUA. |
| 🏴‍☠️ | Tiếng Anh cướp biển | `x-pirate` | ❌ | ✅ | — | Chỉ hỗ trợ văn phong. Sử dụng các ẩn dụ hàng hải. |
| 🦸 | Tiếng Krypton | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptonian | Yêu cầu font PUA. |
| 🎭 | Tiếng Anh thời Shakespeare | `x-shakespeare` | ❌ | ✅ | — | Chỉ hỗ trợ văn phong. Sử dụng các đại từ thee/thou, hậu tố -eth/-est. |
| 🐸 | Cách nói của Yoda | `x-yoda` | ❌ | ✅ | — | Chỉ hỗ trợ văn phong. Trật tự từ OSV (Tân ngữ - Chủ ngữ - Động từ). |

Xem [Ngôn ngữ nhân tạo, Hệ chữ viết & Chính tả](/docs/guides/conlangs-scripts-orthography) để biết các yêu cầu về font PUA, giới hạn Unicode và cách thêm ngôn ngữ của riêng bạn.

---

## Các thiết lập sẵn ngôn ngữ (Language Presets)

Trình hướng dẫn `init` hỗ trợ các tên preset để thiết lập nhanh. Bạn có thể kết hợp các preset với các mã ngôn ngữ riêng lẻ.

| Preset | Chuyển đổi thành |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Thêm bất kỳ ngôn ngữ nào

champollion có thể dịch sang **bất kỳ ngôn ngữ nào mà LLM của bạn biết** — bảng trên chỉ liệt kê các ngôn ngữ có sẵn các thiết lập trước về văn phong (register preset). Để thêm một ngôn ngữ không có trong danh sách, hãy đưa mã BCP-47 của ngôn ngữ đó vào cấu hình của bạn:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

LLM sẽ dịch bằng cách sử dụng kiến thức đã được huấn luyện về ngôn ngữ đó. Việc thiết lập một `register` giúp bạn kiểm soát tông giọng, mức độ trang trọng và các quy ước chính tả. Xem [Cấu hình](/docs/getting-started/configuration) để biết thêm chi tiết.

---

## Language Cards {#language-cards}

Mỗi ngôn ngữ tích hợp sẵn đều có một **Language Card** — một tệp JSON thống nhất trong `shared/language-cards/` chứa tất cả siêu dữ liệu: văn phong, mức độ trang trọng, hỗ trợ phương thức, quy tắc trình bày văn bản, phân loại phả hệ, các thách thức ngôn ngữ và tài nguyên NLP.

### Kiến trúc thẻ thống nhất

Mỗi thẻ được tải ngay lập tức (eagerly) khi import. Không có tầng tham chiếu riêng biệt — tất cả dữ liệu đều nằm trong một tệp duy nhất cho mỗi ngôn ngữ. Các thẻ được làm phong phú từ các nguồn uy tín:

| Nguồn | Dữ liệu |
|--------|------|
| [Glottolog](https://glottolog.org) | Phân loại ngữ hệ, chuỗi tổ tiên, Glottocode |
| [WALS](https://wals.info) | Phân loại chi (genus), các đặc điểm loại hình học |
| [CLDR](https://cldr.unicode.org) | Hệ chữ viết, hướng viết, quy tắc số nhiều, quy tắc trình bày văn bản |
| [ISO 15924](https://unicode.org/iso15924/) | Mã hệ chữ viết |

### Các trường chính trong thẻ

| Trường | Nội dung chứa |
|-------|------------------|
| **`nativeName`** | Tên tự gọi (Endonym) — tên của chính ngôn ngữ đó bằng hệ chữ viết riêng của nó (ví dụ: ქართული, Runasimi) |
| **`classification`** | Điểm neo phả hệ: ngữ hệ, chi, chuỗi tổ tiên đầy đủ từ Glottolog |
| **`contactInfluences`** | Lịch sử tiếp xúc ngôn ngữ chung — các lớp từ mượn, ngôn ngữ siêu tầng (superstrates), ngôn ngữ hạ tầng (substrates) |
| **Hệ thống mức độ trang trọng (Formality)** | Phân biệt T-V (thân mật/trang trọng), các cấp độ nói, kính ngữ (keigo), trợ từ, v.v. |
| **Thiết lập sẵn văn phong (Register presets)** | Các thiết lập sẵn prompt LLM có tên gọi cụ thể cho đặc trưng của ngôn ngữ đó |
| **Hỗ trợ phương thức (Method support)** | Các API dịch thuật nào hỗ trợ ngôn ngữ này |
| **Hướng dẫn về giới tính (Gender guidance)** | Các quy tắc giống ngữ pháp và mẹo viết văn bản bao hàm |
| **Hệ chữ viết/hướng viết (Script/direction)** | Mã hệ chữ viết ISO 15924 và hướng viết RTL/LTR |
| **Quy tắc (Rules)** | Quy tắc trình bày văn bản (dấu ngoặc kép, khoảng cách), viết hoa, các danh mục số nhiều |
| **`glottocode`** | Mã định danh Glottolog chuẩn để đối chiếu chéo |
| **`dataSources`** | Theo dõi nguồn gốc (ví dụ: `["glottolog-5.3", "cldr-48"]`) |

### Khởi tạo khung (Scaffolding) cho một Language Card mới

Sử dụng trình tạo để khởi tạo khung cho một thẻ từ các nguồn dữ liệu uy tín (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

Trình tạo sẽ tự động điền siêu dữ liệu (mã, hệ chữ viết, hướng viết, số nhiều, dấu ngoặc kép, hỗ trợ phương thức, phân loại) và đánh dấu các trường đánh giá ngôn ngữ là TODO để con người biên soạn.

### Sử dụng các Preset Key

Thay vì viết toàn bộ văn bản văn phong, bạn có thể sử dụng tên preset key:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion sẽ phân giải key đó thành prompt văn phong đầy đủ. Chạy `npx champollion init` để xem các preset có sẵn cho từng ngôn ngữ.

### Các Preset ví dụ

| Ngôn ngữ | Preset | Mặc định |
|----------|---------|--------|
| Tiếng Pháp | `formal-vous`, `casual-tu` | `formal-vous` |
| Tiếng Hàn | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Tiếng Nhật | `polite`, `formal-keigo`, `casual` | `polite` |
| Tiếng Đức | `formal-Sie`, `casual-du` | `formal-Sie` |
| Tiếng Thái | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Tiếng Tây Ban Nha | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Xem [Đóng góp một Language Card](https://github.com/gamedaysuits/champollion) để biết đặc tả đầy đủ, bao gồm xác thực trường dữ liệu và danh sách kiểm tra PR.

---

## Xem thêm

- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo cấu hình đầy đủ bao gồm thiết lập ngôn ngữ
- [Các phương thức dịch](/docs/guides/translation-methods) — cách hoạt động của từng phương thức
- [Bộ chuyển đổi hệ chữ viết](/docs/concepts/script-converters) — quy trình chuyển đổi hệ chữ viết đơn trị (deterministic)
- [Ngôn ngữ nhân tạo, Hệ chữ viết & Chính tả](/docs/guides/conlangs-scripts-orthography) — font PUA, Unicode, thêm ngôn ngữ nhân tạo
- [Hỗ trợ một ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — xây dựng các phương thức dịch cho các ngôn ngữ chưa được hỗ trợ đầy đủ

