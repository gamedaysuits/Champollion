---
title: "Cách thức hoạt động"
slug: /how-it-works
description: "Ý nghĩa của “theo lộ trình với rào chắn an toàn”: từng bước xây dựng một công cụ dịch được sắp xếp rõ ràng theo thứ tự, cùng các bước kiểm tra giúp ngăn chặn những lỗi thường gặp và giữ cho ngôn từ luôn nằm trong tầm kiểm soát của bạn."
---

# Cách hoạt động: trên đường ray cùng các rào chắn

Hãy hình dung hai dòng chữ chạy song song: một câu ở ngôn ngữ này, và chính
câu đó ở ngôn ngữ kia. Đó là những gì một bộ dịch học từ đó, và cũng là những
gì nó viết ra.

Trước đây, việc xây dựng một bộ dịch cần đến chuyên gia. Bạn phải biết cách
chuẩn bị các câu ngữ liệu, cách dạy bộ dịch, và — khó nhất trong tất cả — cách
kiểm tra nó mà không tự lừa dối chính mình. Hầu hết những bài học đó đều phải
trả giá bằng nhiều lần vấp ngã.

Champollion sắp đặt tất cả theo các **đường ray**: từng bước theo thứ tự, và mọi
thứ đều có chỗ riêng. Dọc theo đường ray là các **rào chắn**: những điểm kiểm
tra giúp ngăn chặn các lỗi thường gặp và giữ cho câu chữ luôn nằm trong tầm kiểm
soát của bạn. Bạn — hoặc một trợ lý AI mà bạn tin cậy — sẽ đi theo đường ray.
Bạn là người đưa ra các quyết định.

## Ai quyết định điều gì

Đường ray thực hiện các bước. Con người đưa ra quyết định. Mỗi bước thuộc một trong bốn loại:

- **Chỉ con người mới làm được** — viết các câu và kiểm tra bản dịch.
  Không công cụ nào được phép giả vờ là người nói ngôn ngữ này.
- **Chỉ bạn mới có thể trả lời** — câu từ của bạn thuộc về ai, bộ dịch
  có được phép học từ chúng hay không, bạn kỳ vọng điều gì trước khi nhìn thấy
  bất kỳ kết quả nào. Trợ lý của bạn sẽ hỏi; nó không bao giờ tự ý trả lời thay bạn.
- **Trợ lý của bạn hỏi trước** — bất kỳ việc gì liên quan đến cài đặt, huấn luyện
  bộ dịch, tốn chi phí hoặc đưa bất cứ thứ gì lên mạng đều phải chờ bạn đồng ý. *Chưa
  phải lúc này* cũng là một câu trả lời: đường ray sẽ không hỏi lại trong phiên làm việc đó.
- **Trợ lý của bạn tự động thực hiện** — chẳng hạn như kiểm tra lỗi trong câu, hoặc
  tách riêng một số câu ra.

## Đường ray: mọi thứ đều có chỗ riêng

Một dự án là một thư mục trên máy tính của bạn, với từng ngăn cho mỗi loại tài liệu:

| Ngăn | Những gì nằm trong đó |
|---|---|
| Câu dùng để học | Các cặp câu, mỗi câu ở một ngôn ngữ |
| Câu kiểm thử | Các câu do người nói thành thạo kiểm tra. Chỉ dùng để đánh giá, không bao giờ dùng để học |
| Danh sách từ | Từ điển và danh sách từ vựng |
| Ghi chú ngữ pháp | Bất cứ tài liệu nào viết về cách ngôn ngữ hoạt động |
| Thỏa thuận | Ghi chép về việc ai đã đồng ý điều gì và vào lúc nào |
| Hộp thư đến | Các tệp của bạn, theo nguyên trạng hiện có, đang chờ được đưa vào |

Các bộ dịch bạn xây dựng, kết quả của chúng và bản ghi lại từng bước đều có
ngăn riêng.

Các câu của bạn sẽ được chia vào ba nhóm. Phần lớn dùng để **học**. Một số câu — ban
đầu là một phần tư, khi bạn đã có nhiều thì là một phần mười — trở thành các **câu
luyện tập** — giống như những câu hỏi bài tập, được dùng qua mỗi vòng
để xem nó hoạt động ra sao. Một số ít, được người nói ngôn ngữ này kiểm tra, là các **câu
kiểm tra**, chỉ thỉnh thoảng mới dùng đến. Trình dịch không bao giờ học từ
hai nhóm cuối này.

Vì mọi thứ đều có chỗ riêng, các công cụ luôn nắm được việc gì đã làm xong và
việc gì tiếp theo. Hãy hỏi chúng bất cứ lúc nào, chúng sẽ chỉ ra **bước tiếp theo**,
đọc trực tiếp từ thư mục. Trợ lý của bạn không cần phải là chuyên gia, cũng không
cần nhớ bạn đã dừng lại ở đâu. Nó chỉ cần đi theo đường ray.

Các bước diễn ra theo thứ tự sau:

1. **Bắt đầu dự án** — đặt tên hai ngôn ngữ và chọn chiều dịch.
2. **Thu thập dữ liệu** — đưa vào những gì bạn có, và ghi lại chúng thuộc về
   ai cũng như được phép sử dụng như thế nào.
3. **Bảo vệ bộ kiểm thử** — để riêng các câu mà bạn sẽ dùng để đánh giá mọi
   bộ dịch.
4. **Cài đặt các công cụ huấn luyện** — một lần duy nhất, khi bạn đồng ý.
5. **Xây dựng và kiểm thử bộ dịch** — dạy bộ dịch, rồi xem nó thể hiện ra sao
   trên các câu kiểm thử.
6. **Cải thiện qua từng vòng** — người nói ngôn ngữ này kiểm tra các bản thảo, và mỗi
   vòng đều tập trung vào những chỗ dịch sai.

Bạn luôn có thể thực hiện một bước theo cách riêng của mình — làm thủ công hoặc dùng
công cụ khác — và đường ray sẽ tiếp tục từ đúng vị trí được ghi nhận trong thư mục.

## Các rào chắn

Rào chắn có hai loại.

**Một loại giúp bạn không tự lừa dối mình.** Một bộ dịch được kiểm tra trên các câu
mà nó đã học trông có vẻ xuất sắc nhưng thực chất không phải vậy. Một vòng may mắn
trông như thể là một bước tiến. Vì vậy, đường ray:

- tách riêng các câu kiểm thử trước khi bắt đầu dạy,
- loại bỏ các câu gần như sao chép lại chúng,
- yêu cầu bạn viết ra kỳ vọng trước khi xem kết quả,
- và chỉ công nhận một bộ dịch mới là tốt hơn khi nó vượt qua bộ dịch cũ nhờ
  thực lực chứ không chỉ do may mắn.

**Một loại giữ cho câu từ luôn thuộc quyền kiểm soát của bạn.** Mỗi tệp đều có một ghi
chú nêu rõ quyết định của những người sở hữu nó — tệp có được phép rời khỏi máy tính này
không, bộ dịch có được học từ đó không — và mọi công cụ đều phải tuân theo ghi chú này.

Các công cụ từ chối bỏ qua hầu hết những bước kiểm tra này. Một vài bước phụ thuộc vào
bạn và trợ lý của bạn, và [trang rào chắn](/docs/guardrails) sẽ giải thích rõ đó là những bước nào.

**Tiếp theo:** [Chi tiết từng rào chắn →](/docs/guardrails)

## Tìm hiểu sâu hơn

- [Quy ước vận hành cho các tác tử AI](/docs/agents/contract) — các quy tắc mà một
  trợ lý tuân theo trên đường ray, và quy tắc nào do chính các công cụ thực thi.
- [Từng lệnh, từng bước một](/docs/agents/shell) — bản hướng
  dẫn kỹ thuật đầy đủ.
- [Cách quy trình dịch ứng dụng hoạt động](/docs/concepts/how-sync-works) —
  nếu bạn đến đây để dịch văn bản của ứng dụng hoặc trang web.
