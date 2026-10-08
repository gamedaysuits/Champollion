---
sidebar_position: 3
title: "Cổng kiểm soát chất lượng"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Quality Gate

Mỗi bản dịch đều phải trải qua một cổng xác thực xác định (deterministic validation gate) trước khi được ghi vào đĩa. Quality gate này giúp phát hiện các lỗi dịch máy phổ biến — không có lỗi ngầm (silent fallback), không ghi dữ liệu rác vào các tệp ngôn ngữ (locale files) của bạn.

## Các bước kiểm tra xác thực (Validation Checks)

| Kiểm tra | Lỗi phát hiện | Nhãn Gate |
|-------|----------------|-----------|
| **Trống/rỗng** | Model trả về chuỗi rỗng hoặc khoảng trắng | `[GATE] empty` |
| **Trùng lặp nguồn** | Model trả về chuỗi tiếng Anh gốc — nguyên trạng, hoặc bị biến đổi (dấu phụ, viết hoa/thường, ký tự fullwidth), trong toàn bộ giá trị hoặc trong một dạng số nhiều | `[GATE] source-echo` |
| **Cấu trúc ICU / placeholder** | Một biến đã dịch, từ khóa hoặc bộ chọn số nhiều, bị mất `#` hoặc `%s` | `[GATE] icu` |
| **Thẻ đánh dấu** | Một thẻ được mở, đóng hoặc lồng nhau khác với nguồn | `[GATE] markup` |
| **Dấu ngắt câu cạnh placeholder** | Dấu kết thúc câu mà bản dịch đặt ngay trước hoặc sau một placeholder trong khi nguồn không có: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Vòng lặp ảo giác** | Các mẫu trigram lặp lại (ví dụ: `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Độ dài tăng bất thường** | Đầu ra dài hơn đáng kể so với nguồn | `[GATE] length` |
| **Xóa nội dung** | Đầu ra là nguồn nhưng bị xóa mất các chữ cái | `[GATE] content` |
| **Tuân thủ hệ chữ viết** | Sai hệ chữ viết cho locale đích | `[GATE] script` |
| **Cùng đầu ra, khác đầu vào** | Một đoạn văn bản được trả về cho nhiều chuỗi nguồn khác nhau (câu bị học vẹt) | `[GATE] shared-output` |
| **Các danh mục số nhiều ICU** | Thiếu các dạng số nhiều bắt buộc cho locale | `[GATE] icu-plural` |

Các key được khai báo [`noTranslate`](/docs/getting-started/configuration#no-translate) không bao giờ đi qua gate — chúng được sao chép nguyên văn từ nguồn, do đó không có gì để xác thực.

**Các trang Markdown cũng trải qua các bước kiểm tra tương tự, theo từng khối (block).** Trong một thư mục nội dung (`contentDir`, tài liệu Docusaurus), mỗi tiêu đề, đoạn văn, mục danh sách và ô bảng đều được kiểm tra riêng lẻ, và mỗi trường front-matter cũng vậy. Các bước kiểm tra tương tự như trên: rỗng, trùng lặp nguồn, vòng lặp ảo giác, độ dài tăng bất thường, xóa nội dung, hệ chữ viết, và cùng đầu ra cho các đầu vào khác nhau. Một tiêu đề ngắn như `## Feast` nếu trả về dưới dạng một câu hoàn chỉnh sẽ bị từ chối, giống hệt như một app key có cùng văn bản.

Khối bị từ chối sẽ được **yêu cầu dịch lại một lần nữa kèm theo lý do**. Model được thông báo về lỗi sai và biết rằng văn bản vốn đã chính xác nguyên trạng có thể được giữ nguyên khi trả về. Một số trường hợp từ chối không thể quyết định bằng quy tắc cố định nào: tiêu đề là tên riêng (`### BLEURT (Sellam et al., 2020)`), một mục trong danh mục tham khảo, bảng mã hoặc bảng chú giải thuật ngữ có thể chính xác nguyên trạng, hoặc có thể là dịch sót. Nếu khối văn bản được trả về không đổi, hoặc giữ nguyên chữ Latin trong một ngôn ngữ phi Latin, và model lại đưa ra câu trả lời y như vậy, câu trả lời đó sẽ được chấp nhận là có chủ ý. Mọi trường hợp từ chối khác bắt buộc phải vượt qua gate hoàn toàn ở câu trả lời thứ hai. Endpoint nào khai báo không tuân theo chỉ dẫn (`"acceptsInstructions": false`) sẽ không được yêu cầu lại; câu trả lời đầu tiên của nó được đánh giá như câu trả lời thứ hai.

Những gì vẫn bị từ chối sẽ chuyển sang phương thức `fallback` của cặp dịch. Nếu không có phương thức dự phòng, **khối văn bản sẽ giữ nguyên văn bản nguồn của nó mà không thêm bất kỳ đánh dấu nào vào trang**, không bao giờ được lưu vào cache, và mục lock của trang sẽ hiển thị `pending:<hash>`. `status` và `verify` liệt kê các trang như vậy, và sync sẽ chỉ rõ tên từng khối. Lần từ chối này sẽ được ghi nhớ: lần sync thông thường tiếp theo sẽ không gửi lại khối đó cho cùng model nữa (xem [Các khối Markdown và trường front-matter bị từ chối](#refused-markdown-blocks-and-front-matter-fields)). Code, liên kết và markup trong một khối được bảo vệ riêng biệt, và chú thích HTML không bao giờ được gửi đi. Một số văn bản được giữ nguyên như viết mà không cần hỏi lại:
- tên ngắn (`## GitHub`), được đo sau khi bỏ qua inline code, dấu ngoặc kép, dấu ngoặc đơn và `{#anchor}`;
- một mục danh sách tham khảo, hoặc toàn bộ danh sách tham khảo trong một khối;
- các chữ cái fullwidth mà chính văn bản nguồn đã có sẵn.

Một bảng được đánh giá theo các ô của nó, không phải theo các dấu gạch đứng (pipe) và hàng phân cách. `verify` kiểm tra các khối đã có trên đĩa theo cách tương tự, ngoại trừ khối trùng khớp chính xác với những gì sync đã chấp nhận và lưu cache cho nguồn của nó. Khối không đạt sẽ phát ra cảnh báo, khiến `verify --strict` thất bại, và đi kèm lệnh sửa chữa `champollion sync --pair en:fr --redo files:<page>`. Lệnh sync cũng in cùng một lệnh đó cho cùng một tệp.

### Trống/Khoảng trắng (Empty/Blank)

Từ chối các bản dịch là chuỗi rỗng, chỉ chứa khoảng trắng hoặc `null`. Điều này giúp phát hiện các mô hình không trả về kết quả gì cho các khóa (keys) khó.

### Lặp lại nguồn (Source Echo)

Phát hiện khi model trả về văn bản nguồn tiếng Anh thay vì dịch nó. Thường gặp với các chuỗi ngắn và prompt thiếu chi tiết. Hai quy tắc sau được áp dụng, và chúng đo lường các khía cạnh khác nhau:

1. **Bản sao chính xác** (từng byte giống hệt nguồn) sẽ bị từ chối — ngoại trừ giá trị **ngắn, phần lớn là ASCII**: từ 30 ký tự trở xuống, hơn 80% là ASCII thuần. `"Blog"`, `"GitHub"`, `"npm"` được phép giữ nguyên bằng tiếng Anh một cách hợp lệ, vì vậy đối với ngôn ngữ đích dùng chữ Latin, bản sao như vậy được chấp nhận (`verify` liệt kê nó là trùng lặp nguồn); đối với ngôn ngữ đích phi Latin, model được hỏi một lần xem đó có phải là tên riêng không, và việc trả về cùng một câu trả lời hai lần sẽ được chấp nhận. **Ngoại lệ này dựa trên độ dài, và chỉ áp dụng cho các bản sao chính xác.**
2. **Bản sao ngụy trang** — văn bản nguồn chỉ bị thay đổi chữ hoa/thường, dấu phụ, khoảng trắng, ký tự ẩn hoặc các dạng tương thích (ký tự fullwidth, chữ ghép) — sẽ bị từ chối khi nguồn có **từ ba từ trở lên** chứa chữ cái (các placeholder như `{count}` hoặc `%s` và các thẻ đánh dấu không được tính), **dù nó ngắn đến mức nào**. `"Book an appointment"` (19 ký tự, 3 từ) → `"Bóok án appóintment"` bị từ chối; `"cafe"` → `"café"` (1 từ) được chấp nhận, vì bản dịch thực tế có thể chỉ khác tiếng Anh ở dấu phụ. Một tên riêng dài hơn có thêm dấu phụ một cách hợp lệ (`"Universite de Montreal"`) sẽ được chấp nhận khi bạn khai báo cách viết có dấu đó là thuật ngữ được bảo vệ.

Cả hai quy tắc cũng áp dụng **cho từng dạng số nhiều**. Dạng số nhiều `msgstr[n]` của gettext, nhánh `{n, plural, …}` của ICU hoặc key `_one`/`_other` của i18next đều tuân theo các quy tắc tương tự như giá trị số ít: dạng số nhiều tiếng Nga có dạng `few` trả về tiếng Anh kèm dấu phụ sẽ bị từ chối giống hệt như dạng số ít.

Các giá trị dài hơn cũng chính xác khi giữ nguyên — URL, đường dẫn repository, mã định danh sản phẩm — không phải là vấn đề của gate và không thể khắc phục bằng cách tinh chỉnh gate: câu trả lời đúng *chính là* bản sao chép, do đó bất kỳ đầu ra nào khác của model cũng đều sai. Hãy khai báo các key đó với [`noTranslate`](/docs/getting-started/configuration#no-translate) và chúng sẽ bỏ qua hoàn toàn quy trình xử lý. Các key chứa giá trị URL được xử lý theo cách đó theo mặc định.

### Vòng lặp ảo giác (Hallucination Loop)

Phân tích các mẫu trigram (3 ký tự) trong kết quả đầu ra. Nếu bất kỳ trigram nào lặp lại nhiều hơn số lần ngưỡng quy định so với độ dài đầu ra, bản dịch sẽ bị từ chối. Điều này giúp phát hiện các kết quả đầu ra bị lỗi thoái hóa như `"Qo' Qo' Qo' Qo' Qo'"`.

### Phình to độ dài (Length Inflation)

Từ chối các bản dịch có độ dài đầu ra vượt quá `maxLengthRatio × source length` (mặc định: 4×) — nghiêm ngặt hơn: bản dịch có độ dài đúng 4× vẫn được thông qua. Quy tắc này giúp phát hiện ảo giác của model khi sinh ra cả một đoạn văn bản dài dằng dặc cho một đầu vào ngắn.

Có thể cấu hình thông qua `maxLengthRatio` trong tệp cấu hình của bạn.

### Xóa nội dung

Bản sao đối nghịch của việc tăng độ dài bất thường. Một model không có vốn từ vựng cho một chuỗi có thể xóa mọi chữ cái mà nó không dịch được, chỉ để lại dấu câu và khoảng trắng của văn bản nguồn:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Không có kiểm tra nào khác phát hiện được điều này. Nó không rỗng, không phải bản sao nguyên gốc, không lặp lại, và với 33% *độ dài* của nguồn, nó vượt qua `minLengthRatio` một cách dễ dàng.

Bước kiểm tra so sánh **các ký tự nội dung** — chữ cái và chữ số, bỏ qua dấu câu, khoảng trắng và định dạng ẩn — giữa nguồn và đầu ra. Nhưng chỉ dựa vào mật độ thì không thể thành quy tắc, vì các hệ chữ viết dày đặc hợp lệ cũng rơi vào chính khoảng giá trị đó:

| Nguồn | Đầu ra | Lượng nội dung giữ lại | Kết luận |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **bị từ chối** |
| `Getting started` | `入门` | 14% | được chấp nhận |
| `Frequently asked questions` | `常见问题` | 17% | được chấp nhận |

Bất kỳ ngưỡng nào phát hiện trường hợp đầu tiên đều sẽ từ chối hoàn toàn tiếng Trung, tiếng Nhật và tiếng Hàn. Điểm khác biệt giữa chúng không phải là lượng nội dung còn sót lại bao nhiêu mà là *nó đến từ đâu*: đầu ra bị rút rỗng là một **chuỗi con (subsequence)** của chính nguồn của nó — có thể tạo ra bằng cách xóa bớt ký tự từ nguồn — trong khi một bản dịch thực sự về cơ bản không chia sẻ điểm chung nào với nguồn. Cần phải có **cả hai** tín hiệu để kích hoạt cảnh báo, do đó bước kiểm tra này mang tính cần-nhưng-chưa-đủ tương tự như bộ phát hiện lặp lại.

Có thể cấu hình thông qua `minContentRetention` (mặc định `0.35`), theo từng cặp hoặc từng ngôn ngữ. Tăng giá trị này sẽ khiến bước kiểm tra nhạy hơn; nó chỉ kích hoạt cùng lúc với tín hiệu chuỗi con.

:::note[Đây là tín hiệu về từ vựng, không phải nút điều chỉnh chất lượng]
Khi cảnh báo này kích hoạt liên tục cho một ngôn ngữ đích, model không có vốn từ cho văn bản đó — thường là các chuỗi ngắn, nhiều thuật ngữ chuyên ngành trong một ngôn ngữ có vốn từ vựng khép kín. Việc nới lỏng ngưỡng chỉ làm xuất hiện lại tình trạng hư hỏng âm thầm; nó không tạo ra bản dịch. Hãy điều chỉnh prompt, dữ liệu huấn luyện, hoặc cặp dịch.
:::

### Tuân thủ hệ chữ viết (Script Compliance)

Đối với các locale có thẻ ngôn ngữ ghi nhận hệ chữ viết phi Latin (tiếng Ả Rập, CJK, Cyrillic, …), bước này xác thực rằng đầu ra không chỉ chứa toàn chữ Latin. Các chữ cái được phân loại theo **Unicode script**, không phải theo byte: chữ Latin có dấu (`"Bóók"`) và chữ Latin fullwidth (`"Ｂｏｏｋ"`) đều là chữ Latin, vì vậy cả hai đều không được chấp nhận là tiếng Nga. Các chữ cái Latin fullwidth bị từ chối ở bất kỳ ngôn ngữ đích nào ngoài nghệ thuật in chữ CJK (nơi `"ＯＫ"` là cách dùng tiếng Nhật thông thường) — chúng chỉ là tiếng Anh đội lốt. Các ngoại lệ thông thường vẫn được áp dụng: tên ngắn được giữ nguyên (vấn đề tên-hay-nhãn nêu ở trên), các thuật ngữ được bảo vệ đã khai báo, và các key `noTranslate` (bao gồm cả URL) không bao giờ bị trượt kiểm tra này.

Hai điểm cần làm rõ về những gì bước kiểm tra này *không phải*:

- Nó **không bị chi phối bởi trường cấu hình `script:`.** Trường đó dùng để chọn chính tả đầu ra cho [chuyển đổi hệ chữ viết](/docs/getting-started/configuration#script-conversion); kỳ vọng của gate bắt nguồn từ các thẻ ngôn ngữ.
- Nó luôn xác thực **hệ chữ viết làm việc mà model phát ra**, *trước* bất kỳ bước chuyển đổi hệ chữ viết nào. Các locale có bộ chuyển đổi hệ chữ viết (crk, sr, tlh, …) xuất ra đầu ra bằng hệ chữ viết Latin một cách chuẩn xác, do đó chúng được miễn trừ khỏi kiểm tra này; việc chuyển đổi — nếu được bật trong cấu hình — diễn ra sau gate.

### Markup

Thẻ là mã. Với mỗi tên thẻ, bản dịch phải mở, đóng và tự đóng cùng số lượng thẻ như nguồn, lồng nhau theo cùng một cách (`<b>` bên trong `<a>` vẫn phải ở bên trong `<a>`); thứ tự các thẻ ngang hàng có thể thay đổi tùy theo trật tự từ. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` bị từ chối — mất thẻ đóng sẽ làm hỏng trang. Trong một thông điệp số nhiều, mỗi dạng được so sánh với dạng nguồn mà nó dịch sang. `verify` thực hiện kiểm tra tương tự trên các tệp.

### Dấu ngắt câu cạnh Placeholder

Placeholder được điền vào lúc chạy, do đó dấu kết thúc câu mà bản dịch đặt ngay cạnh nó sẽ làm thay đổi những gì người đọc nhìn thấy: `"Take this medicine at {time}."` → `"… sina. {time}."` hiển thị thời gian như một câu riêng biệt. Gate từ chối bản dịch đặt dấu kết thúc câu (`.`, `!`, `?`, hoặc dấu của hệ chữ viết khác: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) ngay **trước** một placeholder, hoặc ngay **sau** một placeholder khi phía sau vẫn còn văn bản tiếp theo, nếu nguồn không có dấu nào ở đó và bản dịch có nhiều dấu kết thúc câu hơn nguồn. Một placeholder chỉ chuyển về cuối câu (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) thì vẫn hợp lệ. Dấu chấm lửng, số thập phân hoặc tên tệp (`{host}.com`), và từ viết tắt một chữ cái (`"M. {name}"`) cũng được chấp nhận. Một từ viết tắt dài hơn đứng trước placeholder (`"ca. {count}"`) không thể phân biệt được với dấu kết thúc câu, nên nó cũng bị từ chối, và phương thức dự phòng của cặp dịch hoặc câu trả lời được diễn đạt lại sẽ tiếp nhận xử lý. `verify` gắn cờ các giá trị tương tự trên đĩa, kèm theo lệnh `--redo` để yêu cầu dịch lại. Các thông điệp ICU plural và select được dành riêng cho bước kiểm tra ICU.

### Cùng đầu ra, khác đầu vào

Model học vẹt một câu trong tập huấn luyện có thể trả về câu đó cho những chuỗi mà nó không biết: cùng một câu cho tiêu đề ứng dụng, "Contact the school", tiêu đề bản tin và tiêu đề mục của nó, dù mỗi câu đều vượt qua mọi kiểm tra ở trên khi đứng riêng lẻ. Khi một bản dịch trả lời cho **ba chuỗi nguồn khác nhau trở lên** trong một lượt chạy của locale — và nó có từ bốn từ trở lên, hoặc các chuỗi nguồn đều có từ hai từ trở lên mà ít có điểm chung — các key đó sẽ bị từ chối (để lượt thử lại, rồi đến phương thức dự phòng, tiếp quản xử lý). **Hai** chuỗi nguồn khác nhau là đủ khi bằng chứng rõ ràng: cả hai đều có từ hai từ trở lên, chia sẻ chưa đến một nửa số từ của nhau, và bản dịch chung có từ bốn từ trở lên (`"Thank you for coming!"` và `"Please bring the forms."` được trả lời bằng cùng một câu). Một câu bị phát hiện theo cách này sẽ được ghi nhớ cho locale đó: lần sync sau nếu gặp lại câu đó, ngay cả với một chuỗi đơn lẻ, cũng sẽ từ chối nó, và các mục cache đã từng phục vụ nó sẽ bị xóa bỏ, để lần redo sẽ hỏi lại model thay vì ghi ra từ cache. Các từ đồng nghĩa quy về một bản dịch ngắn (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) đều hợp lệ, và một văn bản nguồn được dùng cho nhiều key cũng vậy. Các khối Markdown và trường front-matter của các tệp nội dung trong lượt chạy cũng được tính, và từng nhánh của thông điệp ICU plural hoặc select cũng vậy (các nhánh của một thông điệp số nhiều được tính là một nguồn — một ngôn ngữ không biến đổi theo số lượng sẽ viết cùng một văn bản cho mỗi nhánh). Các đầu ra được so sánh mà không tính đến chữ hoa/thường, dấu câu và ký hiệu khối Markdown, do đó `"S?"`, `"S."` và tiêu đề `# S` được coi là cùng một đầu ra. Số lượng đếm bao gồm cả những gì locale đã lưu trên đĩa và những gì cache sẽ phân phát (một câu được cache từng văn bản một bởi công cụ khác sẽ bị từ chối tại cache, không được ghi), nhờ đó key được thêm vào qua từng lần sync cũng bị phát hiện. `verify` sẽ báo lỗi với cùng mẫu tương tự trên đĩa, và công cụ MCP `translate` sẽ từ chối nó ngay trong lượt gọi.

### Câu hỏi bị mất dấu câu

Khi nguồn kết thúc bằng `?` hoặc `!` và bản dịch không kết thúc bằng dấu đó cũng như dấu tương đương mà hệ chữ viết của nó sử dụng (`？`, `؟`, `;` trong tiếng Hy Lạp, `¿…?`, `！`, …), `sync` và `verify` sẽ cảnh báo: `"Where does it hurt?"` viết như một câu trần thuật thì sẽ được đọc như một câu trần thuật. Đây là cảnh báo chứ không phải từ chối, vì một số ngôn ngữ đánh dấu câu hỏi bằng một từ hoặc tiểu từ thay vì dấu câu. Cảnh báo sẽ nêu tên các key và lệnh `--redo keys:<key> --fresh` để hỏi lại (`--fresh`, vì cache đang giữ câu trả lời).

## Điều gì xảy ra khi thất bại

1. Bản dịch không đạt sẽ được ghi vào stderr với tiền tố `[GATE]`, tên key, lý do và bản xem trước của giá trị
2. Key **không** được ghi vào tệp locale
3. Chuỗi thử lại (retry cascade) được kích hoạt (xem bên dưới)
4. Nếu vẫn thất bại, lần từ chối này sẽ được **ghi nhớ** (xem [Các key bị từ chối sẽ bị giữ lại](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Thử lại kèm phản hồi và chuỗi thử lại

Một key bị gate từ chối sẽ nhận được **một lần thử lại kèm phản hồi**: lý do từ chối được đưa vào prompt dưới dạng ngữ cảnh riêng cho từng key (việc thử lại mù quáng ở mức temperature thấp sẽ chỉ trả về đầu ra giống hệt từng byte). Nếu lần thử lại thành công, key sẽ được ghi và quá trình sync đạt trạng thái **xanh (green)** — việc gate từ chối rồi tự khắc phục không bị coi là lỗi, và đây là ngữ nghĩa có chủ đích. Các key vẫn thất bại sau lần thử lại sẽ bị bỏ qua và báo cáo (lệnh sync thoát với mã `2`).

Quá trình thử lại chạy qua chính phương thức dịch của cặp dịch, bất kể đó là gì — LLM, Google Translate, DeepL hay một nhà cung cấp trực tiếp. Chỉ các phương thức LLM mới đọc phản hồi; dòng trạng thái khi chạy sẽ hiển thị thông tin này (`retrying with feedback`, hoặc `asking once more (deepl takes no instructions…)`). Một endpoint `api` chỉ nhận phản hồi khi nó khai báo `"acceptsInstructions": true` (trên cặp dịch hoặc trong manifest của plugin); endpoint nào khai báo `false` — một model NMT được huấn luyện như `nmt-forge serve`, vốn sẽ luôn trả về câu trả lời y hệt — sẽ hoàn toàn không được hỏi lại: các câu trả lời của nó được đánh giá như câu trả lời thứ hai, và những gì nó từ chối sẽ chuyển sang phương thức dự phòng (fallback) của cặp dịch. Việc thử lại cũng áp dụng cho các kết quả khớp Translation Memory: giá trị trong cache bị gate từ chối sẽ bị trục xuất và dịch lại ngay trong cùng lượt chạy, nhờ đó cache bị nhiễm bẩn sẽ tự lành lại.

### Các key bị từ chối sẽ bị giữ lại

Việc từ chối được ghi nhớ trong `.champollion.lock`, theo từng key, đối với **văn bản nguồn hiện tại** của key cùng **phương thức và model** đã tạo ra câu trả lời bị từ chối. Các chuỗi UI của Docusaurus (`i18n/<locale>/code.json` và các tệp JSON của plugin) cũng tuân theo quy tắc này, theo từng tệp và id. Lần chạy `sync` thông thường tiếp theo sẽ không gửi lại key đó cho cùng một model — vì sẽ chỉ bị tính phí cho cùng một câu trả lời — và cho biết có bao nhiêu key đã bị giữ lại cũng như cách xử lý tiếp theo:

- yêu cầu dịch lại: `champollion sync --redo keys:<key>` (hoặc `--redo all`, hoặc `--fresh`) — việc chỉ định rõ tên key đồng nghĩa với một lần thử lại tường minh;
- điền bản dịch theo cách khác: thêm một phương thức `"fallback"` vào cặp dịch (nó sẽ được yêu cầu dịch cho các key mà phương thức chính của cặp dịch đã từ chối), liệt kê key trong `noTranslate` nếu nó giữ nguyên như văn bản gốc, hoặc tự tay viết bản dịch vào tệp.

Key bị giữ lại vẫn ở trạng thái chưa được dịch, do đó lệnh sync sẽ thoát với mã `2` cho đến khi nó được điền. Việc thay đổi văn bản nguồn, model hoặc phương thức sẽ gỡ bỏ trạng thái giữ lại (bởi việc từ chối chỉ áp dụng cho văn bản đó từ model đó). Cache vẫn được đọc đối với key này — việc giữ lại chỉ chặn các lệnh gọi tốn phí, không chặn lệnh gọi miễn phí. Trường hợp key mà lệnh redo không thể hoàn tất là một ngoại lệ duy nhất, được giải thích bên dưới.

### Các khối Markdown và trường front-matter bị từ chối

Quy tắc tương tự cũng áp dụng cho các tệp nội dung (`contentDir`, tài liệu Docusaurus). Một khối hoặc trường front-matter bị gate từ chối sẽ được ghi nhớ trong `.champollion-content.lock`, theo từng trang, khối và locale, đối với **văn bản nguồn hiện tại** của khối cùng **phương thức và model** đã tạo ra câu trả lời bị từ chối. Khối được định danh bằng văn bản nguồn của nó, vì vậy việc chỉnh sửa đoạn văn sẽ gỡ bỏ trạng thái giữ lại. Lần chạy `sync` thông thường tiếp theo sẽ không gửi lại khối đó cho cùng một model nữa, và sẽ hiển thị số lượng khối cùng trường bị giữ lại trên từng trang:

- khối bị giữ lại sẽ giữ nguyên văn bản nguồn trên trang mà không có đánh dấu nào, cho đến khi nó được điền; phần còn lại của trang vẫn được ghi;
- trường front-matter bị giữ lại cũng giữ nguyên văn bản nguồn theo cách tương tự, và phần còn lại của trang vẫn được ghi;
- trang được dịch toàn bộ (`contentSegmentation: "page"`) sẽ bị từ chối toàn bộ khi câu trả lời của nó làm hỏng khối được bảo vệ hoặc làm rỗng trang. Nó được ghi nhớ theo văn bản phần thân và bị giữ lại toàn bộ: trang không được ghi và không có phần nào của nó được gửi đi cho đến khi được điền xong. Việc chỉnh sửa phần thân hoặc chuyển sang phân đoạn theo khối (block segmentation) sẽ gỡ bỏ trạng thái giữ lại.

Lần từ chối do phiên bản gate trước đó đưa ra sẽ tự động được gỡ bỏ. Khi một kiểm tra được nới lỏng, những gì từng bị từ chối sẽ được yêu cầu dịch lại trong lần sync tiếp theo mà không cần chạy redo.

Thứ tự ưu tiên tương tự như thứ tự ưu tiên của key:

1. Trang được chỉ định redo luôn luôn được gửi: `champollion sync --redo files:<page>`, `--redo content` (mọi trang), `--retranslate`, hoặc bất cứ thứ gì trong `--fresh`.
2. Nếu không, khối hoặc trường bị từ chối sẽ bị giữ lại. Nếu cặp dịch có phương thức `fallback` chưa từng từ chối nó, phương thức dự phòng sẽ được gọi để dịch và phương thức chính của cặp dịch sẽ không được gọi.
3. Việc thay đổi model hoặc phương thức sẽ gỡ bỏ trạng thái giữ lại, tương tự như việc thay đổi văn bản nguồn của khối.

Cache vẫn được đọc trước tiên, do đó việc giữ lại chỉ chặn các lệnh gọi tốn phí chứ không chặn các lệnh gọi miễn phí. Một khối được điền bằng cách khác sẽ xóa bản ghi giữ lại của nó: bằng phương thức dự phòng, bằng cache hoặc bằng đoạn văn do chính bạn tự tay viết vào bản dịch (thư mục nội dung sẽ giữ lại đoạn văn được viết thủ công). Khối hoặc trường bị giữ lại vẫn ở trạng thái chưa được dịch, do đó lệnh sync sẽ thoát với mã `2` cho đến khi nó được điền. Điều này cũng đúng với khối bị gate từ chối trong lượt chạy này. Chế độ chạy thử (dry run) sẽ liệt kê những gì mà một lượt chạy thực tế sẽ giữ lại.

### Lệnh redo không thể hoàn tất

Khi `--redo all`, `--redo keys:` hoặc việc chuyển đổi model (`--redo all --fresh-on-model-change`) để lại các key chưa được dịch trong một tệp key-value, chúng sẽ được ghi nhận là **đang chờ xử lý (pending)** trong `.champollion.lock`, và lần chạy `sync` thông thường tiếp theo sẽ yêu cầu model dịch lại chúng một lần nữa — yêu cầu trực tiếp từ model chứ không phải từ cache (vì mục đích của lệnh redo là lấy văn bản từ model mới). `champollion status` sẽ liệt kê các key này. Nếu lần thử lại đó cũng bị từ chối, key sẽ tiếp tục ở trạng thái pending (lệnh status sẽ báo điều này) và bị giữ lại như bất kỳ key bị từ chối nào. Theo thứ tự ưu tiên: key được chỉ định bởi `--redo`/`--fresh` luôn luôn được gửi; key ở trạng thái pending nhận được một lần thử lại đó; key bị từ chối sẽ bị giữ lại. Chuỗi UI của Docusaurus không có cơ chế thử lại pending: nếu bị từ chối trong lệnh redo, nó sẽ bị giữ lại ở lần sync thông thường tiếp theo, tương tự như khối nội dung.

Ngoài ra, khi toàn bộ một batch thất bại (lỗi phân tích cú pháp JSON), Champollion sẽ thử lại với các batch nhỏ dần:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Ngân sách thử lại được giới hạn bởi `maxRetries` (mặc định: 3, có thể cấu hình cho từng ngôn ngữ). Điều này ngăn chặn việc tiêu tốn token ngoài tầm kiểm soát cho các khóa liên tục bị lỗi.

Sau khi dùng hết các lượt thử lại, các key gặp sự cố sẽ được ghi log và bỏ qua. Key không nhận được câu trả lời khả dụng (thiếu trong phản hồi) sẽ được yêu cầu dịch lại trong lần chạy `sync` tiếp theo; key bị gate từ chối sẽ bị giữ lại như mô tả ở trên.

## Bộ nhớ đệm Prompt (Prompt Caching)

Thông điệp hệ thống (system message - bao gồm văn phong, quy tắc ngữ pháp, lưu ý về phong cách) được tách biệt khỏi thông điệp của người dùng (user message - các khóa cần dịch). Sự phân tách này là có chủ ý:

- Thông điệp hệ thống là **giống nhau giữa các loạt** đối với một ngôn ngữ nhất định
- Các nhà cung cấp như Anthropic và Google sẽ lưu bộ nhớ đệm (cache) cho các thông điệp hệ thống lặp lại
- Kết quả: loạt đầu tiên sẽ trả toàn bộ chi phí token, các loạt tiếp theo chỉ trả phí cho thông điệp của người dùng

Điều này có thể giảm đáng kể chi phí token cho các dự án có nhiều loạt dịch.

## Xác thực ICU MessageFormat

Lệnh `integrity` xác thực các mẫu số nhiều ICU MessageFormat dựa trên các quy tắc số nhiều của CLDR. Nếu tệp nguồn của bạn sử dụng cú pháp ICU như:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion sẽ xác minh xem các phiên bản dịch có bao gồm tất cả các danh mục số nhiều bắt buộc cho ngôn ngữ đích hay không. Ví dụ, tiếng Ả Rập yêu cầu sáu danh mục (`zero`, `one`, `two`, `few`, `many`, `other`) — chứ không chỉ `one` và `other`.

### Các dạng số nhiều mà bản dịch không cung cấp

Prompt sẽ chỉ rõ các danh mục CLDR của ngôn ngữ đích. Khi một thông điệp số nhiều trả về thiếu một dạng mà ngôn ngữ đó sử dụng cho việc đếm thông thường (bất kỳ số lượng nào từ 0 đến 1000 — tiếng Nga dùng `few` cho 2, 3, 4 và `many` cho 0, 5, 6), gate sẽ yêu cầu model dịch lại một lần nữa, nêu rõ các dạng còn thiếu và các số đếm mà chúng bao quát. Câu trả lời thứ hai nếu vẫn thiếu các dạng đó sẽ được chấp nhận, không bao giờ bị hỏi lần thứ ba, và công cụ cũng không bao giờ tự ý bổ sung — khi đó lệnh sync sẽ:

- cảnh báo, nêu rõ từng key cùng các dạng còn thiếu của nó, và lệnh để yêu cầu dịch lại (`sync --redo keys:… --fresh`, khi đó việc dùng `--model` mạnh hơn sẽ có ích);
- trong catalog gettext, nơi `msgfmt` cần mọi `msgstr[n]`, sẽ ghi các dạng còn thiếu dưới dạng bản sao của `other` và đánh dấu mục đó bằng chú thích dịch giả `# champollion:` (Poedit và Weblate sẽ hiển thị chú thích này; `verify` sẽ đọc nó, kể cả trong CI không có cache);
- trong các tệp ICU (next-intl, ARB), sẽ ghi thông điệp nguyên như khi nhận được; ứng dụng sẽ hiển thị dạng `other` cho những số đếm đó.

Thông điệp như vậy không được coi là đã dịch xong. Lần sync sau đó chạy một phương thức hoặc model khác — model chưa từng dịch thông điệp này, chẳng hạn như model hosted của CI chạy sau model local — sẽ yêu cầu dịch lại từ model chứ không lấy từ cache (nơi đang lưu câu trả lời chưa hoàn chỉnh); phần ước tính chi phí sẽ tính cả phần này. `sync --redo gaps` yêu cầu dịch lại cho mọi thông điệp như vậy, bất kể công cụ nào đã bỏ dở. Nếu câu trả lời mới cũng thiếu các dạng này, thông điệp sẽ giữ nguyên như cũ (được đánh dấu trong catalog), và `.champollion.lock` sẽ ghi nhận cấu hình nào đã trả lời mà thiếu các dạng đó, để không cấu hình nào bị hỏi lại cho cùng một đoạn văn bản ([hướng dẫn CI](/docs/guides/ci-cd#plural-gaps)).

`verify` báo cáo cả hai trường hợp kèm lệnh sửa chữa. Các dạng chỉ xuất hiện ở các số trên 1000 hoặc số thập phân (dạng `many` trong tiếng Pháp và tiếng Tây Ban Nha, dùng cho 1 000 000) chỉ nhận một dòng thông tin, không phải cảnh báo. Một công cụ dịch máy (DeepL, Google, …) không thể được chỉ định phải viết dạng nào, do đó câu trả lời của nó sẽ không được thử lại — chỉ được báo cáo. Đối với các tệp i18next, mỗi dạng mà nguồn không có (tiếng Pháp `count_many` dịch từ tiếng Anh) là một key riêng biệt, được dịch từ văn bản `_other`: LLM sẽ được yêu cầu dịch dạng đó và sync sẽ thông báo điều này; với công cụ dịch máy, sync sẽ thông báo rằng giá trị đang giữ dạng `other`.

Chạy `champollion integrity` để kiểm tra tính đầy đủ của số nhiều trên tất cả các ngôn ngữ.

## Áp dụng thuật ngữ (Terminology Enforcement)

Đối với các cặp ngôn ngữ được huấn luyện (coached pairs) có kèm từ điển, Champollion sẽ chạy một bước kiểm tra thuật ngữ sau khi dịch. Sau khi vượt qua quality gate, hệ thống sẽ xác minh xem LLM có thực sự sử dụng các thuật ngữ bắt buộc trong từ điển hay không.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Các vi phạm thuật ngữ chỉ là **cảnh báo, không phải lỗi chặn (blocking errors)**. Bản dịch vẫn được ghi vào đĩa. Điều này là có chủ ý — LLM có thể có lý do chính đáng để chọn một từ thay thế (ngữ cảnh, ngữ pháp), và việc chặn bản dịch chỉ vì không khớp thuật ngữ sẽ gây hại nhiều hơn lợi.

Để khắc phục các vi phạm, hãy cập nhật từ điển huấn luyện (coaching dictionary) hoặc chỉnh sửa tệp ngôn ngữ theo cách thủ công.

---

## Xem thêm

- [Cách hoạt động của Sync](/docs/concepts/how-sync-works) — vị trí của quality gate trong quy trình (pipeline)
- [Phương thức dịch](/docs/guides/translation-methods) — các phương thức cung cấp dữ liệu đầu vào cho gate
- [Bộ chuyển đổi hệ chữ viết (Script Converters)](/docs/concepts/script-converters) — chuyển đổi hệ chữ viết sau bước gate
- [Dữ liệu huấn luyện (Coaching Data)](/docs/concepts/coaching-data) — cải thiện chất lượng dịch thuật từ nguồn
- [Bộ nhớ dịch (Translation Memory)](/docs/concepts/translation-memory) — lưu bộ nhớ đệm cho các bản dịch đã được xác thực
- [Tài liệu tham khảo CLI — sync](/docs/reference/cli#sync) — các cờ (flags) của lệnh sync bao gồm cả hành vi thử lại
- [Tài liệu tham khảo CLI — integrity](/docs/reference/cli#integrity) — kiểm tra số nhiều ICU
