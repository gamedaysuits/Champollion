---
sidebar_position: 4
title: "Method Interface"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Giao diện Phương thức Chung (Shared Method Interface)

> **Tóm tắt dành cho quản lý.** Trang này quy định giao thức `TranslationMethod` mà tất cả các phương thức Mạng lưới (Network) phải triển khai, sáu lớp phương thức (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), trục **mô hình dịch (paradigm)** độc lập (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) giúp so sánh *cách một phương thức dịch thuật* giữa các hệ thống khác nhau, định dạng plugin phương thức, và các **lớp phụ thuộc (dependency classes)** (S/O/A1/A2/X) quyết định xem một phương thức có thể chạy trong môi trường thử nghiệm cô lập (sandbox) và đủ điều kiện nhận giải thưởng hay không. Đây là ba trục độc lập. Bất kỳ phương pháp tiếp cận nào triển khai giao thức này đều có thể được đánh giá hiệu năng (benchmark); việc nó phụ thuộc vào yếu tố nào sẽ quyết định nơi nó có thể cạnh tranh.

Hệ thống đánh giá (eval harness) và Champollion chia sẻ một khái niệm chung về **phương thức dịch thuật (translation method)**. Một phương thức là bất kỳ quy trình nào nhận văn bản nguồn và tạo ra văn bản dịch — cho dù đó là một lệnh gọi LLM trực tiếp, một quy trình nhiều giai đoạn (multi-stage pipeline), một API bên thứ ba, hay một dịch giả là con người.

## Kiến trúc

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Được tải thông qua `--method path/to/dir`. Hệ thống đánh giá không tự động phát hiện bất kỳ thứ gì.

## Hai Hệ thống, Một Giao diện

| | Hệ thống Đánh giá (Eval Harness) | Champollion |
|---|---|---|
| **Ngôn ngữ** | Python | Node.js |
| **Điểm khởi đầu (Entry point)** | `translate.py` | `translate.js` |
| **Giao diện** | Giao thức `TranslationMethod` | Cấu hình `methodPlugin` |
| **Mục đích** | Đánh giá hàng loạt kèm tính điểm | Bản địa hóa trực tiếp trong môi trường dev/CI |
| **Đầu ra** | Thẻ lượt chạy (Run card) kèm các chỉ số | Các tệp ngôn ngữ (locale) đã dịch |

Một phương thức hỗ trợ cả hai hệ thống sẽ cung cấp hai điểm khởi đầu — một cho mỗi môi trường chạy (runtime) ngôn ngữ. **Thẻ phương thức (method card)** là cầu nối: nó mô tả phương thức dưới định dạng mà cả hai hệ thống đều hiểu.

## Thẻ Phương thức {#method-card}

Thẻ phương thức mô tả phương thức dịch thuật đó là *gì* mà không tiết lộ các chi tiết độc quyền như toàn bộ prompt hệ thống. Nó trả lời các câu hỏi:

- Phương thức này thuộc lớp nào? (LLM thô, LLM có hướng dẫn, quy trình pipeline, API, v.v.)
- Nó sử dụng **mô hình dịch (paradigm)** nào? (dựa trên quy tắc, thống kê, dịch máy nơ-ron, LLM, lai ghép)
- Nó sử dụng những công cụ nào? (bộ phân tích FST, từ điển, v.v.)
- Bản triển khai có phải là mã nguồn mở không?
- Nó hỗ trợ những cặp ngôn ngữ nào?

Xem [Thông số Thẻ Phương thức](/docs/network/specifications/methods#method-card) để biết schema JSON đầy đủ.

### Ví dụ

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

Trường `dependency_class` tóm tắt những gì phương thức cần để chạy và chuyển giao — xem phần [Tính hợp lệ của Phương thức và Lớp Phụ thuộc](#method-validity-and-dependency-classes) bên dưới. Trường `paradigm` đặt phương thức vào **trục mô hình dịch** (ở đây là `hybrid`: một LLM được kiểm soát bởi một FST dựa trên quy tắc) — xem phần [Mô hình dịch](#paradigms) bên dưới.

### Các Lớp Phương thức

| Lớp | Mô tả |
|-------|-------------|
| `raw-llm` | Gọi LLM trực tiếp với chỉ dẫn tối thiểu |
| `coached-llm` | LLM với prompt có cấu trúc, ví dụ, và các ràng buộc |
| `pipeline` | Quy trình nhiều giai đoạn với các thành phần xác định (deterministic) |
| `custom-plugin` | Tiến trình bên ngoài triển khai giao thức `TranslationMethod` |
| `api` | API dịch thuật của bên thứ ba (Google Translate, DeepL, v.v.) |
| `human` | Dịch thuật bởi con người (để thiết lập mốc so sánh cơ sở) |

### Mô hình dịch {#paradigms}

**Mô hình dịch (paradigm)** là trục độc lập thứ ba: *cách một phương thức dịch ở cấp độ thuật toán*. Nó độc lập với cả lớp phương thức và lớp phụ thuộc. Nếu chỉ dựa vào lớp phương thức thì sẽ bị xoay quanh LLM — một hệ thống [Apertium](https://www.apertium.org/) dựa trên quy tắc và Google Translate đều sẽ rơi vào nhóm `pipeline`/`api`, do đó sự khác biệt giữa "dựa trên quy tắc và nơ-ron" sẽ vô hình nếu không có trục này. Trục mô hình dịch giúp việc so sánh đó trở nên rõ ràng và có thể lọc được trên bảng xếp hạng (leaderboard).

| Mô hình dịch | Mô tả | Ví dụ |
|----------|-------------|----------|
| `rule-based` | Bộ chuyển đổi trạng thái hữu hạn (FST), ngữ pháp viết tay, chuyển đổi hình thái | Apertium, thế hệ GiellaLT FST |
| `statistical` | Dịch máy dựa trên cụm từ / thống kê (SMT) được học từ kho ngữ liệu song song | Moses cổ điển |
| `neural-nmt` | Một mô hình dịch máy nơ-ron mã hóa-giải mã (encoder-decoder) chuyên dụng | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Một mô hình ngôn ngữ lớn đa dụng được hướng dẫn để dịch | một lệnh gọi GPT / Claude / Gemini thô hoặc có hướng dẫn |
| `hybrid` | Kết hợp hai hoặc nhiều mô hình dịch trong một phương thức | một LLM được kiểm soát bởi một FST dựa trên quy tắc (crk-translate); NMT + hậu biên tập dựa trên quy tắc |
| `human` | Dịch thuật bởi con người (mốc so sánh cơ sở ở cấp độ mô hình) | mốc so sánh dịch giả cộng đồng |
| `unknown` | Không xác định — thẻ phương thức không khai báo mô hình dịch | mặc định tương thích ngược cho các thẻ cũ |

Các trục này hoạt động độc lập. Dưới đây là một số ví dụ thực tế:

| Phương thức | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (tự lưu trữ, mã nguồn mở) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (kiểm soát bằng FST, hướng dẫn bằng LLM) | `pipeline` | `hybrid` | A2 |
| Gọi GPT thô | `raw-llm` | `llm` | A1 |

Mô hình dịch là trường **không bắt buộc** trên thẻ phương thức; nếu thiếu, nó sẽ được ghi nhận là `unknown` (điều này không bao giờ cản trở việc xuất bản — trục này mang tính chất bổ sung). Danh sách enum ở trên là từ vựng chuẩn hóa được hỗ trợ và được áp dụng bởi hệ thống đánh giá (`config.VALID_PARADIGMS`). Vì việc áp dụng nằm ở phía ứng dụng thay vì ràng buộc cơ sở dữ liệu, các mô hình dịch mới có thể được thêm vào sau này mà không cần di trú dữ liệu (migration); chỉ việc đổi tên hoặc xóa một giá trị khi các phương thức đã phụ thuộc vào nó mới tốn kém chi phí.

## Tính hợp lệ của Phương thức và Lớp Phụ thuộc {#method-validity-and-dependency-classes}

Một phương thức chỉ có thể chạy và chuyển giao tốt nhất bằng mức độ sẵn có của thành phần phụ thuộc hạn chế nhất của nó. Hai cơ chế của Mạng lưới phụ thuộc vào việc biết chính xác một phương thức cần những gì:

1. **Đánh giá trong môi trường cô lập (Sandboxed evaluation)** ([Thông số Đánh giá hiệu năng §8.2](/docs/network/specifications/benchmark)) — điểm số chuẩn vàng chính thức đến từ một môi trường cô lập có chính sách mạng là **từ chối mặc định (default-deny)**. Một phương thức âm thầm yêu cầu dịch vụ bên ngoài sẽ không thể tạo ra điểm số chính thức.
2. **Chuyển giao giải thưởng (Prize transfer)** ([Thông số Giải thưởng](/docs/network/specifications/prizes)) — các phương thức đoạt giải sẽ được chuyển giao cho tổ chức quản lý của cộng đồng ngôn ngữ đó. Một phương thức đóng gói nội dung mà người nộp không có quyền tích hợp thì không thể chuyển giao một cách hợp pháp. Người nộp phải nắm giữ (hoặc được cấp) quyền đối với mọi thứ có trong gói sản phẩm.

Để thực hiện cả hai bước kiểm tra này một cách tự động thay vì thủ công, mỗi phương thức phải khai báo một **lớp phụ thuộc (dependency class)**, được suy ra từ **bản kê khai phụ thuộc (dependency manifest)** trong `method.json`.

> **Lưu ý về cách đặt tên — ba trục độc lập.** *Lớp phương thức* (phần trên: `raw-llm`, `pipeline`, …) mô tả *hình dáng* của một phương thức — hợp đồng giao diện mà nó thể hiện. *Mô hình dịch* ([§Mô hình dịch](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) mô tả *cách nó dịch về mặt thuật toán*. *Lớp phụ thuộc* (phần này) mô tả *những gì nó cần để chạy và chuyển giao*. Ba trục này độc lập với nhau: một phương thức `pipeline` có thể là `rule-based` hoặc `hybrid`, và có thể thuộc bất kỳ lớp phụ thuộc nào. (Lớp phương thức và mô hình dịch được tách biệt có chủ ý vì nếu chỉ dùng lớp phương thức thì sẽ bị xoay quanh LLM — nó không thể phân biệt một hệ thống dựa trên quy tắc với một hệ thống nơ-ron khi cả hai đều thể hiện dưới dạng `pipeline` hoặc `api`.)

### Năm Lớp Phụ thuộc

| Lớp | Tên | Định nghĩa | Có thể chạy trong sandbox? | Đủ điều kiện nhận giải? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Tự chứa (Self-contained) | Toàn bộ mã nguồn, dữ liệu, mô hình và trọng số được phân phối bên trong thư mục phương thức, dưới các giấy phép cho phép phân phối lại và chuyển giao cho cộng đồng. | ✅ Có, nguyên bản | ✅ Có |
| **O** | Mở bên ngoài (Open external) | Phụ thuộc vào các tài nguyên được lưu trữ bên ngoài dưới giấy phép mở cho phép phân phối lại (bao gồm cả các giấy phép copyleft như AGPL) — ví dụ: một FST được tải xuống tại thời điểm cài đặt. | ✅ Có — các tài nguyên được ghim phiên bản và **được sao lưu (mirror) vào bản nộp** | ✅ Có, kèm theo các điều kiện tương thích giấy phép: các điều khoản copyleft được bảo toàn qua quá trình chuyển giao, và cộng đồng nhận được các quyền tương tự như giấy phép cấp cho mọi người |
| **A1** | Phụ thuộc API, có thể thay thế (API-dependent, substitutable) | Yêu cầu suy luận LLM tại thời điểm chạy, trong đó mô hình là **cấu hình có thể thay thế** — bất kỳ mô hình nào đủ năng lực đều có thể được đưa vào thay thế. Giá trị của phương thức nằm ở các prompt, dữ liệu hướng dẫn và mã nguồn của nó, chứ không nằm ở mô hình của riêng một nhà cung cấp nào. | ⚠️ Chỉ thông qua **cổng kết nối LLM (LLM gateway)** mà thông số sandbox định nghĩa (🔲 đang lên kế hoạch — xem bên dưới) | ⚠️ Có điều kiện — xem bên dưới |
| **A2** | Phụ thuộc API, không thể thay thế (API-dependent, non-substitutable) | Yêu cầu gọi đến một API dữ liệu hoặc dịch vụ bên ngoài tại thời điểm chạy mà không thể sao lưu hoặc thay thế — thường là do nội dung được cung cấp là độc quyền hoặc không có giấy phép (ví dụ: một API từ điển mà từ điển nền tảng không có giấy phép công khai). | ❌ Không — thành phần phụ thuộc không thể tồn tại trong sandbox nếu không có sự cho phép của bên nắm giữ bản quyền | ❌ Cho đến khi bên nắm giữ bản quyền cấp quyền đưa vào sandbox **và** quyền chuyển giao. Được phép xuất hiện trên bảng xếp hạng mở (phân khúc phát triển) với nhãn **"phụ thuộc bên ngoài" (external dependency)** hiển thị rõ ràng |
| **X** | Đóng (Closed) | Đóng gói nội dung mà người nộp không có quyền phân phối lại — các bộ dữ liệu không có giấy phép, nội dung độc quyền được thu thập trái phép (scraped), các thành phần không tương thích về giấy phép. | ❌ | ❌ Không được chấp nhận trong mọi phân khúc. Việc đóng gói nội dung không có bản quyền là vi phạm giấy phép bất kể phương thức chạy ở đâu |

**Lớp hiệu dụng (Effective class).** Lớp phụ thuộc của một phương thức là lớp *hạn chế nhất* trong số tất cả các phụ thuộc đã khai báo của nó, theo thứ tự S < O < A1 < A2 < X. Một từ điển không có giấy phép sẽ khiến một quy trình pipeline vốn tự chứa trở thành Lớp A2 (nếu truy cập tại thời điểm chạy) hoặc Lớp X (nếu đóng gói chung mà không có bản quyền).

### Sự khác biệt giữa A1/A2: Tính khả thay (Substitutability)

Hầu hết các phương thức đều gọi LLM. Mạng lưới không phủ nhận điều đó — nhưng nó phân biệt hai loại phụ thuộc API rất khác nhau:

- **A1 (có thể thay thế):** API cung cấp dịch vụ suy luận LLM thông thường. Định danh mô hình chỉ là một cấu hình: phương thức phải chạy được từ đầu đến cuối với bất kỳ điểm cuối (endpoint) suy luận tương thích nào, bao gồm cả mô hình trọng số mở do cộng đồng tự lưu trữ. Chất lượng đầu ra có thể khác nhau giữa các mô hình — đó là rủi ro của nhà phát triển, và điểm số chính thức được gắn liền với mô hình được ghim phiên bản dùng trong quá trình đánh giá. Một phương thức phụ thuộc vào **trạng thái phía nhà cung cấp** (một mô hình tinh chỉnh chỉ được lưu trữ tại nhà cung cấp, kho lưu trữ tệp của nhà cung cấp, các trợ lý đặc thù của nhà cung cấp) thì *không* thể thay thế: trạng thái đó không thể bị gạt bỏ, vì vậy phụ thuộc đó là A2 trừ khi các trọng số hoặc dữ liệu nền tảng được bao gồm trong bản nộp.
- **A2 (không thể thay thế):** API cung cấp một thứ gì đó độc nhất — thường là dữ liệu độc quyền hoặc không có giấy phép. Không có điểm cuối thay thế nào có thể cung cấp nó, và nội dung không thể được sao lưu vào sandbox nếu không có sự cho phép của bên nắm giữ bản quyền. Phương thức này vẫn hoạt động trên bảng xếp hạng mở (được gắn nhãn), nhưng không thể tạo ra điểm số sandbox chính thức hoặc đủ điều kiện nhận giải thưởng cho đến khi có sự cho phép.

**Những gì một đợt chuyển giao giải thưởng A1 thực sự bàn giao.** Cộng đồng không nhận được mô hình — không ai có thể chuyển giao trọng số của Anthropic, Google hay OpenAI. Việc chuyển giao bao gồm toàn bộ công thức *xung quanh* mô hình: tất cả các prompt, dữ liệu hướng dẫn, mã nguồn quy trình, logic thử lại (retry), cấu hình và các yêu cầu mô hình đã được tài liệu hóa. Vì mô hình có thể thay thế được theo thiết kế, cộng đồng có thể hướng phương thức đã chuyển giao tới bất kỳ nhà cung cấp nào họ chọn — hoặc tới một mô hình trọng số mở trên phần cứng của riêng họ — mà không cần sự tham gia của nhà phát triển. Công thức là tài sản sở hữu; động cơ là thứ thuê ngoài và có thể thay thế.

### Bản kê khai Phụ thuộc (`method.json`)

Mỗi phương thức khai báo các phụ thuộc của nó trong bản kê khai `method.json`. Mỗi mục ghi lại tài nguyên đó là gì, nguồn gốc từ đâu, giấy phép nào bảo hộ và cách phương thức truy cập nó:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Trường | Bắt buộc | Mô tả |
|-------|----------|-------------|
| `id` | ✅ | Định danh ổn định cho thành phần phụ thuộc |
| `kind` | ✅ | `data`, `model`, `software`, hoặc `service` |
| `license` | ✅ | Định danh SPDX, `proprietary`, hoặc `none`. `none` nghĩa là không có giấy phép công khai — được xử lý như bảo lưu mọi quyền |
| `access` | ✅ | `bundled` (nằm trong thư mục phương thức), `mirrored` (được tải khi cài đặt, ghim phiên bản, đưa vào bản nộp), `gateway` (suy luận LLM tại thời điểm chạy qua cổng kết nối đánh giá), `external-api` (bất kỳ lệnh gọi mạng nào khác tại thời điểm chạy) |
| `source` | ✅ | URL chuẩn hoặc định danh `provider:slug` |
| `pin` | cho `mirrored` | Phiên bản, commit, hoặc mã băm nội dung (content hash) để ghim chính xác tài nguyên |
| `substitutable` | cho `gateway`/`external-api` | Liệu có bất kỳ điểm cuối tương thích nào có thể phục vụ phụ thuộc này không |
| `redistributable` | ✅ | Liệu giấy phép có cho phép phân phối lại tài nguyên hay không |
| `transferable` | ✅ | Liệu tài nguyên (hoặc quyền đối với nó) có thể chuyển giao cho cộng đồng theo các điều khoản chuyển giao giải thưởng hay không |
| `notes` | ❌ | Ngữ cảnh tự do |

**Suy luận lớp.** Mỗi phụ thuộc đóng góp một lớp; lớp `dependency_class` của phương thức là lớp hạn chế nhất:

| Hồ sơ phụ thuộc | Đóng góp |
|--------------------|-------------|
| `bundled` + giấy phép cho phép phân phối lại và chuyển giao | S |
| `mirrored` + giấy phép mở cho phép phân phối lại (bao gồm cả copyleft) | O |
| `gateway` + `substitutable: true` (suy luận LLM) | A1 |
| `external-api`, hoặc `gateway` với `substitutable: false` | A2 |
| `bundled` + `license: none` hoặc giấy phép không tương thích với phân phối lại | X |

Trường `dependency_class` được khai báo phải khớp với lớp mà hệ thống đánh giá suy ra từ bản kê khai. Sự không khớp sẽ dẫn đến lỗi xác thực.

Một phương thức **không có** phụ thuộc bên ngoài sẽ khai báo `"dependency_class": "S"` và `"dependencies": []`. Mảng rỗng là một tuyên bố khẳng định, được kiểm duyệt giống như bất kỳ khai báo nào khác.

### Cách Xác minh Tính hợp lệ

Ba lớp xác minh, từ chi phí thấp nhất đến đáng tin cậy nhất:

1. **Kiểm duyệt bản kê khai.** Hệ thống đánh giá suy ra lớp hiệu dụng từ bản kê khai và từ chối nếu có sự không khớp. Người kiểm duyệt sẽ đối chiếu từng phụ thuộc được khai báo với giấy phép và nguồn được nêu của nó — một phụ thuộc được khai báo là `redistributable: true` nhưng giấy phép gốc nói ngược lại sẽ không vượt qua vòng kiểm duyệt.
2. **Phân tích tĩnh.** Mã nguồn được nộp sẽ được quét để tìm các lệnh gọi mạng, tải xuống động và truy cập hệ thống tệp không được ghi nhận trong bản kê khai. Một phụ thuộc *không khai báo* được phát hiện trong quá trình kiểm duyệt sẽ là căn cứ để loại bỏ bản nộp bất kể nó thuộc lớp nào — bản kê khai phải đầy đủ, chứ không chỉ chính xác.
3. **Chính sách mạng của sandbox.** Thông số kỹ thuật của sandbox yêu cầu **từ chối truy cập mạng ra ngoài mặc định (default-deny egress)**: các container phương thức không có quyền truy cập mạng trừ khi một đường dẫn được đưa vào danh sách cho phép (allowlist) một cách rõ ràng. Đường dẫn ra ngoài duy nhất mà thông số kỹ thuật định nghĩa là **cổng kết nối LLM (LLM gateway)** — một proxy suy luận được vận hành bởi hạ tầng đánh giá, giới hạn trong một danh sách cho phép rõ ràng các mô hình được ghim phiên bản, với mọi yêu cầu và phản hồi đều được ghi nhật ký (log) để kiểm duyệt sau lượt chạy. Bất kỳ thứ gì không có trong danh sách cho phép sẽ thất bại ở lớp mạng, chứ không phải ở lớp chính sách. Xem [Thông số Đánh giá hiệu năng §8.6](/docs/network/specifications/benchmark) để biết thiết kế chính sách mạng và cổng kết nối.

> **Hai sandbox khác nhau — một được lên kế hoạch, một đang hoạt động.** Hãy đọc kỹ phần này, vì từ "sandbox" bao gồm hai thứ khác biệt:
>
> - 🔲 **Được lên kế hoạch: sandbox nền tảng và cổng LLM của nó.** Môi trường do hạ tầng đánh giá vận hành được mô tả trong phần này — môi trường có cổng LLM cho phép các phương thức Class A1 tạo ra điểm số tiêu chuẩn vàng (gold-standard) chính thức — đã được đặc tả nhưng chưa được xây dựng. Cho đến khi hoàn thành, các phương thức Class A1 *về nguyên tắc* vẫn đủ điều kiện nhận giải thưởng nhưng chưa thể tạo ra điểm số tiêu chuẩn vàng chính thức.
> - ✅ **Đang hoạt động: luồng thực thi phương thức của nút tổ chức (organizer-node).** Nút chấm điểm của chính nhà tổ chức cuộc thi đã thực thi các gói phương thức được đề xuất bên trong một container cách ly mạng (`mt-eval node run-method`): được xây dựng và chạy bằng `--network=none`, root chỉ đọc, các phần phụ thuộc được đóng gói sẵn (vendored) — điều này giới hạn nó ở các phương thức không cần mạng khi chạy (Class S/O theo thiết kế). Nó có thể chạy trên một máy tính cách ly hoàn toàn (true-airgap) với các gói chỉ chứa điểm số được ký truyền qua thiết bị lưu trữ di động. Xem [Chạy một cuộc thi độc lập](/docs/network/sovereignty/run-a-sovereign-contest) để biết quy trình từ đầu đến cuối.
>
> Phần này mô tả những gì đặc tả nền tảng yêu cầu, không phải những gì hiện đang chạy trên nền tảng.

### Hiển thị trên Bảng xếp hạng

- Bảng xếp hạng hiển thị lớp phụ thuộc của mỗi phương thức bên cạnh huy hiệu lớp phương thức của nó.
- Các phương thức Lớp A2 trên bảng xếp hạng mở sẽ mang một nhãn **"phụ thuộc bên ngoài" (external dependency)** hiển thị rõ ràng: điểm số của chúng phụ thuộc vào một dịch vụ bên thứ ba có thể thay đổi hoặc biến mất, và chúng hiện không đủ điều kiện nhận giải thưởng.
- Các phương thức Lớp X không được liệt kê.

## Hệ thống Đánh giá: Giao thức TranslationMethod {#eval-harness-translationmethod-protocol}

Hệ thống kiểm thử (eval harness) sử dụng structural typing của Python (`Protocol`) cho các plugin. Bất kỳ class nào có các thành phần (member) phù hợp đều hoạt động được — không cần kế thừa. Giao thức này có **ba** thành phần bắt buộc, chứ không chỉ `translate`:

1. **`name`** (`str`) — tên phương thức thân thiện với người dùng, được sử dụng trong ID lượt chạy và nhật ký (log).
2. **`method_card()`** (`-> dict | None`) — siêu dữ liệu (metadata) của phương thức để theo dõi nguồn gốc, được nhúng trong nhật ký lượt chạy và thẻ lượt chạy (run card) được xuất bản. Trả về `None` nếu phương thức không có thẻ.
3. **`async translate(entries, config)`** (`-> list[dict]`) — chính là bản dịch: một loạt các mục đầu vào, trả về một dict kết quả cho mỗi mục đầu ra.

Khi hệ thống kiểm thử tải một plugin thông qua `--method path/to/dir`, nó sẽ xác thực rằng `translate` có thể gọi được (callable), sau đó đọc `method.name` và gọi `method.method_card()` một cách vô điều kiện — plugin thiếu một trong hai thành phần này sẽ bị sập tại thời điểm tải, chứ không thất bại một cách êm đẹp.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

Thư mục plugin cần một tệp manifest `method.json` với ít nhất `name` và `entry_point` (`"module_name:ClassName"` — module được tải từ thư mục plugin và class được khởi tạo). Nếu một thẻ phương thức được trả về khai báo một `class` hoặc `paradigm`, nó phải sử dụng từ vựng chuẩn hóa ở trên — một thẻ không thuộc phân loại chuẩn sẽ không vượt qua bước xác thực tại thời điểm tải thay vì âm thầm biến mất khỏi các bộ lọc của bảng xếp hạng.

Để xem ví dụ thực tế đầy đủ — xây dựng, chạy và gửi một plugin từ đầu đến cuối — hãy xem [Gửi một phương thức](/docs/network/getting-started/submit-a-method) và [hướng dẫn FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline).

## Champollion: Cấu hình methodPlugin

Trong Champollion, các phương thức được đăng ký theo từng cặp ngôn ngữ trong `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Xem [Thông số Plugin](https://champollion.dev/docs/reference/plugin-spec) để biết giao diện phía Champollion.

## Tích hợp Bảng xếp hạng

Khi một thẻ phương thức được đính kèm vào một lượt chạy (thông qua `--method-card`), nó sẽ được nhúng vào thẻ lượt chạy và hiển thị trên bảng xếp hạng:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Nếu không cung cấp `--method-card`, `mt-eval publish` sẽ khởi chạy một trình hướng dẫn tương tác để dẫn dắt bạn qua các bước mô tả phương thức của mình.

Bảng xếp hạng hiển thị:
- **Huy hiệu lớp (Class badge)** — chỉ báo trực quan (ví dụ: "pipeline", "coached-llm")
- **Mô hình dịch (Paradigm)** — mô hình thuật toán (ví dụ: "rule-based", "neural-nmt", "llm", "hybrid"), một cột có thể lọc (xem [Mô hình dịch](#paradigms))
- **Lớp phụ thuộc (Dependency class)** — S/O/A1/A2 (xem [Tính hợp lệ của Phương thức và Lớp Phụ thuộc](#method-validity-and-dependency-classes)); các phương thức A2 mang nhãn "phụ thuộc bên ngoài"
- **Tên phương thức** — lấy từ thẻ phương thức
- **Công cụ được sử dụng** — được liệt kê từ thẻ phương thức
- **Chỉ báo mã nguồn mở**

Khi không có thẻ phương thức nào được đính kèm, bảng xếp hạng sẽ hiển thị cấu hình gốc của hệ thống đánh giá (mô hình, phiên bản prompt, độ sáng tạo - temperature, các công cụ được kích hoạt).

:::danger[KHÔNG HUẤN LUYỆN trên dữ liệu đánh giá]
Các phương thức có quy trình phát triển bao gồm việc tiếp xúc với tập dữ liệu đánh giá — dưới dạng dữ liệu huấn luyện, ví dụ few-shot, mục từ điển hoặc tài liệu tinh chỉnh prompt — sẽ bị **loại** khỏi bảng xếp hạng. Xem [Đánh giá dịch máy (MT Evaluation)](/docs/network/leaderboard/rules) để biết điều gì phân biệt một phương thức tốt và một phương thức không tốt.
:::

---

## Xem thêm

- [Đánh giá dịch máy (MT Evaluation)](/docs/network/leaderboard/rules) — tổng quan, giá trị bảng xếp hạng, và hướng dẫn về phương thức tốt/không tốt
- [Hệ thống Đánh giá (Eval Harness)](/docs/network/specifications/harness) — cách chạy các đánh giá
- [Bộ dữ liệu Đánh giá](/docs/network/leaderboard/datasets) — các bộ dữ liệu có sẵn (EDTeKLA, FLORES+)
- [Thông số Thẻ Lượt chạy (Run Card Specification)](/docs/network/specifications/run-card) — schema JSON của thẻ lượt chạy
- [Thông số Plugin](https://champollion.dev/docs/reference/plugin-spec) — giao diện plugin phía Champollion
- [Bảng xếp hạng Phương thức](https://champollion.dev/leaderboard) — điểm số đánh giá hiệu năng trực tiếp
- [Thông số Đánh giá hiệu năng (Benchmark Specification)](/docs/network/specifications/benchmark) — giao thức đánh giá, định dạng ngữ liệu, schema thẻ lượt chạy
- [Thông số Tính điểm (Scoring Specification)](/docs/network/specifications/scoring) — SSOT cho các chỉ số, trọng số tổng hợp, và các phân khúc chất lượng
