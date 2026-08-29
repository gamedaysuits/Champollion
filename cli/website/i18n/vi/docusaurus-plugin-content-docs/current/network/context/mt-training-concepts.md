---
sidebar_position: 0
title: "Huấn luyện MT bằng ngôn ngữ dễ hiểu"
description: "Bảng thuật ngữ không yêu cầu nền tảng kiến thức về các từ vựng cần thiết để huấn luyện mô hình dịch thuật — mỗi thuật ngữ đều được định nghĩa kèm theo ví dụ thực tế, được viết dành cho những người điều khiển coding agent."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# Huấn luyện MT bằng ngôn ngữ dễ hiểu

Huấn luyện một mô hình dịch máy (MT) có thuật ngữ riêng của nó, và hầu hết chúng không bao giờ được giải thích cho người mới bắt đầu — chúng được mặc định là đã biết. Trang này không mặc định điều gì cả. Mọi thuật ngữ dưới đây đều được định nghĩa bằng những từ ngữ dễ hiểu và gắn liền với một ví dụ cụ thể, để khi bạn đọc [hướng dẫn huấn luyện](/docs/network/tutorials/train-your-own-model) hoặc xem agent lập trình của bạn chạy một lệnh, bạn biết những từ đó có nghĩa là gì và quan trọng hơn là **từ nào trong số chúng đang che giấu những sai lầm âm thầm phá hỏng kết quả.**

:::info[Dành cho ai]
Bạn không cần phải viết Python. Cách làm việc được kỳ vọng hiện nay là
**chỉ đạo một agent lập trình** — Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity hoặc tương tự — để chạy các công cụ cho bạn. Nhiệm vụ của bạn là
hiểu rõ các khái niệm để đưa ra hướng dẫn tốt và đọc kết quả một cách trung thực.
Đó chính xác là mục đích của trang này. Khi chúng tôi đề cập đến một công cụ,
chúng tôi muốn nói đến [**nmt-forge**](/docs/network/getting-started/training-honestly),
bộ công cụ huấn luyện tích hợp các ý tưởng này; tuy nhiên, các thuật ngữ này là của
toàn bộ lĩnh vực chứ không phải của riêng chúng tôi.
:::

Một ví dụ xuyên suốt sẽ liên kết toàn bộ trang này lại với nhau. Giả sử bạn muốn xây dựng một mô hình dịch từ **tiếng Anh → một ngôn ngữ nghèo tài nguyên (low-resource language)** — tạm gọi là *ngôn ngữ đích (target language)* của bạn — ngôn ngữ mà hầu như không có văn bản dịch nào tồn tại. Mọi thứ dưới đây đều là một phần của dự án đó.

---

## 1. Hai nhóm dữ liệu: dữ liệu huấn luyện và dữ liệu đánh giá

**Dữ liệu song ngữ (Parallel data)** là văn bản được ghép cặp với bản dịch của nó — cùng một ý nghĩa trong hai ngôn ngữ, được xếp thẳng hàng theo từng câu.

> `The children are playing.` → `awâsisak mêtawêwak.`

Một mô hình học bằng cách nghiên cứu hàng nghìn cặp như vậy. Nhưng bạn phải giữ các cặp này trong **hai nhóm riêng biệt không bao giờ được chạm vào nhau**:

- **Dữ liệu huấn luyện (Training data)** — các cặp câu mà mô hình *được phép nghiên cứu*. Nó đọc đi đọc lại những câu này và tự điều chỉnh để tái tạo lại chúng.
- **Dữ liệu đánh giá (Evaluation data** hoặc **eval data)** — các cặp câu mà mô hình *không bao giờ được phép nhìn thấy trong quá trình huấn luyện*. Bạn giấu bản dịch đi, yêu cầu mô hình dịch trực tiếp từ phía nguồn mà không có gợi ý nào, rồi so sánh câu trả lời của nó với sự thật được giấu kín. Đây là thước đo trung thực duy nhất để biết nó đã học cách *dịch* hay chỉ là *học vẹt (ghi nhớ)*.

:::tip[Tóm tắt toàn bộ trang này trong một câu]
Một bài kiểm tra chỉ có ý nghĩa nếu mô hình chưa từng nhìn thấy đáp án. Hầu như mọi sai lầm dưới đây đều là những cách khác nhau khiến đáp án bị rò rỉ từ nhóm đánh giá sang nhóm huấn luyện mà không ai nhận ra.
:::

### Dữ liệu song ngữ thực tế so với dữ liệu tổng hợp

- **Dữ liệu song ngữ thực tế (hoặc dữ liệu *vàng - gold*)** là do con người tạo ra: sách giáo khoa song ngữ, hồ sơ chính phủ do con người dịch, các câu chuyện được cộng đồng lưu trữ. Nó đáng tin cậy nhưng đối với hầu hết các ngôn ngữ, nó cực kỳ khan hiếm — thường chỉ có vài trăm cặp câu.
- **Dữ liệu song ngữ tổng hợp (Synthetic parallel data)** được *tạo ra* bằng một chương trình thay vì do con người viết. Khi bạn chỉ có 400 cặp câu thực tế, bạn không thể huấn luyện một mô hình có thể sử dụng được — vì vậy bạn tạo ra hàng trăm nghìn cặp câu bổ sung từ các quy tắc (xem thêm cách thực hiện trong [§7](#7-manufacturing-data-when-you-dont-have-enough)).

Mối quan hệ này vô cùng quan trọng:

> **Ví dụ thực tế.** Một dự án có 435 cặp câu tiếng Anh→Cree thực tế và tạo ra khoảng 1.000.000 cặp câu tổng hợp. Mô hình được huấn luyện trên nhóm dữ liệu tổng hợp lớn *cộng với* vài trăm cặp câu thực tế. Dữ liệu tổng hợp giúp mở rộng độ bao phủ; dữ liệu thực tế giúp mô hình bám sát cách ngôn ngữ được sử dụng trong thực tế. Toàn bộ kỹ nghệ nằm ở việc (a) làm cho nhóm dữ liệu tổng hợp bao phủ càng nhiều ngôn ngữ càng tốt, và (b) chỉ đo lường trên văn bản thực tế mà mô hình chưa từng chạm tới.

:::danger[Không bao giờ kiểm tra trên dữ liệu tổng hợp]
Một tập đánh giá phải **chỉ chứa dữ liệu thực tế**. Nếu bạn kiểm tra trên các câu được tạo ra nhân tạo, bạn đang đo lường xem mô hình có khớp với *trình tạo (generator)* của bạn hay không — chứ không phải liệu nó có thể dịch được hay không. Một bộ công cụ huấn luyện tốt sẽ từ chối đăng ký các hàng dữ liệu tổng hợp làm tập kiểm tra.
:::

---

## 2. Phân chia dữ liệu: train, dev, và test

Bạn bắt đầu với một nhóm các cặp câu thực tế và **chia** nó thành ba vai trò.

| Phân chia (Split) | Tên gọi khác | Mục đích | Mô hình có nhìn thấy trong lúc huấn luyện không? |
|---|---|---|---|
| **train** | tập huấn luyện (training set) | Các cặp câu mô hình nghiên cứu | Có |
| **dev** | tập xác thực (validation set), held-in | Quyết định *khi nào nên dừng* và *phiên bản nào là tốt nhất* | Không (chỉ được *tính điểm*, không bao giờ nghiên cứu) |
| **test** | held-out, tập đánh giá (evaluation set) | Điểm số trung thực cuối cùng | **Không bao giờ** |

Có hai ý tưởng ẩn giấu trong bảng đó:

- **Held-out** chỉ đơn giản có nghĩa là "được để riêng ra và tránh xa quá trình huấn luyện." Một tập test được giữ riêng (held out) một cách có chủ đích.
- **Tập dev** là đứa con thứ thông minh. Mô hình không bao giờ *nghiên cứu* nó, nhưng bạn *nhìn trộm* xem mô hình hoạt động tốt như thế nào trên tập này trong quá trình huấn luyện để đưa ra quyết định — giống như một bài thi thử cho bạn biết có nên tiếp tục học hay không, mà không phải là bài thi thật. Sử dụng tập dev theo cách này là hợp lệ; sử dụng tập *test* theo cách này là gian lận (xem [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Tập niêm phong (Sealed sets) và chia lại (re-splits)

- Một **tập niêm phong (sealed set)** là một tập test chỉ được tính điểm **đúng một lần**. Khoảnh khắc bạn nhìn vào điểm số của mình trên tập đó, nó đã bị "tiêu hao" — bởi vì một khi bạn biết con số đó, mọi quyết định sau này của bạn sẽ bị ảnh hưởng một cách tinh vi bởi nó. Các tập niêm phong là cách các cuộc thi và cộng đồng giữ cho điểm số cuối cùng thực sự là cuối cùng.
- **Chia lại (re-split)** là khi bạn xây dựng lại việc phân chia train/dev/test từ đầu — thường là vì bạn phát hiện ra lần chia cũ đã bị rò rỉ (contaminated). Bạn không thể sửa một lần chia bị rò rỉ bằng cách xóa một vài hàng; bạn phải gom nhóm lại mọi thứ và phân chia lại từ đầu ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) giải thích lý do tại sao).

---

## 3. "Huấn luyện" thực sự làm gì: loss (hàm mất mát), và hai khía cạnh của nó

Huấn luyện là một vòng lặp. Mô hình đưa ra dự đoán, xem nó đã sai như thế nào, và điều chỉnh các con số nội bộ của nó để bớt sai hơn một chút vào lần sau — lặp đi lặp lại hàng triệu lần.

**Loss** là con số duy nhất đo lường mức độ "sai lệch". Thấp hơn là tốt hơn. Nhưng có *hai* loại loss, và việc nhầm lẫn chúng là một cái bẫy kinh điển:

- **Training loss** — mức độ sai lệch của mô hình trên các cặp câu mà nó đang tích cực nghiên cứu. Chỉ số này hầu như luôn tiếp tục giảm, bởi vì trong giới hạn, mô hình có thể chỉ đơn giản là *học vẹt* các cặp câu huấn luyện.
- **Dev loss** (validation loss) — mức độ sai lệch của mô hình trên tập dev được giữ lại mà nó *không* nghiên cứu. Đây là tín hiệu trung thực. Khi dev loss ngừng cải thiện trong khi training loss vẫn tiếp tục giảm, mô hình đã ngừng *học ngôn ngữ* và bắt đầu *học vẹt tập huấn luyện*.

> **Ví dụ thực tế.** Sau một thời gian, bạn thấy training loss ở mức 0.8 và đang giảm, nhưng dev loss bị kẹt ở mức 1.9 và đang tăng *lên*. Khoảng cách đó là dấu hiệu: mô hình đang trở nên tốt hơn trong việc học thuộc lòng các cặp câu huấn luyện của nó và không hề tốt hơn — thậm chí tệ hơn — trong việc dịch bất kỳ thứ gì mới.

### Loss chỉ là đại diện. Giải mã (Decoding) mới là thực tế.

Đây là một chi tiết tinh vi khiến gần như tất cả mọi người vấp ngã. Loss đo lường xem mô hình có gán xác suất cao cho từ tiếp theo chính xác hay không *khi câu trả lời đúng đã ở ngay trước mặt nó*. Điều đó **không** giống với việc mô hình thực sự tự mình tạo ra một bản dịch tốt.

- **Giải mã (Decoding** - còn gọi là *tạo sinh (generation)* hoặc *suy luận (inference)*) là việc mô hình **thực sự dịch**: chỉ được cung cấp câu nguồn, nó sẽ tạo ra câu đích từng từ một mà không có gì để dựa vào.
- **Loss** là một *chỉ số đại diện (proxy)* chi phí thấp được tính toán trong quá trình huấn luyện. Nó có tương quan với chất lượng, nhưng không hoàn hảo.

> **Ví dụ thực tế.** Hai checkpoint có dev loss gần như giống hệt nhau, nhưng khi bạn *giải mã (decode)* các câu trong tập dev và tính điểm các bản dịch thực tế, một checkpoint rõ ràng trôi chảy hơn. Loss không thể thấy sự khác biệt đó; việc giải mã thì có thể. Đây là lý do tại sao việc lựa chọn checkpoint nghiêm túc sẽ giải mã tập dev và tính điểm đầu ra thực tế, thay vì chỉ tin tưởng vào loss.

:::note["Liệu dev loss có theo sát chất lượng không?" là một câu hỏi mở, không phải truyền thuyết]
Bạn sẽ nghe thấy những tuyên bố đầy tự tin rằng "eval loss nói dối." Hãy coi đó là điều **chưa được xác định**, chứ không phải đã được chứng minh — phần lớn truyền thuyết đó đến từ các thử nghiệm bị rò rỉ dữ liệu. Quan điểm trung thực: dev loss là một tín hiệu hữu ích, chi phí thấp; một **hệ số đo lường tạo sinh (generation metric)** trên tập dev (giải mã, sau đó tính điểm) là một tín hiệu trực tiếp hơn. Hãy ưu tiên tín hiệu trực tiếp cho các quyết định cuối cùng, và đừng lặp lại câu "loss nói dối" như một sự thật hiển nhiên.
:::

---

## 4. Nhiễm độc (Contamination) và rò rỉ (leakage): sai lầm phá hỏng kết quả

**Nhiễm độc (Contamination)** (hoặc **rò rỉ - leakage**) có nghĩa là các đáp án đánh giá đã bí mật lọt vào nhóm dữ liệu huấn luyện. Mô hình sau đó "đạt điểm tuyệt đối" nhờ trí nhớ, điểm số của bạn trông rất tuyệt, nhưng kết quả lại vô giá trị. Đây là cách phổ biến nhất khiến các kết quả dịch máy nghèo tài nguyên hóa ra là giả tạo — và là điều quan trọng nhất mà toàn bộ trang này đang cảnh báo bạn.

Dạng rò rỉ kinh điển và lén lút nhất là **cặp tối thiểu chung đích (shared-target minimal pair)**:

> **Ví dụ thực tế — "Feed him" / "Feed her".** Một sách giáo khoa ngôn ngữ ánh xạ nhiều bài luyện tập tiếng Anh khác nhau vào **một** từ đích duy nhất. *"Feed him"* và *"Feed her"* đều dịch sang cùng một dạng, `asam`. Một phép chia ngẫu nhiên ngây thơ sẽ đưa *"Feed him"* → `asam` vào **tập huấn luyện (training)** và *"Feed her"* → `asam` vào **tập kiểm tra (test set)**. Đáp án đích, `asam`, giờ đây nằm ở cả hai nhóm. Mô hình đã ghi nhớ `asam` từ quá trình huấn luyện và "làm đúng" trong bài kiểm tra — nhưng nó không học được gì cả. Trong một dự án thực tế, 17 trong số 54 hàng "test" đã bị rò rỉ theo cách này, và những hàng đó đạt điểm **83** trên hệ số đo lường chất lượng so với **44** của các hàng sạch. Mọi phát hiện được xây dựng trên con số đó đều phải bỏ đi.

Rò rỉ có nhiều bộ mặt, và một quy trình **kiểm toán rò rỉ (leak audit)** thích hợp sẽ kiểm tra tất cả chúng:

- **Trùng lặp chính xác (Exact overlap)** — cùng một câu nguồn *hoặc* cùng một câu đích xuất hiện ở cả hai bên (ví dụ ở trên).
- **Trùng lặp gần như giống hệt (Near-duplicate overlap)** — không giống hệt nhau, nhưng một phiên bản *diễn đạt khác* của câu test lại nằm trong tập huấn luyện. Các tài liệu cùng lĩnh vực thường chia sẻ các cách diễn đạt tương đương; việc so khớp chính xác sẽ bỏ sót những trường hợp này, vì vậy các cuộc kiểm toán cũng đo lường độ tương đồng về mức độ trùng lặp từ ngữ.
- **Trùng lặp toàn bộ tệp (Whole-file overlap)** — ai đó đã vô tình huấn luyện trên chính bản sao của tệp test. (Điều này thực sự xảy ra: một đợt thu thập dữ liệu "huấn luyện" hóa ra lại *chính là* cuốn sách giáo khoa vàng, khớp 489 trên 489 dòng.)

### Phân chia không giao nhau theo nhóm (Group-disjoint splitting) — giải pháp khắc phục

Bạn không thể khắc phục rò rỉ bằng cách xóa từng hàng vi phạm; mô hình rò rỉ sẽ lại xuất hiện. Giải pháp là **phân chia không giao nhau theo nhóm (group-disjoint splitting)**: trước khi chia, hãy liên kết mọi cặp câu có chung nguồn *hoặc* chung đích thành một **nhóm (group)**, sau đó gửi *toàn bộ nhóm* đó đến duy nhất một bên. Giờ đây, `asam` và mọi thứ chia sẻ nó sẽ nằm hoàn toàn trong tập train *hoặc* hoàn toàn trong tập test — không bao giờ nằm ở cả hai. Sau khi phân chia, bạn **xác minh không có sự trùng lặp nào** và từ chối tiếp tục nếu vẫn còn trùng lặp.

:::tip[Đây là những gì "split-guard" làm cho bạn]
Khi agent của bạn chạy bộ phân chia dữ liệu, nó sẽ thực hiện phân chia không giao nhau theo nhóm theo mặc định và tự động xác minh không có sự trùng lặp nào. Bạn không cần phải nhớ bẫy "Feed him / Feed her" — công cụ này khiến việc mắc sai lầm trở nên khó khăn, và nếu bạn cố tình đi đường vòng, nó sẽ từ chối hoạt động kèm theo thông báo chỉ ra cách khắc phục.
:::

---

## 5. Quá khớp (Overfitting), dừng sớm (early stopping), và vùng bình nguyên (plateau)

**Quá khớp (Overfitting)** là những gì xảy ra khi một mô hình tiếp tục nghiên cứu vượt quá điểm học hỏi và bắt đầu *học vẹt*. Training loss của nó trông rất tuyệt vời; nhưng chất lượng dịch thực tế của nó lại tệ đi. Khoảng cách loss trong [§3](#3-what-training-actually-does-loss-and-its-two-faces) là cách bạn phát hiện ra điều này.

**Dừng sớm (Early stopping)** là biện pháp phòng thủ: theo dõi tín hiệu dev, và khi nó ngừng cải thiện trong một số lần kiểm tra nhất định (gọi là **patience** - độ kiên nhẫn), hãy dừng huấn luyện và giữ lại phiên bản tốt nhất trước đó — **checkpoint** tốt nhất (một ảnh chụp nhanh được lưu lại của mô hình trong quá trình huấn luyện). Dừng sớm giúp ngăn ngừa lãng phí tài nguyên tính toán và hiện tượng quá khớp cùng một lúc.

But early stopping has a famous failure mode when you train mostly on synthetic data — the **synthetic→real transfer plateau**:

> **Ví dụ thực tế — cái chết ở nửa epoch.** Một mô hình huấn luyện trên một hỗn hợp chứa 97,5% dữ liệu tổng hợp và được đánh giá trên một tập dev *thực tế* gồm 42 câu. Giai đoạn đầu, mô hình nhanh chóng trở nên tốt ở phần dữ liệu tổng hợp khổng lồ, vì vậy dev loss trên các câu thực tế giảm nhanh, chạm đáy quanh bước thứ 8.000 — sau đó có xu hướng tăng *lên*. Cơ chế dừng sớm ngây thơ thấy "dev loss tăng trong 6 lần kiểm tra liên tiếp" và tuyên bố hoàn thành ở epoch 0.52, bằng một phần hai mươi thời gian huấn luyện dự kiến. Nhưng mô hình chưa thực sự hoàn thành; nó chỉ mới kết thúc phần học dữ liệu tổng hợp *dễ dàng* và chưa bắt đầu quá trình **chuyển giao** chậm chạp sang chất lượng ngôn ngữ thực tế. Nó đã bị dừng lại ở vùng bình nguyên, trước khi gặt hái được kết quả.

Bài học rút ra: với một hỗn hợp nặng về dữ liệu tổng hợp, việc dev loss giảm rồi tăng *sớm* là điều **được dự báo trước**, chứ không phải là sự hội tụ. Quy tắc dừng phải đủ thông minh để duy trì việc huấn luyện vượt qua vùng bình nguyên — một ngưỡng sàn được tính toán từ kích thước hỗn hợp của bạn, chứ không phải một con số kỳ diệu nào đó mà bạn phải tự biết.

:::note[Thiết lập trung thực sẽ làm lộ ra các lỗi thực tế]
Lỗi vùng bình nguyên đó đã bị ẩn đi trong nhiều tháng — bởi vì các lượt chạy trước đó đã sử dụng tập *test* làm tập dev của họ (một cách không hợp lệ), điều này đã che giấu lỗi đó. Lượt chạy *sạch* đầu tiên chính là thứ đã phơi bày nó. Đây là chủ đề lặp đi lặp lại: làm việc một cách trung thực không chỉ giữ cho bạn chân thực, mà nó còn làm cho các vấn đề thực tế lộ diện.
:::

---

## 6. Đo lường chất lượng: metrics, batteries, registers

Khi mô hình *giải mã (decode)* một câu test, làm thế nào để bạn tính điểm câu trả lời của nó so với bản dịch tham chiếu?

### Các hệ số đo lường tính điểm một phần (Partial-credit metrics): chrF++ và BLEU

Một bản dịch hiếm khi giống hệt bản dịch tham chiếu từng từ một, nhưng nó vẫn có thể cực kỳ tốt. Vì vậy, MT sử dụng các hệ số đo lường **tính điểm một phần (partial-credit)** để thưởng cho sự *trùng lặp* thay vì yêu cầu một sự khớp chính xác tuyệt đối:

- **chrF++** tính điểm sự trùng lặp của **các chuỗi ký tự** (cộng với một số chuỗi từ) giữa đầu ra của mô hình và bản dịch tham chiếu. Vì hoạt động ở cấp độ ký tự, nó tính điểm một phần cho việc dịch một từ *gần* đúng — một gốc từ đúng với một hậu tố sai vẫn nhận được điểm nào đó. Điều này giúp nó rất phù hợp với các ngôn ngữ giàu hình thái (morphologically rich), nơi một gốc từ có thể có nhiều dạng biến đổi. Điểm càng cao càng tốt; nó thường được báo cáo trên thang điểm 0–100.
- **BLEU** là tiêu chuẩn cũ hơn. Nó tính điểm sự trùng lặp của các cụm **nguyên từ** (n-grams). Nó vẫn được báo cáo rộng rãi, nhưng lại rất khắt khe với các ngôn ngữ mà từ ngữ có nhiều dạng biến hình, bởi vì một lỗi nhỏ ở phần đuôi từ cũng bị tính là sai hoàn toàn.

> **Ví dụ thực tế.** Bản dịch tham chiếu: `awâsisak mêtawêwak`. Đầu ra của mô hình: `awâsisak mêtawêw` (đúng gốc từ, sai âm tiết cuối). BLEU coi từ thứ hai đơn giản là sai. chrF++ thấy rằng hầu hết các ký tự đều khớp và chấm điểm một phần. Cùng một đầu ra, điểm số lại rất khác nhau — đó là lý do tại sao hệ số đo lường bạn chọn sẽ thay đổi câu chuyện.

:::tip[Nên tin vào hệ số đo lường nào là một câu hỏi cần được đo lường thực tế]
Không phải hệ số đo lường nào cũng theo sát đánh giá của con người như nhau đối với mọi ngôn ngữ. Đối với một số ngữ hệ, BLEU hầu như không có tương quan với những gì con người nghĩ; đối với những ngữ hệ khác, một hệ số đo lường mạng nơ-ron phức tạp lại là thứ không đáng tin cậy. Trước khi bạn tối ưu hóa theo *bất kỳ* hệ số đo lường nào, hãy kiểm tra bằng chứng về [Độ tin cậy của hệ số đo lường (Metric Reliability)](/docs/network/specifications/metric-reliability) cho ngữ hệ của bạn — và nếu câu trả lời trung thực là "chưa được đo lường", hãy nói rõ như vậy thay vì tin tưởng mù quáng vào một con số.
:::

### Các hệ số đo lường mạng nơ-ron (Neural metrics): COMET, MetricX

Bên cạnh sự trùng lặp ký tự/từ ngữ, **các hệ số đo lường mạng nơ-ron** (COMET, COMET-QE, MetricX) sử dụng một mô hình đã được huấn luyện để *đánh giá* các bản dịch giống con người hơn. Chúng có thể đáng tin cậy hơn nhiều — nhưng chỉ đối với các ngôn ngữ mà chúng được huấn luyện để đánh giá, điều này loại trừ hầu hết các ngôn ngữ nghèo tài nguyên. Chúng cũng chạy phụ thuộc vào hướng dịch: **MetricX** là **càng thấp càng tốt**, ngược lại với chrF++ — một chi tiết đáng lưu ý trước khi bạn so sánh các con số.

### Thanh sai số (Error bars): không bao giờ tin tưởng vào một con số duy nhất

Một điểm số duy nhất không đi kèm khoảng bất định là một cái bẫy. Trên các tập test nhỏ, sự khác biệt thường chỉ là nhiễu.

> **Ví dụ thực tế.** "Mô hình đã cải thiện từ 16.7 lên 18.1 trên tập truyện truyền miệng" nghe có vẻ như là một sự tiến bộ — cho đến khi bạn nhận ra tập dữ liệu đó chỉ có 37 câu. Với lượng dữ liệu ít ỏi đó, sự dao động ±3 điểm hoàn toàn là do ngẫu nhiên. Báo cáo trung thực phải là `17.4 [15.1, 19.8] 95% CI`: con số, cộng với **khoảng tin cậy (CI - confidence interval)** — phạm vi mà giá trị thực có khả năng rơi vào. Nếu khoảng tin cậy của hai mô hình chồng chéo lên nhau quá nhiều, bạn không thể khẳng định mô hình nào tốt hơn.

Công cụ tốt sẽ từ chối in ra điểm số mà không có khoảng tin cậy (CI) của nó, và sử dụng một [phép kiểm thử ý nghĩa (significance test)](/docs/network/specifications/significance) trước khi tuyên bố chiến thắng của A trước B.

### Batteries (Bộ kiểm thử) và registers (ngữ vực)

Ngôn ngữ thực tế không phải là một thứ phẳng lặng, đồng nhất. Một **ngữ vực (register)** (hoặc **lĩnh vực - domain**) là một *thể loại* ngôn ngữ: trò chuyện thông thường, bài luyện tập trong sách giáo khoa, bài báo tin tức, truyện truyền miệng, văn bản hành chính chính thức của chính phủ. Một mô hình có thể rất xuất sắc ở thể loại này nhưng lại kém cỏi ở thể loại khác.

Một **bộ kiểm thử (battery)** là một tập đánh giá được chia một cách có chủ ý thành nhiều ngữ vực khác nhau, được tính điểm **riêng biệt**, để một điểm số trung bình duy nhất không thể che giấu đi điểm yếu.

> **Ví dụ thực tế.** Một mô hình đạt điểm tổng thể là 46 — khá ấn tượng. Nhưng phân tích chi tiết bộ kiểm thử cho thấy nó đạt 58 điểm ở các bài luyện tập trong sách giáo khoa và chỉ 22 điểm ở các câu chuyện truyền miệng. Điểm trung bình đã che giấu một thất bại gần như hoàn toàn đối với ngôn ngữ nói tự nhiên. Chỉ có bộ kiểm thử theo từng ngữ vực mới tiết lộ điều đó.

---

## 7. Tạo dữ liệu nhân tạo khi bạn không có đủ dữ liệu

Khi các cặp câu thực tế khan hiếm, bạn sẽ tạo ra các cặp câu tổng hợp. Có hai kỹ thuật chiếm ưu thế, và cả hai đều sống còn nhờ một từ duy nhất: **xác minh (verification)**.

### FST và các bộ phân tích hình thái (morphological analyzers)

Một **bộ phân tích hình thái (morphological analyzer)** là một công cụ hiểu ngữ pháp từ của một ngôn ngữ: cách các gốc từ kết hợp với tiền tố và hậu tố để tạo thành các từ hợp lệ. Nhiều bộ phân tích được xây dựng dưới dạng **FST** — *bộ chuyển đổi trạng thái hữu hạn (finite-state transducers)*, một công nghệ chính xác dựa trên quy tắc (không phải mạng nơ-ron) có thể chạy theo hai hướng:

- **phân tích (analyze)**: cho trước một từ, phân tích nó thành gốc từ + các thẻ ngữ pháp (`nipâw` → "sleep, 3rd-person singular").
- **tạo sinh (generate)**: cho trước một gốc từ + các thẻ, viết ra dạng từ chính xác (`sleep + 3sg` → `nipâw`).

Đối với một ngôn ngữ đa tổng hợp (polysynthetic) — nơi một từ duy nhất có thể truyền tải những gì tiếng Anh cần cả một câu — một FST là mỏ vàng: nó có thể viết ra *bất kỳ* dạng hợp lệ nào của *bất kỳ* gốc từ đã biết nào, đây chính xác là nguyên liệu thô để tạo ra dữ liệu huấn luyện.

### Xác minh khứ hồi (Round-trip verification) — quy tắc giúp dữ liệu tổng hợp trở nên đáng tin cậy

Tạo dữ liệu nhân tạo là một việc nguy hiểm: một trình tạo có thể âm thầm tạo ra những thứ vô nghĩa. Nguyên tắc ngăn chặn điều đó là **luật khứ hồi (round-trip law)**: mọi từ được tạo ra phải vượt qua quy trình *tạo sinh (generate) → phân tích (analyze) → cho ra đúng phân tích ban đầu*. Nếu bạn yêu cầu FST viết ra một dạng từ và sau đó đưa cách viết đó quay trở lại mà không nhận lại được các thẻ ban đầu của mình, từ đó sẽ bị loại bỏ. Không có thứ gì thất bại trong quy trình khứ hồi này được phép đưa vào dữ liệu huấn luyện.

> **Ví dụ thực tế — rò rỉ một ký tự.** Một từ điển đã viết một âm bằng chữ cái `ý`; bộ phân tích lại mong đợi chữ `y` thông thường. Bởi vì không ai đối chiếu hai cách viết này ở ranh giới kết nối, *1.375 động từ* đã âm thầm bị đánh giá là "không xác định" và bị loại bỏ khỏi quá trình tạo sinh — một cách vô hình trong nhiều tuần. Giải pháp khắc phục là một **bộ chuẩn hóa (canonicalizer)**: một hàm chuẩn hóa cách viết về một quy ước duy nhất *ở mọi nơi* mà hai thành phần gặp nhau, cộng với một **kiểm toán phễu (funnel audit)** để đếm xem có bao nhiêu mục vượt qua mỗi giai đoạn của đường ống (pipeline), nhờ đó việc sụt giảm âm thầm 1.375 mục không bao giờ có thể bị che giấu nữa.

### Độ bao phủ, không chỉ là số lượng

Một triệu câu được tạo ra nghe có vẻ rất toàn diện. Nhưng thực tế không phải vậy, nếu chúng chỉ là một triệu biến thể của cùng một vài cấu trúc câu giống nhau.

> **Ví dụ thực tế.** Một kho ngữ liệu tổng hợp gồm 1.000.000 cặp câu hóa ra lại **không chứa câu mệnh lệnh** ("Hãy bỏ phiếu!"), **không có câu hỏi wh-** ("ai/ở đâu/khi nào"), **không có sở hữu** ("con chó của tôi"), và **không có dạng nghịch đảo (inverse forms)** ("cô ấy nhìn thấy *tôi*" — ngữ pháp cốt lõi trong nhiều ngôn ngữ). Bộ phân tích có thể tạo ra tất cả chúng; chỉ là các mẫu (templates) chưa bao giờ yêu cầu. Số lượng lớn đã che giấu một lỗ hổng cấu trúc.

Biện pháp phòng thủ là một **danh sách kiểm tra độ bao phủ (coverage checklist)** được sao chép từ một cuốn ngữ pháp đã xuất bản: các hiện tượng ngữ pháp bắt buộc, mỗi hiện tượng đều được trích dẫn, để quá trình build sẽ thất bại nếu một hiện tượng bắt buộc có không ví dụ nào. Và một **giới hạn cho mỗi loại (per-kind cap)** sẽ ngăn chặn bất kỳ một cấu trúc mẫu nào chiếm ưu thế — trong một kho ngữ liệu, hai cấu trúc mẫu chiếm tới 54% dữ liệu, vì vậy một nửa "trải nghiệm" của mô hình chỉ xoay quanh hai mẫu câu.

### Dịch ngược (Backtranslation)

**Dịch ngược (Backtranslation)** là một kỹ thuật tổng hợp lớn khác, và nó rất thông minh. Nếu bạn có văn bản thuần túy, *chưa được dịch* bằng ngôn ngữ đích của mình (một kho ngữ liệu **đơn ngữ - monolingual** — dễ tìm hơn nhiều so với văn bản song ngữ), bạn có thể:

1. sử dụng một mô hình *ngược* (đích → tiếng Anh),
2. dịch máy văn bản đơn ngữ đích của bạn *sang* tiếng Anh,
3. ghép cặp mỗi câu tiếng Anh dịch máy đó với câu đích **thực tế** mà bạn đã bắt đầu, và
4. huấn luyện mô hình xuôi (tiếng Anh → đích) của bạn trên các cặp câu đó.

Phía ngôn ngữ đích là ngôn ngữ thực tế; chỉ có phía tiếng Anh là tổng hợp — đây thường là một sự đánh đổi tốt.

> **Ví dụ thực tế.** Bạn có 50.000 câu thực tế bằng ngôn ngữ đích nhưng chỉ có 400 cặp câu song ngữ. Hãy dịch ngược 50.000 câu đó sang tiếng Anh thô, và bạn đã biến văn bản đơn ngữ thành 50.000 cặp câu huấn luyện có phía *đích* là ngôn ngữ thực tế chuẩn xác.

:::danger[Kiểm toán rò rỉ cả văn bản đơn ngữ của bạn]
Dịch ngược mang lại cảm giác an toàn vì "nó chỉ là văn bản đơn ngữ" — nhưng văn bản đó có thể *chính là* dữ liệu đánh giá của bạn dưới dạng ngụy trang. Trong một dự án, cuộc kiểm toán rò rỉ đã phát hiện một đợt thu thập đơn ngữ khớp chính xác với tập test vàng. Hãy kiểm toán **mọi** đầu vào đối với **mọi** tập đánh giá, bao gồm cả dữ liệu tổng hợp và đơn ngữ — chứ không chỉ kho ngữ liệu song ngữ rõ ràng của bạn.
:::

### Gắn thẻ dữ liệu tổng hợp

Một phương pháp cuối cùng: **gắn thẻ (tag)** các nguồn tổng hợp bằng một nhãn đánh dấu (như `<synth>` hoặc `<bt>`) và để dữ liệu thực tế (vàng) không gắn thẻ. Điều này cho phép mô hình phân biệt "tài liệu thực hành" với "hàng thật", nhờ đó dữ liệu thực tế sẽ định hình phong cách đầu ra của nó; khi dịch thực tế, bạn không thêm thẻ này vào, và mô hình sẽ dựa trên những gì nó đã học được từ dữ liệu vàng. (Xem [hướng dẫn Dịch ngược (Back-Translation cookbook)](/docs/network/tutorials/back-translation) để tìm hiểu sâu hơn về kỹ thuật này.)

---

## 8. Các mảnh ghép kết nối với nhau như thế nào

Đọc từ trên xuống dưới, đây là một quy trình làm việc hoàn chỉnh:

1. Thu thập **dữ liệu song ngữ thực tế** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — thường là quá ít.
2. **Phân chia** dữ liệu theo kiểu không giao nhau theo nhóm (group-disjoint) thành các tập train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Tạo sinh** dữ liệu tổng hợp để lấp đầy khoảng trống — được xác minh khứ hồi, kiểm tra độ bao phủ, và kiểm toán rò rỉ ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Huấn luyện** trên hỗn hợp dữ liệu, theo dõi **dev loss / dev generation** để tránh **quá khớp (overfitting)** và vượt qua **vùng bình nguyên (plateau)** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Giải mã (Decode)** **bộ kiểm thử test (test battery)** được giữ riêng và tính điểm bằng **các hệ số đo lường tính điểm một phần + khoảng tin cậy**, theo từng **ngữ vực (register)** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Thực hiện tất cả những điều trên mà không bao giờ để đáp án đánh giá chạm vào tập huấn luyện ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — quy tắc tối thượng mà năm quy tắc còn lại phục vụ.

Mỗi quy tắc ở đây đều tương ứng với một sai lầm thực tế, đã được đo lường mà một dự án thực tế đã mắc phải và ghi lại tài liệu. Bạn không cần phải học thuộc lòng chúng: bộ công cụ huấn luyện tự động hóa từng quy tắc để con đường trung thực là mặc định và các con đường không trung thực sẽ bị từ chối kèm theo lời giải thích. Đó là chủ đề của trang tiếp theo.

## Chỉ đạo agent của bạn bằng các thuật ngữ này

Vì bạn sẽ làm việc thông qua một agent lập trình, lợi ích thực tế của trang này là giờ đây bạn có thể đưa ra — và kiểm tra — các hướng dẫn như thế này:

- *"Hãy phân chia kho ngữ liệu theo kiểu không giao nhau theo nhóm (group-disjoint) và xác minh không có sự trùng lặp nào trước khi huấn luyện."*
- *"Hãy trích xuất một tập dev từ phía tập huấn luyện; không bao giờ chọn checkpoint trên tập test."*
- *"Hãy kiểm toán rò rỉ mọi đầu vào đối với mọi tập đánh giá, bao gồm cả dữ liệu tổng hợp và đơn ngữ."*
- *"Hãy báo cáo chrF++ với khoảng tin cậy 95%, phân tích chi tiết theo từng ngữ vực."*
- *"Hãy kiểm tra độ tin cậy của hệ số đo lường cho ngữ hệ này trước khi chúng ta tối ưu hóa theo bất kỳ điểm số nào."*

Nếu agent của bạn có sẵn máy chủ Champollion MCP, nó có thể gọi `get_training_guardrails` để đưa các quy tắc này — và sai lầm mà mỗi quy tắc triệt tiêu — trực tiếp vào ngữ cảnh của nó trước khi viết một lệnh duy nhất.

**Tiếp theo:** hãy đưa nó vào hoạt động trong [**Bạn muốn tự huấn luyện mô hình của riêng mình**](/docs/network/tutorials/train-your-own-model), hướng dẫn từng bước — hoặc đọc [**Huấn luyện mô hình một cách trung thực**](/docs/network/getting-started/training-honestly) để biết cách bộ công cụ biến mọi khái niệm ở đây thành một rào chắn bảo vệ tự động.

Nếu các thuật ngữ như *tokenizer* vẫn còn mơ hồ, tài liệu nhập môn từ đầu là [Tokenizers](/docs/learn/tokenizers) — hãy đọc qua một lần và mọi thứ ở trên sẽ trở nên dễ dàng hơn.
