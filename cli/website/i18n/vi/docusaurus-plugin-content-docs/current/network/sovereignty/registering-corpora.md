---
sidebar_position: 8
title: "Đăng ký Tập dữ liệu & Luồng tiếp cận"
slug: /network/sovereignty/registering-corpora
description: "Đăng ký tập ngữ liệu đánh giá mà không cần phải bàn giao nó. Bốn cấp độ hiển thị — local-only, private, public và sealed —, các luồng giấy phép song hành, và cách fetch-from-source giúp nội dung ngữ liệu không nằm trong tay chúng tôi."
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

> **Tóm tắt tổng quan.** Bạn có thể đăng ký một ngữ liệu đánh giá với Network để
> các phương pháp có thể được đo kiểm chuẩn (benchmark) dựa trên ngữ liệu đó **mà không cần giao dữ liệu cho chúng tôi**. Mọi
> ngữ liệu đều được đăng ký dưới dạng một *thẻ siêu dữ liệu* được ghim mã sha (sha-pinned), không phải nội dung — các câu
> thực tế được tìm nạp từ nguồn của chúng tại thời điểm đánh giá. Khi đăng ký,
> bạn đưa ra hai lựa chọn độc lập: một **tầng hiển thị (exposure tier)** — mức độ dữ liệu rời khỏi máy
> của bạn (`local-only`, `private`, `public`, hoặc `sealed`, trong đó ngữ liệu được
> mã hóa trên thiết bị của bạn dưới khóa người giám sát M-trên-N) — và một **luồng giấy phép (license
> lane)**, quy định mục đích sử dụng ngữ liệu (công khai, chỉ nghiên cứu phi thương
> mại, hoặc riêng tư). Đây là cơ chế cho phép một cộng đồng làm cho ngôn ngữ của mình
> *có thể đo lường được* mà không làm cho nó *bị trích xuất được*.

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

Việc đăng ký đặt ra cho bạn hai câu hỏi độc lập, và rất đáng để tách biệt
chúng vì chúng bảo vệ những thứ khác nhau:

1. **Dữ liệu nào rời khỏi máy của bạn** — *tầng hiển thị* (exposure tier).
2. **Ngữ liệu của bạn có thể được dùng cho mục đích gì** — *luồng giấy phép* (license lane).

Một ngữ liệu có thể được niêm phong và phi thương mại, hoặc công khai và rõ ràng về thương mại, hoặc
bất kỳ sự kết hợp nào khác. Lựa chọn này không ngụ ý hay quy định lựa chọn kia.

### 2a. Các tầng hiển thị — dữ liệu nào rời khỏi máy của bạn

Bốn tầng, được định nghĩa trong `cli/lib/corpus-registration.mjs`. **Nội dung ngữ liệu dạng văn bản thuần
(plaintext) không bao giờ được tải lên ở bất kỳ tầng nào** — đó không phải là một cài đặt chính sách, mà là điều
đúng với mọi tầng. Đăng ký luôn mặc định ở mức riêng tư nhất.

| Tầng | Đã đăng ký? | Những gì chúng tôi nhận được | Thẻ được theo dõi |
|---|:---:|---|:---:|
| **Riêng tư / chỉ cục bộ** | ❌ | Không có gì. Thẻ và văn bản ở lại trên máy của bạn. **Mặc định.** | ❌ |
| **Đăng ký riêng tư** | ✅ | Chỉ siêu dữ liệu — một tập held-out bí mật theo phong cách WMT. Bạn giữ quyền giám hộ; kết quả có thể được công bố mà không để lộ dữ liệu. | ✅ |
| **Đăng ký công khai** | ✅ | Siêu dữ liệu + một con trỏ tìm nạp từ nguồn (fetch-from-source). Văn bản của bạn được tìm nạp theo yêu cầu từ thượng nguồn, không bao giờ được lưu trữ tại đây. Cần có giấy phép cho phép phân phối lại. | ✅ |
| **Được niêm phong (Sealed)** | ✅ | Thẻ không chứa nội dung. Bản mã (ciphertext) ở lại với bạn. | ✅ |

#### Giữ tập kiểm thử tránh xa mọi dịch vụ AI bên ngoài

Không tải văn bản của bạn lên là một đảm bảo. Không *gửi* nó đến API của mô hình
trong khi bạn đánh giá lại là một đảm bảo khác, và điều này quan trọng nhất đối với một tập kiểm thử
chứa từ ngữ nhạy cảm. Hãy đánh dấu tệp là chỉ cục bộ (local-only) bằng cách đặt một tệp nhỏ
bên cạnh nó, được đặt tên theo tệp đó với phần bổ sung `.champollion.json`:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Điều này áp dụng cho bất kỳ định dạng ngữ liệu nào (TSV, JSONL, các cặp văn bản thuần, JSON). Kể từ
thời điểm đó, `mt-eval run` sẽ coi ngữ liệu là được niêm phong:
- với một nhà cung cấp từ xa (OpenRouter, OpenAI, Anthropic, Gemini), lượt chạy sẽ bị
  **từ chối trước khi bất kỳ văn bản nào được gửi đi**, và trước khi bất kỳ khóa API nào được yêu cầu;
- với `--provider local` trỏ tới một mô hình trên máy này (một địa chỉ
  loopback chẳng hạn như `http://localhost:11434/v1`), lượt chạy sẽ tiếp tục;
- với `--method local-model -m <model>` (mô hình NLLB, OPUS-MT hoặc MADLAD
  mà bộ khung harness tải trong tiến trình riêng của nó; yêu cầu có `-m`), lượt chạy sẽ tiếp tục:
  không câu nào rời khỏi
  máy, và việc tải về trọng số chỉ truyền các tệp mô hình, không bao giờ truyền văn bản của bạn;
- với một công cụ dịch máy (MT engine) hoặc một plugin phương pháp (`--method <plugin dir>`), lượt chạy sẽ bị
  từ chối trừ khi bạn xác nhận rằng phương thức truyền tải (transport) của nó là hoàn toàn cục bộ
  (`--attest-local-transport`, được ghi lại trong nhật ký lượt chạy): bộ khung harness không thể
  biết một plugin hoặc một dịch vụ gửi văn bản tới đâu;
- các chỉ số đánh giá riêng của ngôn ngữ từ thẻ ngôn ngữ của nó **không
  được tải**. Chúng đến từ các gói riêng biệt có thể tra cứu từ ngữ trên một
  dịch vụ bên ngoài, chẳng hạn như từ điển trực tuyến. Lượt chạy được tính điểm mà không có
  chúng, và thẻ lượt chạy cho biết chúng đã được giữ lại và lý do tại sao;
- `mt-eval publish` giữ lại các câu và theo mặc định sẽ thay thế một
  prompt tùy chỉnh hoặc prompt huấn luyện (coaching prompt) bằng mã sha256 của nó, vì vậy các ví dụ prompt được trích xuất từ
  chính các câu của bạn cũng sẽ ở lại trên máy này. Một số siêu dữ liệu về ngữ liệu
  vẫn được công khai cùng với điểm số: id, phiên bản, cặp ngôn ngữ, kích thước,
  mã sha256 của tệp, giấy phép và ghi công, mức độ nhiễm bẩn, việc
  nó được đánh dấu là chỉ cục bộ, và tên các phân đoạn của nó. Đối với một id không phải là
  tập dữ liệu đã đăng ký, việc xuất bản cũng tạo một hàng `datasets` công khai với
  cùng id, cặp ngôn ngữ, kích thước và sha256, cùng với miền, tên phân đoạn và
  dải độ khó của nó. Bản xem trước `--dry-run` liệt kê những thông tin này cho lượt chạy của bạn, bên cạnh
  những gì ở lại tại đây: từng câu, tệp và đường dẫn của tệp. Khi đó, những người khác sẽ thấy
  điểm số trên một tập kiểm thử mà họ không thể mở. Nó được tự kiểm chuẩn (self-benchmarked), không ai khác
  có thể chạy lại, và mã sha256 chỉ cho phép người nắm giữ cùng một tệp
  xác nhận đó chính là tệp đó;
- những gì công cụ in ra sẽ lược bỏ các câu, vì một tác tử AI đọc
  terminal sẽ truyền những gì nó đọc được cho nhà cung cấp mô hình của nó. `mt-eval compare`
  hiển thị id mục và điểm số thay vì các câu, và thông báo lỗi
  trích dẫn một câu sẽ được in ra mà câu đó đã bị xóa bỏ. `--show-text` in chúng ra, dành cho
  người ngồi tại terminal. Các tệp được ghi vào thư mục kết quả của bạn vẫn giữ lại
  văn bản, và mỗi tệp đều mang dấu hiệu của ngữ liệu: mọi nhật ký lượt chạy, báo cáo,
  tệp so sánh và bảng điều khiển (dashboard) mà bộ khung harness ghi từ ngữ liệu đều có
  `.champollion.json` riêng với cùng các điều khoản cộng thêm `derived_from`. Khi đó, công cụ
  tiếp theo, hoặc một lượt chạy sau này trên tệp đó, cũng sẽ xử lý nó như một tệp được bảo vệ.
  Terminal sẽ nêu tên từng tệp chứa văn bản;
- bộ nhớ đệm dịch thuật (translation cache) tách riêng các mục của ngữ liệu này: dưới
  `<cache-dir>/protected/<namespace>/` (mặc định là
  `eval/cache/harness/protected/…`), trong một không gian tên (namespace) có khóa theo cài đặt của lượt chạy,
  mã sha256 của ngữ liệu và các điều khoản của nó, để một mục chỉ được
  phục vụ lại cho một lượt chạy trên chính ngữ liệu này — không bao giờ phục vụ cho một lượt chạy trên ngữ liệu khác hoặc
  ngữ liệu không được đánh dấu. Mọi tệp bộ nhớ đệm tại đó đều mang cùng dấu hiệu `.champollion.json`.
  (Các mục được lưu vào bộ nhớ đệm trước khi biện pháp bảo vệ này tồn tại sẽ nằm trong bộ nhớ đệm
  thông thường mà không được đánh dấu; hãy xóa `eval/cache/harness/` một lần để dọn dẹp chúng.)

Dấu hiệu đánh dấu chỉ có thể làm cho ngữ liệu trở nên nghiêm ngặt hơn. Không giấy phép nào và không
cờ `--allow-data-collection` nào có thể nới lỏng nó. Nếu tệp đánh dấu
không đọc được, lượt chạy sẽ dừng lại thay vì bỏ qua nó.

**Niêm phong (Sealed) là sự đảm bảo mạnh mẽ nhất mà hệ thống cung cấp.** Ngữ liệu của bạn được
mã hóa **trên thiết bị của bạn**, theo khóa của nhóm người giám sát, và bản mã
ở lại trên máy của bạn hoặc nút đánh giá của bạn. Champollion chỉ nhận được
thẻ không chứa nội dung. Trên nút ngoại tuyến, khóa được phân chia sao cho cần
**M trên N** người giám sát cùng nhau cấp phép cho một lượt chạy; nghi thức đó đã được xây dựng nhưng
chưa được sử dụng với những người giám sát thực tế. Các tập niêm phong được lập danh mục nhưng được cách ly, và được ghép đôi với
một ngữ liệu *vòng loại* (qualifier) công khai mà một phương pháp phải vượt qua trước khi một lượt chạy niêm phong có thể
được đề xuất. Xem [Tổ chức cuộc thi độc lập (Sovereign Contest)](/docs/network/sovereignty/run-a-sovereign-contest) và [Nút đánh giá độc lập (Sovereign Eval Node)](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Các luồng giấy phép — ngữ liệu có thể được dùng cho mục đích gì

Một cách riêng biệt, giấy phép chi phối nơi kết quả có thể xuất hiện.

#### Public

Một tập dữ liệu có giấy phép mở (ví dụ: CC0, CC-BY) có các tài liệu tham chiếu có thể xuất hiện trên các
giao diện công khai và các lượt chạy của nó có thể xếp hạng trên bảng xếp hạng công khai. Nội dung vẫn được
tải-từ-nguồn — "công khai" điều phối *việc hiển thị các tài liệu tham chiếu và xếp hạng*, không phải
việc lưu trữ máy chủ. Hầu hết danh mục (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) đều nằm trong luồng này.

#### Non-commercial research-only

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

#### Private

Một tập dữ liệu được đăng ký cho **các lượt chạy tính điểm của riêng bạn**, nơi các tài liệu tham chiếu không bao giờ
được công bố. Bạn nắm giữ nguồn; bạn chạy đánh giá; bạn quyết định những gì, nếu có,
được hiển thị. Một tập dữ liệu riêng tư có thể được chuyển sang công khai hoặc phi thương mại
sau đó — mức độ tiếp cận chỉ có thể *nới lỏng* bằng một quyết định rõ ràng do chủ sở hữu đưa ra, không bao giờ
diễn ra một cách âm thầm.

| Luồng giấy phép | Có thể đo benchmark | Tài liệu tham chiếu hiển thị công khai | Có thể xếp hạng trên bảng công khai | Trong lộ trình thương mại / giải thưởng / API |
|------|:---:|:---:|:---:|:---:|
| **Public** | ✅ | ✅ | ✅ | ✅ (nếu giấy phép cho phép) |
| **Non-commercial research-only** | ✅ | tùy thuộc vào giấy phép | chỉ luồng nghiên cứu | ❌ |
| **Private** | ✅ (các lượt chạy của bạn) | ❌ | ❌ | ❌ |

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

### ID của thẻ

`champollion register-corpus` sẽ ghi thẻ cho bạn và gán cho nó một id có
dạng `eval-<source>-<target>-<name>[-<role>]-v1`:

- **name** đến từ `--name`: "Ward phrases" trở thành `ward-phrases`. Bên
  xuất bản chỉ được sử dụng khi tên không có ký tự a–z hoặc 0–9, ví
  dụ như một cái tên chỉ được viết bằng chữ ký âm (syllabics).
- **role** cho biết tập dữ liệu dùng để làm gì: `--role test`, `--role dev` hoặc
  `--role train`. Nó chỉ xuất hiện trong id khi bạn truyền vào. Công cụ không bao giờ
  đoán vai trò, do đó một tập kiểm thử held-out chỉ được gọi là tập kiểm thử nếu bạn
  chỉ định rõ.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Lệnh này đăng ký `eval-eng-xyz-ward-phrases-test-v1`. Để tự chọn id,
hãy truyền `--id eval-…`; nó sẽ được sử dụng chính xác như được cung cấp.

### ID giấy phép nào cho một tập kiểm thử riêng tư

`--license` ghi lại các điều khoản mà những người sở hữu dữ liệu thực sự cấp quyền. Đây
không phải là một phần giữ chỗ (placeholder), và công cụ không chọn thay cho bạn. Hãy hỏi họ
trước (các gia đình, bác sĩ lâm sàng, người quản lý dữ liệu của cộng đồng), sau đó chọn
id thể hiện đúng những gì họ đã trao đổi:

| Những gì chủ sở hữu cấp quyền | `--license` |
|---|---|
| Họ đã xuất bản văn bản theo một giấy phép tiêu chuẩn | id SPDX của giấy phép đó, ví dụ: `CC-BY-NC-4.0` |
| Chỉ sử dụng để tính điểm hệ thống: không bao giờ huấn luyện trên đó, không bao giờ phân phối lại, không tính điểm trả phí | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| Tương tự, nhưng cho phép tính điểm cho người dùng trả phí | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Không cấp quyền nào ngoài mục đích sử dụng của riêng họ: bảo lưu mọi quyền | `proprietary` (`LicenseRef-Proprietary`) |
| Các điều khoản riêng của họ mà không có điều nào ở trên đề cập | `LicenseRef-<a name for their terms>`, nhập nguyên văn, kèm theo các điều khoản được ghi lại nơi người quản trị lưu giữ chúng |

Mỗi id `LicenseRef-…` trong bảng (bao gồm hai khoản cấp quyền đánh giá và
`proprietary`) là một khoản cấp quyền đặc thù (bespoke grant): Champollion không bao giờ đọc nó thay
cho chủ sở hữu. Việc đánh giá từ xa đối với ngữ liệu này sẽ bị từ chối cho đến khi người quản trị
ghi lại sự cho phép của họ, vì vậy chỉ có các mô hình trên chính máy của bạn mới được kiểm thử
dựa trên nó. Nếu bạn không chắc chắn, lựa chọn thận trọng nhất mà vẫn cho phép
bạn đo lường là `community-eval-grant-nc`; hãy ghi lại nó dưới dạng tạm thời và
yêu cầu người quản trị xác nhận hoặc chỉ định đúng giấy phép.

Giấy phép không làm thay đổi nơi các câu được chuyển tới. Một tập chỉ cục bộ (dấu
hiệu `.champollion.json`, hoặc `--tier local-only`) sẽ ở lại trên máy của bạn
bất kể giấy phép của nó quy định điều gì: dấu hiệu đánh dấu sẽ từ chối mọi mô hình từ xa, và một
giấy phép không bao giờ có thể nới lỏng điều này. Giấy phép chi phối những gì người khác có thể làm với
tập dữ liệu nếu nó từng được chia sẻ, và những luồng đánh giá nào nó có thể tham gia. Khi một tệp đã
được đăng ký với `--data`, id của nó sẽ được ghi lại trong tệp
`.champollion.json` bên cạnh nó và không bao giờ thay đổi. Việc đăng ký lại tệp đó
sẽ dừng lại và yêu cầu bạn truyền id bằng `--id`.

Đối với một tập kiểm thử mà một mô hình có thể được huấn luyện dựa trên đó (`--role test`, hoặc một
tập chỉ cục bộ hoặc riêng tư không có vai trò), lệnh sau đó sẽ in ra các
bước nmt-forge phải thực hiện trước lần tính điểm đầu tiên của tập dữ liệu: đăng ký nó,
sàng lọc ngữ liệu huấn luyện của bạn đối chiếu với nó, và ghi lại các dự đoán của bạn.
Mức cơ sở (baseline) `mt-eval run` được thực hiện sau các bước đó. Một bài benchmark là một lần đọc để tính điểm,
và nmt-forge sẽ từ chối các dự đoán được ghi lại sau một lần tính điểm như vậy.

`mt-eval run --corpus <that file>` tìm thẻ thông qua cùng tệp
`.champollion.json` đó. ID tập dữ liệu của lượt chạy chính là id của thẻ, do đó mọi lượt chạy
trên tập dữ liệu đều mang cùng một tên, và tên tệp vẫn được giữ trên lượt chạy dưới dạng
đường dẫn ngữ liệu của nó. Mức độ nhiễm bẩn của thẻ được báo cáo đúng như những gì thẻ nêu.
Cả hai điều này chỉ áp dụng chừng nào tệp vẫn là tệp bạn đã đăng ký: nếu tệp đã
thay đổi kể từ đó, lượt chạy sẽ thông báo điều này và không sử dụng cả hai.

Thẻ `local-only`, `private` hoặc `sealed` cho biết văn bản của nó chưa được xuất bản
(`Contamination: NONE`), vì vậy quá trình đăng ký trước tiên sẽ so sánh tệp bạn truyền
bằng `--data` (hoặc `--seal-input`) với các ngữ liệu công khai. Một bản
checkout từ kho lưu trữ (repository) sẽ so sánh tệp với các thẻ ngữ liệu mà nó chứa. Một bản cài đặt qua npm, vốn
không đi kèm thẻ ngữ liệu nào, sẽ so sánh tệp với danh mục ngữ liệu công khai: CLI
sẽ tải xuống các id và mã tổng kiểm (checksum) của các ngữ liệu công khai và so sánh chúng trên máy
của bạn, nhờ đó mã checksum của tệp không bao giờ rời khỏi máy. Khi tệp khớp từng byte
với một ngữ liệu công khai (cùng mã sha256), việc đăng ký sẽ dừng lại và nêu tên ngữ liệu đó.
Hãy đăng ký nó ở dạng công khai, sử dụng các câu thực sự riêng tư, hoặc giữ nguyên
tầng và khai báo mức hiển thị bằng `--contamination` (khi đó thẻ sẽ ghi nhận
rằng văn bản là công khai). Một tập niêm phong chứa văn bản công khai sẽ bị từ chối: vì nó sẽ
không kiểm thử được điều gì.

Khi không thể thực hiện so sánh (bạn đang ngoại tuyến, hoặc không thể truy cập
danh mục), thẻ sẽ được xếp loại `Contamination: UNCHECKED`, chứ không phải `NONE`, trừ khi
bạn tự khai báo mức xếp loại bằng `--contamination`. Hãy đăng ký lại khi trực tuyến để
so sánh. `mt-eval` xử lý một ngữ liệu `UNCHECKED` giống như bất kỳ ngữ liệu nào
không được xếp loại `LOW`: điểm số của nó sẽ được đưa vào luồng chỉ-so-sánh-tương-đối (relative-comparison-only). Quá trình
kiểm tra sẽ so sánh toàn bộ tệp, do đó một tập công khai đã được chỉnh sửa hoặc định dạng lại sẽ
không được nhận diện; `mt-eval contest prepare` so sánh theo từng hàng.
