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

- ✅ **Đang hoạt động:** đăng ký ngữ liệu (thẻ siêu dữ liệu, ghim băm, các luồng
  tiếp xúc), sổ đăng ký tập dữ liệu được niêm phong (bản tóm tắt + nhóm người giám sát + bộ định chuẩn, không có
  nội dung), bộ máy cuộc thi với luồng được niêm phong, lớp dữ liệu yêu cầu/cấp phép/kiểm toán ủy quyền (đang chờ → quyết định M-trên-N → cấp phép giới hạn thời gian sử dụng một lần, nhật ký kiểm toán chuỗi băm chỉ nối thêm), và việc phát hành chỉ-điểm-số được thực thi ở lớp cơ sở dữ liệu.
- ✅ **Đang hoạt động: node chấm điểm của ban tổ chức + luồng giả thuyết.** Một
  lệnh chia ngữ liệu của bạn thành một tập dev công khai (bộ định chuẩn), một tập
  kiểm tra mù (nguồn được phát hành, các bản tham chiếu được niêm phong ở trạng thái nghỉ trên máy CỦA BẠN), và
  tùy chọn một tập hoàn toàn bí mật (`mt-eval contest prepare`). Việc đăng ký (các) tập
  được niêm phong, bộ định chuẩn, và cuộc thi là **tự phục vụ từ chính tài khoản đăng nhập
  của bạn** — `contest prepare --self-serve`, hoặc `mt-eval contest register
  --manifest` cho một cuộc thi bạn đã chuẩn bị trước đó — với mỗi hàng
  được liên kết danh tính ở lớp cơ sở dữ liệu; không có người quản lý nào can thiệp và không có
  khóa đặc quyền (xem Bước 4 để biết các giới hạn trung thực). Người tham gia
  gửi bản dịch của họ bằng `mt-eval contest submit-hypotheses` (CLI
  tự chấm điểm tập dev cục bộ và từ chối các bản tải lên dưới ngưỡng của bạn);
  node tự lưu trữ CỦA BẠN (`mt-eval node serve`) tự chấm điểm lại bằng chứng dev,
  kiểm soát trên bộ định chuẩn, ủy quyền theo mô hình cuộc thi của bạn
  (`per-submission` — một người giám sát phê duyệt mỗi lần chấm điểm — hoặc `blanket` /
  `open`), chấm điểm tập mù so với các bản tham chiếu không bao giờ rời khỏi máy
  của bạn, và xuất bản các thẻ chạy **chỉ-tổng-hợp**. Những gì luồng này
  KHÔNG chứng minh: rằng phương pháp được nêu tên đã tạo ra các giả thuyết (danh tính phương pháp do
  người tham gia tự nhận và được dán nhãn như vậy trên mỗi thẻ chạy), và nó không thể
  ngăn chặn một kẻ tấn công quyết tâm trích xuất tín hiệu tham chiếu qua nhiều lần gửi
  khác nhau — giới hạn tốc độ, loại bỏ trùng lặp giống hệt nhau từng byte, và chuỗi kiểm toán làm chậm
  điều đó; luồng thực thi phương pháp bên dưới mới là câu trả lời thực sự.
- ✅ **Đang hoạt động: hai luồng phương pháp tập bí mật.** Những người tham gia có hồ sơ
  luồng giả thuyết đã xuất bản có thể đề xuất phương pháp của họ đối với tập bí mật của bạn.
  Node chọn luồng từ bản đệ trình:
  - **Luồng A — mô hình khai báo (được ưu tiên).** Một mô hình nơ-ron tiêu chuẩn là
    DỮ LIỆU: `mt-eval contest submit-model` gửi trọng số safetensors + một
    bộ mã hóa từ (tokenizer) khai báo + một cấu hình — **không có mã, không có Dockerfile.** Node của bạn
    xác thực rằng nó không có mã (safetensors không phải pickle; không có
    `trust_remote_code`/`auto_map`; chỉ các tệp dữ liệu) và chạy các trọng số trong
    công cụ tin cậy CỦA RIÊNG nó (`transformers`, `trust_remote_code=False`, ngoại tuyến).
    Kiến trúc được cho phép theo mặc định (bất kỳ kiến trúc nào công cụ của bạn tải nguyên bản); một
    máy chủ cẩn thận có thể ghim một danh sách cho phép. Không có gì không đáng tin cậy được thực thi, vì vậy
    không có gì để đưa vào hộp cát. Đã xuất bản `declarative-model`, danh tính phương pháp
    **không có mã theo cấu trúc**.
  - **Luồng B — gói có thể chạy (dự phòng hộp cát).** Đối với các phương pháp LÀ mã:
    `mt-eval contest submit-method` gửi một Dockerfile + điểm vào (entrypoint). Sau khi
    người giám sát của bạn phê duyệt, node CỦA BẠN thực thi nó bên trong một vùng chứa
    cách ly mạng (`--network=none` — ngăn xếp mạng không tồn tại bên trong;
    root chỉ đọc, các khả năng bị loại bỏ, môi trường được làm sạch), với
    các kiểm tra tĩnh tự động trước tiên và các bản tham chiếu không bao giờ đi vào vùng chứa.
    Đã xuất bản `method-execution` với danh tính **đã xác minh thực thi**.
  Dù là luồng nào: hàm băm của gói được đóng băng vào yêu cầu ủy quyền (những gì
  chạy có thể chứng minh được là những gì đã được đề xuất), và điểm số được xuất bản thông qua cùng một
  đường dẫn chỉ-tổng-hợp. Để cách ly tối đa, máy chấm điểm có thể là một
  airgap thực sự: các yêu cầu được ủy quyền và các gói chỉ-điểm-số được ký bằng Ed25519 đi qua bằng
  phương tiện có thể tháo rời (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  văn bản bí mật thậm chí không bao giờ đến được máy được kết nối. Những gì các luồng này
  CHƯA bao gồm: chứng thực phần cứng của node (danh tính do tự báo cáo),
  bộ máy giải quyết tranh chấp chính thức, và — đặc biệt đối với Luồng B — việc củng cố vùng chứa
  sâu hơn ngoài ngăn xếp mạng đã bị loại bỏ (hồ sơ seccomp, microVM; đây
  là một lý do để ưu tiên Luồng A). Xem
  [Các giới hạn trung thực](/docs/network/honest-limitations).
- 🔲 **Đang phát triển: ký ngưỡng.** Sự phê duyệt của người giám sát M-trên-N
  được *ghi lại* trong các bảng ủy quyền và kiểm toán hiện nay; công cụ
  khóa ngưỡng mật mã làm cho việc cấp phép không thể đúc được nếu không có M phần chia sẻ
  vẫn chưa được xây dựng — khóa niêm phong hiện tại là một khóa thay thế cặp khóa đơn có nhãn
  (`champollion seal-corpus keygen`), và chữ ký gói điểm airgap
  là một khóa node đơn (`seal-corpus sign-keygen`), không phải là một nghi lễ của người quản lý.
- ❌ **Không phải là một tính năng, theo thiết kế:** Champollion lưu trữ ngữ liệu của bạn, giữ
  khóa của bạn, hoặc giữ quỹ giải thưởng. Các giả thuyết của người tham gia (bản dịch của chính họ)
  đi qua bộ lưu trữ của chúng tôi; nội dung ngữ liệu của bạn thì không bao giờ.

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

- **docker hoặc podman** — bắt buộc đối với luồng thực thi phương thức. Node sẽ tự động phát hiện docker, sau đó là podman; nếu không có cả hai, nó sẽ từ chối hoạt động một cách rõ ràng. **Không có phương án dự phòng** — việc cô lập container với `--network=none` là đảm bảo cốt lõi chịu tải, vì vậy không có gì chạy được nếu thiếu môi trường runtime cho container.
- **Node.js 20.11+ và `champollion` npm CLI** — bộ khung (harness) không triển khai lại mật mã niêm phong. `champollion seal-corpus` (các động từ: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) là triển khai mật mã duy nhất (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), và node của ban tổ chức sẽ gọi lệnh hệ thống đến nó.
- **Một cấu hình node tại `~/.mt-eval/node.json`.** Mọi lệnh `mt-eval node` đều từ chối khởi động nếu thiếu cấu hình này — hãy chạy thử bất kỳ lệnh nào một lần và thông báo lỗi sẽ chỉ ra đường dẫn cấu hình cũng như nơi chứa tệp mẫu (nó đi kèm trong mã nguồn của bộ khung, tại `mt_eval_harness/contest_node.py`). Cấu hình này mang theo `node_id` tự khai báo của bạn (được liên kết vào mọi dấu vân tay yêu cầu) và một bản đồ `contests` trỏ đến các tham chiếu phát triển và các thành phần đã niêm phong của bạn.
- **Đăng nhập.** Không có bước tạo tài khoản riêng biệt: lệnh đầu tiên cần danh tính (ví dụ: `mt-eval contest prepare --self-serve` hoặc `mt-eval publish`) sẽ mở trình duyệt để đăng nhập OAuth qua **GitHub hoặc Google** (Supabase Auth). Email của tài khoản đó là danh tính mà mọi hàng trong registry được liên kết vào — hãy sử dụng tài khoản mà tổ chức của bạn kiểm soát.
- **Giới hạn tiếp nhận.** Các bài nộp của người tham gia bị giới hạn tần suất cho mỗi người nộp là **mặc định 5 bài mỗi 24 giờ** (để chống dò tìm; được thiết lập cho mỗi cuộc thi bằng `--intake-daily-limit` tại thời điểm chuẩn bị, hoặc dưới dạng mặc định của phiên bản tác vụ chung). Hãy lập kế hoạch thời gian cho cuộc thi của bạn xoay quanh giới hạn này.

**Một lưu ý trung thực về việc tự đăng ký.** Trên **endpoint mặc định được lưu trữ trên mạng**, việc tự đăng ký (`contest prepare --self-serve` / `contest register`) hiện tại sẽ dừng lại ở một chốt chặn endpoint production: CLI sẽ từ chối với một thông báo rõ ràng thay vì ghi vào dự án production, trong khi chờ quyết định chính sách về việc mở cánh cửa đó. Các host liên kết (dự án Supabase của riêng bạn) không bị ảnh hưởng. Nếu bạn gặp phải chốt chặn này trên host mặc định, đó là trạng thái hiện tại của hệ thống chứ không phải do bạn cấu hình sai — hãy [mở một issue](https://github.com/gamedaysuits) và chúng tôi sẽ hướng dẫn bạn hoàn tất việc đăng ký.

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

Bản khai thông tin (manifest) vẫn nằm trên máy của bạn — việc đăng ký chỉ gửi các ID không chứa nội dung, các bản tóm tắt và các ngưỡng.
Mỗi hàng trong sổ đăng ký đều **được liên kết danh tính**: cơ sở dữ liệu ghi lại tài khoản đã đăng nhập để đăng ký nó và đóng băng liên kết đó
để tránh các chỉnh sửa sau này, và một vòng loại chỉ có thể kiểm soát một tập dữ liệu niêm phong mà **cùng một** danh tính đó đã đăng ký.
Các tập dữ liệu niêm phong khi tạo ra sẽ bị cách ly (chúng không bao giờ có thể hỗ trợ một cuộc thi thông thường hoặc xếp hạng trên bảng xếp hạng công khai),
các vòng loại khi tạo ra sẽ ở trạng thái an toàn, và việc đăng ký bị giới hạn tần suất — tất cả đều được thực thi bởi các trigger cơ sở dữ liệu
bên dưới mọi máy khách, bao gồm cả máy khách của chúng tôi. Bản thân sổ đăng ký có thể đọc công khai, vì vậy bạn có thể xác minh mục nhập của mình
nói chính xác những gì bạn đã niêm phong — và không có gì hơn.

**Các giới hạn trung thực.** Cửa tự phục vụ chỉ dành cho việc đăng ký (chỉ chèn dữ liệu ở lớp cơ sở dữ liệu). **Việc xoay vòng vòng loại
và thu hồi tập dữ liệu niêm phong vẫn do người quản lý trung gian thực hiện** — hãy mở một issue hoặc liên hệ với dự án qua
[GitHub](https://github.com/gamedaysuits). Và việc chạy nút chấm điểm của ban tổ chức ở các bước sau (tiến trình vòng đời, cấp quyền ủy quyền,
các hoạt động kiểm toán) là một luồng riêng biệt, được xác thực bằng thông tin dịch vụ trên nút của chính bạn — tự phục vụ dừng lại ở hồ sơ công khai.

## Bước 5 — Chọn những người giám hộ và quy tắc M-trên-N

Chọn những người hoặc tổ chức phải cùng nhau phê duyệt mọi đánh giá đối với tập dữ liệu của bạn, và ngưỡng phê duyệt (ví dụ: **3 trên 5**).
Những người giám hộ phải chịu trách nhiệm trước cộng đồng của bạn, chứ không phải trước Champollion — xem [Quản trị dữ liệu](/docs/network/sovereignty/data-sovereignty)
và [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) để biết cách thiết lập các điều khoản cho từng cộng đồng.

**Hộp thư trung thực:** công cụ *mã hóa* ngưỡng (các phần chia sẻ khóa sao cho một quyền cấp thực sự không thể được tạo ra nếu không có M chữ ký)
hiện **đang được phát triển**. Ngày nay, quy tắc M-trên-N được thực thi như một quy trình được ghi lại: mọi yêu cầu truy cập đều đi vào một hàng đợi
**đang chờ xử lý**, các quyết định của người giám hộ được ghi lại, một quyền cấp chỉ được tạo ra cho một yêu cầu được ủy quyền, mỗi quyền cấp là
**sử dụng một lần, có thời hạn và được liên kết với một dấu vân tay cụ thể (phương pháp, phiên bản tập dữ liệu, nút đánh giá)**, và mọi sự kiện
— bao gồm cả các nỗ lực bị chặn — đều nằm trong một **nhật ký kiểm toán chỉ cho phép thêm mới, được liên kết chuỗi băm và có thể đọc công khai**.
Cơ sở dữ liệu từ chối các chuyển đổi trạng thái bất hợp pháp bên dưới mọi máy khách và khóa. Những gì nó chưa thể từ chối là sự thỏa hiệp của chính
nhà vận hành nền tảng — đó là điều mà việc ký ngưỡng sẽ giải quyết, và cho đến khi nó được phát hành, bạn nên coi "Champollion nắm giữ không phần chia sẻ khóa"
là mục tiêu thiết kế đang được xây dựng, chứ không phải là một đặc tính bạn có thể xác minh hôm nay.

## Bước 6 — Thiết lập giải thưởng

Quyết định và công bố cùng với cuộc thi:

- **Số tiền và tiền tệ.**
- **Nhà tài trợ** — ai là người bỏ tiền ra.
- **Nơi giữ tiền** — tài khoản của tổ chức bạn, hoặc một quỹ tín thác cộng đồng mà bạn chỉ định. **Champollion không bao giờ nắm giữ, ký quỹ hoặc chuyển tiền giải thưởng.**
  Việc công bố danh tính của người nắm giữ ngay từ đầu là điều làm cho giải thưởng trở nên đáng tin cậy; xem [lưu ý về rủi ro nhà tài trợ mặc định](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  trong các mẫu điều khoản.
- **Các điều kiện ngưỡng** — mức điểm số mà một phương pháp phải vượt qua, được viết theo [Đặc tả giải thưởng](/docs/network/specifications/prizes):
  các ngưỡng chỉ số, yêu cầu xác thực người nói, tính tái lặp. Hãy làm cho các điều kiện trao giải có thể xác minh được từ các điểm số được công bố,
  để không ai phải tin vào lời nói của bạn (hoặc của chúng tôi) về việc liệu ngưỡng đó đã được vượt qua hay chưa.

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
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(Giá trị `--corpus` là `sealed_set_id` đã đăng ký của bạn. Luồng niêm phong được chọn **tự động** từ đăng ký tập dữ liệu niêm phong — không cần thêm cờ;
một tập dữ liệu niêm phong không bao giờ có thể hỗ trợ một cuộc thi thông thường, và một tập dữ liệu bị cách ly thông thường không bao giờ có thể hỗ trợ bất kỳ cuộc thi nào.
Cả hai quy tắc đều được thực thi trong cơ sở dữ liệu, bên dưới mọi máy khách. Nếu bạn đã đăng ký ở Bước 4 với `contest register` hoặc `prepare --self-serve`,
hàng cuộc thi **đã tồn tại** — hãy bỏ qua bước này; việc thực hiện `contest create` thủ công chỉ dành cho việc lắp ráp một cuộc thi từ một tập dữ liệu niêm phong đã được đăng ký trước đó.)*

## Bước 8 — Các phương pháp phải vượt qua vòng loại công khai trước

Các nhà phát triển xây dựng và chấm điểm các phương pháp của họ trên các tập dữ liệu **công khai** cho cặp ngôn ngữ của bạn — lộ trình [gửi một phương pháp](/docs/network/getting-started/submit-a-method) thông thường.
Trường `current_qualifier_id` của tập dữ liệu niêm phong của bạn chỉ định vòng thi công khai mà một phương pháp phải vượt qua trước khi một lượt chạy niêm phong có thể được yêu cầu.
Điều này giúp giảm áp lực thăm dò lên tập dữ liệu của bạn: không ai được phép nhắm vào tập dữ liệu niêm phong cho đến khi họ chứng minh được hiệu suất thực sự trong môi trường mở.

:::note[Người tham gia: cuộc thi của bạn nằm trên endpoint nào?]
Một cuộc thi **được lưu trữ trên mạng** không cần thiết lập gì cả — endpoint mặc định đi kèm với bộ khung đã mang sẵn cơ chế cuộc thi (tiếp nhận giả thuyết, cổng vòng loại, đề xuất phương thức), và `mt-eval contest submit-hypotheses` / `submit-method` hoạt động ngay lập tức.

Một cuộc thi **liên hợp (federated)** — ban tổ chức chạy cơ chế trên dự án Supabase của riêng họ, vì vậy các bài nộp không bao giờ đi qua hệ thống của chúng tôi — sẽ công bố endpoint của nó cùng với tài liệu cuộc thi. Hãy xuất nó trước khi nộp:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Nếu bộ công cụ được trỏ đến một endpoint không có cơ chế cuộc thi (ví dụ: một máy chủ liên hợp thiếu một migration), lệnh sẽ dừng lại với thông báo *"the contest lane isn't available on this Supabase endpoint yet"* (luồng cuộc thi chưa có sẵn trên endpoint Supabase này) và cho bạn biết nó đang giao tiếp với endpoint nào. (Ban tổ chức liên hợp: hãy công bố hai giá trị này bên cạnh bản phát hành ngữ liệu của bạn, `--node-id`, và `--corpus-version`.)
:::

## Bước 9 — Các lượt chạy niêm phong: yêu cầu, ủy quyền, thực thi, xuất điểm số

Đối với mỗi phương pháp đủ điều kiện:

1. Một **yêu cầu** được gửi đối với tập dữ liệu niêm phong của bạn — nó đi vào trạng thái `pending` và mang theo một dấu vân tay bất biến của (mã băm tarball phương pháp, id tập dữ liệu, phiên bản tập dữ liệu, `scores-only`, phép đo nút đánh giá).
2. Những **người giám hộ của bạn quyết định** (M-trên-N). Sự phê duyệt sẽ tạo ra một **quyền cấp (grant)**: sử dụng một lần, có thời hạn, chỉ có hiệu lực cho chính xác dấu vân tay đó.
3. Việc đánh giá chạy trong hộp cát cô lập mạng trên nút của **bạn** (`mt-eval node run-method`): các kiểm tra tĩnh tự động, một container không có ngăn xếp mạng, các bản dịch tham chiếu được giữ bên ngoài nó — hoặc, để cô lập tối đa, trên một máy cô lập mạng thực sự với các gói chỉ chứa điểm số được ký được chuyển qua phương tiện lưu trữ di động (xem hộp trạng thái ở trên để biết những gì được và không được hỗ trợ).
4. **Chỉ có điểm số được xuất ra.** Quy tắc xuất `scores-only` được ghim chặt ở lớp cơ sở dữ liệu; văn bản theo từng mục nhập từ tập dữ liệu của bạn không bao giờ được công bố.
5. Mọi bước — yêu cầu, bỏ phiếu, cấp quyền, sử dụng và bất kỳ nỗ lực bị chặn nào — đều được thêm vào nhật ký kiểm toán công khai, liên kết chuỗi băm mà bạn (và bất kỳ ai) có thể phát lại.

## Gửi một phương pháp (dành cho người tham gia) — hai luồng

Hầu hết các mục NMT không có gì kỳ lạ: một transformer tinh chỉnh tiêu chuẩn và
các trọng số của nó. Đối với những mục đó, có một **luồng không có mã, được ưu tiên** — và một dự phòng
hộp cát cho các phương pháp thực sự là mã.

### Luồng A — mô hình khai báo (được ưu tiên cho NMT tiêu chuẩn)

Nếu phương pháp của bạn là một mô hình nơ-ron tiêu chuẩn, bạn gửi nó dưới dạng **dữ liệu** — các
trọng số, bộ mã hóa từ (tokenizer), và cấu hình — và ban tổ chức chạy nó trong công cụ
suy luận tin cậy của riêng họ. **Không có Dockerfile, không có mã, không có hộp cát.** Bởi vì không có gì bạn
gửi được thực thi, kiểm tra an toàn của ban tổ chức là một xác thực định dạng có thể quyết định
thay vì cố gắng chứng minh mã tùy ý là an toàn — một sự đảm bảo mạnh mẽ hơn
nghiêm ngặt cho bạn và cho ngữ liệu.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

Các quy tắc mà gói của bạn phải thỏa mãn (được xác thực cục bộ trước khi tải lên, và một lần nữa
bởi node của ban tổ chức):

- **Các trọng số là `safetensors`, không bao giờ là pickle.** Một `.bin`/`.pt`/`.ckpt` của PyTorch
  là một pickle — mã tùy ý khi tải — và bị từ chối. Xuất sang
  `model.safetensors` (`safetensors` / `transformers` thực hiện điều này một cách nguyên bản).
- **Một kiến trúc mà công cụ của ban tổ chức tải nguyên bản.** `architectures` của `config.json`
  có thể là bất kỳ kiến trúc nào mà `transformers` của máy chủ triển khai
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, và nhiều kiến trúc khác) — các máy chủ
  **cho phép theo mặc định**, bởi vì với `trust_remote_code=False` sự an toàn
  đến từ định dạng không có mã, không phải tên kiến trúc (một kiến trúc không được hỗ trợ
  đơn giản là không tải được, không chạy gì cả). Một máy chủ cẩn thận có thể
  xuất bản một danh sách cho phép. Không có `auto_map`, không có `trust_remote_code` — những thứ đó lén lút đưa
  mã tùy chỉnh trở lại và luôn bị từ chối.
- **Một bộ mã hóa từ khai báo** (`tokenizer.json` hoặc một `.model` của `sentencepiece` +
  từ vựng), và **chỉ các tệp dữ liệu** — không có `.py`/tập lệnh/tệp nhị phân trong gói.

Ban tổ chức chạy nó với `trust_remote_code=False`, ngoại tuyến, và chỉ có điểm số
rời đi — được xuất bản dưới dạng `declarative-model`, danh tính phương pháp **không có mã theo
cấu trúc**. (Trọng số nhiều GB: sử dụng `--bundle-out` cho luồng sneakernet,
giống như bên dưới.)

### Luồng B — gói có thể chạy (hộp cát, cho các phương pháp mã)

Nếu phương pháp của bạn thực sự là mã — một đường ống, một mô hình lai được huấn luyện bởi LLM, một bộ giải mã
tùy chỉnh — nó không thể được chạy theo cách khai báo, vì vậy thay vào đó nó đi qua hộp cát
cách ly mạng. Đây là luồng yếu hơn một cách trung thực (nó chứa mã không đáng tin cậy
thay vì từ chối chạy nó), vì vậy hãy sử dụng Luồng A bất cứ khi nào phương pháp của bạn là một
mô hình tiêu chuẩn.

**Giao ước của gói có thể chạy là stdin/stdout.** Gói của bạn khai báo một điểm khởi chạy (ví dụ: `method/translate.py`). Bên trong container, node của ban tổ chức sẽ chạy chính xác:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Các câu nguồn được đưa vào theo từng dòng trên stdin; bạn ghi một bản dịch tương ứng trên mỗi dòng ra stdout. Mọi thứ bạn đã truyền dưới dạng `--method-dir` được đóng gói dưới thư mục `method/` trong gói và được mount **chỉ đọc tại `/method`** vào lúc chạy — bao gồm cả các trọng số, không cần sao chép vào image. Container không có ngăn xếp mạng (`--network=none`), root chỉ đọc, và một thư mục `/tmp` có thể ghi.

**Một wrapper tối giản cho Hugging Face transformers:**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Nộp nó bằng lệnh:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Trước tiên, bạn cần có một bản ghi luồng giả thuyết đã được công bố cho cuộc thi — cổng T1 của Bước 9 — và `--agree` xác nhận các điều khoản nộp phương thức.)

**Trọng số nhiều GB: sử dụng luồng sneakernet.** Đường dẫn tiếp nhận trực tuyến sẽ tải lên file tarball của bạn dưới dạng một **yêu cầu POST duy nhất** lên bộ lưu trữ của host cuộc thi, do đó nó bị giới hạn bởi giới hạn tải lên bộ lưu trữ của host đó — điều này phù hợp với mã nguồn và các mô hình nhỏ, nhưng không phù hợp với các checkpoint nặng nhiều GB. Bản thân giao ước gói cho phép các artifact lớn hơn nhiều (tarball lên đến 100 GB, image đã build lên đến 150 GB). Đối với các trọng số lớn, hãy bỏ qua việc tải lên trực tuyến:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

Thư mục trao đổi được chuyển đến ban tổ chức bằng phương tiện lưu trữ di động (hoặc bất kỳ kênh nào mà cả hai bên tin tưởng); họ sẽ nạp nó bằng lệnh `mt-eval node import-bundle`. Dù bằng cách nào, mã SHA-256 của gói cũng được đóng băng vào yêu cầu ủy quyền, vì vậy những gì được chạy chắc chắn là những gì bạn đã đề xuất.

**Ban tổ chức: tải trước các image cơ sở trên các máy không có mạng.** Bởi vì quá trình build image chạy với `--network=none`, image cơ sở `FROM` của Dockerfile phải có sẵn trong kho lưu trữ image cục bộ của máy. Trên một máy có kết nối mạng, hãy chạy `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; mang theo `base.tar` cùng với gói; trên máy không có mạng, hãy chạy `docker load -i base.tar` trước khi chạy `mt-eval node run-method`. Hãy thống nhất về (các) image cơ sở với những người tham gia trong tài liệu cuộc thi được công bố của bạn.

## Bước 10 — Công bố điểm số, trao giải theo ngưỡng đã công bố của bạn

Kết quả chỉ chứa điểm số được công bố lên [bảng xếp hạng](/docs/network/leaderboard/rules) giống như bất kỳ lượt chạy nào khác, được đánh dấu là các đánh giá trên tập dữ liệu niêm phong.
Nếu một phương pháp vượt qua các điều kiện ngưỡng bạn đã công bố ở Bước 6 — bao gồm cả [xác thực người nói](/docs/network/specifications/speaker-validation), vốn là cổng kiểm soát của cộng đồng bạn, không phải là cổng tự động — **bạn** (hoặc quỹ tín thác của bạn) sẽ trao giải thưởng, theo các điều khoản đã công bố của chính bạn. Vai trò của Champollion kết thúc ở việc đo lường.

---

## Những gì bạn giữ lại, mãi mãi

- **Tập dữ liệu.** Nó không bao giờ rời khỏi cơ sở hạ tầng của bạn. Hãy đưa bản mã ngoại tuyến và tập dữ liệu niêm phong chỉ đơn giản là ngừng hoạt động.
- **Các khóa.** Quyền truy cập sẽ mất hiệu lực khi những người giám hộ của bạn ngừng cấp quyền.
- **Tiền.** Nó chưa từng ở bất kỳ nơi nào khác.
- **Hồ sơ.** Mã băm đầu của nhật ký kiểm toán có thể được công bố, vì vậy lịch sử về việc ai đã chạy cái gì đối với tập dữ liệu của bạn không thể bị âm thầm ghi đè — bởi bất kỳ ai, kể cả chúng tôi.

Để biết ngôn ngữ điều khoản mà bạn có thể điều chỉnh — quyền sở hữu, cấp phép chỉ chứa điểm số, và một cái nhìn chi tiết về các cách một cuộc thi có thể bị tấn công —
xem [Các mẫu điều khoản](/docs/network/sovereignty/terms-templates).
