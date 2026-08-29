---
sidebar_position: 3
title: "Huấn luyện mô hình đầu tiên của bạn (với agent của bạn)"
description: "Hướng dẫn từng bước để huấn luyện một mô hình dịch máy (MT) tài nguyên thấp bằng cách chỉ dẫn một coding agent — những gì bạn nói, những gì forge thực hiện, một phản hồi từ chối trông như thế nào, và cách đọc kết quả chẩn đoán."
related:
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Huấn luyện mô hình đầu tiên của bạn (với agent của bạn)

Bạn không cần phải biết cách huấn luyện một mô hình dịch máy nơ-ron. Bạn chỉ cần có khả năng **nói với một coding agent những gì bạn muốn** — Claude, hoặc một mô hình thuộc phân khúc Sonnet/Flash, hoặc bất kỳ agent nào có thể chạy các lệnh shell. **nmt-forge** được xây dựng để agent có thể vận hành nó một cách *cơ học*: ở mỗi bước, công cụ sẽ cho agent biết chính xác phải làm gì tiếp theo, và từ chối — một cách rõ ràng, kèm theo giải pháp khắc phục — khi một bước nào đó có thể làm hỏng kết quả của bạn.

Trang này mô tả toàn bộ chu trình. Mỗi bước được viết dưới dạng **những gì bạn nói với agent của mình**, **những gì forge thực hiện**, **giao diện khi bị từ chối** (để cả bạn và agent đều không hoảng loạn khi nó xảy ra — việc từ chối chính là cách công cụ hoạt động), và cuối cùng là **cách đọc báo cáo**.

:::tip Quy tắc duy nhất cho agent của bạn
Hãy bảo nó: *"Luôn chạy `nmt-forge status --json` trước tiên, và sau mỗi bước.
Làm theo bất kỳ điều gì `next_command` của nó yêu cầu."* Thói quen duy nhất đó sẽ biến forge thành một đường ray dẫn hướng. Nếu agent của bạn kết nối qua MCP, chu trình tương tự chính là công cụ `forge_status` — xem [Hướng dẫn về Agent](/docs/network/getting-started/agent-guide).
:::

---

## Bước 0 — Hướng agent của bạn vào ngôn ngữ của bạn

**Bạn nói:** *"Tôi muốn huấn luyện một mô hình tiếng Anh→[ngôn ngữ của bạn]. Hãy bắt đầu bằng việc khám phá những gì forge biết về ngôn ngữ này. Mã ISO 639-3 là `crk`"* (sử dụng mã ngôn ngữ của bạn).

**forge thực hiện:** `nmt-forge discover crk` đọc thẻ ngôn ngữ — chữ viết, từ điển, bộ phân tích hình thái, các kho ngữ liệu hiện có và các tập đánh giá (với bất kỳ cờ `do_not_train` / cách ly nào), cùng các chỉ số trọng tài theo từng ngôn ngữ. Nó xếp ngôn ngữ của bạn vào **thang tài nguyên**: (1) văn bản song ngữ → huấn luyện có giám sát; (2) + đơn ngữ → dịch ngược có gắn thẻ; (3) + từ điển/ngữ pháp → dữ liệu tổng hợp có trích dẫn; (4) + bộ phân tích → tổng hợp được xác minh hai chiều; (5) + chỉ số trọng tài → chỉ số riêng của ngôn ngữ trong việc chấm điểm và lựa chọn checkpoint.

**Một trường trống nghĩa là CHƯA XÁC ĐỊNH (UNKNOWN), chứ không bao giờ là bằng không.** Một thẻ thưa thớt không có nghĩa là "ngôn ngữ này không có gì" — có thể nó chỉ chưa ghi nhận tài nguyên đó. Bạn luôn có thể tự mang theo kho ngữ liệu song ngữ của riêng mình.

Sau đó: *"Khởi tạo khung dự án."* → `nmt-forge init crk` ghi một không gian làm việc, một cấu hình khởi đầu, và một bản tóm tắt `NEXT_STEPS`.

---

## Bước 1 — Phân chia dữ liệu không thể gian lận

**Bạn nói:** *"Đây là kho ngữ liệu song ngữ `corpus.jsonl` của tôi. Hãy chia nó thành các tập train/dev/test và đăng ký các tập dev và test."*

**forge thực hiện:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7 --out data/splits --register mypair`. Nó tạo ra một phân chia **không giao thoa theo nhóm (group-disjoint)**: bất kỳ hai cặp câu nào có chung nguồn *hoặc* đích sẽ nằm ở **cùng một** phía. Đây là cách phổ biến nhất khiến điểm số của các ngôn ngữ ít tài nguyên bị thổi phồng — một sách giáo khoa ánh xạ nhiều bài tập tiếng Anh sang một từ đích, một phân chia ngẫu nhiên ngây thơ sẽ bỏ một bản sao vào tập train và bản sao song sinh của nó vào tập test, và mô hình "dịch" các câu trả lời mà nó đã ghi nhớ.

**Giao diện khi bị từ chối:** nếu bạn đưa cho forge một phân chia do bạn tự tạo và nó không phải là không giao thoa, `verify-split` sẽ gặp sự cố và nêu tên các khóa bị trùng — *"các hàng này có chung một đích chuẩn hóa giữa tập train và test."* Cách khắc phục: hãy để forge tự thực hiện việc phân chia.

---

## Bước 2 — Sàng lọc rò rỉ dữ liệu

**Bạn nói:** *"Trước khi huấn luyện, hãy kiểm tra xem kho ngữ liệu huấn luyện có bị rò rỉ dữ liệu so với các tập đánh giá hay không."*

**forge thực hiện:** `nmt-forge leak-audit corpus.jsonl`. Nó sàng lọc kho ngữ liệu của bạn so với mọi tập dev/test/sealed đã đăng ký:

- **Trùng khớp hoàn toàn hoặc gần như trùng khớp ở phía đích** (câu trả lời tham chiếu nằm trong dữ liệu huấn luyện của bạn) → **nghiêm trọng (fatal)**. Đây là rò rỉ câu trả lời.
- **Gần như trùng khớp ở phía nguồn với một câu trả lời *khác*** → **thông tin, được giữ lại**. Cùng một câu lệnh, bản dịch khác nhau là một cặp tương phản tối thiểu hợp lệ, không phải là rò rỉ — forge báo cáo nhưng không bao giờ xóa nó. (Sự khác biệt này là một lỗi thực tế mà chúng tôi phát hiện được qua quá trình dogfooding: phiên bản trước đó đã gắn cờ nghiêm trọng cho 44 hàng trong khi chỉ có 17 hàng thực sự bị rò rỉ.)

**Giao diện khi bị từ chối:** *"row 118: target-side near-duplicate of test set `mypair-test` (Jaccard 0.83) — answer leakage."* Cách khắc phục: agent của bạn chạy `nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` và huấn luyện trên những phần dữ liệu còn lại.

---

## Bước 3 — Dự đoán trước khi xem kết quả

**Bạn nói:** *"Hãy ghi lại những gì chúng ta kỳ vọng mô hình sẽ đạt được, sau đó chúng ta sẽ huấn luyện."*

**forge thực hiện:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions predictions.md`. Bạn (hoặc agent của bạn, nói rõ ra) cam kết các dự đoán có thể kiểm chứng tính đúng sai — chỉ số nào, hướng nào, quy mô ra sao — **trước khi** có bất kỳ điểm số kiểm thử nào tồn tại.

**Giao diện khi bị từ chối:** nếu agent của bạn cố gắng chấm điểm tập test mà không có đăng ký trước, `score` sẽ từ chối: *"scoring a test set is refused without a preregistration that predates the first scoring read."* Đây là điều phân biệt giữa một kết quả thực tế và việc thêu dệt câu chuyện dựa trên kết quả có sẵn. Cách khắc phục: đăng ký trước.

:::info Tại sao việc này có vẻ như thêm việc
Đây chính là công việc cần làm. Mỗi rào chắn ở đây là một sai lầm từng đánh lừa các nhà nghiên cứu thực thụ. Công cụ này biến con đường trung thực thành con đường dễ dàng và biến con đường không trung thực thành con đường ngăn cản bạn.
:::

---

## Bước 4 — Kiểm tra các rào chắn, sau đó huấn luyện

**Bạn nói:** *"Liệu lượt chạy huấn luyện có vượt qua tất cả các bước kiểm tra không? Nếu có, hãy huấn luyện."*

**forge thực hiện:** `nmt-forge preflight run` liệt kê mọi rào chắn mà lượt chạy sẽ gặp phải — có dev-fence, kiểm tra rò rỉ sạch sẽ, xác định được mức sàn lịch trình (schedule floor), kiểm tra khoảng trống giải mã (decode headroom) — mỗi mục đi kèm ✓ hoặc ✗ cùng cách khắc phục. Khi tất cả đều xanh: `nmt-forge run config.json`.

Huấn luyện là bước duy nhất **không** phải là một lệnh gọi công cụ tức thì — nó sử dụng GPU và mất từ vài phút đến vài giờ. Agent của bạn chạy nó trong terminal và theo dõi các dòng `[schedule-sanity]`. forge tự động tính toán **mức sàn (floor)** dừng sớm từ sự kết hợp dữ liệu của bạn, nhờ đó một lượt chạy chứa nhiều dữ liệu tổng hợp sẽ không bị dừng đột ngột ở nửa epoch khi độ hao hụt (loss) của tập dev thực tế dao động (một lỗi thực tế thường gặp — xem [Chẩn đoán một lượt chạy huấn luyện](/docs/network/getting-started/diagnosing-training)).

Khi hoàn tất, forge đã **chọn một checkpoint trên tập dev được rào chắn** (không bao giờ chọn trên tập test) và ghi lại một `run-manifest.json`.

---

## Bước 5 — Hoàn tất chu trình: đánh giá và chẩn đoán

**Bạn nói:** *"Hãy chấm điểm mô hình trên bộ kiểm thử (test battery) và cho tôi biết cần cải thiện những gì."*

**forge thực hiện:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config config.json`. Lệnh này **hoàn tất chu trình** chỉ trong một câu lệnh: nó giải mã bộ kiểm thử bằng checkpoint mà lượt chạy đã chọn, chấm điểm (được kiểm soát bởi đăng ký trước, với khoảng tin cậy 95% cho mọi con số), và đính kèm một phần **Chẩn đoán & Khuyến nghị** bằng ngôn ngữ tự nhiên. (Trước khi lệnh này tồn tại, bạn phải tạo liên kết tượng trưng (symlink) cho checkpoint và chạy bộ giải mã bằng tay — chính xác là bước mà những người mới bắt đầu thường bị lạc lối.)

### Cách đọc báo cáo battery-lint

Báo cáo là một bảng điểm số **theo văn phong/lĩnh vực (register)** (sách giáo khoa, chính phủ, truyện truyền miệng, ...), mỗi mục đi kèm khoảng tin cậy của nó, theo sau là phần chẩn đoán. Phần chẩn đoán sẽ chỉ ra các **văn phong yếu nhất** của bạn, và đối với mỗi văn phong, nguyên nhân có khả năng nhất cùng **đòn bẩy** cần tác động tiếp theo:

| Nếu chẩn đoán nói… | Nghĩa là… | Đòn bẩy |
|---|---|---|
| `R1-vocabulary-gap` | điểm số của văn phong đó thấp **và** đầu ra chưa hoàn thành; mô hình thiếu từ vựng | **TỪ VỰNG (VOCABULARY)** — mở rộng từ điển, sau đó kiểm tra lại phễu |
| `R2-structure-gap` | các từ đã được biết nhưng *cấu trúc* câu thì chưa | **CẤU TRÚC (STRUCTURE)** — thêm các cấu trúc còn thiếu (templates/compositor) |
| `R3-mixed-convention` | đầu ra bị lẫn lộn các cách chính tả | **CHÍNH TẢ (ORTHOGRAPHY)** — chuẩn hóa kho ngữ liệu về một quy ước duy nhất, huấn luyện lại |
| `R4-optimism-bound` | điểm số "đầy đủ" bị thổi phồng bởi các hàng đánh giá gần như trùng lặp | **ĐO LƯỜNG (MEASUREMENT)** — trích dẫn điểm số nghiêm ngặt để đánh giá khả năng tổng quát hóa |
| `R5-low-power` | khoảng tin cậy quá rộng | **ĐO LƯỜNG (MEASUREMENT)** — không hành động dựa trên các mức chênh lệch nhỏ hơn khoảng tin cậy; mở rộng tập đánh giá |
| `R7-transfer-plateau` | hoạt động tốt trên dữ liệu tổng hợp, nhưng bị đình trệ trên văn bản thực tế | **DỮ LIỆU THỰC TẾ (REAL-DATA)** — dịch ngược dữ liệu đơn ngữ hoặc thu thập các câu song ngữ thực tế |

Mỗi phát hiện đều đi kèm với bằng chứng kích hoạt nó. Đối với các phát hiện `--json`, agent của bạn có thể xử lý bằng lập trình: `nmt-forge lint <battery-manifest.json>`.

---

## Những gì bạn vừa thực hiện

Bạn đã huấn luyện một mô hình có điểm số thực sự đáng tin cậy: không rò rỉ câu trả lời, checkpoint được chọn mà không cần xem trước tập test, có sai số cho mọi con số, các dự đoán được viết trước khi có kết quả, và một chẩn đoán chỉ ra đòn bẩy tiếp theo thay vì để bạn phải tự đoán. Đó chính là mấu chốt — **kết quả trung thực là mặc định, và bạn không cần chuyên môn về dịch máy (MT) để đạt được điều đó.**

Khi các con số gây thất vọng (chắc chắn sẽ như vậy trong lần đầu tiên), hãy truy cập [Chẩn đoán một lượt chạy huấn luyện](/docs/network/getting-started/diagnosing-training) — tài liệu này tập trung vào triệu chứng trước tiên, được viết dành riêng cho khoảnh khắc đó.
