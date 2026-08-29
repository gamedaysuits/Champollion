---
sidebar_position: 3
title: "Bộ dữ liệu đánh giá"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Tập dữ liệu Đánh giá (Evaluation Datasets)

> **Tóm tắt nội dung.** Trang này mô tả các tập dữ liệu đánh giá có sẵn để đánh giá chuẩn (benchmarking), bao gồm lược đồ mục nhập ngữ liệu, các cấp độ khó (1–5) và các yêu cầu về nguồn gốc. Danh mục này bao gồm **~4.700 tập dữ liệu đánh giá được lấy từ nguồn trên 19 họ ngữ liệu** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, các tập dữ liệu mù WMT newstest/General 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) cộng với FLORES+ — *nội dung* ngữ liệu không bao giờ được lưu trữ tại đây; mỗi tập dữ liệu là một thẻ siêu dữ liệu được ghim mã băm (sha-pinned) và được xây dựng lại một cách tất định từ kho lưu trữ gốc (upstream) được ghim của nó. Một **luồng phi thương mại / chỉ dành cho nghiên cứu** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k và các tập dữ liệu sử dụng cho nghiên cứu của WMT) bị loại trừ khỏi bất kỳ luồng thương mại / giải thưởng / API nào; trong luồng này, các ngữ liệu theo các cấp phép đã sửa đổi, tùy chỉnh hoặc không được nêu rõ sẽ bị **giới hạn bởi sự đồng thuận (consent-gated)** — việc đánh giá qua API mô hình từ xa sẽ từ chối trừ khi bản thân văn bản giấy phép cấp quyền sử dụng cho mục đích đánh giá (được ghi nhận là một quyết định rõ ràng cho từng tập dữ liệu, như với các tập dữ liệu sử dụng cho nghiên cứu của WMT) hoặc sự cho phép của chủ sở hữu bản quyền được ghi nhận trên mục nhập của tập dữ liệu. Hai tập dữ liệu tham chiếu do con người tuyển chọn — EDTeKLA Dev v1 (tiếng Plains Cree) và FLORES+ Devtest (870 cặp ngôn ngữ được lập danh mục, 1.012 câu mỗi cặp) — được trình bày chi tiết bên dưới; chi tiết số lượng mục nhập đầy đủ của EdTeKLA được nêu một lần, trong [phần của nó](#edtekla-development-set-v1).

Các tập dữ liệu là những mục tiêu cố định mà công cụ kiểm thử (harness) sẽ chạy đối chiếu. Mỗi tập dữ liệu là một tệp JSON chứa các cặp nguồn→đích với các bản dịch tham chiếu chuẩn (gold-standard). Công cụ kiểm thử sẽ chấm điểm kết quả đầu ra của mô hình so với các bản dịch tham chiếu này — nó không bao giờ sửa đổi chúng.

:::danger[KHÔNG HUẤN LUYỆN trên dữ liệu đánh giá]

⚠️ **Các tập dữ liệu này chỉ dành cho mục đích đánh giá.** Các phương pháp được huấn luyện, tinh chỉnh (fine-tune), gợi ý vài lượt (few-shot-prompted) hoặc bằng cách khác tiếp xúc với dữ liệu đánh giá sẽ tạo ra điểm số cao một cách nhân tạo và sẽ bị **tước quyền tham gia bảng xếp hạng (leaderboard).**

Hãy sử dụng các ngữ liệu riêng biệt để huấn luyện. Các tập đánh giá phải luôn là dữ liệu chưa từng được mô hình của bạn nhìn thấy trong suốt quá trình phát triển.
:::

---

## Định dạng Tập dữ liệu {#dataset-format}

Mọi tập dữ liệu đều tuân theo cùng một cấu trúc JSON:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Sơ đồ chuẩn tắc]
[Tài liệu đặc tả đo kiểm](/docs/network/specifications/benchmark) định nghĩa ngữ liệu chuẩn tắc (canonical corpus) và cấu trúc thực thể. Trang này tài liệu hóa các tập dữ liệu hiện có và cách tạo mới chúng.
:::

### Khối `dataset` Cấp cao nhất

| Trường | Kiểu | Mô tả |
|-------|------|-------------|
| `id` | `string` | Mã định danh duy nhất của tập dữ liệu (được dùng trong thẻ chạy và bảng xếp hạng) |
| `version` | `string` | Phiên bản ngữ nghĩa (Semantic version). Việc tăng chỉ số này sẽ làm mất hiệu lực của các so sánh thẻ chạy trước đó |
| `language_pair` | `string` | Nhãn hiển thị (ví dụ: `EN→CRK`) |
| `description` | `string` | Tùy chọn. Bản tóm tắt dễ đọc |
| `source_language` | `string` | Mã ngôn ngữ nguồn BCP 47 |
| `target_language` | `string` | Mã ngôn ngữ đích BCP 47 |
| `created` | `string` | Ngày tạo theo định dạng ISO 8601 |
| `license` | `string` | Mã định danh giấy phép SPDX |
| `provenance` | `string[]` | Danh sách các thẻ nguồn gốc xuất xứ được sử dụng trên các mục dữ liệu |

### Các Trường của Mục dữ liệu

| Trường | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Mã định danh duy nhất của mục dữ liệu trong ngữ liệu |
| `source` | `string` | ✅ | Văn bản nguồn cần dịch |
| `reference` | `string` | ✅ | Bản dịch tham chiếu chuẩn (gold-standard) |
| `difficulty` | `integer` | ✅ | Cấp độ khó từ 1–5 (xem bên dưới) |
| `provenance` | `string` | ✅ | Nguồn gốc của mục này (ví dụ: `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Văn phong/mức độ trang trọng (ví dụ: `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Chức năng giao tiếp (ví dụ: `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Ngữ cảnh tùy chọn dành cho người đánh giá |
| `morphological_analysis` | `string` | ❌ | Phân tích hình thái học chuẩn (gold-standard) |
| `variant_class` | `string` | ❌ | Nhãn phân lớp nhóm các biến thể dịch thuật được chấp nhận |

---

## Các tập dữ liệu hiện có

Danh mục này bao gồm **~4.700 tập dữ liệu đánh giá được lấy từ nguồn trên 19 họ ngữ liệu**, cộng với hai tập dữ liệu tham chiếu do con người tuyển chọn (EDTeKLA + FLORES) được trình bày chi tiết bên dưới — tổng cộng có **5.602 tập dữ liệu** trong sổ đăng ký tính đến ngày 12-07-2026. Mỗi ngữ liệu là một **thẻ siêu dữ liệu được ghim mã băm (sha-pinned)** — nội dung ngữ liệu không bao giờ được lưu trữ tại đây; nó được xây dựng lại một cách tất định từ kho lưu trữ gốc (upstream) được ghim của nó tại thời điểm đánh giá. Tất cả các tập dữ liệu đều mang `do_not_train`. Một thẻ nguồn mở rộng ra thành nhiều tập dữ liệu theo từng cặp, do đó tổng số trong sổ đăng ký vượt quá ~1.417 thẻ nguồn; các tập dữ liệu thuộc luồng mở được đưa trực tiếp vào hàng đợi quét (sweep queue); luồng chỉ dành cho nghiên cứu chạy theo yêu cầu ở những nơi mà giấy phép của nó cho phép rõ ràng (các cấp phép đã sửa đổi/tùy chỉnh/không được nêu rõ sẽ bị giới hạn bởi sự đồng thuận đối với việc đánh giá qua API mô hình từ xa).

| Họ | Tập dữ liệu | Người xây dựng / nguồn | Giấy phép | Luồng |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1.260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | mở |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | mở (tải xuống bị giới hạn bởi HF) |
| **Tatoeba** | 874 | [Cộng đồng Tatoeba](https://tatoeba.org), thông qua Tatoeba Challenge | CC-BY-2.0 | mở |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | mở |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | mở |
| **WMT newstest / General** (các tập dữ liệu mù 2014–2025) | 178 | WMT (Conference on Machine Translation), thông qua sacreBLEU | `LicenseRef-WMT-Research-Use` | **sử dụng cho nghiên cứu** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | mở |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | mở |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | mở |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **phi thương mại / chỉ dành cho nghiên cứu** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | mở (chia sẻ tương tự) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **chỉ dành cho nghiên cứu** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (ban tổ chức shared-task) | CC-BY-NC-SA-4.0 | **phi thương mại / chỉ dành cho nghiên cứu** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (ban tổ chức) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **chỉ dành cho nghiên cứu** |
| **Gamayun** | 8 | CLEAR Global (trước đây là Translators without Borders) | `LicenseRef-TWB-Gamayun` | **phi thương mại / chỉ dành cho nghiên cứu** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **phi thương mại / chỉ dành cho nghiên cứu** |
| **EDTeKLA / prize** | 3 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **phi thương mại / chỉ dành cho nghiên cứu (bị cách ly)** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **phi thương mại / chỉ dành cho nghiên cứu** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **phi thương mại / chỉ dành cho nghiên cứu** |

*(FLORES+ devtest — 870 cặp được lập danh mục, CC-BY-SA-4.0 — là tập dữ liệu tham chiếu được trình bày chi tiết bên dưới, nâng tổng số trong sổ đăng ký lên 5.602.)*

:::info[Luồng phi thương mại chỉ dành cho nghiên cứu]
Phần lớn danh mục được cấp phép mở (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) và có thể sử dụng trên mọi luồng. Một nhóm nhỏ — **Gamayun** (giấy phép
tùy chỉnh của TWB) và **EDTeKLA** (giấy phép CC BY-NC-SA đã sửa đổi, có phạm vi chủ quyền) — là **phi thương mại**: nó
bị loại khỏi bất kỳ luồng thương mại, giải thưởng hoặc API nào. Đối với các ngữ liệu theo
các cấp phép đã sửa đổi, tùy chỉnh hoặc không được nêu rõ, việc đánh giá qua API mô hình từ xa sẽ bị
**giới hạn bởi sự đồng thuận (consent-gated)**: hệ thống kiểm thử (harness) từ chối gửi văn bản của chúng đến
các API mô hình của bên thứ ba trừ khi bản thân văn bản giấy phép cấp quyền sử dụng cho mục đích đánh giá
(được ghi nhận là một quyết định rõ ràng cho từng tập dữ liệu — các tập dữ liệu sử dụng cho nghiên cứu của WMT
có mang quyết định này) hoặc sự cho phép rõ ràng của chủ sở hữu bản quyền được ghi nhận trên
mục nhập của tập dữ liệu (việc đánh giá cục bộ vẫn có thể thực hiện được). Tính hợp lệ **dựa trên mục đích sử dụng**: luồng thương mại rất nghiêm ngặt,
luồng nghiên cứu thì khoan dung hơn và việc cách ly luôn được ưu tiên (do đó các phần cắt không hợp lệ của EdTeKLA
không bao giờ có thể được xếp hạng). Xem
[Đăng ký ngữ liệu & Các luồng tiếp xúc](/docs/network/sovereignty/registering-corpora) để
biết cách một ngữ liệu chọn luồng của nó.
:::

Các tập dữ liệu tham chiếu được trình bày chi tiết bên dưới; các ngữ liệu thuộc họ ngữ liệu cũng tuân theo cùng một cấu trúc JSON và được liệt kê trong sổ đăng ký tập dữ liệu.

:::note[Danh mục không phải là một bảng xếp hạng đã có dữ liệu]
Một danh mục ngữ liệu lớn là những gì các phương pháp *có thể* được đo kiểm đối chiếu — nó không phải là một bảng xếp hạng chứa đầy kết quả. Bản thân bảng xếp hạng đang trong giai đoạn khởi tạo dữ liệu; xem [quy tắc bảng xếp hạng](/docs/network/leaderboard/rules) và [Hạn chế trung thực](/docs/network/honest-limitations).
:::

### Tập Phát triển EDTeKLA v1 {#edtekla-development-set-v1}

Tập dữ liệu đánh giá đầu tiên, được xây dựng cho bản dịch tiếng Anh → Plains Cree (SRO). Được tạo bởi [nhóm nghiên cứu EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) tại Đại học Alberta.

| Thuộc tính | Giá trị |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Version** | `1.0` |
| **Cặp ngôn ngữ** | EN → CRK (tiếng Plains Cree, hệ thống chính tả SRO) |
| **Số lượng mục nhập** | Tập phân chia dev gồm 436 mục nhập (`textbook_dev.json`). Chuỗi: 589 dòng đã căn chỉnh thô từ nguồn (upstream) → 486 cặp hợp lệ duy nhất sau khi chuẩn hóa/loại bỏ trùng lặp (số lượng do Champollion tính toán) → 436 dev + 50 held-out (tập phân chia tất định seed-42 của Champollion — EdTeKLA xuất bản các tệp thô, không phải tập phân chia). Một tập tiêu chuẩn vàng (gold-standard) riêng biệt gồm 62 mục nhập (được tuyển chọn thủ công, chỉ dành cho nghiên cứu, **không phải** tài liệu của EdTeKLA) nâng tổng số bộ sưu tập đánh giá tiếng Plains Cree kết hợp của dự án lên 548. |
| **Phân bố độ khó** | Dễ, Trung bình, Khó |
| **Nguồn gốc** | `gold_standard` (được xác minh bởi người bản ngữ), `textbook` (tài liệu giáo dục đã xuất bản) |
| **Giấy phép** | [Giấy phép CC BY-NC-SA đã sửa đổi của EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — có phạm vi chủ quyền; sách giáo khoa gốc là CC BY-NC-ND 4.0) — **bị loại khỏi các luồng bảng xếp hạng, giải thưởng và thương mại/API** (phi thương mại) |

> **Đây là tuyên bố chính thức về số lượng tập dữ liệu đánh giá tiếng Plains Cree.** Các
> trang khác sẽ liên kết đến đây thay vì trình bày lại chúng. Các con số 486/436/50 được
> Champollion tính toán từ các tệp đã căn chỉnh thô của EdTeKLA (bản thân EdTeKLA không xuất bản
> số lượng hay tập phân chia nào); tập tiêu chuẩn vàng gồm 62 mục nhập có nguồn gốc riêng biệt, không thuộc EdTeKLA.
> Số lượng ở trên luôn được gắn liền với luồng của nó: EdTeKLA mang giấy phép CC BY-NC-SA đã sửa đổi,
> có phạm vi chủ quyền và **bị loại khỏi bảng xếp hạng, các giải thưởng và luồng
> thương mại/API**.

**Những gì tập dữ liệu này kiểm tra:**

- Các câu chào hỏi cơ bản và cụm từ thông dụng
- Tính sinh động của danh từ (noun animacy) và sự chuyển dịch ngôi (obviation)
- Chia động từ theo các ngôi và thì
- Các cấu trúc chỉ vị trí (locative)
- Các mô hình sở hữu (possessive)
- Cấu trúc câu phức tạp

:::tip[Cấu trúc ngữ liệu]
Tài liệu có nguồn gốc từ EdTeKLA được chia thành một tập dev công khai và một tập held-out (tập phân chia của Champollion từ bản căn chỉnh sách giáo khoa thô của EdTeKLA — số lượng có trong bảng trên). Tập tiêu chuẩn vàng gồm 62 mục nhập riêng biệt được tuyển chọn thủ công từ các nguồn khác và không thuộc ngữ liệu EdTeKLA. Một tập dữ liệu nhỏ hơn, chất lượng cao với các tiêu chuẩn vàng đã được xác minh sẽ hữu ích hơn một tập dữ liệu lớn nhưng nhiều nhiễu — đặc biệt đối với một ngôn ngữ có nguồn tài nguyên thấp, nơi các bản dịch "đủ sát nghĩa" thường không hợp lệ về mặt hình thái học.
:::

---

## Tạo một Tập dữ liệu Mới

Để tạo một tập dữ liệu cho một cặp ngôn ngữ hoặc lĩnh vực mới:

### 1. Định cấu trúc JSON

Tuân theo cấu trúc của [Định dạng Tập dữ liệu](#dataset-format). Mọi mục dữ liệu phải có `source`, `reference`, `difficulty`, `provenance`, `register` và `context`.

### 2. Gán một ID duy nhất

Sử dụng một chuỗi định danh (slug) mang tính mô tả: `{project}-{split}-v{version}` (ví dụ: `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Xác minh các bản dịch chuẩn (gold standards)

Mọi giá trị `reference` phải được xác minh bởi người nói lưu loát hoặc được lấy từ một nguồn tài liệu đã xuất bản và được bình duyệt. Các bản dịch tham chiếu do máy tạo ra sẽ làm mất đi mục đích của việc đánh giá.

### 4. Thiết lập các cấp độ khó

Gán cho mỗi mục dữ liệu một cấp độ khó bằng số nguyên:

| Cấp độ | Mô tả | Ví dụ |
|------|-------------|----------|
| 1 — Từ vựng cơ bản | Từ đơn, câu chào hỏi thông dụng, chữ số | "hello" → "tânisi" |
| 2 — Câu đơn giản | Chủ ngữ-động từ hoặc SVO, thì hiện tại | "I see the dog" |
| 3 — Độ phức tạp trung bình | Thì quá khứ/tương lai, từ sở hữu, tính sinh động | "I saw his dog yesterday" |
| 4 — Hình thái học phức tạp | Sự chuyển dịch ngôi (obviation), thể bị động, mệnh đề phụ thuộc (conjunct order) | "the woman whose son went to the store" |
| 5 — Nâng cao | Nhiều mệnh đề, văn phong trang trọng, nghi lễ, thành ngữ | Toàn bộ đoạn văn với giọng điệu phù hợp với ngữ cảnh |

### 5. Gắn thẻ nguồn gốc xuất xứ

Mỗi mục dữ liệu nên chỉ rõ nguồn gốc của nó. Các thẻ phổ biến:

- `gold_standard` — Được xác minh bởi người nói lưu loát
- `textbook` — Từ các tài liệu giáo dục đã xuất bản
- `elicited` — Được tạo ra thông qua các buổi thu thập dữ liệu có cấu trúc (elicitation sessions)
- `corpus` — Được trích xuất từ một ngữ liệu song song

### 6. Xác thực tệp tin

Chạy công cụ kiểm thử đối với tập dữ liệu của bạn bằng bất kỳ mô hình nào để xác minh rằng tệp JSON được định dạng đúng và có đầy đủ tất cả các trường bắt buộc:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

Công cụ kiểm thử sẽ báo lỗi nếu thiếu trường, trùng lặp chỉ mục hoặc vi phạm cấu trúc (schema).

### 7. Gửi để tích hợp

Hãy mở một pull request gửi tới [kho lưu trữ công cụ kiểm thử eval harness](https://github.com/gamedaysuits/Champollion) để thêm một **thẻ siêu dữ liệu tải-từ-nguồn** — một mục đăng ký trỏ công cụ kiểm thử đến nguồn thượng nguồn (trình tải/URL, ghim SHA, giấy phép và nguồn gốc xuất xứ). **Không bao giờ commit trực tiếp nội dung ngữ liệu.** Champollion không lưu trữ hoặc theo dõi văn bản ngữ liệu của bên thứ ba; công cụ kiểm thử sẽ tải các bản dịch tham chiếu từ nguồn thượng nguồn tại thời điểm chạy và chấm điểm dựa trên dữ liệu mới tải về đó. Hãy xác thực cục bộ trước (bước 6), sau đó chỉ gửi thẻ siêu dữ liệu. Hãy đính kèm tài liệu mô tả phương pháp xác minh và các nguồn gốc xuất xứ của bạn.

---

## FLORES+ Devtest

Một bộ đo điểm chuẩn đa ngôn ngữ có phạm vi bao phủ rộng do [Sáng kiến Dữ liệu Ngôn ngữ Mở (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus) duy trì. Được sử dụng cho các so sánh ranh giới đa mô hình của Champollion.

| Thuộc tính | Giá trị |
|----------|-------|
| **ID** | Một thẻ cho mỗi cặp: `eval-flores-devtest-v1-<src>-<tgt>` (ví dụ: `eval-flores-devtest-v1-amh-fra`) |
| **Các cặp ngôn ngữ** | 870 cặp ngôn ngữ được lập danh mục và có thể chạy được (812 cặp trong số đó là giữa hai ngôn ngữ không phải tiếng Anh) |
| **Số lượng mục** | 1.012 câu cho mỗi cặp |
| **Giấy phép** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Nguồn** | Meta FLORES-200, hiện do OLDI duy trì — được tải từ nguồn, ghim SHA cho mỗi cặp (nội dung ngữ liệu không bao giờ được theo dõi tại đây) |
| **Độ rò rỉ dữ liệu (Contamination)** | **CAO** — chỉ mang tính tương đối, chỉ dùng để thử nghiệm / minh họa (xem lưu ý) |

:::warning[Độ rò rỉ dữ liệu CAO — chỉ mang tính tương đối, không bao giờ là mốc đo kiểm tuyệt đối]
FLORES+ là dữ liệu công khai được thu thập từ web mà các mô hình tiên phong (frontier models) rất có thể đã từng thấy qua. Champollion chạy nó trong một luồng **chỉ mang tính tương đối**: có thể sử dụng để so sánh trực tiếp các phương pháp với nhau, nhưng **không bao giờ được báo cáo dưới dạng điểm số chất lượng tuyệt đối**, và **không bao giờ được sử dụng làm cạnh chuỗi (chain edge)** trên [bản đồ dịch thuật](https://champollion.dev). Nó **chỉ dành cho mục đích thử nghiệm và minh họa**.
:::

:::danger[Chỉ dùng để đánh giá]
FLORES+ chỉ được dành riêng cho mục đích đánh giá. Các nhà biên soạn yêu cầu rõ ràng rằng nó **không được sử dụng làm dữ liệu huấn luyện**. Hãy đảm bảo nội dung của nó được loại trừ khỏi bất kỳ ngữ liệu huấn luyện nào.
:::

---

## Xem thêm

- [Đánh giá Dịch máy (MT Evaluation)](/docs/network/leaderboard/rules) — tổng quan về khung đánh giá và bảng xếp hạng
- [Công cụ kiểm thử Eval Harness](/docs/network/specifications/harness) — cách chạy đánh giá đối với các tập dữ liệu này
- [Đặc tả Thẻ chạy (Run Card Specification)](/docs/network/specifications/run-card) — cấu trúc JSON để ghi lại kết quả
- [Bảng xếp hạng Phương pháp (Method Leaderboard)](https://champollion.dev/leaderboard) — điểm số đo chuẩn trực tiếp
- [Dự án EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) — nhóm nghiên cứu của Đại học Alberta đứng sau tập dữ liệu tiếng Cree
