---
sidebar_position: 7
title: "Quản trị Dữ liệu"
description: "Quan điểm của Champollion về dữ liệu ngôn ngữ: kho ngữ liệu vẫn thuộc về những người quản trị chúng, mọi giấy phép đều được tôn trọng và các điều khoản cộng đồng sẽ chi phối dữ liệu cộng đồng."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Quản trị Dữ liệu (Data Stewardship)

> **Tóm tắt tổng quan.** Champollion là bộ công cụ nghiên cứu và phát triển
> dịch máy — có sẵn mã nguồn (source-available) và miễn phí cho mục đích phi thương mại, với
> khung đánh giá là mã nguồn mở. Trang này nêu rõ lập trường đầy đủ của dự án về
> dữ liệu ngôn ngữ: ngữ liệu thuộc về cộng đồng khởi nguồn của chúng, mọi giấy phép
> và điều khoản cộng đồng đều được tôn trọng bằng cơ chế kỹ thuật thay vì bằng lời hứa, và nền tảng
> không tự đặt ra bất kỳ điều khoản nào đối với ngôn ngữ của bất kỳ ai.

:::info[Dữ liệu ngôn ngữ là dữ liệu sinh học]
Dữ liệu ngôn ngữ là **dữ liệu sinh học**. Giống như dữ liệu di truyền hoặc y tế, một ngôn ngữ mang
trong mình bản sắc, quan hệ thân tộc và các mối quan hệ của những người nói ngôn ngữ đó — và giống như
bộ gen, nó không thể được ẩn danh hóa một cách thực sự: dù có loại bỏ tên tuổi, ngôn ngữ
vẫn mã hóa danh tính của cộng đồng sở hữu nó. Vì vậy, những người cung cấp kho ngữ liệu nắm giữ
chìa khóa của chính kho ngữ liệu đó, cũng như bất kỳ thứ gì được đối chiếu với nó. Đó là tiền đề
cho toàn bộ nội dung bên dưới.
:::

Từ tiền đề đó, thiết kế của hệ thống được hình thành. Champollion coi mỗi bên đóng góp
ngữ liệu là một **người quản trị (steward)**: ngữ liệu vẫn thuộc về họ — về mặt pháp lý,
vật lý và thực tế — trong khi cơ sở hạ tầng giúp cho ngữ liệu đó có thể *đo lường được*.

## Các cam kết

1. **Chúng tôi không bao giờ lưu giữ dữ liệu.** Các ngữ liệu được đăng ký dưới dạng
   thẻ siêu dữ liệu (metadata card) được ghim bằng mã hash và được tải về từ chính
   máy chủ lưu trữ của người quản trị tại thời điểm đánh giá. Không có gì được sao chép
   vào kho lưu trữ này hoặc được phân phối từ cơ sở hạ tầng của chúng tôi. Nếu bạn ngoại
   tuyến kho lưu trữ của mình, việc đánh giá dựa trên ngữ liệu đó sẽ dừng lại. Xem
   [Đăng ký Ngữ liệu](/docs/network/sovereignty/registering-corpora).

2. **Mọi giấy phép đều được tôn trọng — bằng cổng kiểm soát, không phải bằng lời hứa.** Các ngữ liệu
   phi thương mại và chỉ dùng cho nghiên cứu được loại trừ bằng cơ chế kỹ thuật khỏi bất kỳ mục đích sử dụng nào
   mà giấy phép không cho phép. Các hạn chế do cộng đồng đặt ra ngoài phạm vi giấy phép được
   ghi nhận kèm theo nguồn và được tuân thủ theo cách tương tự. Cơ chế thực thi nằm ở
   các cổng pre-push chạy cục bộ trước mỗi lần push (CI hiện đang bị tắt) và
   trong các trigger cơ sở dữ liệu, chứ không phải trong một quy tắc ứng xử.

3. **Các điều khoản thuộc về người quản trị và chúng có sự khác biệt.** Các ngôn ngữ
   khác nhau sẽ có các thỏa thuận khác nhau — một ngữ liệu công cộng CC0, một ngữ liệu
   cộng đồng chỉ dùng cho nghiên cứu, và một tập kiểm thử khép kín với các yêu cầu triển
   khai chủ quyền đều có thể tham gia, mỗi loại theo các điều khoản riêng. Không có hợp
   đồng chung ở đây và không có yêu cầu mặc định nào đối với bất kỳ thứ gì. Xem
   [Khung Điều khoản](/docs/network/sovereignty/ownership-transfer).

4. **Ngữ liệu bảo mật được hỗ trợ như một kiến trúc hệ thống, không phải là ngoại lệ.**
   Một cộng đồng có thể giữ kín tập kiểm thử — lưu trữ trên cơ sở hạ tầng của riêng họ,
   không bao giờ để Champollion hay các nhà phát triển nhìn thấy — mà vẫn có thể chấm điểm
   cho các phương pháp dựa trên tập kiểm thử đó. Khả năng đo lường mà không cần trích xuất
   là một mục tiêu thiết kế, không phải là một giải pháp tạm thời.

5. **Ghi nhận tác quyền và công lao luôn đi kèm với dữ liệu.** Việc ghi nhận công lao của người xây dựng
   và nhà ngôn ngữ học là bắt buộc trên mọi bề mặt mà ngữ liệu xuất hiện. Khi một cộng đồng
   đã áp dụng các Nhãn TK hoặc BC của [Local Contexts](https://localcontexts.org/), chúng tôi
   dự định hiển thị chúng và tuân thủ giao thức mà chúng mã hóa; tính năng hỗ trợ Nhãn
   hiện chưa được triển khai. Chúng tôi sẽ mang theo các Nhãn; chúng tôi không bao giờ tự tạo ra chúng.

6. **Người đóng góp sẽ được trả thù lao.** Việc xây dựng và kiểm định ngữ liệu là
   công việc chuyên môn, sẽ được chi trả theo mức thù lao công bố khi có kinh phí (hiện tại
   dự án chưa giữ quỹ nào) — xem
   [Cách người bản ngữ nhận thù lao](/docs/network/perspectives/how-speakers-get-paid).
   Thanh toán thù lao không đồng nghĩa với việc mua đứt ngữ liệu: người xây dựng được trả công *và* vẫn là
   người quản lý dữ liệu (steward).

## Cách một giấy phép trở thành cơ chế thực thi

Cam kết 2 có hình thái cụ thể, và đáng để nêu ra đầy đủ — đây là
cách "mọi giấy phép đều được tôn trọng" thực sự vận hành, chứ không phải một bản tóm tắt
các ý định tốt đẹp.

**Mọi bộ benchmark khi tiếp nhận đều ở trạng thái tạm giữ.** Một tập kiểm thử mới được lập danh mục sẽ bị cách ly
theo mặc định: hiển thị trong chỉ mục, bị loại khỏi hàng đợi đánh giá, khỏi
các cuộc thi và khỏi mọi bảng xếp hạng. Không có bất kỳ giả định nào về ngữ liệu khi tiếp nhận
— kể cả khi giấy phép trông có vẻ thông thoáng — cho đến khi các điều khoản của nó được xem xét đối chiếu
với văn bản giấy phép thực tế tại một bản sửa đổi upstream được ghim cố định.

**Phán quyết rà soát mang tính máy móc, và các trường hợp phức tạp sẽ tiếp tục bị tạm giữ.** Một giấy phép
thông thoáng được nêu rõ ràng sẽ mở quyền cho ngữ liệu ở mọi làn. Một giấy phép
phi thương mại được nêu rõ ràng sẽ đưa nó vào làn nghiên cứu vốn bị loại trừ khỏi
mọi bề mặt thương mại, giải thưởng và API. Và một giấy phép không được nêu rõ,
bị chỉnh sửa, hỗn tạp hoặc mang tính đặc thù riêng sẽ **không bao giờ được diễn giải thay mặt
cho chủ sở hữu quyền**: ngữ liệu vẫn được ghi nhận trong danh mục nhưng ở trạng thái tạm giữ — nằm ngoài hàng đợi, các cuộc thi
và bảng xếp hạng — cho đến khi chủ sở hữu quyền nêu rõ các điều khoản hoặc ghi nhận quyền sử dụng.
Phán quyết, ngày tháng, làn phân loại và căn cứ của nó được đóng dấu ở định dạng máy đọc được trên
thẻ ngữ liệu và các mục registry của nó, nhờ đó câu hỏi "tại sao dữ liệu này có thể chạy được?" luôn có
câu trả lời có thể trích dẫn, và câu hỏi "tại sao dữ liệu này không thể chạy?" cũng vậy.

**Gửi văn bản đến một mô hình là một quá trình truyền tải, và nó có cổng kiểm soát.** Đánh giá
một mô hình đồng nghĩa với việc gửi cho nó các câu nguồn — đó là lúc ngữ liệu rời khỏi nơi lưu trữ ban đầu, và
điều này được kiểm soát theo từng giấy phép. Các ngữ liệu có giấy phép thông thoáng có thể sử dụng
các kênh tiêu chuẩn. Các ngữ liệu theo giấy phép phi thương mại được công bố chỉ được truyền tải qua
các kênh cam kết theo hợp đồng là không huấn luyện dựa trên dữ liệu đầu vào — được nêu chính xác như vậy:
một sự bảo đảm không huấn luyện (no-training), chứ không phải bảo đảm không lưu giữ (no-retention). Các ngữ liệu có quyền hạn chưa được nêu rõ
hoặc bị chỉnh sửa sẽ bị từ chối đánh giá từ xa hoàn toàn cho đến khi có sự đồng thuận
được ghi nhận, và các bộ dữ liệu cộng đồng niêm phong sẽ không bao giờ rời khỏi hạ tầng của người quản lý dữ liệu.
Khi cổng kiểm soát từ chối, thông báo từ chối của nó sẽ trích dẫn phán quyết rà soát giấy phép.

**Cơ chế thực thi nằm bên dưới mọi client.** Việc tạm giữ được thực thi bằng
một trigger cơ sở dữ liệu mà không client nào có thể vượt qua, quy tắc không lưu trữ được thực thi bằng
cổng pre-push, chạy cục bộ trước mỗi lần push (CI hiện đang bị tắt), quét
mọi đường dẫn được theo dõi và được push để tìm nội dung ngữ liệu, và cổng truyền tải
chạy bên trong chính khung đánh giá. Bất kỳ thành phần nào trong số này đều có thể
từ chối thao tác của chúng tôi, và đó chính là mục đích cốt lõi.

## Những điều dự án này không hướng tới

Champollion không phải là một nhà môi giới dữ liệu, không phải là một nhà cung cấp dịch vụ
dịch thuật, và không phải là một nền tảng thương mại. Đây là công cụ nghiên cứu. Điểm số
cao trên bảng xếp hạng chỉ chứng minh một phương pháp hoạt động hiệu quả về mặt kỹ thuật;
nó không phải là giấy phép để xuất bản các bản dịch, phân phối lại ngữ liệu, hoặc triển khai
bất kỳ thứ gì trái với mong muốn của cộng đồng. Những quyết định đó luôn thuộc về người quản trị.

## Các khung hoạt động định hình thiết kế này

Quan điểm này không phải do chúng tôi tự nghĩ ra. Nó được kế thừa và chịu ảnh hưởng sâu sắc
từ các công trình quản trị dữ liệu của người bản địa trong hai thập kỷ qua:

- **Các nguyên tắc về chủ quyền dữ liệu của First Nations** — Các quốc gia Bản địa First Nations tại Canada
  đã khẳng định quyền sở hữu, kiểm soát, truy cập và nắm giữ của cộng đồng đối với
  thông tin của chính họ; mô hình quản lý dữ liệu ở đây được thiết kế để
  tương thích với những khẳng định đó.
- **[Các nguyên tắc CARE](https://www.gida-global.org/care)** (Lợi ích tập thể,
  Quyền kiểm soát, Trách nhiệm, Đạo đức) — Liên minh Dữ liệu Bản địa Toàn cầu (Global Indigenous Data Alliance).
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — Mạng lưới Chủ quyền Dữ liệu người Māori (Māori Data Sovereignty Network).
- **[Giấy phép Kaitiakitanga](https://tehiku.nz/)** — Giấy phép dựa trên quyền giám hộ của Te Hiku Media dành cho dữ liệu tiếng Māori (te reo Māori), có ảnh hưởng trực tiếp đến mô hình lưu ký "người quản lý giữ chìa khóa" được sử dụng ở đây.

Chúng tôi khuyến khích bất kỳ ai đang thiết kế cơ chế quản trị cho dữ liệu ngôn ngữ của riêng họ
hãy tham khảo trực tiếp các nguồn đó — họ mới là những chuyên gia, không phải chúng tôi. Khi một
cộng đồng áp dụng bất kỳ khung hoạt động nào trong số này cho ngữ liệu của họ, thẻ ngữ liệu sẽ ghi nhận
khẳng định đó và bộ công cụ sẽ tôn trọng nó.

Champollion dự định áp dụng **Thông báo "Open to Collaborate"** và các Nhãn của Local Contexts;
hiện tại cả hai đều chưa được triển khai. Khi được áp dụng, các Nhãn do chính cộng đồng tạo ra
sẽ thay thế mọi điều chúng tôi phát biểu về dữ liệu của cộng đồng đó.

## Xem thêm

- [Chủ quyền dữ liệu, từ số không](/docs/learn/data-sovereignty) — phiên bản vỡ lòng của trang này, dành cho độc giả mới tiếp cận khái niệm

- [Đăng ký Ngữ liệu & Luồng Tiếp cận](/docs/network/sovereignty/registering-corpora) — cơ chế hoạt động
- [Dành cho các Cộng đồng Ngôn ngữ](/docs/network/community/for-language-communities) — hướng dẫn bằng ngôn ngữ phổ thông
- [Cách Người nói Ngôn ngữ được Trả phí](/docs/network/perspectives/how-speakers-get-paid) — các mức phí và điều khoản đã công bố
- [Các Phương pháp Dịch thuật](https://champollion.dev/docs/guides/translation-methods) — phương pháp `api`, giúp giữ các câu lệnh (prompt), từ điển và dữ liệu huấn luyện của cộng đồng trên máy chủ của riêng họ
