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

:::info[Nội dung đã phát hành hôm nay so với nội dung đang hoàn thiện]
Phần mềm node ban tổ chức **đã được phát hành hôm nay** trong `mt-eval` — xem
[hướng dẫn cuộc thi độc lập](/docs/network/sovereignty/run-a-sovereign-contest):
chuẩn bị và niêm phong cuộc thi, cổng vòng loại công khai **được thực thi lại bởi
chính node đối với mỗi bài dự thi trước khi bất kỳ người giám hộ nào được yêu cầu phê duyệt
bất cứ điều gì**, chấm điểm dựa trên ngưỡng, và trình thực thi phương thức được cô lập mạng
với tính năng quét gói import. Thứ mà một node chấp nhận là một **mô hình hoặc một phương thức** — một
cấu phần (artifact) mà nó có thể chạy. Việc tải lên các bản dịch của một tập kiểm thử ẩn công khai nguồn
đã bị loại bỏ như một hình thức nộp bài thi vào ngày 2026-09-06 và lệnh tương ứng đã bị xóa;
một vòng thi công khai nguồn chỉ còn tồn tại như một công cụ chẩn đoán tùy chọn của ban tổ chức, và
điểm số tự báo cáo thuộc về bảng xếp hạng mở, vốn là một bảng công khai
được lập chỉ mục theo ngữ liệu và hướng cặp ngôn ngữ thay vì là một cuộc thi.
**Nghi thức khóa ngưỡng và quy trình niêm phong khi lưu trữ của §4 cũng đã được phát hành
hôm nay**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, các phần chia khóa đạt túc số được cung cấp vào thời điểm chạy
(`node run-method --offline --share …`), sổ cái ủy quyền cục bộ liên kết chuỗi băm (`node ledger verify|head`), các bản kê điểm số đã ký
(`node sign-manifest` / `node verify-manifest`), và bộ công cụ air-gap ở §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Các gói
điểm số được ký **trên node, bằng Python** — gói ngoại tuyến không cần runtime
Node.js — và cùng một định dạng chữ ký tách rời có thể được xác thực bằng
cả hai bản triển khai. **Tính năng staging yêu cầu** phía ban tổ chức **cũng đã phát hành**:
`mt-eval node stage-request` ghi lại chính xác yêu cầu trao đổi mà một relay trực tuyến sẽ tạo,
từ một tệp gói mà hoàn toàn không cần cơ sở dữ liệu (phục vụ cho việc diễn tập, hoặc triển khai không bao giờ kết nối mạng),
được xác thực trước giống như cách lệnh import sẽ xác thực và được liên kết với ID của node; điểm số
nhận lại có thể xác thực được qua bản kê nhưng không được công bố qua relay, vì không tồn tại bản ghi ủy quyền
nào để đối chiếu công bố. Phương án
thay thế bằng cặp khóa đơn chỉ còn tồn tại cho các cuộc thi mà ban tổ chức
nắm giữ hoàn toàn dữ liệu tham chiếu — mọi giao diện đều dán nhãn rõ làn nào đang
được sử dụng. Nói một cách rõ ràng, những gì phiên bản v1 **không** bao gồm: chứng thực phần cứng
từ xa (TEE) không được hỗ trợ (§5), và việc *ký* theo ngưỡng ở phía
nền tảng (người giám hộ phê duyệt qua điện thoại đối với hạ tầng máy chủ) là
kế hoạch tương lai — trên một node độc lập, quyền giám hộ được thực thi bằng cách
xuất trình trực tiếp M trên N phần chia khóa tại máy (§4). Và để chính xác về mặt
mật mã học: đây là cơ chế chia sẻ bí mật Shamir M-trên-N với khóa
**được tái tạo trong vùng nhớ bị khóa của node trong suốt lượt chạy được ủy quyền**
(sau đó được xóa về 0) — đây *không phải* là tính toán đa bên, và khóa thực sự có
tồn tại ráp hoàn chỉnh trong thời gian ngắn trên máy ngoại tuyến của bạn. Cuối cùng, cho đến khi
cổng chấp thuận của cộng đồng được mở, làn này **chỉ chạy trên
dữ liệu tổng hợp**; các ngữ liệu thực tế phải chờ sự chấp thuận đó.
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

1. Cài đặt bản Linux LTS hiện tại (Ubuntu/Debian) từ bộ cài USB **khi đã
   rút cáp mạng**; bật mã hóa toàn bộ ổ đĩa khi cài đặt.
2. Trên một máy riêng biệt, có mạng và đã cài đặt harness
   (`python3 -m pip install mt-eval-harness`, 0.2.0 trở lên), hãy build gói ngoại tuyến.
   `mt-eval node bundle --out <dir>` thực hiện bốn việc:
   - đóng gói wheel cho harness đã cài đặt và các dependency của nó (hoặc một wheel cụ thể,
     với `--wheel <file>`);
   - tải các thư viện mật mã học theo danh sách đã ghim mã băm đi kèm
     bên trong harness;
   - sao chép bất kỳ cấu phần `--include` nào;
   - tạo bản kê sha256 cho mọi tệp.

   Bao gồm **thẻ ngôn ngữ** cho mọi ngôn ngữ mà node sẽ chấm điểm
   (`--include <cards-dir>`): node xác định cặp ngôn ngữ của lượt chạy từ một
   chỉ mục thẻ cục bộ và không bao giờ tải từ mạng về. Cả hai gói cài đặt đều không đi kèm
   thư mục thẻ cho từng ngôn ngữ, vì vậy hãy tạo thư mục này ở đây bằng CLI `champollion`,
   mỗi ngôn ngữ một `<code>.json` (`champollion network card eng --json >
   node-cards/eng.json`, sau đó làm tương tự cho ngôn ngữ còn lại của bạn), và truyền
   `--include node-cards`. Trên node, nó nằm tại
   `<dir>/artifacts/node-cards`; hãy trỏ `cards_dir` tới đó. Mọi thứ node cần sẽ được chuyển qua
   trên ổ đĩa IN một lần duy nhất. Hãy build trên cùng phiên bản Python mà node chạy
   (3.11 hoặc 3.12); danh sách đã ghim mã băm sẽ từ chối bất kỳ phiên bản nào khác.
3. Chuyển gói ngoại tuyến qua ổ đĩa IN; xác thực sha256 của mọi cấu phần
   đối chiếu với bản kê **trên node** trước khi cài đặt
   (`mt-eval node bundle --verify <dir>`). Sau đó chỉ cài đặt từ các wheel
   được đóng gói đi kèm:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   Thành phần bổ sung `[node]` là thư viện `cryptography` mà `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` cài đặt
   thiếu nó.
4. Tạo cặp khóa ký của node (`mt-eval node keygen`) và lưu lại
   khóa công khai của nó — bạn sẽ công bố khóa này để bất kỳ ai cũng có thể xác thực
   các bản kê điểm số của bạn (§5).
   Node cũng cần **Docker** (hoặc Podman) để chạy từng phương thức được nộp
   trong một container không có mạng; nếu cả hai đều không có trên `PATH`,
   `mt-eval node run-method` sẽ từ chối bằng một dòng thông báo nêu tên cả hai, và
   yêu cầu vẫn có thể chạy lại được. Node cũng cần tệp cấu hình node tại
   `~/.mt-eval/node.json`. Tệp đó chỉ định tên node, thư mục thẻ của nó
   (`cards_dir`, hoặc `MT_EVAL_CARDS_DIR`), và các cuộc thi mà nó phục vụ.
   `mt-eval node init` sẽ tạo một cấu hình khởi đầu chứa mọi khóa mà một node chấm điểm
   đọc, bao gồm cổng vòng loại công khai (`qualifier` + `dev_corpus`,
   nơi node sẽ chạy lại từng phương thức trước khi mở tập dữ liệu niêm phong)
   và các vị trí dữ liệu ẩn được niêm phong (`holdout_set_id` + `holdout_corpus`;
   hãy xóa chúng đối với cuộc thi không có tập holdout).
   `mt-eval node init --from-contest <out>` điền các giá trị của cuộc thi từ
   bản kê mà `contest prepare` đã ghi (bảng ánh xạ nằm trong
   [hướng dẫn cuộc thi độc lập](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Khối `sandbox` là chính sách tài nguyên của node (4 GB RAM, 4 GB bộ nhớ tạm scratch,
   30 phút mỗi lượt chạy, không GPU), và `contest submit-method` khai báo chính xác
   các giá trị đó theo mặc định, do đó hãy công bố các giới hạn của bạn cùng cuộc thi nếu bạn
   thay đổi chúng.
   Cấu hình node chỉ khai báo một nửa cổng đó sẽ bị từ chối khi khởi động.
   `mt-eval node ledger verify` kiểm tra tệp đã điền: lệnh này từ chối
   giá trị `<...>` còn sót lại đầu tiên hoặc tệp được khai báo nhưng không có trên node,
   in ra những gì đã kiểm tra, sau đó phát lại chuỗi băm của sổ cái cục bộ. Máy tính
   kết nối mạng làm nhiệm vụ chuyển tiếp yêu cầu đến node cũng cần
   **service-role key** của cơ sở dữ liệu (`MT_EVAL_SUPABASE_SERVICE_KEY`). Khóa đó
   không bao giờ cần thiết trên chính node air-gap.
5. Kể từ thời điểm đó, máy tính sẽ không bao giờ kết nối vào mạng — và một lượt chạy niêm phong có
   thể được thực hiện để chứng minh điều đó trước: `mt-eval node egress-check` (cũng được thực thi
   tự động với `assert_airgap` trong cấu hình node) sẽ từ chối khi một
   tuyến đường, một lần thăm dò hoặc DNS cho thấy bất kỳ đường nào ra ngoài. Cập nhật hệ điều hành là một quy trình
   có chủ đích, được đóng gói và xác thực mã băm — chứ không phải là một dịch vụ chạy ngầm.

## 3. Kỷ luật truyền tải (mỗi cuộc thi, cả hai chiều)

Air-gap là một *quy trình*, không phải là một sản phẩm. Quy trình đó là:

- **Ổ đĩa IN** chứa: các gói phương thức hoặc mô hình đã nộp và bản kê của chúng. Trước khi bất cứ thứ gì chạy, node sẽ xác thực mã băm của từng gói đối chiếu với bản kê và quá trình quét import sẽ chạy (từ chối các phương thức import các thư viện mạng — tính năng này đã phát hành hôm nay).
- **Ổ đĩa OUT** chứa: bản kê điểm số đã ký — điểm số tổng hợp, các mã băm phương thức/cấu hình tương ứng, phần đầu của nhật ký kiểm toán — và *không có gì khác*. Đầu ra của từng phân đoạn được giữ lại trên node dưới sự kiểm soát của ban tổ chức; việc công bố chúng là một quyết định riêng biệt, có chủ đích của cộng đồng.
- Mỗi ổ đĩa chỉ phục vụ một chiều duy nhất. Ổ đĩa đã gắn vào node không bao giờ được tự động mount trên một máy trực tuyến — hãy mount ổ đĩa ở chế độ `noexec,nodev` và sao chép bản kê ra ngoài bằng tay.
- `mt-eval node manifest write <drive> --direction in|out` băm mọi tệp trên ổ đĩa trước khi chuyển qua; `mt-eval node manifest verify` ở phía nhận sẽ từ chối bất kỳ tệp nào bị thêm vào, thay đổi hoặc thiếu.
- Ghi nhật ký mỗi lần chuyển giao (ngày tháng, ổ đĩa, mã băm bản kê) vào sổ nhật ký bằng giấy hoặc nhật ký trên node. Tẻ nhạt chính là mấu chốt: nhật ký là thứ giúp bạn trả lời câu hỏi "liệu có bất cứ thứ gì khác từng rời khỏi đây không?" bằng bằng chứng xác thực.

## 4. Quyền giám quản khóa (M-trên-N, do cộng đồng nắm giữ)

Tập kiểm thử niêm phong được mã hóa khi lưu trữ; việc giải mã yêu cầu một túc số
các phần chia khóa do những người giám hộ mà **cộng đồng lựa chọn** nắm giữ — như hội đồng
Trưởng lão, cơ quan thẩm quyền ngôn ngữ, tổ chức giáo dục. Thiết kế này
không cấp bất kỳ phần chia khóa nào cho nền tảng, vì vậy Champollion không thể giải mã một tập dữ liệu niêm phong,
và bất kỳ người giám hộ đơn lẻ nào cũng không thể tự mình giải mã. Nghi thức
dưới đây vẫn chưa được thực hiện với những người giám hộ thực tế.

Nghi thức (một phiên ngồi lại ngoại tuyến; các công cụ đi kèm sẽ tự động hóa việc này): `mt-eval node ceremony init` tạo khóa của tập dữ liệu trên node, chia nó thành N phần chia sẻ (bất kỳ M phần nào cũng có thể tái tạo lại; ít hơn sẽ không tiết lộ gì cả — việc chia sẻ này mang tính lý thuyết thông tin), và xóa sạch khóa ngay trong cùng một nhịp; `ceremony share` xuất phần chia sẻ của mỗi người giám quản dưới dạng một tệp cho một token cộng với một bản sao lưu trên giấy có thể in được; `ceremony verify` chứng minh các bản sao được phân phối có thể tái tạo lại — mà không lưu trữ bất kỳ thứ gì; `ceremony share --wipe-originals` then destroys the node's own copies. `mt-eval node seal` mã hóa kho ngữ liệu bằng khóa công khai của nghi thức: node lưu trữ bản mã và một thẻ siêu dữ liệu không chứa nội dung, không có gì khác. Từ đó trở đi, việc chạy một đánh giá đồng nghĩa với việc các người giám quản phải xuất trình vật lý M trên N phần chia sẻ (`node run-method --offline --share …`): khóa được xây dựng lại **chỉ trong bộ nhớ bị khóa của trình thực thi**, được sử dụng cho một lần chạy gắn với quyền đó, và bị xóa sạch — nó không bao giờ chạm vào ổ đĩa nữa. Mọi yêu cầu, bỏ phiếu, cấp quyền và sử dụng đều được nối vào một sổ cái cục bộ dạng chuỗi băm (`node ledger verify`), và một nỗ lực chạy mà không có đủ túc số sẽ bị từ chối *và* được ghi lại.

Một câu nói trung thực về cơ chế này: đây là chia sẻ bí mật Shamir với việc tái tạo trong bộ nhớ của cỗ máy ngoại tuyến do cộng đồng nắm giữ — không phải là tính toán đa bên. Trong một lần chạy được ủy quyền, khóa tồn tại trong chốc lát, được lắp ráp hoàn chỉnh, trên phần cứng mà cộng đồng kiểm soát vật lý; các thuộc tính mà nó bảo vệ là *không có khóa thường trực trên ổ đĩa*, *không có lần chạy nào mà không có mặt đủ túc số*, và *mọi lần sử dụng đều được xâu chuỗi vào sổ cái có thể kiểm tra*. Việc ký ngưỡng từ phía nền tảng, nơi khóa không bao giờ được lắp ráp ở bất kỳ đâu, vẫn là công việc trong tương lai và được gắn nhãn như vậy ở bất cứ nơi nào nó được đề cập.

Việc luân chuyển và thay thế người giám quản sẽ chạy lại nghi thức; việc mất nhiều hơn N−M phần chia sẻ có nghĩa là tập dữ liệu sẽ được niêm phong lại từ bản sao nguồn của cộng đồng — cộng đồng luôn giữ lại bản gốc văn bản thuần túy (plaintext) của riêng mình, bởi vì [quyền sở hữu](/docs/network/sovereignty/data-sovereignty) chưa bao giờ thuộc về chúng tôi.

## 5. "Được chứng thực" ở đây có nghĩa là gì — và không có nghĩa là gì

Mỗi lần đánh giá tạo ra một **tệp kê khai điểm số được ký**: chữ ký của node trên các điểm số, mã băm của gói phương pháp, checksum của kho ngữ liệu, và phần đầu của nhật ký kiểm toán chỉ cho phép ghi thêm (append-only). Bất kỳ ai nắm giữ khóa công khai đã công bố của node đều có thể xác minh nó — `mt-eval node verify-manifest <manifest> --pubkey <published .pub.json>` — rằng *node này* đã tạo ra *những điểm số này* cho *chính xác những đầu vào này*, và nhật ký dạng chuỗi băm giúp phát hiện các chỉnh sửa lịch sử âm thầm.

Đó là **chứng thực phần mềm** — nó chứng minh tính toàn vẹn của bản ghi, và đó là những gì v1 cung cấp. Nó **không** chứng minh phần cứng silicon nào đã thực thi lần chạy: chứng thực từ xa bằng phần cứng (TEE) là công việc trong tương lai và cố tình không được tuyên bố hỗ trợ. Tuyên bố bảo mật trung thực cho v1: kỷ luật của ban tổ chức (§3) cộng với các tệp kê khai được ký cộng với quyền giám quản vật lý của cộng đồng đối với cỗ máy chính là mỏ neo niềm tin — đó cũng chính xác là nơi mà một thiết kế ưu tiên chủ quyền muốn đặt niềm tin vào.

## 6. Vòng lặp vận hành

1. Thông báo cuộc thi; công bố khóa công khai của node + ngưỡng điểm tập dev.
2. Nhận bài nộp trực tuyến (trên máy thông thường), tổng hợp bản kê IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Mang ổ đĩa IN tới node; xác thực các mã băm (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   đề xuất nộp bài ở trạng thái *pending*. Đầu tiên node sẽ kiểm tra đề xuất đó (`node run-method
   <id> --offline` thực thi lại bài kiểm tra vòng loại của thí sinh trên tập dev công khai
   và kiểm tra runtime container cho bài nộp bằng mã lệnh, không mở bất kỳ dữ liệu niêm phong nào, và
   ghi nhận kết quả đạt vào sổ cái cục bộ). Sau đó, người giám hộ ghi nhận quyết định
   trên node (`node approve <id> --offline --actor <custodian>`, bị từ chối
   cho đến khi quá trình kiểm tra đó vượt qua, hoặc `node deny … --offline --reason …`: một phiếu biểu quyết
   + ủy quyền trong sổ cái cục bộ và một bản ghi được ký bằng khóa của node;
   `node list --offline` hiển thị những gì đang chờ). Lượt chạy niêm phong (lại chạy `node run-method
   --offline`) sẽ từ chối đề xuất đang chờ cho đến khi sự phê duyệt đó được
   ghi nhận và xác thực thành công.
4. Các người giám hộ ủy quyền cho lượt chạy bằng cách cung cấp đủ túc số phần chia khóa (§4 —
   `node run-method <id> --offline --share … --share …`); tập dữ liệu niêm phong chỉ
   giải mã trực tiếp vào trình thực thi. Không đủ túc số, không chạy — và nỗ lực này
   sẽ được ghi vào sổ cái.
5. Thực thi; tính toán điểm số; giữ lại các đầu ra phân đoạn ở phía node.
6. Dọn dẹp: xóa dữ liệu văn bản gốc đang làm việc; ghi thêm vào nhật ký kiểm toán; ký bản kê.
7. Mang ổ đĩa OUT trở lại; công bố điểm số + bản kê; bất kỳ ai cũng có thể xác thực
   (`node verify-manifest`).
8. Ghi nhật ký chuyển giao; các ổ đĩa giữ nguyên mục đích chuyên dụng; node luôn giữ trạng thái ngắt kết nối.
