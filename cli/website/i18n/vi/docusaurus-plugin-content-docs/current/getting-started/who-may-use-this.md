---
title: "Ai được phép sử dụng"
description: "Giấy phép của từng gói Champollion bằng ngôn từ dễ hiểu — ai thuộc phạm vi áp dụng và ai không. Đây chỉ là bản tóm tắt, không phải tư vấn pháp lý; nội dung văn bản giấy phép có giá trị quyết định."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Ai có thể sử dụng công cụ này

Các gói của Champollion không dùng chung một giấy phép duy nhất. Trang này giải thích một cách dễ hiểu phạm vi áp dụng của từng giấy phép đối với người dùng.

**Đây là bản tóm tắt, không phải tư vấn pháp lý. Văn bản giấy phép chính thức sẽ có hiệu lực điều chỉnh.** Mỗi giấy phép đều được liên kết trong bảng dưới đây và đi kèm với gói tương ứng.

## Các gói và giấy phép tương ứng

| Gói | Mô tả | Giấy phép |
|---|---|---|
| `champollion` (npm) | CLI giúp dịch các tệp ngôn ngữ (locale) của bạn | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | MCP server cung cấp các công cụ này cho AI agent | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | Bộ công cụ huấn luyện mô hình | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; lệnh `mt-eval`) | Khung đánh giá (evaluation harness) | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), kèm [ngoại lệ cho plugin](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | Plugin tiêu chuẩn đánh giá tiếng Plains Cree | Giấy phép tạm thời riêng: chỉ sử dụng khi có sự cho phép ([trên PyPI](https://pypi.org/project/champollion-lyss/)) |

Các registry dữ liệu (`shared/`) và các tệp migration cơ sở dữ liệu (`mt-eval-arena/`) trong [kho lưu trữ](https://github.com/gamedaysuits/Champollion) được cấp phép theo Apache-2.0.

## CLI, MCP server và nmt-forge

Ba thành phần này được cấp phép theo PolyForm Noncommercial License 1.0.0. Bạn có thể sử dụng, sửa đổi và chia sẻ chúng cho **mục đích phi thương mại**. Bản thân giấy phép đã chỉ định cụ thể các mục đích đó. Hai điều khoản sau đây giải quyết hầu hết các trường hợp:

> **Mục đích cá nhân.** Việc sử dụng cá nhân cho nghiên cứu, thử nghiệm và kiểm thử vì lợi ích tri thức cộng đồng, học tập cá nhân, giải trí riêng tư, dự án sở thích, hoạt động nghiệp dư hoặc thực hành tôn giáo, mà không dự kiến bất kỳ ứng dụng thương mại nào, là việc sử dụng cho mục đích được cho phép.

> **Tổ chức phi thương mại.** Việc sử dụng bởi bất kỳ tổ chức từ thiện, cơ sở giáo dục, tổ chức nghiên cứu công lập, tổ chức y tế hoặc an toàn công cộng, tổ chức bảo vệ môi trường, hoặc cơ quan chính phủ nào đều là việc sử dụng cho mục đích được cho phép, bất kể nguồn tài trợ hay các nghĩa vụ phát sinh từ nguồn tài trợ đó.

Đối với một tổ chức thuộc các loại hình trên, nguồn kinh phí của tổ chức không làm thay đổi câu trả lời: điều khoản đã nêu rõ "bất kể nguồn tài trợ".

| Đối tượng | Được phép? | Lý do |
|---|---|---|
| Trường học dịch ứng dụng hoặc bản tin của trường | ✓ Có | Là cơ sở giáo dục |
| Bệnh viện công hoặc phòng khám y tế công cộng dịch hướng dẫn cho bệnh nhân | ✓ Có | Là tổ chức y tế hoặc an toàn công cộng |
| Tổ chức từ thiện dịch trang web của mình | ✓ Có | Là tổ chức từ thiện |
| Cơ quan chính phủ hoặc viện nghiên cứu công lập | ✓ Có | Là cơ quan chính phủ hoặc tổ chức nghiên cứu công lập |
| Bạn, trong một dự án cá nhân hoặc nghiên cứu mà không hướng tới ứng dụng thương mại | ✓ Có | Sử dụng cá nhân cho nghiên cứu, thử nghiệm, kiểm thử, học tập riêng hoặc sở thích |
| Cửa hàng dịch trang bán hàng của mình | ✗ Không | Sản phẩm của doanh nghiệp vì lợi nhuận là mục đích thương mại |
| Phòng khám tư nhân vì lợi nhuận dịch cổng thông tin bệnh nhân | ✗ Không | Sản phẩm của doanh nghiệp vì lợi nhuận là mục đích thương mại. Đây không phải là tổ chức y tế công cộng |

Mục đích thương mại không thuộc phạm vi áp dụng: giấy phép này không cấp quyền cho mục đích đó.

## Khung đánh giá (`mt-eval-harness`)

Khung đánh giá này là mã nguồn mở theo Giấy phép Công cộng GNU Affero, phiên bản 3 trở lên (AGPL-3.0-or-later). AGPL cho phép sử dụng cho mục đích thương mại, theo các điều khoản riêng của giấy phép. Các điều khoản chính gồm:

- Nếu bạn phân phối khung đánh giá, dù có sửa đổi hay không, bạn phải phân phối theo cùng giấy phép đó và kèm theo mã nguồn.
- Nếu bạn sửa đổi khung đánh giá và cho phép người khác sử dụng qua mạng, bạn phải cung cấp cho họ mã nguồn của phiên bản đã sửa đổi (mục 13, "Tương tác qua mạng từ xa").

Một điều khoản cấp quyền riêng ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), theo mục 7 của AGPL) cho phép các plugin tiêu chuẩn đánh giá thuộc các giấy phép khác hoạt động với khung đánh giá thông qua giao diện plugin công khai của nó. Điều này không làm thay đổi giấy phép của chính khung đánh giá.

## Plugin Plains Cree (`champollion-lyss`)

`champollion-lyss` có giấy phép tạm thời riêng: gói này chỉ được phép sử dụng khi có sự cho phép bằng văn bản. Quyền sử dụng thường được cấp miễn phí cho mục đích nghiên cứu phi thương mại, giáo dục và phục vụ lợi ích cộng đồng. Không cho phép bất kỳ mục đích sử dụng thương mại nào. Đây là giấy phép tạm thời, dự kiến sẽ được thay thế bằng các điều khoản do cộng đồng cùng quản trị đặt ra. Văn bản giấy phép và thông báo NOTICE đi kèm trong gói phần mềm.

## Những gì các giấy phép này không bao gồm

Các dịch vụ dịch thuật, mô hình và kho ngữ liệu mà bạn sử dụng thông qua các công cụ này vẫn giữ nguyên các điều khoản riêng của chúng: điều khoản API của nhà cung cấp, giấy phép của mô hình, giấy phép của kho ngữ liệu. Khung đánh giá ghi nhận giấy phép của từng kho ngữ liệu và áp dụng các quy tắc về việc dịch vụ mô hình nào được phép truy cập, nhưng các điều khoản đó do chủ sở hữu của chúng quy định, chứ không phải bởi các giấy phép trên trang này.

## Văn bản giấy phép

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (cũng có tại [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): CLI, và cùng văn bản này cho [MCP server](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) cùng [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) và [ngoại lệ cho plugin](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): khung đánh giá
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): giấy phép tạm thời và NOTICE đi kèm trong gói

Trang này là bản tóm tắt, không phải tư vấn pháp lý. Trong trường hợp có sự khác biệt giữa trang này và văn bản giấy phép, văn bản giấy phép sẽ có hiệu lực điều chỉnh.
