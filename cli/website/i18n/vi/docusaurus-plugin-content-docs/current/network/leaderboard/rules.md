---
sidebar_position: 1
title: "Quy tắc gửi bài"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Đánh giá MT

> **Tóm tắt nội dung.** Trang này xác định tiêu chí nộp bài lên bảng xếp hạng, cách tính điểm (chrF++ là chỉ số tiêu đề, cùng các chỉ số tiêu chuẩn và chẩn đoán kèm theo), chính sách chống gian lận, các bậc xác minh và quy trình gửi bài. Các phương pháp đã tiếp xúc với dữ liệu đánh giá sẽ bị loại.

champollion bao gồm một khung đánh giá dịch máy được thiết kế để **đo điểm chuẩn có thể tái lập** của các phương pháp dịch — đặc biệt là đối với các ngôn ngữ ít tài nguyên và ngôn ngữ bản địa, nơi không tồn tại các điểm chuẩn MT tiêu chuẩn và các tuyên bố về chất lượng rất khó xác minh.

---

## Bảng xếp hạng

Trọng tâm là **[Bảng xếp hạng phương pháp](https://champollion.dev/leaderboard)** — một bảng điểm công khai, trực tiếp và **mở tiếp nhận bài nộp**, nơi các nhà nghiên cứu và thành viên cộng đồng gửi cũng như so sánh các phương pháp dịch thuật với đánh giá có dấu vân tay (fingerprint) và khả năng tái lập.

Mỗi lượt gửi bao gồm:

- **Pipeline gắn dấu vân tay** — gắn liền với một commit Git và mã băm cấu hình cụ thể, giúp kết quả có thể truy vết về chính xác mã nguồn đã tạo ra chúng
- **Tập dữ liệu được đánh phiên bản** — được băm nội dung và quản lý phiên bản; điểm số chỉ có thể so sánh trong cùng một phiên bản tập dữ liệu
- **Chỉ số chuẩn hóa** — tất cả điểm số đều được tính toán bởi khung đánh giá (evaluation harness) dùng chung, loại bỏ sự khác biệt về mặt triển khai
- **Các bậc tin cậy** — tự đánh giá (self-benchmarked), Champollion Verified hoặc Community Validated
- **Theo dõi chi phí** — chi phí API cho mỗi lượt gửi, giúp sự đánh đổi giữa chi phí và chất lượng trở nên minh bạch

Bảng xếp hạng xếp thứ hạng các lượt chạy theo cách WMT, FLORES-200 và các nhiệm vụ chung AmericasNLP báo cáo đánh giá dịch máy (MT): dựa trên **một chỉ số tiêu chuẩn, chrF++**, được hiển thị cùng khoảng tin cậy 95% và chữ ký sacreBLEU của nó — ví dụ: `chrF++ 47.5 [45.9, 49.0]`. Mọi thông tin khác đều được hiển thị bên cạnh, không bao giờ trộn lẫn vào nó:

| Chỉ số | Vai trò | Đo lường điều gì |
|--------|---------|------------------|
| **chrF++** | **Chỉ số tiêu đề và xếp hạng** | Điểm F-score n-gram ký tự so với bản tham chiếu (sacreBLEU, `word_order=2`). Xử lý hình thái học phong phú tốt hơn các chỉ số cấp độ từ |
| **BLEU, spBLEU, TER, COMET** | Các chỉ số tiêu chuẩn, bên cạnh tiêu đề | Các chỉ số khác mà các bài báo MT báo cáo; COMET khi được tính toán, kèm theo id mô hình của nó |
| **Exact Match** | Chẩn đoán | Tần suất bản dịch khớp chính xác với bản tham chiếu |
| **FST Acceptance** | Chẩn đoán | Đối với các ngôn ngữ có bộ chuyển đổi trạng thái hữu hạn (FST): tỷ lệ từ đầu ra là các dạng hợp lệ. Nó không so sánh với bản gốc hay bản tham chiếu, vì vậy nó không bao giờ là một điểm số |
| **Equivalent Match** | Chẩn đoán | Tỷ lệ khớp với bản tham chiếu hoặc một biến thể chấp nhận được (trật tự từ, quy ước chính tả). Hiện tại là CRK; đang khái quát hóa. |
| **Semantic Score** | Chẩn đoán | Khả năng bảo toàn ý nghĩa, bởi một trình xác thực tất định. Hiện tại là CRK; đang khái quát hóa. |
| **Lưu ý về điểm số** | Hiển thị bên cạnh tiêu đề | Khi đầu ra sao chép bản gốc, ngắn hơn hoặc dài hơn nhiều so với bản tham chiếu, lặp lại một đầu ra cho nhiều đầu vào, hoặc các dòng kiểm thử có bản sao trong dữ liệu huấn luyện |

Việc một lượt chạy có tốt hơn lượt chạy khác hay không được quyết định bởi kiểm định ý nghĩa theo cặp (paired significance test) trên chrF++, chứ không phải bằng thứ tự của hai con số — các khoảng tin cậy chồng lấn là cảnh báo rằng thứ tự có thể chỉ là nhiễu ([Kiểm định ý nghĩa thống kê](/docs/network/specifications/significance)); bảng xếp hạng cuộc thi sử dụng kiểm định này để tạo thành các cụm thứ hạng. chrF++ chỉ xếp hạng các hệ thống trên cùng một tập dữ liệu, không bao giờ so sánh giữa các ngôn ngữ khác nhau. Không có điểm số tự động nào mang nhãn chất lượng — chỉ có đánh giá của con người bởi người nói ngôn ngữ đó mới chứng nhận chất lượng. Điểm tổng hợp có trọng số và các bậc chất lượng được sử dụng trước đây đã ngừng hoạt động; điểm tổng hợp của thẻ cũ nếu có hiển thị sẽ được ghi là "legacy composite (retired)".

:::info[Bộ chỉ số đầy đủ]
[Quy cách tính điểm](/docs/network/specifications/scoring#how-runs-are-scored) xác định cách chấm điểm các lượt chạy và danh mục chỉ số hoàn chỉnh (sáu danh mục: bề mặt, cấu trúc, ngữ nghĩa, hành vi, tuân thủ và các bộ so sánh được báo cáo).
:::

**[→ Xem bảng xếp hạng](https://champollion.dev/leaderboard)**

---

## Các tập dữ liệu hiện có

Những gì một lượt chạy có thể được chấm điểm đều được các công cụ liệt kê, do đó trang này không duy trì danh sách riêng:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

Trang [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) mô tả danh mục, định dạng ngữ liệu, các bậc độ khó, các phân luồng giấy phép và cách tạo tập dữ liệu của riêng bạn. Ba quy tắc từ danh mục đó quyết định những gì có thể xếp hạng:

- **Ngữ liệu bị cách ly không bao giờ được xếp hạng.** Nó được đưa vào danh mục nhưng không bao giờ có thể chạy được, và cơ sở dữ liệu sẽ từ chối điểm số gửi lên đối với nó. Các ngữ liệu tiếng Anh→Plains Cree của EdTeKLA (`eval-eng-crk-edtekla-dev-v1` và `eval-eng-crk-edtekla-textbook`) bị cách ly. Chúng mang giấy phép CC BY-NC-SA sửa đổi theo phạm vi chủ quyền (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) và được loại trừ khỏi mọi bảng xếp hạng, giải thưởng và phân luồng thương mại.
- **Ngữ liệu bị nhiễm bẩn chỉ xếp hạng tương đối.** FLORES+, và bất kỳ ngữ liệu nào được phân loại `HIGH` hoặc `MEDIUM` về độ nhiễm bẩn hoặc chưa được phân loại, sẽ được đóng dấu chỉ-so-sánh-tương-đối trên thẻ lượt chạy của nó. Nó so sánh các phương pháp chạy trên ngữ liệu đó và không bao giờ được báo cáo dưới dạng chất lượng tuyệt đối. Chỉ ngữ liệu được xếp loại `LOW` mới xếp hạng theo chất lượng tuyệt đối.
- **Các phân luồng giấy phép được duy trì.** Một ngữ liệu phi thương mại sẽ không tham gia vào các lộ trình thương mại và giải thưởng. Một ngữ liệu theo cấp phép sửa đổi, tùy chỉnh hoặc không nêu rõ sẽ từ chối đánh giá qua API mô hình từ xa cho đến khi quyền cho phép của chủ sở hữu được ghi nhận trên mục của nó.

**Các cuộc thi chạy trên các tập dữ liệu niêm phong mà đơn vị tổ chức nắm giữ.** Một cuộc thi không được chấm điểm trên bất kỳ ngữ liệu công khai nào trong số này. Đơn vị tổ chức, một cộng đồng hoặc một tổ chức, lưu giữ một tập kiểm thử được giữ lại và niêm phong trên cơ sở hạ tầng của riêng họ. Người tham gia đủ điều kiện thông qua tập dev công khai do đơn vị tổ chức phát hành, sau đó chuyển cho nút của đơn vị tổ chức một mô hình hoặc phương pháp để chạy. Người giám sát của đơn vị tổ chức sẽ ủy quyền cho mỗi lượt chạy và chỉ có điểm số được công bố ra ngoài. Xem [Tổ chức cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[KHÔNG HUẤN LUYỆN trên dữ liệu đánh giá]

**Các tập dữ liệu này chỉ dành cho mục đích đánh giá.** Các phương pháp được huấn luyện, tinh chỉnh, gợi ý vài lượt (few-shot-prompted) hoặc bằng cách khác bị lộ dữ liệu đánh giá sẽ tạo ra điểm số cao một cách nhân tạo và sẽ bị **loại khỏi bảng xếp hạng.**

Đây không phải là một gợi ý — đó là quy tắc quan trọng nhất để đảm bảo tính toàn vẹn của việc đánh giá. Hãy sử dụng các kho ngữ liệu riêng biệt để huấn luyện. Các tập đánh giá phải là dữ liệu chưa từng được mô hình của bạn nhìn thấy trong quá trình phát triển.

Nếu bạn đang sử dụng dữ liệu hướng dẫn (coaching data) hoặc các ví dụ few-shot, chúng phải đến từ **các nguồn hoàn toàn tách biệt**. Nếu còn nghi ngờ, đừng đưa vào.
:::

:::warning[Tính phi xác định của LLM]

Đầu ra của LLM là không xác định (non-deterministic). Điểm số thể hiện các phép đo tại một thời điểm cụ thể dưới các phiên bản mô hình và cấu hình API cụ thể. Các nhà cung cấp mô hình có thể cập nhật trọng số, chiến lược giải mã hoặc bộ lọc an toàn bất kỳ lúc nào, điều này có thể gây ra sự sai lệch điểm số giữa các lượt chạy. Bảng xếp hạng ghi lại chính xác mã định danh mô hình (slug) và dấu thời gian cho mỗi lượt gửi.
:::

---

## Điều gì tạo nên một phương pháp tốt

Không phải tất cả các phương pháp đều được tạo ra như nhau. Dưới đây là những điểm khác biệt giữa một công trình nghiên cứu nghiêm túc và những điểm số bị thổi phồng.

### Đặc điểm của một phương pháp mạnh mẽ

- **Tách biệt rõ ràng giữa dữ liệu huấn luyện và dữ liệu đánh giá** — phương pháp của bạn chưa bao giờ nhìn thấy tập đánh giá trong quá trình phát triển, tinh chỉnh, kỹ nghệ gợi ý (prompt engineering) hoặc lựa chọn ví dụ few-shot
- **Có thể tái lập** — người khác có thể sao chép kho lưu trữ của bạn, chạy hệ thống đánh giá và nhận được điểm số tương tự (trong giới hạn tính không xác định của LLM)
- **Được tài liệu hóa** — [thẻ phương pháp](/docs/network/specifications/methods) của bạn mô tả phương pháp của bạn làm gì, sử dụng những công cụ nào và các hạn chế của nó là gì
- **Trung thực về phạm vi** — nếu phương pháp của bạn chỉ hoạt động cho một cặp ngôn ngữ, hãy nói rõ; nếu nó bị giảm chất lượng trên một số cấu trúc hình thái nhất định, hãy ghi nhận điều đó
- **Nhận thức về cộng đồng** — đối với các ngôn ngữ bản địa, phương pháp của bạn tôn trọng chủ quyền dữ liệu. Bạn đã tham vấn các cộng đồng ngôn ngữ hoặc chỉ sử dụng dữ liệu được cấp phép mở

### Các dấu hiệu cảnh báo (những gì sẽ bị loại)

| Dấu hiệu cảnh báo | Tại sao lại là vấn đề |
|----------|--------------------|
| Huấn luyện trên dữ liệu đánh giá | Làm mất hoàn toàn mục đích của việc đánh giá. Điểm số bị thổi phồng sẽ gây hiểu lầm cho mọi người. |
| Lựa chọn kết quả tốt nhất (Cherry-picking) | Chạy 10 lần và chỉ gửi lượt chạy tốt nhất mà không tiết lộ các lượt chạy khác |
| Hậu xử lý không được tiết lộ | Sửa đổi đầu ra bằng thủ công trước khi chấm điểm |
| Dữ liệu hướng dẫn bị ô nhiễm | Sử dụng các ví dụ của tập đánh giá làm gợi ý few-shot hoặc mục từ điển |
| Tuyên bố sẵn sàng thương mại mà không có nguồn gốc rõ ràng | Nếu phương pháp của bạn sử dụng dữ liệu CC BY-NC-SA, nó không sẵn sàng cho mục đích thương mại |

### Các cấp độ xác minh

Các bậc xác minh mô tả **ai đã xác thực kết quả**. Chúng không phải là nhãn chất lượng (các bậc chất lượng tự động cũ đã [ngừng hoạt động](/docs/network/specifications/scoring#5-quality-tiers)).

| Bậc | Ý nghĩa | Cách đạt được |
|------|---------|--------------|
| **Self-benchmarked** | Bạn tự chạy bộ công cụ harness và gửi kết quả | Xuất bản thẻ lượt chạy của bạn bằng `mt-eval publish` |
| **Champollion Verified** | Dự án đã độc lập chấm điểm lại các đầu ra bạn gửi so với ngữ liệu tham chiếu được ghim sha và tái lập được điểm số của bạn | Công cụ chấm lại (re-scorer) là công cụ của người duy trì, được chạy thủ công theo đợt. Không có tiến trình lập lịch tự động, vì vậy không có bài nộp nào được chấm lại ngay khi đến (xem bên dưới) |
| **Community Validated** | Người nói song ngữ của ngôn ngữ đích, đủ điều kiện theo giao thức riêng của cộng đồng, đã xem xét một mẫu phân tầng của đầu ra (≥30 mục, ≥2 người đánh giá) và ≥70% đạt tiêu chuẩn của cộng đồng. Chỉ được trao thông qua quy trình kiểm thử riêng của cộng đồng; việc hạ bậc thông qua kiểm tra đột xuất diễn ra tương ứng | Gửi mã nguồn phương pháp cho tổ chức quản trị — họ sẽ chạy nó trên tập chuẩn vàng (gold-standard) và đưa đầu ra cho cộng đồng xem xét |

**Đánh giá do cộng đồng xác thực là một phân luồng riêng biệt, và hiện tại chưa có điểm số đánh giá của con người:** bộ công cụ harness có thể chọn ra những hệ thống mà ngân sách đánh giá thủ công cố định có thể chi trả từ bảng xếp hạng đóng băng của một cuộc thi kín (chỉ toàn bộ các nhóm đồng hạng — một cụm không bao giờ bị chia đôi), nhưng nó không ghi nhận xếp hạng nào, và hiện tại không có mục nào trên bảng xếp hạng mang đánh giá của con người.

**Thứ hạng là các cụm, không phải là một thứ tự nghiêm ngặt.** Các mục liền kề mà kiểm định ý nghĩa không thể phân tách sẽ chia sẻ chung một thứ hạng và mang một *khoảng* thứ hạng; trong một cuộc thi niêm phong, nơi đầu ra trên từng phân đoạn không bao giờ rời khỏi máy của đơn vị tổ chức, kiểm định theo cặp sẽ chạy trên máy đó và chỉ có các phán quyết đã ký của nó được đưa ra; nếu không có chúng, các trường hợp hòa điểm sẽ dựa trên bằng chứng khoảng tin cậy hoặc sự bằng nhau về điểm số. Cách thức hoạt động và mức độ tin cậy của từng nấc bằng chứng được trình bày chi tiết trong [Kiểm định ý nghĩa thống kê → Cụm xếp hạng](/docs/network/specifications/significance#ranking-clusters).

### Cách thức mở rộng quy mô xác minh: kiểm toán theo trọng số uy tín

**Chúng tôi không xác nhận nguồn gốc xuất xứ.** Một dòng trên bảng xếp hạng do một người đóng góp tạo ra bằng cách chạy bộ công cụ harness *mã nguồn mở* trên máy của *chính họ*. "Lượt chạy này thực sự đến từ bộ harness" không phải là điều máy chủ có thể xác minh đối với tính toán tự lưu trữ — khóa ký của harness nằm trong tay người đóng góp, vì vậy chữ ký chỉ xác thực một *máy móc, không phải sự trung thực*. Thay vì giả vờ điều ngược lại, **tính hợp lệ ở đây phải đạt được bằng nỗ lực và tự điều chỉnh**: một dòng đáng tin cậy vì điểm số của nó có thể **tái lập** và vì người đóng góp đứng sau đã **đặt cược uy tín mà nếu bị phát hiện làm giả sẽ bị hủy hoại hoàn toàn.** Việc xác minh được thực hiện theo bốn tầng, kỹ lưỡng ở những nơi cần thiết và tiết kiệm chi phí ở những nơi có thể — dự án không bao giờ phải chạy lại bài làm của tất cả mọi người.

- **L0 — chấm lại điểm mọi thứ (miễn phí, ~100%).** Công cụ chấm lại sẽ tính lại điểm của bạn từ *chính các đầu ra bạn đã gửi* so với **ngữ liệu tham chiếu được ghim sha** (không phải bản sao lưu trữ của bạn), bằng cùng một chỉ số mà harness sử dụng. Nếu điểm số không thể tái lập từ các đầu ra, hoặc bản tham chiếu được lưu trữ đã bị sửa đổi, lượt chạy sẽ **bị loại** — chỉ riêng điều này đã loại bỏ điểm số tự gõ hoặc bị chỉnh sửa. Lượt chạy tái lập thành công sẽ được thăng cấp lên **Champollion Verified** — bậc mà bảng xếp hạng cuộc thi mặc định sử dụng, và là bậc duy nhất đủ điều kiện nhận giải thưởng. Nó đã được xây dựng và có chi phí thấp, nhưng là một **lệnh của người duy trì, chạy thủ công**: không có gì tự động chạy khi gửi bài và không có lịch trình chạy. Cho đến khi điều đó thay đổi, mọi dòng khi đến — và tiếp tục duy trì — đều ở mức tự đánh giá (self-benchmarked).
- **L1 — nấc thang uy tín của người đóng góp.** Mỗi người đóng góp (được xác định qua thông tin đăng nhập của họ) *chỉ* kiếm được điểm uy tín bằng cách vượt qua các bước kiểm tra sâu hơn bên dưới — không bao giờ chỉ dựa vào số lượng, do đó việc tạo danh tính mới không mang lại lợi ích gì. Uy tín là **công khai**, và nó quyết định tần suất kích hoạt bước kiểm tra tốn kém.
- **L2 — chạy lại trên một *mẫu* (kiểm tra tốn kém; hiện chỉ là chính sách, chưa có trình chạy lại).** Đối với tập phát triển (development set) *công khai*, L0 không thể phát hiện người đóng góp chỉ đơn giản sao chép bản tham chiếu làm "bản dịch" của họ. Để phát hiện điều đó cần phải thực sự chạy lại mô hình — tài nguyên tính toán thực tế — vì vậy chúng tôi sẽ thực hiện điều đó trên một **mẫu**, không phải với tất cả mọi người. **Chính sách lấy mẫu** đã được xây dựng và thử nghiệm: một lượt chạy được chọn với xác suất tăng theo **mức độ quan trọng (stakes)** (lượt chạy mở ra cầu nối đầu tiên đến toàn bộ một ngữ hệ *luôn luôn* được chọn), tăng theo **sự bất thường** (mức nhảy vọt quá tốt đến mức khó tin so với kết quả tốt nhất trước đó *luôn luôn* được chọn), và giảm theo **uy tín** (người đóng góp đã vượt qua nhiều đợt kiểm toán sẽ hiếm khi bị kiểm tra đột xuất; người mới hoặc người nộp ẩn danh sẽ bị kiểm tra ở mỗi lượt chạy cho đến khi họ xây dựng được lòng tin). Vượt qua kiểm toán L2 sẽ nâng cao uy tín. **Trình chạy lại mà chính sách này vận hành hiện chưa tồn tại**, do đó chưa có đợt kiểm toán L2 nào từng kích hoạt: một lượt chạy được chọn sẽ được ghi nhận là *L2-pending*.
- **L3 — kiểm chứng chéo (xác minh miễn phí).** Khi hai người đóng góp *độc lập* chạy cùng một mô hình trên cùng một ngữ liệu và các đầu ra được chấm điểm lại của họ **trùng khớp**, sự trùng khớp đó *chính là* sự xác minh — và nó nâng cao uy tín của cả hai. Sự **bất đồng** thực sự sẽ gắn cờ cả hai lượt chạy để kiểm toán L2. Việc tái lập được khen thưởng thay vì bị coi là dư thừa.

**Một trường hợp làm giả bị phát hiện sẽ dẫn đến hậu quả nghiêm trọng — tương tự như một bài báo bị rút lại (retraction).** Hành vi làm giả được chứng minh sẽ đưa uy tín của người đóng góp về 0, **kiểm toán lại toàn bộ lịch sử đã xác minh của họ** (từng lượt chạy đã xác minh của họ sẽ được đưa lại quy trình xác minh) và được ghi nhận **công khai** trong nhật ký kiểm toán. Đó là điều giúp việc lấy mẫu nhẹ trở nên an toàn: gian lận trên một tập dev công khai có thể lọt qua trong một lượt chạy, nhưng cái giá phải trả dự kiến — mất toàn bộ sự tin cậy đã tích lũy và toàn bộ hồ sơ bị rà soát lại — biến nó thành một canh bạc tồi. Các quy tắc này ràng buộc tương tự đối với các lượt chạy của chính những người duy trì dự án.

**Tại sao việc đóng góp vẫn rất đáng giá.** Bạn luôn chi trả phần tốn kém nhất (chạy phương pháp của bạn); dự án chỉ trả phần chấm điểm lại L0 miễn phí cho mọi người cộng với việc chạy lại L2 trên một *mẫu thu hẹp* — cao đối với người mới và các lượt chạy có mức độ quan trọng cao, thấp đối với những người đóng góp đã được chứng minh. Chi phí xác minh được *khấu hao theo uy tín và san sẻ thông qua kiểm chứng chéo*, chứ không phải thanh toán toàn bộ mỗi lần.

---

## Cách gửi

1. **Xây dựng phương pháp của bạn** — xem [Xây dựng phương pháp](/docs/network/specifications/methods) để biết giao diện phương pháp
2. **Chạy harness** — xem [Eval Harness](/docs/network/specifications/harness) để biết cách thiết lập và sử dụng
3. **Tạo run card** — harness tạo ra một run card JSON chứa điểm số, vân tay và siêu dữ liệu của bạn
4. **Xuất bản** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` tải run card lên bảng xếp hạng (xem trước bằng `--dry-run`)
5. **Xuất hiện trên bảng xếp hạng** — lượt chạy của bạn được liệt kê là *self-benchmarked (unverified)*. [Bảng xếp hạng phương pháp](https://champollion.dev/leaderboard) liệt kê và xếp hạng mọi dòng không bị `disqualified`, bao gồm cả các lượt tự đánh giá và được dán nhãn tương ứng; lọc theo *Champollion Verified* để chỉ xem các kết quả đã được chấm điểm lại. Bước chấm điểm lại L0 để nâng hạng một lượt chạy lên bậc đó là một đợt xử lý của người duy trì và không có tiến trình lập lịch, vì vậy hiện tại mọi dòng trên bảng xếp hạng đều là lời tuyên bố tự báo cáo. Chế độ chỉ hiển thị Verified là mặc định cho bảng xếp hạng **cuộc thi**, và đây là bậc duy nhất đủ điều kiện nhận giải thưởng

---

## Chính sách liêm chính: Rút bài, Chạy lại, Hủy niêm yết, Tranh chấp

Được viết trước để việc thực thi là một quy trình, không phải kịch tính. Các quy tắc này ràng buộc mọi người như nhau — bao gồm cả các lượt chạy của chính những người duy trì.

**Không rút lại bài.** Một lượt chạy đã xuất bản là một bản ghi vĩnh viễn. Không có cơ chế nào — cho bất kỳ ai — để xóa một điểm số vì nó gây xấu hổ. Mỗi dòng lượt chạy đều mang dấu thời gian `submitted_at` do máy chủ đóng dấu và một dấu vết kiểm toán bất biến; chính các hành động kiểm duyệt cũng được ghi lại.

**Chạy lại chỉ thêm vào, không bao giờ thay thế.** Nếu bạn cải tiến phương pháp của mình, hãy xuất bản một lượt chạy mới. Lượt chạy cũ vẫn được giữ nguyên. Tiết lộ có chọn lọc — thử nghiệm riêng tư nhiều biến thể và chỉ xuất bản phương án chiến thắng — là điều khiến các bảng xếp hạng khác dễ bị gian lận; bản ghi chỉ thêm vào (append-only) là câu trả lời mang tính cấu trúc. Việc loại bỏ trùng lặp bằng dấu vân tay giúp ngăn chặn spam gửi lại nội dung giống hệt từng byte; nó không bao giờ viết lại lịch sử.

**Hủy niêm yết là việc thực thi quy tắc, có nêu rõ quy tắc.** Một lượt chạy chỉ bị hủy niêm yết (được đánh dấu `disqualified` một cách rõ ràng — không phải âm thầm xóa bỏ) vì các nguyên nhân đã được liệt kê: tập dữ liệu bị cách ly hoặc tập con không hợp lệ (được thực thi bởi database trigger bên dưới mọi client), không khớp mã tổng kiểm (checksum) của ngữ liệu, điểm số bị làm giả hoặc nằm ngoài phạm vi, vi phạm rào chắn nội dung (content-guard) hoặc người quản lý rút lại đăng ký của dữ liệu cơ sở. Việc hủy niêm yết sẽ nêu rõ quy tắc và bằng chứng. Các nguyên nhân mới sẽ được bổ sung vào đây thông qua bản chỉnh sửa có ghi ngày tháng trước khi được áp dụng, không bao giờ được hồi tố tạo ra cho một trường hợp riêng lẻ.

### Gắn cờ một kết quả

*Đã thêm vào ngày 07-09-2026.*

:::caution[Chưa tiếp nhận gắn cờ]

Tính năng gắn cờ đã được xây dựng và cơ sở dữ liệu đã sẵn sàng kể từ ngày 07-09-2026 — nhưng biểu mẫu gửi cờ vẫn chưa được triển khai lại trên đó, vì vậy *Flag this result* vẫn chưa thể gửi được. Nó sẽ báo lỗi thay vì âm thầm chấp nhận một lá cờ. Trong thời gian này, vui lòng gửi email đến `info@champollion.dev`. Thông báo này sẽ được gỡ bỏ vào ngày biểu mẫu được phát hành chính thức.

:::

**Bất kỳ ai cũng có thể gắn cờ một kết quả.** Mở rộng dòng của kết quả đó trên bảng xếp hạng và sử dụng *Flag this result*: thao tác này sẽ mở một biểu mẫu tin nhắn đã được liên kết với id của lượt chạy đó, và bạn nêu rõ những gì bạn cho là sai cùng cách bạn biết được — ngữ liệu bị nhiễm bẩn, chỉ số không khớp với nhãn của nó, phương pháp bị gán sai tác giả, hoặc bất kỳ điều gì khác. Một lá cờ bắt buộc phải đưa ra lý do. Một lá cờ không có lý do chẳng khác nào một lượt bình chọn giảm (downvote), và bảng xếp hạng này không có downvote.

**Gắn cờ là một tin nhắn riêng tư, không phải là một phiếu bầu.** Nó được gửi đến những người duy trì dưới dạng một phiếu yêu cầu (ticket) và không chuyển đi đâu khác. Không có số lượng cờ nào từng được hiển thị — không có trên dòng, không có trong run card, không có ở bất kỳ đâu — bởi vì một con số hiển thị công khai sẽ trở thành mục tiêu để gian lận, và vị thế của một kết quả phải dựa trên bằng chứng thay vì số người phản đối. Chỉ riêng việc gửi gắn cờ sẽ không làm thay đổi bất kỳ điều gì về dòng đó.

**Một lá cờ được chấp thuận chỉ hiển thị theo đúng một cách:** kết quả được đánh dấu `disqualified`, vì một nguyên nhân đã được liệt kê trên trang này. Tương tự như mọi trường hợp hủy niêm yết khác, một nguyên nhân mới sẽ được thêm vào đây **bằng bản chỉnh sửa có ghi ngày tháng trước khi áp dụng cho bất kỳ ai** — vì vậy việc gắn cờ không bao giờ có thể tạo ra một quy tắc bí mật hay quy tắc hồi tố. Nếu lá cờ không được chấp thuận, dòng đó vẫn giữ nguyên không đổi, và nếu bạn đã để lại địa chỉ, bạn sẽ nhận được câu trả lời trong mọi trường hợp.

**Các bậc tin cậy là nhãn, không phải là sự chỉnh sửa.** Các dòng `self-benchmarked` là những tuyên bố; các dòng `Champollion Verified` đã được chấm điểm lại độc lập từ các đầu ra của người nộp so với ngữ liệu được ghim sha; `Community Validated` chỉ được trao thông qua quy trình kiểm thử riêng của cộng đồng. Việc xác minh thay đổi bậc của một dòng — không bao giờ thay đổi điểm số của dòng đó.

**Uy tín là công khai và tự điều chỉnh.** Điểm uy tín của người đóng góp, cùng nhật ký kiểm toán ghi lại mọi lần chấm lại điểm, chạy lại theo mẫu, kiểm chứng chéo và xử lý gian lận, đều được công khai. Uy tín không phải là hệ số nhân điểm và không bao giờ can thiệp vào các con số của một lượt chạy — nó chỉ quyết định tần suất các lượt chạy của người đóng góp được kiểm toán lại (xem mục *kiểm toán theo trọng số uy tín* ở trên). Hành vi làm giả bị chứng minh sẽ được ghi nhận công khai tương tự như việc rút bài và kích hoạt kiểm toán lại toàn bộ lịch sử đã xác minh của người đóng góp; các quy tắc tương tự cũng áp dụng cho các lượt chạy của chính những người duy trì.

**Tranh chấp.** Hãy mở một issue kèm theo id lượt chạy và khiếu nại cụ thể (sai điểm, sai tập dữ liệu, áp dụng sai quy tắc). Những người duy trì sẽ chạy lại các bước kiểm tra tất định một cách công khai; kết quả và bằng chứng của nó sẽ được đưa lên issue. Nếu tranh chấp liên quan đến dữ liệu hoặc quá trình xác thực của một cộng đồng, cơ quan có thẩm quyền của chính cộng đồng đó sẽ quyết định và ban quản trị bảng xếp hạng sẽ thực thi quyết định của họ. Đối với các cuộc thi có giải thưởng, các quy tắc tương tự sẽ được áp dụng cùng với các bước kiểm toán và điều kiện vòng loại được công bố trước của cuộc thi — những người chiến thắng sẽ được kiểm toán **trước khi** chi trả giải thưởng, và quyết định loại tư cách sẽ trích dẫn quy tắc chính xác như bất kỳ trường hợp hủy niêm yết nào khác.

## Hướng đi tương lai

- **Các lượt chạy so sánh mô hình toàn diện** — đánh giá hệ thống các mô hình tiên phong (GPT-4o, Claude, Gemini, v.v.) trên các ngôn ngữ của champollion bằng cách sử dụng các kho ngữ liệu đánh giá tùy chỉnh (không phải điểm chuẩn công khai)
- **Thêm nhiều cặp ngôn ngữ hơn** — tiếng Quechua, tiếng Inuktitut và các ngôn ngữ ít tài nguyên khác khi các tập dữ liệu được cộng đồng xác thực trở nên khả dụng
- **Nhập tập dữ liệu** — công cụ để chuyển đổi các tập dữ liệu đánh giá bên ngoài (WMT, Tatoeba, v.v.) sang định dạng đánh giá của champollion
- **Tự động chạy lại** — phát hiện các thay đổi phiên bản mô hình và chạy lại các điểm chuẩn để theo dõi sự sai lệch điểm số

---

## Xem thêm

- **[Bảng xếp hạng phương pháp](https://champollion.dev/leaderboard)** — điểm số trực tiếp và các bài nộp
- **[Eval Harness](/docs/network/specifications/harness)** — cách chạy đánh giá
- **[Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets)** — định dạng tập dữ liệu và các tập dữ liệu hiện có
- **[Xây dựng phương pháp](/docs/network/specifications/methods)** — đặc tả giao diện phương pháp
- **[Quy cách Run Card](/docs/network/specifications/run-card)** — JSON schema của run card
- **[Quy cách Benchmark](/docs/network/specifications/benchmark)** — giao thức đánh giá, định dạng ngữ liệu, chủ quyền
- **[Quy cách tính điểm](/docs/network/specifications/scoring)** — nguồn chân lý duy nhất (SSOT) cho các chỉ số và cách chấm điểm các lượt chạy
