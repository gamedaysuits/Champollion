---
sidebar_position: 5
title: "Tại sao hàng đợi được thiết kế theo cách này"
slug: '/network/perspectives/why-the-queue'
description: "Triết lý đằng sau hàng đợi tính toán cộng đồng: token quyên góp là ngân sách, mạng lưới là sứ mệnh, và danh sách ưu tiên là một tập hợp các niềm tin cần được ghi lại, phản biện và có thể bác bỏ."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Tại sao Hàng đợi được Xây dựng theo Cách này

Hàng đợi là sản phẩm biên tập có tầm ảnh hưởng lớn nhất mà chúng tôi công bố.
Mỗi mục trong đó đều truyền tải thông điệp: *nếu bạn sẵn lòng chi vài cent
tín dụng API cho dịch thuật máy cho ngôn ngữ ít tài nguyên, thì đây là nơi tốt nhất
mà chúng tôi biết để sử dụng.* Câu nói đó mang theo những trách nhiệm lớn lao. Trang này
nói về những trách nhiệm đó là gì và cách
[công thức xây dựng hàng đợi](/docs/network/specifications/queue-construction)
thực hiện chúng.

## Danh sách ưu tiên là một tập hợp các niềm tin

Bất kỳ việc sắp xếp thứ tự công việc nào cũng đều ẩn chứa câu trả lời cho ba câu hỏi,
dù có ai đó viết chúng ra hay không:

1. **Chúng tôi coi trọng điều gì?** Một lượt chạy hoàn thành thực sự có *giá trị* như thế nào?
2. **Chúng tôi tin vào điều gì?** Chúng tôi kỳ vọng điều gì sẽ xảy ra khi một lượt chạy chưa từng thử nghiệm được thực thi?
3. **Chúng tôi thừa nhận mình không biết điều gì?** Khi nào sự tò mò nên được ưu tiên hơn dự đoán?

Hầu hết các hàng đợi đánh giá hiệu năng (benchmark) đều trả lời những câu hỏi này một cách ngầm định — "khoảng cách lớn nhất trước,"
"mô hình mới nhất trước," hoặc theo bảng tính của ai đó. Chúng tôi nghĩ rằng một dự án yêu cầu
những người xa lạ chi tiền xứng đáng nhận được câu trả lời rõ ràng, trong một công thức
mà bất kỳ ai cũng có thể tính toán lại, với mọi dữ liệu đầu vào được công khai. Không phải vì
các công thức là trung lập — chúng không hề trung lập, công thức của chúng tôi thể hiện sứ mệnh và trực giác của chúng tôi —
mà bởi vì **một định kiến được viết ra có thể được tranh luận, còn một định kiến không được viết ra thì không.**

## Những gì chúng tôi coi trọng: các chuỗi liên kết, không phải các dấu tích hoàn thành

Sứ mệnh của chúng tôi là *mọi ngôn ngữ sang mọi ngôn ngữ thông qua các chuỗi cặp riêng lẻ được đo lường*.
Cơ sở hạ tầng dịch thuật của thế giới lấy tiếng Anh làm trung tâm; dự án của chúng tôi ban đầu cũng vậy — một mô hình ngôi sao của các benchmark eng→X.
Nhưng mô hình ngôi sao chỉ đo lường một thứ duy nhất: khoảng cách so với tiếng Anh.
Các ngôn ngữ trên thế giới xứng đáng có một *mạng lưới (mesh)*: khi không có benchmark trực tiếp giữa hai ngôn ngữ,
một chuỗi các cặp được đo lường sẽ xuất hiện — và chất lượng của nó phải là thứ chúng tôi có thể ước lượng từ các phép đo thay vì chỉ khẳng định suông.

Vì vậy, giá trị của một lượt chạy hoàn thành không phải là "thêm một hàng trên bảng xếp hạng."
Mà là **toàn bộ mạng lưới trở nên mạnh mẽ hơn bao nhiêu**: mức tăng trong mục tiêu năng lực chuỗi trọng số chất lượng Φ của chúng tôi,
câu hỏi đặt ra cho mỗi cặp ngôn ngữ có thứ tự trên Trái Đất mà chúng tôi theo dõi là: *chuỗi tốt nhất giữa chúng hiện tại tốt đến mức nào?*
Một lượt chạy kết nối một ngôn ngữ bị cô lập có giá trị bằng hàng trăm lượt chạy nhằm đánh bóng một góc vốn đã sáng —
và công thức sẽ chỉ ra chính xác là bao nhiêu trăm lượt, thay vì để mặc cho cảm tính.
Đây cũng chính là bản năng đã dẫn dắt M2M-100 khai thác các "ngôn ngữ cầu nối" giữa các ngữ hệ thay vì thu thập thêm dữ liệu ghép cặp với tiếng Anh (Fan và cộng sự 2021) —
được áp dụng liên tục và hướng vào việc đánh giá thay vì huấn luyện.

Hai hệ quả mà chúng tôi chủ động chấp nhận:

- **Một lượt chạy nhỏ, chi phí thấp trên một cặp chưa được đo lường thường tốt hơn một lượt chạy tốn kém trên một cặp đã được đo lường.**
  Tài nguyên tính toán đóng góp là một nguồn ngân sách; chúng tôi xếp hạng theo mức tăng mạng lưới *trên mỗi đô la*
  (quy tắc tham lam cổ điển để tối ưu hóa phạm vi bao phủ trong một ngân sách giới hạn — Khuller, Moss & Naor 1999).
  Việc thắp sáng cạnh thứ một trăm đóng góp nhiều hơn cho sứ mệnh so với việc mạ vàng cạnh đầu tiên.
- **Các chuỗi ước lượng có giá trị thấp hơn các cạnh được đo lường trực tiếp.**
  Mô hình chuỗi của chúng tôi nhân các chất lượng cạnh và áp dụng mức giảm trừ độ trung thực (fidelity discount) cho mỗi điểm nối trung gian (pivot junction),
  bởi vì kết quả của bốn mươi năm dịch thuật trung gian cho thấy việc định tuyến qua một ngôn ngữ trung gian sẽ làm mất mát nhiều thông tin hơn so với những gì phép hợp thành ngây thơ gợi ý (Utiyama & Isahara 2007; Wu & Wang 2007).
  Khoản giảm trừ này là động lực lâu dài của công thức để *đo lường cặp trực tiếp* thay vì hài lòng với một chuỗi có vẻ hợp lý.

## Những gì chúng tôi tin tưởng: các dự đoán đủ đơn giản để kiểm toán

Để định giá một thử nghiệm chưa chạy, bạn phải dự đoán kết quả của nó.
Có một dải lựa chọn ở đây, từ "không giả định gì cả" cho đến "huấn luyện một mô hình để đoán."
Chúng tôi chủ động dừng lại sớm trên dải lựa chọn đó: dự đoán của chúng tôi là một phép cộng mà một người đóng góp có thể tự kiểm tra trên một tờ giấy ăn —
*cặp ngôn ngữ này thường đạt điểm số ra sao, mô hình này thường lệch đi thế nào, có bằng chứng huấn luyện (coaching evidence) nào cho chính xác ngôn ngữ này không* —
và không có gì khác. Không có trọng số tự học, không có embedding, không có mô hình nào mà bản thân các định kiến của nó cần phải được kiểm toán.

Điều này khiến chúng tôi phải đánh đổi độ chính xác. Một bộ dự đoán gradient-boosted dựa trên các đặc trưng ngôn ngữ sẽ đoán tốt hơn.
Chúng tôi đánh đổi độ chính xác đó để lấy một đặc tính mà chúng tôi coi trọng hơn: **mọi thứ hạng trên hàng đợi đều có thể được tính toán lại bằng tay từ các con số được in trên chính mục đó.**
Khi ai đó hỏi "tại sao lượt chạy tiếng Faroe này lại ở vị trí số 1?", câu trả lời là bốn con số được công bố và một câu giải thích, chứ không phải "mô hình bảo thế."
Nghiên cứu về học chủ động (active learning) từ lâu đã cân bằng giữa sự tinh vi trong lựa chọn với sự tin cậy và khả năng kiểm tra (Haffari, Roy & Sarkar 2009 đã mang chính sự đánh đổi này vào dịch máy);
một benchmark do tình nguyện viên tài trợ nên thuộc về phía có thể kiểm tra được.

## Những gì chúng tôi không biết: sự tò mò có ngân sách

Một hàng đợi được dẫn dắt hoàn toàn bằng các dự đoán sẽ có một chế độ lỗi (failure mode):
nó tự tin bỏ đói tất cả những gì nó dự đoán kém, và không bao giờ phát hiện ra rằng mình đã sai.
Câu trả lời kinh điển từ tài liệu về bài toán multi-armed bandit là *sự lạc quan khi đối mặt với sự không chắc chắn (optimism in the face of uncertainty)*:
trao cho mỗi lựa chọn chưa thử nghiệm một phần thưởng điểm cộng (bonus) và phần thưởng này sẽ giảm dần khi bằng chứng tích lũy (Auer, Cesa-Bianchi & Fischer 2002).
Hàng đợi của chúng tôi mang chính xác phần thưởng điểm cộng đó — được điều chỉnh tỷ lệ, không phải ngẫu nhiên, theo ngưỡng nhiễu (noise floor) của các công cụ đo lường của chúng tôi:
sự lạc quan không bao giờ vượt quá khoảng 5 điểm chrF++ mà các ngữ liệu phát triển (dev corpora) nhỏ dù sao cũng không thể phân biệt được ([Thiết kế Ngữ liệu §6.3](/docs/network/specifications/corpus-design)).

Sự khiêm tốn tương tự cũng xuất hiện trong hai sự bất đối xứng đáng được nhắc tên:

- **Mọi thứ được công bố đều là bằng chứng; chỉ có các ngữ liệu mở mới là hành động.**
  Kết quả trên các ngữ liệu có giấy phép hạn chế sẽ cung cấp thông tin cho tri thức của mạng lưới,
  nhưng hàng đợi chỉ yêu cầu những người đóng góp chạy những gì mà bất kỳ ai cũng có thể chạy một cách tự do.
- **Bằng chứng huấn luyện (coaching evidence) không tự lan truyền.**
  Nơi các lượt chạy có huấn luyện (coached runs) vượt trội hơn các lượt chạy thông thường (naive runs),
  đó là thực tế được đo lường cho riêng ngôn ngữ đó — và hoàn toàn im lặng về mọi ngôn ngữ khác.
  Hàng đợi giữ thứ tự ưu tiên baseline trước tiên ở bất kỳ nơi nào việc huấn luyện chưa được đo lường,
  thay vì giả định rằng những cải tiến của một ngôn ngữ có thể áp dụng chung cho các ngôn ngữ khác.

## Những gì chúng tôi từ chối thực hiện

- **Không tối ưu hóa mức độ tương tác.** Các mục không bao giờ được sắp xếp để tối đa hóa lượt nhấp chuột, chuỗi ngày hoạt động (streaks), hoặc sự hài lòng khi hoàn thành. Mục tiêu mạng lưới là mục tiêu duy nhất.
- **Không có sự can thiệp biên tập ngầm.** Nếu chúng tôi cần thúc đẩy một cặp ngôn ngữ nào đó (do quan hệ đối tác cộng đồng, thời hạn hoàn thành), nó sẽ xuất hiện dưới dạng một điều khoản có tên và phiên bản rõ ràng trong đặc tả kỹ thuật — chứ không phải là một sự sắp xếp lại âm thầm.
- **Không khóa quyền xác nhận (claim-locking).** Bất kỳ ai cũng có thể chạy bất kỳ mục nào vào bất kỳ lúc nào; các lượt chạy giống hệt nhau sẽ được loại bỏ trùng lặp bằng dấu vân tay (fingerprint) và các lượt tái lập độc lập luôn là bằng chứng được hoan nghênh. Vị trí trong hàng đợi là một lời khuyên, không phải là sự cho phép.
- **Không phô diễn năng lực (capability theater).** Φ và mọi điểm số cấu thành nên nó đều là các con số trên tập phát triển (development-set) với các lưu ý đã biết (giới hạn trên của sự rò rỉ dữ liệu - contamination upper bounds, sự khác biệt về quy mô giữa các ngôn ngữ). Chúng định hướng việc chi tiêu ngân sách; chúng không bao giờ được trích dẫn như là những gì một mô hình "có thể làm được."

## Được xây dựng để chấp nhận sai sót một cách công khai

Công thức này được gắn phiên bản (`ecv-v2`), các tham số của nó được phản ánh trong mọi hàng đợi được công bố, và giả định mô hình hóa trung tâm của nó — rằng chất lượng chuỗi được kết hợp theo phép nhân với một mức giảm trừ cho mỗi điểm nối — giờ đây *có thể kiểm tra được bằng chính dữ liệu của chúng tôi*: mạng lưới chứa các tam giác được đo lường (deu→fra trực tiếp bên cạnh deu→eng và eng→fra), vì vậy chúng tôi có thể chấm điểm các bản dịch dạng chuỗi thực tế so với dự đoán của mô hình và khớp mức giảm trừ một cách thực nghiệm thay vì tự chọn. Khi điều đó xảy ra, phiên bản v3 sẽ công bố rõ, và trang này sẽ giải thích những gì đã thay đổi và tại sao. Đó là tiêu chuẩn mà chúng tôi muốn hướng tới: không phải một hàng đợi luôn luôn đúng, mà là một hàng đợi luôn công khai rõ ràng lập luận của mình.

*Phần toán học, các giá trị mặc định, ví dụ thực tế và các trích dẫn đầy đủ nằm trong [Đặc tả Xây dựng Hàng đợi](/docs/network/specifications/queue-construction).*
