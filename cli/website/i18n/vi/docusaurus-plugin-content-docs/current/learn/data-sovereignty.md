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

Bốn câu hỏi đó có một cái tên, và chúng bắt nguồn từ một nơi cụ thể.

---

## 1. Những câu hỏi — và ai đã đặt ra chúng trước tiên

Các First Nations ở Canada đã trình bày các nguyên tắc chủ quyền dữ liệu về
**quyền sở hữu (ownership), kiểm soát (control), truy cập (access) và chiếm hữu (possession)** như một sự
khẳng định quyền tài phán đối với thông tin của chính họ — bắt nguồn từ một lịch sử đã được ghi nhận
về các nghiên cứu được thực hiện *trên* các cộng đồng thay vì *cùng với* họ, và dữ liệu thu được
không bao giờ quay trở lại.

Nguồn gốc đó không phải là chuyện nhỏ. Đây không phải là một danh sách kiểm tra đạo đức đa năng mà
bất kỳ ai cũng có thể sử dụng. Đó là những khẳng định quyền tài phán, được đưa ra bởi những dân tộc
cụ thể trong những bối cảnh pháp lý và văn hóa cụ thể, và chúng thuộc về các cộng đồng đã đưa ra chúng.

Tóm tắt bốn câu hỏi:

| | Câu hỏi mà nó trả lời |
|---|---|
| **Ownership** (Sở hữu) | Ai sở hữu thông tin này? Một cộng đồng sở hữu tập thể kiến thức văn hóa và dữ liệu của họ — giống như cách một người sở hữu thông tin cá nhân của chính họ. |
| **Control** (Kiểm soát) | Ai quyết định điều gì sẽ xảy ra với nó? Các cộng đồng kiểm soát mọi giai đoạn của bất cứ thứ gì liên quan đến họ: cái gì được thu thập, như thế nào, bởi ai, để làm gì, và nó được xử lý ra sao sau đó. |
| **Access** (Tiếp cận) | Ai có thể tiếp cận nó? Các cộng đồng phải có khả năng tiếp cận thông tin về chính họ, bất kể nó được lưu giữ ở đâu, bởi ai. |
| **Possession** (Chiếm hữu) | Nó nằm ở đâu về mặt vật lý? Không giống như quyền sở hữu — sự chiếm hữu là thực tế cụ thể của việc lưu giữ, và nó là cơ chế làm cho ba nguyên tắc kia có thể thực thi được thay vì chỉ là lời hứa. |

Các khuôn khổ khác biệt có tồn tại và không thể hoán đổi cho nhau: **CARE** (Collective Benefit, Authority to Control, Responsibility,
Ethics) dành cho quản trị dữ liệu của người bản địa nói chung, và **Te Mana Raraunga** dành cho
chủ quyền dữ liệu của người Māori. Mỗi khuôn khổ phát sinh trong bối cảnh pháp lý và văn hóa riêng của nó. Việc sử dụng
tên của một khuôn khổ cho các nguyên tắc của một khuôn khổ khác cũng là một kiểu xóa bỏ.

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

**Mã hóa trước khi rời đi, dành cho cấp độ mạnh nhất.** Khi một ngữ liệu phải
sử dụng được mà không bao giờ bị đọc, nó được mã hóa **ngay trên thiết bị của người nắm giữ** trước khi bất cứ thứ gì rời đi. Những gì dự án này nhận được là bản mã (ciphertext) và một
mô tả không chứa nội dung.

**Không một bên đơn lẻ nào có thể giải mã.** Khóa được chia nhỏ cho một nhóm người giám sát (custodians) sao
cho một số lượng nhất định trong số họ — ví dụ ba trên năm — phải hành động cùng nhau để ủy quyền
cho bất cứ điều gì. Không một người giám sát cá nhân nào có thể hành động một mình, và dự án này cũng vậy:
mô hình được quyết định là **Champollion giữ không cổ phần (zero shares)**, vì vậy nó không thể
giải mã dù có hay không có sự hợp tác của bất kỳ ai. Một lần chạy (run) xảy ra vì một nhóm túc số (quorum)
người giám sát đã quyết định nó nên diễn ra.

> **Thực trạng hiện tại.** Cơ chế này đã được xây dựng và có thể kiểm tra. Các
> *người giám sát chưa được xác nhận* — thành phần thuộc về các cộng đồng
> liên quan, và chưa có nhóm nào đồng ý nắm giữ cổ phần. Cho đến khi họ đồng ý,
> sẽ không có tập hợp người giám sát trực tiếp nào, và dự án này sẽ không nêu tên các ứng viên
> một cách công khai. Vì vậy, hãy đọc đoạn trên như một cơ chế hoạt động đang chờ đợi các
> mối quan hệ để làm cho nó vận hành, chứ không phải là một thứ đang chạy ngay hôm nay.

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

**Dự án này không được xác nhận, chứng nhận hay phê duyệt theo bất kỳ khuôn khổ chủ quyền dữ liệu bản địa nào. Không có đánh giá nào
đã diễn ra, không có đánh giá nào đang chờ xử lý và không có đánh giá nào được ngụ ý.**

Những gì tồn tại là một **nỗ lực ban hành chủ quyền dữ liệu trong mã** — lấy các nguyên tắc
được các dân tộc bản địa trình bày và thể hiện chúng dưới dạng các cơ chế hoạt động thay vì
các cam kết. Nỗ lực đó là của chúng tôi. Việc nó có thành công hay không không phải do chúng tôi tuyên bố.
Các quyết định về sự tuân thủ thuộc về các cộng đồng liên quan, và một dự án tự khẳng định
sự tuân thủ của chính nó sẽ là sự tái hiện thu nhỏ chính xác thái độ mà các nguyên tắc này tồn tại
để sửa chữa: người ngoài quyết định điều gì được coi là cách xử lý thỏa đáng đối với
thông tin của một cộng đồng.

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

Nếu bạn làm việc về quản trị dữ liệu của người bản địa, CARE, Te Mana Raraunga, hoặc
công nghệ ngôn ngữ của người bản địa — hoặc nếu bạn là thành viên hay đại diện của một
cộng đồng có ngôn ngữ nằm trong chỉ mục này — chúng tôi muốn nghe xem điều này sai ở đâu.
Cụ thể:

- nơi một cơ chế không thực hiện những gì nguyên tắc yêu cầu;
- nơi cách diễn đạt làm sai lệch các nguyên tắc của một cộng đồng, hoặc mượn thẩm quyền của chúng;
- nơi một thứ gì đó được mô tả là mang tính bảo vệ nhưng lại không bảo vệ bạn;
- nơi một cộng đồng sẽ cần thứ gì đó mà chúng tôi chưa xây dựng;
- nơi bản thân từ vựng không phù hợp.

Các phản đối và sửa chữa có thể được đưa ra thông qua
[tuyến liên hệ và gỡ bỏ](/docs/network/community/contact-objections-takedown),
cũng bao gồm việc yêu cầu xóa bất cứ điều gì về một ngôn ngữ mà bạn
đại diện. Không có yêu cầu nào về việc phải ngoại giao về vấn đề này.

Việc chưa được đánh giá là một thực tế về công việc này, không phải là một sự biện chữa cho nó. Một nỗ lực
mời gọi sự đánh giá là trung thực; một nỗ lực không làm vậy chỉ là một lời tuyên bố.

---

## Đi đâu tiếp theo

- [Quản lý dữ liệu (Data Stewardship)](/docs/network/sovereignty/data-sovereignty) — quan điểm vận hành, chi tiết hơn.
- [Đăng ký ngữ liệu (Registering Corpora)](/docs/network/sovereignty/registering-corpora) — bốn cấp độ phơi bày, và những gì rời khỏi máy của bạn ở mỗi cấp độ.
- [Chạy một cuộc thi có chủ quyền (Run a Sovereign Contest)](/docs/network/sovereignty/run-a-sovereign-contest) — nghi thức của người giám sát, từ đầu đến cuối.
- [Những hạn chế trung thực (Honest Limitations)](/docs/network/honest-limitations) — những gì dự án này không tuyên bố.
- [Dành cho các cộng đồng ngôn ngữ (For Language Communities)](/docs/network/community/for-language-communities) — điểm khởi đầu thực tế.
