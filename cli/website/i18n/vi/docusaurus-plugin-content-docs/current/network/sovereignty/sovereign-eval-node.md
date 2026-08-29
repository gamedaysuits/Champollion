---
sidebar_position: 9
title: "Node đánh giá tự chủ — Phần cứng & Vận hành Air-Gap"
description: "Phần cứng tham chiếu, kỷ luật air-gap và các hoạt động quản lý khóa để chạy một node đánh giá do cộng đồng kiểm soát: tập dữ liệu kiểm thử bí mật không bao giờ rời khỏi máy của bạn; các phương thức được đưa đến dữ liệu."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Node Đánh giá Chủ quyền — Phần cứng & Vận hành Air-Gap

Một node đánh giá chủ quyền là một cỗ máy do **bạn** kiểm soát, chứa một tập dữ liệu kiểm thử bí mật và đánh giá các phương pháp dịch thuật dựa trên tập dữ liệu đó. Các phương pháp được đưa đến nơi chứa dữ liệu; dữ liệu không bao giờ bị di chuyển. Điểm số — và chỉ điểm số — là thứ duy nhất được xuất ra.

Trang này là đặc tả thực tế: nên mua (hoặc tái sử dụng) phần cứng nào, cách thiết lập ra sao, và kỷ luật vận hành để biến việc "tập dữ liệu kiểm thử không bao giờ rời khỏi máy" thành một sự thật mà bạn có thể chứng minh, thay vì một lời hứa mà bạn phải tin tưởng.

:::info[Những gì đã được phát hành hôm nay so với những gì đang được gắn nhãn đang phát triển]
Phần mềm node ban tổ chức (chuẩn bị cuộc thi, tiếp nhận giả thuyết, chấm điểm có kiểm soát ngưỡng, trình thực thi phương pháp cách ly mạng với import scan) **ships today** in `mt-eval` — see the của nó) đã được phát hành đầy đủ và được ghi chép trong    import-scan (`node import-bundle`); queue methods. [hướng dẫn cuộc thi chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest). **Nghi thức khóa ngưỡng và luồng công việc niêm phong dữ liệu tĩnh của §4 cũng đã được phát hành hôm nay**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node seal`, các phần chia sẻ theo túc số (quorum shares) được xuất trình tại thời điểm chạy (`node run-method --offline --share …`), một sổ cái ủy quyền cục bộ dạng chuỗi băm (`node ledger verify|head`), các tệp kê khai điểm số được ký (`node sign-manifest` / `node verify-manifest`), và các công cụ air-gap của §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Phương án thay thế bằng cặp khóa đơn (single-keypair stand-in) chỉ còn dành cho các cuộc thi mà ban tổ chức nắm giữ toàn quyền các tài liệu tham khảo — mọi bề mặt đều dán nhãn rõ luồng nào đang được sử dụng. Nói một cách đơn giản, những gì v1 **không** bao gồm: chứng thực từ xa bằng phần cứng (TEE) không được hỗ trợ (§5), và việc *ký* ngưỡng từ phía nền tảng (phê duyệt qua điện thoại của người giám quản đối với cơ sở hạ tầng được lưu trữ) là công việc trong tương lai — trên một node chủ quyền, quyền giám quản được thực thi bằng cách xuất trình vật lý M trên N phần chia sẻ tại máy (§4). Và để nói chính xác về mật mã học: đây là chia sẻ bí mật Shamir M-trên-N với khóa **được tái tạo trong bộ nhớ bị khóa của node trong một lần chạy được ủy quyền** (sau đó bị xóa sạch) — nó *không* phải là tính toán đa bên (multi-party computation), và khóa thực sự có tồn tại trong chốc lát dưới dạng hoàn chỉnh trên máy ngoại tuyến của bạn. Cuối cùng, cho đến khi cổng đồng thuận về chủ quyền dữ liệu của cộng đồng mở ra, luồng này chỉ chạy với **dữ liệu tổng hợp**; các kho ngữ liệu thực tế đang chờ sự đồng thuận đó.
:::

## 1. Phần cứng tham chiếu

Trình thực thi chạy các phương pháp độc lập: giải mã NMT cục bộ, xác thực FST/hình thái học, và tính toán số liệu. Không có lệnh gọi đám mây nào xảy ra bên trong môi trường air-gap (các phương pháp LLM-API chính xác là lớp mà một node air-gap sẽ từ chối — xem các lớp phương pháp của [đặc tả benchmark](/docs/network/specifications/benchmark)).

| Cấp độ | Cấu hình | Phù hợp cho | Chi phí ước tính (2026) |
|---|---|---|---|
| **Tối thiểu** (hoạt động được) | 4-core x86_64 hoặc Apple/ARM, 16 GB RAM, 500 GB SSD | Đánh giá Metric + FST, giải mã CPU cho các mô hình NMT nhỏ (chậm nhưng chính xác) | US$0 (một chiếc laptop cũ) – $400 (đã qua sử dụng) |
| **Khuyến nghị** | 8-core, 32 GB RAM, 1 TB NVMe, NVIDIA GPU ≥ 12 GB VRAM (ví dụ: dòng RTX 4070) | Giải mã NMT thoải mái cho toàn bộ các bộ kiểm thử; đánh giá phương pháp song song | ~US$900–1.600 (máy trạm cỡ nhỏ) |
| **Cấp tổ chức** | 16-core, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Các cuộc thi có nhiều phương pháp, bộ kiểm thử lớn, lưu trữ bản mã (ciphertext) đã lưu trữ | ~US$2.500–4.000 |

Các yêu cầu bắt buộc ở mọi cấp độ:

- **Không có thiết bị vô tuyến, hoặc thiết bị vô tuyến mà bạn có thể chứng minh là đã tắt.** Tốt nhất: một máy tính để bàn không có card Wi-Fi/Bluetooth. Chấp nhận được: một chiếc laptop có card không dây đã bị tháo bỏ vật lý hoặc vô hiệu hóa trong firmware. "Chế độ máy bay" (Airplane mode) không phải là air-gap.
- **Một card mạng có dây (NIC) mà bạn có thể rút cáp.** Việc không cắm cáp là biện pháp kiểm soát mạng dễ kiểm toán nhất.
- **Hai ổ USB chuyên dụng** (được dán nhãn IN và OUT — xem §3) và, lý tưởng nhất là một cỗ máy mà bạn đã vô hiệu hóa các cổng khác trong firmware.
- **Mã hóa toàn bộ ổ đĩa** (LUKS trên Linux) để một node bị đánh cắp sẽ trở thành cục gạch, và một bộ lưu điện (UPS) nếu nguồn điện của bạn không ổn định — một quá trình đánh giá bị gián đoạn giữa chừng có thể khôi phục được, nhưng tốt nhất là đừng để điều đó xảy ra.

## 2. Thiết lập phần mềm (một lần, ~một giờ)

1. Cài đặt một bản Linux LTS hiện hành (Ubuntu/Debian) từ bộ cài đặt USB **với cáp mạng đã được rút ra**; bật mã hóa toàn bộ ổ đĩa lúc cài đặt.
2. Trên một máy tính riêng biệt có kết nối mạng, xây dựng gói ngoại tuyến — `mt-eval node bundle --out <dir>` các tệp wheel `mt-eval[node]` và các phần phụ thuộc của nó, sao chép bất kỳ artifact `--include` nào, và ghi một tệp kê khai sha256 cho mọi tệp. Mọi thứ mà node cần sẽ được chuyển qua ổ IN một lần.
3. Chuyển gói dữ liệu bằng ổ IN; xác minh mã băm sha256 của mọi artifact so với tệp kê khai **trên node** trước khi cài đặt (`mt-eval node bundle --verify <dir>`).
4. Tạo cặp khóa ký của node (`mt-eval node keygen`) và lưu lại nửa khóa công khai — bạn sẽ công bố nó để bất kỳ ai cũng có thể xác minh các tệp kê khai điểm số của bạn (§5).
5. Từ đó trở đi, cỗ máy không bao giờ kết nối mạng — và một lần chạy niêm phong có thể được thực hiện để chứng minh điều đó trước tiên: `mt-eval node egress-check` (cũng được thực thi tự động với `assert_airgap` trong cấu hình node) sẽ từ chối khi một route, một probe, hoặc DNS cho thấy bất kỳ đường ra nào. Cập nhật hệ điều hành là một sự kiện có chủ đích, được đóng gói và xác minh bằng mã băm — không phải là một dịch vụ chạy ngầm.

## 3. Kỷ luật truyền tải (mỗi cuộc thi, cả hai chiều)

Air-gap là một *quy trình*, không phải là một sản phẩm. Quy trình đó là:

- **Ổ IN** mang theo: các gói phương pháp được gửi, các tệp giả thuyết, và tệp kê khai của chúng. Trước khi bất kỳ thứ gì chạy, node sẽ xác minh mã băm của từng gói so với tệp kê khai và quá trình quét import sẽ chạy (nó từ chối các phương pháp import các thư viện mạng — tính năng này đã được phát hành).
- **Ổ OUT** mang theo: tệp kê khai điểm số đã được ký — điểm số tổng hợp, mã băm của phương pháp/cấu hình thuộc về chúng, phần đầu (head) của nhật ký kiểm toán — và *không có gì khác*. Các đầu ra trên từng phân đoạn (per-segment outputs) được giữ lại trên node dưới sự kiểm soát của ban tổ chức; việc công bố chúng là một quyết định riêng biệt, có chủ đích của cộng đồng.
- Mỗi ổ đĩa chỉ dùng cho một chiều, mãi mãi. Một ổ đĩa đã chạm vào node không bao giờ được tự động mount trên một máy có kết nối mạng — hãy mount nó `noexec,nodev` và sao chép tệp kê khai ra bằng phương pháp thủ công.
- `mt-eval node manifest write <drive> --direction in|out` băm mọi tệp trên ổ đĩa trước khi chuyển đổi; `mt-eval node manifest verify` ở bên nhận sẽ từ chối bất kỳ thứ gì được thêm vào, thay đổi hoặc bị thiếu.
- Ghi nhật ký mọi lần chuyển đổi (ngày tháng, ổ đĩa, mã băm tệp kê khai) vào sổ giấy của node hoặc nhật ký trên node. Sự nhàm chán chính là mục đích: nhật ký là thứ cho phép bạn trả lời câu hỏi "có bất kỳ thứ gì khác từng lọt ra ngoài không?" bằng bằng chứng.

## 4. Quyền giám quản khóa (M-trên-N, do cộng đồng nắm giữ)

Tập dữ liệu kiểm thử được niêm phong sẽ được mã hóa ở trạng thái tĩnh; việc giải mã yêu cầu một túc số (quorum) các phần chia sẻ khóa do các người giám quản **được cộng đồng lựa chọn** nắm giữ — một hội đồng Trưởng lão, một cơ quan ngôn ngữ, một tổ chức giáo dục. Nền tảng không nắm giữ bất kỳ phần chia sẻ nào; Champollion không thể giải mã một tập dữ liệu đã niêm phong, và bất kỳ người giám quản đơn lẻ nào cũng không thể tự mình làm điều đó.

Nghi thức (một phiên ngồi lại ngoại tuyến; các công cụ đi kèm sẽ tự động hóa việc này): `mt-eval node ceremony init` tạo khóa của tập dữ liệu trên node, chia nó thành N phần chia sẻ (bất kỳ M phần nào cũng có thể tái tạo lại; ít hơn sẽ không tiết lộ gì cả — việc chia sẻ này mang tính lý thuyết thông tin), và xóa sạch khóa ngay trong cùng một nhịp; `ceremony share` xuất phần chia sẻ của mỗi người giám quản dưới dạng một tệp cho một token cộng với một bản sao lưu trên giấy có thể in được; `ceremony verify` chứng minh các bản sao được phân phối có thể tái tạo lại — mà không lưu trữ bất kỳ thứ gì; `ceremony share --wipe-originals` then destroys the node's own copies. `mt-eval node seal` mã hóa kho ngữ liệu bằng khóa công khai của nghi thức: node lưu trữ bản mã và một thẻ siêu dữ liệu không chứa nội dung, không có gì khác. Từ đó trở đi, việc chạy một đánh giá đồng nghĩa với việc các người giám quản phải xuất trình vật lý M trên N phần chia sẻ (`node run-method --offline --share …`): khóa được xây dựng lại **chỉ trong bộ nhớ bị khóa của trình thực thi**, được sử dụng cho một lần chạy gắn với quyền đó, và bị xóa sạch — nó không bao giờ chạm vào ổ đĩa nữa. Mọi yêu cầu, bỏ phiếu, cấp quyền và sử dụng đều được nối vào một sổ cái cục bộ dạng chuỗi băm (`node ledger verify`), và một nỗ lực chạy mà không có đủ túc số sẽ bị từ chối *và* được ghi lại.

Một câu nói trung thực về cơ chế này: đây là chia sẻ bí mật Shamir với việc tái tạo trong bộ nhớ của cỗ máy ngoại tuyến do cộng đồng nắm giữ — không phải là tính toán đa bên. Trong một lần chạy được ủy quyền, khóa tồn tại trong chốc lát, được lắp ráp hoàn chỉnh, trên phần cứng mà cộng đồng kiểm soát vật lý; các thuộc tính mà nó bảo vệ là *không có khóa thường trực trên ổ đĩa*, *không có lần chạy nào mà không có mặt đủ túc số*, và *mọi lần sử dụng đều được xâu chuỗi vào sổ cái có thể kiểm tra*. Việc ký ngưỡng từ phía nền tảng, nơi khóa không bao giờ được lắp ráp ở bất kỳ đâu, vẫn là công việc trong tương lai và được gắn nhãn như vậy ở bất cứ nơi nào nó được đề cập.

Việc luân chuyển và thay thế người giám quản sẽ chạy lại nghi thức; việc mất nhiều hơn N−M phần chia sẻ có nghĩa là tập dữ liệu sẽ được niêm phong lại từ bản sao nguồn của cộng đồng — cộng đồng luôn giữ lại bản gốc văn bản thuần túy (plaintext) của riêng mình, bởi vì [quyền sở hữu](/docs/network/sovereignty/data-sovereignty) chưa bao giờ thuộc về chúng tôi.

## 5. "Được chứng thực" ở đây có nghĩa là gì — và không có nghĩa là gì

Mỗi lần đánh giá tạo ra một **tệp kê khai điểm số được ký**: chữ ký của node trên các điểm số, mã băm của gói phương pháp, checksum của kho ngữ liệu, và phần đầu của nhật ký kiểm toán chỉ cho phép ghi thêm (append-only). Bất kỳ ai nắm giữ khóa công khai đã công bố của node đều có thể xác minh nó — `mt-eval node verify-manifest <manifest> --pubkey <published .pub.json>` — rằng *node này* đã tạo ra *những điểm số này* cho *chính xác những đầu vào này*, và nhật ký dạng chuỗi băm giúp phát hiện các chỉnh sửa lịch sử âm thầm.

Đó là **chứng thực phần mềm** — nó chứng minh tính toàn vẹn của bản ghi, và đó là những gì v1 cung cấp. Nó **không** chứng minh phần cứng silicon nào đã thực thi lần chạy: chứng thực từ xa bằng phần cứng (TEE) là công việc trong tương lai và cố tình không được tuyên bố hỗ trợ. Tuyên bố bảo mật trung thực cho v1: kỷ luật của ban tổ chức (§3) cộng với các tệp kê khai được ký cộng với quyền giám quản vật lý của cộng đồng đối với cỗ máy chính là mỏ neo niềm tin — đó cũng chính xác là nơi mà một thiết kế ưu tiên chủ quyền muốn đặt niềm tin vào.

## 6. Vòng lặp vận hành

1. Công bố cuộc thi; công bố khóa công khai của node + ngưỡng của tập dữ liệu phát triển (dev-set).
2. Nhận các bài nộp trực tuyến (máy tính thông thường), lắp ráp tệp kê khai IN (`mt-eval node manifest write <drive> --direction in`).
3. Mang ổ IN đến node; xác minh các mã băm (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Các người giám quản ủy quyền cho lần chạy bằng cách xuất trình đủ túc số các phần chia sẻ (§4 — `node run-method <id> --offline --share … --share …`); tập dữ liệu được niêm phong chỉ giải mã vào trong trình thực thi. Không đủ túc số, không chạy — và nỗ lực đó sẽ được ghi vào sổ cái.
5. Thực thi; điểm số được tính toán; các đầu ra trên từng phân đoạn được giữ lại ở phía node.
6. Dọn dẹp (Teardown): văn bản thuần túy đang làm việc bị xóa sạch; nhật ký kiểm toán được ghi thêm; tệp kê khai được ký.
7. Mang ổ OUT trở lại; công bố điểm số + tệp kê khai; bất kỳ ai cũng có thể xác minh (`node verify-manifest`).
8. Ghi nhật ký lần chuyển đổi; các ổ đĩa vẫn được dùng chuyên dụng; node vẫn ở trạng thái ngắt kết nối (dark).

