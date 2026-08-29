---
sidebar_position: 4
title: "Đặc tả Thẻ Ngôn ngữ"
description: "Schema chuẩn cho các thẻ cấu hình theo từng ngôn ngữ của Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Đặc tả Thẻ Ngôn ngữ

> **Nguồn sự thật duy nhất (Single source of truth).** Tài liệu này định nghĩa cấu trúc chuẩn của mọi thẻ ngôn ngữ (language card). Một thẻ chỉ khẳng định những gì một nguồn được trích dẫn khẳng định: một trường không có nguồn nào khẳng định sẽ bị **bỏ qua, không phải là null** — một trường bị thiếu có nghĩa là "không có nguồn nào đề cập", chứ không bao giờ là "không có gì để biết". Lược đồ (schema) có thể kiểm tra bằng máy được phát hành dưới dạng `shared/schemas/language-card.schema.json` trong gói npm, và [ví dụ chuẩn dưới đây](#canonical-template) được tạo ra từ kho ngữ liệu (corpus) trực tiếp trong mỗi lần build trang web, do đó trang này không thể bị lệch so với các thẻ mà nó mô tả.

## Bản build lại atlas tháng 08-2026 — những gì đã thay đổi trong lược đồ này

Kho ngữ liệu thẻ hiện nay là **đầu ra của quá trình build (build output)**: mỗi thẻ được phóng chiếu (projected) từ một kho lưu trữ các bản snapshot upstream đã được ghim, và được build lại — không bao giờ được chỉnh sửa thủ công — khi một dữ kiện thay đổi. Có bốn điều về cấu trúc đã thay đổi cùng với bản build lại đó:

1. **Các trường có tranh chấp mang một envelope ghi nhận nguồn (attribution envelope).** Khi các nguồn được trích dẫn thực sự bất đồng, trường đó không phải là một giá trị phẳng (flat value) mà là `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment`, và bất kỳ trường nào mà một nguồn mới biến thành có tranh chấp. Người dùng (consumers) nên đọc các thẻ thông qua adapter đã được phát hành (`normalizeCard()` trong gói npm) thay vì giả định đó là các giá trị phẳng — `display()` phân giải một envelope thành giá trị đã được thống nhất của nó và cố tình không trả về gì khi có tranh chấp thực sự thay vì chọn ra một bên thắng cuộc.

2. **Các trường được đổi tên.** `endonym` đã thay thế `nativeName` · `codeAliases` đã thay thế `aliases` · `scripts[]` (tất cả các hệ thống chữ viết được chứng thực) đã thay thế trường phẳng `script`, với hệ thống chữ viết chính (primary script) được dẫn xuất từ thẻ BCP 47 tối đa của thẻ ngôn ngữ · `endangerment` (đánh giá của mọi nguồn, trên thang đo riêng của nguồn đó) đã thay thế đối tượng `vitality` duy nhất · `isoLanguageType` và `isoScope` hiện mang các từ ngữ riêng của ISO 639-3 ("Living", "Macrolanguage") thay vì các chữ viết tắt. Các trường mới: `modality` ("spoken"/"signed", được dẫn xuất từ phả hệ của Glottolog), `glottologBucket` (các nhóm phi phả hệ của Glottolog, được giữ ngoài vị trí family), `locale`/`localeScoped`.

3. **Các trường không được khẳng định sẽ bị bỏ qua, không phải là null.** Một trường không có nguồn nào khẳng định sẽ vắng mặt trên thẻ. Quy tắc trước đây ("mọi thẻ PHẢI chứa mọi trường cấp cao nhất, ngay cả khi null") đã bị loại bỏ: một giá trị trống trên bề mặt công khai được hiểu là một tuyên bố rằng không có gì để biết, điều này không giống với việc chưa từng tìm kiếm.

4. **Các thẻ locale (locale cards) đã tồn tại.** Bên cạnh các thẻ ngôn ngữ, các bản phóng chiếu locale (`fra-CA`, `cmn-Hant`) mang các dữ kiện của ngôn ngữ đó được phân giải cho một lãnh thổ hoặc hệ thống chữ viết, được xác định bởi một khối `locale: {language, region, script}`. Một locale không phải là một ngôn ngữ: hãy loại trừ các locale khỏi số lượng ngôn ngữ dựa vào khối đó.

## Nguyên tắc Thiết kế

1. **Ghi nguồn mọi thứ.** Mọi tuyên bố về dữ kiện đều được truy xuất về một nguồn chính, có tên và có phiên bản. Các tuyên bố không có nguồn gốc là các tuyên bố không thể xác minh. Bản đồ `_fieldSources` (và các chú thích `source` trên từng trường trong các đối tượng con) làm cho nguồn gốc (provenance) trở nên rõ ràng.

2. **Bảo tồn sự bất đồng.** Khi các tổ chức có thẩm quyền bất đồng (một nguồn nói 50.000 người nói, nguồn khác nói 20.000), thẻ sẽ lưu trữ *cả hai* kèm theo ghi nhận nguồn — cấu trúc envelope ở trên. Chúng tôi không tính trung bình, phân giải hay chọn phe. Người dùng có thể tự điều hướng qua các sắc thái này.

3. **Vắng mặt có nghĩa là không được khẳng định.** Một trường bị thiếu có nghĩa là không có nguồn nào khẳng định một giá trị. Khi một thuộc tính thực sự không áp dụng (ví dụ: giống ngữ pháp đối với một ngôn ngữ không có thuộc tính này), giá trị được trích dẫn sẽ nói rõ điều đó thay vì để trống.

4. **Được build lại, không bao giờ vá (patched).** Các thẻ được phóng chiếu từ các nguồn đã ghim bằng một quá trình build tất định (deterministic build). Một khiếm khuyết về dữ kiện sẽ được sửa tại trình xử lý nguồn (source handler) của nó và kho ngữ liệu được build lại — không có chỉnh sửa tại chỗ, không có lớp làm giàu dữ liệu (enrichment layer) chỉ dành cho việc merge.

---

## Kiến trúc Ba lớp

| Lớp | Vị trí | Mục đích |
|-------|----------|---------|
| **Thẻ ngôn ngữ** | `shared/language-cards/<code>.json` | Cấu hình cho từng ngôn ngữ: danh tính, phân loại, tài nguyên, và mọi thứ khác |
| **Thẻ chi (Genus cards)** | `shared/language-cards/genera/<genus>.json` | Các thuộc tính runtime dùng chung cho các ngôn ngữ có liên quan (được biên soạn thủ công, không tự động tạo) |
| **Cây ngôn ngữ** | `shared/language-cards/language-tree.json` | Hệ thống phân cấp Glottolog đầy đủ — dữ liệu tham chiếu cho Lab UI và khám phá ngôn ngữ |

---

## Mô hình Kế thừa

> **Chủ yếu mang tính lịch sử kể từ bản build lại atlas.** Không có thẻ ngôn ngữ nào trên đĩa còn mang `extends` nữa — mọi thẻ đều được vật chất hóa (materialized) hoàn toàn bởi quá trình build, bởi vì văn xuôi được kế thừa không thể trích dẫn được (một tuyên bố cấp độ ngữ hệ lại mang địa chỉ cấp độ ngôn ngữ). Bản thân cơ chế này chỉ còn tồn tại ở một nơi: gói offline của gói npm cung cấp các thẻ locale dưới dạng các delta `extends` nhỏ gọn so với ngôn ngữ của chúng, được phân giải bằng cùng một quá trình merge được mô tả ở đây.

Khi một thẻ thiết lập `"extends": "family-dravidian"`, runtime sẽ gộp thẻ
cha vào thẻ con bằng cách sử dụng `_deepMerge()` (trong `lib/registers.js`). Điều này cho phép
các thẻ chi định nghĩa các văn phong (register), hệ thống mức độ trang trọng (formality system) và hướng dẫn về giới tính dùng chung để
áp dụng xuống tất cả các ngôn ngữ thành viên — mà không cần sao chép dữ liệu trên hàng trăm
thẻ riêng lẻ.

### Ngữ nghĩa Gộp (Merge Semantics)

| Giá trị con | Hành vi | Lý do |
|-------------|----------|-----|
| `null` | Kế thừa từ cha | `null` nghĩa là "Tôi không định nghĩa trường này" — giá trị của cha sẽ được áp dụng |
| Khác null | Ghi đè cha | Dữ liệu của con cụ thể hơn — được ưu tiên |
| Đối tượng lồng nhau | Gộp đệ quy | Các trường của con sẽ ghi đè, các trường của cha được bảo toàn |
| Mảng | Thay thế hoàn toàn | Các mảng không gộp theo từng phần tử — mảng của con sẽ được chọn |

### Các trường Danh tính (Không bao giờ Kế thừa)

Một số trường thuộc về chính thẻ đó và KHÔNG BAO GIỜ được kế thừa từ thẻ cha:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Ngay cả khi thẻ cha định nghĩa `aliases: ["macro-code"]`, thẻ con cũng sẽ KHÔNG
kế thừa các bí danh (alias) đó. Các trường này luôn là giá trị riêng của thẻ con (bao gồm cả
`null` nếu chưa được thiết lập).

**Lý do:** Nếu không có quy tắc này, mọi ngôn ngữ Cree sẽ kế thừa `aliases: ["cre"]`
từ thẻ cha là vĩ ngôn ngữ (macrolanguage), khiến mọi biến thể đều trở thành bí danh của vĩ ngôn ngữ đó.

### Ví dụ: Cách một Thẻ Cree được Phân giải

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

Tại thời điểm runtime, `getLanguageCard("crk")` trả về một đối tượng đã gộp chứa các văn phong (register)
của genus-cree + các thuộc tính của family-algic (nếu có) + danh tính và siêu dữ liệu (metadata) riêng của crk.

### Biểu mẫu Thẻ Chi (Genus Card Template)

Các thẻ chi nằm trong `shared/language-cards/genera/` và định nghĩa các thuộc tính dùng chung
cho một nhóm ngôn ngữ. Chúng tuân theo cùng một schema như các thẻ thông thường nhưng có
các quy ước khác:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Quy tắc quan trọng:** Thẻ chi CHỈ được chứa dữ liệu thực sự được chia sẻ trên
toàn bộ nhóm và có nguồn gốc từ các tài liệu tham chiếu uy tín. Nếu hệ thống mức độ trang trọng
khác nhau giữa các thành viên, nó phải thuộc về các thẻ riêng lẻ chứ không phải thẻ chi.

## Ví dụ chuẩn \{#canonical-template}

> **Được tạo tự động, không phải viết tay.** Mọi thứ trong phần này được dẫn xuất từ kho ngữ liệu trực tiếp tại thời điểm build: toàn bộ thẻ `crk` (Plains Cree), chính xác đến từng byte, cộng với một đoạn trích locale `fra-CA`. Khi kho ngữ liệu được build lại, lần build trang web tiếp theo sẽ dẫn xuất lại trang này. Không còn template nào được bảo trì thủ công để có thể bị lỗi thời — template trước đó đã bị lệch cả một thế hệ lược đồ so với các thẻ và đã bị loại bỏ vào ngày 16-08-2026.

Ví dụ cho thấy **cấu trúc trên đĩa (on-disk shape)** — những gì bạn nhận được nếu mở file. Người dùng vẫn nên đọc các thẻ thông qua adapter đã được phát hành (`normalizeCard()` trong gói npm): nó phân giải các envelope, làm cầu nối cho các tên trước khi chuyển đổi (pre-cutover), và dẫn xuất các giá trị chỉ để hiển thị (hệ thống chữ viết chính, mức độ sức sống) mà thẻ thô cố tình không mang theo.

Những điều cần lưu ý khi đọc:

1. **Các envelope ghi nhận nguồn.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, và `politenessDistinction` mỗi trường đều mang `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` có `"agreement": "incommensurable"`: các nguồn của nó đánh giá trên các thang đo khác nhau, vì vậy mỗi giá trị gọi tên `scale` của nó thay vì được chuyển đổi sang thang đo của một bên thắng cuộc.

2. **Bị bỏ qua có nghĩa là không được khẳng định.** Thẻ không có `iso639_1` (Plains Cree không có mã ISO 639-1) và không có `phonologicalInventory` (không có nguồn được nạp nào khẳng định điều này) — các trường đó đơn giản là vắng mặt, không bao giờ là `null` hoặc `[]`.

3. **Nguồn gốc (Provenance) là một lớp hạng nhất (first-class layer).** `_fieldSources` ánh xạ mọi trường tới (các) nguồn đã khẳng định nó, với `champollion-derived-v1` đánh dấu các giá trị mà Champollion đã tính toán. `_card` đóng dấu loại thẻ, id, bản sửa đổi (revision), và những trường nào mà luồng sửa lỗi (correction lane) có thể chạm tới; `_atlas` đóng dấu bản phát hành kho ngữ liệu.

4. **Không có kết quả chạy (run results).** Không có gì trên thẻ là điểm số đo lường của đầu ra phương pháp — chrF, tỷ lệ chấp nhận FST, và những thứ tương tự là các kết quả chạy được khóa bằng (phương pháp, tập dữ liệu, số liệu) và nằm trên bảng xếp hạng (leaderboard). Thẻ chỉ khẳng định rằng các tài nguyên *tồn tại* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Thẻ locale là một bản phóng chiếu, không phải là một ngôn ngữ \{#locale-card-example}

Bên cạnh các thẻ ngôn ngữ là các thẻ locale (`fra-CA`, `cmn-Hant`): các dữ kiện của một ngôn ngữ **được phân giải cho một lãnh thổ hoặc hệ thống chữ viết**, được xác định bởi khối `locale` của chúng — không bao giờ bằng hình thức mã (code shape). Một thẻ locale kế thừa các dữ kiện của ngôn ngữ của nó, phân giải các dữ kiện trong phạm vi hệ thống chữ viết và lãnh thổ (`script`, `localeScoped`), và **không phải là một ngôn ngữ**: hãy loại trừ các thẻ locale khỏi mọi số đếm ngôn ngữ và danh sách theo từng ngôn ngữ dựa vào khối `locale` đó.

<CardSpecExample variant="locale" />

---

## Tham chiếu trường (Field Reference) \{#field-reference}

Có hai quy ước áp dụng cho mọi bảng dưới đây:

- **"envelope"** có nghĩa là một envelope ghi nhận nguồn — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` — mang tuyên bố của *mọi* nguồn. Một trường được liệt kê là `envelope` có thể xuất hiện dưới dạng một giá trị phẳng trên các thẻ mà chỉ có một nguồn lên tiếng (ví dụ: các languoid chỉ có trên Glottolog mang một `name` phẳng); người dùng phải xử lý cả hai, đó là những gì adapter đã phát hành thực hiện.
- Không có trường nào là bắt buộc ngoài `code` và `name`; mọi thứ khác đều bị **bỏ qua khi không có nguồn nào khẳng định nó**. (Các) nguồn khẳng định của mỗi trường được ghi lại trên từng thẻ trong `_fieldSources`, vì vậy các bảng mô tả *loại* nguồn thay vì ghim các phiên bản có thể bị lệch.

### § 1. Các trường Danh tính

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `code` | `string` | **Bắt buộc.** ID thẻ và tên file. ISO 639-3 đối với thẻ ngôn ngữ (`crk`); các languoid chỉ có trên Glottolog mang glottocode của chúng; thẻ locale mang mã locale (`fra-CA`). |
| `name` | envelope | **Bắt buộc.** Tên tham chiếu tiếng Anh (sổ đăng ký ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Đã thay thế `nativeName`. Tên mà người nói gọi ngôn ngữ đó, bằng chính ngôn ngữ đó (LinguaMeta, Wikidata). Vắng mặt khi không có nguồn nào khẳng định — một endonym (tên tự gọi) không bao giờ do chúng tôi bịa ra hoặc chuyển tự. |
| `alternateNames` | `string[]` | Các tên tiếng Anh được chứng thực khác. |
| `iso639_1` | `string` | Chỉ hiện diện khi tồn tại mã ISO 639-1 gồm hai chữ cái (`fra` → `"fr"`). |
| `isoScope` | `string` | Các từ ngữ riêng của ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (đã thay thế các chữ viết tắt `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Đã thay thế `isoType`. Các từ ngữ riêng của ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Macrolanguage mà ngôn ngữ này thuộc về (`crk` → `"cre"`). Các ánh xạ macrolanguage của ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Trên các thẻ trung tâm (hub cards) của macrolanguage: các mã thành viên riêng lẻ (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Trên các thẻ macrolanguage: các thành viên có thẻ (tag) được các sổ đăng ký BCP 47 gộp vào thẻ của macrolanguage này (bảng bí danh CLDR + langtags của SIL, mỗi cái đều được ghi nhận nguồn). |
| `supersededCodes` | `string[]` | Các mã ISO 639-3 đã ngừng sử dụng mà SIL hiện đang hướng tới ngôn ngữ này — được ghi lại trên ngôn ngữ kế thừa để các kho ngữ liệu được xuất bản dưới mã cũ vẫn có thể phân giải được. |
| `codeAliases` | `string[]` | Đã thay thế `aliases`. Các định danh cấp độ mã phân giải về thẻ này. |
| `bcp47` | `string` | Thẻ BCP 47 của ngôn ngữ như được khẳng định (LinguaMeta). |
| `bcp47Tag` | envelope | Được dẫn xuất bởi Champollion: thẻ RFC 5646 (mã ISO 639 ngắn nhất sẽ thắng). |
| `bcp47FullTag` | envelope | Dạng ngôn ngữ–chữ viết–khu vực tối đa (likelySubtags của CLDR + langtags của SIL). Adapter dẫn xuất **hệ thống chữ viết chính** từ thẻ này. |
| `modality` | `string` | `"spoken"` hoặc `"signed"`, được dẫn xuất từ phả hệ của Glottolog. Chữ viết là một thuộc tính chính tả, không phải là một phương thức (modality) — một ngôn ngữ không có chữ viết vẫn hoàn toàn là ngôn ngữ nói hoặc ngôn ngữ ký hiệu. |
| `locale` | `object` | **Chỉ dành cho thẻ locale.** `{language, region, script, publishedTag, source, note}` — danh tính locale ĐÓ. Loại trừ các thẻ locale khỏi số đếm ngôn ngữ bằng khối này, không bao giờ bằng hình thức mã. |
| `localeScoped` | `object` | Chỉ dành cho thẻ locale: các giá trị được phân giải cho lãnh thổ/hệ thống chữ viết của locale (ví dụ: `scriptName`, `cldrOfficialStatus`). |

### § 2. Các trường Phân loại

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `glottocode` | `string` | Định danh của Glottolog cho languoid này (`crk` → `"plai1258"`). Các languoid chỉ có trên Glottolog — các ngôn ngữ mà Glottolog ghi nhận nhưng ISO 639-3 thì không — sử dụng glottocode làm `code` của thẻ. |
| `classification` | `object` | Container cho các trường vị trí bên dưới. Mỗi trường được lấy nguồn độc lập và bị bỏ qua độc lập — một ngôn ngữ biệt lập (isolate), hoặc một ngôn ngữ được xếp vào một nhóm (bucket) của Glottolog, một cách hợp lệ chỉ mang một phần của đối tượng này. |
| `classification.family` | envelope | Ngữ hệ cấp cao nhất mà mỗi tổ chức phân loại khẳng định. Glottolog và WALS là các hệ thống phân loại riêng biệt không phải lúc nào cũng đồng nhất, vì vậy cả hai đều được giữ lại và ghi nhận nguồn. Quy tắc lint R5 kiểm tra giá trị Glottolog bên trong envelope so với cây riêng của Glottolog: WALS có thể không đồng ý với Glottolog, nhưng Glottolog không được phép bị trích dẫn sai. Các ngôn ngữ biệt lập hoàn toàn không mang ngữ hệ nào. |
| `classification.familyGlottocode` | `string` | Glottocode của ngữ hệ cấp cao nhất đó (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nút phân loại trung gian của WALS (`crk` → `"Algonquian"`). Một khái niệm của WALS, **không phải** của Glottolog — Glottolog xuất bản một cây có độ sâu tùy ý không có cấp độ chi (genus) — vì vậy nó chỉ hiện diện ở nơi WALS mã hóa ngôn ngữ đó. |
| `classification.ancestry` | `string[]` | Đường dẫn phả hệ của Glottolog dưới dạng các glottocode tổ tiên, gốc trước (`["algi1248", …, "plai1264"]`). Thứ tự **chính là** lời khẳng định: đây là một đường dẫn, không bao giờ là một tập hợp được sắp xếp theo bảng chữ cái. |
| `classification.glottologBucket` | `string` | Các nhóm phi phả hệ của Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Được giữ ngoài vị trí family vì một nhóm phân loại theo loại, không phải theo phả hệ: một thẻ có nhóm sẽ không có ngữ hệ, và đó là kết quả trung thực. |
| `isIsolate` | `boolean` | Liệu Glottolog có phân loại ngôn ngữ này là một ngôn ngữ biệt lập (isolate) hay không. |

Thẻ trước khi chuyển đổi cũng mang một `genusGlottocode`. Nó đã bị loại bỏ cùng với lỗi phân loại đã tạo ra nó: chi (genus) là khái niệm của WALS, và việc khoác cho nó một định danh Glottolog đã khẳng định một nút cây mà Glottolog không có. Thay vào đó, hệ thống phân cấp của Glottolog được mang bởi `ancestry`.

### § 3. Các trường Địa lý

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `macroarea` | `string` | Khu vực vĩ mô (macroarea) của Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` hoặc `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Điểm đại diện của Glottolog. Một điểm, không phải một lãnh thổ: nó đặt ngôn ngữ trên bản đồ và không khẳng định gì về phạm vi hay ranh giới. |
| `countries` | `string[]` | Mã ISO 3166-1 alpha-2 của các quốc gia mà Glottolog liên kết với ngôn ngữ (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Một trạng thái chính thức mà một số lãnh thổ cấp cho ngôn ngữ, như CLDR ghi nhận (được mang qua LinguaMeta) — `"Official"`, `"Regional official"`. Trên một thẻ locale, trạng thái được phân giải cho lãnh thổ của *locale đó* nằm trong `localeScoped.cldrOfficialStatus`. |

Mảng `regions` trước khi chuyển đổi (phân tích số lượng người nói theo từng quốc gia với mã hành chính) và `arealContext` (tư cách thành viên Sprachbund) đã bị loại bỏ: không có nguồn được nạp nào khẳng định chúng, và việc quản lý dữ liệu không có nguồn gốc sẽ không tồn tại sau một lần build lại. Các tuyên bố về người nói ở cấp độ khu vực có thể quay trở lại vào ngày một nguồn có thể trích dẫn được đưa vào pipeline; cho đến lúc đó, sự vắng mặt là trạng thái trung thực nhất.

### § 4. Các trường Hệ thống Chữ viết

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `scripts` | `string[]` | Đã thay thế trường phẳng `script`. **Tất cả** các mã ISO 15924 được chứng thực (`crk` → `["Cans", "Latn"]`), không theo thứ tự — không bao giờ đọc `scripts[0]` là hệ thống chữ viết "duy nhất". Hệ thống chữ viết chính được adapter dẫn xuất từ thẻ tối đa của `bcp47FullTag`. |
| `scriptNames` | `string[]` | Tên hiển thị do Champollion dẫn xuất cho `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Đã thay thế `dir`. Các từ ngữ riêng của nguồn — `"left-to-right"` / `"right-to-left"` (trước đây là `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script của CLDR: hệ thống chữ viết quá chuẩn mực đối với ngôn ngữ đến mức các thẻ BCP 47 bỏ qua nó (`fra` → `"Latn"`). |
| `script` | `string` | **Chỉ dành cho thẻ locale**: hệ thống chữ viết được phân giải theo locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Các thẻ ngôn ngữ không mang trường hệ thống chữ viết phẳng. |

Một ngôn ngữ không có chữ viết được chứng thực đơn giản là **không có trường `scripts`** — sự vắng mặt có nghĩa là không có nguồn nào khẳng định một hệ thống chữ viết, chứ không phải là một tuyên bố rằng ngôn ngữ đó "không có chữ viết". (Ngôn ngữ ký hiệu là nhóm lớn nhất như vậy: không có hệ thống ký hiệu nào được cộng đồng áp dụng làm tiêu chuẩn cho việc đọc viết hàng ngày.)

### § 5. Các trường Nhân khẩu học & Sức sống Ngôn ngữ

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `speakerEstimates` | envelope | Ước tính của mọi nguồn, được ghi nhận. Các giá trị có thể là số đếm chính xác hoặc chuỗi phạm vi riêng của nguồn (`"10000-99999"`), với các lưu ý của nguồn được mang nguyên văn trong `note`. `"agreement": "conflicting"` là phổ biến — việc hiển thị sự xung đột *chính là* sản phẩm; không có gì được tính trung bình hoặc được chọn. |
| `endangerment` | envelope | Đã thay thế đối tượng `vitality` duy nhất. Đánh giá của mọi nguồn **trên thang đo riêng của nguồn đó** — mỗi giá trị mang một trường `scale`, và `"agreement": "incommensurable"` là tiêu chuẩn vì các từ vựng của ELCat, Glottolog AES và LinguaMeta không phải là bản dịch của nhau. Adapter dẫn xuất một *mức độ sức sống (vitality tier)* hiển thị từ một nguồn được chỉ định duy nhất theo thứ tự thẩm quyền đã khai báo; mức độ đó chỉ để hiển thị — toàn bộ tập hợp được ghi nhận nguồn vẫn nằm trên thẻ. |

Một số lượng người nói *được hiển thị* ở bất kỳ đâu trong Champollion phải khớp với một trong các mục `speakerEstimates` được trích dẫn hoặc mang nguồn gốc `champollion-derived` rõ ràng — được thực thi bởi các quy tắc tính toàn vẹn của thẻ.

### § 5.5 Các trường Tài liệu hóa & Sự hiện diện Kỹ thuật số

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `documentation` | `object` | Đã thay thế `documentationDepth`. Bản ghi của Glottolog về mức độ ngôn ngữ được mô tả tốt như thế nào, theo thuật ngữ riêng của Glottolog. |
| `documentation.medLevel` | `string` | Cấp độ Mô tả Chi tiết nhất (Most Extensive Description) của Glottolog, nguyên văn — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Khóa thư mục của mô tả chi tiết nhất đó trong danh mục tham chiếu của Glottolog. |
| `documentation.firstDocumented` | `number` | Cột năm-tài-liệu-đầu-tiên riêng của Glottolog, nguyên văn — được chuyển đến đây từ trường cấp cao nhất trước khi chuyển đổi. Chỉ hiện diện trên vài trăm ngôn ngữ, và bản thân sự thưa thớt này cũng đáng để biết. |
| `documentation.lastDocumented` | `number` | Cột năm-tài-liệu-cuối-cùng riêng của Glottolog, nguyên văn — hiện diện trên khoảng một nghìn ngôn ngữ. |
| `wikipediaEdition` | `object` | Đã thay thế `digitalPresence`. `{site, url, name}` — một phiên bản Wikipedia mở tồn tại bằng ngôn ngữ này (`afr` → `af.wikipedia.org`). Chỉ là sự tồn tại, cố tình **không có số lượng bài viết**: một số phiên bản phần lớn do bot tạo ra, và một phiên bản khổng lồ không có nghĩa là "được ghi chép tốt hơn" so với một phiên bản nhỏ theo bất kỳ nghĩa nào mà một dịch giả có thể sử dụng. |
| `dialectCount` | `number` | Cột `child_dialect_count` riêng của Glottolog, nguyên văn — chỉ các phương ngữ con trực tiếp, không phải toàn bộ cây con. Đây là khẳng định của Glottolog, không phải số học của chúng tôi: một quy tắc trước đó đã đóng dấu nó là `champollion-derived` và khiến hàng nghìn thẻ nhận công cho số đếm của Glottolog. |

Phần còn lại của khối `digitalPresence` trước khi chuyển đổi (số giờ Common Voice, số câu Tatoeba) đã bị loại bỏ cho đến khi các nguồn đó được đưa vào pipeline — bản thân kho ngữ liệu Tatoeba đã xuất hiện ở nơi nó thuộc về, dưới dạng một kho ngữ liệu song song trong `resources.corpora` (§ 9).

### § 6. Các trường Mức độ trang trọng, Văn phong & Giới tính

Kho ngữ liệu được phóng chiếu mang chính xác một trường ở đây — dữ kiện được trích dẫn:

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `politenessDistinction` | envelope | Liệu ngôn ngữ có ngữ pháp hóa sự lịch sự trong các hình thức ngôi thứ hai hay không. Được ghi nhận nguồn qua Grambank GB415 (nhị phân: vắng mặt/hiện diện) và WALS 45A (bốn cấp độ: không phân biệt / nhị phân / nhiều / tránh đại từ). Đó là các thang đo khác nhau, vì vậy mỗi giá trị gọi tên `scale` của nó và envelope báo cáo chúng là **không thể so sánh được (incommensurable)** thay vì là một sự bất đồng. |

**Hệ thống register (ngữ vực) là cấu hình, không phải là một dữ kiện của thẻ.** Kho ngữ liệu trước khi chuyển đổi đã lưu trữ văn xuôi `formality` và các prompt `registers` trên gần một nghìn tám trăm thẻ mỗi loại — hầu hết đều được tạo ra từ cùng hai nguồn ở trên, sau đó được mang theo như thể nó là cấu hình được quản lý thủ công. Atlas giữ lại dữ kiện; các bề mặt cấu hình — `formality`, `registers`, `gender`, `codeSwitching` — vẫn là một phần của **lược đồ được quản lý của gói npm** (`language-card.schema.json`), nằm trên các thẻ trung tâm chi/ngữ hệ được quản lý, và tiếp cận CLI thông qua quá trình merge `extends` của hệ thống register được mô tả trong [Mô hình Kế thừa (Inheritance Model)](#inheritance-model). Chúng không phải là các trường atlas được phóng chiếu: không có thẻ nào trong kho ngữ liệu được phóng chiếu mang chúng, và quá trình build atlas sẽ không bao giờ ghi chúng. Hướng dẫn trong [Viết các Preset Register Tốt (Writing Good Register Presets)](#writing-good-register-presets) áp dụng cho luồng được quản lý đó.

### § 7. Các trường Hồ sơ Ngôn ngữ học

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `typologicalProfile` | `object` | Một khóa cho mỗi đặc điểm loại hình học được nạp, mỗi giá trị là mã hóa riêng của nguồn, mỗi khóa chỉ hiện diện ở nơi nguồn mã hóa ngôn ngữ này. Các giá trị boolean đến từ các đặc điểm của Grambank, các chuỗi danh mục từ các chương của WALS; sổ đăng ký quyết định gọi tên tham số upstream chính xác cho mọi khóa. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — các số đếm do Champollion tính toán trên một kho PHOIBLE được trích dẫn (PHOIBLE xuất bản một hàng cho mỗi âm vị và không khẳng định số đếm nào), vì vậy mọi giá trị đều mang nguồn gốc `champollion-derived`. **PHOIBLE là cơ quan thẩm quyền duy nhất về thanh điệu** (lint R1): Grambank không có đặc điểm thanh điệu, và không có gì khác trên thẻ được phép khẳng định tính thanh điệu. |
| `numeralSystem` | `object` | `{base}` — cơ số đếm, nguyên văn từ *Numeral Systems of the World's Languages* của Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; gần một trăm giá trị riêng biệt). Vắng mặt khi cột cơ số riêng của Chan trống — khoảng một nửa số ngôn ngữ được khảo sát — bởi vì một trình tạo trước đó đã điền vào chỗ trống bằng `"decimal"` và bịa ra các giá trị cho hai nghìn ngôn ngữ. |
| `pluralCategories` | `string[]` | Các danh mục số nhiều cơ bản mà CLDR nêu cho ngôn ngữ này — tiếng Ả Rập phân biệt `["zero", "one", "two", "few", "many", "other"]`, tiếng Pháp ba danh mục, tiếng Trung một. Được đọc từ các khóa của bộ quy tắc riêng của CLDR, vì vậy đó là khẳng định của CLDR, không phải là dẫn xuất của chúng tôi. Đã thay thế `rules.plurals.categories` trước khi chuyển đổi; một pipeline i18n cần nó để biết một thông báo phải cung cấp bao nhiêu hình thức số nhiều. |

Các khóa `typologicalProfile` hiện đang được phóng chiếu, cùng với các tham số upstream của chúng:

- **Các chương WALS** (chuỗi danh mục, nhãn giá trị riêng của WALS): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Các đặc điểm Grambank** (booleans): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

Các khối `linguisticChallenges` và `contactInfluences` trước khi chuyển đổi không được phóng chiếu — văn xuôi được nghiên cứu mà không có nguồn được nạp sẽ ở lại trên lược đồ được quản lý của gói npm, giống như các bề mặt register trong § 6 (các bảng [Các loại Ảnh hưởng Tiếp xúc (Contact Influence Types)](#contact-influence-types) bên dưới phục vụ luồng đó). Khối `rules` đã bị loại bỏ: những gì có thể trích dẫn trong đó vẫn tồn tại dưới dạng `pluralCategories` ở đây và các trường hệ thống chữ viết trong § 4.

### § 8. Các trường Bách khoa toàn thư

Đã bị loại bỏ khỏi các thẻ. Các khối `encyclopedic` (các bài luận về lịch sử và phương ngữ, các liên kết tổ chức), `culturalAphorism`, và `varieties` trước khi chuyển đổi là văn xuôi được quản lý thủ công ở cấp độ thẻ, mà quá trình build lại sẽ xóa theo thiết kế. Các dữ kiện về tư cách thành viên mà `varieties` hướng tới hiện là các trường danh tính được trích dẫn (§ 1 `macrolanguageMembers` và `canonicalisedMembers`), và phạm vi phủ sóng của công cụ theo từng biến thể được trả lời bởi thẻ riêng của mỗi thành viên (`methodSupport`, `resources`). Một câu nói tiêu biểu có thể quay trở lại thông qua luồng đóng góp của cộng đồng với sự đồng ý và trích dẫn; nó sẽ không quay trở lại dưới dạng một trường thẻ không được trích dẫn.

### § 9. Các trường Tài nguyên Kỹ thuật số

Mọi thứ trong phần này khẳng định **sự tồn tại và khả năng, không bao giờ là chất lượng**: rằng một tài nguyên được xuất bản và ai xuất bản nó — không bao giờ khẳng định rằng nó tốt, hoàn chỉnh hoặc có thể sử dụng được, và không bao giờ là một điểm số đo lường. Bất kỳ điểm số đo lường nào của đầu ra phương pháp đều là kết quả chạy được khóa bằng (phương pháp, tập dữ liệu, số liệu), nằm trên bảng xếp hạng, và bị cấm trên các thẻ (lint R3).

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `resources` | `object` | Container: mỗi trường con bên dưới là một danh sách được lấy nguồn độc lập, bị bỏ qua khi không có nguồn nào khẳng định nó. |
| `resources.fsts` | `object[]` | Các bộ phân tích hình thái học trạng thái hữu hạn (finite-state morphological analysers) đã xuất bản: `{name, url, publisher, license, licenceEstablished, archived}`. Giấy phép đi kèm với mỗi mục thay vì được giả định là đồng nhất trên toàn bộ danh mục — các ranh giới giấy phép cần các điều khoản thực tế. Đối với một ngôn ngữ đa tổng hợp (polysynthetic language), FST thường là công cụ kiểm tra cấu trúc duy nhất tồn tại. |
| `resources.corpora` | `object[]` | Các kho ngữ liệu song song chứng thực ngôn ngữ này: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Được nêu thông qua **các cặp**, bởi vì một kho ngữ liệu song song chỉ chứng thực một ngôn ngữ thông qua một cặp — "bao phủ tiếng Swahili" mà không nói rõ là so với cái gì sẽ trả lời một câu hỏi mà không ai hỏi. Sự tồn tại và kích thước, không bao giờ là chất lượng. |
| `resources.monolingualCorpora` | `object[]` | Các kho ngữ liệu đơn ngữ — được giữ tách biệt khỏi `corpora` để "có một kho ngữ liệu" không bao giờ có nghĩa là hai thứ không thể so sánh được. |
| `resources.speech` | `object[]` | Các tài nguyên giọng nói đã xuất bản. Chỉ là sự tồn tại. |
| `resources.keyboards` | `object[]` | Các bố cục bàn phím đã xuất bản. Đơn giản nhưng chịu tải trọng quan trọng: đối với một hệ thống chính tả cần các ký tự mà không có bố cục tiêu chuẩn nào tạo ra, một bố cục là sự khác biệt giữa việc ngôn ngữ đó có thể gõ được hay không. |
| `resources.typology` | `object[]` | Các tập dữ liệu loại hình học *mã hóa* ngôn ngữ này, với mức độ: `{dataset, featuresCoded, datasetFeatureTotal}`. Sự tồn tại và mức độ, không bao giờ là nội dung — những gì một đặc điểm nói sẽ không nằm trên thẻ cho đến khi một người viết bản đồ tham số chấp nhận nó (những đặc điểm được chấp nhận sẽ xuất hiện trong `typologicalProfile` của § 7). Các số đếm đặc điểm là số học của chúng tôi, vì vậy chúng mang nguồn gốc `champollion-derived`. |
| `lexicalResources` | `object` | Container cho các dữ kiện tồn tại từ vựng. |
| `lexicalResources.datasets` | `object[]` | Các danh sách từ vựng đã xuất bản với phạm vi phủ sóng của chúng: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Các từ điển đã xuất bản — sự tồn tại, không bao giờ là chất lượng, và **có hướng** theo nơi nhà xuất bản hướng chúng tới: một từ điển đi theo một chiều là một tài nguyên khác với một từ điển đi theo chiều ngược lại. Các mục không đồng nhất về cấu trúc (một tập dữ liệu CLDF biết số lượng mục của nó; một kho lưu trữ biết cặp và hướng của nó); mỗi mục gọi tên nguồn riêng của nó, và giấy phép cũng như trạng thái lưu trữ đi kèm theo từng mục. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Các số đếm do Champollion tính toán trên CLICS³: các khái niệm được chứng thực cho ngôn ngữ này, và các hình thức ánh xạ tới hai hoặc nhiều khái niệm riêng biệt. `champollion-derived`. |
| `methodSupport` | `object` | Các phương pháp dịch thuật nào bao phủ ngôn ngữ này — khả năng, không bao giờ là điểm số. Cấu trúc: `{total, byTier, named, truncated}`. Tiếng Anh mang hàng nghìn cạnh phương pháp và ngôn ngữ trung vị có vài chục, vì vậy thẻ giữ *cấu trúc* của bằng chứng — `total` cộng với các số đếm `byTier` theo từng mức độ tin cậy (`fetched`, `partially-confirmed`, `model-card-declared`) — và chỉ gọi tên các mục mạnh nhất (mỗi `{value, variant, source, confidence}`), có giới hạn. Các **dịch vụ** đăng ký luôn được gọi tên đầy đủ, vượt qua giới hạn, vì vậy sự vắng mặt của một dịch vụ khỏi `named` là một câu trả lời thực sự; sự vắng mặt của một mục thẻ mô hình chỉ có nghĩa là "không nằm trong số những mục mạnh nhất", và mọi cạnh vẫn có thể truy vấn được trong kho lưu trữ atlas. |
| `metricModelSupport` | envelope | Các mô hình số liệu đánh giá xuất bản phạm vi phủ sóng của ngôn ngữ này, với định danh mô hình mà một harness tải (`masakhane/africomet-mtl`). Thúc đẩy hành vi thực tế — lựa chọn mô hình COMET — và vẫn là khả năng, không bao giờ là điểm số. |

**Được gộp vào các trường ở trên:** `keyboardSupport` trước khi chuyển đổi (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`), và `databaseCoverage` (→ `resources.typology` cộng với `lexicalResources` — một mục cơ sở dữ liệu hiện là một dữ kiện phủ sóng được trích dẫn kèm theo mức độ, không phải là một boolean).

**Đã bị loại bỏ khỏi các thẻ:** `omt1600`, `evalDatasets`, `pipelineReadiness`, và `metricPlugins` — không có trường nào được khẳng định bởi một nguồn được nạp, và mức độ sẵn sàng (readiness tier) là một sự phán xét, không phải là một trích dẫn.

**Được quản lý, không được phóng chiếu:** các bề mặt khai báo tiêu chuẩn đánh giá (eval-standard) (`evalStandard`, `evalMetrics`, `evalPack`) ở lại trong lược đồ được quản lý của gói npm. Chúng cho evaluation harness biết gói trọng tài bên ngoài nào chấm điểm một ngôn ngữ (trọng tài, không phải thí sinh — lõi của harness không cung cấp mã chấm điểm dành riêng cho ngôn ngữ nào); harness đọc chúng từ một thẻ khi hiện diện, nhưng hiện tại không có thẻ nào trong kho ngữ liệu được phóng chiếu mang chúng, và quá trình build atlas không ghi chúng. Điều tương tự cũng áp dụng cho khối `install` mà trình cài đặt FST của harness đọc từ các mục `resources.fsts[]` (`get_fst_install_info()` trong `language_cards.py`): các mục được phóng chiếu chỉ mang các dữ kiện tồn tại.

### § 10. Các trường Nguồn gốc dữ liệu (Provenance)

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `_fieldSources` | `object` | Trên mọi thẻ. Ánh xạ mọi đường dẫn trường trên thẻ (`"classification.family"`, `"coordinates.lat"`) tới các id nguồn đã được sắp xếp đã khẳng định nó (`["glottolog-v5.3", "wals-v2020.5"]`). Các giá trị do Champollion tính toán mang `champollion-derived-v1`. Các id nguồn có phiên bản — `grambank-v1.0.3`, `iso639-3-20260715` — vì vậy mọi tuyên bố đều truy xuất về chính xác bản phát hành đã tạo ra nó. |
| `coverage` | `object` | Trên mọi thẻ, và **được tính toán bởi trình phóng chiếu (projector), không được khẳng định bởi bất kỳ nguồn nào**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — có bao nhiêu nguồn riêng biệt nói về ngôn ngữ này, có bao nhiêu thành phần thẻ mang một giá trị trong tổng số bao nhiêu thành phần tồn tại để được điền, và có bao nhiêu giá trị mà một nguồn đã ghi nhận một cách tích cực là *vắng mặt* (đã tìm kiếm và nói không — một dữ kiện khác với việc chưa từng tìm kiếm). Đây là điều cho phép một thẻ mỏng nói lên **lý do tại sao** nó mỏng thay vì trông như bị bỏ bê. |
| `_card` | `object` | Siêu dữ liệu riêng của thẻ: `{type, id, revision, correctableFields}`. `type` là `"language"` hoặc `"locale"` (các thẻ phương pháp và kho ngữ liệu chạy trên cùng một trình phóng chiếu); `revision` là một hàm băm nội dung (content hash), vì vậy bất kỳ thay đổi nào đối với nội dung của thẻ đều làm thay đổi nó; `correctableFields` liệt kê các đường dẫn trường mang giá trị — các trường mà luồng sửa lỗi có thể chạm tới. |
| `_atlas` | `object` | `{version}` — dấu bản phát hành kho ngữ liệu (`"unreleased"` giữa các bản phát hành). Cố tình là một id bản phát hành, **không phải** là một dấu thời gian build: một dấu thời gian sẽ làm cho hai bản build từ các ghim giống hệt nhau khác nhau theo lịch, phá hủy thuộc tính cho phép bất kỳ ai kiểm tra atlas — cùng các ghim đầu vào, cùng các byte đầu ra. |

Khối nguồn gốc trước khi chuyển đổi đã bị loại bỏ toàn bộ: `dataSources` (được thay thế bởi bản đồ `_fieldSources` trên từng trường), `supportTier` (một phán xét được tính toán, được thay thế bằng các số đếm `coverage` trung lập), `_generated` (toàn bộ kho ngữ liệu được tạo tự động; con dấu là `_card.revision` cộng với `_atlas.version`), `humanReviewed` và `notes` (việc quản lý thuộc về các luồng có bản ghi riêng của chúng), và `firstDocumented`/`lastDocumented` cấp cao nhất (được chuyển vào `documentation` trong § 5.5, nơi nguồn của chúng thực sự khẳng định chúng).

---

## Chính sách Mã Ngôn ngữ

Champollion sử dụng **ISO 639-3** làm mã định danh chuẩn. Các mã tiêu chuẩn khác
được đăng ký dưới dạng bí danh (alias) và sẽ được phân giải thành mã ISO 639-3 tại thời điểm runtime.

| Ưu tiên | Tiêu chuẩn | Ví dụ | Trường | Sử dụng |
|----------|----------|---------|-------|-----|
| 1 (chuẩn) | ISO 639-3 | `crk` | `code` | Tên file thẻ, khóa cấu hình, tham số API |
| 2 (bí danh) | ISO 639-1 | `iu` | `codeAliases[]` | Được chấp nhận trong CLI, phân giải thành ISO 639-3 |
| 3 (bí danh) | BCP 47 | `fil` | `codeAliases[]` | Được chấp nhận trong CLI, phân giải thành ISO 639-3 |
| Tham chiếu | Glottocode | `plai1258` | `glottocode` | Chỉ để phân loại, không dùng cho runtime |

**Thứ tự phân giải:** Khi người dùng cung cấp một mã:
1. Khớp trực tiếp trên `card.code` → tìm thấy
2. Khớp trên `card.codeAliases[]` → tìm thấy, trả về thẻ chuẩn
3. Khớp trên `card.iso639_1` → tìm thấy (dự phòng)
4. Không tìm thấy → lỗi

### Lịch sử Di chuyển: ISO 639-1 → ISO 639-3

Trước phiên bản v8, tên tệp thẻ sử dụng mã ISO 639-1 nếu có sẵn (`fr.json`,
`de.json`, `ja.json`). Trong quá trình di chuyển sang 639-3, tất cả các thẻ đã được đổi tên thành mã
ISO 639-3 tương đương:

| Trước | Sau | Lý do |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 là mã chuẩn |
| `de.json` | `deu.json` | 639-3 là mã chuẩn |
| `zh.json` | `cmn.json` | Vĩ ngôn ngữ → ngôn ngữ riêng lẻ mặc định |
| `ar.json` | `arb.json` | Vĩ ngôn ngữ → Tiếng Ả Rập Tiêu chuẩn Hiện đại |
| `ms.json` | `zsm.json` | Vĩ ngôn ngữ → Tiếng Mã Lai Tiêu chuẩn |

**Điều gì đã xảy ra với các mã cũ?**
- Mã 639-1 cũ nằm trong `card.iso639_1`
- Mã 639-1 cũ nằm trong `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` trả về `"fra"` tại runtime — tương thích ngược
- Người dùng vẫn có thể viết `"fr"` trong cấu hình của họ — nó phân giải một cách minh bạch

**Những thay đổi về mặt kiến trúc:**
- `_deepMerge()` giờ đây sẽ bỏ qua các giá trị `null` (kế thừa từ cha)
- `_deepMerge()` giờ đây đã được thiết lập trường danh tính (mã, phần mở rộng, bí danh không bao giờ được kế thừa)
- `formality.default` giờ đây được suy ra từ các cờ văn phong (register) `isDefault: true`
- 205 thẻ có nguồn gốc từ Grambank đã được sửa lỗi cấu trúc `formality.default`
- 38 thẻ chi/họ/vĩ ngôn ngữ cung cấp các mục tiêu kế thừa

---

## Các Trường hợp Đặc biệt

### Ngôn ngữ ký hiệu (Sign Languages)
Ngôn ngữ ký hiệu (ví dụ: ASE — Ngôn ngữ Ký hiệu Mỹ) là các ngôn ngữ hợp lệ có mã ISO 639-3. Chúng có địa lý và số lượng người nói nhưng:
- `modality` là `"signed"` — khẳng định tích cực của thẻ về việc ngôn ngữ đó *là* gì; sự vắng mặt của một hệ thống chữ viết là một dữ kiện riêng biệt
- `scripts` thường vắng mặt (không có hệ thống ký hiệu nào được cộng đồng áp dụng làm tiêu chuẩn), mặc dù `"Sgnw"` (SignWriting) xuất hiện ở nơi một nguồn khẳng định nó
- `textDirection` vắng mặt
- `linguisticChallenges` nên giải quyết ngữ pháp không gian, từ loại (classifiers), v.v.

### Ngôn ngữ Cổ đại & Lịch sử
Các ngôn ngữ như tiếng Latinh (`lat`, isoLanguageType `"Historical"`) và tiếng Phạn (`san`) vẫn được sử dụng trong các bối cảnh cụ thể (phụng vụ, học thuật) nhưng không có người bản ngữ:
- `isoLanguageType` mang từ trạng thái riêng của ISO (`"Ancient"`, `"Historical"`, `"Extinct"`) — thẻ không bao giờ làm nhẹ đi hoặc ghi đè nó
- `endangerment` và `speakerEstimates` báo cáo bất cứ điều gì mà các nguồn được trích dẫn thực sự đánh giá, giữ nguyên văn các lưu ý (số đếm cộng đồng L2 vẫn được dán nhãn như cách các nguồn của chúng dán nhãn)
- `firstDocumented` / `lastDocumented` định vị chúng trong thời gian

### Ngôn ngữ Nhân tạo (Constructed Languages)
Quốc tế ngữ Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, v.v.:
- `classification` có thể vắng mặt — Glottolog xếp các conlang (ngôn ngữ nhân tạo) vào một nhóm phi phả hệ, và nhóm này không bao giờ được hiển thị như một ngữ hệ
- `contactInfluences` phản ánh tài liệu nguồn (ví dụ: Esperanto dựa trên các ngôn ngữ Rôman, Giéc-man, Slav)
- `endangerment` là bất thường — cộng đồng người nói đang phát triển nhưng không có quê hương bản địa

### Macrolanguages
Tiếng Ả Rập (`ara`), tiếng Trung (`zho`), tiếng Cree (`cre`), tiếng Quechua (`que`) là các macrolanguage bao gồm nhiều ngôn ngữ riêng lẻ:
- `isoScope: "Macrolanguage"` — một trung tâm điều hướng, không bao giờ là mục tiêu benchmark
- `macrolanguageMembers` liệt kê các mã thành viên riêng lẻ; `canonicalisedMembers` ghi lại những thành viên nào mà các sổ đăng ký BCP 47 gộp vào thẻ của macrolanguage (mỗi sổ đăng ký đều được ghi nhận nguồn)
- `methodSupport` phản ánh những gì *thẻ macrolanguage* hỗ trợ (thường là biến thể được chuẩn hóa)
- Các thành viên riêng lẻ có thẻ riêng của chúng, mang `macrolanguage` quay trở lại trung tâm

### Ngôn ngữ Không có Chính tả Chuẩn hóa
Nhiều ngôn ngữ (đặc biệt là các ngôn ngữ truyền miệng) không có hệ thống chữ viết được chuẩn hóa, hoặc có các hệ thống chính tả cạnh tranh nhau:
- `scripts`, `scriptNames`, và `textDirection` vắng mặt — không có nguồn nào khẳng định một hệ thống chữ viết, điều này không giống với tuyên bố là "không có chữ viết"
- `notes` nên giải thích tình hình chính tả
- `linguisticChallenges` nên lưu ý điều này ảnh hưởng như thế nào đến MT (Dịch máy) (ví dụ: không có dữ liệu huấn luyện)

### Song ngữ phân cảnh (Diglossia)
Các ngôn ngữ như tiếng Ả Rập (tiếng Ả Rập chuẩn hiện đại - MSA so với các phương ngôn) hoặc tiếng Guaraní (Jopará so với tiếng Guaraní thuần túy):
- `codeSwitching` ghi nhận tình trạng biến thể hỗn hợp
- `registers` có thể cung cấp các thiết lập sẵn (preset) cho các cấp độ khác nhau
- `varieties` có thể liệt kê cặp song ngữ phân cảnh

---

## Các Loại hình Ảnh hưởng Tiếp xúc

| Loại hình | Ý nghĩa | Ví dụ |
|------|---------|---------|
| `superstrate` | Ngôn ngữ thống trị được áp đặt lên một cộng đồng | Tiếng Pháp → Tiếng Anh (sau năm 1066) |
| `substrate` | Ngôn ngữ bản địa ảnh hưởng đến ngôn ngữ bị áp đặt | Tiếng Celt → Tiếng Anh |
| `adstrate` | Ngôn ngữ lân cận có sự ảnh hưởng lẫn nhau | Tiếng Na Uy cổ → Tiếng Anh |
| `learned_borrowing` | Từ mượn thông qua giáo dục/học thuật | Tiếng Latinh → Tiếng Anh |
| `lexical_borrowing` | Từ vựng mượn trực tiếp thông qua tiếp xúc | Tiếng Tây Ban Nha → Tiếng Filipino |
| `relexification` | Thay thế toàn bộ từ vựng | Tiếng Bồ Đào Nha → Tiếng Papiamentu |

## Mức độ Sâu sắc của Ảnh hưởng Tiếp xúc

| Mức độ | Ý nghĩa |
|-------|---------|
| `light` | Một vài từ mượn, tác động cấu trúc tối thiểu |
| `moderate` | Lượng từ vựng đáng kể trong các lĩnh vực cụ thể |
| `heavy` | Từ vựng phổ biến và một số đặc điểm cấu trúc |
| `structural` | Ngữ pháp, cú pháp và âm vị học bị ảnh hưởng |
| `defining` | Bản sắc cốt lõi được hình thành bởi sự tiếp xúc (ngôn ngữ bồi/creole, ngôn ngữ hỗn hợp) |

---

## Cách Viết các Thiết lập sẵn Văn phong Tốt

**Các gợi ý thiết lập sẵn tốt:**
- Đặt tên rõ ràng cho đặc điểm trang trọng (ví dụ: "해요체", "vous-form", "siz-form")
- Giải thích đại từ hoặc dạng động từ cụ thể cần sử dụng
- Cung cấp bối cảnh khi nào văn phong này là phù hợp
- Đề cập đến các lưu ý về chữ viết nếu có

**Không** đưa hướng dẫn bao hàm giới tính (gender-inclusive) vào gợi ý thiết lập sẵn. Hướng dẫn về giới tính
thuộc về `card.gender.inclusiveGuidance` — nó được đưa vào một cách riêng biệt.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Quy ước Đặt tên Thiết lập sẵn

Các khóa thiết lập sẵn (preset key) nên mang tính mô tả và viết thường nối nhau bằng dấu gạch ngang:
- Các ngôn ngữ phân biệt T-V (thân mật - trang trọng): `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Các cấp độ kính ngữ (speech level): `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Trung tính: `professional`, `neutral-professional`
- Chuyển mã (code-switching): `taglish-professional`, `pure-filipino`

---

## Cách các Dữ kiện Thẻ được Cập nhật

Các thẻ là **đầu ra của quá trình build (build output)** — một bản phóng chiếu tất định từ các snapshot upstream đã được ghim. Không còn quy trình làm giàu dữ liệu trên từng thẻ nữa: luồng script `enrich-*` chạy thủ công đã bị loại bỏ, và một chỉnh sửa được thực hiện trực tiếp trên file thẻ sẽ bị xóa bởi lần build tiếp theo. Để thay đổi một dữ kiện:

1. **Đăng ký quyết định.** Mỗi trường là một hàng trong sổ đăng ký quyết định của quá trình build: tham số upstream nào cung cấp dữ liệu cho nó, nó phóng chiếu như thế nào, và một giá trị vắng mặt có ý nghĩa gì.
2. **Sửa lớp nạp dữ liệu (ingest layer).** Một giá trị sai là một khiếm khuyết trong trình xử lý nguồn (hoặc một ghim upstream đã cũ), không bao giờ là thứ để vá trên thẻ.
3. **Build lại và chuyển đổi (cut over).** Quá trình build phóng chiếu lại mọi thẻ từ các snapshot đã ghim; các cổng (gates) từ chối các bản build một phần, các giá trị null/trống, và các thẻ không vượt qua các quy tắc tính toàn vẹn.

### Xử lý Xung đột

Khi các nguồn bất đồng:
1. **Lưu trữ tất cả chúng** kèm theo ghi nhận nguồn — đó là mục đích của envelope ghi nhận nguồn
2. **KHÔNG tính trung bình** hoặc chọn phe — `consensus` chỉ xuất hiện khi các nguồn thực sự đồng ý
3. **Mang theo các lưu ý của mỗi nguồn** nguyên văn trong `note` của giá trị đó
4. Một giá trị duy nhất để hiển thị hoặc tính toán được **dẫn xuất bởi adapter** từ thứ tự thẩm quyền đã khai báo — bản thân thẻ giữ lại toàn bộ sự phân tán

---

## Xác thực

Chạy linter sau bất kỳ lần build lại nào:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Danh sách Kiểm tra PR

Khi gửi một thay đổi chạm đến các thẻ (hãy nhớ: thay đổi quá trình build, không phải thẻ):

- [ ] Bản sửa lỗi nằm trong một trình xử lý nạp dữ liệu (ingest handler) hoặc sổ đăng ký quyết định — không có file thẻ nào được chỉnh sửa thủ công
- [ ] Các trường chỉ mang các giá trị được nguồn khẳng định — không có gì được đệm thêm thành `null` hoặc `[]` để "hoàn thiện" một thẻ
- [ ] `classification` đến từ Glottolog (không phải được xây dựng thủ công)
- [ ] Nguồn gốc của mọi trường được chạm tới sẽ nằm trong `_fieldSources`, với các giá trị do Champollion tính toán mang nguồn gốc `champollion-derived`
- [ ] Không có điểm số đo lường nào của đầu ra phương pháp xuất hiện ở bất kỳ đâu trên thẻ
- [ ] Linter và cổng tính toàn vẹn của thẻ (card-integrity gate) vượt qua mà không có lỗi

---

## Tài liệu Tham chiếu Chuyên ngành

| Tiêu chuẩn | Được duy trì bởi | Cách dùng của chúng tôi |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Mã ngôn ngữ chuẩn, mối quan hệ vĩ ngôn ngữ |
| [Glottolog](https://glottolog.org) | Viện Max Planck | Phân loại, tọa độ, mức độ nguy cấp AES |
| [WALS](https://wals.info) | Viện Max Planck | Định nghĩa chi (genus), đặc điểm loại hình học |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Mã chữ viết (script code) |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Dữ liệu locale, quy tắc số nhiều, trình bày văn bản |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Số lượng người nói, tên tự gọi (endonym), dữ liệu chữ viết |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, ước tính người nói, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Phân loại mức độ nguy cấp |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Bản tóm tắt ngôn ngữ Philippines |

Xem thêm: [Quy trình Trích dẫn Thẻ Ngôn ngữ](/docs/reference/language-card-citation-procedure)
để biết hướng dẫn chi tiết cho từng nguồn.
