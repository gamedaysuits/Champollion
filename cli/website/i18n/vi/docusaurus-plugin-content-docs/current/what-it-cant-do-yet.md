---
title: "Những điều công cụ chưa thể làm"
slug: /what-it-cant-do-yet
description: "Phần chia sẻ chân thực, bằng những lời mộc mạc: bộ dịch đầu tiên của bạn sẽ còn nhỏ, một bộ dịch dùng được cần rất nhiều câu, và không công cụ nào có thể hứa hẹn chất lượng — chỉ đảm bảo rằng bạn luôn biết rõ mình đang ở đâu."
---

# Những điều công cụ chưa thể làm

Mô hình dịch đầu tiên của bạn có thể sẽ chỉ như một **sổ tay mẫu câu**. Nó sẽ dịch tốt những câu tương tự như các câu nó đã học, và lúng túng với bất kỳ điều gì mới. Điều đó hoàn toàn bình thường: mọi dự án đều bắt đầu từ đó.

Điều giúp mô hình tiến bộ là có thêm nhiều câu hơn — đúng loại câu cần thiết, được kiểm tra bởi một người nói ngôn ngữ đó. Sau mỗi vòng, các công cụ sẽ cho bạn biết liệu mô hình có thực sự tốt hơn hay không, và gợi ý điều gì sẽ giúp ích nhiều nhất tiếp theo. Trang này giải thích một cách mộc mạc những điều bạn nên chuẩn bị đón nhận trên chặng đường này.

## Một mô hình dịch dùng được đòi hỏi rất nhiều câu

Bao nhiêu câu? Chúng tôi chưa biết con số chính xác cho bất kỳ ngôn ngữ thực tế nào. Dưới đây là những gì chúng tôi đã biết.

Chúng tôi đã tạo ra một ngôn ngữ thử nghiệm để máy tính có thể tự động chấm từng câu trả lời: khoảng 2.000 từ, ngữ pháp hoàn toàn theo quy tắc, dữ liệu chuẩn chỉnh. Một mô hình dịch được huấn luyện trên máy tính xách tay sau đó đã dịch các câu giao tiếp hàng ngày hoàn toàn mới mà nó chưa từng thấy, và máy tính đã kiểm tra xem từng câu có mang đúng nghĩa chính xác như câu tiếng Anh hay không:

- sau 6.400 câu ví dụ, **khoảng 79 trên 100 câu** đúng hoàn toàn;
- sau 25.600 câu, **khoảng 96 trên 100 câu**.

Mọi câu chứa từ mà mô hình chưa từng thấy đều dịch sai — chiếm khoảng một phần ba số lỗi ở mốc 6.400 câu; phần còn lại là do ngữ pháp mà nó chưa học. Đó là điều đầu tiên cần biết: **mô hình dịch không thể dịch một từ mà nó chưa từng học.** Vì vậy, các công cụ sẽ chỉ rõ điều này: khi một câu có từ mà mô hình dịch chưa từng thấy trong các bài học, công cụ sẽ báo rõ từ đó — dòng dịch đó rất có thể bị sai, dù đọc lên nghe có trôi chảy đến đâu.

Một ngôn ngữ thực tế phong phú hơn nhiều so với ngôn ngữ thử nghiệm của chúng tôi: có nhiều từ vựng hàng ngày hơn, các từ có nhiều nghĩa, và ngữ pháp thể hiện những điều mà tiếng Anh không nói ra. Vì vậy, những con số này chỉ là mức sàn tối thiểu, không phải là ước tính thực tế. Một ngôn ngữ thực tế sẽ cần nhiều câu hơn, và chúng tôi chưa biết cần nhiều hơn bao nhiêu. Chúng tôi đang tiến hành đo lường điều đó.

Điều đó có ý nghĩa gì về mặt thời gian: chúng tôi chưa đo lường thời gian thực tế của một người nói ngôn ngữ bản địa. Nếu việc viết hoặc kiểm tra một câu mất khoảng một phút, thì 6.400 câu sẽ mất khoảng một trăm giờ. Được chia sẻ giữa các thành viên trong gia đình và một lớp học, mỗi người một hoặc hai giờ mỗi tuần sẽ tích lũy dần — và một mô hình dịch nhỏ sẽ hỗ trợ các cụm từ thường dùng nhất của bạn từ rất lâu trước mốc đó. Bài viết [Cần bao nhiêu câu?](/docs/how-many-sentences) sẽ đi sâu vào chi tiết này.

## Công cụ không thể hứa hẹn một mô hình dịch tốt — chỉ hứa bạn sẽ biết rõ chất lượng của nó

Điểm số đo lường mức độ sát nghĩa của bản dịch so với cách một người bản ngữ diễn đạt câu đó. Một bản dịch tốt nhưng dùng từ khác đi có thể bị chấm điểm thấp, và một bản dịch trôi chảy nhưng sai nghĩa lại có thể nhận điểm khá cao. Đó là lý do tại sao việc người nói ngôn ngữ đó trực tiếp kiểm tra các bản nháp quan trọng hơn bất kỳ con số nào.

Điểm số cũng chỉ phản ánh chất lượng cho những câu tương tự như các câu được dùng để đo lường, và nếu chỉ với vài câu thì điểm số sẽ chưa chuẩn xác — các công cụ hiển thị cho bạn một khoảng điểm, chứ không phải một con số duy nhất. Nó không thể cho bạn biết liệu câu *tiếp theo* mà mô hình viết ra có đúng hay không. Người nói thành thạo ngôn ngữ mới là người quyết định bản dịch có dùng được hay không.

## Chưa có ai hoàn thành trọn vẹn quy trình với một ngôn ngữ thực tế

Chúng tôi đã đi qua từng bước của quy trình nhiều lần, với các ngôn ngữ thử nghiệm và với nhiều trợ lý AI khác nhau, từ một thư mục trống cho đến một mô hình dịch bạn có thể thử nghiệm ngay trên trình duyệt. Trong các lần chạy thử nghiệm gần đây nhất — với các trợ lý AI hỗ trợ một gia đình giả định — hơn một nửa đã gặp sự cố ở bước nào đó. Chúng tôi đã khắc phục các bước đó và đang tiến hành thử nghiệm lại.

Chưa có cộng đồng nào đưa một ngôn ngữ thực tế đi trọn quy trình để tạo ra một mô hình dịch hoạt động hoàn chỉnh trên hệ thống này. Nếu bạn bắt đầu ngay bây giờ, bạn nằm trong số những người tiên phong.

## Một số phần vẫn chưa sẵn sàng

- **Các công cụ hướng dẫn từng bước sẽ đi kèm trong phiên bản tiếp theo.** Cho đến lúc đó, các trang này mô tả cách chúng sẽ hoạt động. Trang [Trước khi bắt đầu](/docs/before-you-begin) là những gì bạn có thể thực hiện hôm nay.
- **Cho phép người khác thử nghiệm mô hình dịch trên các câu của bạn** — mà không bao giờ nhìn thấy nội dung câu — đã hoạt động được, nhưng chưa được tích hợp trọn vẹn vào quy trình. Hiện tại, bạn cần làm theo một tài liệu hướng dẫn dài hơn.
- **Cấu hình máy tính của bạn rất quan trọng.** Một máy Mac đời mới hơn (M1 trở lên) với bộ nhớ 16 GB, hoặc một máy tính có card đồ họa NVIDIA với 16 GB bộ nhớ riêng, có thể xây dựng loại mô hình dịch mạnh mẽ hơn; với 8 GB, bạn có thể tạo phiên bản nhẹ hơn, nhưng phiên bản này chưa được thử nghiệm trên máy tính 8 GB. Trên Windows, các công cụ huấn luyện cần có WSL (môi trường Linux tích hợp sẵn của Windows). Các máy tính khác sẽ chỉ tạo được loại mô hình nhỏ hơn nhiều, vốn có kết quả thua xa trong các thử nghiệm của chúng tôi.
- **Các vòng huấn luyện tiêu tốn thời gian của máy tính.** Hầu hết các vòng huấn luyện đều tiếp nối từ mô hình dịch bạn đang sử dụng thay vì bắt đầu lại từ đầu, nhưng với mô hình mạnh hơn, một vòng huấn luyện vẫn có thể mất nhiều giờ, và mỗi máy tính chỉ có thể huấn luyện một mô hình tại một thời điểm.
- **Hãy giữ các câu ngắn gọn.** Mô hình dịch mạnh hơn chỉ đọc được một độ dài câu nhất định — thậm chí ngắn hơn nếu ngôn ngữ của bạn sử dụng bảng chữ cái riêng. Các công cụ sẽ đếm bất kỳ câu nào quá dài và báo cho bạn biết để bạn có thể chia nhỏ câu đó ra.
- **Chính tả không được tự động kiểm tra.** Nếu mọi người viết chính tả ngôn ngữ đó theo những cách khác nhau, hãy thống nhất một cách viết chung cho toàn bộ dự án trước khi bắt đầu.

## Công cụ không thể ngăn chặn mọi nguy cơ rò rỉ

Đối với các tệp được lưu trữ trên máy tính này — theo mặc định — các công cụ chỉ hiển thị số lượng câu cho trợ lý AI của bạn chứ không hiển thị nội dung câu. Nhưng một trợ lý có quyền thao tác trên máy tính của bạn có thể mở bất kỳ tệp nào bạn mở được, dù bạn có yêu cầu hay không, và hầu hết chúng đều gửi những gì đọc được về công ty vận hành chúng.
Trang [Từ ngữ của bạn, quy tắc của bạn](/docs/your-words-your-rules) giải thích những việc bạn cần làm.

## Mô hình dịch không phải là một ngôn ngữ đang sống

Một mô hình dịch có thể hỗ trợ một chương trình ngôn ngữ, một trường học hoặc một gia đình. Ngôn ngữ thực sự sống trong những người nói ngôn ngữ đó, và trong việc được sử dụng mỗi ngày.
Bài viết [Dịch thuật không phải là hồi sinh ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization) sẽ chia sẻ thêm về điều này.

---

Những giới hạn này sẽ thay đổi cùng với tiến trình phát triển. Khi có thay đổi, trang này cũng sẽ được cập nhật tương ứng.

**Tiếp theo:** [Trước khi bắt đầu →](/docs/before-you-begin)

## Tìm hiểu sâu hơn

- [Các rào chắn kiểm soát, từng bước một](/docs/guardrails) — cách thức hoạt động của từng bước kiểm tra.
- [Các giới hạn kỹ thuật](/docs/network/honest-limitations) — những gì các phép đo bao gồm và không bao gồm, các cấp độ tin cậy đối với điểm số được công bố, quy trình lưu giữ bài kiểm tra niêm phong, và lý do tại sao không đưa ra mức độ tin cậy cho từng câu riêng lẻ.
- Về các con số của ngôn ngữ thử nghiệm: mỗi quy mô chỉ chạy một lần, do đó độ lệch giữa các lần chạy chưa được đo lường. "Đúng hoàn toàn" là kết quả kiểm tra tự động mọi thành phần ý nghĩa — động từ, thì, ngôi, phủ định, chủ ngữ, tân ngữ và nhiều yếu tố khác — dựa trên chính ngữ pháp của ngôn ngữ nhân tạo đó, chứ không phải đánh giá của con người. Mô hình dịch là một mô hình cấp độ byte (byte-level) được huấn luyện trước và tinh chỉnh trên máy tính xách tay chạy Apple silicon. Thời gian huấn luyện thay đổi kết quả rất nhiều (cùng mô hình đó và 6.400 câu chỉ đạt khoảng 27 trên 100 với thời gian huấn luyện bằng một phần tư), vì vậy đây không phải là những giới hạn tuyệt đối. Ở mốc 6.400 câu, khoảng 9 trên 100 bản dịch đọc rất trôi chảy, dùng từ ngữ thực tế, nhưng lại mang một ý nghĩa hoàn toàn khác. Mô hình nhỏ hơn mà các công cụ sử dụng trên những máy tính khác chỉ đạt khoảng 6 trên 100 câu đúng ở mốc 6.400 câu.
- Mô hình dịch mạnh hơn chỉ đọc tối đa 320 byte cho mỗi câu — tương đương khoảng 100 ký tự chữ tượng thanh (syllabics), vì các chữ cái có dấu và chữ cái của các bảng chữ cái khác chiếm từ hai đến bốn byte mỗi chữ. Quá trình huấn luyện sẽ đếm các cặp câu vượt quá giới hạn trước khi cắt ngắn chúng, và dịch vụ dịch thuật khi chạy sẽ thông báo những phần nội dung đã bị cắt bỏ.
