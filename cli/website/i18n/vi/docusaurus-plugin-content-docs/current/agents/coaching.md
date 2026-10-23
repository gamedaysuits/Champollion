---
title: "Đồng hành cùng mọi người"
slug: /agents/coaching
description: "Cách tác nhân AI truyền đạt báo cáo vòng chạy của Champollion và trò chuyện với những người đang xây dựng bộ dịch: nêu tiến độ trước tiên, mọi con số đều đi kèm đơn vị và tập dữ liệu, chỉ khích lệ những tiến bộ đã được đo lường, hỏi xin thời gian mà không tạo áp lực, và không hứa hẹn bất cứ điều gì về chất lượng."
---

# Hướng dẫn mọi người

Hệ thống đường ray sẽ đo lường. Bạn là người truyền đạt. Phần lớn những gì mọi người nghe về trình dịch của họ đều thông qua bạn, vì vậy cách bạn diễn đạt là một phần của công việc. Trang này hướng dẫn cách diễn đạt: báo cáo vòng chứa những gì, cách truyền đạt lại, cách hỏi về thời gian, và những từ ngữ nên dùng.

Các quy tắc cốt lõi nằm trong [bản hợp đồng](/docs/agents/contract) §5: chỉ nói những gì là sự thật, truyền đạt từng lưu ý nguyên văn, hứa hẹn về quy trình chứ không bao giờ hứa về chất lượng, gắn mọi con số với đơn vị và tập dữ liệu dùng để đo lường.

## Báo cáo vòng

Mỗi vòng cải thiện kết thúc bằng `champollion improve report` (bước `improve-report` trong hành trình, chế độ `auto`). Lệnh này ghi `improve/round-<k>/report.json` và in ra bốn phần; `--json` in ra cùng đối tượng đó:

| Trường | Nội dung chứa |
|---|---|
| `round` | Vòng đang tiến hành: hơn một vòng so với các vòng mà forge đã đánh giá |
| `progress` | Các dòng, theo thứ tự: xu hướng trong đánh giá của người nói, tiếp theo là đánh giá của từng vòng (mỗi đánh giá được theo sau bởi so sánh mù đối với vòng mà bảng có trộn bản dịch nháp của mô hình khác), sau đó là phán quyết của từng vòng trên tập phát triển (dev set) |
| `checks` | Cảnh báo về những gì các con số có thể và không thể thể hiện |
| `projection` | Ước tính sơ bộ về số câu huấn luyện cần thêm để đạt mức "dùng được", tính theo mỗi lần nhân đôi số câu, kèm theo một khoảng — hoặc lý do tại sao không có — hoặc `null` trước khi có hai vòng đánh giá |
| `projection_numbers` | Cùng ước tính đó dưới dạng số: `more_sentences`, `range` (`[fewest, most]` câu huấn luyện; `most` là `null` khi các bước kiểm tra không thể giới hạn khoảng) và `speaker_hours` — hoặc `null` khi không có dự phóng |
| `actions` | Từ một đến bốn việc cần làm tiếp theo |

Báo cáo chỉ đọc các bản ghi được lưu giữ qua các vòng — `marks.json` của người nói ở mỗi vòng và các phán quyết `improve-compare` của forge — rồi in ra số lượng và tỷ lệ phần trăm, không bao giờ in ra một câu hoàn chỉnh.

### Ý nghĩa của từng dòng

**Đánh giá của người nói — thước đo quan trọng nhất.** Mỗi vòng, mô hình đang dùng sẽ dịch nháp các câu mà gia đình đã viết, và người nói đánh dấu từng bản nháp là `Y` (đúng), `N` (sai, kèm theo cách diễn đạt đúng) hoặc `?` (không chắc chắn). Tỷ lệ đúng được tính trên các bản nháp được đánh dấu `Y` hoặc `N`, với khoảng tin cậy Wilson 95%:

> Vòng 1: người nói đánh dấu đúng 9 trên 24 bản dịch nháp của các câu mới — 38%
> (khoảng 95% là 21%–57%).

Đây là những câu mới — được soạn trước khi có mô hình nào học chúng — nên đây là
phép đo ngoài mẫu. Trong một vòng mà bảng chấm có trộn các bản nháp
của mô hình khác, số đếm này chỉ tính các dòng của mô hình đang dùng. Các dòng hiển thị lại
(bên dưới) không bao giờ nằm trong số này.

**Các dòng hiển thị lại.** Từ vòng 2, cứ khoảng mười dòng thì có một dòng là bản nháp mà
người nói đã chấm trên một bảng trước đó, được gửi lại mà không có đánh dấu. Bảng chấm có ghi rõ
điều này ở đầu trang — *“Một vài dòng dưới đây được đưa trở lại từ các bảng trước đó một cách có chủ đích.
Xin vui lòng chấm lại từ đầu, như thể đây là câu mới: mức độ đồng nhất giữa các lần chấm cho biết các kết quả chấm
đáng tin cậy đến đâu.”* — và không bao giờ cho biết đó là những dòng nào. `improve marks` in ra *“Các dòng
hiển thị lại: người nói đã chấm A trên J dòng theo cách họ từng chấm trước đây (P%)”*, cùng với
số lần đổi chiều theo mỗi hướng. Các dòng này không bao giờ được tính vào tỷ lệ của vòng đó và
không bao giờ được dùng để huấn luyện lại; chúng chỉ làm người nói mất khoảng 10 giây cho mỗi dòng
([đo lường](/docs/agents/measurement#the-speakers-marks)).

**So sánh mù.** Mô hình thứ hai dịch nháp ngẫu nhiên một nửa số bản nháp của bảng, không gắn nhãn, và người nói đánh giá cả hai mà không biết bản dịch nào của mô hình nào ([đo lường](/docs/agents/measurement#the-speakers-marks)). Mô hình thứ hai là mô hình mới nhất khi nó chưa được đưa vào sử dụng; trong lần ghé thăm sau khi thăng cấp mô hình, đó là mô hình mà mô hình mới đã thay thế. Báo cáo thêm một dòng:

> Vòng 2: Mù, trên các câu mới: mô hình đang dùng được đánh dấu đúng 5
> trên 12 (42%), mô hình mới hơn (không dùng) là 7 trên 12 (58%) — không có
> khác biệt rõ ràng trên 24 câu.

Sau khi thăng cấp, dòng này có nội dung *"mô hình được đưa vào sử dụng gần nhất được đánh dấu đúng trên …, mô hình mà nó thay thế trên …"*. Nó kết thúc theo một trong ba cách (kiểm định hai tỷ lệ ở mức ý nghĩa 5%): đối với mô hình mới hơn, *mô hình mới hơn rõ ràng tốt hơn trên các câu mà gia đình cần* hoặc *mô hình đang dùng rõ ràng tốt hơn*; sau khi thăng cấp, *mô hình mới rõ ràng tốt hơn trên các câu mà gia đình cần* hoặc *mô hình mà nó thay thế rõ ràng tốt hơn — mô hình mới chưa giúp ích được gì trên các câu mà gia đình cần*; hoặc *không có khác biệt rõ ràng trên N câu*. Nếu có quá ít hàng được đánh dấu của một mô hình, báo cáo sẽ ghi *"quá ít hàng của một mô hình được đánh giá để so sánh"*.

**Xu hướng.** Báo cáo chỉ gọi mức tăng là *tiến bộ thực sự* khi thỏa mãn cả ba điều kiện:

- khoảng của vòng cuối nằm hoàn toàn phía trên khoảng của vòng đầu (giới hạn dưới của nó
  nằm trên giới hạn trên của vòng đầu);
- mô hình của một vòng đã được đưa vào sử dụng ở giữa — do mọi người lựa chọn
  (các bản ghi `export` và `choose` của forge): sau phán quyết **better** và
  sự đồng ý của họ, dựa trên đánh giá mù của người bản ngữ, hoặc theo lựa chọn của chính họ. Riêng
  phán quyết **better** thì không được tính; và
- khi đánh giá mù trong cùng các buổi làm việc, người bản ngữ đánh giá mô hình mới là đúng
  nhiều hơn rõ rệt so với mô hình mà nó thay thế (các lần kiểm tra sau mỗi
  lần nâng cấp, được gộp lại; kiểm định hai tỷ lệ ở mức 5%).

Điều thứ ba xuất hiện vì cách chấm của người nói có thể trôi dạt: một người trở nên
dễ tính hơn qua từng vòng sẽ nâng mọi tỷ lệ lên, nhưng trong một lượt kiểm tra thì điều đó ảnh hưởng như nhau đến cả hai mô hình.
Trong một thử nghiệm mô phỏng với người nói chấm sai 10% bản nháp và
trở nên dễ tính hơn qua từng vòng, một lần nâng cấp mà tập luyện tập tình cờ đánh giá sai
được ghi nhận là tiến triển thực sự trong 106 trên 1.600 báo cáo khi mô hình không thể
cải thiện; với việc kiểm tra ẩn danh, con số này là 3 — và nhiều nhất lại là 3 trên 1.600 khi chạy lại
với mức sàn 50 câu và phán quyết của người nói, bao gồm cả những lượt chạy có tập luyện tập bắt đầu ở mức 30 câu.

Mức tăng có kèm thăng cấp nhưng thiếu bước kiểm tra đó sẽ được in là *chưa được tính là tiến bộ thực sự: mức độ dễ tính khi đánh giá bản nháp có thể cũng đã thay đổi* — kèm theo số đếm của lần kiểm tra, hoặc thông báo rằng bảng tiếp theo sẽ trộn các bản nháp của hai mô hình. Mức tăng khi vẫn giữ nguyên mô hình đang dùng được in là *không được tính là tiến bộ*: các câu hoặc cách đánh giá đã thay đổi, chứ không phải mô hình. Mức tăng nằm trong các khoảng sai số được in là *tăng lên, dù chưa vượt qua ngưỡng không chắc chắn*.

**Phán quyết của tập phát triển (dev set).** Forge so sánh mô hình mới với mô hình đang dùng trên cùng các câu phát triển (luyện tập), từng câu một:

> Vòng 1: trên cùng 50 câu luyện tập (dev), chrF++ (0–100, mức độ trùng khớp
> với bản dịch đã kiểm tra) là 24,1 cho mô hình mới so với 22,0 cho mô hình
> đang dùng — không có thay đổi đo lường được: không sử dụng (trên 50 câu chỉ có
> mức chênh lệch từ khoảng 5,8 điểm trở lên mới thể hiện một cách đáng tin cậy).

Phần kết thúc của dòng phụ thuộc vào phán quyết và việc mọi người có chọn
mô hình của vòng đó hay không (các bản ghi `export` và `choose` của forge) — riêng phán quyết
thì không đưa thứ gì vào sử dụng cả:

| Phán quyết | Chưa được chọn | Đã chọn |
|---|---|---|
| **better** | *tốt hơn rõ rệt: chưa đưa vào sử dụng — mọi người chưa chọn* | *tốt hơn rõ rệt: đã đưa vào sử dụng* |
| **worse** | *kém hơn rõ rệt: không dùng* | *kém hơn rõ rệt — đã đưa vào sử dụng …* |
| **no-change** | *không có thay đổi rõ rệt: không dùng* | *không có thay đổi rõ rệt — đã đưa vào sử dụng …* |
| **too-few** | *quá ít câu luyện tập để xác định (dưới 50): đánh giá mù của người bản ngữ sẽ quyết định* | *quá ít câu luyện tập để xác định (dưới 50) — đã đưa vào sử dụng …* |

"Đã đưa vào sử dụng …" sẽ kết thúc bằng *dựa trên đánh giá mù của người bản ngữ* khi forge lưu
phán quyết của người bản ngữ cho mô hình đó với `clear: newer` (`improve-speaker`), và
kết thúc bằng *theo lựa chọn của chính mọi người* trong các trường hợp còn lại. `champollion improve status` sử dụng
cùng những từ này: dòng của mỗi vòng kết thúc bằng *"· mô hình mới trên các câu
luyện tập (dev): …"*. Quy tắc phán quyết nằm trong mục
[đo lường](/docs/agents/measurement#comparing-two-models).

**Các bước kiểm tra.**

- *Quá khớp.* Nếu điểm dev chrF++ của mô hình đang dùng tăng từ 3 điểm trở lên
  qua các vòng (mô hình mới của vòng gần nhất chỉ được tính một khi mọi
  người đã chọn nó) trong khi tỷ lệ chấm đúng của người nói chỉ tăng 2 điểm trở xuống,
  báo cáo sẽ cho biết mức tăng đó có thể chỉ thuộc về các câu luyện tập, và
  hãy tin vào các kết quả chấm.
- *Tập dev quá nhỏ để thấy mức tăng.* Khi sự khác biệt nhỏ nhất mà tập dev
  thể hiện một cách đáng tin cậy là hơn 3 điểm chrF++ (hoặc, nếu không rõ, là dưới 50
  câu), báo cáo sẽ nói "không có thay đổi đo lường được" là giới hạn của tập dev,
  chứ không phải bằng chứng cho thấy vòng đó không mang lại kết quả gì.
- *Mức độ đáng tin cậy của các kết quả chấm.* Khi đã có 10 dòng hiển thị lại được đánh giá,
  tính trên tất cả các vòng: *“Người nói đã chấm A trên J dòng hiển thị lại theo cách họ
  từng chấm trước đây (P%): khoảng E% số lượt chấm bị đổi chiều ngẫu nhiên, điều này kéo
  mọi tỷ lệ chấm đúng về mức 50% — dự phóng đã tính đến điều này.”* Khi
  các bản nháp từng bị chấm sai nay được chấm đúng nhiều hơn rõ rệt so với chiều ngược lại (phép kiểm
  định dấu ở mức 5%, từ 6 lần đổi chiều trở lên), báo cáo sẽ thêm *“cách chấm có thể đang nương tay hơn,
  điều mà việc tăng tỷ lệ sẽ không thể hiện được”*. Trước mốc 10: *“Hiện đã đánh giá N dòng hiển thị
  lại — sai số chấm của chính người nói được ước tính từ 10 dòng.”*

**Dự phóng.** Chỉ được đưa ra khi mức tăng là tiến triển thực sự (cả ba
điều trên) và tỷ lệ chấm đúng vẫn dưới 80% — cách gọi của hệ thống cho trạng thái
*hoạt động được* trên các câu mà gia đình cần. Đường cong học tập tăng theo các bước gần như
đều đặn mỗi khi tăng gấp đôi số câu huấn luyện, vì vậy nó đọc bước này từ
các lần kiểm tra mù của người nói đối với từng mô hình mới so với mô hình mà nó thay thế
(ghi nhận các cặp huấn luyện của cả hai mô hình) và cho biết cần thêm bao nhiêu câu huấn luyện
nữa để đạt 80% được chấm đúng, kèm theo một khoảng ước lượng, cùng với số giờ của người nói tính
khoảng 70 giây mỗi câu (một phút để viết, mười giây để chấm). Khoảng này
bao quát những gì các lần kiểm tra cho phép (95%) và, khi 10 dòng hiển thị lại đã được
đánh giá, mốc "thực sự đúng ở mức 80%" có thể nằm ở đâu trên các kết quả chấm của chính người nói này;
văn bản sau đó sẽ cho biết *“các bản nháp thực sự đúng ở mức 80% có thể được chấm đúng khoảng T% số
lần theo kết quả chấm của họ — khoảng ước lượng đã tính đến điều đó”*. Trước đó, nó sẽ cho biết
*“(Sai số chấm của chính người nói chưa được tính đến: có quá ít dòng hiển
thị lại đã được đánh giá.)”* Bản thân con số ước tính vẫn giữ ở mức 80%
thuần túy. Các số đếm được làm tròn đến hai chữ số. Khi các lượt kiểm tra không thể giới hạn khoảng này, nó
sẽ nói rằng *“chưa thể cho biết cần thêm bao nhiêu câu nữa”*. Nếu không, nó sẽ nêu rõ
lý do tại sao không có dự phóng — chẳng hạn, *“kiểm tra mù của người nói chưa cho thấy mô hình
mới vượt trội hơn mô hình mà nó thay thế, vì vậy mức tăng có thể nằm ở
cách chấm chứ không phải ở mô hình”*. Hãy luôn nói rằng đây là một ước lượng sơ bộ; báo cáo luôn làm như vậy.
Trong thử nghiệm mô phỏng, nó rơi vào phạm vi chênh lệch không quá 2 lần so với số lượng thực tế trong 69–78%
trường hợp ở mức 400 câu mỗi vòng và 53–56% ở mức 800 câu, và số lượng thực tế rơi
vào trong khoảng ước lượng 89–94% và 76–80% số lần (ở mức 800 câu mỗi vòng, là 51–54%
trước khi khoảng ước lượng tính đến kết quả chấm của người nói); đường thẳng mà nó
thay thế chỉ đạt 5% ở mức 400 câu. Đừng bao giờ nói một mô hình "có thể đã hoạt động được" dựa trên
sai số chấm của người nói: báo cáo không làm như vậy, vì trong mô phỏng, nhận xét đó
sai 2–3 lần cho mỗi lần đúng.

**Các hành động.** Theo thứ tự ưu tiên, có tối đa bốn hành động: chấm bảng của vòng này, hoặc viết
những câu vẫn còn thiếu (20 câu mỗi vòng); khi so sánh ẩn danh cho thấy
mô hình mới hơn rõ ràng tốt hơn, rằng *"vòng này thực sự có ích, ngay cả khi tập
luyện tập chưa thể phản ánh điều đó"* — hãy tiếp tục, và việc mở rộng tập luyện tập
sẽ giúp phán quyết tiếp theo nhìn thấy điều đó; khi người nói chấm mô hình bị thay thế bởi đợt nâng cấp
rõ ràng tốt hơn, cần hỏi cộng đồng xem có nên đưa mô hình trước đó quay lại không,
và làm cho tập luyện tập giống hơn với các câu mà họ cần; mở rộng
tập luyện tập, khi nó quá nhỏ để nhận ra mức tăng của một vòng và dưới 200
câu (*"cứ 2 câu trên mỗi bảng thì có 1 câu không có bản nháp — người nói
viết lại cách nói câu đó, và câu đó sẽ được đưa vào tập luyện tập (hiện là 31; 50 câu cho phép
đánh giá một vòng, 200 câu cho phép thấy được mức tăng khoảng 3 điểm)"* — "cứ 4 câu có 1"
kể từ mức 50); những việc cần làm sau hai vòng không có mức tăng (bên dưới); việc
thời gian người nói có thể dành ra có vẻ quá ít; và khi mức chặn dưới
của tỷ lệ đúng đạt 70%, một lần kiểm tra trên tập kiểm tra được khóa — với
dự đoán được viết ra trước.

**Hai vòng không có cải thiện** — hai phán quyết gần nhất đều là **no-change** hoặc
**worse** (vòng **too-few** không nói lên điều gì về cả hai hướng, và không được tính),
đồng thời không có mô hình nào được đưa vào sử dụng giữa hai vòng đó; forge cũng đếm tương tự đối với
lời đề xuất mô hình mạnh hơn. Ở những nơi tập luyện tập có thể nhận thấy mức cải thiện thông thường của một vòng,
hành động sẽ hiển thị *"Hai vòng không có cải thiện mà tập luyện tập này có thể thấy
(khoảng X điểm chrF++ trở lên): các vòng có thể đang bổ sung ít hơn mức đó, hoặc
không mang lại gì — hệ thống không thể biết chắc điều nào. Các hướng đi nhanh hơn: mô hình mạnh hơn mà
cơ chế định hướng đề xuất khi máy tính đủ khả năng huấn luyện, hoặc thêm nhiều câu thuộc loại
mà mô hình đang dịch sai."* (X là mức chênh lệch nhỏ nhất mà phán quyết phát hiện được.) Ở những nơi
không thể phát hiện, hệ thống sẽ khuyên tiếp tục. Không bao giờ được nói hoặc ám chỉ rằng thêm nhiều câu sẽ không
giúp ích gì: ở gần đỉnh đường cong cải thiện, một vòng chỉ thêm khoảng nửa điểm chrF++, thấp hơn
mức mà 200 câu luyện tập có thể phát hiện. Trong các vòng mô phỏng, câu thông báo cũ
"thêm những câu tương tự có thể không giúp ích" đã xuất hiện trong 98 trên 1.200 báo cáo trong khi
mô hình thực sự đang tiến bộ.

### Cách truyền đạt lại

1. **Tiến triển trước tiên.** Mở đầu bằng những gì đã thay đổi, trong các đánh giá của người nói.
2. **Mỗi con số đều đi kèm đơn vị và tập dữ liệu.** "9 trong số 24 câu mới mà
   người nói đã kiểm tra là đúng — 38%", đừng bao giờ chỉ nói "38%". "chrF++ 24,1 trên 100 ở
   50 câu luyện tập", đừng bao giờ chỉ nói "24,1". Một khoảng là mức độ chắc chắn của công cụ,
   chứ không phải hai kết quả: "trong khoảng từ 21% đến 57% — với 24 câu, các
   công cụ không thể chắc chắn hơn thế".
3. **Các kiểm tra, một cách rõ ràng.** Nếu báo cáo đưa ra cảnh báo, hãy nói rõ cảnh báo điều gì.
4. **Các bước tiếp theo là những việc họ có thể làm.** Chuyển mỗi hành động thành một câu
   hướng tới cộng đồng, kèm theo tên tệp được nhắc đến.
5. **Truyền đạt lại mọi lưu ý nguyên văn từng từ.**

**Khích lệ những gì đo lường được.** Một bản nháp được đánh dấu đúng, một mức tăng vượt ra ngoài các khoảng sai số, một mô hình mới được đưa vào sử dụng: hãy nói về điều đó một cách ấm áp. Bản dịch đầu tiên rất đáng để ăn mừng. Đừng bao giờ ăn mừng một con số mà báo cáo không coi là tiến bộ.

**"Không có thay đổi đo lường được" — mộc mạc và ân cần.** Điều đó không có nghĩa là vòng này bị lãng phí vô ích. Hãy giải thích đúng ý nghĩa của nó: với ngần này câu luyện tập, chỉ mức chênh lệch cỡ này mới thể hiện được; một mức cải thiện nhỏ hơn có thể đang ẩn giấu; mô hình đang dùng vẫn tiếp tục được dùng; những câu mà người nói đã sửa vẫn được tính. Sau đó hãy nêu bước tiếp theo.

**"Quá ít câu luyện tập để biết" — chứ không phải "không thay đổi".** Dưới 50
câu luyện tập thì không phép so sánh nào có thể đưa ra quyết định, bất kể hai điểm số là bao nhiêu; đó
không phải là phán quyết về mô hình mới. Thay vào đó, hãy nói những gì sẽ diễn ra: mô hình đang dùng
sẽ được giữ nguyên lúc này; bảng tiếp theo sẽ trộn các bản nháp của mô hình mới hơn vào mà không đánh dấu,
và đánh giá của người nói sẽ quyết định; cứ hai dòng trên bảng thì có một dòng không có bản nháp, và những
câu đó sẽ mở rộng tập luyện tập cho đến khi một vòng có thể được đánh giá dựa trên tập này.

**So sánh ẩn danh — với số lượng của cả hai, và tác dụng của nó.** Hãy nêu
số lượng của cả hai mô hình và phần kết thúc của báo cáo, đúng như đã viết. Khi mô hình mới hơn
rõ ràng tốt hơn, hãy nói như báo cáo đã nêu — vòng này thực sự có ích, ngay cả khi
tập luyện tập chưa thể phản ánh điều đó — và đó là đánh giá của chính người nói
trên các câu mới. Sau phán quyết **too-few** hoặc **no-change** đối với
mô hình đó, sự ưu tiên rõ ràng sẽ khiến forge đề xuất đưa nó vào sử dụng: `improve marks`
in ra *"forge đã ghi nhận: công cụ đề xuất đưa mô hình mới hơn vào sử dụng (cộng đồng
đồng ý trước)"*, và đề xuất này xuất hiện dưới dạng bước `improve-promote`
(bên dưới) — hãy hỏi trước khi chạy. Sau phán quyết **worse**, nó sẽ không được
đề xuất. Sau một lần nâng cấp, chính việc kiểm tra này cho phép báo cáo tính một
mức tăng là tiến triển thực sự; khi nó cho thấy mô hình bị thay thế tốt hơn
rõ rệt, hãy hỏi cộng đồng xem có nên đưa mô hình trước đó quay lại không — đừng bao giờ làm điều đó
khi chưa có sự đồng ý của họ. "Không có khác biệt rõ rệt" trên 24 câu mang đúng ý nghĩa của nó.
**Lưu ý.** Không bao giờ nói cho người nói biết dòng nào đến từ mô hình nào trước khi
đọc các đánh giá của họ.

**Các dòng hiển thị lại — mục đích của chúng.** Hãy nêu mức độ đồng nhất cùng với các số đếm của nó,
đúng như báo cáo thể hiện ("người nói đã chấm 17 trên 20 dòng hiển thị lại theo cách
họ từng chấm trước đây — 85%"), và nêu rõ mục đích của nó: các kết quả chấm có thể
được tin cậy đến đâu. Điều này được thông báo trên bảng chấm, chứ không phải một bài kiểm tra giấu kín đối với người nói.
Hãy nêu sai số ngẫu nhiên theo cách báo cáo thể hiện: khoảng E% số lượt chấm đổi
chiều một cách ngẫu nhiên, điều này kéo mọi tỷ lệ về mức 50%, và dự phóng
đã tính đến điều này. Khi báo cáo cho biết *“cách chấm có thể đang nương tay hơn”*,
hãy nói điều đó một cách mộc mạc và không hề trách cứ: mức tăng tỷ lệ khi đó có thể là do
cách chấm, chứ không phải do mô hình. **Lưu ý.** Không bao giờ nói cho người nói biết những dòng nào
được đưa trở lại, hay trước đây họ đã chấm ra sao — bảng chấm chỉ cho biết có một vài dòng như vậy.

**Những từ mô hình chưa từng thấy.** Khi `sync` cảnh báo rằng các khóa *"chứa những từ mô hình chưa từng thấy trong huấn luyện — rất có thể bị dịch sai, dù đọc rất trôi chảy"*, hãy nói một cách mộc mạc: những dòng đó rất có thể bị sai dù đọc có vẻ xuôi tai; một người nói nên kiểm tra lại chúng, hoặc các câu của vòng tiếp theo có thể dạy mô hình những từ đó. Hãy nêu tên các khóa, đúng như cảnh báo đã nêu; bạn không bao giờ nhìn thấy các từ đó. Người dùng sẽ thấy chúng trên trang dùng thử của mô hình, bên dưới mỗi dòng. Bằng chứng, trên ngôn ngữ thử nghiệm được sáng tạo ra: các câu chứa từ mà mô hình chưa từng thấy đúng 0 lần trong số 358 lần ([phục vụ](/docs/agents/serving#words-the-model-never-saw)).

**Các từ trong danh sách mong muốn.** Phần "Các từ chưa từng thấy" yêu cầu *"hai hoặc ba câu với mỗi từ bạn cần, mỗi câu diễn đạt một ý khác nhau"*: ít từ hơn, nhưng mỗi từ xuất hiện trong một vài câu, sẽ dạy mô hình nhiều hơn là nhiều từ nhưng chỉ xuất hiện một lần. Hãy truyền đạt lại theo cách đó. Trên ngôn ngữ thử nghiệm được sáng tạo ra, một từ xuất hiện một lần trong quá trình huấn luyện dịch đúng trong 27–29% trường hợp, và xuất hiện 2–4 lần đạt 63–95%; và với 3.200 câu huấn luyện, ByT5-small được huấn luyện trên các câu chọn lọc có nhiều từ mới nhất chỉ đạt 39,4% đúng về nghĩa trên 500 câu giữ lại kiểm thử, so với 53,4% đối với các câu giao tiếp hàng ngày — trong khi tốn nhiều thời gian của người nói hơn một chút (khoảng 57 giờ so với 54 giờ).

Đừng bao giờ tự mình nhận xét một điểm số là tốt hay xấu. Một người nói thông thạo sẽ quyết định điều gì là phù hợp để sử dụng.

## Hỏi về thời gian

Bước `improve-time` (chế độ `ask_user`) hỏi người nói có thể dành ra bao nhiêu thời gian: `per_week` và `total`, từng câu trả lời **chính xác như họ đã nói** ("có lẽ khoảng 30 câu một tuần", "vài tiếng, rồi tính tiếp"). Thông tin này được ghi lại bởi `champollion improve time` trong `improve/time.json`; số lượng câu của mỗi vòng được lên kế hoạch dựa trên thông tin đó, và báo cáo sẽ so sánh dự phóng với lượng thời gian này.

- **Lưu ý.** Hỏi một lần; đừng bao giờ nài ép thêm. Nếu họ không biết, hãy ghi lại đúng những gì họ nói — những lời mơ hồ cũng là một câu trả lời.
- **Lưu ý.** Khi báo cáo cho biết dự phóng cần nhiều câu hơn thời gian mà họ cho biết còn lại, hãy nói thẳng thắn với họ, cùng với các lựa chọn được nêu: thêm người nói, người trợ giúp cho dự án, hoặc một mục tiêu hẹp hơn vào lúc này (một cuốn sổ tay câu mẫu cho những câu họ cần nhất). Sau đó hãy để họ tự chọn.

## Những đề xuất mà đường ray đưa ra

**Đề xuất đưa mô hình tốt hơn vào sử dụng** (trạng thái forge `improve-promote`, chế độ
`confirm`). Một mô hình mới tốt hơn rõ rệt trên tập dev — hoặc tập dev
không thể đưa ra kết luận (**too-few**, hoặc **no-change**) và người bản ngữ, khi chấm
mù, đã đánh giá nó đúng nhiều hơn rõ rệt. Khi đó `why` của forge sẽ bổ sung
số liệu đếm của người bản ngữ: *"Khi đánh giá mù trong cùng buổi làm việc, người bản ngữ đã chấm
mô hình mới hơn đúng ở A trên B câu mới (P%) và mô hình đang dùng đúng ở C trên
D câu (Q%) — một sự khác biệt rõ rệt: mô hình mới hơn hoạt động tốt hơn trên các câu mà
gia đình cần."* Hãy nói rõ đó là trường hợp nào. Đây là một lời đề xuất: riêng phán quyết thì không
thay đổi điều gì. Việc đưa nó vào sử dụng sẽ thay đổi câu trả lời của trang web hoặc ứng dụng của họ, vì vậy hãy hỏi trước
khi chạy bước này; nếu chọn "để sau", `declined: true`. Chỉ khi họ đồng ý — phản hồi
`export` và `choose` của bước này — thì mô hình mới được đưa vào sử dụng; cho đến lúc đó, báo cáo sẽ ghi
*"tốt hơn rõ rệt: chưa đưa vào sử dụng — mọi người chưa chọn"*, và
mọi mức tăng điểm đều không được tính là tiến bộ từ mô hình đó. Khi đã được chọn dựa trên đánh giá của người bản ngữ,
dòng của vòng đó sẽ ghi *"đã đưa vào sử dụng dựa trên đánh giá mù của người bản ngữ"*.

**Một mô hình mạnh hơn** (trạng thái forge `improve-stronger-model`, chế độ `ask_user`).
Sau hai vòng liên tiếp mà tập dev có thể đánh giá nhưng không thấy tiến bộ —
cả hai đều là **no-change** hoặc **worse**; vòng **too-few** không được tính —
tính từ lần đổi mô hình gần nhất (chuyển đổi preset, hoặc bất kỳ mô hình nào mà
mọi người đưa vào sử dụng bằng `choose`, bao gồm cả việc nâng cấp dựa trên đánh giá của người bản ngữ),
khi đang dùng mô hình siêu nhỏ, cơ chế định hướng sẽ đề xuất ByT5-small
— `byt5-small`, hoặc `byt5-small-lowmem` nếu GPU có 8–15 GB bộ nhớ
để huấn luyện (ít bộ nhớ hơn cho mỗi bước, chậm hơn): cần tải xuống khoảng 1,2 GB và
thời gian huấn luyện lâu hơn, tốt nhất là trên Apple silicon hoặc GPU NVIDIA
([huấn luyện](/docs/agents/training#models)). Ô nhập câu trả lời là `try_it`:
`yes` hoặc `not-now`. Hãy nói những gì `why` của forge thông báo — khi tập dev quá
nhỏ để nhận thấy mức cải thiện của một vòng, hãy nói rằng những cải thiện nhỏ có thể đang bị ẩn; nếu không, hãy nói
rằng hai vòng vừa qua mang lại *"không có thay đổi nào mà các câu dev có thể nhận thấy (khoảng X điểm chrF++
trở lên): các vòng có thể đang bổ sung ít hơn mức đó, hoặc không mang lại gì"*. Thông báo
không nói rằng thêm nhiều câu sẽ không giúp ích, và bạn cũng không được nói như vậy. "Để sau"
là một trong những câu trả lời của bước này: truyền `try_it: "not-now"` (qua MCP,
`declined: true` sẽ bị từ chối ở đây). Forge sẽ ghi nhận điều đó, giữ nguyên mô hình đang dùng,
và lời đề xuất sẽ chỉ xuất hiện lại sau hai vòng như vậy nữa (**no-change** hoặc
**worse**). Trả lời cách nào cũng được; quyền quyết định là của họ.

**Đánh giá dự đoán.** Sau khi có điểm số trên tập kiểm thử, mọi người sẽ cho biết dự đoán mà họ viết có đúng hay không (`held` hoặc `missed`) và ai đã đánh giá điều đó. Hãy đọc cho họ nghe dự đoán và điểm số kèm theo khoảng tin cậy; đừng bao giờ đánh giá thay họ.

**Những người nói chưa đồng ý.** Một tệp trong `waiting_for_agreement` sẽ được hỏi mỗi phiên một lần, một cách nhẹ nhàng. Chỉ có câu trả lời "có" từ người đó — xác nhận rằng mọi người có lời nói trong đó đều đã đồng ý — mới giải quyết được câu hỏi này.

## Từ ngữ dành cho mọi người

| Hãy nói | Thay vì |
|---|---|
| "điểm trên thang 100 thể hiện bản dịch sát với cách nói của chính người nói đến mức nào — chrF++" | chỉ riêng "chrF++ 24.1" |
| "mức độ chắc chắn của các công cụ: trong khoảng từ 21% đến 57%" | "CI [0.21, 0.57]" |
| "các câu luyện tập" (tập dev) | "phân chia dev" |
| "các câu kiểm tra, được giữ khóa" | "tập kiểm tra held-out" |
| "mô hình nhỏ đầu tiên" | tên thư mục hoặc tên lượt chạy của nó |
| "không có thay đổi đo lường được — trên 50 câu luyện tập, chỉ chênh lệch khoảng 6 điểm mới thể hiện rõ" | "không có cải thiện" |
| "chưa đủ câu luyện tập để biết — dưới 50 câu, đánh giá của chính người nói sẽ quyết định" | "không thay đổi" đối với phán quyết too-few |
| "sổ tay mẫu câu: dịch tốt những câu tương tự như các câu nó đã học" | "mô hình NMT cơ sở cho ngôn ngữ ít tài nguyên" |
| "người nói đã chấm đúng 9 trên 24 câu" | "độ chính xác 38%" |

Hãy giải thích một thuật ngữ ngay lần đầu tiên nó xuất hiện, kèm theo ví dụ trước khi nhắc đến thuật ngữ đó.

## Khi nào nên đề xuất trợ giúp

- **Dự án gặp bế tắc, hoặc họ yêu cầu sự trợ giúp từ con người.** Hãy nói: *"Bạn gặp khó khăn, hoặc muốn nhận trợ giúp cho dự án của mình? Hãy trao đổi cùng chúng tôi."* — [info@champollion.dev](mailto:info@champollion.dev). Không bao giờ bắt buộc; không có báo giá.
- **Họ cần thêm câu, người nói hoặc tài nguyên tính toán nhiều hơn những gì họ có.** Hãy hướng dẫn họ đến mục [Tham gia dự án](/docs/join-a-project): những người khác có thể đóng góp câu, danh sách từ hoặc phương pháp (hiện tại chỉ là tệp), và không có nội dung nào của họ bị gửi đi mà không có sự đồng ý của họ ([lưu trữ và tham gia](/docs/agents/hosting-and-joining)).

## Tìm hiểu sâu hơn

- [Cải thiện dần qua từng vòng](/docs/make-it-better) — vòng lặp cải thiện theo cách mọi người đọc hiểu.
- [Quy tắc đo lường](/docs/agents/measurement) — quy tắc phán quyết, khoảng sai số và giới hạn của tập dev.
- [Huấn luyện với nmt-forge](/docs/agents/training) — mô hình mạnh hơn là gì và đòi hỏi những gì.
- [Hợp đồng vận hành](/docs/agents/contract) §5 — chỉ nói những gì là sự thật.
