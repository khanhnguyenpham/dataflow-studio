# Synthetic fixtures

All rows are made for this project; they are not customer orders.

`inventory.csv` has five rows and four unique SKU/warehouse pairs: a duplicate SKU 004,
zero stock and a negative count that requires business review. Deduplicating by SKU
and Warehouse retains four rows and a quantity total of 19. Zero/negative values
must not be silently replaced. Codes 001–004 stay text.

`sales-missing-key.csv` has two orders, one matching product P01 and one unmatched
P999. With `products.csv`, strict left join must fail. Explicitly allowing unmatched
keys retains two rows and reports one unmatched row; inner join retains only one.
Neither operation may invent a product or silently change P999.

`monthly-sales.csv` has six rows, one duplicated row, one missing quantity, an invalid date (31 February), one non-numeric quantity and a deliberately large quantity. The large value is a review warning, not a confirmed error. IDs include leading zeros and must remain text. No transformation should silently repair the invalid date or infer the missing quantity.

`products.csv` is a unique product-code lookup for the four products in October. `next-month-sales.csv` has four rows, three unique order IDs and valid quantities/dates. These files can be loaded from the sample menu without uploading local files. The workflow browser test deduplicates October to five rows and joins product labels, then repeats that saved definition on November to produce three rows. This example does not claim October's remaining date/quantity defects were repaired by a join.

`next-month-variant.csv` contains the same kind of monthly sales with renamed/reordered columns, one duplicate order and an extra Comment column. The helper must preview alignment and explicitly ask before removing the extra column from a derived version. `schema-cases.json` provides small labelled header-only regression fixtures; results do not establish general ML accuracy.
