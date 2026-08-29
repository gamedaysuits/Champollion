---
title: "Cách tokenizer quyết định ngôn ngữ nào có chi phí rẻ"
sidebar_label: "Tokenizer"
description: "Trước khi một mô hình ngôn ngữ đọc một từ, có một thứ gì đó đã cắt nó thành nhiều mảnh. Bước này được học từ dữ liệu, tối ưu hóa việc nén thay vì ý nghĩa, và âm thầm quyết định ngôn ngữ nào sẽ tốn nhiều chi phí khi sử dụng. Một bài viết nhập môn dành cho người đọc bắt đầu từ con số không."
---

# Cách một tokenizer quyết định ngôn ngữ nào có chi phí rẻ

:::info[Dành cho ai]
Bất kỳ ai. Trang này giả định rằng bạn không có kiến thức nền tảng về học máy (machine-learning) hay ngôn ngữ học. Nếu bạn biết mô hình ngôn ngữ là gì — một phần mềm tiếp nhận văn bản và tạo ra văn bản — như vậy là đủ.
:::

Mọi mô hình ngôn ngữ đều có một bước đầu tiên vô hình. Trước khi đọc một từ, một phần mềm sẽ cắt từ đó thành các mảnh nhỏ (fragment). Những mảnh nhỏ này mới chính là thứ mà mô hình thực sự nhìn thấy.

Bước đó được gọi là **tokenization** (mã hóa token), và hầu như không ai để ý đến nó. Nó đáng để xem xét, bởi vì đây là điểm khiến một số ngôn ngữ trở nên đắt đỏ hơn gấp nhiều lần khi sử dụng so với các ngôn ngữ khác — và quyết định này được đưa ra trước cả khi bất kỳ ai nghĩ đến chất lượng, sự công bằng hay độ bao phủ.

---

## 1. Mô hình không biết đọc

Một mạng nơ-ron (neural network) thực hiện các phép toán số học trên các con số. Nó không có khái niệm về chữ cái hay từ ngữ. Vì vậy, văn bản phải được chuyển thành số trước tiên.

**Tokenizer** là phần mềm thực hiện việc chuyển đổi đó, và đảo ngược quá trình này ở bước cuối. Nó biến một chuỗi (string) thành một danh sách các số nguyên (integer), mỗi số nguyên trỏ đến một hàng trong một bảng tra cứu (lookup table) lớn.

Nó đưa ra hai quyết định:

**Tập từ vựng (The vocabulary)** — kho chứa cố định các mảnh mà mô hình được phép nhìn thấy. Không phải là từ: mà là *các mảnh (pieces)*. Những mảnh phổ biến là các từ nguyên vẹn, nhưng những thành phần hiếm gặp hơn sẽ bị chia nhỏ. Kho chứa này có kích thước cố định, được chọn từ trước — thường là hàng chục nghìn mục.

**Sự phân đoạn (The segmentation)** — đối với bất kỳ chuỗi thực tế nào, nó sẽ dùng những mảnh nào, theo thứ tự nào. Từ *unbelievable* có thể trở thành `un` + `believ` + `able`, hoặc một mảnh duy nhất, hoặc mười một chữ cái đơn lẻ. Bạn nhận được kết quả nào hoàn toàn phụ thuộc vào những gì có trong tập từ vựng.

> **Ví dụ thực tế.** Nếu `believ` có trong tập từ vựng, từ *unbelievable* sẽ tiêu tốn ba mảnh. Nếu không có, tokenizer sẽ lùi lại (fall back) dùng các mảnh nhỏ hơn và nhỏ hơn nữa cho đến khi nó có thể bao phủ toàn bộ từ — có thể là một mảnh cho mỗi chữ cái. Cùng một từ, cùng một nghĩa, nhưng có thể tốn gấp ba hoặc gấp mười một lần số mảnh, tùy thuộc vào một quyết định đã được đưa ra từ rất lâu trước khi bạn gõ từ đó.

---

## 2. Tập từ vựng được *học*, và nó tối ưu hóa sai mục tiêu

Đây là phần khiến nhiều người ngạc nhiên.

Tập từ vựng không do một nhà ngôn ngữ học thiết kế. Nó được **học từ một tập văn bản**, bởi một thuật toán có mục tiêu là **nén (compression)** — bao phủ văn bản này bằng càng ít mảnh càng tốt.

Ý nghĩa không đóng vai trò gì ở đây. Thuật toán không biết từ là gì, tiền tố là gì, hay một ngôn ngữ có tồn tại hay không. Nó đếm những gì thường xuất hiện cùng nhau, và cấp cho các chuỗi xuất hiện thường xuyên một mục riêng vì điều đó làm cho văn bản ngắn lại.

Hệ quả xảy ra một cách máy móc. Các mảnh được phân bổ cho một ngôn ngữ gần như tỷ lệ thuận với **khối lượng của ngôn ngữ đó trong tập văn bản**. Một ngôn ngữ chiếm tỷ trọng lớn sẽ có nhiều mảnh dành riêng cho nó, và các từ của nó sẽ xuất hiện nguyên vẹn hoặc gần như nguyên vẹn. Một ngôn ngữ hầu như không có mặt sẽ gần như không có mảnh nào của riêng nó, và các từ của nó sẽ được bao phủ bởi bất kỳ mảnh chung chung nào tình cờ khớp được.

Một ngôn ngữ hoàn toàn không có trong tập văn bản sẽ nhận được **không** mảnh dành riêng nào. Nó vẫn hoạt động — tokenizer sẽ luôn tìm ra *một* cách nào đó để biểu diễn văn bản, vì nó có thể lùi về sử dụng các ký tự đơn lẻ hoặc byte thô. Chỉ là chi phí để nói bất cứ điều gì sẽ đắt hơn rất nhiều.

:::note[Đây không phải là lỗi (bug)]
Không có gì hoạt động sai cả. Thuật toán nén đã làm chính xác những gì nó được yêu cầu. Vấn đề là "làm cho văn bản huấn luyện ngắn lại" đã được chấp nhận như một thước đo thay thế (proxy) cho "biểu diễn ngôn ngữ tốt", và đối với các ngôn ngữ vắng mặt trong văn bản đó, thước đo thay thế này hoàn toàn thất bại.
:::

---

## 3. Fertility: con số gọi tên mức độ thiệt hại

**Fertility** là số lượng token trung bình mà một từ tiêu tốn.

Đối với một ngôn ngữ mà tokenizer được huấn luyện nhiều, fertility sẽ gần bằng 1 — hầu hết các từ là một mảnh duy nhất. Đối với một ngôn ngữ mà nó chưa từng thấy, cùng một thước đo này có thể cao hơn gấp nhiều lần, vì mọi từ đều phải được lắp ráp từ các mảnh nhỏ.

Con số duy nhất đó kéo theo bốn loại "thuế" riêng biệt:

| Thuế | Ý nghĩa |
|---|---|
| **Chi phí (Cost)** | Hầu hết các mô hình thương mại tính phí theo token. Nhiều token hơn cho mỗi từ có nghĩa là cùng một câu sẽ tốn nhiều tiền hơn để dịch, tóm tắt hoặc tạo ra. |
| **Ngữ cảnh (Context)** | Các mô hình có một cửa sổ (window) cố định. Fertility cao có nghĩa là tài liệu thực tế của bạn sẽ khớp được ít hơn vào cửa sổ đó. |
| **Tính toán (Compute)** | Các chuỗi dài hơn sẽ chậm hơn, ở mọi nơi, mãi mãi. |
| **Học tập (Learning)** | Điều khó khăn nhất. Ý nghĩa giờ đây bị bôi ra trên nhiều mảnh chứa ít thông tin, do đó mô hình phải giải quyết một bài toán khó hơn — ngay cả với dữ liệu giống hệt nhau. |

Ba điều đầu tiên là sự bất công. Điều thứ tư mới là thứ làm giảm chất lượng.

**Điều này đã được đo lường, không phải là phỏng đoán.** Petrov, La Malfa, Torr và Bibi đã phát hiện ra rằng cùng một văn bản, khi được dịch sang các ngôn ngữ khác nhau, có thể chênh lệch độ dài sau khi token hóa **lên đến 15 lần**, và sự chênh lệch này vẫn tồn tại ở các tokenizer được xây dựng có chủ đích cho việc sử dụng đa ngôn ngữ.

Phát hiện của họ làm phức tạp thêm một cách khắc phục hiển nhiên: các mô hình cấp độ ký tự (character-level) và cấp độ byte (byte-level) — câu trả lời theo trực giác là "chỉ cần dùng chữ cái, khi đó mọi ngôn ngữ đều bình đẳng" — vẫn cho thấy sự chênh lệch **hơn 4 lần** đối với một số cặp ngôn ngữ. Việc lùi về các đơn vị nhỏ hơn chỉ thu hẹp khoảng cách. Nó không xóa bỏ được khoảng cách đó.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Tại sao điều này ảnh hưởng đến một số ngôn ngữ về mặt cấu trúc, chứ không chỉ về mặt thống kê

Sự thiếu hụt đại diện trong tập dữ liệu huấn luyện là một nguyên nhân. Có một nguyên nhân thứ hai, và nó không biến mất khi thêm dữ liệu.

Các ngôn ngữ khác nhau ở khối lượng công việc mà một từ duy nhất đảm nhận.

Trong tiếng Anh, một câu chủ yếu là các từ riêng biệt xếp thành hàng: *I saw them*. Ba từ, ba khái niệm, có khoảng trắng ở giữa. Các tokenizer được xây dựng bởi những người làm việc trên các ngôn ngữ hoạt động theo cách này, và họ mặc định điều đó — hầu hết các tokenizer thực sự coi khoảng trắng là ranh giới của một mảnh.

Các ngôn ngữ khác xây dựng toàn bộ một mệnh đề thành **một từ**, bằng cách xếp chồng các phần có nghĩa lên nhau. Các nhà ngôn ngữ học gọi đây là các ngôn ngữ **đa tổng hợp (polysynthetic)**, và chúng rất phổ biến trong các ngôn ngữ Bản địa ở Châu Mỹ, cũng như ở những nơi khác.

> **Ví dụ thực tế.** Trong tiếng Plains Cree (nêhiyawêwin), *nikî-wâpamâwak* có nghĩa đại khái là "Tôi đã thấy họ". Nó là một từ. Bên trong nó là một vài phần có nghĩa: ai đang hành động, hành động đó ở trong quá khứ, bản thân việc nhìn thấy, và ai đang bị nhìn thấy.
>
> Một người nói tiếng Anh cần bốn từ cho câu đó, và một tokenizer được huấn luyện trên tiếng Anh có thể sẽ tiêu tốn bốn mảnh. Một tokenizer chưa từng thấy tiếng Cree sẽ không có mục nào cho bất kỳ phần nào trong số đó, vì vậy nó xé nát từ duy nhất này thành các mảnh nhỏ mà không tôn trọng bất kỳ ranh giới mang ý nghĩa nào.

Hai thứ bị phá hỏng cùng một lúc. Từ này tiêu tốn nhiều mảnh hơn mức cần thiết rất nhiều — và các mảnh này **cắt ngang qua các đơn vị ý nghĩa**, do đó mô hình phải lắp ráp lại một cấu trúc mà tokenizer vừa mới phá hủy.

Việc thêm nhiều văn bản tiếng Cree hơn vào tập dữ liệu huấn luyện sẽ cải thiện vấn đề đầu tiên. Nó chỉ giúp ích một phần cho vấn đề thứ hai, bởi vì thuật toán vẫn đang tối ưu hóa việc nén, và việc nén không biết rằng một ranh giới là có ý nghĩa.

---

## 5. Từ tokenization đến một câu trả lời sai

Chuỗi đi từ "phân đoạn tồi" đến "đầu ra sai" rất ngắn.

1. Tokenizer ngắt một từ tại các ranh giới không mang ý nghĩa.
2. Mô hình học được các mối liên kết yếu hơn, bởi vì cùng một khái niệm xuất hiện dưới nhiều cách viết mảnh khác nhau thay vì một mảnh nhất quán.
3. Khi tạo văn bản, mô hình lắp ráp đầu ra theo từng mảnh một.
4. Các mảnh mà khi đứng riêng lẻ có vẻ hợp lý có thể kết hợp thành một từ **không tồn tại** trong ngôn ngữ đó.

Bước cuối cùng đó là điều cần phải lưu tâm. Trong một ngôn ngữ mà các từ được xây dựng từ các bộ phận, một mô hình có thể tạo ra thứ gì đó trông có vẻ đúng cấu trúc đối với bất kỳ ai không nói ngôn ngữ đó — các mảnh trông có vẻ đúng, được lắp ráp thành một từ mà không một người bản xứ nào từng nói.

Việc chấm điểm tự động tiêu chuẩn thường sẽ không phát hiện ra điều này, bởi vì các điểm số đó chủ yếu đo lường sự trùng lặp với một câu trả lời tham chiếu, và một từ sai được tạo thành từ các mảnh trông-có-vẻ-đúng vẫn có thể trùng lặp.

:::danger[Tại sao điều này quan trọng hơn cả điểm số chất lượng]
Một đầu ra trôi chảy nhưng sai lệch còn nguy hiểm hơn một đầu ra bị hỏng rõ ràng. Một người đọc không nói ngôn ngữ đó không có cách nào để nhận biết. Đây là một phần lớn lý do tại sao Champollion nhấn mạnh vào việc xác thực bởi những người nói ngôn ngữ đó, và vào các kiểm tra cấu trúc đặt câu hỏi "đây có phải là một từ có thật không?" thay vì chỉ hỏi "điều này có giống với câu trả lời mong đợi không?"
:::

---

## 6. Ai là người quyết định, và tại sao đó mới là vấn đề thực sự

Mọi thứ ở trên đều bắt nguồn từ một lựa chọn: **văn bản nào đã được đưa vào tập dữ liệu mà tokenizer học từ đó.**

Bất cứ ai đưa ra lựa chọn đó đều quyết định cách mọi ngôn ngữ sẽ bị cắt nhỏ, chi phí sử dụng nó là bao nhiêu, và mô hình sẽ phải làm việc vất vả như thế nào để biểu diễn nó. Quyết định đó được đưa ra một lần, từ rất sớm, thường là bởi một nhóm nhỏ, và nó gần như là vĩnh viễn trong suốt vòng đời của mô hình đó — tokenizer không phải là thứ bạn có thể điều chỉnh sau này.

Nó cũng hầu như không bao giờ được thảo luận. Các cuộc tranh luận về công nghệ ngôn ngữ thường xoay quanh dữ liệu, kích thước mô hình và điểm số chất lượng. Bước quyết định xem một ngôn ngữ có thể được biểu diễn hay không lại nằm bên dưới tất cả những thứ đó, và bị coi như một công việc kỹ thuật nền tảng (plumbing).

Đó là lý do tại sao trang này tồn tại. Nếu một cộng đồng muốn có quyền kiểm soát thực sự đối với cách ngôn ngữ của họ được xử lý bởi máy móc, thì việc kiểm soát dữ liệu là không đủ. Câu hỏi *"ai đã quyết định cách các từ của chúng ta bị cắt thành từng mảnh?"* có một câu trả lời, và đối với hầu hết các ngôn ngữ trên thế giới, câu trả lời hiện tại là: một người khác, như một tác dụng phụ của việc nén một tập văn bản mà hầu như không chứa ngôn ngữ đó.

---

## Bước tiếp theo

- [Champollion là gì](/docs/what-is-champollion) — dự án mà trang này thuộc về, và những gì nó thực hiện đối với các vấn đề trên.
- [Cách các mô hình được huấn luyện](/docs/network/context/mt-training-concepts) — từ vựng cho bước *sau* tokenization, với cùng một cách tiếp cận bắt-đầu-từ-con-số-không.
- [Những hạn chế thực tế](/docs/network/honest-limitations) — những gì dự án này **không** tuyên bố.
- [Quản lý dữ liệu](/docs/network/sovereignty/data-sovereignty) — ai nắm giữ chìa khóa của một kho ngữ liệu (corpus), và điều đó có ý nghĩa gì trong thực tế.
