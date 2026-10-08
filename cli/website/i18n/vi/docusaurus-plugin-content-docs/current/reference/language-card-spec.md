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

> **Nguồn chân lý duy nhất (Single source of truth).** Tài liệu này định nghĩa cấu trúc chuẩn của
> mỗi thẻ ngôn ngữ. Một thẻ chỉ khẳng định những gì một nguồn được trích dẫn khẳng định: một
> trường không có nguồn nào khẳng định sẽ **bị lược bỏ, chứ không phải null** — một trường còn thiếu có nghĩa là
> "không có nguồn nào nhắc đến", chứ không bao giờ có nghĩa là "không có gì để biết". Schema có thể
> kiểm tra bằng máy được phát hành dưới dạng `shared/schemas/language-card.schema.json` trong gói npm,
> và [ví dụ chuẩn bên dưới](#canonical-template) được tạo tự động từ kho dữ liệu
> trực tiếp trong mỗi lần build trang web, vì vậy trang này không thể bị sai lệch so với các thẻ mà nó mô tả.

## Đợt tái cấu trúc atlas 2026-08 — những gì đã thay đổi trong schema này

Kho thẻ hiện là **kết quả đầu ra của quá trình build (build output)**: mỗi thẻ được ánh xạ từ một kho
lưu trữ các bản snapshot thượng nguồn được ghim phiên bản, và được build lại — không bao giờ chỉnh sửa thủ công — khi một dữ kiện
thay đổi. Bốn điểm về cấu trúc đã thay đổi cùng đợt tái cấu trúc đó:

1. **Các trường còn tranh cãi mang một vỏ bao gán nguồn (attribution envelope).** Ở những nơi các nguồn trích dẫn
   thực sự bất đồng ý kiến, trường dữ liệu không phải là một giá trị phẳng đơn thuần mà là
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, và bất kỳ trường nào bị một nguồn mới đưa vào diện
   tranh cãi. Các bên tiêu thụ dữ liệu nên đọc thẻ qua bộ điều hợp (adapter) được công bố
   (`normalizeCard()` trong gói npm) thay vì giả định các giá trị phẳng —
   `display()` phân giải một envelope thành giá trị đã được đồng thuận và chủ động
   không trả về gì khi có tranh chấp thực sự thay vì tự ý chọn ra một bên thắng cuộc.

2. **Các trường được đổi tên.** `endonym` thay thế `nativeName` · `codeAliases`
   thay thế `aliases` · `scripts[]` (tất cả các hệ chữ viết đã được chứng thực) thay thế trường phẳng
   `script`, với hệ chữ viết chính được suy ra từ thẻ BCP 47
   cực đại của thẻ · `endangerment` (đánh giá của từng nguồn, theo thang đo
   riêng của nguồn đó) thay thế đối tượng `vitality` đơn lẻ · `isoLanguageType` và
   `isoScope` hiện mang chính xác nguyên văn của ISO 639-3 ("Living", "Macrolanguage")
   thay vì các chữ cái viết tắt. Các trường mới: `modality` ("spoken"/"signed", được suy ra
   từ phả hệ của Glottolog), `glottologBucket` (các nhóm phân loại phi phả hệ của Glottolog,
   tách riêng khỏi vị trí ngữ tộc/họ ngôn ngữ), `locale`/`localeScoped`.

3. **Các trường không được khẳng định sẽ bị lược bỏ, không phải là null.** Một trường không được nguồn nào khẳng định sẽ
   không xuất hiện trên thẻ. Quy tắc trước đây ("mỗi thẻ BẮT BUỘC phải chứa mọi
   trường cấp cao nhất, kể cả khi có giá trị null") đã bị bãi bỏ: một giá trị trống trên
   bề mặt công khai được hiểu như một khẳng định rằng không có gì để biết,
   điều này không tương đương với việc chưa tìm kiếm thông tin.

4. **Sự tồn tại của các thẻ locale.** Bên cạnh các thẻ ngôn ngữ, các bản chiếu locale
   (`fra-CA`, `cmn-Hant`) mang các dữ kiện của ngôn ngữ đó đã được phân giải cho một
   vùng lãnh thổ hoặc hệ chữ viết, được xác định bởi một khối `locale: {language, region, script}`.
   Một locale không phải là một ngôn ngữ: hãy loại trừ các locale khỏi số lượng ngôn ngữ
   dựa vào khối này.

## Nguyên tắc Thiết kế

1. **Trích dẫn nguồn cho mọi thứ.** Mọi khẳng định về mặt thực tế đều phải truy nguyên được về một nguồn sơ cấp
   cụ thể, có tên và có phiên bản. Các khẳng định không có nguồn gốc là các khẳng định không thể kiểm chứng.
   Bản đồ `_fieldSources` (và các chú thích `source` theo từng trường trong các đối tượng con)
   làm rõ nguồn gốc xuất xứ (provenance) một cách tường minh.

2. **Bảo toàn sự bất đồng.** Khi các cơ quan thẩm quyền bất đồng quan điểm (một nguồn nói
   50.000 người nói, nguồn khác lại nói 20.000), thẻ sẽ lưu trữ *cả hai* kèm theo
   gán nguồn — chính là cấu trúc envelope ở trên. Chúng tôi không lấy trung bình, không tự giải quyết hay
   đứng về bên nào. Người dùng có thể tự xem xét các sắc thái này.

3. **Vắng mặt có nghĩa là không được khẳng định.** Một trường bị thiếu có nghĩa là không có nguồn nào khẳng định
   giá trị đó. Khi một đặc tính thực sự không áp dụng (ví dụ: giống ngữ pháp
   đối với ngôn ngữ không có giống), giá trị được trích dẫn sẽ nêu rõ điều đó thay vì
   để trống.

4. **Build lại, không bao giờ vá lỗi cục bộ.** Các thẻ được ánh xạ từ các nguồn được ghim phiên bản thông qua
   một quy trình build tất định (deterministic build). Lỗi về dữ kiện sẽ được sửa tại trình xử lý nguồn tương ứng và
   toàn bộ kho dữ liệu sẽ được build lại — không chỉnh sửa tại chỗ, không có lớp làm giàu dữ liệu chỉ dựa vào merge.

---

## Kiến trúc Ba lớp

| Lớp | Vị trí | Mục đích |
|-------|----------|---------|
| **Thẻ ngôn ngữ** | `shared/language-cards/<code>.json` | Cấu hình cho từng ngôn ngữ: danh tính, phân loại, tài nguyên, và mọi thứ khác |
| **Thẻ chi (Genus cards)** | `shared/language-cards/genera/<genus>.json` | Các thuộc tính runtime dùng chung cho các ngôn ngữ có liên quan (được biên soạn thủ công, không tự động tạo) |
| **Cây ngôn ngữ** | `shared/language-cards/language-tree.json` | Hệ thống phân cấp Glottolog đầy đủ — dữ liệu tham chiếu cho Lab UI và khám phá ngôn ngữ |

---

## Mô hình Kế thừa

> **Phần lớn mang tính lịch sử kể từ đợt tái cấu trúc atlas.** Hiện không còn thẻ ngôn ngữ nào trên ổ đĩa
> mang `extends` nữa — mọi thẻ đều được hiện thực hóa (materialized) hoàn chỉnh trong quá trình build,
> vì nội dung văn bản kế thừa không thể trích dẫn nguồn (một khẳng định cấp ngữ tộc lại mang
> địa chỉ cấp ngôn ngữ). Bản thân cơ chế này vẫn tồn tại ở một nơi: gói ngoại tuyến của
> npm cung cấp các thẻ locale dưới dạng các delta `extends` nhỏ gọn
> so với ngôn ngữ của chúng, được phân giải bằng cùng một thao tác merge được mô tả tại đây.

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

> **Được tạo tự động, không phải tự viết.** Mọi thứ trong phần này đều được trích xuất từ
> kho dữ liệu trực tiếp tại thời điểm build: thẻ `crk` (Plains Cree) đầy đủ, chính xác từng byte,
> cộng với một đoạn trích locale `fra-CA`. Khi kho dữ liệu được build lại, lần build trang web tiếp theo
> sẽ tạo lại trang này. Không còn mẫu nào được duy trì thủ công để bị lỗi thời nữa —
> mẫu trước đây đã bị tụt hậu nguyên một thế hệ schema so với các thẻ thực tế
> và đã bị bãi bỏ vào ngày 2026-08-16.

Ví dụ này thể hiện **cấu trúc lưu trên ổ đĩa** — những gì bạn nhận được nếu mở tệp ra.
Các bên tiêu thụ dữ liệu vẫn nên đọc thẻ thông qua bộ điều hợp đã công bố
(`normalizeCard()` trong gói npm): nó phân giải các envelope, chuyển tiếp
các tên gọi trước đợt chuyển đổi, và suy ra các giá trị chỉ dùng để hiển thị (primary script,
vitality tier) mà thẻ thô chủ ý không lưu trữ.

Những điểm cần lưu ý khi đọc:

1. **Vỏ bao gán nguồn (Attribution envelopes).** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, và
   `politenessDistinction` mỗi trường đều mang `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   có `"agreement": "incommensurable"`: các nguồn của nó đánh giá trên các thang đo
   khác nhau, vì vậy mỗi giá trị sẽ nêu rõ `scale` của nó thay vì bị quy đổi sang
   thang đo của một bên thắng cuộc.

2. **Lược bỏ nghĩa là không được khẳng định.** Thẻ không có `iso639_1` (Plains Cree không có
   mã ISO 639-1) và không có `phonologicalInventory` (không có nguồn nạp nào
   khẳng định thông tin này) — các trường đó chỉ đơn giản là vắng mặt, không bao giờ là `null` hay `[]`.

3. **Nguồn gốc xuất xứ là một tầng hạng nhất (first-class layer).** `_fieldSources` ánh xạ từng trường tới
   (các) nguồn đã khẳng định nó, với `champollion-derived-v1` đánh dấu
   các giá trị do Champollion tính toán. `_card` đóng dấu loại thẻ, id, bản sửa đổi (revision),
   và những trường nào mà luồng sửa lỗi có thể can thiệp; `_atlas` đóng dấu bản phát hành
   của kho dữ liệu.

4. **Không chứa kết quả thực thi (run results).** Không có thông tin nào trên thẻ là điểm số đo lường kết quả đầu ra
   của phương pháp — chrF, tỷ lệ chấp nhận của FST và các chỉ số tương tự là kết quả thực thi được định danh theo khóa
   (phương pháp, tập dữ liệu, chỉ số) và nằm trên bảng xếp hạng (leaderboard). Thẻ chỉ
   khẳng định rằng các tài nguyên *có tồn tại* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Thẻ locale là một bản chiếu, không phải một ngôn ngữ \{#locale-card-example}

Bên cạnh các thẻ ngôn ngữ là các thẻ locale (`fra-CA`, `cmn-Hant`): các
dữ kiện của một ngôn ngữ **được phân giải cho một vùng lãnh thổ hoặc một hệ chữ viết**, được xác định bởi
khối `locale` của chúng — không bao giờ dựa vào hình thức mã. Một thẻ locale kế thừa các dữ kiện
của ngôn ngữ tương ứng, phân giải các dữ kiện trong phạm vi hệ chữ viết và lãnh thổ (`script`,
`localeScoped`), và **không phải là một ngôn ngữ**: hãy loại trừ các thẻ locale khỏi mọi
phép đếm ngôn ngữ và danh sách theo từng ngôn ngữ dựa vào khối `locale` này.

<CardSpecExample variant="locale" />

---

## Tài liệu tham khảo các trường \{#field-reference}

Hai quy ước áp dụng cho mọi bảng bên dưới:

- **"envelope"** có nghĩa là một vỏ bao gán nguồn — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — mang khẳng định của *tất cả* các nguồn.
  Một trường được liệt kê là `envelope` có thể xuất hiện dưới dạng một giá trị phẳng trên các thẻ
  chỉ có một nguồn đề cập (ví dụ: các languoid chỉ có trên Glottolog mang một
  `name` phẳng); bên tiêu thụ dữ liệu phải xử lý được cả hai trường hợp, và đây chính là việc bộ điều hợp
  được công bố thực hiện.
- Không có trường nào là bắt buộc ngoài `code` và `name`; mọi trường khác đều
  **bị lược bỏ khi không có nguồn nào khẳng định**. (Các) nguồn khẳng định của mỗi trường
  được ghi nhận theo từng thẻ trong `_fieldSources`, do đó các bảng này mô tả
  *loại* nguồn thay vì ghim các phiên bản cụ thể có thể bị sai lệch theo thời gian.

### § 1. Các trường Danh tính

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `code` | `string` | **Bắt buộc.** ID thẻ và tên tệp. Mã ISO 639-3 đối với thẻ ngôn ngữ (`crk`); languoid chỉ có trên Glottolog mang glottocode của chúng; thẻ locale mang mã locale (`fra-CA`). |
| `name` | envelope | **Bắt buộc.** Tên tham chiếu tiếng Anh (sổ đăng ký ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Thay thế `nativeName`. Tên người bản ngữ tự gọi ngôn ngữ của họ, bằng chính ngôn ngữ đó (LinguaMeta, Wikidata). Vắng mặt khi không có nguồn nào khẳng định — chúng tôi không bao giờ tự bịa ra hay chuyển tự một tên tự gọi (endonym). |
| `alternateNames` | `string[]` | Các tên tiếng Anh đã được chứng thực khác. |
| `iso639_1` | `string` | Chỉ xuất hiện khi có mã ISO 639-1 gồm hai chữ cái (`fra` → `"fr"`). |
| `isoScope` | `string` | Từ ngữ của chính ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (thay thế các chữ viết tắt `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Thay thế `isoType`. Từ ngữ của chính ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Macrolanguage mà ngôn ngữ này thuộc về (`crk` → `"cre"`). Các ánh xạ macrolanguage của ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Trên các thẻ hub macrolanguage: các mã thành viên riêng lẻ (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Trên các thẻ macrolanguage: các thành viên có thẻ mà các cơ quan đăng ký BCP 47 gộp vào thẻ của macrolanguage này (bảng bí danh CLDR + langtags SIL, mỗi mục đều được gán nguồn). |
| `supersededCodes` | `string[]` | Các mã ISO 639-3 đã bãi bỏ mà SIL hiện điều hướng về ngôn ngữ này — được ghi nhận trên ngôn ngữ kế nhiệm để các kho ngữ liệu xuất bản dưới mã cũ vẫn có thể phân giải được. |
| `codeAliases` | `string[]` | Thay thế `aliases`. Các mã định danh ở cấp độ code phân giải về thẻ này. |
| `bcp47` | `string` | Thẻ BCP 47 của ngôn ngữ như được khẳng định (LinguaMeta). |
| `bcp47Tag` | envelope | Do Champollion suy ra: thẻ RFC 5646 (mã ISO 639 ngắn nhất sẽ thắng). |
| `bcp47FullTag` | envelope | Dạng ngôn ngữ–chữ viết–vùng cực đại (CLDR likelySubtags + SIL langtags). Bộ điều hợp suy ra **hệ chữ viết chính (primary script)** từ thẻ này. |
| `modality` | `string` | `"spoken"` hoặc `"signed"`, suy ra từ phả hệ Glottolog. Chữ viết là một thuộc tính của chính tả, không phải thể thức (modality) — một ngôn ngữ không có chữ viết vẫn hoàn toàn là ngôn ngữ nói hoặc ký hiệu. |
| `locale` | `object` | **Chỉ dành cho thẻ locale.** `{language, region, script, publishedTag, source, note}` — định danh CHÍNH của locale. Hãy loại trừ các thẻ locale khỏi các phép đếm ngôn ngữ dựa vào khối này, không bao giờ dựa vào hình thức mã. |
| `localeScoped` | `object` | Chỉ dành cho thẻ locale: các giá trị được phân giải cho lãnh thổ/chữ viết của locale (ví dụ: `scriptName`, `cldrOfficialStatus`). |

### § 2. Các trường Phân loại

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `glottocode` | `string` | Mã định danh của Glottolog cho languoid này (`crk` → `"plai1258"`). Languoid chỉ có trên Glottolog — các ngôn ngữ mà Glottolog ghi nhận nhưng ISO 639-3 không có — dùng glottocode làm `code` của thẻ. |
| `classification` | `object` | Vùng chứa cho các trường vị trí phân loại bên dưới. Mỗi trường đều được lấy nguồn độc lập và bị lược bỏ độc lập — một ngôn ngữ biệt lập (isolate), hoặc một ngôn ngữ được xếp vào một nhóm (bucket) của Glottolog, hoàn toàn hợp lệ khi chỉ mang một phần của đối tượng này. |
| `classification.family` | envelope | Ngữ tộc cấp cao nhất mà mỗi cơ quan phân loại khẳng định. Glottolog và WALS là các hệ thống phân loại riêng biệt không phải lúc nào cũng đồng thuận, vì vậy cả hai đều được giữ lại và gán nguồn. Quy tắc lint R5 kiểm tra giá trị Glottolog bên trong envelope đối chiếu với cây phân loại của chính Glottolog: WALS có thể bất đồng với Glottolog, nhưng Glottolog không được phép bị trích dẫn sai. Các ngôn ngữ biệt lập không mang bất kỳ ngữ tộc nào. |
| `classification.familyGlottocode` | `string` | Glottocode của ngữ tộc cấp cao nhất đó (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nút phân loại trung gian của WALS (`crk` → `"Algonquian"`). Một khái niệm của WALS, **không phải** của Glottolog — Glottolog xuất bản cây có độ sâu tùy ý và không có cấp genus — do đó trường này chỉ xuất hiện khi WALS có mã hóa ngôn ngữ đó. |
| `classification.ancestry` | `string[]` | Đường dẫn phả hệ của Glottolog dưới dạng các glottocode tổ tiên, gốc đứng trước (`["algi1248", …, "plai1264"]`). Thứ tự **chính là** khẳng định: đây là một đường dẫn, không bao giờ là một tập hợp được sắp xếp theo bảng chữ cái. |
| `classification.glottologBucket` | `string` | Các nhóm phi phả hệ của Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Tách riêng khỏi vị trí ngữ tộc vì một bucket phân loại theo loại hình, không phải theo nguồn gốc phả hệ: thẻ có bucket sẽ không có ngữ tộc, và đó là kết quả trung thực. |
| `isIsolate` | `boolean` | Liệu Glottolog có phân loại ngôn ngữ này là ngôn ngữ biệt lập (isolate) hay không. |

Thẻ trước đợt chuyển đổi cũng từng chứa một `genusGlottocode`. Nó đã bị bãi bỏ cùng
với lỗi phân loại danh mục đã tạo ra nó: genus là một khái niệm của WALS, và
việc gán cho nó một mã định danh Glottolog đã khẳng định một nút cây phả hệ mà Glottolog không hề
có. Hệ thống phân cấp của Glottolog được thể hiện qua `ancestry` thay thế.

### § 3. Các trường Địa lý

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `macroarea` | `string` | Đại khu vực (macroarea) của Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` hoặc `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — điểm tọa độ đại diện của Glottolog. Một điểm tọa độ, không phải một vùng lãnh thổ: nó định vị ngôn ngữ trên bản đồ và không khẳng định bất kỳ điều gì về phạm vi hay ranh giới. |
| `countries` | `string[]` | Mã ISO 3166-1 alpha-2 của các quốc gia mà Glottolog liên kết với ngôn ngữ (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Tình trạng chính thức mà một số vùng lãnh thổ cấp cho ngôn ngữ, theo ghi nhận của CLDR (được chuyển qua LinguaMeta) — `"Official"`, `"Regional official"`. Trên thẻ locale, trạng thái được phân giải cho lãnh thổ của *locale đó* nằm trong `localeScoped.cldrOfficialStatus`. |

Mảng `regions` trước đợt chuyển đổi (phân tích chi tiết số người nói theo từng quốc gia kèm
mã quản trị) và `arealContext` (tư cách thành viên vùng ngôn ngữ / Sprachbund) đã bị bãi bỏ: không có nguồn
nạp nào khẳng định chúng, và việc biên tập không có nguồn sẽ không thể tồn tại qua một lần build lại.
Các khẳng định về số người nói ở cấp vùng có thể quay trở lại vào ngày một nguồn có thể trích dẫn được đưa vào
pipeline; cho đến lúc đó, sự vắng mặt là trạng thái trung thực nhất.

### § 4. Các trường Hệ thống Chữ viết

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `scripts` | `string[]` | Thay thế trường phẳng `script`. **Tất cả** các mã ISO 15924 đã được chứng thực (`crk` → `["Cans", "Latn"]`), không có thứ tự — không bao giờ hiểu `scripts[0]` là hệ chữ viết "duy nhất". Hệ chữ viết chính do bộ điều hợp suy ra từ thẻ cực đại của `bcp47FullTag`. |
| `scriptNames` | `string[]` | Tên hiển thị do Champollion suy ra cho `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Thay thế `dir`. Từ ngữ của chính nguồn — `"left-to-right"` / `"right-to-left"` (trước đây là `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script của CLDR: hệ chữ viết mang tính chuẩn mực đến mức các thẻ BCP 47 lược bỏ nó (`fra` → `"Latn"`). |
| `script` | `string` | **Chỉ dành cho thẻ locale**: hệ chữ viết đã được phân giải theo locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Thẻ ngôn ngữ không mang trường hệ chữ viết phẳng. |

Một ngôn ngữ không có chữ viết được chứng thực chỉ đơn giản là **không có trường `scripts`** —
sự vắng mặt này có nghĩa là không có nguồn nào khẳng định một hệ chữ viết, chứ không phải khẳng định rằng ngôn ngữ này
"không có chữ viết". (Ngôn ngữ ký hiệu là nhóm lớn nhất thuộc loại này: không có hệ thống ký hiệu nào
đạt chuẩn cộng đồng để dùng cho việc đọc viết hàng ngày.)

### § 5. Các trường Nhân khẩu học & Sức sống Ngôn ngữ

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `speakerEstimates` | envelope | Ước tính của từng nguồn, kèm theo gán nguồn. Các giá trị có thể là số đếm chính xác hoặc chuỗi khoảng giá trị của chính nguồn đó (`"10000-99999"`), với các lưu ý cảnh báo của nguồn được giữ nguyên văn trong `note`. `"agreement": "conflicting"` là trường hợp phổ biến — việc hiển thị xung đột *chính là* sản phẩm; không có gì bị lấy trung bình hay được ưu tiên lựa chọn. |
| `endangerment` | envelope | Thay thế đối tượng `vitality` đơn lẻ. Đánh giá của từng nguồn **trên thang đo riêng của chính nguồn đó** — mỗi giá trị mang một trường `scale`, và `"agreement": "incommensurable"` là điều bình thường vì kho từ vựng của ELCat, Glottolog AES và LinguaMeta không thể quy đổi tương đương lẫn nhau. Bộ điều hợp suy ra một *cấp độ sức sống (vitality tier)* để hiển thị từ một nguồn cụ thể duy nhất theo thứ tự thẩm quyền đã khai báo; cấp độ đó chỉ dùng để hiển thị — tập hợp đầy đủ kèm gán nguồn vẫn được giữ lại trên thẻ. |

Số lượng người nói *được hiển thị* ở bất kỳ đâu trong Champollion đều phải khớp với một trong các
mục `speakerEstimates` được trích dẫn hoặc mang nguồn gốc `champollion-derived`
tường minh — điều này được thực thi bởi các quy tắc tính toàn vẹn của thẻ.

### § 5.5 Các trường Tài liệu hóa & Sự hiện diện Kỹ thuật số

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `documentation` | `object` | Thay thế `documentationDepth`. Bản ghi của Glottolog về mức độ được mô tả chi tiết của ngôn ngữ, theo thuật ngữ riêng của Glottolog. |
| `documentation.medLevel` | `string` | Cấp độ Mô tả Toàn diện nhất (Most Extensive Description) của Glottolog, nguyên văn — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Khóa thư mục của mô tả toàn diện nhất đó trong danh mục tài liệu tham khảo của Glottolog. |
| `documentation.firstDocumented` | `number` | Cột năm đầu tiên có tài liệu ghi chép của chính Glottolog, nguyên văn — được chuyển về đây từ trường cấp cao nhất trước chuyển đổi. Chỉ xuất hiện trên vài trăm ngôn ngữ, và sự thưa thớt này tự nó đã là một thông tin đáng để biết. |
| `documentation.lastDocumented` | `number` | Cột năm cuối cùng có tài liệu ghi chép của Glottolog, nguyên văn — xuất hiện trên khoảng một nghìn ngôn ngữ. |
| `wikipediaEdition` | `object` | Thay thế `digitalPresence`. `{site, url, name}` — tồn tại một phiên bản Wikipedia mở bằng ngôn ngữ này (`afr` → `af.wikipedia.org`). Chỉ ghi nhận sự tồn tại, chủ ý **không có số lượng bài viết**: một số phiên bản chủ yếu do bot tạo ra, và một phiên bản khổng lồ không có nghĩa là "được ghi chép tài liệu tốt hơn" một phiên bản nhỏ theo bất kỳ khía cạnh nào mà một dịch giả có thể tận dụng. |
| `dialectCount` | `number` | Cột `child_dialect_count` của chính Glottolog, nguyên văn — chỉ tính các phương ngữ con trực tiếp, không tính toàn bộ cây phụ (subtree). Đây là khẳng định của Glottolog, không phải phép tính số học của chúng tôi: một quy tắc trước đây đã gắn nhãn nó là `champollion-derived` và khiến hàng nghìn thẻ nhận vơ số đếm của Glottolog. |

Phần còn lại của khối `digitalPresence` trước đợt chuyển đổi (số giờ Common Voice,
số lượng câu Tatoeba) bị bãi bỏ cho đến khi các nguồn đó được đưa vào pipeline —
bản thân kho dữ liệu Tatoeba đã xuất hiện đúng vị trí của nó, dưới dạng một kho
ngữ liệu song ngữ tại `resources.corpora` (§ 9).

### § 6. Các trường Mức độ trang trọng, Văn phong & Giới tính

Kho ngữ liệu được chiếu mang chính xác một trường ở đây — dữ kiện được trích dẫn:

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `politenessDistinction` | envelope | Ngôn ngữ có ngữ pháp hóa mức độ lịch sự ở các dạng ngôi thứ hai hay không. Được gán nguồn giữa Grambank GB415 (nhị phân: absent/present) và WALS 45A (bốn mức độ: no distinction / binary / multiple / pronouns avoided). Đó là các thang đo khác nhau, vì vậy mỗi giá trị đều nêu rõ `scale` của nó và envelope báo cáo chúng là **không thể so sánh tương đương (incommensurable)** thay vì là một sự bất đồng. |

**Hệ thống văn phong (register) là cấu hình, không phải dữ kiện thẻ.** Kho dữ liệu trước đợt
chuyển đổi đã lưu văn bản `formality` và các prompt `registers` trên gần một nghìn tám
trăm thẻ cho mỗi loại — hầu như tất cả đều được tạo ra từ cùng hai nguồn
ở trên, sau đó được duy trì như thể là cấu hình được biên tập thủ công. Atlas
giữ lại dữ kiện; các bề mặt cấu hình — `formality`, `registers`,
`gender`, `codeSwitching` — vẫn là một phần của **schema được biên tập của
gói npm** (`language-card.schema.json`), nằm trên các thẻ trung tâm genus/ngữ tộc được biên tập,
và đến được CLI thông qua thao tác merge `extends` của hệ thống register
được mô tả trong [Mô hình kế thừa](#inheritance-model). Chúng không phải là các trường atlas
được ánh xạ: không có thẻ nào trong kho dữ liệu ánh xạ mang chúng, và quá trình build
atlas sẽ không bao giờ ghi chúng. Hướng dẫn trong mục
[Viết Preset văn phong tốt](#writing-good-register-presets) áp dụng cho
luồng dữ liệu được biên tập đó.

### § 7. Các trường Hồ sơ Ngôn ngữ học

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `typologicalProfile` | `object` | Mỗi khóa tương ứng với một đặc trưng loại hình học được nạp vào, mỗi giá trị là cách mã hóa riêng của nguồn, mỗi khóa chỉ xuất hiện khi nguồn có mã hóa ngôn ngữ này. Các giá trị boolean đến từ các đặc trưng của Grambank, các chuỗi danh mục đến từ các chương của WALS; sổ đăng ký quyết định nêu rõ tham số thượng nguồn chính xác cho từng khóa. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — số đếm do Champollion tính toán trên kho ngữ âm PHOIBLE được trích dẫn (PHOIBLE xuất bản một hàng cho mỗi phân đoạn âm và không khẳng định số lượng), vì vậy mỗi giá trị đều mang nguồn gốc `champollion-derived`. **PHOIBLE là cơ quan thẩm quyền duy nhất về thanh điệu** (lint R1): Grambank không có đặc trưng thanh điệu, và không có trường nào khác trên thẻ được phép khẳng định về tính thanh điệu. |
| `numeralSystem` | `object` | `{base}` — cơ số đếm, nguyên văn từ công trình *Numeral Systems of the World's Languages* của Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; gần một trăm giá trị khác biệt). Vắng mặt khi cột cơ số của chính Chan bị trống — khoảng một nửa số ngôn ngữ được khảo sát — vì một trình tạo trước đó đã điền giá trị trống bằng `"decimal"` và tự bịa ra giá trị cho hai nghìn ngôn ngữ. |
| `pluralCategories` | `string[]` | Các danh mục số nhiều đếm được mà CLDR quy định cho ngôn ngữ này — tiếng Ả Rập phân biệt `["zero", "one", "two", "few", "many", "other"]`, tiếng Pháp phân biệt ba loại trong số đó, tiếng Trung phân biệt một loại. Được đọc từ các khóa trong bộ quy tắc của chính CLDR, do đó đây là khẳng định của CLDR chứ không phải suy diễn của chúng tôi. Thay thế `rules.plurals.categories` trước chuyển đổi; một pipeline i18n cần thông tin này để biết một thông điệp phải cung cấp bao nhiêu dạng số nhiều. |

Các khóa `typologicalProfile` hiện đang được ánh xạ, cùng với các tham số
thượng nguồn của chúng:

- **Các chương WALS** (chuỗi danh mục, nhãn giá trị của chính WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Các đặc trưng Grambank** (kiểu boolean): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Các khối `linguisticChallenges` và `contactInfluences` trước đợt chuyển đổi không
được ánh xạ — văn bản nghiên cứu không có nguồn nạp sẽ được giữ lại trong schema
biên tập của gói npm, giống như các bề mặt văn phong trong § 6 (các bảng
[Loại ảnh hưởng tiếp xúc](#contact-influence-types) bên dưới phục vụ cho
luồng đó). Khối `rules` đã bị bãi bỏ: những gì có thể trích dẫn trong đó vẫn tồn tại dưới dạng
`pluralCategories` ở đây và các trường hệ chữ viết trong § 4.

### § 8. Các trường Bách khoa toàn thư

Đã bị loại bỏ khỏi thẻ. Các khối `encyclopedic` (tiểu luận lịch sử và phương ngữ,
liên kết tổ chức), `culturalAphorism` và `varieties` trước đợt chuyển đổi là
các đoạn văn bản được biên tập thủ công ở cấp độ thẻ, vốn đã được thiết kế để bị xóa bỏ trong đợt rebuild. Các
dữ kiện về tư cách thành viên mà `varieties` từng đề cập nay là các trường định danh có trích dẫn nguồn
(§ 1 `macrolanguageMembers` và `canonicalisedMembers`), và độ phủ công cụ theo từng biến thể
được giải đáp bởi thẻ riêng của từng thành viên (`methodSupport`,
`resources`). Một câu danh ngôn đại diện có thể quay trở lại thông qua luồng đóng góp
của cộng đồng kèm theo sự đồng thuận và trích dẫn; nó sẽ không quay lại dưới dạng
một trường không trích dẫn nguồn trên thẻ.

### § 9. Các trường Tài nguyên Kỹ thuật số

Mọi thứ trong phần này đều khẳng định **sự tồn tại và năng lực, không bao giờ khẳng định
chất lượng**: tức là một tài nguyên đã được công bố và ai là người công bố nó — chứ không bao giờ khẳng định nó
tốt, đầy đủ hay có thể sử dụng được, và không bao giờ là một điểm số đo lường. Mọi điểm số đo lường
kết quả đầu ra của phương pháp đều là kết quả thực thi được định danh theo (phương pháp, tập dữ liệu, chỉ số), nằm trên
bảng xếp hạng và bị nghiêm cấm xuất hiện trên thẻ (quy tắc lint R3).

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `resources` | `object` | Vùng chứa: mỗi trường con bên dưới là một danh sách có nguồn độc lập, bị lược bỏ khi không có nguồn nào khẳng định. |
| `resources.fsts` | `object[]` | Các bộ phân tích hình thái học hữu hạn trạng thái (finite-state morphological analysers) đã công bố: `{name, url, publisher, license, licenceEstablished, archived}`. Giấy phép đi kèm với từng mục thay vì giả định đồng nhất trên toàn bộ danh mục — ranh giới giấy phép cần các điều khoản thực tế. Đối với một ngôn ngữ đa tổng hợp (polysynthetic), FST thường là công cụ kiểm tra cấu trúc duy nhất tồn tại. |
| `resources.corpora` | `object[]` | Các kho ngữ liệu song ngữ chứng thực ngôn ngữ này: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Được nêu theo **các cặp ngôn ngữ**, bởi vì một kho ngữ liệu song ngữ chỉ chứng thực một ngôn ngữ thông qua một cặp — việc nói "hỗ trợ tiếng Swahili" mà không nói rõ là với ngôn ngữ nào thì chỉ là trả lời cho một câu hỏi không ai hỏi. Sự tồn tại và quy mô, không bao giờ là chất lượng. |
| `resources.monolingualCorpora` | `object[]` | Các kho ngữ liệu đơn ngữ — được tách riêng khỏi `corpora` để "có kho ngữ liệu" không bao giờ mang hai ý nghĩa không thể so sánh với nhau. |
| `resources.speech` | `object[]` | Các tài nguyên giọng nói đã công bố. Chỉ ghi nhận sự tồn tại. |
| `resources.keyboards` | `object[]` | Các bố cục bàn phím đã công bố. Đơn giản nhưng thiết yếu: đối với một hệ chính tả cần các ký tự mà không bố cục chuẩn nào gõ được, một bố cục bàn phím chính là sự khác biệt giữa việc ngôn ngữ đó có thể gõ được hay không. |
| `resources.typology` | `object[]` | Các tập dữ liệu loại hình học *mã hóa* ngôn ngữ này, kèm theo phạm vi: `{dataset, featuresCoded, datasetFeatureTotal}`. Sự tồn tại và phạm vi, không bao giờ là nội dung — những gì một đặc trưng thể hiện sẽ nằm ngoài thẻ cho đến khi có người viết bản đồ tham số chấp nhận nó (các đặc trưng được chấp nhận xuất hiện trong `typologicalProfile` ở § 7). Số đếm đặc trưng là phép tính của chúng tôi, do đó chúng mang nguồn gốc `champollion-derived`. |
| `lexicalResources` | `object` | Vùng chứa cho các dữ kiện về sự tồn tại của từ vựng. |
| `lexicalResources.datasets` | `object[]` | Danh sách từ vựng đã công bố kèm theo độ phủ của chúng: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Các từ điển đã công bố — chỉ sự tồn tại, không bao giờ là chất lượng, và **có hướng** nếu nhà xuất bản chỉ định hướng: một từ điển đi theo một chiều là một tài nguyên khác biệt so với từ điển đi theo chiều ngược lại. Các mục không đồng nhất về cấu trúc (một tập dữ liệu CLDF biết số lượng mục từ của nó; một kho lưu trữ biết cặp và hướng ngôn ngữ của nó); mỗi mục nêu nguồn riêng của mình, giấy phép và trạng thái lưu trữ đi kèm theo từng mục. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Số đếm do Champollion tính toán trên CLICS³: các khái niệm được chứng thực cho ngôn ngữ này, và các dạng ánh xạ tới hai hoặc nhiều khái niệm khác biệt. `champollion-derived`. |
| `methodSupport` | `object` | Những phương pháp dịch nào hỗ trợ ngôn ngữ này — năng lực, không bao giờ là điểm số. Cấu trúc: `{total, byTier, named, truncated}`. Tiếng Anh mang hàng nghìn liên kết phương pháp còn ngôn ngữ trung vị chỉ có vài chục, do đó thẻ lưu giữ *cấu trúc* của bằng chứng — `total` cộng với số đếm `byTier` theo từng tầng độ tin cậy (`fetched`, `partially-confirmed`, `model-card-declared`) — và chỉ nêu tên các mục mạnh nhất (mỗi `{value, variant, source, confidence}`), có giới hạn số lượng. Các **dịch vụ** trong sổ đăng ký luôn được nêu tên đầy đủ, vượt trên giới hạn đó, do đó sự vắng mặt của một dịch vụ trong `named` là một câu trả lời thực sự; sự vắng mặt của một mục model-card chỉ có nghĩa là "không nằm trong số những mục mạnh nhất", và mọi liên kết đều có thể truy vấn được trong kho lưu trữ atlas. |
| `metricModelSupport` | envelope | Các mô hình chỉ số đánh giá công bố độ phủ cho ngôn ngữ này, kèm theo mã định danh mô hình mà một harness sẽ tải (`masakhane/africomet-mtl`). Điều khiển hành vi thực tế — lựa chọn mô hình COMET — và vẫn là năng lực, không bao giờ là điểm số. |

**Được gộp vào các trường ở trên:** trường trước chuyển đổi `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), và `databaseCoverage` (→
`resources.typology` cộng với `lexicalResources` — một mục cơ sở dữ liệu hiện là một
dữ kiện về độ phủ có trích dẫn kèm phạm vi, chứ không phải một giá trị boolean).

**Đã loại bỏ khỏi thẻ:** `omt1600`, `evalDatasets`, `pipelineReadiness` và
`metricPlugins` — không có trường nào được khẳng định bởi một nguồn nạp, và cấp độ sẵn sàng (readiness
tier) là một đánh giá chủ quan, không phải một trích dẫn.

**Được biên tập, không phải được ánh xạ:** các bề mặt khai báo tiêu chuẩn đánh giá
(`evalStandard`, `evalMetrics`, `evalPack`) vẫn nằm trong schema được biên tập của gói npm.
Chúng cho harness đánh giá biết gói trọng tài bên ngoài nào
chấm điểm cho một ngôn ngữ (trọng tài, không phải thí sinh — phần lõi của harness không đi kèm bất kỳ
mã chấm điểm riêng nào cho ngôn ngữ); harness sẽ đọc chúng từ thẻ khi
có mặt, nhưng hiện không có thẻ nào trong kho dữ liệu ánh xạ mang chúng, và
quá trình build atlas không ghi chúng. Điều tương tự cũng áp dụng cho khối `install` mà
trình cài đặt FST của harness đọc từ các mục `resources.fsts[]`
(`get_fst_install_info()` trong `language_cards.py`): các mục được ánh xạ
chỉ mang dữ kiện về sự tồn tại.

### § 10. Các trường Nguồn gốc dữ liệu (Provenance)

| Trường | Cấu trúc | Ghi chú |
|-------|-------|-------|
| `_fieldSources` | `object` | Có trên mọi thẻ. Ánh xạ từng đường dẫn trường trên thẻ (`"classification.family"`, `"coordinates.lat"`) tới các id nguồn đã được sắp xếp đã khẳng định nó (`["glottolog-v5.3", "wals-v2020.5"]`). Các giá trị do Champollion tính toán mang `champollion-derived-v1`. Các id nguồn đều có phiên bản — `grambank-v1.0.3`, `iso639-3-20260715` — do đó mọi khẳng định đều truy nguyên được về bản phát hành chính xác đã đưa ra nó. |
| `coverage` | `object` | Có trên mọi thẻ, và **được tính toán bởi projector, không phải do bất kỳ nguồn nào khẳng định**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — có bao nhiêu nguồn riêng biệt nói về ngôn ngữ này, bao nhiêu thành phần thẻ mang giá trị trên tổng số bao nhiêu thành phần có thể điền, và bao nhiêu giá trị được một nguồn ghi nhận rõ ràng là *vắng mặt* (đã tìm kiếm và khẳng định không có — một dữ kiện khác hẳn với việc chưa bao giờ tìm kiếm). Điều này giúp một thẻ có ít thông tin nêu rõ được **lý do** tại sao nó ít thông tin thay vì trông như bị bỏ quên. |
| `_card` | `object` | Siêu dữ liệu của chính thẻ: `{type, id, revision, correctableFields}`. `type` là `"language"` hoặc `"locale"` (thẻ phương pháp và thẻ kho ngữ liệu dùng chung một projector); `revision` là mã băm nội dung, do đó bất kỳ thay đổi nào đối với nội dung thẻ đều làm thay đổi nó; `correctableFields` liệt kê các đường dẫn trường đang mang giá trị — các trường mà luồng sửa lỗi có thể can thiệp. |
| `_atlas` | `object` | `{version}` — con dấu phát hành của kho ngữ liệu (`"unreleased"` giữa các bản phát hành). Chủ ý là một id phát hành, **không phải** dấu thời gian build: dấu thời gian sẽ khiến hai bản build từ cùng các bản ghim phiên bản giống hệt nhau bị khác nhau theo lịch, phá vỡ đặc tính cho phép bất kỳ ai cũng có thể kiểm tra atlas — cùng bản ghim đầu vào, cùng số byte đầu ra. |

Khối provenance trước đợt chuyển đổi đã bị loại bỏ toàn bộ: `dataSources`
(được thay thế bằng bản đồ `_fieldSources` theo từng trường), `supportTier` (một đánh giá qua tính toán,
được thay thế bằng các số đếm trung tính `coverage`), `_generated` (toàn bộ
kho dữ liệu được tạo tự động; con dấu là `_card.revision` cộng với
`_atlas.version`), `humanReviewed` và `notes` (phần biên tập thuộc về
các luồng có bản ghi riêng của chúng), và các trường cấp cao nhất
`firstDocumented`/`lastDocumented` (được chuyển vào `documentation` trong § 5.5,
nơi nguồn của chúng thực sự khẳng định).

---

## Chính sách Mã Ngôn ngữ

Champollion sử dụng **ISO 639-3** làm mã định danh chuẩn. Các mã tiêu chuẩn khác
được đăng ký dưới dạng bí danh (alias) và sẽ được phân giải thành mã ISO 639-3 tại thời điểm runtime.

| Mức ưu tiên | Tiêu chuẩn | Ví dụ | Trường | Mục đích sử dụng |
|----------|----------|---------|-------|-----|
| 1 (chuẩn) | ISO 639-3 | `crk` | `code` | Tên tệp thẻ, khóa cấu hình, tham số API |
| 2 (bí danh) | ISO 639-1 | `iu` | `codeAliases[]` | Được chấp nhận trong CLI, phân giải về ISO 639-3 |
| 3 (bí danh) | BCP 47 | `fil` | `codeAliases[]` | Được chấp nhận trong CLI, phân giải về ISO 639-3 |
| Tham chiếu | Glottocode | `plai1258` | `glottocode` | Chỉ dùng cho phân loại, không dùng cho runtime |

**Thứ tự phân giải:** Khi người dùng cung cấp một mã:
1. Khớp trực tiếp trên `card.code` → tìm thấy
2. Khớp trên `card.codeAliases[]` → tìm thấy, trả về thẻ chuẩn (canonical card)
3. Khớp trên `card.iso639_1` → tìm thấy (fallback)
4. Không tìm thấy → báo lỗi

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
- `resolveCode("fr")` trả về `"fra"` khi chạy (runtime) — tương thích ngược
- Người dùng vẫn có thể viết `"fr"` trong file cấu hình của họ — mã sẽ được phân giải một cách minh bạch

**Những thay đổi về mặt kiến trúc:**
- `_deepMerge()` giờ đây sẽ bỏ qua các giá trị `null` (kế thừa từ cha)
- `_deepMerge()` giờ đây đã được thiết lập trường danh tính (mã, phần mở rộng, bí danh không bao giờ được kế thừa)
- `formality.default` giờ đây được suy ra từ các cờ văn phong (register) `isDefault: true`
- 205 thẻ có nguồn gốc từ Grambank đã được sửa lỗi cấu trúc `formality.default`
- 38 thẻ chi/họ/vĩ ngôn ngữ cung cấp các mục tiêu kế thừa

---

## Các Trường hợp Đặc biệt

### Ngôn ngữ ký hiệu
Ngôn ngữ ký hiệu (ví dụ: ASE — American Sign Language) là các ngôn ngữ chính thức
có mã ISO 639-3. Chúng có vị trí địa lý và số lượng người dùng nhưng:
- `modality` là `"signed"` — khẳng định rõ ràng của thẻ về bản chất
  của ngôn ngữ; việc vắng mặt một hệ thống chữ viết là một dữ kiện riêng biệt
- `scripts` thường vắng mặt (không có hệ thống ký hiệu nào đạt tiêu chuẩn cộng đồng
  được chấp nhận rộng rãi), mặc dù `"Sgnw"` (SignWriting) sẽ xuất hiện khi có nguồn khẳng định
- `textDirection` vắng mặt
- `linguisticChallenges` nên đề cập đến ngữ pháp không gian, các từ loại định danh (classifiers), v.v.

### Ngôn ngữ cổ đại & lịch sử
Các ngôn ngữ như tiếng Latinh (`lat`, isoLanguageType `"Historical"`) và tiếng Phạn
(`san`) vẫn được sử dụng trong các ngữ cảnh cụ thể (phụng vụ, học thuật) nhưng không
còn người bản ngữ:
- `isoLanguageType` mang từ chỉ trạng thái của chính ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — thẻ không bao giờ làm nhẹ bớt hay ghi đè lên nó
- `endangerment` và `speakerEstimates` báo cáo bất kỳ điều gì mà các nguồn trích dẫn
  thực sự đánh giá, giữ nguyên văn các lưu ý cảnh báo (số lượng người dùng trong cộng đồng L2 giữ nguyên nhãn theo
  cách mà các nguồn gán nhãn cho chúng)
- `firstDocumented` / `lastDocumented` xác định vị trí của chúng theo thời gian

### Ngôn ngữ nhân tạo (Constructed Languages)
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, v.v.:
- `classification` có thể vắng mặt — Glottolog xếp các ngôn ngữ nhân tạo (conlang) vào một
  nhóm phi phả hệ, và nhóm này không bao giờ được hiển thị như một ngữ tộc
- `contactInfluences` phản ánh tư liệu nguồn (ví dụ: Esperanto vay mượn từ ngữ tộc Rôman, German, Slav)
- `endangerment` bất thường — cộng đồng người nói đang phát triển nhưng không có quê hương bản địa

### Macrolanguage (Đại ngôn ngữ)
Tiếng Ả Rập (`ara`), tiếng Trung (`zho`), Cree (`cre`), Quechua (`que`) là các macrolanguage
bao hàm nhiều ngôn ngữ riêng lẻ:
- `isoScope: "Macrolanguage"` — một hub điều hướng, không bao giờ là mục tiêu benchmark
- `macrolanguageMembers` liệt kê các mã thành viên riêng lẻ;
  `canonicalisedMembers` ghi lại những thành viên nào mà các cơ quan đăng ký BCP 47 gộp
  vào thẻ của macrolanguage (mỗi cơ quan đăng ký đều được gán nguồn)
- `methodSupport` phản ánh những gì mà *thẻ macrolanguage* hỗ trợ (thường là biến thể chuẩn hóa)
- Các ngôn ngữ thành viên riêng lẻ có thẻ riêng của chúng, mang `macrolanguage` liên kết ngược về hub

### Ngôn ngữ không có hệ thống chính tả chuẩn hóa
Nhiều ngôn ngữ (đặc biệt là các ngôn ngữ truyền khẩu) không có hệ thống chữ viết
chuẩn hóa, hoặc có các hệ thống chính tả cạnh tranh nhau:
- `scripts`, `scriptNames`, và `textDirection` vắng mặt — không có nguồn nào
  khẳng định một hệ chữ viết, điều này không tương đồng với khẳng định "không có chữ viết"
- `notes` nên giải thích tình hình chính tả
- `linguisticChallenges` nên lưu ý điều này ảnh hưởng như thế nào đến dịch máy (MT) (ví dụ: không có dữ liệu huấn luyện)

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

## Cách cập nhật các dữ kiện trên thẻ

Các thẻ là **kết quả đầu ra của quá trình build (build output)** — một bản chiếu tất định từ các bản snapshot thượng nguồn
được ghim phiên bản. Không còn quy trình làm giàu dữ liệu trên từng thẻ nữa: luồng tập lệnh
chạy thủ công `enrich-*` đã bị bãi bỏ, và mọi chỉnh sửa được thực hiện trực tiếp trên tệp thẻ
sẽ bị xóa trong lần build tiếp theo. Để thay đổi một dữ kiện:

1. **Đăng ký quyết định.** Mỗi trường là một hàng trong sổ đăng ký quyết định (decision
   registry) của bản build: tham số thượng nguồn nào cung cấp dữ liệu cho nó, cách nó được chiếu và giá trị
   vắng mặt có ý nghĩa gì.
2. **Sửa lớp tiếp nhận dữ liệu (ingest layer).** Giá trị sai là một lỗi trong trình xử lý nguồn
   (hoặc do ghim phiên bản thượng nguồn bị cũ), không bao giờ là thứ cần vá lỗi trực tiếp trên thẻ.
3. **Build lại và chuyển đổi (cut over).** Quá trình build sẽ chiếu lại mọi thẻ từ các bản
   snapshot được ghim; các cổng kiểm tra (gates) sẽ từ chối các bản build cục bộ, các giá trị null/rỗng và các thẻ
   không vượt qua quy tắc về tính toàn vẹn.

### Xử lý Xung đột

Khi các nguồn bất đồng ý kiến:
1. **Lưu trữ tất cả các nguồn** kèm gán nguồn — đó là mục đích của
   attribution envelope
2. **KHÔNG lấy trung bình** hoặc chọn phe — `consensus` chỉ xuất hiện khi
   các nguồn thực sự đồng thuận
3. **Giữ nguyên văn các lưu ý cảnh báo của từng nguồn** trong trường `note` của giá trị đó
4. Một giá trị duy nhất dùng cho hiển thị hoặc tính toán sẽ **được bộ điều hợp (adapter) suy ra**
   theo thứ tự thẩm quyền đã khai báo — bản thân thẻ luôn giữ đầy đủ tất cả các ý kiến

---

## Xác thực

Chạy linter sau bất kỳ lần build lại nào:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Danh sách Kiểm tra PR

Khi gửi một thay đổi có tác động đến các thẻ (hãy nhớ: thay đổi bản build,
chứ không phải sửa trực tiếp trên thẻ):

- [ ] Bản sửa lỗi nằm trong trình xử lý tiếp nhận dữ liệu (ingest handler) hoặc sổ đăng ký quyết định (decision registry) — không có tệp thẻ
      nào được chỉnh sửa thủ công
- [ ] Các trường chỉ chứa các giá trị được nguồn khẳng định — không chèn đệm các giá trị `null` hoặc
      `[]` để "hoàn thiện" một thẻ
- [ ] `classification` đến từ Glottolog (không phải tự tạo thủ công)
- [ ] Nguồn gốc (provenance) của mọi trường bị tác động đều được ghi vào `_fieldSources`, với
      các giá trị do Champollion tính toán mang nguồn gốc `champollion-derived`
- [ ] Không có điểm số đo lường kết quả đầu ra của phương pháp nào xuất hiện ở bất kỳ đâu trên thẻ
- [ ] Linter và cổng kiểm tra tính toàn vẹn của thẻ (card-integrity gate) đều vượt qua mà không có lỗi

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
