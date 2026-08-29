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

> **Tóm tắt.** Champollion là công cụ nghiên cứu và phát triển dịch máy — có sẵn mã nguồn và miễn phí cho mục đích phi thương mại, bộ công cụ đánh giá của nó là mã nguồn mở. Trang này trình bày đầy đủ quan điểm của dự án về dữ liệu ngôn ngữ: các ngữ liệu thuộc về cộng đồng nguồn của chúng, mọi giấy phép và điều khoản cộng đồng đều được tôn trọng bằng cơ chế kỹ thuật thay vì chỉ bằng lời hứa, và nền tảng này không đặt ra bất kỳ điều khoản riêng nào đối với ngôn ngữ của bất kỳ ai.

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

2. **Mọi giấy phép đều được tôn trọng — bằng rào cản kỹ thuật, không bằng lời hứa.**
   Các ngữ liệu phi thương mại và chỉ dùng cho nghiên cứu sẽ bị loại trừ một cách tự động
   khỏi bất kỳ mục đích sử dụng nào mà giấy phép của chúng không cho phép. Các hạn chế
   do cộng đồng đưa ra ngoài phạm vi giấy phép sẽ được ghi nhận cùng với nguồn của chúng
   và được tôn trọng theo cách tương tự. Việc thực thi này nằm trong các cổng kiểm duyệt CI
   và trigger của cơ sở dữ liệu, không phải trong quy tắc ứng xử.

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

5. **Ghi nhận công lao và đóng góp luôn đi kèm với dữ liệu.** Việc ghi nhận công lao của
   người xây dựng và nhà ngôn ngữ học là bắt buộc trên mọi giao diện mà ngữ liệu xuất hiện.
   Nơi nào cộng đồng đã áp dụng các Nhãn TK hoặc BC của [Local Contexts](https://localcontexts.org/),
   chúng tôi sẽ hiển thị chúng và tôn trọng giao thức mà chúng mã hóa. Chúng tôi truyền tải
   các Nhãn; chúng tôi không bao giờ tự tạo ra chúng.

6. **Người đóng góp được trả phí.** Việc xây dựng và xác thực ngữ liệu là công việc chuyên
   môn được trả lương theo mức giá đã công bố — xem
   [Cách Người nói Ngôn ngữ được Trả phí](/docs/network/perspectives/how-speakers-get-paid).
   Việc thanh toán không có nghĩa là mua lại ngữ liệu: người xây dựng được trả phí *và*
   vẫn là người quản trị ngữ liệu đó.

## Cách một giấy phép được thực thi

Cam kết 2 có một hình thức cụ thể và đáng để trình bày đầy đủ — đây là cách "mọi giấy phép đều được tôn trọng" thực sự vận hành, chứ không phải là một bản tóm tắt những ý định tốt đẹp.

**Mọi benchmark đều được tạm giữ khi đưa vào.** Một tập kiểm tra mới được lập danh mục sẽ bị cách ly theo mặc định: hiển thị trong chỉ mục, nhưng bị loại khỏi hàng đợi đánh giá, các cuộc thi và mọi bảng xếp hạng. Không có bất kỳ giả định nào về một ngữ liệu khi tiếp nhận — ngay cả với một giấy phép trông có vẻ cởi mở — cho đến khi các điều khoản của nó được xem xét đối chiếu với văn bản giấy phép thực tế tại một bản sửa đổi gốc (upstream revision) được ghim.

**Các phán quyết đánh giá được thực hiện một cách máy móc, và những trường hợp khó sẽ tiếp tục bị tạm giữ.** Một giấy phép cởi mở được nêu rõ ràng sẽ thông qua ngữ liệu cho mọi luồng (lane). Một giấy phép phi thương mại được nêu rõ ràng sẽ thông qua nó vào một luồng nghiên cứu, bị loại trừ khỏi mọi bề mặt thương mại, giải thưởng và API. Và một giấy phép không được nêu rõ, bị sửa đổi, hỗn hợp hoặc tùy chỉnh sẽ **không bao giờ được diễn giải thay cho chủ sở hữu quyền**: ngữ liệu vẫn được lập danh mục nhưng bị tạm giữ — nằm ngoài hàng đợi, các cuộc thi và bảng xếp hạng — cho đến khi chủ sở hữu quyền nêu rõ các điều khoản hoặc ghi nhận việc cấp phép. Phán quyết, ngày tháng, luồng và cơ sở của nó được ghi lại dưới dạng máy có thể đọc được trên thẻ ngữ liệu và các mục đăng ký của nó, để câu hỏi "tại sao cái này có thể chạy được?" luôn có một câu trả lời có thể trích dẫn, và câu hỏi "tại sao cái này không thể?" cũng vậy.

**Gửi văn bản đến một mô hình là một sự truyền tải, và nó được kiểm soát.** Đánh giá một mô hình có nghĩa là gửi cho nó các câu nguồn — đó là lúc ngữ liệu rời khỏi nơi lưu trữ, và điều này được quản lý theo giấy phép. Các ngữ liệu được cấp phép cởi mở có thể sử dụng các kênh tiêu chuẩn. Các ngữ liệu theo giấy phép phi thương mại được nêu rõ chỉ di chuyển qua các kênh mà theo hợp đồng không huấn luyện trên dữ liệu đầu vào — được nêu chính xác là: một sự đảm bảo không huấn luyện (no-training), chứ không phải là không lưu giữ (no-retention). Các ngữ liệu theo các cấp phép không được nêu rõ hoặc bị sửa đổi sẽ bị từ chối đánh giá từ xa hoàn toàn cho đến khi sự đồng ý được ghi nhận, và các tập dữ liệu cộng đồng được niêm phong sẽ không bao giờ rời khỏi cơ sở hạ tầng của người quản lý chúng. Khi cổng kiểm soát từ chối, thông báo từ chối của nó sẽ trích dẫn phán quyết đánh giá giấy phép.

**Sự thực thi nằm bên dưới mọi client.** Việc tạm giữ được thực thi bởi một trigger cơ sở dữ liệu mà không client nào có thể vượt qua, quy tắc không lưu trữ (no-hosting) được thực thi bởi một cổng kho lưu trữ quét mọi đường dẫn được theo dõi để tìm nội dung ngữ liệu, và cổng truyền tải chạy bên trong chính bộ công cụ đánh giá. Bất kỳ thành phần nào trong số này đều có thể nói không với chúng tôi, đó chính là mấu chốt.

## Những điều dự án này không hướng tới

Champollion không phải là một nhà môi giới dữ liệu, không phải là một nhà cung cấp dịch vụ
dịch thuật, và không phải là một nền tảng thương mại. Đây là công cụ nghiên cứu. Điểm số
cao trên bảng xếp hạng chỉ chứng minh một phương pháp hoạt động hiệu quả về mặt kỹ thuật;
nó không phải là giấy phép để xuất bản các bản dịch, phân phối lại ngữ liệu, hoặc triển khai
bất kỳ thứ gì trái với mong muốn của cộng đồng. Những quyết định đó luôn thuộc về người quản trị.

## Các khung hoạt động định hình thiết kế này

Quan điểm này không phải do chúng tôi tự nghĩ ra. Nó được kế thừa và chịu ảnh hưởng sâu sắc
từ các công trình quản trị dữ liệu của người bản địa trong hai thập kỷ qua:

- **Các nguyên tắc chủ quyền dữ liệu của First Nations** — các First Nations ở Canada
  đã khẳng định quyền sở hữu, kiểm soát, truy cập và chiếm hữu của cộng đồng đối với
  thông tin của chính họ; mô hình quản trị ở đây được thiết kế để tương thích với những khẳng định đó.
- **[Các Nguyên tắc CARE](https://www.gida-global.org/care)** (Lợi ích tập thể, Quyền kiểm soát,
  Trách nhiệm, Đạo đức) — Liên minh Dữ liệu Bản địa Toàn cầu (Global Indigenous Data Alliance).
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — Mạng lưới Chủ quyền Dữ liệu Māori.
- **[Giấy phép Kaitiakitanga](https://tehiku.nz/)** — Giấy phép dựa trên quyền giám hộ của Te Hiku Media
  đối với dữ liệu tiếng Māori (te reo Māori), một ảnh hưởng trực tiếp đến mô hình lưu ký "người quản trị
  nắm giữ chìa khóa" được sử dụng ở đây.

Chúng tôi khuyến khích bất kỳ ai đang thiết kế cơ chế quản trị cho dữ liệu ngôn ngữ của riêng họ
hãy tham khảo trực tiếp các nguồn đó — họ mới là những chuyên gia, không phải chúng tôi. Khi một
cộng đồng áp dụng bất kỳ khung hoạt động nào trong số này cho ngữ liệu của họ, thẻ ngữ liệu sẽ ghi nhận
khẳng định đó và bộ công cụ sẽ tôn trọng nó.

Champollion hiển thị **Thông báo "Sẵn sàng Hợp tác" (Open to Collaborate)** của Local Contexts: chúng tôi
xây dựng mối quan hệ với các cộng đồng có ngôn ngữ xuất hiện ở đây, và các Nhãn do cộng đồng tự soạn thảo
sẽ thay thế cho bất kỳ điều gì chúng tôi nói về dữ liệu của họ.

## Xem thêm

- [Chủ quyền Dữ liệu, từ con số không](/docs/learn/data-sovereignty) — phiên bản nhập môn của trang này, dành cho những độc giả mới làm quen với khái niệm này

- [Đăng ký Ngữ liệu & Luồng Tiếp cận](/docs/network/sovereignty/registering-corpora) — cơ chế hoạt động
- [Dành cho các Cộng đồng Ngôn ngữ](/docs/network/community/for-language-communities) — hướng dẫn bằng ngôn ngữ phổ thông
- [Cách Người nói Ngôn ngữ được Trả phí](/docs/network/perspectives/how-speakers-get-paid) — các mức phí và điều khoản đã công bố
- [Các Phương pháp Dịch thuật](https://champollion.dev/docs/guides/translation-methods) — phương pháp `api`, giúp giữ các câu lệnh (prompt), từ điển và dữ liệu huấn luyện của cộng đồng trên máy chủ của riêng họ
