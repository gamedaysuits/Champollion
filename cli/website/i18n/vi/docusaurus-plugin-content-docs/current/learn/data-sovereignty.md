---
title: "Ý nghĩa của chủ quyền dữ liệu khi bạn lập trình vào phần mềm"
sidebar_label: "Chủ quyền dữ liệu"
description: "Chủ quyền dữ liệu của người bản địa là một tập hợp các nguyên tắc về việc ai sở hữu, kiểm soát, truy cập và nắm giữ dữ liệu. Đây là cách các nguyên tắc đó thể hiện khi ai đó cố gắng tích hợp chúng vào một phần mềm hoạt động thực tế — và những gì mà nỗ lực đó không thể khẳng định."
---

# Chủ quyền dữ liệu có ý nghĩa gì khi bạn đưa nó vào phần mềm

:::info[Dành cho ai]
Bất kỳ ai. Không yêu cầu kiến thức nền tảng về luật, học máy hay quản trị của người bản địa. Nếu bạn từng tự hỏi thực sự cần những gì để một cộng đồng giữ quyền kiểm soát dữ liệu ngôn ngữ của chính họ khi có sự tham gia của máy tính, thì trang này là câu trả lời chi tiết.
:::

Hầu hết các cuộc thảo luận về dữ liệu và sự đồng thuận đều dừng lại ở sự cho phép: ai đó đã đồng ý chưa.
Chủ quyền dữ liệu đặt ra một loạt câu hỏi khó hơn. Ai **sở hữu** thứ này? Ai quyết định
điều gì sẽ xảy ra với nó? Ai có thể tiếp cận nó? Nó nằm ở đâu về mặt vật lý?

Những câu hỏi đó không tự nhiên xuất hiện. Chúng được cất lên lần đầu tiên và
mạnh mẽ nhất bởi các dân tộc Bản địa.

---

## 1. Những câu hỏi — và ai là người đầu tiên đặt ra chúng

Các Dân tộc Đầu tiên (First Nations) ở Canada đã làm rõ các nguyên tắc chủ quyền dữ liệu về
**quyền sở hữu, quyền kiểm soát, quyền truy cập và quyền chiếm hữu** như một lời khẳng định quyền tài phán
đối với thông tin của chính họ — bắt nguồn từ một lịch sử được ghi nhận rõ ràng về việc các nghiên cứu
được thực hiện *trên* các cộng đồng thay vì *cùng với* họ, và kết quả dữ liệu thu được
chẳng bao giờ quay trở lại.

Nguồn gốc đó không phải là chi tiết vụn vặt. Đây không phải là một danh sách kiểm tra đạo đức chung chung
mà bất kỳ ai cũng có thể tùy tiện áp dụng; chúng là những lời khẳng định quyền tài phán, được đưa ra bởi các
dân tộc cụ thể trong bối cảnh pháp lý và văn hóa cụ thể, và chúng thuộc về chính
các cộng đồng đã tạo ra chúng.

Tóm tắt bốn câu hỏi:

| | Câu hỏi mà nó trả lời |
|---|---|
| **Ownership** (Sở hữu) | Ai sở hữu thông tin này? Một cộng đồng sở hữu tập thể kiến thức văn hóa và dữ liệu của họ — giống như cách một người sở hữu thông tin cá nhân của chính họ. |
| **Control** (Kiểm soát) | Ai quyết định điều gì sẽ xảy ra với nó? Các cộng đồng kiểm soát mọi giai đoạn của bất cứ thứ gì liên quan đến họ: cái gì được thu thập, như thế nào, bởi ai, để làm gì, và nó được xử lý ra sao sau đó. |
| **Access** (Tiếp cận) | Ai có thể tiếp cận nó? Các cộng đồng phải có khả năng tiếp cận thông tin về chính họ, bất kể nó được lưu giữ ở đâu, bởi ai. |
| **Possession** (Chiếm hữu) | Nó nằm ở đâu về mặt vật lý? Không giống như quyền sở hữu — sự chiếm hữu là thực tế cụ thể của việc lưu giữ, và nó là cơ chế làm cho ba nguyên tắc kia có thể thực thi được thay vì chỉ là lời hứa. |

Có những khuôn khổ riêng biệt và chúng không thể hoán đổi cho nhau:
**CARE** (Lợi ích tập thể, Quyền hạn kiểm soát, Trách nhiệm, Đạo đức)
cho việc quản trị dữ liệu Bản địa nói chung, và **Te Mana Raraunga** cho chủ quyền
dữ liệu người Māori, cùng nhiều khuôn khổ khác. Mỗi khuôn khổ ra đời trong bối cảnh
pháp lý và văn hóa riêng. Việc dùng tên của khuôn khổ này cho các nguyên tắc của khuôn khổ khác
cũng là một hình thức xóa bỏ danh tính của chúng.

---

## 2. Tại sao phần mềm làm cho điều này trở nên rõ nét

Một nguyên tắc có thể tồn tại trên giấy như một ý định tốt. Phần mềm buộc phải đặt ra
câu hỏi, bởi vì máy tính không hành động dựa trên ý định — nó hành động dựa trên những gì được
xây dựng.

Hãy xem xét cách thông thường mà một hệ thống dịch thuật được đánh giá. Để tìm hiểu
xem một hệ thống có dịch tốt ngôn ngữ của bạn hay không, ai đó cần một **tập kiểm tra (test set)**:
các câu trong ngôn ngữ của bạn, đi kèm với ý nghĩa của chúng. Hầu như mọi nền tảng đánh giá
đều yêu cầu bạn **tải lên (upload)** tập kiểm tra đó để nó có thể được chấm điểm.

Hãy đọc lại điều đó với bốn câu hỏi trong tay. Việc tải lên chuyển giao
sự chiếm hữu. Nó thường chuyển giao quyền kiểm soát thực tế — một khi bản sao tồn tại trên
máy của người khác, khả năng nói "dừng lại" của bạn chỉ là một yêu cầu, không phải là một
khả năng. Quyền tiếp cận trở thành thứ bạn được cấp thay vì thứ bạn
có. Quyền sở hữu chỉ tồn tại trên giấy và không còn nhiều ý nghĩa.

Đối với một cộng đồng có dữ liệu ngôn ngữ từng bị trích xuất trước đây, "hãy tải nó lên và tin tưởng
chúng tôi" không phải là một yêu cầu trung lập. Nó có cùng hình thức với những gì đã
xảy ra.

---

## 3. Các cơ chế thực sự là gì

Quan điểm của dự án này là nếu chủ quyền là có thật, nó phải là một thuộc tính
của phần mềm, chứ không phải là một đoạn văn trong một chính sách. Dưới đây là hình ảnh cụ thể
của điều đó. Chúng được mô tả để bạn có thể đánh giá và tranh luận với chúng.

**Đăng ký mà không giao nộp.** Một tập kiểm tra được đăng ký bằng cách mô tả
*nơi nó lưu trữ* và ghim một mã băm mật mã (cryptographic hash) của nội dung chính xác của nó — không phải bằng cách
tải lên các câu. Tại thời điểm đánh giá, hệ thống tìm nạp từ nguồn,
kiểm tra mã băm có khớp hay không và chấm điểm. Không có gì được lưu trữ. Nếu người nắm giữ đưa
nguồn ngoại tuyến, ngữ liệu (corpus) đơn giản là ngừng được đánh giá. Quyền kiểm soát vẫn ở nơi nó
bắt đầu, bởi vì sự chiếm hữu không bao giờ di chuyển.

**Mã hóa trước khi gửi đi, đối với cấp độ bảo mật cao nhất.** Trường hợp một kho ngữ liệu cần phải
sử dụng được mà không bao giờ bị đọc nội dung, nó sẽ được mã hóa **trên chính thiết bị
của người nắm giữ**, và bản mã vẫn nằm lại ở phía người nắm giữ. Những gì dự án này nhận được
chỉ là một bản mô tả không chứa bất kỳ nội dung nào.

**Không một bên đơn lẻ nào có thể giải mã.** Khóa mã hóa được thiết kế để phân chia cho một nhóm
những người giám hộ sao cho cần một số lượng người nhất định — chẳng hạn ba trong số năm người — cùng
hành động để phê duyệt bất kỳ điều gì. Không một người giám hộ riêng lẻ nào có thể hành động độc lập, và
dự án này cũng vậy: thiết kế này phân bổ cho **Champollion không có mảnh khóa nào (zero shares)**, do đó dự án
không thể giải mã dù có hay không có sự hợp tác của bất kỳ ai. Một lượt chạy sẽ diễn ra
bởi vì túc số người giám hộ đã quyết định rằng nó nên diễn ra.

> **Thực trạng hiện tại.** Cơ chế này đã được xây dựng và có thể kiểm thử, nhưng
> nó vẫn chưa được vận hành với những người giám hộ thực tế. *Chưa có người giám hộ
> nào được chỉ định* — thành phần nhân sự thuộc về các cộng đồng liên quan, và chưa có nhóm
> nào đồng ý nắm giữ các mảnh khóa. Cho đến khi họ đồng ý,
> sẽ chưa có tập hợp người giám hộ nào hoạt động, và dự án này sẽ không công khai
> danh sách các ứng viên. Vì vậy, hãy hiểu đoạn văn trên như một cơ chế đang hoạt động nhưng đang chờ đợi
> các mối quan hệ giúp nó thực sự vận hành, chứ không phải là thứ đang chạy ở thời điểm hiện tại.

**Kết quả không bị phơi bày.** Những gì trả về từ một đánh giá được niêm phong là
điểm số, không phải các câu. Một phương pháp có thể được chứng minh là hoạt động trên một ngữ liệu mà
tác giả của phương pháp đó, và dự án này, chưa bao giờ đọc.

**Đồng thuận trước khi truyền tải.** Việc gửi văn bản đến một API mô hình bên ngoài bản thân nó đã là
một sự tiết lộ. Các ngữ liệu theo giấy phép cộng đồng, tùy chỉnh hoặc không được nêu rõ sẽ **từ chối**
đánh giá từ xa cho đến khi người nắm giữ quyền đã ghi nhận rõ ràng sự cho phép đối với
việc đó. Sự từ chối đó được thực thi trong mã, và không có quy trình tự động nào có thể cấp
quyền thay mặt cho một cộng đồng.

**Khả năng đảo ngược chỉ theo một hướng.** Sự phơi bày có thể được nới lỏng bởi một
quyết định có chủ ý của người nắm giữ. Nó không bao giờ nới lỏng theo mặc định, do vô tình, hoặc
vì sự thuận tiện của người khác.

---

## 4. Những gì không phải là dự án này

**Dự án này không được xác thực, chứng nhận hoặc phê duyệt theo bất kỳ khuôn khổ
chủ quyền dữ liệu Bản địa nào. Chưa có đánh giá nào diễn ra, không có đánh giá nào đang chờ xử lý,
và không hàm ý bất kỳ sự công nhận nào.**

Những gì hiện có là một **nỗ lực nhằm hiện thực hóa chủ quyền dữ liệu bằng mã nguồn** — tiếp thu
các nguyên tắc được các dân tộc Bản địa nêu rõ và diễn đạt chúng thành các cơ chế hoạt động
thay vì chỉ là những lời cam kết suông. Nỗ lực đó là của chúng tôi. Liệu nó có thành công hay không
không thuộc thẩm quyền tuyên bố của chúng tôi. Quyết định về sự tuân thủ thuộc về các cộng đồng
liên quan, và một dự án tự khẳng định sự tuân thủ của mình sẽ tái hiện lại chính xác
thái độ mà các nguyên tắc này sinh ra để điều chỉnh: kẻ bên ngoài tự cho mình quyền quyết định
thế nào là đối xử thỏa đáng với thông tin của một cộng đồng.

Cũng không có điều nào trong số đó là sự đảm bảo về tính bất khả thi. Phần mềm có lỗi. Người vận hành
mắc sai lầm. Một bên quyết tâm nắm giữ đủ các vai trò phù hợp là một
rủi ro tồn dư mà không có kiến trúc nào loại bỏ được. Tuyên bố này hẹp hơn và, chúng tôi nghĩ,
hữu ích hơn: **những con đường dễ dàng đã bị đóng lại, và những con đường khó khăn sẽ để lại bằng chứng.**

Cũng có những khoảng trống giữa các nguyên tắc và các cơ chế, và chúng tôi thà
gọi tên chúng còn hơn để bạn tự tìm ra. Chiếm hữu là nguyên tắc mà các
cơ chế này phục vụ tốt nhất — mã thực sự tốt trong việc không lưu giữ mọi thứ.
Sở hữu và Kiểm soát vươn xa hơn những gì phần mềm có thể tự làm, đi vào các điều khoản,
quản trị và các mối quan hệ mà không có lượng mật mã nào giải quyết được. Và mọi
cơ chế ở trên đều giả định một cộng đồng đã có năng lực và
cơ sở hạ tầng để lưu giữ dữ liệu của chính họ, đây không phải là một giả định trung lập.

---

## 5. Vui lòng tranh luận với điều này

Nỗ lực này cởi mở với những lời phê bình, và lời mời này không phải để trang trí.

Nếu bạn làm việc trong lĩnh vực quản trị dữ liệu Bản địa, CARE, Te Mana Raraunga hoặc
công nghệ ngôn ngữ Bản địa — hoặc nếu bạn là thành viên hay đại diện của một
cộng đồng có ngôn ngữ nằm trong chỉ mục này — chúng tôi rất muốn lắng nghe những điểm chưa đúng ở đây.
Cụ thể:

- trường hợp một cơ chế không thực hiện đúng những gì nguyên tắc yêu cầu;
- trường hợp cách diễn đạt bóp méo các nguyên tắc của cộng đồng, hoặc lạm dụng uy tín của họ;
- trường hợp một nội dung được mô tả là có tính bảo vệ nhưng thực tế sẽ không bảo vệ bạn;
- trường hợp cộng đồng cần một thứ mà chúng tôi chưa xây dựng;
- trường hợp chính thuật ngữ được sử dụng chưa chuẩn xác.

Các phản đối và sửa chữa có thể được đưa ra thông qua
[tuyến liên hệ và gỡ bỏ](/docs/network/community/contact-objections-takedown),
cũng bao gồm việc yêu cầu xóa bất cứ điều gì về một ngôn ngữ mà bạn
đại diện. Không có yêu cầu nào về việc phải ngoại giao về vấn đề này.

Việc chưa được đánh giá là một thực tế về công việc này, không phải là một sự biện chữa cho nó. Một nỗ lực
mời gọi sự đánh giá là trung thực; một nỗ lực không làm vậy chỉ là một lời tuyên bố.

> Trang này là bản mô tả về một nỗ lực xây dựng hướng tới các nguyên tắc mà tác giả chính là các cộng đồng — hãy tìm hiểu các nguyên tắc đó theo đúng cách mà các tác giả của chúng trình bày; nỗ lực này không được bảo chứng bởi bất kỳ tổ chức nào quản lý các nguyên tắc đó.

---

## Bước tiếp theo

- [Quản lý dữ liệu (Data Stewardship)](/docs/network/sovereignty/data-sovereignty) — quan điểm vận hành, chi tiết hơn.
- [Đăng ký ngữ liệu (Registering Corpora)](/docs/network/sovereignty/registering-corpora) — bốn cấp độ phơi bày, và những gì rời khỏi máy của bạn ở mỗi cấp độ.
- [Chạy một cuộc thi có chủ quyền (Run a Sovereign Contest)](/docs/network/sovereignty/run-a-sovereign-contest) — nghi thức của người giám sát, từ đầu đến cuối.
- [Những hạn chế trung thực (Honest Limitations)](/docs/network/honest-limitations) — những gì dự án này không tuyên bố.
- [Dành cho các cộng đồng ngôn ngữ (For Language Communities)](/docs/network/community/for-language-communities) — điểm khởi đầu thực tế.
