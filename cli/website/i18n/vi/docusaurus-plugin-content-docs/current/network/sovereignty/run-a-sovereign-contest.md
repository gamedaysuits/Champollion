---
sidebar_position: 9
title: "Tự vận hành một cuộc thi dịch thuật"
slug: /network/sovereignty/run-a-sovereign-contest
description: "Quy trình tự phục vụ khép kín từ đầu đến cuối dành cho cộng đồng hoặc tổ chức để tự vận hành một cuộc thi dịch máy (MT) dựa trên kho ngữ liệu bảo mật, độc lập của riêng mình — mà Champollion không bao giờ nắm giữ dữ liệu hay tiền thưởng."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Tổ chức một Cuộc thi Độc lập (Sovereign Contest)

> **Tóm tắt điều hành.** Một cộng đồng hoặc tổ chức có thể chạy một cuộc thi đánh giá
> — bao gồm cả giải thưởng được tài trợ — dựa trên một tập dữ liệu kiểm thử được giữ kín
> mà **không bao giờ rời khỏi cơ sở hạ tầng của chính họ**. Bạn xây dựng tập dữ liệu, mã hóa nó,
> lưu trữ nó và nắm giữ các khóa; Mạng lưới chỉ đăng ký một thẻ siêu dữ liệu không chứa nội dung
> và một bản tóm tắt bản mã (ciphertext digest). Các phương pháp phải vượt qua vòng loại trên các tập dữ liệu công khai
> trước; mỗi lượt chạy thử nghiệm trên tập dữ liệu niêm phong của bạn đều yêu cầu sự ủy quyền từ những người giám hộ của bạn;
> chỉ có **điểm số** được xuất ra ngoài. Quỹ giải thưởng do **nhà tài trợ nắm giữ**
> — bởi tổ chức của bạn hoặc một quỹ tín thác mà bạn chỉ định — và **Champollion không bao giờ
> chạm vào tiền hoặc dữ liệu.** Trang này là tài liệu hướng dẫn tự thực hiện từ đầu đến cuối.

:::warning[Những gì đã hoạt động so với đang phát triển]
Hãy nhìn nhận rõ ràng trước khi bắt đầu — đây là một dự án nghiên cứu phi thương mại đang phát triển, và chúng tôi muốn bạn kiểm chứng chúng tôi hơn là tin tưởng chúng tôi:

- ✅ **Đang hoạt động:** đăng ký ngữ liệu (thẻ siêu dữ liệu, ghim mã băm, luồng hiển thị), sổ đăng ký tập dữ liệu niêm phong (digest + nhóm người giám hộ + bộ tiêu chuẩn vượt qua, không có nội dung), cơ chế cuộc thi với luồng niêm phong, tầng dữ liệu yêu cầu/cấp quyền/kiểm toán ủy quyền (đang chờ → quyết định M-trên-N → cấp quyền dùng một lần có giới hạn thời gian, nhật ký kiểm toán chỉ thêm gắn chuỗi băm), và chỉ phát hành điểm số được thực thi ở tầng cơ sở dữ liệu.
- ✅ **Đang hoạt động: nút chấm điểm của ban tổ chức.** Một lệnh sẽ chia ngữ liệu của bạn thành tập dev công khai (tập mà người tham gia tự chấm để vượt qua vòng loại) và một tập bí mật niêm phong mà nút của bạn thực thi các bài dự thi đối chiếu, đồng thời niêm phong nửa bí mật ở trạng thái nghỉ trên máy của BẠN (`mt-eval contest prepare`). Việc đăng ký (các) tập niêm phong, bộ tiêu chuẩn và cuộc thi là **tự phục vụ từ lần đăng nhập của chính bạn** — `contest prepare --self-serve`, hoặc `mt-eval contest register --manifest` cho cuộc thi bạn đã chuẩn bị trước đó — với mỗi hàng được ràng buộc danh tính ở tầng cơ sở dữ liệu; không có người phụ trách can thiệp và không có khóa đặc quyền (xem Bước 4 để biết các giới hạn trung thực).
- ✅ **Đang hoạt động: các bài dự thi là PHƯƠNG PHÁP, không phải bản dịch.** Tham gia cuộc thi bằng cách giao cho nút của bạn thứ gì đó mà nó có thể CHẠY. Người tham gia tự chấm điểm trên tập dev công khai (`mt-eval contest qualify`) để nhận biên nhận, sau đó gửi mô hình hoặc phương pháp; nút của bạn sẽ thực thi lại điểm số của biên nhận đó trên bản sao tập dev của chính nó trước khi bất kỳ người giám hộ nào được yêu cầu phê duyệt bất cứ điều gì, và từ chối nếu không khớp. Nút chọn luồng từ bài nộp:
  - **Luồng A — mô hình khai báo (ưu tiên).** Một mô hình neural tiêu chuẩn là DỮ LIỆU: `mt-eval contest submit-model` gửi trọng số safetensors + bộ tách từ khai báo + cấu hình — **không có mã code, không có Dockerfile.** Nút của bạn xác thực rằng nó không chứa mã code (safetensors không phải pickle; không có `trust_remote_code`/`auto_map`; chỉ là các tệp dữ liệu) và chạy trọng số trong engine tin cậy của CHÍNH NÓ (`transformers`, `trust_remote_code=False`, ngoại tuyến). Kiến trúc theo mặc định là cho phép (bất kỳ kiến trúc nào mà engine của bạn tải tự nhiên); một máy chủ cẩn trọng có thể ghim danh sách cho phép. Không có gì không đáng tin cậy được thực thi, vì vậy không cần hộp cát. Được xuất bản `declarative-model`, danh tính phương pháp **vốn dĩ không chứa mã code**.
  - **Luồng B — gói có thể chạy (dự phòng hộp cát).** Dành cho các phương pháp LÀ mã code: `mt-eval contest submit-method` gửi một Dockerfile + điểm vào. Sau khi người giám hộ của bạn phê duyệt, nút của BẠN sẽ thực thi nó bên trong một container cách ly mạng (`--network=none` — ngăn xếp mạng không tồn tại bên trong; root chỉ đọc, loại bỏ các quyền hạn, môi trường được làm sạch), với các kiểm tra tĩnh tự động trước và các tham chiếu không bao giờ đi vào container. Được xuất bản `method-execution` với danh tính **được xác minh qua thực thi**.
Ở cả hai luồng: mã băm của gói được cố định vào yêu cầu ủy quyền (những gì chạy có thể chứng minh được là những gì đã được đề xuất), và điểm số được xuất bản thông qua cùng một đường dẫn chỉ xuất bản số liệu tổng hợp. Để đạt mức độ cách ly tối đa, máy chấm điểm có thể là một airgap thực sự: các yêu cầu đã ủy quyền và các gói chỉ chứa điểm số được ký bằng Ed25519 được chuyển qua phương tiện lưu trữ rời (`mt-eval node relay` / `import-bundle` / `export-scores`) — văn bản bí mật thậm chí không bao giờ chạm tới máy có kết nối mạng. Những gì các luồng này CHƯA bao gồm: chứng thực phần cứng của nút (danh tính là tự báo cáo), cơ chế tranh chấp chính thức, và — cụ thể đối với Luồng B — việc tăng cường bảo mật container sâu hơn ngoài việc gỡ bỏ ngăn xếp mạng (seccomp profile, microVM; đây là lý do nên ưu tiên Luồng A). Xem [Các giới hạn trung thực](/docs/network/honest-limitations).
- ✅ **Tầng cam kết đã hoạt động (2026-09-07).** Các khai báo bài dự thi (chính/đối chiếu, các track), các giai đoạn nộp bài, kết quả bị giữ lại (`hidden_until_close`), và trạng thái đóng băng khiến các cam kết đã khai báo của bạn không thể chỉnh sửa một khi bài dự thi đã tồn tại đều được thực thi trong cơ sở dữ liệu trên endpoint do mạng lưu trữ. Một máy chủ liên kết nhận được các quy tắc tương tự bằng cách áp dụng migration đi kèm với harness; đối với một endpoint cũ hơn, harness sẽ quay về tập cơ sở và thông báo rõ điều đó (`declarations_available: false`) thay vì giả vờ hỗ trợ. Bất cứ nơi nào một bước bên dưới ghi rằng *cơ sở dữ liệu đóng băng / giữ lại*, điều đó hoàn toàn có hiệu lực thực tế.
- 🔲 **Đang phát triển: ký ngưỡng.** Đối với một tập được niêm phong bằng `champollion seal-corpus`, sự phê duyệt M-trên-N của người giám hộ được *ghi lại* trong các bảng ủy quyền và kiểm toán, và khóa niêm phong là khóa đại diện cặp khóa đơn được gắn nhãn (`champollion seal-corpus keygen`). Một tập được niêm phong trên nút ngoại tuyến (`mt-eval node seal`) sử dụng **nghi thức tạo khóa** được tích hợp sẵn của nút (`mt-eval node ceremony`): khóa tập dữ liệu được chia M-trên-N và chỉ được lắp ráp lại trong bộ nhớ trong một lần chạy được túc số ủy quyền. Nghi thức đó chưa bao giờ được sử dụng với người giám hộ thực sự, và các phần chia khóa của nó là các tệp thuần túy trong v1. Cả hai đường dẫn đều chưa có *ký* ngưỡng: chữ ký gói điểm airgap là một khóa nút đơn lẻ (`seal-corpus sign-keygen`).
- ❌ **Theo thiết kế không có chuyện:** Champollion lưu trữ ngữ liệu của bạn, giữ khóa của bạn, hoặc giữ tiền thưởng. Gói của người tham gia (mô hình hoặc mã code của chính họ) chỉ quá cảnh qua bộ lưu trữ của chúng tôi trên đường tới nút của bạn; nội dung ngữ liệu của bạn không bao giờ đi qua đó.
- ❌ **Đã bị xóa thay vì để lại như một cái bẫy.** `contest submit-hypotheses` (ngừng hoạt động 2026-09-06) đã tải lên các bản dịch của một tập mù công khai nguồn; `contest submit` (ngừng hoạt động 2026-09-06) đã liên kết điểm số bạn tự xuất bản. Cả hai đều không còn là đường dẫn nộp bài dự thi cuộc thi nữa. Vòng thi mù công khai nguồn chỉ tồn tại như một chẩn đoán tùy chọn của ban tổ chức, và điểm tự báo cáo vẫn thuộc về bảng xếp hạng mở — vốn là bảng công khai được lập chỉ mục theo ngữ liệu và hướng cặp ngôn ngữ, không phải một cuộc thi.

Nếu một bước bên dưới phụ thuộc vào thứ gì đó trong danh sách 🔲, bước đó sẽ nêu rõ.
:::

---

## Hình thức của thỏa thuận

| Ai | Nắm giữ | Không bao giờ nắm giữ |
|-----|-------|-------------|
| **Bạn (cộng đồng/tổ chức)** | Tập dữ liệu, các khóa mã hóa (thông qua những người giám hộ của bạn), quỹ giải thưởng, quyết định trao giải | — |
| **Champollion / Mạng lưới** | Thẻ siêu dữ liệu, bản tóm tắt bản mã, hồ sơ ủy quyền + kiểm toán, điểm số được công bố | Nội dung tập dữ liệu của bạn, khóa của bạn, tiền của bạn |
| **Nhà phát triển phương pháp** | Phương pháp của họ | Dữ liệu kiểm thử của bạn — họ chỉ thấy điểm số, không bao giờ thấy các câu văn |

Mọi thứ dưới đây là sự triển khai chi tiết về mặt kỹ thuật của bảng đó.

---

## Điều kiện tiên quyết dành cho ban tổ chức

Trước Bước 1, hãy tìm hiểu xem việc vận hành phía node thực sự yêu cầu những gì:

- **Harness cùng với gói mở rộng node:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 trở lên; sử dụng `python3 -m pip`, hoạt động trong mọi môi trường mà harness chạy — một lệnh `pip` trần không nằm trên `PATH` trong mọi môi trường ảo). Gói mở rộng `[node]` bổ sung thư viện `cryptography` mà `mt-eval node keygen`, nghi thức người giám hộ và việc ký manifest điểm số sử dụng. Một bản cài đặt `python3 -m pip install mt-eval-harness` thuần túy sẽ thiếu thư viện này, và các lệnh đó sẽ dừng lại và chỉ rõ bản cài đặt này.
- **docker hoặc podman** — bắt buộc cho luồng thực thi phương pháp. Nút tự động phát hiện docker, sau đó là podman (`sandbox.runtime` trong `node.json` mặc định là `null`; hãy chỉ định một cái ở đó nếu muốn bắt buộc dùng nó). Nếu không có cái nào trên `PATH`, `mt-eval node run-method` sẽ từ chối bằng một dòng thông báo nêu tên cả hai, trước khi chạy bất kỳ thứ gì, và yêu cầu được giữ nguyên trạng thái để bạn có thể chạy lại sau khi cài đặt runtime. **Không có phương án dự phòng**. Việc cách ly container với `--network=none` là đảm bảo cốt lõi chịu tải, vì vậy không có gì chạy được nếu thiếu container runtime.
- **Node.js 20.11+ và npm CLI `champollion`** — harness không tự cài đặt lại thuật toán mã hóa niêm phong. `champollion seal-corpus` (các động từ: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) là triển khai mã hóa duy nhất (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), và nút của ban tổ chức sẽ gọi shell tới nó.
- **Cấu hình nút tại `~/.mt-eval/node.json`.** Mọi lệnh `mt-eval node` đều từ chối khởi động nếu thiếu cấu hình này. `mt-eval node init` ghi một cấu hình khởi đầu vào đó (`--print` sẽ hiển thị nó thay vì ghi). Nó chứa `node_id` tự báo cáo của bạn (được gắn vào dấu vân tay của mọi yêu cầu) và một bản đồ `contests` trỏ tới tập dev, tập niêm phong của bạn (`secret_set_id` + `secret_artifact`), tập giữ lại niêm phong nếu bạn đã chuẩn bị (`holdout_set_id` + `holdout_corpus`; xóa cả hai khóa nếu bạn không chuẩn bị) và cổng tiêu chuẩn vượt qua công khai (`qualifier` + `dev_corpus`, ngưỡng trên thang điểm 0–100 của tiêu chuẩn vượt qua). Sau khi bạn đã chạy `contest prepare` (Bước 1), `mt-eval node init --from-contest ./mytask` sẽ ghi cấu hình khởi đầu với các giá trị của cuộc thi đã được điền sẵn từ `./mytask/local/manifest.json`, và liệt kê những gì còn lại cần bạn xử lý. Ánh xạ mà nó áp dụng (bạn có thể tự điền thủ công nếu muốn):

  | `local/manifest.json` | `node.json` (dưới `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (cả hai đều bị xóa khi không có tập giữ lại) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (cùng tên) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: bản sao mà `contest prepare` đã đọc (`--test-suite <id>=<path>`, hoặc bản sao nó tìm thấy), khi nó nằm trên máy này với các byte đã ghim; nếu không, bạn thiết lập `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` cho tập được niêm phong vào một cặp khóa (sau đó đặt `secret_privkey`), `threshold-quorum` cho một nghi thức |
  | `registration.prize_terms` (được ghi lại bởi `contest prepare` và `contest register`) | `prize_terms_sha256`: SHA-256 của các điều khoản, mã băm mà người tham gia chuyển tới `--accept-terms` (được bỏ qua khi cuộc thi không tuyên bố giải thưởng) |

  ID cuộc thi là `--slug` bạn đã cung cấp cho `contest prepare` (`mytask` trong ví dụ bên dưới). Prepare ghi lại nó trong manifest, việc đăng ký sẽ tạo cuộc thi dưới ID đó, và đó là ID mà người tham gia chuyển tới `contest qualify` và `submit-method`, vì vậy hãy công bố nó cùng với bản phát hành dev; `--contest-id` sẽ ghi đè lên nó. (Một manifest được ghi trước khi ID được ghi lại sẽ giữ nguyên ID mà việc đăng ký suy ra từ tên của nó, `"My Task 2026"` → `my-task-2026`, vì đó là những gì mà cuộc thi, các biên nhận và cấu hình nút của nó đã sử dụng.) Không có manifest nào biết `node_id`, `cards_dir`, `signing_key` hoặc tệp khóa riêng tư của bạn, vì vậy những thông tin đó vẫn giữ nguyên dưới dạng `<...>` để bạn tự điền.
  `mt-eval node ledger verify` sau đó sẽ kiểm tra và thông báo những gì nó đã kiểm tra: nó tải cấu hình (quyền giám hộ, toàn bộ cổng tiêu chuẩn vượt qua, cặp giữ lại, chỉ mục thẻ cục bộ), từ chối giá trị đầu tiên vẫn còn là phần giữ chỗ `<...>` hoặc một tệp đã khai báo nhưng không có trên máy này, in ra các tập dữ liệu và tệp của từng cuộc thi, và chỉ sau đó mới phát lại chuỗi băm của sổ cái ủy quyền (không có mục nào trên một nút mới).
- **Chỉ mục thẻ ngôn ngữ cục bộ mà nút mang theo.** Việc chấm điểm nêu tên cặp ngôn ngữ của lần chạy, và nút không bao giờ tra cứu ngôn ngữ qua mạng. Hãy trỏ `cards_dir` trong `node.json` vào một thư mục chứa thẻ cho mọi ngôn ngữ mà nút của bạn chấm điểm (hoặc thiết lập `MT_EVAL_CARDS_DIR`); một nút không có chỉ mục cục bộ sẽ từ chối khởi động thay vì đi tải về. Cả hai gói được cài đặt đều không đi kèm thư mục thẻ cho từng ngôn ngữ, vì vậy hãy ghi một thư mục trên máy có kết nối mạng bằng CLI `champollion`, mỗi tệp `<code>.json` cho một ngôn ngữ trong cặp của bạn:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Sau đó đặt `"cards_dir"` thành đường dẫn tuyệt đối của thư mục đó. Đối với một nút air-gap, hãy mang nó theo trong gói ngoại tuyến (`mt-eval node bundle --out <dir> --include node-cards`); nó nằm tại `<dir>/artifacts/node-cards`, và `cards_dir` trỏ tới đó trên nút.
- **Đăng nhập.** Không có bước tạo tài khoản riêng biệt: lệnh đầu tiên cần danh tính (ví dụ: `mt-eval contest prepare --self-serve` hoặc `mt-eval publish`) sẽ mở trình duyệt để đăng nhập OAuth qua **GitHub hoặc Google** (Supabase Auth). Email của tài khoản đó là danh tính mà mọi hàng trong sổ đăng ký được liên kết — hãy sử dụng tài khoản mà tổ chức của bạn kiểm soát.
- **Bộ điều tiết tiếp nhận.** Bài nộp của người tham gia bị giới hạn tốc độ theo người nộp thành **mặc định 5 bài mỗi 24 giờ** (chống thăm dò; được đặt cho từng cuộc thi bằng `--intake-daily-limit` tại thời điểm chuẩn bị, hoặc theo mặc định của phiên bản shared-task). Hãy tính toán thời gian biểu cuộc thi của bạn xoay quanh giới hạn này.

**Một lưu ý trung thực về việc đăng ký tự phục vụ.** Trên **endpoint mặc định do mạng lưu trữ**, việc đăng ký tự phục vụ (`contest prepare --self-serve` / `contest register`) hiện tại sẽ dừng lại ở một chốt chặn bảo vệ của production-endpoint: CLI từ chối kèm theo một thông báo rõ ràng thay vì ghi vào dự án production, chờ đợi một quyết định chính sách về việc mở cánh cửa đó. Các máy chủ liên kết (dự án Supabase của riêng bạn) không bị ảnh hưởng. Nếu bạn gặp chốt chặn này trên máy chủ mặc định, đó là trạng thái hiện tại của hệ thống chứ không phải do bạn cấu hình sai — [hãy mở một issue](https://github.com/gamedaysuits/Champollion/issues) và chúng tôi sẽ hỗ trợ bạn hoàn tất việc đăng ký.

---

## Bước 1 — Xây dựng tập dữ liệu kiểm thử giữ kín của bạn

Thiết kế tập dữ liệu mà bạn sẽ dùng để đo lường, và giữ kín nó ngay từ ngày đầu tiên:
không có nội dung nào trong đó từng được xuất bản, đăng tải hoặc chia sẻ với một nhà cung cấp mô hình.

- Làm theo [Khung thiết kế tập dữ liệu](/docs/network/specifications/corpus-design)
  để biết cấu trúc mục nhập, các mức độ khó và phạm vi văn phong, và tài liệu hướng dẫn [Tạo tập dữ liệu](/docs/network/tutorials/corpus-creation)
  để biết các công cụ.
- Yêu cầu người nói trôi chảy kiểm tra các mục nhập trước khi niêm phong — [Giao thức xác thực người nói](/docs/network/specifications/speaker-validation)
  mô tả một cấu trúc đánh giá mà bạn có thể tái sử dụng cho việc đảm bảo chất lượng (QA) tập dữ liệu, chứ không chỉ cho việc đánh giá phương pháp.
- Quyết định nhãn **phiên bản** tập dữ liệu ngay bây giờ (ví dụ: `v1`). Quyền ủy quyền được liên kết với một phiên bản cụ thể,
  vì vậy việc quản lý phiên bản là một phần của mô hình bảo mật, không phải là việc ghi chép sổ sách thông thường.

### Cách phân chia ngữ liệu

Một lệnh duy nhất nhận ngữ liệu gốc của bạn và tạo ra mọi tầng, mang tính tất định từ một seed do bạn chọn và ghi lại:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` là điểm số mà một phương pháp phải đạt được trên tập dev công khai trước khi nút của bạn chịu chạy nó trên tập niêm phong và tập giữ lại niêm phong. Điểm số này nằm trên **thang điểm tiêu chuẩn vượt qua 0–100**: điểm tiêu chuẩn vượt qua là **chrF++ cấp ngữ liệu** (sacreBLEU chrF, `word_order=2`) của các kết quả dev so với các câu tham chiếu dev đã phát hành — chỉ số tiêu đề của tiêu chuẩn chấm điểm, và là cùng một con số mà thẻ `mt-eval run` làm tiêu đề cho cùng các kết quả đó. Không có gì khác được trộn vào điểm này; khớp chính xác được hiển thị bên cạnh như một chẩn đoán và không bao giờ dùng làm cổng chặn. Nút của bạn tính toán cùng một con số khi chạy lại một phương pháp, do đó biên nhận của người tham gia và phép đo của nút của bạn có thể so sánh được với nhau.

Hãy thiết lập ngưỡng từ điểm chrF++ mà bạn đã đo trên tập dev này (chạy `contest qualify` trên các kết quả dev của một baseline), không phải từ điểm số trên các tập đánh giá khác: mức chrF++ rất khác nhau giữa các ngôn ngữ và ngữ liệu. Một tiêu chuẩn vượt qua được đăng ký trước [tiêu chuẩn chấm điểm](/docs/network/specifications/scoring#how-runs-are-scored) với chỉ số tổng hợp cũ đã ngừng dùng vẫn hoạt động: ngưỡng của nó được đọc trên thang điểm chrF++, và lệnh qualify luôn thông báo rõ điều đó mỗi lần chạy, vì vậy hãy xác nhận con số hoặc xoay vòng sang một tiêu chuẩn vượt qua mới.

`--license` là bắt buộc. Nó chỉ định giấy phép phát hành tập dev, và mt-eval không bao giờ tự chọn giúp bạn. Tệp được phát hành mang giấy phép này dưới dạng `dataset.license`, đây là điều mà `mt-eval run`, `contest qualify` và `publish` đọc, do đó các lần chạy của người tham gia bị giới hạn bởi giấy phép của bạn. Hãy sử dụng chính quyền cấp phép của chủ sở hữu quyền dưới dạng một mã định danh SPDX. Với `CC-BY-4.0`, người tham gia có thể đánh giá bằng bất kỳ dịch vụ mô hình nào. Với giấy phép phi thương mại như `CC-BY-NC-4.0`, các mô hình từ xa chỉ chạy qua các kênh không dùng dữ liệu để huấn luyện. Với các điều khoản của riêng bạn (`LicenseRef-<name>`), việc đánh giá từ xa bị từ chối cho đến khi sự cho phép của chủ sở hữu quyền được ghi nhận, do đó người tham gia phải sử dụng các mô hình cục bộ.

Các tệp được phát hành cũng nêu rõ các điều khoản khác của tập gốc, được đọc từ thẻ của chính tập gốc (thẻ ngữ liệu mà `champollion network register-corpus` đã ghi, thông qua sidecar `<file>.champollion.json` của nó) và phong bì của chính nó: `dataset.do_not_train` và, khi tập gốc được đánh dấu chỉ dùng cục bộ, `dataset.transmission: "local-only"` (người tham gia khi đó chỉ có thể chạy tập dev với một mô hình trên chính máy của họ), với `dataset.terms_from` nêu rõ nguồn gốc của từng điều khoản. Khi thẻ của tập gốc không nêu điều khoản huấn luyện, hãy truyền `--do-not-train true` hoặc `false`; cờ này có thể siết chặt điều khoản của tập gốc chứ không bao giờ nới lỏng (lệnh `--do-not-train false` trên một tập gốc `doNotTrain: true` sẽ bị từ chối). prepare in ra các điều khoản này, và cảnh báo khi thẻ của tập gốc cho biết việc phân phối lại bị cấm: việc phát hành `public/` chính là phân phối lại, vì vậy đừng phát hành cho đến khi chủ sở hữu quyền đồng ý.

| Phân chia | Ai nhìn thấy | Mục đích |
|-------|-------------|----------------|
| **Tập dev công khai** (`--dev-size`) | tất cả mọi người — cả nguồn *và* tham chiếu đều được phát hành | **tiêu chuẩn vượt qua**: người tham gia tự chấm điểm trên tập này trước khi có thể nộp bài (Bước 8) |
| **Tập niêm phong** (`--secret-size`) | không ai ngoài nút của bạn — cả nguồn *và* tham chiếu đều được mã hóa | tập dùng để thực sự chấm điểm bài dự thi |
| **Tập giữ lại niêm phong** (`--sealed-holdout-size`, tùy chọn) | không ai ngoài nút của bạn | phân chia niêm phong **thứ hai**, được chấm điểm trong cùng lần chạy, với điểm số bị giữ lại cho đến khi bạn đóng cuộc thi |
| *Tập mù* (`--blind-size`, mặc định 0) | nguồn được phát hành, tham chiếu bị giữ lại | một vòng chẩn đoán tùy chọn của riêng bạn. Đây **không** phải là đường dẫn nộp bài dự thi: tham gia cuộc thi bằng cách giao nộp phương pháp, không bao giờ bằng cách tải lên bản dịch |

Các phân chia là rời rạc và có thể tái lập: cùng một ngữ liệu, cùng một seed, cùng một phân chia, mãi mãi. Công thức được lưu giữ trong một manifest cục bộ của ban tổ chức và không bao giờ rời khỏi máy của bạn.

**Các câu lặp lại được giữ nguyên về một phía.** Việc phân chia là rời rạc theo nhóm (`group-disjoint/1`, được ghi lại trong khối `split` của manifest): các hàng có chung nguồn hoặc tham chiếu, dù là chính xác hay sau khi chuẩn hóa chữ hoa/thường, dấu câu và khoảng trắng, sẽ tạo thành một nhóm, và một nhóm sẽ nằm trọn vẹn trong một phân chia duy nhất. Do đó, không có hàng niêm phong nào lặp lại một hàng của tập dev đã phát hành. Các nhóm được xáo trộn với seed của bạn và được sắp xếp lần lượt theo dev, blind, secret, holdout; một tập gốc không có câu lặp lại sẽ nhận được sự phân chia chính xác như việc xáo trộn từng hàng mang lại. Nếu các nhóm nguyên vẹn không thể lấp đầy kích thước bạn yêu cầu, prepare sẽ từ chối, kèm theo số lượng hàng bị lặp lại và cách khắc phục: loại bỏ các phần lặp lại (giữ lại một hàng của mỗi nhóm), hoặc yêu cầu tổng kích thước thấp hơn kích thước của tập gốc để một số nhóm có thể được bỏ qua.

**`public/` có thể phát hành; nhật ký chạy được chuyển vào `runs/`.** prepare ghi một tệp đánh dấu, `.champollion-releasable.json`, vào `public/`. Nhật ký chạy, báo cáo và bộ nhớ cache bản dịch không bao giờ được ghi vào đó: `mt-eval run` từ chối `--output-dir` hoặc `--cache-dir` bên trong nó và nêu tên `runs/` bên cạnh (`<out>/runs/`) để thay thế, và `run_benchmark` của MCP server sẽ tự động đặt một lần chạy trên tập dev đã phát hành (baseline bạn chạy để thiết lập ngưỡng) vào `runs/` và thông báo điều đó. Một cuộc thi được chuẩn bị trước khi tệp đánh dấu tồn tại sẽ được nhận diện theo bố cục của nó (`public/` bên cạnh `local/manifest.json`).

**Tại sao cần tập giữ lại.** Một tập niêm phong đơn lẻ vẫn có thể bị tinh chỉnh đối phó trong một cuộc thi dài — mỗi bài nộp là một lần thăm dò, và đủ số lần thăm dò sẽ làm rò rỉ một chút thông tin. Một phân chia thứ hai được chấm điểm trong cùng một lần chạy được ủy quyền nhưng không ai nhìn thấy các con số cho đến khi kết thúc sẽ cung cấp cho bạn cái nhìn khách quan cuối cùng: nếu thứ hạng của một hệ thống thay đổi giữa hai tập, bạn sẽ hiểu được bao nhiêu phần là do tinh chỉnh đối phó và bao nhiêu phần là khả năng dịch thuật thực sự. Cả hai tập đều được bao quát bởi **một** lần ủy quyền duy nhất, do đó không tốn thêm nghi thức nào của người giám hộ.

**Bộ kiểm thử của bên thứ ba.** `--test-suite` chỉ định một ngữ liệu chẩn đoán công khai — của người khác, được ghim mã sha và có thể tải xuống công khai — mà mọi bài dự thi cũng được chạy trên đó. Những con số này **được báo cáo và không bao giờ xếp hạng**: chúng ở đó để người đọc có thể thấy liệu điểm số cao trên tập niêm phong có duy trì được trên một tập mà cuộc thi của bạn không tự thiết kế hay không. Champollion từ chối một bộ kiểm thử bị cách ly, chưa được ghim băm, không dành cho cặp ngôn ngữ của bạn, hoặc chính là một trong các phân chia của bạn.

**Một hàng niêm phong mà đã công khai thì không còn là niêm phong.** `contest prepare` so sánh tập niêm phong và tập giữ lại niêm phong của bạn với mọi thứ công khai: tập dev mà nó phát hành (việc phân chia rời rạc theo nhóm ở trên giữ cho con số này bằng 0), bản phát hành nguồn blind nếu có, và mọi bộ kiểm thử đã khai báo. Nó so khớp chính xác và sau khi chuẩn hóa chữ hoa/thường, dấu câu và khoảng trắng (cùng phép so sánh mà các nhóm phân chia sử dụng), sau đó in từng phần trùng lặp kèm số lượng (ví dụ "30 trong số 30 hàng cũng xuất hiện trong bộ kiểm thử…") và ghi lại số lượng vào `local/manifest.json`. Đối với bộ kiểm thử của bên thứ ba, nó cảnh báo thay vì từ chối: bộ kiểm thử là văn bản công khai của người khác, và bạn quyết định xem có nên xóa những hàng đó khỏi tập gốc hay loại bỏ bộ kiểm thử rồi chuẩn bị lại. Để kiểm tra một bộ kiểm thử, prepare cần các câu của nó. Nó sử dụng một bản sao đã có sẵn trên máy của bạn và không bao giờ tải xuống trong quá trình chuẩn bị. Hãy đặt tên cho bản sao của bạn bằng `--test-suite <id>=<path>`; mã sha256 của nó phải khớp với mã đã ghim của sổ đăng ký. Nếu không tìm thấy bản sao nào, cảnh báo sẽ thông báo rằng bộ kiểm thử **chưa được kiểm tra**, chứ không bao giờ nói rằng nó sạch. Manifest ghi lại đường dẫn của từng bản sao mà prepare đã đọc, để `node init --from-contest` có thể trỏ nút của bạn tới đó.

Tập giữ lại và các bộ kiểm thử đã khai báo của bạn sẽ trở thành những cam kết: ngay khi bài dự thi đầu tiên xuất hiện, cuộc thi sẽ đóng băng chúng, vì vậy bạn không thể thêm hoặc bớt một bộ kiểm thử giữa chừng cuộc thi.

## Bước 2 — Mã hóa và lưu trữ nó trên cơ sở hạ tầng của BẠN

Mã hóa tập dữ liệu khi lưu trữ (bất kỳ cơ chế AEAD hiện đại nào — ví dụ: `age`/x25519 hoặc AES-256-GCM)
và lưu trữ **bản mã** ở một nơi nào đó bạn kiểm soát. Champollion không bao giờ nhận được văn bản gốc *hoặc* bản mã.

Chỉ công bố duy nhất một thành phần: **bản tóm tắt SHA-256 của tệp bản mã (ciphertext blob)**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

Bản tóm tắt là công khai; dữ liệu thì không. Bất kỳ ai sau đó cũng có thể xác minh rằng tệp dữ liệu được đánh giá là trùng khớp từng byte
với tệp dữ liệu bạn đã niêm phong — đảm bảo tính toàn vẹn mà không cần sở hữu dữ liệu. Đây là nguyên tắc sử dụng mã băm thay vì sao chép tương tự như
[đăng ký tập dữ liệu thông thường](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Bước 3 — Đăng ký thẻ siêu dữ liệu

Đăng ký tập dữ liệu thông qua [luồng đăng ký](/docs/network/sovereignty/registering-corpora) tiêu chuẩn, an toàn khi thất bại (fail-private):
một thẻ với `language_pair`, `license`, `attribution`, và `do_not_train` — **không có các câu văn**. Chọn luồng hiển thị **riêng tư (private)**;
việc đăng ký tập dữ liệu niêm phong ở bước tiếp theo là thứ giúp nó đủ điều kiện tham gia cuộc thi.

## Bước 4 — Đăng ký nó dưới dạng một tập dữ liệu niêm phong

Một tập dữ liệu niêm phong là một mục đăng ký không chứa nội dung, đưa ba thứ sau vào hồ sơ công khai:

| Trường | Những gì bạn cam kết |
|-------|------------------------|
| `ciphertext_digest` | Các byte chính xác được tính là "tập dữ liệu" |
| `custodian_group_id` | Một ID ẩn danh cho nhóm kiểm soát quyền truy cập (không bao giờ là tên tổ chức/quốc gia công khai trước khi có sự đồng ý) |
| `current_qualifier_id` | Vòng thi công khai mà một phương pháp phải vượt qua trước khi một lượt chạy niêm phong có thể được đề xuất |

Việc đăng ký là **tự phục vụ, từ chính tài khoản đăng nhập của bạn** — không có người quản lý trung gian và không có khóa đặc quyền:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

Manifest vẫn nằm trên máy của bạn — việc đăng ký chỉ gửi các ID, digest và ngưỡng không chứa nội dung. Bạn có thể đọc chính xác những gì nó gửi trước khi bất cứ thứ gì được chuyển đi: `contest prepare --no-register` in ra kế hoạch đăng ký, từng hàng mà `contest register` sẽ ghi, theo thứ tự — ID của từng tập niêm phong và mã SHA-256 của bản mã của nó (kèm theo số lượng hàng vẫn được niêm phong trên máy của bạn), nhóm người giám hộ, ID và ngưỡng của tiêu chuẩn vượt qua, hàng cuộc thi cùng các cam kết đã ghi lại của nó, các cột chính sách, và bất kỳ tập giữ lại, bộ kiểm thử và điều khoản giải thưởng nào được hợp nhất vào siêu dữ liệu của cuộc thi. Kế hoạch này được xây dựng bởi chính đoạn mã gửi các hàng, vì vậy nó không thể mô tả thứ gì khác ngoài những gì được gửi.
Mọi hàng trong sổ đăng ký đều được **ràng buộc danh tính**: cơ sở dữ liệu ghi lại tài khoản đã đăng nhập đăng ký nó và đóng băng liên kết đó trước các chỉnh sửa sau này, và một tiêu chuẩn vượt qua chỉ có thể làm cổng chặn cho một tập niêm phong mà **cùng** danh tính đó đã đăng ký. Các tập niêm phong khi mới tạo sẽ ở trạng thái cách ly (chúng không bao giờ có thể làm nền tảng cho một cuộc thi thông thường hay xếp hạng trên bảng xếp hạng công khai), các tiêu chuẩn vượt qua khi mới tạo ở trạng thái an toàn, và việc đăng ký bị giới hạn tốc độ — tất cả đều được thực thi bởi các database trigger bên dưới mọi client, bao gồm cả của chúng tôi. Bản thân sổ đăng ký có thể đọc công khai, vì vậy bạn có thể xác minh bài dự thi của mình nêu chính xác những gì bạn đã niêm phong — và không có gì hơn.

**Các giới hạn trung thực.** Cửa tự phục vụ chỉ dành cho việc đăng ký (chỉ chèn ở tầng cơ sở dữ liệu). **Việc xoay vòng tiêu chuẩn vượt qua và cho tập niêm phong ngừng hoạt động vẫn cần người phụ trách can thiệp** — hãy mở issue hoặc liên hệ với dự án qua [GitHub](https://github.com/gamedaysuits/Champollion/issues). Và việc vận hành nút chấm điểm của ban tổ chức ở các bước sau (thúc đẩy vòng đời, cấp quyền ủy quyền, các thao tác kiểm toán) là một luồng riêng biệt có thông tin xác thực dịch vụ trên nút của chính bạn — tính tự phục vụ dừng lại ở hồ sơ công khai.

## Bước 5 — Chọn những người giám hộ và quy tắc M-trên-N

Chọn những người hoặc tổ chức phải cùng nhau phê duyệt mọi đánh giá đối với tập dữ liệu của bạn, và ngưỡng phê duyệt (ví dụ: **3 trên 5**).
Những người giám hộ phải chịu trách nhiệm trước cộng đồng của bạn, chứ không phải trước Champollion — xem [Quản trị dữ liệu](/docs/network/sovereignty/data-sovereignty)
và [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) để biết cách thiết lập các điều khoản cho từng cộng đồng.

**Hộp trung thực:** việc *ký* ngưỡng (một quyền cấp mà thực sự không thể tạo ra nếu không có M chữ ký) **đang trong quá trình phát triển**. Nghi thức khóa của nút ngoại tuyến (`mt-eval node ceremony`, Shamir M-trên-N) đã được xây dựng nhưng chưa được sử dụng với người giám hộ thực sự. Mặt khác, quy tắc M-trên-N được thực thi như một quy trình được ghi lại: mọi yêu cầu truy cập đều đi vào hàng đợi **đang chờ**, các quyết định của người giám hộ được ghi lại, quyền cấp chỉ được tạo cho một yêu cầu được ủy quyền, mỗi quyền cấp là **dùng một lần, có giới hạn thời gian và ràng buộc vào một dấu vân tay cụ thể (phương pháp, phiên bản ngữ liệu, nút đánh giá)**, và mọi sự kiện — bao gồm cả các lần thử bị chặn — đều được ghi vào **nhật ký kiểm toán chỉ thêm, nối chuỗi băm, có thể đọc công khai**. Cơ sở dữ liệu từ chối các chuyển đổi trạng thái bất hợp pháp bên dưới mọi client và khóa. Điều mà nó chưa thể từ chối là sự xâm phạm vào chính nhà vận hành nền tảng — đó là điều mà ký ngưỡng sẽ giải quyết, và cho đến khi tính năng đó được phát hành, bạn nên coi "Champollion không giữ bất kỳ phần chia khóa nào" là mục tiêu thiết kế đang hướng tới, chứ không phải là một đặc tính mà bạn có thể xác minh ngày hôm nay.

## Bước 6 — Thiết lập giải thưởng và tuyên bố các điều khoản

Giải thưởng là tùy chọn. **Một cuộc thi không tuyên bố điều khoản giải thưởng chỉ đơn giản là không có giải thưởng** — đó là mặc định, và nó không hề là một cuộc thi kém giá trị hơn.

Nếu bạn dự định trao giải, hãy quyết định và công bố cùng với cuộc thi:

- **Số tiền và loại tiền tệ.**
- **Nhà tài trợ** — ai là người cấp tiền.
- **Nơi tiền được giữ** — tài khoản của tổ chức bạn, hoặc một quỹ tín thác cộng đồng do bạn chỉ định. **Champollion không bao giờ giữ, ký quỹ hay chuyển tiếp tiền giải thưởng.** Việc công bố danh tính của bên giữ tiền ngay từ đầu là điều làm cho giải thưởng trở nên đáng tin cậy; xem [ghi chú về rủi ro vỡ nợ của nhà tài trợ](/docs/network/sovereignty/terms-templates#trojan-horse-risks) trong các mẫu điều khoản.
- **Điều kiện ngưỡng** — mức điểm mà một phương pháp phải vượt qua, được viết theo [Quy cách giải thưởng](/docs/network/specifications/prizes): một ngưỡng chrF++, bất kỳ cổng chẩn đoán nào bạn muốn (chẳng hạn như tỷ lệ chấp nhận FST tối thiểu — một cổng mà bài dự thi phải vượt qua, không bao giờ là điểm số), yêu cầu xác thực bởi người bản ngữ, tính tái lập. Hãy đảm bảo các điều kiện trao giải có thể xác minh được từ các điểm số đã công bố, để không ai phải tin vào lời nói của bạn (hoặc của chúng tôi) về việc ngưỡng đã được vượt qua hay chưa.
- **Điều khoản giải thưởng** — điều gì xảy ra với chính bài dự thi.

### Điều khoản giải thưởng là do bạn chọn

Khâu thực thi là cố định: trong một cuộc thi có chủ quyền, người tham gia giao cho bạn một mô hình hoặc một phương pháp và nút của bạn sẽ chạy nó. Điều gì xảy ra với nó *sau đó* là lựa chọn của bạn, và là một trong ba lựa chọn:

| Điều khoản | Những gì bạn thông báo cho người tham gia |
|---|---|
| `pass_to_holders` — *chuyển giao cho bên nắm giữ* | Phương pháp được chuyển giao cho bạn, những người nắm giữ chuẩn đối sánh có chủ quyền. Bạn chấm điểm và giữ lại phương pháp, bất kể ai thắng. |
| `retain_ip` — *giữ lại quyền sở hữu trí tuệ* | Người tham gia giữ quyền sở hữu. Bạn chấm điểm bài dự thi và chỉ giữ lại tối đa một bản sao niêm phong để kiểm toán. |
| `release_open` — *phát hành mở* | Người tham gia giữ quyền sở hữu nhưng phải phát hành phương pháp theo giấy phép mở. Việc phát hành đó là điều kiện nhận giải. |

Các chi tiết bắt nguồn từ điều khoản, vì vậy không có ma trận nào cần điền: những gì bạn giữ lại (`retention`), liệu có quyền nào bị dịch chuyển hay không (`rights`), bạn có thể sử dụng nó vào việc gì (`host_use`) và liệu người tham gia có phải phát hành hay không (`release`) đều được **suy ra** từ tùy chọn bạn đã chọn. Hai trong số các tùy chọn cho phép bạn thu hẹp một trường:

- dưới `retain_ip`, `--prize-retention delete_after_scoring` sẽ hủy tạo phẩm sau khi nó đã được chấm điểm (mặc định là giữ một bản sao niêm phong để kiểm toán);
- dưới `release_open`, `--prize-release-timing` chuyển việc phát hành sang `required_before_scores` hoặc `required_after_prize` (mặc định là `required_before_prize`), và `--prize-release-license` chỉ định tên giấy phép thay vì chấp nhận bất kỳ giấy phép nào được OSI phê duyệt (`any_osi`).

Bảng suy dẫn đầy đủ, và cách từng tùy chọn được xác minh trước khi giải ngân, có trong [Quy cách giải thưởng §2.1, điều kiện 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Dù bạn chọn phương án nào, điều khoản sẽ được in lại cho bạn bằng ngôn ngữ rõ ràng kèm theo mã **SHA-256** trước khi có bất cứ thứ gì được ghi lại. Mã băm đó là token chấp nhận: một người tham gia chuyển `--accept-terms <hash>`, việc chấp nhận được đóng gói vào bundle của họ và được bao hàm bởi mã băm nội dung của nó, và nút của bạn sẽ từ chối một bundle đã chấp nhận bất kỳ điều gì khác. Điều khoản sẽ đóng băng ngay khi cuộc thi của bạn có bài dự thi đầu tiên, do đó không ai có thể bị ràng buộc vào các điều khoản mà họ chưa từng đọc.

Tiền bạc cố tình *không* phải là một phần của điều khoản: số tiền, loại tiền và nhà tài trợ là thông tin cuộc thi, và một điều khoản về việc ai sở hữu phương pháp là một loại tuyên bố khác với điều khoản về việc chi trả bao nhiêu tiền.

## Bước 7 — Tạo cuộc thi

Các cuộc thi trên các tập dữ liệu niêm phong sử dụng **luồng niêm phong (sealed lane)** rõ ràng. Điều kiện tham gia là an toàn khi đóng (fail-closed):
cuộc thi sẽ bị từ chối trừ khi đăng ký tập dữ liệu niêm phong của bạn tồn tại và đang hoạt động — và việc tạo cuộc thi **không cấp cho ai** bất kỳ quyền truy cập nào vào tập dữ liệu.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Hai trong số các cờ đó được cố định hoặc đóng băng bởi cơ sở dữ liệu bất kể bạn làm gì sau đó, và ba cờ khác là các **cam kết**:

- `--use-context` là một phần danh tính của cuộc thi: nó được cố định ngay khi cuộc thi được đăng ký và không bao giờ có thể thay đổi (thay vào đó hãy tạo một cuộc thi mới). Mặc định là `non-commercial`.
- `--primary-metric` (mặc định `chrf_plus_plus`), chỉ số mà bảng xếp hạng sử dụng, bị đóng băng một khi cuộc thi có bài dự thi đầu tiên. Một cuộc thi mới nêu tên chỉ số cũ đã ngừng dùng `composite` sẽ bị từ chối kèm theo lý do; các cuộc thi được đăng ký trước [tiêu chuẩn chấm điểm](/docs/network/specifications/scoring#how-runs-are-scored) vẫn tiếp tục hoạt động.
- `--visibility` (mặc định `public`), `--description` và việc cổng tiếp nhận có mở hay không đều không bị đóng băng.

Ba cam kết này bị đóng băng ngay khi cuộc thi của bạn có bài dự thi đầu tiên:

- `--prize-disposition` / `--prize-terms` — điều khoản từ Bước 6. Bỏ qua cả hai thì cuộc thi không có giải thưởng.
- `--results-visibility hidden_until_close` — mọi điểm số mà nút của bạn đo được đều **bị giữ lại** cho đến khi bạn đóng cuộc thi, để không ai tinh chỉnh đối phó với tập niêm phong từ kết quả của chính họ. Đây là mặc định; ví dụ nêu rõ điều này để cam kết hiển thị trong ghi chú của chính bạn. Hãy truyền `--results-visibility immediate` nếu bạn muốn một bảng trực tiếp thay thế, với mỗi thẻ được xuất bản ngay khi nút của bạn hoàn thành nó.
- `--anonymize-until-close` — người tham gia xuất hiện dưới các bút danh ổn định trong bảng xếp hạng của bạn trong khi cuộc thi đang mở. (Đây là chế độ xem xếp hạng của bạn; nó không ẩn danh một thẻ một khi thẻ đó được xuất bản lên bảng mở.)

Ba cờ tương tự cũng có sẵn trên `contest prepare` và `contest register`, đây là nơi hầu hết các nhà tổ chức sẽ thiết lập chúng, vì các cổng này tạo cuộc thi cho bạn. Với `contest prepare --no-register`, các cờ đăng ký bạn truyền (`--results-visibility`, `--anonymize-until-close`, `--primary-metric`, các cờ giải thưởng, `--visibility`, `--use-context`, `--closed-intake`) được ghi vào `local/manifest.json`, và `contest register --manifest` áp dụng chúng trừ khi bạn truyền các cờ riêng của nó, thông báo khi một cờ thay thế một giá trị đã ghi. Prepare in ra từng điều khoản này kèm giá trị của nó, dù bạn đã cung cấp hay đó là giá trị mặc định, và thời điểm nó không còn có thể thay đổi được nữa, trước khi bất cứ điều gì được đăng ký. Mục `--help` của nó nêu tên từng giá trị mặc định.

*(Giá trị `--corpus` là `sealed_set_id` đã đăng ký của bạn. Luồng niêm phong được chọn **tự động** từ đăng ký tập dữ liệu niêm phong — không cần thêm cờ;
một tập dữ liệu niêm phong không bao giờ có thể hỗ trợ một cuộc thi thông thường, và một tập dữ liệu bị cách ly thông thường không bao giờ có thể hỗ trợ bất kỳ cuộc thi nào.
Cả hai quy tắc đều được thực thi trong cơ sở dữ liệu, bên dưới mọi máy khách. Nếu bạn đã đăng ký ở Bước 4 với `contest register` hoặc `prepare --self-serve`,
hàng cuộc thi **đã tồn tại** — hãy bỏ qua bước này; việc thực hiện `contest create` thủ công chỉ dành cho việc lắp ráp một cuộc thi từ một tập dữ liệu niêm phong đã được đăng ký trước đó.)*

## Bước 8 — Các phương pháp phải vượt qua vòng loại công khai trước

Các nhà phát triển xây dựng và chấm điểm các phương pháp của họ trên **tập dev công khai** mà bạn đã phát hành ở Bước 1. `current_qualifier_id` của tập niêm phong của bạn nêu tên vòng thi đó, và một phương pháp phải vượt qua ngưỡng của nó trước khi một lần chạy niêm phong có thể được yêu cầu. Điều này giúp ngăn chặn áp lực thăm dò lên ngữ liệu của bạn: không ai được phép nhắm vào tập niêm phong cho đến khi họ thể hiện được hiệu suất thực sự một cách công khai.

Người tham gia tự chạy nó, ngoại tuyến, chỉ bằng một lệnh:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

ID tiêu chuẩn vượt qua và ngưỡng là hai dữ kiện mà việc chấm điểm cần từ bạn, vì vậy hãy công bố cả hai cùng với bản phát hành dev. Đối với một cuộc thi được tạo bằng `contest prepare`, ID tiêu chuẩn vượt qua chính là ID của ngữ liệu dev (`dataset.corpus_id` của nó), và prepare sẽ ghi ngưỡng vào phần mô tả của ngữ liệu dev. Nếu không có hai cờ `--offline-…`, qualify sẽ đọc chúng từ cơ sở dữ liệu cuộc thi. Điều đó chỉ hoạt động khi cuộc thi đã được đăng ký trên endpoint mà người tham gia đang trỏ tới. Khi cuộc thi không có ở đó, hoặc không thể tiếp cận cơ sở dữ liệu, qualify sẽ dừng lại và in lệnh ngoại tuyến ở trên, được điền sẵn các đối số của chính người tham gia.

`--dev` nhận các bản dịch của người tham gia cho tập dev theo định dạng mỗi dòng một bản dịch theo thứ tự ngữ liệu, dưới dạng JSON được đánh khóa theo entry id, hoặc dưới dạng nhật ký chạy mà `mt-eval run --corpus <the dev corpus>` wrote (or its `_report.json` tạo ra. Nhật ký chạy được đọc theo entry id và được kiểm tra để đảm bảo đó là một lần chạy trên cùng ngữ liệu dev đó; nhật ký có các mục bị lỗi sẽ bị từ chối, vì mọi mục đều phải được chấm điểm. Phần tóm tắt sau đó sẽ thông báo rằng các kết quả đầu ra được tạo bởi harness trong lần chạy đó và được chấm điểm lại từ tệp của nó (kèm chi phí của lần chạy đó), chứ không bao giờ nói rằng chúng được tạo bên ngoài harness; chỉ một tệp giả thuyết thuần túy mới được mô tả theo cách đó.

**Vượt qua bài kiểm tra chưa phải là nộp bài.** Sau phán quyết, qualify sẽ cho biết những gì nó có thể nhận định về việc nộp bài. Đối với một lần chạy plugin phương pháp có thư mục nằm trên máy, nó chạy cùng một quy trình quét tĩnh mà `submit-method` và nút của bạn chạy (các thư viện mạng, các công cụ mạng shell, các đường dẫn hệ thống tệp bị cấm) và hiển thị bất cứ thứ gì sẽ bị từ chối, chẳng hạn như một plugin import `urllib` để gọi một máy chủ mô hình. Đối với một lần chạy đường dẫn LLM riêng của harness (một mô hình được truy cập qua nhà cung cấp), nó sẽ báo rằng không có phương pháp nào để nộp ở trạng thái hiện tại: nút chạy bài dự thi mà không có mạng, vì vậy mô hình phải được chuyển vào bên trong nó (xem phần *Đóng gói mọi mô hình mà phương pháp của bạn gọi* bên dưới). Nếu không, dòng thông báo vượt qua sẽ nêu tên các bước kiểm tra vẫn còn ở phía trước tại thời điểm nộp bài. Không có điều nào trong số này làm thay đổi phán quyết hay biên nhận.

Nó in điểm tiêu chuẩn vượt qua (thứ dùng làm cổng chặn) và ngưỡng cạnh nhau, cả hai đều trên thang điểm tiêu chuẩn vượt qua chrF++ 0–100, sau đó là bản chất của điểm số: corpus chrF++ với chữ ký sacreBLEU của nó, các chỉ số tiêu chuẩn khác bên cạnh (không bao giờ trộn lẫn), khớp chính xác như một chẩn đoán không bao giờ dùng làm cổng chặn, và bất kỳ lưu ý nào về điểm số. Qualify không xuất bản bất cứ điều gì. Một hệ thống có các đầu ra dev chủ yếu là bản sao chép văn bản nguồn của chúng sẽ bị từ chối bất kể nó đạt điểm bao nhiêu: khi một nửa hoặc nhiều hơn là bản sao nguồn (bỏ qua chữ hoa/thường, dấu phụ và dấu câu, và loại trừ các dòng mà bản tham chiếu chính là nguồn, chẳng hạn như tên riêng), người tham gia không thực sự dịch thuật. Quy tắc tương tự sẽ từ chối nó một lần nữa khi nút của bạn thực thi lại nó. Thao tác đó sẽ ghi một **biên nhận tiêu chuẩn vượt qua** trên máy của họ, mà nếu không có nó thì `submit-model` và `submit-method` sẽ từ chối tạo bài nộp. Các biên nhận được lưu giữ theo từng cuộc thi và từng hệ thống (`--system`), vì vậy một người tham gia đạt chuẩn hai hệ thống sẽ giữ lại cả hai; việc đạt chuẩn lại cùng một hệ thống sẽ lưu biên nhận trước đó bên cạnh. `submit-method` và `submit-model` sử dụng biên nhận cho `--system` (mặc định: biên nhận cho `--name`, nếu không thì là biên nhận duy nhất của cuộc thi) và từ chối, kèm theo danh sách, khi có sự mơ hồ. Biên nhận vốn dĩ là tự báo cáo — do đó nó không phải là thứ làm cổng chặn. Trước khi bất kỳ quyền cấp nào được xác nhận, **nút của bạn sẽ thực thi lại phương pháp đã nộp trên cùng tập dev đó** và so sánh phép đo của chính nó với tuyên bố; một biên nhận phóng đại phương pháp sẽ bị từ chối tại đó, với thông tin đối chiếu giữa tuyên bố và phép đo thực tế trong thông báo từ chối.

**Một biên nhận nêu tên lần chạy đã tạo ra nó.** Khi `--dev` là nhật ký chạy (hoặc `_report.json` của nó), biên nhận sẽ ghi lại lần chạy và mô hình mà nó đã chạy: đối với `mt-eval run --method local-model -m <model>`, là ID Hugging Face và bản sửa đổi, hoặc thư mục mô hình kèm theo mã SHA-256 trên các tệp của nó. Một nhật ký chạy `local-model` không nêu tên mô hình sẽ bị từ chối — các bản dựng 0.2.0 trước đây không truyền `-m` cho engine đó, khiến nó chạy một mô hình dự phòng tiếng Anh→tiếng Tây Ban Nha thay thế. `submit-model` sau đó sẽ kiểm tra xem các trọng số mà nó đóng gói có nằm trong số các tệp mà biên nhận nêu tên hay không, và từ chối, nêu tên cả hai mã băm, nếu không khớp. Một biên nhận được chấm điểm từ một tệp giả thuyết thuần túy không nêu tên mô hình nào; việc nút thực thi lại chính là bước kiểm tra đối với tệp đó.

**Khoảng cách giữa biên nhận và nút được gắn cờ.** Cả hai con số đều được tính toán theo cùng một cách — cùng một bộ chấm điểm, cùng một tập dev, và đối với mô hình là cùng một quy tắc độ dài giải mã — do đó cùng một trọng số sẽ cho kết quả trong khoảng chênh lệch rất nhỏ. Khi con số của nút và của biên nhận chênh lệch nhau hơn **2.0 điểm** trên thang điểm tiêu chuẩn vượt qua 0–100, nút sẽ thông báo điều đó sau khi thực thi lại; một nút air-gap cũng ghi lại khoảng chênh lệch cùng với kết quả kiểm tra vào sổ cái cục bộ của nó và in lại cho người giám hộ tại `node approve --offline`. Đó là một cờ cảnh báo, không bao giờ là sự từ chối: con số của chính nút mới là thứ dùng làm cổng chặn. (Giới hạn 2.0 là một lựa chọn thận trọng có chủ đích để dễ dàng gắn cờ; đó là giá trị chính sách mà ban tổ chức có thể muốn xem xét lại.)

### Người tham gia có thể diễn tập mọi thứ trước khi nộp bài

Không ai muốn biết rằng gói của họ bị dị tật thông qua một thông báo từ chối vài ngày sau đó. `mt-eval contest validate` chạy, trên máy của người tham gia và không cần mạng, chính xác những gì nút của bạn sẽ chạy đầu tiên:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Nó in một bảng kết quả phát hiện và thoát với mã khác 0 nếu có bất kỳ điều gì sẽ bị từ chối (`--json` dành cho công cụ tự động). Hãy hướng dẫn người tham gia sử dụng lệnh này trong thư kêu gọi tham gia của bạn: họ chỉ tốn một lệnh và giúp bạn tránh khỏi việc phải từ chối bài nộp.

`validate` không ghi bất cứ thứ gì. Nó chấm điểm lại đầu ra dev mà không ghi biên nhận, sau đó kiểm tra một biên nhận:

- **Một gói đã đóng gói** (tệp `.tar.gz` mà lệnh submit đã ghi) mang theo biên nhận được đóng gói cùng nó, và bản sao đó là bản mà nút của bạn đọc. Vì vậy validate sẽ kiểm tra diễn tập đối chiếu với bản sao đó. Nó cũng tìm biên nhận trên máy của người tham gia nơi bản sao bắt nguồn và nêu tên hệ thống của nó, bất kể phương pháp của gói được gọi là gì. Nó cảnh báo khi `--system` chỉ định một biên nhận khác, và khi người tham gia đã đạt chuẩn lại hệ thống đó kể từ khi đóng gói (gói vẫn mang biên nhận cũ hơn). Nếu không có các cờ `--offline-…`, ID tiêu chuẩn vượt qua và ngưỡng cũng được lấy từ bản sao đó, nghĩa là chúng là các giá trị mà người tham gia đã cung cấp cho `contest qualify`. Kết quả phát hiện sẽ thông báo điều đó.
- **Một thư mục nguồn** được đóng gói để kiểm tra bằng `--manifest`: validate sử dụng biên nhận mà `submit-method` và `submit-model` sẽ nhúng vào, được tìm thấy theo cách mà các lệnh đó tìm kiếm: `--system`, nếu không thì là biên nhận có tên giống như phương pháp của gói, nếu không thì là biên nhận duy nhất của cuộc thi.

Nó cảnh báo khi biên nhận đó bao quát đầu ra dev khác, một tệp dev khác hoặc một tiêu chuẩn vượt qua khác. Nó cũng cảnh báo khi không có biên nhận nào. Biên nhận chỉ bắt nguồn từ `contest qualify`.

Đây là một buổi diễn tập, và lệnh nêu rõ điều đó. Nút của bạn vẫn sẽ build image mà không có mạng, chạy container và tự chạy lại tiêu chuẩn vượt qua. Một kết quả validate sạch sẽ chỉ có nghĩa là chưa có gì *được biết trước* là sai — chứ không đảm bảo rằng lần chạy sẽ đạt điểm.

:::note[Người tham gia: cuộc thi của bạn nằm trên endpoint nào?]
Một cuộc thi **do mạng lưu trữ** không cần thiết lập endpoint — endpoint mặc định đi kèm với harness đã chứa sẵn cơ chế cuộc thi (cổng tiêu chuẩn vượt qua, đề xuất phương pháp, ủy quyền), và `mt-eval contest submit-model` / `submit-method` nói chuyện trực tiếp với nó. Bạn cần harness **0.2.0 trở lên** (`mt-eval --version`); các phiên bản trước đó thiếu `qualify`, `validate`, `rank` và `close`. Các cuộc thi do mạng lưu trữ chỉ mở khi ban tổ chức được đăng ký qua cánh cửa được mô tả trong lưu ý ở trên, vì vậy hầu hết các cuộc thi ngày nay là **liên kết**.

Một cuộc thi **liên hợp (federated)** — ban tổ chức chạy cơ chế trên dự án Supabase của riêng họ, vì vậy các bài nộp không bao giờ đi qua hệ thống của chúng tôi — sẽ công bố endpoint của nó cùng với tài liệu cuộc thi. Hãy xuất nó trước khi nộp:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Nếu bộ công cụ được trỏ đến một endpoint không có cơ chế cuộc thi (ví dụ: một máy chủ liên hợp thiếu một migration), lệnh sẽ dừng lại với thông báo *"the contest lane isn't available on this Supabase endpoint yet"* (luồng cuộc thi chưa có sẵn trên endpoint Supabase này) và cho bạn biết nó đang giao tiếp với endpoint nào. (Ban tổ chức liên hợp: hãy công bố hai giá trị này bên cạnh bản phát hành ngữ liệu của bạn, `--node-id`, và `--corpus-version`.)
:::

## Bước 9 — Các lượt chạy niêm phong: yêu cầu, ủy quyền, thực thi, xuất điểm số

Đối với mỗi bài dự thi:

1. Một **yêu cầu** được nộp đối chiếu với tập niêm phong của bạn — nó đi vào `pending` và mang một dấu vân tay bất biến gồm (mã băm gói, ID ngữ liệu, phiên bản ngữ liệu, `scores-only`, phép đo của nút đánh giá).
2. Nút của bạn chạy các **bước kiểm tra tĩnh của chính nó** trên gói. Đối với bài dự thi dạng mã code (Luồng B), sau đó nó sẽ kiểm tra xem liệu nó có thể chạy được bài đó hay không: container runtime có hiện diện hay không, và RAM, đĩa tạm cùng thời gian chạy mà gói khai báo có vừa với các mức giới hạn tối đa `sandbox` của bạn hay không. Việc không đáp ứng ở bước này không phải là một phán quyết về phương pháp. Lệnh từ chối sẽ nêu tên từng điểm không khớp ("8 GB RAM requested, this node allows 4 GB (sandbox.max_ram_gb)"), không có gì bị chạy hoặc bị bác bỏ, và yêu cầu vẫn giữ nguyên trạng thái. Bạn có thể nâng mức giới hạn trong `node.json` và chạy lại `mt-eval node run-method <id>` mà không cần nộp lại bài. Hoặc người tham gia có thể đóng gói lại với các cờ mà thông báo từ chối in ra (ví dụ `--ram-gb 4`); các yêu cầu tài nguyên nằm bên trong mã băm của gói, vì vậy đó sẽ là một yêu cầu mới. Sau đó, nút **thực thi lại tuyên bố tiêu chuẩn vượt qua của người tham gia** trên bản sao tập dev công khai của chính nó. Biên nhận của họ là một tuyên bố; đây là phép đo thực tế. Việc không đạt sẽ bị từ chối tại đây — trước khi bất kỳ người giám hộ nào được yêu cầu phê duyệt bất cứ điều gì, và trước khi tập niêm phong được mở — và thông báo từ chối nêu rõ những gì đã được tuyên bố, những gì đã được đo lường, và ngưỡng chuẩn là bao nhiêu. Một gói chấp nhận các điều khoản giải thưởng khác với các điều khoản mà cuộc thi của bạn tuyên bố cũng sẽ bị từ chối tại cùng thời điểm này.
3. Các **người giám hộ của bạn đưa ra quyết định** (M-trên-N). Sự phê duyệt sẽ tạo ra một **quyền cấp**: dùng một lần, có thời hạn, chỉ hợp lệ cho chính xác dấu vân tay đó.
4. Đánh giá chạy trong hộp cát cách ly mạng trên nút của **bạn** (`mt-eval node run-method`): một container không có ngăn xếp mạng, các câu tham chiếu được giữ bên ngoài nó — hoặc, để cách ly tối đa, trên một máy air-gap thực sự với các gói chỉ chứa điểm số đã ký được chuyển qua phương tiện lưu trữ rời (xem hộp trạng thái ở trên để biết những gì được và chưa được hỗ trợ). Một nút tối không tải lên bất cứ thứ gì: bạn mang gói điểm số đã ký của nó ra ngoài và xuất bản thẻ chạy từ một máy có kết nối mạng (`mt-eval node relay`). Tập giữ lại niêm phong và bất kỳ bộ kiểm thử của bên thứ ba nào đã khai báo đều chạy trong **cùng** một lần chạy được ủy quyền, do đó chúng không tốn thêm nghi thức nào của người giám hộ.
5. **Chỉ có điểm số rời khỏi máy.** Quy tắc phát hành `scores-only` được ghim ở tầng cơ sở dữ liệu; văn bản theo từng bài nộp từ ngữ liệu của bạn không bao giờ được xuất bản.
6. Nếu cuộc thi của bạn đã cam kết `hidden_until_close`, điểm số sẽ chưa được xuất bản ngay: nó **bị giữ lại** như một kết quả trì hoãn mà chỉ bạn mới có thể nhìn thấy, và `contest close` sẽ xuất bản mọi thẻ bị giữ lại trước khi đóng băng bảng xếp hạng. Một kết quả bị giữ lại không bao giờ là một kết quả bị mất.
7. Mọi bước — yêu cầu, các phiếu bầu, quyền cấp, việc sử dụng và bất kỳ lần thử nào bị chặn — đều được ghi thêm vào nhật ký kiểm toán công khai, được nối chuỗi băm mà bạn (và bất kỳ ai) đều có thể phát lại.

## Nộp phương pháp (dành cho người tham gia) — hai luồng

Hầu hết các bài dự thi NMT không hề xa lạ: một mô hình transformer tinh chỉnh tiêu chuẩn và các trọng số của nó. Đối với những trường hợp đó, có một **luồng ưu tiên, không chứa mã code** — và một phương án dự phòng bằng hộp cát cho các phương pháp thực sự là mã code.

### Luồng A — mô hình khai báo (ưu tiên cho NMT tiêu chuẩn)

Nếu phương pháp của bạn là một mô hình neural tiêu chuẩn, bạn nộp nó dưới dạng **dữ liệu** — trọng số, bộ tách từ và cấu hình — và ban tổ chức sẽ chạy nó trong engine suy luận đáng tin cậy của riêng họ. **Không có Dockerfile, không có mã code, không có hộp cát.** Vì không có thứ gì bạn nộp được thực thi, việc kiểm tra độ an toàn của ban tổ chức là một bước xác thực định dạng có thể quyết định được thay vì cố gắng chứng minh mã code tùy ý là an toàn — một sự đảm bảo mạnh mẽ hơn hẳn cho cả bạn và cho ngữ liệu.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Một mô hình được huấn luyện bằng NMT Forge.** `nmt-forge export` ghi thư mục có thể triển khai `export/model/`. Bên cạnh trọng số, cấu hình và bộ tách từ, nó còn chứa `forge-model.json` (điểm số của mô hình đó trên tập kiểm thử riêng của bạn, và các đường dẫn cục bộ), `DEPLOY.md` và `champollion-plugin/`, không có mục nào trong số này là một phần của bài dự thi. `submit-model` chỉ đóng gói các tệp mà transformers đọc (trọng số, `config.json`, `generation_config.json`, các tệp bộ tách từ) và in ra mọi thứ nó đã bỏ qua, do đó ba mục kia sẽ tự động được giữ lại bên ngoài. Phần 6 của `DEPLOY.md` đó liệt kê các tệp tạo nên bài dự thi, kiến trúc từ `config.json`, và số lượng tham số được đọc từ phần đầu của tệp trọng số, kèm theo lệnh chính xác. Để gửi chính xác các tệp bạn đã xem xét, hãy sao chép chúng vào một thư mục riêng và truyền thư mục đó dưới dạng `--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Số lượng tham số nào.** Luồng A kiểm tra `--parameter-count` đối chiếu với tệp trọng số. Nó cộng tổng kích thước các tensor trong header `safetensors` và từ chối một tuyên bố chênh lệch hơn 1%. Đó là những gì tệp lưu trữ, và nó có thể khác với số lượng đếm được trong torch. Một trọng số ràng buộc hoặc dùng chung được lưu trữ một lần. Một bảng mà mô hình xây dựng lại khi tải, chẳng hạn như vị trí hình sin, có thể hoàn toàn không được lưu. Thông báo từ chối sẽ in ra số lượng đếm được của tệp; hãy khai báo con số đó.

Các quy tắc mà gói của bạn phải đáp ứng (được xác thực cục bộ trước khi tải lên, và một lần nữa bởi nút của ban tổ chức):

- **Trọng số là `safetensors`, không bao giờ là pickle.** Tệp PyTorch `.bin`/`.pt`/`.ckpt` là một pickle — thực thi mã code tùy ý khi tải — và bị từ chối. Hãy xuất sang `model.safetensors` (`safetensors` / `transformers` thực hiện việc này một cách tự nhiên).
- **Một kiến trúc mà engine của ban tổ chức tải được một cách tự nhiên.** `architectures` của `config.json` có thể là bất kỳ kiến trúc nào mà `transformers` của máy chủ triển khai (Marian, NLLB/M2M100, mBART, T5, Pegasus, và nhiều kiến trúc khác) — các máy chủ **mặc định cho phép**, vì với `trust_remote_code=False` sự an toàn đến từ định dạng không chứa mã code, chứ không phải từ tên kiến trúc (một kiến trúc không được hỗ trợ đơn giản là không tải được, không chạy bất cứ thứ gì). Một máy chủ cẩn trọng có thể công bố một danh sách cho phép. Không có `auto_map`, không có `trust_remote_code` — những mục đó lén đưa mã tùy chỉnh trở lại và luôn bị từ chối.
- **Một bộ tách từ mang tính khai báo** (`tokenizer.json` hoặc một `.model` `sentencepiece` + từ vựng), và **chỉ các tệp dữ liệu** — không có `.py`/script/tệp nhị phân trong gói.

**Những gì `submit-model` đóng gói.** Các tệp dữ liệu tại thư mục gốc của `--model-dir` (`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): trọng số, cấu hình, bộ tách từ và cấu hình sinh. Mọi thứ khác — một tệp `README.md` hoặc `DEPLOY.md`, một thư mục con, một checkpoint pickle bên cạnh safetensors — đều bị loại bỏ, và lệnh sẽ liệt kê những gì nó đã bỏ qua. Vì vậy, thư mục `model/` mà `nmt-forge export` ghi ra có thể nộp nguyên trạng: `DEPLOY.md` và `champollion-plugin/` của nó sẽ được giữ lại phía sau. `contest validate` đóng gói theo cách tương tự và báo cáo các tệp bị bỏ qua dưới dạng phát hiện INFO. Việc kiểm tra của nút của bạn không thay đổi: một gói mang tệp không phải dữ liệu vẫn sẽ bị từ chối tại đó.

**Đầu ra có thể dài bao nhiêu.** Nút của bạn luôn giải mã với độ dài rõ ràng: `max_new_tokens` hoặc `max_length` mà mô hình khai báo (`generation_config.json` của nó), nếu không thì tối đa `max(64, 4 × source tokens)` token mới cho mỗi câu, bị giới hạn bởi các vị trí của bộ giải mã. `mt-eval run --method local-model` giải mã theo cùng một quy tắc, do đó biên nhận của người tham gia và việc thực thi lại của nút của bạn sẽ khớp nhau. `submit-model` in ra độ dài sẽ áp dụng và ghi nó vào manifest (`model.decodeLength`); nút ghi lại độ dài mà nó đã áp dụng trong các dữ kiện thực thi của lần chạy (`execution.generation`). Nếu không có độ dài rõ ràng, thư viện transformers sẽ dừng ở khoảng 20 token, và mọi bài dự thi sẽ bị chấm điểm trên đầu ra bị cắt ngắn.

Ban tổ chức chạy nó với `trust_remote_code=False`, ngoại tuyến, và chỉ có điểm số rời khỏi máy — được xuất bản dưới dạng `declarative-model`, danh tính phương pháp **vốn dĩ không chứa mã code**. (Trọng số nhiều GB: sử dụng `--bundle-out` cho luồng sneakernet, tương tự như bên dưới.)

### Luồng B — gói có thể chạy (hộp cát, dành cho các phương pháp dạng mã code)

Nếu phương pháp của bạn thực sự là mã code — một pipeline, một hệ thống lai có LLM hỗ trợ, một bộ giải mã tùy chỉnh — nó không thể chạy theo cách khai báo, vì vậy nó sẽ đi qua hộp cát cách ly mạng. Đây là luồng thực tế yếu hơn về mặt bảo mật (nó chứa mã không đáng tin cậy thay vì từ chối chạy nó), vì vậy hãy sử dụng Luồng A bất cứ khi nào phương pháp của bạn là một mô hình tiêu chuẩn.

**Đóng gói mọi mô hình mà phương pháp của bạn gọi.** Nút chạy bài dự thi của bạn hoàn toàn không có mạng, vì vậy một phương pháp gọi API mô hình được lưu trữ trên máy chủ (một hệ thống lai được hỗ trợ bởi LLM gọi một LLM đám mây, một dịch vụ MT) sẽ không nhận được phản hồi và không có điểm số. Một hệ thống lai được hỗ trợ bởi LLM chỉ đạt chuẩn khi LLM của nó nằm bên trong gói: các trọng số mở dưới `/method`, chạy cùng tiến trình hoặc bởi một máy chủ cục bộ mà entrypoint của bạn khởi động. Điều tương tự cũng áp dụng cho bất kỳ từ điển, FST hoặc dữ liệu nào khác mà phương pháp của bạn đọc tại thời điểm chạy. ([Quy cách phương pháp](/docs/network/specifications/methods#method-validity-and-dependency-classes) gọi một phương pháp cần LLM được lưu trữ trên máy chủ là lớp phụ thuộc A1; cổng kết nối cho phép lớp này chạy trong hộp cát hiện chưa được xây dựng.)

**Hợp đồng của gói có thể chạy là stdin/stdout.** Bên trong container, nút của ban tổ chức chạy chính xác:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Các câu nguồn đến từng dòng một trên stdin; bạn ghi một bản dịch trên mỗi dòng ra stdout. Container không có ngăn xếp mạng (`--network=none`), thư mục gốc chỉ đọc, và một thư mục `/tmp` có thể ghi.

**Nơi lưu trữ các tệp của bạn.** Mọi thứ trong thư mục bạn truyền dưới dạng `--method-dir` đều được đóng gói dưới `method/` trong gói và được gắn kết **chỉ đọc tại `/method`** khi chạy, bao gồm cả trọng số, vì vậy không cần sao chép thứ gì vào image. Hãy bố trí nó như thế này:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` là đường dẫn của script bên trong `--method-dir`. Đường dẫn trong gói của nó, `method/translate.py`, cũng được chấp nhận. Nếu một tên có thể chỉ hai tệp khác nhau, lệnh sẽ từ chối và nêu tên cả hai; nếu tệp bị thiếu, nó sẽ nêu tên mọi đường dẫn mà nó đã tìm kiếm.

**Một wrapper tối giản cho Hugging Face transformers:**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dockerfile phải build mà không có mạng.** Ban tổ chức build image của bạn với `--network=none` — việc kiểm tra build trong môi trường không mạng *chính là* quá trình build — vì vậy mọi dependency phải được **tích hợp sẵn vào gói** (một lệnh `pip install` cố gắng kết nối tới PyPI sẽ làm hỏng quá trình build, và quá trình quét tĩnh trước khi chạy sẽ gắn cờ các lệnh gọi mạng trước khi bất kỳ thứ gì được gửi đi). Hãy đóng gói các file wheel bên trong thư mục phương thức của bạn và cài đặt từ chúng:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Những gì mọi bài nộp phải mang theo.** Đây là những mục bắt buộc, và lệnh sẽ dừng lại trước bất kỳ bước mạng nào nếu thiếu một mục:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`, `--method-class`, `--developer`, `--node-id`, và `--agree`;
- một **biên nhận `mt-eval contest qualify` đạt chuẩn** cho cuộc thi này và hệ thống này (Bước 8; `--system` chỉ định tên biên nhận khi bạn đã đạt chuẩn nhiều hơn một hệ thống);
- hai khai báo, được ghi lại dưới dạng các tuyên bố của bạn: `--track constrained` hoặc `--track unconstrained` (không có mặc định), và `--parameter-count`;
- đối với phương pháp có trọng số đã huấn luyện (`--parameter-count` lớn hơn 0): cần thêm `--weights-license <SPDX id or LicenseRef-…>` và một trong hai `--weights-public` hoặc `--weights-private`;
- đối với phương pháp **không có trọng số đã huấn luyện** (dựa trên quy tắc, từ điển, FST): `--parameter-count 0` và không có cờ trọng số. Bài nộp sẽ ghi lại giấy phép trọng số và tính mở là không áp dụng, thay vì một giấy phép mà bạn phải tự bịa ra;
- đối với phương pháp **dùng prompt cho LLM** (không huấn luyện gì, chỉ viết prompt): số lượng tham số là tham số của mọi mô hình mà gói chạy, bao gồm cả LLM, mặc dù bạn không huấn luyện nó. Hãy lấy nó từ thẻ mô hình của LLM hoặc header trọng số của nó, và truyền giấy phép của LLM dưới dạng `--weights-license` với `--weights-public` khi trọng số của nó có thể tải xuống công khai. `--parameter-count 0` sẽ khai báo sai về hệ thống: 0 có nghĩa là phương pháp không chạy mô hình nào cả. Một phương pháp gọi một LLM được lưu trữ trên máy chủ hoàn toàn không thể tham gia một cuộc thi niêm phong: nút không có mạng, và cổng kết nối để thực hiện các cuộc gọi đó chưa được xây dựng (xem phần *Đóng gói mọi mô hình mà phương pháp của bạn gọi* ở trên). `contest qualify` đã thông báo điều này khi các kết quả đầu ra mà nó chấm điểm đến từ một nhà cung cấp;
- cùng với `--track constrained`: `--training-data-file`, một danh sách văn bản thuần túy về dữ liệu bạn đã dùng để huấn luyện (một phương pháp không huấn luyện trên dữ liệu nào sẽ nêu rõ điều đó trong tệp);
- nếu cuộc thi tuyên bố các điều khoản giải thưởng: `--accept-terms <hash>` (chạy một lần không có cờ này và các điều khoản sẽ được in ra kèm theo mã băm để truyền lại); nếu cuộc thi yêu cầu mô tả: `--description-file`.

**Tài nguyên mà phương pháp của bạn khai báo.** Gói nêu rõ RAM, đĩa tạm và thời gian thực tế mà nó cần, và nút của ban tổ chức sẽ từ chối gói nào yêu cầu nhiều hơn mức trần `sandbox` của nó. Các giá trị mặc định là các mức trần trong mẫu nút mà `mt-eval node init` ghi ra: `--ram-gb 4`, `--disk-gb 4`, `--max-runtime-minutes 30`, không có GPU. Do đó, một gói được đóng gói với các giá trị mặc định sẽ chạy được trên một nút được cấu hình với các giá trị mặc định của mẫu. Nếu phương pháp của bạn cần nhiều hơn, hãy thông báo bằng các cờ đó (và `--gpu`), đồng thời kiểm tra xem nút của ban tổ chức có cho phép hay không. Các nhà tổ chức thay đổi mức trần nên công bố chúng cùng với cuộc thi. Nếu nút từ chối, thông báo từ chối sẽ nêu tên từng giá trị và mức mà nút cho phép.

Nộp nó bằng lệnh:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

Nút của ban tổ chức sẽ thực thi lại phương pháp của bạn trên bản sao tập dev công khai của chính nó trước khi bất kỳ người giám hộ nào được yêu cầu phê duyệt lần chạy. `--agree` xác nhận các điều khoản nộp phương pháp.

**Trọng số nhiều GB, hoặc không có kết nối: sử dụng luồng sneakernet.** Đường dẫn tiếp nhận qua mạng lưu trữ sẽ tải tệp tarball của bạn lên dưới dạng **một lệnh POST đơn lẻ** tới bộ lưu trữ của máy chủ cuộc thi, do đó nó bị giới hạn bởi hạn mức tải lên lưu trữ của máy chủ đó — phù hợp cho mã code và các mô hình nhỏ, nhưng không phù hợp cho các checkpoint nhiều GB. Bản thân hợp đồng gói cho phép các tạo phẩm lớn hơn nhiều (tarball lên tới 100 GB, image đã build lên tới 150 GB). `--offline` đóng gói bundle và ghi một thư mục trao đổi mà hoàn toàn không cần mạng. Khi không có kết nối thì không có hàng cuộc thi nào để đọc, vì vậy lệnh cũng cần các giá trị mà ban tổ chức đã công bố: `--bundle-out`, `--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` và `--offline-threshold` (ngưỡng trên thang điểm tiêu chuẩn vượt qua 0–100). Một phương pháp dựa trên quy tắc không có trọng số, được đóng gói ngoại tuyến:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

Thư mục trao đổi được chuyển đến ban tổ chức bằng phương tiện lưu trữ di động (hoặc bất kỳ kênh nào mà cả hai bên tin tưởng); họ sẽ nạp nó bằng lệnh `mt-eval node import-bundle`. Dù bằng cách nào, mã SHA-256 của gói cũng được đóng băng vào yêu cầu ủy quyền, vì vậy những gì được chạy chắc chắn là những gì bạn đã đề xuất.

**Ban tổ chức: một đề xuất ngoại tuyến phải chờ người giám hộ, tương tự như đề xuất trực tuyến — và nút sẽ kiểm tra nó trước, theo thứ tự ở Bước 9.** Nó đến dưới dạng một yêu cầu *đang chờ*, và nút air-gap sẽ tự ghi lại cả các bước kiểm tra của chính nó lẫn quyết định của người giám hộ, không cần cơ sở dữ liệu và không cần service key:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

Lệnh `node run-method --offline` đầu tiên đối với một đề xuất đang chờ không mở bất cứ thứ gì được niêm phong. Nó thực thi lại tiêu chuẩn vượt qua của người tham gia trên tập dev công khai (`qualifier` + `dev_corpus` mà `node.json` của bạn khai báo; `node init --from-contest` sẽ điền cả hai), và đối với bài dự thi dạng mã code, kiểm tra xem container runtime có hiện diện hay không và RAM, đĩa tạm cùng thời gian chạy đã khai báo của gói có vừa với các mức trần `sandbox` của bạn hay không. Một lần kiểm tra đạt sẽ được ghi vào sổ cái cục bộ được gắn chuỗi băm của nút. Việc không đạt tiêu chuẩn vượt qua sẽ bị từ chối tại đây, được ghi lại dưới dạng sự từ chối của nút, và chuyển ngược trở lại dưới dạng một thông báo từ chối đã ký: không cần hỏi người giám hộ. Một nút không thể chạy bài dự thi (không có runtime, mức trần quá nhỏ) sẽ từ chối như một sự cố của nút và không ghi lại gì, và yêu cầu vẫn giữ nguyên trạng thái.

`node approve --offline` từ chối cho đến khi bước kiểm tra đạt đó nằm trong sổ cái cho chính xác dấu vân tay và gói của yêu cầu này, và lỗi của nó nêu tên lệnh cần chạy trước. Sau đó, nó ghi một phiếu bầu và sự ủy quyền vào cùng một sổ cái (sổ cái mà nghi thức chia sẻ người giám hộ sử dụng) cùng một bản ghi quyết định được ký bằng `signing_key` của nút, nêu tên bước kiểm tra mà nó đã được cấp. Lệnh `node run-method --offline` thứ hai kiểm tra cả ba điều kiện trước khi bất cứ thứ gì được niêm phong chạy (sổ cái xác minh thành công, nó hiển thị yêu cầu này được ủy quyền theo dấu vân tay đã import, và bản ghi đã ký xác minh thành công và nêu tên yêu cầu này), do đó một đề xuất đang chờ không bao giờ chạy chỉ dựa trên lời nói của người vận hành. Sau đó, nó chạy lại bước kiểm tra runtime và tiêu chuẩn vượt qua trước khi tập niêm phong được mở. Một sự từ chối được ghi lại theo cách tương tự và gửi trở lại cho người tham gia dưới dạng một thông báo từ chối đã ký; một người giám hộ có thể từ chối tại bất kỳ thời điểm nào, dù đã kiểm tra hay chưa. Các yêu cầu đã được ủy quyền sẵn khi đến — một bản xuất chuyển tiếp (được ủy quyền trong cơ sở dữ liệu cuộc thi) hoặc `node stage-request` (ban tổ chức staging chính là bên ủy quyền) — không cần quyết định thứ hai.

**Ban tổ chức: tải trước các image cơ sở trên các máy không có mạng.** Bởi vì quá trình build image chạy với `--network=none`, image cơ sở `FROM` của Dockerfile phải có sẵn trong kho lưu trữ image cục bộ của máy. Trên một máy có kết nối mạng, hãy chạy `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; mang theo `base.tar` cùng với gói; trên máy không có mạng, hãy chạy `docker load -i base.tar` trước khi chạy `mt-eval node run-method`. Hãy thống nhất về (các) image cơ sở với những người tham gia trong tài liệu cuộc thi được công bố của bạn.

## Bước 10 — Xếp hạng, đóng, xuất dữ liệu

Các kết quả chỉ chứa điểm số được xuất bản lên [bảng xếp hạng](/docs/network/leaderboard/rules) giống như bất kỳ lần chạy nào khác, được đánh dấu là các đánh giá tập niêm phong. Bảng xếp hạng riêng của cuộc thi là do bạn xây dựng, đóng băng và xuất bản:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Những gì `rank` thực hiện, để bạn có thể nêu rõ trong quy tắc của mình: các bài dự thi được xếp hạng dựa trên **chỉ số chính đã ghi nhận** của cuộc thi (`--primary-metric` khi tạo; mặc định là chrF++), sau đó là chrF++ → BLEU → COMET → bài nộp sớm nhất. Mặc định là **chỉ các bài đã xác minh** — các thẻ chạy mà nút đã xuất bản — và đếm bất kỳ thẻ tự báo cáo nào mà nó đã ẩn. Mọi cặp liền kề đều mang một phán quyết hòa có nhãn: kiểm định ý nghĩa thống kê theo cặp cho từng phân đoạn ở nơi có các hàng theo từng phân đoạn, nếu không thì là **sự trùng lặp khoảng tin cậy 95%**, nếu không thì là sự bằng nhau về điểm số. **Một cuộc thi niêm phong không bao giờ xuất bản các hàng theo từng phân đoạn** (theo thiết kế chỉ xuất bản số liệu tổng hợp), vì vậy kiểm định theo cặp của nó sẽ chạy trên nút của bạn. Trước khi đóng, hãy chạy `mt-eval node verdicts --contest <id> --out verdicts.json` trên nút; lệnh này chỉ ghi các phán quyết đã ký (theo từng cặp: giá trị p, chênh lệch điểm số, khoảng tin cậy, số lượng phân đoạn — không có văn bản). Sau đó đóng bằng `--node-verdicts verdicts.json --verify-key <the node's .pub.json>`. Nếu không có phán quyết, kết quả hòa sẽ dựa vào sự trùng lặp khoảng tin cậy. Dù theo cách nào, đầu ra cũng sẽ nêu tên bằng chứng mà nó đã sử dụng, và các hệ thống hòa điểm sẽ chia sẻ cùng một thứ hạng (`1, 1, 3`).

`close` là thao tác một chiều. Nó xếp hạng dựa trên chỉ số đã ghi nhận, từ chối khi các bài nộp vẫn đang được chấm điểm (trừ khi bạn ép buộc), hiển thị bảng cho bạn xem, hỏi xác nhận, rồi sau đó đóng băng bảng xếp hạng vào hồ sơ cuộc thi. `export` trả về nguyên văn kết quả đã đóng băng đó, dưới dạng JSON hoặc CSV, cho trang Findings hoặc trang kết quả của bạn. Các thẻ được chấm điểm trên bất kỳ tập nào khác (tập T2 hoàn toàn bí mật, một thẻ tập dev lạc) được liệt kê riêng và không bao giờ bị trộn vào bảng xếp hạng chính.

### Quyết định thời điểm kết quả xuất hiện

Hai cam kết bạn đưa ra khi tạo, và không thể âm thầm thay đổi sau đó — cơ sở dữ liệu sẽ đóng băng cả hai ngay khi cuộc thi của bạn có một bài dự thi:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` là cờ thực sự ẩn điểm số.** Dưới cờ này, mọi thẻ mà nút của bạn chấm điểm đều được giữ lại thay vì xuất bản: phương pháp vẫn đã chạy, quyền ủy quyền vẫn đã được sử dụng, và thẻ được lắp ráp, xác thực và lưu trữ nguyên văn — nó chỉ đơn giản là không nằm trên bảng xếp hạng. `contest close` xuất bản mọi thẻ bị giữ lại **trước tiên**, sau đó mới xây dựng và đóng băng bảng xếp hạng, vì vậy không có gì bị mất và kết quả đóng băng sẽ xếp hạng mọi thứ bạn đang giữ. Điều đó cũng xảy ra khi đóng bắt buộc: việc ép buộc là về việc xếp hạng công việc vẫn đang xử lý, chứ không bao giờ là về việc giữ lại một điểm số mà cuộc thi của bạn có nghĩa vụ công bố. Bản chụp nhanh bị đóng băng sẽ liệt kê chính xác những kết quả nào mà việc đóng cuộc thi đã xuất bản.

Bị giữ lại là một **trạng thái được ghi nhận, không phải một lần chạy bị mất**: thẻ bị giữ lại không thể chỉnh sửa, và con trỏ cho biết nơi nó được xuất bản chỉ được ghi một lần và không bao giờ trỏ lại — cả hai đều được thực thi trong cơ sở dữ liệu, bên dưới mọi client. Trong khi cuộc thi đang mở, `rank` sẽ cho bạn biết có bao nhiêu kết quả đang bị giữ lại, để một bảng xếp hạng tạm thời không bao giờ bị đọc nhầm là đã hoàn chỉnh khi thực tế chưa phải vậy.

**`--anonymize-until-close` làm ít việc hơn, và cần làm rõ chính xác nó làm những gì.** Nó thay thế tên người tham gia bằng các bút danh tất định trong các tạo phẩm xếp hạng của *bạn* — bảng `rank`, JSON của nó, CSV — trong khi cuộc thi đang mở, và `close` sẽ tiết lộ chúng. Nó **không** ẩn danh bảng xếp hạng công khai: một thẻ đã được xuất bản sẽ hiển thị dòng tên tác giả mà bài dự thi đã khai báo. Nếu bạn muốn người tham gia không thể nhìn thấy kết quả của nhau trước khi kết thúc, đó là chức năng của `--results-visibility hidden_until_close`; cờ này không thể thay thế cho điều đó.

Nếu một phương pháp vượt qua các điều kiện ngưỡng mà bạn đã công bố ở Bước 6 — bao gồm cả việc [xác thực bởi người bản ngữ](/docs/network/specifications/speaker-validation), vốn là cổng kiểm duyệt của cộng đồng bạn chứ không phải tự động — **bạn** (hoặc quỹ tín thác của bạn) sẽ trao giải thưởng theo các điều khoản đã công bố của chính bạn. Vai trò của Champollion dừng lại ở khâu đo lường.

---

## Những gì bạn giữ lại, mãi mãi

- **Tập dữ liệu.** Nó không bao giờ rời khỏi cơ sở hạ tầng của bạn. Hãy đưa bản mã ngoại tuyến và tập dữ liệu niêm phong chỉ đơn giản là ngừng hoạt động.
- **Các khóa.** Quyền truy cập sẽ mất hiệu lực khi những người giám hộ của bạn ngừng cấp quyền.
- **Tiền.** Nó chưa từng ở bất kỳ nơi nào khác.
- **Hồ sơ.** Mã băm đầu của nhật ký kiểm toán có thể được công bố, vì vậy lịch sử về việc ai đã chạy cái gì đối với tập dữ liệu của bạn không thể bị âm thầm ghi đè — bởi bất kỳ ai, kể cả chúng tôi.

Để biết ngôn ngữ điều khoản mà bạn có thể điều chỉnh — quyền sở hữu, cấp phép chỉ chứa điểm số, và một cái nhìn chi tiết về các cách một cuộc thi có thể bị tấn công —
xem [Các mẫu điều khoản](/docs/network/sovereignty/terms-templates).
