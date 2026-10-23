---
title: "Quy tắc đo lường"
slug: /agents/measurement
description: "Cách Champollion đánh giá một trình dịch và cách một tác tử báo cáo kết quả: tiêu chuẩn chấm điểm (chrF++ cấp ngữ liệu với khoảng tin cậy bootstrap 95%), điểm kiểm định, tập phát triển so với tập kiểm thử, kết quả dự đoán, bản dịch gần như sao chép, ngưỡng sàn từ điển, quy tắc đánh giá bắt cặp cùng ngưỡng tối thiểu 50 câu đi kèm, danh sách mong muốn định hướng điều gì, điểm số từ người bản ngữ, so sánh mù giữa hai mô hình, nhận định của người bản ngữ, các hàng được hiển thị lại (độ đồng thuận, sai số ngẫu nhiên, độ trôi), và cách diễn đạt một con số."
---

# Quy tắc đo lường

Hệ thống ray cam kết cộng đồng sẽ **biết** mô hình hoạt động tốt đến mức nào trên các câu của chính họ — chứ không phải cam kết rằng nó tốt. Lời hứa đó dựa trên một vài quy tắc, hầu hết đều được thực thi nghiêm ngặt. Trang này nêu rõ các quy tắc đó, và kết thúc bằng cách diễn đạt một con số.

## Tiêu chuẩn chấm điểm (standard/1)

Mỗi lượt chạy mới đều được chấm điểm theo cùng một cách (`arena/mt_eval_harness/scoring.py`):

- **Chỉ số tiêu đề:** **chrF++** ở cấp độ ngữ liệu (sacreBLEU chrF với bậc từ 2), từ 0 đến 100 — càng cao nghĩa là càng gần với các bản dịch tham chiếu — cùng với **khoảng tin cậy bootstrap 95%** và chữ ký sacreBLEU của nó. Được ghi là `chrF++ 47.5 [45.9, 49.0]`.
- **Các phân đoạn nào được tính:** một quy tắc duy nhất cho chỉ số tiêu đề, khoảng tin cậy của nó và mọi phép so sánh. Phân đoạn dịch thất bại được tính là kết quả rỗng — không bao giờ bị loại bỏ, không bao giờ được chấm điểm như một văn bản giữ chỗ; phân đoạn không có bản dịch tham chiếu sẽ bị loại trừ ở mọi nơi.
- **Khoảng tin cậy:** khoảng tin cậy của chính chỉ số tiêu đề — bootstrap theo phân vị trên các phân đoạn đó, 1.000 lần lấy mẫu lại, seed 12345, α 0.05. Dưới 30 phân đoạn, công cụ sẽ cảnh báo rằng khoảng tin cậy có thể có độ bao phủ kém; nếu ít hơn 2 phân đoạn thì không có khoảng tin cậy.
- **Đặt cạnh nhau, không bao giờ trộn lẫn:** BLEU, spBLEU, TER, và COMET khi được tính toán, mỗi chỉ số đi kèm chữ ký hoặc model ID của nó.
- **Chỉ số chẩn đoán, tách biệt:** khớp chính xác, khớp tương đương, FST chấp nhận, độ chính xác hình thái học, bộ xác thực ngữ nghĩa, chuyển mã ngôn ngữ, ảo giác, tuân thủ thuật ngữ, phong cách viết. Chúng không bao giờ đi vào chỉ số tiêu đề và không bao giờ dùng để xếp hạng.
- **"Tốt hơn" là một kiểm định ý nghĩa thống kê theo cặp** trên chrF++, không bao giờ là hai con số so sánh bằng mắt.
- **Không có nhãn chất lượng.** Chỉ có đánh giá của con người mới chứng nhận chất lượng.

**Đã ngừng sử dụng:** điểm tổng hợp có trọng số và các nhãn bậc chất lượng. Thẻ lượt chạy standard/1 mang `composite: null` và `quality_tier: null`.
**Lưu ý.** Không bao giờ trình bày, tính toán hoặc trích dẫn điểm tổng hợp hay bậc chất lượng, ngay cả từ một thẻ cũ.

**Cảnh báo điểm số** là các chẩn đoán được ghi bên cạnh điểm số, không bao giờ là sự thay đổi đối với điểm số: `source_copy` (một nửa hoặc nhiều hơn các đầu ra sao chép nguồn), `length_inflation` và `length_deflation` (đầu ra dài hơn gấp đôi, hoặc ngắn hơn một nửa độ dài tham chiếu — tính trung bình, hoặc trong một phần tư hay nhiều hơn các phân đoạn), `near_constant_output` (một đầu ra lặp lại qua nhiều nguồn), và `train_test_near_twin` (các dòng tập kiểm thử có bản sinh đôi trong tập huấn luyện — mức nghiêm trọng khi một nửa hoặc nhiều hơn mắc phải). **Lưu ý.** Luôn chuyển tiếp từng cảnh báo cùng với điểm số, từng chữ một.

## Đo lường có cổng kiểm soát

Khi một lượt chạy có một chuỗi cổng kiểm soát ([phương thức và cổng kiểm soát](/docs/agents/methods#gate-chains)),
**những gì được đo lường là những gì được phát hành**:

- chỉ số tiêu đề chrF++ chấm điểm đầu ra đã qua cổng kiểm soát;
- điểm chrF++ chưa qua cổng kiểm soát, cùng khoảng tin cậy của nó, nằm ngay bên cạnh (`overall.gates.ungated`);
- **tỷ lệ từ chối** — số phân đoạn cổng kiểm soát từ chối ÷ số phân đoạn được đánh giá — là một con số riêng biệt, với số lượng theo từng cổng và theo những gì được phát hành (`shipped_from`: phương thức, nguồn, phương án dự phòng, không có gì);
- **dấu vân tay** của chuỗi (sha256 của JSON chuẩn tắc) đi kèm với báo cáo và bất kỳ lượt chạy nào được công bố.

**Khóa chặt.** Không có phương án dự phòng trong đo lường: `mt-eval run` và `mt-eval test` từ chối chuỗi có các cổng chuyển phân đoạn bị từ chối sang phương án dự phòng, trước khi bất kỳ điều gì được dịch hoặc tiêu tốn chi phí.

**Lưu ý.** Hãy báo cáo điểm số đã qua cổng kiểm soát cùng với điểm số chưa qua cổng và tỷ lệ từ chối. Chỉ riêng điểm số đã qua cổng kiểm soát sẽ che giấu những gì mà các cổng đã loại bỏ.

## Các tập dữ liệu và mục đích của từng tập

| Vai trò | Dùng cho | Đọc |
|---|---|---|
| `train` | Học | Không bao giờ tính điểm như một kết quả |
| `dev` (luyện tập) | Chọn checkpoint; đánh giá các vòng cải thiện (từ 50 câu); ngưỡng sàn từ điển | Tự do |
| `test` | Các cột mốc: kiểm thử mô hình, đối chiếu với dự đoán của cộng đồng | Mỗi lần đọc tính điểm đều cần đăng ký trước (forge); mọi lần đọc đều được ghi nhật ký |
| `sealed` | Bài kiểm thử mà không ai ngoài những người nắm giữ nhìn thấy | Một lần |

**Trong nmt-forge** (sổ đăng ký, `.forge/eval-registry.json`; sổ cái):

- **Khóa chặt.** Mọi lần đọc một tập dữ liệu đã đăng ký đều được ghi vào sổ cái chuỗi băm kèm theo mục đích (`score`, `dev-selection`, `audit`, `inspect`).
- **Khóa chặt.** Việc chấm điểm một tập kiểm thử yêu cầu phải có bản đăng ký trước hợp lệ cho nội dung hiện tại của nó.
- **Khóa chặt.** Tập niêm phong chỉ được chấm điểm một lần. Lần chấm điểm thứ hai sẽ bị từ chối (`sealed set '<name>' has already been spent`); a single `mt-eval` đọc tệp niêm phong cũng làm tiêu hao tệp đó. `--override-respend '<reason>'` (trên `nmt-forge score` và `nmt-forge compare`) được ghi vào sổ cái. `export` từ chối tiêu hao lại và nêu tên `--no-eval`.
- **Khóa chặt.** Rào chắn tập phát triển (dev fence): quá trình huấn luyện cần một tập `dev` đã đăng ký; các dòng dev không được trùng khớp chính xác nguồn hoặc đích với tập kiểm thử hay tập niêm phong; không dòng huấn luyện nào được phép là dòng dev.

**Trong mt-eval:**

- **Lưu ý.** `mt-eval run` và `mt-eval compare` chấm điểm tệp kiểm thử hoặc tệp niêm phong mà không cần bất kỳ bản đăng ký trước nào và không bao giờ từ chối theo số lần đọc. `mt-eval run` chỉ nối thêm một dòng vào nhật ký đọc của tệp (`<file>.reads.jsonl`) khi forge đã tạo nhật ký; `compare` và `test` không ghi lại gì. Không bao giờ chấm điểm tập kiểm thử bằng mt-eval trước khi dự đoán của cộng đồng được ghi lại.

## Dự đoán

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` và `--rationale`: một dự đoán văn bản tự do về chrF++, bằng chính lời của cộng đồng. Phán quyết về nó thuộc về cộng đồng: `nmt-forge prereg verdict <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: một mảng JSON; mỗi dự đoán nêu một `metric` và một `rationale`, cùng với `direction` (`increase`, `decrease`, `no_change`) kèm `baseline_score` (và `margin` tùy chọn) — do công cụ đánh giá — hoặc `expect` văn bản tự do.
- **Khóa chặt.** Dự đoán được viết sau bất kỳ lần đọc để chấm điểm nào đối với tập dữ liệu (bởi forge hoặc bởi `mt-eval run`) đều bị từ chối: *"eval set '…' was already read for scoring (N time(s): …) before this preregistration"*. `--allow-after-reads` cho phép bỏ qua, và mọi báo cáo, tệp xuất cùng trạng thái đều nêu rõ điều đó.
- **Lưu ý.** Dự đoán là của cộng đồng, được viết trước khi có bất kỳ điểm số nào, không bao giờ được bạn diễn đạt lại hay thu hẹp. Câu hỏi của hệ thống ray không gợi ý con số nào (*"No number is suggested here, so the guess stays theirs"*); bạn cũng không được đưa ra con số nào.

## Bản sao gần giống

`nmt-forge leak-audit` so sánh từng cặp huấn luyện với mọi tập dev, tập kiểm thử và tập niêm phong đã đăng ký:

| Tìm thấy | Quy tắc | Điều gì xảy ra |
|---|---|---|
| Cùng một tệp | sha256 | Bị loại bỏ |
| Bản sao chính xác | Cùng nguồn hoặc cùng đích sau khi chuẩn hóa | Bị loại bỏ |
| Bản sao gần giống | Tập hợp từ đích trùng lặp ≥ 0,6 (Jaccard) khi tập này chứa tập kia, hoặc ≥ 0,9 | Bị loại bỏ |
| Mẫu câu tương đồng | Cùng khung câu, câu trả lời khác nhau | **Được giữ lại** để học hỏi, và được đếm, để có thể đọc điểm số khi có và không có các dòng kiểm thử đó |
| Chỉ khớp nguồn | Cùng câu gợi ý, câu trả lời khác nhau | Được giữ lại, được báo cáo |

Các câu ngắn được so sánh bằng trigram ký tự; các câu rất ngắn chỉ so sánh theo độ khớp chính xác. Một dòng kiểm thử là một **bản sinh đôi gần** khi một dòng huấn luyện giống hệt hoặc trùng lặp với nó ≥ 0,6 ở một trong hai phía; khi một nửa hoặc nhiều hơn các dòng kiểm thử có bản sinh đôi, điểm số chủ yếu phản ánh khả năng ghi nhớ chứ không phải dịch thuật, và cảnh báo ở mức nghiêm trọng. `--clean-to` ghi lại tệp đã sàng lọc; `--drop-test-twins` cũng loại bỏ các dòng huấn luyện sinh đôi với dòng kiểm thử, để có điểm số không chứa bản sinh đôi.

Lần phân chia tập dev đầu tiên của hệ thống ray áp dụng cùng ngưỡng đó: `--near-dupe 0.6` trên `nmt-forge split` giữ các dòng có từ ngữ trùng lặp ≥ 0,6 ở một phía của ranh giới dev/huấn luyện, nhờ đó điểm dev đầu tiên không chứa bộ nhớ bản sao gần giống mà đợt sàng lọc ở vòng sau sẽ từ chối. `--max-group` giới hạn một nhóm bản sao gần giống ở mức một nửa kích thước tập dev cộng một, để tệp được viết từ các mẫu câu vẫn có thể phân chia được.

**Lưu ý.** Chỉ nói "kiểm toán rò rỉ phát hiện …" từ `true_now` hoặc đầu ra của chính đợt kiểm toán, tuyệt đối không tự ý nói "tập kiểm thử sạch sẽ".

## Mốc sàn từ điển

`nmt-forge floor <word lists>` dịch tập dev từng từ một bằng từ điển (cụm từ dài nhất trước) và chấm điểm bằng cùng đoạn mã như điểm dev của một lượt chạy: chrF++ cùng khoảng tin cậy 95% của nó. Nó chạy trên máy tính này, không bao giờ đọc tập kiểm thử, và chỉ ghi lại tên từ điển, mã băm cùng số lượng mục từ, số từ nguồn mà chúng tiếp cận được, và điểm số. Một lượt chạy **vượt qua mốc sàn** chỉ khi giới hạn dưới của khoảng tin cậy tập dev của nó nằm trên giới hạn trên của mốc sàn; `nmt-forge status` cảnh báo về lượt chạy không đạt điều này.

## So sánh hai mô hình

**Một vòng cải tiến** (`nmt-forge compare-runs <in-use> <new>`): bản dịch của cả hai mô hình trên **cùng các câu dev**, được ghép cặp theo từng dòng; một kiểm định ngẫu nhiên hóa xấp xỉ theo cặp (1.000 lần thử) và khoảng tin cậy bootstrap 95% cho sự khác biệt.

| Phán quyết | Quy tắc |
|---|---|
| **too-few** | ít hơn 50 câu phát triển, bất kể điểm số ra sao — mô hình đang dùng được giữ nguyên, và điểm chấm mù của người nói sẽ quyết định (bên dưới) |
| **better** | từ 50 câu trở lên, p < 0.05 **và** cận dưới của khoảng lớn hơn 0 — mô hình mới được đề xuất để sử dụng; mô hình chỉ được đưa vào dùng khi cộng đồng đồng ý |
| **worse** | từ 50 câu trở lên, p < 0.05 và cận trên của khoảng nhỏ hơn 0 |
| **no-change** | bất kỳ trường hợp nào khác — mô hình đang dùng được giữ nguyên |

**Tại sao lại là 50.** Được đo trên các kết quả đầu ra ByT5-small của ngôn ngữ kiểm thử nhân tạo, 100 tập luyện tập ngẫu nhiên cho mỗi kích cỡ, theo quy tắc này: ở 23 câu dev, nó kết luận hai mô hình gần như ngang nhau (chênh lệch 0.7 chrF++ trên 500 câu) là khác nhau 9 lần trong 100 lần, và chỉ kết luận mức tăng thực +5.9 chrF++ là **better** 21 lần trong 100 lần; ở 50 câu, tỷ lệ này lần lượt là 4 lần và 96 lần trong 100 lần. Chênh lệch nhỏ nhất được ghi nhận 8 lần trong 10 lần là 8.1 điểm chrF++ ở 23 câu, 5.8 ở 50 câu, 4.0 ở 100 câu và 2.8 ở 200 câu. Vì vậy, bước phân chia đầu tiên của rails dành riêng ít nhất 50 câu dev khi có từ 200 cặp trở lên — một phần mười số cặp đã qua sàng lọc, tối đa 500; khi có dưới 200 cặp, con số này là một phần tư, tức dưới 50 câu — và các trang tính duyệt sẽ bổ sung cho tập hợp này bằng các dòng luyện tập: cứ hai dòng chọn một dòng khi còn dưới 50, và cứ bốn dòng chọn một dòng cho đến khi đạt 200.

Mỗi phán quyết cũng nêu rõ sự khác biệt nhỏ nhất mà tập dev của nó có thể cho thấy một cách đáng tin cậy (8 trên 10 lần): độ rộng của khoảng tin cậy × (1,96 + 0,84) ÷ (2 × 1,96). Khi con số đó lớn hơn 3 điểm chrF++, "no-change" là giới hạn của tập dev, chứ không phải bằng chứng cho thấy vòng cải tiến không mang lại kết quả gì. Tập dev cũng là cơ sở chọn checkpoint của lượt chạy mới, điều này tạo chút ưu ái cho mô hình mới — **hãy nêu rõ điều này** khi bạn truyền đạt phán quyết.

Sự ưu tiên khi đánh giá mù của người bản ngữ dành cho mô hình mới hơn (bên dưới) khiến forge chỉ đề xuất đưa mô hình đó vào sử dụng sau phán quyết **too-few** hoặc **no-change** — không bao giờ sau **worse** — và cộng đồng phải đồng ý trước (`improve-promote`, chế độ `confirm`). Sự ưu tiên khi đánh giá mù dành cho mô hình đã bị thay thế sau một lần thăng cấp sẽ không bao giờ đưa nó trở lại: hành động trong báo cáo vòng sẽ hỏi ý kiến cộng đồng.

**Hai lượt chạy bất kỳ** (`mt-eval compare <report> <report> --significance`):
ngẫu nhiên hóa xấp xỉ theo mặc định (`--method paired_bootstrap` cho phương pháp còn lại), 1.000 lần thử (`--n-bootstrap`), α 0,05, seed 12345, trên các mục mà các báo cáo chia sẻ theo ID (cảnh báo nếu dưới 10). chrF++ trước, sau đó đến các chỉ số phụ. Mọi cặp lượt chạy đều được kiểm định; không có hiệu chỉnh kiểm định bội, và đầu ra nêu rõ điều này.

## Cơ sở điều hướng của danh sách mong muốn

`nmt-forge analyze` phân tích điểm chrF++ trên tập dev của một lượt chạy theo loại câu (với ít nhất 5 câu dev cho mỗi loại). Một loại câu được coi là **yếu nhất** — và tính trọng số cho danh sách mong muốn — chỉ khi khoảng tin cậy 95% về mức độ mà các câu của nó bị chấm thấp hơn phần còn lại hoàn toàn nằm trên 0 (khoảng tin cậy Welch trên chrF++ cấp độ câu). Điểm số thấp hơn do ngẫu nhiên sẽ được báo cáo như vậy (*"… could be chance — the wishlist does not steer by it"*) và không bao giờ tính trọng số cho bảng tính.

Phần "Các từ chưa từng thấy" yêu cầu hai hoặc ba câu cho mỗi từ, mỗi câu diễn đạt một ý khác nhau, chứ không phải một câu: trên ngôn ngữ thử nghiệm nhân tạo, một từ xuất hiện một lần trong huấn luyện cho kết quả đúng 27–29% số lần và một từ xuất hiện 2–4 lần đạt 63–95%; và ở mức 3.200 câu huấn luyện, ByT5-small được huấn luyện trên các câu chọn lọc có nhiều từ mới nhất đạt 39,4% trong số 500 câu giữ lại đúng về mặt ý nghĩa, so với 53,4% đối với các câu giao tiếp hàng ngày, trong khi tốn thêm một chút thời gian của người bản ngữ (khoảng 57 giờ so với 54 giờ).

## Đánh giá của người bản ngữ

Trong mỗi vòng cải thiện, người nói chấm bản nháp của mô hình cho các câu mới
`Y`, `N` hoặc `?`. Tỷ lệ đúng là `Y ÷ (Y + N)` (bỏ qua `?`, các hàng chưa chấm, hàng luyện tập
và các hàng hiển thị lại), cùng khoảng tin cậy Wilson 95%. Mức tăng giữa các vòng chỉ được tính là
**tiến bộ** khi khoảng tin cậy của vòng cuối nằm hoàn toàn phía trên
vòng đầu, một mô hình của vòng đó đã được đưa vào sử dụng ở giữa chừng — do cộng đồng lựa chọn
(các bản ghi `export` và `choose` của forge), dù là sau kết luận **tốt hơn**,
dựa trên kết quả chấm mù của người nói hay theo lựa chọn riêng của họ; chỉ riêng kết luận **tốt hơn**
thôi thì không được tính — **và** các lượt kiểm tra mù của người nói đối với từng lần nâng cấp
(bên dưới), được gộp lại qua các vòng ở giữa chừng, chấm các mô hình mới đúng
nhiều hơn rõ rệt so với những mô hình mà chúng thay thế (|z| > 1.96).
Đây là những câu mà chưa mô hình nào từng thấy: thước đo quan trọng nhất, và là
thước đo cần ưu tiên hàng đầu ([coaching](/docs/agents/coaching)).

**Hai mô hình, chấm mù.** `champollion improve sheet` để một mô hình thứ hai tạo bản nháp cho
một nửa ngẫu nhiên (theo seed) của các hàng được nháp (`nmt-forge draft-newer`), chưa chấm:
mô hình mới nhất vừa được huấn luyện khi nó không phải là mô hình đang dùng — như sau một vòng
có kết luận là too-few, no-change hoặc worse — hoặc, vào lần truy cập sau khi
nâng cấp, là mô hình mà mô hình đang dùng đã thay thế. Hàng nào thuộc về mô hình nào được lưu
bên cạnh bảng tính trong `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` hoặc `replaced`, cặp huấn luyện của mỗi mô hình `in_use_pairs`
và `other_pairs`, `other_rows`, và `repeat_rows`, bên dưới).
`champollion improve marks` sau đó đếm riêng hai mô hình, các hàng hiển thị
lại đều được loại khỏi toàn bộ phần này:

- tỷ lệ đúng ở trên — thước đo tiến độ — chỉ tính các dòng của mô hình đang dùng;
- mọi bản nháp được đánh dấu đúng và mọi bản sửa đều trở thành cặp huấn luyện, bất kể mô hình nào đã nháp;
- một kiểm định hai tỷ lệ (gộp, hai phía ở mức 5%: |z| > 1.96) cho biết người bản ngữ đánh dấu mô hình nào đúng thường xuyên hơn, nếu có sự khác biệt: `clear` là `newer`
  hoặc `replaced` (mô hình còn lại), `in-use` hoặc `neither`, được ghi lại trong
  `marks.json` (`blind`) cùng cả hai số đếm (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` và số cặp huấn luyện của cả hai; phép so sánh với mô hình mới hơn
  cũng lưu giữ `newer`, `newer_right`, `newer_judged` và `newer_share`. Khi
  một trong hai mô hình không có dòng nào được đánh dấu `Y` hoặc `N`, `clear` là `null` và văn bản
  sẽ thông báo *"quá ít dòng của một mô hình được đánh giá để có thể so sánh"*;
- đối với mô hình mới hơn, khi mỗi mô hình có ít nhất một bản nháp được đánh giá, các số đếm
  sẽ được chuyển tới forge (`nmt-forge speaker-verdict`), công cụ này sẽ chạy cùng kiểm định đó và
  ghi lại `clear` (`newer`, `in-use` hoặc `neither`) vào sổ cái của nó
  (`improve-speaker`). Sau phán quyết **too-few** hoặc **no-change** trong lần chạy đó,
  `clear: newer` sẽ khiến forge đề xuất đưa mô hình mới hơn vào sử dụng;
  `champollion improve marks` sau đó sẽ in ra *"forge đã ghi nhận: đề xuất đưa mô hình mới hơn vào sử dụng (cộng đồng đồng ý trước)"*
  ([huấn luyện](/docs/agents/training#the-improve-rounds)).

Các dòng được phân bổ ngẫu nhiên, trên một bảng tính, do cùng một người bản ngữ đánh giá, trên các câu mới của chính gia đình — do đó một khác biệt rõ ràng sẽ phản ánh điều mà tập dev có thể quá nhỏ để thể hiện, và sự thay đổi trong mức độ khắt khe khi chấm điểm của người bản ngữ sẽ ảnh hưởng như nhau đến cả hai mô hình. **Lưu ý.** Không bao giờ cho người bản ngữ biết dòng nào đến từ mô hình nào trước khi các đánh giá của họ được ghi nhận.

**Các hàng hiển thị lại.** Từ vòng 2, `champollion improve sheet` đưa trở lại một
hàng cho mỗi 10 câu mới trên bảng tính (`REPEAT_EVERY`; làm tròn xuống,
và ít hơn khi có ít hàng đủ điều kiện hơn): một bản nháp mà người nói đã chấm `Y` hoặc `N` trên
bảng tính trước đó, cùng bản nháp trước đó của nó, chưa chấm, tại một vị trí ngẫu nhiên theo seed —
không bao giờ là hàng luyện tập, hàng vốn đã là hàng lặp lại, hàng đã từng được hiển thị
lại, hay câu đã có trên bảng tính này. Dòng đầu tiên của bảng tính, phía trên
tiêu đề cột, ghi: *"Một vài hàng bên dưới được cố ý đưa lại từ các bảng tính trước.
Xin hãy chấm mới, như thể câu mới: mức độ trùng khớp giữa các lần chấm cho biết chúng đáng tin cậy đến đâu."* Bảng tính không bao giờ nói rõ là hàng nào; `sheet-key.json` lưu chúng dưới dạng
`repeat_rows` (`row`, `from_round`, `from_row`, và `mark`, kết quả chấm
trước đó). Chúng làm người nói mất khoảng 10 giây cho mỗi hàng.

`improve marks` chỉ đánh giá từng hàng so với chính kết quả chấm trước đó của người nói: một
hàng lặp lại không bao giờ được tính vào tỷ lệ của vòng, không bao giờ thành cặp huấn luyện lần nữa,
không bao giờ nằm trong phép so sánh mù. `marks.json` nhận thêm `repeats`: `shown`,
`judged` (lần này được chấm `Y` hoặc `N`; `?` hoặc để trống thì được hiển thị, không đánh giá),
`agreed`, `agreement` (trùng khớp ÷ được đánh giá), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (các hàng được đánh giá từng được chấm `N`) và
`rounds_apart_wrong_before`. Lệnh này in ra: *"Các hàng hiển thị lại: người nói
đã chấm A trên J hàng giống như trước đây (P%) — W câu từng sai nay đúng, R câu từng
đúng nay sai. Không tính vào tỷ lệ của vòng này, và không huấn luyện
lại."*

Khi gộp qua các vòng, một khi có từ 10 hàng trở lên được đánh giá (`MIN_REPEATS`), báo cáo
vòng sẽ đọc được hai điều từ chúng:

- **Sai số ngẫu nhiên** `e`, từ các lần đổi chiều chia đều theo cả hai hướng. Hai lần chấm của
  cùng một bản nháp ngẫu nhiên không đồng nhất 2e(1 − e) số lần, mỗi hướng một nửa; với
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. Sai số kéo mọi tỷ lệ về phía 50%: một bản nháp thực sự
  đúng với tỷ lệ p sẽ được chấm là đúng trong e + p(1 − 2e) số lần, do đó
  ở mức e = 10%, "thực sự đúng 80%" sẽ đọc thành khoảng 74%.
- **Độ trôi**: các lần đổi chiều theo một hướng vượt quá mức chia đều. Báo cáo cảnh báo rằng
  việc chấm điểm có thể đang trở nên dễ dãi hơn khi số lần đổi chiều từ từng-sai-thành-đúng vượt trội rõ rệt
  so với chiều ngược lại: từ 6 lần đổi chiều trở lên và kiểm định dấu,
  (`wrong_to_right` − flips ÷ 2) ÷ √(flips ÷ 4) > 1.96.

Dòng kiểm tra của nó: *"Người nói đã chấm A trên J hàng hiển thị lại giống như trước
đây (P%): khoảng E% số lần chấm đổi chiều ngẫu nhiên, điều này kéo mọi
tỷ lệ chấm đúng về mức 50% — dự phóng đã tính đến điều này."* — và về
độ trôi, *"Và W bản nháp từng chấm sai nay được chấm đúng, so với R bản nháp theo chiều
ngược lại: việc chấm có thể đang trở nên dễ dãi hơn, điều mà mức tăng tỷ lệ sẽ
không thể hiện."* Dưới 10 hàng được đánh giá: *"Đã đánh giá N hàng hiển thị lại cho đến nay — sai số
chấm của chính người nói được ước tính từ 10 hàng."*

**Đích đến của các vòng.** Dự phóng của báo cáo vòng chỉ được lập từ
tiến độ thực sự (ở trên) khi tỷ lệ đúng còn dưới 80%. Đường cong học tập
tăng theo các bước xấp xỉ đều nhau về log-odds cho mỗi lần nhân đôi dữ liệu huấn luyện, do đó
nó đọc bước này từ chính các lượt kiểm tra mù sau các lần nâng cấp: tổng của
`logit(in_use_share) − logit(other_share)` chia cho tổng của
`log2(in_use_pairs ÷ other_pairs)` (tỷ lệ được giới hạn trong khoảng 1–99%), với khoảng
95% từ phương sai của mỗi tỷ lệ, khoảng 1 ÷ (n·p·(1 − p)) cho n bản nháp
được đánh giá. Từ các cặp huấn luyện của mô hình đang dùng, nó cho biết cần thêm bao nhiêu nữa để đạt
80% chấm đúng — con số ước tính — và số giờ của người nói với mức 70 giây mỗi
câu. Khoảng giá trị bao quát khoảng tin cậy của bước tăng (không có giới hạn trên vượt quá sáu lần
nhân đôi nữa) và, khi đã đánh giá được 10 hàng hiển thị lại, vị trí mà "thực sự đúng 80%"
có thể rơi vào trên kết quả chấm của người nói này: e + 0.8(1 − 2e) + 0.2 × K, tối đa
97%, trong đó K là độ trôi mỗi vòng (các lần đổi chiều vượt quá mức chia đều, chia cho
khoảng cách số vòng giữa hai lần chấm của các hàng từng sai) nhân với số vòng
giữa lần chấm đầu và lần chấm cuối, giới hạn ở mức ±30%. Mức ít nhất là mức nhỏ hơn trong hai mục tiêu tại chặn trên
của bước tăng, mức nhiều nhất là mức lớn hơn tại chặn dưới; mức ít nhất là 0 sẽ hiển thị
"không có". Đoạn văn sau đó bổ sung: *"Việc chấm của chính người nói: họ đã chấm A trên J
hàng hiển thị lại giống như trước đây (P%), do đó khoảng E% số lần chấm đổi
chiều ngẫu nhiên … các bản nháp thực sự đúng 80% có thể được chấm đúng khoảng T%
thời gian theo kết quả chấm của họ — khoảng giá trị đã tính đến điều đó."* (kèm theo, khi K
chênh lệch từ 1% trở lên theo chiều nào đó, tần suất các bản nháp từng chấm sai nay được chấm đúng nhiều hơn hay ít hơn bao nhiêu); trước thời điểm đó, *"(Sai số chấm của chính người nói vẫn chưa
được tính đến: có quá ít hàng hiển thị lại được đánh giá.)"* `report.json`
chứa các số liệu dưới dạng `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

Trong thử nghiệm mô phỏng — một người nói có độ nhiễu, tập tách dev riêng của rails và các quy tắc
kết luận này, 200 lượt chạy thử cho mỗi kịch bản trên hai bộ seed — con số ước tính rơi
vào trong phạm vi sai số 2 lần so với số lượng thực tế 69–78% số lần ở mức 400 câu
mới mỗi vòng và 53–56% ở mức 800 câu, và số lượng thực tế rơi vào trong
khoảng ước tính 89–94% và 76–80% số lần (nếu không có các hàng lặp lại, là 91–93% và 51–54%).
Việc điều chỉnh chính con số ước tính theo kết quả chấm của người nói đã giúp ích ở mức 800 câu mỗi vòng và
gây hại ở mức 400 câu (trong phạm vi sai số 2 lần: 64% và 19%), do đó con số này vẫn giữ ở mức
80% thông thường. Một ghi chú cho rằng mô hình "có thể đã hoạt động tốt" từng được thử nghiệm và bị loại bỏ:
nó sai 2–3 lần cho mỗi lần đúng. Một phỏng đoán thô, và được nêu rõ như vậy.

## Những điều con số không thể hiện

- Điểm số là của hệ thống trên tập dữ liệu đó, không dành cho từng câu riêng lẻ: không có độ tin cậy theo từng câu.
- chrF++ đo lường mức độ trùng lặp với bản tham chiếu. Một bản dịch tốt diễn đạt khác đi có thể bị điểm thấp; một bản dịch trôi chảy nhưng sai nghĩa có thể đạt điểm khá cao.
- FST chấp nhận cho biết các từ có tồn tại, chứ không phải câu mang đúng ý nghĩa.
- Các dòng trên bảng xếp hạng được công bố theo mặc định là tự báo cáo; bộ xác minh sẽ chấm điểm lại các đầu ra đã gửi dựa trên ngữ liệu được ghim mã băm (trong khoảng 1,0 chrF++), và không chạy lại các phương thức.

## Cách báo cáo một con số

Mỗi con số đều đi kèm **đơn vị của nó, những gì nó đo lường, và tập dữ liệu mà nó được đo lường trên đó** — cùng với kích thước của tập dữ liệu và khoảng giá trị nếu có.

| Nên nói | Không bao giờ nói |
|---|---|
| "chrF++ 24.1 trên 100 ở 50 câu luyện tập (dev), khoảng 20.6–27.6" | "24.1" · "chính xác 24%" |
| "người bản ngữ đánh dấu 9 trên 24 bản nháp mới là đúng — 38% (21%–57%)" | "độ chính xác 38%" |
| "không có thay đổi đo lường được: trên 50 câu dev chỉ thấy được mức chênh lệch khoảng 5.8 điểm" | "nó đã cải thiện đôi chút" |
| "quá ít câu luyện tập để kết luận: dưới 50 câu, không phép so sánh nào có thể quyết định — đánh giá mù của người bản ngữ sẽ quyết định" | "không thay đổi" đối với phán quyết **too-few** |
| "trên 50 câu kiểm thử bị khóa, một lần duy nhất, đối chiếu với dự đoán bạn đã viết: '…'" (đọc lại chính lời của họ) | điểm kiểm thử mà không có tập dữ liệu hoặc dự đoán |
| "đánh giá mù, trên các câu mới, người bản ngữ đánh dấu mô hình mới hơn đúng ở 7 trên 12 câu và mô hình đang dùng đúng ở 5 trên 12 câu — không có khác biệt rõ rệt trên 24 câu" | "mô hình mới tốt hơn" chỉ từ các đánh dấu |
| "chrF++ 31.0 qua cổng kiểm soát (bản thực tế phát hành), 33.5 không qua cổng kiểm soát, 12% bị cổng kiểm soát từ chối" | chỉ nêu riêng điểm qua cổng kiểm soát |

- Một khoảng giá trị thể hiện mức độ chắc chắn của công cụ, không phải là hai kết quả.
- Hai điểm số trên các tập dữ liệu khác nhau không thể so sánh được với nhau. Hai điểm số trên cùng một tập dữ liệu chỉ khác nhau khi kiểm định theo cặp khẳng định điều đó.
- Trích dẫn nguyên văn từng chữ các lưu ý và cảnh báo.
- Không bao giờ gọi một điểm số là tốt hay xấu; không bao giờ gắn từ ngữ chỉ chất lượng. Người bản ngữ thành thạo sẽ quyết định những gì phù hợp để sử dụng.

## Tìm hiểu sâu hơn

- [Đặc tả chấm điểm](/docs/network/specifications/scoring) và [ý nghĩa thống kê](/docs/network/specifications/significance).
- [Thẻ lượt chạy](/docs/network/specifications/run-card) — những gì một lượt chạy có chấm điểm ghi lại.
- [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability) — chỉ số nào đã được đối chiếu với đánh giá của con người cho những ngôn ngữ nào.
- [Các giới hạn kỹ thuật](/docs/network/honest-limitations).
- [Rào chắn an toàn](/docs/guardrails) — phiên bản dành cho cộng đồng.
