---
sidebar_position: 8
title: "Đăng ký Tập dữ liệu & Luồng tiếp cận"
slug: /network/sovereignty/registering-corpora
description: "Đăng ký một tập ngữ liệu đánh giá mà không cần giao nộp nó. Bốn cấp độ hiển thị — local-only, private, public và sealed — các luồng giấy phép hoạt động song song với chúng, và cách fetch-from-source đảm bảo nội dung tập ngữ liệu không rơi vào tay chúng tôi."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Đăng ký Tập dữ liệu (Corpora) & Luồng Tiếp cận (Exposure Lanes)

> **Tóm tắt nội dung.** Bạn có thể đăng ký một ngữ liệu đánh giá với Network để các phương pháp có thể được benchmark trên đó **mà không cần giao dữ liệu cho chúng tôi**. Mỗi ngữ liệu được đăng ký dưới dạng một *thẻ siêu dữ liệu* (metadata card) được ghim mã băm (sha-pinned), chứ không phải nội dung — các câu thực tế được lấy từ nguồn của chúng tại thời điểm đánh giá. Khi đăng ký, bạn đưa ra hai lựa chọn độc lập: một **cấp độ tiếp xúc** (exposure tier) — lượng dữ liệu rời khỏi máy của bạn (`local-only`, `private`, `public`, hoặc `sealed`, trong đó ngữ liệu được mã hóa trên thiết bị của bạn bằng khóa người giám sát M-of-N) — và một **luồng cấp phép** (license lane), quy định ngữ liệu có thể được sử dụng cho mục đích gì (công khai, chỉ dành cho nghiên cứu phi thương mại, hoặc riêng tư). Đây là cơ chế cho phép một cộng đồng làm cho ngôn ngữ của họ có thể *đo lường được* mà không bị *trích xuất*.

Đánh giá dịch máy thường đòi hỏi điều ngược lại với chủ quyền dữ liệu:
"hãy tải tập dữ liệu kiểm thử của bạn lên để chúng tôi có thể tính điểm dựa trên đó." Đây là điều không thể chấp nhận đối với
các ngôn ngữ bản địa và các tập dữ liệu do cộng đồng nắm giữ khác, nơi dữ liệu thuộc sở hữu của
chính những người tạo ra nó. Network được xây dựng để bạn không bao giờ phải thực hiện sự đánh đổi đó.

---

## 1. Đăng ký là siêu dữ liệu, không phải nội dung {#1-registration-is-metadata-not-content}

Một tập dữ liệu được đăng ký là một **thẻ (card)**: một bản ghi JSON nhỏ mô tả *nơi*
tập dữ liệu đó tồn tại và *nó là gì*, cùng với một mã băm nội dung (content hash) để có thể xác minh chính xác từng byte — nhưng **không chứa các câu**. Một thẻ mang các thông tin:

| Trường | Ý nghĩa |
|-------|-----------|
| `url` | Nơi tải tập dữ liệu về (kho lưu trữ thượng nguồn do bạn kiểm soát) |
| `sha256` | Mã băm nội dung của kho lưu trữ được ghim — chứng minh không ai thay đổi dữ liệu |
| `license` | Mã định danh SPDX (hoặc `LicenseRef-…` cho giấy phép tùy chỉnh) |
| `language_pair` | Nguồn → đích, ví dụ: `eng-crk` |
| `do_not_train` | Luôn được thiết lập — dữ liệu đánh giá tuyệt đối không được dùng để huấn luyện |
| `attribution` | Ghi nhận công lao của người xây dựng/nhà ngôn ngữ học được hiển thị ở mọi nơi tập dữ liệu xuất hiện |

Tại thời điểm đánh giá, hệ thống khai thác **sẽ tải về từ nguồn**, xác minh `sha256`,
và tính điểm dựa trên các tài liệu tham chiếu vừa tải về. Network không bao giờ lưu trữ, lưu trữ máy chủ (host),
hoặc phân phối lại nội dung tập dữ liệu. Nếu bạn ngoại tuyến kho lưu trữ thượng nguồn,
tập dữ liệu đơn giản là sẽ ngừng hoạt động — quyền kiểm soát vẫn thuộc về bạn. Đây là
cùng một nguyên tắc tải-từ-nguồn được áp dụng cho toàn bộ danh mục (xem
[Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets)).

:::info[Tại sao lại dùng mã hash thay vì một bản sao]
Một mã hash nội dung cho phép điểm số tự báo cáo được **kiểm tra lại** đối chiếu với ngữ liệu thực tế, chưa bị chỉnh sửa mà chúng tôi không bao giờ cần phải nắm giữ ngữ liệu đó. Một lượt chạy có các số liệu không khớp với nguồn được ghim bằng hash sẽ bị từ chối. Khả năng xác minh và việc không nắm giữ không hề mâu thuẫn ở đây — mã hash chính là thứ giúp cả hai điều này khả thi.
:::

---

## 2. Hai lựa chọn riêng biệt

Việc đăng ký sẽ hỏi bạn hai câu hỏi độc lập và bạn nên tách biệt chúng vì chúng bảo vệ những thứ khác nhau:

1. **Những gì rời khỏi máy của bạn** — *cấp độ tiếp xúc* (exposure tier).
2. **Ngữ liệu của bạn có thể được sử dụng cho mục đích gì** — *luồng cấp phép* (license lane).

Một ngữ liệu có thể được niêm phong (sealed) và phi thương mại, hoặc công khai và rõ ràng về mặt thương mại, hoặc bất kỳ sự kết hợp nào khác. Lựa chọn này không kéo theo lựa chọn kia.

### 2a. Cấp độ tiếp xúc — những gì rời khỏi máy của bạn

Bốn cấp độ, được định nghĩa trong `cli/lib/corpus-registration.mjs`. **Nội dung ngữ liệu dạng văn bản thuần túy (plaintext) không bao giờ được tải lên ở bất kỳ cấp độ nào** — đó không phải là một thiết lập chính sách, điều này đúng với mọi cấp độ. Việc đăng ký luôn mặc định ở mức riêng tư nhất.

| Cấp độ | Đã đăng ký? | Những gì chúng tôi nhận | Thẻ được theo dõi |
|---|:---:|---|:---:|
| **Riêng tư / chỉ cục bộ (Private / local-only)** | ❌ | Không có gì. Thẻ và văn bản ở lại trên máy của bạn. **Mặc định.** | ❌ |
| **Đăng ký riêng tư (Register privately)** | ✅ | Chỉ siêu dữ liệu — một tập hợp giữ bí mật kiểu WMT. Bạn giữ quyền quản lý; kết quả có thể được công bố mà không làm lộ dữ liệu. | ✅ |
| **Đăng ký công khai (Register publicly)** | ✅ | Siêu dữ liệu + một con trỏ lấy-từ-nguồn (fetch-from-source). Văn bản của bạn được lấy từ nguồn (upstream) theo yêu cầu, không bao giờ được lưu trữ ở đây. Cần có giấy phép cho phép phân phối lại. | ✅ |
| **Niêm phong (Sealed)** | ✅ | Bản mã (Ciphertext) + một thẻ không có nội dung. Không có gì khác. | ✅ |

**Niêm phong (Sealed) là sự đảm bảo mạnh mẽ nhất mà hệ thống cung cấp.** Ngữ liệu của bạn được mã hóa **trên thiết bị của bạn**, dưới khóa ngưỡng (threshold key) của nhóm người giám sát, trước khi một byte nào rời đi. Champollion nhận bản mã và không thể giải mã nó — và bất kỳ người giám sát đơn lẻ nào cũng không thể: cần **M trên N** người trong số họ cùng nhau ủy quyền cho một lần chạy. Các tập hợp được niêm phong được lập danh mục nhưng bị cách ly, và được ghép nối với một ngữ liệu *đủ điều kiện* (qualifier) công khai mà một phương pháp phải vượt qua trước khi một lần chạy niêm phong có thể được đề xuất. Xem [Chạy một Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) và [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Luồng cấp phép — ngữ liệu có thể được sử dụng cho mục đích gì

Một cách riêng biệt, giấy phép quy định nơi kết quả có thể xuất hiện.

#### Công khai (Public)

Một tập dữ liệu có giấy phép mở (ví dụ: CC0, CC-BY) có các tài liệu tham chiếu có thể xuất hiện trên các
giao diện công khai và các lượt chạy của nó có thể xếp hạng trên bảng xếp hạng công khai. Nội dung vẫn được
tải-từ-nguồn — "công khai" điều phối *việc hiển thị các tài liệu tham chiếu và xếp hạng*, không phải
việc lưu trữ máy chủ. Hầu hết danh mục (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) đều nằm trong luồng này.

#### Chỉ dành cho nghiên cứu phi thương mại (Non-commercial research-only)

Một tập dữ liệu theo giấy phép phi thương mại (ví dụ: CC BY-NC-SA, hoặc một giấy phép tùy chỉnh của
cộng đồng/NGO như `LicenseRef-TWB-Gamayun` của bộ công cụ Gamayun). Nó có thể
được **đo kiểm cho mục đích nghiên cứu** — các phương pháp chạy trên đó, điểm số được tính toán —
nhưng nó bị **loại trừ khỏi mọi lộ trình thương mại, giải thưởng và API.** Tính hợp lệ được
**dựa trên mục đích sử dụng**, không phải dựa trên tập dữ liệu:

- **luồng thương mại rất nghiêm ngặt** — bất kỳ thứ gì không có giấy phép thương mại rõ ràng đều bị
  loại trừ;
- **luồng nghiên cứu thì khoan dung** — các tập dữ liệu phi thương mại luôn được chào đón;
- **quy tắc cách ly luôn thắng** — một tập dữ liệu bị gắn cờ là một tập hợp con không hợp lệ (hoặc
  bị cấm vì lý do khác) không bao giờ có thể xếp hạng trong *bất kỳ* luồng nào, bất kể giấy phép là gì.

Đây là cách một cộng đồng có thể cho phép tập dữ liệu của họ thúc đẩy tiến trình nghiên cứu trong khi vẫn giữ
nó ngoài tầm với của bất kỳ sản phẩm thương mại nào.

#### Riêng tư (Private)

Một tập dữ liệu được đăng ký cho **các lượt chạy tính điểm của riêng bạn**, nơi các tài liệu tham chiếu không bao giờ
được công bố. Bạn nắm giữ nguồn; bạn chạy đánh giá; bạn quyết định những gì, nếu có,
được hiển thị. Một tập dữ liệu riêng tư có thể được chuyển sang công khai hoặc phi thương mại
sau đó — mức độ tiếp cận chỉ có thể *nới lỏng* bằng một quyết định rõ ràng do chủ sở hữu đưa ra, không bao giờ
diễn ra một cách âm thầm.

| Luồng cấp phép | Có thể benchmark | Tham chiếu hiển thị công khai | Có thể xếp hạng trên bảng công khai | Trong luồng thương mại / giải thưởng / API |
|------|:---:|:---:|:---:|:---:|
| **Công khai (Public)** | ✅ | ✅ | ✅ | ✅ (nếu giấy phép cho phép) |
| **Chỉ dành cho nghiên cứu phi thương mại** | ✅ | tùy thuộc vào giấy phép | chỉ luồng nghiên cứu | ❌ |
| **Riêng tư (Private)** | ✅ (các lần chạy của bạn) | ❌ | ❌ | ❌ |

:::note[Luồng thương mại là một rào chắn bảo vệ, không phải là một hoạt động kinh doanh]
Bản thân Champollion là phi thương mại — không có API trả phí hay sản phẩm nào đứng sau tất cả những điều này. Luồng thương mại/giải thưởng tồn tại như một rào chắn bảo vệ *phòng ngừa*: nó ghi lại một cách tự động những ngữ liệu nào có thể xuất hiện một cách hợp pháp trong bối cảnh giải thưởng hoặc thương mại, để không một mục đích sử dụng nào trong tương lai — bởi bất kỳ ai — có thể chệch khỏi giấy phép hoặc các điều khoản của bên quản lý.
:::

---

## 3. Đảm bảo chủ quyền

Việc đăng ký được thiết kế xoay quanh [quan điểm quản lý dữ liệu](/docs/network/sovereignty/data-sovereignty).
Cụ thể:

- **Quyền sở hữu vẫn thuộc về nguồn.** Chúng tôi giữ một mã băm và một URL, không giữ dữ liệu.
- **Quyền kiểm soát thuộc về chủ sở hữu.** Luồng tiếp cận là lựa chọn của chủ sở hữu, và mức độ tiếp cận chỉ
  nới lỏng bằng một quyết định rõ ràng. Việc gỡ bỏ kho lưu trữ thượng nguồn sẽ thu hồi khả năng chạy đánh giá.
- **Phi thương mại nghĩa là phi thương mại.** Các tập dữ liệu NC được loại trừ một cách cơ học
  khỏi các luồng thương mại, giải thưởng và API — không phải bằng lời hứa, mà bằng cổng chặn.
- **Các tập hợp con không hợp lệ không bao giờ có thể xếp hạng.** Quy tắc cách ly ghi đè giấy phép, vì vậy một tập dữ liệu
  bị cấm xếp hạng sẽ bị cấm ở mọi nơi.
- **Ghi nhận công lao là bắt buộc.** Thông tin ghi nhận người xây dựng/nhà ngôn ngữ học sẽ đi kèm với thẻ
  đến mọi giao diện mà tập dữ liệu xuất hiện.

Để biết cách thiết lập các điều khoản cho từng ngôn ngữ — bao gồm cả việc chuyển giao quyền sở hữu phương pháp cho
các giải thưởng được tài trợ — xem [Sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer).

---

## 4. Cách đăng ký

Sơ đồ thẻ tập dữ liệu (corpus card schema) và các công cụ xây dựng/xác minh được tài liệu hóa trong
[Khung thiết kế tập dữ liệu](/docs/network/specifications/corpus-design) và
[Hướng dẫn tạo tập dữ liệu](/docs/network/tutorials/corpus-creation). Tóm lại:

1. Lưu trữ kho lưu trữ tập dữ liệu ở một nơi nào đó bạn kiểm soát (nó sẽ ở đó — nó không bao giờ
   bị sao chép vào Network).
2. Viết một thẻ: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Chọn luồng tiếp cận (công khai / phi thương mại / riêng tư).
4. Đăng ký thẻ. Các phương pháp hiện có thể được đo kiểm dựa trên tập dữ liệu
   tải-từ-nguồn, theo các quy tắc của luồng đã chọn.

Bạn không bao giờ phải tải các câu lên. Bạn có thể dừng lại bất kỳ lúc nào.
