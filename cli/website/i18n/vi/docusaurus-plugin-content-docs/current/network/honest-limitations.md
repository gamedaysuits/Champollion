---
title: "Giới hạn kỹ thuật"
description: "Những điều Champollion (chưa) khẳng định, được nêu một cách chuẩn xác: giới hạn của việc xác thực hình thái, các cấp độ tin cậy tự báo cáo, xác thực từ người nói, lưu ký bài kiểm tra niêm phong, và lý do không cung cấp độ tin cậy cho từng câu."
---

# Giới hạn kỹ thuật

> **Bạn mới đến đây?** Trang [Những điều công cụ chưa làm được](/docs/what-it-cant-do-yet) giải thích
> những điều tương tự bằng ngôn từ bình dị. Trang này là phiên bản chính xác, dành cho
> các nhà phát triển, nhà nghiên cứu và agent.

Đây là những tuyên bố mà chúng tôi sẽ **không** vượt quá. Nếu có bất kỳ điều gì khác trên trang web
này ngụ ý nhiều hơn những gì được viết ở đây, hãy coi đó là một lỗi và
[báo cho chúng tôi](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Cơ sở hạ tầng đánh giá chỉ có được sự tin cậy bằng cách trung thực về các giới hạn của nó. Dưới đây
là các giới hạn của chúng tôi, được nêu rõ ràng để bạn có thể kiểm chứng.

## 1. Xác thực hình thái sâu phụ thuộc vào một FST *và* một tập kiểm thử có thể xếp hạng

Xác thực hình thái dựa trên FST — kiểm tra xem mỗi từ đầu ra có phải là một
từ đúng quy cách trong ngôn ngữ đích hay không — cần hai yếu tố cho một cặp
ngôn ngữ: một FST mà bộ công cụ đánh giá (harness) đã ghim cố định, và một tập đánh giá cho cặp ngôn ngữ
có thể xếp hạng. Bản thân `GiellaLTFSTMetric` mang tính **tổng quát**: nó chấm điểm bất kỳ
ngôn ngữ nào có FST GiellaLT được ghim (Plains Cree, các ngôn ngữ Sámi,
tiếng Phần Lan, tiếng Na Uy Bokmål, Inuktitut và các ngôn ngữ khác). Một số ngôn ngữ trong số đó
có các tập đánh giá mở (Tatoeba, WMT, WMT24++) —
[trang tập dữ liệu](/docs/network/leaderboard/datasets) liệt kê danh mục này,
`mt-eval corpora --source eng --target <code>` liệt kê những gì có thể chạy cho một cặp ngôn ngữ,
và `mt-eval corpora --with-fst` chỉ liệt kê các cặp có ngôn ngữ đích sở hữu một
FST đã ghim, cùng với trạng thái liệu nó đã được cài đặt trên máy của bạn hay chưa.
Plains Cree, ngôn ngữ khởi đầu cho công việc FST này, là một ngoại lệ: hai
tập đánh giá của nó (EdTeKLA) được phân loại là các nhãn bị cách ly, và
cơ sở dữ liệu sẽ từ chối bất kỳ điểm số nào được gửi lên liên quan đến chúng.

Hai giới hạn bổ sung được áp dụng. Trường hợp FST được ghim chỉ là một bộ
**chấp nhận (acceptor)** kiểm tra chính tả (Bắc Sámi, Amharic, Basque), nó chỉ cho biết một từ có tồn tại hay không
chứ không cho biết từ đó có được biến hình đúng cách hay không, do đó `morphological_accuracy` không
được tính toán — và một bộ chấp nhận cũng chấp nhận một số từ tiếng Anh và từ viết hoa, do đó
sự chấp nhận FST có thể cộng điểm cho đầu ra chưa dịch (khi đó thẻ lượt chạy sẽ hiển thị
cảnh báo sao chép nguồn; xem [các lưu ý về điểm số](/docs/network/specifications/scoring#2-8-score-caveats)). Sự chấp nhận FST chỉ mang tính chẩn đoán: nó không bao giờ nằm trong chỉ số chrF++ tiêu đề hay dùng để xếp hạng một lượt chạy.
Nó cũng cộng điểm cho trường hợp lặp lại một câu hợp lệ duy nhất cho mọi đầu vào; khi đó thẻ lượt chạy
sẽ hiển thị cảnh báo đầu ra gần như không đổi.
Và mọi cặp ngôn ngữ không có FST đều được chấm điểm bằng các chỉ số bề mặt (chrF++, BLEU)
và các kiểm tra hành vi. Đó là những tín hiệu hữu ích, nhưng chúng **không**
đảm bảo tính hợp lệ về mặt hình thái. Chúng tôi không tuyên bố việc xác thực hình thái
cho bất kỳ ngôn ngữ nào nếu thiếu một trong hai yếu tố: một FST và một tập đánh giá có thể xếp hạng.

## 2. Các bậc tin cậy: hiện tại mọi hàng đều là tự báo cáo {#2-trust-tiers-are-self-reported-at-launch}

Hầu hết các điểm số đều do người đóng góp tự chạy harness và
công bố kết quả. **Xác minh** — chấm điểm lại một bài nộp từ chính các
kết quả đầu ra của nó đối với ngữ liệu chuẩn được ghim mã SHA — đã được xây dựng, nhưng đó là một
lệnh của người bảo trì được chạy thủ công: không có gì tự động chạy lệnh này khi nộp bài và không có gì
lập lịch cho nó, vì vậy hiện tại mọi hàng xuất hiện và duy trì ở trạng thái tự đo kiểm
([Quy tắc nộp bài](/docs/network/leaderboard/rules#verification-tiers)). Hãy đọc
huy hiệu tin cậy trên mỗi hàng: **"tự báo cáo" mang đúng ý nghĩa đó**, và đó là
mặc định.

## 3. Việc xác thực bởi người bản xứ trong cộng đồng vẫn chưa diễn ra

Giải thưởng được đề xuất yêu cầu **tỷ lệ chấp nhận ≥ 70% từ người nói song ngữ** (hiện chưa mở giải thưởng nào). Cổng kiểm duyệt đó đã được
quy định cụ thể, và các công cụ để vận hành nó đang được xây dựng — nhưng **chưa có đánh giá nào
từ người nói trong cộng đồng được thực hiện**, và **chưa có điểm số nào trên trang web này vượt qua
cổng người nói**. chrF++ và mọi con số tự động khác chỉ là các tín hiệu máy tính,
không phải phán quyết của cộng đồng, đó là lý do tại sao không có điểm số nào ở đây gắn nhãn chất lượng.

## 4. Sandbox đánh giá và nghi thức tạo khóa đã tồn tại; chưa có người giám hộ nào sử dụng chúng

Chúng tôi lấy ngữ liệu từ nguồn của chúng và ghim mã SHA, còn các phần dữ liệu tách riêng để giữ lại đều được
niêm phong. Khi một cộng đồng nắm giữ một tập kiểm thử bí mật, một phương pháp có thể được
chấm điểm đối với tập đó mà không bao giờ rời khỏi tay họ — và quy trình đánh giá đó
hiện có **hai luồng**. Luồng
được ưu tiên, dành cho các mô hình neural tiêu chuẩn, là **khai báo**: người tham gia
chỉ nộp dữ liệu — trọng số safetensors + một tokenizer khai báo + một tệp cấu hình —
và ban tổ chức sẽ chạy dữ liệu đó trong công cụ suy luận đáng tin cậy của riêng họ
(`trust_remote_code=False`, ngoại tuyến; chấp nhận cấu trúc linh hoạt vì
tính an toàn nằm ở định dạng không chứa mã thực thi, chứ không phải ở tên cấu trúc). Hoàn toàn không có mã của người tham gia nào
được chạy, vì vậy không có gì cần phải cô lập; việc kiểm tra an toàn là một bước xác thực
định dạng có thể quyết định được (đây có phải là safetensors chứ không phải pickle? không có `trust_remote_code`?), chứ
không phải là một nỗ lực nhằm chứng minh mã tùy ý là an toàn. Đối với các phương pháp thực sự là mã thực thi
(các pipeline, mô hình lai có LLM hỗ trợ), phương án dự phòng là **hộp cát**
cách ly mạng (kiểm tra tĩnh, container `--network=none`, chỉ cho phép xuất điểm số, tùy chọn truyền tệp
qua khoảng cách vật lý thực sự). Vì hộp cát không có mạng, một
phương pháp chỉ chạy được ở đó khi mọi mô hình mà nó gọi đều nằm bên trong gói của nó: một
mô hình lai có LLM hỗ trợ phải gửi kèm LLM của mình dưới dạng trọng số mở, vì không thể
truy cập vào API LLM được lưu trữ trên máy chủ. Hộp cát chứa mã không đáng tin cậy
thay vì từ chối chạy mã đó, vì vậy đây thực sự là luồng yếu hơn — bảo đảm chịu tải
của nó là `--network=none` (quét tĩnh theo kinh nghiệm không thể kiểm duyệt một mô hình
nhị phân), và việc tăng cường bảo mật sâu hơn (seccomp, microVM) đã được hoãn lại. Xem
[tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest)
để biết chính xác những gì đã hoạt động và những gì chưa. **Nghi thức khóa** của nút ngoại tuyến
**đã được xây dựng** — khóa của tập dữ liệu được chia theo cơ chế M-trên-N và chỉ được ghép lại trong bộ nhớ trong
quá trình chạy được biểu quyết cho phép — nhưng nó chưa từng được sử dụng với một người giám hộ thực sự, và
các phần chia sẻ chỉ là các tệp thông thường trong phiên bản đầu tiên này. Những gì **chưa** được xây dựng: ký
ngưỡng (điểm số được ký bởi một khóa nút đơn lẻ) và chứng thực phần cứng (bản kê
điểm số chỉ được ký bằng phần mềm). Chưa có người giám hộ khóa cộng đồng nào được
bổ nhiệm, vì vậy việc đánh giá **giải thưởng** theo tiêu chuẩn vàng vẫn tạm đóng cho đến khi
có người giám hộ và sự đồng thuận của cộng đồng.

## 5. Hiện tại các khóa do ban tổ chức nắm giữ; chưa có người giám hộ cộng đồng nào được bổ nhiệm {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Hiện tại, các khóa của tập dữ liệu đã niêm phong do ban tổ chức nắm giữ** — bất kỳ ai đã niêm phong nó,
trên chính máy của họ. **Champollion không nắm giữ bất kỳ phần khóa nào.** *Cơ chế* giám hộ
cho nhiều hơn một người nắm giữ đã được xây dựng: nghi thức khóa M-trên-N của nút ngoại tuyến
chia khóa của tập dữ liệu giữa các người giám hộ. Cơ chế này vẫn chưa được chạy với các người giám hộ
thực sự. Người giám hộ do chính các cộng đồng tự chọn, và hiện chưa có ai
được bổ nhiệm: **người giám hộ khóa cộng đồng — hiện chưa có ai được bổ nhiệm.** Giám hộ
không phải là sự đồng thuận: quy trình xây dựng sự đồng thuận mang tính quan hệ với cộng đồng là một lộ trình riêng, chậm hơn và
quan trọng hơn.

## 6. Chúng tôi đo lường các phương pháp trên bộ chuẩn kiểm thử; chúng tôi không chấm điểm từng bản dịch riêng lẻ {#system-vs-output}

Có hai điều khác nhau cùng được gọi là "dịch máy đáng tin cậy". Chúng tôi thực hiện một trong
hai điều đó.

**Cấp độ hệ thống — những gì chúng tôi làm.** Cho một cặp ngôn ngữ, một tập kiểm thử và một phương pháp:
phương pháp đó đạt điểm số như thế nào, theo chỉ số nào, trên miền nào, trong
luồng nhiễm tạp (contamination lane) nào, ở bậc tin cậy nào? Đó là một khẳng định về một *phương pháp trên một
bộ chuẩn kiểm thử (benchmark)*, cộng với khẳng định về việc ai là người đặt ra tiêu chuẩn. Các quy tắc chấm điểm
được công bố, các kho ngữ liệu được ghim, và đối với một bộ chuẩn kiểm thử có chủ quyền, cộng đồng
sở hữu tập kiểm thử sẽ quyết định những gì đạt chuẩn. Bảng xếp hạng, bản đồ, các thẻ
lượt chạy và `mt-eval` đều là điều này, và chỉ điều này mà thôi.

**Cấp độ đầu ra — những gì chúng tôi không làm.** Cho một câu nguồn và một
bản dịch của nó: khả năng *bản dịch đó* là đúng đắn cao đến mức nào? Trong MT và NLP,
đó là ước lượng chất lượng (quality estimation) và định lượng độ bất định (uncertainty quantification), và nó là một lĩnh vực nghiên cứu
riêng biệt. Chúng tôi **không công bố độ tin cậy theo từng phân đoạn cho bất kỳ bản dịch nào**,
và không có nội dung nào ở đây là xác suất đã hiệu chuẩn rằng một đầu ra cụ thể là chính xác. Một
hàng có điểm số cao không phải là sự bảo đảm cho câu tiếp theo mà phương pháp đó tạo ra.

Điều ngược lại là một sai lầm dễ mắc phải hơn, và nó cũng ràng buộc chúng tôi. Khi một bề mặt giao diện ở đây cho biết
không có phương pháp nào trên một cặp ngôn ngữ đạt điểm đủ tốt để triển khai — như
[dịch vụ dịch thuật bởi con người](/human-services) đã nêu — đó là một nhận định về
các phương pháp đã đo lường trên các tập kiểm thử đã đo lường. Đó là một lý do xác đáng để không phát hành
đầu ra của máy cho cặp ngôn ngữ đó. Đó không phải là một phán quyết về bất kỳ câu cụ thể nào.

**Ước lượng chất lượng là một vị trí còn mở, không phải là một lỗ hổng bị che giấu.** Bộ công cụ đánh giá đã
tính toán một điểm số nơ-ron không cần bản dịch tham chiếu, AfriCOMET-QE (`qe_score`), làm
tín hiệu về tính thỏa đáng cho các lượt chạy không có tham chiếu chuẩn vàng. Điểm số này được báo cáo dưới dạng một
con số **cấp độ kho ngữ liệu** trong luồng nơ-ron riêng biệt, được bộ xác minh tính toán lại độc lập, và không bao giờ xuất hiện trong chỉ số chrF++ tiêu đề
([Quy cách chấm điểm](/docs/network/specifications/scoring#how-runs-are-scored)). Các chỉ số là
các plugin ([Quy cách plugin](/docs/reference/plugin-spec)), vì vậy một
chỉ số QE cấp phân đoạn là điều mà bộ công cụ này có thể tiếp nhận. Cho đến khi một chỉ số như vậy được tích hợp,
công bố và được siêu đánh giá (meta-evaluated) cho từng ngôn ngữ theo cách các chỉ số dựa trên tham chiếu
được thực hiện ([Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability)), chúng tôi
sẽ không đưa ra nhận định nào về các đầu ra riêng lẻ.

---

Các giới hạn này sẽ thay đổi khi công việc tiến triển. Khi một trong số chúng thay đổi, trang này
sẽ thay đổi theo — và sự thay đổi đó sẽ hiển thị trong lịch sử trang, chứ không bị âm thầm loại bỏ.
