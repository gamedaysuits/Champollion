---
sidebar_position: 0
title: "Khi bạn muốn tự huấn luyện mô hình của riêng mình"
description: "Hướng dẫn toàn diện (end-to-end) định hướng agent về việc huấn luyện mô hình dịch thuật tài nguyên thấp bằng nmt-forge — bạn chỉ đạo một coding agent, các guardrail sẽ tự động ngăn chặn các lỗi cơ bản."
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Bạn muốn tự huấn luyện mô hình của riêng mình

Đây là hướng dẫn hoàn chỉnh về việc huấn luyện một mô hình dịch máy cho ngôn ngữ nghèo tài nguyên — từ chỗ "tôi nói ngôn ngữ này và hầu như không có dữ liệu" cho đến một mô hình mà bạn có thể báo cáo một cách trung thực và gửi lên [Mạng lưới](/docs/network/). Tài liệu này được viết cho người mới bắt đầu, và giả định cách làm việc hiện đại: **bạn chỉ đạo một agent lập trình** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, hoặc tương tự), và agent đó sẽ chạy các công cụ.

Vì vậy, mỗi bước dưới đây đều có cấu trúc giống nhau:

- 🗣️ **Yêu cầu agent của bạn** — những gì cần hỏi, bằng ngôn ngữ tự nhiên.
- 🛠️ **Công cụ làm gì** — những gì [nmt-forge](/docs/network/getting-started/training-honestly) chạy thay cho bạn, và **hàng rào bảo vệ** (guardrail) giúp phát hiện lỗi kinh điển trước khi nó gây tổn thất cho bạn.
- 👀 **Cách đọc kết quả** — thế nào là "tốt" và những điều cần lưu ý.

:::info[Trước tiên, hãy nắm vững từ vựng]
Nếu các thuật ngữ như *dev set*, *decoding*, *chrF++*, *leakage*, hoặc *round-trip verification* chưa trở nên quen thuộc với bạn, hãy đọc [**Huấn luyện MT bằng ngôn ngữ bình dân**](/docs/network/context/mt-training-concepts) trước — tài liệu này định nghĩa mọi từ ngữ được sử dụng ở đây kèm theo ví dụ thực tế. Trang này sẽ dựa trên tất cả các khái niệm đó.
:::

:::note[Sự trung thực là tính năng, không phải rào cản]
Công cụ này được thiết kế có chủ ý rõ ràng. Các hàng rào bảo vệ của nó tự động hóa việc ngăn chặn những sai lầm thực tế, đã được đo lường từ một dự án thực tế — vì vậy con đường trung thực là mặc định, và các lối tắt không trung thực sẽ **bị từ chối kèm theo thông báo chỉ rõ cách khắc phục**. Khi bạn thấy một thông báo từ chối trong hướng dẫn này, đó là lúc công cụ đang làm đúng nhiệm vụ của nó. Bạn chắc chắn sẽ muốn như vậy.
:::

---

## Những gì bạn cần trước khi bắt đầu

- **Một agent lập trình** có quyền truy cập terminal và hệ thống tệp. Đây là người điều khiển.
- **Một số câu dịch thực tế** cho cặp ngôn ngữ của bạn — ngay cả vài trăm cặp câu do con người dịch cũng là một khởi đầu khả thi. Sách giáo khoa song ngữ, tài liệu lưu trữ cộng đồng, hồ sơ công dịch thuật, tài liệu giáo dục. Chất lượng quan trọng hơn số lượng.
- **Tùy chọn nhưng mạnh mẽ:** văn bản đơn ngữ bằng ngôn ngữ đích của bạn, từ điển song ngữ, tài liệu ngữ pháp tham khảo đã xuất bản, và bộ phân tích hình thái (FST). Bạn **không** cần tất cả những thứ này để bắt đầu — công cụ sẽ cho bạn biết chính xác những gì đang có và những gì sẽ mở khóa các tính năng tương ứng.
- **Tài nguyên tính toán (Compute):** các bước hàng rào bảo vệ, chia tách dữ liệu, tổng hợp, kiểm định và chấm điểm đều chạy được trên máy tính xách tay. Chỉ có bước huấn luyện mô hình thực tế mới cần GPU (và một mô hình nhỏ với LoRA có thể chạy vừa vặn trên phần cứng khiêm tốn).

> 🗣️ **Yêu cầu agent của bạn:** *"Cài đặt nmt-forge từ gói `forge/` của monorepo Champollion và xác nhận lệnh `nmt-forge` hoạt động. Chúng ta sẽ huấn luyện một mô hình dịch tiếng Anh → \<your language\> một cách trung thực."*

Agent của bạn có thể gọi công cụ `get_training_guardrails` của máy chủ Champollion MCP để tải toàn bộ quy tắc — mười hàng rào bảo vệ và lỗi mà mỗi hàng rào loại bỏ — vào ngữ cảnh của chính nó trước khi viết bất kỳ lệnh nào. Nếu bạn đang điều khiển một agent, hãy yêu cầu nó thực hiện việc đó trước tiên.

---

## Bước 1 — Chọn một ngôn ngữ và xem những gì thực sự tồn tại

Mọi dự án đều bắt đầu bằng việc hỏi chỉ mục xem ngôn ngữ đó *có* những gì, một cách trung thực.

> 🗣️ **Yêu cầu agent của bạn:** *"Chạy `nmt-forge discover` cho mã ISO 639-3 của ngôn ngữ đích của tôi và tóm tắt những dữ liệu nào đang tồn tại và những gì còn thiếu."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Công cụ làm gì.** Nó đọc **thẻ (card)** Champollion của ngôn ngữ — nguồn thông tin đáng tin cậy duy nhất (single source of truth) về những gì đã biết về ngôn ngữ đó — và báo cáo các hệ chữ viết, bộ phân tích hình thái, từ điển, kho ngữ liệu và tập dữ liệu đánh giá (eval dataset) mà nó ghi nhận, sau đó xếp ngôn ngữ vào **thang tài sản (asset ladder)**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Cách đọc kết quả.** Các ký hiệu `✓` là những gì bạn có thể làm ngay bây giờ; các ký hiệu `?` là các nấc thang đang chờ tài sản tương ứng. Quan trọng là, **việc thiếu thông tin trên thẻ có nghĩa là *chưa biết*, chứ không bao giờ có nghĩa là "ngôn ngữ này không có gì".** Một tấm thẻ thưa thớt thông tin là lời mời gọi bạn bổ sung những gì mình biết, chứ không phải là ngõ cụt — và ngay cả một tấm thẻ trống trơn cũng giúp bạn có được chu trình huấn luyện được bảo vệ đầy đủ ở nấc thang 1. Một tấm thẻ phong phú (như Plains Cree) sẽ tự động kết nối các nấc thang phía trên: các tập đánh giá của nó sẽ đi kèm cờ đánh dấu **KHÔNG BAO GIỜ HUẤN LUYỆN TRÊN DỮ LIỆU NÀY**, và trọng tài đặc thù cho ngôn ngữ đó đã sẵn sàng để tích hợp.

Sau đó, khởi tạo khung (scaffold) dự án:

> 🗣️ **Yêu cầu agent của bạn:** *"Khởi tạo khung dự án với `nmt-forge init` cho cặp ngôn ngữ này và đọc cho tôi tệp `NEXT_STEPS.md` mà nó tạo ra."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Thao tác này sẽ tạo ra một không gian làm việc (thư mục `.forge/` mà mọi hàng rào bảo vệ đều tham chiếu), một **cấu hình khởi đầu**, và một bản tóm tắt `NEXT_STEPS.md` được viết cho *bạn và agent của bạn* — thứ tự câu lệnh, thang tài sản cho ngôn ngữ của bạn, và những điều khoản không thể thương lượng. Đây là bản đồ cho mọi bước bên dưới.

---

## Bước 2 — Trỏ đến bộ phân tích và từ điển (nếu bạn có)

Bước này liên quan đến **nấc thang 3–4** của thang tài sản. Nếu ngôn ngữ của bạn không có bộ phân tích, hãy bỏ qua và chuyển đến [Bước 4](#step-4--split-your-real-data-safely) — bạn sẽ chỉ huấn luyện trên dữ liệu thực tế (và dịch ngược), đây là một lộ trình hoàn toàn hợp lệ.

Nếu bộ phân tích và từ điển *thực sự* tồn tại, chúng sẽ mở khóa khả năng *sản xuất* dữ liệu huấn luyện đã được xác minh — đòn bẩy lớn nhất đối với một ngôn ngữ có ít văn bản song ngữ.

> 🗣️ **Yêu cầu agent của bạn:** *"Thẻ ghi nhận một bộ phân tích hình thái và một từ điển cho ngôn ngữ này. Hãy tải chúng theo hướng dẫn cài đặt trên thẻ, trỏ gói ngôn ngữ (language pack) đến chúng thông qua các biến môi trường đã được tài liệu hóa, và xác nhận bộ phân tích có thể xác minh hai chiều (round-trip) một vài từ đã biết."*

🛠️ **Công cụ làm gì — và ranh giới mà nó sẽ không vượt qua.** Các bộ phân tích (FST) và từ điển là **các công cụ riêng biệt do người dùng tự tải về theo giấy phép riêng của chúng**. Bộ công cụ **không bao giờ đóng gói sẵn hoặc phân phối lại chúng** — nó chỉ hướng dẫn bạn nơi tải và giấy phép của chúng là gì, và bạn tự tải về. Đây không phải là thủ tục hành chính rườm rà: nhiều tài nguyên ngôn ngữ mang những ràng buộc thực tế về quyền hạn và chủ quyền, và công cụ này tôn trọng điều đó ngay từ thiết kế.

Thành phần kết nối là một **gói ngôn ngữ (language pack)**: một plugin nhỏ giúp điều chỉnh bộ phân tích, từ điển, quy tắc chính tả và các mẫu câu trích dẫn ngữ pháp của *bạn* tương thích với công cụ. Bản thân bộ công cụ **không** đi kèm bất kỳ gói ngôn ngữ nào — các gói này tồn tại cùng với ngôn ngữ của chúng (ví dụ: gói Plains Cree nằm trong dự án riêng của nó và được cắm vào thông qua đường dẫn mô-đun).

👀 **Cách đọc kết quả.** Bạn muốn bộ phân tích thực hiện **xác minh hai chiều (round-trip)**: viết ra một dạng từ, đưa cách viết đó ngược trở lại, và nhận được cùng một thẻ ngữ pháp. Nếu không, hàm **chuẩn hóa (canonicalizer)** của gói ngôn ngữ — hàm duy nhất chuẩn hóa chính tả bất cứ khi nào hai thành phần gặp nhau — có lẽ cần thêm một quy tắc. Việc làm đúng điều này rất quan trọng: một ký tự chưa được đối chiếu duy nhất (`ý` so với `y`) từng âm thầm xóa bỏ 1.375 động từ khỏi một quy trình tạo dữ liệu trong nhiều tuần. Tính năng **kiểm định phễu (funnel audit)** của công cụ sẽ đếm chính xác số lượng dữ liệu còn sót lại ở mỗi giai đoạn để lỗi biến mất âm thầm như vậy không thể ẩn giấu.

---

## Bước 3 — Tổng hợp dữ liệu huấn luyện từ các quy tắc ngữ pháp

Với một bộ phân tích + từ điển + một gói các mẫu câu trích dẫn ngữ pháp, bạn can sản xuất hàng trăm nghìn cặp câu đã được xác minh.

> 🗣️ **Yêu cầu agent của bạn:** *"Tạo dữ liệu huấn luyện tổng hợp bằng `nmt-forge synth` bằng cách sử dụng gói ngôn ngữ của chúng ta, sau đó hiển thị cho tôi báo cáo độ bao phủ."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Công cụ làm gì — luật xuất dữ liệu (emit law).** Mỗi hàng dữ liệu đầu ra phải thỏa mãn các quy tắc mà không gói ngôn ngữ nào có thể bỏ qua:

- **Được xác minh hai chiều (Round-trip verified)** — mọi từ được tạo ra đều phải vượt qua bước *tạo → phân tích → cùng kết quả phân tích*, nếu không hàng đó sẽ bị loại bỏ. Không có dạng từ chưa xác minh nào được phép xuất ra.
- **Được trích dẫn ngữ pháp (Grammar-cited)** — mọi loại mẫu câu đều phải trích dẫn tài liệu ngữ pháp đã xuất bản mà nó mô phỏng. Các mẫu câu không có trích dẫn sẽ không tồn tại; mã nguồn sẽ từ chối tải chúng.
- **Được kiểm tra độ bao phủ (Coverage-checked)** — các mẫu câu được đối chiếu với một danh sách kiểm tra các hiện tượng ngữ pháp bắt buộc (câu mệnh lệnh, câu hỏi, sở hữu, dạng nghịch đảo...). Nếu một hiện tượng *bắt buộc* có không ví dụ nào, quá trình xây dựng sẽ thất bại. Đây là chốt chặn chống lại bẫy "một triệu câu nhưng chỉ có vài cấu trúc lặp đi lặp lại" — số lượng lớn che giấu các lỗ hổng cấu trúc.
- **Được đóng dấu nguồn gốc (Provenance-stamped)** — mọi hàng dữ liệu tổng hợp đều được đánh dấu `synthetic: true`. Con dấu này có vai trò chịu lực: hệ thống đăng ký sẽ **từ chối** đăng ký các hàng dữ liệu tổng hợp làm tập kiểm thử (test set). Tập kiểm thử chỉ được phép chứa dữ liệu thực tế.

👀 **Cách đọc kết quả.** Hãy xem báo cáo độ bao phủ để tìm **các mục bắt buộc có độ bao phủ bằng không** (một hiện tượng ngữ pháp mà các mẫu câu của bạn chưa bao giờ tạo ra) và xem **phân phối loại mẫu câu (kind distribution)** — nếu có hai dạng mẫu câu chiếm ưu thế, giới hạn cho mỗi loại của bộ lấy mẫu (mặc định là 15%) sẽ cân bằng lại chúng để không một mẫu đơn lẻ nào chiếm tới một nửa trải nghiệm học của mô hình.

:::tip[Không có bộ phân tích? Hãy sử dụng dịch ngược (backtranslation) thay thế]
Nếu bạn không thể tổng hợp từ các quy tắc nhưng có văn bản **đơn ngữ** bằng ngôn ngữ đích, hãy yêu cầu agent của bạn chạy luồng **dịch ngược (backtranslation)**: `nmt-forge backtranslate` sẽ dịch máy văn bản đơn ngữ của bạn *sang* tiếng Anh và ghép cặp mỗi kết quả với câu đích **thực tế**. Phía ngôn ngữ đích vẫn giữ được sự nguyên bản. Công cụ sẽ **kiểm định rò rỉ dữ liệu (leak-audit) trên văn bản đơn ngữ trước** — vì văn bản đó có thể đang âm thầm *chính là* dữ liệu đánh giá của bạn. Xem [Hướng dẫn dịch ngược](/docs/network/tutorials/back-translation).
:::

---

## Bước 4 — Chia tách dữ liệu thực tế của bạn một cách an toàn

Bây giờ, hãy lấy các cặp câu **thực tế** của bạn và chia chúng thành các tập train / dev / test. Đây là nơi ẩn náu của sai lầm hủy hoại kết quả nghiêm trọng nhất trong dịch máy nghèo tài nguyên, và là nơi hàng rào bảo vệ chứng minh giá trị của nó.

> 🗣️ **Yêu cầu agent của bạn:** *"Chia tách kho ngữ liệu thực tế thành tập test và dev bằng `nmt-forge split`, theo phương pháp nhóm không giao nhau (group-disjoint), và đăng ký chúng. Sử dụng một seed cố định để đảm bảo khả năng tái lặp."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Công cụ làm gì — chốt chặn chia tách (split-guard).** Nó thực hiện **chia tách nhóm không giao nhau (group-disjoint splitting)**: mọi cặp câu chia sẻ chung một câu nguồn *hoặc* câu đích sẽ được liên kết vào một nhóm, và toàn bộ nhóm đó sẽ nằm hoàn toàn ở một phía. Sau đó, nó **xác minh không có sự trùng lặp nào** và từ chối tiếp tục nếu phát hiện bất kỳ sự trùng lặp nào.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Điều này loại bỏ **rò rỉ "Feed him" / "Feed her" leak**: một sách giáo khoa ánh xạ cả hai câu luyện tập tiếng Anh này sang cùng một từ đích (`asam`); việc chia tách ngẫu nhiên ngây thơ sẽ đưa một bản sao vào tập train và bản sao song sinh của nó vào tập test, khiến mô hình "vượt qua" nhờ ghi nhớ máy móc. Trong một dự án thực tế, 17 trong số 54 hàng kiểm thử đã bị rò rỉ theo cách này và đạt điểm số 83 so với 44 của các hàng sạch — và mọi phát hiện dựa trên con số đó đều vô giá trị. `--register textbook` ghi lại các tập dev và test (dưới dạng `textbook-dev` và `textbook-test`) trong không gian làm việc để mọi lệnh sau này đều biết rằng chúng là *các tập đánh giá mà bạn không bao giờ được phép huấn luyện trên đó*.

👀 **Cách đọc kết quả.** Bạn muốn thấy dòng **verified: 0 shared** (đã xác minh: 0 chia sẻ). Nếu thay vào đó bạn nhận được một thông báo `SplitLeakageError`, đừng xóa các hàng bằng tay — việc đó chỉ làm xáo trộn lại vấn đề. Hãy chạy lại bước chia tách nhóm không giao nhau; đó mới là cách khắc phục, và thông báo lỗi cũng chỉ rõ điều đó.

:::danger[Không bao giờ huấn luyện trên một benchmark]
Nếu bạn lấy một tập dữ liệu đánh giá từ hệ thống đăng ký chung (`nmt-forge registry add-harness`), công cụ sẽ đóng dấu và coi nó là vùng cấm đối với việc huấn luyện — **mọi** benchmark trong hệ thống đăng ký đều được gắn cờ *do-not-train* (không huấn luyện). Hãy tinh chỉnh (fine-tune) trên bất kỳ dữ liệu nào bạn có một cách hợp pháp; chỉ là không bao giờ được huấn luyện trên tập test. Đây là [quy tắc duy nhất](/docs/network/leaderboard/rules) của toàn bộ Mạng lưới.
:::

---

## Bước 5 — Huấn luyện

Một tệp cấu hình mô tả toàn bộ lượt chạy; một câu lệnh thực thi nó, đảm bảo khả năng tái lặp.

> 🗣️ **Yêu cầu agent của bạn:** *"Điền vào cấu hình huấn luyện — trỏ `dev` vào tập dev đã đăng ký của chúng ta, liệt kê các luồng dữ liệu chuẩn (gold) và dữ liệu tổng hợp (synthetic), chọn một mô hình nền tảng nhỏ với LoRA — sau đó chạy `nmt-forge run` và theo dõi các chẩn đoán tiến trình (schedule diagnostics)."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Công cụ làm gì — bốn hàng rào bảo vệ cùng một lúc.**

- **Kiểm định rò rỉ trước khi huấn luyện (Leak-audit).** *Mọi* luồng dữ liệu — dữ liệu chuẩn (gold), dữ liệu tổng hợp (synthetic) và bất kỳ văn bản dịch ngược nào — đều được sàng lọc đối chiếu với *mọi* tập đánh giá đã đăng ký. Các trường hợp trùng khớp hoàn toàn, trùng khớp gần như hoàn toàn (được diễn đạt lại) và trùng khớp toàn bộ tệp trên một tập test đều được coi là lỗi nghiêm trọng. Không có gì được huấn luyện cho đến khi hỗn hợp dữ liệu hoàn toàn sạch sẽ.
- **Rào chắn tập dev (Dev-fence).** Quá trình huấn luyện **sẽ từ chối bắt đầu nếu không có tập dev đã đăng ký**, và nó sẽ chỉ chọn các checkpoint dựa trên tập dev đó — không bao giờ dựa trên tập test. (Nó thậm chí còn kiểm tra nội dung các hàng trong tập dev đối chiếu với tập test để phát hiện mánh khóe `cp test.jsonl dev.jsonl`.) Việc lựa chọn checkpoint có thể sử dụng **loss** của tập dev hoặc một **chỉ số tạo văn bản (generation metric)** của tập dev — giải mã tập dev và chấm điểm đầu ra thực tế, đây là tín hiệu trung thực hơn.
- **Độ hợp lý của tiến trình (Schedule-sanity).** Nếu hỗn hợp dữ liệu của bạn chứa nhiều dữ liệu tổng hợp, công cụ sẽ *suy ra* một ngưỡng dừng tối thiểu từ kích thước hỗn hợp của bạn và duy trì việc huấn luyện vượt qua **vùng bình nguyên (plateau)** — giai đoạn mà mô hình đã hoàn thành việc học dữ liệu tổng hợp dễ dàng nhưng chưa chuyển đổi sang chất lượng thực tế. Điều này ngăn chặn "cái chết ở nửa epoch", nơi việc dừng sớm một cách ngây thơ sẽ kết thúc quá trình huấn luyện ở mức một phần hai mươi kế hoạch. Mỗi lần can thiệp đều in ra quỹ đạo loss của tập dev và lý do bằng ngôn ngữ dễ hiểu.
- **Toán học về mức độ tiếp xúc + đánh dấu dữ liệu tổng hợp.** Dữ liệu chuẩn (gold) được tăng trọng số (lặp lại) để lượng dữ liệu thực tế ít ỏi không bị lấnát; tệp kê khai (manifest) sẽ ghi lại **mức độ tiếp xúc hiệu dụng trên mỗi câu duy nhất (effective exposure per unique sentence)** để đảm bảo thử nghiệm A/B diễn ra công bằng. Các nguồn dữ liệu tổng hợp sẽ mang một thẻ đánh dấu (tag); dữ liệu chuẩn thì không để nó định hình phong cách đầu ra.

👀 **Cách đọc kết quả.** Lượt chạy sẽ in ra một **báo cáo tập dev kèm theo khoảng tin cậy (confidence intervals)** — không có đầu ra điểm số đơn thuần nào:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Nếu bạn thấy một thông báo `schedule-sanity` giải thích rằng nó đã *giữ* quá trình huấn luyện vượt qua điểm dừng sớm, đó là lúc chốt chặn vùng bình nguyên đang hoạt động tốt. Lượt chạy cũng ghi lại một **tệp kê khai (manifest)**: hash cấu hình, hash tệp dữ liệu, các seed và tiến trình được suy ra, nhờ đó toàn bộ lượt chạy có thể được tái lặp.

---

## Bước 6 — Đánh giá một cách trung thực

Bạn đã có một mô hình. Trước khi bạn chấm điểm nó trên tập test, bạn phải viết ra những gì mình kỳ vọng — *trước tiên*.

> 🗣️ **Yêu cầu agent của bạn:** *"Viết một bản đăng ký trước (preregistration) cho việc chấm điểm tập test — chỉ số dự đoán, hướng thay đổi và biên độ của chúng ta — sau đó giải mã tập test và chấm điểm nó."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Công cụ làm gì — các chốt chặn chống thêu dệt câu chuyện (anti-storytelling guards).**

- **Đăng ký trước (Preregistration).** Việc chấm điểm một tập **test** đã đăng ký yêu cầu phải có một bản đăng ký trước được viết *trước khi* xem kết quả lần đầu tiên. Nếu không có nó, bảng so sánh đơn giản là sẽ **từ chối hiển thị**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Đây là chốt chặn chống lại việc biến các suy đoán sau sự thật (postdictions - ví dụ: "tất nhiên là nó đã cải thiện trên các câu chuyện truyền miệng") thành các dự đoán trước sự thật (predictions). Việc viết ra những dự đoán *thất bại* chính là điều làm cho những dự đoán thành công trở nên đáng tin cậy.
- **Luôn có khoảng tin cậy.** Mọi điểm số đều được hiển thị cùng với khoảng tin cậy (CI) bootstrap 95% của nó; không có đầu ra nào thiếu CI. Một mức tăng `+0.5` mà các khoảng tin cậy của chúng chồng lấn lên nhau thì không được coi là một chiến thắng.
- **Sổ cái đánh giá (eval-ledger).** Mọi lượt đọc của mỗi tập đánh giá đều được ghi nhật ký (chỉ thêm mới - append-only, chống giả mạo - tamper-evident). Hãy hỏi `nmt-forge ledger show --set textbook-test` xem một tập dữ liệu đã bị "hao mòn" (spent) như thế nào. Các tập dữ liệu **được niêm phong (sealed)** là loại dùng một lần — được chấm điểm một lần, sau đó đóng lại.

👀 **Cách đọc kết quả.** Hãy đọc con số **cùng với khoảng tin cậy của nó và theo từng phong cách ngôn ngữ (register)**, đồng thời kiểm tra xem **nên tin vào chỉ số nào** trước khi ăn mừng:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` hiển thị **độ tin cậy đã được đo lường** của từng chỉ số đối với ngữ hệ của bạn (từ các đánh giá meta của WMT). Đối với một số ngữ hệ, một chỉ số như BLEU hầu như không bám sát đánh giá của con người trong khi COMET lại làm được; đối với nhiều ngữ hệ nghèo tài nguyên, câu trả lời trung thực là *chưa được đo lường* — trong trường hợp đó, đánh giá của người bản xứ, chứ không phải bất kỳ con số tự động nào, mới là tín hiệu thực tế. Xem [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability).

:::tip[Trọng tài riêng của ngôn ngữ của bạn]
Nếu ngôn ngữ của bạn có tiêu chuẩn đánh giá LYSS (một công cụ linter biết rằng, ví dụ, hai cách viết chỉ khác nhau bởi một quy ước nguyên âm dài đã được tài liệu hóa), hãy tích hợp nó bằng `--plugin` và nó sẽ chấm điểm song song với chrF++ — thậm chí có thể *chọn* các checkpoint, nhờ đó mô hình chiến thắng sẽ là mô hình được chính trọng tài của ngôn ngữ đó ưu tiên. Mọi con số từ plugin cũng đều có khoảng tin cậy đi kèm.
:::

---

## Bước 7 — Lặp lại (Iterate)

Bây giờ bạn tiến hành cải tiến — và mọi cải tiến đều được đo lường theo cùng một cách trung thực.

> 🗣️ **Yêu cầu agent của bạn:** *"Thay đổi một thứ — thêm một loại mẫu câu / thêm dữ liệu dịch ngược / sử dụng một mô hình nền tảng khác — huấn luyện lại, và thử nghiệm A/B nó với lượt chạy trước đó trên tập dev, có tính đến ý nghĩa thống kê (significance)."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Công cụ làm gì.** `compare` chạy một **phép kiểm thử ý nghĩa thống kê theo cặp (paired significance test)**, chứ không chỉ là một phép trừ đơn thuần, nhờ đó khẳng định "B vượt trội hơn A" là một tuyên bố được số liệu thống kê hỗ trợ — chứ không phải là nhiễu. Hãy lặp lại trên tập **dev** (đó là mục đích của tập này); giữ tập **test** cho các lần kiểm tra không thường xuyên và đã được đăng ký trước; giữ bất kỳ tập **được niêm phong (sealed)** nào cho bước cuối cùng.

👀 **Cách đọc kết quả.** Một cải tiến thực sự sẽ vượt qua khoảng tin cậy của nó *và* phép kiểm thử ý nghĩa thống kê. Nếu không, dù sao bạn cũng đã học được một điều gì đó — rằng đòn bẩy đó yếu hơn bạn kỳ vọng, điều này rất đáng để biết. Các chốt chặn vùng bình nguyên/độ bao phủ/rò rỉ đồng nghĩa với việc các con số bạn đang so sánh là đáng tin cậy, vì vậy bạn thực sự có thể tin tưởng vào chu trình lặp lại của chính mình.

Các đòn bẩy tiếp theo phổ biến, được sắp xếp sơ bộ theo thứ tự hiệu quả mang lại cho một ngôn ngữ khan hiếm dữ liệu:

1. **Tăng độ bao phủ** trong quá trình tổng hợp — thêm các hiện tượng ngữ pháp còn thiếu mà báo cáo độ bao phủ đã gắn cờ cảnh báo.
2. **Dịch ngược (Backtranslation)** — chuyển đổi văn bản đơn ngữ đích thành nhiều cặp câu huấn luyện hơn.
3. **Một mô hình nền tảng lớn hơn hoặc phù hợp hơn**, hoặc tinh chỉnh LoRA rank/siêu tham số (hyperparameter).
4. **Giáo trình huấn luyện (Curriculum)** — tiền huấn luyện (pretrain) trên dữ liệu tổng hợp, sau đó tinh chỉnh (finetune) trên các cặp câu thực tế.

---

## Bước 8 — Đưa mô hình lên Mạng lưới

Một mô hình được huấn luyện một cách trung thực chính xác là những gì [Mạng lưới Champollion](/docs/network/) được xây dựng để tiếp nhận.

> 🗣️ **Yêu cầu agent của bạn:** *"Đóng gói mô hình này dưới dạng một phương pháp (method) và gửi nó lên bảng xếp hạng cho cặp ngôn ngữ của chúng ta."*

- **[Gửi một phương pháp](/docs/network/getting-started/submit-a-method)** sẽ biến mô hình của bạn thành một mục nhập trên Mạng lưới, được chấm điểm trên các kho ngữ liệu tham chiếu công khai và được ghi nhận đóng góp cho bạn.
- Bởi vì quá trình đánh giá của bạn rất sạch sẽ — chia tách nhóm không giao nhau, có rào chắn tập dev, được kiểm định rò rỉ dữ liệu, có khoảng tin cậy, được đăng ký trước — bài nộp của bạn sẽ vượt qua được sự kiểm duyệt khắt khe vốn thường đánh sập hầu hết các tuyên bố về dịch máy nghèo tài nguyên khác. Kiến trúc chống gian lận (các tập test bí mật do cộng đồng sở hữu, kiểm tra khả năng tái lặp, xác thực bởi người bản xứ) không phải là rào cản đối với một mô hình được xây dựng theo cách này; trái lại, nó là một con dấu chứng nhận mức độ uy tín.
- Nếu có một **giải thưởng** đang mở cho ngôn ngữ của bạn, một phương pháp hiện có, tốt hơn mức cơ sở (baseline) được xây dựng một cách trung thực chính là những gì một quỹ tài trợ sẽ phần thưởng. Và khi một phương pháp hoạt động hiệu quả cho một ngôn ngữ bản địa, **quyền sở hữu có thể được chuyển giao cho cộng đồng** — bạn xây dựng nó ở đây và họ triển khai nó, theo các điều khoản của riêng họ. Xem [Quy định giải thưởng](/docs/network/specifications/prizes) và [Chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer).

---

## Toàn bộ hành trình, tóm gọn trong một hơi thở

1. **Khám phá** những gì ngôn ngữ đang có (`discover`, `init`) — sự vắng mặt thông tin nghĩa là chưa biết, chứ không phải bằng không.
2. **Trỏ đến** bộ phân tích + từ điển nếu chúng tồn tại (nấc thang 3–4), tôn trọng giấy phép của chúng.
3. **Tổng hợp** dữ liệu huấn luyện đã được xác minh, trích dẫn và kiểm tra độ bao phủ (`synth`) — hoặc **dịch ngược** văn bản đơn ngữ.
4. **Chia tách** dữ liệu thực tế theo nhóm không giao nhau và đăng ký các tập đánh giá (`split`).
5. **Huấn luyện** một cấu hình, có rào chắn tập dev, được kiểm định rò rỉ dữ liệu, nhận biết vùng bình nguyên (`run`).
6. **Đánh giá** với các dự đoán được viết ra trước tiên, luôn có khoảng tin cậy (CI), sử dụng đúng chỉ số (`prereg`, `score`).
7. **Lặp lại** với các thử nghiệm A/B được kiểm thử ý nghĩa thống kê (`compare`).
8. **Gửi** lên Mạng lưới — nơi làm việc trung thực là mục tiêu cốt lõi.

Bạn không bao giờ phải học thuộc lòng mười cách khiến kết quả dịch máy nghèo tài nguyên đi chệch hướng. Công cụ này đã biến con đường trung thực thành mặc định và từ chối các lối tắt kèm theo lời giải thích. Đó chính là toàn bộ ý tưởng: **các hàng rào bảo vệ sẽ ngăn chặn các lỗi nghiệp dư để bạn có thể tập trung vào chính ngôn ngữ đó.**

## Tiếp tục tìm hiểu

- [**Huấn luyện MT bằng ngôn ngữ bình dân**](/docs/network/context/mt-training-concepts) — mọi thuật ngữ ở đây, được định nghĩa kèm theo ví dụ.
- [**Huấn luyện mô hình một cách trung thực**](/docs/network/getting-started/training-honestly) — mười hàng rào bảo vệ trên một trang duy nhất, mỗi hàng rào đi kèm câu chuyện thực tế đằng sau nó.
- [**Mô hình tinh chỉnh (Fine-Tuned Model)**](/docs/network/tutorials/fine-tuned-model) và [**Dịch ngược (Back-Translation)**](/docs/network/tutorials/back-translation) — các hướng dẫn chuyên sâu hơn về các kỹ thuật cụ thể.
- [**Tạo kho ngữ liệu (Corpus Creation)**](/docs/network/tutorials/corpus-creation) — xây dựng dữ liệu thực tế làm nền tảng cho mọi thứ khác.
