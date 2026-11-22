# Column matching and review

The workflow input helper suggests mappings from column names only. It uses case/spacing/Unicode normalization, explicit English/Vietnamese aliases and bigram/token similarity. No uploaded cell values are sent to an AI service. Scores are rule similarities, not calibrated probabilities or proof of business equivalence.

Each expected column needs a different input column. Ambiguous aliases, weak matches and competing assignments remain unselected. A unique exact normalized name takes priority over an alias. Review every dropdown. If an input contains extra columns, explicitly approve removing them from the derived version before previewing the exact workflow structure.

Preview shows old/new column order and the first ten resulting rows. Confirmation saves a new immutable dataset version using the typed `map_columns` operation. The original file and parsed version 1 remain unchanged. Missing fields cannot be invented by this helper. After alignment, rerun the workflow to validate its other rules. The same helper can review the lookup input.

## Reproducible evaluation

Run `PYTHONPATH=backend python -m app.evaluate_mapping --output docs/evaluation/schema-mapping.json` (PowerShell: set `PYTHONPATH` first). The fixture contains three validation and eight test scenarios, manually labelled by this project. The splits are small regression sets with known alias conventions; they are not an independent dataset or evidence of broad ML generalization. Threshold 0.78 and ambiguity margin 0.12 are explicit constants. No model is trained.

| Test-split decision measure | Normalized names only | Rules + similarity |
| --- | --- | --- |
| Fields reviewed | 16 | 16 |
| Suggested mappings | 5 | 10 |
| Correct suggestions | 5 | 10 |
| Abstentions | 11 | 6 |
| Suggestion coverage | 31.25% | 62.50% |

The six abstentions in the assisted case match the fixture's ambiguous/missing-field labels. All ten emitted test suggestions matched those labels. This is a count over the listed examples, not a claim of 100% accuracy on arbitrary spreadsheets. Full per-split counts, mistakes and canonical fixture SHA are in the generated JSON. Keep actual failures rather than changing labels to improve a score. Embeddings/paid LLMs remain optional roadmap work without measured benefit here.

The changed-November sample contains reordered/renamed headers and a `Comment` column. Its three unique order IDs are 201–203, with one duplicate order. The browser walkthrough deliberately encounters schema drift, reviews suggested names, approves dropping `Comment` from the derived version, previews, applies, then runs the saved deduplication recipe successfully.

Dataset listing and header inspection load metadata rather than uploaded binary/record payloads; a PostgreSQL test checks the generated listing query. PostgreSQL connections now have a five-second connection timeout and bounded pool waits so an unavailable server fails visibly instead of leaving requests waiting indefinitely.

## Tiếng Việt

Trong **Quy trình**, chọn bảng đầu vào rồi mở **Kiểm tra và khớp tên cột**. Gợi ý chỉ dựa vào tên cột và quy tắc từ đồng nghĩa. Kiểm tra các lựa chọn; trường hợp chưa rõ phải chọn thủ công. Điểm giống không phải xác suất đúng.

Nếu có cột dư, cần chủ động chấp nhận loại chúng khỏi phiên bản mới. Xem trước tên, thứ tự cột và dữ liệu trước khi xác nhận. Tệp nguồn không bị ghi đè. Sau đó chạy lại quy trình để kiểm tra toàn bộ điều kiện. Bộ đánh giá hiện tại chỉ là ví dụ tổng hợp nhỏ, không đại diện cho mọi dữ liệu thực tế.
