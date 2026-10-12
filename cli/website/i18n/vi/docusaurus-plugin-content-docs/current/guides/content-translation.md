---
sidebar_position: 5
title: "Dịch thuật nội dung"
---

# Dịch nội dung (Markdown)

Champollion dịch các tệp Markdown và MDX, bao gồm cả các trường front matter và phần thân (body). Các khối mã (code block), shortcode cùng những phần tử có cấu trúc khác đều được bảo vệ khỏi quá trình dịch.

Các tệp này nằm trong một **thư mục nội dung** (`contentDir`). Đó có thể là bất kỳ thư mục Markdown nào: `content/` của một trang Hugo, hoặc một thư mục bản tin (newsletter) bên trong ứng dụng Next.js. Một trang Docusaurus (trang có `docusaurus.config.js`) thì khác: `docs/` và `blog/` của nó được dịch sang các thư mục `i18n/<locale>/` mà không cần `contentDir`. Xem [Tích hợp framework](/docs/guides/framework-integration).

## Thiết lập

Thiết lập `contentDir` trong cấu hình của bạn, hoặc truyền `--content-dir` trên dòng lệnh:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Khi bắt đầu chạy, lệnh sync sẽ nêu tên thư mục và cho biết các bản dịch sẽ được lưu ở đâu:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Trong một trang Hugo, nó cũng nêu tên dấu hiệu nhận diện được tìm thấy, ví dụ như `Detected framework: Hugo (hugo.toml)`. Hugo được coi là được phát hiện khi có tệp `hugo.toml`/`.yaml`/`.yml`/`.json`, thư mục `config/_default/` của Hugo, tệp `config.toml` hoặc `config.yaml` có cài đặt chỉ dành cho Hugo như `baseURL`, thư mục `archetypes/`, hoặc thư mục `layouts/` chứa template của Hugo. Dù là Hugo hay không, các tệp đều được dịch và đặt tên theo cùng một cách.

## Nơi lưu trữ các bản dịch

Mỗi bản dịch được ghi **ngay cạnh tệp nguồn**, với locale đích được thêm vào trước phần mở rộng. Đây là quy ước dịch theo tên tệp (translation-by-filename) của Hugo:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Các thư mục con cũng được tìm kiếm, và mỗi bản dịch sẽ nằm trong cùng thư mục với tệp nguồn tương ứng. Ứng dụng của bạn sẽ chọn tệp cho một locale dựa theo tên đó. Ví dụ: một trang Next.js đọc `newsletters/2026-10.crk.md` cho tiếng Plains Cree.

**Những tệp nào được tính là tệp nguồn.** Mọi tệp `.md` và `.mdx` trong thư mục đều là tệp nguồn, trừ khi tên của nó kết thúc bằng `.<code>.md` (hoặc `.mdx`) và `<code>` có dạng của một mã ngôn ngữ. Mã ngôn ngữ ở đây gồm hai hoặc ba chữ cái viết thường, theo sau có thể là chữ viết (script) như `-Hant` và/hoặc vùng (region) như `-BR` hoặc `-419`. Những tệp đó được coi là bản dịch và sẽ bị bỏ qua. Một hậu tố ngôn ngữ nguồn (`launch.en.md`) vẫn được tính là nguồn. Một điểm cần lưu ý: một tệp nguồn có tên như `guide.faq.md` cũng kết thúc bằng hậu tố có từ hai đến ba chữ cái, vì vậy nó sẽ bị coi nhầm là bản dịch sang tiếng "faq" và không được dịch. Hãy đổi tên tệp, ví dụ thành `guide-faq.md`.

## Những gì được dịch

### Front Matter

Cả hai dấu phân cách YAML (`---`) và TOML (`+++`) đều được hỗ trợ. Theo mặc định, các trường sau sẽ được dịch:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Tất cả các trường khác (`date`, `draft`, `tags`, `weight`, `slug`, v.v.) được giữ nguyên từ nguồn. Bạn có thể thay đổi danh sách này bằng `translatableFields` trong cấu hình của mình.

### Nội dung phần thân

Theo mặc định, phần thân được tách thành các đoạn văn và các khối cấp cao nhất khác (top-level block), và từng khối sẽ được dịch. Các phần tử có cấu trúc được che chắn bằng placeholder trước khi dịch và được khôi phục lại sau đó. Khi dùng `contentSegmentation: "page"`, toàn bộ phần thân sẽ được dịch nguyên khối.

## Bảo vệ khối

Các thành phần sau sẽ đi qua quá trình dịch mà không bị thay đổi:

| Thành phần | Ví dụ | Bảo vệ |
|---------|---------|-----------|
| Khối mã (Code blocks) | ``````` ```js ... ``` ``````` | Toàn bộ khối được che chắn |
| Mã nội dòng (Inline code) | `` `variable` `` | Được che chắn |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | Toàn bộ khối được che chắn |
| HTML thô (Raw HTML) | `<div>`, `<table>` | Được che chắn |
| Liên kết (URLs) | `[text](https://...)` | URL được giữ nguyên, văn bản được dịch |
| Nội suy (Interpolation) | `{{ .Count }}` | Được che chắn |

## Khi một tệp được dịch lại

Lệnh sync ghi lại mã nhận diện (SHA-256 fingerprint) của từng tệp nguồn trong `.champollion-content.lock`. Hãy commit tệp đó cùng với các bản dịch của bạn.

- **Nguồn không thay đổi:** bản dịch không bị can thiệp.
- **Nguồn đã thay đổi:** tệp sẽ được cập nhật. Những đoạn văn có nội dung tiếng Anh không đổi sẽ được lấy từ [Translation Memory](/docs/concepts/translation-memory) mà không tốn chi phí, vì vậy bạn chỉ phải trả phí cho các đoạn văn đã thay đổi.
- **Tệp dịch không có mục tương ứng trong lock file** (tệp do bạn tự viết tay) sẽ được giữ nguyên và ghi nhận là của bạn. Ngoại lệ là tệp vẫn còn chứa các đánh dấu `[EN] ` do phiên bản CLI cũ hơn 0.5.0 ghi vào, tệp này sẽ được dịch lại.
- **Khối văn bản bị quality gate từ chối, kể cả khi yêu cầu lại kèm lý do,** sẽ giữ nguyên văn bản gốc mà không có đánh dấu nào trên trang. Mục tương ứng của trang trong lock file sẽ ghi `pending:<hash>`, và việc từ chối được ghi lại trong `.champollion-content.lock`. Các lần sync sau sẽ không gửi khối đó tới cùng một mô hình nữa, nhờ đó bạn không bị tính phí lại. `status` và `verify` sẽ liệt kê trang này. Hãy yêu cầu lại bằng `--redo files:<page>`, thêm một phương thức `fallback`, hoặc tự viết đoạn văn đó (nội dung sẽ được giữ lại). Một trường front-matter bị từ chối cũng sẽ giữ nguyên văn bản gốc theo cách tương tự, và phần còn lại của trang vẫn được ghi. Xem [Các khối Markdown và trường front-matter bị từ chối](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Để chủ động dịch lại một tệp, hãy chỉ định tên của nó. Đường dẫn là đường dẫn mà lệnh sync hiển thị, tương đối so với thư mục nội dung:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Xem xét và chỉnh sửa bản dịch {#reviewing-and-editing-translations}

Người duyệt (reviewer) có thể chỉnh sửa Markdown đã dịch trực tiếp trong tệp bản dịch. Champollion sẽ giữ lại những nội dung sửa đổi đó khi nguồn thay đổi sau này.

1. Chạy `champollion sync` và commit các bản dịch cùng với `.champollion-content.lock`.
2. Người duyệt mở tệp đã dịch, ví dụ `newsletters/2026-10.crk.md`, và chỉnh sửa. Họ có thể thay đổi bất kỳ đoạn văn nào, hoặc một trường front-matter đã dịch như `title` hay `description`.
3. Người duyệt commit tệp. Không cần câu lệnh nào để "chấp nhận" các chỉnh sửa.

Điều gì xảy ra với các chỉnh sửa trong lần chạy `champollion sync` tiếp theo:

| Tình huống | Lệnh sync thực hiện |
|---|---|
| Nguồn không thay đổi | Không làm gì cả. Bản dịch được giữ nguyên chính xác như người duyệt đã để lại. |
| Nguồn thay đổi ở các đoạn văn **khác** | Các đoạn văn và trường của người duyệt được **giữ nguyên từng chữ** và các đoạn văn đã thay đổi sẽ được dịch. Lần chạy sẽ thông báo điều này, ví dụ `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. Văn bản của người duyệt vẫn thuộc về họ trong mọi lần sync sau này. |
| Đoạn văn nguồn mà người duyệt đã chỉnh sửa **cũng** thay đổi | Đoạn văn đó sẽ được dịch lại, vì phiên bản của người duyệt dịch từ phần tiếng Anh không còn tồn tại nữa. Lần chạy sẽ in cảnh báo kèm từ ngữ của người duyệt, để bạn có thể áp dụng lại nếu vẫn phù hợp. |
| Người duyệt thêm, xóa hoặc gộp các đoạn văn, hoặc cặp ngôn ngữ sử dụng `contentSegmentation: "page"` | Các chỉnh sửa không thể khớp theo từng đoạn văn. Khi nguồn thay đổi, tệp sẽ được **giữ nguyên chính xác như hiện trạng**, và mỗi lần sync sẽ cảnh báo cũng như liệt kê tệp này cho đến khi được xử lý. Bạn có thể tự cập nhật thủ công (lần sync tiếp theo sẽ nhận tệp đã chỉnh sửa làm tệp hiện tại), hoặc thay thế bằng bản dịch máy bằng cách dùng `--redo files:<path>`. |

Các chỉnh sửa đối với khối mã, khoảng trắng giữa các đoạn văn, và các trường front-matter không được dịch (`date`, `tags`, v.v.) sẽ không được giữ lại khi tệp được ghi lại. Những phần đó luôn được lấy từ nguồn.

**Chủ động thay thế các chỉnh sửa.** Các chỉnh sửa chỉ bị thay thế khi bạn chỉ định rõ tên tệp. `--redo files:2026-10.md` khôi phục lại bản dịch máy được lưu trong bộ nhớ đệm (cache). `--redo files:2026-10.md --fresh` (hoặc `--retranslate 2026-10.md`) sẽ dịch lại từ đầu. Một lần chạy xử lý lại toàn bộ nội dung mà không chỉ định tên tệp (`--redo content`, `--force-content`) vẫn sẽ giữ lại các chỉnh sửa.

**Cách nhận diện các chỉnh sửa.** Mỗi lần ghi bản dịch, lệnh sync cũng ghi lại vào `.champollion-content.lock` một đoạn mã nhận diện (fingerprint) ngắn của từng đoạn văn đã ghi. Đoạn văn trên đĩa không còn khớp nữa tức là đã được con người chỉnh sửa. Nếu lock file bị mất, các chỉnh sửa sẽ không thể nhận diện được, vì vậy hãy lưu nó trong hệ thống quản lý phiên bản (version control). Bản dịch được ghi bởi phiên bản Champollion cũ hơn sẽ được ghi nhận vào lần sync tiếp theo. Nếu các chỉnh sửa của bạn khác với những gì Translation Memory lưu giữ, chúng sẽ được nhận diện là của bạn.

Văn bản của người duyệt không bao giờ được lưu trong Translation Memory dưới dạng kết quả dịch máy.

:::note[XLIFF chỉ áp dụng cho tệp chuỗi (string file)]
`champollion xliff export` chuyển giao **tệp chuỗi** (khóa và giá trị) của ứng dụng tới công cụ CAT của biên dịch viên. Xem [Làm việc với biên dịch viên chuyên nghiệp](/docs/guides/professional-translators). Hiện chưa có tính năng xuất XLIFF cho nội dung Markdown, do đó Markdown đã dịch sẽ được xem xét trực tiếp trong chính các tệp đó như đã mô tả ở trên.
:::

## Các phương thức chỉ dành cho Markdown

:::warning[Google Translate và Markdown]
Google Translate **hoàn toàn không nhận biết** được các khối mã, shortcode hay các biến nội suy (interpolation variable). Nó sẽ làm hỏng nội dung Markdown có cấu trúc. Hãy sử dụng các phương thức LLM (`llm` hoặc `llm-coached`) để dịch nội dung, vì chúng chủ động bảo vệ các phần tử có cấu trúc.
:::

Khi quá trình dịch nội dung chuyển hướng dự phòng (fallback) từ Google Translate sang một phương thức LLM, champollion sẽ ghi nhật ký (log) một cảnh báo giải thích lý do.
