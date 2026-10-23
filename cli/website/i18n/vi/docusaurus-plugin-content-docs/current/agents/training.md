---
title: "Huấn luyện với nmt-forge"
slug: /agents/training
description: "Cách nmt-forge huấn luyện và kiểm thử mô hình theo quy trình định sẵn: các cấu hình đặt sẵn của mô hình và những gì --model auto tự chọn theo bộ nhớ, vòng lặp có rào chắn bảo vệ qua từng lệnh, giới hạn giải mã và độ dài, các tác vụ chạy nền cùng hàng đợi huấn luyện từng mô hình một, dung lượng đĩa (các checkpoint được giữ lại, kiểm tra đĩa, dọn dẹp), xuất và phục vụ, các vòng cải thiện (đánh giá của vòng, đánh giá của người nói) cùng đề xuất mô hình mạnh hơn, dữ liệu tổng hợp, bảng triệu chứng → nguyên nhân → cách khắc phục đã kiểm chứng, và phân loại lỗi."
---

# Huấn luyện với nmt-forge

`nmt-forge` huấn luyện một mô hình dựa trên các cặp câu của cộng đồng, bên trong các rào chắn bảo vệ: công cụ sẽ từ chối những gì có thể làm sai lệch kết quả, và mỗi lần từ chối đều nêu rõ điều gì xảy ra, lý do và cách khắc phục. Công cụ không tự cài đặt bất kỳ thước đo nào — mọi điểm số đều đến từ công cụ đánh giá (`mt-eval`), cùng một mã nguồn chấm điểm cho mọi thứ khác.

Trên quy trình có rào chắn (rails), bạn hiếm khi phải gõ các lệnh này: `champollion next` sẽ gọi tên chúng, và từ bước `forge` trở đi, nó sẽ chuyển tiếp cố vấn riêng của forge (`nmt-forge status`). Trang này giải thích những gì các bước đó thực hiện.

## Các mô hình

`nmt-forge init --model <preset>` ghi một cấu hình mẫu (preset) vào `config.json` dưới dạng các con số rõ ràng (được băm vào định danh của mỗi lượt chạy: phiên bản forge phát hành sau không bao giờ làm thay đổi các lượt chạy của dự án hiện có). `nmt-forge use-model <preset>` dùng để chuyển đổi dự án.

| Cấu hình mẫu | Bản chất | Yêu cầu | Điều forge khuyến nghị kỳ vọng |
|---|---|---|---|
| `cpu-tiny` | Một transformer nhỏ được huấn luyện từ đầu trên các cặp câu, với vốn từ 4.000 phần tử được học từ các dòng huấn luyện | Chỉ cần CPU · không cần tải về | "trên khoảng 1–2 nghìn cặp câu: chrF++ vào khoảng 5–30 (mức cao nhất chỉ dành cho dữ liệu có tính khuôn mẫu cao) — ghi nhớ các cụm từ và khuôn mẫu trong dữ liệu của bạn, không phải bản dịch tổng quát" |
| `byt5-small` | Mô hình ByT5-small của Google (300 triệu tham số, đọc theo byte — không cần khớp từ vựng), được tinh chỉnh | Tải về ~1,2 GB · khuyến nghị dùng Apple silicon hoặc GPU CUDA | "trong các thử nghiệm của riêng forge, mô hình này học được nhiều hơn nhiều từ cùng các cặp câu so với cpu-tiny — bạn vẫn nên đo lường nó với mô hình đang dùng trên tập dev của mình" |
| `byt5-small-lowmem` | Cùng mô hình, tốc độ học và giới hạn độ dài, được thiết lập cho máy tính có bộ nhớ 8–15 GB: Adafactor, gradient checkpointing, và các batch gồm 4 cặp câu tích lũy 4 lần (vẫn là 16 cặp câu mỗi bước) — tốn ít bộ nhớ hơn mỗi bước, mất nhiều thời gian hơn. Chưa được đo lường trên máy tính 8 GB | như `byt5-small` | như `byt5-small` |
| `cpu-finetune` | Một mô hình Marian/opus-mt tiền huấn luyện nhỏ, được tinh chỉnh trên CPU. Bạn tự đặt tên cho mô hình cơ sở (`--base`); công cụ không bao giờ tự đoán | Chỉ cần CPU · tải về ~300 MB | "tùy thuộc vào mức độ liên quan của ngôn ngữ đích của mô hình cơ sở — hãy đo lường nó với cpu-tiny trên tập dev của bạn" |
| `nllb-600m` | NLLB-200 distilled 600M với LoRA | GPU CUDA (8 GB trở lên) · tải về ~2,5 GB | "mạnh nhất trong ba mô hình khi NLLB bao quát một ngôn ngữ có liên quan; bạn vẫn cần đo lường — đừng bao giờ mặc định" |

Mọi cấu hình mẫu đều huấn luyện với phần bổ trợ huấn luyện của forge (`nmt-forge[hf]`), với seed là 42. Không cấu hình mẫu nào đặt sẵn giới hạn thời gian: con số đó do cộng đồng tự quyết định.

- **Khi không có `--model`**, `init` sẽ ghi `cpu-tiny`.
- **`--model auto`** (thứ mà rails truyền vào) đọc bộ nhớ của GPU mà forge có thể huấn luyện trên đó — trên máy Mac dùng Apple silicon, đó là bộ nhớ của máy tính (dùng chung với GPU); với `nvidia-smi` trên `PATH`, đó là bộ nhớ của card NVIDIA lớn nhất: 16 GB trở lên (hoặc bộ nhớ không thể đọc được) → `byt5-small`; 8–15 GB → `byt5-small-lowmem`; dưới 8 GB → `cpu-tiny`. Khi không có GPU nào trong hai loại, chọn `cpu-tiny`. Lý do, cùng với dung lượng bộ nhớ tìm thấy, sẽ được in ra (`chosen: …`) và trả về dưới dạng `model_choice` trong `--json`. Thao tác này không kiểm tra xem GPU có hoạt động hay không. `NMT_FORGE_AUTO_PRESET` sẽ ghi đè thiết lập này (nó phải chỉ định rõ tên cấu hình mẫu).
- **Mô hình mạnh hơn mà các vòng đề xuất** chỉ dành cho dự án có mô hình đang dùng là `cpu-tiny`: `byt5-small-lowmem` ở nơi mà `--model auto` sẽ chọn nó, nếu không thì chọn `byt5-small` — cũng trên máy tính mà `auto` sẽ chọn `cpu-tiny`; phần `why` của đề xuất sẽ nêu rõ những gì nó cần.

**Lưu ý.** Đừng bao giờ miêu tả kỳ vọng của một cấu hình mẫu như một lời hứa chắc chắn. Hãy đo lường trên tập dev.

## Vòng lặp có rào chắn

Mỗi lệnh đều nhận `--json`; `--workspace <dir>` (mặc định là `.forge`) đứng trước lệnh con. Forge từ chối các cờ viết tắt.

| Bước | Lệnh | Chức năng | Các trường hợp từ chối |
|---|---|---|---|
| Workshop | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Ghi `.forge/`, `config.json`, `NEXT_STEPS.md` | `--pair` không đọc được; `cpu-finetune` mà không có `--base` |
| Tập kiểm thử | `nmt-forge registry add project-test <file> --role test` | Ghim mã sha256 của tệp; bắt đầu nhật ký đọc của tệp | Các dòng tổng hợp trong một tập kiểm thử hoặc tập niêm phong; tên đã được đăng ký với nội dung khác (trừ khi `--allow-rotate`) |
| Sàng lọc | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Sàng lọc từng cặp dữ liệu đối chiếu với mọi tập phát triển, kiểm thử và niêm phong đã đăng ký; ghi một bản sao sạch | Ghi đè lên tệp đang sử dụng (trừ khi `--overwrite`); kết quả không còn dữ liệu huấn luyện nào |
| Dự đoán | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Ghi lại kết quả dự đoán của cộng đồng trước bất kỳ điểm số nào | ID đã tồn tại; ghi sau bất kỳ lượt đọc chấm điểm nào của tập dữ liệu, bởi forge hoặc `mt-eval` (trừ khi `--allow-after-reads`, được ghi vào sổ cái) |
| Tập phát triển | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Tách tập phát triển không trùng lặp theo nhóm, được đăng ký là `project-dev`. `<n>` của rails: một phần mười số cặp đã sàng lọc, tối thiểu 50, tối đa 500 — một phần tư trong số đó dưới 200 cặp ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` giữ các bản sao gần giống (độ trùng lặp từ ≥ 0,6) ở một phía, đây là ngưỡng mà sàng lọc ở mọi vòng sau đều áp dụng; rails đặt `--max-group` bằng một nửa kích thước tập phát triển cộng một, để tệp được viết từ các mẫu vẫn có thể phân tách | Một phía vượt quá 1,5× yêu cầu, hoặc phần huấn luyện giữ lại dưới một nửa số dòng |
| Mức sàn | `nmt-forge floor <word lists>` | Dịch từng từ một của tập phát triển theo từ điển và chấm điểm tương tự như điểm tập phát triển của một lượt chạy | Chưa đăng ký tập phát triển nào |
| Kiểm tra | `nmt-forge preflight run --config config.json` | Chạy mọi cổng kiểm tra mà lượt chạy sẽ gặp, kèm các cách khắc phục; thoát với mã 2 nếu có bất kỳ cổng nào thất bại | — |
| Huấn luyện | `nmt-forge run config.json --detach` | Huấn luyện, chọn checkpoint trên tập phát triển, xóa các checkpoint khác của lượt chạy ([dung lượng đĩa](#disk-space)), ghi `.forge/runs/<run name>-<8 hex>/` cùng với `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Lượt chạy đã tồn tại (cùng cấu hình, các tệp huấn luyện và tập phát triển); đĩa không đủ dung lượng chứa (`disk-room`, trước khi ghi bất cứ thứ gì; `--skip-disk-check` sẽ ghi đè quy tắc này); lượt chạy đang diễn ra; các dòng huấn luyện bị rò rỉ vào tập kiểm thử hoặc tập niêm phong; các dòng phát triển lẫn vào tập huấn luyện; dữ liệu bị đánh dấu không huấn luyện hoặc bị cách ly; `terms.training: not-allowed`; dữ liệu tổng hợp vượt quá giới hạn; giới hạn giải mã quá ngắn so với các bản dịch tham chiếu; các khóa cấu hình không xác định |
| Chấm điểm kiểm thử | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Chấm điểm tập kiểm thử một lần đối chiếu với kết quả dự đoán; đóng gói mô hình, kèm `input-words.json` bên cạnh thư mục của mô hình — các từ mà mô hình đã được huấn luyện, để máy chủ có thể chỉ ra những từ mô hình chưa từng thấy ([phục vụ](/docs/agents/serving#what-an-export-holds)) | Chưa đăng ký trước, hoặc có nhiều bản đăng ký nhưng không có `--prereg`; tập niêm phong đã sử dụng hết; `--out` không rỗng mà không có `--force` |
| Lựa chọn | `nmt-forge choose <export>/model` | Ghi lại lựa chọn mô hình của cộng đồng | Thư mục không phải là bản xuất đã ghi nhận kèm theo mô hình |
| Phục vụ | `nmt-forge serve <export>/model --detach` | Phục vụ mô hình trên máy tính này ([phục vụ](/docs/agents/serving#nmt-forge-serve)) | Ngoài loopback mà không có token, hoặc mô hình chỉ dùng cục bộ mà không có `--holders-agreed-by` |

Mọi thông tin quan trọng đều được ghi vào sổ cái chuỗi băm (hash-chained ledger) (`.forge/ledger.jsonl`): các lượt đăng ký, các lượt đọc cùng mục đích, các dự đoán, điểm số, các lần dùng tập niêm phong, các lần ghi đè, kết luận kiểm toán, điểm sàn, các bản xuất, các lựa chọn, các lượt phục vụ cũng như thời điểm bắt đầu và kết thúc tác vụ. Bản kê lượt chạy (run manifest) là biên bản ghi nhận của một lượt chạy.

**Các cổng kiểm tra trước khi chạy:** cấu hình (in ra mã băm cấu hình đầy đủ), độ khớp của không gian làm việc, không có lượt chạy nào đang diễn ra, hàng rào bảo vệ dev, dữ liệu huấn luyện, backend đã cài đặt, các plugin chọn lọc, các cặp gần trùng trong tập kiểm thử và tập dev (cảnh báo), kiểm toán rò rỉ, tỷ lệ pha trộn dữ liệu huấn luyện, khoảng trống tạo sinh, tính hợp lý của lịch trình.

**Giải mã.** Quá trình giải mã dev cuối cùng, lượt đọc kiểm thử (`export`), một mô hình đang dùng dịch lại tập dev, và mô hình đang được phục vụ đều sử dụng tìm kiếm chùm (beam search) với `decode.num_beams` (4 trừ khi `config.json` quy định khác); việc lựa chọn checkpoint, vốn xếp hạng nhiều checkpoint, sẽ giải mã theo kiểu tham lam (greedy). Bản xuất sẽ ghi lại `beams_applied`, và `nmt-forge serve` sẽ giải mã theo đúng cách mà mô hình đã được đo lường: bản xuất cũ hơn không có thông tin này sẽ được phục vụ theo kiểu tham lam.

**Giới hạn độ dài.** Một mô hình học từ tối đa `model.max_src` token của một câu nguồn và `model.max_tgt` của bản dịch, đọc tối đa `model.max_src` khi dịch, và viết tối đa `decode.max_new_tokens` (`byt5-small`: mỗi chiều 320 byte — khoảng 320 chữ cái Latinh, khoảng 100 ký tự âm tiết; `cpu-tiny`: 256 phần tử đầu vào, 384 đầu ra). Không có gì bị cắt bỏ trong âm thầm: quá trình huấn luyện đếm các cặp câu vượt quá một trong hai giới hạn trước khi cắt tỉa chúng, và lần giải mã dev cuối cùng sẽ đếm các câu bị cắt khi đưa vào cùng các bản dịch bị dừng lại ở mức trần. Cả hai đều được ghi vào bản kê lượt chạy (`length_limits`), và `status` sẽ cảnh báo kèm giải pháp: ngắt các câu dài, hoặc tăng `model.max_src` và `model.max_tgt` (và `decode.max_new_tokens`) trong `config.json` — khi đó việc huấn luyện sẽ mất nhiều thời gian hơn.

**Lưu ý.** Bản thân `nmt-forge run` không bắt buộc phải có dự đoán; rails sẽ yêu cầu dự đoán trước. Không huấn luyện trước khi hoàn thành bước dự đoán.

**Lưu ý.** `export` là bước đọc tập kiểm thử. Việc chạy bước này là một cột mốc quan trọng, khi dự đoán của cộng đồng đã được ghi nhận trước đó — tuyệt đối không phải là một bước kiểm tra thông thường.

## Các tác vụ chạy ngầm

`run --detach` và `serve --detach` khởi động một tác vụ có giám sát và trả về quyền điều khiển.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Các trạng thái: `running`, `finished`, `refused`, `crashed`, `stalled`, `deadline`, `interrupted`, `lost`. `lost` là tác vụ có tiến trình giám sát kết thúc mà không có bản ghi — bao gồm cả sau khi khởi động lại máy, khi số hiệu tiến trình của nó giờ thuộc về một tiến trình khác.
- **Mỗi thời điểm chỉ huấn luyện một tác vụ trên máy tính này.** Các tác vụ huấn luyện xếp hàng trên toàn máy, đến trước phục vụ trước (`~/.nmt-forge/machine/train-queue`), trên mọi dự án. Một tác vụ đang xếp hàng sẽ giữ trạng thái `running`, kèm theo `queued_behind` (tác vụ mà nó đang chờ) trong `nmt-forge jobs --json`; `status` có giá trị `training` và cho biết nó đang chờ sau ai, và nó sẽ tự khởi động. Nếu bị dừng trong lúc đang chờ, tác vụ sẽ kết thúc ở trạng thái chưa khởi động (`interrupted`); chờ quá 24 giờ cũng sẽ kết thúc tác vụ (`deadline`).
- **Các giới hạn** (tác vụ huấn luyện): không có dấu hiệu hoạt động trong 15 phút khi khởi động (`--startup-minutes`); không có tiến triển nào trong khoảng thời gian dài hơn giữa 10 phút và 30 lần thời gian trung vị của một bước (`--stall-minutes`); hạn chót là `--deadline-hours`, nếu không thì bằng ngân sách thời gian trong cấu hình × 1,25, nếu không có nữa thì là 24 giờ. Tác vụ vượt quá giới hạn sẽ bị dừng và ghi lại thông tin.
- **Dừng tác vụ**: lượt chạy dừng lại ở bước tiếp theo; tiến trình giám sát sẽ nâng mức xử lý lên chấm dứt (terminate) sau 60 giây và buộc dừng hẳn (kill) sau đó 10 giây.
- **Cổng kiểm tra thời gian thực** (các backend Hugging Face): sau giai đoạn làm nóng (warm-up), forge sẽ đo thời gian các bước, ước tính toàn bộ lượt chạy và từ chối nếu lượt chạy không khớp với ngân sách (`wall-clock budget exceeded: …`). Nếu không đặt ngân sách, mức trần là 24 giờ.
- Trong khi một tác vụ huấn luyện đang chạy, `status` là `training` và bước của rails là `wait`. Một tác vụ bị thất bại sẽ xuất hiện dưới dạng cảnh báo trên mọi trạng thái sau đó.
- **Khôi phục.** Khi tác vụ huấn luyện gần nhất kết thúc ở trạng thái `lost`, `crashed`, `stalled` hoặc `deadline` sau khi đã lưu một checkpoint, `status` sẽ gợi ý lệnh `nmt-forge preflight run --config config.json && nmt-forge run config.json --resume --detach`: một lượt chạy mới bắt đầu từ checkpoint cuối cùng của lượt chạy bị gián đoạn (trọng số của nó, một bộ tối ưu mới, các epoch còn lại), và bản kê của nó sẽ nêu rõ nơi nó đã khôi phục (`resumed_from`). Lệnh này không bao giờ được đề xuất sau khi dừng thủ công.
- Các tác vụ tách rời (detached jobs) chỉ hỗ trợ hệ thống POSIX (macOS, Linux).

## Dung lượng đĩa

Quá trình huấn luyện ghi lại các checkpoint: tối đa `model.save_total_limit` checkpoint cùng lúc
(4 checkpoint trừ khi `config.json` chỉ định khác), mỗi checkpoint khoảng 1,4 GB đối với ByT5-small.
Trước khi có những quy tắc này, mỗi vòng cải thiện của một dự án ByT5-small giữ lại khoảng
5,6 GB, không có gì xóa mô hình của vòng trước, và đĩa đầy đã làm hỏng
lượt chạy khi đang lưu. Đơn vị GB của Forge là 1024³ byte.

- **Một lượt chạy hoàn tất chỉ giữ lại checkpoint đã chọn.** Mọi thư mục
  `checkpoint-*` khác của lượt chạy sẽ bị xóa khi checkpoint đã được chọn:
  không có gì đọc lại chúng nữa (`export` sao chép checkpoint được chọn; vòng tiếp theo
  bắt đầu từ mô hình đang dùng). Tệp manifest ghi nhận `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` trong khối
  `model` của `config.json` sẽ giữ lại tất cả. Bất kỳ giá trị nào khác đều bị từ chối khi
  đọc cấu hình, trước bất kỳ quá trình huấn luyện nào (`ConfigError`; ở đây cho giá trị `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Khóa.** Lượt chạy mà ổ đĩa không đủ chỗ chứa sẽ bị từ chối trước khi có bất kỳ dữ liệu nào được ghi
  (chốt chặn `disk-room`); lượt chạy tách rời (detached run) bị từ chối ngay lập tức, trước khi tác vụ
  của nó bắt đầu. Mức ước tính: kích thước của một checkpoint — checkpoint được giữ lại của
  một lượt chạy trước đó của cùng mô hình nền trong không gian làm việc này, hoặc là các tệp trọng số
  của chính mô hình nền (thư mục cục bộ, hoặc bộ nhớ cache của Hugging Face) — nhân với
  `model.save_total_limit`, cộng thêm 1 GB để hoàn tất; không bao giờ dưới 2 GB. Thông báo
  từ chối cho biết
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — hoặc khi không rõ kích thước, *"(dù là mô hình nào thì dung lượng trống tối thiểu cũng phải còn từng đó)"* — sau đó là
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  và một `fix` nêu rõ những gì `nmt-forge tidy` có thể giải phóng ở đây (khi có thể
  giải phóng bất kỳ thứ gì), việc di chuyển các tệp khác ra khỏi ổ đĩa, và `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (có hoặc không có `--detach`) vẫn khởi
  chạy dù thế nào đi nữa. Mục `disk_room` của manifest ghi lại quá trình kiểm tra — `free_bytes`,
  `checkpoint_bytes` (`null` khi chưa rõ), `checkpoints_at_once`,
  `need_bytes` — hoặc `{"skipped": "--skip-disk-check"}`. **Lưu ý.** Ước
  tính có thể sai lệch; việc có bỏ qua bước kiểm tra hay không là do người dùng quyết định.
- **`nmt-forge tidy`** liệt kê trọng số mô hình của các vòng trước không còn gì
  sử dụng — mỗi lượt chạy cùng kích thước của nó, tổng dung lượng, dung lượng trống — và không
  xóa bất cứ thứ gì. `nmt-forge tidy --yes` sẽ xóa chúng. Lệnh này không bao giờ xóa mô hình đang
  dùng, lượt chạy mới nhất, hay mô hình mà mô hình đang dùng đã thay thế (bảng duyệt
  mù dùng nó để tạo bản nháp); dòng `Kept:` ở đầu ra nêu tên từng mục kèm theo lý do. Một lượt chạy đã dọn dẹp vẫn giữ lại bản ghi của mình — manifest, các bản dịch tập dev, báo cáo —
  và manifest của nó nhận thêm `model_removed` (`at`, `by`, `bytes`, `why`); sổ
  cái nhận một mục `tidy` (`runs`, `bytes`). Một lượt chạy đã dọn dẹp khi được yêu cầu
  dịch (`compare-runs` dịch lại tập dev bằng mô hình đó) sẽ bị từ chối:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Lưu ý.** `--yes` xóa các tệp: hãy cho người dùng xem danh sách, và chỉ chạy khi
  họ đồng ý.
- **`status` cảnh báo** — một dòng trong `warnings`, được hệ thống rails chuyển tiếp — khi
  ổ đĩa chứa không gian làm việc còn dưới 10 GB trống, hoặc việc dọn dẹp có thể giải phóng từ 5 GB
  trở lên: *"máy tính này còn trống X GB; mô hình của N vòng trước không còn dùng chiếm Y GB — `nmt-forge tidy` liệt kê các mô hình này,
  `nmt-forge tidy --yes` giải phóng dung lượng (mô hình đang dùng, mô hình mới nhất và
  mô hình mà nó đã thay thế được giữ lại)"* (phần sau dấu chấm phẩy chỉ xuất hiện khi
  việc dọn dẹp có thể giải phóng dung lượng).

## Các vòng cải thiện

Khi một mô hình đã được đưa vào sử dụng, mỗi vòng sẽ huấn luyện một lượt chạy mới trên lượng dữ liệu nhiều hơn với cùng một tập dev.

**Cách một vòng huấn luyện.** `champollion improve prepare` chạy lệnh `nmt-forge round-plan --config config.json`, which rewrites `config.json` theo một trong hai cách và ghi kế hoạch vào sổ cái (`round-plan`):

- **Tiếp tục từ mô hình đang dùng** (`init_from` thư mục mô hình của nó): 4 lượt duyệt (epoch) qua toàn bộ các câu tính đến hiện tại — các câu cũ giúp mô hình không bị quên — ở mức một nửa tốc độ học. Nhanh hơn nhiều so với huấn luyện lại từ đầu. Toàn bộ thiết lập đầy đủ chờ sẵn trong `config.json` dưới mục `model_full`.
- **Từ đầu**, với các thiết lập đầy đủ được khôi phục, khi chưa có mô hình nào được đưa vào sử dụng; khi mô hình bị thay đổi (`use-model`, lệnh này cũng bỏ `model_full`); đối với `cpu-tiny`, vốn có từ vựng bắt nguồn từ các câu huấn luyện (huấn luyện chỉ mất vài phút); đối với mô hình adapter (LoRA); và cứ mỗi vòng thứ 4, để nhiều lần tiếp nối ngắn không làm mô hình bị trôi dạt.

`prepare` in ra kế hoạch và lý do, đồng thời ghi lại `training` (`mode`,
`epochs`) trong `improve/round-<k>/prepared.json`. Dù theo cách nào, lượt chạy mới cũng được
đánh giá đối chiếu với mô hình đang sử dụng trên cùng các câu phát triển. Sau đó (1, 3 và
4 là các trạng thái mà cố vấn của forge nêu tên; 2 được rails ghi lại):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — hai mô hình, được ghép cặp
   theo từng câu trên tập dev. Với ít hơn 50 câu tập dev, kết
   luận là **too-few**, bất kể điểm số: *"quá ít câu tập dev để
   xác định: dưới 50 câu, không thể phân biệt khác biệt thực sự với ngẫu nhiên một cách đáng tin cậy, bất kể
   mức độ chênh lệch"*. Từ 50 câu trở lên: **better** chỉ khi phép kiểm định bắt cặp có p < 0,05
   **và** khoảng tin cậy 95% của độ chênh lệch nằm trên 0; **worse** khi
   p < 0,05 và khoảng này nằm dưới 0; còn lại là **no-change**. Mỗi kết luận đều nêu rõ
   mức chênh lệch nhỏ nhất mà tập dev có thể phát hiện một cách đáng tin cậy. Tập test không bao giờ
   được đọc. Bị từ chối (`improve-loop`) đối với các lượt chạy trên các tập dev khác nhau, lượt chạy
   không có bản dịch tập dev được lưu, hoặc tập dev đã thay đổi kể từ lượt chạy mới.
2. **Đánh giá của người bản ngữ**, nơi tập dev không thể đưa ra quyết định. Mô hình
   của một vòng chưa được đưa vào sử dụng sẽ tạo bản nháp cho một nửa số dòng dự thảo
   trong bảng duyệt tiếp theo, theo phương pháp mù (`draft-newer`, bên dưới), và `champollion improve
   marks` ghi lại số lượng đánh giá của người bản ngữ với forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge chỉ xử lý thông tin này sau kết luận **too-few** hoặc **no-change**. Một
   phép kiểm định gộp hai tỷ lệ, hai phía ở mức 5% (|z| > 1,96), đưa ra `clear`:
   `newer`, `in-use` hoặc `neither`; mục `improve-speaker` của sổ cái lưu lại
   tên của hai lượt chạy, bốn số lượng đếm, `z` và `clear` — chỉ lưu số lượng đếm. Lệnh này
   từ chối số đếm nhỏ hơn 0, số câu đúng nhiều hơn số câu được đánh giá, và mô hình không có
   bản nháp nào được đánh giá. Nội dung thông báo: *"Khi chấm mù trong cùng một đợt kiểm tra, người bản ngữ
   đã đánh dấu mô hình mới hơn dịch đúng A trên B câu mới (P%) và mô hình
   đang dùng đúng C trên D (Q%)"*, sau đó là *"mô hình mới hơn rõ ràng tốt hơn trên
   các câu này — forge đề xuất đưa nó vào sử dụng"*, *"mô hình đang dùng rõ
   ràng tốt hơn trên các câu này — tiếp tục giữ lại"* hoặc *"không có khác biệt rõ ràng
   trên các câu này — tiếp tục giữ lại mô hình đang dùng"*.
3. **`improve-promote`** (`confirm`), khi kết quả là **better** — hoặc khi là **too-few** hoặc
   **no-change** nếu `speaker-verdict` mới nhất của lượt chạy đó cho biết
   `clear: newer` (không bao giờ đề xuất khi là **worse**). Đây là một đề xuất: chỉ riêng kết luận thì chưa đưa
   bất cứ mô hình nào vào sử dụng. Khi người dùng đồng ý, lệnh này sẽ xuất lượt chạy mới mà không đọc
   tập test (`--no-eval`), ghi nhận là đã chọn (`choose`), dừng máy chủ đang chạy
   và phân phát mô hình mới trên cùng một cổng. Chỉ khi có
   `export` và `choose` đó mới được tính là đưa một mô hình vào sử dụng: cho đến lúc đó, báo cáo
   vòng chạy sẽ ghi *"tốt hơn rõ rệt: chưa được đưa vào sử dụng — người dùng
   chưa chọn"*, đồng thời tiến độ, dự phóng và kiểm tra quá khớp (overfit) sẽ loại
   mô hình đó ra. Dựa trên các đánh giá của người bản ngữ, `why` của lệnh sẽ bổ sung số lượng của họ cùng thông báo *"khác
   biệt rõ ràng: mô hình mới hơn dịch tốt hơn ở các câu mà gia đình
   cần"*. Trong bảng duyệt tiếp theo, một nửa số dòng dự thảo đến từ mô hình mà nó đã
   thay thế, nhờ đó người bản ngữ kiểm tra việc nâng cấp này theo phương pháp mù (bên dưới).
4. Nếu không, mô hình đang dùng sẽ được giữ lại và vòng tiếp theo bắt đầu — trừ khi
   kết luận của hai vòng gần nhất kể từ lần thay đổi mô hình gần nhất đều là
   **no-change** hoặc **worse**, với `cpu-tiny` đang được dùng. Lần thay đổi
   mô hình gần nhất là mục `model-change` mới nhất (chuyển đổi preset hoặc `not-now`) hoặc
   `choose` trong sổ cái — bất kỳ mô hình nào mà người dùng đã đưa vào sử dụng, bao gồm cả
   việc nâng cấp dựa trên đánh giá của người bản ngữ. Một vòng có kết quả **too-few** không phải là một
   vòng đã được phân định: nếu một trong hai vòng gần nhất là too-few, sẽ không có đề xuất nào.
   Sau đó **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (hoặc
   `not-now`), preset `byt5-small` hoặc `byt5-small-lowmem`
   ([các mô hình](#models)). Ô câu trả lời là `try_it`. `yes` ghi lại
   mô hình của cấu hình (vẫn giữ nguyên quỹ thời gian của người dùng) và bước tiếp theo sẽ huấn luyện
   mô hình đó; `not-now` không thay đổi gì cả. Cả hai trường hợp đều được ghi vào sổ cái
   (`model-change`), và đề xuất chỉ xuất hiện lại sau thêm hai vòng như vậy nữa.
   Qua MCP, "không phải lúc này" ở đây là câu trả lời `try_it: "not-now"`;
   `declined: true` bị từ chối ở bước này
   ([MCP](/docs/agents/mcp#not-now)). `why` của nó không bao giờ nói rằng thêm câu là
   không có tác dụng: khi tập dev quá nhỏ để nhận thấy mức tăng của một vòng, thông báo sẽ là *"có thể
   các cải thiện nhỏ đang bị ẩn đi"*; nếu không thì các vòng đó *"không mang lại
   thay đổi nào mà các câu tập dev có thể nhận thấy (khoảng X điểm chrF++ trở lên): các vòng chạy có thể
   đang cải thiện ít hơn mức đó, hoặc không cải thiện gì"* — gần đỉnh của đường cong phát triển, một vòng chạy
   tăng thêm khoảng nửa điểm chrF++, thấp hơn mức mà 200 câu dev có thể phát hiện.
   **Lưu ý.** `--answer` mặc định là `yes`: luôn truyền câu trả lời của người dùng
   một cách rõ ràng.

Rails điều phối phần còn lại của một vòng (`champollion improve …`): `nmt-forge
wishlist` tạo bảng gồm những gì hữu ích nhất (mặc định 40 gợi ý nhắc, có
ít nhất một phần tư để mở; các từ mà mô hình chưa từng thấy sẽ yêu cầu hai hoặc
ba câu cho mỗi từ, mỗi câu diễn đạt một ý khác nhau — một từ chỉ thấy một lần trong
quá trình huấn luyện hiếm khi được học
([đo lường](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` phân tích chi tiết chrF++ của tập phát triển theo từng loại
câu, và `nmt-forge grow-dev` thêm các câu luyện tập của người bản ngữ vào
tập phát triển dưới cùng một tên — không bao giờ là dòng đã có trong tập phát triển, không bao giờ là dòng
có câu nguồn nằm trong tập kiểm thử hoặc tập niêm phong. Một loại câu chỉ định hướng cho
danh sách mong muốn khi nó có điểm số thấp hơn rõ rệt so với phần còn lại
([đo lường](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (được chạy bởi `champollion improve sheet`) dịch nháp ngẫu nhiên
một nửa số dòng của bảng đánh giá tiếp theo bằng mô hình kia, không đánh dấu, để
người bản ngữ đánh giá cả hai mô hình một cách mù
([đo lường](/docs/agents/measurement#the-speakers-marks)): mô hình mới nhất được
huấn luyện khi nó không phải là mô hình đang sử dụng (vòng của nó chưa được đưa vào
sử dụng), hoặc sau khi nâng cấp, là mô hình mà mô hình đang dùng đã thay thế. `--json` của lệnh
cho biết mô hình nào (`relation`: `newer` hoặc `replaced`, `null` khi không có mô hình
khác và mọi dòng đều thuộc về mô hình đang dùng), kèm `other`, `in_use`, các
cặp huấn luyện đằng sau mỗi mô hình (`other_pairs`, `in_use_pairs`) và `n`; mục
`draft-newer` của sổ cái cũng ghi nhận điều tương tự. Cách truyền đạt một vòng:
[hướng dẫn](/docs/agents/coaching).

## Dữ liệu tổng hợp và dịch ngược

- `nmt-forge synth <pack> --out <file>` chạy bộ tạo dữ liệu của gói ngôn ngữ. Forge không đi kèm bất kỳ gói nào. Mỗi dòng đều được xác minh và đóng dấu `synthetic: true`.
- Tệp dữ liệu tổng hợp được huấn luyện như một luồng có gắn thẻ trong `config.json` (`data.synthetic`, `{"path", "tag": "<synth>"}`). Nếu vượt quá 15% của một loại, lượt chạy sẽ bị từ chối trừ khi cấu hình có nêu rõ `mix.synthetic_sample`; `nmt-forge sample --cap 0.15 --key kind` sẽ rút ra một mẫu có giới hạn trần.
- **Dịch ngược không có lệnh riêng.** Nó là một hàm thư viện (`nmt_forge.training.backtranslation.backtranslate`): bạn cung cấp mô hình dịch ngược; trước tiên nó sẽ rà soát văn bản đơn ngữ đối chiếu với mọi tập đã đăng ký và gắn thẻ đầu ra của nó là `<bt>`; sau đó đầu ra được huấn luyện như một luồng dữ liệu tổng hợp. Không có bộ lọc chất lượng nào chạy trên phần này. `config.data.monolingual` sẽ bị từ chối.
- **Lưu ý.** Văn bản đơn ngữ cũng là dữ liệu của cộng đồng như bất kỳ dữ liệu nào khác: các điều khoản phụ kèm theo nó vẫn được áp dụng, và một mô hình dịch ngược là LLM được lưu trữ từ xa sẽ gửi dữ liệu đó đến một nhà cung cấp ([quy tắc dữ liệu](/docs/agents/data-rules)).

## Triệu chứng → nguyên nhân → cách khắc phục

| Triệu chứng | Nguyên nhân có thể | Cách khắc phục |
|---|---|---|
| `cpu-tiny` đạt điểm từ 5 đến 30 chrF++ trên tập phát triển | Mô hình này vốn dĩ yếu: một cuốn ngữ cảnh cho các cụm từ tương tự như dữ liệu huấn luyện của nó | Thêm các cặp dữ liệu thực tế; trên Apple silicon hoặc GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` khi GPU có 8–15 GB) |
| "Tốt trên câu mẫu, kém trên văn bản thực tế" | Quy tắc R7 (bão hòa chuyển giao): dev loss đã chạm đáy trước checkpoint cuối cùng và tăng từ 5% trở lên. Quy tắc này kích hoạt khi có bất kỳ mức tăng nào như vậy, bất kể chrF++ của tập phát triển ra sao — hãy đọc nó cùng với điểm tập phát triển | Thêm các cặp dữ liệu thực tế. Được hiển thị bởi `nmt-forge lint <run-manifest.json>`, không phải khi xuất |
| Điểm số có vẻ quá tốt | Các bản sao hoặc bản gần như sao chép của tập kiểm thử xuất hiện trong tập huấn luyện; hoặc hầu hết các dòng kiểm thử đều có một dòng sinh đôi trong tập huấn luyện (R4-recall-not-translation, từ một nửa trở lên) | `leak-audit --drop-test-twins` để có tệp không chứa các dòng trùng lặp; báo cáo điểm số có và không có các dòng sinh đôi |
| Sự khác biệt nhỏ giữa hai mô hình | Khoảng tin cậy quá rộng (R5-low-power, khoảng tin cậy rộng hơn 8 điểm) | `nmt-forge compare` (kiểm định ghép cặp); đối với các vòng, `compare-runs`. Mở rộng tập phát triển |
| Một vòng báo "quá ít câu phát triển để kết luận" (`too-few`) | Tập phát triển có dưới 50 câu: không có so sánh nào đưa ra quyết định ở đây | Không có gì cần khắc phục: bảng tiếp theo sẽ trộn các bản dịch nháp của cả hai mô hình một cách mù và điểm số của người bản ngữ sẽ quyết định; cứ hai dòng trong bảng thì có một dòng là câu luyện tập cho đến khi tập phát triển có đủ 50 câu |
| Một vòng báo "không có thay đổi đo lường được" | Tập phát triển quá nhỏ để nhận thấy mức cải thiện của một vòng | Mở rộng tập từ các câu luyện tập của người bản ngữ (`grow-dev`, được điều phối bởi `champollion improve prepare`) |
| Huấn luyện bị từ chối: `[disk-room] this computer has … free` | Đĩa không thể chứa các checkpoint của lượt chạy | `nmt-forge tidy` liệt kê dung lượng mà các mô hình của vòng trước có thể giải phóng; `nmt-forge tidy --yes` khi người dùng đồng ý; hoặc giải phóng dung lượng ở nơi khác. Chỉ dùng `--skip-disk-check` khi người dùng xác định rằng ước tính bị sai |
| Lượt chạy không vượt qua được mức sàn từ điển | Quá trình huấn luyện không học được gì ngoài danh sách từ vựng đã cung cấp | Thêm các cặp câu; kiểm tra độ bao phủ của mức sàn; thông báo điều này cho cộng đồng |
| Tập phát triển đã bão hòa | Cận dưới của khoảng tin cậy đạt 99% mức trần | Dùng một tập phát triển khó hơn; điểm số không thể tăng thêm nữa |
| Bị từ chối trước khi huấn luyện | Xem dòng "Huấn luyện" ở trên; `preflight run` nêu rõ từng cổng kiểm tra không đạt và cách khắc phục | Thực hiện theo cách khắc phục. Thiếu gói mở rộng huấn luyện: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (hoặc `pip` vào môi trường Python của chính forge) |
| Bị dừng do vượt quá thời gian thực tế | Dự kiến thời gian chạy vượt quá ngân sách (24 giờ nếu không đặt ngân sách) | Chọn mô hình nhỏ hơn hoặc giảm số epoch, hoặc ngân sách do cộng đồng thiết lập (`model.time_budget_hours`) |
| Tác vụ chạy ngầm thất bại | `nmt-forge jobs` hiển thị `crashed`, `stalled`, `deadline`, `lost` hoặc `refused` | Đọc `stderr.log` của tác vụ trong `.forge/jobs/<name>/` và khắc phục; sau đó huấn luyện lại, hoặc tiếp tục từ checkpoint cuối cùng khi `status` nêu rõ `--resume` |
| Quá trình huấn luyện chờ và không bắt đầu | Một tiến trình huấn luyện khác đang chạy trên máy tính này; tiến trình này đang xếp hàng sau nó (`queued_behind`) | Hãy chờ: tiến trình sẽ tự bắt đầu. Không khởi chạy tiến trình khác |
| Các câu dài bị cắt ngắn | Giới hạn độ dài: `status` cảnh báo kèm số lượng (các cặp bị cắt trong huấn luyện, các câu tập phát triển bị cắt khi đưa vào, các bản dịch bị dừng ở mức giới hạn) | Tách các câu dài; hoặc tăng `model.max_src`, `model.max_tgt` và `decode.max_new_tokens` (thời gian huấn luyện lâu hơn) |
| Các từ xuất hiện dưới dạng các mảnh không xác định (`cpu-tiny`) | Từ vựng chỉ được học từ các dòng huấn luyện | Thêm các cặp câu sử dụng những từ đó; hoặc `byt5-small`, mô hình đọc theo byte |

## Phân loại các dạng lỗi

Forge được xây dựng dựa trên danh mục các cách mà một dự án huấn luyện tự đánh lừa mình. Tóm lại — "bắt buộc thực thi" nghĩa là các công cụ sẽ từ chối:

| Nhóm | Các lỗi | Trong mã nguồn |
|---|---|---|
| Rò rỉ | Câu trả lời nằm trong tập huấn luyện; các bản gần như trùng lặp; câu diễn đạt lại nằm vắt ngang điểm phân tách; các mẫu câu liên kết chuỗi | Bắt buộc thực thi (kiểm toán rò rỉ, bảo vệ phân tách). Các câu mẫu cùng họ được giữ lại và đếm |
| Nhiễm bẩn tập dev/kiểm thử | Chọn checkpoint trên tập kiểm thử; dùng tập niêm phong hai lần; tính điểm kiểm thử mà không có dự đoán; dự đoán sau khi đã đọc dữ liệu | Bắt buộc thực thi (hàng rào dev, sổ cái đánh giá, đăng ký trước) |
| Bộ tách từ và chính tả | Bộ tách từ không thể viết được hệ chữ viết đó; quy ước chính tả bị lẫn lộn | Không kiểm tra đối với bộ tách từ; quy ước lẫn lộn là cảnh báo cú pháp (lint), chỉ khi cấu hình có nêu rõ |
| Dữ liệu tổng hợp | Làm chủ tỷ lệ pha trộn dữ liệu tổng hợp; dừng sớm làm hỏng lượt chạy có nhiều dữ liệu tổng hợp; sụp đổ mô hình; dịch ngược tự ăn sâu vào các lỗi của chính nó | Điểm sàn dừng sớm được bắt buộc thực thi; phần còn lại là cảnh báo cú pháp hoặc thẻ phân loại |
| Độ bao phủ | Thiếu các từ dành cho phong cách ngôn ngữ đó | Cảnh báo cú pháp, khi có plugin báo cáo độ bao phủ |
| Đo lường | Độ chênh lệch nhỏ hơn khoảng tin cậy của nó; một con số mơ hồ không rõ nguồn gốc; tính toán thước đo ngoài công cụ đánh giá | Bắt buộc thực thi: mỗi điểm số đều đi kèm khoảng tin cậy và đến từ công cụ đánh giá |
| Giải mã | Đầu ra bị cắt cụt; checkpoint được chọn theo loss thay vì theo kết quả đầu ra | Bắt buộc thực thi: khoảng trống giải mã, lựa chọn dựa trên thước đo tạo sinh; các trường hợp bị cắt độ dài được đếm và cảnh báo |
| Quy trình | Các khóa cấu hình không xác định; dữ liệu không-được-huấn-luyện; các lượt chạy mất kiểm soát | Bắt buộc thực thi |

Các thiếu sót đã biết, hiện chưa có mã xử lý: độ bao phủ của bộ tách từ, chất lượng dịch ngược, việc cắt ngắn theo phong cách ngôn ngữ, tỷ lệ dữ liệu chuẩn/tổng hợp, độ biến thiên giữa các seed khác nhau.

## Đầu ra cho các chương trình

`--json` đưa chính xác một tài liệu JSON ra stdout. Một trường hợp từ chối sẽ trả về `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` và mã thoát 2 (`details` được thêm vào đối với các trường hợp từ chối do phân tách và hàng rào dev). Mã thoát 1 là sự cố sập bất ngờ. `nmt-forge run` kết thúc với `RUN EXIT <code>` (0, 1, 2 hoặc 130); `run --detach` trả về 0 cùng tài liệu tác vụ. Lệnh `nmt-forge status --json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready", "blockers", "warnings", "answers"}}`.

## Tìm hiểu sâu hơn

- [Tài liệu tham khảo lệnh `nmt-forge`](/docs/network/getting-started/forge-command-reference) — mọi lệnh con và cờ.
- [Các quy tắc đo lường](/docs/agents/measurement) — ý nghĩa của các điểm số.
- [Trình dịch đầu tiên của bạn](/docs/your-first-translator) và [Cải thiện trình dịch](/docs/make-it-better) — các phiên bản dành cho cộng đồng.
- [Phục vụ và triển khai](/docs/agents/serving) — những gì một bản xuất lưu giữ.
